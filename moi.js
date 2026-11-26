/* ============================================================
   MOI · module privé de Versus
   Lit TON fichier « Portefeuille & Épargne » (son API Apps Script), directement depuis cet appareil.
   Rien de ce module ne passe par le fichier Versus partagé : l'adresse et la clé restent
   dans le stockage local de l'appareil, les chiffres ne sont envoyés à personne.
   Chargé à la demande (premier passage sur l'onglet Moi).
   Dépend des fonctions communes de Versus : eur, pct, esc, sens, ok, tracer, boiteGraphe,
   teinte, couleur, toast, stock, ETAT, MOIS, F0, F1, NB, MOINS, nf, reduit.
   ============================================================ */
(function () {
"use strict";
const K = { api: "versus.moi.api", cle: "versus.moi.cle", cache: "versus.moi.cache", cacheLe: "versus.moi.cacheLe", pref: "versus.moi.pref", refus: "versus.moi.refus" };
/* v16.83 · âge de la copie affichée quand le fichier ne répond pas */
function ageCopie() { const t = +stock.get(K.cacheLe) || 0; if (!t) return ""; const mn = Math.max(0, Math.round((Date.now() - t) / 60e3)); return mn < 1 ? "à l'instant" : mn < 60 ? "il y a " + mn + " min" : mn < 48 * 60 ? "il y a " + Math.round(mn / 60) + " h" : "il y a " + Math.round(mn / 1440) + " j"; }
function majuscule(t) { t = String(t || ""); return t.charAt(0).toUpperCase() + t.slice(1); }
const PREF = Object.assign({ onglet: "jour", patri: "fin", tri: "env", mode: "base", per: "6m", serie: "ip", moisMode: "eur", rep: "classe", acc: {} },
  (() => { try { return JSON.parse(stock.get(K.pref) || "{}"); } catch (e) { return {}; } })());
delete PREF.varP; delete PREF.var5;   // lot 50 (Théo) : la période d'Aujourd'hui (Jour · 5 j · 1 M…) n'est pas mémorisée : chaque ouverture repart sur « Jour »
delete PREF.million;
if (Array.isArray(PREF.ambOff)) { PREF.ambOff = PREF.ambOff.filter(x => x !== "tout"); if (!PREF.ambOff.length) delete PREF.ambOff; }   // lot 62 d : l'ancien interrupteur général « Non » est remis à « Oui »   // E (v16.93) : plus de mode « net » pour le million (ancienne préférence oubliée)
/* lot 27 (Conseil, validé par Théo) : Stats s'ouvre sur « Contre le marché », Mois par mois en €, Risque ouvert ; le patrimoine dans le temps part en FINANCIER.
   Migration unique : les anciens réglages par défaut enregistrés sur l'appareil ne doivent pas masquer les nouveaux. */
if (!PREF.stats27) { PREF.mode = "base"; PREF.moisMode = "eur"; PREF.patri = "fin"; delete PREF.acc["m-risque"]; delete PREF.effort; delete PREF.rendement; PREF.stats27 = 1; }
/* lot 50 (Théo, règle de tout Moi) : les rubriques dépliables reviennent repliées (ou à leur défaut) à chaque ouverture de l'appli ;
   leur état ne vaut que pendant la visite (PREF.acc en mémoire, jamais écrit sur l'appareil). Seuls les filtres sont mémorisés. */
PREF.acc = {};
function garderPref() { stock.set(K.pref, JSON.stringify(Object.assign({}, PREF, { acc: {} }))); }

let M = null;            // dernières données reçues de ton fichier
let RAW = null;          // profil simple : réponse brute de l'API (comptes, soldes, réglages)
let SRC = "";            // "api" | "cache"
let enCours = false, dernierAppel = 0, dernierFlap = "", erreur = "";

/* ---------- Format (complète ceux de Versus) ---------- */
const $m = s => document.querySelector("#v-moi " + s);
function cours(v) { return !ok(v) ? "—" : ETAT.discret === "oui" ? "•••" + NB + "€" : (v < 1 ? nf(4, 4) : nf(2, 2)).format(v) + NB + "€"; }
function qte(v) { return !ok(v) ? "—" : ETAT.discret === "oui" ? "•••" : nf(0, 6).format(v); }
function fleche(v) { const s = sens(v); return s === "up" ? "▲" : s === "down" ? "▼" : "■"; }
function dateNum(n) { const s = String(n); return new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)); }
function dateCourte(d) { return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); }
function dateLongue(d) { return d.getDate() + " " + MOIS[d.getMonth()] + " " + d.getFullYear(); }
function frDate(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : ""; }
function isoJour(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function kEur(v) { return ETAT.discret === "oui" ? "•••" : (Math.abs(v) >= 1000 ? sgn(v) + F1.format(Math.abs(v) / 1000) + "k" : sgn(Math.round(v)) + F0.format(Math.abs(v))); }
function sgn(v) { return v > 0 ? "+" : v < 0 ? MOINS : ""; }
function maCouleur() { try { return D ? couleur(M && M.personne ? M.personne : ETAT.moi) : "var(--p0)"; } catch (e) { return "var(--p0)"; } }

/* ---------- Styles (injectés une fois, tous préfixés par .moi) ---------- */
function injecterStyle() {
  if (document.getElementById("style-moi")) return;
  const st = document.createElement("style"); st.id = "style-moi";
  st.textContent = `
.moi { --c-bourse: #5B8DEF; --c-epargne: #E8B341; --c-av: #2EC4A0; --c-immo: #E07A52;   /* A (v16.93) : une couleur fixe par famille, distincte du violet de l'appli */
  --s1: var(--c-bourse); --s2: var(--c-epargne); --s3: var(--c-immo);
  --e1: #E8B341; --e2: #34C3AE; --e3: #C084FC; --e4: #FF8A5B; --e5: #7DD3FC;
  --flap: #1C222B; --flap-2: #262E39; --flap-ink: #F2F4F7; --flap-line: #0B0E12; --flap-acc: #B8A9FF; }
.moi .m-onglets { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 62px); z-index: 15; box-shadow: 0 6px 10px -6px var(--shade); }
.moi .m-hero { display: grid; gap: 10px; }
.moi .m-attente { display: grid; gap: 6px; padding: 14px 16px; border-radius: 14px; border: 1px dashed var(--rule); background: var(--panel); line-height: 1.45; }   /* v20.37 */
.moi .m-attente span { color: var(--ink-2); font-size: 14px; }
.moi .m-flaps { display: flex; flex-wrap: wrap; gap: 4px; }
.moi .m-flap { position: relative; width: clamp(26px, 8.4vw, 44px); height: clamp(40px, 12.6vw, 64px); display: grid; place-items: center; border-radius: 6px;
  background: linear-gradient(to bottom, var(--flap-2) 0 50%, var(--flap) 50% 100%); color: var(--flap-ink); font: 600 clamp(22px, 7.4vw, 40px)/1 var(--f-num);
  box-shadow: 0 1px 0 var(--flap-line), 0 4px 10px var(--shade); }
.moi .m-flap::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 2px; margin-top: -1px; background: var(--flap-line); }
.moi .m-flap.u, .moi .m-flap.s { color: var(--flap-acc); }
.moi .m-flap.sep { width: clamp(6px, 2vw, 10px); background: none; box-shadow: none; } .moi .m-flap.sep::after { display: none; }
.moi .m-flap.go { animation: mBascule .32s cubic-bezier(.3, .7, .3, 1) both; }
@keyframes mBascule { from { transform: rotateX(-88deg); } to { transform: rotateX(0); } }
.moi .m-flap.af-laiton { --flap: #3B2C12; --flap-2: #4B3A1A; --flap-ink: #F3DDA4; --flap-line: #1C1406; --flap-acc: #FFD27A; }
.moi .m-flap.af-ivoire { --flap: #E6DDC6; --flap-2: #F1EAD6; --flap-ink: #1B1F1C; --flap-line: #B3A88C; --flap-acc: #A35E0B; }
.moi .m-flap.af-nuit { --flap: #0E1C33; --flap-2: #172B4D; --flap-ink: #DCE7FF; --flap-line: #060D1A; --flap-acc: #7FB2FF; }
.moi .m-flap.af-gare { --flap: #5B1611; --flap-2: #701F17; --flap-ink: #F7E8CF; --flap-line: #2A0806; --flap-acc: #FFC15E; }
.moi .m-flap.af-terminal { overflow: hidden; border-radius: 3px; background: #021208; color: #39FF7A; font-weight: 500; text-shadow: 0 0 4px rgba(57,255,122,.9), 0 0 12px rgba(57,255,122,.45); box-shadow: inset 0 0 14px rgba(57,255,122,.14), 0 0 0 1px rgba(57,255,122,.22), 0 4px 10px var(--shade); }
.moi .m-flap.af-terminal::after { top: 0; bottom: 0; height: auto; margin: 0; background: repeating-linear-gradient(to bottom, transparent 0 2px, rgba(0,0,0,.38) 2px 3px); }
.moi .m-flap.af-terminal.u, .moi .m-flap.af-terminal.s { color: #C8FFD8; }
.moi .m-flap.af-terminal.go { animation: mTerm .5s steps(4) both; }
@keyframes mTerm { 0% { opacity: 0; } 50% { opacity: .6; } 75% { opacity: .2; } 100% { opacity: 1; } }
.moi .m-flap.af-led { overflow: hidden; border-radius: 4px; background: #0a0705; color: #FFB21E; font-weight: 800; text-shadow: 0 0 6px rgba(255,170,30,.9); box-shadow: inset 0 0 0 1px #2a1d0e, 0 4px 10px var(--shade); }
.moi .m-flap.af-led::after { top: 0; bottom: 0; height: auto; margin: 0; background: radial-gradient(circle at center, transparent 0 1.15px, #0a0705 1.6px) 0 0 / 4px 4px; }
.moi .m-flap.af-led.u, .moi .m-flap.af-led.s { color: #FF5A3C; text-shadow: 0 0 6px rgba(255,90,60,.9); }
.moi .m-flap.af-compteur { overflow: hidden; border-radius: 2px; background: linear-gradient(to bottom, #050505 0%, #2d2d2d 18%, #161616 50%, #2d2d2d 82%, #050505 100%); color: #F4F1EA; box-shadow: inset 0 0 0 1px #000, 0 0 0 2px #3a3a3a, 0 4px 10px var(--shade); }
.moi .m-flap.af-compteur::after { display: none; }
.moi .m-flap.af-compteur.u, .moi .m-flap.af-compteur.s { background: linear-gradient(to bottom, #2a0000, #9a0c0c 20%, #5a0606 50%, #9a0c0c 80%, #2a0000); color: #fff; }
.moi .m-flap.af-compteur.go { animation: mRoule .7s cubic-bezier(.2, .8, .3, 1) both; }
@keyframes mRoule { from { color: transparent; text-shadow: 0 -1.1em 0 #F4F1EA, 0 -2.2em 0 #F4F1EA, 0 -3.3em 0 #F4F1EA; } to { color: #F4F1EA; text-shadow: 0 0 0 transparent; } }
.moi .m-flap.af-neon { border-radius: 8px; background: #0b0614; color: #fff; font-weight: 400; text-shadow: 0 0 2px #fff, 0 0 6px #FF4FD8, 0 0 14px #FF4FD8, 0 0 28px #C026D3; box-shadow: inset 0 0 0 1px rgba(255,79,216,.35), 0 0 16px rgba(255,79,216,.22); }
.moi .m-flap.af-neon::after { display: none; }
.moi .m-flap.af-neon.u, .moi .m-flap.af-neon.s { text-shadow: 0 0 2px #fff, 0 0 6px #22D3EE, 0 0 14px #22D3EE, 0 0 28px #0891B2; box-shadow: inset 0 0 0 1px rgba(34,211,238,.35), 0 0 16px rgba(34,211,238,.22); }
.moi .m-flap.af-neon.go { animation: mNeon 1.1s linear both; }
@keyframes mNeon { 0% { opacity: 0; } 10% { opacity: .9; } 14% { opacity: .1; } 22% { opacity: 1; } 30% { opacity: .3; } 38%, 100% { opacity: 1; } }
.moi .m-flap.af-nixie { overflow: hidden; border-radius: 45% 45% 10px 10px / 22% 22% 10px 10px; background: radial-gradient(ellipse at 50% 35%, #2c1b12 0%, #120a06 60%, #050302 100%); color: #FFA05A; font-weight: 300;
  text-shadow: 0 0 4px #FF7A1A, 0 0 10px #FF5A00, 0 0 22px rgba(255,80,0,.6); box-shadow: inset 0 0 0 1px rgba(255,200,160,.18), inset 0 8px 12px rgba(255,255,255,.06), 0 4px 12px var(--shade); }
.moi .m-flap.af-nixie::after { top: 6%; bottom: 6%; left: 8%; right: 8%; height: auto; margin: 0; border-radius: inherit; background: repeating-linear-gradient(60deg, rgba(255,170,100,.09) 0 1px, transparent 1px 4px), repeating-linear-gradient(-60deg, rgba(255,170,100,.09) 0 1px, transparent 1px 4px); }
.moi .m-flap.af-nixie.go { animation: mNixie .9s ease-out both; }
@keyframes mNixie { from { color: #3a1d0a; text-shadow: none; } to { color: #FFA05A; } }
.moi .m-flap.af-lingot { overflow: hidden; border-radius: 0; clip-path: polygon(10% 0, 90% 0, 100% 100%, 0 100%); box-shadow: none; color: #5B3A0A; font-weight: 800;
  background: linear-gradient(160deg, #FFF3C4 0%, #F2C94C 25%, #B7832F 55%, #F7D774 75%, #9A6A1E 100%); text-shadow: 0 1px 0 rgba(255,255,255,.6), 0 -1px 0 rgba(0,0,0,.25); }
.moi .m-flap.af-lingot::after { top: 0; bottom: 0; height: auto; margin: 0; left: -60%; right: auto; width: 45%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.75), transparent); animation: mLingot 3.6s ease-in-out infinite; }
@keyframes mLingot { 0% { left: -60%; } 55%, 100% { left: 130%; } }
.moi .m-flap.af-lingot.u, .moi .m-flap.af-lingot.s { color: #3B2405; }
.moi .m-flap.af-prisme { border-radius: 8px; color: #fff; text-shadow: 0 1px 3px rgba(0,0,0,.5); box-shadow: 0 4px 14px rgba(185,140,255,.35);
  background: linear-gradient(120deg, #FF6B9A, #FFC15E, #E9F27A, #5CF0B5, #5AB8FF, #B98CFF, #FF6B9A); background-size: 300% 300%; animation: mPrisme 6s linear infinite; }
.moi .m-flap.af-prisme::after { background: rgba(255,255,255,.45); }
.moi .m-flap.af-prisme.go { animation: mBascule .32s cubic-bezier(.3, .7, .3, 1) both, mPrisme 6s linear infinite; }
@keyframes mPrisme { from { background-position: 0% 50%; } to { background-position: 300% 50%; } }
.moi .aff-g { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.moi .aff-c { position: relative; display: grid; gap: 3px; justify-items: center; align-content: start; text-align: center; padding: 10px 4px 8px; border-radius: 12px; border: 1px solid var(--rule); background: var(--panel); color: var(--ink); cursor: pointer; }
.moi .aff-c.on { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
.moi .aff-c .aff-v { position: relative; display: grid; place-items: center; height: 34px; }
.moi .aff-c .m-flaps { gap: 2px; flex-wrap: nowrap; }
.moi .aff-c .m-flap { width: 17px; height: 26px; font-size: 16px; border-radius: 3px; }
.moi .aff-c .m-flap.af-nixie { border-radius: 45% 45% 4px 4px / 22% 22% 4px 4px; }
.moi .aff-c.verrou .m-flaps { filter: saturate(.4) brightness(.55); }
.moi .aff-c .aff-l { position: absolute; font-style: normal; font-size: 15px; text-shadow: 0 1px 4px rgba(0,0,0,.6); }
.moi .aff-c b { font: italic 800 12.5px/1.1 var(--f-display); letter-spacing: .06em; text-transform: uppercase; }
.moi .aff-c small { font-size: 10.5px; line-height: 1.25; color: var(--ink-3); }
.moi .aff-c.on small { color: var(--accent-ink); font-weight: 600; }
.moi .aff-c .jauge { display: block; width: 80%; height: 3px; border-radius: 2px; background: var(--rule-2); overflow: hidden; }
.moi .aff-c .jauge i { display: block; height: 100%; background: var(--gold); }
.m-fete .mf-af { color: #F5C542; font-weight: 600; } .m-fete .wr-btn { justify-self: center; }
/* Thème de Moi : la carte du haut prend le fond du thème, l'onglet actif sa couleur */
#v-moi.th .m-hero { position: relative; padding: 14px 14px 16px; border-radius: 16px; background: var(--th-fond); color: #F4F5F8; box-shadow: inset 0 0 0 1px rgba(255,255,255,.08), 0 8px 20px var(--shade);
  --ink: #F4F5F8; --ink-2: rgba(244,245,248,.8); --ink-3: rgba(244,245,248,.58); --rule: rgba(255,255,255,.14); --rule-2: rgba(255,255,255,.1); --panel: rgba(255,255,255,.06); --panel-2: rgba(255,255,255,.08); --up: #4ADE80; --down: #FF6B6B; --up-bg: rgba(74,222,128,.14); --down-bg: rgba(255,107,107,.14); }
#v-moi.th .m-onglets button[aria-pressed="true"] { background: var(--mc); color: #0B0D12; }
.moi .m-hero { position: relative; }
.moi .m-titre-h { font-style: italic; text-transform: none; letter-spacing: .02em; opacity: .9; }
.moi .vs-expl { margin-top: 4px; font-size: 12px; opacity: .7; }
.moi .m-emb { font-style: normal; font-size: 15px; line-height: 1; margin-right: 6px; letter-spacing: 0; vertical-align: -1px; }
/* Profil */
.moi .vs-prof { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px 14px; border-radius: 16px; border: 1px solid var(--rule); background: var(--panel); }
.moi .vs-prof.th { color: #F4F5F8; border-color: transparent; box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); }
.moi .vs-av { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 50%; font-size: 27px; line-height: 1; background: var(--panel-2); box-shadow: inset 0 0 0 2px var(--mc); }
.moi .vs-prof.th .vs-av { background: rgba(255,255,255,.08); }
.moi .vs-prof b { display: block; font: italic 800 19px/1.1 var(--f-display); letter-spacing: .05em; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.moi .vs-prof small { display: block; margin-top: 3px; font-size: 13px; color: var(--ink-2); }
.moi .vs-prof.th small { color: rgba(244,245,248,.75); }
.moi .vs-n { text-align: right; font: 600 13px/1.1 var(--f-num); color: var(--ink-3); }
.moi .vs-n b { display: inline; font: 700 18px/1 var(--f-num); color: var(--ink); letter-spacing: 0; text-transform: none; font-style: normal; }
.moi .vs-prof.th .vs-n, .moi .vs-prof.th .vs-n b { color: #F4F5F8; }
.moi .vs-n small { display: block; font: 500 11px/1.2 var(--f-text); margin: 2px 0 0; }
/* v17.19 · Ma tenue (haut de Missions) + encart « Nouveau » */
.moi .vs-tenue { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 6px 8px; padding: 7px 8px 7px 12px; border-radius: 16px; border: 1px solid var(--rule); background: var(--panel); }   /* lot 51 : une seule rangée */
.moi .vs-tenue .vt-h { all: unset; box-sizing: border-box; display: grid; gap: 4px; cursor: pointer; }
.moi .vs-tenue .vt-h b { font: italic 800 12.5px/1 var(--f-display); letter-spacing: .05em; text-transform: uppercase; white-space: nowrap; }
.moi .vs-tenue .vt-h small { font: 500 11.5px/1 var(--f-num, var(--f-text)); color: var(--ink-3); white-space: nowrap; }
.moi .vs-tenue .vt-r { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; }
.moi .vs-tenue .vt-r.a7 { grid-template-columns: repeat(7, minmax(0, 1fr)); }   /* lot 62 d : + l'ambiance en cours */
.moi .vs-tenue .vt-o { all: unset; box-sizing: border-box; position: relative; min-width: 0; height: 38px; display: grid; place-items: center; padding: 0 1px; border-radius: 10px; background: var(--panel-2); border: 1px solid var(--rule-2, var(--rule)); cursor: pointer; }
.moi .vs-tenue .vt-o:focus-visible, .moi .vs-tenue .vt-h:focus-visible { outline: 2px solid var(--accent); }
.moi .vs-tenue .vt-p { height: 26px; width: 100%; display: grid; place-items: center; overflow: hidden; }
.moi .vs-tenue .vt-p .m-flaps { --fh: 17px; gap: 1px; flex-wrap: nowrap; }
.moi .vs-tenue .vt-p .m-flap { width: 13px; height: 19px; font-size: 12px; border-radius: 2px; box-shadow: none; }
.moi .vs-tenue .vt-p .m-flap::after { height: 1px; }
.moi .vs-tenue .vt-p .m-af { max-width: none; } .moi .vs-tenue .vt-p .t-ticket .tk-h, .moi .vs-tenue .vt-p .t-billet .bl-c, .moi .vs-tenue .vt-p .t-billet::after { display: none; }
.moi .vs-tenue .vt-p .vs-sw { width: 30px; height: 20px; } .moi .vs-tenue .vt-p .vs-cb { width: 34px; height: 18px; }
.moi .vs-tenue .vt-p .vs-em { font-size: 19px; }
.moi .vs-tenue .vt-n { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }   /* lot 51 : nom lu par le lecteur d'écran, pas affiché */
.moi .vs-tenue .vt-n .vt-c { display: none; }
.moi .vs-tenue > .vs-nv { grid-column: 1 / -1; }
.moi .vs-nv { display: flex; align-items: center; gap: 8px; padding: 7px 6px 7px 10px; border-radius: 12px; background: color-mix(in srgb, var(--gold) 14%, transparent); border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent); font-size: 12.5px; line-height: 1.3; }
.moi .vs-nv > span { flex: 1; min-width: 0; }
.moi .vs-nv .btn { padding: 6px 12px; font-size: 12.5px; }
.moi .vs-nv .vt-x { all: unset; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; color: var(--ink-3); cursor: pointer; font-size: 14px; }
.moi .vs-nv .vt-x:focus-visible { outline: 2px solid var(--accent); }
/* Vestiaire */
.moi .vs-o { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
.moi .vs-o .chip { display: grid; justify-items: center; gap: 3px; padding: 7px 3px 6px; border-radius: 10px; min-width: 0; }
.moi .vs-o .chip b { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.moi .vs-o .chip small { font: 500 10.5px/1 var(--f-num); color: var(--ink-3); }
.moi .vs-o .chip[aria-pressed="true"] small { color: inherit; opacity: .75; }
.moi .vs-o .chip[data-vt="amb"] { grid-column: -2; }   /* lot 62 c (Théo) : « Ambiances » tout à droite, après les autres onglets */
.moi .vs-g { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
.moi .vs-t { position: relative; min-width: 0; }
.moi .vs-b { all: unset; box-sizing: border-box; width: 100%; display: grid; justify-items: center; gap: 4px; padding: 8px 2px 7px; border-radius: 10px; border: 1px solid var(--rule); background: var(--panel); cursor: pointer; text-align: center; }
.moi .vs-b:focus-visible { outline: 2px solid var(--accent); }
.moi .vs-t.on .vs-b { border-color: var(--mc); box-shadow: 0 0 0 1.5px var(--mc); }
.moi .vs-t.vs-sel:not(.on) .vs-b { border-color: var(--ink-3); }
.moi .vs-p { position: relative; height: 30px; width: 100%; display: grid; place-items: center; overflow: hidden; }
.moi .vs-t.verrou .vs-p > :not(.vs-l) { filter: saturate(.35) brightness(.6); opacity: .8; }
.moi .vs-t.secret .vs-p > .vs-em { filter: none; opacity: 1; color: var(--ink-3); font: 800 20px/1 var(--f-display); }
.moi .vs-l { position: absolute; font-style: normal; font-size: 12px; right: 6px; bottom: 0; text-shadow: 0 1px 3px rgba(0,0,0,.5); }
.moi .vs-nm { max-width: 100%; padding: 0 3px; font-size: 10.5px; font-weight: 600; line-height: 1.25; color: var(--ink-2); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; hyphens: auto; }   /* lot 44 : « Ticket de caisse » sur 2 lignes, plus tronqué */
.moi .vs-t.verrou .vs-nm { color: var(--ink-3); }
.moi .vs-ok { position: absolute; top: 4px; left: 6px; font-size: 10px; font-weight: 800; color: var(--mc); }
.moi .vs-q { position: absolute; top: 3px; right: 3px; width: 18px; height: 18px; padding: 0; display: grid; place-items: center; border-radius: 50%; border: 1px solid var(--rule); background: var(--panel-2); color: var(--ink-3); font: 700 10.5px/1 var(--f-text); cursor: pointer; }
.moi .vs-q:focus-visible { outline: 2px solid var(--accent); }
.moi .vs-t.vs-sel .vs-q { background: var(--ink); color: var(--bg); border-color: var(--ink); }
/* aperçus */
.moi .vs-p .m-flaps { --fh: 17px; gap: 1px; flex-wrap: nowrap; }
.moi .vs-p .m-flap { width: 12px; height: 19px; font-size: 12px; border-radius: 2px; box-shadow: none; }
.moi .vs-p .m-flap::after { height: 1px; }
.moi .vs-p .m-af { max-width: none; } .moi .vs-p .t-ticket .tk-h, .moi .vs-p .t-billet .bl-c, .moi .vs-p .t-billet::after { display: none; }
.moi .vs-p .t-ticket { margin-bottom: 3px; padding: 2px 5px 3px; } .moi .vs-p .t-ticket::after { height: 3px; bottom: -3px; background-size: 5px 5px; }
.moi .vs-p .t-billet { padding: 2px 6px; } .moi .vs-p .t-carte { padding: 3px 6px; gap: 3px; }
.moi .vs-sw { position: relative; width: 44px; height: 26px; border-radius: 7px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.12); overflow: hidden; }
.moi .vs-sw.base { background: var(--panel-2); box-shadow: inset 0 0 0 1px var(--rule); }
.moi .vs-sw i { position: absolute; left: 6px; right: 14px; height: 3px; border-radius: 2px; background: rgba(255,255,255,.55); top: 8px; }
.moi .vs-sw.base i { background: var(--ink-3); }
.moi .vs-sw i + i { top: 15px; right: 22px; background: var(--sw); }
.moi .vs-cb { width: 52px; height: 24px; overflow: visible; }
.moi .vs-cb path { fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.moi .vs-cb path.x { display: none; }
.moi .vs-cb.fx-halo path.x { display: block; stroke-width: 6; opacity: .3; }
.moi .vs-cb.fx-comete path.x { display: block; stroke-width: 6; opacity: .45; filter: blur(1.5px); }
.moi .vs-cb.fx-etincelles path.x { display: block; stroke: var(--gold) !important; stroke-width: 3; stroke-dasharray: .1 5; animation: fxDefile 1.4s linear infinite; }
.moi .vs-cb.fx-flammes path.x { display: block; stroke-width: 4.5; opacity: .6; stroke-dasharray: 2 4; animation: fxDefile .9s linear infinite; }
.moi .vs-em { font-size: 22px; line-height: 1; }
.moi .vs-g2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.moi .vs-g2 .vs-b { min-height: 44px; align-content: center; padding: 9px 24px 9px 26px; }
.moi .vs-ti { max-width: 100%; font: italic 700 13px/1.15 var(--f-display); letter-spacing: .04em; color: var(--ink); text-wrap: balance; }
.moi .vs-t.verrou .vs-ti { color: var(--ink-3); }
.moi .vs-g2 .vs-l { left: 8px; right: auto; bottom: auto; top: 50%; transform: translateY(-50%); }
.moi .vs-g2 .vs-ok { top: 50%; left: 8px; transform: translateY(-50%); }
/* détail (le « ? ») */
.moi .vs-d { display: grid; gap: 10px; padding: 12px; border-radius: 12px; background: var(--panel-2); border: 1px solid var(--rule-2); }
.moi .vs-aide { margin: 0; font-size: 12.5px; color: var(--ink-3); }
.moi .vs-dl { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 10px; align-items: start; }
.moi .vs-di { width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; background: var(--panel); font: 800 17px/1 var(--f-display); color: var(--ink-3); }
.moi .vs-dl b { font: italic 800 15px/1.15 var(--f-display); letter-spacing: .05em; text-transform: uppercase; }
.moi .vs-dl small { font-size: 11.5px; color: var(--ink-3); }
.moi .vs-dl p { margin: 4px 0 0; font-size: 13px; line-height: 1.4; color: var(--ink-2); }
.moi .vs-dl .jauge { display: block; height: 5px; margin-top: 6px; } .moi .vs-dl .jauge i { background: var(--gold); }
.moi .vs-da { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; } .moi .vs-da:empty { display: none; }
.moi .vs-da .btn { padding: 9px 14px; font-size: 13px; }
.moi .vs-eq { font-size: 13px; font-weight: 600; color: var(--up); }
/* paliers : récompenses */
.moi .pl-r .pl-rec { display: flex; flex-wrap: wrap; gap: 4px 8px; }
.moi .pl-r .pl-rec span { white-space: nowrap; }
.moi .pl-r .pl-rec span.cache { color: var(--ink-3); }
/* fête : récompenses débloquées */
.m-fete .mf-recs { display: grid; gap: 8px; width: min(320px, 86vw); }
.m-fete .mf-rec { display: grid; grid-template-columns: 34px minmax(0, 1fr); grid-template-rows: auto auto; column-gap: 10px; align-items: center; text-align: left; padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(245,197,66,.45); background: rgba(255,255,255,.06); color: #F4F5F8; cursor: pointer; }
.m-fete .mf-rec > span { grid-row: span 2; font-size: 24px; line-height: 1; text-align: center; }
.m-fete .mf-rec b { font: italic 800 15px/1.15 var(--f-display); letter-spacing: .05em; text-transform: uppercase; }
.m-fete .mf-rec small { font-size: 12px; opacity: .7; }
.m-fete .mf-rec.fait { border-color: #3DDC97; } .m-fete .mf-rec.fait small { color: #3DDC97; opacity: 1; }
@media (max-width: 360px) { .moi .vs-g { gap: 5px; } .moi .vs-nm { font-size: 10px; } }
/* lot 44 · aperçus réduits des objets (Ce mois-ci, résumé des familles, fêtes) */
.moi .cm-ap, .moi .pb-ap, .moi .mf-ap { display: grid; place-items: center; overflow: hidden; flex: none; }
.moi .cm-ap .m-flaps, .moi .pb-ap .m-flaps, .moi .mf-ap .m-flaps { --fh: 17px; gap: 1px; flex-wrap: nowrap; }
.moi .cm-ap .m-flap, .moi .pb-ap .m-flap, .moi .mf-ap .m-flap { width: 13px; height: 19px; font-size: 12px; border-radius: 2px; box-shadow: none; }
.moi .cm-ap .m-flap::after, .moi .pb-ap .m-flap::after, .moi .mf-ap .m-flap::after { height: 1px; }
.moi .cm-ap .m-af, .moi .pb-ap .m-af, .moi .mf-ap .m-af { max-width: none; }
.moi :is(.cm-ap, .pb-ap, .mf-ap) :is(.t-ticket .tk-h, .t-billet .bl-c, .t-billet::after) { display: none; }
.moi :is(.cm-ap, .pb-ap, .mf-ap) .vs-sw { width: 34px; height: 22px; } .moi :is(.cm-ap, .pb-ap, .mf-ap) .vs-cb { width: 40px; height: 20px; }
.moi :is(.cm-ap, .pb-ap, .mf-ap) .vs-em { font-size: 20px; }
.moi .nw { white-space: nowrap; }
/* lot 44 · carte « Ce mois-ci » */
.moi .m-cemois { display: grid; gap: 4px; padding: 9px 12px 10px; border-radius: 16px; border: 1px solid color-mix(in srgb, var(--gold) 50%, var(--rule)); background: color-mix(in srgb, var(--gold) 9%, var(--panel)); }
.moi .m-cemois.fait { border-color: color-mix(in srgb, var(--up) 55%, var(--rule)); background: color-mix(in srgb, var(--up) 10%, var(--panel)); }
.moi .m-cemois .cm-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 26px; margin: -2px -4px 0 0; }
.moi .m-cemois .cm-k { font: 700 11px/1 var(--f-display); letter-spacing: .14em; text-transform: uppercase; color: var(--gold); }
.moi .m-cemois.fait .cm-k, .moi .m-cemois.fait .cm-t b { color: var(--up); }
.moi .m-cemois .cm-t { margin: 0; font-size: 15px; line-height: 1.3; color: var(--ink); }
.moi .m-cemois .cm-s { margin: 0; font-size: 13px; line-height: 1.35; color: var(--ink-2); }
.moi .m-cemois .cm-pt { margin: 0; font-size: 12.5px; line-height: 1.35; color: var(--ink-2); } .moi .m-cemois .cm-pt b { color: var(--ink); white-space: nowrap; }
.moi .m-cemois .cm-cf { display: flex; align-items: center; gap: 6px; margin-top: 2px; font-size: 11px; color: var(--ink-2); }   /* lot 56 · carte de fidélité */
.moi .m-cemois .cf-k, .moi .m-cemois .cf-n { flex: none; font: 700 11px/1 var(--f-display); letter-spacing: .04em; } .moi .m-cemois .cf-n { color: var(--ink); }
.moi .m-cemois .cf-c { flex: 1; min-width: 0; display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 3px; }
.moi .m-cemois .cf-c i { font-style: normal; display: grid; place-items: center; height: 19px; border-radius: 50%; font: 600 9.5px/1 var(--f-display); border: 1px dashed var(--rule); color: var(--ink-2); opacity: .75; }
.moi .m-cemois .cf-c i.cf-ok { border: 1.5px solid var(--up); background: color-mix(in srgb, var(--up) 22%, transparent); color: var(--up); opacity: 1; font-size: 11px; transform: rotate(-8deg); }
.moi .m-cemois .cf-c i.cf-jk { border-style: solid; opacity: 1; font-size: 10px; }
.moi .m-cemois .cf-c i.cf-cour { border: 1.5px dashed var(--gold); color: var(--gold); opacity: 1; }
.moi .m-cemois .cf-c i.cf-rate { opacity: .35; text-decoration: line-through; } .moi .m-cemois .cf-c i.cf-hors { opacity: .3; border-style: dotted; }
/* lot 51 · couronne du million (détail replié) */
.moi .mi-haut { display: flex; justify-content: flex-end; }
.moi .mi-cour { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 5px; min-height: 30px; padding: 3px 10px 3px 8px; border-radius: 999px; cursor: pointer; white-space: nowrap;
  border: 1px solid color-mix(in srgb, #F5C542 55%, transparent); background: color-mix(in srgb, #F5C542 12%, var(--panel)); color: var(--ink); }
.moi .mi-cour .mi-c { font-size: 15px; line-height: 1; }
.moi .mi-cour b { font: italic 800 14px/1 var(--f-display); letter-spacing: .02em; color: color-mix(in srgb, #F5C542 70%, var(--ink)); }
.moi .mi-cour i { font-style: normal; font-size: 10px; color: var(--ink-3); }
.moi .mi-cour[aria-expanded="true"] { background: color-mix(in srgb, #F5C542 24%, var(--panel)); }
.moi .mi-cour:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.moi .mi-det[hidden] { display: none; }
/* lot 51 · Récompenses : récemment gagnées / à venir */
.moi .m-recs { display: grid; gap: 8px; padding: 9px 10px 10px; border-radius: 16px; border: 1px solid var(--rule); background: var(--panel); }
.moi .m-recs .rc-l { display: grid; gap: 5px; }
.moi .m-recs .rc-k { font: 700 10.5px/1 var(--f-display); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); padding-left: 2px; }
.moi .m-recs .rc-g { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
.moi .m-recs .rc-c { all: unset; box-sizing: border-box; position: relative; overflow: hidden; min-width: 0; display: grid; justify-items: center; align-content: start; gap: 2px; padding: 5px 4px 6px; border-radius: 11px; background: var(--panel-2); border: 1px solid var(--rule-2, var(--rule)); text-align: center; }
.moi .m-recs button.rc-c { cursor: pointer; } .moi .m-recs button.rc-c:focus-visible { outline: 2px solid var(--accent); }
.moi .m-recs .rc-c.av { border-style: dashed; }
.moi .m-recs .rc-ap { position: relative; height: 22px; width: 100%; display: grid; place-items: center; overflow: hidden; }
.moi .m-recs .rc-c b { max-width: 100%; font: 700 11.5px/1.2 var(--f-text); color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.moi .m-recs .rc-c b em { font-style: normal; color: var(--ink-3); font-weight: 600; }
.moi .m-recs .rc-c small { font-size: 10.5px; line-height: 1.2; color: var(--ink-3); }
.moi .m-recs .rc-c.av small { color: var(--ink-2); }
.moi .rc-ap .m-flaps { --fh: 15px; gap: 1px; flex-wrap: nowrap; }
.moi .rc-ap .m-flap { width: 11px; height: 16px; font-size: 10.5px; border-radius: 2px; box-shadow: none; } .moi .rc-ap .m-flap::after { height: 1px; }
.moi .rc-ap .m-af { max-width: none; } .moi .rc-ap :is(.t-ticket .tk-h, .t-billet .bl-c, .t-billet::after) { display: none; }
.moi .rc-ap .vs-sw { width: 30px; height: 18px; } .moi .rc-ap .vs-cb { width: 34px; height: 17px; } .moi .rc-ap .vs-em { font-size: 17px; }
/* lot 44 · groupes de familles, aide repliée, récompense suivante */
.moi details.pl-grp { border-radius: 12px; }
.moi details.pl-grp > summary { list-style: none; cursor: pointer; padding: 10px 12px; border-radius: 12px; border: 1px dashed var(--rule); font-size: 13.5px; font-weight: 600; color: var(--ink-2); }
.moi details.pl-grp > summary::-webkit-details-marker, .moi details.pl-aide > summary::-webkit-details-marker { display: none; }
.moi details.pl-grp > summary::after { content: " ›"; } .moi details.pl-grp[open] > summary::after { content: " ‹"; }
.moi details.pl-grp > summary small { font: 500 12px/1 var(--f-num); color: var(--ink-3); }
.moi details.pl-grp[data-grp="_finies"] > summary { color: var(--up); border-style: solid; border-color: color-mix(in srgb, var(--up) 35%, var(--rule)); }
.moi details.pl-grp > .pl-blocs { margin-top: 8px; }
.moi details.pl-aide { margin: -4px 0 8px; font-size: 12.5px; color: var(--ink-3); }
.moi details.pl-aide > summary { list-style: none; cursor: pointer; display: inline-block; color: var(--ink-2); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
.moi details.pl-aide p { margin: 4px 0 0; }
.moi .pl-bloc .pb-r { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; font-size: 12px; line-height: 1.3; color: var(--ink-2); white-space: normal; font-weight: 500; }
.moi .pl-bloc .pb-r b { color: var(--gold); font-weight: 700; }
.moi .pl-bloc .pb-ap { width: 42px; height: 24px; }
/* lot 44 · fête : le vrai objet et « Équiper » en avant */
.m-fete .mf-rec { grid-template-columns: 52px minmax(0, 1fr) auto; }
.m-fete .mf-rec .mf-ap { grid-row: span 2; width: 52px; height: 32px; font-size: 24px; }
.m-fete .mf-rec .mf-eq { grid-column: 3; grid-row: 1 / span 2; font-style: normal; padding: 7px 12px; border-radius: 999px; background: #F5C542; color: #1A1406; font: 700 12.5px/1 var(--f-text); white-space: nowrap; }
.m-fete .mf-rec.fait .mf-eq { background: #3DDC97; }
.m-fete .mf-l { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; font-size: 13.5px; opacity: .85; text-align: left; }
.moi .m-flaps { --fh: clamp(40px, 12.6vw, 64px); }
.m-million .mm-flaps { --fh: clamp(32px, 10vw, 48px); }
.moi .aff-c .m-flaps { --fh: 24px; }
.moi .m-af { position: relative; display: inline-flex; flex-wrap: wrap; align-items: center; max-width: 100%; }
/* Tambours (compteur à rouleaux) */
.moi .t-tambour { gap: 2px; padding: calc(var(--fh) * .07); border-radius: calc(var(--fh) * .1); background: linear-gradient(#4a4a4a, #141414); box-shadow: inset 0 0 0 1px #000, 0 0 0 2px #8a8a8a, 0 0 0 3px #2a2a2a, 0 4px 12px var(--shade); }
.moi .od { position: relative; width: calc(var(--fh) * .6); height: var(--fh); overflow: hidden; border-radius: 2px; background: #0d0d0d; color: #F4F1EA; font: 600 calc(var(--fh) * .6)/var(--fh) var(--f-num); text-align: center; }
.moi .od b { display: block; height: var(--fh); font-weight: 600; }
.moi .od-r { display: block; transform: translateY(calc(var(--d) * var(--fh) * -1)); }
.moi .od-r.go { animation: mOd 1.3s cubic-bezier(.2, .75, .25, 1) both; }
@keyframes mOd { from { transform: translateY(0); } }
.moi .od::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to bottom, rgba(0,0,0,.8), rgba(0,0,0,0) 32%, rgba(255,255,255,.07) 50%, rgba(0,0,0,0) 68%, rgba(0,0,0,.8)); }
.moi .od.u { background: #8a0d0d; }
.moi .od-sep { width: calc(var(--fh) * .14); }
/* Sept segments */
.moi .t-seg { gap: calc(var(--fh) * .06); padding: calc(var(--fh) * .12) calc(var(--fh) * .16); border-radius: calc(var(--fh) * .1); }
.moi .t-seg svg { height: calc(var(--fh) * .82); width: calc(var(--fh) * .82 * 44 / 70); overflow: visible; }
.moi .t-seg .sg-x { font: 600 calc(var(--fh) * .58)/1 var(--f-num); min-width: calc(var(--fh) * .3); text-align: center; }
.moi .t-seg .sg-sep { width: calc(var(--fh) * .12); }
.moi .t-seg.calc { background: linear-gradient(170deg, #b4c29d, #95a57e); box-shadow: inset 0 2px 7px rgba(0,0,0,.4), 0 0 0 3px #44474b, 0 0 0 5px #1f2022, 0 4px 12px var(--shade); }
.moi .t-seg.calc rect { fill: rgba(28,40,24,.09); } .moi .t-seg.calc rect.l { fill: #1c2818; } .moi .t-seg.calc .sg-x { color: #1c2818; }
.moi .t-seg.reveil { background: #0c0303; box-shadow: inset 0 0 0 1px #2a0b08, 0 0 0 3px #1b1b1b, 0 4px 12px var(--shade); }
.moi .t-seg.reveil rect { fill: rgba(255,58,40,.08); } .moi .t-seg.reveil rect.l { fill: #ff3a28; }
.moi .t-seg.reveil svg { filter: drop-shadow(0 0 3px rgba(255,58,40,.75)); } .moi .t-seg.reveil .sg-x { color: #ff3a28; text-shadow: 0 0 6px rgba(255,58,40,.8); }
.moi .t-seg.go svg, .moi .t-seg.go .sg-x { animation: mSeg .6s steps(1) both; }
@keyframes mSeg { 0% { opacity: 0; } 30% { opacity: 1; } 45% { opacity: .15; } 60%, 100% { opacity: 1; } }
/* Matrice de points */
.moi .t-mat { gap: calc(var(--fh) * .1); padding: calc(var(--fh) * .14) calc(var(--fh) * .18); border-radius: calc(var(--fh) * .08); background: #0b0705; box-shadow: inset 0 0 0 1px #2a1d0e, 0 0 0 2px #151515, 0 4px 12px var(--shade); }
.moi .t-mat svg { height: calc(var(--fh) * .78); width: calc(var(--fh) * .78 * 5 / 7); filter: drop-shadow(0 0 2px rgba(255,170,30,.7)); }
.moi .t-mat circle { fill: #170f05; } .moi .t-mat circle.l { fill: #FFB21E; }
.moi .t-mat .mt-sep { width: calc(var(--fh) * .1); }
.moi .t-mat.go svg { animation: mMat .5s steps(3) both; }
@keyframes mMat { from { opacity: 0; } to { opacity: 1; } }
/* Ticket de caisse */
.moi .t-ticket { flex-direction: column; align-items: stretch; flex-wrap: nowrap; margin-bottom: 7px; padding: calc(var(--fh) * .16) calc(var(--fh) * .32) calc(var(--fh) * .22); background: #FBF8F1; color: #1d1d1b; transform: rotate(-1.2deg); box-shadow: 0 6px 12px var(--shade); }
.moi .t-ticket::after { content: ""; position: absolute; left: 0; right: 0; bottom: -6px; height: 6px; background: linear-gradient(135deg, #FBF8F1 33%, transparent 33%) 0 0 / 8px 8px repeat-x, linear-gradient(225deg, #FBF8F1 33%, transparent 33%) 0 0 / 8px 8px repeat-x; }
.moi .t-ticket .tk-h { display: flex; justify-content: space-between; gap: 12px; padding-bottom: 3px; margin-bottom: 4px; border-bottom: 1px dashed #8a877f; font: 700 calc(var(--fh) * .2)/1.2 "Courier New", ui-monospace, monospace; letter-spacing: .18em; color: #55534d; }
.moi .t-ticket .tk-v { font: 700 calc(var(--fh) * .66)/1.05 "Courier New", ui-monospace, monospace; letter-spacing: -.02em; white-space: nowrap; }
.moi .t-ticket .tk-v i { font-style: normal; } .moi .t-ticket .tk-v i.tk-s { display: inline-block; width: .3em; }
.moi .t-ticket.go .tk-v i { animation: mTk .01s steps(1) both; }
@keyframes mTk { from { visibility: hidden; } }
/* Billet de banque */
.moi .t-billet { flex-direction: column; align-items: flex-start; flex-wrap: nowrap; overflow: hidden; padding: calc(var(--fh) * .14) calc(var(--fh) * .9) calc(var(--fh) * .14) calc(var(--fh) * .26); border-radius: 4px; color: #23473a;
  background: radial-gradient(circle at calc(100% - var(--fh) * .45) 50%, rgba(35,71,58,.18) 0 calc(var(--fh) * .3), transparent calc(var(--fh) * .31)),
    repeating-radial-gradient(circle at 0 120%, transparent 0 3px, rgba(35,71,58,.12) 3px 4px), repeating-radial-gradient(circle at 100% -20%, transparent 0 3px, rgba(120,80,40,.1) 3px 4px),
    linear-gradient(120deg, #ECE6CC, #D8DFC4 45%, #EADBBD);
  box-shadow: inset 0 0 0 3px #ECE6CC, inset 0 0 0 4px #23473a, inset 0 0 0 6px #ECE6CC, inset 0 0 0 7px rgba(35,71,58,.5), 0 4px 12px var(--shade); }
.moi .t-billet::after { content: "€"; position: absolute; right: calc(var(--fh) * .3); top: 50%; transform: translateY(-50%); font: 700 calc(var(--fh) * .32)/1 Georgia, "Times New Roman", serif; color: rgba(35,71,58,.55); }
.moi .t-billet .bl-c { font: 700 calc(var(--fh) * .15)/1.2 Georgia, "Times New Roman", serif; letter-spacing: .32em; color: rgba(35,71,58,.75); }
.moi .t-billet .bl-v { font: 700 calc(var(--fh) * .66)/1.05 Georgia, "Times New Roman", serif; letter-spacing: .01em; white-space: nowrap; text-shadow: 0 1px 0 rgba(255,255,255,.7), 0 -1px 0 rgba(0,0,0,.12); }
.moi .t-billet.go .bl-v { animation: mEncre 1s ease-out both; }
@keyframes mEncre { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
/* Carte black */
.moi .t-carte { gap: calc(var(--fh) * .22); flex-wrap: nowrap; overflow: hidden; padding: calc(var(--fh) * .2) calc(var(--fh) * .32); border-radius: calc(var(--fh) * .16);
  background: repeating-linear-gradient(115deg, rgba(255,255,255,.025) 0 2px, transparent 2px 5px), linear-gradient(135deg, #2b2b2e, #0d0d0f 55%, #222226); box-shadow: inset 0 0 0 1px rgba(255,255,255,.12), 0 6px 14px var(--shade); }
.moi .t-carte .ca-puce { flex: none; width: calc(var(--fh) * .48); height: calc(var(--fh) * .36); border-radius: calc(var(--fh) * .06);
  background: linear-gradient(90deg, transparent 32%, rgba(0,0,0,.28) 32% 36%, transparent 36% 64%, rgba(0,0,0,.28) 64% 68%, transparent 68%), linear-gradient(transparent 46%, rgba(0,0,0,.28) 46% 54%, transparent 54%), linear-gradient(135deg, #f3dc95, #b9913f 55%, #e8cd7d); }
.moi .t-carte .ca-v { font: 600 calc(var(--fh) * .56)/1 var(--f-num); letter-spacing: .06em; white-space: nowrap; color: #d9d9de;
  background: linear-gradient(180deg, #ffffff, #b9bac2 55%, #8d8e96); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(1px 1px 0 rgba(0,0,0,.9)) drop-shadow(-1px -1px 0 rgba(255,255,255,.18)); }
.moi .t-carte::after { content: ""; position: absolute; top: 0; bottom: 0; left: -60%; width: 40%; background: linear-gradient(100deg, transparent, rgba(255,255,255,.14), transparent); animation: mLingot 5s ease-in-out infinite; }
/* Cartes de choix */
.moi .aff-c .t-ticket .tk-h, .moi .aff-c .t-billet .bl-c { display: none; }
.moi .aff-c .t-ticket { margin-bottom: 4px; }
.moi .aff-c .t-ticket::after { height: 4px; bottom: -4px; background-size: 6px 6px; }
.moi .aff-c .m-af { max-width: none; }
.moi .aff-c .aff-v { height: 40px; }
.moi .aff-c i.aff-t { font-style: normal; font-size: 9.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
@media (prefers-reduced-motion: reduce) { .moi .od-r.go, .moi .t-seg.go svg, .moi .t-seg.go .sg-x, .moi .t-mat.go svg, .moi .t-ticket.go .tk-v i, .moi .t-billet.go .bl-v, .moi .t-carte::after { animation: none; } }
/* Paliers en blocs dépliables */
.moi .pl-blocs { display: grid; gap: 8px; }
.moi details.pl-bloc { border: 1px solid var(--rule); border-radius: 12px; background: var(--panel); }
.moi details.pl-bloc > summary { list-style: none; cursor: pointer; display: grid; grid-template-columns: minmax(0, 1fr) auto 14px; gap: 5px 10px; align-items: center; padding: 11px 12px; }
.moi details.pl-bloc > summary::-webkit-details-marker { display: none; }
.moi details.pl-bloc > summary::after { content: ""; grid-column: 3; grid-row: 1; width: 8px; height: 8px; border-right: 2px solid var(--ink-3); border-bottom: 2px solid var(--ink-3); transform: rotate(45deg) translate(-2px, -2px); transition: transform .2s; }
.moi details.pl-bloc[open] > summary::after { transform: rotate(225deg) translate(-2px, -2px); }
.moi details.pl-bloc > summary:focus-visible { outline: 2px solid var(--accent); border-radius: 12px; }
.moi .pl-bloc .pb-t { font: italic 800 14.5px/1.15 var(--f-display); letter-spacing: .06em; text-transform: uppercase; }
.moi .pl-bloc .pb-n { font: 600 12.5px/1 var(--f-num); color: var(--ink-2); }
.moi .pl-bloc.complet .pb-n { color: var(--up); }
.moi .pl-bloc .jauge { grid-column: 1 / -1; height: 4px; }
.moi .pl-bloc .jauge i { background: var(--gold); }
.moi .pl-bloc .pb-s { grid-column: 1 / -1; font-size: 12px; line-height: 1.35; color: var(--ink-3); }
.moi .pl-bloc .pb-s b { color: var(--ink-2); font-weight: 600; }
.moi .pl-bloc .pb-r { color: var(--gold); font-weight: 600; white-space: nowrap; }
.moi .pl-bloc > .pl-liste { padding: 0 12px 6px; border-top: 1px solid var(--rule-2); }
.moi .pl-bloc > .pl-liste .pl-r:last-child { border-bottom: 0; }
.moi .pl-r .pl-rec { font-style: normal; font-size: 11.5px; font-weight: 600; color: var(--gold); }
.moi .m-rappel { display: flex; align-items: center; gap: 10px; margin: 10px 0 4px; padding: 10px 12px; border-radius: 14px; background: color-mix(in srgb, var(--gold) 14%, var(--card, transparent)); border: 1px solid color-mix(in srgb, var(--gold) 45%, transparent); }
.moi.sans-aide .aide, .moi.sans-aide .guide-l { display: none !important; }
.nt-l { display: grid; gap: 8px; }
.nt-l .m-h4 { margin: 6px 0 0; }
.nt { display: flex; align-items: center; gap: 10px; padding: 11px 12px; border-radius: 14px; border: 1px solid var(--rule); background: var(--panel); }
.nt .nt-ic { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 14px; }
.nt.orange .nt-ic { background: color-mix(in srgb, var(--gold) 20%, transparent); color: var(--gold); } .nt.orange { border-color: color-mix(in srgb, var(--gold) 45%, var(--rule)); }
.nt.rouge .nt-ic { background: color-mix(in srgb, var(--down) 18%, transparent); color: var(--down); } .nt.rouge { border-color: color-mix(in srgb, var(--down) 45%, var(--rule)); }
.nt.vert .nt-ic { background: var(--up-bg, color-mix(in srgb, var(--up) 18%, transparent)); color: var(--up); }
.nt .nt-t { flex: 1; min-width: 0; display: grid; gap: 2px; } .nt .nt-t b { font-size: 14.5px; } .nt .nt-t small { font-size: 12.5px; color: var(--ink-2); }
.nt .nt-a { display: grid; gap: 4px; justify-items: end; flex: none; }
.nt-rep { margin: 0; font-size: 12px; color: var(--ink-3); }
.nt-tous { all: unset; box-sizing: border-box; cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 12px; margin-top: 4px; border-radius: 12px; border: 1px dashed var(--rule); font-size: 13.5px; font-weight: 600; color: var(--ink-2); }
.nt-tous span { font-size: 18px; }
.moi .rac-g { display: inline-flex; gap: 2px; } .moi .rac-g .chip.suppr { padding-inline: 10px; }
.moi .maj-pli { margin-top: 10px; border: 1px solid var(--rule); border-radius: 12px; padding: 0 12px; }
.moi .maj-pli > summary { cursor: pointer; padding: 12px 0; font-weight: 700; font-size: 14px; } .moi .maj-pli > summary small { font-weight: 400; color: var(--ink-3); margin-left: 6px; font-size: 12px; }
.moi .maj-pli[open] { padding-bottom: 12px; }
.moi .rap-autres { margin-top: 6px; } .moi .rap-autres > summary { cursor: pointer; font-size: 13px; color: var(--ink-2); padding: 6px 2px; }
.moi .m-rappel .ic { color: var(--gold); font-weight: 700; }
.moi .m-rappel .t { flex: 1; display: grid; font-size: 14px; line-height: 1.25; }
.moi .m-rappel .t small { font-size: 12px; color: var(--ink-2); }
.moi .m-rappel .lien { white-space: nowrap; }
.moi .av-t > div:nth-child(2) .sub { font-size: 11px; }
.moi .pret-an { padding: 10px; } .moi .pret-an .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11.5px; color: var(--ink-2); margin-bottom: 6px; }
.moi .pret-an .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; border: 5px solid; margin-right: 5px; vertical-align: -1px; box-sizing: border-box; }
.moi .pret-an .legend .pa { color: var(--ink-3); } .moi .pret-an-t { margin: 6px 2px 0; font-size: 12.5px; color: var(--ink-2); line-height: 1.45; }
.moi .av-stack { margin: 10px 0 8px; }
.moi .av-sups { display: grid; gap: 6px; }
.moi .av-s { all: unset; box-sizing: border-box; cursor: pointer; display: flex; justify-content: space-between; gap: 10px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--rule); background: var(--panel); }
.moi .av-s[aria-pressed="true"] { border-color: var(--c, var(--accent)); box-shadow: inset 3px 0 0 var(--c, var(--accent)); }
.moi .av-n { display: grid; gap: 2px; min-width: 0; } .moi .av-n b { font-size: 14px; display: flex; align-items: center; gap: 6px; } .moi .av-n small { font-size: 11.5px; color: var(--ink-3); }
.moi .av-n i { width: 9px; height: 9px; border-radius: 3px; background: var(--c); display: inline-block; margin-right: 6px; }
.moi .av-v { display: grid; justify-items: end; gap: 2px; flex: none; } .moi .av-v b { font: 600 14.5px/1 var(--f-num); } .moi .av-v small { font-size: 11.5px; color: var(--ink-2); }
.moi .av-tout { justify-content: center; font-size: 13px; font-weight: 600; color: var(--ink-2); }
.moi .av-courbe { margin-top: 10px; padding: 10px; border: 1px solid var(--rule); border-radius: 12px; background: var(--panel); }
.moi .av-leg { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 11.5px; color: var(--ink-2); margin-top: 4px; }
.moi .av-leg i { display: inline-block; width: 12px; height: 3px; border-radius: 2px; margin-right: 5px; vertical-align: middle; } .moi .av-leg i.pt { background: repeating-linear-gradient(90deg, var(--ink-3) 0 4px, transparent 4px 7px); } .moi .av-leg i.rd { width: 7px; height: 7px; border-radius: 50%; }
.moi .av-rdv { display: grid; gap: 6px; } .moi .av-rdv > div { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; } .moi .av-rdv > div > span { flex: 1; } .moi .av-rdv .mini-btn { flex: none; } .moi .av-rdv i { font-style: normal; } .moi .av-rdv small { display: block; color: var(--ink-3); font-size: 12px; }
/* 19/11 · pastille Jour | 5 j en haut à droite de la carte (remplace le bandeau « Voir la semaine ») */
/* lot 58 (Théo : « les jours, les réduire comme sur les Marchés ; Face aux marchés à côté, juste une icône ») : la rangée de périodes reprend
   les petites pastilles des Marchés (.chips.m-filtre, ~30 px), l'icône 📈 à sa droite (zone tactile 40×40, marges négatives : la rangée garde ~30 px) */
.moi .m-hero-t { display: flex; align-items: center; gap: 6px; min-width: 0; }   /* lot 62 : titre de la carte + 📈 sur la même ligne */
.moi .m-hero-t .eyebrow { flex: 1 1 auto; min-width: 0; }
.moi .m-vsmk { all: unset; box-sizing: border-box; flex: none; margin: -5px -5px -5px auto; min-width: 40px; height: 40px; padding: 0 5px; display: grid; place-items: center; cursor: pointer; border-radius: 50%; -webkit-tap-highlight-color: transparent; }
.moi .m-vsmk span { height: 30px; padding: 0 10px; display: grid; place-items: center; border-radius: 15px; white-space: nowrap; font-weight: 700; color: var(--ink-2); background: var(--panel-2); border: 1px solid var(--rule-2); font-size: 15px; line-height: 1; box-sizing: border-box; }
.moi .m-vsmk:active span { background: var(--panel); }
.moi .m-vsmk:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.moi .m-jour .m-maj { margin: 0; font-size: 11px; }
.moi .m-per-n { flex-basis: 100%; margin-top: -3px; font-size: 11.5px; color: var(--ink-3); }
.moi .m-jour[role="button"] { cursor: pointer; -webkit-tap-highlight-color: transparent; }
.moi .m-5j-v { font-style: normal; opacity: .7; margin-left: 2px; }
.moi .m-5j { display: grid; gap: 5px; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--rule); background: var(--panel); }
.moi .m-5j .l { display: grid; grid-template-columns: 70px minmax(0, 1fr) 62px 62px; align-items: center; gap: 8px; font-size: 12.5px; }
.moi .m-5j .j { color: var(--ink-2); }
.moi .m-5j .bar { height: 6px; border-radius: 3px; background: var(--rule-2); overflow: hidden; }
.moi .m-5j .bar i { display: block; height: 100%; border-radius: 3px; background: var(--ink-3); } .moi .m-5j .bar i.up { background: var(--up); } .moi .m-5j .bar i.down { background: var(--down); }
.moi .m-5j b { font: 600 12.5px/1 var(--f-num); text-align: right; } .moi .m-5j small { font: 500 11.5px/1 var(--f-num); text-align: right; color: var(--ink-2); }
.moi .m-5j b.up, .moi .m-5j small.up { color: var(--up); } .moi .m-5j b.down, .moi .m-5j small.down { color: var(--down); }
.moi .m-5j p { margin: 2px 0 0; font-size: 11px; line-height: 1.35; color: var(--ink-3); }
.moi .m-maj { display: block; margin-top: 4px; font-size: 11px; color: var(--ink-3, var(--ink-2)); opacity: .8; }
.moi .m-jour { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; font-size: 13px; color: var(--ink-2); }
.moi .m-status { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--ink-3); }
.moi .m-status i { font-style: normal; display: inline-flex; align-items: center; gap: 6px; }
.moi .m-status i::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: var(--ink-3); }
.moi .m-status i.on::before { background: var(--up); box-shadow: 0 0 0 3px var(--up-bg); }
.moi .tuiles > .m-def-t { cursor: pointer; }
.moi .tuiles .lab .qm, .moi .m-debut .lab .qm { display: inline-grid; place-items: center; width: 14px; height: 14px; margin-left: 4px; border-radius: 50%; border: 1px solid var(--rule); font: 700 9px/1 var(--f-num); font-style: normal; color: var(--ink-3); vertical-align: 1px; }
.moi .tuiles .m-def { display: none; font-size: 12px; line-height: 1.4; color: var(--ink-2); padding-top: 4px; }
.moi .tuiles .ouvert .m-def { display: block; }
.moi .m-notes { display: grid; gap: 6px; }
.moi .m-note { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: var(--ink-2); padding: 9px 12px; border-radius: 10px; background: var(--panel); border: 1px solid var(--rule); }
.moi .m-note .ic { flex: none; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; font: 700 11px/1 var(--f-num); }
.moi .m-note.ok .ic { background: var(--up-bg); color: var(--up); }
.moi .m-note.warn { border-color: var(--down); color: var(--ink); } .moi .m-note.warn .ic { background: var(--down-bg); color: var(--down); }
.moi .m-note.rappel .ic { background: color-mix(in srgb, var(--gold) 18%, transparent); color: var(--gold); }
.moi .badge.big-b { font-size: 15px; padding: 5px 11px; }
.moi .badge.warn { background: color-mix(in srgb, #F0A030 20%, transparent); color: #C77A10; }
.moi .ms-r { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 10px; align-items: baseline; padding: 10px 2px; border-bottom: 1px solid var(--rule-2); }
.moi .ms-r:last-child { border-bottom: 0; }
.moi .ms-r b { font: italic 700 16px/1.1 var(--f-display); letter-spacing: .04em; text-transform: uppercase; }
.moi .ms-r .v { font: 700 16px/1.1 var(--f-num); text-align: right; }
.moi .ms-r small { font-size: 11.5px; color: var(--ink-3); }
.moi .ms-r .s { text-align: right; font-family: var(--f-num); }
.moi .ms-r .s i { font-style: normal; }
.moi .ms-r .s .badge { font-size: 11px; }
.moi .ms-liste { display: grid; gap: 8px; }
.moi .ms-l { display: grid; grid-template-columns: minmax(0, 1fr) 118px; gap: 4px 10px; align-items: center; padding: 10px 12px; border-radius: 12px; background: var(--panel); border: 1px solid var(--rule); }
.moi .ms-n b { display: block; font: italic 700 15px/1.15 var(--f-display); letter-spacing: .04em; text-transform: uppercase; }
.moi .ms-n small { display: block; font-size: 11.5px; color: var(--ink-3); }
.moi .ms-l input[type="text"] { font: 600 16px/1.2 var(--f-num); padding: 10px; border-radius: 10px; border: 1px solid var(--rule); background: var(--bg); color: var(--ink); width: 100%; min-width: 0; text-align: right; }
.moi .ms-int { grid-column: 2; justify-self: end; display: flex; gap: 5px; align-items: center; font-size: 11.5px; color: var(--ink-3); }
.moi .ms-int input { accent-color: var(--accent); margin: 0; }
.moi .ms-c { grid-template-columns: minmax(0, 1fr); text-align: left; color: var(--ink); cursor: pointer; font: inherit; }
.moi .ms-c.on { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--panel)); }
.moi .ms-note { margin: 0; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--accent) 10%, var(--panel)); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); font-size: 13px; line-height: 1.45; }
.moi .ms-fige { font-size: 13px; opacity: .7; }
.moi #ms-form .seg { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.moi .rang2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.moi .m-barres { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1px 12px; padding: 3px 8px; border-radius: 12px; border: 1px solid var(--rule); background: var(--panel); }   /* lot 52 : barres classées */
.moi .m-barres.deux { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(var(--nr), auto); grid-auto-flow: column; }
.moi .m-barre { all: unset; box-sizing: border-box; cursor: pointer; display: grid; grid-template-columns: 44px minmax(0, 1fr) 58px 60px; align-items: center; gap: 8px; height: 22px; padding: 0 3px; border-radius: 6px; min-width: 0; }
.moi .m-barres.sans-eur .m-barre { grid-template-columns: 44px minmax(0, 1fr) 58px; }
.moi .m-barres.deux .m-barre { grid-template-columns: 40px minmax(0, 1fr) 52px; gap: 5px; padding: 0 1px; }
.moi .m-barre:focus-visible { outline: 2px solid var(--accent); } .moi .m-barre:active { background: var(--panel-2); }
.moi .m-barre b { font: 700 12px/1 var(--f-num); letter-spacing: .01em; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.moi .m-b-t { position: relative; height: 9px; border-radius: 3px; background: color-mix(in srgb, var(--rule-2) 70%, transparent); }
.moi .m-b-t::before { content: ""; position: absolute; left: 50%; top: -4px; bottom: -4px; width: 1px; background: var(--ink-3); opacity: .55; }
.moi .m-b-f { position: absolute; top: 0; bottom: 0; border-radius: 3px; background: var(--ink-3); } .moi .m-b-f.up { background: var(--up); } .moi .m-b-f.down { background: var(--down); }
.moi .m-b-p { font: 600 12px/1 var(--f-num); font-variant-numeric: tabular-nums; letter-spacing: -.02em; text-align: right; white-space: nowrap; color: var(--ink-2); }
.moi .m-b-p.up { color: var(--up); } .moi .m-b-p.down { color: var(--down); }
.moi .m-barre small { font: 500 11px/1 var(--f-num); font-variant-numeric: tabular-nums; letter-spacing: -.02em; text-align: right; white-space: nowrap; overflow: hidden; color: var(--ink-3); }
.moi .m-per-bas { margin: 0 0 6px; }
.moi .m-ferme { justify-self: start; align-self: start; display: inline-block; padding: 3px 8px; border-radius: 999px; background: var(--panel-2); border: 1px solid var(--rule-2); font: 600 11.5px/1.2 var(--f-text); color: var(--ink-2); white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.moi .m-carte-l { margin: -6px 2px 0; font-size: 11px; line-height: 1.3; color: var(--ink-3); }
.moi .m-tri { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 10px; border-bottom: 1px solid var(--rule); padding-bottom: 8px; }
.moi .m-tri .m-coche { padding-bottom: 0; }
.moi .m-tri-p { margin: 8px 0 2px; } .moi .m-tri-p .chip { padding: 6px 11px; font-size: 12.5px; }
@media (max-width: 400px) { .moi .m-tri .sel { width: 100% !important; order: 3; } }
.moi .m-tri h2.sec { border: 0; padding: 0; white-space: nowrap; }
.moi .m-tri .sel { min-width: 0; width: min(190px, 44%); }
.moi .m-env { display: grid; }
.moi .m-env.total .m-env-h { border-bottom: 0; border-top: 2px solid var(--ink); margin-top: 6px; }
.moi .m-env-h .pv { font: 500 12px/1.1 var(--f-num); font-variant-numeric: tabular-nums; }
.moi .m-coche { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--ink-2); cursor: pointer; margin-left: auto; padding-bottom: 8px; white-space: nowrap; }
.moi .m-coche input { width: 18px; height: 18px; accent-color: var(--accent); margin: 0; }
.moi .m-debut-w { display: grid; gap: 6px; }
.moi .m-debut { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: var(--rule); border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; }
.moi .m-debut button { all: unset; box-sizing: border-box; cursor: pointer; background: var(--panel); padding: 8px 8px 7px; display: grid; gap: 2px; min-width: 0; }
.moi .m-debut button[aria-pressed="true"] { background: var(--panel-2); box-shadow: inset 0 -2px 0 var(--accent); }
.moi .m-debut button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.moi .m-debut .lab { font: 700 10px/1.1 var(--f-display); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.moi .m-debut b { font: 600 13.5px/1.15 var(--f-num); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.moi .m-debut small { font: 400 10.5px/1.2 var(--f-num); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.moi .m-def-l { margin: 0; font-size: 12.5px; line-height: 1.45; color: var(--ink-2); padding: 8px 10px; border-left: 3px solid var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); border-radius: 0 8px 8px 0; }
@media (max-width: 359px) { .moi .m-debut { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.moi .m-env-h { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; align-items: baseline; padding: 14px 0 6px; border-bottom: 2px solid var(--ce, var(--rule)); }
.moi .m-env-h b::before { content: ""; display: inline-block; width: 5px; height: 14px; margin-right: 8px; border-radius: 1px; transform: skewX(-12deg); background: var(--ce, var(--rule)); vertical-align: -1px; }
.moi .m-env.total .m-env-h b::before { display: none; }
.moi .m-env-h b { font: italic 800 16px/1.1 var(--f-display); letter-spacing: .06em; text-transform: uppercase; min-width: 0; }
.moi .m-env-h .v { font: 600 14px/1.1 var(--f-num); font-variant-numeric: tabular-nums; text-align: right; }
.moi .m-env-h .j { justify-self: end; font: 600 12.5px/1.1 var(--f-num); font-variant-numeric: tabular-nums; }
.moi .m-l { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 10px; padding: 10px 2px; border-bottom: 1px solid var(--rule-2); cursor: pointer; transition: background .3s; }
.moi .m-l:hover, .moi .m-l.eclair { background: var(--panel-2); }
.moi .m-l .g { min-width: 0; display: grid; gap: 2px; }
.moi .m-l .g b { font: 700 15px/1.1 var(--f-num); letter-spacing: .02em; }
.moi .m-l .g b .tag { font-style: normal; background: var(--rule-2); color: var(--ink-3); }
.moi .m-l .g small { font-size: 12px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.moi .m-l .d { display: grid; gap: 3px; justify-items: end; }
.moi .m-l .d .badge { font-size: 14px; padding: 3px 9px; }
.moi .m-l .d small { font: 600 12px/1.1 var(--f-num); font-variant-numeric: tabular-nums; }
.moi .m-l .d .v { font: 600 14px/1.1 var(--f-num); }
.moi .m-l .b { grid-column: 1 / -1; display: flex; flex-wrap: wrap; justify-content: space-between; gap: 2px 12px; font: 400 11.5px/1.3 var(--f-num); font-variant-numeric: tabular-nums; color: var(--ink-3); }
.moi .m-l .b i { font-style: normal; opacity: .75; }
.moi .m-l.especes { cursor: default; color: var(--ink-3); } .moi .m-l.especes:hover { background: none; }
.moi .m-l.especes .g b { font: 500 13px/1.1 var(--f-text); }
/* lot 64 (Théo, choix B) : « Mes enveloppes » en tableau d'un seul bloc : Enveloppe (valeur, poids, actifs) | période choisie | plus-value ;
   toucher une rangée = ses lignes dessous, dans les mêmes colonnes (valeur, cours, PRU, période, plus-value € et %) ; répartition sous le total */
.moi .m-envs { margin-top: 8px; border-radius: 12px; border: 1px solid var(--rule); background: var(--panel); overflow: hidden; }
.moi .nv-g { display: grid; grid-template-columns: minmax(0, 1fr) 74px 82px 10px; align-items: center; gap: 0 10px; }
.moi .nv-tete { padding: 7px 12px 4px 15px; border-bottom: 1px solid var(--rule-2); font: 700 10px/1.1 var(--f-display); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.moi .nv-tete span:nth-child(n+2) { text-align: right; }
.moi .m-enve + .m-enve, .moi .m-enve + .nv-tot { border-top: 1px solid var(--rule-2); }
.moi .nv-h { all: unset; box-sizing: border-box; cursor: pointer; width: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 74px 82px 10px; align-items: center; gap: 0 10px; padding: 7px 12px 7px 15px; box-shadow: inset 3px 0 0 var(--ce); }
.moi .nv-h:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.moi .m-enve.ouvert .nv-h { background: color-mix(in srgb, var(--ce) 9%, transparent); }
.moi .nv-n { display: grid; grid-template-columns: auto minmax(16px, 1fr) auto; align-items: center; gap: 3px 7px; min-width: 0; }
.moi .nv-n b { grid-column: 1 / -1; font: 600 14px/1.2 var(--f-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.moi .nv-n .nv-v { font: 500 12px/1.1 var(--f-num); font-variant-numeric: tabular-nums; color: var(--ink-2); white-space: nowrap; }
.moi .nv-n .nv-j { height: 4px; border-radius: 2px; background: var(--rule-2); overflow: hidden; }
.moi .nv-n .nv-j i { display: block; height: 100%; border-radius: 2px; background: var(--ce); }
.moi .nv-n em { font: 600 10.5px/1 var(--f-num); font-style: normal; color: var(--ink-3); }
.moi .nv-c { display: grid; gap: 2px; justify-items: end; min-width: 0; }
.moi .nv-c b { font: 600 13.5px/1.1 var(--f-num); font-variant-numeric: tabular-nums; white-space: nowrap; }
.moi .nv-c small { font: 500 11.5px/1.1 var(--f-num); font-variant-numeric: tabular-nums; white-space: nowrap; opacity: .85; }
.moi .nv-ch { font-size: 10px; color: var(--ink-3); text-align: right; transition: transform .2s; }
.moi .m-enve.ouvert > .nv-h .nv-ch { transform: rotate(180deg); color: var(--ce); }
.moi .nv-a { grid-column: 1 / -1; display: flex; gap: 4px; margin-top: 4px; min-width: 0; overflow: hidden; white-space: nowrap; }
.moi .nv-a span { flex: none; padding: 1px 5px; border-radius: 4px; background: var(--rule-2); font: 600 10px/1.2 var(--f-num); letter-spacing: .02em; color: var(--ink-2); }
.moi .nv-a span.plus { background: none; padding-inline: 2px; color: var(--ink-3); }
.moi .m-enve.ouvert .nv-a { display: none; }
.moi .nv-l { padding: 0 12px 0 15px; box-shadow: inset 3px 0 0 var(--ce); background: var(--panel-2); }
.moi .nv-l[hidden] { display: none; }
.moi .m-l.nv-li { grid-template-columns: minmax(0, 1fr) 74px 82px 10px; gap: 0 10px; align-items: start; padding: 8px 0; border-bottom: 1px solid var(--rule); }
.moi .m-l.nv-li:last-child { border-bottom: 0; }
.moi .nv-ln { display: grid; gap: 2px; min-width: 0; }
.moi .nv-ln b { font: 700 13.5px/1.2 var(--f-num); letter-spacing: .02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.moi .nv-ln b small { margin-left: 6px; font: 400 11px/1 var(--f-text); letter-spacing: 0; color: var(--ink-3); }
.moi .nv-ln .nv-v { font: 600 12.5px/1.15 var(--f-num); font-variant-numeric: tabular-nums; }
.moi .nv-ln .nv-cr, .moi .nv-li .nv-pru { font: 400 10.5px/1.15 var(--f-num); font-variant-numeric: tabular-nums; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 1; }
.moi .nv-ln .nv-cr i, .moi .nv-li .nv-pru i { font-style: normal; opacity: .8; }
.moi .nv-ln .nv-vo { font: 500 10.5px/1.15 var(--f-num); font-variant-numeric: tabular-nums; color: var(--ink-3); white-space: nowrap; }
.moi .nv-tot .nv-n .nv-vo { grid-column: 1 / -1; font: 500 10.5px/1.15 var(--f-num); font-variant-numeric: tabular-nums; color: var(--ink-3); white-space: nowrap; }
.moi .nv-vo i { font-style: normal; font-size: 9px; margin-right: 1px; }
.moi .nv-vo.fort { color: var(--down); } .moi .nv-vo.agite { color: var(--gold); }
.moi .nv-vo-aide { margin: 0; padding: 6px 12px 8px 15px; font-size: 11px; line-height: 1.35; color: var(--ink-3); background: var(--panel-2); }
.moi .nv-li .nv-ch { align-self: center; font-size: 13px; }
.moi .m-l.nv-li.especes .nv-ln b { font: 500 13px/1.2 var(--f-text); color: var(--ink-3); }
.moi .nv-tot { padding: 7px 12px 9px 15px; background: var(--panel-2); border-top: 2px solid var(--ink) !important; row-gap: 7px; }
.moi .nv-tot .nv-n b { font: 700 10.5px/1.2 var(--f-display); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-2); }
.moi .nv-tot .nv-n .nv-v { font: 600 14px/1.1 var(--f-num); color: var(--ink); }
.moi .nv-rep { grid-column: 1 / -1; display: flex; gap: 2px; height: 6px; border-radius: 3px; overflow: hidden; }
.moi .nv-rep i { flex-basis: 0; min-width: 3px; background: var(--ce); }
/* lot 65 : « Lignes » = le même tableau à plat, classé en touchant l'en-tête */
.moi .m-tri .m-vue-l { flex: none; }
.moi .nv-triable button { all: unset; box-sizing: border-box; cursor: pointer; text-align: right; white-space: nowrap; padding: 3px 0; border-radius: 4px; }
.moi .nv-triable button:first-child { text-align: left; }
.moi .nv-triable button[aria-pressed="true"] { color: var(--ink); }
.moi .nv-triable button:focus-visible { outline: 2px solid var(--accent); }
.moi .nv-plat { background: none; box-shadow: none; }
.moi .nv-plat .m-l.nv-li { position: relative; }
.moi .nv-plat .m-l.nv-li::before { content: ""; position: absolute; left: -15px; top: 0; bottom: 0; width: 3px; background: var(--ce); }
.moi .nv-e { display: inline-block; vertical-align: 1px; margin-left: 6px; padding: 1px 5px; border-radius: 4px; font: 600 9.5px/1.2 var(--f-num); letter-spacing: .02em; color: var(--ce); background: color-mix(in srgb, var(--ce) 14%, transparent); }
.moi .m-envs.plat .nv-ln b small { margin-left: 5px; }
.moi .nv-info { margin: 6px 0 0; font-size: 11.5px; color: var(--ink-3); }
.moi .m-mk-t { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.moi .m-idx-mk { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.moi .m-idx-mk button { all: unset; box-sizing: border-box; background: var(--panel); padding: 9px 10px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; min-width: 0; cursor: pointer; }
.moi .m-idx-mk button[aria-pressed="true"] { background: color-mix(in srgb, var(--accent) 14%, var(--panel)); box-shadow: inset 3px 0 0 var(--accent); }
.moi .m-idx-mk button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.moi .m-idx-mk button:last-child:nth-child(odd) { grid-column: 1 / -1; }   /* v17.41 : 9 cases (Nasdaq ×3) : la dernière prend la rangée, pas de trou */
.moi .m-idx-mk b small { font: 500 10px/1 var(--f-text); color: var(--ink-3); margin-right: 5px; }
.moi .m-mk-panneau:not(:empty) { margin-top: 10px; padding: 10px; border: 1px solid var(--rule); border-radius: 12px; background: var(--panel); display: grid; gap: 8px; }
.moi .m-mk-svg { width: 100%; height: auto; display: block; }
.moi .m-mk { scroll-margin-top: calc(env(safe-area-inset-top, 0px) + 112px); }   /* lot 61 : 📈 › amène le titre « Marchés » juste sous les onglets collants (avant : caché dessous) */
.moi .m-mk-svg text { font: 10px var(--f-num, sans-serif); fill: var(--ink-2); }
.moi .m-mk-svg .gr { stroke: var(--rule); stroke-width: 1; }
.moi .m-mk-svg .b100 { stroke: var(--ink-2); stroke-width: 1; stroke-dasharray: 3 3; opacity: .6; }
.moi .m-mk-res { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; font-size: 13px; color: var(--ink-2); }
.moi .m-mk-res > b:first-child { color: var(--ink); font-size: 14px; margin-right: auto; }
.moi .m-mk-res .m-mk-per { color: var(--ink); font-weight: 600; }
.moi .m-mk-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.moi .m-mk-chips .chip { font-size: 12px; padding: 5px 9px; display: inline-flex; align-items: center; gap: 5px; }
.moi .m-mk-chips .chip i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; background: var(--mkc); box-sizing: border-box; }
/* lot 62 : pastille allumée = bord et pastille pleine de sa couleur ; éteinte = pastille creuse, texte atténué (le % reste lisible) */
.moi .m-mk-chips { gap: 5px; }
.moi .m-mk-chips .chip { gap: 4px; min-height: 30px; padding: 4px 8px; font-size: 11.5px; }
.moi .m-mk-chips .m-mk-plus { border-style: dashed; color: var(--ink-2); font-weight: 600; }   /* v20.35 : « + N autres » */
.moi .m-mk-chips .chip small { font-size: 10.5px; }
.moi .m-mk-chips .chip.on { color: var(--ink); border-color: color-mix(in srgb, var(--mkc) 75%, var(--rule)); background: color-mix(in srgb, var(--mkc) 14%, var(--panel)); }
.moi .m-mk-chips .chip[aria-pressed="false"] { opacity: 1; color: var(--ink-3); background: none; border-style: dashed; }
.moi .m-mk-chips .chip[aria-pressed="false"] i { background: none; border: 1.5px solid var(--mkc); }
.moi .m-mk-chips .chip[aria-pressed="false"] small { opacity: .7; }
.moi .m-mk-rien { margin: 18px 0; text-align: center; }
.moi .m-mk-chips { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 5px; margin-bottom: 8px; }   /* lot 62 c : 2 pastilles par ligne */
.moi .m-mk-chips .chip { display: flex; justify-content: flex-start; border-radius: 10px; min-height: 34px; padding: 5px 8px; font-size: 12.5px; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: manipulation; }
.moi .m-mk-chips .chip span { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; line-height: 1.35; }   /* l'accent de « Émergents » n'est pas rogné */
.moi .m-mk-chips .chip b { flex: none; font: 600 12px/1 var(--f-num); font-variant-numeric: tabular-nums; }
.moi .m-mk-chips .chip b small { margin-right: 4px; font-size: 10px; color: var(--ink-3); font-weight: 600; }
.moi .m-mk-chips .chip[aria-pressed="false"] b.flat, .moi .m-mk-chips .chip[aria-pressed="false"] span { color: var(--ink-3); }
.moi .m-mk-res .lien { margin-right: 8px; }
.moi .m-mk-chips .chip.m-mk-moi { grid-column: 1 / -1; }   /* lot 63 : « Mon portefeuille » en tête, sur toute la largeur */
/* 25/11/2026 (Théo) : volatilité 1 an de chaque marché, la même pastille que les lignes du portefeuille (sous le nom dans la case, à côté du nom dans « un marché seul ») */
.moi .m-mk-chips .chip.avec-vo { flex-wrap: wrap; row-gap: 1px; align-content: center; }
.moi .m-mk-chips .chip span.nv-vo, .moi .m-mk-res .nv-vo { flex: none; overflow: visible; font: 500 10.5px/1.15 var(--f-num); font-variant-numeric: tabular-nums; color: var(--ink-3); white-space: nowrap; }
.moi .m-mk-chips .chip span.nv-vo { flex: 1 0 100%; padding-left: 13px; text-align: left; }
.moi .m-mk-chips .chip .nv-vo i, .moi .m-mk-chips .chip[aria-pressed="false"] .nv-vo i { width: auto; height: auto; border: 0; border-radius: 0; background: none; display: inline; }
.moi .m-mk-chips .chip span.nv-vo.fort, .moi .m-mk-res .nv-vo.fort { color: var(--down); } .moi .m-mk-chips .chip span.nv-vo.agite, .moi .m-mk-res .nv-vo.agite { color: var(--gold); }
.moi .m-mk-res .nv-vo { font-size: 12px; }
.moi .m-idx { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 1px; background: var(--rule); border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; }
.moi .m-idx div { background: var(--panel); padding: 8px 10px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; min-width: 0; }
.moi .m-idx span { font-size: 12.5px; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.moi .m-idx b { font: 600 12.5px/1 var(--f-num); font-variant-numeric: tabular-nums; white-space: nowrap; }
.moi .tuiles.m-petit .val { font-size: 15.5px; }
.moi .tuiles.m-pret-t .val { font-size: 14.5px; white-space: nowrap; letter-spacing: -.01em; }   /* V15.12 : « dans 14 ans 7 mois » sur une ligne, les 4 tuiles à la même taille */
.moi .m-pret b { white-space: nowrap; font-size: 14.5px; }
.moi .tuiles.m-petit > div { padding: 9px 11px; }
.moi .mini p { grid-column: 1 / -1; margin: 2px 0 0; font-size: 12px; color: var(--ink-2); }
.moi .m-ligne-det { grid-column: 1 / -1; padding-top: 4px; cursor: default; }
.moi .m-tri { display: flex; justify-content: space-between; align-items: end; gap: 10px; }
.moi .m-tri .sel { min-width: 0; width: min(240px, 60%); }
.moi .m-big { font: 700 clamp(32px, 10vw, 46px)/1 var(--f-num); font-variant-numeric: tabular-nums; letter-spacing: -.03em; }
.moi .m-leg3 { display: grid; }
.moi .m-leg3 button { all: unset; box-sizing: border-box; cursor: pointer; display: grid; grid-template-columns: 12px minmax(0, 1fr) auto 46px; gap: 10px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--rule); font-size: 13.5px; }
.moi .m-leg3 button i { width: 12px; height: 12px; border-radius: 3px; transform: skewX(-12deg); }
.moi .m-leg3 .m-dette i { background: none; box-shadow: inset 0 0 0 1.5px var(--c-immo); } .moi .m-leg3 .m-dette .num { color: var(--down); }
.moi .m-leg3 .num { text-align: right; font-family: var(--f-num); font-variant-numeric: tabular-nums; } .moi .m-leg3 .pc { text-align: right; color: var(--ink-3); font-size: 12.5px; font-family: var(--f-num); }
.moi .m-bloc { position: relative; padding-left: 12px; display: grid; gap: 10px; scroll-margin-top: 130px; }
.moi .m-bloc::before { content: ""; position: absolute; left: 0; top: 2px; bottom: 2px; width: 4px; border-radius: 2px; background: var(--c, var(--rule)); }
.moi .m-bloc h2.sec { border-bottom-color: var(--c, var(--rule)); }
.moi h3.m-sous { margin: 6px 0 0; font: italic 800 14px/1 var(--f-display); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-2); }
.moi .m-liste { display: grid; }
.moi .m-liste .r { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 12px; padding: 10px 0; border-bottom: 1px solid var(--rule); }
.moi .m-liste .r .a { font-weight: 600; font-size: 14px; min-width: 0; }
.moi .m-liste .r .b { text-align: right; font: 600 14px/1.2 var(--f-num); font-variant-numeric: tabular-nums; }
.moi .m-liste .r .c { font-size: 12px; color: var(--ink-3); min-width: 0; }
.moi .m-liste .r .d { text-align: right; font: 400 12px/1.2 var(--f-num); color: var(--ink-2); }
.moi .m-liste .r.m-liv .b small { font: 500 11px/1 var(--f-text); color: var(--ink-3); }
.moi .m-liste .r.m-liv .b.up { color: var(--up); }
.moi .m-int31 { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 2px 12px; margin: 4px 0 6px; padding: 10px 12px; border-radius: 12px; background: color-mix(in srgb, var(--up) 9%, var(--panel)); border: 1px solid color-mix(in srgb, var(--up) 28%, var(--rule)); }
.moi .m-int31 .k { font: 600 13px/1.2 var(--f-text); color: var(--ink-2); }
.moi .m-int31 b { font: 700 19px/1.1 var(--f-num); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; } .moi .m-int31 b.up { color: var(--up); }
.moi .m-int31 small { grid-column: 1 / -1; font-size: 12px; color: var(--ink-3); }
.moi .m-liste .r.total { border-top: 2px solid var(--c, var(--ink)); }
.moi .m-liste .r.total .a { font: italic 800 14px/1.2 var(--f-display); letter-spacing: .08em; text-transform: uppercase; }
.moi .m-pret { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--rule); border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; }
.moi .m-pret div { background: var(--panel); padding: 10px 12px; display: grid; gap: 3px; min-width: 0; }
.moi .m-pret span { font-size: 11.5px; color: var(--ink-3); }
.moi .m-pret b { font: 600 15px/1.15 var(--f-num); font-variant-numeric: tabular-nums; }
.moi .m-pret small { font-size: 11.5px; color: var(--ink-2); }
.moi .m-barres svg { width: 100%; display: block; }
.moi .m-barres text { font: 500 10.5px var(--f-num); fill: var(--ink-3); }
.moi .legend i.carre { width: 10px; height: 10px; border: 0; border-radius: 2px; display: inline-block; margin-right: 6px; vertical-align: -1px; transform: skewX(-12deg); }
.moi .m-rep { display: grid; }
.moi .m-rep > div { display: grid; grid-template-columns: minmax(0, 1fr) 52px 78px; gap: 8px; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--rule); font-size: 13px; }
.moi .m-rep .n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
/* lot 27 : Stats en profondeur (bandeau du mois, écart en grand, courbe des baisses, répartition en une barre, performances à 4 colonnes) */
.moi .m-rep .n i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 7px; vertical-align: -1px; }
.moi .m-rep-barre { display: flex; height: 16px; border-radius: 8px; overflow: hidden; gap: 2px; margin: 4px 0 2px; }
.moi .m-rep-barre i { display: block; min-width: 3px; }
.moi .m-ec.m-ec3 { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; } .moi .m-ec.m-ec1 { grid-template-columns: minmax(0, 1fr); }
.moi .m-ec3 .m-ec-t { padding: 9px 9px; } .moi .m-ec3 .m-ec-t .k { font-size: 10px; letter-spacing: .04em; } .moi .m-ec3 .m-ec-t b { font-size: 17px; } .moi .m-ec3 .m-ec-t small { font-size: 11px; }
.moi .m-ec-t b.up { color: var(--up); } .moi .m-ec-t b.down { color: var(--down); } .moi .m-ec-t.ok { border-color: color-mix(in srgb, var(--up) 45%, var(--rule)); }
.moi .m-seg3 button { padding: 9px 4px; font-size: 12.5px; line-height: 1.15; }
/* lot 35 : un seul choix de compte en haut de Stats */
.moi .m-cpt > .k { flex: none; align-self: center; margin-right: 2px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); }
/* lot 50 (Théo, règle générale) : filtres de Moi (compte, période, horizon…) = une rangée de petites pastilles, une seule ligne,
   défilement horizontal dans la rangée si elle est trop longue (jamais la page) ; la place est pour les graphiques.
   Même apparence que les filtres du Classement (.f-seg, v17.56) : rail gris, la pastille choisie en relief. */
.moi .chips.m-filtre { flex-wrap: nowrap; gap: 2px; width: fit-content; min-width: 0; max-width: 100%; justify-self: start; padding: 2px; border-radius: 9px; background: var(--panel-2); border: 1px solid var(--rule-2);
  overflow-x: auto; overscroll-behavior-x: contain; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.moi .chips.m-filtre::-webkit-scrollbar { display: none; }
.moi .chips.m-filtre .chip { flex: none; padding: 5px 9px; border: 0; border-radius: 7px; background: none; color: var(--ink-2); font: 600 12px/1.15 var(--f-text); white-space: nowrap; }
.moi .chips.m-filtre .chip[aria-pressed="true"] { background: #EDF0F4; color: #11151B; border: 0; box-shadow: 0 0 0 1px rgba(0,0,0,.35), 0 1px 3px rgba(0,0,0,.4); }   /* v17.75 (Théo) : la pastille choisie ressort nettement (comme l'ancien bouton foncé) */
/* lot 61 (Théo) : couleurs FIXES, plus var(--ink)/var(--panel) que les thèmes de Moi redéfinissent dans la carte du haut (texte blanc sur blanc = pastille vide).
   Sombre : clair + texte foncé ; clair : foncé + texte blanc ; carte du haut avec un thème : la couleur du thème + texte foncé (comme les onglets) */
:root[data-theme="light"] .moi .chips.m-filtre .chip[aria-pressed="true"] { background: #11151B; color: #FFFFFF; box-shadow: 0 0 0 1px rgba(255,255,255,.2), 0 1px 3px rgba(0,0,0,.25); }
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) .moi .chips.m-filtre .chip[aria-pressed="true"] { background: #11151B; color: #FFFFFF; box-shadow: 0 0 0 1px rgba(255,255,255,.2), 0 1px 3px rgba(0,0,0,.25); } }
#v-moi.th .m-hero .chips.m-filtre .chip[aria-pressed="true"] { background: var(--mc, #F4F5F8); color: #0B0D12; box-shadow: 0 0 0 1px rgba(0,0,0,.28), 0 1px 4px rgba(0,0,0,.45); }
.moi .chips.m-filtre.m-cpt > .k { padding-left: 6px; }
@media (max-width: 360px) { .moi .chips.m-filtre .chip { font-size: 11.5px; padding: 5px 7px; } }
.moi .m-seul { padding: 6px 0 2px; }
.moi .m-ecart { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; background: var(--panel); border: 1px solid var(--rule); }
.moi .m-ecart > b { font: italic 800 28px/1 var(--f-display); white-space: nowrap; color: var(--ink); } .moi .m-ecart > b.up { color: var(--up); } .moi .m-ecart > b.down { color: var(--down); }
.moi .m-ecart > span { display: grid; gap: 3px; font-size: 13px; font-weight: 600; color: var(--ink); min-width: 0; } .moi .m-ecart small { font: 500 11.5px/1.3 var(--f-num); color: var(--ink-3); overflow-wrap: anywhere; }
.moi .m-dd-w { display: grid; gap: 6px; margin-bottom: 8px; }
.moi .m-dd .ba { fill: var(--down); fill-opacity: .18; } .moi .m-dd .bl { fill: none; stroke: var(--down); stroke-width: 1.6; stroke-linejoin: round; }
.moi .m-dd .bz { fill: var(--ink-3); fill-opacity: .08; } .moi .m-dd .bp { fill: var(--down); stroke: var(--panel); stroke-width: 2; } .moi .m-dd .bt { font-weight: 700; fill: var(--down); }
.moi .m-dd-t { margin-bottom: 8px; }
.moi .tuiles.m-t3 { grid-template-columns: repeat(3, minmax(0, 1fr)); } .moi .tuiles.m-t3 > div { padding: 8px 8px; min-width: 0; }
.moi .tuiles.m-t3 .lab { font-size: 11px; } .moi .tuiles.m-t3 .val { font-size: 15px; white-space: nowrap; } .moi .tuiles.m-t3 .sub { font-size: 11px; overflow-wrap: anywhere; }
.moi .m-perf4 { width: 100%; table-layout: fixed; } .moi .m-perf4 th:first-child, .moi .m-perf4 td:first-child { width: 34%; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.moi .m-perf4 th, .moi .m-perf4 td { text-align: right; padding-left: 4px; padding-right: 4px; }
.moi .m-perf4 tr.m-pf-r { cursor: pointer; } .moi .m-pf-v { font-style: normal; color: var(--ink-3); font-size: 10px; } .moi .m-pf-r.ouvert .m-pf-v { display: inline-block; transform: rotate(180deg); }
.moi .m-perf4 tr.m-pf-d td { text-align: left; white-space: normal; font-size: 12px; color: var(--ink-2); background: var(--rule-2); }
.m-million .mm-lien { justify-self: start; font: 600 12.5px/1 var(--f-ui, inherit); color: var(--gold); background: none; border: 0; padding: 4px 0; cursor: pointer; text-decoration: underline; text-underline-offset: 3px; }
.moi .pj-mil { margin: 0 0 8px; font-size: 13.5px; color: var(--ink-2); } .moi .pj-mil b { color: var(--ink); }
.moi .m-rep .b { height: 8px; background: var(--rule-2); border-radius: 4px; overflow: hidden; }
.moi .m-rep .b i { display: block; height: 100%; background: var(--s1); border-radius: 4px; }
.moi .m-rep .p, .moi .m-rep .e { text-align: right; font: 500 12px/1 var(--f-num); font-variant-numeric: tabular-nums; white-space: nowrap; } .moi .m-rep .e { color: var(--ink-3); }
.moi .mpm { display: grid; gap: 10px; }
.moi .mpm-an { padding: 10px; border-radius: 14px; border: 1px solid var(--rule); background: var(--panel); min-width: 0; }
.moi .mpm-t { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 2px 10px; min-height: 38px; padding: 0 2px 8px; }
.moi .mpm-t .mpm-h { font: 600 14px/1.15 var(--f-text); color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .moi .mpm-t .mpm-h b { color: var(--ink); font: italic 800 17px/1 var(--f-display); letter-spacing: .03em; }
.moi .mpm-t .mpm-p { font: 700 17px/1.1 var(--f-num); font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; } .moi .mpm-t .mpm-p.up { color: var(--up); } .moi .mpm-t .mpm-p.down { color: var(--down); }
.moi .mpm-t small { font: 500 12px/1.2 var(--f-num); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .moi .mpm-t .mpm-e { text-align: right; color: var(--ink-2); }
.moi .mpm-g { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; }
.moi .mpm-c { all: unset; box-sizing: border-box; display: grid; align-content: center; justify-items: center; gap: 2px; min-width: 0; height: 56px; padding: 4px 2px; border-radius: 9px; background: var(--panel-2); color: var(--ink); text-align: center; cursor: pointer;
  -webkit-tap-highlight-color: transparent; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; touch-action: manipulation; position: relative; }
.moi .mpm-g.sans-e .mpm-c { height: 46px; }
.moi .mpm-c i { font: 700 9.5px/1 var(--f-display); font-style: normal; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.moi .mpm-c b { font: 700 13.5px/1.1 var(--f-num); font-variant-numeric: tabular-nums; white-space: nowrap; }
.moi .mpm-c small { font: 500 10.5px/1.1 var(--f-num); font-variant-numeric: tabular-nums; color: var(--ink-2); white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.moi .mpm-c .mpm-sp { position: absolute; top: 3px; right: 5px; font: 700 9px/1 var(--f-num); color: var(--gold); pointer-events: none; }
.moi .mpm-leg b { color: var(--gold); }
.moi .mpm-c.vide { cursor: default; background: none; box-shadow: inset 0 0 0 1px var(--rule-2); opacity: .6; }
.moi .mpm-c.cours { box-shadow: inset 0 0 0 1.5px var(--ink-3); } .moi .mpm-c.cours i::after { content: " •"; color: var(--accent); }
.moi .mpm-c.on { box-shadow: inset 0 0 0 2px var(--ink); }
.moi .mpm-c:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
/* lot 50 : années d'avant repliées en une ligne (année · ★ n/m · %), dépliées : la même tête à 2 étages que l'année en cours */
.moi .acc.mpm-y { padding: 0; }
.moi .acc.mpm-y > summary.mpm-t { grid-template-columns: minmax(0, 1fr) auto 12px; min-height: 0; padding: 10px 12px 8px; }
.moi .acc.mpm-y > summary.mpm-t::after { grid-column: 3; grid-row: 1 / span 2; align-self: center; margin: 0 2px 4px 0; }
.moi .acc.mpm-y > summary .mpm-h { grid-column: 1; grid-row: 1; } .moi .acc.mpm-y > summary .mpm-p { grid-column: 2; grid-row: 1; }
.moi .acc.mpm-y > summary .mpm-x { grid-column: 1; grid-row: 2; } .moi .acc.mpm-y > summary .mpm-e { grid-column: 2; grid-row: 2; }
.moi .acc.mpm-y:not([open]) > summary.mpm-t { grid-template-columns: auto minmax(0, 1fr) auto 12px; align-items: baseline; padding: 10px 12px; }
.moi .acc.mpm-y:not([open]) > summary .mpm-x { grid-column: 2; grid-row: 1; } .moi .acc.mpm-y:not([open]) > summary .mpm-p { grid-column: 3; grid-row: 1; font-size: 15px; }
.moi .acc.mpm-y:not([open]) > summary .mpm-e { display: none; } .moi .acc.mpm-y:not([open]) > summary.mpm-t::after { grid-column: 4; grid-row: 1; margin: 0 2px 2px 0; }
.moi .acc.mpm-y > div { display: block; padding: 0 10px 10px; }
.moi .mpm-aide { margin-top: 6px; }
.moi .m-jr { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.moi .m-jr b { display: block; font: 700 12px/1 var(--f-display); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2); margin-bottom: 4px; }
.moi .m-jr .l { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0 8px; padding: 5px 0; border-bottom: 1px solid var(--rule-2); font-size: 12px; }
.moi .m-jr .l span:first-child { grid-column: 1 / -1; color: var(--ink-2); }
.moi .m-jr .l span:not(:first-child) { font: 500 11.5px/1.2 var(--f-num); white-space: nowrap; }
.moi .m-jr .l span:last-child { text-align: right; }
.moi .acc > div { display: grid; gap: 10px; }
.moi .acc.m-compact > summary { padding: 9px 12px; align-items: center; }
.moi .acc.m-compact > summary::after { grid-row: 1; align-self: center; margin-top: 0; }
.moi .acc.m-compact > summary .t { font-size: 14px; }
.moi .m-cp-r { grid-column: 1; grid-row: 2; display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--ink-3); }
.moi .m-cp-r b { font: 600 12px/1 var(--f-num); }
.moi .m-perf-t th, .moi .m-perf-t td { font-size: 11.5px; padding-top: 6px; padding-bottom: 6px; }
.moi .m-jc > summary { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 8px; }
.moi .m-jc > summary::after { grid-column: 3; }
.moi .m-jc-p { display: grid; gap: 1px; min-width: 0; padding: 2px 0 2px 9px; border-left: 3px solid var(--up); }
.moi .m-jc-p.down { border-left-color: var(--down); }
.moi .m-jc-p i { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font: 700 10px/1.2 var(--f-display); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); font-style: normal; }
.moi .m-jc-p b { font: 700 16px/1.1 var(--f-num); }
.moi .m-jc-p.up b { color: var(--up); } .moi .m-jc-p.down b { color: var(--down); }
.moi .m-jc-p small { font: 500 11px/1.2 var(--f-num); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.moi .m-h4 { margin: 10px 0 0; font: italic 800 14px/1 var(--f-display); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-2); }
.moi .m-vide { display: grid; gap: 14px; justify-items: start; padding: 26px 0 10px; }
.moi .m-vide p { margin: 0; font-size: 14px; color: var(--ink-2); }
.moi .tab td small { color: var(--ink-3); }
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) .moi { --e1: #B7791F; --e2: #0F8F7E; --e3: #8B3FD9; --e4: #D35A1F; --e5: #1E88B8; --c-bourse: #2F62C8; --c-epargne: #9A7400; --c-av: #12866B; --c-immo: #C24E2A; } }
:root[data-theme="light"] .moi { --e1: #B7791F; --e2: #0F8F7E; --e3: #8B3FD9; --e4: #D35A1F; --e5: #1E88B8; --c-bourse: #2F62C8; --c-epargne: #9A7400; --c-av: #12866B; --c-immo: #C24E2A; }
@media (max-width: 430px) {
  .moi .m-rep > div { grid-template-columns: minmax(0, 1fr) 48px 72px; }
}

/* signal levier (repris de Cote) */
.moi .sig { border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; background: var(--panel); --sc: var(--up); }
.moi .sig.hors { --sc: var(--down); } .moi .sig.x1 { --sc: var(--p0); } .moi .sig.creux { --sc: var(--accent); }
.moi .sig-tete { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 12px 11px 10px; border-left: 4px solid var(--sc); }
.moi .sig-tete:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.moi .sig-haut { display: flex; align-items: center; border-left: 4px solid var(--sc); } .moi .sig-haut .sig-tete { border-left: 0; width: auto; flex: 1; min-width: 0; padding: 11px 8px 11px 2px; gap: 6px; justify-content: flex-end; } .moi .sig-haut .sg-rien { font-size: 10.5px; flex-shrink: 0; } .moi .sig-haut .sig-voir { margin-left: 0; font-size: 11px; } .moi .sig-haut .sig-lab { letter-spacing: .06em; } .moi .sig-plie { gap: 6px; padding-right: 2px; }
.moi .sig-plie { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 7px; padding: 11px 4px 11px 10px; min-width: 0; } .moi .sig-plie:disabled { cursor: default; }
.moi .sig-plie:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; } .moi .chev-t { font: 600 12px/1 var(--f-num); color: var(--ink-3); width: 10px; }
.moi .sg-badge { font: 700 11px/1 var(--f-num); padding: 4px 7px; border-radius: 6px; white-space: nowrap; color: var(--sc); background: color-mix(in srgb, var(--sc) 15%, transparent); }   /* 26/11 : état visible même replié */
.moi .sig-lab { font: 700 11px/1.1 var(--f-display); letter-spacing: .1em; text-transform: uppercase; color: var(--accent-ink); }
.moi .sig-pos { margin-left: auto; font: 700 13px/1 var(--f-num); padding: 6px 9px; border-radius: 6px; white-space: nowrap; color: var(--sc); background: color-mix(in srgb, var(--sc) 15%, transparent); }
.moi .sig-tete .chev { font: 600 18px/1 var(--f-num); color: var(--ink-3); transition: transform .2s; }
.moi .sig-tete[aria-expanded="true"] .chev { transform: rotate(90deg); }
.moi .sig-cells { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border-bottom: 1px solid var(--rule); margin: 0 -12px; }
.moi .pc-c { padding: 10px 12px; display: grid; gap: 4px; border-right: 1px solid var(--rule); min-width: 0; }
.moi .pc-c:last-child { border-right: 0; }
.moi .pc-c .lab { font: 700 11px/1.1 var(--f-display); letter-spacing: .1em; text-transform: uppercase; color: var(--accent-ink); }
.moi .pc-c .val { font: 600 15px/1.15 var(--f-num); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.moi .pc-c .sub { font-size: 11px; color: var(--ink-3); }
.moi .sig-msg { margin: 0; padding: 9px 12px; font-size: 13px; border-top: 1px solid var(--rule); color: var(--ink-2); }
.moi .sig-msg.ordre { font-weight: 600; color: var(--ink); background: color-mix(in srgb, var(--gold) 18%, transparent); }
.moi .sig-msg.alerte { color: var(--ink); background: var(--down-bg); }
.moi .sig-detail { border-top: 1px solid var(--rule); padding: 0 12px 12px; display: grid; gap: 4px; }
.moi .sig-detail .m-liste .r { padding: 8px 0; }
.moi .sig-detail .t-ACHAT, .moi .sig-detail .t-RELAIS, .moi .sig-detail .t-x2 { color: var(--up); }
.moi .sig-detail .t-VENTE { color: var(--down); } .moi .sig-detail .t-x1 { color: var(--p0); }
.moi .sig-detail .t-CREUX, .moi .sig-detail .t-EVITEE { color: var(--accent-ink); } .moi .sig-detail .t-REFUS { color: var(--gold); }
.moi .sig-pied { font-size: 11px; color: var(--ink-3); padding-top: 6px; }
.moi .sig-cto { display: flex; align-items: center; gap: 10px; padding: 8px 12px 8px 14px; border-top: 1px solid var(--rule); min-width: 0; flex-wrap: wrap; }
.moi .sig-cto .sig-pos { margin-left: 0; }
.moi .sig-cto .sub { font-size: 11.5px; color: var(--ink-3); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.moi .sig-pos.cto-x3 { --sc: #E0841A; } .moi .sig-pos.cto-x2 { --sc: var(--up); } .moi .sig-pos.cto-x1 { --sc: var(--p0); } .moi .sig-pos.cto-or { --sc: #B8962E; } .moi .sig-pos.cto-cash { --sc: var(--down); }
.moi .sig-h { margin: 12px 0 2px; font: 700 12px/1.2 var(--f-display); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2); display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.moi .sig-h small { font: 400 11px/1.2 var(--f-text); letter-spacing: 0; text-transform: none; color: var(--ink-3); text-align: right; }
.moi .sig-detail .b.acc { color: var(--accent-ink); } .moi .sig-detail .b.down { color: var(--down); }
.moi .ck { font-style: normal; font-weight: 700; margin-left: 4px; } .moi .ck.up { color: var(--up); } .moi .ck.down { color: var(--down); }
.moi .qm-b { all: unset; box-sizing: border-box; cursor: pointer; display: inline-grid; place-items: center; width: 17px; height: 17px; margin-left: 6px; border-radius: 50%; border: 1px solid var(--rule); font: 700 10.5px/1 var(--f-num); color: var(--ink-3); vertical-align: 1px; letter-spacing: 0; text-transform: none; }
.moi .qm-b:focus-visible { outline: 2px solid var(--accent); }
.moi [data-aide].aide-on > .a .qm-b, .moi [data-aide].aide-on .sig-lab .qm-b, .moi [data-aide].aide-on .sig-h .qm-b, .moi .qm-b.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.moi .aide { display: none; font: 400 12.5px/1.45 var(--f-text); color: var(--ink); background: color-mix(in srgb, var(--accent) 9%, transparent); border-left: 3px solid var(--accent); padding: 7px 9px; border-radius: 0 6px 6px 0; margin-top: 6px; letter-spacing: 0; text-transform: none; }
.moi [data-aide].aide-on .aide { display: block; }
.moi .aide-l { padding: 0; }
.moi .sig-cto .aide { flex-basis: 100%; }
.moi .sig-case-aide { padding: 8px 0; border-bottom: 1px solid var(--rule); }
.moi .sig-case-aide .aide { display: block; margin-top: 0; }
/* lot 66 · bloc Levier en clair : deux règles séparées (position / versement), jauges des seuils, phrases « pour toi », rubriques repliables */
.moi .sig-voir { margin-left: auto; font: 600 11.5px/1 var(--f-text); color: var(--ink-3); }
.moi .sg-texte > .sig-msg { border-top: 1px solid var(--rule); }
.moi .sg-bloc { display: grid; gap: 6px; padding: 9px 12px 10px 14px; border-top: 1px solid var(--rule); }
.moi .sg-k { font: 700 10px/1.1 var(--f-display); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.moi .sg-k small { margin-left: 6px; font: 400 11px/1 var(--f-text); letter-spacing: 0; text-transform: none; }
.moi .sg-lignes { gap: 0; padding-top: 4px; padding-bottom: 4px; }
.moi .sg-pl { display: grid; grid-template-columns: 76px minmax(0, 1fr) 16px; align-items: center; gap: 0 8px; padding: 6px 0; cursor: pointer; border-radius: 6px; }
.moi .sg-pl + .sg-pl { border-top: 1px solid var(--rule-2); }
.moi .sg-pl:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.moi .sg-pp { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; min-width: 0; }
.moi .sg-ou { font: 600 12px/1.2 var(--f-num); color: var(--ink-2); white-space: nowrap; } .moi .sg-ou.sg-vers { white-space: normal; }   /* 26/11 : versement = « PEA → … · CTO → … », peut passer à la ligne */
.moi .sg-pi { font-size: 13px; color: var(--ink-3); text-align: right; } .moi .sg-pl.on .sg-pi { color: var(--accent-ink); }
.moi .sg-pl .sg-ph { grid-column: 1 / -1; margin-top: 6px; }
.moi .sg-pl .sg-ph[hidden] { display: none; }
.moi .sg-pl .sig-pos { margin: 0; font-size: 12px; padding: 5px 8px; }
.moi .sg-ph { min-width: 0; font-size: 12.5px; line-height: 1.35; color: var(--ink-2); }
.moi .sg-ph b { color: var(--ink); font-weight: 600; }
.moi .sg-ph .sub { display: block; font-size: 11px; color: var(--ink-3); }
.moi .sg-pl .aide, .moi .sg-bloc > .aide { grid-column: 1 / -1; }
.moi .sg-pl.diff.on { background: color-mix(in srgb, var(--gold) 8%, transparent); margin: 0 -8px; padding-inline: 8px; }
.moi .sg-pl .sig-lab { white-space: nowrap; }
.moi .sg-diff { font-style: normal; font: 700 10.5px/1 var(--f-text); padding: 2px 6px; border-radius: 4px; color: var(--gold); background: color-mix(in srgb, var(--gold) 16%, transparent); white-space: nowrap; }
.moi .sg-exc { font-style: normal; font: 700 10.5px/1 var(--f-text); padding: 2px 6px; border-radius: 4px; color: var(--accent-ink); background: color-mix(in srgb, var(--accent) 16%, transparent); white-space: nowrap; }   /* 26/11 : pastille « exception creux » */
.moi .sg-cles .r { padding: 9px 0; }
.moi .sg-pt { display: block; font-size: 12.5px; line-height: 1.4; color: var(--ink); }
.moi .sg-pt i { font: 700 9.5px/1 var(--f-display); font-style: normal; letter-spacing: .08em; text-transform: uppercase; color: var(--accent-ink); margin-right: 4px; }
.moi .sg-j { position: relative; display: block; height: 26px; margin: 4px 6px 0; }
.moi .sg-j .sg-t { position: absolute; left: 0; right: 0; top: 4px; height: 6px; border-radius: 3px; background: var(--rule-2); overflow: hidden; }
.moi .sg-j .z { position: absolute; top: 0; bottom: 0; } .moi .sg-j .z.ok { background: color-mix(in srgb, var(--up) 45%, transparent); }
.moi .sg-j .z.mi { background: color-mix(in srgb, var(--gold) 50%, transparent); } .moi .sg-j .z.ko { background: color-mix(in srgb, var(--down) 40%, transparent); }
.moi .sg-j .m { position: absolute; top: 1px; width: 2px; height: 12px; margin-left: -1px; background: var(--ink-2); }
.moi .sg-j small { position: absolute; top: 15px; transform: translateX(-50%); font: 500 10px/1 var(--f-num); color: var(--ink-3); white-space: nowrap; }
.moi .sg-j .p { position: absolute; top: 0; width: 12px; height: 12px; margin-left: -6px; border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 2px var(--panel); }
.moi .sg-net { display: grid; gap: 4px; margin-top: 2px; }
.moi .sg-net > span { display: grid; grid-template-columns: 22px minmax(0, 1fr) 48px; align-items: center; gap: 8px; font: 500 11.5px/1 var(--f-num); color: var(--ink-2); }
.moi .sg-net em { height: 8px; border-radius: 4px; background: var(--rule-2); overflow: hidden; } .moi .sg-net em b { display: block; height: 100%; border-radius: 4px; background: var(--ink-3); }
.moi .sg-net > span.best { color: var(--ink); font-weight: 700; } .moi .sg-net > span.best em b { background: var(--accent); }
.moi .sg-net > span > span { text-align: right; } .moi .sg-net i { font-style: normal; }
.moi details.sg-rub { border: 1px solid var(--rule); border-radius: 10px; margin-top: 8px; background: var(--panel); }
.moi details.sg-rub > summary { list-style: none; cursor: pointer; display: grid; grid-template-columns: minmax(0, 1fr) auto 12px; align-items: center; gap: 8px; padding: 10px 11px; }
.moi details.sg-rub > summary::-webkit-details-marker { display: none; }
.moi details.sg-rub > summary span { font: 700 11.5px/1.2 var(--f-display); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-2); }
.moi details.sg-rub > summary b { font: 600 12px/1.1 var(--f-num); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px; }
.moi details.sg-rub > summary b.acc { color: var(--accent-ink); } .moi details.sg-rub > summary b.down { color: var(--down); }
.moi details.sg-rub > summary::after { content: "›"; font: 600 16px/1 var(--f-num); color: var(--ink-3); transition: transform .2s; }
.moi details.sg-rub[open] > summary::after { transform: rotate(90deg); }
.moi details.sg-rub > summary:focus-visible { outline: 2px solid var(--accent); border-radius: 10px; }
.moi details.sg-rub > :not(summary) { margin-left: 11px; margin-right: 11px; }
.moi details.sg-rub .r:last-child { border-bottom: 0; }
.moi .sg-intro { margin: 0 0 2px; font-size: 12.5px; line-height: 1.4; color: var(--ink-2); } .moi .sg-intro small { color: var(--ink-3); }
.moi .sg-frise { list-style: none; margin: 6px 0 4px 4px; padding: 0 0 0 14px; border-left: 2px solid var(--rule); display: grid; gap: 8px; }
.moi .sg-frise li { position: relative; display: grid; grid-template-columns: 62px auto; gap: 1px 8px; align-items: baseline; }
.moi .sg-frise li::before { content: ""; position: absolute; left: -19px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: var(--panel); border: 2px solid currentColor; color: var(--ink-3); }
.moi .sg-frise .d { font: 500 11px/1.2 var(--f-num); color: var(--ink-3); }
.moi .sg-frise .ty { font: 600 13px/1.2 var(--f-text); color: var(--ink); } .moi .sg-frise .ty small { margin-left: 4px; font: 700 10px/1 var(--f-display); letter-spacing: .06em; color: var(--ink-3); }
.moi .sg-frise li.t-ACHAT::before, .moi .sg-frise li.t-x2::before, .moi .sg-frise li.t-RELAIS::before { color: var(--up); } .moi .sg-frise li.t-VENTE::before { color: var(--down); }
.moi .sg-frise li.t-x1::before { color: var(--p0); } .moi .sg-frise li.t-CREUX::before, .moi .sg-frise li.t-EVITEE::before { color: var(--accent); } .moi .sg-frise li.t-REFUS::before { color: var(--gold); }
.moi .sg-frise .x i { font: 700 9.5px/1 var(--f-display); font-style: normal; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); margin-right: 3px; } .moi .sg-frise .x b { display: block; margin-top: 2px; font: 600 11.5px/1.2 var(--f-num); }
.moi .sg-frise .x { grid-column: 1 / -1; font-size: 12px; line-height: 1.35; color: var(--ink-2); }
.moi .sg-ventes { margin: 4px 0 2px; padding: 0 0 0 16px; display: grid; gap: 5px; font-size: 12.5px; line-height: 1.4; color: var(--ink-2); }
.moi .sg-ventes b { color: var(--ink); font-weight: 600; }
.moi .sg-bilan { display: grid; gap: 8px; padding-bottom: 10px; }
.moi .bl-ind { display: grid; gap: 3px; padding: 9px 10px; border-radius: 8px; background: var(--panel-2); font-size: 12.5px; line-height: 1.4; color: var(--ink-2); }
.moi .bl-h { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.moi .bl-h b { font: 700 13px/1.2 var(--f-text); color: var(--ink); } .moi .bl-h b small { font: 500 11px/1 var(--f-text); color: var(--ink-3); margin-left: 4px; }
.moi .bl-h em { font-style: normal; font: 600 11.5px/1.2 var(--f-text); color: var(--ink); white-space: nowrap; }
.moi .bl-d, .moi .bl-n { font-size: 11.5px; color: var(--ink-3); } .moi .bl-m small { color: var(--ink-3); }
.moi .bl-ep { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.moi .bl-ep li { display: grid; gap: 2px; padding: 0 0 6px 9px; border-left: 3px solid var(--rule); border-bottom: 1px solid var(--rule); }
.moi .bl-ep li.bon { border-left-color: var(--up); } .moi .bl-ep li.mauvais { border-left-color: var(--down); } .moi .bl-ep li.cours { border-left-color: var(--gold); }
.moi .bl-t { font-size: 12.5px; line-height: 1.35; color: var(--ink); } .moi .bl-s { font-size: 11px; line-height: 1.3; color: var(--ink-3); font-variant-numeric: tabular-nums; }
.moi .bl-ep b.up, .moi .bl-m b.up { color: var(--up); } .moi .bl-ep b.down, .moi .bl-m b.down { color: var(--down); }
.moi details.bl-plus > summary { cursor: pointer; font: 600 12px/1.2 var(--f-text); color: var(--accent-ink); padding: 4px 0; }
.moi details.bl-plus > ol { margin-top: 6px; }
.moi .sg-rien { min-width: 0; font: 600 11.5px/1.2 var(--f-text); color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.moi .sg-consigne { margin: 0; padding: 10px 12px 4px 14px; font: 700 15px/1.3 var(--f-text); color: var(--ink); }
.moi .sg-consigne.cash { font-size: 17px; color: var(--down); } .moi .sg-consigne.creux { color: var(--accent-ink); }
.moi .sg-texte > .sig-msg.sg-pq { margin: 6px 8px 0; padding: 0 4px; border: 0; font-size: 13px; line-height: 1.45; }
.moi .sg-texte > .sig-msg.sg-secu { padding: 7px 10px; border-radius: 8px; background: var(--down-bg); color: var(--ink); }
.moi .sg-texte > .sig-msg.sg-af { color: var(--ink); } .moi .sg-texte > .sig-msg.sg-note { color: var(--ink-3, var(--ink-2)); font-size: 12px; line-height: 1.4; }   /* 26/11 : « À faire : rien » et la note des deux moyennes */
.moi .sg-consigne + .sig-msg { border-top: 0; padding-top: 2px; padding-left: 14px; }
.moi .sg-texte > .sig-msg.ordre, .moi .sg-texte > .sig-msg.alerte { margin: 4px 8px 0; padding: 8px 10px; border: 0; border-radius: 8px; } .moi .sg-texte + .sg-bloc { margin-top: 8px; }
.moi .sg-perim { margin: 0; padding: 7px 12px 9px 14px; border-top: 1px solid var(--rule); font-size: 11.5px; line-height: 1.35; color: var(--ink-3); }
.moi .sg-def { display: block; margin-bottom: 2px; color: var(--ink-2); }
.moi .sg-def i { font: 700 9.5px/1 var(--f-display); font-style: normal; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); margin-right: 3px; }
.moi .sg-cles .r .a small { font: 400 11px/1 var(--f-text); color: var(--ink-3); margin-left: 4px; }
.moi details.sg-rub[data-rub="curieux"] .sig-h:first-child { margin-top: 4px; }
.moi .sig-detail > .sg-perim { border-top: 0; padding: 10px 0 0; }
.moi .m-status { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: var(--ink-2); }
/* saisie (feuille ➕) */
.moi.m-feuille { min-height: 70vh; }
.moi .m-seg4 button { font-size: 12.5px; padding: 10px 4px; }
/* v17.34 · saisie simplifiée (Conseil) : 2 onglets, date visible, phrase + bouton collés en bas, menu ⋯ */
#m-titre-saisie > span:first-child { display: inline-flex; align-items: center; gap: 8px; }
#m-titre-saisie .m-tete-a { display: inline-flex; align-items: center; gap: 4px; }
.moi .m-qm { width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--rule); background: var(--panel); color: var(--ink-2); font: 700 13px/1 var(--f-text); cursor: pointer; padding: 0; letter-spacing: 0; font-style: normal; }
.moi .m-qm[hidden], .moi .m-menu-b[hidden], .moi .m-seg2[hidden] { display: none; }
.moi .m-menu-b { font: 800 18px/1 var(--f-text); letter-spacing: 0; font-style: normal; color: var(--ink-2); }
.moi .m-menu-b[aria-expanded="true"] { color: var(--accent); }
.moi .m-menu { display: flex; flex-wrap: wrap; gap: 8px 16px; padding: 10px 12px; border: 1px solid var(--rule); border-radius: 10px; background: var(--panel); }
.moi .m-menu .nommer { flex-basis: 100%; }
.moi .m-date-l { display: flex; gap: 6px; align-items: center; min-width: 0; }
.moi .m-date-l .chip { flex: 0 0 auto; padding: 9px 11px; }
.moi .m-date-l input[type="date"] { flex: 1 1 auto; min-width: 0; width: auto; padding: 9px 8px; }
.moi .m-pu { margin: -6px 0 0; font-size: 12.5px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.moi .m-pu-l { justify-self: start; font-size: 12.5px; margin-top: -10px; }
/* v17.73 (lot57) · saisie dans l'ordre de l'avis d'opéré : 2 champs par ligne, contrôle ✓, erreur sous le champ, 1er champ manquant entouré */
.moi .m-pu[hidden], .moi .m-err[hidden] { display: none; }
.moi .m-pu.ok { color: var(--up); font-weight: 600; }
.moi .m-pu.warn { color: var(--down); font-weight: 600; }
.moi .m-err { display: block; font-size: 12px; line-height: 1.35; font-weight: 600; color: var(--down); }
.moi .champ input.a-erreur { border-color: var(--down); box-shadow: 0 0 0 1px var(--down); }
.moi .champ select.a-remplir, .moi .champ input.a-remplir { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.moi .m-avis2, .moi .m-ca { align-items: start; }
/* v17.76 (lot59) · « 📄 Importer mon avis d'opéré » */
.moi .m-imp { display: grid; gap: 8px; }
.moi .m-imp-b { justify-self: start; }
.moi .m-imp.ouvert { padding: 10px 12px; border: 1px solid var(--accent); border-radius: 10px; background: color-mix(in srgb, var(--accent) 7%, var(--panel)); font-size: 13px; }
.moi .m-imp-t { font-size: 13.5px; }
.moi .m-rv-auto { all: unset; box-sizing: border-box; display: block; position: relative; width: 100%; margin: 18px 0 0; padding: 6px 22px 6px 0; cursor: pointer; font: 500 11.5px/1.4 var(--f-text); color: var(--ink-2); }
.moi .m-rv-auto > i { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); font-style: normal; font-size: 16px; opacity: .6; }
.moi .m-rv-auto:focus-visible { outline: 2px solid var(--accent); border-radius: 6px; }
.moi .m-rv-auto small { display: block; color: var(--up); font-size: 11px; }
.moi .m-rv-auto.fait { color: var(--ink-2); }
.moi .m-rv-auto.fait small { color: var(--ink-2); }
.moi .m-meme { all: unset; box-sizing: border-box; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; width: 100%; margin: 0 0 10px; padding: 11px 14px; border-radius: 14px; background: color-mix(in srgb, var(--accent) 12%, var(--panel)); border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent); cursor: pointer; font: 600 14px/1.25 var(--f-text); color: var(--ink); }
.moi .m-meme small { font-weight: 500; color: var(--ink-2); font-size: 12.5px; }
.moi .m-imp .aide, .moi .m-imp-n { display: block; margin: 0; font-size: 12.5px; color: var(--ink-2); line-height: 1.4; }
.moi .m-imp-n.petit { font-size: 12px; color: var(--ink-3); overflow-wrap: anywhere; }
.moi .m-imp-n.warn, .moi .m-imp-msg { margin: 0; color: var(--down); font-weight: 600; font-size: 12.5px; }
.moi .m-cmp-l { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.moi .m-cmp-l li { display: flex; gap: 8px; align-items: center; justify-content: space-between; font-size: 12.5px; line-height: 1.35; padding: 6px 8px; border-radius: 10px; background: var(--panel-2, rgba(127,127,127,.08)); overflow-wrap: anywhere; }
.moi .m-cmp-l li.ko { color: var(--down); }
.moi .m-cmp-l li.ok span { color: var(--ink-2); }
.moi .m-cmp-b { justify-self: start; }
.moi .m-imp-a { display: flex; flex-wrap: wrap; gap: 8px; }
.moi .m-imp-a label.btn { cursor: pointer; }
.moi .m-imp textarea { width: 100%; box-sizing: border-box; min-height: 96px; font: 12px/1.35 ui-monospace, monospace; padding: 8px; border: 1px solid var(--rule); border-radius: 8px; background: var(--bg, var(--panel)); color: var(--ink); }
.moi .m-imp-l { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.moi .m-imp-o { all: unset; box-sizing: border-box; cursor: pointer; display: block; width: 100%; padding: 7px 10px; border: 1px solid var(--rule); border-radius: 8px; font-size: 12.5px; background: var(--panel); overflow-wrap: anywhere; }
.moi .m-imp-o[aria-current="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); font-weight: 600; }
.moi .m-imp-o.fait { opacity: .6; cursor: default; color: var(--up); }
.moi .m-na-isin { margin: 0; }
.moi .m-avis2 > .champ > label, .moi .m-ca > .champ > label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.moi .m-avis2 .champ input { padding-inline: 10px; }
.moi .m-pied { position: sticky; bottom: calc(-22px - env(safe-area-inset-bottom, 0px)); z-index: 2; display: grid; gap: 8px; margin: 0 -4px; padding: 10px 4px calc(12px + env(safe-area-inset-bottom, 0px)); background: linear-gradient(to bottom, transparent, var(--bg) 14px); }
.moi .m-pied .phrase-ordre { margin: 0; }
.moi .m-pied .phrase-ordre[hidden] { display: none; }
.moi #f-envoyer.manque { font-size: 13px; letter-spacing: .02em; text-transform: none; font-style: normal; }
.moi .m-rv { all: unset; box-sizing: border-box; cursor: pointer; display: flex; justify-content: space-between; align-items: center; gap: 10px; width: 100%; padding: 8px 12px; border: 1px dashed var(--rule); border-radius: 10px; font-size: 13px; color: var(--ink-2); }
.moi .m-rv span { display: block; min-width: 0; } .moi .m-rv small { display: block; margin-top: 2px; font-size: 12px; color: var(--ink-3); } .moi .m-rv i { font-style: normal; font-size: 18px; color: var(--ink-3); }
.moi .m-rv.fort { border-style: solid; border-color: var(--accent); background: color-mix(in srgb, var(--accent) 9%, var(--panel)); color: var(--ink); padding: 11px 12px; }
.moi .m-rv-etat { margin-top: 14px; padding: 10px 12px; border-radius: 10px; background: var(--panel); border: 1px solid var(--rule); font-size: 13px; color: var(--ink-2); display: grid; gap: 6px; }
.moi .m-rv-etat p { margin: 0; } .moi .m-rv-corr { justify-self: start; font-size: 12.5px; }
.moi .m-pru { margin: 10px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--panel); border: 1px solid var(--rule); font-size: 13.5px; line-height: 1.4; overflow-wrap: anywhere; }
.moi .m-pru small { color: var(--ink-3); font-size: 12px; }
.moi .jr.cible { background: color-mix(in srgb, var(--mc, #c80) 14%, transparent); border-radius: 8px; padding-left: 6px; padding-right: 6px; }
.moi .m-jplus { display: block; margin: 12px auto 0; font-size: 13.5px; color: var(--ink-2); text-align: center; min-height: 44px; }
.moi .jmois { margin: 14px 0 0; font: italic 800 12px/1 var(--f-display); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.moi .jmois:first-child { margin-top: 4px; }
.moi .jr .ja { flex-wrap: wrap; }
.moi .jconf { flex-basis: 100%; font-size: 12px; color: var(--ink-2); }
.moi .m-na { display: grid; gap: 10px; margin-top: 4px; }
.moi .m-na.cadre { margin-top: 8px; padding: 10px; border: 1px solid var(--rule-2); border-radius: 10px; }
.moi .m-na-t { display: block; } .moi .m-na-a { display: flex; gap: 14px; align-items: center; }
.moi .rap-h.fixe { grid-template-columns: minmax(0, 1fr) auto; }
.nt-tous small { flex: 1; margin-left: 8px; font-weight: 400; font-size: 12px; color: var(--ink-3); }
.moi .alerte.info { border-color: var(--accent); }
.moi.sans-aide .aide.m-garde { display: block !important; }   /* le versement lié touche à l'exactitude : jamais masqué */
.moi .form { display: grid; gap: 14px; }
/* v17.78 (lot60, Théo) · « + » en plein écran (profil complet seulement) et parcours en étapes */
#m-saisie.m-voile-plein { align-items: stretch; }
.feuille.m-plein { height: 100vh; height: 100dvh; max-height: none; min-height: 0; border-radius: 0; display: flex; flex-direction: column; gap: 14px; padding-top: max(8px, env(safe-area-inset-top, 0px)); overscroll-behavior: contain; }
.feuille.m-plein > h3 { position: sticky; top: calc(-1 * max(8px, env(safe-area-inset-top, 0px))); z-index: 3; margin: 0 -4px; padding: 8px 4px; background: var(--bg); }
/* v20.66 (bug de Clément) : rien ne rétrécit dans la feuille plein écran ; la barre Mouvement/Historique (.seg, overflow: hidden) était
   écrasée à 2 px dès que l'étape « Quoi ? » dépassait la hauteur de l'écran (gros texte du téléphone, carte des relevés…) : la feuille défile à la place */
.feuille.m-plein > * { flex-shrink: 0; }
.feuille.m-plein > #m-pane-ordre:not([hidden]) { flex: 1 0 auto; display: flex; flex-direction: column; }
.feuille.m-plein #m-form-ordre { flex: 1 0 auto; display: flex; flex-direction: column; gap: 14px; }
.feuille.m-plein #m-form-ordre > .m-pied { margin-top: auto; }
.moi .m-etapes { list-style: none; margin: 0; padding: 0; display: flex; gap: 6px; }
.moi .m-etapes li { flex: 1 1 0; min-width: 0; border-top: 3px solid var(--rule); padding-top: 5px; font-size: 11.5px; line-height: 1.2; color: var(--ink-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.moi .m-etapes li.cur { border-color: var(--accent); color: var(--ink); font-weight: 700; }
.moi .m-etapes li.fait { border-color: color-mix(in srgb, var(--accent) 45%, var(--rule)); }
.moi .m-etapes i { font-style: normal; font-weight: 700; }
.moi .m-et-b { all: unset; box-sizing: border-box; cursor: pointer; color: var(--ink-2); display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; padding: 4px 0; margin: -4px 0; }
.moi .m-et-b:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.moi .types.m-tuiles { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.moi .types .type-btn.m-tuile { font-size: 16px; }
.moi .m-tuile { display: grid; gap: 5px; justify-items: start; text-align: left; padding: 16px 14px; min-height: 76px; align-content: center; border-radius: 14px; font-size: 15px; }
.moi .m-tuile small { font: 400 12px/1.3 var(--f-text); color: var(--ink-3); letter-spacing: 0; text-transform: none; font-style: normal; }
.moi .m-imp.m-imp-petit { justify-items: end; margin-bottom: -6px; }
.moi .m-imp-p { border: 1px solid var(--rule); background: var(--panel); color: var(--ink-2); border-radius: 999px; padding: 6px 12px; font: 600 12.5px/1.2 var(--f-text); cursor: pointer; letter-spacing: 0; text-transform: none; font-style: normal; }
.moi .m-imp-p:focus-visible, .moi .m-choix:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.moi .m-aide-e { margin: -4px 0 0; font-size: 12.5px; line-height: 1.4; color: var(--ink-3); }
.moi .m-q { display: grid; gap: 10px; }
.moi .m-q-t { font-size: 16px; line-height: 1.3; }
.moi .m-choix { all: unset; box-sizing: border-box; cursor: pointer; display: grid; gap: 4px; width: 100%; padding: 13px 14px; border: 1px solid var(--rule); border-radius: 12px; background: var(--panel); font-size: 14.5px; color: var(--ink); }
.moi .m-choix small { font-size: 12.5px; line-height: 1.35; color: var(--ink-3); }
.moi .m-choix[aria-pressed="true"] { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.moi .m-choix[aria-pressed="true"] b::before { content: "✓ "; color: var(--accent); }
.moi .m-vers-m { margin: -2px 0 2px 14px; }
.moi .m-q .aide.lie { margin-top: 0; }
.moi .m-relire { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--rule); border-radius: 12px; background: var(--panel); }
.moi .m-relire .phrase-ordre { margin: 0; font-size: 15px; line-height: 1.45; }
.moi .m-relire .m-pu { margin: 0; }
.moi .m-relire .aide.lie { margin-top: -4px; }
.moi .m-relire-a { display: flex; flex-wrap: wrap; gap: 6px 18px; }
.moi .m-vers-l { margin: 0; font-size: 13.5px; font-weight: 600; }
.moi .rang.trois { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.moi .champ select, .moi .champ input[type="date"], .moi .champ input[type="text"] { font: 500 15px/1.2 var(--f-text); padding: 11px 12px; border-radius: 10px; border: 1px solid var(--rule); background: var(--panel); color: var(--ink); width: 100%; min-width: 0; }
.moi .champ input[inputmode="decimal"] { font-family: var(--f-num); font-variant-numeric: tabular-nums; }
.moi .aide.lie, .moi .champ .aide { display: block; background: none; border: 0; padding: 0; margin: 0; font-size: 11.5px; color: var(--ink-3); }
.moi .aide.lie { margin-top: -8px; }
.moi .types { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) auto; gap: 6px; }
.moi .types .type-btn { font-size: 13px; letter-spacing: .03em; }
.moi .types .plus-types { padding-inline: 10px; font-size: 12.5px; }
.moi .m-autres { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: -6px; }
.moi .m-autres .chip { padding: 8px 12px; }
.moi .m-autres-t { flex-basis: 100%; font-size: 11.5px; color: var(--ink-3); margin-top: 2px; }
.moi .champ .calc { display: block; font-size: 12px; line-height: 1.4; color: var(--accent-ink, var(--accent)); margin-top: 4px; }
.moi .champ .calc[hidden] { display: none; }
.moi .champ input.auto { border-style: dashed; }
.moi .champ > .lien { justify-self: start; margin-top: 4px; font-size: 13px; }
.moi .m-plus { border: 1px solid var(--rule); border-radius: 10px; background: var(--panel); }
.moi .m-plus > summary { cursor: pointer; list-style: none; padding: 11px 12px; font-weight: 600; font-size: 14px; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
.moi .m-plus > summary::-webkit-details-marker { display: none; }
.moi .m-plus > summary::before { content: "▸"; color: var(--ink-3); }
.moi .m-plus[open] > summary::before { content: "▾"; }
.moi .m-plus > summary small { font-weight: 400; font-size: 12.5px; color: var(--ink-3); }
.moi .m-plus-c { display: grid; gap: 12px; padding: 0 12px 12px; }
.moi .type-btn { border: 1px solid var(--rule); background: var(--panel); border-radius: 10px; padding: 11px 4px; cursor: pointer; font: italic 800 14px/1 var(--f-display); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); }
.moi .type-btn[aria-pressed="true"] { background: var(--ink); color: var(--bg); border-color: var(--ink); box-shadow: inset 0 -3px 0 var(--accent); }
.moi .raccourcis { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.moi .raccourcis > span:first-child { font-size: 12px; color: var(--ink-3); }
.moi .chip.suppr { border-color: var(--down); color: var(--down); }
.moi .coche { display: flex; gap: 10px; align-items: center; font-size: 14px; cursor: pointer; }
.moi .coche input { width: 20px; height: 20px; accent-color: var(--accent); }
.moi .mini-btn { border: 1px solid var(--rule); background: var(--panel); border-radius: 8px; padding: 6px 10px; font-size: 12.5px; cursor: pointer; color: var(--ink); }
.moi .phrase-ordre { margin: 4px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--panel-2); border-left: 3px solid var(--accent); font-size: 14px; line-height: 1.45; }
.moi .recap { display: grid; gap: 0; background: var(--panel); border: 1px solid var(--rule); border-radius: 10px; padding: 4px 12px; }
.moi .recap div { display: flex; justify-content: space-between; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--rule-2); font-size: 13px; color: var(--ink-2); align-items: center; }
.moi .recap div:last-child { border-bottom: 0; }
.moi .recap b { font: 600 13px/1.2 var(--f-num); font-variant-numeric: tabular-nums; color: var(--ink); text-align: right; }
.moi .alertes { display: grid; gap: 6px; }
.moi .alertes:empty, .moi .recap[hidden] { display: none; }
.moi .pied-form { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
.moi .nommer { display: flex; gap: 8px; align-items: center; flex: 1; min-width: 0; }
.moi .nommer input { flex: 1; min-width: 0; font: 500 14px/1.2 var(--f-text); padding: 8px 10px; border-radius: 8px; border: 1px solid var(--rule); background: var(--panel); color: var(--ink); }
.moi .m-jo { display: grid; }
.moi .jr { display: grid; grid-template-columns: 46px minmax(0, 1fr) auto; gap: 2px 10px; padding: 10px 0; border-bottom: 1px solid var(--rule); align-items: start; }
.moi .jr .jd { font: 600 13px/1.1 var(--f-num); }
.moi .jr .jd small { display: block; font-size: 10.5px; color: var(--ink-3); font-weight: 400; }
.moi .jr .jm { min-width: 0; display: grid; gap: 2px; }
.moi .jr .jm b { font-size: 14px; }
.moi .jr .jm span { font-size: 12px; color: var(--ink-3); overflow-wrap: anywhere; }
.moi .jr .jv { font: 600 13.5px/1.1 var(--f-num); font-variant-numeric: tabular-nums; text-align: right; }
.moi .jr .ja { grid-column: 2 / -1; display: flex; gap: 14px; }
.moi .jr.envoi { opacity: .6; }
.moi .tag.prog { background: var(--rule-2); color: var(--ink-2); }
.moi .tag.app { background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent-ink); }
.moi .raps { display: grid; }
.moi .rap { border-bottom: 1px solid var(--rule); }
.moi .rap-h { all: unset; box-sizing: border-box; cursor: pointer; width: 100%; display: grid; grid-template-columns: 10px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 11px 0; }
.moi .rap-h.fixe { cursor: default; }
.moi .rap-h:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.moi .rap-n { font-weight: 600; font-size: 14px; display: grid; gap: 2px; min-width: 0; }
.moi .rap-n small { font-weight: 400; font-size: 12px; color: var(--ink-3); }
.moi .pt { width: 8px; height: 8px; border-radius: 50%; background: var(--ink-3); }
.moi .pt.ok { background: var(--up); } .moi .pt.faire { background: #F59E0B; box-shadow: 0 0 0 3px color-mix(in srgb, #F59E0B 25%, transparent); }
.moi .st { font: 700 11px/1 var(--f-display); letter-spacing: .08em; text-transform: uppercase; padding: 4px 7px; border-radius: 5px; background: var(--rule-2); color: var(--ink-2); }
.moi .st.ok { background: var(--up-bg); color: var(--up); } .moi .st.faire { background: color-mix(in srgb, #F59E0B 18%, transparent); color: #D97706; }
.moi .rap-c { padding: 0 0 14px 20px; }
.moi .ligne-champ { display: flex; gap: 8px; }
.moi .ligne-champ input { flex: 1; min-width: 0; font: 500 15px/1.2 var(--f-num); padding: 11px 12px; border-radius: 10px; border: 1px solid var(--rule); background: var(--panel); color: var(--ink); }
.moi .m-h4 small { font: 400 12px/1.2 var(--f-text); letter-spacing: 0; text-transform: none; color: var(--ink-3); margin-left: 6px; }
.moi .m-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; margin: 4px 0 0; }
@media (max-width: 380px) { .moi .rang.trois { grid-template-columns: 1fr 1fr; } .moi .types .type-btn { font-size: 12px; letter-spacing: .01em; } }
/* jauge du millionnaire */
.m-million { --gold: #F5C542; position: relative; overflow: hidden; border-radius: 18px; padding: 18px 16px 16px; display: grid; gap: 12px; color: #F4F5F8;
  background: radial-gradient(120% 90% at 100% 0%, color-mix(in srgb, var(--gold) 34%, transparent), transparent 55%), radial-gradient(90% 80% at 0% 100%, color-mix(in srgb, var(--mc) 40%, transparent), transparent 60%), #0B0D12;
  border: 1px solid color-mix(in srgb, var(--gold) 45%, #0B0D12); box-shadow: 0 10px 30px rgba(0,0,0,.35); }
.m-million .mm-h { display: flex; justify-content: space-between; align-items: center; }
.m-million .mm-k { font: italic 800 15px/1 var(--f-display); letter-spacing: .14em; text-transform: uppercase; color: var(--gold); }
.m-million .mm-prive { font: 700 10px/1.4 var(--f-display); letter-spacing: .12em; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; border: 1px solid rgba(255,255,255,.25); color: rgba(255,255,255,.7); }
.m-million .mm-pct { display: flex; align-items: baseline; gap: 4px; }
.m-million .mm-pct b { font: italic 800 clamp(64px, 22vw, 96px)/.9 var(--f-display); letter-spacing: -.01em; background: linear-gradient(180deg, #FFF3C4, var(--gold) 60%, #B7791F); -webkit-background-clip: text; background-clip: text; color: transparent; }
.m-million .mm-pct span { font: italic 800 28px/1 var(--f-display); color: var(--gold); }
.m-million .mm-flaps .m-flap { width: clamp(22px, 7vw, 34px); height: clamp(32px, 10vw, 48px); font-size: clamp(18px, 6vw, 28px); }
.m-million .mm-piste { position: relative; height: 54px; margin: 6px 4px 0 2px; }
.m-million .mm-rail { position: absolute; left: 0; right: 0; top: 10px; height: 14px; border-radius: 7px; background: rgba(255,255,255,.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); }
.m-million .mm-rail i { position: absolute; inset: 0 auto 0 0; border-radius: 7px; background: linear-gradient(90deg, var(--mc), var(--gold)); box-shadow: 0 0 18px color-mix(in srgb, var(--gold) 60%, transparent); }
.m-million .mm-rail em { position: absolute; top: -7px; width: 12px; height: 28px; margin-left: -6px; border-radius: 3px; background: #fff; transform: skewX(-12deg); box-shadow: 0 0 0 3px var(--mc), 0 0 16px #fff; }
.m-million .mj { position: absolute; top: 0; transform: translateX(-50%); display: grid; justify-items: center; gap: 22px; }
.m-million .mj i { width: 2px; height: 34px; background: rgba(255,255,255,.25); position: absolute; top: 4px; }
.m-million .mj b { margin-top: 36px; font: 600 10.5px/1 var(--f-num); color: rgba(255,255,255,.55); }
.m-million .mj.passe b { color: var(--gold); } .m-million .mj.passe i { background: var(--gold); }
.m-million .mj.fin { transform: translateX(-100%); }
.m-million .mj.fin i { width: 14px; height: 34px; background: repeating-conic-gradient(#fff 0 25%, #0B0D12 0 50%) 0 0 / 7px 7px; border-radius: 2px; }
.m-million .mj.fin b { color: var(--gold); font-weight: 800; }
.m-million .mm-eta { margin: 0; font-size: 16px; line-height: 1.4; }
.m-million .mm-eta b { color: var(--gold); font-weight: 700; }
.m-million .mm-sub { margin: 0; font-size: 13px; color: rgba(255,255,255,.75); }
.m-million .mm-sub b { font-family: var(--f-num); color: #fff; }
.m-million .mm-d { display: flex; align-items: center; gap: 10px; }
.m-million .mm-coche { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: rgba(255,255,255,.7); cursor: pointer; }
.m-million .mm-coche input { width: 16px; height: 16px; margin: 0; accent-color: var(--gold); }
.m-million.reduit { gap: 8px; padding: 12px 14px; }
.m-million .mm-ligne { margin: 0; display: flex; align-items: baseline; gap: 10px; }
.m-million .mm-ligne b { font: italic 800 28px/1 var(--f-display); color: var(--gold); }
.m-million .mm-ligne span { font-size: 13.5px; color: rgba(255,255,255,.8); }
.m-million .mm-rail.mini { position: relative; top: 0; height: 8px; }
.m-million .mm-badge { margin: 0; padding: 9px 11px; border-radius: 10px; font-size: 12.5px; line-height: 1.4; color: rgba(255,255,255,.85); background: rgba(245,197,66,.1); border: 1px dashed rgba(245,197,66,.45); }
.m-million .mm-badge b { color: #F5C542; }
.m-million .mm-note { margin: 0; font-size: 11.5px; color: rgba(255,255,255,.5); }

/* missions : série, paliers, fête (repris de Cote) */
.moi .m-onglets button { font-size: 12.5px; padding: 10px 2px; }
.moi .m-bilans { display: flex; flex-wrap: wrap; gap: 8px; }
.wr .cl-flaps { display: flex; flex-wrap: wrap; justify-content: center; align-self: stretch; width: 100%; margin: 14px 0 6px; gap: 3px; }
.wr .cl-flaps .m-flap { width: clamp(22px, 7vw, 40px); height: clamp(34px, 10.6vw, 60px); font-size: clamp(22px, 7vw, 40px); }
.wr .cl-flaps { --fh: clamp(34px, 10.6vw, 56px); } .wr .cl-serie .t-billet::after, .wr .cl-serie .t-ticket .tk-h { display: none; } .wr .cl-serie .t-billet { padding-right: calc(var(--fh) * .3); }   /* v17.4 : styles de compteur (billet…) dans la clôture : --fh manquait (iPhone) */
.wr .cl-serie { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 10px 0; } .wr .cl-serie .cl-flaps { margin: 0; width: auto; align-self: auto; }
.wr .cl-fl { font: 800 28px/1 var(--f-display); opacity: .7; }
.wr .cl-jauge { height: 8px; border-radius: 4px; background: rgba(255,255,255,.18); overflow: hidden; margin: 6px 0 2px; } .wr .cl-jauge i { display: block; height: 100%; background: var(--c, #9B87FF); border-radius: 4px; }
.m-million .mm-plus { font: 600 12px/1 var(--f-ui, inherit); color: rgba(255,255,255,.85); background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.22); border-radius: 999px; padding: 6px 10px; cursor: pointer; white-space: nowrap; }
.m-million .mm-mini { margin: 0; font-size: 12.5px; line-height: 1.4; color: rgba(255,255,255,.78); } .m-million .mm-mini b { color: #fff; }
.moi .m-ec { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.moi .m-ec-t { display: flex; flex-direction: column; gap: 4px; text-align: left; padding: 10px 12px; border-radius: 12px; background: var(--panel); border: 1px solid var(--rule); color: var(--ink-2); font: inherit; font-size: 12px; min-width: 0; }
.moi button.m-ec-t { cursor: pointer; }
.moi .m-ec-t .k { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--ink-3); }
.moi .m-ec-t b { font: italic 800 20px/1.1 var(--f-display); color: var(--ink); overflow-wrap: anywhere; }
.moi .m-ec-t small { font-size: 12px; line-height: 1.35; overflow-wrap: anywhere; }
.moi .m-ec-t.attente { border-color: color-mix(in srgb, #F59E0B 55%, var(--rule)); }
.moi .m-ec-t .warn { color: #F59E0B; } .moi .m-ec-t .up { color: var(--up); }
.moi .m-serie { display: flex; align-items: baseline; gap: 10px; padding: 10px 12px; border-radius: 12px; background: var(--panel); border: 1px solid var(--rule); font-size: 12.5px; color: var(--ink-2); }
.moi .m-serie b { font: italic 800 20px/1 var(--f-display); letter-spacing: .04em; white-space: nowrap; color: var(--ink); }
.moi .m-serie:not(.ok) { border-color: color-mix(in srgb, #F59E0B 55%, var(--rule)); }
.moi .mois12 { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 4px; }
.moi .mois12 span { display: grid; gap: 4px; justify-items: center; }
.moi .mois12 i { width: 100%; height: 22px; border-radius: 4px; background: var(--rule-2); }
.moi .mois12 .ok i { background: linear-gradient(to bottom, var(--gold) 0 50%, color-mix(in srgb, var(--gold) 82%, #000) 50% 100%); }
.moi .mois12 .cours i { outline: 2px solid var(--ink); outline-offset: 1px; }
.moi .mois12 b { font: 600 10px/1 var(--f-num); color: var(--ink-3); }
.moi .pl-r.fait:focus-visible { outline: 2px solid var(--accent); }
.moi .pastille { justify-self: start; position: relative; padding: 7px 9px; border-radius: 6px; background: linear-gradient(to bottom, var(--flap-2) 0 50%, var(--flap) 50% 100%); color: var(--flap-ink); font: 600 15px/1 var(--f-num); letter-spacing: .04em; }
.moi .pl-r.fait .pastille { color: #F5C542; }
.moi .pl-r:not(.fait) .pastille { opacity: .7; }
.moi .pl-r .jauge i { background: var(--gold); }
.moi .tous-paliers { display: grid; gap: 10px; }
.moi .tous-paliers h3.m-sous { display: flex; justify-content: space-between; align-items: baseline; }
.moi .tous-paliers h3.m-sous small { font: 500 12px/1 var(--f-num); color: var(--ink-3); }
.moi .pl-liste { display: grid; }
.moi .pl-r { all: unset; box-sizing: border-box; display: grid; grid-template-columns: 62px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--rule-2); }
.moi .pl-r .pastille { padding: 5px 7px; font-size: 12.5px; }
.moi .pl-r.fait { cursor: pointer; }
.moi .pl-r .pl-t { font-size: 13px; line-height: 1.3; display: grid; gap: 4px; min-width: 0; }
.moi .pl-r .pl-t .jauge { height: 4px; }
.moi .pl-r .pl-t small { font-size: 11px; color: var(--ink-3); }
.moi .pl-r:not(.fait) .pl-t { color: var(--ink-2); }
.moi .pl-r .pl-s { font: 500 12px/1 var(--f-num); color: var(--ink-3); white-space: nowrap; }
.moi .pl-r.fait .pl-s { color: var(--up); }
.m-fete { position: fixed; inset: 0; z-index: 95; display: flex; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 24px 16px; text-align: center; color: #F4F5F8;
  background: radial-gradient(circle at 50% 30%, rgba(245,197,66,.35), transparent 60%), #0B0D12; }
.m-fete > div { display: grid; gap: 16px; justify-items: center; max-width: 480px; margin: auto; }
.m-fete .mf-k { font: 700 13px/1 var(--f-display); letter-spacing: .16em; text-transform: uppercase; color: #F5C542; }
.m-fete .m-flaps { justify-content: center; }
.m-fete h3 { margin: 0; font: italic 800 24px/1.15 var(--f-display); letter-spacing: .05em; text-transform: uppercase; }
.m-fete p { margin: 0; opacity: .75; font-size: 14px; }
.moi .m-bilan { margin: 10px 0 2px; font-size: 15px; line-height: 1.4; color: var(--ink); }
.moi .m-bilan b { font-weight: 800; white-space: nowrap; }
.moi .m-bilan .up { color: var(--up); font-weight: 600; white-space: nowrap; } .moi .m-bilan .neutre { color: var(--ink-2); font-weight: 600; white-space: nowrap; }
.moi .m-bilan .bl-faire { all: unset; cursor: pointer; font-weight: 700; color: var(--gold); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
.moi .m-bilan .bl-ok { color: var(--ink-2); }
.moi .m-afaire.m-rappel { display: grid; gap: 0; padding: 4px 12px 6px; align-items: stretch; }
.moi .m-afaire .af-h { display: flex; align-items: center; gap: 8px; padding: 6px 0 4px; }
.moi .m-afaire .af-h b { font-size: 15px; } .moi .m-afaire .af-h small { margin-left: auto; font-size: 11.5px; color: var(--ink-3); }
.moi .m-afaire .af-n { min-width: 22px; height: 22px; padding: 0 6px; box-sizing: border-box; border-radius: 11px; display: inline-grid; place-items: center; font: 700 12.5px/1 var(--f-num); background: var(--gold); color: #1A1406; }
.moi .m-afaire .af-r { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-top: 1px solid color-mix(in srgb, var(--gold) 25%, transparent); }
.moi .m-afaire .af-i { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 15px; background: color-mix(in srgb, var(--gold) 18%, transparent); }
.moi .m-afaire .af-t { flex: 1; min-width: 0; display: grid; gap: 1px; } .moi .m-afaire .af-t b { font-size: 14px; line-height: 1.25; } .moi .m-afaire .af-t small { font-size: 12px; color: var(--ink-2); }
.moi .m-afaire .af-a { flex: none; display: grid; gap: 2px; justify-items: center; } .moi .m-afaire .af-a .lien { font-size: 12px; white-space: nowrap; } .moi .m-afaire .af-a [data-lx-sans] { white-space: normal; max-width: 96px; text-align: center; line-height: 1.2; }
.moi .m-afaire .af-plus > summary { cursor: pointer; padding: 8px 0 4px; font-size: 13px; font-weight: 600; color: var(--ink-2); border-top: 1px solid color-mix(in srgb, var(--gold) 25%, transparent); }
.moi .m-afaire .af-rep { margin: 4px 0 2px; font-size: 12px; color: var(--ink-3); }
.moi .m-afaire.vide { display: flex; align-items: center; gap: 10px; margin: 10px 0 4px; padding: 9px 12px; border-radius: 14px; border: 1px solid var(--rule); background: var(--panel); font-size: 13.5px; color: var(--ink-2); }
.moi .m-afaire.vide b { color: var(--ink); } .moi .m-afaire .af-ok { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; color: var(--up); background: var(--up-bg, color-mix(in srgb, var(--up) 18%, transparent)); }
.moi .av-rdv .av-du i { color: var(--gold); }
.moi .art-point { display: flex; align-items: center; gap: 10px; margin: 14px 0 4px; padding: 10px 12px; border-radius: 14px; border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--rule)); background: color-mix(in srgb, var(--gold) 10%, transparent); }
.moi .art-point span { flex: 1; display: grid; gap: 2px; font-size: 14px; } .moi .art-point small { font-size: 12px; color: var(--ink-2); }
.moi.pa .pa-expl { margin: -6px 0 0; font-size: 13.5px; line-height: 1.4; color: var(--ink-2); padding: 10px 12px; border-radius: 12px; background: var(--panel); }
.moi.pa .pa-expl b { color: var(--ink); }
.moi.pa .pa-vide { margin: 0; font-size: 12.5px; color: var(--ink-3); text-align: center; }
.moi.pa .pa-pied { margin: 0; font-size: 13px; color: var(--ink-2); text-align: center; }
.moi.pa #pa-envoyer.arme { background: var(--gold); color: #1A1406; }
/* lot 55 · objets « vivants » des paliers hauts */
.moi .m-flap.af-paillettes { overflow: hidden; border-radius: 8px; color: #FFF8E1; font-weight: 600; text-shadow: 0 0 6px rgba(255,236,170,.75);
  background: radial-gradient(1.5px 1.5px at 22% 30%, #fff 60%, transparent), radial-gradient(1px 1px at 70% 22%, #FFE9A8 60%, transparent), radial-gradient(1.5px 1.5px at 40% 78%, #fff 60%, transparent), radial-gradient(1px 1px at 80% 64%, #FFE9A8 60%, transparent), linear-gradient(160deg, #1F1640, #3A2470 55%, #1A1236);
  box-shadow: inset 0 0 0 1px rgba(255,233,168,.25), 0 4px 12px rgba(122,84,255,.3); }
.moi .m-flap.af-paillettes::after { top: 0; bottom: 0; height: auto; margin: 0; background: radial-gradient(2px 2px at 30% 40%, #fff 50%, transparent), radial-gradient(2px 2px at 68% 70%, #fff 50%, transparent), radial-gradient(1.5px 1.5px at 55% 18%, #fff 50%, transparent); animation: mPaillettes 2.4s ease-in-out infinite; }
.moi .m-flap.af-paillettes:nth-child(2n)::after { animation-delay: -.8s; } .moi .m-flap.af-paillettes:nth-child(3n)::after { animation-delay: -1.6s; }
@keyframes mPaillettes { 0%, 100% { opacity: 0; transform: scale(.6); } 45% { opacity: 1; transform: scale(1); } 70% { opacity: .2; } }
.moi .m-flap.af-paillettes.u, .moi .m-flap.af-paillettes.s { color: #FFE9A8; }
.fx-pulsar { stroke-width: 6; stroke-dasharray: 26 640; opacity: .95; filter: drop-shadow(0 0 4px #fff); animation: fxPulsar 3.2s linear infinite; }
@keyframes fxPulsar { from { stroke-dashoffset: 666; } to { stroke-dashoffset: 0; } }
.moi svg.vs-cb[class*="fx-"] { stroke-dasharray: none; stroke-width: 0; opacity: 1; filter: none; animation: none; }   /* lot 55 : les règles .fx-* du graphe ne doivent pas s'appliquer à l'aperçu entier (il était pâle et flou) */
.moi .vs-cb.fx-pulsar path.x { display: block; stroke-width: 5; stroke-dasharray: 10 70; filter: drop-shadow(0 0 2px #fff); animation: fxPulsarP 1.6s linear infinite; }
@keyframes fxPulsarP { from { stroke-dashoffset: 80; } to { stroke-dashoffset: 0; } }
#v-moi.th.th-vivant .m-hero { background-size: 300% 300%; animation: mOpale 14s ease-in-out infinite alternate; }
@keyframes mOpale { from { background-position: 0% 40%; } to { background-position: 100% 60%; } }
/* lot 62 · Journées folles : le grand effet (plein écran, toucher pour passer) */
.m-folle { position: fixed; inset: 0; z-index: 94; display: grid; place-items: center; padding: 24px 16px; color: #FFF6E8; cursor: pointer; opacity: 0; transition: opacity .35s ease; -webkit-tap-highlight-color: transparent; outline: none; }
.m-folle.on { opacity: 1; } .m-folle.fin { opacity: 0; transition-duration: .4s; pointer-events: none; }
.m-folle.feu { background: linear-gradient(0deg, rgba(120,28,6,.75), transparent 34%), radial-gradient(130% 60% at 50% 118%, rgba(200,60,10,.7), transparent 70%), rgba(12,4,2,.95); }
.m-folle.joie { background: radial-gradient(120% 70% at 50% -10%, rgba(30,60,110,.75), transparent 70%), rgba(4,7,18,.95); }
.m-folle canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.m-folle .mfo-c { position: relative; display: grid; justify-items: center; gap: 6px; text-align: center; max-width: 340px; margin-top: -14vh; }
.m-folle .mfo-k { font: italic 800 15px/1 var(--f-display); letter-spacing: .22em; text-transform: uppercase; color: #FFC46B; }
.m-folle.joie .mfo-k { color: #7CF5C4; }
.m-folle .mfo-d { font: 600 13px/1.2 var(--f-text); letter-spacing: .04em; opacity: .8; }
.m-folle .mfo-p { font: italic 800 clamp(64px, 21vw, 104px)/1 var(--f-display); letter-spacing: -.01em; font-variant-numeric: tabular-nums; margin: 6px 0 2px; white-space: nowrap; }
.m-folle.feu .mfo-p { color: #FFE2B0; text-shadow: 0 0 18px rgba(255,120,30,.85), 0 0 46px rgba(255,60,10,.55), 0 2px 0 rgba(60,10,0,.6); }
.m-folle.joie .mfo-p { color: #F2FFFA; text-shadow: 0 0 18px rgba(94,234,212,.75), 0 0 46px rgba(255,111,168,.4), 0 2px 0 rgba(0,20,30,.5); }
.m-folle .mfo-e { font: 700 17px/1 var(--f-num); opacity: .9; }
.m-folle p { margin: 10px 0 0; font: 600 15px/1.4 var(--f-text); color: #FFF1DC; text-shadow: 0 1px 8px rgba(0,0,0,.9); }
.m-folle .mfo-t { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(22px + env(safe-area-inset-bottom, 0px)); padding: 6px 12px; border-radius: 999px; background: rgba(0,0,0,.5); font-size: 12px; letter-spacing: .06em; color: rgba(255,255,255,.75); white-space: nowrap; }
.m-folle.on .mfo-c > * { animation: mfoIn .7s cubic-bezier(.2,.9,.25,1.2) both; }
.m-folle.on .mfo-c > :nth-child(2) { animation-delay: .08s; } .m-folle.on .mfo-c > :nth-child(3) { animation-delay: .16s; } .m-folle.on .mfo-c > :nth-child(n+4) { animation-delay: .5s; }
@keyframes mfoIn { from { opacity: 0; transform: translateY(14px) scale(.92); } to { opacity: 1; transform: none; } }
.m-folle.feu.on .mfo-p { animation: mfoIn .7s cubic-bezier(.2,.9,.25,1.2) .16s both, mfoVacille 2.2s ease-in-out .9s infinite; }
@keyframes mfoVacille { 0%, 100% { filter: brightness(1); } 30% { filter: brightness(1.12); } 55% { filter: brightness(.94); } 75% { filter: brightness(1.08); } }
.m-folle.feu.fort.on .mfo-c, .m-folle.feu.explo.on .mfo-c { animation: mfoSecousse .5s linear .05s 1; }
.m-folle.joie.bonbons { background: radial-gradient(120% 70% at 50% -10%, rgba(120,40,110,.6), transparent 70%), rgba(14,8,24,.95); } .m-folle.joie.bonbons .mfo-k { color: #FF9FCB; }
.m-folle.joie.bonbons .mfo-p { color: #FFF5FB; text-shadow: 0 0 18px rgba(255,111,168,.7), 0 0 46px rgba(94,234,212,.4), 0 2px 0 rgba(30,0,20,.5); }
@keyframes mfoSecousse { 0%, 100% { transform: none; } 20% { transform: translate(-5px, 2px); } 40% { transform: translate(4px, -3px); } 60% { transform: translate(-3px, 2px); } 80% { transform: translate(2px, -1px); } }
.m-folle.joie.fort.on .mfo-p { animation: mfoIn .7s cubic-bezier(.2,.9,.25,1.2) .16s both, mfoAurore 3s ease-in-out 1s infinite; }
@keyframes mfoAurore { 50% { text-shadow: 0 0 24px rgba(163,230,53,.8), 0 0 64px rgba(94,234,212,.6), 0 2px 0 rgba(0,20,30,.5); } }
.m-folle.calme .mfo-c > *, .m-folle.calme .mfo-p, .m-folle.calme .mfo-c { animation: none !important; }
@media (prefers-reduced-motion: reduce) { .m-folle .mfo-c > *, .m-folle .mfo-p, .m-folle .mfo-c { animation: none !important; } }
/* lot 62 b · les autres événements : un fond par scène (le texte reste lisible), la petite carte « pourquoi » sur Aujourd'hui */
.m-folle.krach { background: linear-gradient(180deg, rgba(40,46,60,.9), rgba(8,10,16,.96) 60%); } .m-folle.krach .mfo-k { color: #B9C6E0; }
.m-folle.krach .mfo-p { color: #F1F4FA; text-shadow: 0 0 22px rgba(170,190,230,.6), 0 2px 0 rgba(0,0,0,.6); }
.m-folle.crypto { background: radial-gradient(110% 60% at 50% 50%, rgba(60,24,90,.7), transparent 70%), rgba(8,5,14,.95); } .m-folle.crypto .mfo-k { color: #F7931A; }
.m-folle.crypto .mfo-p { color: #FFF3E2; text-shadow: 0 0 18px rgba(247,147,26,.8), 0 0 46px rgba(196,181,253,.45), 0 2px 0 rgba(0,0,0,.6); }
.m-folle.sommet { background: linear-gradient(180deg, rgba(20,26,70,.96), rgba(70,40,90,.95) 55%, rgba(14,16,38,.97)); } .m-folle.sommet .mfo-k { color: #FFC9B0; }
.m-folle.sommet .mfo-c { margin-top: -34vh; } .m-folle.sommet .mfo-p { color: #FFF6F0; text-shadow: 0 0 22px rgba(255,160,140,.6), 0 2px 0 rgba(0,0,0,.5); }
.m-folle.serie { background: radial-gradient(120% 60% at 50% 100%, rgba(40,90,70,.6), transparent 70%), rgba(6,14,16,.95); } .m-folle.serie .mfo-k { color: #A3E635; }
.m-folle.serie .mfo-c { margin-top: -30vh; } .m-folle.serie .mfo-p { color: #F4FFE8; text-shadow: 0 0 20px rgba(163,230,53,.55), 0 2px 0 rgba(0,0,0,.5); }
.m-folle.relache { background: linear-gradient(180deg, rgba(7,10,28,.97), rgba(20,22,52,.96)); } .m-folle.relache .mfo-k { color: #C4B5FD; }
.m-folle.relache .mfo-p { color: #E8E6FF; text-shadow: 0 0 20px rgba(196,181,253,.5); }
.m-folle.record, .m-folle.pirebaisse, .m-folle.volhaut, .m-folle.volbas { background: linear-gradient(180deg, rgba(8,12,26,.96), rgba(14,20,38,.96)); }   /* lot 63 : sobres */
.m-folle.record .mfo-k { color: #7CF5C4; } .m-folle.pirebaisse .mfo-k { color: #9EC2FF; } .m-folle.volhaut .mfo-k { color: #B9C6E0; } .m-folle.volbas .mfo-k { color: #C5F06B; }
.m-folle.record .mfo-p, .m-folle.pirebaisse .mfo-p, .m-folle.volhaut .mfo-p, .m-folle.volbas .mfo-p { color: #F4F7FF; text-shadow: 0 0 18px rgba(160,190,255,.35), 0 2px 0 rgba(0,0,0,.5); }
.m-folle.plat { background: linear-gradient(180deg, rgba(8,16,34,.97), rgba(10,30,44,.96)); } .m-folle.plat .mfo-k { color: #9EE3F0; }
.m-folle.plat .mfo-c { margin-top: -30vh; } .m-folle.plat .mfo-p { color: #EEFBFF; text-shadow: 0 0 20px rgba(158,227,240,.45), 0 2px 0 rgba(0,0,0,.5); }
.m-folle .mfo-p.long { font-size: clamp(48px, 15vw, 80px); }
.moi .m-ev { display: flex; flex-wrap: wrap; gap: 6px; margin-top: -4px; }   /* lot 62 c (Théo) : de petites pastilles sous la carte du haut, rien de pleine largeur */
.moi .m-ev-p { display: inline-flex; align-items: stretch; max-width: 100%; border: 1px solid color-mix(in srgb, var(--evc, var(--rule)) 45%, var(--rule)); border-radius: 999px; background: var(--panel); overflow: hidden; }
.moi .m-ev-p.on { border-color: var(--evc, var(--accent)); background: color-mix(in srgb, var(--evc, var(--accent)) 14%, var(--panel)); }
.moi .m-ev-p .m-ev-b { all: unset; box-sizing: border-box; position: relative; display: inline-flex; align-items: center; gap: 5px; min-width: 0; min-height: 30px; padding: 3px 2px 3px 10px; font: 600 12.5px/1.2 var(--f-text); color: var(--ink); cursor: pointer; white-space: nowrap; -webkit-tap-highlight-color: transparent; }
.moi .m-ev-p .m-ev-b small { color: var(--ink-3); font-weight: 600; }
.moi .m-ev-p .m-ev-x { all: unset; box-sizing: border-box; display: grid; place-items: center; width: 28px; min-height: 30px; color: var(--ink-3); font-size: 11px; cursor: pointer; }
.moi .m-ev-nvp { position: absolute; top: 3px; left: 3px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); }
.moi .m-ev.conf { display: grid; gap: 8px; padding: 10px 12px; border: 1px solid var(--rule); border-radius: 12px; background: var(--panel); }
.moi .m-ev-q { margin: 0; font-size: 13px; line-height: 1.4; color: var(--ink-2); } .moi .m-ev-q b { color: var(--ink); }
.moi .m-ev-a { display: flex; gap: 8px; } .moi .m-ev-a .btn { padding: 7px 14px; }
.moi .m-ev-b:focus-visible, .moi .m-ev-x:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.moi [data-ev="feu"] { --evc: #FF6E28; } .moi [data-ev="krach"] { --evc: #96AAD2; } .moi [data-ev="crypto"] { --evc: #F7931A; } .moi [data-ev="joie"] { --evc: #FF6FA8; }
.moi [data-ev="record"] { --evc: #5EEAD4; } .moi [data-ev="pirebaisse"] { --evc: #7FB2FF; } .moi [data-ev="volhaut"] { --evc: #96AAD2; } .moi [data-ev="volbas"] { --evc: #A3E635; }
.moi [data-ev="serie"] { --evc: #5EEAD4; } .moi [data-ev="sommet"] { --evc: #FFA08C; } .moi [data-ev="relache"] { --evc: #C4B5FD; } .moi [data-ev="plat"] { --evc: #7CCFE0; }

/* l'ambiance de la journée sur Aujourd'hui : derrière le contenu, quelques braises qui montent (ou paillettes d'or qui scintillent) */
.moi .m-amb { position: fixed; inset: 0; z-index: -1; pointer-events: none; overflow: hidden; }
.moi .m-amb.feu { background: radial-gradient(120% 34% at 50% 104%, rgba(255,96,30,.16), transparent 70%); }
.moi .m-amb.joie { background: radial-gradient(120% 30% at 50% -4%, rgba(94,234,212,.10), transparent 70%); }
.moi .m-amb i { position: absolute; width: var(--s); height: var(--s); border-radius: 50%; will-change: transform, opacity; }
.moi .m-amb.feu i { bottom: -8px; background: #FFB347; box-shadow: 0 0 6px 2px rgba(255,120,30,.7); animation: mAmbBraise var(--d) linear var(--r) infinite; }
.moi .m-amb.joie i { background: var(--c); box-shadow: 0 0 6px 1px var(--c); animation: mAmbJoie var(--d) ease-in-out var(--r) infinite; }
@keyframes mAmbBraise { 0% { transform: translate(0, 0); opacity: 0; } 10% { opacity: .9; } 50% { transform: translate(14px, -45vh); } 80% { opacity: .5; } 100% { transform: translate(-8px, -88vh); opacity: 0; } }
@keyframes mAmbJoie { 0%, 100% { opacity: 0; transform: translateY(0) scale(.4); } 45% { opacity: .95; transform: translateY(10px) scale(1); } 70% { opacity: .2; transform: translateY(16px) scale(.6); } }
.moi .m-hero.m-amb-feu .m-jour .badge { box-shadow: 0 0 0 1px rgba(255,110,40,.45), 0 0 14px rgba(255,90,30,.35); }
.moi .m-hero.m-amb-joie .m-jour .badge, .moi .m-hero.m-amb-serie .m-jour .badge { box-shadow: 0 0 0 1px rgba(94,234,212,.5), 0 0 14px rgba(255,111,168,.3); }
.moi .m-amb.crypto i, .moi .m-amb.relache i, .moi .m-amb.serie i { background: var(--c); box-shadow: 0 0 6px 1px var(--c); animation: mAmbJoie var(--d) ease-in-out var(--r) infinite; }
.moi .m-amb.krach { background: linear-gradient(180deg, rgba(120,140,180,.10), transparent 40%); }
.moi .m-amb.krach i { top: -12vh; width: 1px; height: 10vh; border-radius: 0; background: linear-gradient(180deg, transparent, rgba(170,190,230,.45)); animation: mAmbPluie var(--d) linear var(--r) infinite; }
@keyframes mAmbPluie { from { transform: translate(0, 0) rotate(12deg); } to { transform: translate(-16vh, 125vh) rotate(12deg); } }
.moi .m-amb.sommet { background: radial-gradient(90% 30% at 50% -6%, rgba(255,160,140,.14), transparent 70%); }
.moi .m-amb.serie { background: radial-gradient(100% 26% at 50% -4%, rgba(163,230,53,.10), transparent 70%); }
.moi .m-amb.relache { background: linear-gradient(180deg, rgba(90,80,180,.10), transparent 45%); }
.moi .m-amb.volhaut { background: linear-gradient(90deg, rgba(150,170,210,.10), transparent 40%, rgba(150,170,210,.08)); } .moi .m-amb.volbas { background: radial-gradient(100% 26% at 50% -4%, rgba(163,230,53,.08), transparent 70%); }
.moi .m-amb.record i, .moi .m-amb.pirebaisse i { background: var(--c); box-shadow: 0 0 6px 1px var(--c); animation: mAmbJoie var(--d) ease-in-out var(--r) infinite; }
.moi .m-amb.plat { background: linear-gradient(0deg, rgba(90,170,200,.10), transparent 35%); }   /* lot 62 c : Calme plat = une simple teinte, rien ne bouge */
.moi .m-amb.crypto { background: radial-gradient(100% 30% at 50% -4%, rgba(247,147,26,.10), transparent 70%); }
@media (prefers-reduced-motion: reduce) { .moi .m-amb { display: none; } }
/* « Le jour J » : un palier rond de patrimoine financier sans objet fait passer un reflet d'or sur le total (une fois) */
.moi .m-hero .m-flaps.m-jourj { position: relative; }
.moi .m-hero .m-flaps.m-jourj::after { content: ""; position: absolute; inset: -4px -8px; pointer-events: none; background: linear-gradient(105deg, transparent 35%, rgba(255,226,140,.75) 50%, transparent 65%); background-size: 250% 100%; mix-blend-mode: screen; border-radius: 10px; animation: mJourJ 1.6s ease-in-out 2 both; }
@keyframes mJourJ { from { background-position: 120% 0; } to { background-position: -30% 0; } }
@media (prefers-reduced-motion: reduce) { .moi .m-hero .m-flaps.m-jourj::after { animation: none; display: none; } }
/* réglage du Vestiaire */
.moi .vs-amb { display: grid; gap: 8px; margin-top: 10px; }
.moi .vs-amb-g { display: flex; align-items: center; gap: 10px; padding: 4px 2px 8px; border-bottom: 1px solid var(--rule); }
.moi .vs-amb-g > span:first-child { flex: 1 1 auto; min-width: 0; } .moi .vs-amb-g .chips, .moi .vs-amb-l .chips { flex: none; } .moi .vs-amb-g b { display: block; font-size: 14px; } .moi .vs-amb-g small { display: block; font-size: 11.5px; color: var(--ink-3); line-height: 1.3; }
.moi .vs-amb-t { font: italic 800 14px/1.1 var(--f-display); letter-spacing: .05em; text-transform: uppercase; }
.moi .vs-amb > small { font-size: 12px; color: var(--ink-3); margin-top: -4px; }
.moi .vs-amb-l { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 12px; border: 1px solid var(--rule); background: var(--panel); }
.moi .vs-amb-l .vs-em { font-size: 22px; text-align: center; }
.moi .vs-amb-l b { display: block; font-size: 14px; } .moi .vs-amb-l small { display: block; font-size: 11.5px; color: var(--ink-3); line-height: 1.3; margin-top: 2px; }
.moi .vs-amb-l.grise { opacity: .55; filter: grayscale(1); }
.moi .vs-amb-x { font-size: 14px; opacity: .7; }
@media (prefers-reduced-motion: reduce) { .moi .m-flap.go, .moi .m-flap.af-prisme, .moi .m-flap.af-lingot::after, .moi .m-flap.af-paillettes::after, .fx-pulsar, .moi .vs-cb.fx-pulsar path.x, #v-moi.th.th-vivant .m-hero { animation: none; } }
`;
  document.head.appendChild(st);
}

/* ---------- Connexion à ton fichier ---------- */
/* Simulation (l'admin regarde l'appli à une autre date ou comme un joueur) : rien ne part vers les fichiers */
function simulationM() { return !!window.DATE_SIM || (typeof vueJoueur === "function" && vueJoueur()); }
const MSG_SIM = "👁️ Simulation : rien n'est envoyé. Repasse en admin, aujourd'hui (Réglages ou barre du Podium) pour agir pour de vrai.";
function adresse() { return (stock.get(K.api) || "").trim(); }
function cle() { return stock.get(K.cle) || ""; }
function configure() { return !!(adresse() && cle()); }
function lireCache() { if (M) { assurerSimple(); return; } const c = stock.get(K.cache); if (c) { try { recevoir(JSON.parse(c)); SRC = "cache"; } catch (e) { stock.del(K.cache); } } }

let rechargerApres = false;   // un rechargement demandé pendant une lecture en cours (ex. juste après un ordre) n'est plus perdu
/* v16.65 · une clé refusée n'est plus effacée en silence (avant : l'appli retombait sur « Connecter mon fichier » sans dire pourquoi) ;
   on la garde, on le dit, et on ne réessaie plus tout seul (pour ne pas faire bloquer le fichier) tant qu'on n'a pas touché « Réessayer » */
function cleRefusee(msg) { stock.set(K.refus, "1"); erreur = "Ton fichier a refusé la clé enregistrée sur ce téléphone" + (msg && !/^Clé incorrecte\.?$/.test(msg) ? " (" + msg + ")" : "") + "."; }
/* v16.83 · changement d'adresse ou de clé pendant une lecture : connecter() augmente la génération et coupe la lecture en cours ;
   une réponse d'une génération (ou d'une adresse) périmée est jetée, puis on relit le bon fichier */
let generation = 0, ctrlLecture = null;
/** v20.34 (Théo, 24/11) · le Versus peut donner à un joueur la NOUVELLE adresse de son fichier Moi (ex. Kévin passe au profil complet) :
 *  l'appli s'y range toute seule, avec la même clé ; l'ancienne copie locale est oubliée. Jamais en simulation, jamais pour un autre joueur. */
function adopterNouvelleAdresse() {
  try {
    const Dv = dVersus(), na = Dv && Dv.moiAdresse;
    if (!na || !configure() || (typeof simulationM === "function" && simulationM())) return false;
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(na) || adresse() === na) return false;
    suivreAdresseVerifsPru(adresse(), na);
    stock.set(K.api, na); stock.del(K.cache); stock.del(K.cacheLe); stock.del(K.refus); RAW = null; M = null; generation++;
    return true;
  } catch (e) { return false; }
}
async function charger(frais) {
  if (adopterNouvelleAdresse()) frais = true;
  if (!configure() || (stock.get(K.refus) && !frais)) return;
  if (enCours) { if (frais) rechargerApres = true; return; }
  enCours = true; erreur = "";
  const gen = generation, url = adresse(), k = cle();
  const ctrl = window.AbortController ? new AbortController() : null; ctrlLecture = ctrl;
  const minuteur = setTimeout(() => { if (ctrl) ctrl.abort(); }, 25000);
  const perime = () => gen !== generation || url !== adresse() || k !== cle();
  try {
    const json = await lireApi(url, k, "data", { frais: !!frais }, ctrl ? ctrl.signal : undefined);   // clé hors de l'adresse (POST)
    if (perime()) return;
    if (!json.ok) {
      if (json.erreur === "cle") { cleRefusee(json.message); return; }
      throw new Error(json.message || "Réponse inattendue de ton fichier");
    }
    recevoir(json); SRC = "api"; dernierAppel = Date.now();
    stock.set(K.cache, JSON.stringify(json)); stock.set(K.cacheLe, String(Date.now()));
    setTimeout(() => { verifierPaliers(); revendiquerMillion(); revendiquerFichier(); lierVersus(); }, 0);
  } catch (e) {
    if (perime()) return;
    erreur = (e && e.message) || String(e);
    if (M) SRC = "cache";
  } finally {
    clearTimeout(minuteur);
    if (gen !== generation) { /* connecter() a déjà libéré la place : ne rien toucher à la nouvelle lecture */ }
    else if (url !== adresse() || k !== cle()) { enCours = false; if (ctrlLecture === ctrl) ctrlLecture = null; setTimeout(() => charger(true), 0); }
    else {
      enCours = false; if (ctrlLecture === ctrl) ctrlLecture = null;
      signalerCloche();
      if (vueMoi()) rendre();
      if (rechargerApres) { rechargerApres = false; setTimeout(() => charger(true), 0); }
    }
  }
}
function vueMoi() { const s = document.getElementById("v-moi"); return s && !s.hidden; }

/* ---------- Rendu ---------- */
const ONGLETS = [["jour", "Aujourd'hui"], ["patrimoine", "Patrimoine"], ["stats", "Stats"], ["missions", "Missions"]];

/** V15.2 · Redessine sans faire sauter la page : le bouton touché reste au même endroit de l'écran */
function garderPlace(b, fn) {
  const attrs = b && b.attributes ? [...b.attributes].filter(x => x.name.startsWith("data-")) : [];
  const sel = attrs.length ? attrs.map(x => "[" + x.name + '="' + CSS.escape(x.value) + '"]').join("") : null, y0 = b && b.getBoundingClientRect ? b.getBoundingClientRect().top : null;
  const corps = document.body, h = corps.style.minHeight; corps.style.minHeight = document.documentElement.scrollHeight + "px";   // pas de remontée forcée pendant le redessin
  fn();
  const suite = () => { const nb = sel && document.querySelector("#v-moi " + sel); if (nb && y0 !== null) window.scrollBy(0, nb.getBoundingClientRect().top - y0); corps.style.minHeight = h; };
  suite(); requestAnimationFrame(suite);
}
function rendre() {
  injecterStyle();
  const v = document.getElementById("v-moi"); if (!v) return;
  v.style.setProperty("--mc", couleurMoi()); v.classList.remove("m-flot");
  { const th = M ? themeActif() : null; v.classList.toggle("th", !!(th && th[3])); v.classList.toggle("th-vivant", !!(th && th[4] === "vivant")); if (th && th[3]) v.style.setProperty("--th-fond", th[3]); else v.style.removeProperty("--th-fond"); }
  if (!configure()) { v.innerHTML = ecranConnexion(); brancherConnexion(v); return; }
  if (stock.get(K.refus)) {
    v.innerHTML = '<div class="m-vide"><div class="m-flaps" aria-hidden="true">' + flaps("MOI", false) + '</div><p>🔑 Ton fichier a refusé la clé de ce téléphone.</p><p class="info">' + "La clé enregistrée ici ne correspond plus à celle de ton fichier." + ' Elle est gardée : si c\'était un raté passager, « Réessayer » suffit ; sinon, remets ta clé dans Réglages › Mon fichier.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn acc" type="button" id="m-reessayer">Réessayer</button><button class="btn" type="button" id="m-connecter">Changer la clé</button></div></div>';
    brancherConnexion(v);
    v.querySelector("#m-reessayer").addEventListener("click", () => { stock.del(K.refus); erreur = ""; rendre(); charger(true); });
    return;
  }
  lireCache(); signalerCloche();
  bulleReleve();   // v17.88 (Théo) : plus de « point du vendredi » (la pastille 5 j suffit)
  if (!M) {
    v.innerHTML = erreur ? '<div class="m-vide"><p>Impossible de lire ton fichier.</p><p class="info">' + esc(majuscule(erreur).replace(/\.?$/, ".")) + '</p><button class="btn" type="button" id="m-reessayer">Réessayer</button></div>'
      : '<div class="m-vide"><div class="m-flaps" aria-hidden="true">' + flaps("MOI", !reduit) + "</div><p>Ouverture de ton fichier…</p><p class=\"info\">La première lecture prend quelques secondes. Ensuite, les derniers chiffres s'affichent tout de suite pendant la mise à jour.</p></div>";
    const r = v.querySelector("#m-reessayer"); if (r) r.addEventListener("click", () => { erreur = ""; rendre(); charger(true); });
    if (!erreur) charger(false);
    return;
  }
  if (Date.now() - dernierAppel > 5 * 60e3 && !enCours && !erreur) setTimeout(() => charger(false), 0);
  noterVisite();
  const o = ONGLETS.some(x => x[0] === PREF.onglet) || (PREF.onglet === "artema" && aArtema()) ? PREF.onglet : "jour";
  const bandeau = SRC === "cache" && erreur && !enCours ? '<p class="info" style="margin:6px 2px;font-size:12px;opacity:.75">📴 Ton fichier n\'a pas répondu : chiffres de la dernière ouverture' + (ageCopie() ? " (" + ageCopie() + ")" : "") + ".</p>" : "";   // v17.20 (Théo) : la mise à jour se fait en silence, en arrière-plan
  const bandeauAncien = SRC === "cache" ? '<div class="demo-band">' + (enCours ? "Mise à jour de ton fichier…" : erreur ? "Ton fichier n'a pas répondu (" + esc(String(erreur).replace(/\.$/, "")) + ") · chiffres de la dernière ouverture" + (ageCopie() ? " (" + ageCopie() + ")" : "") + "." : "Chiffres de la dernière ouverture · mise à jour…") + " <small>" + esc(M.majTexte || "") + "</small></div>" : "";
  v.innerHTML =
    '<div class="seg m-onglets" role="tablist" aria-label="Moi">' + ONGLETS.map(([k, l]) => '<button type="button" role="tab" data-m-ong="' + k + '" aria-pressed="' + (o === k) + '" aria-selected="' + (o === k) + '">' + l + "</button>").join("") + "</div>" +
    bandeau + (o === "jour" ? htmlAFaire() : "")   /* v17.2 (Théo) : plus de phrase-bilan ; les échéances passent dans la cloche */ +   /* v16.95 : calendrier unique des échéances */   // v16.87 : phrase-bilan + boîte unique « À faire » (ailleurs, la cloche suffit)
    ({ jour: M.simple ? htmlJourSimple : htmlJour, patrimoine: htmlPatrimoine, stats: htmlStats, missions: htmlMissions, artema: htmlArtema })[o]();
  v.querySelectorAll("[data-m-ong]").forEach(b => b.addEventListener("click", () => { PREF.onglet = b.dataset.mOng; garderPref(); rendre(); window.scrollTo(0, 0); }));
  brancherAFaire(v); brancherEcheances(v);
  v.querySelectorAll("details.acc[data-acc]").forEach(d => d.addEventListener("toggle", () => { PREF.acc[d.dataset.acc] = d.open; garderPref(); if (d.open && d.dataset.acc === "m-courbe") dessinerCourbe(); if (d.open && d.dataset.acc === "m-ep-temps") dessinerEpargne(); if (d.open && d.dataset.acc === "m-pret") dessinerPret(); if (d.open && d.dataset.acc === "m-ptemps") dessinerPatrimoine(); }));
  ({ artema: brancherArtema, jour: M.simple ? brancherJourSimple : brancherJour, patrimoine: brancherPatrimoine, stats: brancherStats, missions: brancherMissions })[o](v);
  v.classList.toggle("m-flot", !!v.querySelector(".m-per-flot"));   // lot 62 : place pour la barre des périodes flottante (rien n'est caché dessous)
  if (o === "jour" && !M.simple) { try { habillerFolle(v); } catch (e) { /* jamais bloquant */ } setTimeout(() => { try { verifierEvenement(); } catch (e) { /* idem */ } }, 650); }   // lot 62 : journées folles et événements rares
  v.querySelectorAll(".m-filtre").forEach(r => {   // lot 50 : la pastille choisie reste visible dans une rangée qui défile
    const b = r.querySelector('[aria-pressed="true"]'); if (!b) return; const rr = r.getBoundingClientRect(), br = b.getBoundingClientRect();
    if (br.right > rr.right) r.scrollLeft += br.right - rr.right + 8; });
  if (SRC === "api") verifierPaliers();
  verifierCloture();
}

function acc(id, titre, sous, contenu, defaut) {
  const ouvert = PREF.acc[id] === undefined ? !!defaut : PREF.acc[id];
  return '<details class="acc" data-acc="' + id + '"' + (ouvert ? " open" : "") + '><summary><span class="t">' + titre + (sous ? " <small>" + sous + "</small>" : "") + "</span></summary><div>" + contenu + "</div></details>";
}

function ecranConnexion() {
  return '<div class="m-vide"><div class="m-flaps" aria-hidden="true">' + flaps("MOI", false) + "</div>" +
    "<p>Ton espace privé : tes enveloppes, tes lignes, ton épargne, ton immobilier et tes stats détaillées, lus directement depuis ton fichier « Portefeuille &amp; Épargne ».</p>" +
    '<p class="info">Connecte-le une fois dans Réglages › Mon fichier : l\'adresse et la clé restent sur cet appareil et ne passent jamais par le fichier Versus partagé. Les autres ne voient que ta bourse dans le classement.</p>' +
    '<button class="btn acc" type="button" id="m-connecter">Connecter mon fichier</button></div>';
}
function brancherConnexion(v) {
  const b = v.querySelector("#m-connecter");
  if (b) b.addEventListener("click", () => { if (typeof ouvrirReglages === "function") ouvrirReglages("regl-moi"); });
}

/* Afficheurs : palettes (repris de Cote) et autres types (tambours, segments, matrice, ticket, billet, carte) */
const estSepAff = ch => ch === NB || ch === " " || ch === "\u202F" || ch === "\u00A0";
const MATRICE = {
  "0": "01110100011001110101110011000101110", "1": "00100011000010000100001000010001110", "2": "01110100010000100010001000100011111",
  "3": "11111000100010000010000011000101110", "4": "00010001100101010010111110001000010", "5": "11111100001111000001000011000101110",
  "6": "00110010001000011110100011000101110", "7": "11111000010001000100010000100001000", "8": "01110100011000101110100011000101110",
  "9": "01110100011000101111000010001001100", "A": "01110100011000111111100011000110001", "B": "11110100011000111110100011000111110",
  "C": "01110100011000010000100001000101110", "D": "11100100101000110001100011001011100", "E": "11111100001000011110100001000011111",
  "F": "11111100001000011110100001000010000", "G": "01110100011000010111100011000101111", "H": "10001100011000111111100011000110001",
  "I": "01110001000010000100001000010001110", "J": "00111000100001000010000101001001100", "K": "10001100101010011000101001001010001",
  "L": "10000100001000010000100001000011111", "M": "10001110111010110101100011000110001", "N": "10001100011100110101100111000110001",
  "O": "01110100011000110001100011000101110", "P": "11110100011000111110100001000010000", "Q": "01110100011000110001101011001001101",
  "R": "11110100011000111110101001001010001", "S": "01111100001000001110000010000111110", "T": "11111001000010000100001000010000100",
  "U": "10001100011000110001100011000101110", "V": "10001100011000110001100010101000100", "W": "10001100011000110101101011010101010",
  "X": "10001100010101000100010101000110001", "Y": "10001100010101000100001000010000100", "Z": "11111000010001000100010001000011111",
  "€": "00111010001111001000111100100000111", "+": "00000001000010011111001000010000000", "-": "00000000000000011111000000000000000",
  "•": "00000000000111001110011100000000000", "%": "11000110010001000100010001001100011", ">": "01000001000001000001000100010001000",
  ":": "00000011000110000000011000110000000", ",": "00000000000000000000011000010001000", ".": "00000000000000000000000000110001100"
};
const SEGMENTS = { "0": "abcdef", "1": "bc", "2": "abged", "3": "abgcd", "4": "fgbc", "5": "afgcd", "6": "afgedc", "7": "abc", "8": "abcdefg", "9": "abcdfg",
  "-": "g", "•": "g", "A": "abcefg", "B": "cdefg", "C": "adef", "D": "bcdeg", "E": "adefg", "F": "aefg", "G": "acdef", "H": "bcefg", "I": "bc", "J": "bcde",
  "L": "def", "N": "ceg", "O": "abcdef", "P": "abefg", "R": "eg", "S": "acdfg", "T": "defg", "U": "bcdef", "Y": "bcdfg" };
const SEG_R = { a: [7, 2, 26, 5], b: [33, 7, 5, 26], c: [33, 37, 5, 26], d: [7, 63, 26, 5], e: [2, 37, 5, 26], f: [2, 7, 5, 26], g: [7, 32.5, 26, 5] };
const majAff = ch => ch === MOINS ? "-" : ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
function rendreAff(type, style, texte, animer) {
  const ch = Array.from(texte), go = animer ? " go" : "", aDesChiffres = /\d/.test(texte);
  if (type === "tambour") return '<span class="m-af t-tambour" aria-hidden="true">' + ch.map((c, i) => {
    if (estSepAff(c)) return '<i class="od-sep"></i>';
    if (/\d/.test(c)) return '<span class="od"><span class="od-r' + go + '" style="--d:' + (10 + +c) + (animer ? ";animation-delay:" + i * 90 + "ms" : "") + '">' + "01234567890123456789".split("").map(x => "<b>" + x + "</b>").join("") + "</span></span>";
    return '<span class="od' + (c === "€" ? " u" : "") + '"><b>' + esc(c) + "</b></span>";
  }).join("") + "</span>";
  if (type === "seg") return '<span class="m-af t-seg ' + style + go + '" aria-hidden="true">' + ch.map((c, i) => {
    const dl = animer ? ' style="animation-delay:' + i * 70 + 'ms"' : "";
    if (estSepAff(c)) return '<i class="sg-sep"></i>';
    const on = SEGMENTS[majAff(c)];
    if (!on) return '<span class="sg-x"' + dl + ">" + esc(c) + "</span>";
    return '<svg viewBox="0 0 44 70"' + dl + '><g transform="translate(5 0) skewX(-6)">' + Object.keys(SEG_R).map(k => { const r = SEG_R[k]; return '<rect x="' + r[0] + '" y="' + r[1] + '" width="' + r[2] + '" height="' + r[3] + '" rx="2.5"' + (on.includes(k) ? ' class="l"' : "") + "/>"; }).join("") + "</g></svg>";
  }).join("") + "</span>";
  if (type === "matrice") return '<span class="m-af t-mat' + go + '" aria-hidden="true">' + ch.map((c, i) => {
    if (estSepAff(c)) return '<i class="mt-sep"></i>';
    const m = MATRICE[majAff(c)] || "0".repeat(35);
    let ronds = ""; for (let k = 0; k < 35; k++) ronds += '<circle cx="' + (k % 5 + .5) + '" cy="' + (Math.floor(k / 5) + .5) + (m[k] === "1" ? '" r=".44" class="l"/>' : '" r=".32"/>');
    return '<svg viewBox="0 0 5 7"' + (animer ? ' style="animation-delay:' + i * 80 + 'ms"' : "") + ">" + ronds + "</svg>";
  }).join("") + "</span>";
  if (type === "ticket") return '<span class="m-af t-ticket' + go + '" aria-hidden="true"><span class="tk-h"><span>' + (aDesChiffres ? "TOTAL" : "VERSUS") + "</span><span>" + (aDesChiffres ? "EUR" : "MOI") + '</span></span><span class="tk-v">' +
    ch.map((c, i) => "<i" + (estSepAff(c) ? ' class="tk-s"' : "") + (animer ? ' style="animation-delay:' + (150 + i * 75) + 'ms"' : "") + ">" + (estSepAff(c) ? "" : esc(c)) + "</i>").join("") + "</span></span>";
  if (type === "billet") return '<span class="m-af t-billet' + go + '" aria-hidden="true"><span class="bl-c">VERSUS</span><span class="bl-v">' + esc(texte.replace(/\s*€$/, "")) + "</span></span>";
  if (type === "carte") return '<span class="m-af t-carte" aria-hidden="true"><span class="ca-puce"></span><span class="ca-v">' + esc(texte) + "</span></span>";
  return "";
}
function flaps(texte, animer, style) {
  let i = 0;
  const st = style || afficheurActif(), def = AFFICHEURS.find(a => a[0] === st), type = def && def[2] ? def[2] : "palette";
  if (type !== "palette") return rendreAff(type, st, texte, animer);
  const af = " af-" + st;
  return Array.from(texte).map(ch => {
    if (estSepAff(ch)) return '<span class="m-flap sep" aria-hidden="true"></span>';
    const cls = (ch === "€" ? "m-flap u" : (ch === MOINS || ch === "+") ? "m-flap s" : "m-flap") + af;
    const delai = animer ? ' style="animation-delay:' + (i++ * 55) + 'ms"' : "";
    return '<span class="' + cls + (animer ? " go" : "") + '"' + delai + ' aria-hidden="true">' + esc(ch) + "</span>";
  }).join("");
}
function marches(txt) {
  if (!txt) return "";
  return txt.split("·").map(p => p.trim()).filter(Boolean).map(p => {
    const on = p.includes("🟢") || /continu/.test(p);
    return '<i class="' + (on ? "on" : "") + '">' + esc(p.replace(/[🟢⚪🌙]/gu, "").replace(/\s+/g, " ").trim()) + "</i>";
  }).join("");
}
function note(txt, type) {
  if (!txt) return "";
  const propre = txt.replace(/^[✓⚠🔔✏️\s]+/u, "").trim();
  return '<div class="m-note ' + type + '"><span class="ic">' + (type === "ok" ? "✓" : type === "warn" ? "!" : "◷") + "</span><span>" + esc(propre).replace(/ +▸ /g, "<br>▸ ") + "</span></div>";
}
function tuile(lab, val, cls, sub, def) {
  return '<div' + (def ? ' class="m-def-t" role="button" tabindex="0" aria-expanded="false"' : "") + '><span class="lab">' + lab + (def ? '<i class="qm" aria-hidden="true">?</i>' : "") + '</span><span class="val ' + (cls || "") + '">' + val + '</span><span class="sub">' + (sub || "&nbsp;") + "</span>" + (def ? '<span class="m-def">' + esc(def) + "</span>" : "") + "</div>";
}
function brancherDefs(v) {
  v.querySelectorAll(".m-def-t").forEach(t => {
    const f = () => { t.classList.toggle("ouvert"); t.setAttribute("aria-expanded", t.classList.contains("ouvert")); };
    t.addEventListener("click", f); t.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f(); } });
  });
}

/* ================= Onglet Aujourd'hui : la bourse du jour, toutes les lignes visibles d'emblée ================= */
function patrimoineNet() {
  const imm = M.immo || [], s = M.synthese || {};
  const l = imm.find(x => /^Patrimoine net/.test(x.nom));
  return l ? { avecImmo: true, montant: l.montant, note: l.note } : { avecImmo: false, montant: s.financier, note: "" };
}
/* v20.38 (Théo, 24/11) : fichier avec un historique mais aucune ligne de bourse encore saisie (nouveau joueur ; Kévin avant sa photo de départ) */
function enAttenteLignes() {
  if (!M || M.simple || !(M.historique && M.historique.rows && M.historique.rows.length)) return false;
  return !lignesTenues().length && !((M.synthese || {}).valeur > 0);
}
/* Anomalies du fichier à montrer. En attente de lignes, « Relevé automatique en retard » est masqué : les photos quotidiennes ne sont pas
   encore lancées exprès. Il revient tout seul dès que des lignes existent. Les autres anomalies restent toujours visibles. */
function anomaliesVues() {
  const a = M && M.anomalies; if (!a || /^\s*✓/.test(a)) return "";
  if (!enAttenteLignes()) return a;
  const parts = a.replace(/^[⚠\s]+/u, "").split(/\s+▸\s+/).filter(p => !/^Relevé automatique en retard/.test(p.trim()));
  return parts.length ? "⚠ " + parts.join("     ▸ ") : "";
}
function lignesTenues() {
  const out = [];
  (M.groupes || []).forEach(g => g.lignes.forEach(l => { if (!l.especes) out.push(Object.assign({ env: g.env }, l)); }));
  return out;
}
/* V15.11 · « Dernière séance » : quand la bourse est fermée (nuit, week-end), on peut afficher les variations de la dernière séance,
   lues dans Perf lignes (Google Finance), puis revenir à « aujourd'hui ». Rien n'est écrit : c'est une vue. */
function seanceDu() { const p = M && M.perfLignes; if (!p) return null; const ds = Object.values(p).map(x => x && x.seanceDu).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d || "")).sort(); return ds.length ? ds[ds.length - 1] : null; }
/* proposée quand la dernière séance n'est pas aujourd'hui ET qu'aucune ligne cotée ne bouge aujourd'hui (une nouvelle séance a commencé → le bouton s'en va) */
function seanceProposee() {
  if (M && M.__seance) return true;   // pendant l'affichage de la séance (copie de M), elle reste proposée
  const d = seanceDu(); if (!d || d >= isoJour(new Date())) return false;
  const perf = M.perfLignes || {};
  return !(M.groupes || []).some(g => g.lignes.some(l => { const p = perf[g.env + "|" + l.code]; return p && typeof p.seance === "number" && Math.abs(l.pct || 0) > 1e-9; }));
}
/* Théo, 19/11 : plus de bandeau « Voir la semaine ». « Jour » montre tout seul la dernière séance quand la bourse n'a pas encore bougé
   aujourd'hui (nuit, week-end : fini le « ■ 0 € · 0,00 % »), et la pastille « Jour | 5 j » de la carte passe aux 5 dernières séances
   (semaine glissante : « 1 semaine » de Perf lignes). Le choix est gardé sur l'appareil (PREF.var5). Rien n'est écrit : c'est une vue. */
function modeSeance() { return seanceProposee(); }
const PERIODES_J = { "5j": ["s1", "5 j", "5 séances"], "1m": ["m1", "1 M", "1 mois"], "6m": ["m6", "6 M", "6 mois"], "ytd": ["ytd", "YTD", "depuis janvier"], "1a": ["a1", "1 an", "1 an"], "tout": ["tout", "Tout", "depuis le début"] };   // lot 63 (Théo) : + « Tout » = depuis la 1re ligne de l'historique   // v17.23 (Conseil) : Jour | 5 j | 1 M | 6 M | Janv. | 1 an
function periodeJ() { const p = PREF.varP || (PREF.var5 === true ? "5j" : null); return p && PERIODES_J[p] && seanceDu() ? p : null; }
function mode5j() { return periodeJ() === "5j"; }
const JOURS_C = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
/** lot 50 (Théo) : bourse de Paris fermée ? (avant 9 h, après 17 h 30, week-end, ou jour sans séance = férié : la dernière séance n'est pas
    aujourd'hui et aucune ligne ne bouge, cf. seanceProposee). → { ferme, lib : « jeu. 19/11 » = la séance dont viennent les chiffres } */
function bourseFermee() {
  const n = new Date(), mn = n.getHours() * 60 + n.getMinutes(), we = n.getDay() % 6 === 0, sansSeance = seanceProposee();
  const ferme = we || mn < 9 * 60 || mn >= 17 * 60 + 30 || sansSeance;
  const d = sansSeance ? seanceDu() : !we && mn >= 9 * 60 ? isoJour(n) : seanceDu();
  return { ferme, lib: d ? JOURS_C[new Date(d + "T12:00:00").getDay()] + " " + frDate(d).slice(0, 5) : "" };
}
function badgeFerme(bf) { return '<span class="m-ferme" title="Les chiffres sont ceux de la dernière séance">🔒 Bourse fermée' + (bf.lib ? " · séance du " + esc(bf.lib) : "") + "</span>"; }
function libSeance() { const d = seanceDu(); if (!d) return ""; const x = new Date(d + "T12:00:00"); return JOURS_C[x.getDay()] + " " + frDate(d).slice(0, 5); }
/** les 5 dernières séances (jours ouvrés, fériés non retirés) : la dernière = aujourd'hui si la bourse bouge, sinon la dernière séance connue */
function seances5() {
  const fin = new Date((seanceProposee() ? seanceDu() : isoJour(new Date())) + "T12:00:00"), out = [];
  for (const d = new Date(fin); out.length < 5; d.setDate(d.getDate() - 1)) if (d.getDay() % 6) out.unshift(isoJour(d));
  return out;
}
function lib5j() { const s = seances5(); return "sur 5 séances · du " + frDate(s[0]).slice(0, 5) + " au " + frDate(s[4]).slice(0, 5); }
/** fin de la période = la dernière séance (ou aujourd'hui quand la bourse bouge) ; début = mêmes bornes que Stats (`fenetre`) */
function finPer() { return new Date((seanceProposee() ? seanceDu() : isoJour(new Date())) + "T12:00:00"); }
function debutPer(p, fin) {
  if (p === "tout") { const r = M && M.historique && M.historique.rows; return r && r.length ? dateNum(r[0][0]) : new Date(2000, 0, 1, 12); }   // lot 63 : le début du portefeuille
  if (p === "5j") { const d = new Date(seances5()[0] + "T12:00:00"); d.setDate(d.getDate() - 1); return d; }   // la veille de la 1re des 5 séances
  if (p === "ytd") return new Date(fin.getFullYear() - 1, 11, 31, 12);
  const m = new Date(fin.getFullYear(), fin.getMonth() - ({ "1m": 1, "6m": 6, "1a": 12 }[p] || 1), 1);   // le 31/05 − 3 mois = le 28/02 (comme Stats)
  return new Date(m.getFullYear(), m.getMonth(), Math.min(fin.getDate(), new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate()), 12);
}
function libPer(p) { if (p === "5j") return lib5j(); const fin = finPer(), d = debutPer(p, fin), court = x => frDate(isoJour(x)).slice(0, 5);
  if (p === "tout") return "depuis le début · du " + frDate(isoJour(d)) + " au " + court(fin) + " · lignes : depuis l'achat";
  if (p === "ytd") return "depuis le 1er janvier · au " + court(fin);
  const c = p === "1a" ? x => frDate(isoJour(x)) : court; return "sur " + PERIODES_J[p][2] + " · du " + c(d) + " au " + c(fin); }
/** v17.23 : le total d'une période vient de l'HISTORIQUE du fichier, versements neutralisés (comme le TWR de Stats) :
    % = ip(fin) / ip(début) − 1 ; € = écart de valeur − écart d'apports. Début = dernière séance ≤ la date de début.
    En séance, la variation en direct s'ajoute à la dernière ligne de l'historique. null = historique trop court ou en retard. */
function totalHisto(p) {
  const h = M.historique, cols = h && h.cols || [], rows = h && h.rows || [], ki = cols.indexOf("ip"), kv = cols.indexOf("v"), ka = cols.indexOf("a"), s = M.synthese || {};
  if (ki < 0 || kv < 0 || !rows.length) return null;
  const num = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(), fin = finPer(), d0 = debutPer(p, fin), cF = num(fin), c0 = num(d0);
  let i0 = -1, i1 = -1; rows.forEach((r, i) => { if (r[0] <= c0) i0 = i; if (r[0] <= cF) i1 = i; });
  if (i0 < 0 || i1 <= i0) return null;
  const a = rows[i0], b = rows[i1];
  if ((num(d0) !== a[0] && (dateNum(c0) - dateNum(a[0])) / 864e5 > 6) || !(a[ki] > 0 && b[ki] > 0) || !ok(a[kv]) || !ok(b[kv])) return null;   // trou dans l'historique
  let pc = b[ki] / a[ki] - 1, e = (b[kv] - a[kv]) - (ka >= 0 && ok(a[ka]) && ok(b[ka]) ? b[ka] - a[ka] : 0);
  /* v20.10 (Théo) : la dernière séance = le chiffre de la carte « Jour » (cours de clôture de chaque ligne), pas l'instantané de 18 h de l'historique */
  { const sc = seanceCarteSure(), z = i1 - 1;
    if (sc && b[0] === cF && sc.d === isoN(b[0]) && z >= i0 && rows[z][ki] > 0 && ok(rows[z][kv])) {
      pc = (rows[z][ki] / a[ki]) * (1 + sc.p) - 1;
      e = (rows[z][kv] - a[kv]) - (ka >= 0 && ok(a[ka]) && ok(rows[z][ka]) ? rows[z][ka] - a[ka] : 0) + sc.e; } }
  if (b[0] < cF) { if (seanceProposee() || !ok(s.jour)) return null;   // la dernière séance manque encore à l'historique
    pc = (1 + pc) * (1 + (s.jourPct || 0)) - 1; e += s.jour; }
  return { e, p: pc };
}
/** v17.85 (Théo) : lignes dont Google Finance n'a pas l'historique (EPA:GOLD) → variation de la période d'après les clôtures du marché équivalent (Marchés du Versus) */
const PROXY_LIGNE = { GOLD: "Or" };   // Amundi Physical Gold (€, non couvert) ≈ « Or non couvert »
function proxyPer(code, per) {
  try { const nom = PROXY_LIGNE[code], m = nom && marchesMoi(); if (!m) return null;
    const x = (m.jour || []).find(y => y.nom === nom); if (!x) return null;
    const r = varMk(x, per); return typeof r.v === "number" && isFinite(r.v) ? r.v : null; } catch (e) { return null; }
}
function mSeance(m, cinq) {
  const perf = m.perfLignes || {}, c = JSON.parse(JSON.stringify(m)), dSeance = seanceDu(); c.__seance = true; let tot = 0;
  (c.groupes || []).forEach(g => {
    let j = 0;
    g.lignes.forEach(l => { if (l.especes) return; const p = perf[g.env + "|" + l.code];
      const v = p ? (cinq ? p[PERIODES_J[cinq][0]] : (p.seanceDu && dSeance && p.seanceDu < dSeance ? null : p.seance)) : null;   // 5 j : « 1 semaine » de Perf lignes ; v18.4 : jamais la variation d'une séance plus ancienne présentée comme la dernière
      let w = cinq === "tout" ? (ok(l.pvPct) ? l.pvPct : null) : v;   // lot 63 : « Tout » = chaque ligne depuis son achat (sa plus-value en %)
      if (typeof w !== "number" && cinq) w = proxyPer(l.code, cinq);   // v17.85 (Théo) : GOLD sans historique Google → l'historique de la case « Or non couvert »
      if (typeof w === "number") { l.pct = w; l.jour = (l.valeur || 0) * w / (1 + w); } else if (cinq || (p && p.seanceDu && dSeance && p.seanceDu < dSeance)) { l.pct = null; l.jour = 0; }
      j += l.jour || 0; });
    if (g.total) { g.total.jour = j; const base = (g.total.valeur || 0) - j; g.total.pct = base ? j / base : 0; }
    tot += j;
  });
  const sy = c.synthese = Object.assign({}, c.synthese), base = (sy.valeur || 0) - tot, th = cinq ? totalHisto(cinq) : null;
  sy.jour = tot; sy.jourPct = base ? tot / base : 0; sy.jourLibelle = cinq ? libPer(cinq) : "";
  if (th) { sy.jour = th.e; sy.jourPct = th.p; } if (cinq) sy.jourNote = th ? "versements exclus" : "estimation d'après les cours";   // v17.23 : total = historique (sinon somme des lignes)   // séance : la date est déjà dans le titre de la carte
  return c;
}
/** 5 j : le détail jour par jour, lu dans ton historique (sans l'effet des versements) ; aujourd'hui en séance = la variation en direct */
let CINQ = null, cinqOuvert = false, VUEJ = "jour";   // VUEJ : "jour" | "seance" | "5j", fixé par htmlJour avant de prendre la copie
function joursCinq() {
  const h = M.historique, cols = h && h.cols || [], rows = h && h.rows || [], ki = cols.indexOf("ip"), kv = cols.indexOf("v"), ka = cols.indexOf("a"), s = M.synthese || {};
  const auj = isoJour(new Date()), live = !seanceProposee();
  const sc = seanceCarteSure();   // v20.10 (Théo) : la séance que montre la carte « Jour » garde EXACTEMENT son chiffre dans le détail 5 j
  const out = seances5().map(iso => {
    const x = { iso }, n = +iso.replace(/-/g, "");
    if (iso === auj && live && ok(s.jour)) { x.p = s.jourPct; x.e = s.jour; return x; }
    if (sc && sc.d === iso) { x.p = sc.p; x.e = sc.e; return x; }
    const i = rows.findIndex(r => r[0] === n), a = rows[i - 1], b = rows[i];
    if (i > 0 && ki >= 0 && a[ki] > 0 && b[ki] > 0 && (dateNum(b[0]) - dateNum(a[0])) / 864e5 < 4.5) { x.p = b[ki] / a[ki] - 1; x.e = kv >= 0 ? (b[kv] - a[kv]) - (ka >= 0 ? b[ka] - a[ka] : 0) : null; }
    return x;
  });
  return out.some(x => ok(x.p)) ? out : null;
}
function htmlCinq() {
  if (!CINQ || !cinqOuvert) return "";
  const maxP = Math.max(.002, ...CINQ.filter(x => ok(x.p)).map(x => Math.abs(x.p)));
  return '<div class="m-5j">' + CINQ.map(x => { const d = new Date(x.iso + "T12:00:00");
    return '<div class="l"><span class="j">' + JOURS_C[d.getDay()] + " " + frDate(x.iso).slice(0, 5) + "</span>" +
      (ok(x.p) ? '<span class="bar"><i class="' + sens(x.p) + '" style="width:' + Math.max(3, Math.round(Math.abs(x.p) / maxP * 100)) + '%"></i></span><b class="' + sens(x.p) + '">' + pct(x.p, 2) + '</b><small class="' + sens(x.e) + '">' + (ok(x.e) ? eur(x.e, 0, true) : "") + "</small>"
        : '<span class="bar"></span><b class="flat">—</b><small></small>') + "</div>"; }).join("") +
    '<p>Jour par jour d\'après ton historique, sans l\'effet de tes versements. Le total au-dessus suit le cours de chaque ligne.</p></div>';
}
/* ==================== lot 62 · « Journées folles » (Théo, Conseil) ====================
   Une séance où ton portefeuille fait −3 % ou pire (+3 % ou mieux) : un grand effet plein écran de quelques secondes (incendie / feu d'artifice),
   la 1re fois que tu ouvres Moi › Aujourd'hui dans les 7 jours qui suivent (rattrapage : la date est affichée), puis une ambiance discrète
   sur Aujourd'hui jusqu'à la fin de ces 7 jours (à couper ou remettre dans Missions › Vestiaire ; ensuite grisée jusqu'à la prochaine journée du même genre).
   Palier fort : −5 % / +5 %.
   Source : l'historique de ton fichier (variation de l'indice « ip », versements neutralisés) ; la séance en cours (ou la dernière séance)
   tant que l'historique ne l'a pas encore. Une fois par séance, par palier et par appareil. Jamais dans le Versus, jamais pour le profil simple. */
const FOLLE_SEUIL = .028, FOLLE_MID = .035, FOLLE_FORT = .05, FOLLE_JOURS = 3;   // v20.3 (Théo) : 3 jours au lieu d'une semaine ;   // lot 62 c (Théo) : 3 paliers par sens : 2,8 % · 3,5 % · 5 %   // Théo : une fenêtre d'environ une semaine (rattrapage compris)
const JOURS_L = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
function isoN(n) { const s = String(n); return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8); }
/** séances de l'historique : { d, p (variation, versements neutralisés), e (€ gagnés ou perdus hors versements), ip0 (niveau d'avant), i } */
function seancesHisto() {
  const h = M && M.historique, cols = h && h.cols || [], rows = h && h.rows || [], ki = cols.indexOf("ip"), kv = cols.indexOf("v"), ka = cols.indexOf("a"), out = [];
  if (ki < 0) return out;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    if (!(a[ki] > 0 && b[ki] > 0) || (dateNum(b[0]) - dateNum(a[0])) / 864e5 > 4.5) continue;
    const p = b[ki] / a[ki] - 1; if (Math.abs(p) < 1e-9) continue;   // jour sans séance (week-end recopié)
    out.push({ d: isoN(b[0]), p, e: kv >= 0 && ok(a[kv]) && ok(b[kv]) ? (b[kv] - a[kv]) - (ka >= 0 && ok(a[ka]) && ok(b[ka]) ? b[ka] - a[ka] : 0) : null, ip0: a[ki], i });
  }
  return out;
}
/** v20.10 : seanceCarte() sans jamais lever d'erreur ni lire une copie de séance */
function seanceCarteSure() { try { return M && !M.__seance ? seanceCarte() : null; } catch (e) { return null; } }
/** la séance du jour (en direct) ou la dernière séance, telle que la carte « Jour » la montre */
function seanceCarte() {
  if (!M || M.__seance) return null;
  const s = M.synthese || {};
  if (!seanceProposee()) {   // week-end ou avant 9 h, les cours affichés sont encore ceux de la dernière séance
    const n = new Date(), auj = isoJour(n), d = n.getDay() % 6 === 0 || n.getHours() < 9 ? seanceDu() || auj : auj;
    return ok(s.jourPct) && Math.abs(s.jourPct) > 1e-9 ? { d, p: s.jourPct, e: s.jour, direct: d === auj } : null; }
  const d = seanceDu(); if (!d) return null;
  const sy = mSeance(M, null).synthese; return ok(sy.jourPct) && Math.abs(sy.jourPct) > 1e-9 ? { d, p: sy.jourPct, e: sy.jour } : null;
}
/** la journée folle en cours (la plus récente des 4 derniers jours), ou null */
function journeeFolle() {
  if (!M || M.simple) return null;
  /* lot 62 d (Théo, 21/11) : seulement la DERNIÈRE séance, avec le chiffre exact de la carte du haut (on ne relit jamais l'historique pour faire naître
     un événement passé). Seule exception voulue : la séance du vendredi 20/11/2026, pour qu'elle s'affiche encore les jours suivants. */
  const c = []; try { const x = seanceCarte(); if (x) c.push(x); } catch (e) { /* données absentes */ }
  if (!c.some(y => y.d === EV_EXCEPTION) && isoJour(new Date()) <= finEv({ k: "feu", d: EV_EXCEPTION })) try { const y = seancesHisto().find(z => z.d === EV_EXCEPTION); if (y) c.push(y); } catch (e) { /* idem */ }
  const x = c.find(y => Math.abs(y.p) >= FOLLE_SEUIL - 1e-9);
  const niv = x ? (Math.abs(x.p) >= FOLLE_FORT - 1e-9 ? 3 : Math.abs(x.p) >= FOLLE_MID - 1e-9 ? 2 : 1) : 0;
  return x ? Object.assign({}, x, { sens: x.p > 0 ? 1 : -1, niv, fort: niv === 3 }) : null;
}
function cleFolle(x) { return x.d + (x.sens > 0 ? "+" : "-") + (x.niv || (x.fort ? 3 : 1)); }   // lot 62 c : palier 1 · 2 · 3
function libJourFolle(d) { if (d === isoJour(new Date())) return "Aujourd'hui"; const x = new Date(d + "T12:00:00"); return majuscule(JOURS_L[x.getDay()]) + " " + frDate(d).slice(0, 5); }
/** sprite rond et flou (dessiné une fois) */
function spriteFolle(r, stops) {
  const c = document.createElement("canvas"); c.width = c.height = r * 2; const g = c.getContext("2d"), gr = g.createRadialGradient(r, r, 0, r, r, r);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c;
}
let SPR_FOLLE = null;
function spritesFolle() {
  if (SPR_FOLLE) return SPR_FOLLE;
  const sp = col => spriteFolle(16, [[0, "#FFFFFF"], [.18, col], [.5, col.replace(/^#(..)(..)(..)$/, (m, a, b, c) => "rgba(" + parseInt(a, 16) + "," + parseInt(b, 16) + "," + parseInt(c, 16) + ",.35)")], [1, "rgba(0,0,0,0)"]]);
  SPR_FOLLE = {
    chaud: spriteFolle(32, [[0, "rgba(255,246,214,1)"], [.25, "rgba(255,200,90,.9)"], [.6, "rgba(255,120,30,.35)"], [1, "rgba(255,80,20,0)"]]),
    orange: spriteFolle(32, [[0, "rgba(255,150,40,.95)"], [.4, "rgba(235,80,25,.55)"], [1, "rgba(200,40,15,0)"]]),
    rouge: spriteFolle(32, [[0, "rgba(210,50,25,.8)"], [.5, "rgba(140,25,15,.35)"], [1, "rgba(80,10,5,0)"]]),
    fumee: spriteFolle(32, [[0, "rgba(70,60,58,.45)"], [1, "rgba(40,35,35,0)"]]),
    nuage: spriteFolle(32, [[0, "rgba(96,106,128,.95)"], [.55, "rgba(60,68,86,.7)"], [1, "rgba(30,34,46,0)"]]),
    braise: spriteFolle(8, [[0, "#FFF3C0"], [.35, "rgba(255,170,60,.95)"], [1, "rgba(255,90,20,0)"]]),
    or: spriteFolle(10, [[0, "#FFFBEA"], [.3, "rgba(255,214,92,.95)"], [1, "rgba(255,180,40,0)"]]),
    c: ["#FF6FA8", "#5EEAD4", "#7FB2FF", "#C4B5FD", "#A3E635", "#FFB86B", "#FFFFFF"].map(sp)
  };
  return SPR_FOLLE;
}
/** l'aurore (bouquet final) : trois voiles verts / turquoise / mauves, floutés une fois dans une image hors écran */
function auroreFolle(W, H) {
  const c = document.createElement("canvas"), h = Math.round(H * .55); c.width = Math.round(W); c.height = h; const g = c.getContext("2d");
  try { g.filter = "blur(14px)"; } catch (e) { /* sans flou : un peu plus net */ }
  [["94,234,212", 0, .5], ["163,230,53", 2.1, .32], ["196,181,253", 4.2, .28]].forEach(([col, ph, a0]) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(" + col + ",0)"); gr.addColorStop(.3, "rgba(" + col + "," + a0 + ")"); gr.addColorStop(.75, "rgba(" + col + "," + a0 * .25 + ")"); gr.addColorStop(1, "rgba(" + col + ",0)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= W; x += 8) g.lineTo(x, h * (.08 + .16 * (1 + Math.sin(x / 85 + ph)) / 2 + .06 * Math.sin(x / 31 + ph * 2)));
    g.lineTo(W, h); g.closePath(); g.fill(); });
  return c;
}
/** lot 62 b · les scènes des événements rares (une image par appel ; st = mémoire de la scène) */
function sceneEv(kind, g, W, H, t, dt, st, eclairs, pousser, rnd, SP, finE) {
  const T1 = Math.min(1, t / .8);
  if (kind === "krach") {   // l'orage : nuages bas, pluie oblique, éclairs blancs (pas de feu : ce n'est pas ton portefeuille)
    if (!st.n) st.n = Array.from({ length: 9 }, (_, i) => ({ x: (i / 8) * W * 1.2 - W * .1, y: rnd(-.04, .1) * H, r: rnd(.28, .42) * W, v: rnd(6, 16) }));
    g.globalCompositeOperation = "source-over";
    st.n.forEach(n => { n.x += n.v * dt; g.globalAlpha = .9 * T1; g.drawImage(SP.nuage, n.x - n.r, n.y - n.r * .6, n.r * 2, n.r * 1.2); });
    if (!finE) for (let i = 0, k = Math.round(280 * dt * T1 + Math.random()); i < k; i++) pousser({ k: "l", x: rnd(0, W * 1.2), y: rnd(-20, H * .2), vx: -120, vy: rnd(650, 900), v: 0, vie: rnd(.8, 1.3) });
    eclairs.forEach((e, i) => { const u = (t - e) / .3; if (u < 0 || u > 1) return;
      if (!st["b" + i]) { let x = rnd(.2, .8) * W, y = H * .08; const pts = [[x, y]]; while (y < H * rnd(.5, .7)) { x += rnd(-38, 38); y += rnd(22, 46); pts.push([x, y]); } st["b" + i] = pts; }
      g.globalAlpha = (1 - u) * .55; g.fillStyle = "#DDE6FF"; g.fillRect(0, 0, W, H);
      const pts = st["b" + i]; g.globalAlpha = 1 - u; g.strokeStyle = "rgba(220,230,255,.35)"; g.lineWidth = 7; g.lineJoin = "round"; g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
      g.strokeStyle = "#FFFFFF"; g.lineWidth = 2; g.stroke(); });
    g.globalAlpha = 1; g.globalCompositeOperation = "lighter";
  } else if (kind === "crypto") {   // l'orage électrique : arcs orange (couleur du Bitcoin) et violets, étincelles
    g.globalCompositeOperation = "lighter";
    eclairs.forEach((e, i) => { const u = (t - e) / .22; if (u < 0 || u > 1) return;
      if (!st["a" + i]) { const a = [rnd(0, W), rnd(.05, .45) * H], b = [rnd(0, W), rnd(.55, .95) * H], pts = [a]; for (let j = 1; j < 12; j++) pts.push([a[0] + (b[0] - a[0]) * j / 12 + rnd(-26, 26), a[1] + (b[1] - a[1]) * j / 12 + rnd(-14, 14)]); pts.push(b); st["a" + i] = pts;
        for (let j = 0; j < 26; j++) pousser({ k: "s", x: b[0], y: b[1], vx: rnd(-220, 220), vy: rnd(-260, 40), v: 0, vie: rnd(.5, 1), sp: SP.braise, tl: rnd(2, 4) }); }
      const pts = st["a" + i], col = i % 2 ? "196,181,253" : "247,147,26";
      [[10, .25], [4, .6], [1.6, 1]].forEach(([w, a]) => { g.globalAlpha = (1 - u) * a; g.strokeStyle = a === 1 ? "#FFF6E8" : "rgb(" + col + ")"; g.lineWidth = w; g.beginPath(); pts.forEach((p, j) => j ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); });
      g.globalAlpha = (1 - u) * .12; g.fillStyle = "rgb(" + col + ")"; g.fillRect(0, 0, W, H); });
    g.globalAlpha = 1;
  } else if (kind === "sommet") {   // l'aube sur un sommet : le soleil se lève derrière la montagne, un petit drapeau est planté
    if (!st.m) { const pts = [[0, H * .78]], n = 9; for (let i = 1; i < n; i++) pts.push([W * i / n, H * (i === 5 ? .5 : rnd(.62, .76))]); pts.push([W, H * .74]); st.m = pts; st.pic = pts[5]; }
    const lev = Math.min(1, t / 2.4), sy = H * (.66 - .14 * (1 - Math.pow(1 - lev, 2))), px = st.pic[0], py = st.pic[1];
    g.globalCompositeOperation = "lighter"; g.globalAlpha = .55 * T1;
    const gr = g.createRadialGradient(px, sy, 0, px, sy, W * .9); gr.addColorStop(0, "rgba(255,190,150,.9)"); gr.addColorStop(.25, "rgba(255,120,140,.35)"); gr.addColorStop(1, "rgba(80,90,200,0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalAlpha = .18 * T1; g.fillStyle = "#FFE4CF"; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + t * .15; g.beginPath(); g.moveTo(px, sy); g.lineTo(px + Math.cos(a - .05) * W, sy + Math.sin(a - .05) * W); g.lineTo(px + Math.cos(a + .05) * W, sy + Math.sin(a + .05) * W); g.fill(); }
    g.globalAlpha = 1; g.drawImage(SP.chaud, px - 60, sy - 60, 120, 120);
    g.globalCompositeOperation = "source-over"; g.fillStyle = "#0B1026"; g.beginPath(); g.moveTo(0, H); st.m.forEach(p => g.lineTo(p[0], p[1])); g.lineTo(W, H); g.fill();
    g.fillStyle = "rgba(255,255,255,.85)"; g.beginPath(); g.moveTo(px, py); g.lineTo(px - 16, py + 18); g.lineTo(px - 5, py + 14); g.lineTo(px, py + 20); g.lineTo(px + 6, py + 13); g.lineTo(px + 17, py + 19); g.fill();   // la neige du sommet
    if (t > 1.4) { const f = Math.min(1, (t - 1.4) / .4), hp = 34 * f; g.strokeStyle = "#E8ECF5"; g.lineWidth = 2; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - hp); g.stroke();
      if (f >= 1) { const w = Math.sin(t * 6) * 3; g.fillStyle = "#5EEAD4"; g.beginPath(); g.moveTo(px, py - hp); g.lineTo(px + 20, py - hp + 5 + w); g.lineTo(px, py - hp + 12); g.fill(); } }
    g.globalCompositeOperation = "lighter";
  } else if (kind === "serie") {   // l'arc-en-ciel se dessine, cinq petits soleils s'allument (un par séance)
    const cx = W / 2, cy = H * .8, R = Math.min(W * .62, H * .5), pr = Math.min(1, t / 1.6), cols = ["#FF5D73", "#FF9F45", "#FFD45C", "#7BE495", "#5EEAD4", "#7FB2FF", "#B794F4"];
    g.globalCompositeOperation = "lighter"; g.lineCap = "round";
    cols.forEach((c, i) => { g.globalAlpha = .42; g.strokeStyle = c; g.lineWidth = R * .024; g.beginPath(); g.arc(cx, cy, R * (1 - i * .045), Math.PI, Math.PI + pr * Math.PI); g.stroke(); });
    for (let i = 0; i < SERIE_N; i++) { const ts = .3 + i * .32; if (t < ts) continue; const a = Math.PI + (i + .5) / SERIE_N * Math.PI, x = cx + Math.cos(a) * R * 1.1, y = cy + Math.sin(a) * R * 1.1, u = Math.min(1, (t - ts) / .3);
      g.globalAlpha = u * .8; g.drawImage(SP.c[i % SP.c.length], x - 10 * u, y - 10 * u, 20 * u, 20 * u); if (!st["s" + i]) { st["s" + i] = 1; for (let j = 0; j < 14; j++) pousser({ k: "s", x, y, vx: rnd(-120, 120), vy: rnd(-160, 20), v: 0, vie: rnd(.5, .9), sp: SP.c[j % SP.c.length], tl: rnd(3, 5) }); } }
    g.globalAlpha = 1;
  } else if (["record", "pirebaisse", "volhaut", "volbas"].includes(kind)) {   // lot 63 : effets sobres (un halo, quelques particules), 3,5 s
    const col = { record: "94,234,212", pirebaisse: "127,178,255", volhaut: "150,170,210", volbas: "163,230,53" }[kind], T1b = Math.min(1, t / .8);
    g.globalCompositeOperation = "lighter"; g.globalAlpha = .5 * T1b;
    const gr = g.createRadialGradient(W / 2, H * .42, 0, W / 2, H * .42, W * .8); gr.addColorStop(0, "rgba(" + col + ",.45)"); gr.addColorStop(1, "rgba(" + col + ",0)"); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    if (!finE) { if (kind === "volhaut") { for (let i = 0, k2 = Math.round(90 * dt + Math.random()); i < k2; i++) pousser({ k: "l", x: -20, y: rnd(.1, .95) * H, vx: rnd(700, 1100), vy: rnd(-30, 30), v: 0, vie: rnd(.5, .9) }); }
      else { st.a = (st.a || 0) + dt * (kind === "volbas" ? 10 : 26); while (st.a >= 1) { st.a--; pousser({ k: "s", x: rnd(0, W), y: kind === "volbas" ? rnd(-10, H * .3) : H + 5, vx: rnd(-15, 15), vy: kind === "volbas" ? rnd(10, 30) : -rnd(160, 280), v: 0, vie: kind === "volbas" ? rnd(2.5, 3.5) : rnd(1.4, 2.2), sp: kind === "record" ? SP.c[1] : kind === "volbas" ? SP.c[4] : SP.c[2], tl: rnd(2.5, 4.5) }); } } }
  } else if (kind === "plat") {   // la mer d'huile : un horizon au crépuscule, le reflet du soleil, des ronds dans l'eau qui s'élargissent lentement
    const hy = H * .62, T1b = Math.min(1, t / 1.2);
    g.globalCompositeOperation = "source-over"; g.globalAlpha = T1b;
    const ciel = g.createLinearGradient(0, 0, 0, hy); ciel.addColorStop(0, "rgba(10,24,48,0)"); ciel.addColorStop(1, "rgba(120,170,190,.35)"); g.fillStyle = ciel; g.fillRect(0, 0, W, hy);
    const mer = g.createLinearGradient(0, hy, 0, H); mer.addColorStop(0, "rgba(40,90,110,.55)"); mer.addColorStop(1, "rgba(6,20,30,.2)"); g.fillStyle = mer; g.fillRect(0, hy, W, H - hy);
    g.globalCompositeOperation = "lighter"; g.drawImage(SP.chaud, W / 2 - 46, hy - 70, 92, 92);   // le soleil posé sur l'horizon
    for (let i = 0; i < 14; i++) { const y = hy + 6 + i * i * 1.6, w = (60 - i * 3) * (1 + .08 * Math.sin(t * 1.3 + i)); g.globalAlpha = T1b * (.35 - i * .02); g.fillStyle = "#FFE2B8"; g.fillRect(W / 2 - w / 2, y, w, 2); }
    g.globalCompositeOperation = "source-over"; g.lineWidth = 1.2;
    [0, 1.3, 2.6].forEach((t0, j) => { const u = ((t - t0) % 3.9) / 3.9; if (t < t0) return; const x0 = W * [.3, .7, .5][j], y0 = hy + H * [.12, .2, .28][j];
      g.globalAlpha = T1b * (1 - u) * .6; g.strokeStyle = "#BFE7F2"; g.beginPath(); g.ellipse(x0, y0, 10 + u * W * .22, (10 + u * W * .22) * .18, 0, 0, Math.PI * 2); g.stroke(); });
    g.globalAlpha = 1; g.globalCompositeOperation = "lighter";
  } else if (kind === "relache") {   // la sieste : un croissant de lune, des étoiles, des « z » qui montent
    if (!st.e) st.e = Array.from({ length: 40 }, () => [rnd(0, W), rnd(0, H * .6), rnd(0, 6), rnd(.6, 1.6)]);
    g.globalCompositeOperation = "lighter"; st.e.forEach(e => { g.globalAlpha = T1 * (.35 + .35 * Math.sin(t * 2 + e[2])); g.drawImage(SP.braise, e[0] - e[3] * 2, e[1] - e[3] * 2, e[3] * 4, e[3] * 4); });
    const mx = W * .78, my = H * .16, r = Math.min(W, H) * .09; g.globalCompositeOperation = "source-over"; g.globalAlpha = T1;
    g.fillStyle = "#F3F0D8"; g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.fill(); g.fillStyle = "#070A1C"; g.beginPath(); g.arc(mx + r * .45, my - r * .2, r * .9, 0, Math.PI * 2); g.fill();
    st.z = (st.z || 0) + dt; if (st.z > .55 && !finE) { st.z = 0; pousser({ k: "z", x: W * rnd(.35, .6), y: H * .78, vy: -rnd(40, 60), v: 0, vie: 2.6, ph: rnd(0, 6), tl: rnd(18, 30) }); }
    g.globalAlpha = 1; g.globalCompositeOperation = "lighter";
  }
}
/** le grand effet. revoir = rejoué à la demande (rien n'est noté) */
function lancerFolle(x, revoir) {
  injecterStyle();
  const kind = x.k || (x.sens < 0 ? "feu" : "joie"), feu = kind === "feu", joie = kind === "joie", fort = !!x.fort, niv = x.niv || (fort ? 3 : 1), explo = feu && niv === 2, bonbons = joie && niv === 2, disc = ETAT.discret === "oui", T = textesEv(Object.assign({ k: kind }, x));   // lot 62 b : un seul moteur pour tous les événements
  const o = document.createElement("div");
  o.className = "m-folle moi " + kind + (fort ? " fort" : "") + (explo ? " explo" : "") + (bonbons ? " bonbons" : "") + (reduit ? " calme" : "");
  o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true"); o.setAttribute("aria-label", T.k + " : " + T.sub + ", " + T.big); o.tabIndex = -1;
  o.innerHTML = '<canvas aria-hidden="true"></canvas><div class="mfo-c"><span class="mfo-k">' + esc(T.k) + '</span><span class="mfo-d">' + esc(T.sub) + "</span>" +
    '<b class="mfo-p' + (T.big.length > 8 ? " long" : "") + '">' + esc(T.big) + "</b>" + ((feu || joie) && !disc && ok(x.e) && Math.abs(x.e) >= 1 ? '<span class="mfo-e">' + eur(x.e, 0, true) + "</span>" : "") + "<p>" + esc(T.phr) + '</p></div><span class="mfo-t">Touche pour continuer</span>';
  document.body.appendChild(o);
  try { o.focus({ preventScroll: true }); } catch (e) { /* rien */ }
  const S = window.SONS, duree = reduit ? 2800 : fort ? 5000 : niv === 2 ? 4600 : kind === "relache" || ["record", "pirebaisse", "volhaut", "volbas"].includes(kind) ? 3600 : 4300, t0 = performance.now();
  let fini = false, raf = 0;
  const fermer = () => { if (fini) return; fini = true; cancelAnimationFrame(raf); removeEventListener("resize", taille); if (S && S.folleStop) S.folleStop(); o.classList.add("fin");
    setTimeout(() => { o.remove(); try { verifierPaliers(); } catch (e) { /* rien */ } }, 450); };   // lot 62 d : une fête de palier en attente passe APRÈS l'effet (jamais par-dessus)
  o.addEventListener("click", fermer); o.addEventListener("keydown", e => { if (["Escape", "Enter", " "].includes(e.key)) { e.preventDefault(); fermer(); } });
  setTimeout(fermer, duree);
  requestAnimationFrame(() => o.classList.add("on"));
  /* son : la séquence est écrite à l'avance (mêmes instants que l'image) */
  const fusees = [];
  if (joie && !bonbons) { const n = fort ? 10 : 7; for (let i = 0; i < n; i++) { const l = (i < 2 ? 0 : .1 + (i - 1) * (fort ? .38 : .46)) + Math.random() * .12, bas = i % 3 === 2;   // deux fusées d'entrée, puis une salve régulière ; une sur trois éclate plus bas, sur les côtés
    fusees.push({ l, b: l + .7 + Math.random() * .2, x: bas ? (i % 2 ? .82 : .18) : .14 + ((i * .37 + Math.random() * .2) % .72), y: bas ? .5 + Math.random() * .12 : .1 + Math.random() * .24, gros: fort && i === n - 1 }); } }
  const eclairs = kind === "krach" ? [.35, 1.5, 2.6, 3.4] : kind === "crypto" ? [.2, .9, 1.5, 2.2, 2.8, 3.3] : [];
  try { if (S) { if (explo && S.explosion) S.explosion(); if (bonbons && S.bonbons) S.bonbons(duree / 1000 - .8); if (feu) S.folleFeu(duree / 1000 - .3, fort || explo); else if (joie) { fusees.forEach(f => S.fusee(f.l, f.b, f.gros)); if (fort) S.aurore(1, duree / 1000 - 1.4); } else if (S.evenement) S.evenement(kind, duree / 1000, eclairs); } } catch (e) { /* son indisponible */ }
  const cv = o.querySelector("canvas"), g = cv.getContext && cv.getContext("2d");
  let W = 0, H = 0; const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  function taille() { W = innerWidth; H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); }
  if (reduit || !g) return;   // version calme : un fond qui s'allume, le chiffre, rien qui bouge
  taille(); addEventListener("resize", taille);
  const SP = spritesFolle(), P = [], rnd = (a, b) => a + Math.random() * (b - a), MAX = 900;
  let der = t0, acc = 0, accB = 0, aur = null; const T0 = {};
  const pousser = q => { if (P.length < MAX) P.push(q); };
  const pas = now => {
    if (fini) return;
    const dt = Math.max(0, Math.min(.05, (now - der) / 1000)), t = Math.max(0, (now - t0) / 1000), T = duree / 1000; der = Math.max(der, now);   // la 1re image peut dater d'avant t0
    g.clearRect(0, 0, W, H);
    const finE = t > T - 1.1;   // plus rien ne naît dans la dernière seconde
    if (feu) {
      const taux = finE ? 0 : (fort ? 190 : 150) * Math.min(1, t / .5);
      acc += taux * dt; while (acc >= 1) { acc--; const x0 = rnd(-.05, 1.05) * W;
        pousser({ k: "f", x: x0, y: H + 30, vx: rnd(-10, 10), vy: -rnd(150, 300) * (fort ? 1.3 : 1) * (H / 800), v: 0, vie: rnd(.7, 1.4), tl: rnd(26, 50) * (W < 500 ? 1 : 1.3) }); }
      accB += (finE ? 0 : fort ? 40 : 24) * dt; while (accB >= 1) { accB--; pousser({ k: "b", x: rnd(0, W), y: H + 5, vx: rnd(-30, 30), vy: -rnd(70, 190), v: 0, vie: rnd(1.8, 3.4), ph: rnd(0, 6), tl: rnd(2, 4) }); }
      if (fort && t < .35) { g.fillStyle = "rgba(255,120,40," + (.35 * (1 - t / .35)) + ")"; g.fillRect(0, 0, W, H); }   // l'éclair du départ
      if (explo) {   // lot 62 c · Explosion : flash blanc, onde de choc, débris qui retombent (le feu prend ensuite)
        if (t < .45) { g.fillStyle = "rgba(255,236,200," + (.8 * (1 - t / .45)) + ")"; g.fillRect(0, 0, W, H); }
        if (!T0.deb) { T0.deb = 1; for (let i = 0; i < 70; i++) { const a = -Math.PI * rnd(.08, .92), v0 = rnd(250, 620); pousser({ k: "d", x: W / 2 + rnd(-20, 20), y: H * .74, vx: Math.cos(a) * v0, vy: Math.sin(a) * v0, v: 0, vie: rnd(1.3, 2.2), r: rnd(0, 6), vr: rnd(-9, 9), tl: rnd(3, 8) }); } }
        if (t < .9) { const u = t / .9; g.globalCompositeOperation = "lighter"; g.globalAlpha = (1 - u) * .7; g.strokeStyle = "#FFD9A8"; g.lineWidth = 6 * (1 - u) + 1; g.beginPath(); g.ellipse(W / 2, H * .74, u * W * .9, u * W * .3, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
      }
    } else if (!joie) { sceneEv(kind, g, W, H, t, dt, T0, eclairs, pousser, rnd, SP, finE); } else if (bonbons) {   // lot 62 c · Pluie de bonbons : des bonbons emballés multicolores tombent en tournant
      accB += (finE ? 0 : 55) * dt * Math.min(1, t / .4); while (accB >= 1) { accB--; pousser({ k: "c", x: rnd(0, W), y: -20, vx: rnd(-25, 25), vy: rnd(140, 260), v: 0, vie: 4, r: rnd(0, 6), vr: rnd(-4, 4), tl: rnd(9, 15), col: ["#FF6FA8", "#5EEAD4", "#7FB2FF", "#C4B5FD", "#A3E635", "#FFB86B"][Math.floor(rnd(0, 6))] }); }
    } else {
      fusees.forEach(f => {
        if (!f.parti && t >= f.l) { f.parti = 1; pousser({ k: "r", x: f.x * W, y: H + 10, x1: f.x * W + rnd(-20, 20), y1: f.y * H, t0: t, d: f.b - f.l, v: 0, vie: f.b - f.l }); }
        if (!f.eclate && t >= f.b) { f.eclate = 1; const n = f.gros ? 150 : fort ? 95 : 75, sp0 = SP.c[Math.floor(Math.random() * SP.c.length)], v0 = (f.gros ? 310 : 230) * Math.min(1.3, W / 390);
          for (let i = 0; i < n; i++) { const a = Math.PI * 2 * i / n + rnd(-.05, .05), vv = v0 * rnd(.45, 1), sp = f.gros ? SP.c[i % SP.c.length] : sp0;   // le bouquet final : toutes les couleurs
            pousser({ k: "e", x: f.x * W, y: f.y * H, vx: Math.cos(a) * vv, vy: Math.sin(a) * vv, v: 0, vie: rnd(1.1, 1.8), sp, tl: rnd(5, 8) * (f.gros ? 1.3 : 1) }); }
          pousser({ k: "flash", x: f.x * W, y: f.y * H, v: 0, vie: .2, tl: f.gros ? 90 : 60 }); }
      });
      if (fort) {   // le bouquet final : une aurore verte ondule en haut de l'écran, derrière les fusées (dessinée et floutée une seule fois)
        if (!aur) aur = auroreFolle(W, H);
        const al = Math.min(1, t / 1.2) * (finE ? Math.max(0, (T - t) / 1.1) : 1);
        g.globalCompositeOperation = "lighter"; g.globalAlpha = al * (.8 + .2 * Math.sin(t * 1.7));
        g.drawImage(aur, -W * .08 + Math.sin(t * .5) * W * .06, 0, W * 1.16, H * (.55 + .03 * Math.sin(t * 1.1)));
        g.globalAlpha = 1; g.globalCompositeOperation = "source-over"; }
    }
    g.globalCompositeOperation = "lighter";
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i]; q.v += dt; const u = q.v / q.vie;
      if (u >= 1) { P.splice(i, 1); continue; }
      if (q.k === "f") { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= .98;
        q.x += Math.sin(q.v * 9 + q.tl) * 14 * dt;   // la langue de flamme ondule
        const s = q.tl * (1 - u * .6), spr = u < .25 ? SP.chaud : u < .55 ? SP.orange : u < .8 ? SP.rouge : null;
        if (spr) { g.globalAlpha = Math.min(1, (1 - u) * 1.4) * .6; g.drawImage(spr, q.x - s * .8, q.y - s * 1.9, s * 1.6, s * 3.2); }   // étirée en hauteur : une langue, pas une bulle
        else { g.globalCompositeOperation = "source-over"; g.globalAlpha = (1 - u) * .5; g.drawImage(SP.fumee, q.x - s, q.y - s * 1.1, s * 2.2, s * 2.2); g.globalCompositeOperation = "lighter"; }
      } else if (q.k === "b") { q.x += (q.vx + Math.sin(q.v * 3 + q.ph) * 26) * dt; q.y += q.vy * dt; g.globalAlpha = (1 - u) * (.6 + .4 * Math.sin(q.v * 18 + q.ph)); g.drawImage(SP.braise, q.x - q.tl, q.y - q.tl, q.tl * 2, q.tl * 2);
      } else if (q.k === "r") { const w = Math.min(1, (t - q.t0) / q.d), e = 1 - Math.pow(1 - w, 2), x = q.x + (q.x1 - q.x) * e, y = q.y + (q.y1 - q.y) * e;
        for (let j = 0; j < 5; j++) { const ej = 1 - Math.pow(1 - Math.max(0, w - j * .025), 2); g.globalAlpha = .7 - j * .12; g.drawImage(SP.braise, q.x + (q.x1 - q.x) * ej - 4, q.y + (q.y1 - q.y) * ej - 4, 8, 8); }
        g.globalAlpha = 1; g.drawImage(SP.or, x - 6, y - 6, 12, 12);
      } else if (q.k === "e") { const fr = Math.pow(.25, dt); q.vx *= fr; q.vy = q.vy * fr + 120 * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        g.globalAlpha = (1 - u) * (u > .65 ? .5 + .5 * Math.sin(q.v * 40) : 1); g.drawImage(q.sp, q.x - q.tl, q.y - q.tl, q.tl * 2, q.tl * 2);
      } else if (q.k === "d") { q.vy += 700 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt; g.globalCompositeOperation = "source-over"; g.globalAlpha = Math.min(1, (1 - u) * 2);
        g.save(); g.translate(q.x, q.y); g.rotate(q.r); g.fillStyle = "#2A2220"; g.fillRect(-q.tl, -q.tl * .6, q.tl * 2, q.tl * 1.2); g.fillStyle = "rgba(255,140,50,.85)"; g.fillRect(-q.tl, -q.tl * .6, q.tl * 2, 1.5); g.restore(); g.globalCompositeOperation = "lighter";
      } else if (q.k === "c") { q.x += (q.vx + Math.sin(q.v * 2 + q.r) * 20) * dt; q.y += q.vy * dt; q.r += q.vr * dt; if (q.y > H + 30) { q.v = q.vie; continue; }
        g.globalCompositeOperation = "source-over"; g.globalAlpha = 1; const L = q.tl; g.save(); g.translate(q.x, q.y); g.rotate(q.r); g.fillStyle = q.col;
        g.beginPath(); g.moveTo(-L * .9, 0); g.lineTo(-L * 1.6, -L * .55); g.lineTo(-L * 1.6, L * .55); g.closePath(); g.fill(); g.beginPath(); g.moveTo(L * .9, 0); g.lineTo(L * 1.6, -L * .55); g.lineTo(L * 1.6, L * .55); g.closePath(); g.fill();
        g.beginPath(); g.ellipse(0, 0, L, L * .62, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(-L * .35, -L * .62, L * .22, L * 1.24); g.fillRect(L * .2, -L * .62, L * .22, L * 1.24); g.restore(); g.globalCompositeOperation = "lighter";
      } else if (q.k === "l") { q.x += q.vx * dt; q.y += q.vy * dt; g.globalCompositeOperation = "source-over"; g.strokeStyle = "rgba(190,205,230," + (.45 * (1 - u)) + ")"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * .03, q.y - q.vy * .03); g.stroke(); g.globalCompositeOperation = "lighter";
      } else if (q.k === "s") { q.vy += 300 * dt; q.x += q.vx * dt; q.y += q.vy * dt; g.globalAlpha = 1 - u; g.drawImage(q.sp, q.x - q.tl, q.y - q.tl, q.tl * 2, q.tl * 2);
      } else if (q.k === "z") { q.x += Math.sin(q.v * 1.5 + q.ph) * 12 * dt; q.y += q.vy * dt; g.globalCompositeOperation = "source-over"; g.globalAlpha = Math.min(1, u * 4) * (1 - u); g.fillStyle = "#E0E7FF"; g.font = "italic 800 " + q.tl + "px sans-serif"; g.fillText("z", q.x, q.y); g.globalCompositeOperation = "lighter";
      } else if (q.k === "flash") { g.globalAlpha = (1 - u) * .4; g.drawImage(SP.chaud, q.x - q.tl, q.y - q.tl, q.tl * 2, q.tl * 2);
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    raf = requestAnimationFrame(pas);
  };
  raf = requestAnimationFrame(pas);
}
/** la dernière journée folle d'un genre (historique du fichier + celles vues sur cet appareil) : aaaa-mm-jj ou null */
function derniereFolle(k) {
  const sg = k === "feu" ? -1 : 1; let d = null;
  try { seancesHisto().forEach(x => { if (x.p * sg >= FOLLE_SEUIL - 1e-9 && (!d || x.d > d)) d = x.d; }); } catch (e) { /* rien */ }
  try { const l = JSON.parse(stock.get(cleStock("folles")) || "[]"); (Array.isArray(l) ? l : []).forEach(c => { if (c.charAt(10) === (sg > 0 ? "+" : "-") && (!d || c.slice(0, 10) > d)) d = c.slice(0, 10); }); } catch (e) { /* rien */ }
  return d;
}
/* ==================== lot 62 b · Événements rares de Moi (validés par Théo) ====================
   Même mécanique que les journées folles : un grand effet à la 1re ouverture de Moi › Aujourd'hui, une petite carte qui dit POURQUOI
   (« Événement · … »), une ambiance discrète pendant environ une semaine (le jour même pour la relâche), puis grisé dans Vestiaire › Ambiances.
   JAMAIS deux à la fois : le plus prioritaire des événements en cours gagne (ordre EV_PRIO). Profil simple : rien.
   Seuils (Conseil, lot 62) : Krach = S&P 500 −3 % ou pire en une séance (≈ 3 séances par an depuis 1990, groupées : ≈ 1 à 2 événements par an
   une fois regroupées sur une semaine) ; Tempête crypto = Bitcoin ±10 % d'une clôture à l'autre (≈ 3-4 fois par an en 2023-2025, bien plus avant) ;
   Sommet = clôture du S&P 500 au-dessus de TOUTES les clôtures connues (≥ 250 séances de données) après au moins 20 séances sans record ;
   Série verte = 5 séances de hausse d'affilée de ton portefeuille (historique du fichier, versements neutralisés) ; Relâche = jour férié de semaine
   où Paris (lignes EPA:) ou New York (lignes NASDAQ:/NYSE…) est fermée. Concernés : Krach et Sommet = tout le monde (le S&P 500 est la référence
   du jeu) ; Tempête crypto = seulement si tu as du Bitcoin ; Relâche = seulement si tu as des lignes sur la place fermée.
   lot 62 c : Calme plat = 20 séances d'affilée de ton portefeuille sans bouger de plus de 1 % (historique du fichier), priorité la plus basse. */
const EV_PRIO = ["feu", "joie", "krach", "crypto", "record", "sommet", "pirebaisse", "volhaut", "serie", "volbas", "relache", "plat"];   // lot 63 : + 4 événements de risque (les records personnels avant ceux du S&P ; la volatilité basse avec les événements calmes)   // lot 62 c : ta journée folle passe avant le krach (Moi parle de TON portefeuille ; le krach reste en pastille) ; « Calme plat » en dernier
const KRACH_SEUIL = -.03, CRYPTO_SEUIL = .10, SOMMET_MIN = 250, SOMMET_ECART = 40, SERIE_N = 7, SP_RECORD_CONNU = 6000, CALME_N = 20, CALME_SEUIL = .01;   // lot 62 c : Calme plat = 20 séances sans ±1 %   // SP_RECORD_CONNU : plancher prudent si la série est en points d'indice
const EV_DEF = {
  feu: { ic: "🧯", nom: "Incendie", quoi: "ton portefeuille perd 2,8 % ou plus en une séance (Explosion à −3,5 %, Journée noire à −5 %)" },
  joie: { ic: "🎆", nom: "Feu d'artifice", quoi: "ton portefeuille gagne 2,8 % ou plus en une séance (Pluie de bonbons à +3,5 %, Bouquet final à +5 %)" },
  krach: { ic: "⛈️", nom: "Krach mondial", quoi: "le S&P 500 perd 3 % ou plus en une séance" },
  crypto: { ic: "⚡", nom: "Tempête crypto", quoi: "le Bitcoin bouge de 10 % ou plus en 24 h (si tu en as)" },
  sommet: { ic: "🏔️", nom: "Sommet du S&P 500", quoi: "le S&P 500 bat son record après au moins deux mois sans record" },
  serie: { ic: "🌈", nom: "Série verte", quoi: "ton portefeuille monte 7 séances d'affilée" },   // lot 63 : 7 (à 5, ≈ 5 fois par an : trop fréquent)
  relache: { ic: "😴", nom: "Bourse en relâche", quoi: "un jour férié ferme la bourse de tes lignes" },
  record: { ic: "🧗", nom: "Record battu", quoi: "ton portefeuille dépasse son plus haut après une baisse de 10 % ou plus" },
  pirebaisse: { ic: "🩹", nom: "Pire baisse effacée", quoi: "ton portefeuille rattrape la plus grosse baisse de l'année (5 % ou plus), une fois par an" },
  volhaut: { ic: "🌬️", nom: "Volatilité très élevée", quoi: "ta volatilité sur 1 mois dépasse 90 % de ton historique (30 % par an si l'historique est court)" },
  volbas: { ic: "🍃", nom: "Volatilité au plus bas", quoi: "ta volatilité sur 3 mois passe sous 90 % de ton historique (8 % par an si l'historique est court)" },
  plat: { ic: "🌊", nom: "Calme plat", quoi: "ton portefeuille ne bouge jamais de plus de 1 % pendant 20 séances d'affilée" }
};
function ambCoupee(k) { return Array.isArray(PREF.ambOff) && PREF.ambOff.includes(k); }
function evTousCoupes() { return false; }   // lot 62 d (Théo) : plus d'interrupteur général (on coupait tout par erreur) ; seulement Oui/Non par événement
/** lot 62 c : le nom d'une journée folle selon son palier (Incendie · Explosion · Journée noire / Feu d'artifice · Pluie de bonbons · Bouquet final) */
function nomEv(x) { const n = (x.niv || 1) - 1; return x.k === "feu" ? ["Incendie", "Explosion", "Journée noire"][n] : x.k === "joie" ? ["Feu d'artifice", "Pluie de bonbons", "Bouquet final"][n] : EV_DEF[x.k].nom; }
const libCourt = d => { const j = new Date(d + "T12:00:00"); return JOURS_C[j.getDay()] + " " + (j.getFullYear() === new Date().getFullYear() ? frDate(d).slice(0, 5) : frDate(d)); };   // l'année quand ce n'est pas celle-ci
/** clôtures quotidiennes d'un marché du Versus { d, v } (+ la séance en direct quand le Versus l'a et que les clôtures ne l'ont pas encore) */
function closEv(nom) {
  const m = marchesMoi(), q = m && m.quot, sq = q && (q.s || []).find(x => x.nom === nom), out = []; if (!sq) return out;
  (q.d || []).forEach((d, i) => { if (sq.v[i] > 0) out.push({ d: isoN(d), v: sq.v[i] }); });
  const j = (m.jour || []).find(x => x.nom === nom), mh = j && typeof j.pct === "number" && /^(\d{2})\/(\d{2})/.exec(j.heure || "");
  /* lot 62 d (Théo, 21/11) : la variation du Versus (`jour`, datée par son heure) fait foi pour SA séance : la clôture Google du jour peut manquer
     (pas encore là le lendemain matin) ou être une valeur de la journée (cours en séance). On remplace (ou on ajoute) cette séance. */
  /* v20.61 (bug de Théo, 25/11 : « Krach −3,1 % » pour un jour à −1,09 %) : `av` est lu SANS retirer la clôture d'avant (l'ancien .pop() l'enlevait :
     la séance du jour était alors comparée à l'avant-veille, deux séances cumulées) ; une ligne Google datée d'aujourd'hui que le Versus ne confirme
     pas (cours en séance, pas une clôture) est ignorée : la séance du jour = exactement la variation affichée dans Marchés, ou rien. */
  const a = new Date(), auj = isoJour(a); let dj = null;
  if (mh && out.length) { const y = +mh[2] > a.getMonth() + 1 ? a.getFullYear() - 1 : a.getFullYear(); dj = y + "-" + mh[2] + "-" + mh[1];
    if (dj <= auj) { const k = out.findIndex(x => x.d >= dj), av = k < 0 ? out[out.length - 1] : out[k - 1];
      if (av) { const x = { d: dj, v: av.v * (1 + j.pct), versus: true }; if (k < 0) out.push(x); else if (out[k].d === dj) out[k] = x; } } }
  return dj === auj ? out : out.filter(x => x.d !== auj);
}
function varsEv(c, gapMax) { const out = []; for (let i = 1; i < c.length; i++) if ((new Date(c[i].d + "T12:00:00") - new Date(c[i - 1].d + "T12:00:00")) / 864e5 <= gapMax) out.push({ d: c[i].d, p: c[i].v / c[i - 1].v - 1, v: c[i].v }); return out; }
/** tickers des lignes tenues (Perf lignes) */
function tickersTenus() { const p = (M && M.perfLignes) || {}; return lignesTenues().map(l => String(((p[l.env + "|" + l.code] || {}).ticker) || "").toUpperCase()); }
function aDuBitcoin() {
  if (lignesTenues().some(l => (l.valeur || 0) > 0 && /\bBTC\b|BITCOIN/i.test((l.code || "") + " " + (l.nom || "")))) return true;
  if (tickersTenus().some(t => /BTC/.test(t))) return true;
  return (M.enveloppes || []).some(e => /crypto/i.test((e.nom || "") + " " + (e.regime || "")) && e.type !== "total" && (e.valeur || 0) > 0);
}
/** jours fériés de semaine où la bourse ferme : Paris (Euronext) et New York (NYSE/Nasdaq) → nom du jour ou "" */
function paques(an) { const a = an % 19, b = Math.floor(an / 100), c = an % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), j = ((h + l - 7 * m + 114) % 31) + 1; return new Date(an, mo - 1, j, 12); }
function ferie(iso, place) {
  const x = new Date(iso + "T12:00:00"), an = x.getFullYear(), mo = x.getMonth() + 1, j = x.getDate(), jsem = x.getDay(); if (jsem % 6 === 0) return "";
  const P = paques(an), dP = Math.round((x - P) / 864e5);
  if (dP === -2) return "Vendredi saint";
  if (place === "paris") return mo === 1 && j === 1 ? "Jour de l'an" : dP === 1 ? "Lundi de Pâques" : mo === 5 && j === 1 ? "Fête du travail" : mo === 12 && (j === 25 || j === 26) ? (j === 25 ? "Noël" : "Lendemain de Noël") : "";
  const obs = (m0, j0) => { const d = new Date(an, m0 - 1, j0, 12), w = d.getDay(); if (w === 6) d.setDate(d.getDate() - 1); if (w === 0) d.setDate(d.getDate() + 1); return d.getMonth() + 1 === mo && d.getDate() === j; };
  const nieme = (m0, w0, n) => mo === m0 && jsem === w0 && (n > 0 ? Math.ceil(j / 7) === n : j + 7 > new Date(an, mo, 0).getDate());
  if ((mo === 1 && j === 1) || (mo === 1 && j === 2 && jsem === 1)) return "Jour de l'an";
  if (nieme(1, 1, 3)) return "Martin Luther King Day"; if (nieme(2, 1, 3)) return "Presidents' Day"; if (nieme(5, 1, -1)) return "Memorial Day";
  if (obs(6, 19)) return "Juneteenth"; if (obs(7, 4)) return "Independence Day"; if (nieme(9, 1, 1)) return "Labor Day"; if (nieme(11, 4, 4)) return "Thanksgiving"; if (obs(12, 25)) return "Noël";
  return "";
}
/** tous les événements (passés compris) d'un genre, du plus récent au plus ancien : { k, d, … } */
function evDe(k) {
  const out = [];
  if (k === "krach") varsEv(closEv("S&P 500"), 5).forEach(x => { if (x.p <= KRACH_SEUIL + 1e-9) out.push({ k, d: x.d, p: x.p }); });
  else if (k === "crypto") { if (aDuBitcoin()) varsEv(closEv("Bitcoin"), 4).forEach(x => { if (Math.abs(x.p) >= CRYPTO_SEUIL - 1e-9) out.push({ k, d: x.d, p: x.p }); }); }
  else if (k === "sommet") { const c = closEv("S&P 500"); let max = 0, iMax = -1;
    c.forEach((x, i) => { if (i >= SOMMET_MIN && x.v > max && i - iMax >= SOMMET_ECART && (x.v < 1000 || x.v > SP_RECORD_CONNU)) out.push({ k, d: x.d, v: x.v, avant: max, dAvant: c[iMax].d }); if (x.v > max) { max = x.v; iMax = i; } }); }
  else if (k === "record" || k === "pirebaisse" || k === "volhaut" || k === "volbas") evRisque(k).forEach(x => out.push(x));
  else if (k === "plat") { const l = seancesHisto(); let n = 0;   // lot 62 c : une fois par période calme (à la 20e séance), pas tous les jours qui suivent
    l.forEach((x, i) => { const suite = i > 0 && x.i - l[i - 1].i <= 3; n = Math.abs(x.p) <= CALME_SEUIL + 1e-9 ? (suite && n ? n + 1 : 1) : 0; if (n === CALME_N) out.push({ k, d: x.d, de: l[i - CALME_N + 1].d }); }); }
  else if (k === "serie") { const l = seancesHisto(); let n = 0, cum = 1;
    l.forEach((x, i) => { const suite = i > 0 && x.i - l[i - 1].i <= 3; if (x.p > 0) { n = suite && n ? n + 1 : 1; cum = n === 1 ? 1 + x.p : cum * (1 + x.p); } else n = 0; if (n === SERIE_N) out.push({ k, d: x.d, p: cum - 1 }); }); }
  else if (k === "relache") { const t = tickersTenus(), pl = [["paris", /^EPA:/], ["ny", /^(NASDAQ|NYSE|NYSEARCA|NYSEAMERICAN|BATS):/]].filter(([, re]) => t.some(x => re.test(x))).map(p => p[0]);
    if (pl.length) { const n = new Date(); for (let i = 0; i < 400; i++) { const d = isoJour(new Date(n.getFullYear(), n.getMonth(), n.getDate() - i, 12)), f = pl.map(p => [p, ferie(d, p)]).filter(x => x[1]);
      if (f.length) out.push({ k, d, places: f.map(x => x[0]), lib: f[0][1] }); } } }
  else if (k === "feu" || k === "joie") { const d = derniereFolle(k); if (d) out.push({ k, d }); }
  return out.sort((a, b) => a.d < b.d ? 1 : -1);
}
/** l'événement en cours (un seul), ou null */
/** lot 62 c (Théo) : TOUS les événements en cours (un par genre, le plus récent de sa fenêtre), du plus fort au plus faible, sans ceux qu'on a retirés (✕) */
function evenementsActifs() { const m = evMasques(); return evenementsListe().filter(x => !m.includes(x.cle)); }
/* lot 62 d (Théo, 21/11) : un événement NAÎT le jour où la dernière séance remplit sa condition (chiffre de la carte du haut, variation du jour
   des marchés), avec la date de cette séance, puis vit sa semaine : il est gardé sur l'appareil (« evNes »). On ne scanne jamais l'historique
   pour créer des événements d'anciennes séances ; les événements « de durée » (série verte, calme plat) se calculent sur l'historique mais ne
   naissent que si la condition devient vraie à la dernière séance. Exception : la séance du 20/11/2026. */
const EV_EXCEPTION = "2026-11-20";
/** lot 63 · les événements de risque (historique du fichier, versements neutralisés : indice « ip ») ; seuils dans EV_DEF.
    Volatilité = écart-type des variations quotidiennes × √252 ; seuil personnel = centile 90 (haut) ou 10 (bas) des valeurs passées dès 250 valeurs,
    sinon un seuil fixe (30 % / 8 %). Un seul événement par épisode : il faut repasser franchement de l'autre côté (×0,8 ou ×1,25) pour réarmer. */
const VOL_HAUT_FIXE = .30, VOL_BAS_FIXE = .08, VOL_MIN_PERSO = 250;
function evRisque(k) {
  const l = seancesHisto(), h = M.historique, ki = h.cols.indexOf("ip"), out = []; if (l.length < 2) return out;
  const ip = l.map(x => h.rows[x.i][ki]);
  if (k === "record") { let mx = l[0].ip0, dMx = null, creux = 0;
    l.forEach((x, i) => { if (ip[i] > mx) { if (creux <= -.10 + 1e-9) out.push({ k, d: x.d, creux, dAvant: dMx }); mx = ip[i]; dMx = x.d; creux = 0; } else creux = Math.min(creux, ip[i] / mx - 1); }); }
  else if (k === "pirebaisse") { let an = "", mx = 0, pire = 0, pic = 0, dPic = null, dMx = null, fait = false;
    l.forEach((x, i) => { const a = x.d.slice(0, 4); if (a !== an) { an = a; mx = x.ip0; dMx = null; pire = 0; pic = 0; dPic = null; fait = false; }
      if (ip[i] > mx) { mx = ip[i]; dMx = x.d; } const dd = ip[i] / mx - 1; if (dd < pire) { pire = dd; pic = mx; dPic = dMx; }
      if (!fait && pire <= -.05 + 1e-9 && ip[i] > pic) { fait = true; out.push({ k, d: x.d, pire, dAvant: dPic, an }); } }); }
  else { const N = k === "volhaut" ? 21 : 63, haut = k === "volhaut", vs = [], tri = [];
    let arme = true;
    l.forEach((x, i) => { if (i < N - 1) return; const w = l.slice(i - N + 1, i + 1).map(y => y.p), m = w.reduce((a, b) => a + b, 0) / N, v = Math.sqrt(w.reduce((a, b) => a + (b - m) * (b - m), 0) / (N - 1) * 252);
      const perso = tri.length >= VOL_MIN_PERSO, thr = perso ? tri[Math.floor(tri.length * (haut ? .9 : .1))] : (haut ? VOL_HAUT_FIXE : VOL_BAS_FIXE);
      if (arme && (haut ? v > thr : v < thr)) { arme = false; out.push({ k, d: x.d, vol: v, perso }); }
      else if (!arme && (haut ? v < thr * .8 : v > thr * 1.25)) arme = true;
      let a = 0, b = tri.length; while (a < b) { const c = (a + b) >> 1; if (tri[c] < v) a = c + 1; else b = c; } tri.splice(a, 0, v); }); }   // centile sur les valeurs PASSÉES seulement
  if (k === "pirebaisse") { const rec = evRisque("record").map(x => x.d); return out.filter(x => !rec.includes(x.d)).reverse(); }   // le même jour qu'un record : le record suffit
  return out.reverse();
}
function evNaissants() {
  const out = [], exc = d => d === EV_EXCEPTION;
  try { const x = journeeFolle(); if (x) out.push(Object.assign({}, x, { k: x.sens < 0 ? "feu" : "joie", folle: true })); } catch (e) { /* rien */ }
  const dernier = (k, fin) => { try { const l = evDe(k); if (!fin) return; l.filter(x => x.d === fin || exc(x.d)).forEach(x => out.push(x)); } catch (e) { /* données absentes */ } };
  const finSP = (closEv("S&P 500").slice(-1)[0] || {}).d, finBTC = (closEv("Bitcoin").slice(-1)[0] || {}).d, finH = (seancesHisto().slice(-1)[0] || {}).d;
  dernier("krach", finSP); dernier("sommet", finSP); dernier("crypto", finBTC); dernier("serie", finH); dernier("plat", finH); dernier("relache", isoJour(new Date()));
  ["record", "pirebaisse", "volhaut", "volbas"].forEach(k => dernier(k, finH));   // lot 63 : naissent seulement à la dernière séance de l'historique
  return out;
}
let MEMO_EV = { m: null, j: "", l: null };
function evenementsListe() {
  if (!M || M.simple) return [];
  const auj = isoJour(new Date()), mk = marchesMoi(); if (MEMO_EV.m === M && MEMO_EV.mk === mk && MEMO_EV.j === auj && MEMO_EV.l) return MEMO_EV.l.map(x => Object.assign({}, x));   // v20.61 : recalcul aussi quand les marchés du Versus changent
  let nes = []; try { nes = JSON.parse(stock.get(cleStock("evNes")) || "[]"); } catch (e) { nes = []; } if (!Array.isArray(nes)) nes = [];
  let change = false;
  evNaissants().forEach(x => { x.cle = x.folle ? cleFolle(x) : x.k + ":" + x.d; const y = { k: x.k, d: x.d, p: x.p, e: x.e, v: x.v, avant: x.avant, dAvant: x.dAvant, de: x.de, places: x.places, lib: x.lib, sens: x.sens, niv: x.niv, fort: x.fort, folle: x.folle, creux: x.creux, pire: x.pire, an: x.an, vol: x.vol, perso: x.perso };
    const i = nes.findIndex(z => z.k === x.k && z.d === x.d);
    if (i < 0) { nes.push(y); change = true; } else if (JSON.stringify(nes[i]) !== JSON.stringify(Object.assign({}, nes[i], y, { niv: Math.max(nes[i].niv || 0, y.niv || 0) || undefined }))) { nes[i] = Object.assign({}, nes[i], y, { niv: Math.max(nes[i].niv || 0, y.niv || 0) || undefined }); if (nes[i].folle) nes[i].fort = nes[i].niv === 3; change = true; } });   // même séance revue (en direct) : chiffre mis à jour, palier jamais baissé
  /* v20.61 : un événement de marché gardé sur l'appareil est revu à chaque ouverture tant que sa séance est dans les données : chiffre à jour
     (clôture Google ou variation du Versus), et retiré si la séance ne remplit plus la condition (krach né en direct à −3,4 %, séance finie à −2,5 %). */
  [["krach", "S&P 500"], ["crypto", "Bitcoin"], ["sommet", "S&P 500"]].forEach(([k, nom]) => { if (!nes.some(z => z.k === k) || (k === "crypto" && !aDuBitcoin())) return;
    let c, l; try { c = closEv(nom).map(z => z.d); l = evDe(k); } catch (e) { return; } if (!c.length) return;
    nes = nes.filter(z => { if (z.k !== k || !c.includes(z.d)) return true; const y = l.find(w => w.d === z.d);
      if (!y) { change = true; return false; } ["p", "v", "avant", "dAvant"].forEach(f => { if (y[f] !== undefined && z[f] !== y[f]) { z[f] = y[f]; change = true; } }); return true; }); });
  const lim = limEv(); nes = nes.filter(x => x.d >= isoJour(new Date(Date.now() - 400 * 864e5)));
  if (change) stock.set(cleStock("evNes"), JSON.stringify(nes.slice(-60)));
  const parK = {}; nes.filter(x => x.d <= auj && (x.k === "relache" ? x.d === auj : x.d >= lim)).forEach(x => { if (!parK[x.k] || parK[x.k].d < x.d) parK[x.k] = x; });   // un par genre : le plus récent
  const cand = Object.values(parK).map(x => Object.assign({}, x));
  cand.sort((a, b) => EV_PRIO.indexOf(a.k) - EV_PRIO.indexOf(b.k) || (a.d < b.d ? 1 : -1));
  cand.forEach(x => { x.cle = x.folle ? cleFolle(x) : x.k + ":" + x.d; });
  MEMO_EV = { m: M, mk, j: auj, l: cand };
  return cand.map(x => Object.assign({}, x));
}
/** lot 62 c (Théo) : ✕ = masquer (pas supprimer) : l'événement reste dans Vestiaire › Ambiances, où « Oui » le remet, jusqu'à la fin de sa fenêtre */
function evenementsTous() { return evenementsListe(); }
function evenementActif() { return evenementsActifs()[0] || null; }
/** dernier jour de la fenêtre d'un événement (aaaa-mm-jj) */
function finEv(x) { if (x.k === "relache") return x.d; const d = new Date(x.d + "T12:00:00"); d.setDate(d.getDate() + FOLLE_JOURS); return isoJour(d); }
function limEv() { const n = new Date(); return isoJour(new Date(n.getFullYear(), n.getMonth(), n.getDate() - FOLLE_JOURS, 12)); }
/** textes d'un événement : kicker, gros chiffre, ligne du dessous, phrase, carte « pourquoi » */
function textesEv(x) {
  const lib = libJourFolle(x.d), lc = libCourt(x.d), pts = v => v >= 1000 ? F0.format(Math.round(v)) + NB + "pts" : "";
  if (x.k === "krach") return { k: "Krach mondial", big: pct(x.p, 1), sub: "S&P 500 · " + lib, phr: "Le monde entier tousse. Les krachs passent, les plans réguliers restent.", carte: "S&P 500 " + pct(x.p, 1) + " le " + lc };
  if (x.k === "crypto") return { k: "Tempête crypto", big: pct(x.p, 1), sub: "Bitcoin en 24 h · " + lib, phr: x.p < 0 ? "Le Bitcoin plonge. Ta bourse, elle, n'a rien vu." : "Le Bitcoin s'emballe. Garde la tête froide.", carte: "Bitcoin " + pct(x.p, 1) + " le " + lc };
  if (x.k === "sommet") { const e = x.avant > 0 ? x.v / x.avant - 1 : null, p = pts(x.v);
    return { k: "Sommet du S&P 500", big: p || "Record", sub: "Clôture " + (lib === "Aujourd'hui" ? "d'aujourd'hui" : "du " + lc) + (ok(e) ? " · " + pct(e, 1) + " au-dessus du record du " + frDate(x.dAvant).slice(0, 5) : ""), phr: "Jamais aussi haut sur toutes les données connues. Profite de la vue, puis continue de grimper.", carte: (p ? p + " · " : "") + "record battu le " + lc }; }
  const pc = (v, n) => pct(v, n || 1, false);
  if (x.k === "record") return { k: "Record battu", big: "Record", sub: "au-dessus de ton plus haut" + (x.dAvant ? " du " + frDate(x.dAvant).slice(0, 5) : "") + ", après " + pct(x.creux, 1) + " · " + lc, phr: "Tu as tenu pendant la baisse : c'est exactement comme ça qu'on gagne.", carte: "nouveau plus haut après " + pct(x.creux, 1) + " le " + lc };
  if (x.k === "pirebaisse") return { k: "Pire baisse effacée", big: "Effacée", sub: "la baisse de " + pct(x.pire, 1) + " de " + x.an + (x.dAvant ? " (depuis le " + frDate(x.dAvant).slice(0, 5) + ")" : "") + " est rattrapée · " + lc, phr: "Plus aucune trace de la pire baisse de l'année.", carte: "baisse de " + pct(x.pire, 1) + " rattrapée le " + lc };
  if (x.k === "volhaut") return { k: "Volatilité très élevée", big: pc(x.vol, 0), sub: "par an, sur 1 mois · " + (x.perso ? "plus haute que 90 % de ton historique" : "au-dessus de 30 %") + " · " + lc, phr: "Ça secoue plus que d'habitude. Rien à faire de spécial : ton plan est fait pour ça.", carte: "volatilité sur 1 mois " + pc(x.vol, 0) + " le " + lc };
  if (x.k === "volbas") return { k: "Volatilité au plus bas", big: pc(x.vol, 1), sub: "par an, sur 3 mois · " + (x.perso ? "plus basse que 90 % de ton historique" : "sous 8 %") + " · " + lc, phr: "Ton portefeuille n'a presque jamais été aussi tranquille.", carte: "volatilité sur 3 mois " + pc(x.vol, 1) + " le " + lc };
  if (x.k === "plat") return { k: "Calme plat", big: CALME_N + " séances", sub: "sans bouger de plus de 1 % · du " + frDate(x.de).slice(0, 5) + " au " + lc, phr: "Mer d'huile. Les meilleurs placements sont souvent les plus ennuyeux.", carte: CALME_N + " séances sans ±1 %, jusqu'au " + lc };
  if (x.k === "serie") return { k: "Série verte", big: SERIE_N + " séances", sub: "de hausse d'affilée · " + pct(x.p, 1) + " · jusqu'au " + lc, phr: SERIE_N + " jours de soleil d'affilée sur ton portefeuille. Profite, ça ne dure jamais.", carte: SERIE_N + " séances en hausse jusqu'au " + lc };
  if (x.k === "relache") { const pl = x.places.map(p => p === "paris" ? "Paris" : "New York").join(" et ");
    return { k: "Bourse en relâche", big: "Fermée", sub: pl + " · " + x.lib, phr: "Les marchés font la sieste. Toi aussi, si tu veux.", carte: pl + " fermée · " + x.lib }; }
  const feu = x.sens < 0;
  const n = (x.niv || (x.fort ? 3 : 1)) - 1;
  return { k: (feu ? ["Journée folle", "Explosion", "Journée noire"] : ["Journée folle", "Pluie de bonbons", "Bouquet final"])[n], big: pct(x.p, 2), sub: lib, carte: "ton portefeuille " + pct(x.p, 2) + " le " + lc,   // 2 décimales, comme la carte du haut
    phr: (feu ? ["La bourse prend feu. Toi, tu gardes ton plan.", "Ça a sauté fort. Respire : ton plan, lui, tient debout.", "Grosse brûlure. Ceux qui tiennent dix ans ont tous vécu des jours comme celui-ci."]
      : ["Feu d'artifice sur ton portefeuille.", "Il pleut des bonbons sur ton portefeuille. Croque, mais ne change rien.", "Une séance comme on en voit peu. Savoure, et ne change rien."])[n] };
}
/** à l'ouverture de Moi › Aujourd'hui : le grand effet de l'événement en cours, une fois par événement et par appareil */
/** à l'ouverture de Moi › Aujourd'hui : UN seul grand effet (le plus fort des événements pas encore vus) ; les autres nouveaux sont notés « vus »
    sans être joués (pas de cascade) et gardent une pastille « nouveau » dans la carte Événements tant qu'on ne les a pas touchés */
function evListe(k) { try { const l = JSON.parse(stock.get(cleStock(k)) || "[]"); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
function evAjoute(k, cles, max) { const l = evListe(k); cles.forEach(c => { if (!l.includes(c)) l.push(c); }); stock.set(cleStock(k), JSON.stringify(l.slice(-(max || 60)))); }
function folleVue(x) { const pre = x.d + (x.sens > 0 ? "+" : "-"); return evListe("folles").some(k => k.startsWith(pre) && +k.slice(-1) >= (x.niv || 1)); }   // déjà vue (ou plus forte)
function evVu(x) { return x.folle ? folleVue(x) : evListe("evVus").includes(x.cle); }
let evAttente = 0;
function verifierEvenement() {
  if (!M || M.simple || SRC !== "api" || PREF.onglet !== "jour" || !vueMoi() || document.hidden || !identiteSure() || evTousCoupes()) return;
  if (document.querySelector(".m-fete, .m-folle")) { clearTimeout(evAttente); evAttente = setTimeout(verifierEvenement, 1500); return; }   // une fête de palier passe d'abord ; l'effet suit quand elle est fermée (jamais les deux ensemble)
  const L = evenementsActifs(), nv = L.filter(x => !evVu(x)); if (!nv.length) return;
  const x = nv[0];
  nv.forEach(y => { if (y.folle) evAjoute("folles", [cleFolle(y)], 40); else evAjoute("evVus", [y.cle]); });   // tous notés : un seul est joué
  evAjoute("evJoues", [x.cle]);
  const go = () => { lancerFolle(x); rendre(); };   // la carte Événements se met à jour (pastille « nouveau » des autres)
  if (typeof window.ereApres === "function") window.ereApres(go, "folleMoi"); else go();
}
function evMasques() { try { const l = JSON.parse(stock.get(cleStock("evMasques")) || "[]"); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
function evMasque(x) { return evMasques().includes(x.cle); }
/** Vestiaire › Ambiances : un interrupteur général, puis une ligne par événement déjà vécu (grisée hors de sa semaine) */
function derniereEv(k) { try { const l = JSON.parse(stock.get(cleStock("evNes")) || "[]"); const x = (Array.isArray(l) ? l : []).filter(y => y.k === k).sort((a, b) => a.d < b.d ? 1 : -1)[0]; return x ? x.d : null; } catch (e) { return null; } }   // lot 62 d : seulement les événements nés sur cet appareil
function htmlAmbFolles() {
  if (!M || M.simple) return "";
  const L = evenementsTous(), masq = evMasques(), tout = evTousCoupes(), lignes = EV_PRIO.map(k => {
    const x = L.find(y => y.k === k), der = x ? x.d : derniereEv(k); if (!der) return "";   // jamais vécu (ou pas concerné) : pas listé
    const D = EV_DEF[k], actif = !!x && !tout;
    return '<div class="vs-amb-l' + (actif ? "" : " grise") + '"><span class="vs-em">' + (x && actif ? icoEv(x) : D.ic) + "</span><span><b>" + esc(x && actif ? nomEv(x) : D.nom) + "</b><small>" + (actif ? "séance du " + libCourt(x.d) + " · jusqu'au " + libCourt(finEv(x)) + (masq.includes(x.cle) ? " · masqué" : "") : "dernier : " + libCourt(der) + " · " + esc(D.quoi)) + "</small></span>" +
      (actif ? (on => '<span class="chips m-filtre" role="group" aria-label="' + esc("Afficher " + nomEv(x)) + '"><button class="chip" type="button" data-ev-vis="' + esc(x.cle) + '" data-ev-on="1" aria-pressed="' + on + '">Oui</button><button class="chip" type="button" data-ev-vis="' + esc(x.cle) + '" data-ev-on="" aria-pressed="' + !on + '">Non</button></span>')(!masq.includes(x.cle) && !ambCoupee(k)) : '<span class="vs-amb-x">🔒</span>') + "</div>";
  }).join("");
  return lignes ? '<div class="vs-amb"><small>Les événements rares de la semaine : pastille et ambiance sur Aujourd\'hui. « Non » masque un événement, « Oui » le remet.</small>' +
    (reduit ? "<small>Ambiances coupées sur ce téléphone (moins d'animations demandé).</small>" : "") + lignes + "</div>" : "";
}
/** sur Aujourd'hui (lot 62 c, Théo) : une rangée de petites pastilles sous la carte du haut, une par événement en cours (« 💥 Explosion · ven. 20/11 ») ;
    toucher = rejouer l'effet et choisir l'ambiance de fond (une seule à la fois, par défaut la plus forte) ; ✕ = demande de confirmation, puis masque
    (carte et ambiance) : l'événement se remet dans Missions › Vestiaire › Ambiances jusqu'à la fin de sa fenêtre. */
const NB_AMB = 14;
function evChoisi(L) { const c = stock.get(cleStock("evAmb")); return L.find(x => x.cle === c) || L.find(x => !ambCoupee(x.k)) || L[0]; }
function icoEv(y) { return y.k === "feu" && y.niv === 2 ? "💥" : y.k === "joie" && y.niv === 2 ? "🍬" : EV_DEF[y.k].ic; }
function habillerFolle(v) {
  const L = evenementsActifs(), hero = v.querySelector(".m-hero"); if (!L.length || !hero || evTousCoupes()) return;
  const x = evChoisi(L), joues = evListe("evJoues");
  const c = document.createElement("div"); c.className = "m-ev"; c.setAttribute("role", "group"); c.setAttribute("aria-label", "Événements en cours");
  const pastilles = () => L.map(y => { const T = textesEv(y), nv = !joues.includes(y.cle), on = y === x;
    return '<span class="m-ev-p' + (on ? " on" : "") + '" data-ev="' + y.k + '"><button type="button" class="m-ev-b" data-ev-cle="' + esc(y.cle) + '" aria-pressed="' + on + '" title="' + esc("Événement : " + T.carte + ". Toucher pour revoir l'effet") + '" aria-label="' + esc("Événement " + nomEv(y) + " : " + T.carte + (nv ? ", nouveau" : "") + ". Toucher pour revoir l'effet et choisir son ambiance") + '">' +
      (nv ? '<i class="m-ev-nvp" aria-hidden="true"></i>' : "") + '<span aria-hidden="true">' + icoEv(y) + "</span>" + esc(nomEv(y)) + " <small>· " + esc(libCourt(y.d)) + "</small></button>" +
      '<button type="button" class="m-ev-x" data-ev-x="' + esc(y.cle) + '" aria-label="' + esc("Masquer " + nomEv(y)) + '">✕</button></span>'; }).join("");
  const brancher = () => {
    c.querySelectorAll("[data-ev-cle]").forEach(b => b.addEventListener("click", () => { const y = L.find(z => z.cle === b.dataset.evCle); if (!y) return;
      stock.set(cleStock("evAmb"), y.cle); evAjoute("evJoues", [y.cle]); rendre(); lancerFolle(y, true); }));
    c.querySelectorAll("[data-ev-x]").forEach(b => b.addEventListener("click", () => { const y = L.find(z => z.cle === b.dataset.evX); if (!y) return;
      c.classList.add("conf"); c.innerHTML = '<p class="m-ev-q">Masquer l\'événement <b>' + esc(nomEv(y)) + "</b> ? Tu pourras le remettre jusqu'au " + esc(libCourt(finEv(y))) + " dans Missions › Vestiaire › Ambiances.</p>" +
        '<span class="m-ev-a"><button type="button" class="btn acc" data-ev-ok>Masquer</button><button type="button" class="btn ghost" data-ev-non>Annuler</button></span>';
      c.querySelector("[data-ev-ok]").addEventListener("click", () => { evAjoute("evMasques", [y.cle]); rendre(); });
      c.querySelector("[data-ev-non]").addEventListener("click", () => { c.classList.remove("conf"); c.innerHTML = pastilles(); brancher(); });
      c.querySelector("[data-ev-non]").focus(); }));
  };
  c.innerHTML = pastilles(); brancher();
  hero.insertAdjacentElement("afterend", c);
  if (ambCoupee(x.k) || reduit) return;
  hero.classList.add("m-amb-" + x.k);
  const a = document.createElement("div"); a.className = "m-amb " + x.k + (x.fort ? " fort" : ""); a.setAttribute("aria-hidden", "true");
  const COUL = { joie: ["#FF6FA8", "#5EEAD4", "#7FB2FF", "#C4B5FD", "#A3E635"], crypto: ["#F7931A", "#FFB347", "#C4B5FD"], relache: ["#E0E7FF", "#C4B5FD", "#FDE68A"], serie: ["#A3E635", "#5EEAD4", "#7FB2FF"], record: ["#5EEAD4", "#E0F7F3"], pirebaisse: ["#7FB2FF", "#C4B5FD"] }[x.k] || ["#FFB347"];
  const monte = x.k === "feu", tombe = x.k === "krach";
  let h = ""; if (!["sommet", "plat", "volhaut", "volbas"].includes(x.k)) for (let i = 0; i < NB_AMB; i++) { const r = (i * 0.618034) % 1, r2 = (i * 0.414214 + .3) % 1;
    h += '<i style="left:' + (3 + r * 94).toFixed(1) + "%;" + (monte || tombe ? "" : "top:" + (4 + r2 * 80).toFixed(1) + "%;") + "--d:" + (monte ? 7 + r2 * 6 : tombe ? 1.4 + r2 * .8 : 3 + r2 * 3).toFixed(2) + "s;--r:" + (-(r2 * 12)).toFixed(2) + "s;--s:" + (2 + r * 2.5).toFixed(1) + "px;--c:" + COUL[i % COUL.length] + '"></i>'; }
  a.innerHTML = h; v.prepend(a);
}
let LIVEJ = null;   // lot 63 : la variation en direct de la carte « Jour » (pour le dernier point de « Mon portefeuille »)
function htmlJour() {
  const cinq = periodeJ();
  { const s = M.synthese || {}; LIVEJ = !seanceProposee() && ok(s.jourPct) && Math.abs(s.jourPct) > 1e-9 ? s.jourPct : null; }
  CINQ = cinq === "5j" ? joursCinq() : null; VUEJ = cinq || (modeSeance() ? "seance" : "jour");
  if (VUEJ === "jour") return htmlJourBase();
  const m0 = M; M = mSeance(m0, cinq);
  try { return htmlJourBase(); } finally { M = m0; }
}
function htmlJourBase() {
  const s = M.synthese || {};
  const texteFlap = ETAT.discret === "oui" ? "•••" + NB + "€" : eur(s.valeur);
  const animer = !reduit && texteFlap !== dernierFlap; dernierFlap = texteFlap;
  const suffixe = (s.jourLibelle || "").replace(/^Variation du jour\s*·?\s*/, "");
  const toutes = lignesTenues();
  const detail = PREF.vueL === "lignes";   // lot 65 (Conseil) : deux vues du même tableau, « Enveloppes » (par défaut) ou « Lignes » à plat ; plus de case ni de puces de tri
  const hausse = toutes.filter(l => l.pct > 1e-9).length, baisse = toutes.filter(l => l.pct < -1e-9).length;
  /* lot 52 (Théo : « ce n'est pas du tout en fonction de la perte de perf en % » ; mini-Conseil data-viz + investisseur + joueur pressé, unanime) :
     la carte en tuiles (taille = gain en €, v17.62) laisse place à des barres classées du meilleur au pire % de la période. Une ligne par ticker,
     barre centrée sur 0 (à droite = hausse, à gauche = baisse), longueur ∝ |%| : la plus forte variation a toujours la plus longue barre.
     € en petit à droite ; plus de 7 lignes = deux colonnes sans € (jamais plus haut que l'ancienne carte). Mode discret : aucun €, le % reste. */
  const maxP = Math.max(.001, ...toutes.map(l => Math.abs(l.pct || 0)));
  const gainL = l => ok(l.jour) ? l.jour : ok(l.pct) && l.pct > -1 ? (l.valeur || 0) * l.pct / (1 + l.pct) : 0;
  const bouge = toutes.some(l => Math.abs(l.pct || 0) > 1e-9), deuxC = toutes.length > 7, sansEur = deuxC || ETAT.discret === "oui";
  const triees = toutes.slice().sort((a, b) => (b.pct || 0) - (a.pct || 0) || (b.valeur || 0) - (a.valeur || 0));
  const barreL = l => { const p = l.pct || 0, w = Math.abs(p) > 1e-9 ? Math.max(2, Math.abs(p) / maxP * 50) : 0, g = gainL(l);
    return '<button type="button" class="m-barre" data-aller-ligne="' + esc(l.env + "|" + l.code) + '" title="' + esc((l.nom || l.code) + " · " + pct(l.pct, 2)) + '">' +
      "<b>" + esc(l.code) + '</b><span class="m-b-t">' + (w ? '<i class="m-b-f ' + sens(p) + '" style="width:' + w.toFixed(1) + "%;" + (p > 0 ? "left" : "right") + ':50%"></i>' : "") + "</span>" +
      '<span class="m-b-p ' + sens(p) + '">' + pct(l.pct, 2) + "</span>" + (sansEur ? "" : "<small>" + (ok(g) && Math.abs(g) >= .5 ? eur(g, 0, true) : "") + "</small>") + "</button>"; };
  const barres = '<div class="m-barres' + (deuxC ? " deux" : "") + (sansEur ? " sans-eur" : "") + '" style="--nr:' + (deuxC ? Math.ceil(triees.length / 2) : triees.length) + '" role="group" aria-label="Une barre par ligne, de la meilleure à la pire variation en %">' + triees.map(barreL).join("") + "</div>";
  const liste = htmlEnveloppes(s, detail);   // lot 64-65 : le tableau, par enveloppe ou toutes les lignes à plat (tri en touchant l'en-tête)
  const indices = (M.indices || []).filter(i => i.nom !== "1 USD en EUR");
  const nomIdx = n => n.replace(/\s*\((ETF\s)?([^)]*)\)/, "");
  const v5 = !!PERIODES_J[VUEJ], per = !!seanceDu(), det5 = VUEJ === "5j" && !!CINQ, bf = bourseFermee();
  /* v20.37 (Théo, 24/11) : fichier avec un historique mais aucune ligne de bourse encore saisie (nouveau joueur, Kévin avant sa photo de départ) :
     pas de gros « 0 € » inquiétant, un encadré qui explique. */
  const attente = enAttenteLignes();
  const ATT = '<div class="m-hero"><div class="m-hero-t"><span class="eyebrow">' + embHero() + "Bourse</span></div>" +
    '<div class="m-attente" role="status"><b>⏳ Tes lignes arrivent bientôt.</b><span>Ta bourse s\'affichera ici, au cours du jour, dès que tes lignes (PEA, assurance-vie…) seront saisies dans ton fichier. En attendant, tes statistiques et ton « Mois par mois » viennent de tes relevés du Versus.</span></div></div>';
  return (attente ? ATT : '<div class="m-hero">' +
      '<div class="m-hero-t"><span class="eyebrow">' + embHero() + (v5 ? "Bourse · " + PERIODES_J[VUEJ][2] : bf.ferme ? '<span title="Les chiffres sont ceux de la dernière séance">🔒 Bourse fermée' + (bf.lib ? " · " + esc(bf.lib) : "") + "</span>" : 'Bourse aujourd\'hui' + (!majCourte() && heureCours() ? " · " + esc(heureCours()) : "")) + "</span>" +
      /* v17.75 (Théo) : « Bourse fermée » passe dans la ligne du titre (plus de badge à part, −30 px) */
      /* Théo, 19/11 : pastille Jour | 5 j ; v17.23 : rangée de 6 périodes sous le titre (un toucher bascule, le choix reste sur l'appareil) */
      /* lot 62 (Théo, Conseil) : la rangée des périodes descend au pouce (barre flottante, comme Classement et Mois) ; la carte garde le rappel
         de la période dans son titre (« Bourse · 1 mois ») et l'icône 📈 passe à droite du titre */
      '<button type="button" class="m-vsmk" id="m-vsmk" aria-label="Face aux marchés : comparer les courbes" title="Face aux marchés : comparer les courbes"><span aria-hidden="true">📈 ›</span></button></div>' +   // lot 58 : l'ancien bouton large devient une icône (même effet : défiler jusqu'aux Marchés)
      '<div class="m-flaps" role="img" aria-label="' + esc(texteFlap) + '">' + flaps(texteFlap, animer) + "</div>" +
      '<div class="m-jour"' + (det5 ? ' role="button" tabindex="0" aria-expanded="' + cinqOuvert + '" title="Jour par jour"' : "") + '><span class="badge big-b ' + sens(s.jour) + '">' + fleche(s.jour) + " " + eur(s.jour, 0, true) + " · " + pct(s.jourPct, 2) + "</span>" +
        "<span>" + (suffixe ? esc(suffixe) : hausse + " en hausse · " + baisse + " en baisse") + (det5 ? ' <i class="m-5j-v" aria-hidden="true">' + (cinqOuvert ? "▴" : "▾") + "</i>" : "") + "</span>" + (majCourte() ? '<small class="m-maj">' + esc(majCourte()) + "</small>" : "") + (s.jourNote ? '<small class="m-per-n">' + esc(s.jourNote) + "</small>" : "") + "</div>" +
      (det5 ? htmlCinq() : "") +
    "</div>") +
    (attente ? "" : bandeDebut(s)) +
    (toutes.length >= 3 ? barres + '<p class="m-carte-l">' + (!bouge ? "Rien n'a encore bougé." + (!v5 && bf.ferme ? " Bourse fermée" + (bf.lib ? " (séance du " + esc(bf.lib) + ")" : "") + "." : "") : "Du meilleur au pire, en %" + (v5 ? " sur la période" : bf.ferme ? " sur la séance du " + esc(bf.lib) + " (bourse fermée)" : " aujourd'hui") + ".") + "</p>" : "") +   // lot 27 : sous 3 lignes, la carte n'apprend rien
    blocSignal() +
    "<div>" +
      '<div class="m-tri"><h2 class="sec">' + (detail ? "Mes lignes" : "Mes enveloppes") + "</h2>" +
        '<div class="f-seg m-vue-l" role="group" aria-label="Afficher">' + [["env", "Par enveloppe"], ["lignes", "Toutes les lignes"]].map(([k, l]) => '<button type="button" data-m-vue="' + k + '" aria-pressed="' + ((detail ? "lignes" : "env") === k) + '">' + l + "</button>").join("") + "</div></div>" +
      liste +
      '<p class="info nv-info">' + (detail ? "Touche un titre de colonne pour classer, une ligne pour son détail." : "Touche une enveloppe pour voir ses lignes.") + "</p>" +
    "</div>" +
    (per ? '<div class="f-seg f-per m-per-flot" role="group" aria-label="Période : la carte du haut, tes lignes et les Marchés">' + boutonsPer(v5, "") + "</div>" : "") +
    (marchesMoi() ? htmlMarches() : indices.length ? '<div><h2 class="sec">Marchés <small>variation du jour</small></h2><div class="m-idx">' + indices.map(i => '<div><span>' + esc(nomIdx(i.nom)) + '</span><b class="' + sens(i.pct) + '">' + pct(i.pct, 2) + "</b></div>").join("") + "</div></div>" : "") +
    "";
}
/** boutons de période (Jour · 5 j · 1 M · 6 M · Janv. · 1 an) ; bas = la rangée au-dessus des Marchés (lot 50), même réglage que la carte Bourse */
function boutonsPer(v5, bas) {
  return [["jour", "Jour"]].concat(Object.keys(PERIODES_J).map(k => [k, PERIODES_J[k][1]])).map(([k, l]) => '<button type="button"' + (bas ? ' class="chip" data-per-b="1"' : "") + ' data-per="' + k + '" aria-pressed="' + ((v5 ? VUEJ : "jour") === k) + '">' + l + "</button>").join("");
}
const ENV_OUV = new Set();   // lot 64 : enveloppes dépliées pendant la visite (toutes repliées à chaque réouverture de l'appli)
/** lot 64 (B, Théo) : un seul bloc en tableau : Enveloppe (valeur, poids en mini-jauge, ses actifs en étiquettes) | période choisie | plus-value latente ;
    rangée Portefeuille en pied + répartition ; toucher une rangée = ses lignes dessous, mêmes colonnes.
    lot 65 (Conseil) : plat = « Lignes » : toutes les lignes dans le même tableau (étiquette d'enveloppe), classées en touchant l'en-tête
    (Montant, période, plus-value ; un 2e toucher inverse le sens) ; les espèces restent en bas */
function htmlEnveloppes(s, plat) {
  const gs = M.groupes || [], lib = PERIODES_J[VUEJ] ? PERIODES_J[VUEJ][1] : VUEJ === "seance" ? "Séance" : "Jour";
  const somme = gs.reduce((a, g) => a + Math.max(0, (g.total || {}).valeur || 0), 0) || 1, ce = gi => "--ce:var(--e" + (gi % 5 + 1) + ")";
  const col = (e, p, dec, plus) => '<span class="nv-c"><b class="' + sens(p) + '">' + pct(p, dec) + '</b><small class="' + sens(e) + '">' + eur(e, 0, true) + "</small>" + (plus || "") + "</span>";
  const pru = l => ok(l.pru) ? '<small class="nv-pru"><i>PRU</i> ' + cours(l.pru).replace(/\s?€$/, "") + "</small>" : "";
  const tag = (g, gi) => plat ? '<span class="nv-e" style="' + ce(gi) + '">' + esc(String(g.env).split(" ")[0]) + "</span>" : "";
  const ligne = (g, l, gi) => l.especes
    ? '<div class="m-l nv-li especes"' + (plat ? ' style="' + ce(gi) + '"' : "") + '><span class="nv-ln"><b>Espèces' + tag(g, gi) + '</b><span class="nv-v">' + eur(l.valeur) + "</span></span><span></span><span></span><span></span></div>"
    : '<div class="m-l nv-li" role="button" tabindex="0" aria-expanded="false" data-code="' + esc(l.code) + '" data-env="' + esc(g.env) + '" title="' + esc(l.nom || l.code) + '"' + (plat ? ' style="' + ce(gi) + '"' : "") + ">" +
      '<span class="nv-ln"><b>' + esc(l.code) + tag(g, gi) + (l.nom ? "<small>" + esc(l.nom) + "</small>" : "") + '</b><span class="nv-v">' + eur(l.valeur) + "</span>" +
      (ok(l.cours) ? '<span class="nv-cr"><i>cours</i> ' + cours(l.cours) + "</span>" : "") + pastilleVol(volLigne(g.env, l.code)) + "</span>" +
      col(l.jour, l.pct, 2) + col(l.pv, l.pvPct, 1, pru(l)) + '<span class="nv-ch" aria-hidden="true">›</span></div>';
  const actifs = g => { const c = g.lignes.filter(l => !l.especes && l.code).sort((a, b) => (b.valeur || 0) - (a.valeur || 0)), n = 4;
    return c.length ? '<span class="nv-a">' + c.slice(0, n).map(l => "<span>" + esc(l.code) + "</span>").join("") + (c.length > n ? '<span class="plus">+' + (c.length - n) + "</span>" : "") + "</span>" : ""; };
  let corps, tete;
  if (plat) {
    const tri = ["poids", "jour", "pv"].includes(PREF.tri) ? PREF.tri : "poids", inv = PREF.triInv === true;
    const cle = { poids: l => l.valeur || 0, jour: l => l.pct || 0, pv: l => l.pvPct || 0 }[tri];
    const toutes = [], esp = [];
    gs.forEach((g, gi) => g.lignes.forEach(l => { if (l.especes) { if (Math.abs(l.valeur || 0) >= 0.5) esp.push([g, l, gi]); } else toutes.push([g, l, gi]); }));
    toutes.sort((a, b) => (inv ? 1 : -1) * (cle(a[1]) - cle(b[1])));
    corps = '<div class="nv-l nv-plat">' + toutes.concat(esp).map(x => ligne(x[0], x[1], x[2])).join("") + "</div>";
    const bt = (k, l) => '<button type="button" data-m-tri="' + k + '" aria-pressed="' + (tri === k) + '">' + l + (tri === k ? (inv ? " ▴" : " ▾") : "") + "</button>";
    tete = '<div class="nv-tete nv-g nv-triable" role="group" aria-label="Classer les lignes">' + bt("poids", "Montant") + bt("jour", esc(lib)) + bt("pv", "Plus-value") + "<span></span></div>";
  } else {
    corps = gs.map((g, gi) => {
      const t = g.total || {}, ouv = ENV_OUV.has(g.env), w = Math.max(0, t.valeur || 0) / somme;
      return '<div class="m-enve' + (ouv ? " ouvert" : "") + '" style="' + ce(gi) + '" data-env-nom="' + esc(g.env) + '">' +
        '<button type="button" class="nv-h" aria-expanded="' + ouv + '"><span class="nv-n"><b>' + esc(g.env) + '</b><span class="nv-v">' + eur(t.valeur) + "</span>" +
        '<span class="nv-j" aria-hidden="true"><i style="width:' + (w * 100).toFixed(1) + '%"></i></span><em>' + pct(w, 0, false) + "</em></span>" +
        col(t.jour, t.pct, 2) + col(t.pv, t.pvPct, 1) + '<span class="nv-ch" aria-hidden="true">▾</span>' + actifs(g) + "</button>" +
        '<div class="nv-l"' + (ouv ? "" : " hidden") + ">" + g.lignes.filter(l => !l.especes || Math.abs(l.valeur || 0) >= 0.5).map(l => ligne(g, l, gi)).join("") + "</div></div>";
    }).join("");
    tete = '<div class="nv-tete nv-g"><span>Enveloppe</span><span>' + esc(lib) + "</span><span>Plus-value</span><span></span></div>";
  }
  const vp = volPortefeuille();
  const rep = gs.map((g, gi) => '<i style="' + ce(gi) + ";flex-grow:" + Math.max(0, (g.total || {}).valeur || 0).toFixed(0) + '" title="' + esc(g.env) + '"></i>').join("");
  return '<div class="m-envs' + (plat ? " plat" : "") + '">' + tete + corps +
    '<div class="nv-tot nv-g"><span class="nv-n"><b>Portefeuille</b><span class="nv-v">' + eur(s.valeur) + "</span>" + pastilleVol(vp) + "</span>" + col(s.jour, s.jourPct, 2) + col(s.latente, s.latentePct, 1) + "<span></span>" +
    (gs.length > 1 ? '<span class="nv-rep" role="img" aria-label="Répartition par enveloppe">' + rep + "</span>" : "") + "</div>" +
    (vp || gs.some(g => g.lignes.some(l => !l.especes && volLigne(g.env, l.code))) ? '<p class="nv-vo-aide">' + aideVol(vp, /\*<\/span>/.test(corps)) + "</p>" : "") + "</div>";
}
function estOuverte(el) { return el.classList.contains("ouvert"); }
function basculerEnv(el) {
  const ouv = !el.classList.contains("ouvert");
  el.classList.toggle("ouvert", ouv); el.querySelector(".nv-l").hidden = !ouv; el.querySelector(".nv-h").setAttribute("aria-expanded", String(ouv));
  if (ouv) ENV_OUV.add(el.dataset.envNom); else ENV_OUV.delete(el.dataset.envNom);
}
/* « cours du 16/11 à 17 h 35 » (point 10 : heure de mise à jour en petit) */
function majCourte() {
  const t = String(M.majTexte || ""), d = t.match(/(\d{1,2})\/(\d{1,2})/), h = t.match(/(\d{1,2})[:h]\s?(\d{2})/);
  if (!h) return "";
  return "cours " + (d ? "du " + d[1].padStart(2, "0") + "/" + d[2].padStart(2, "0") + " " : "") + "à " + h[1] + " h " + h[2];
}
function heureCours() { return String(M.majTexte || "").replace(/^Cours du /, "").replace(/\s*\(.*\)$/, "").replace(/^.* à /, ""); }
/* « Depuis le début » : bande compacte sous le chiffre du jour, définition au toucher */
const DEFS = {
  gain: "Résultat total : valeur actuelle moins apports nets, ce que tes placements t'ont rapporté ou coûté, frais et ventes compris.",
  latente: "Latente : gain ou perte sur ce que tu n'as pas encore vendu.",
  mwr: "MWR : ton rendement réel, en tenant compte du moment où tu as versé ton argent.",
  twr: "TWR : la performance de tes placements, sans l'effet de tes versements : c'est elle qu'on compare au S&P 500."
};
function bandeDebut(s) {
  const c = (k, lab, val, cls, sub) => '<button type="button" data-def="' + k + '"><span class="lab">' + lab + '</span><b class="' + cls + '">' + val + "</b><small>" + sub + "</small></button>";
  return '<div class="m-debut-w"><span class="eyebrow">Depuis le début</span><div class="m-debut">' +
    c("gain", "Résultat", eur(s.gain, 0, true), sens(s.gain), pct(s.gainPct)) +
    c("latente", 'Latente<i class="qm" aria-hidden="true">?</i>', eur(s.latente, 0, true), sens(s.latente), pct(s.latentePct)) +
    c("mwr", 'MWR<i class="qm" aria-hidden="true">?</i>', pct(s.mwr), sens(s.mwr), "timing " + esc(s.timing || "—")) +
    c("twr", 'TWR<i class="qm" aria-hidden="true">?</i>', pct(s.twr), sens(s.twr), "S&amp;P " + pct(s.sp500)) +
    '</div><p class="m-def-l" hidden></p></div>';
}
function basculerLigne(el) {
  const ouvert = el.querySelector(".m-ligne-det");
  if (ouvert) { ouvert.remove(); el.setAttribute("aria-expanded", "false"); return; }
  const env = el.dataset.env, code = el.dataset.code;
  const p = (M.perfLignes || {})[env + "|" + code] || {};
  const pos = (((M.ref || {}).detenu) || []).find(d => d.env === env && d.code === code) || {};
  const l = lignesTenues().find(x => x.env === env && x.code === code) || {};
  const m = (lab, v) => "<div><span>" + lab + '</span><b class="' + sens(v) + '">' + pct(v) + "</b></div>";
  const e = (lab, v, sig) => "<div><span>" + lab + '</span><b class="' + (sig ? sens(v) : "") + '">' + (ok(v) ? eur(v, 2, sig) : "—") + "</b></div>";
  const vo = volLigne(env, code), fv = vo && feuVol(vo.v);   // 25/11/2026 (Théo) : volatilité de la ligne
  const voTxt = !vo ? "Volatilité : pas assez de cours pour la calculer." : "Volatilité " + (vo.an ? "sur 1 an" : "depuis le " + frDate(isoN(vo.deb)) + " (moins d'un an de cours)") + " : " + fv.m + ", " +
    (vo.src === "marche" ? "estimée d'après le marché « " + esc(vo.nom) + " » (pas encore de cours de la ligne)." : "d'après " + F0.format(vo.n) + " séances du cours de " + esc(vo.ticker) + ".") +
    " 🟢 moins de 15 % · 🟠 15 à 30 % · 🔴 plus de 30 %.";
  const d = document.createElement("div");
  d.className = "m-ligne-det";
  d.innerHTML = '<div class="mini">' + m("1 semaine", p.s1) + m("1 mois", p.m1) + m("6 mois", p.m6) + m("YTD", p.ytd) + m("1 an", p.a1) +
    "<div><span>Cours</span><b>" + cours(l.cours) + "</b></div><div><span>Poids</span><b>" + pct(l.poids, 1, false) + "</b></div>" +
    "<div><span>Volatilité" + (vo && !vo.an ? "*" : " 1 an") + "</span><b>" + (vo ? fv.e + " " + (vo.src === "marche" ? "≈" : "") + pct(vo.v, 1, false) : "—") + "</b></div>" +
    "<div><span>Quantité × PRU</span><b>" + qte(l.qte) + " × " + cours(l.pru) + "</b></div>" + e("Plus-value", l.pv, true) +
    e("Coût de revient", pos.cout) + e("Plus-value réalisée", pos.pvr, true) + e("Frais payés", pos.frais) +
    '<p style="grid-column:1/-1;margin:0;font-size:12px;color:var(--ink-2)">' + (p.ticker ? "Performance du cours (" + esc(p.ticker) + "), indépendante de tes dates d'achat." : "Pas de cotation Google Finance pour cette ligne : performances du cours indisponibles.") + " " + voTxt + "</p>" +
    '<p class="m-actions"><button class="mini-btn" type="button" data-ordre="Achat">Acheter</button><button class="mini-btn" type="button" data-ordre="Vente">Vendre</button><button class="mini-btn" type="button" data-alerte="1">Alerte de cours</button></p></div>';
  el.appendChild(d);
  d.querySelectorAll("[data-ordre]").forEach(b => b.addEventListener("click", ev => { ev.stopPropagation(); ouvrirSaisieM({ type: b.dataset.ordre, env: env, actif: code }); }));
  d.querySelector("[data-alerte]").addEventListener("click", ev => {
    ev.stopPropagation();
    const c = (refData().cours || {})[code];
    alertePre = { code: code, seuil: c ? saisieNombre(c, c < 10 ? 2 : 0) : "" };
    reglageOuvert = null; ouvrirSaisieM(null, "maj");
    setTimeout(() => { const el2 = document.querySelector('#m-pane-maj [data-reg="alertes"]'); if (el2) el2.scrollIntoView({ block: "start" }); }, 40);
  });
  el.setAttribute("aria-expanded", "true");
}
function alertesDeclenchees() {
  const r = M.ref || {}, out = [];
  (M.alertes || []).forEach(a => {
    let c = (r.cours || {})[a.code];
    (M.groupes || []).forEach(g => g.lignes.forEach(l => { if (l.code === a.code && l.cours) c = l.cours; }));
    if (c && (a.sens === "sous" ? c < a.seuil : c > a.seuil)) out.push(a.code + (a.sens === "sous" ? " est passé sous " : " a dépassé ") + cours(a.seuil) + " (cours " + cours(c) + ")");
  });
  return out;
}
function brancherJour(v) {
  brancherDefs(v); brancherSignal(v); brancherMarches(v);
  { const vm = v.querySelector("#m-vsmk"); if (vm) vm.addEventListener("click", () => { const mk = v.querySelector(".m-mk"); if (!mk) return;   // lot 61 (Théo) : défile jusqu'aux Marchés ET ouvre « Comparer »
    if (marcheOuvert !== "cmp" && marchesMoi()) { marcheOuvert = "cmp"; const pn = mk.querySelector("#m-mk-panneau"); if (pn) pn.innerHTML = panneauMarche(); majPastillesMk(mk); }
    mk.scrollIntoView({ behavior: "smooth", block: "start" }); }); }
  v.querySelectorAll(".m-per-flot [data-per]").forEach(b => b.addEventListener("click", () => { const k = b.dataset.per; PREF.varP = k === "jour" ? null : k; delete PREF.var5; delete PREF.seance; garderPref(); garderPlace(b, rendre); }));   // lot 62 : une seule barre (flottante, en bas) ; la page ne saute pas   // lot 50 : rangée du bas = même réglage, la page ne saute pas   // 19/11 : Jour ⇄ 5 séances
  const b5 = v.querySelector('.m-jour[role="button"]'); if (b5) { const bascule = () => { cinqOuvert = !cinqOuvert; rendre(); };
    b5.addEventListener("click", bascule); b5.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); bascule(); } }); }
  v.querySelectorAll(".m-l[data-code]").forEach(el => {
    el.addEventListener("click", e => { if (!e.target.closest(".m-ligne-det")) basculerLigne(el); });
    el.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target === el) { e.preventDefault(); basculerLigne(el); } });
  });
  v.querySelectorAll("[data-aller-ligne]").forEach(b => b.addEventListener("click", () => {
    const [env, code] = b.dataset.allerLigne.split("|");
    const el = Array.from(v.querySelectorAll(".m-l[data-code]")).find(x => x.dataset.env === env && x.dataset.code === code);
    if (!el) return;
    { const ce = el.closest("[data-env-nom]"); if (ce && !estOuverte(ce)) basculerEnv(ce); }   // lot 64 : la ligne est dans une enveloppe repliée
    if (!el.querySelector(".m-ligne-det")) basculerLigne(el);
    el.scrollIntoView({ block: "center", behavior: reduit ? "auto" : "smooth" });
    el.classList.add("eclair"); setTimeout(() => el.classList.remove("eclair"), 1200);
  }));
  v.querySelectorAll("[data-m-tri]").forEach(b => b.addEventListener("click", () => { const k = b.dataset.mTri; PREF.triInv = PREF.tri === k ? !PREF.triInv : false; PREF.tri = k; garderPref(); garderPlace(b, rendre); }));   // lot 65 : en-tête de colonne ; 2e toucher = sens inverse
  v.querySelectorAll(".nv-h").forEach(b => b.addEventListener("click", () => basculerEnv(b.closest("[data-env-nom]"))));   // lot 64
  v.querySelectorAll("[data-m-vue]").forEach(b => b.addEventListener("click", () => { PREF.vueL = b.dataset.mVue === "lignes" ? "lignes" : "env"; garderPref(); garderPlace(b, rendre); }));   // lot 65 : Enveloppes | Lignes (filtre mémorisé)
  const def = v.querySelector(".m-def-l");
  v.querySelectorAll("[data-def]").forEach(b => b.addEventListener("click", () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    v.querySelectorAll("[data-def]").forEach(x => x.setAttribute("aria-pressed", "false"));
    b.setAttribute("aria-pressed", String(on)); def.hidden = !on; def.textContent = on ? DEFS[b.dataset.def] : "";
  }));
}

/* ================= Onglet Patrimoine ================= */
function htmlPatrimoine() {
  const s = M.synthese || {}, imm = M.immo || [], ep = M.epargne || [], sup = M.supports || [], fis = M.fiscalite || [];
  const net = patrimoineNet();
  const immoNet = (imm.find(x => /^Valeur nette/.test(x.nom)) || {}).montant || 0;
  const parts = [["Épargne", s.epargne || 0, "--s2", "p-epargne"]].concat(net.avecImmo ? [["Immobilier net", immoNet, "--s3", "p-immo"]] : []).concat([["Bourse", s.valeur || 0, "--s1", "p-bourse"]]);
  /* I (v16.93) : seules les parts positives vont dans la barre et les % ; un immobilier net négatif s'affiche à part (« dette nette ») */
  const posit = parts.filter(p => p[1] > 0), dette = net.avecImmo && immoNet < 0;
  const tot = posit.reduce((a, p) => a + p[1], 0) || 1;
  const envs = (M.enveloppes || []).filter(e => e.type === "env");
  const liste = (rows, f) => '<div class="m-liste">' + rows.map(f).join("") + "</div>";
  const rEnv = e => '<div class="r"><span class="a">' + esc(e.nom) + '</span><span class="b">' + eur(e.valeur) + "</span>" +
    '<span class="c">Résultat ' + pct(e.gainPct) + " · TWR " + pct(e.twr) + '</span><span class="d ' + sens(e.gain) + '">' + eur(e.gain, 0, true) + "</span></div>";
  const PV = pvLivrets(ep);
  const rEp = r => { const t = /^Total/.test(r.nom), pv = PV.par.get(r);
    if (pv) return rLivret(r, pv);   // lot 46 (Théo) : un livret = sa plus-value attendue au 31/12 en gros, le solde en petit
    return '<div class="r' + (t ? " total" : "") + '"><span class="a">' + esc(r.nom) + '</span><span class="b">' + eur(r.solde) + "</span>" +
      (M.simple ? '<span class="c">' + (t ? "tous tes comptes" : esc(r.type || "") + " · saisi le " + frDate(r.date)) + '</span><span class="d"></span></div>'
      : '<span class="c">' + (t ? "Intérêts acquis " + eur(r.acquis) : "Taux moyen " + pct(r.taux, 2, false) + (r.fiscal && r.fiscal !== "—" ? " · fiscalité allégée le " + esc(r.fiscal) : "")) + "</span>" +
      '<span class="d">fin d\'année ≈ ' + eur(r.fin31) + "</span></div>"); };
  const rSup = r => { const t = /^Total/.test(r.nom);
    return '<div class="r' + (t ? " total" : "") + '"><span class="a">' + esc(r.nom) + '</span><span class="b">' + eur(r.valeur) + "</span>" +
      '<span class="c">' + (r.note ? esc(r.note) : "Investi " + eur(r.investi)) + '</span><span class="d ' + sens(r.pv) + '">' + eur(r.pv, 2, true) + " · " + pct(r.pvPct, 2) + "</span></div>"; };
  const rImm = r => { const t = /^Patrimoine net/.test(r.nom);
    return '<div class="r' + (t ? " total" : "") + '"><span class="a">' + esc(r.nom) + '</span><span class="b">' + eur(r.montant) + "</span>" +
      (r.note ? '<span class="c" style="grid-column:1/-1">' + esc(r.note) + "</span>" : "") + "</div>"; };
  const rFis = r => { const t = r.nom === "Portefeuille";
    return '<div class="r' + (t ? " total" : "") + '"><span class="a">' + esc(r.nom) + '</span><span class="b ' + sens(r.gainNet) + '">' + eur(r.gainNet, 0, true) + "</span>" +
      '<span class="c">' + (r.fiscal && r.fiscal !== "—" ? "Fiscalité allégée le " + esc(r.fiscal) : t ? "Après impôt estimé" : "Pas d'avantage fiscal de durée") + '</span><span class="d">impôt ≈ ' + eur(r.impot) + "</span></div>"; };
  const bloc = (id, c, titre, sous, contenu) => '<section class="m-bloc" id="' + id + '" style="--c:var(' + c + ')"><h2 class="sec">' + titre + " <small>" + sous + "</small></h2>" + contenu + "</section>";
  return '<div class="hero"><span class="eyebrow">' + (net.avecImmo ? "Patrimoine net (avec immobilier)" : "Patrimoine financier") + '</span><span class="m-big">' + eur(net.montant) + '</span><div class="sous">' + esc(net.note || "") + "</div></div>" +
    '<div><div class="stack" role="img" aria-label="Répartition du patrimoine">' + posit.map(p => '<i style="flex:' + p[1] + ";background:var(" + p[2] + ')"></i>').join("") + "</div>" +
      '<div class="m-leg3">' + parts.filter(p => p[1] > 0 || !(dette && p[3] === "p-immo")).map(p => '<button type="button" data-cible="' + p[3] + '"><i style="background:var(' + p[2] + ')"></i><span>' + p[0] + '</span><span class="num">' + eur(p[1]) + '</span><span class="pc">' + (p[1] >= 0 ? pct(p[1] / tot, 0, false) : "") + "</span></button>").join("") +
        (dette ? '<button type="button" class="m-dette" data-cible="p-immo"><i></i><span>Immobilier : dette nette</span><span class="num down">' + eur(immoNet) + '</span><span class="pc"></span></button>' : "") + "</div></div>" +
    /* lot 27 (Conseil) : sous le total, le patrimoine dans le temps (financier par défaut) puis l'unique Projection 2034, repliée */
    /* v17.38 (Théo) : l'assurance-vie mise en avant juste sous le total ; le patrimoine dans le temps et la projection, repliés, viennent après */
    (sup.length ? bloc("p-av", "--c-av", envQuintessa() ? "AV Quintessa" : "Assurance vie", "par support", htmlAV(sup)) : "") +
    blocPatrimoineTemps() + htmlProjection() +
    bloc("p-epargne", "--s2", "Épargne", esc(s.epargneLibelle || ""), totalInterets(PV) + liste(ep, rEp) + blocEpargneTemps()) +
    (net.avecImmo ? bloc("p-immo", "--s3", "Immobilier", "prix d'achat, prêts restants", pretHtml() + liste(imm, rImm) + blocPret()) : "") +
    bloc("p-bourse", "--s1", "Bourse", "portefeuille", liste(envs, rEnv)) +   // v17.21 (Théo) : la bourse en dernier (elle a déjà sa place dans Aujourd'hui)
    (fis.length ? acc("m-fis", "Si tout était retiré", "résultat net d'impôt estimé", liste(fis, rFis), false) : "") +
    htmlComparateur();   // v16.95 : où mettre le prochain euro
}
/* lot 46 (Théo, 20/11) : « pour les livrets, afficher la plus-value à la fin de l'année, c'est plus parlant ».
   Intérêts attendus au 31/12 de l'année en cours, livret par livret :
   - profil complet : « Intérêts prévus au 31/12 » du fichier (règle des quinzaines, taux de l'année) ;
   - profil simple : règle des quinzaines refaite ici à partir des soldes saisis (le taux du fichier, sinon le taux habituel du livret) ;
     les quinzaines à venir gardent le solde d'aujourd'hui, et avant la première saisie le compte est supposé à son premier solde : « environ » ;
   - à défaut : solde × taux, « environ ». Seuls les livrets sont concernés (l'assurance-vie garde son montant). */
function estLivret(r) { return !/^Total/.test(r.nom || "") && (!!genreLivret(r) || /livret/i.test((r.nom || "") + " " + (r.type || ""))); }
function quinzainesSimple(r, taux) {
  const L = (M.soldes || []).filter(x => x[1] === r.nom).sort((a, b) => String(a[0]).localeCompare(String(b[0]))); if (!L.length) return null;
  const an = new Date().getFullYear(), auj = isoJour(new Date());
  const soldeA = iso => { let v = null; L.forEach(x => { if (x[0] <= iso) v = x[2]; }); return v === null ? L[0][2] : v; };   // avant la 1re saisie : le premier solde connu
  let tot = 0;
  for (let k = 0; k < 24; k++) {
    const mo = Math.floor(k / 2), d1 = isoJour(new Date(an, mo, k % 2 ? 16 : 1)), d2 = isoJour(k % 2 ? new Date(an, mo + 1, 0) : new Date(an, mo, 15));
    let base;
    if (d1 > auj) base = r.solde;   // à venir : le solde d'aujourd'hui
    else {   // passé ou en cours : le solde au début de la quinzaine, moins un retrait fait pendant (il compte dès la quinzaine où il a lieu)
      base = soldeA(isoJour(new Date(an, mo, k % 2 ? 15 : 0)));
      L.forEach(x => { if (x[0] >= d1 && x[0] <= d2 && x[0] <= auj) base = Math.min(base, x[2]); });
    }
    tot += Math.max(0, base || 0) * taux / 24;
  }
  return tot;
}
function pvLivrets(ep) {
  const par = new Map(); let tot = 0, acquis = 0, environ = false, avecAcquis = true;
  (ep || []).filter(estLivret).forEach(r => {
    const t = tauxLivret(r); let v = null, env = false;
    if (!M.simple && ok(r.prevus)) v = r.prevus;
    else if (M.simple && (M.soldes || []).length) { v = quinzainesSimple(r, t.r); env = true; }
    if (!ok(v) && ok(r.solde)) { v = r.solde * t.r; env = true; }
    if (!ok(v)) return;
    par.set(r, { v, env, taux: t, acquis: ok(r.acquis) ? r.acquis : null });
    tot += v; environ = environ || env;
    if (ok(r.acquis)) acquis += r.acquis; else avecAcquis = false;
  });
  return { par, tot, acquis: avecAcquis && par.size ? acquis : null, environ };
}
function rLivret(r, pv) {
  const fin = new Date().getFullYear();
  return '<div class="r m-liv"><span class="a">' + esc(r.nom) + '</span><span class="b ' + sens(pv.v) + '">' + (pv.env ? "≈ " : "") + eur(pv.v, 0, true) + '<small> au 31/12</small></span>' +
    '<span class="c">Solde ' + eur(r.solde) + " · taux " + pct(pv.taux.r, 2, false) + (pv.taux.repli ? " (habituel)" : "") + (M.simple && r.date ? " · saisi le " + frDate(r.date) : "") + "</span>" +
    '<span class="d">' + (ok(pv.acquis) ? "déjà acquis " + eur(pv.acquis, 0, true) : pv.env ? "environ" : "") + "</span></div>";
}
function totalInterets(PV) {
  if (!PV.par.size) return "";
  return '<div class="m-int31"><span class="k">Intérêts attendus cette année</span><b class="' + sens(PV.tot) + '">' + (PV.environ ? "≈ " : "") + eur(PV.tot, 0, true) + "</b>" +
    "<small>" + (PV.par.size > 1 ? "tes " + PV.par.size + " livrets" : "ton livret") + ", versés le 31/12" + (ok(PV.acquis) ? " · déjà acquis " + eur(PV.acquis, 0, true) : "") + (PV.environ ? " · estimation" : " · règle des quinzaines") + "</small></div>";
}
/* ================= V15.14 · Assurance-vie Quintessa : versé, valeur et gain par support, courbes, rendez-vous ================= */
const COUL_AV = { fe: "#2BB673", artema: "#9B6BFF", ostrum: "#18A9C7", total: "var(--accent)" };
let avSel = "total";
function cleSupport(nom) { return /fonds\s*euros/i.test(nom) ? "fe" : /artema/i.test(nom) ? "artema" : /ostrum/i.test(nom) ? "ostrum" : String(nom).toLowerCase().replace(/\W+/g, ""); }
/* Valeur et versé de chaque support au fil du temps, à partir des ordres passés (Ordres) et de la valeur d'aujourd'hui (Patrimoine) */
function seriesAV(sup) {
  const h = M.histoAV, auj = isoJour(new Date()); if (!h || !(h.ordres || []).length) return null;
  const O = h.ordres, debut = O[0][0], rows = sup.filter(r => !/^Total/.test(r.nom));
  // grille de dates : chaque opération, le 1er de chaque mois, aujourd'hui
  const dates = new Set(O.map(o => o[0])); let m = debut.slice(0, 7) + "-01";
  while (m <= auj) { if (m >= debut) dates.add(m); const [y, mo] = m.split("-").map(Number); m = (mo === 12 ? y + 1 : y) + "-" + String(mo === 12 ? 1 : mo + 1).padStart(2, "0") + "-01"; }
  dates.add(auj); const D_ = [...dates].sort();
  /* v16.83 · une vente d'UC retire de son versé la part au prix d'achat (au prorata de la valeur vendue, faute de quantités ici) ;
     ce même coût repasse au versé du fonds euros, la plus-value réalisée s'ajoute à sa valeur. Ainsi, versé total = apports − retraits. */
  const coutVente = new Map(), suivi = {};
  O.forEach((o, i) => {
    if (!o[2] || !(o[1] === "Achat" || o[1] === "Vente" || o[1] === "Relevé")) return;
    const x = suivi[o[2]] || (suivi[o[2]] = { v: 0, cur: 0 });
    if (o[1] === "Achat") { x.v += o[3]; x.cur += o[3]; }
    else if (o[1] === "Relevé") x.cur = o[3];
    else { const frac = x.cur > 0 ? Math.min(1, o[3] / x.cur) : x.v > 0 ? Math.min(1, o[3] / x.v) : 1, cout = x.v * frac; coutVente.set(i, cout); x.v -= cout; x.cur = Math.max(0, x.cur - o[3]); }
  });
  const typesRef = (M.ref && M.ref.types) || [];
  const sensType = t => { const x = typesRef.find(y => y.nom === t); if (x) return { s: Math.sign(x.tresorerie || 0), flux: !!x.flux };
    return { s: t === "Apport" || t === "Solde initial" || t === "Intérêts" || t === "Dividende" ? 1 : t === "Retrait" || t === "Frais" ? -1 : 0, flux: t === "Apport" || t === "Retrait" || t === "Solde initial" }; };
  const out = {};
  rows.forEach(r => {
    const k = cleSupport(r.nom), code = k === "fe" ? null : (k === "artema" ? "ARTEMA" : k === "ostrum" ? "OSTRUM" : null);
    const verse = [], val = [];
    if (k === "fe") {
      /* fonds euros = l'argent de l'enveloppe qui n'est pas investi en UC. v16.83 : tous les types comptent, d'après leur signe (M.ref.types) :
         Solde initial, Apport et Retrait au versé ; Intérêts, Frais (et plus-values réalisées) à la valeur ; le reste de l'écart avec la valeur
         du fichier court au prorata du temps (courbe estimée, ancrée sur r.valeur) */
      let v = 0, vx = 0, w = 0, prev = null; const W = [], X = [];
      D_.forEach(d => {
        if (prev) w += (v + vx) * (new Date(d) - new Date(prev)) / 864e5;
        O.forEach((o, i) => {
          if (o[0] !== d) return; const t = o[1];
          if (t === "Achat") v -= o[3];
          else if (t === "Vente") { const c = coutVente.has(i) ? coutVente.get(i) : o[3]; v += c; vx += o[3] - c; }
          else { const st = sensType(t); if (st.flux) v += st.s * o[3]; else if (st.s) vx += st.s * o[3]; }
        });
        verse.push(v); X.push(vx); W.push(w); prev = d;
      });
      const n = D_.length - 1, G = ok(r.valeur) ? r.valeur - (verse[n] + X[n]) : 0, Wf = W[n] || 1;
      D_.forEach((d, i) => val.push(verse[i] + X[i] + G * W[i] / Wf));
    } else {
      let v = 0, cur = null;
      D_.forEach(d => {
        O.forEach((o, i) => {
          if (o[0] !== d || o[2] !== code) return;
          if (o[1] === "Achat") { v += o[3]; cur = (cur === null ? 0 : cur) + o[3]; }
          else if (o[1] === "Vente") { v -= coutVente.has(i) ? coutVente.get(i) : o[3]; cur = Math.max(0, (cur === null ? 0 : cur) - o[3]); }
          else if (o[1] === "Relevé") cur = o[3];
        });
        verse.push(Math.max(0, v)); val.push(cur === null ? null : cur);
      });
      if (val.length) val[val.length - 1] = ok(r.valeur) ? r.valeur : val[val.length - 1];
    }
    out[k] = { nom: r.nom, verse, val, estime: k === "fe" };
  });
  const tv = D_.map((_, i) => Object.values(out).reduce((a, x) => a + (x.val[i] || 0), 0)), tvv = D_.map((_, i) => Object.values(out).reduce((a, x) => a + (x.verse[i] || 0), 0));
  out.total = { nom: "Toute l'assurance-vie", verse: tvv, val: tv, estime: true };
  return { dates: D_, s: out };
}
function courbeAV(S, k) {
  const x = S.s[k]; if (!x) return "";
  const W = 320, H = 150, g = 46, dr = 6, hb = 18, n = S.dates.length;
  const vals = x.val.concat(x.verse).filter(v => v !== null && isFinite(v)); if (!vals.length) return "";
  let lo = Math.min(...vals), hi = Math.max(...vals);
  { const mini = Math.abs(hi) * .08; if (hi - lo < mini) { const mil = (hi + lo) / 2; lo = mil - mini / 2; hi = mil + mini / 2; } }   // v16.87 : échelle honnête (20 € sur 15 850 € ne doit pas ressembler à une envolée)
  const mg = (hi - lo) * .12 || Math.max(1, hi * .01);
  /* v16.83 · graduations rondes (graduations + axeEur, comme les autres courbes) : plus de « 23k » pour 22 500 */
  const ticks = graduations(lo, hi, 3), pasT = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  lo = Math.min(lo - mg, ticks[0]); hi = Math.max(hi + mg, ticks[ticks.length - 1]);
  const X = i => g + i * (W - g - dr) / Math.max(1, n - 1), Y = v => 6 + (hi - v) / (hi - lo) * (H - 6 - hb);
  const kEur = v => Math.abs(v) >= 1000 ? axeEur(v) : ETAT.discret === "oui" ? "" : nf(0, pasT < 1 ? 2 : 0).format(v);
  const pts = arr => arr.map((v, i) => v === null ? null : X(i).toFixed(1) + "," + Y(v).toFixed(1)).filter(Boolean).join(" ");
  const ptsA = arr => arr.map((v, i) => v === null ? null : [X(i), Y(v)]).filter(Boolean);   // v16.87 : pour les courbes lissées
  const c = COUL_AV[k] || "var(--accent)", i0 = x.val.findIndex(v => v !== null);
  const aire = i0 >= 0 ? '<path fill="' + c + '" opacity=".12" d="' + lisse(ptsA(x.val)) + "L" + X(n - 1).toFixed(1) + " " + Y(lo).toFixed(1) + "L" + X(i0).toFixed(1) + " " + Y(lo).toFixed(1) + 'Z"/>' : "";
  const mois = d => ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][+d.slice(5, 7) - 1] + " " + d.slice(2, 4);
  const grille = ticks.map(v => '<line x1="' + g + '" x2="' + (W - dr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="gr"/><text x="' + (g - 4) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + kEur(v) + "</text>").join("");
  const releves = k === "artema" || k === "ostrum" ? (M.histoAV.ordres || []).filter(o => o[1] === "Relevé" && o[2] === (k === "artema" ? "ARTEMA" : "OSTRUM")).map(o => { const i = S.dates.indexOf(o[0]); return i >= 0 ? '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(o[3]).toFixed(1) + '" r="3" fill="' + c + '"/>' : ""; }).join("") : "";
  return '<svg class="m-mk-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Valeur et versements de ' + esc(x.nom) + '">' + grille + aire +
    '<polyline fill="none" stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="4 3" points="' + pts(x.verse) + '"/>' +
    '<path fill="none" stroke="' + c + '" stroke-width="2.2" stroke-linejoin="round" d="' + lisse(ptsA(x.val)) + '"/>' + releves +
    '<text x="' + g + '" y="' + (H - 4) + '">' + mois(S.dates[0]) + '</text><text x="' + (W - dr) + '" y="' + (H - 4) + '" text-anchor="end">' + mois(S.dates[n - 1]) + "</text></svg>" +
    '<div class="av-leg"><span><i style="background:' + c + '"></i>valeur' + (x.estime ? " (estimée entre les relevés)" : "") + '</span><span><i class="pt"></i>versé</span>' + (releves ? '<span><i class="rd" style="background:' + c + '"></i>tes relevés</span>' : "") + "</div>";
}
function htmlAV(sup) {
  const tot = sup.find(r => /^Total/.test(r.nom)) || {}, rows = sup.filter(r => !/^Total/.test(r.nom)), p = (M.parametres || {});
  const S = seriesAV(sup), fe = p.fondsEuros || {}, ar = p.artema || {};
  const tuile = (lab, val, cls, sub) => '<div><span class="lab">' + lab + '</span><span class="val ' + (cls || "") + '">' + val + '</span><span class="sub">' + sub + "</span></div>";
  const rap = k => (rappelsFichier().find(x => cleRappel(x.nom) === k) || {}).prochaine;
  const du = k => rappelsFichier().some(x => cleRappel(x.nom) === k && rappelDu(x));   // v16.83 : un rappel déjà dû est dans la cloche, pas répété ici
  const rdv = [];
  if (aArtema() && (ar.initial === null || ar.initial === undefined || ar.initial === "") && !du("artemaInitial")) rdv.push(["📌", "Artema : niveau de départ de l'indice", rap("artemaInitial") ? "à saisir dès le " + frDate(rap("artemaInitial")) : "à saisir"]);
  if (rap("releve") && !du("releve")) rdv.push(["◷", aArtema() ? "Relevé du mois (Artema)" : "Relevé du mois", quandRappel({ prochaine: rap("releve") }) || frDate(rap("releve"))]);
  if (fe.taux) rdv.push(["💶", "Fonds euros : " + pct(fe.taux, 2, false) + " net (" + (fe.annee || "—") + ")" + (fe.bonus ? " + bonus " + pct(fe.bonus, 2, false) + (fe.bonusFin ? " jusqu'au " + frDate(fe.bonusFin) : "") : ""), (rap("fondsEuros") ? "vrai taux vers le " + frDate(rap("fondsEuros")) + " · " : "") + "estimation ajustable", "fondsEuros"]);
  const sel = S && S.s[avSel] ? avSel : "total";
  const nDus = tachesAFaire().filter(t => t.cles.some(k => /^(artema|releve|fondsEuros|versement)/.test(k))).length;   // v16.87 : ce qui est dû vit dans « À faire »
  if (nDus) rdv.unshift(["◷", nDus + " chose" + (nDus > 1 ? "s" : "") + " à faire sur l'assurance-vie", "dans « À faire » (onglet Aujourd'hui)", null, "jour"]);
  return '<div class="tuiles m-petit av-t">' +
      tuile("Valeur", eur(tot.valeur), "", "aujourd'hui") + tuile("Versé", eur(tot.investi), "", "à ce jour") +
      tuile("Gain", eur(tot.pv, 0, true), sens(tot.pv), pct(tot.pvPct, 2) + " depuis l'ouverture") + tuile("Garanti", pct(rows.filter(r => cleSupport(r.nom) === "fe").reduce((a, r) => a + (r.poids || 0), 0), 0, false), "", "part en fonds euros") +
    "</div>" +
    '<div class="stack av-stack" role="img" aria-label="Répartition">' + rows.map(r => '<i style="flex:' + Math.max(0, r.valeur || 0) + ";background:" + (COUL_AV[cleSupport(r.nom)] || "var(--ink-3)") + '"></i>').join("") + "</div>" +
    '<div class="av-sups">' + rows.map(r => { const k = cleSupport(r.nom);
      return '<button type="button" class="av-s" data-av="' + k + '" aria-pressed="' + (sel === k) + '" style="--c:' + (COUL_AV[k] || "var(--ink-3)") + '"><span class="av-n"><b><i></i>' + esc(r.nom) + "</b><small>" + esc(r.note || "") + "</small></span>" +
        '<span class="av-v"><b>' + eur(r.valeur) + '</b><small>versé ' + eur(r.investi) + '</small><small class="' + sens(r.pv) + '">' + eur(r.pv, 2, true) + " · " + pct(r.pvPct, 2) + "</small></span></button>"; }).join("") +
      (S ? '<button type="button" class="av-s av-tout" data-av="total" aria-pressed="' + (sel === "total") + '">Toute l\'AV</button>' : "") + "</div>" + lienArtema() +
    (S ? '<div class="av-courbe" id="av-courbe">' + courbeAV(S, sel) + "</div>" : '<p class="info">Les courbes arrivent dès que ton fichier envoie l\'historique (mise à jour du script).</p>') +
    (rdv.length ? '<h3 class="m-sous">Rendez-vous</h3><div class="av-rdv">' + rdv.map(([i, t, q, k, al]) => '<div' + (al ? ' class="av-du"' : "") + '><i>' + i + "</i><span>" + esc(t) + (q ? "<small>" + esc(q) + "</small>" : "") + "</span>" + (k ? '<button class="mini-btn" type="button" data-av-reg="' + k + '">Ajuster</button>' : al ? '<button class="mini-btn" type="button" data-m-aller="' + al + '">Voir</button>' : "") + "</div>").join("") + "</div>" : "");
}
/* ================= V16.7 · Artema Décembre 2026 : l'écran à part (produit structuré Natixis, ISIN FR0014017J36) =================
   Source : DIC Natixis du 01/04/2026 + fiche BPCE Vie. Chacun ne voit que ses propres chiffres (calculés sur son fichier). */
const ARTEMA = {
  emission: "2026-12-04", photo: ["2026-12-02", "2026-12-04"], attente: .01, nominal: 100, barriere: .6, fgse: .008,
  rdv: [["2029-12-07", "2029-12-24", .285], ["2030-12-09", "2030-12-23", .38], ["2031-12-08", "2031-12-22", .475], ["2032-12-07", "2032-12-20", .57], ["2033-12-07", "2033-12-19", .665], ["2034-12-01", "2034-12-18", .76, true]],
  lien: "https://equityderivatives.natixis.com/fr/indice/rdigtdg/"
};
const JOUR_MS = 864e5, jours = (a, b) => (new Date(b) - new Date(a)) / JOUR_MS;
/* v20.20 (Théo) : le gain affiché NET des 0,80 %/an de frais du contrat (au lieu des 28,5 % / +9,5 pts bruts de la brochure) */
const netArt = i => { const x = ARTEMA.rdv[i]; return (1 + x[2]) * Math.pow(1 - ARTEMA.fgse, jours(ARTEMA.emission, x[1]) / 365.25) - 1; };
const pasNetArt = () => (netArt(4) - netArt(0)) / 4;
function aArtema() {   // 24/11/2026 : c'est le serveur qui dit si Artema est suivi (artema.suivi, ligne ARTEMA des positions) ; anciens scripts : la ligne Artema des supports
  if (!M) return false; const a = (M.parametres || {}).artema;
  if (a && typeof a.suivi === "boolean") return a.suivi;
  return (M.supports || []).some(r => /artema/i.test(r.nom || "") && (r.valeur || r.investi));
}
/** tout ce qu'il faut savoir sur ton Artema à une date (v16.8x : parts exposées, repli estimé, dernier relevé, historique des niveaux) */
function etatArtema() {
  const row = (M.supports || []).find(r => /artema/i.test(r.nom || "")) || {}, ar = (M.parametres || {}).artema || {}, auj = isoJour(new Date());
  const tous = ((M.histoAV || {}).ordres || []).filter(o => o[2] === "ARTEMA" && /^\d{4}-\d\d-\d\d/.test(String(o[0])));
  const ordres = tous.filter(o => o[1] === "Achat");
  // parts achetées pendant l'attente : prix = 100 € au 4 décembre MOINS 1 %/an restant à courir (DIC : 100 × (1 − 1 % × t))
  const prixAttente = d => ARTEMA.nominal * (1 - ARTEMA.attente * Math.max(0, jours(d, ARTEMA.emission)) / 365);
  let parts = 0, debut = null, estime = false;
  ordres.forEach(o => { parts += o[3] / prixAttente(o[0]); if (!debut || o[0] < debut) debut = o[0]; });
  const verse = row.investi || ordres.reduce((a, o) => a + o[3], 0);
  // pas d'ordre « Achat » : on estime à partir du plus ancien ordre Artema de TON fichier (sinon la date d'émission)
  if (!parts && verse) { debut = tous.reduce((m, o) => !m || o[0] < m ? o[0] : m, null) || ARTEMA.emission; parts = verse / prixAttente(debut); estime = true; }
  const partsA = d => parts * Math.pow(1 - ARTEMA.fgse, Math.max(0, jours(debut || auj, d)) / 365.25);
  const ini = +ar.initial || null, act = +ar.actuel || null, ratio = ini && act ? act / ini : null;
  const E = { row, ar, auj, parts, partsA, debut, estime, verse, ini, act, ratio, valeur: row.valeur || null, pv: row.pv, pvPct: row.pvPct };
  E.ech = ARTEMA.rdv.map((x, i) => issueArtema(E, 1, i));   // le cas « au moins au départ » à chaque rendez-vous
  E.finPlat = partsA(ARTEMA.rdv[5][1]) * ARTEMA.nominal;
  E.phase = auj < ARTEMA.photo[0] ? "attente" : auj <= ARTEMA.photo[1] ? "photo" : !ini ? "depart" : "vie";
  E.ip = E.ech.findIndex(e => e.ev >= auj); E.prochain = E.ip >= 0 ? E.ech[E.ip] : null;
  E.passe = E.ech.filter(e => e.ev < auj && e.pay >= isoJour(new Date(Date.now() - 40 * JOUR_MS))).pop() || null;
  const rel = tous.filter(o => o[1] === "Relevé").sort((a, b) => a[0] < b[0] ? -1 : 1).pop();
  E.releve = rel ? String(rel[0]).slice(0, 10) : null;
  const dAct = /^\d{4}-\d\d-\d\d/.test(String(ar.date || "")) ? String(ar.date).slice(0, 10) : null;
  E.dateAct = dAct; E.age = dAct ? Math.round(jours(dAct, auj)) : null;
  // rendez-vous passé + niveau saisi ce jour-là (ou après) au moins au départ → Artema s'est probablement arrêté
  E.arrete = E.passe && ratio >= 1 && dAct && dAct >= E.passe.ev ? issueArtema(E, ratio, E.ech.indexOf(E.passe)) : null;
  // historique des niveaux saisis (serveur V-B : parametres.artema.histo) + la dernière saisie ; un point par jour
  const h = {}; (Array.isArray(ar.histo) ? ar.histo : []).forEach(x => { const d = String((x || [])[0] || "").slice(0, 10), n = +(x || [])[1]; if (/^\d{4}-\d\d-\d\d$/.test(d) && n > 0) h[d] = n; });
  if (dAct && act) h[dAct] = act;
  E.histo = Object.keys(h).sort().map(d => [d, h[d]]); E.histoServeur = Array.isArray(ar.histo);
  return E;
}
/** LA fonction de calcul (sans effet de bord) : ce qui se passe au rendez-vous i (0 à 5) si l'indice y est à r × son départ */
function issueArtema(E, r, i) {
  const [ev, pay, c, fin] = ARTEMA.rdv[i], base = E.partsA(pay) * ARTEMA.nominal, o = { ev, pay, c, fin: !!fin, r };
  if (!fin && !(r >= 1)) return Object.assign(o, { etat: "attente", montant: null, gain: null, tra: null, prochainC: ARTEMA.rdv[i + 1][2] });
  o.etat = r >= 1 ? "arret" : r >= ARTEMA.barriere ? "capital" : "perte";
  o.montant = o.etat === "arret" ? base * (1 + c) : o.etat === "capital" ? base : base * r;   // perte = TOUTE la baisse
  const a = Math.max(.1, jours(E.debut || E.auj, pay) / 365.25);
  o.gain = o.montant - E.verse; o.tra = E.verse ? Math.pow(o.montant / E.verse, 1 / a) - 1 : null;
  return o;
}
function rebours(de, a) {
  const d0 = new Date(de), d1 = new Date(a); let y = d1.getFullYear() - d0.getFullYear(), m = d1.getMonth() - d0.getMonth(), j = d1.getDate() - d0.getDate();
  if (j < 0) { m--; j += new Date(d1.getFullYear(), d1.getMonth(), 0).getDate(); } if (m < 0) { y--; m += 12; }
  return { y, m, j, total: Math.round(jours(de, a)) };
}
const pc1 = c => String(Math.round(c * 1000) / 10).replace(".", ",");
const MOIS_C = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const moisAn = iso => MOIS_C[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const jourMois = iso => +iso.slice(8, 10) + (iso.slice(8, 10) === "01" ? "er" : "") + " " + ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const jourCourt = (iso, sansAn) => +iso.slice(8, 10) + (iso.slice(8, 10) === "01" ? "er" : "") + " " + MOIS_C[+iso.slice(5, 7) - 1] + (sansAn ? "" : " " + iso.slice(0, 4));
const e10 = v => eur(Math.round(v / 10) * 10).replace(/\u202F/g, "\u00A0"), g10 = v => eur(Math.round(v / 10) * 10, 0, true).replace(/\u202F/g, "\u00A0");
const ptsIdx = v => new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v).replace(/[\s\u202F]/g, "\u00A0") + "\u00A0pts";
const coulArt = r => r >= 1 ? "v" : r >= ARTEMA.barriere ? "o" : "r";
const ilYaJ = j => j <= 0 ? "aujourd'hui" : j === 1 ? "hier" : "il y a " + j + NB + "j";
const PERIME_J = 35, NBS = "\u00A0";
/** une issue en une ligne (montant, gain, rendement) */
function texteIssue(s, avecTra) {
  if (s.etat === "attente") return "rien ne se passerait : on attendrait " + moisAn(ARTEMA.rdv[ARTEMA.rdv.findIndex(x => x[0] === s.ev) + 1][0]) + ", où le gain possible monte à <b" + (s.r >= ARTEMA.barriere ? ' class="up"' : "") + ">+" + pc1(netArt(ARTEMA.rdv.findIndex(x => x[0] === s.ev) + 1)) + NBS + "% net</b>";
  return (s.etat === "arret" ? "Artema s'arrête : " : s.etat === "capital" ? "capital rendu (moins les frais) : " : "perte égale à la baisse : ") +
    "<b>≈ " + e10(s.montant) + "</b> (" + g10(s.gain) + (avecTra && s.tra !== null ? ", ≈ " + pct(s.tra, 1, false) + "/an" : "") + ")";
}
/** la jauge : l'indice par rapport à son départ (40 % → 130 %), avec les marges en clair */
function jaugeArtema(ratio, mini, E) {
  const x = r => Math.max(0, Math.min(100, (r - .4) / .9 * 100));
  let m = "";
  if (ratio) {
    const pos = mini ? x(ratio) : Math.max(7, Math.min(93, x(ratio)));
    m = '<div class="art-jm' + (ratio > 1.3 || ratio < .4 ? " hors" : "") + '" style="left:' + pos.toFixed(1) + '%">' + (ratio > 1.3 ? "▶ " : ratio < .4 ? "◀ " : "") + Math.round(ratio * 100) + " %</div>";
  }
  let marges = "";
  if (!mini && ratio) {
    const b = ARTEMA.barriere;
    marges = '<div class="art-marges"><div>' + (ratio < 1 ? "Il doit encore monter de <b>+" + pc1(1 / ratio - 1) + " %</b> pour retrouver son départ." : (ratio < 1.0005 ? "<b class=\"up\">Pile à son départ.</b>" : "<b class=\"up\">" + pc1(ratio - 1) + " %</b> au-dessus du départ.")) + "</div><div>" +
      (ratio >= b ? "Il peut encore baisser de <b>" + pc1(1 - b / ratio) + " %</b> avant la barrière de 2034." : "Sous la barrière : il doit remonter de <b>+" + pc1(b / ratio - 1) + " %</b> d'ici le 1er déc. 2034.") + "</div>" +
      (E && E.ini ? '<div class="g"><span>départ = ' + ptsIdx(E.ini) + "</span> · <span>barrière = " + ptsIdx(E.ini * b) + "</span></div>" : "") + "</div>";
  }
  return '<div class="art-jw' + (mini ? " mini" : "") + '">' + m +
    '<div class="art-jauge"><span class="r" style="width:' + x(.6).toFixed(1) + '%"></span><span class="o" style="width:' + (x(1) - x(.6)).toFixed(1) + '%"></span><span class="v"></span></div>' +
    (mini ? "" : '<div class="art-jl"><span>40 %</span><span>60 % · barrière</span><span>100 % · départ</span><span>130 %</span></div>') + "</div>" + marges;
}
/** ① la phrase-verdict en tête : [classe, html] */
function verdictArtema(E) {
  if (E.phase === "attente") return ["", "⏳ <b>Pas encore exposé à l'indice.</b> Ton argent rapporte 1 %/an jusqu'au 4 décembre (prix de 100 € ce jour-là). La photo de départ de l'indice sera prise les 2, 3 et 4 décembre 2026."];
  if (E.phase === "photo") return ["", "📸 <b>Photo de départ en cours</b> (2, 3 et 4 décembre) : la moyenne des clôtures de l'indice sur ces 3 jours devient sa référence pour 8 ans."];
  if (E.phase === "depart") return ["o", "📌 <b>Saisis le niveau de départ de l'indice</b> (valeur officielle publiée par Natixis après le 4 décembre) pour que la jauge et les rendez-vous s'affichent."];
  if (!E.ratio) return ["", "Saisis le niveau actuel de l'indice pour voir où il en est par rapport à son départ."];
  if (E.arrete) { const a = E.arrete;
    return ["v", "🎉 <b>Artema s'est probablement arrêté le " + jourCourt(a.ev) + "</b> : l'indice était au moins à son départ (" + Math.round(E.ratio * 100) + NBS + "% le " + frDate(E.dateAct).slice(0, 5) + ")." +
      heroArtema("v", "versés vers le " + jourCourt(a.pay), a) + "<small>À vérifier sur ton relevé BPCE Vie. Si l'indice était sous son départ le " + jourCourt(a.ev, true) + ", rien ne s'est passé : prochain rendez-vous en " + (E.prochain ? moisAn(E.prochain.ev) : "—") + ".</small>"]; }
  if (!E.prochain) return ["", "🏁 <b>Artema est terminé.</b>"];
  // v16.85 · lendemain d'un rendez-vous sans niveau saisi ce jour-là : on attend la clôture au lieu de viser déjà le rendez-vous suivant
  if (E.passe && !E.arrete && (!E.dateAct || E.dateAct < E.passe.ev)) return ["o", "⏳ <b>Le rendez-vous du " + jourCourt(E.passe.ev) + " est passé.</b> Saisis le niveau de clôture de l'indice ce jour-là pour savoir si Artema s'est arrêté."];
  const r = E.ratio, s = issueArtema(E, r, E.ip), c = coulArt(r), auJour = E.auj === s.ev;
  const tete = (c === "v" ? "🟢" : c === "o" ? "🟠" : "🔴") + " Indice à <b>" + Math.round(r * 100) + NBS + "%</b> de son départ";
  let t = s.etat === "attente" ? tete + " → " + (auJour ? "au rendez-vous d'aujourd'hui" : "au rendez-vous du " + jourCourt(s.ev)) + ", à ce niveau : " + texteIssue(s) + "."
    : tete + (auJour ? ". <b>Si c'était aujourd'hui…</b>" : ". Au rendez-vous du " + jourCourt(s.ev) + ", à ce niveau :") +
      heroArtema(s.etat === "arret" ? "v" : s.etat === "capital" ? "o" : "r", s.etat === "arret" ? "Artema s'arrête, tu toucherais" : s.etat === "capital" ? "capital rendu (moins les frais)" : "perte égale à la baisse", s);
  if (c === "r" && !s.fin) t += '<small>La barrière des 60 % ne compte qu\'au 1er déc. 2034 : passer dessous avant ne déclenche rien.</small>';
  else if (c === "o" && !s.fin) t += "<small>Capital protégé jusqu'à −40 % à l'échéance seulement, sauf faillite de Natixis.</small>";
  else if (c === "v" && !s.fin) t += "<small>Remboursement anticipé automatique si l'indice est encore au moins à son départ ce jour-là. Sinon, le gain net grossit d'environ " + pc1(pasNetArt()) + " points par année d'attente.</small>";
  return [c, t];
}
/** le chiffre héros : ce que tu toucherais (plus gros que le versé) */
function heroArtema(c, quoi, s) {
  return '<div class="art-hero ' + c + '"><small>' + quoi + '</small><b>≈ ' + e10(s.montant) + "</b><small>" + g10(s.gain) + (s.tra !== null ? " · ≈ " + pct(s.tra, 1, false) + "/an" : "") + "</small></div>";
}
/** fraîcheur du niveau saisi */
function fraicheurArtema(E) {
  if (!E.act) return "";
  if (!E.dateAct) return '<div class="art-frais">date de saisie inconnue</div>';
  return '<div class="art-frais' + (E.age > PERIME_J ? " vieux" : "") + '">niveau du ' + frDate(E.dateAct).slice(0, 5) + ", " + ilYaJ(E.age) + (E.age > PERIME_J ? " · <b>à remettre à jour</b>" : "") + "</div>";
}
const pastilleEstime = E => E.estime ? '<span class="art-est" title="ajoute ton ordre d\'achat pour un calcul exact">estimé</span>' : "";
/** la ligne compacte dans Moi › Patrimoine › Quintessa */
function lienArtema() {
  if (!aArtema()) return "";
  const E = etatArtema(), p = E.prochain, txt = E.phase === "attente" || E.phase === "photo" ? "photo de départ les 2–4 déc." : E.phase === "depart" ? "niveau de départ à saisir" : p ? "prochain rendez-vous : " + moisAn(p.ev) : "terminé";
  const X = r => (Math.max(0, Math.min(1, (r - .4) / .9)) * 96 + 2).toFixed(1);
  const mini = E.ratio ? '<svg class="art-mini" viewBox="0 0 100 22" aria-label="Indice à ' + Math.round(E.ratio * 100) + ' % de son départ"><rect x="2" y="12" width="' + (X(.6) - 2) + '" height="6" rx="3" fill="#C8414E"/><rect x="' + X(.6) + '" y="12" width="' + (X(1) - X(.6)) + '" height="6" fill="#F2B33A"/><rect x="' + X(1) + '" y="12" width="' + (98 - X(1)) + '" height="6" rx="3" fill="#3DDC97"/><path d="M' + X(E.ratio) + ' 10l-3-5h6z" fill="currentColor"/><text x="' + X(E.ratio) + '" y="4.5" text-anchor="middle" font-size="7" font-weight="700" fill="currentColor">' + Math.round(E.ratio * 100) + ' %</text></svg>' : "";
  return '<button type="button" class="art-lien" data-m-aller="artema" style="--c:' + COUL_AV.artema + '"><span><b>🎯 Suivi du produit structuré Artema</b><small>' + esc(txt) + "</small></span>" + mini + '<em class="art-voir">Voir le détail ›</em></button>';   // v17.45 (Théo) : plus visible, on voit que ça s'ouvre
}
/* ---- ⑥ le simulateur « Et si ? » : un curseur, six rendez-vous, un seul calcul (issueArtema) ---- */
let artSim = { v: null, i: null, ouvert: false }, artCourbeTout = false, artTrois = false;
const SIM_MIN = 40, SIM_MAX = 150;
function zoneSim(v) { return v >= 100 ? 2 : v >= 60 ? 1 : 0; }
function resSim(E, v, i) {
  const r = v / 100, s = issueArtema(E, r, i), cl = s.etat === "arret" ? "v" : s.etat === "attente" ? "g" : s.etat === "capital" ? "o" : "r";
  const titre = { arret: "Artema s'arrête", attente: "Rien ne se passe, on attend l'an prochain (+" + pc1(pasNetArt()) + " pts nets)", capital: "Capital rendu (moins les frais)", perte: "Perte = baisse" }[s.etat];
  const k0 = Math.max(0, E.ip);
  const lignes = ARTEMA.rdv.map((x, k) => {
    const q = issueArtema(E, r, k), passe = k < k0;
    const val = passe ? "passé" : q.etat === "attente" ? "on attend" : "≈ " + e10(q.montant);
    return '<tr class="' + (passe ? "gris" : q.etat) + (k === i ? " on" : "") + '"><td>' + moisAn(x[0]) + (q.fin ? " · fin" : "") + "</td><td>" + val + "</td><td>" + (passe || q.etat === "attente" ? "" : g10(q.gain)) + "</td></tr>";
  }).join("");
  return '<div class="art-sres ' + cl + '"><div class="t">' + titre + '</div><div class="m"><b>' + (s.montant === null ? "—" : "≈ " + e10(s.montant)) + "</b>" +
    (s.montant === null ? "<small>prochain rendez-vous : " + moisAn(ARTEMA.rdv[i + 1][0]) + " (+" + pc1(netArt(i + 1)) + " % net possible)</small>" : "<small>" + g10(s.gain) + (s.tra !== null ? " · ≈ " + pct(s.tra, 1, false) + "/an" : "") + "</small>") + "</div>" +
    '<p>si l\'indice est à ' + v + NBS + "% de son départ le " + jourCourt(s.ev) + (i > 0 ? ", sans l'avoir retrouvé aux rendez-vous d'avant" : "") + pastilleEstime(E) + "</p></div>" +
    '<p class="art-sp">Le même ' + v + NBS + "%, selon le rendez-vous où il est atteint :</p>" +
    '<table class="art-t art-esc">' + lignes + "</table>" + '<p class="art-gris">Estimé, frais du contrat déduits, avant impôts et prélèvements sociaux. On ne touche qu\'une seule fois : au premier rendez-vous où l\'indice est au moins à son départ.</p>';
}
function labelSim(E, v) { return '<b>' + v + " %</b> du départ" + (E.ini ? " · ≈ " + ptsIdx(E.ini * v / 100) : ""); }
function htmlSim(E) {
  if (artSim.v === null) artSim.v = E.ratio ? Math.max(SIM_MIN, Math.min(SIM_MAX, Math.round(E.ratio * 100))) : 100;
  if (artSim.i === null) artSim.i = E.ip >= 0 ? E.ip : 5;
  const p = v => ((v - SIM_MIN) / (SIM_MAX - SIM_MIN)).toFixed(4);
  return '<details class="art-d art-sim"' + (artSim.ouvert ? " open" : "") + '><summary>🎚️ Et si ? Simule un niveau de l\'indice</summary>' +
    '<div class="art-sl-l" id="art-sl-l">' + labelSim(E, artSim.v) + "</div>" +
    '<div class="art-sl" style="--p60:' + p(60) + ";--p100:" + p(100) + '"><input type="range" id="art-r" min="' + SIM_MIN + '" max="' + SIM_MAX + '" step="1" value="' + artSim.v + '" aria-label="Niveau de l\'indice en % de son départ">' +
    '<i class="cr" style="--p:' + p(60) + '"><span>60</span></i><i class="cr" style="--p:' + p(100) + '"><span>100</span></i></div>' +
    '<div class="art-ans" role="group" aria-label="Rendez-vous">' + ARTEMA.rdv.map((x, k) => '<button type="button" data-art-an="' + k + '" aria-pressed="' + (k === artSim.i) + '">' + x[0].slice(0, 4) + "</button>").join("") + "</div>" +
    '<div id="art-sim-res">' + resSim(E, artSim.v, artSim.i) + "</div></details>";
}
/* ---- ⑦ la courbe des niveaux saisis (points seulement, en % du départ) ---- */
function svgCourbeArtema(E, tout) {
  const pts = E.histo.map(([d, n]) => [d, n / E.ini, n]);
  const W = 360, H = 186, gl = 34, gr = W - 72, gt = 12, gb = H - 24;
  const d0 = ARTEMA.emission, dMax = pts.length ? pts[pts.length - 1][0] : d0;
  let d1 = tout ? "2034-12-18" : isoJour(new Date(Date.now() + 31 * JOUR_MS)); if (dMax > d1) d1 = dMax; if (jours(d0, d1) < 45) d1 = isoJour(new Date(new Date(d0).getTime() + 45 * JOUR_MS));
  const span = jours(d0, d1), X = d => gl + Math.max(0, Math.min(1, jours(d0, d) / span)) * (gr - gl);
  const lo = Math.min(.4, ...pts.map(p => p[1])) - .02, hi = Math.max(1.3, ...pts.map(p => p[1])) + .02, Y = r => gb - (r - lo) / (hi - lo) * (gb - gt);
  let s = '<svg class="art-c" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Niveaux de l\'indice saisis, en % du départ">';
  [.4, .6, 1, 1.3].forEach(r => { s += '<text x="' + (gl - 5) + '" y="' + (Y(r) + 4).toFixed(1) + '" text-anchor="end" class="ax">' + Math.round(r * 100) + "</text>"; });
  if (tout) ARTEMA.rdv.forEach(x => { const xx = X(x[0]).toFixed(1); s += '<line x1="' + xx + '" x2="' + xx + '" y1="' + gt + '" y2="' + gb + '" class="rv"/><text x="' + xx + '" y="' + (H - 6) + '" text-anchor="middle" class="ax">' + (x[3] ? "" : "") + "’" + x[0].slice(2, 4) + "</text>"; });
  else {
    const m = []; for (let d = new Date(+d0.slice(0, 4), +d0.slice(5, 7), 1); isoJour(d) <= d1; d = new Date(d.getFullYear(), d.getMonth() + (span > 400 ? 3 : 1), 1)) m.push(isoJour(d));
    const pas = Math.ceil(m.length / 6); m.forEach((d, k) => { if (k % pas) return; s += '<text x="' + X(d).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="ax">' + MOIS_C[+d.slice(5, 7) - 1].replace(".", "") + (d.slice(5, 7) === "01" ? " " + d.slice(2, 4) : "") + "</text>"; });
  }
  s += '<line x1="' + gl + '" x2="' + gr + '" y1="' + Y(1).toFixed(1) + '" y2="' + Y(1).toFixed(1) + '" class="dep"/><text x="' + gr + '" y="' + (Y(1) + 4).toFixed(1) + '" text-anchor="start" class="lv" dx="6">départ</text>';
  s += '<line x1="' + gl + '" x2="' + gr + '" y1="' + Y(.6).toFixed(1) + '" y2="' + Y(.6).toFixed(1) + '" class="bar"/><text x="' + gr + '" y="' + (Y(.6) + 4).toFixed(1) + '" text-anchor="start" class="lr" dx="6">barrière</text>';
  if (pts.length > 1) s += '<path class="pl" d="' + lisse(pts.map(p => [X(p[0]), Y(p[1])])) + '"/>';
  pts.forEach((p, k) => { s += '<circle class="pt ' + coulArt(p[1]) + '" cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="' + (k === pts.length - 1 ? 4.5 : 3.5) + '" data-k="' + k + '"/>'; });
  return s + "</svg>";
}
function htmlCourbeArtema(E) {
  if (!E.ini) return '<p class="art-gris">La courbe s\'affichera une fois le niveau de départ saisi.</p>';
  if (!E.histo.length) return '<p class="art-gris">Elle se remplira à chaque saisie du niveau de l\'indice.</p>';
  return '<div id="art-courbe">' + svgCourbeArtema(E, artCourbeTout) + '</div><p class="art-gris art-cleg"><b class="cl-v">━ départ (100 %)</b> · <b class="cl-r">┅ barrière (60 %)</b> : elle ne compte qu\'au 1er déc. 2034.</p><div class="art-ctip" id="art-ctip">' + (E.histo.length < 2 || !E.histoServeur ? "Elle se remplira à chaque saisie." : "Touche un point pour voir son niveau.") + "</div>" +
    '<button type="button" class="lien art-ctout" data-art-tout aria-pressed="' + artCourbeTout + '">' + (artCourbeTout ? "‹ Vue rapprochée" : "Jusqu'en 2034 ›") + "</button>";
}
/* ---- ⑤ la saisie express du niveau de l'indice ---- */
function htmlSaisieArtema(E) {
  const lien = '<a class="lien" href="' + ARTEMA.lien + '" target="_blank" rel="noopener">↗ Voir l\'indice</a>';
  if (E.phase === "attente" || E.phase === "photo") return '<p class="art-gris">Le niveau de départ se saisit à partir du 5 décembre : c\'est la valeur officielle publiée par Natixis (moyenne des clôtures des 2, 3 et 4 déc.).</p><div class="art-btns">' + lien + "</div>";
  const msg = "";
  const rapA = (rappelsFichier().find(x => cleRappel(x.nom) === "artemaActuel") || {}).prochaine;
  if (!E.ini) return '<form class="art-saisie" data-art-form="initial"><div class="rang">' + champ("art-niv", "Niveau de départ (pts)", "", { ph: "ex. 1 234,56" }) + "</div>" +
    '<p class="art-gris">Valeur officielle publiée par Natixis (moyenne des clôtures des 2, 3 et 4 déc.). Si elle diffère de ton calcul, c\'est le chiffre de Natixis qui compte.</p>' +
    '<details class="art-trois"' + (artTrois ? " open" : "") + '><summary>Calculer depuis les 3 cours de clôture</summary><div class="rang trois">' + champ("art-c1", "2 déc.", "") + champ("art-c2", "3 déc.", "") + champ("art-c3", "4 déc.", "") + "</div></details>" +
    msg + '<div class="art-btns"><button class="btn acc" type="submit">Enregistrer</button>' + lien + "</div></form>";
  return '<form class="art-saisie" data-art-form="actuel"><div class="rang">' + champ("art-niv", "Niveau du jour (pts)", "", { ph: E.act ? saisieNombre(E.act, 2) : "ex. 1 234,56" }) + champ("art-date", "Clôture du", aujourdhuiISO(), { type: "date" }) + "</div>" +
    '<p class="art-gris">Cours de <b>clôture</b> officiel de l\'indice Artema (page Natixis), pas l\'Euro Stoxx ni un cours en séance.' + (rapA ? " Prochain rappel le " + frDate(rapA) + "." : "") + "</p>" +
    msg + '<div class="art-btns"><button class="btn acc" type="submit">Enregistrer</button>' + lien + "</div></form>";
}
/** l'écran Artema (v16.8x : verdict → jauge → rendez-vous → vente → saisie → simulateur → courbe → détails) */
function htmlArtema() {
  if (!aArtema()) return '<div class="m-vide"><p>Pas d\'Artema dans ton assurance-vie.</p></div>';
  const E = etatArtema(), p = E.prochain, [vc, vt] = verdictArtema(E), vieux = E.ratio && E.age !== null && E.age > PERIME_J ? " vieux" : "";
  const avantPhoto = E.phase === "attente" || E.phase === "photo";
  const cible = avantPhoto ? ARTEMA.photo[1] : E.arrete ? E.arrete.pay : p ? p.ev : null, rb = cible ? rebours(E.auj, cible) : null;
  const rbTxt = rb ? (rb.total <= 0 ? "aujourd'hui" : rb.y ? rb.y + " an" + (rb.y > 1 ? "s" : "") : rb.m ? rb.m + " mois" : rb.total + " j") : "—", rbSous = rb && rb.total > 0 ? (rb.y ? (rb.m ? rb.m + " mois · " : "") + rb.j + " j" : rb.m ? rb.j + " j" : "") : "";
  let rdvTxt;
  if (avantPhoto) rdvTxt = "<b>2, 3 et 4 décembre 2026</b> : photo de départ de l'indice. Ensuite, rien ne se passe jusqu'au premier rendez-vous, le 7 déc. 2029.<br>Pour sortir à ce rendez-vous, l'indice doit être <b>au moins à son niveau de départ</b> (0 % ou plus : pas besoin qu'il monte) → +" + pc1(netArt(0)) + " % net de frais. Sinon, on retente chaque année, avec environ " + pc1(pasNetArt()) + " points nets de plus.";
  else if (E.arrete) rdvTxt = "<b>Argent versé vers le " + jourCourt(E.arrete.pay) + "</b> (si Artema s'est bien arrêté le " + jourCourt(E.arrete.ev, true) + ")." + (p ? "<br>Sinon, prochain rendez-vous le " + jourCourt(p.ev) + "." : "");
  else if (!p) rdvTxt = "Artema est terminé.";
  else {
    const auJour = E.auj === p.ev, dates = "<b>Constatation le " + jourCourt(p.ev) + "</b> · argent versé vers le " + jourCourt(p.pay, true);
    if (E.ratio) rdvTxt = dates + "<br>" + (auJour ? "C'est aujourd'hui : saisis la clôture du jour pour savoir s'il s'arrête." : "Pas de rendez-vous avant : d'ici là, rien ne se déclenche, quoi que fasse l'indice.");
    else rdvTxt = dates + "<br>Si l'indice est ≥ 100 % ce jour-là : " + texteIssue(issueArtema(E, 1, E.ip), true) + "." + (p.fin ? " Entre 60 et 100 % : capital rendu (≈ " + e10(E.finPlat) + "). Sous 60 % : perte égale à la baisse." : " Sinon, rien ne se passe : on attend l'an prochain.");
  }
  const pos = iso => Math.max(0, Math.min(100, jours("2026-12-04", iso) / jours("2026-12-04", "2034-12-01") * 100));
  const frise = '<div class="art-frise"><div class="l"></div><div class="f" style="width:' + pos(E.auj).toFixed(1) + '%"></div><div class="auj-t" style="left:' + pos(E.auj).toFixed(1) + '%"></div><div class="auj" style="left:' + pos(E.auj).toFixed(1) + '%;transform:translateX(' + (pos(E.auj) < 10 ? -12 : pos(E.auj) > 90 ? -88 : -50) + '%)">aujourd\'hui</div>' +
    '<div class="p dep" style="left:0"><i></i>déc.<b>2026</b></div>' + E.ech.map(e => '<div class="p' + (p && e.ev === p.ev ? " next" : "") + (e.fin ? " fin" : "") + (e.ev < E.auj ? " passe" : "") + '" style="left:' + pos(e.ev).toFixed(1) + '%"><i></i>' + (e.fin ? "fin" : "déc.") + "<b>" + e.ev.slice(0, 4) + "</b></div>").join("") + "</div>";
  // ④ si tu vendais aujourd'hui (prix de marché, jamais recalculé depuis l'indice)
  let vente = "";
  if (E.valeur) {
    const s = E.ratio && p && !E.arrete ? issueArtema(E, E.ratio, E.ip) : null, ecart = s && s.montant !== null ? s.montant - E.valeur : null;
    vente = "<h4>Si tu vendais aujourd'hui</h4><div class=\"art-si\"><p>Prix du relevé<small>" + (E.releve ? "relevé du " + frDate(E.releve) : "dernier relevé") + " · versé " + eur(E.verse) + "</small></p><div><b>≈ " + e10(E.valeur) + "</b><small class=\"" + sens(E.pv) + "\">" + eur(E.pv, 0, true) + " · " + pct(E.pvPct, 1) + "</small></div></div>" +
      (ecart !== null ? '<p class="art-cmp">Attendre le rendez-vous à ce niveau = <b class="' + (ecart >= 0 ? "up" : "down") + '">' + g10(ecart) + "</b> " + (ecart >= 0 ? "de plus" : "de moins") + ".</p>" : "") +
      '<p class="art-gris">Prix de marché : il peut être sous ton versé même si l\'indice est au-dessus du départ ; vendre avant fait perdre la protection.</p>';
  }
  const tableau = '<table class="art-t"><tr><th>Si ça s\'arrête en</th><th>Gain</th><th>Tu récupères</th><th>Par an</th></tr>' +
    E.ech.map(e => '<tr class="' + (p && e.ev === p.ev ? "on" : "") + (e.ev < E.auj ? " passe" : "") + '"><td>' + moisAn(e.ev) + (e.fin ? " · fin" : "") + '</td><td class="up">+' + pc1(E.verse ? e.gain / E.verse : netArt(E.ech.indexOf(e))) + " %</td><td>" + e10(e.montant) + "</td><td>≈ " + pct(e.tra, 1, false) + "</td></tr>").join("") +
    '<tr class="note"><td colspan="4">Une ligne = le cas où l\'indice est au moins à son départ ce jour-là (et ne l\'était pas avant). À la fin seulement, s\'il ne l\'a jamais retrouvé : entre 60 et 100 % → ≈ ' + e10(E.finPlat) + " (ton capital moins les frais) · sous 60 % → perte égale à la baisse.</td></tr></table>";
  const bientot = p && jours(E.auj, p.ev) <= 10 && jours(E.auj, p.ev) > 0 ? '<div class="art-alerte">🔔 <b>Rendez-vous Artema le ' + jourMois(p.ev) + "</b> : pense à saisir le niveau de clôture de l'indice ce jour-là pour savoir s'il s'arrête.</div>" : "";
  const apres = !E.passe ? "" : '<div class="art-alerte">🎯 Le rendez-vous du ' + jourMois(E.passe.ev) + " est passé. " + (E.arrete ? "L'assureur placera l'argent sur un autre support vers le " + frDate(E.passe.pay) : "Si l'indice était au moins à son départ ce jour-là, Artema a été remboursé le " + frDate(E.passe.pay) + (E.ratio && E.dateAct && E.dateAct >= E.passe.ev ? "" : " (saisis le niveau de clôture du " + frDate(E.passe.ev).slice(0, 5) + " pour en avoir le cœur net)") + " et l'assureur a placé l'argent sur un autre support") + " : <b>choisis où le mettre</b> (Saisir › ordre).</div>";
  return '<div class="art"><button type="button" class="lien art-retour" data-m-aller="patrimoine">‹ Patrimoine</button>' + htmlAFaire("artema") +   // v16.87 : ce qui est dû sur Artema
    '<div class="art-carte"><div class="art-h"><div><b><span class="art-pt"></span>Artema Décembre 2026</b><small>Produit structuré · Natixis · jusqu\'en 2034 au plus</small></div>' +
    '<div class="art-val"><small>versé</small><b>' + eur(E.verse) + "</b>" + (E.estime ? pastilleEstime(E) : "") + "</div></div>" +
    apres + '<div class="art-verdict ' + vc + vieux + '">' + vt + fraicheurArtema(E) + (E.estime ? '<small class="art-gris">' + pastilleEstime(E) + " ajoute ton ordre d'achat pour un calcul exact.</small>" : "") + "</div>" + bientot +
    (avantPhoto || !E.ini ? "" : "<h4>L'indice par rapport à son départ</h4><div class=\"art-jz" + vieux + "\">" + jaugeArtema(E.ratio, false, E) + "</div>") +
    '<h4>' + (avantPhoto ? "Photo de départ" : E.arrete ? "Versement" : "Prochain rendez-vous") + '</h4><div class="art-rdv"><div class="big">' + rbTxt + "<small>" + rbSous + "</small></div><p>" + rdvTxt + "</p></div>" + frise +
    vente +
    '<div class="art-point"><span><b>Nouveau relevé ?</b><small>Valeur de ta ligne (€) et niveau de l\'indice en une fois.</small></span><button class="mini-btn" type="button" data-art-point>🎯 Point Artema</button></div>' +
    "<h4>" + (E.ini ? "Niveau de l'indice" : "Niveau de départ") + "</h4>" + htmlSaisieArtema(E) +
    htmlSim(E) +
    "<h4>L'indice, saisie après saisie</h4>" + htmlCourbeArtema(E) +
    '<details class="art-d"><summary>Tous les rendez-vous</summary>' + tableau + "</details>" +
    htmlIndiceArtema() +
    '<details class="art-d"><summary>Comment marche Artema ?</summary><div class="art-cas"><div><i>📸</i>Déc. 2026 : photo de départ de l\'indice (moyenne des clôtures du 2 au 4 décembre).</div><div><i>⏳</i>Jusqu\'en 2029 : rien ne se passe, la valeur bouge avec les marchés.</div><div><i>🎯</i>Chaque début décembre de 2029 à 2033 : si l\'indice est au moins à son départ → Artema s\'arrête (remboursement anticipé automatique), capital + gain (+' + pc1(netArt(0)) + ' % net de frais la 1re fois). Le gain net grossit d\'environ ' + pc1(pasNetArt()) + ' points par année d\'attente.</div><div><i>🏁</i>1er décembre 2034 : au moins au départ → +' + pc1(netArt(5)) + ' % net · entre −40 % et 0 → capital · sous 60 % du départ → perte égale à toute la baisse.</div><div><i>🙅</i>Rien à décider : sortir avant se fait au prix du marché (protection perdue).</div></div></details>' +
    '<div class="art-mentions">Montants estimés (tes parts, 0,80 %/an de frais du contrat), avant impôts et prélèvements sociaux. · L\'indice retire 50 points par an à son NIVEAU (pas 50 %), un peu chaque jour : vers 1 250 points, c\'est environ 4 % par an (plus si l\'indice baisse, moins s\'il monte). Ce frein finance le gain promis et la protection : l\'indice monte donc moins vite que la bourse, c\'est normal. · Capital soumis au risque de défaut de Natixis. · Fiscalité : rien à l\'arrêt d\'Artema, l\'argent reste dans le contrat.</div>' +
    "</div></div>";
}
/* v20.19 (Théo) : « L'indice et les risques » : composition et risques, d'après la brochure Natixis (données au lancement de l'indice, 31/03/2026) et le DIC */
const INDICE_ARTEMA = {
  pays: [["États-Unis", 60], ["Allemagne", 19.75], ["Pays-Bas", 7.12], ["France", 6.26], ["Espagne", 3.03], ["Italie", 1.61], ["Finlande", 1.55], ["Suède", 0.68]],
  secteurs: [["Matériel électronique", 22.9], ["Semi-conducteurs", 17.27], ["Logiciels", 15.67], ["Conseil / services informatiques", 10.5], ["Fournisseurs d'énergie", 9.24], ["Télécoms et réseaux (installation)", 8.22], ["Centres de données (construction, exploitation)", 8.27], ["Autres (vente, composants, appareils, matières premières, opérateurs)", 7.93]],
  euro: ["A2A", "ASML", "Aurubis", "Boliden", "Capgemini", "Cellnex", "Dassault Systèmes", "Ferrovial", "Infineon", "Nexans", "Nexi", "Nokia", "Prysmian", "SAP", "Siemens", "Siemens Energy", "SPIE", "Telefónica", "Vinci", "Wolters Kluwer"],
  us: ["Adobe", "AMD", "Applied Materials", "Broadcom", "Cisco", "Cognizant", "Constellation Energy", "Digital Realty", "eBay", "Equinix", "First Solar", "HP Enterprise", "HubSpot", "IBM", "MercadoLibre", "Monolithic Power", "Palo Alto Networks", "PG&E", "Seagate", "Workday"]
};
function htmlIndiceArtema() {
  const I = INDICE_ARTEMA, barre = ([n, v]) => '<div class="ai-l"><span>' + esc(n) + '</span><i><b style="width:' + Math.round(v / I.pays[0][1] * 100 * (v <= 60 ? 1 : 1)) + '%"></b></i><em>' + String(v).replace(".", ",") + NBS + "%</em></div>";
  const barreS = ([n, v]) => '<div class="ai-l"><span>' + esc(n) + '</span><i><b style="width:' + Math.round(v / 22.9 * 100) + '%"></b></i><em>' + String(v).replace(".", ",") + NBS + "%</em></div>";
  const echelle = [1, 2, 3, 4, 5, 6, 7].map(k => '<span' + (k === 5 ? ' class="on"' : "") + ">" + k + "</span>").join("");
  return '<details class="art-d art-ind"><summary>L\'indice et les risques</summary>' +
    '<p class="art-gris">40 entreprises de la « chaîne de la digitalisation » (puces, logiciels, data centers, réseaux, énergie), choisies aussi sur des critères ESG : 20 de la zone euro (40 % du poids) et 20 américaines (60 %), pondérées par leur taille en bourse. Indice de SGX, administré par Scientific Beta.</p>' +
    "<h5>Pays</h5>" + I.pays.map(barre).join("") +
    "<h5>Secteurs</h5>" + I.secteurs.map(barreS).join("") +
    '<details class="art-d"><summary>Les 40 entreprises</summary><p class="ai-n"><b>Zone euro</b> · ' + I.euro.map(esc).join(" · ") + '</p><p class="ai-n"><b>États-Unis</b> · ' + I.us.map(esc).join(" · ") + "</p></details>" +
    "<h5>Niveau de risque officiel</h5>" + '<div class="ai-sri" role="img" aria-label="Risque 5 sur 7">' + echelle + '</div><p class="art-gris">5 sur 7 : « entre moyen et élevé » (DIC Natixis).</p>' +
    '<ul class="ai-r">' +
      "<li><b>Pas de garantie du capital</b> : à la fin (déc. 2034), si l'indice est sous 60 % de son départ, tu perds toute la baisse (ex. −45 % → tu récupères 55 %).</li>" +
      "<li><b>Le frein de 50 points</b> : les dividendes réinvestis ont rapporté en moyenne 29 points par an sur 8 ans, moins que les 50 retirés : l'indice perd donc environ 21 points par an par rapport aux actions elles-mêmes.</li>" +
      "<li><b>Gain plafonné</b> : environ " + pc1(pasNetArt()) + " points nets de frais par année d'attente, même si l'indice monte beaucoup plus.</li>" +
      "<li><b>Très concentré sur la tech</b> et à 60 % en dollars : le change € / $ joue aussi.</li>" +
      "<li><b>Risque Natixis</b> : si la banque fait défaut, tu peux tout perdre (notes A+ / A2 / A+).</li>" +
      "<li><b>Frais</b> : 4,47 % à l'entrée, déjà inclus dans le prix (dont jusqu'à 3,6 % de commission pour la banque qui le vend), plus les 0,80 %/an de ton contrat.</li>" +
      "<li><b>Sortie avant l'heure</b> : au prix du marché du jour, avec une perte possible.</li>" +
    "</ul>" +
    '<p class="art-gris">Exemples de la brochure (avant frais du contrat) : indice à 140 % la 3e année → 128,5 % (arrêt) · à 70 % à la fin → 100 % · à 45 % à la fin → 45 %. Source : brochure Natixis (répartition au 31/03/2026) et DIC ; ce n\'est pas un conseil financier.</p>' +
  "</details>";
}
function brancherArtema(v) {
  v.querySelectorAll("[data-m-aller]").forEach(b => b.addEventListener("click", () => { PREF.onglet = b.dataset.mAller; garderPref(); rendre(); window.scrollTo(0, 0); }));
  v.querySelectorAll("[data-art-reg]").forEach(b => b.addEventListener("click", () => faireRappel(b.dataset.artReg)));
  v.querySelectorAll("[data-art-point]").forEach(b => b.addEventListener("click", () => ouvrirPointArtema("point")));
  if (!aArtema()) return;
  let E = null; const etat = () => E || (E = etatArtema());
  // simulateur : l'input ne touche QUE son bloc
  const sim = v.querySelector(".art-sim"), rg = v.querySelector("#art-r"), res = v.querySelector("#art-sim-res"), lab = v.querySelector("#art-sl-l");
  if (sim) sim.addEventListener("toggle", () => { artSim.ouvert = sim.open; });
  if (rg) {
    let zone = zoneSim(artSim.v);
    rg.addEventListener("input", () => {
      const x = +rg.value; artSim.v = x; lab.innerHTML = labelSim(etat(), x); res.innerHTML = resSim(etat(), x, artSim.i);
      const z = zoneSim(x); if (z !== zone) { zone = z; if (window.SONS && SONS.vibrer) SONS.vibrer(18); }
    });
    v.querySelectorAll("[data-art-an]").forEach(b => b.addEventListener("click", () => {
      artSim.i = +b.dataset.artAn; v.querySelectorAll("[data-art-an]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); res.innerHTML = resSim(etat(), artSim.v, artSim.i);
    }));
  }
  // courbe : un point touché → sa date, son niveau, son %
  const zc = v.querySelector("#art-courbe"), tip = v.querySelector("#art-ctip");
  if (zc) zc.addEventListener("click", e => {
    const svg = zc.querySelector("svg"), cs = [...svg.querySelectorAll("circle[data-k]")]; if (!cs.length) return;
    const bx = svg.getBoundingClientRect(), xv = (e.clientX - bx.left) / bx.width * 360;
    let best = cs[0]; cs.forEach(c => { if (Math.abs(+c.getAttribute("cx") - xv) < Math.abs(+best.getAttribute("cx") - xv)) best = c; });
    cs.forEach(c => c.classList.toggle("sel", c === best));
    const [d, n] = etat().histo[+best.dataset.k]; tip.innerHTML = "<b>" + frDate(d) + "</b> · " + ptsIdx(n) + " · <b>" + Math.round(n / etat().ini * 100) + " %</b> du départ";
  });
  const bt = v.querySelector("[data-art-tout]");
  if (bt) bt.addEventListener("click", () => { artCourbeTout = !artCourbeTout; zc.innerHTML = svgCourbeArtema(etat(), artCourbeTout); bt.setAttribute("aria-pressed", String(artCourbeTout)); bt.textContent = artCourbeTout ? "‹ Vue rapprochée" : "Jusqu'en 2034 ›"; });
  // saisie express (même action serveur que le rappel : action « artema »)
  const f = v.querySelector("[data-art-form]"); if (!f) return;
  const tr = f.querySelector(".art-trois");
  if (tr) {
    tr.addEventListener("toggle", () => { artTrois = tr.open; });
    tr.addEventListener("input", () => {
      const c = ["art-c1", "art-c2", "art-c3"].map(id => lireNombre(lireChamp(id)));
      if (c.every(x => x > 0)) $f("art-niv").value = saisieNombre((c[0] + c[1] + c[2]) / 3, 4);
    });
  }
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const quoi = f.dataset.artForm, niv = lireNombre(lireChamp("art-niv")), date = quoi === "actuel" ? lireChamp("art-date") : "", Ex = etat();
    const refus = m => { const z = f.querySelector(".alerte"); if (z) z.remove(); f.querySelector(".art-btns").insertAdjacentHTML("beforebegin", '<div class="alerte err">' + esc(m) + "</div>"); };
    if (!(niv > 0)) return refus("Saisis le niveau de l'indice (ex. 1 234,56).");
    if (quoi === "actuel") {
      if (!/^\d{4}-\d\d-\d\d$/.test(date)) return refus("Indique la date de la clôture.");
      if (date > aujourdhuiISO()) return refus("La date ne peut pas être dans le futur.");
      if (Ex.ini && (niv < Ex.ini / 3 || niv > Ex.ini * 3)) return refus("Niveau très loin du départ (" + ptsIdx(Ex.ini) + ") : faute de frappe ?");
    }
    const btn = f.querySelector('button[type="submit"]'); btn.disabled = true; btn.textContent = "Enregistrement…";
    const rep = await posterFichier({ action: "artema", quoi, niveau: niv, date });
    if (rep.ok) {
      const a = (M.parametres = M.parametres || {}).artema = Object.assign({}, (M.parametres || {}).artema);
      if (quoi === "initial") a.initial = niv; else { a.actuel = niv; a.date = date; if (Array.isArray(a.histo)) a.histo = a.histo.filter(x => String(x[0]).slice(0, 10) !== date).concat([[date, niv]]); }
      artSim.v = null; toast(rep.message || "Enregistré."); signalerCloche(); rendre(); charger(true);
    } else {
      btn.disabled = false; btn.textContent = "Enregistrer";
      if (rep.erreur === "cle") { cleRefusee(rep.message); toast("Clé refusée par ton fichier."); rendre(); return; }
      refus(rep.message || "Erreur inattendue.");
    }
  });
}
function brancherAV(v) {
  const z = v.querySelector("#p-av"); if (!z) return;
  z.addEventListener("click", e => {
    const al = e.target.closest("[data-m-aller]"); if (al) { PREF.onglet = al.dataset.mAller; garderPref(); rendre(); window.scrollTo(0, 0); return; }
    const rg = e.target.closest("[data-av-reg]"); if (rg) { faireRappel(rg.dataset.avReg); return; }
    const b = e.target.closest("[data-av]"); if (!b) return;
    avSel = b.dataset.av; const S = seriesAV(M.supports || []); if (!S) return;
    z.querySelectorAll("[data-av]").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.av === avSel)));
    const c = z.querySelector("#av-courbe"); if (c) c.innerHTML = courbeAV(S, S.s[avSel] ? avSel : "total");
  });
}
function pretHtml() {
  const p = M.prets;
  if (!p || (!p.prochaine && !p.actuel)) return "";
  const cell = (lab, val, sous) => "<div><span>" + lab + "</span><b>" + val + "</b>" + (sous ? "<small>" + sous + "</small>" : "") + "</div>";
  return '<div class="m-pret">' +
    (p.prochaine ? (p.banque   // v16.83 : tableau de la banque (profil simple) : l'échéance contient déjà l'assurance, et c'est ta part
      ? cell("Prochaine échéance", eur(p.prochaine.echeance, 2), "le " + frDate(p.prochaine.date) + " · assurance comprise (ta part)")
      : cell("Prochaine échéance", eur(p.prochaine.echeance + (p.prochaine.assurance || 0), 2), "le " + frDate(p.prochaine.date) + (p.prochaine.assurance ? " · assurance comprise (" + eur(p.prochaine.assurance, 2) + ")" : p.prochaine.assurance === 0 ? "" : " · hors assurance"))) : "") +
    (p.actuel ? cell("Capital restant dû", eur(p.actuel.restant), "après l'échéance du " + frDate(p.actuel.date)) : "") +
    cell("Intérêts payés en " + new Date().getFullYear(), eur(p.interetsAnnee), "prêt classique") +
    (p.fin ? cell(/^dans /.test(dansDuree(p.fin)) ? "Fin des prêts dans" : "Fin des prêts", dansDuree(p.fin).replace(/^dans /, ""), "le " + frDate(p.fin) + (p.interetsRestants ? " · encore " + eur(p.interetsRestants) + " d'intérêts" : "")) : (p.prochaine ? cell("Après la prochaine", eur(p.prochaine.restant), "restant dû") : "")) +
    "</div>";
}
/* ---- V15.4 · Marchés : 8 cases (variation du jour, lue dans le Versus), courbe d'un an au toucher, « Comparer » en base 100 ---- */
const COUL_MK = ["#5B8DEF", "#2BB673", "#9B6BFF", "#E5484D", "#F2A33A", "#18A9C7", "#D6619E", "#C9A227", "#8C7B5A", "#E8590C", "#F7931A", "#627EEA", "#00B3A4", "#B8336A"];   // v20.35 : 13e Semi-conducteurs, 14e Semis ×3   // v19.0 : 11e Bitcoin, 12e Ethereum   // v17.41 : 10e = Nasdaq ×3
let marcheOuvert = "cmp", mkTemp = null;   // lot 62 c (Théo) : la comparaison est toujours là ; un nombre = la courbe d'un seul marché (toucher long)   // lot 62 : mkTemp = vue passagère (« Comparer l'or couvert et non couvert »), jamais mémorisée
/* lot 62 (Théo, Conseil) : « Comparer » montre 4 courbes par défaut (le monde, les États-Unis, la tech, l'or) ; les autres s'allument d'un toucher
   sur leur pastille. C'est un filtre : le choix est mémorisé sur l'appareil (PREF.mkVis = noms affichés). */
const MK_DEFAUT = ["S&P 500", "MSCI Monde", "Nasdaq-100", "Or"];
function mkVisibles(noms) {
  if (mkTemp) return mkTemp;
  const l = Array.isArray(PREF.mkVis) ? PREF.mkVis.filter(n => noms.includes(n)) : null;
  if (l && (l.length || PREF.mkVis.length === 0)) return new Set(l);
  const d = MK_DEFAUT.filter(n => noms.includes(n)); return new Set(d.length ? d : noms.slice(0, 4));
}
function mkBasculer(nom, noms) { const s = new Set(mkVisibles(noms)); if (s.has(nom)) s.delete(nom); else s.add(nom); mkTemp = null; PREF.mkVis = noms.filter(n => s.has(n)); garderPref(); }
function mkParDefaut() { return !mkTemp && !Array.isArray(PREF.mkVis); }
function marchesMoi() { const Dv = dVersus(); const m = Dv && Dv.marchesMoi; if (!(m && (m.jour || []).length)) return null;
  // v17.49 (Théo) : l'or en deux cases côte à côte, « Or non couvert » puis « Or couvert € » (sa variation vient des clôtures, comme le ×3)
  const i = m.jour.findIndex(x => x.nom === "Or");
  if (i >= 0 && !m.jour.some(x => x.nom === "Or couvert €") && (m.series || []).some(x => x.nom === "Or couvert €")) m.jour.splice(i + 1, 0, { nom: "Or couvert €", pct: null, heure: "" });
  return m; }
const CRYPTO_MK = ["Bitcoin", "Ethereum"];   // v19.0 (Théo) : deux cryptos « pour rigoler », 24 h sur 24
const NOMS_MK = { "Or": "Or non couvert", "Or couvert €": "Or couvert", "Semi-conducteurs": "Semi-conducteurs" };
/* v20.35 (Théo, 24/11) : 6 marchés en vue, les autres derrière « + N autres » (ceux dont la courbe est affichée restent toujours visibles) */
const PRIO_MK = ["S&P 500", "Nasdaq-100", "Nasdaq ×2", "Semi-conducteurs", "Or", "Bitcoin"];   // v17.49 : nom affiché dans la case (le nom technique reste « Or »)
/* v17.41 (Théo) : les cases suivent la période de la carte Bourse (Jour · 5 j · 1 M · 6 M · Janv. · 1 an), mêmes bornes (`debutPer`).
   Source : clôtures quotidiennes `quot` (serveur Versus V63) ; à défaut, les courbes hebdomadaires (≈). En « Jour », bourse fermée :
   la dernière séance du marché (clôture / clôture d'avant) au lieu d'un tiret. En séance, la variation en direct s'ajoute à la dernière clôture. */
function closMk(nom) {   // { d: [aaaammjj], v: [cours] } sans trous, du plus ancien au plus récent ; hebdo = true si seulement les semaines
  const m = marchesMoi(), q = m && m.quot, out = { d: [], v: [], hebdo: false };
  const sq = q && (q.s || []).find(x => x.nom === nom);
  if (sq && (q.d || []).length) { q.d.forEach((d, i) => { if (sq.v[i] > 0) { out.d.push(+d); out.v.push(sq.v[i]); } }); return out; }
  const se = serieMk(nom); if (!se) return out; out.hebdo = true;
  (m.semaines || []).forEach((k, i) => { const v = se.v[i]; if (v > 0 && (!out.v.length || v !== out.v[out.v.length - 1] || i === m.semaines.length - 1)) { out.d.push(+k.replace(/-/g, "")); out.v.push(v); } });
  return out;
}
/** lot 61 : bornes communes aux cases ET aux courbes (une seule règle) : i0 = la clôture de départ (dernière ≤ début de la période) */
function bornesMk(x, per) {
  const c = closMk(x.nom), n = c.v.length, live = typeof x.pct === "number";
  // v18.7 : la variation du Versus est celle de SA séance (« 20/11 17:35 ») : elle ne s'ajoute que si l'historique s'arrête avant cette séance (pas de double compte le lundi matin)
  const mh = /^(\d{2})\/(\d{2})/.exec(x.heure || ""), a0 = new Date(), yh = mh && +mh[2] > a0.getMonth() + 1 ? a0.getFullYear() - 1 : a0.getFullYear();
  const auj = mh ? yh * 10000 + +mh[2] * 100 + +mh[1] : +isoJour(a0).replace(/-/g, "");
  const dLast = n ? c.d[n - 1] : 0, enDirect = !!(n && live && !c.hebdo && dLast < auj), fin = enDirect ? dateNum(auj) : dateNum(Math.min(dLast || auj, auj));   // hebdo : la clé de la semaine est son vendredi
  const num = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  let i0 = -1;
  if (n && per === "5j" && !c.hebdo) i0 = n - 1 - (enDirect ? 4 : 5);   // 5 séances : la clôture d'avant la 1re (aujourd'hui compte en séance)
  else if (n) {
    const d0 = per === "5j" ? new Date(fin.getFullYear(), fin.getMonth(), fin.getDate() - 7, 12) : debutPer(per, fin), c0 = num(d0);
    c.d.forEach((d, i) => { if (d <= c0) i0 = i; });
    if (i0 >= 0 && (d0 - dateNum(c.d[i0])) / 864e5 > (c.hebdo ? 8 : 6)) i0 = -1;   // historique trop court : pas de chiffre inventé
    if (i0 < 0 && per === "tout") i0 = 0;   // lot 63 : « Tout » : le plus ancien disponible (dit sous la courbe)
  }
  const vide = !n || i0 < 0 || (i0 >= n - 1 && !enDirect);
  return { c, n, i0, enDirect, auj, vide };
}
function varMk(x, per) {   // → { v, du (aaaa-mm-jj de la séance montrée, null = en direct), hebdo }
  const iso = k => String(k).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  if (!per) {
    const c = closMk(x.nom), n = c.v.length;
    if (typeof x.pct === "number") {   // v18.7 : le Versus donne la variation de la DERNIÈRE séance même bourse fermée ; datée si ce n'est pas aujourd'hui
      const m = /^(\d{2})\/(\d{2})/.exec(x.heure || ""), a = new Date(), y = m && +m[2] > a.getMonth() + 1 ? a.getFullYear() - 1 : a.getFullYear(), d = m ? y + "-" + m[2] + "-" + m[1] : null;
      return { v: x.pct, du: d && d !== isoJour(a) ? d : null };
    }
    if (n < 2 || c.hebdo) return { v: null };
    return { v: c.v[n - 1] / c.v[n - 2] - 1, du: iso(c.d[n - 1]) };
  }
  const B = bornesMk(x, per), c = B.c, n = B.n; if (B.vide) return { v: null };
  let v = c.v[n - 1] / c.v[B.i0] - 1; if (B.enDirect) v = (1 + v) * (1 + x.pct) - 1;
  return { v, du: B.enDirect || c.hebdo ? null : iso(c.d[n - 1]), hebdo: c.hebdo };
}
/** lot 61 (Théo) : la courbe suit la période choisie (dans les 2 sens avec la carte Bourse). → { d: [aaaammjj], v, hebdo } ou null.
    Départ = la même clôture que la case (base 100), fin = dernière clôture (+ le point en direct en séance). Clôtures quotidiennes `quot` ;
    « 1 an » : une valeur par semaine (dernière clôture de chaque semaine, départ et fin gardés) ; sans `quot` : les semaines (≈). */
function fenMk(x, per) {
  const B = bornesMk(x, per); if (B.vide) return null;
  let d = B.c.d.slice(B.i0), v = B.c.v.slice(B.i0);
  if ((per === "1a" || per === "tout") && !B.c.hebdo) {
    const sem = k => { const t = dateNum(k); t.setDate(t.getDate() + ((5 - t.getDay() + 7) % 7)); return isoJour(t); };
    const gard = d.map((k, i) => i === 0 || i === d.length - 1 || sem(k) !== sem(d[i + 1]));
    d = d.filter((k, i) => gard[i]); v = v.filter((k, i) => gard[i]);
  }
  if (B.enDirect) { d.push(B.auj); v.push(v[v.length - 1] * (1 + x.pct)); }
  return d.length > 1 ? { d, v, hebdo: B.c.hebdo } : null;
}
/** période des courbes : celle de la carte ; « Jour » (ou pas de pastilles) → 5 séances, et sans clôtures quotidiennes → 1 an comme avant */
function perCourbe() { const p = PERIODES_J[VUEJ] ? VUEJ : null; if (p) return p; const m = marchesMoi(); return m && m.quot && seanceDu() ? "5j" : "1a"; }
function txtBase(d0, per, hebdo) {
  const t = dateNum(d0), j = t.getDate() === 1 ? "1er" : t.getDate();
  const pj = PERIODES_J[VUEJ] ? "" : per === "5j" ? "« Jour » : la courbe montre les 5 dernières séances. " : "";
  return pj + "Base 100 au " + j + " " + ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"][t.getMonth()] + " " + t.getFullYear() + " (" + PERIODES_J[per][2] + ")" + (hebdo || per === "1a" || per === "tout" ? ", une valeur par semaine" + (hebdo ? " (≈)" : "") : ", une clôture par séance");
}
function htmlMarches() {
  const m = marchesMoi(), h = (m.jour.find(x => x.heure) || {}).heure, per = PERIODES_J[VUEJ] ? VUEJ : null;
  const vs = m.jour.map(x => varMk(x, per)), dus = vs.map(r => r.du).filter(Boolean).sort(), duMax = dus[dus.length - 1], tousSeance = vs.every((r, i) => r.du || r.v === null || CRYPTO_MK.includes(m.jour[i].nom));   // v19.0 : la crypto cote en continu, elle ne change pas « bourse fermée »
  const jc = iso => { const d = new Date(iso + "T12:00:00"); return JOURS_C[d.getDay()] + " " + frDate(iso).slice(0, 5); };
  const sous = per ? PERIODES_J[per][2] + (vs.some(r => r.hebdo) ? " (≈ d'après les cours de la semaine)" : "")
    : tousSeance && duMax ? (bourseFermee().ferme ? "🔒 bourse fermée · " : "") + "dernière séance · " + jc(duMax) : (h ? "cours du " + esc(h.replace(" ", " à ").replace(":", " h ")) : "");
  const marque = r => r.du && (!tousSeance || r.du !== duMax) ? "<small>" + frDate(r.du).slice(0, 5) + "</small>" : "";   // marché en retard sur les autres (ex. ×3 avant l'ouverture de New York)
  /* lot 62 c (Théo) : plus de grille de 12 cases (doublon) : une pastille par marché = son % sur la période de la barre du bas ET l'interrupteur de sa courbe
     (pleine = affichée, pointillée = masquée) ; un toucher long = la courbe de ce marché seul */
  const noms = m.series.map(x => x.nom), S = mkVisibles(noms), fm = fenMoi(perCourbe()), pm = (M.synthese || {}).jourPct;   // lot 63 : le % de la carte du haut, pour la même période
  const moi = fm ? '<button type="button" class="chip m-mk-moi' + (moiVisible() ? " on" : "") + '" data-mk-moi="1" aria-pressed="' + moiVisible() + '" style="--mkc:var(--ink)"><i></i><span>' + NOM_MOI + '</span><b class="' + sens(pm) + '">' + (ok(pm) ? pct(pm, per && per !== "5j" ? 1 : 2) : "—") + "</b></button>" : "";
  return '<div class="m-mk"><div class="m-mk-t"><h2 class="sec">Marchés <small>' + sous + "</small></h2></div>" +
    '<div class="m-mk-chips" role="group" aria-label="Marchés : touche pour afficher ou masquer la courbe, toucher long pour la courbe seule">' + moi + m.jour.map((x, i) => { const r = vs[i], k = noms.indexOf(x.nom), on = S.has(x.nom);
      if (PREF.mkTout !== true && !PRIO_MK.includes(x.nom) && !on) return "";   // v20.35 : rangé derrière « + N autres »
      const vk = volMk(x.nom);
      return '<button type="button" class="chip' + (on ? " on" : "") + (vk ? " avec-vo" : "") + '" data-mk-cache="' + esc(x.nom) + '" data-mk-i="' + i + '" aria-pressed="' + on + '" style="--mkc:' + (k >= 0 ? COUL_MK[k % COUL_MK.length] : "var(--ink-3)") + '"' + (r.du ? ' title="Séance du ' + frDate(r.du) + '"' : "") + '><i></i><span>' + esc(NOMS_MK[x.nom] || x.nom) + '</span><b class="' + sens(r.v) + '">' + marque(r) + (ok(r.v) ? pct(r.v, per && per !== "5j" ? 1 : 2) : "—") + "</b>" + pastilleVol(vk) + "</button>"; }).join("") + (() => { const n = m.jour.filter(x => !PRIO_MK.includes(x.nom) && !S.has(x.nom)).length; return PREF.mkTout === true ? '<button type="button" class="chip m-mk-plus" data-mk-plus="1" aria-expanded="true">Moins ▴</button>' : n ? '<button type="button" class="chip m-mk-plus" data-mk-plus="1" aria-expanded="false">+ ' + n + " autre" + (n > 1 ? "s" : "") + " ▾</button>" : ""; })() + "</div>" +
    '<div class="m-mk-panneau" id="m-mk-panneau">' + panneauMarche() + "</div></div>";
}
/** lot 63 (Théo) : « Mon portefeuille » dans les courbes : l'indice de l'historique (versements neutralisés), mêmes bornes que les marchés ;
    en séance, son dernier point = la variation du jour de la carte du haut. → { d: [aaaammjj], v } ou null */
const NOM_MOI = "Mon portefeuille";
function fenMoi(per) {
  const h = M && !M.simple && M.historique, cols = h && h.cols || [], rows = h && h.rows || [], ki = cols.indexOf("ip"); if (ki < 0 || rows.length < 2) return null;
  const c = { d: [], v: [] }; rows.forEach((r, i) => { if (!(r[ki] > 0)) return; if (c.v.length && r[ki] === c.v[c.v.length - 1] && i < rows.length - 1) return; c.d.push(+r[0]); c.v.push(r[ki]); });   // une valeur par séance
  const auj = +isoJour(new Date()).replace(/-/g, ""), n = c.v.length, direct = LIVEJ !== null && n && c.d[n - 1] < auj;
  const fin = direct ? dateNum(auj) : dateNum(c.d[n - 1]), num = d => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  let i0 = -1;
  if (per === "5j") i0 = Math.max(0, n - 1 - (direct ? 4 : 5));
  else if (per === "tout") i0 = 0;
  else { const d0 = debutPer(per, fin), c0 = num(d0); c.d.forEach((d, i) => { if (d <= c0) i0 = i; });
    /* v20.65 (Clément) : historique à trous (photos mensuelles, puis quotidiennes) : pas de point ≤ 6 j avant le début →
       la courbe part du PREMIER point à l'intérieur de la période (base 100 sur lui) au lieu de disparaître */
    if (i0 < 0 || (d0 - dateNum(c.d[i0])) / 864e5 > 6) { i0 = c.d.findIndex(d => d > c0); if (i0 < 0) i0 = n - 1; } }
  if (i0 < 0) return null;
  let d = c.d.slice(i0), v = c.v.slice(i0);
  if (per === "1a" || per === "tout") { const sem = k => { const t = dateNum(k); t.setDate(t.getDate() + ((5 - t.getDay() + 7) % 7)); return isoJour(t); };
    const g = d.map((k, i) => i === 0 || i === d.length - 1 || sem(k) !== sem(d[i + 1])); d = d.filter((k, i) => g[i]); v = v.filter((k, i) => g[i]); }
  if (direct) { d.push(auj); v.push(v[v.length - 1] * (1 + LIVEJ)); }
  return d.length > 1 ? { d, v } : null;
}
function moiVisible() { return PREF.mkMoi !== false; }   // affichée par défaut, masquable comme les autres
function serieMk(nom) { const m = marchesMoi(); return m && (m.series || []).find(x => x.nom === nom); }
function courbesSVG(lignes, base100, per) {   // lot 61 : lignes = [{ nom, d: [aaaammjj], v, c }] ; abscisse = le temps (les séances manquantes d'un marché ne décalent rien)
  const W = 320, H = 150, g = 34, dr = 6, hb = 18;
  lignes = lignes.filter(l => l.d && l.d.length > 1); if (!lignes.length) return "";
  const pts = lignes.map(l => l.v.map(x => base100 ? x / l.v[0] * 100 : x));
  const tous = pts.flat(); let lo = Math.min(...tous), hi = Math.max(...tous); const mg = (hi - lo) * .08 || 1; lo -= mg; hi += mg;
  const ts = lignes.map(l => l.d.map(k => dateNum(k).getTime())), t0 = Math.min(...ts.map(t => t[0])), t1 = Math.max(...ts.map(t => t[t.length - 1]));
  const X = t => g + (t - t0) / Math.max(1, t1 - t0) * (W - g - dr), Y = v => 6 + (hi - v) / (hi - lo) * (H - 6 - hb);
  const fmt = v => base100 ? (hi - lo < 6 ? v.toFixed(1).replace(".", ",") : Math.round(v)) : v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2);
  const MC = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const lab = t => { const d = new Date(t); return per === "1a" || per === "tout" ? MC[d.getMonth()] + " " + String(d.getFullYear()).slice(2) : dateCourte(d); };
  const grille = [lo + mg, (lo + hi) / 2, hi - mg].map(v => '<line x1="' + g + '" x2="' + (W - dr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="gr"/><text x="' + (g - 4) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + fmt(v) + "</text>").join("");
  const b100 = base100 && lo < 100 && hi > 100 ? '<line x1="' + g + '" x2="' + (W - dr) + '" y1="' + Y(100).toFixed(1) + '" y2="' + Y(100).toFixed(1) + '" class="b100"/>' : "";
  const peu = Math.max(...pts.map(p => p.length)) <= 8;   // 5 séances : on voit chaque clôture
  const traits = pts.map((p, k) => { const xy = p.map((v, i) => [X(ts[k][i]), Y(v)]), L = lignes[k], dd = peu ? "M" + xy.map(q => q[0].toFixed(1) + " " + q[1].toFixed(1)).join("L") : lisse(xy);
    const st = c => /^var\(/.test(c) ? ' style="stroke:' + c + '"' : ' stroke="' + c + '"';   // lot 63 : une couleur du thème (var(--ink)) passe par style
    return (L.halo ? '<path fill="none"' + st(L.halo) + ' stroke-opacity=".35" stroke-width="' + ((L.w || 2.2) + 4) + '" stroke-linejoin="round" stroke-linecap="round" d="' + dd + '"/>' : "") +
      '<path fill="none"' + st(L.c) + ' stroke-width="' + (L.w || (lignes.length > 1 ? 1.6 : 2.2)) + '" stroke-linejoin="round" stroke-linecap="round" d="' + dd + '"/>' +
      (peu && lignes.length === 1 ? xy.map(q => '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="2.4" fill="' + lignes[k].c + '"/>').join("") : ""); }).join("");
  return '<svg class="m-mk-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(lignes.map(l => l.nom).join(", ")) + " sur " + (PERIODES_J[per] ? PERIODES_J[per][2] : "un an") + '">' + grille + b100 + traits +
    '<text x="' + g + '" y="' + (H - 4) + '">' + lab(t0) + '</text><text x="' + (W - dr) + '" y="' + (H - 4) + '" text-anchor="end">' + lab(t1) + "</text></svg>";
}
function panneauMarche() {
  const m = marchesMoi(); if (!m || marcheOuvert === null || !(m.semaines || []).length) return "";
  const per = perCourbe(), cas = nom => m.jour.find(x => x.nom === nom) || { nom, pct: null };
  const varF = f => f ? f.v[f.v.length - 1] / f.v[0] - 1 : null, debut = fs => fs.filter(Boolean).map(f => f.d[0]).sort((a, b) => a - b)[0];
  if (marcheOuvert === "cmp") {
    /* lot 50 (Théo) : pastilles dans l'ordre des cases (« Nasdaq ×3 » juste après « Nasdaq ×2 ») ; chaque courbe garde sa couleur */
    const rang = nom => { const i = m.jour.findIndex(x => x.nom === nom); return i < 0 ? 99 : i; };
    const lignes = m.series.map((x, i) => Object.assign({ nom: x.nom, c: COUL_MK[i % COUL_MK.length], i }, fenMk(cas(x.nom), per) || { d: null, v: [] })).sort((a, b) => rang(a.nom) - rang(b.nom) || a.i - b.i);
    const S = mkVisibles(lignes.map(l => l.nom)), vis = lignes.filter(l => S.has(l.nom) && l.d), fm = moiVisible() ? fenMoi(per) : null;
    if (fm) vis.push({ nom: NOM_MOI, d: fm.d, v: fm.v, c: "var(--ink)", w: 2.6, halo: couleurMoi() });   // lot 63 : toujours au premier plan (dessinée en dernier)
    const d0 = debut(vis.length ? vis : lignes.filter(l => l.d)), dm = per === "tout" && fm ? fm.d[0] : null, dmk = per === "tout" ? debut(vis.filter(l => l.nom !== NOM_MOI)) : null;
    const autre = !mkParDefaut() ? '<button class="lien" type="button" data-mk-defaut="1">Revenir aux 4 courbes de base</button>' : "";
    return (vis.length ? courbesSVG(vis, true, per) || '<p class="info">Pas encore assez d\'historique pour cette période.</p>' : '<p class="info m-mk-rien">Aucune courbe : touche une pastille pour l\'afficher.</p>') +
      '<p class="info m-mk-base">' + (d0 ? txtBase(d0, per, lignes.some(l => l.hebdo)) + ". " : "") + (dm && dmk && dmk > dm ? "Les marchés n'ont pas d'historique avant le " + frDate(isoN(dmk)) + " : leurs courbes partent de là. " : "") + "ETF en euros (Or couvert ≈ GLD, Nasdaq ×3 ≈ TQQQ). " + (m.jour.some(x => volMk(x.nom)) ? "Vol. = volatilité 1 an (🟢 moins de 15 % · 🟠 15 à 30 % · 🔴 plus de 30 %). " : "") + "Toucher long : un marché seul. " + autre + "</p>";
  }
  const j = m.jour[marcheOuvert], se = j && serieMk(j.nom); if (!se) return '<p class="info">Pas d\'historique pour ce marché.</p>';
  // lot 61 : les repères 1 mois · 6 mois · 1 an suivent la même règle que les cases (plus les semaines ≈ quand les clôtures existent) ; la période choisie en premier
  const c = COUL_MK[m.series.indexOf(se) % COUL_MK.length], f = fenMk(j, per), t = (lab, v, fort) => ok(v) ? '<span' + (fort ? ' class="m-mk-per"' : "") + ">" + lab + ' <b class="' + sens(v) + '">' + pct(v, 1) + "</b></span>" : "";
  const vo = volMk(j.nom);
  return '<div class="m-mk-res"><button class="lien" type="button" data-mk="cmp">← Tous</button><b>' + esc(NOMS_MK[j.nom] || j.nom) + "</b>" + pastilleVol(vo) + (f ? t(PERIODES_J[per][2], varF(f), true) : "") + ["1m", "6m", "1a"].filter(k => k !== per).map(k => t(PERIODES_J[k][2], varMk(j, k).v)).join("") + "</div>" +
    (f ? courbesSVG([{ nom: se.nom, d: f.d, v: f.v, c: c }], true, per) + '<p class="info m-mk-base">' + txtBase(f.d[0], per, f.hebdo) + ".</p>" : '<p class="info">Pas encore assez d\'historique pour cette période.</p>') +
    (vo ? '<p class="info m-mk-vo">' + VOL_AIDE + (vo.an ? "" : " * moins d'un an de cours : depuis le " + frDate(isoN(vo.deb)) + ".") + " D'après " + vo.n + " séances de ce marché.</p>" : "") +
    (/^Or/.test(j.nom) && serieMk("Or couvert €") ? '<p class="info">Couvert ou non ? <button class="lien" type="button" data-mk="cmp-or">Comparer l\'or couvert et non couvert</button></p>' : "");
}
function majPastillesMk(z) {
  const m = marchesMoi(), S = m ? mkVisibles(m.series.map(x => x.nom)) : new Set(), seul = typeof marcheOuvert === "number";
  z.querySelectorAll("[data-mk-cache]").forEach(b => { const on = S.has(b.dataset.mkCache), sel = seul && +b.dataset.mkI === marcheOuvert; b.classList.toggle("on", seul ? sel : on); b.setAttribute("aria-pressed", String(seul ? sel : on)); });
}
function brancherMarches(v) {
  const z = v.querySelector(".m-mk"); if (!z) return;
  const maj = () => { const pn = z.querySelector("#m-mk-panneau"); pn.innerHTML = panneauMarche(); majPastillesMk(z); };
  majPastillesMk(z);
  let long = null, longFait = false;   // toucher long (0,5 s) sur une pastille = la courbe de ce marché seul
  z.addEventListener("pointerdown", e => { const b = e.target.closest("[data-mk-i]"); if (!b) return; longFait = false; clearTimeout(long);
    long = setTimeout(() => { longFait = true; mkTemp = null; marcheOuvert = +b.dataset.mkI; maj(); if (window.SONS && SONS.vibrer) SONS.vibrer(15); }, 500); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(t => z.addEventListener(t, () => clearTimeout(long)));
  z.addEventListener("contextmenu", e => { if (e.target.closest("[data-mk-i]")) e.preventDefault(); });
  z.addEventListener("click", e => {
    const b = e.target.closest("[data-mk],[data-mk-cache],[data-mk-defaut],[data-mk-moi],[data-mk-plus]"); if (!b) return;
    if (longFait) { longFait = false; return; }
    if (b.dataset.mkPlus) { if (PREF.mkTout === true) delete PREF.mkTout; else PREF.mkTout = true; garderPref(); garderPlace(b, rendre); return; }   // v20.35 : « + N autres » / « Moins »
    const noms = () => marchesMoi().series.map(x => x.nom);
    if (b.dataset.mkMoi) { PREF.mkMoi = !moiVisible(); if (PREF.mkMoi) delete PREF.mkMoi; garderPref(); marcheOuvert = "cmp"; garderPlace(b, () => { maj(); b.classList.toggle("on", moiVisible()); b.setAttribute("aria-pressed", String(moiVisible())); }); return; }
    if (b.dataset.mkCache) { if (!noms().includes(b.dataset.mkCache)) return; mkBasculer(b.dataset.mkCache, noms()); marcheOuvert = "cmp"; garderPlace(b, maj); return; }
    if (b.dataset.mkDefaut) { mkTemp = null; delete PREF.mkVis; garderPref(); marcheOuvert = "cmp"; maj(); return; }
    const k = b.dataset.mk;
    if (k === "cmp-or") { marcheOuvert = "cmp"; mkTemp = new Set(noms().filter(n => /^Or/.test(n))); maj(); return; }   // vue passagère : le choix mémorisé ne bouge pas
    if (k === "cmp") { mkTemp = null; marcheOuvert = "cmp"; maj(); }
  });
}
/* « dans 14 ans 3 mois » jusqu'à une date (aaaa-mm-jj) */
function dansDuree(iso) {
  const f = new Date(String(iso).slice(0, 10) + "T12:00:00"), a = new Date();
  let m = (f.getFullYear() - a.getFullYear()) * 12 + f.getMonth() - a.getMonth(); if (f.getDate() < a.getDate()) m--;
  if (m <= 0) return f > a ? "dans moins d'un mois" : "terminé";
  const ans = Math.floor(m / 12), mo = m % 12;
  return "dans " + (ans ? ans + " an" + (ans > 1 ? "s" : "") : "") + (ans && mo ? " " : "") + (mo ? mo + " mois" : "");
}
function seriePatrimoine() {
  const mpm = M.moisParMois || [];
  const app = (M.parametres || {}).appart || null;
  const mens = (M.prets || {}).mensuel || [];
  const MOISN = { "janv.": 1, "févr.": 2, "mars": 3, "avr.": 4, "mai": 5, "juin": 6, "juil.": 7, "août": 8, "sept.": 9, "oct.": 10, "nov.": 11, "déc.": 12 };
  return mpm.map(r => {
    let an, mo;
    if (/^\d{4}-\d{2}/.test(String(r.mois))) { an = +String(r.mois).slice(0, 4); mo = +String(r.mois).slice(5, 7); }
    else { const p = String(r.mois).split(" "); mo = MOISN[p[0]]; an = +p[1]; }
    if (!an || !mo) return null;
    const finIso = isoJour(new Date(an, mo, 0));
    let immo = 0;
    if (app && app.prix && app.date && finIso >= app.date) {
      let restant = null;
      mens.forEach(x => { if (x[0] <= finIso) restant = x[1]; });
      if (mens.length) immo = app.prix - (restant === null ? mens[0][1] : restant);
      else immo = ((M.immo || []).find(x => /^Valeur nette/.test(x.nom)) || {}).montant || 0;
    }
    const bourse = r.bourse || 0, epargne = (r.epargne || 0) + (r.uc || 0);
    return { an, mo, bourse, epargne, immo, complet: r.epargne !== null && r.epargne !== undefined, total: bourse + epargne + immo };
  }).filter(Boolean);
}
function graduations(mn, mx, n) {
  const brut = (mx - mn) / n || 1, p = Math.pow(10, Math.floor(Math.log10(brut)));
  const pas = [1, 2, 2.5, 5, 10].map(x => x * p).find(x => x >= brut) || 10 * p;
  const a = Math.floor(mn / pas) * pas, b = Math.ceil(mx / pas) * pas;
  const t = []; for (let v = a; v <= b + pas / 2; v += pas) t.push(+v.toFixed(6));
  return t;
}
function brancherPatrimoine(v) {
  brancherAV(v); brancherComparateur(v); brancherProjection(v);
  const re = b => garderPlace(b, rendre);
  v.querySelectorAll("[data-m-patri]").forEach(b => b.addEventListener("click", () => { PREF.patri = b.dataset.mPatri; garderPref(); re(b); }));
  v.querySelectorAll("[data-m-patridet]").forEach(b => b.addEventListener("click", () => { PREF.patriDet = b.dataset.mPatridet; garderPref(); re(b); }));
  dessinerPatrimoine(); dessinerEpargne(); dessinerPret();
  v.querySelectorAll("[data-cible]").forEach(b => b.addEventListener("click", () => { const c = document.getElementById(b.dataset.cible); if (c) c.scrollIntoView({ block: "start", behavior: reduit ? "auto" : "smooth" }); }));
}

/* ================= Onglet Stats ================= */
const PERIODES_M = [["1m", "1 mois"], ["3m", "3 mois"], ["6m", "6 mois"], ["ytd", "YTD"], ["1a", "1 an"], ["tout", "Tout"]];
function seriesDisponibles() {
  const noms = (M.enveloppes || []).filter(e => e.type === "env").map(e => e.nom);
  const cols = (M.historique || {}).cols || [];
  const out = [["ip", "Portefeuille"]];
  [["pea", /PEA/], ["cto", /CTO/], ["av", /^AV|Assurance/i], ["cr", /Crypto/i]].forEach(([k, re]) => { const n = noms.find(x => re.test(x)); if (n && cols.includes(k)) out.push([k, n]); });
  return out;
}
/** Valeur et apports : tout le portefeuille, ou une enveloppe quand le fichier en donne le détail */
function seriesValeur() { const cols = (M.historique || {}).cols || []; return seriesDisponibles().map(([k, l]) => k === "ip" ? ["", "Tout"] : [k, l]).filter(([k]) => !k || cols.includes("v_" + k)); }
/* lot 35 (Théo) : UN seul choix de compte en haut de Stats (Tout · PEA · Assurance-vie · CTO · Crypto), appliqué à TOUS les blocs,
   mémorisé sur l'appareil (PREF.compte, "" = Tout). Seuls les comptes de bourse que la personne possède sont proposés.
   Un bloc qui ne peut pas être calculé pour un compte seul (détail absent du fichier) le dit en une ligne au lieu d'afficher un chiffre faux. */
const COMPTES_S = [["pea", /PEA/, "PEA"], ["av", /^AV|Assurance/i, "Assurance-vie"], ["cto", /CTO/, "CTO"], ["cr", /Crypto/i, "Crypto"]];
function comptesStats() {
  const envs = (M.enveloppes || []).filter(e => e.type === "env"), out = [];
  COMPTES_S.forEach(([k, re, lib]) => { const e = envs.find(x => re.test(x.nom || "")); if (e) out.push({ k, lib, nom: e.nom, env: e }); });
  return out;
}
/** Compte choisi (null = Tout). Avec un seul compte de bourse, pas de choix : Tout. */
function compteS() { const l = comptesStats(); return l.length > 1 ? l.find(c => c.k === PREF.compte) || null : null; }
/** Colonnes de l'historique pour le compte : indice de performance, valeur, versé (−1 si le fichier ne les donne pas) */
function colsS(c) {
  const cols = (M.historique || {}).cols || [];
  return c ? { i: cols.indexOf(c.k), v: cols.indexOf("v_" + c.k), a: cols.indexOf("a_" + c.k) } : { i: cols.indexOf("ip"), v: cols.indexOf("v"), a: cols.indexOf("a") };
}
/** Relevés du compte : Tout = tous ; un compte = à partir de son premier relevé non vide (pas de mois à 0 avant son ouverture) */
function rowsS(c) {
  const h = M.historique, rows = h && h.rows || [];
  if (!c) return rows;
  const k = colsS(c), j = k.v >= 0 ? k.v : k.i, i0 = j < 0 ? -1 : rows.findIndex(r => r[j] > 0);
  return i0 < 0 ? [] : rows.slice(i0);
}
const seulTout = quoi => '<p class="info m-seul">' + quoi + " : disponible pour Tout seulement (ton fichier ne donne pas ce détail par compte).</p>";
function choixCompte() {
  const l = comptesStats(); if (l.length < 2) return "";
  const c = compteS(), b = (k, lib) => '<button class="chip" type="button" data-m-compte="' + k + '" aria-pressed="' + ((c ? c.k : "") === k) + '">' + esc(lib) + "</button>";
  return '<div class="chips m-filtre m-cpt" role="group" aria-label="Compte affiché dans toutes les stats"><span class="k">Compte</span>' + b("", "Tout") + l.map(x => b(x.k, x.lib)).join("") + "</div>";
}
function fenetre(rows, per) {
  if (!rows.length || per === "tout") return rows;
  const cle = cleFenetre(rows, per);
  let i0 = 0; rows.forEach((r, i) => { if (r[0] <= cle) i0 = i; });
  return rows.slice(i0);
}
/** date de début (aaaammjj) demandée pour la période, comptée depuis le dernier relevé (sert à fenetre et à la volatilité de la période) */
function cleFenetre(rows, per) {
  const fin = dateNum(rows[rows.length - 1][0]);
  const nm = ({ "1m": 1, "3m": 3, "6m": 6, "1a": 12 }[per] || 6), mDeb = new Date(fin.getFullYear(), fin.getMonth() - nm, 1);
  /* v16.83 : le 31 mai − 3 mois = le 28/29 février (et non le 3 mars) : jour borné au dernier jour du mois visé */
  const debut = per === "ytd" ? new Date(fin.getFullYear() - 1, 11, 31) : new Date(mDeb.getFullYear(), mDeb.getMonth(), Math.min(fin.getDate(), new Date(mDeb.getFullYear(), mDeb.getMonth() + 1, 0).getDate()));
  return debut.getFullYear() * 10000 + (debut.getMonth() + 1) * 100 + debut.getDate();
}
/* lot 27 (Conseil validé par Théo) : Stats = « ma bourse en profondeur ». Ordre : bandeau du mois, courbe « Contre le marché »,
   Mois par mois (€ par défaut), Risque (ouvert, courbe des baisses), records perso, Répartition, Performances et Frais repliés.
   Le patrimoine dans le temps, la Projection 2034, l'épargne livret par livret et le prêt sont dans Patrimoine. */
const MODES_C = [["base", "Contre le marché"], ["gain", "Gain cumulé (€)"], ["valeur", "Valeur et apports"]];
function modeCourbe() { return MODES_C.some(x => x[0] === PREF.mode) ? PREF.mode : "base"; }
function htmlStats() {
  const h = M.historique, envs = M.enveloppes || [];
  if (!PERIODES_M.some(x => x[0] === PREF.per)) PREF.per = "6m";   // lot 50 : période mémorisée absente = 6 mois (par défaut)
  const mode = modeCourbe(), per = PREF.per, c = compteS();
  const derniere = h && h.rows && h.rows.length ? dateNum(h.rows[h.rows.length - 1][0]) : null;
  const courbe = h && h.rows && h.rows.length > 1 ?
    '<div class="chips m-filtre" role="group" aria-label="Type de courbe">' + MODES_C.map(([k, l]) => '<button class="chip" type="button" data-m-mode="' + k + '" aria-pressed="' + (mode === k) + '">' + l + "</button>").join("") + "</div>" +
    '<div class="chips m-filtre" role="group" aria-label="Période">' + PERIODES_M.map(([k, l]) => '<button class="chip" type="button" data-m-per="' + k + '" aria-pressed="' + (per === k) + '">' + l + "</button>").join("") + "</div>" +
    '<div class="m-ecart" id="m-ecart" hidden></div><div id="m-courbe-box"></div><p class="resume" id="m-resume"></p>' : '<div class="vide">Pas encore assez de relevés pour tracer une courbe.</div>';
  return choixCompte() + blocMoisEnCours() +
    '<div><h2 class="sec">' + (c ? esc(c.lib) : "Ma bourse") + ' <small>' + (M.simple ? "fin de mois" : "au jour le jour") + (derniere ? " · relevé du " + dateLongue(derniere) : "") + "</small></h2></div>" + courbe +
    blocMois() + (M.simple ? "" : blocRisque()) + blocJours() + blocRepartition() + blocPerformances(envs) + blocFrais();
}
/* Performances : repliées, 4 colonnes (1 mois, depuis janv., 1 an, depuis le début) ; 1 semaine, 6 mois, MWR et volatilité au toucher d'une ligne */
function blocPerformances(envs) {
  if (!envs.some(e => ["m1", "ytd", "a1", "twr"].some(k => ok(e[k])))) return "";   // rien à montrer (profil simple sans bourse)
  const cS = compteS(); if (cS) envs = [cS.env].concat(envs.filter(e => e.type === "indice"));   // lot 35 : le compte choisi face aux indices
  const pf = cS ? cS.env : envs.find(e => e.type === "total") || envs[0] || {};
  const resume = ["m1", "ytd", "twr"].map((k, i) => '<span>' + ["1 mois", "janv.", "début"][i] + ' <b class="' + sens(pf[k]) + '">' + pct(pf[k]) + "</b></span>").join("");
  const c = (e, k) => '<td class="' + (e.type === "indice" ? "" : sens(e[k])) + '">' + pct(e[k]) + "</td>";
  const ligne = (e, i) => '<tr class="m-pf-r' + (e.type === "indice" ? " indice" : "") + '" tabindex="0" role="button" aria-expanded="false" data-pf="' + i + '"><td>' + esc(e.nom) + ' <i class="m-pf-v" aria-hidden="true">▾</i></td>' + ["m1", "ytd", "a1", "twr"].map(k => c(e, k)).join("") + "</tr>" +
    '<tr class="m-pf-d" data-pf-d="' + i + '" hidden><td colspan="5">1 sem. <b class="' + sens(e.s1) + '">' + pct(e.s1) + "</b> · 6 mois <b class=\"" + sens(e.m6) + '">' + pct(e.m6) + "</b>" +
      (e.type === "indice" ? "" : ' · MWR <b class="' + sens(e.mwr) + '">' + pct(e.mwr) + "</b>") + " · volatilité <b>" + pct(e.vol, 1, false) + "</b></td></tr>";
  return '<details class="acc m-compact" data-acc="m-perf"' + (PREF.acc["m-perf"] ? " open" : "") + '><summary><span class="t">Performances</span><span class="m-cp-r">' + resume + "</span></summary>" +
    '<div><table class="tab m-perf-t m-perf4"><thead><tr><th>Enveloppe</th><th>1 mois</th><th>YTD</th><th>1 an</th><th>Début</th></tr></thead><tbody>' + envs.map(ligne).join("") + "</tbody></table>" +
    '<p class="info">Touche une ligne pour la semaine, les 6 mois, le MWR et la volatilité.</p></div></details>';
}
function dessinerCourbe() {
  const zone = document.getElementById("m-courbe-box"); if (!zone) return;
  const h = M.historique; if (!h || !h.rows || h.rows.length < 2) return;
  const C = n => h.cols.indexOf(n), mode = modeCourbe(), cS = compteS(), kS = colsS(cS);
  const vide = t => { zone.innerHTML = t; const r = document.getElementById("m-resume"); if (r) r.innerHTML = ""; };
  if (cS && (mode === "base" ? kS.i < 0 : kS.v < 0 || kS.a < 0)) return vide(seulTout(mode === "base" ? "Courbe contre le marché" : mode === "gain" ? "Gain cumulé" : "Valeur et apports"));
  const rS = rowsS(cS); if (rS.length < 2) return vide('<div class="vide">Pas encore assez de relevés pour ce compte.</div>');
  const rows = fenetre(rS, PREF.per), mc = couleurMoi(), cb = defObj("courbe", actifM("courbe")) || COURBES_M[0];
  let series;
  const ev = cS ? [cS.k, cS.lib] : null, kv = ev ? "_" + ev[0] : "";
  if (mode === "valeur") {
    series = [{ nom: ev ? "Valeur · " + ev[1] : "Valeur", k: C(kv ? "v" + kv : "v"), c: cb[2] || mc, w: 2.2, aire: true, fx: cb[3] }, { nom: ev ? "Versé · " + ev[1] : "Apports cumulés", k: C(kv ? "a" + kv : "a"), c: "var(--idx)", w: 1.6, marche: true, dash: true }];
  } else if (mode === "gain") {
    const kV = C(kv ? "v" + kv : "v"), kA = C(kv ? "a" + kv : "a");
    series = kV >= 0 && kA >= 0 ? [{ nom: ev ? "Gain · " + ev[1] : "Gain cumulé", k: kV, kA, c: cb[2] || mc, w: 2.2, fx: cb[3], gain: true }] : [];
  } else {
    const ch = cS ? [cS.k, cS.lib] : ["ip", "Portefeuille"];
    series = [{ nom: ch[1], k: C(ch[0]), c: cb[2] || mc, w: 2.2, base: true, fx: cb[3] },
      { nom: "S&P 500 (en €, ETF)", k: C("isp"), c: "var(--idx)", w: 1.6, base: true, dash: "5 4" },
      { nom: "Nasdaq-100", k: C("inq"), c: "var(--gold)", w: 1.6, base: true, dash: "1.5 3.5" }];
  }
  series = series.filter(s => s.k >= 0);
  if (!series.length) { zone.innerHTML = '<div class="vide">Ton fichier ne donne pas encore ce détail.</div>'; return; }
  series.forEach(s => {
    if (s.gain) { s.v = rows.map(r => ok(r[s.k]) && ok(r[s.kA]) ? r[s.k] - r[s.kA] : null); return; }   // gain cumulé = valeur − versé (depuis le début)
    const b = (rows.find(r => ok(r[s.k]) && r[s.k] !== 0) || [])[s.k] || 1; s.v = rows.map(r => ok(r[s.k]) ? (s.base ? r[s.k] / b - 1 : r[s.k]) : null);
  });
  zone.innerHTML = boiteGraphe("g-moi", series.map(s => ({ nom: s.nom, c: s.c, dash: s.dash === "1.5 3.5" ? "dot" : !!s.dash })));
  const court = PREF.per === "1m";
  const etiqX = (k, kp) => {
    if (kp === null) return "";
    const d = dateNum(k), p = dateNum(kp);
    if (court) return d.getDay() < p.getDay() ? dateCourte(d) : "";
    return d.getMonth() !== p.getMonth() ? (d.getMonth() === 0 ? String(d.getFullYear()) : MOIS[d.getMonth()]) : "";
  };
  const base = mode === "base", gain = mode === "gain";
  tracer(document.getElementById("g-moi"), { x: rows.map(r => r[0]), zeroMin: !base, depuisZero: mode === "valeur", ligneZero: gain, base, finEtiq: base,
    series: series.map(s => ({ nom: s.nom, v: s.v, c: s.c, w: s.w, aire: s.aire, marche: s.marche, dash: s.dash, fx: s.fx })),
    fmt: base ? (x => pct(x)) : gain ? (x => eur(x, 0, true)) : (x => eur(x)), fmtAxe: base ? (t => pct(t, 0)) : axeEur, titreX: k => dateLongue(dateNum(k)), etiqX });
  const n = rows.length, d0 = dateNum(rows[0][0]), d1 = dateNum(rows[n - 1][0]);
  const r = document.getElementById("m-resume"), gros = document.getElementById("m-ecart");
  const grand = (val, cls, lab, sous) => { if (!gros) return; gros.hidden = false; gros.innerHTML = '<b class="' + cls + '">' + val + "</b><span>" + lab + (sous ? "<small>" + sous + "</small>" : "") + "</span>"; };
  if (mode === "valeur") {
    const i0 = Math.max(0, series[0].v.findIndex(x => ok(x))), d0b = dateNum(rows[i0][0]);
    const dv = (series[0].v[n - 1] || 0) - (series[0].v[i0] || 0), da = series[1] ? (series[1].v[n - 1] || 0) - (series[1].v[i0] || 0) : 0;
    r.innerHTML = "Du " + dateLongue(d0b) + " au " + dateLongue(d1) + " : valeur <b>" + eur(dv, 0, true) + "</b>, dont apports <b>" + eur(da, 0, true) + '</b>, soit un gain de <b class="' + sens(dv - da) + '">' + eur(dv - da, 0, true) + "</b>. L'axe part de zéro.";
  } else if (gain) {
    const v = series[0].v, i0 = Math.max(0, v.findIndex(x => ok(x))), fin = v[n - 1], d0b = dateNum(rows[i0][0]);
    const kV = series[0].k, kA = rows[n - 1][C(kv ? "a" + kv : "a")];
    grand(eur(fin, 0, true), sens(fin), "gagnés depuis le début", "valeur " + eur(rows[n - 1][kV]) + " − versé " + eur(kA));
    r.innerHTML = "Gain cumulé = valeur moins tout ce que tu as versé : il ne bouge pas quand tu verses, seulement quand la bourse bouge. Du " + dateLongue(d0b) + " au " + dateLongue(d1) + ' : <b class="' + sens(fin - v[i0]) + '">' + eur(fin - (v[i0] || 0), 0, true) + "</b>.";
  } else {
    const p = series[0].v[n - 1], sp = series[1] && series[1].nom.startsWith("S&P") ? series[1].v[n - 1] : null, nq = series.find(s => s.nom === "Nasdaq-100");
    if (ok(p) && ok(sp)) grand(pts(p - sp), sens(p - sp), (p - sp >= 0 ? "d'avance" : "de retard") + " sur le S&amp;P 500", esc(series[0].nom) + " " + pct(p) + " · S&amp;P 500 " + pct(sp) + (nq && ok(nq.v[n - 1]) ? " · Nasdaq " + pct(nq.v[n - 1]) : ""));
    r.innerHTML = "Du " + dateLongue(d0) + " au " + dateLongue(d1) + ' : <b class="' + sens(p) + '">' + pct(p) + "</b>" +
      (ok(sp) ? ", S&amp;P 500 <b>" + pct(sp) + '</b>, écart <b class="' + sens(p - sp) + '">' + pts(p - sp) + "</b>" : "") + ". Indices rebasés au début de la période, apports neutralisés" + (M.simple ? "" : " ; au jour le jour (le Versus compte en fin de mois)") + ".";
  }
}
/* ---- Risque au jour le jour : baisses depuis le plus haut (indice « ip » : sans l'effet de tes versements) ---- */
function baisses(rows, k) {
  let max = -Infinity, iMax = -1, pire = 0, iPic = -1, iCreux = -1;
  const dd = rows.map((r, i) => { const v = r[k]; if (!(v > 0)) return null; if (v > max) { max = v; iMax = i; } const d = v / max - 1; if (d < pire) { pire = d; iCreux = i; iPic = iMax; } return d; });
  let iRetour = -1;
  if (iCreux >= 0) { const cible = rows[iPic][k]; for (let i = iCreux + 1; i < rows.length; i++) if (rows[i][k] >= cible) { iRetour = i; break; } }
  let der = dd.length - 1; while (der > 0 && dd[der] === null) der--;
  return { dd, actuel: dd[der] || 0, pire, iPic, iCreux, iRetour, iMax };
}
function duree(a, b) {   // entre deux dates aaaammjj, en jours (moins de 45 j), sinon en mois / ans
  const j = Math.round((dateNum(b) - dateNum(a)) / 864e5);
  if (j < 45) return j + " jour" + (j > 1 ? "s" : "");
  const m = Math.round(j / 30.44); if (m < 24) return m + " mois";
  return Math.floor(m / 12) + " ans" + (m % 12 ? " et " + (m % 12) + " mois" : "");
}
function svgBaisses(rows, B) {
  const W = 320, H = 132, m = { l: 34, r: 8, t: 8, b: 18 }, iw = W - m.l - m.r, ih = H - m.t - m.b, n = rows.length;
  const bas = Math.min(-.02, B.pire * 1.12), X = i => m.l + (n > 1 ? i / (n - 1) : 0) * iw, Y = v => m.t + (v / bas) * ih;
  const pas = -bas > .3 ? .1 : -bas > .12 ? .05 : -bas > .05 ? .02 : .01;
  let o = "";
  for (let t = 0; t >= bas - 1e-9; t -= pas) o += '<line class="gr" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '"' + (t === 0 ? ' style="stroke:var(--ink-3)"' : "") + '/><text x="' + (m.l - 4) + '" y="' + (Y(t) + 3.5).toFixed(1) + '" text-anchor="end">' + (t === 0 ? "0" : MOINS + Math.round(-t * 100)) + " %</text>";
  let d = "", first = -1, last = -1;
  B.dd.forEach((v, i) => { if (v === null) return; d += (first < 0 ? "M" : "L") + X(i).toFixed(1) + " " + Y(v).toFixed(1); if (first < 0) first = i; last = i; });
  if (B.iCreux >= 0) { const xa = X(B.iPic), xb = X(B.iRetour >= 0 ? B.iRetour : n - 1); o += '<rect class="bz" x="' + xa.toFixed(1) + '" y="' + m.t + '" width="' + Math.max(1, xb - xa).toFixed(1) + '" height="' + ih + '"/>'; }
  if (d) o += '<path class="ba" d="' + d + "L" + X(last).toFixed(1) + " " + Y(0).toFixed(1) + "L" + X(first).toFixed(1) + " " + Y(0).toFixed(1) + 'Z"/><path class="bl" d="' + d + '"/>';
  if (B.iCreux >= 0) { const x = X(B.iCreux), y = Y(B.pire), droite = x > W - 90; o += '<circle class="bp" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.5"/><text class="bt" x="' + (x + (droite ? -6 : 6)).toFixed(1) + '" y="' + Math.min(H - m.b - 2, y + 4).toFixed(1) + '" text-anchor="' + (droite ? "end" : "start") + '">pire ' + pct(B.pire) + "</text>"; }
  const a0 = dateNum(rows[0][0]), a1 = dateNum(rows[n - 1][0]);
  o += '<text x="' + m.l + '" y="' + (H - 4) + '">' + dateCourte(a0) + "/" + String(a0.getFullYear()).slice(2) + '</text><text x="' + (W - m.r) + '" y="' + (H - 4) + '" text-anchor="end">' + dateCourte(a1) + "/" + String(a1.getFullYear()).slice(2) + "</text>";
  return '<svg class="m-mk-svg m-dd" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Baisses depuis le plus haut">' + o + "</svg>";
}
/* Sharpe et volatilité d'une série d'indice sur la dernière année (même méthode pour toi et le S&P : rendements du soir, 252 séances) */
function risqueAn(rows, k) {
  if (k < 0 || rows.length < 30) return null;
  const fin = rows[rows.length - 1][0], deb = fin - 10000, r = [];
  for (let i = 1; i < rows.length; i++) if (rows[i - 1][0] >= deb && rows[i - 1][k] > 0 && rows[i][k] > 0) r.push(rows[i][k] / rows[i - 1][k] - 1);
  if (r.length < 30) return null;
  const moy = r.reduce((a, x) => a + x, 0) / r.length, et = Math.sqrt(r.reduce((a, x) => a + (x - moy) * (x - moy), 0) / (r.length - 1)) * Math.sqrt(252);
  const rf = ((dVersus() || {}).marche || {}).tauxSansRisque || 0;
  return { vol: et, sharpe: et > 0 ? (moy * 252 - rf) / et : null };
}
/** Part des séances en hausse sur la dernière année (indice de performance du compte : sans l'effet des versements) */
function hausseAn(rows, k) {
  if (!rows.length) return null;
  const deb = rows[rows.length - 1][0] - 10000; let n = 0, up = 0;
  for (let i = 1; i < rows.length; i++) if (rows[i - 1][0] >= deb && rows[i - 1][k] > 0 && rows[i][k] > 0) { n++; if (rows[i][k] > rows[i - 1][k]) up++; }
  return n >= 20 ? up / n : null;
}
/* 25/11/2026 (Théo) · VOLATILITÉ de chaque ligne et du portefeuille : écart type des variations quotidiennes sur un an glissant,
   ramené à l'année (× √252), comme « Volatilité 1 an » de Stats › Risque. Moins d'un an de cours : depuis le premier (on le dit).
   Lignes : cours d'un an de la ligne (Volatilite.js du fichier, Yahoo Finance) ; à défaut, le marché équivalent suivi par le Versus (≈).
   Seulement dans la propre appli du joueur : rien ne part vers le Versus. */
function volPoints(pts) {   // pts : [{ d: aaaammjj, v: cours }] du plus ancien au plus récent
  if (!pts || pts.length < 21) return null;
  const fin = pts[pts.length - 1].d, borne = fin - 10000, P = pts.filter(p => p.d >= borne), r = [];
  for (let i = 1; i < P.length; i++) { const q = P[i].v / P[i - 1].v; if (q > .5 && q < 2) r.push(q - 1); }   // ×2 ou ÷2 en un jour : découpage d'ETF, pas une variation
  if (r.length < 20) return null;
  const moy = r.reduce((a, x) => a + x, 0) / r.length, jours = (dateNum(fin) - dateNum(P[0].d)) / 864e5;
  const parAn = jours > 0 && r.length * 365 / jours >= 320 ? 365 : 252;   // coté 7 j / 7 (crypto) : 365 variations par an ; bourse : 252 (comme Stats › Risque)
  return { v: Math.sqrt(r.reduce((a, x) => a + (x - moy) * (x - moy), 0) / (r.length - 1)) * Math.sqrt(parAn), n: r.length, deb: P[0].d, an: pts[0].d <= borne, parAn };
}
/** repère : 🟢 calme < 15 % · 🟠 15-30 % · 🔴 > 30 % */
function feuVol(v) { return v < .15 ? { e: "🟢", m: "calme", c: "calme" } : v <= .30 ? { e: "🟠", m: "agité", c: "agite" } : { e: "🔴", m: "très agité", c: "fort" }; }
/* Lignes sans cours de la ligne : le marché équivalent du Versus (mêmes noms que les cases Marchés) */
const VOL_PROXY = { LQQ: "Nasdaq ×2", QQQ3: "Nasdaq ×3", ANX: "Nasdaq-100", PUST: "Nasdaq-100", PANX: "Nasdaq-100", CNDX: "Nasdaq-100", EQQQ: "Nasdaq-100",
  PSP5: "S&P 500", ESE: "S&P 500", PE500: "S&P 500", CSPX: "S&P 500", "500": "S&P 500", CW8: "MSCI Monde", EWLD: "MSCI Monde", DCAM: "MSCI Monde", WPEA: "MSCI Monde", WLD: "MSCI Monde", IWDA: "MSCI Monde",
  PAEEM: "Émergents", AEEM: "Émergents", EIMI: "Émergents", EMPEA: "Émergents", GOLD: "Or", IGLN: "Or", BTC: "Bitcoin", ETH: "Ethereum", SEME: "Semi-conducteurs", SOXL: "Semis ×3", ETZ: "Stoxx 600", MEUD: "Stoxx 600" };
function volLigne(env, code) {
  try {
    const p = (M.perfLignes || {})[env + "|" + code] || {}, t = String(p.ticker || "").toUpperCase(), x = M.vol && M.vol.t && t ? M.vol.t[t] : null;
    if (x && ok(x.v)) return { v: x.v, n: x.n, deb: +String(x.deb || "").replace(/-/g, "") || null, an: x.an !== false, src: "cours", ticker: t };
    const nom = VOL_PROXY[String(code || "").toUpperCase()];
    if (nom && marchesMoi()) { const c = closMk(nom); if (!c.hebdo && c.d.length) { const r = volPoints(c.d.map((d, i) => ({ d, v: c.v[i] }))); if (r) return Object.assign(r, { src: "marche", nom }); } }
  } catch (e) { /* pas de volatilité plutôt qu'un écran cassé */ }
  return null;
}
/** portefeuille entier : la MÊME valeur que la volatilité de Stats › Risque pour la même période (même fonction, choixRisque).
 *  26/11/2026 (Théo) : suit la période d'Aujourd'hui (1 M, 6 M, YTD, 1 an, Tout) ; « Jour » = 1 an ; 5 j = trop court.
 *  → { v, deb, an (période complète), n, per, court } ; { manque: true, … } si pas assez de cours sur la période ; null sans historique quotidien. */
function volPortefeuille(per) {
  try {
    const h = M.historique; if (M.simple || !h || !h.rows || h.rows.length < 2) return null;   // profil simple : relevés de fin de mois, pas de variations quotidiennes
    const k = h.cols.indexOf("ip"); if (k < 0) return null;
    const c = choixRisque(null, per === undefined ? VUEJ : per);   // exactement le chiffre de Stats › Risque (même fonction)
    if (!ok(c.moiVol)) return c.per === "1a" ? null : { manque: true, n: c.n, per: c.per, deb: c.deb, an: c.an };
    return { v: c.moiVol, deb: c.deb, an: c.an, n: c.n, per: c.per, court: c.court };
  } catch (e) { return null; }
}
function pastilleVol(x) { if (!x || x.manque) return ""; const f = feuVol(x.v);
  return '<span class="nv-vo ' + f.c + '" title="Volatilité ' + (x.per && x.per !== "1a" ? VOL_PER[x.per][0] + (x.an ? "" : " (depuis le " + frDate(isoN(x.deb)) + ")") + (x.court ? " (court : indicatif)" : "") : x.an ? "1 an" : "depuis le " + frDate(isoN(x.deb))) + " : " + f.m + (x.src === "marche" ? " (≈ " + esc(x.nom) + ")" : "") + '"><i aria-hidden="true">' + f.e + "</i> vol. " + (x.src === "marche" ? "≈" : "") + pct(x.v, 0, false) + (x.an ? "" : "*") + "</span>"; }
/** 25/11/2026 (Théo) : volatilité 1 an d'un marché des cases Marchés, depuis ses clôtures quotidiennes déjà reçues (closMk ← marchesMoi().quot),
 *  même calcul que les lignes (volPoints). Seulement les semaines (pas de clôtures quotidiennes) : rien plutôt qu'un chiffre faux. */
function volMk(nom) {
  try { const c = closMk(nom); if (c.hebdo || c.d.length < 21) return null; return volPoints(c.d.map((d, i) => ({ d, v: c.v[i] }))); }
  catch (e) { return null; }
}
const VOL_AIDE = "Vol. = volatilité sur 1 an : à quel point le cours bouge d'un jour à l'autre, ramenée à l'année. 🟢 calme (moins de 15 %) · 🟠 15 à 30 % · 🔴 plus de 30 %.";
/** phrase d'aide sous les lignes (Aujourd'hui) : les lignes restent sur 1 an ; le portefeuille suit la période choisie (26/11/2026, Théo) */
function aideVol(vp, etoileLigne) {
  const etoile = etoileLigne || (vp && !vp.manque && !vp.an && (!vp.per || vp.per === "1a")) ? " * moins d'un an de cours : depuis le premier." : "";
  if (!vp || !vp.per || vp.per === "1a") return VOL_AIDE + etoile;
  const p = VOL_PER[vp.per][0], sur = /^depuis/.test(p) ? p : "sur " + p;   // « depuis janvier » / « depuis le début » sans « sur »
  return "Vol. = volatilité : à quel point le cours bouge d'un jour à l'autre, ramenée à l'année. 🟢 calme (moins de 15 %) · 🟠 15 à 30 % · 🔴 plus de 30 %. " +
    (vp.manque ? "Portefeuille : pas assez de cours " + sur + " pour la calculer." : "Portefeuille : " + sur + (vp.an ? "" : " (depuis le " + frDate(isoN(vp.deb)) + ")") + ", la période choisie" + (vp.court ? " (court : indicatif)" : "") + ".") +
    " Lignes : toujours sur 1 an." + etoile;
}
/** 26/11/2026 (Théo) · la volatilité du PORTEFEUILLE (et celle du S&P 500 à côté, et le Sharpe) suit la PÉRIODE CHOISIE.
 *  1 an : comme avant (valeur du fichier, sinon recalculée). Autres périodes : recalculées ici sur les relevés quotidiens de la période
 *  (mêmes bornes que la courbe, fenetre), même méthode : écart type des variations quotidiennes × √252. Moins de 60 séances : « court : indicatif ».
 *  Moins de 15 séances : pas de chiffre (« pas assez de cours »). Les pastilles des lignes et des marchés restent sur 1 an. */
const VOL_PER = { "5j": ["5 séances", "Vol. 5 séances"], "1m": ["1 mois", "Vol. 1 mois"], "3m": ["3 mois", "Vol. 3 mois"], "6m": ["6 mois", "Vol. 6 mois"],
  "ytd": ["depuis janvier", "Vol. depuis janv."], "1a": ["1 an", "Vol. 1 an"], "tout": ["depuis le début", "Vol. depuis le début"] };
const VOL_MIN = 15, VOL_COURT = 60;
function perVol(p) { return VOL_PER[p] ? p : "1a"; }   // « Jour », « Séance » : 1 an (la référence)
/** relevés de la période (5 séances : les 6 derniers relevés) et si l'historique commence après le début demandé */
function fenVol(R, per) {
  if (!R.length) return { W: [], part: false };
  if (per === "5j") return { W: R.slice(-6), part: R.length < 6 };
  if (per === "tout") return { W: R, part: false };
  return { W: fenetre(R, per), part: R[0][0] > cleFenetre(R, per) };
}
/** volatilité et Sharpe d'une colonne sur des relevés donnés (tous) : { vol, sharpe, n } ; n = nombre de variations ; vol null sous VOL_MIN */
function risqueSur(W, k) {
  const r = [];
  if (k >= 0) for (let i = 1; i < W.length; i++) if (W[i - 1][k] > 0 && W[i][k] > 0) r.push(W[i][k] / W[i - 1][k] - 1);
  if (r.length < VOL_MIN) return { vol: null, sharpe: null, n: r.length };
  const moy = r.reduce((a, x) => a + x, 0) / r.length, et = Math.sqrt(r.reduce((a, x) => a + (x - moy) * (x - moy), 0) / (r.length - 1)) * Math.sqrt(252);
  const rf = ((dVersus() || {}).marche || {}).tauxSansRisque || 0;
  return { vol: et, sharpe: et > 0 ? (moy * 252 - rf) / et : null, n: r.length };
}
/** Sharpe et volatilité du compte (cS, ou tout le portefeuille) et du S&P sur la même période (per, 1 an par défaut).
 *  1 an : ceux de ton fichier quand il les donne ; sinon les deux recalculés ici, de la même façon.
 *  UNE seule fonction : Stats › Risque et la pastille du total (volPortefeuille) lisent la même. */
function choixRisque(cS, per) {
  per = perVol(per);
  const h = M.historique, R = rowsS(cS), k = colsS(cS).i, kS = h.cols.indexOf("isp");
  const envs = M.enveloppes || [], pf = cS ? cS.env : envs.find(e => e.type === "total") || {}, idx = envs.find(e => e.type === "indice" && /S&P/i.test(e.nom || "")) || {};
  if (per !== "1a") {
    const { W, part } = fenVol(R, per), a = risqueSur(W, k), b = risqueSur(W, kS);
    return { moiSh: a.sharpe, spSh: a.vol === null ? null : b.sharpe, moiVol: a.vol, spVol: a.vol === null ? null : b.vol, calc: true, pf, per, n: a.n, court: a.n < VOL_COURT, an: !part, deb: W.length ? W[0][0] : null };
  }
  let moiSh = pf.sharpe, spSh = idx.sharpe, moiVol = pf.vol, spVol = idx.vol, calc = false;
  if (k >= 0 && (!ok(spSh) || (cS && !(ok(moiSh) && ok(moiVol))))) { const a = risqueAn(R, k), b = risqueAn(R, kS); if (a && b) { moiSh = a.sharpe; spSh = b.sharpe; moiVol = a.vol; spVol = b.vol; calc = true; } }
  const fin = R.length ? R[R.length - 1][0] : 0, borne = fin - 10000, deb = R.length ? (R.find(r => r[0] >= borne) || R[0])[0] : null;
  const n = k < 0 ? 0 : R.filter(r => r[0] >= borne).length - 1;
  return { moiSh, spSh, moiVol, spVol, calc, pf, per, n, court: n < VOL_COURT, an: R.length ? R[0][0] <= borne : false, deb };
}
function blocRisque() {
  const h = M.historique; if (!h || !h.rows || h.rows.length < 2) return "";
  const cS = compteS(), k = colsS(cS).i;
  if (k < 0) return cS ? acc("m-risque", "Risque", "au jour le jour", seulTout("Risque"), true) : "";
  const R = rowsS(cS); if (R.length < 2) return "";
  const B = baisses(R, k), dc = i => dateCourte(dateNum(R[i][0])) + "/" + String(R[i][0]).slice(2, 4);
  const X = choixRisque(cS, PREF.per), { moiSh, spSh, moiVol, spVol, calc, pf } = X;
  const pv = VOL_PER[X.per], laPer = { "1a": "la même année", "1m": "le même mois", "3m": "les mêmes 3 mois", "6m": "les mêmes 6 mois" }[X.per] || "la même période";
  const depuis = !X.an && X.deb ? "depuis le " + dc(R.findIndex(r => r[0] === X.deb)) + " · " : "", indic = X.court ? " (court : indicatif)" : "";
  const manque = !ok(moiVol) && X.per !== "1a" ? "pas assez de cours (" + X.n + " séance" + (X.n > 1 ? "s" : "") + ")" : "";
  const hausse = cS && !ok(pf.hausse) ? hausseAn(R, k) : pf.hausse;
  const auHaut = B.actuel > -0.0005;
  const retour = B.iCreux < 0 ? null : B.iRetour >= 0 ? duree(R[B.iCreux][0], R[B.iRetour][0]) : null;
  const phrase = (auHaut ? "Tu es <b>à ton plus haut</b>" : "Tu es à <b class=\"down\">" + pct(B.actuel) + "</b> de ton plus haut") +
    (B.iCreux < 0 ? "." : " ; ta pire baisse, <b>" + pct(B.pire) + "</b>, " + (retour ? "a été effacée en <b>" + retour + "</b>." : "n'est pas encore effacée (creux le " + dc(B.iCreux) + ")."));
  return acc("m-risque", "Risque", M.simple ? "fin de mois" : "au jour le jour", '<div class="m-dd-w">' + svgBaisses(R, B) + '<p class="resume">' + phrase + "</p></div>" +
    '<div class="tuiles m-petit m-t3 m-dd-t">' +
      tuile("Baisse actuelle", pct(B.actuel), sens(B.actuel), auHaut ? "au plus haut" : "plus haut le " + dc(B.iMax)) +
      tuile("Pire baisse", B.iCreux < 0 ? pct(0) : pct(B.pire), B.iCreux < 0 ? "" : "down", B.iCreux < 0 ? "aucune baisse" : "du " + dc(B.iPic) + " au " + dc(B.iCreux)) +
      tuile("Temps de retour", B.iCreux < 0 ? "—" : retour || "pas encore", "", B.iCreux < 0 ? "" : retour ? "du creux au retour, le " + dc(B.iRetour) : "depuis le creux du " + dc(B.iCreux)) +
    "</div>" +
    '<div class="tuiles m-petit m-t3">' +
      tuile(pv[1], ok(moiVol) ? pct(moiVol, 1, false) : "—", "", manque || depuis + (ok(spVol) ? "S&amp;P 500 : " + pct(spVol, 1, false) : "écart type annualisé") + indic,
        "La volatilité mesure l'ampleur des secousses : plus elle est haute, plus ta valeur monte et descend fort d'un jour à l'autre. Elle suit la période choisie en haut (" + pv[0] + ") et se lit en comparaison avec le S&P 500 sur " + laPer + ". Sur une période courte (moins de 60 séances), le chiffre change vite : il est seulement indicatif. Les pastilles des lignes restent sur 1 an.") +
      tuile("Sharpe " + pv[1].slice(5), ok(moiSh) ? F2.format(moiSh) : "—", "", manque || (ok(spSh) ? "S&amp;P 500 : " + F2.format(spSh) + (X.per === "1a" ? " sur la même année" : "") : "rendement pour le risque pris") + indic,
        "Sharpe : ce que tu as gagné au-dessus d'un placement sans risque, pour chaque unité de secousse, sur la période choisie (" + pv[0] + "). Il se lit en comparaison : au-dessus du S&P 500, tu as été mieux payé que le marché pour le risque pris." + (calc ? " Ici, les deux sont recalculés sur tes relevés de la période." : "")) +
      tuile("Jours en hausse", pct(hausse, 0, false), "", "sur les 12 derniers mois") +
    "</div>", true);
}
function joursRecords(c) {
  const h = M.historique; if (!h || !h.rows || h.rows.length < 2) return [];
  const K = colsS(c), ki = K.i, kv = K.v, ka = K.a, out = [], R = rowsS(c);
  if (c && (ki < 0 || kv < 0 || ka < 0) || R.length < 2) return [];
  // 14.4.2 : seuls comptent les jours où le portefeuille valait au moins la moitié de sa valeur actuelle
  // (les % des débuts, sur quelques centaines d'euros, ne sont pas comparables) ; se recale seul après un gros versement
  const actuel = R[R.length - 1][kv], seuil = actuel > 0 ? actuel / 2 : 0;
  for (let i = 1; i < R.length; i++) {
    const a = R[i - 1], b = R[i];
    if ((dateNum(b[0]) - dateNum(a[0])) / 864e5 > 4.5 || !(a[ki] > 0) || !(b[ki] > 0)) continue;
    if (!(a[kv] >= seuil) || !(b[kv] >= seuil)) continue;
    out.push({ j: b[0], p: b[ki] / a[ki] - 1, e: (b[kv] - a[kv]) - (b[ka] - a[ka]) });
  }
  return out;
}
/* Bandeau « Ce mois-ci » (remplace « En ce moment ») : résultat du mois en €, série de versements, baisse depuis le plus haut */
function blocMoisEnCours() {
  const t = [], now = new Date(), discret = ETAT.discret === "oui", finM = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const tuileB = (k, big, small, cls, extra) => t.push('<div class="m-ec-t' + (extra ? " " + extra : "") + '"><span class="k">' + k + '</span><b class="' + (cls || "") + '">' + big + "</b><small>" + small + "</small></div>");
  const cS = compteS(), mpm = moisParMois(cS), der = mpm[mpm.length - 1], absents = [];
  let moLib = MOIS_L[now.getMonth()] + " " + now.getFullYear();
  if (der) {
    const ceMois = der.an === now.getFullYear() && der.mois === now.getMonth() + 1;
    moLib = MOIS_L[der.mois - 1] + " " + der.an;
    const sansEur = der.eur === null; if (sansEur && !discret) absents.push("le résultat en euros");
    tuileB(ceMois ? "Résultat du mois" : "Résultat de " + MOIS_L[der.mois - 1], discret || sansEur ? pct(der.twr) : eur(der.eur, 0, true), discret ? "en € : masqué (mode discret)" : sansEur ? "hors versements" : pct(der.twr) + " hors versements", sens(discret || sansEur ? der.twr : der.eur));
  }
  try {
    const sv = cS ? versementsCompte(cS) : serieVersements(), mo = MOIS_L[now.getMonth()];
    if (!sv) absents.push("la série de versements");
    else
    if (sv.liste.length) tuileB("Versements d'affilée", sv.actuelle + " mois", "record " + sv.record + " · " + (sv.moisEnCours ? '<span class="up">' + esc(mo) + " fait ✓</span>" : '<span class="warn">' + esc(mo) + " : jusqu'au " + dateCourte(finM) + "</span>"), "", sv.moisEnCours ? "ok" : "attente");
  } catch (e) { /* pas de parcours : tuile absente */ }
  const h = M.historique, k = h && h.cols ? colsS(cS).i : -1, R = rowsS(cS);
  if (k >= 0 && R.length > 1) {
    const B = baisses(R, k), auHaut = B.actuel > -0.0005;
    tuileB("Depuis ton plus haut", auHaut ? "au top" : pct(B.actuel), auHaut ? "nouveau plus haut ✓" : "plus haut le " + dateCourte(dateNum(R[B.iMax][0])), auHaut ? "up" : "down");
  } else if (cS && h && h.rows && h.rows.length > 1) absents.push("le résultat du mois et le plus haut");
  const info = absents.length ? seulTout(majuscule(absents.join(", "))) : "";
  return t.length || info ? '<div><h2 class="sec">Ce mois-ci <small>' + esc(moLib) + (cS ? " · " + esc(cS.lib) : "") + '</small></h2></div>' + (t.length ? '<div class="m-ec m-ec' + t.length + '">' + t.join("") + "</div>" : "") + info : "";
}
/** Versements d'affilée d'un compte (lot 35) : un mois compte quand le versé du compte y augmente (relevés du soir) ; null sans ce détail */
function versementsCompte(c) {
  const K = colsS(c), R = rowsS(c); if (K.a < 0 || !R.length) return null;
  const fin = {}; R.forEach(r => { fin[String(r[0]).slice(0, 4) + "-" + String(r[0]).slice(4, 6)] = r[K.a]; });
  const auj = cleMoisD(new Date()), debut = String(R[0][0]).slice(0, 4) + "-" + String(R[0][0]).slice(4, 6), liste = [];
  let avant = 0, vu = 0;
  for (let m = debut; m <= auj; m = moisSuivant(m, 1)) { const a = fin[m] === undefined ? avant : fin[m]; liste.push({ m, ok: a - avant > 0.5 }); avant = a; vu++; if (vu > 600) break; }
  let run = 0, record = 0; liste.forEach(x => { run = x.ok ? run + 1 : 0; if (run > record) record = run; });
  const moisEnCours = !!(liste.length && liste[liste.length - 1].m === auj && liste[liste.length - 1].ok);
  let actuelle = 0; for (let i = liste.length - 1 - (moisEnCours ? 0 : 1); i >= 0 && liste[i].ok; i--) actuelle++;
  return { actuelle, record, moisEnCours, liste };
}
function blocJours() {
  const cS = compteS(), K = colsS(cS);
  if (cS && !M.simple && (K.i < 0 || K.v < 0 || K.a < 0)) return '<div><h2 class="sec">Records perso</h2></div>' + seulTout("Meilleurs et pires jours");
  const l = joursRecords(cS); if (l.length < 5) return "";
  const tri = l.slice().sort((x, y) => y.p - x.p), best = tri.slice(0, 5), pire = tri.slice(-5).reverse();
  const date = j => dateLongue(dateNum(j));
  const liste = (titre, xs) => "<div><b>" + titre + "</b>" + xs.map((x, i) => '<div class="l"><span>' + (i + 1) + ". " + date(x.j) + '</span><span class="' + sens(x.p) + '">' + pct(x.p, 2) + '</span><span class="' + sens(x.e) + '">' + eur(x.e, 0, true) + "</span></div>").join("") + "</div>";
  const pastille = (lib, x, cls) => '<span class="m-jc-p ' + cls + '"><i>' + lib + '</i><b>' + pct(x.p, 2) + "</b><small>" + dateCourte(dateNum(x.j)) + "/" + String(x.j).slice(2, 4) + " · " + eur(x.e, 0, true) + "</small></span>";
  return '<div><h2 class="sec">Records perso <small>top 5 en dépliant</small></h2></div>' +
    '<details class="acc m-compact m-jc" data-acc="m-jours"' + (PREF.acc["m-jours"] ? " open" : "") + "><summary>" + pastille("▲ Meilleur jour", best[0], "up") + pastille("▼ Pire jour", pire[0], "down") + "</summary>" +
    '<div><div class="m-jr">' + liste("Top 5", best) + liste("Flop 5", pire) + "</div>" +
    '<p class="info">Sur ' + l.length + " jours de bourse depuis le " + dateLongue(dateNum(l[0].j)) + ", classés en performance (sans l'effet de tes versements). Seuls comptent les jours où " + (cS ? "ce compte" : "ton portefeuille") + " valait au moins la moitié de sa valeur actuelle : après un gros versement, la période se recale toute seule.</p></div></details>";
}
/** Mois par mois : Tout (sans argument, comme avant) ou un compte (lot 35) ; eur = null quand le fichier ne donne pas valeur et versé du compte */
function moisParMois(c) {
  const h = M.historique; if (!h || !h.rows || h.rows.length < 2) return [];
  const K = colsS(c), kv = K.v, ka = K.a, ki = K.i, R = rowsS(c), sansEur = kv < 0 || ka < 0;
  if (ki < 0 || R.length < 2) return [];
  const fins = [];
  R.forEach((r, i) => { const m = Math.floor(r[0] / 100), s = R[i + 1]; if (!s || Math.floor(s[0] / 100) !== m) fins.push(r); });
  /* lot 46 : S&P 500 du même mois, sur les mêmes relevés (colonne « isp » = S&P 500 en €, celle de « Contre le marché »).
     Profil simple : le rendement mensuel du S&P donné par le Versus (« msp »), null quand il manque. Pas de donnée sûre = null (pas de marqueur). */
  const kS = h.cols.indexOf("isp"), kM = h.cols.indexOf("msp"), pos = v => typeof v === "number" && isFinite(v) && v > 0;
  let prec = null;
  return fins.map(r => {
    const twr = prec ? r[ki] / prec[ki] - 1 : r[ki] / R[0][ki] - 1;
    const eurM = sansEur ? null : prec ? (r[kv] - prec[kv]) - (r[ka] - prec[ka]) : r[kv] - r[ka];
    const a = prec || R[0];
    const sp = kM >= 0 ? (prec && typeof r[kM] === "number" && isFinite(r[kM]) ? r[kM] : null) : kS >= 0 && pos(r[kS]) && pos(a[kS]) && a !== r ? r[kS] / a[kS] - 1 : null;
    prec = r;
    return { an: Math.floor(r[0] / 10000), mois: Math.floor(r[0] / 100) % 100, twr, eur: eurM, sp };
  });
}
/* Mois par mois (lot 43, Conseil) : un calendrier par année, 4 colonnes × 3 rangées, % en gros ET € en petit dans chaque case
   (plus de bascule), teinte selon le signe et l'ampleur du %. Toucher une case = son détail (mois, %, résultat, versé) à la place du total
   de l'année, au même endroit et à la même hauteur : rien ne bouge. Mode discret : seulement des %. Calculs : moisParMois (inchangée). */
function versesMois(c) {   // versé de chaque mois (fins de mois, comme moisParMois) ; null sans la colonne du versé
  const K = colsS(c), R = rowsS(c); if (K.a < 0 || R.length < 2) return null;
  const out = {}; let prec = null;
  R.forEach((r, i) => { const s = R[i + 1]; if (s && Math.floor(s[0] / 100) === Math.floor(r[0] / 100)) return; out[Math.floor(r[0] / 100)] = r[K.a] - (prec ? prec[K.a] : 0); prec = r; });
  return out;
}
function mieuxSp(x) { return ok(x.sp) && ok(x.twr) && x.twr > x.sp; }   // lot 46 : % du mois hors versements, strictement au-dessus
function teinteMpm(r, max) {   // même vert/rouge que le reste de l'appli, plafonné pour garder le texte lisible
  if (!ok(r) || Math.abs(r) < 5e-5) return "";
  const a = Math.min(1, Math.abs(r) / max) * .4 + .1;
  return "background:color-mix(in srgb, var(" + (r > 0 ? "--up" : "--down") + ") " + Math.round(a * 100) + "%, var(--panel))";
}
function blocMois() {
  const cS = compteS(), m = moisParMois(cS);
  if (!m.length) return cS && colsS(cS).i < 0 ? '<div><h2 class="sec">Mois par mois</h2></div>' + seulTout("Mois par mois") : "";
  const discret = ETAT.discret === "oui", sansEur = m.some(x => x.eur === null), avecEur = !discret && !sansEur;
  const V = avecEur ? versesMois(cS) : null, now = new Date(), anN = now.getFullYear(), moN = now.getMonth() + 1;
  const eurC = v => Math.abs(v) >= 10000 ? kEur(v) + NB + "€" : eur(v, 0, true);
  const ans = Array.from(new Set(m.map(x => x.an))).sort().reverse();
  const maxP = Math.max(.03, ...m.map(x => Math.abs(x.twr)));
  // une ligne de tête à 2 étages, toujours la même hauteur : [titre · % en gros] / [contexte · €]
  const tete = (titre, ctx, p, e) => '<span class="mpm-h">' + titre + '</span><b class="mpm-p ' + sens(p) + '">' + pct(p) + '</b><small class="mpm-x">' + ctx + "</small>" + '<small class="mpm-e">' + e + "</small>";
  const carte = an => {
    const ms = m.filter(x => x.an === an), tot = ms.reduce((p, x) => p * (1 + x.twr), 1) - 1, totE = ms.reduce((p, x) => p + x.eur, 0);
    const avecSp = ms.filter(x => ok(x.sp)), devant = avecSp.filter(mieuxSp).length;   // lot 46 : mois devant le S&P 500
    const ctxA = (an !== anN && ms.length === 12 ? "année entière" : "depuis " + MOIS_L[ms[0].mois - 1]) + (avecSp.length ? " · ★ " + devant + "/" + avecSp.length : "");
    const teteA = tete("<b>" + an + "</b>", esc(ctxA), tot, avecEur ? eurC(totE) : "");
    const cases = MOIS.map((nm, i) => {
      const x = ms.find(y => y.mois === i + 1), cours = an === anN && i + 1 === moN;
      if (!x) return '<span class="mpm-c vide"><i>' + nm + "</i></span>";
      const v = V ? V[an * 100 + i + 1] : null, e = avecEur ? eurC(x.eur) : "";
      const spTxt = ok(x.sp) ? "S&P " + pct(x.sp) : "", bat = ok(x.sp) && mieuxSp(x);
      const ctx = [cours ? "en cours" : "", ok(v) ? "versé " + eur(v, 0) : "", spTxt].filter(Boolean).join(" · ");
      const det = tete("<b>" + majuscule(MOIS_L[i]) + " " + an + "</b>", esc(ctx) || (avecEur ? "résultat" : "hors versements"), x.twr, e);
      return '<button type="button" class="mpm-c' + (cours ? " cours" : "") + '" style="' + teinteMpm(x.twr, maxP) + '" data-mpm="' + esc(det) + '" aria-label="' + esc(MOIS_L[i] + " " + an + " : " + pct(x.twr) + (e ? ", " + e : "") + (bat ? ", mieux que le S&P 500 (" + pct(x.sp) + ")" : spTxt ? ", S&P 500 " + pct(x.sp) : "")) + '"><i>' + nm + "</i><b>" + pct(x.twr) + "</b>" + (e ? "<small>" + e + "</small>" : "") + (bat ? '<span class="mpm-sp" aria-hidden="true">★</span>' : "") + "</button>";
    }).join("");
    const grille = '<div class="mpm-g' + (avecEur ? "" : " sans-e") + '">' + cases + "</div>";
    /* lot 50 (Théo) : seule l'année en cours est dépliée ; les années d'avant = une ligne repliée (année · % · ★ n/m), dépliée au toucher,
       état gardé pendant la visite comme les autres accordéons (PREF.acc["mpm-aaaa"]). La tête de l'année est le résumé : le détail d'un mois s'y affiche aussi. */
    if (an !== ouvertA) return '<details class="acc mpm-an mpm-y" data-acc="mpm-' + an + '"' + (PREF.acc["mpm-" + an] ? " open" : "") + '><summary class="mpm-t" data-mpm-an="' + esc(teteA) + '">' + teteA + "</summary><div>" + grille + "</div></details>";
    return '<section class="mpm-an"><div class="mpm-t" aria-live="polite" data-mpm-an="' + esc(teteA) + '">' + teteA + "</div>" + grille + "</section>";
  };
  const ouvertA = ans.includes(anN) ? anN : ans[0];   // année en cours (à défaut : la plus récente)
  return '<div><h2 class="sec">Mois par mois <small>' + (avecEur ? "% hors versements · € = résultat" : "% hors versements") + (cS ? " · " + esc(cS.lib) : "") + "</small></h2></div>" +
    (discret ? '<p class="info">Mode discret : seulement les %.</p>' : sansEur ? seulTout("Le résultat en euros") : "") +
    '<div class="mpm">' + ans.map(carte).join("") + "</div>" +
    '<p class="info mpm-aide">Touche un mois : son détail remplace le total de l\'année.' + (m.some(x => ok(x.sp)) ? ' <span class="mpm-leg"><b>★</b> = mieux que le S&amp;P 500 ce mois-là (hors versements).</span>' : "") + "</p>";
}
/* Répartition : une seule barre à 100 % ; masquée quand il n'y a qu'une catégorie (seuls les critères qui séparent vraiment sont proposés) */
const COUL_REP = ["#5B8DEF", "#2BB673", "#9B6BFF", "#F2A33A", "#18A9C7", "#E5484D", "#D6619E", "#C9A227", "#8C7B5A"];
function blocRepartition() {
  const actifs = (M.ref || {}).actifs || [];
  const info = c => actifs.find(a => a.code === c) || {};
  const CLES = { classe: l => info(l.code).classe || "Non classé", zone: l => info(l.code).zone || "Non renseignée", ligne: l => l.code, levier: l => { const v = Number(info(l.code).levier) || 1; return v > 1 ? "Levier ×" + v : "Sans levier"; } };
  const cS = compteS(), grs = (M.groupes || []).filter(gr => !cS || gr.env === cS.nom);
  const grouper = cle => { const g = {}; grs.forEach(gr => gr.lignes.forEach(l => { if (!l.especes && l.valeur > 0) { const k = cle(l); g[k] = (g[k] || 0) + l.valeur; } })); return Object.entries(g).sort((a, b) => b[1] - a[1]); };
  const dispo = [["classe", "Classe"], ["zone", "Zone"], ["ligne", "Ligne"], ["levier", "Levier"]].map(([k, l]) => [k, l, grouper(CLES[k])]).filter(x => x[2].length >= 2);
  if (!dispo.length) return "";   // une seule ligne (ou aucune) : rien à répartir
  const sel = dispo.find(x => x[0] === PREF.rep) || dispo[0], tri = sel[2], tot = tri.reduce((a, x) => a + x[1], 0) || 1;
  const coul = i => COUL_REP[i % COUL_REP.length];
  return '<div><h2 class="sec">Répartition <small>' + (cS ? "lignes du compte " + esc(cS.lib) : "lignes du portefeuille") + "</small></h2></div>" +
    (dispo.length > 1 ? '<div class="chips m-filtre" role="group" aria-label="Répartir par">' + dispo.map(([k, l]) => '<button class="chip" type="button" data-m-rep="' + k + '" aria-pressed="' + (sel[0] === k) + '">' + l + "</button>").join("") + "</div>" : "") +
    '<div class="m-rep-barre" role="img" aria-label="Répartition par ' + esc(sel[1].toLowerCase()) + '">' + tri.map(([k, v], i) => '<i style="flex:' + v + ";background:" + coul(i) + '" title="' + esc(k) + " · " + pct(v / tot, 1, false) + '"></i>').join("") + "</div>" +
    '<div class="m-rep">' + tri.map(([k, v], i) => '<div><span class="n"><i style="background:' + coul(i) + '"></i>' + esc(k) + '</span><span class="p">' + pct(v / tot, 1, false) + '</span><span class="e">' + eur(v) + "</span></div>").join("") + "</div>";
}
function blocFrais() {
  let f = M.frais || []; if (!f.length) return "";
  const cS = compteS();
  if (cS) { f = f.filter(r => r.nom === cS.nom); if (!f.length) return acc("m-frais", "Frais payés", esc(cS.lib), seulTout("Les frais"), false); }
  const tot = cS ? f[0] : f.find(r => /^Total/.test(r.nom));
  return acc("m-frais", "Frais payés", tot ? eur(tot.total, 0) + " au total" : "courtage, gestion", '<div class="m-liste">' +
    f.map(r => '<div class="r' + (/^Total/.test(r.nom) ? " total" : "") + '"><span class="a">' + esc(r.nom) + '</span><span class="b">' + eur(r.total, 2) + "</span>" +
      '<span class="c">cette année ' + eur(r.annee, 2) + '</span><span class="d">' + pct(r.pct, 2, false) + " des versements</span></div>").join("") + "</div>", false);
}
function brancherStats(v) {
  brancherDefs(v);
  const re = b => garderPlace(b, rendre);
  v.querySelectorAll("[data-m-mode]").forEach(b => b.addEventListener("click", () => { PREF.mode = b.dataset.mMode; garderPref(); re(b); }));
  v.querySelectorAll("[data-m-per]").forEach(b => b.addEventListener("click", () => { PREF.per = b.dataset.mPer; garderPref(); re(b); }));
  v.querySelectorAll("[data-m-compte]").forEach(b => b.addEventListener("click", () => { PREF.compte = b.dataset.mCompte; garderPref(); re(b); }));
  v.querySelectorAll("[data-m-rep]").forEach(b => b.addEventListener("click", () => { PREF.rep = b.dataset.mRep; garderPref(); re(b); }));
  v.querySelectorAll(".mpm-c[data-mpm]").forEach(c => c.addEventListener("click", () => {   // lot 43 : détail à la place du total de l'année, sans rien déplacer ; re-toucher = retour à l'année
    const an = c.closest(".mpm-an"), t = an.querySelector(".mpm-t"), deja = c.classList.contains("on");
    v.querySelectorAll(".mpm-c.on").forEach(x => { x.classList.remove("on"); const t2 = x.closest(".mpm-an").querySelector(".mpm-t"); t2.innerHTML = t2.dataset.mpmAn; });
    if (!deja) { c.classList.add("on"); t.innerHTML = c.dataset.mpm; }
  }));
  v.querySelectorAll("details.mpm-y").forEach(d => d.addEventListener("toggle", () => { if (d.open) return; const c = d.querySelector(".mpm-c.on"); if (c) { c.classList.remove("on"); const t = d.querySelector(".mpm-t"); t.innerHTML = t.dataset.mpmAn; } }));
  v.querySelectorAll("tr.m-pf-r").forEach(tr => {
    const f = () => { const d = v.querySelector('tr[data-pf-d="' + tr.dataset.pf + '"]'); if (!d) return; d.hidden = !d.hidden; tr.setAttribute("aria-expanded", String(!d.hidden)); tr.classList.toggle("ouvert", !d.hidden); };
    tr.addEventListener("click", f); tr.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f(); } });
  });
  const g = v.querySelector(".grille"); if (g) { const sx = g.closest(".scroll-x"); if (sx) sx.scrollLeft = sx.scrollWidth; }
  dessinerCourbe();
}

/* ================= Signal levier Nasdaq (repris tel quel de Cote V5.6 : mêmes données, mêmes règles, mêmes textes) ================= */
let signalOuvert = false;
const SIG_RUB = new Set();   // lot 66 : rubriques du bloc Levier ouvertes pendant la visite
/* lot 67 (Théo, 21/11) · l'apport du mois suit la position : 0 = cash hors marché, 1 = ×1 alarme de volatilité allumée ;
   la formule d'espérance (arbitrage.optimal) ne départage ×1 / ×2 (×3 au CTO) que quand l'alarme est éteinte.
   Lu dans le champ « apport » du script (SignalLevier, lot 67) ; repli sur la même règle s'il manque (script plus ancien). */
function apportSignal(g) {   // Théo 26/11/2026 : le versement suit les positions (plus de calcul d'espérance) : 0 cash/or · 1 ×1 · 2 levier
  if (!g) return null;
  return !g.expose ? 0 : g.reduit ? 1 : 2;
}
/* phrase du versement du mois, la même que l'e-mail (slVersement_) */
function versementSignal(g) {
  const D = detientSignal(g);
  return "comme tes positions : PEA → " + D.pea + (g.positionCTO ? " · CTO → " + D.cto : "");
}
/* 25/11/2026 (Théo) · BILAN APRÈS COUP du signal levier : pour chaque « sors » passé d'un indicateur, ce qu'aurait donné passer sur le
   Nasdaq-100 sans levier plutôt que rester en ×2, jusqu'au signal de retour. Calculé par SignalLevier (slBilan, champ « bilan »).
   Simple indication : Théo n'est jamais obligé de suivre. Seulement des %, jamais un montant. */
const BIL_NOMS = { T: ["Tendance", "vente totale", "le Nasdaq clôture nettement sous sa moyenne des 45 semaines (bande −5 %)"], V: ["Agitation", "×2 → ×1", "la volatilité dépasse le seuil de l'alarme"] };
function blocBilanSignal(g) {
  const b = g && g.bilan; if (!b || !b.ind || !Array.isArray(b.ep)) return "";
  const court = s => s ? s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(2, 4) : "—";
  const p = v => v === null || v === undefined ? "—" : pct(v / 100, 1);
  const ligneEp = e => {
    const [k, du, au, j, rester, sortir, mieux, evitee, drapeau] = e, nom = BIL_NOMS[k] ? BIL_NOMS[k][0].toLowerCase() : k, enCours = !au;
    /* bon / mauvais : le drapeau du serveur, calculé sur la valeur exacte (le % affiché est arrondi) ; ancien script : le signe du % */
    const bon = drapeau === 1 || drapeau === 0 ? drapeau === 1 : mieux > 0, peu = mieux !== null && Math.abs(mieux) < .05;
    const val = bon ? "<b class=\"up\">" + p(Math.abs(mieux)) + "</b>" : "<b class=\"down\">" + p(-Math.abs(mieux)) + "</b>";
    const verdict = mieux === null ? "calcul impossible"
      : peu ? (bon ? (enCours ? "pour l'instant, sortir fait" : "sortir aurait fait") + " à peine mieux (moins de 0,1 %)" : (enCours ? "pour l'instant, rester est" : "rester était") + " à peine mieux (moins de 0,1 %)")
      : enCours ? (bon ? "pour l'instant, sortir fait " + val + " de mieux" : "pour l'instant, rester est mieux (" + val + ")")
      : bon ? "sortir aurait fait " + val + " de mieux" : "rester était mieux (" + val + ")";
    return '<li class="' + (enCours ? "cours" : bon ? "bon" : "mauvais") + '"><span class="bl-t">' + (enCours ? "⏳" : "📉") + " Signal du " + esc(court(du)) + " (" + esc(nom) + ")" + (enCours ? ", en cours" : "") + " : " + verdict + "</span>" +
      '<span class="bl-s">' + (enCours ? "depuis " + j + " j" : "jusqu'au retour du " + esc(court(au)) + " (" + j + " j)") + " · rester ×2 " + p(rester) + " · sortir ×1 " + p(sortir) + (evitee ? " · vente évitée par le creux" : "") + "</span></li>";
  };
  const carte = k => { const x = b.ind[k]; if (!x) return ""; const N = BIL_NOMS[k] || [k, "", ""];
    const avis = !x.n ? "pas encore de signal fini" : x.moyen > 0 && x.bons * 2 >= x.n ? "👍 a plutôt aidé" : x.moyen < 0 && x.bons * 2 < x.n ? "👎 a plutôt coûté" : "🤷 mitigé";
    return '<div class="bl-ind"><div class="bl-h"><b>' + N[0] + " <small>" + N[1] + "</small></b><em>" + avis + "</em></div>" +
      '<span class="bl-d">Dit « sors » quand ' + N[2] + ".</span>" +
      (x.n ? '<span class="bl-n">' + x.n + (x.n > 1 ? " signaux finis" : " signal fini") + " · ✅ " + x.bons + " bon" + (x.bons > 1 ? "s" : "") + " · ❌ " + x.mauvais + " mauvais</span>" +
        '<span class="bl-m">En moyenne, ' + (x.moyen >= 0 ? "sortir a fait <b class=\"up\">" + p(x.moyen) + "</b> de mieux" : "rester a été mieux (<b class=\"down\">" + p(x.moyen) + "</b>)") + "." +
        (x.bons && x.mauvais ? " <small>Quand il avait raison : " + p(x.gainBons) + " ; quand il avait tort : " + p(x.perteMauvais) + ".</small>" : "") + "</span>" : "") +
      (x.enCours ? '<span class="bl-n">⏳ un signal en cours (compté quand il sera fini)</span>' : "") + "</div>"; };
  const ep = b.ep, n = 6, tot = b.nEp || ep.length;
  return '<details class="sg-rub" data-rub="bilan"><summary><span>Bilan après coup</span><b>depuis ' + esc(String(b.depuis || "").slice(0, 4)) + '</b></summary><div class="sg-bilan">' +
    '<p class="sg-intro">Une <b>indication</b>, pas un ordre : chaque fois qu\'un voyant a dit « sors », on regarde après coup ce qu\'aurait donné <b>passer sur le Nasdaq-100 sans levier</b> plutôt que <b>rester en ×2</b>, jusqu\'au signal de retour. Tu n\'es jamais obligé de suivre.</p>' +
    carte("T") + carte("V") +
    (ep.length ? '<h4 class="sig-h">Les derniers signaux <small>du plus récent au plus ancien</small></h4><ol class="bl-ep">' + ep.slice(0, n).map(ligneEp).join("") + "</ol>" +
      (ep.length > n ? '<details class="bl-plus"><summary>Voir les ' + (ep.length - n) + " autres</summary><ol class=\"bl-ep\">" + ep.slice(n).map(ligneEp).join("") + "</ol></details>" : "") : "") +
    '<p class="sg-intro"><small>Calcul sur le Nasdaq-100 (en dollars), clôture du signal → clôture du retour (l\'ordre se passe en vrai à l\'ouverture suivante). Le ×2 est recalculé jour par jour : deux fois la variation, moins les frais du LQQ et le coût d\'emprunt' + (b.tauxFed ? " (taux de la Fed du jour)" : " (taux de secours : historique de la Fed indisponible)") + ". Calcul jusqu'à la séance du " + esc(court(b.dernier)) + ". Le bilan par voyant ne compte que les signaux finis" + (tot > ep.length ? " ; les " + ep.length + " plus récents sont listés sur " + tot : "") + ". Ce n\'est pas un conseil en investissement.</small></p>" +
  "</div></details>";
}
/* 26/11/2026 (Théo) · ce que la règle fait détenir, en clair (même règle que slDetient_ du script) : alarme allumée = ×1, jamais de LQQ ni de QQQ3 */
function detientSignal(g) {
  return { pea: !g.expose ? "cash" : g.reduit ? "Nasdaq-100 ×1" : "LQQ ×2", cto: !g.expose ? "or" : g.reduit ? "Nasdaq-100 ×1" : "QQQ3 ×3" };
}
function raisonCreux(r) {
  return r === "BULLE" ? "marché jugé en bulle" : r === "EMPLOI" ? "le chômage américain monte" : r === "EMPLOI 25-54" ? "l'emploi des 25-54 ans recule" : r === "DONNÉE MANQUANTE" ? "donnée d'emploi manquante" : String(r || "").toLowerCase();
}
/* 26/11 : le journal du moteur parle « EMA » et « SMA 150 » : dit avec les mots de la carte */
function detailSignal(t) {
  return String(t || "").replace(/l'EMA 45 sem\./g, "sa ligne de tendance (45 semaines)").replace(/NDX sous la bande −5 %/g, "Nasdaq plus de 5 % sous sa ligne de tendance")
    .replace(/sous la SMA 150/g, "sous la moyenne des 150 séances").replace(/creux le même jour/g, "exception creux le même soir").replace(/^NDX /, "Nasdaq ");
}
/* 26/11 (Théo) : texte du signal replié ou non, mémorisé sur l'appareil ; une nouvelle position (signature) le redéplie d'office */
const CLE_PLIE = "versus.moi.levier.plie";
function signaturePosition(g) { return [g.expose ? 1 : 0, g.reduit ? 1 : 0, g.depuis || "", g.reduitDepuis || ""].join("|"); }
function textePlie(g) {
  try { const m = JSON.parse(localStorage.getItem(CLE_PLIE) || "null"); return !!(m && m.sig === signaturePosition(g) && m.plie); } catch (e) { return false; }
}
function noterPlie(g, plie) { try { localStorage.setItem(CLE_PLIE, JSON.stringify({ sig: signaturePosition(g), plie })); } catch (e) {} }
function blocSignal() {
  const g = M.signal;
  if (!g || !g.position) return "";
  const NNBSP = NB;
  const cls = !g.expose || (g.creux && g.creuxActif !== false) ? "hors" : g.reduit ? "x1" : "x2";   // 26/11 : exception creux = signal de vente d'abord (cash)
  const sansCreux = g.creuxActif === false;   // 25/11/2026 : si un jour la règle tourne sans « creux », tout ce qui en parle se cache
  const court = s => s ? s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(2, 4) : "—";
  const p = v => v === null || v === undefined ? "—" : pct(v / 100);
  const p1 = v => v === null || v === undefined ? "—" : F1.format(v) + NNBSP + "%";
  const coche = ok2 => ok2 === null || ok2 === undefined ? '<i class="ck">?</i>' : ok2 ? '<i class="ck up">✓</i>' : '<i class="ck down">✕</i>';
  const qm = '<button type="button" class="qm-b" aria-label="Que veut dire cette donnée ?">?</button>';
  const aide = t => t ? '<span class="aide">' + t + "</span>" : "";
  const qmCase = k => '<button type="button" class="qm-b" data-case="' + k + '" aria-label="Que veut dire cette donnée ?">?</button>';
  const cell = (lab, val, c, sub, k) => '<span class="pc-c"><span class="lab">' + lab + (k ? qmCase(k) : "") + '</span><span class="val ' + (c || "") + '">' + val + '</span><span class="sub">' + sub + "</span></span>";
  const ligne = (a, b, c, bCls, ex) => '<div class="r" data-aide><span class="a">' + a + (ex ? qm : "") + '</span><span class="b ' + (bCls || "") + '">' + b + "</span>" + (c ? '<span class="c" style="grid-column:1/-1">' + c + "</span>" : "") + (ex ? '<span class="c aide-l" style="grid-column:1/-1">' + aide(ex) + "</span>" : "") + "</div>";
  /* textes des « ? » : construits à chaque affichage avec les seuils et les chiffres du dernier calcul,
     pour qu'ils suivent les réglages du script et la situation du jour (plus aucun chiffre figé) */
  const xj = g.jauges || {};
  const n1 = v => v === null || v === undefined || !isFinite(v) ? "—" : F1.format(v);
  const n2 = v => v === null || v === undefined || !isFinite(v) ? "—" : F2.format(v);
  const nS = v => Number.isInteger(v) ? F0.format(v) : F1.format(v);
  const sg = v => v === null || v === undefined || !isFinite(v) ? "—" : (v >= 0 ? "+" : MOINS) + F1.format(Math.abs(v));
  const auj = t => " <b>Aujourd'hui : " + t + ".</b>";
  const VH = g.volHaut || 30, VB = g.volBas || 25, BANDE = g.bande || 5, EMAS = g.emaSem || 45;
  const TCTO = g.tauxCTO || 31.4;
  const SMA = xj.smaLen || 150, ECART = Math.abs(xj.seuilEcart === undefined ? -10 : xj.seuilEcart);
  const levierAuj = !g.expose ? "cash au PEA" + (g.positionCTO ? ", or au CTO" : "") : g.reduit ? "×1 (Nasdaq-100 ×1" + (g.positionCTO ? " au PEA et au CTO" : "") + ")" : g.creux ? "×2 (si tu gardes, exception creux)" : "×2 au PEA" + (g.positionCTO ? ", ×3 au CTO" : "");
  const EX = {
    distance: "Écart entre le Nasdaq-100 (dernière clôture) et le seuil qui déclencherait un ordre. En position, ce seuil est la vente : la moyenne mobile " + EMAS + " semaines (EMA) moins " + nS(BANDE) + " %" +
      (g.bandeSortie ? ", soit " + F0.format(g.bandeSortie) + " points" : "") + ". Hors marché, c'est la distance au seuil d'achat (l'EMA" + (g.ema ? ", " + F0.format(g.ema) + " points" : "") + ") : un chiffre négatif veut dire qu'il est encore en dessous." +
      (g.distance !== null && g.distance !== undefined ? auj(sg(g.distance) + " %, " + (g.creux ? "avant la fin de l'exception (retour au-dessus de la ligne de tendance)" : g.expose ? "le Nasdaq peut encore baisser d'environ " + n1(Math.max(0, g.distance)) + " % avant un signal de vente" : "il doit encore monter d'environ " + n1(Math.max(0, -g.distance / (1 + g.distance / 100))) + " % pour un signal d'achat") + (g.zoneTendance ? " · zone d'alerte" : "")) : ""),
    vol: "Amplitude des variations quotidiennes du Nasdaq sur les 20 dernières séances, ramenée à l'année. Au-dessus de " + nS(VH) + " %, la règle passe en ×1, parce qu'un ETF à levier perd beaucoup quand le marché secoue. Elle ne revient au levier que sous " + nS(VB) + " %, pour éviter les allers-retours. Un marché calme est autour de 15 à 20 %." +
      (g.vol20 !== null && g.vol20 !== undefined ? auj(n1(g.vol20) + " %, levier " + levierAuj + (g.zoneVol ? " · zone d'alerte, proche de " + nS(VH) + " %" : "")) : ""),
    depuis: "Date du dernier changement d'exposition (entrée en position ou sortie du marché) et variation du Nasdaq depuis cette date. Une bascule ×2 ↔ ×1 ne remet pas ce compteur à zéro." +
      (g.depuis ? auj((g.creux && g.creuxDepuis ? "en creux depuis le " + frDate(g.creuxDepuis) + ", position ouverte" : g.expose ? "en position" : "hors marché") + " depuis le " + frDate(g.depuis) + " (" + g.joursDepuis + " j)" + (g.expose && g.perfDepuis !== null && g.perfDepuis !== undefined ? ", Nasdaq " + sg(g.perfDepuis) + " %" : "")) : ""),
    cto: "Ce que la même règle dit pour le compte-titres, le même jour que le PEA : QQQ3 (×3) en position, Nasdaq-100 ×1 quand l'alarme de volatilité est allumée (au-dessus de " + nS(VH) + " %), or quand le signal est hors marché (au lieu du cash du PEA). Au CTO, chaque bascule est une vente imposée à " + nS(TCTO) + " % sur la plus-value." +
      (g.positionCTO ? auj(esc(g.positionCTO) + (g.ordreCTO && g.ordreCTO !== "Aucun" ? " · ordre : " + esc(g.ordreCTO) : ", aucun ordre")) : ""),
    apport: "L'argent nouveau du mois suit la même règle que tes positions, dans le compte où tu verses : au PEA, LQQ ×2 si le marché est calme, Nasdaq-100 ×1 s'il est agité, cash hors marché ; au CTO, QQQ3 ×3, Nasdaq-100 ×1, ou or hors marché. Pas de calcul, pas d'émotion." +
      auj(versementSignal(g)),
    vol20: "Même volatilité que la case du haut. Au-dessus de " + nS(VH) + " % : passage en ×1 au PEA (LQQ → Nasdaq ×1)" + (g.positionCTO ? " et au CTO (QQQ3 → Nasdaq ×1)" : "") + ". Retour au levier sous " + nS(VB) + " %." + (sansCreux ? "" : " Elle s'applique aussi pendant l'exception creux (Théo, 26/11).") +
      (g.vol20 !== null && g.vol20 !== undefined ? auj(n1(g.vol20) + " %, levier " + levierAuj + (g.reduit ? (g.reduitDepuis ? " (alarme du " + frDate(g.reduitDepuis).slice(0, 5) + " encore allumée" + ")" : "") + " · retour au levier sous " + nS(VB) + " %" : g.expose ? " · ×1 si elle dépasse " + nS(VH) + " %" : "")) : ""),
    omen: "Le Pine utilise une deuxième alarme, le Hindenburg Omen, qui détecte une bourse de New York fragile (beaucoup de plus hauts et de plus bas en même temps). Ses données ne sont pas disponibles gratuitement, donc elle n'est pas suivie ici. Tu passeras un peu moins souvent en ×1 que le Pine.",
    creux: "Règle d'entrée anticipée, utile seulement hors marché après une forte baisse. PRÊT = toutes les sécurités sont au vert, il n'attend qu'une baisse assez large. BLOQUÉ = une sécurité est au rouge (la raison est indiquée). DÉSARMÉ = déjà utilisée pendant cet épisode. EN CREUX = le signal de vente est là, mais la règle permet de garder (ou d'acheter en avance) ; c'est à toi de choisir, le message principal reste le cash. L'exception dure jusqu'à ce que le Nasdaq repasse au-dessus de sa ligne de tendance (" + EMAS + " semaines) ; ensuite la règle normale reprend. Pendant l'exception, l'alarme d'agitation s'applique comme d'habitude : ×1 au-dessus de " + nS(VH) + " %, LQQ ×2 sous " + nS(VB) + " %. En position normale, la règle ne sert pas." +
      (g.creuxVerdict ? auj(esc(g.creuxVerdict) + (g.expose && !g.creux ? " (en position, la règle ne sert pas)" : "")) : ""),
    largeur: "Profondeur de la chute : écart entre le Nasdaq et sa moyenne des " + SMA + " dernières séances (≈ 7 mois), plus courte que la ligne de tendance (" + EMAS + " semaines) : elle sert seulement à l'exception creux. Le creux se déclenche à " + MOINS + nS(ECART) + " % ou moins. Un ✕ en marché haussier est normal : il n'y a pas de baisse." +
      (xj.ecartSMA !== null && xj.ecartSMA !== undefined ? auj(sg(xj.ecartSMA) + " % · " + (xj.declLargeur ? "baisse assez large" : "il manque " + n1(Math.max(0, xj.ecartSMA + ECART)) + " points de baisse")) : ""),
    bulle: "Combien de fois le Nasdaq a été multiplié sur 5 ans, au plus haut des 2 dernières années. Au-dessus de ×" + n2(xj.seuilBulle || 4) + ", le marché est jugé en bulle et l'entrée sur creux est refusée (en 2000, c'était ×10,5)." +
      (xj.bulle !== null && xj.bulle !== undefined ? auj("×" + n2(xj.bulle) + (xj.okBulle ? ", sous le seuil" : ", au-dessus du seuil : creux refusé")) : ""),
    sahm: "Indicateur de récession de la Fed de Saint-Louis : hausse du chômage américain (moyenne 3 mois) par rapport à son plus bas de l'année. Vers 0,50, la récession est en général déjà là ; la règle refuse le creux dès " + n2(xj.seuilSahm || 0.3) + ". 0,00 = le chômage est à son plus bas de l'année." +
      (xj.sahm !== null && xj.sahm !== undefined ? auj(n2(xj.sahm) + (xj.okSahm ? ", sous le seuil" : ", au-dessus du seuil : creux refusé")) : ""),
    prime: "Même logique, sur le taux d'emploi des 25-54 ans, moins bruité que le chômage : baisse depuis son plus haut de l'année. Refus du creux à partir de " + n2(xj.seuilPrime || 0.5) + "." +
      (xj.prime !== null && xj.prime !== undefined ? auj(n2(xj.prime) + (xj.okPrime ? ", sous le seuil" : ", au-dessus du seuil : creux refusé")) : ""),
    arme: "L'entrée sur creux ne sert qu'une fois par épisode de baisse. Elle se réarme quand la tendance redevient acheteuse." +
      (xj.arme !== undefined ? auj(xj.arme ? "armée" : "désarmée, en attente du prochain signal d'achat") : ""),
    journal: "ACHAT / VENTE : signal de tendance (EMA " + EMAS + " semaines). ×1 / ×2 : alarme de volatilité (au CTO, ×2 veut dire retour au QQQ3 ×3)." + (sansCreux ? "" : " CREUX : entrée anticipée. RELAIS : la tendance reprend une position creux, rien à acheter. VENTE ÉVITÉE : vente et creux le même jour, position gardée. REFUS : un creux bloqué par une sécurité.") +
      (g.signaux && g.signaux.length ? auj("dernier signal " + esc(g.signaux[0].type) + " le " + frDate(g.signaux[0].date)) : "")
  };
  /* lot 66 (Conseil design, Théo : « je ne comprends pas à quoi servent les indicateurs ») : PRÉSENTATION seulement, mêmes données et mêmes calculs.
     En haut : « Ta position » (ce que tu détiens, PEA puis CTO) et « Ton versement du mois » (l'argent nouveau), deux règles distinctes rendues visibles ;
     dans le détail : chaque indicateur = valeur + jauge des seuils + une phrase « pour toi » ; rubriques repliables (fermées à chaque ouverture) ; journal en frise. */
  const seuil = g.creux ? "avant la fin de l'exception (ligne de tendance)" : g.expose ? "avant la vente" : "avant l'achat";
  const vol = g.vol20 === null || g.vol20 === undefined ? "—" : F1.format(g.vol20) + NNBSP + "%";
  const volCls = g.vol20 !== null && g.vol20 >= g.volHaut ? "down" : "";
  const ok_ = v => v !== null && v !== undefined && isFinite(v);
  /* jauge : échelle [mn, mx], zones colorées, repères étiquetés, pointeur sur la valeur */
  const jauge = (mn, mx, v, zones, marques) => { const x = t => Math.max(0, Math.min(100, (t - mn) / (mx - mn) * 100)).toFixed(1);
    return '<span class="sg-j" aria-hidden="true"><span class="sg-t">' + (zones || []).map(z => '<i class="z ' + z[2] + '" style="left:' + x(z[0]) + "%;width:" + (x(z[1]) - x(z[0])).toFixed(1) + '%"></i>').join("") + "</span>" +
      (marques || []).map(m => '<i class="m" style="left:' + x(m[0]) + '%"></i><small style="left:' + x(m[0]) + '%">' + m[1] + "</small>").join("") +
      (ok_(v) ? '<b class="p" style="left:' + x(v) + '%"></b>' : "") + "</span>"; };
  const phrase = t => t ? '<span class="sg-pt"><i>Pour toi</i> ' + t + "</span>" : "";
  /* ligne du détail avec jauge et phrase (même aide « ? » qu'avant) */
  const ligneJ = (a, b, c, bCls, ex, jg, pt) => '<div class="r sg-r" data-aide><span class="a">' + a + (ex ? qm : "") + '</span><span class="b ' + (bCls || "") + '">' + b + "</span>" +
    (jg ? '<span class="c" style="grid-column:1/-1">' + jg + "</span>" : "") + (pt ? '<span class="c" style="grid-column:1/-1">' + phrase(pt) + "</span>" : "") +
    (c ? '<span class="c" style="grid-column:1/-1">' + c + "</span>" : "") + (ex ? '<span class="c aide-l" style="grid-column:1/-1">' + aide(ex) + "</span>" : "") + "</div>";
  let msg = "";
  /* 26/11/2026 (Théo : « contradictoire, pas fiable ») · UNE seule vérité, la même que l'e-mail (SignalLevier.js, slMessage_) :
     ce que la règle fait détenir (detient), les ordres compte par compte, pourquoi, jusqu'à quand. Alarme d'agitation allumée (reduit) =
     Nasdaq-100 ×1, JAMAIS de LQQ ni de QQQ3, creux ou pas (Théo 26/11 : l'exemption du Pine est supprimée dans SignalLevier.js).
     Vocabulaire : « ligne de tendance » = moyenne des 45 semaines (≈ 225 séances), qui décide de vendre / racheter ;
     « moyenne des 150 séances » (≈ 7 mois) : mesure seulement si la chute est assez profonde (−10 %) pour l'exception creux. */
  const enCash = !g.expose, cashRecent = enCash && (g.transition || (g.joursDepuis !== null && g.joursDepuis !== undefined && g.joursDepuis <= 14));
  const enCreux = g.expose && g.creux && !sansCreux;
  const D = detientSignal(g), aCTO = !!g.positionCTO;
  /* 26/11 (Théo) : en haut, 3 lignes au plus : quoi faire, pourquoi (une phrase), jusqu'à quand ; un seul chiffre d'écart.
     Exception creux : le SIGNAL DE VENTE (cash) d'abord, l'exception en nuance (« à toi de choisir ») ; le détail daté est dans « Comprendre ». */
  const LIGNE = "sa ligne de tendance (moyenne des " + EMAS + " semaines)";
  const grp = x => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  const remonte = ok_(g.distance) && g.distance < 0 ? "il doit remonter de +" + F1.format(Math.abs(g.distance) / (1 - Math.abs(g.distance) / 100)) + NNBSP + "%" + (g.ema ? " (" + grp(g.ema) + " points)" : "") : "";
  const jx = g.jauges || {};
  const entree = g.creux && g.creuxDepuis ? (g.signaux || []).find(x => (x.type === "VENTE ÉVITÉE" || x.type === "CREUX") && x.date === g.creuxDepuis) : null;
  const mE = entree && /(-?\d+,\d) % sous la SMA/.exec(entree.detail || "");
  const chuteE = mE ? Math.abs(Number(mE[1].replace(",", "."))) : ok_(jx.ecartSMA) ? Math.abs(jx.ecartSMA) : null;
  const venteEv = enCreux && g.creuxDepuis && g.depuis && g.creuxDepuis !== g.depuis;   // creux sur une position déjà ouverte = vente évitée ; sinon achat anticipé
  const passe = g.creuxDepuis && g.creuxDepuis !== g.date, leJ = passe ? "Le " + esc(court(g.creuxDepuis).slice(0, 5)) + ", l" : "L";
  const DEUX = "Deux moyennes, deux rôles : la ligne de tendance (" + EMAS + " semaines, ≈ " + EMAS * 5 + " séances) décide de vendre ou de racheter ; la moyenne des " + SMA + " séances (≈ 7 mois) mesure seulement si la chute est assez profonde pour l'exception creux.";
  const pq = (t, cl) => '<p class="sig-msg sg-pq' + (cl || "") + '">' + t + "</p>";
  const ordre = t => '<p class="sig-msg ordre">' + t + "</p>";
  /* jours d'ordre : la phrase fabriquée par le script (message, la même que l'e-mail) ; ancien script : l'ordre brut du moteur */
  const MG = g.message && g.message.pea ? g.message : null;
  const ordres = () => MG ? ordre("👉 PEA : " + esc(MG.pea)) + (aCTO && MG.cto ? ordre("👉 CTO : " + esc(MG.cto)) : "")
    : ordre("👉 PEA : " + esc(g.ordre)) + (aCTO && g.ordreCTO && g.ordreCTO !== "Aucun" ? ordre("👉 CTO : " + esc(g.ordreCTO)) : "");
  const bascCreux = enCreux && g.transition && g.ordre && /BASCULE|RETOUR/.test(g.ordre);   // l'agitation change pendant l'exception : ne concerne que celui qui a gardé
  if (enCreux) {
    const avecGarde = venteEv ? "de garder ton " + D.pea + (aCTO ? (D.cto === D.pea ? " (PEA et CTO)" : " et ton " + D.cto) : "") : "d'acheter dès maintenant le " + D.pea + (aCTO ? (D.cto === D.pea ? " (PEA et CTO)" : " (" + D.cto + " au CTO)") : "");
    const nuance = "<b>Exception creux possible</b> : la chute " + (passe ? "était" : "est") + " assez profonde (" + (chuteE === null ? "" : F1.format(chuteE) + NNBSP + "%" + (passe ? " le " + esc(court(g.creuxDepuis).slice(0, 5)) : "") + ", seuil " + nS(ECART) + NNBSP + "%") + ") sans signe de récession, donc la règle permet aussi " + avecGarde + " ; à toi de choisir.";
    msg = (bascCreux ? (MG ? ordres() : ordre("👉 Si tu as gardé (exception creux), PEA : " + esc(g.ordre) + (aCTO && g.ordreCTO && g.ordreCTO !== "Aucun" ? " · CTO : " + esc(g.ordreCTO) : "") + ". Si tu es en cash : rien à faire."))
        : venteEv ? ordre("👉 Vends ton " + D.pea + (aCTO ? (D.cto === D.pea ? " au PEA et au CTO : cash au PEA, or au CTO" : " (cash au PEA) et ton " + D.cto + " (or au CTO)") : " : cash au PEA") + (passe ? ", si ce n'est pas déjà fait." : "."))
        : pq("<b>À faire : rien.</b> Reste en cash" + (aCTO ? " (or au CTO)" : "") + ".", " sg-af")) +
      pq("<b>Pourquoi</b> : " + (venteEv ? leJ + "e Nasdaq a clôturé plus de " + nS(BANDE) + NNBSP + "% sous " + LIGNE + ". " : (passe ? leJ + "e Nasdaq était" : "Le Nasdaq est") + " sous " + LIGNE + ". ") + nuance) +
      pq("<b>Jusqu'à quand</b> : rachat (ou fin de l'exception) quand le Nasdaq repassera au-dessus de sa ligne de tendance" + (remonte ? " : " + remonte : "") + ".");
  } else if (enCash) {
    const Q = g.quitte || null;   // script du 26/11 : ce que la règle détenait la veille de la vente
    const bloque = jx.declLargeur ? (!jx.lisible || !jx.feuVert ? "l'exception creux est bloquée (" + raisonCreux(jx.raison) + ")" : !jx.arme ? "l'exception creux a déjà servi pendant cette baisse" : "l'exception creux ne s'applique pas")
      : "la chute n'est pas assez profonde pour l'exception creux";
    const dejaFait = g.transition ? "" : " (si ce n'est pas déjà fait depuis le " + esc(court(g.depuis).slice(0, 5)) + ")";
    msg = (cashRecent && MG && MG.ordre ? ordre("👉 PEA : " + esc(MG.pea.replace(/\.$/, "")) + dejaFait + ".") + (aCTO && MG.cto ? ordre("👉 CTO : " + esc(MG.cto.replace(/\.$/, "")) + dejaFait + ".") : "")
      : cashRecent ? ordre("👉 PEA : vends ton " + (Q ? Q.pea : "LQQ ×2 ou ton Nasdaq-100 ×1 (ce que tu as)") + ", garde l'argent en cash" + dejaFait + ".") +
        (aCTO ? ordre("👉 CTO : vends ton " + (Q ? Q.cto : "QQQ3 ×3 ou ton Nasdaq-100 ×1 (ce que tu as)") + ", achète de l'or" + dejaFait + ".") : "")
      : pq("<b>À faire : rien.</b> Reste en cash" + (aCTO ? " (or au CTO)" : "") + ".", " sg-af")) +
      pq("<b>Pourquoi</b> : le Nasdaq " + (cashRecent ? "a clôturé plus de " + nS(BANDE) + NNBSP + "% sous " + LIGNE + (g.depuis ? " le " + esc(court(g.depuis).slice(0, 5)) : "") : "est sous " + LIGNE) + (sansCreux ? "." : " et " + bloque + ".")) +
      pq("<b>Jusqu'à quand</b> : rachat quand il repassera au-dessus de sa ligne de tendance" + (remonte ? " : " + remonte : "") + (sansCreux ? "." : ", ou plus tôt si l'exception creux se déclenche."));
  }
  else if (g.transition) msg = ordres();
  else if (g.provisoire && g.provisoire.changement) msg = '<p class="sig-msg alerte">Séance US en cours : ' + esc(g.provisoire.position) + " si la clôture reste à ce niveau (provisoire)</p>";
  else if (g.zoneTendance) msg = '<p class="sig-msg alerte">Zone d\'alerte : le Nasdaq est à ' + F1.format(Math.abs(g.distance)) + NNBSP + "% du seuil " + (g.expose ? "de vente" : "d'achat") + "</p>";
  else if (g.zoneVol) msg = '<p class="sig-msg alerte">Zone d\'alerte : agitation proche de ' + g.volHaut + NNBSP + "%, passage en ×1 possible</p>";
  else msg = "";   // lot 67 (Théo) : rien à faire → une seule ligne discrète dans l'en-tête (sg-rien), plus de consigne en gros

  /* une VENTE et un CREUX le même jour = la vente n'a pas lieu (anciens journaux) : une seule ligne */
  const bruts = g.signaux || [], fusion = [];
  bruts.forEach(x => {
    const jumeau = bruts.find(y => y !== x && y.date === x.date && ((x.type === "VENTE" && y.type === "CREUX") || (x.type === "CREUX" && y.type === "VENTE")));
    if (!jumeau) { fusion.push(x); return; }
    if (x.type === "VENTE") fusion.push({ type: "VENTE ÉVITÉE", date: x.date, detail: "Creux détecté le même jour : la position est gardée, aucun ordre." });
  });
  const typeCls = t => t === "VENTE ÉVITÉE" ? "t-EVITEE" : "t-" + String(t).replace("×1", "x1").replace("×2", "x2");
  /* historique des bascules : le journal, dit en clair (« ×2 → ×1 ») ; « depuis » = la seule mesure après coup déjà fournie (perfDepuis, dernière entrée) */
  const BASC = { "ACHAT": "cash → ×2 · achat", "VENTE": "→ cash · vente", "×1": "×2 → ×1 · alarme", "×2": "×1 → ×2 · fin d'alarme", "CREUX": "cash → achat anticipé", "RELAIS": "creux → position normale", "VENTE ÉVITÉE": "vente évitée, position gardée", "REFUS": "achat anticipé refusé" };
  const journal = '<ol class="sg-frise">' + fusion.slice(0, 8).map(x =>
    '<li class="' + typeCls(x.type) + '"><span class="d">' + esc(court(x.date)) + '</span><span class="ty">' + esc(BASC[x.type] || x.type) + ' <small>' + esc(x.type) + '</small></span><span class="x"><i>Pourquoi</i> ' + esc(detailSignal(x.detail)) +
      (g.expose && x.date === g.depuis && /ACHAT|CREUX/.test(x.type) && g.perfDepuis !== null && g.perfDepuis !== undefined ? ' <b class="' + sens(g.perfDepuis) + '">Depuis : Nasdaq ' + p(g.perfDepuis) + "</b>" : "") + "</span></li>").join("") + "</ol>";

  /* creux : les 4 conditions du Pine */
  const j = g.jauges;
  const creuxPt = g.creux ? (venteEv ? "elle s'applique depuis le " + frDate(g.creuxDepuis) + " (vente évitée) : la règle permet de garder au lieu de passer en cash, jusqu'au retour au-dessus de la ligne de tendance."
      : "elle s'applique depuis le " + frDate(g.creuxDepuis) + " (achat anticipé) : la règle permet d'être investi avant le signal normal, jusqu'au retour au-dessus de la ligne de tendance.")
    : g.expose ? "tu es en position : cette règle ne sert pas aujourd'hui." : "hors marché, elle peut te faire racheter AVANT le signal normal, si la baisse est assez large et que les 3 sécurités sont vertes.";
  const creux = '<h4 class="sig-h">Entrée sur creux <small>utile seulement hors marché</small></h4>' +
    '<p class="sg-intro">Une règle de rattrapage : après une forte chute, elle permet de racheter AVANT le signal normal, si la baisse est assez profonde et si 3 sécurités disent que ce n\'est ni une bulle (marché monté trop vite) ni une récession (chômage qui monte).</p>' +
    '<p class="sg-intro">' + phrase(creuxPt) + "</p>" +
    ligne("Verdict", esc(g.creuxVerdict || "—"), g.expose && !g.creux ? "en position : la règle ne sert pas" : "", g.creux ? "acc" : "", EX.creux) +
    (j ? ligneJ("Profondeur de la chute", p1(j.ecartSMA) + " " + coche(j.declLargeur), "exception possible quand le Nasdaq est " + F1.format(Math.abs(j.seuilEcart)) + " % ou plus sous sa moyenne des " + j.smaLen + " séances (≈ 7 mois). Ce n'est pas la ligne de tendance : elle mesure seulement la profondeur de la chute", "", EX.largeur,
        ok_(j.ecartSMA) ? jauge(-25, 15, j.ecartSMA, [[-25, j.seuilEcart, "ok"]], [[j.seuilEcart, F0.format(j.seuilEcart) + " %"], [0, "0"]]) : "",
        ok_(j.ecartSMA) ? (j.declLargeur ? "la baisse est assez large pour déclencher le creux." : "il manque " + F1.format(Math.max(0, j.ecartSMA - j.seuilEcart)) + " points de baisse pour déclencher le creux.") : "") +
      ligneJ("1 · Bulle", (j.bulle === null ? "—" : "×" + F2.format(j.bulle)) + " " + coche(j.bulle === null ? null : j.okBulle), "montée sur 5 ans au pic des 2 ans, doit rester < ×" + F2.format(j.seuilBulle), "", EX.bulle,
        ok_(j.bulle) ? jauge(0, Math.max(j.seuilBulle * 1.6, j.bulle * 1.15), j.bulle, [[0, j.seuilBulle, "ok"], [j.seuilBulle, Math.max(j.seuilBulle * 1.6, j.bulle * 1.15), "ko"]], [[j.seuilBulle, "×" + F0.format(j.seuilBulle)]]) : "",
        ok_(j.bulle) ? (j.okBulle ? "pas de bulle : un creux pourrait être acheté." : "marché jugé en bulle : un creux serait refusé.") : "") +
      ligneJ("2 · Sahm", (j.sahm === null ? "—" : F2.format(j.sahm)) + " " + coche(j.sahm === null ? null : j.okSahm), "chômage US, doit rester < " + F2.format(j.seuilSahm), "", EX.sahm,
        ok_(j.sahm) ? jauge(0, Math.max(j.seuilSahm * 2, j.sahm * 1.15), j.sahm, [[0, j.seuilSahm, "ok"], [j.seuilSahm, Math.max(j.seuilSahm * 2, j.sahm * 1.15), "ko"]], [[j.seuilSahm, F2.format(j.seuilSahm)]]) : "",
        ok_(j.sahm) ? (j.okSahm ? "pas de signe de récession par le chômage." : "le chômage monte : risque de récession, creux refusé.") : "") +
      ligneJ("3 · Sahm 25-54 ans", (j.prime === null ? "—" : F2.format(j.prime)) + " " + coche(j.prime === null ? null : j.okPrime), "emploi des 25-54 ans, doit rester < " + F2.format(j.seuilPrime), "", EX.prime,
        ok_(j.prime) ? jauge(0, Math.max(j.seuilPrime * 2, j.prime * 1.15), j.prime, [[0, j.seuilPrime, "ok"], [j.seuilPrime, Math.max(j.seuilPrime * 2, j.prime * 1.15), "ko"]], [[j.seuilPrime, F2.format(j.seuilPrime)]]) : "",
        ok_(j.prime) ? (j.okPrime ? "l'emploi tient : pas d'alerte." : "l'emploi recule : creux refusé.") : "") +
      ligne("Armée", j.arme ? "oui" : "non", "une seule entrée par épisode : se réarme quand la tendance repasse acheteuse", "", EX.arme) : "");

  const levier = '<h4 class="sig-h">Levier <small>PEA ×2 / CTO ×3 ↔ ×1</small></h4>' +
    '<p class="sg-intro">Un ETF ×2 (LQQ) fait deux fois les mouvements du Nasdaq, à la hausse comme à la baisse. Quand le marché s\'agite trop, ces allers-retours le grignotent : l\'alarme repasse alors en ×1.</p>' +
    ligne("Volatilité 20 séances", vol + " " + coche(g.vol20 === null ? null : g.vol20 < g.volHaut), "passe en ×1 au-dessus de " + g.volHaut + " %, revient sous " + (g.volBas || 25) + " %", "", EX.vol20) +
    ligne("Alarme Omen", "non suivie", "données NYSE introuvables gratuitement : seule la volatilité pilote le ×1", "", EX.omen);

  /* les 3 indicateurs clés, en clair */
  const VHt = g.volHaut || 30, VBt = g.volBas || 25;
  const dPt = !ok_(g.distance) ? "" : g.creux ? "le Nasdaq est " + (g.distance < 0 ? "encore sous" : "au-dessus de") + " sa ligne de tendance : signal de vente (cash), avec l'exception creux qui permet de garder jusqu'à son retour au-dessus."
    : g.expose ? (g.distance > 0 ? "tout va bien : le Nasdaq peut encore baisser d'environ " + F1.format(g.distance) + " % avant que la règle dise de vendre." : "le Nasdaq est passé sous le seuil de vente.")
    : (g.distance < 0 ? "le Nasdaq doit encore monter d'environ " + F1.format(-g.distance / (1 + g.distance / 100)) + " % pour que la règle dise de racheter." : "le Nasdaq est au-dessus du seuil d'achat.");
  const vPt = !ok_(g.vol20) ? "" : g.vol20 >= VHt ? "le marché secoue fort. Au-dessus de " + VHt + " %, on réduit le levier à ×1 ; on remonte à ×2 quand ça redescend sous " + VBt + " %."
    : g.vol20 >= VBt ? "entre les deux : on ne change rien (si tu es en ×1 tu y restes jusqu'à " + VBt + " %, si tu es en ×2 tu y restes jusqu'à " + VHt + " %)."
    : "marché calme : le ×2 est autorisé.";
  const dMin = Math.min(-10, (g.distance || 0) - 3), dMax = Math.max(15, (g.distance || 0) + 3), vMax = Math.max(45, (g.vol20 || 0) + 5);
  const def = t => '<span class="sg-def"><i>C\'est quoi ?</i> ' + t + "</span>";
  const cles = '<div class="m-liste sg-cles">' +
    ligneJ("Tendance <small>distance</small>", p(g.distance), def("on compare le Nasdaq à sa ligne de tendance : sa moyenne des " + EMAS + " dernières semaines (≈ " + EMAS * 5 + " séances). Plus de " + nS(BANDE) + " % en dessous à la clôture : la règle vend" + (sansCreux ? "" : " (sauf exception creux)") + " ; repassé au-dessus : elle rachète.") + seuil + (g.bandeSortie ? " · seuil de vente " + F0.format(g.bandeSortie) + " pts" : ""), g.distance < 0 && g.expose ? "down" : "", EX.distance,
      ok_(g.distance) ? jauge(dMin, dMax, g.distance, [[dMin, 0, "ko"], [0, dMax, "ok"]], [[0, g.creux ? "fin exception" : g.expose ? "vente" : "achat"]]) : "", dPt) +
    ligneJ("Agitation <small>volatilité</small>", vol, def("à quel point le Nasdaq bouge fort d'un jour à l'autre, sur les 20 dernières séances. Un marché calme, c'est 15 à 20 %.") + "20 j · ×1 au-dessus de " + g.volHaut + NNBSP + "%", volCls, EX.vol,
      ok_(g.vol20) ? jauge(0, vMax, g.vol20, [[0, VBt, "ok"], [VBt, VHt, "mi"], [VHt, vMax, "ko"]], [[VBt, VBt + " %"], [VHt, VHt + " %"]]) : "", vPt) +
    (g.creux && g.creuxDepuis ? ligneJ("En creux depuis", esc(court(g.creuxDepuis)), "position ouverte le " + esc(court(g.depuis)) + " · Nasdaq " + p(g.perfDepuis), "", EX.depuis)
      : ligneJ("Depuis", esc(court(g.depuis)), g.expose ? "Nasdaq " + p(g.perfDepuis) : g.joursDepuis + " j hors marché", "", EX.depuis)) +
    "</div>";

  const detail = '<div class="sig-detail"' + (signalOuvert ? "" : " hidden") + ">" +
    '<p class="sg-perim">Cette stratégie ne concerne que ton levier Nasdaq (PEA)' + (g.positionCTO ? " et ton CTO" : "") + ". Le reste de ton portefeuille n'est pas concerné.</p>" +
    (enCreux ? '<h4 class="sig-h">Exception creux · les chiffres <small>datés</small></h4><p class="sg-intro">' +
      (chuteE !== null ? "<b>Le " + esc(frDate(g.creuxDepuis)) + "</b> (" + (venteEv ? "signal de vente" : "achat anticipé") + ") : chute de " + F1.format(chuteE) + NNBSP + "% sous la moyenne des " + SMA + " séances (seuil " + nS(ECART) + NNBSP + "%), sans bulle ni signe de récession. " : "") +
      "<b>Aujourd'hui (" + esc(court(g.date).slice(0, 5)) + ")</b> : Nasdaq " + (ok_(g.distance) ? F1.format(Math.abs(g.distance)) + NNBSP + "% " + (g.distance < 0 ? "sous" : "au-dessus de") + " sa ligne de tendance" : "—") +
      (ok_(jx.ecartSMA) ? ", " + F1.format(Math.abs(jx.ecartSMA)) + NNBSP + "% sous la moyenne des " + SMA + " séances" : "") + (ok_(g.vol20) ? ", agitation " + F1.format(g.vol20) + NNBSP + "%" : "") + ".</p>" +
      '<p class="sg-intro">' + DEUX + "</p>" +
      '<p class="sg-intro"><small>Pourquoi la règle permet de garder : sur 1997-2026, garder à chaque exception a rapporté environ +4,4 points par an de plus que passer en cash, pour une pire baisse comparable ; sans elle, 20 des 24 passages en cash ont été rachetés plus cher. Le passé ne garantit pas l\'avenir.</small></p>' : "") +
    '<h4 class="sig-h">Les 2 voyants qui décident</h4>' + cles +
    /* lot 67 (Théo) : les deux façons de vendre + le creux, en 3 lignes pour débutant */
    '<h4 class="sig-h">Quand la règle vend</h4><ul class="sg-ventes">' +
      "<li><b>×2 → ×1 (alarme)</b> : le marché secoue fort (agitation &gt; " + VH + "\u00a0%) : on enlève le levier mais on reste investi. Fréquent, réagit en quelques jours.</li>" +
      "<li><b>Vente totale (tendance)</b> : si le Nasdaq <b>clôture</b> " + nS(BANDE) + "\u00a0% ou plus sous sa ligne de tendance (moyenne des " + EMAS + " semaines), on vend tout. Rare (baisses longues). On rachète quand il repasse au-dessus de la ligne." + (g.dernierCash && g.dernierCash.du ? " <small class=\"sg-cash\">Dernier passage en cash : " + (g.dernierCash.au ? "du " + esc(court(g.dernierCash.du)) + " au " + esc(court(g.dernierCash.au)) : "depuis le " + esc(court(g.dernierCash.du))) + ".</small>" : "") + "</li>" +
      "<li><b>Hors marché</b> : cash sur le PEA (le PEA n'accepte pas l'or), or sur le CTO.</li>" +
      (sansCreux ? "<li><b>Pas d'exception</b> : plus de " + nS(BANDE) + "\u00a0% sous la ligne de tendance, c'est le cash, même après une très forte baisse (règle de Théo du 26/11/2026)." +
          " <small class=\"sg-cash\">Test sur l'historique (Nasdaq-100, 1997-2026, frais compris) : cette règle, environ 18,2\u00a0% par an, pire baisse −56\u00a0%, 4,3 ordres par an, 18\u00a0% du temps en cash, 6 à 7 e-mails par an ; 20 des 24 passages en cash ont été rachetés plus cher (faux signaux). L'ancienne règle, qui pouvait garder après une chute très profonde : environ 22,7\u00a0% par an, pire baisse −58\u00a0%, 4,1 ordres par an, 13\u00a0% du temps en cash. Le passé ne garantit pas l'avenir.</small></li></ul>"
        : "<li><b>Exception « creux »</b> : après une très forte baisse (au moins " + nS(ECART) + "\u00a0% sous la moyenne des " + SMA + " séances) <b>sans</b> bulle ni signe de récession, la règle permet de ne pas vendre (« vente évitée ») ou de racheter en avance, jusqu'à ce que le Nasdaq repasse au-dessus de sa ligne de tendance (" + EMAS + " semaines). Le message principal reste le cash : c'est à toi de choisir. Le prix si tu gardes : si la baisse continue, tu la subis." +
          " <small class=\"sg-cash\">Test sur l'historique (Nasdaq-100, 1997-2026) : environ +4,4 points par an par rapport à la même règle sans exception (en gardant à chaque fois), pour une pire baisse comparable ; sans elle, 20 des 24 passages en cash ont été rachetés plus cher. Le passé ne garantit pas l'avenir.</small></li></ul>") +
    '<div data-aide><h4 class="sig-h"><span>Historique des bascules' + qm + '</span><small>journal · 8 derniers changements</small></h4>' + aide(EX.journal) + "</div>" + journal +
    blocBilanSignal(g) +
    '<details class="sg-rub" data-rub="curieux"><summary><span>Pour les curieux</span><b>tous les indicateurs</b></summary><div class="m-liste">' + levier + (sansCreux ? "" : creux) + "</div></details>" +
    '<div class="sig-pied">Calcul du ' + esc(g.majLe || "") + " · données " + esc(g.source || "") + " · ligne de tendance " + F0.format(g.ema) + " · seuil de vente " + F0.format(g.bandeSortie) + "</div>" +
  "</div>";

  /* vue courte : UNE consigne, puis deux règles en deux blocs : ce que tu détiens (position) / où va l'argent nouveau (apport) */
  /* 26/11 (Théo) : la phrase dit exactement ce que la règle fait détenir, comme la consigne et l'e-mail */
  const posPEA = enCreux ? "cash : signal de vente, le Nasdaq est sous sa ligne de tendance (moyenne des " + EMAS + " semaines). Exception creux : la règle permet aussi de " + (venteEv ? "garder ton " : "détenir le ") + D.pea + (g.reduit ? " (pas de LQQ : l'agitation est au-dessus de l'alarme)" : "") + "."
    : !g.expose ? "cash : le Nasdaq est sous sa ligne de tendance (moyenne des " + EMAS + " semaines)."
    : g.reduit ? "Nasdaq-100 ×1, pas de LQQ : " + (g.vol20 !== null && g.vol20 !== undefined && g.vol20 < g.volHaut
        ? "l'alarme reste allumée tant que l'agitation n'est pas redescendue sous " + g.volBas + " % (aujourd'hui " + vol + ")."   // lot 67 : entre-deux (hystérésis), pas « trop agité »
        : "le marché est trop agité (agitation " + vol + ", alarme au-dessus de " + g.volHaut + " %).")
    : "LQQ ×2 : le Nasdaq est au-dessus de sa ligne de tendance et le marché est assez calme.";
  const ctoCls = g.positionCTO === "OR" ? "or" : /×1/.test(g.positionCTO || "") ? "x1" : "x3";
  const posCTO = enCreux ? "or : signal de vente (au lieu du cash du PEA). Exception creux : la règle permet aussi de " + (venteEv ? "garder ton " : "détenir le ") + D.cto + "." : g.positionCTO === "OR" ? "or, au lieu du cash du PEA." : /×1/.test(g.positionCTO || "") ? "même alarme : Nasdaq-100 ×1 au lieu du QQQ3 (×3)." : "même signal que le PEA, en ×3.";
  const apM = apportSignal(g);
  const apportTxt = enCreux ? "signal de vente : pas de versement en actions, l'argent nouveau reste en cash" + (g.positionCTO ? " (or au CTO)" : "") + ". Si tu gardes (exception creux) : ×" + apM + "."
    : versementSignal(g) + ", dans le compte où tu verses.";
  const ligneP = (lab, ex, pastilles, ph, cl) => '<div class="sg-pl' + (cl || "") + '" role="button" tabindex="0" aria-expanded="false"' + (ex ? " data-aide" : "") + '><span class="sig-lab">' + lab + (ex ? qm : "") + "</span>" +
    '<span class="sg-pp">' + pastilles + '</span><span class="sg-pi" aria-hidden="true">ⓘ</span><span class="sg-ph" hidden>' + ph + "</span>" + (ex ? aide(ex) : "") + "</div>";
  const consigne = enCreux ? (bascCreux ? "Si tu as gardé (exception creux), à la prochaine ouverture :" : venteEv ? "💶 Signal de vente : passer en cash · exception creux possible" : "💶 Tendance : reste en cash · exception creux possible") : enCash ? (cashRecent ? "💶 PASSE EN CASH" : "💶 RESTE EN CASH") : g.transition ? (MG && MG.titre ? esc(MG.titre) : "À faire à la prochaine ouverture de la bourse :") : g.provisoire && g.provisoire.changement ? "À faire : rien pour l'instant, la séance américaine n'est pas finie." : "À faire : rien. Garde ce que tu as.";
  const rien = !msg;   // ni ordre, ni alerte, ni séance provisoire qui changerait la position
  /* 26/11 (Théo) : le texte (ordres, pourquoi, jusqu'à quand) se replie en touchant l'en-tête ; déplié d'office quand la position change,
     ensuite le choix de Théo est gardé sur l'appareil. Badge de l'état visible même replié. */
  const plie = !rien && textePlie(g);
  const badge = !g.expose ? "💶 Cash" : g.reduit ? "×1" : "×2 / ×3";
  return '<div class="sig ' + cls + (rien ? " rien" : "") + (plie ? " plie" : "") + '">' +
    '<div class="sig-haut">' +
    '<button type="button" class="sig-plie"' + (rien ? ' disabled' : ' aria-expanded="' + !plie + '" aria-label="Afficher ou masquer le texte du signal"') + ">" +
      (rien ? "" : '<span class="chev-t" aria-hidden="true">' + (plie ? "▸" : "▾") + "</span>") +
      '<span class="sig-lab">' + (g.positionCTO ? "Levier · PEA + CTO" : "Signal levier · PEA") + "</span>" +
      '<span class="sg-badge b-' + (!g.expose ? "cash" : g.reduit ? "x1" : "x2") + '">' + badge + "</span></button>" +
    '<button type="button" class="sig-tete" aria-expanded="' + signalOuvert + '">' +
      (rien ? '<span class="sg-rien" title="Aucun ordre · séance du ' + esc(court(g.date)) + '">✓ Rien à faire</span>' : "") + '<span class="sig-voir">' + (signalOuvert ? "Masquer" : "Comprendre") + '</span><span class="chev" aria-hidden="true">›</span>' +
    "</button></div>" +
    (rien ? "" : '<div class="sg-texte"' + (plie ? " hidden" : "") + '><p class="sg-consigne' + (g.transition || cashRecent || venteEv ? " ordre" : "") + (enCash || enCreux ? " cash" : "") + '">' + consigne + "</p>" + msg + "</div>") +
    /* lot 66 b (Théo) : vue repliée = consigne + 3 lignes à pastilles ; la phrase d'une ligne s'ouvre en la touchant (une seule à la fois) */
    '<div class="sg-bloc sg-lignes">' +
      ligneP("PEA", "", '<span class="sig-pos pea-' + cls + '">' + (enCreux ? "cash" : esc(D.pea)) + "</span>" + (enCreux ? '<em class="sg-exc">ou ' + esc(D.pea) + (venteEv ? " si tu gardes" : " si tu achètes") + "</em>" : ""), "<b>À détenir selon la règle</b> : " + posPEA) +
      (g.positionCTO ? ligneP("CTO", EX.cto, '<span class="sig-pos cto-' + (enCreux ? "or" : ctoCls) + '">' + (D.cto === "or" ? "OR" : esc(D.cto)) + "</span>" + (enCreux ? '<em class="sg-exc">ou ' + esc(D.cto) + (venteEv ? " si tu gardes" : " si tu achètes") + "</em>" : ""), posCTO + ' <span class="sub">même signal · ×1 si alarme · or hors marché</span>') : "") +
      ligneP("Versement", EX.apport, '<span class="sg-ou sg-vers">' + esc(versementSignal(g).replace(/^comme tes positions : /, "")) + "</span>", "<b>Ton versement du mois</b> (l'argent nouveau seulement) : " + apportTxt) +
    "</div>" +
    detail +
  "</div>";
}
function brancherSignal(v) {
  const carte = v.querySelector(".sig"); if (!carte) return;
  carte.addEventListener("click", e => {
    const q = e.target.closest(".qm-b"); if (!q) return;
    e.stopPropagation();
    if (q.dataset.case) {   // cases du détail : explication en pleine largeur sous les cases
      carte.querySelectorAll(".sig-case-aide").forEach(d => { d.hidden = d.dataset.pour !== q.dataset.case || !d.hidden; });
      carte.querySelectorAll("[data-case]").forEach(b => b.classList.toggle("on", b === q && !carte.querySelector('.sig-case-aide[data-pour="' + q.dataset.case + '"]').hidden));
      return;
    }
    const z = q.closest("[data-aide]"); if (z) z.classList.toggle("aide-on");
  });
  const pl = carte.querySelector(".sig-plie"), tx = carte.querySelector(".sg-texte");
  if (pl && tx) pl.addEventListener("click", () => { const plie = !tx.hidden; tx.hidden = plie; carte.classList.toggle("plie", plie); pl.setAttribute("aria-expanded", String(!plie));
    const c = pl.querySelector(".chev-t"); if (c) c.textContent = plie ? "▸" : "▾"; if (M.signal) noterPlie(M.signal, plie); });
  const t = carte.querySelector(".sig-tete");
  t.addEventListener("click", () => { signalOuvert = !signalOuvert; t.setAttribute("aria-expanded", String(signalOuvert)); carte.querySelector(".sig-detail").hidden = !signalOuvert; const vv = t.querySelector(".sig-voir"); if (vv) vv.textContent = signalOuvert ? "Masquer" : "Comprendre"; });
  carte.querySelectorAll('.sg-pl[role="button"]').forEach(l => { const bascule = () => { const on = !l.classList.contains("on");
      carte.querySelectorAll(".sg-pl.on").forEach(x => { x.classList.remove("on"); x.setAttribute("aria-expanded", "false"); x.querySelector(".sg-ph").hidden = true; });
      if (on) { l.classList.add("on"); l.setAttribute("aria-expanded", "true"); l.querySelector(".sg-ph").hidden = false; } };
    l.addEventListener("click", ev => { if (ev.target.closest(".qm-b, .aide")) return; bascule(); });
    l.addEventListener("keydown", ev => { if ((ev.key === "Enter" || ev.key === " ") && ev.target === l) { ev.preventDefault(); bascule(); } }); });   // lot 66 b
  carte.querySelectorAll("details.sg-rub").forEach(d => { if (SIG_RUB.has(d.dataset.rub)) d.open = true; d.addEventListener("toggle", () => { if (d.open) SIG_RUB.add(d.dataset.rub); else SIG_RUB.delete(d.dataset.rub); }); });   // lot 66 : ouvertes pendant la visite, fermées à chaque ouverture de l'appli
}

/* ================= Graphiques du patrimoine (onglet Stats) ================= */
function cleMoisIso(iso) { return +String(iso).slice(0, 4) * 100 + +String(iso).slice(5, 7); }
function libMoisK(k) { return MOIS[k % 100 - 1] + " " + Math.floor(k / 100); }
/* aires empilées : couches positives au-dessus de zéro, dettes en dessous, ligne du total net par-dessus */
function empile(box, conf) {
  const svg = box.querySelector("svg"), tip = box.querySelector(".tip");
  const xs = conf.x, n = xs.length; if (n < 2) { box.hidden = true; return; }
  const W = Math.max(280, box.clientWidth - 20), H = W < 420 ? 220 : 250, m = { l: 46, r: 10, t: 10, b: 24 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const haut = xs.map((_, i) => conf.couches.reduce((a, c) => a + Math.max(0, c.v[i] || 0), 0));
  const bas = xs.map((_, i) => (conf.negs || []).reduce((a, c) => a - Math.max(0, c.v[i] || 0), 0));
  let mn = Math.min(0, ...bas), mx = Math.max(...haut, ...(conf.ligne ? conf.ligne.v.filter(ok) : []));
  const pad = (mx - mn) * .06 || 1; mx += pad; if (mn < 0) mn -= pad;
  const ticks = graduations(mn, mx, 4); mn = Math.min(mn, ticks[0]); mx = Math.max(mx, ticks[ticks.length - 1]);
  const X = i => m.l + i / (n - 1) * iw, Y = v => m.t + ih - (v - mn) / (mx - mn) * ih;
  let o = "";
  ticks.forEach(t => {
    o += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '" style="stroke:var(' + (Math.abs(t) < 1e-9 ? "--ink-3" : "--rule") + ')"' + (Math.abs(t) < 1e-9 ? "" : ' stroke-dasharray="2 4"') + "/>";
    o += '<text x="' + (m.l - 6) + '" y="' + (Y(t) + 3.5).toFixed(1) + '" text-anchor="end">' + esc(axeEur(t)) + "</text>";
  });
  let dx = -99;
  xs.forEach((k, i) => {
    const lab = i === 0 || k % 100 === 1 ? (k % 100 === 1 ? String(Math.floor(k / 100)) : MOIS[k % 100 - 1]) : (n <= 14 ? MOIS[k % 100 - 1] : "");
    if (!lab) return; const x = X(i); if (x - dx < 40) return; dx = x;
    o += '<text x="' + x.toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(lab) + "</text>";
  });
  // V15.17 : couches lissées (courbe monotone), dégradé vertical et liseré clair sur le dessus ; nom de la couche à droite si elle est assez épaisse
  const uid = "e" + Math.random().toString(36).slice(2, 7); let defs = "";
  const courbe = (pts, debut) => { // pts = [[x,y]…] ; tangentes monotones (Fritsch-Carlson)
    const k = pts.length; if (k < 3) return pts.map((p, i) => (i || !debut ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
    const dx = [], dy = [], m2 = []; for (let i = 0; i < k - 1; i++) { dx.push(pts[i + 1][0] - pts[i][0]); dy.push(pts[i + 1][1] - pts[i][1]); m2.push(dy[i] / (dx[i] || 1)); }
    const t = [m2[0]]; for (let i = 1; i < k - 1; i++) t.push(m2[i - 1] * m2[i] <= 0 ? 0 : (m2[i - 1] + m2[i]) / 2); t.push(m2[k - 2]);
    for (let i = 0; i < k - 1; i++) { if (m2[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; } const a = t[i] / m2[i], b = t[i + 1] / m2[i], h = a * a + b * b; if (h > 9) { const q = 3 / Math.sqrt(h); t[i] = q * a * m2[i]; t[i + 1] = q * b * m2[i]; } }
    let d = (debut ? "M" : "L") + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (let i = 0; i < k - 1; i++) d += "C" + (pts[i][0] + dx[i] / 3).toFixed(1) + " " + (pts[i][1] + t[i] * dx[i] / 3).toFixed(1) + " " + (pts[i + 1][0] - dx[i] / 3).toFixed(1) + " " + (pts[i + 1][1] - t[i + 1] * dx[i] / 3).toFixed(1) + " " + pts[i + 1][0].toFixed(1) + " " + pts[i + 1][1].toFixed(1);
    return d;
  };
  let nG = 0;
  const aire = (bas0, haut1, c, op) => {
    const id = uid + (nG++), hautP = haut1.map((v, i) => [X(i), Y(v)]), basP = bas0.map((v, i) => [X(i), Y(v)]).reverse();
    defs += '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:' + c + ';stop-opacity:' + Math.min(1, (op || .85) + .08) + '"/><stop offset="1" style="stop-color:' + c + ';stop-opacity:' + ((op || .85) * .78).toFixed(2) + '"/></linearGradient>';
    return '<path d="' + courbe(hautP, true) + courbe(basP, false) + 'Z" fill="url(#' + id + ')"/>' +
      '<path d="' + courbe(hautP, true) + '" fill="none" style="stroke:' + c + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="' + courbe(hautP, true) + '" fill="none" style="stroke:var(--panel)" stroke-width=".8" stroke-opacity=".7" transform="translate(0,1.2)"/>';
  };
  let base = xs.map(() => 0); const etiq = [];
  conf.couches.forEach(c => { const h = base.map((b, i) => b + Math.max(0, c.v[i] || 0)); o += aire(base, h, c.c, c.op);
    const ep = Y(base[n - 1]) - Y(h[n - 1]); if (ep >= 13) etiq.push([Y((base[n - 1] + h[n - 1]) / 2), c.nom]); base = h; });
  base = xs.map(() => 0);
  (conf.negs || []).forEach(c => { const h = base.map((b, i) => b - Math.max(0, c.v[i] || 0)); o += aire(base, h, c.c, c.op || .45); base = h; });
  if (conf.ligne) {
    let d = ""; conf.ligne.v.forEach((v, i) => { if (ok(v)) d += (d ? "L" : "M") + X(i).toFixed(1) + " " + Y(v).toFixed(1); });
    o += '<path d="' + d + '" fill="none" style="stroke:var(--ink)" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>';
  }
  etiq.forEach(([y, nom]) => { o += '<text class="e-lab" x="' + (W - m.r - 6) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' + esc(String(nom).replace(/\s*\(.*\)$/, "").replace(/ et autres$/, "").replace(/ Fortuneo$/, "").slice(0, 16)) + "</text>"; });
  o = "<defs>" + defs + "</defs>" + o;
  o += '<line class="cross" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ih) + '" style="stroke:var(--ink-3)" visibility="hidden"/>';
  o += '<rect class="hit" x="' + m.l + '" y="0" width="' + iw + '" height="' + H + '" fill="transparent"/>';
  svg.setAttribute("viewBox", "0 0 " + W + " " + H); svg.setAttribute("height", H); svg.innerHTML = o;
  const cross = svg.querySelector(".cross"), hit = svg.querySelector(".hit");
  const montrer = ev => {
    const r = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.round(((ev.clientX - r.left) * W / r.width - m.l) / iw * (n - 1))));
    const x = X(i); cross.setAttribute("x1", x); cross.setAttribute("x2", x); cross.setAttribute("visibility", "visible");
    const rows = conf.couches.concat(conf.negs || []).filter(c => ok(c.v[i]) && c.v[i]).map(c => '<div class="row" style="--c:' + c.c + '"><span>' + esc(c.nom) + "</span><span>" + (conf.negs && conf.negs.includes(c) ? MOINS : "") + eur(c.v[i]) + "</span></div>").join("");
    tip.hidden = false;
    const totI = conf.couches.reduce((a, c) => a + Math.max(0, c.v[i] || 0), 0) - (conf.negs || []).reduce((a, c) => a + Math.max(0, c.v[i] || 0), 0);
    tip.innerHTML = "<b>Fin " + esc(libMoisK(xs[i])) + " · " + eur(totI) + "</b>" + rows + (conf.ligne && ok(conf.ligne.v[i]) ? '<div class="row" style="--c:var(--ink)"><span>' + esc(conf.ligne.nom) + "</span><span>" + eur(conf.ligne.v[i]) + "</span></div>" : "");
    const bx = box.getBoundingClientRect(), px = x / W * r.width + (r.left - bx.left), tw = tip.offsetWidth;
    let left = px + 14; if (left + tw > bx.width - 6) left = px - tw - 14;
    tip.style.left = Math.max(6, left) + "px"; tip.style.top = "38px";
  };
  hit.addEventListener("pointermove", montrer); hit.addEventListener("pointerdown", montrer);
  hit.addEventListener("pointerleave", () => { cross.setAttribute("visibility", "hidden"); tip.hidden = true; });
}
function boiteEmpile(id, leg) {
  return '<div class="chart-box" id="' + id + '"><div class="legend">' + leg.map(l => '<span><i class="carre" style="background:' + l.c + (l.op ? ";opacity:" + l.op : "") + '"></i>' + esc(l.nom) + "</span>").join("") +
    '</div><svg class="chart" role="img" aria-label="Graphique empilé"></svg><div class="tip" hidden></div></div>';
}
/* lot 46 (Théo, 20/11) : point de départ des graphiques de patrimoine (« Patrimoine dans le temps » dans ses 3 vues, « Livret par livret »)
   et des phrases « depuis … », par profil. Avant l'achat de l'appartement, une partie du patrimoine était en route vers l'immobilier :
   les courbes et « depuis fin déc. 2025 » n'avaient pas de sens. Décision de Théo : « le graphique commence au niveau du trou ».
   Le trou = le relevé de fin de mois le plus bas du fichier de Théo : fin juillet 2026 (achat de l'appartement le 06/07/2026 ; l'argent
   revient sur les comptes en août). Même date pour Clément. Absent = depuis le début, comme avant (Devlin, Kévin…).
   Seulement l'affichage : performance, paliers, Versus gardent tout l'historique. Valeur = premier relevé de fin de mois montré, « aaaa-mm ». */
const DEPART_GRAPHES = { "Théo": "2026-07", "Clément": "2026-07" };
function departGraphes() {
  const qui = (M && M.personne) || (typeof moiVrai === "function" ? moiVrai() : null) || ETAT.moi || "";
  const n = x => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const k = Object.keys(DEPART_GRAPHES).find(x => n(x) === n(qui));
  return k ? DEPART_GRAPHES[k] : null;
}
function departK() { const d = departGraphes(); return d ? +d.slice(0, 4) * 100 + +d.slice(5, 7) : null; }
/** « depuis fin juil. 2026 » ; au point de départ d'un profil : « depuis l'achat (juil. 2026) », en version longue « depuis l'achat de l'appartement (juillet 2026) ».
   lot 50 (Théo, 20/11 : « l'appartement, je l'ai depuis début juillet ») : on ne dit plus « fin juillet ». Le premier point reste le relevé réel de fin
   juillet (le plancher : fin juin, l'argent n'était pas encore parti, la courbe aurait commencé en haut) ; l'axe vertical part toujours de 0 (`empile`). */
function txtDepuis(k, long) { return k === departK() ? (long ? "depuis l'achat de l'appartement (" + MOIS_L[k % 100 - 1] + " " + Math.floor(k / 100) + ")" : "depuis l'achat (" + libMoisK(k) + ")") : "depuis fin " + libMoisK(k); }
/** garde les points à partir du mois de départ du profil (k = aaaamm) ; s'il en resterait moins de 2, on garde tout */
function depuisDepart(liste, cle) {
  const d = departGraphes(); if (!d) return liste;
  const k0 = +d.slice(0, 4) * 100 + +d.slice(5, 7), l = liste.filter(x => cle(x) >= k0);
  return l.length >= 2 ? l : liste;
}
/* A · patrimoine dans le temps, brut ou net */
function donneesPatrimoine() {
  const s = depuisDepart(seriePatrimoine(), x => x.an * 100 + x.mo); if (s.length < 2) return null;
  const app = (M.parametres || {}).appart || null, mens = (M.prets || {}).mensuel || [];
  return s.map(x => {
    const finIso = isoJour(new Date(x.an, x.mo, 0));
    let prix = 0, dette = 0;
    if (app && app.prix && app.date && finIso >= app.date) {
      prix = app.prix;
      let restant = null; mens.forEach(r => { if (r[0] <= finIso) restant = r[1]; });
      dette = mens.length ? (restant === null ? mens[0][1] : restant) : Math.max(0, prix - x.immo);
    }
    return Object.assign({ k: x.an * 100 + x.mo, prix, dette }, x);
  });
}
/* Détail du patrimoine : une couche par enveloppe de bourse (si le fichier garde leur valeur mois par mois)
   et une par livret (soldes de fin de mois) ; ce qui ne se répartit pas reste dans une couche « autres » */
const MIX_DET = [0, .3, .5, .66, .78, .86];
/* teinte d'une même famille, en couleur pleine (lisible aussi dans la légende et l'info-bulle) : var(--s1) mélangée au fond du graphique */
function nuance(v, t) {
  if (!t) return "var(" + v + ")";
  const lire = css => { const el = document.createElement("i"); el.style.cssText = "position:absolute;visibility:hidden;color:" + css; (document.querySelector(".moi") || document.body).appendChild(el);
    const c = getComputedStyle(el).color; el.remove();
    try { const cv = document.createElement("canvas"); cv.width = cv.height = 1; const x = cv.getContext("2d"); x.fillStyle = "#000"; x.fillStyle = c; x.fillRect(0, 0, 1, 1); return Array.from(x.getImageData(0, 0, 1, 1).data.slice(0, 3)); } catch (e) { return null; } };
  const a = lire("var(" + v + ")"), f = lire("var(--panel)");
  return a && f ? "rgb(" + a.map((c, i) => Math.round(c + (f[i] - c) * t)).join(",") + ")" : "var(" + v + ")";
}
function detailPatrimoine(d) {
  const h = M.historique || {}, cols = h.cols || [], rows = h.rows || [], bourse = [], ep = [];
  const envs = seriesValeur().filter(([k]) => k);
  if (envs.length) {
    const lignes = d.map(x => { let r = null; rows.forEach(z => { if (Math.floor(z[0] / 100) <= x.k) r = z; }); return r; });
    envs.forEach(([k, l]) => { const c = cols.indexOf("v_" + k); const v = lignes.map(r => r && ok(r[c]) ? r[c] : 0); if (v.some(z => z > .5)) bourse.push({ nom: l, v }); });
    if (bourse.length) {
      const reste = d.map((x, i) => Math.max(0, x.bourse - bourse.reduce((a, c) => a + c.v[i], 0)));
      if (reste.some(v => v > 1)) bourse.push({ nom: "Bourse · autres", v: reste });
    }
  }
  const em = M.epargneMois;
  if (em && em.rows && em.rows.length) {
    const par = {}; em.rows.forEach(r => { par[cleMoisIso(r[0])] = r; });
    em.comptes.forEach((nom, j) => { const v = d.map(x => par[x.k] ? Math.max(0, par[x.k][j + 1] || 0) : 0); if (v.some(z => z > .5)) ep.push({ nom: nom.replace(/\s+Banque Pop\.?$/, ""), v }); });
    if (ep.length) {
      const somme = i => ep.reduce((a, c) => a + c.v[i], 0);
      const av = d.map((x, i) => par[x.k] ? Math.max(0, x.epargne - somme(i)) : 0), nd = d.map(x => par[x.k] ? 0 : Math.max(0, x.epargne));
      if (av.some(v => v > .5)) ep.push({ nom: "Assurance-vie et autres", v: av });
      if (nd.some(v => v > .5)) ep.push({ nom: "Épargne (pas de détail ce mois-là)", v: nd });
    }
  }
  const PAL_B = ["#5B8DEF", "#9B6BFF", "#18A9C7", "#E5484D", "#D6619E", "#3F5FBF"], PAL_E = ["#2BB673", "#C9A227", "#F2A33A", "#8C7B5A", "#6FCF97"];   // V15.17 : vraies couleurs
  bourse.forEach((c, i) => { c.c = PAL_B[i % PAL_B.length]; c.op = .9; });
  ep.forEach((c, i) => { c.c = PAL_E[i % PAL_E.length]; c.op = .9; });
  return { bourse, ep, utile: bourse.length > 1 || ep.length > 1 };
}
function couchesPatrimoine(d, brut, aImmo, det) {
  const bourse = det && det.bourse.length ? det.bourse : [{ nom: "Bourse", v: d.map(x => x.bourse), c: "var(--s1)" }];
  const ep = det && det.ep.length ? det.ep : [{ nom: "Épargne", v: d.map(x => x.epargne), c: "var(--s2)" }];
  const couches = bourse.concat(ep);
  if (aImmo) couches.push(brut ? { nom: "Appartement", v: d.map(x => x.prix), c: "var(--s3)" } : { nom: "Immobilier net", v: d.map(x => x.immo), c: "var(--s3)" });
  return couches;
}
function modePatri(aImmo) { return aImmo && (PREF.patri === "net" || PREF.patri === "brut") ? PREF.patri : "fin"; }   // lot 27 : financier par défaut (comme le million)
function blocPatrimoineTemps() {
  const d = donneesPatrimoine(); if (!d) return "";
  const aImmo0 = d.some(x => x.prix > 0), mp = modePatri(aImmo0), brut = mp === "brut", aImmo = aImmo0 && mp !== "fin";
  const det0 = detailPatrimoine(d), voirDet = det0.utile && PREF.patriDet === "1", det = voirDet ? det0 : null;
  const leg = couchesPatrimoine(d, brut, aImmo, det).map(c => ({ nom: c.nom, c: c.c, op: c.op }))
    .concat(brut && aImmo ? [{ nom: "Prêts restants", c: "var(--down)", op: .5 }] : []);
  const der = d[d.length - 1], prem = d.find(x => x.complet) || d[0];
  const net = x => x.bourse + x.epargne + (aImmo ? x.immo : 0);
  /* lot 46 : une variation par année civile complète après le départ (profils avec départ seulement ; jamais l'année du départ) */
  const parAn = [], dk = departK();
  if (dk) d.forEach(x => { if (x.k % 100 !== 12) return; const a = d.find(y => y.k === x.k - 100); if (a && a.k >= dk) parAn.push(" En " + Math.floor(x.k / 100) + " : <b class=\"" + sens(net(x) - net(a)) + "\">" + eur(net(x) - net(a), 0, true) + "</b>."); });
  return acc("m-ptemps", "Patrimoine dans le temps", "fin de mois · " + esc(txtDepuis(prem.k)) + " : " + (ETAT.discret === "oui" ? "•••" : eur(net(der) - net(prem), 0, true)), 
    (aImmo0 ? '<div class="chips m-filtre" role="group" aria-label="Ce qui est compté">' + [["fin", "Financier"], ["net", "Avec l'immobilier"], ["brut", "Brut (dette)"]].map(([k, l]) => '<button class="chip" type="button" data-m-patri="' + k + '" aria-pressed="' + (mp === k) + '">' + l + "</button>").join("") + "</div>" : "") +
    (det0.utile ? '<div class="chips m-filtre" role="group" aria-label="Niveau de détail"><button class="chip" type="button" data-m-patridet="" aria-pressed="' + !voirDet + '">Vue d\'ensemble</button><button class="chip" type="button" data-m-patridet="1" aria-pressed="' + voirDet + '">Détail par compte</button></div>' : "") +
    boiteEmpile("g-patri", leg) +
    '<p class="resume">' + (!aImmo ? "Financier : épargne, bourse et assurance-vie" + (aImmo0 ? ", sans l'immobilier (comme le million). " : ". ") : brut ? "Brut : l'appartement compté à son prix, les prêts restants en dessous de zéro. Les pointillés suivent ton patrimoine net. " : "Net : l'immobilier compte pour son prix moins les prêts restants. ") +
      (voirDet ? "Détail : une couche par enveloppe de bourse" + (det.bourse.length ? "" : " (ton fichier ne garde pas leur valeur mois par mois : la bourse reste en un bloc)") + " et une par livret. " : "") +
      esc(majuscule(txtDepuis(prem.k, true))) + " : <b class=\"" + sens(net(der) - net(prem)) + "\">" + eur(net(der) - net(prem), 0, true) + "</b>." + parAn.slice(-3).join("") + "</p>", false);   // v17.38 (Théo) : replié par défaut
}
function dessinerPatrimoine() {
  const box = document.getElementById("g-patri"); if (!box) return;
  const d = donneesPatrimoine(); if (!d) return;
  const aImmo0 = d.some(x => x.prix > 0), mp = modePatri(aImmo0), brut = mp === "brut", aImmo = aImmo0 && mp !== "fin";
  const det0 = detailPatrimoine(d), det = det0.utile && PREF.patriDet === "1" ? det0 : null;
  empile(box, { x: d.map(x => x.k), couches: couchesPatrimoine(d, brut, aImmo, det), trait: !!det, negs: brut && aImmo ? [{ nom: "Prêts restants", v: d.map(x => x.dette), c: "var(--down)" }] : [],
    ligne: brut && aImmo ? { nom: "Patrimoine net", v: d.map(x => x.bourse + x.epargne + x.immo) } : null });
}
/* C · épargne livret par livret (soldes envoyés par l'API V10 ; l'assurance-vie = total épargne du mois moins les livrets) */
const COUL_EP = ["var(--gold)", "var(--p1)", "var(--p2)", "var(--p3)", "var(--accent)", "var(--idx)"];
function donneesEpargne() {
  const em = M.epargneMois; if (!em || !em.rows || !em.rows.length) return null;
  const mpm = {}; (M.moisParMois || []).forEach(r => { mpm[String(r.mois).slice(0, 7)] = r; });
  const rows = depuisDepart(em.rows.filter(r => { const t = mpm[String(r[0]).slice(0, 7)]; return t && ok(t.epargne); }), r => cleMoisIso(r[0]));   // lot 46 : même départ que le patrimoine
  if (rows.length < 2) return null;
  const av = rows.map(r => { const t = mpm[String(r[0]).slice(0, 7)]; return Math.max(0, (t.epargne || 0) + (t.uc || 0) - r.slice(1).reduce((a, b) => a + b, 0)); });
  const couches = em.comptes.map((nom, j) => ({ nom: nom.replace(/\s+Banque Pop\.?$/, ""), v: rows.map(r => r[j + 1]), c: COUL_EP[j % COUL_EP.length] })).filter(c => c.v.some(x => x > 0.5));
  if (av.some(x => x > 0.5)) couches.push({ nom: "Assurance-vie et autres", v: av, c: "var(--c-av)" });
  return { x: rows.map(r => cleMoisIso(r[0])), couches };
}
function blocEpargneTemps() {
  const d = donneesEpargne();
  if (!d) return M.epargneMois === undefined && (M.epargne || []).length && typeof estAdmin === "function" && estAdmin() ? '<p class="info">Admin : « livret par livret » a besoin de la version 10 de l\'API patrimoine.</p>' : "";   // lot 27 : message technique réservé à l'admin
  const der = d.couches.map(c => c.v[c.v.length - 1]), tot = der.reduce((a, b) => a + b, 0);
  return acc("m-ep-temps", "Livret par livret", "fin de mois", boiteEmpile("g-epargne", d.couches) +
    '<p class="resume">Aujourd\'hui : ' + d.couches.map((c, i) => esc(c.nom) + " <b>" + eur(der[i]) + "</b>").join(" · ") + " · total <b>" + eur(tot) + "</b>.</p>", false);
}
function dessinerEpargne() { const box = document.getElementById("g-epargne"); if (!box || !box.offsetParent) return; const d = donneesEpargne(); if (d) empile(box, { x: d.x, couches: d.couches }); }
/* B · prêt année par année (lot 27 : seulement le graphique, replié sous Immobilier ; les chiffres clés sont déjà dans les tuiles du prêt) */
function blocPret() {
  const p = M.prets; if (!p || !(p.mensuel || []).length) return "";
  const emprunte = Math.max(...p.mensuel.map(r => r[1])), restant = p.actuel ? p.actuel.restant : p.mensuel[0][1];
  return acc("m-pret", "Le prêt année par année", emprunte > 0 ? "remboursé " + pct((emprunte - restant) / emprunte, 0, false) : "", '<div class="chart-box pret-an" id="g-pret"></div>', false);
}
/* V15.15 · le prêt année par année : barres « capital remboursé » + « intérêts payés » (passé plein, à venir pâle, année en cours entourée) */
function dessinerPret() {
  const box = document.getElementById("g-pret"); if (!box) return;
  const discret = ETAT.discret === "oui";   // lot 27 : aucun montant en mode discret (ni axe, ni bulle)
  const mens = M.prets.mensuel || []; if (mens.length < 2) { box.innerHTML = ""; return; }
  const avecInt = mens.some(r => r[2] > 0), parAn = {};
  for (let i = 1; i < mens.length; i++) { const y = +String(mens[i][0]).slice(0, 4), a = parAn[y] = parAn[y] || { cap: 0, int: 0 }; a.cap += Math.max(0, mens[i - 1][1] - mens[i][1]); a.int += mens[i][2] || 0; }
  const ys = Object.keys(parAn).map(Number).sort((a, b) => a - b), an = new Date().getFullYear();
  const W = 320, H = 170, g = 34, dr = 4, hb = 18, n = ys.length, max = Math.max(...ys.map(y => parAn[y].cap + parAn[y].int)) || 1;
  const pas = (W - g - dr) / n, bw = Math.max(4, pas * .7), Y = v => 8 + (1 - v / max) * (H - 8 - hb);
  const kE = v => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(".", ",") + " k" : String(Math.round(v));
  const grille = [max, max / 2].map(v => '<line x1="' + g + '" x2="' + (W - dr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="gr"/><text x="' + (g - 4) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + (discret ? "" : kE(v)) + "</text>").join("");
  const barres = ys.map((y, i) => {
    const a = parAn[y], x = g + i * pas + (pas - bw) / 2, op = y <= an ? 1 : .42, yc = Y(a.cap), yi = Y(a.cap + a.int);
    return '<g opacity="' + op + '"><title>' + y + (discret ? "" : " : " + Math.round(a.cap).toLocaleString("fr-FR") + " € de capital" + (avecInt ? ", " + Math.round(a.int).toLocaleString("fr-FR") + " € d'intérêts" : "")) + "</title>" +
      '<rect x="' + x.toFixed(1) + '" y="' + yc.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, H - hb - yc).toFixed(1) + '" rx="2" fill="var(--accent)"/>' +
      (avecInt && a.int > 0 ? '<rect x="' + x.toFixed(1) + '" y="' + yi.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, yc - yi).toFixed(1) + '" rx="2" fill="#F2A33A"/>' : "") +
      (y === an ? '<rect x="' + (x - 2).toFixed(1) + '" y="' + (yi - 2).toFixed(1) + '" width="' + (bw + 4).toFixed(1) + '" height="' + (H - hb - yi + 2).toFixed(1) + '" rx="3" fill="none" stroke="var(--ink)" stroke-width="1.2"/>' : "") + "</g>";
  }).join("");
  const montrer = (y, i) => i === 0 || i === n - 1 || y === an || (y % 5 === 0 && Math.abs(y - an) > 1 && i > 1 && i < n - 2);
  const lab = ys.map((y, i) => montrer(y, i) ? '<text x="' + (g + i * pas + pas / 2).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle"' + (y === an ? ' font-weight="700"' : "") + ">" + y + "</text>" : "").join("");
  const totInt = ys.reduce((t, y) => t + parAn[y].int, 0), resteInt = mens.filter(r => r[0] > isoJour(new Date())).reduce((t, r) => t + (r[2] || 0), 0);
  box.innerHTML = '<div class="legend"><span><i style="border-color:var(--accent)"></i>capital remboursé</span>' + (avecInt ? '<span><i style="border-color:#F2A33A"></i>intérêts payés</span>' : "") + '<span class="pa">pâle = à venir</span></div>' +
    '<svg class="m-mk-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Prêt année par année">' + grille + barres + lab + "</svg>" +
    '<p class="pret-an-t">' + (parAn[an] ? "<b>En " + an + "</b> : " + eur(parAn[an].cap, 0) + " de capital" + (avecInt ? " · " + eur(parAn[an].int, 0) + " d'intérêts" : "") : "") +
      (avecInt ? "<br>Intérêts sur toute la durée : <b>" + eur(totInt, 0) + "</b>, dont " + eur(resteInt, 0) + " encore à payer." : "") + "</p>";
}

/* ================= Jauge du millionnaire (privée : Moi › Missions, seulement sur ton appareil) ================= */
const CIBLE = 1e6, JALONS = [100000, 250000, 500000, 750000];
/* E (v16.93, règle de Théo) : le million se compte UNIQUEMENT sur le patrimoine financier (épargne + bourse + assurance-vie), jamais avec l'immobilier */
function valeurMillion() { return (M.synthese || {}).financier; }
/* rythme d'épargne vers le million : médiane des versements nets (versements − retraits) de TOUTES les enveloppes financières
   sur les 12 derniers mois terminés (un mois sans versement compte pour 0 ; la médiane ignore les gros transferts ponctuels).
   Profil simple : pas de « net » dans le fichier, on prend les versements. Sans parcours : repli sur les apports en bourse (relevés du Versus). */
function medianeMois(vals) { const v = vals.slice().sort((x, y) => x - y); return v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; }
function effortMensuel() { const r = rythmeMillion(); return r ? r.c : null; }
function rythmeMillion() {
  const p = ((M && M.ref) || {}).parcours || {}, liste = p.mois || [];
  if (liste.length || p.premier) {
    const par = {}, aNet = liste.some(x => ok(x.net));
    liste.forEach(x => { par[x.m] = ok(x.net) ? x.net : (x.apports || 0); });
    const auj = new Date(), debut = p.premier ? p.premier.slice(0, 7) : liste.map(x => x.m).sort()[0], vals = [];
    for (let k = 12; k >= 1; k--) { const d = new Date(auj.getFullYear(), auj.getMonth() - k, 1), m = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); if (!debut || m >= debut) vals.push(par[m] || 0); }
    if (vals.length) return { c: Math.max(0, Math.round(medianeMois(vals) / 10) * 10), n: vals.length,
      source: (aNet ? "versements nets médians, toutes enveloppes" : "versements médians, tous comptes") + ", sur " + (vals.length > 1 ? "les " + vals.length + " derniers mois terminés" : "le dernier mois terminé") };
  }
  const h = M.historique; if (!h || !h.rows || h.rows.length < 2) return null;
  const ka = h.cols.indexOf("a"); if (ka < 0) return null;
  const fins = {}; h.rows.forEach(r => { fins[Math.floor(r[0] / 100)] = r[ka]; });
  const ks = Object.keys(fins).map(Number).sort((x, y) => x - y), d = [];
  for (let i = 1; i < ks.length; i++) d.push(fins[ks[i]] - fins[ks[i - 1]]);
  const der = d.slice(-12); if (!der.length) return null;
  return { c: Math.max(0, Math.round(medianeMois(der) / 10) * 10), n: der.length, source: "apports médians en bourse sur 12 mois (pas encore de parcours dans ton fichier)" };
}
function moisPourMillion(v0, c, rAn) {
  if (v0 >= CIBLE) return 0;
  const i = Math.pow(1 + rAn, 1 / 12) - 1;
  let v = v0;
  for (let n = 1; n <= 12 * 80; n++) { v = v * (1 + i) + c; if (v >= CIBLE) return n; }
  return null;
}
/* lot 27 (Conseil) : UNE seule date du million dans toute l'appli (Missions, titre et curseurs de la Projection) :
   patrimoine financier d'aujourd'hui, ton rythme d'épargne réel, rendement central de la projection. Plus de 2e simulateur.
   lot 41 (Théo) : elle SUIT les réglages de la Projection (versement en plus, rendement), mémorisés sur l'appareil ; regle = ils diffèrent du fichier. */
function millionEstime() {
  const g = M ? reglagesProj() : null, P = g ? calculProjection(g.plus, g.r, g.h) : null; if (!P) return null;
  return { v: P.v, c: P.cp, r: P.r, n: P.nMp, quand: P.nMp === null ? null : dateDansMois(P.nMp), source: P.source, regle: P.regle, cF: P.c, rF: P.rF };
}
function textesMillion(E, v) {
  const discret = ETAT.discret === "oui", n = E ? E.n : null, quand = E ? E.quand : null;
  const prochain = JALONS.concat([CIBLE]).find(j => j > v);
  const nProchain = E && prochain ? moisPourMillion(v * CIBLE / prochain, E.c * CIBLE / prochain, E.r) : null;   // même calcul, mis à l'échelle du jalon
  const eta = !E ? "Pas encore assez de chiffres pour estimer la date."
    : quand ? (E.regle ? "Selon tes réglages" : "À ton rythme") + ', <b>millionnaire en ' + MOIS_L[quand.getMonth()] + " " + quand.getFullYear() + "</b>" + (n > 0 ? " · dans " + (n >= 24 ? Math.floor(n / 12) + " ans" + (n % 12 ? " et " + (n % 12) + " mois" : "") : n + " mois") : "") + "."
    : "À ton rythme actuel, le million reste hors de portée : la projection montre l'effet d'un effort en plus.";
  const sub = prochain && prochain < CIBLE && nProchain !== null ? "Prochain jalon : <b>" + F0.format(prochain / 1000) + " 000 €</b>" + (discret ? "" : ", encore " + eur(prochain - v)) + (nProchain ? " · ≈ " + (nProchain >= 24 ? Math.round(nProchain / 12) + " ans" : nProchain + " mois") : "") : "";
  return { n, quand, eta, sub };
}
function lienProjection() { return '<button type="button" class="mm-lien" data-m-voirproj>Voir la projection ›</button>'; }
/* lot 41 : rappel discret quand la date vient des réglages de la Projection, avec le retour aux valeurs du fichier */
function mentionReglages(E) { return E && E.regle ? '<p class="mm-mini mm-regle">Selon tes réglages de la Projection (' + (E.c !== E.cF ? "+" + F0.format(E.c - E.cF) + " €/mois, " : "") + pctR(E.r) + ' par an). <button type="button" class="lien" data-m-razproj>↺ valeurs du fichier</button></p>' : ""; }
function htmlMillion() {
  if (!M) return "";
  const E = millionEstime(), v = E ? E.v : (valeurMillion() || 0), part = Math.max(0, Math.min(1, v / CIBLE)), T = textesMillion(E, v);
  const discret = ETAT.discret === "oui", reduitM = PREF.millionReduit !== false;
  const texteFlap = discret ? "•••" : F0.format(Math.round(v));
  const piste = JALONS.map(j => '<span class="mj' + (v >= j ? " passe" : "") + '" style="left:' + (j / CIBLE * 100) + '%"><i></i><b>' + (j / 1000) + "k</b></span>").join("");
  const tete = '<div class="mm-h"><span class="mm-k">Cap sur le million</span><span class="mm-d"><span class="mm-prive">privé</span>' +
    '<button type="button" class="mm-plus" id="mm-reduire" aria-expanded="' + !reduitM + '">' + (reduitM ? "Voir plus ▾" : "Réduire ▴") + "</button></span></div>";
  /* D (v16.93) : en mode discret, ni %, ni jauge, ni date, ni jalon (tout cela laisse deviner le montant) */
  if (discret) return '<section class="m-million reduit discret" style="--mc:' + couleurMoi() + '"><div class="mm-h"><span class="mm-k">Cap sur le million</span><span class="mm-d"><span class="mm-prive">privé</span></span></div>' +
    '<p class="mm-mini">Masqué en mode discret. Désactive-le dans Réglages pour voir ta progression.</p></section>';
  if (reduitM) return '<section class="m-million reduit" style="--mc:' + couleurMoi() + '">' + tete +
    '<p class="mm-ligne"><b>' + F1.format(part * 100) + ' %</b><span>' + (T.quand ? "millionnaire en " + MOIS_L[T.quand.getMonth()] + " " + T.quand.getFullYear() : E ? "hors de portée à ce rythme" : "") + "</span></p>" +
    '<div class="mm-rail mini"><i style="width:' + (part * 100).toFixed(2) + '%"></i></div>' + (T.sub ? '<p class="mm-mini">' + T.sub + "</p>" : "") + mentionReglages(E) + (E ? lienProjection() : "") + "</section>";
  return '<section class="m-million" style="--mc:' + couleurMoi() + '">' + tete +
    '<div class="mm-pct"><b>' + F1.format(part * 100) + '</b><span>%</span></div>' +
    '<div class="m-flaps mm-flaps" aria-label="' + esc(texteFlap) + ' euros">' + flaps(texteFlap + NB + "€", false) + "</div>" +
    '<div class="mm-piste" role="img" aria-label="' + F1.format(part * 100) + ' % du million"><div class="mm-rail"><i style="width:' + (part * 100).toFixed(2) + '%"></i><em style="left:' + (part * 100).toFixed(2) + '%"></em></div>' + piste + '<span class="mj fin" style="left:100%"><i></i><b>1M</b></span></div>' +
    '<p class="mm-note">Patrimoine financier : épargne, bourse et assurance-vie. L\'immobilier ne compte pas.</p>' +
    '<p class="mm-eta" id="mm-eta">' + T.eta + "</p>" +
    '<p class="mm-sub" id="mm-sub">' + T.sub + "</p>" +
    (E ? (E.regle ? mentionReglages(E) + '<p class="mm-note">Même calcul que la Projection (scénario central). Ton fichier seul : ' + pctR(E.rF) + " par an, ≈ " + F0.format(E.cF) + " €/mois" + (E.source ? ", " + esc(E.source) : "") + ".</p>"
      : '<p class="mm-note">Même calcul que la Projection (scénario central, ' + pctR(E.r) + " par an ; ton rythme : ≈ " + F0.format(E.c) + " €/mois" + (E.source ? ", " + esc(E.source) : "") + ").</p>") + lienProjection() : "") +
    '<p class="mm-badge">' + badgeMillion() + "</p>" +
  "</section>";
}
function badgeMillion() {
  const pm = typeof D !== "undefined" && D && D.premierMillion;
  if (!pm) return "👑 Le badge <b>Premier millionnaire</b> est encore à prendre : unique, gardé pour toujours, et seul le fait est partagé, jamais ton montant.";
  return pm.nom === moiVrai() ? "👑 Tu es le <b>premier millionnaire</b> du groupe. Personne d'autre ne l'aura." : "👑 <b>" + esc(pm.nom) + "</b> a pris le badge Premier millionnaire. Il reste le million pour toi.";
}
/* le premier à 1 000 000 € de patrimoine financier revendique le badge (le montant ne quitte pas l'appareil) */
async function revendiquerMillion() {
  try {
    if (!M || SRC !== "api" || !((M.synthese || {}).financier >= 1e6) || typeof D === "undefined" || !D || D.premierMillion || SOURCE !== "api" || simulationM()) return;
    if (M.simple && (estAdmin() || !M.personne)) return;
    const qui = M.simple ? M.personne : moiVrai();
    if (stock.get("versus.moi.million") === qui) return;
    const rep2 = await envoyerApi(apiUrl(), { cle: stock.get(CLES.cle), action: "million", personne: qui });
    if (rep2.ok) { stock.set("versus.moi.million", qui); if (typeof window.charger === "function") window.charger(true); }   // v16.93 : plus de message, la cérémonie EST l'annonce (rechargement direct vers la scène)
  } catch (e) { /* réessai à la prochaine ouverture */ }
}
function brancherMillion(el) {
  const r = el.querySelector("#mm-reduire"); if (r) r.addEventListener("click", () => { PREF.millionReduit = PREF.millionReduit === false; garderPref(); afficherMillion(el); });
  el.querySelectorAll("[data-m-razproj]").forEach(b => b.addEventListener("click", () => { razReglagesProj(); afficherMillion(el); }));
  el.querySelectorAll("[data-m-voirproj]").forEach(b => b.addEventListener("click", () => {   // lot 27 : la projection unique est dans Patrimoine
    PREF.onglet = "patrimoine"; PREF.acc["m-proj"] = true; garderPref(); rendre();
    const d = document.querySelector('#v-moi details[data-acc="m-proj"]'); if (d) d.scrollIntoView({ block: "start", behavior: reduit ? "auto" : "smooth" }); else window.scrollTo(0, 0);
  }));
}
function afficherMillion(el) {
  injecterStyle(); lireCache();
  if (!M) { el.innerHTML = ""; return; }
  el.classList.add("moi");
  el.innerHTML = htmlMillion(); brancherMillion(el);
}

/* ================= v16.95 · Projection 2034, calendrier des échéances, « où mettre le prochain euro » (privé, rien n'est envoyé) =================
   Règle fixe : la projection part du patrimoine FINANCIER seulement (valeurMillion), jamais de l'immobilier.
   Taux de repli : utilisés seulement quand ton fichier ne donne pas le sien (indicatifs, à revoir de temps en temps). */
const TAUX_REPLI = { livretA: .017, ldds: .017, lep: .027, livretJeune: .02, pel: .0175, cel: .01, autreLivret: .01, fondsEuros: .025, uc: .04, bourse: .06 };
const PLAFONDS_LIVRETS = [[/livret\s*a\b/i, 22950, "livretA", "Livret A"], [/ldds|d[ée]veloppement durable/i, 12000, "ldds", "LDDS"], [/\blep\b|populaire/i, 10000, "lep", "LEP"],
  [/livret\s*jeune/i, 1600, "livretJeune", "Livret jeune"], [/\bpel\b|plan d'[ée]pargne logement/i, 61200, "pel", "PEL"], [/\bcel\b|compte d'[ée]pargne logement/i, 15300, "cel", "CEL"]];
const PLAFOND_PEA = 150000, ECART_SCENARIO = .02, FIN_PROJ = "2034-12-31";
const PLUS_MAX = 500, PLUS_PAS = 50, PLUS_PROPOSE = 100;
/* lot 41 (Théo) : réglages de la Projection mémorisés sur l'appareil (PREF.proj) : versement en plus, rendement central choisi
   (null = celui du fichier), horizon. Ils pilotent aussi la date du million de Missions (millionEstime). */
const HORIZONS_PROJ = [2034, 2040, 2050], HORIZON_DEF = 2034, REND_MAX = .10, REND_PAS = .005;
function reglagesProj() {
  const g = PREF.proj || {}, plus = Math.max(0, Math.min(PLUS_MAX, Math.round((+g.plus || 0) / PLUS_PAS) * PLUS_PAS));
  const r = typeof g.r === "number" && isFinite(g.r) ? Math.max(0, Math.min(REND_MAX, g.r)) : null;
  return { plus, r, h: HORIZONS_PROJ.includes(g.h) ? g.h : HORIZON_DEF };
}
function garderReglagesProj(o) { PREF.proj = Object.assign(reglagesProj(), o); garderPref(); }
function razReglagesProj() { const h = reglagesProj().h; PREF.proj = h === HORIZON_DEF ? undefined : { h }; if (!PREF.proj) delete PREF.proj; garderPref(); }
function genreLivret(r) { const t = (r.nom || "") + " " + (r.type || ""); return PLAFONDS_LIVRETS.find(p => p[0].test(t)) || null; }
function tauxLivret(r) { if (ok(r.taux) && r.taux > 0) return { r: r.taux, repli: false }; const g = genreLivret(r); return { r: TAUX_REPLI[g ? g[2] : "autreLivret"], repli: true }; }
function tauxFondsEuros() { const fe = (M.parametres || {}).fondsEuros || {}; return ok(fe.taux) && fe.taux > 0 ? { r: fe.taux, repli: false, fe } : { r: TAUX_REPLI.fondsEuros, repli: true, fe }; }
/** le patrimoine financier découpé par famille, chacune avec son rendement habituel → rendement moyen « central » */
function mixFinancier() {
  const s = M.synthese || {}, total = valeurMillion();
  if (!ok(total) || total <= 0) return null;
  const parts = [];
  (M.epargne || []).filter(r => !/^Total/.test(r.nom || "") && r.solde > 0).forEach(r => parts.push({ fam: "livrets", v: r.solde, r: tauxLivret(r).r }));
  (M.supports || []).filter(r => !/^Total/.test(r.nom || "") && r.valeur > 0).forEach(r => parts.push({ fam: cleSupport(r.nom) === "fe" ? "fe" : "uc", v: r.valeur, r: cleSupport(r.nom) === "fe" ? tauxFondsEuros().r : TAUX_REPLI.uc }));
  if (s.valeur > 0) parts.push({ fam: "bourse", v: s.valeur, r: TAUX_REPLI.bourse });
  let somme = parts.reduce((a, p) => a + p.v, 0);
  if (total > somme + 1) { parts.push({ fam: "autres", v: total - somme, r: TAUX_REPLI.autreLivret }); somme = total; }
  const r = somme > 0 ? parts.reduce((a, p) => a + p.v * p.r, 0) / somme : TAUX_REPLI.autreLivret;
  const fam = {}; parts.forEach(p => { const f = fam[p.fam] = fam[p.fam] || { v: 0, rv: 0 }; f.v += p.v; f.rv += p.v * p.r; });
  return { total, r, fam: Object.keys(fam).map(k => ({ k, part: fam[k].v / somme, r: fam[k].rv / fam[k].v })).sort((a, b) => b.part - a.part) };
}
function moisJusquA(iso) { const a = new Date(), f = new Date(iso + "T12:00:00"); return Math.max(1, (f.getFullYear() - a.getFullYear()) * 12 + f.getMonth() - a.getMonth()); }
function serieProj(v, c, rAn, n) { const i = Math.pow(1 + Math.max(-.5, rAn), 1 / 12) - 1, out = [v]; let x = v; for (let k = 1; k <= n; k++) { x = x * (1 + i) + c; out.push(x); } return out; }
/** tout le calcul de la projection (sans effet de bord) ; plus = euros ajoutés chaque mois par le curseur ;
    rCentral = rendement central choisi (absent/null = moyenne pondérée du fichier) ; h = année de fin (absente = 2034).
    nM = mois jusqu'au million selon le fichier seul ; nMp = selon les réglages (versement + rendement choisis). */
function calculProjection(plus, rCentral, h) {
  if (!M) return null;
  const mix = mixFinancier(); if (!mix) return null;
  h = HORIZONS_PROJ.includes(h) ? h : HORIZON_DEF; plus = plus || 0;
  const fin = h + "-12-31", choisi = typeof rCentral === "number" && isFinite(rCentral), r = choisi ? rCentral : mix.r;
  const ry = rythmeMillion(), c = ry ? ry.c : 0, n = moisJusquA(fin), cp = c + plus;
  const sc = [["prudent", Math.max(0, r - ECART_SCENARIO)], ["central", r], ["optimiste", r + ECART_SCENARIO]].map(([k, rr]) => ({ k, r: rr, s: serieProj(mix.total, cp, rr, n) }));
  sc.forEach(x => { x.fin = x.s[n]; });
  const nM = moisPourMillion(mix.total, c, mix.r), nMp = moisPourMillion(mix.total, cp, r);
  return { v: mix.total, mix, c, plus, cp, n, h, fin, r, rF: mix.r, choisi, regle: plus > 0 || choisi, sc, verse: mix.total + cp * n, source: ry ? ry.source : "", nM, nMp };
}
function dateDansMois(n) { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function jalonsProjection(fin) {
  fin = fin || FIN_PROJ; const l = [], auj = isoJour(new Date());
  if (aArtema()) ARTEMA.rdv.forEach((x, i) => { if (x[0] >= auj && x[0] <= fin) l.push({ d: x[0], k: "artema", t: x[3] ? "Artema : fin" : "Artema : rendez-vous " + (i + 1) }); });
  const p = M.prets; if (p && p.fin && p.fin >= auj && p.fin <= fin) l.push({ d: p.fin, k: "pret", t: "Fin du prêt" });
  return l;
}
function svgProjection(P) {
  const W = 320, H = 176, m = { l: 38, r: 8, t: 10, b: 30 }, iw = W - m.l - m.r, ih = H - m.t - m.b, n = P.n;
  const mx = Math.max(...P.sc[2].s) * 1.06 || 1, X = k => m.l + k / n * iw, Y = v => m.t + ih - Math.max(0, Math.min(v, mx)) / mx * ih;
  const d = arr => arr.map((v, k) => (k ? "L" : "M") + X(k).toFixed(1) + " " + Y(v).toFixed(1)).join("");
  const pas = mx > 1.2e7 ? 2.5e6 : mx > 5e6 ? 1e6 : mx > 2e6 ? 5e5 : mx > 8e5 ? 2.5e5 : mx > 3e5 ? 1e5 : mx > 1.2e5 ? 5e4 : mx > 4e4 ? 1e4 : 5e3;
  let o = "";
  for (let t = 0; t <= mx; t += pas) o += '<line class="gr" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '"/><text x="' + (m.l - 4) + '" y="' + (Y(t) + 3.5).toFixed(1) + '" text-anchor="end">' + (t ? kEurProj(t).replace(" ", "") : "0") + "</text>";
  if (mx > CIBLE * .7) o += '<line class="mil" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(CIBLE).toFixed(1) + '" y2="' + Y(CIBLE).toFixed(1) + '"/><text class="mil-t" x="' + (W - m.r) + '" y="' + (Y(CIBLE) - 3).toFixed(1) + '" text-anchor="end">1 million</text>';
  const a0 = new Date(), kDe = iso => Math.max(0, Math.min(n, (+iso.slice(0, 4) - a0.getFullYear()) * 12 + (+iso.slice(5, 7) - 1 - a0.getMonth()) + (+iso.slice(8, 10) - 1) / 30));
  const court = P.h - a0.getFullYear() <= 9;   // 2034 : une année sur deux ; 2040/2050 : tous les 5 ans
  for (let y = a0.getFullYear() + 1; y <= P.h; y++) { if (court ? (y - a0.getFullYear()) % 2 : y % 5) continue; const x = X(kDe(y + "-01-01")); o += '<text x="' + x.toFixed(1) + '" y="' + (H - m.b + 13) + '" text-anchor="middle">' + y + "</text>"; }
  const [pr, ce, op] = P.sc;
  o += '<path class="bande" d="' + d(op.s) + pr.s.map((v, k) => "L" + X(n - k).toFixed(1) + " " + Y(pr.s[n - k]).toFixed(1)).join("") + 'Z"/>';
  o += '<path class="l-pr" d="' + d(pr.s) + '"/><path class="l-op" d="' + d(op.s) + '"/><path class="l-ce" d="' + d(ce.s) + '"/>';
  if (P.regle) { const base = serieProj(P.v, P.c, P.rF, n); o += '<path class="l-base" d="' + d(base) + '"/>'; }   // la courbe du fichier seul, pour comparer
  o += '<circle class="pt" cx="' + X(0).toFixed(1) + '" cy="' + Y(P.v).toFixed(1) + '" r="3"/><circle class="pt" cx="' + X(n).toFixed(1) + '" cy="' + Y(ce.fin).toFixed(1) + '" r="3.5"/>';
  jalonsProjection(P.fin).forEach(j => { const x = X(kDe(j.d)), yb = H - m.b; o += '<g class="j-' + j.k + '"><title>' + esc(j.t) + " · " + frDate(j.d) + '</title><line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + m.t + '" y2="' + yb + '"/>' +
    (j.k === "artema" ? '<path d="M' + x.toFixed(1) + " " + (yb - 5) + "l4 4l-4 4l-4 -4z" + '"/>' : '<circle cx="' + x.toFixed(1) + '" cy="' + (yb - 1) + '" r="4"/>') + "</g>"; });
  return '<svg class="pj-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Projection du patrimoine financier jusqu\'en ' + P.h + '">' + o + "</svg>";
}
const pctR = r => String(Math.round(r * 1000) / 10).replace(".", ",") + NB + "%";
/* au-delà du million, une décimale (2,4 M€) : à l'horizon 2050 « 2 M€ » serait trop grossier */
const kEurProj = v => v >= 1e6 ? (v % 1e6 ? F1 : F0).format(v / 1e6) + NB + "M€" : kEurP(v);
const arrK = v => kEurProj(Math.round(v / 1000) * 1000);
const NOMS_FAM = { livrets: "livrets", fe: "fonds euros", uc: "Artema et autres supports", bourse: "bourse", autres: "le reste" };
const moisProj = n => { const q = dateDansMois(n); return MOIS_L[q.getMonth()] + " " + q.getFullYear(); };
const dureeM = g => g >= 24 ? Math.floor(g / 12) + " ans" + (g % 12 ? " et " + (g % 12) + " mois" : "") : g + " mois";
function phrasePlus(P) {
  if (!P.regle) return 'Fais glisser pour voir l\'effet d\'un petit effort en plus (essaie +' + PLUS_PROPOSE + " €).";
  const ecart = P.nM !== null && P.nMp !== null ? P.nM - P.nMp : null;
  const quoi = [P.plus ? "+" + F0.format(P.plus) + " €/mois" : "", P.choisi ? pctR(P.r) + " par an" : ""].filter(Boolean).join(" · ");
  const mil = P.nMp === 0 ? "million déjà atteint" : P.nMp === null ? "million encore hors de portée en 80 ans"
    : ecart > 0 ? "million <b>" + dureeM(ecart) + " plus tôt</b>, en " + moisProj(P.nMp) : ecart < 0 ? "million <b>" + dureeM(-ecart) + " plus tard</b>, en " + moisProj(P.nMp) : "million en " + moisProj(P.nMp);
  const d = P.sc[1].fin - serieProj(P.v, P.c, P.rF, P.n)[P.n];
  return "<b>" + quoi + "</b> → " + mil + " · fin " + P.h + " : <b>" + (d < 0 ? MOINS : "+") + kEurProj(Math.abs(d)) + "</b> par rapport à ton fichier (central).";
}
function phraseMil(P) {
  return P.nMp === 0 ? "Million atteint : bravo."
    : P.nMp !== null ? (P.regle ? "Selon tes réglages (central)" : "À ton rythme (central)") + " : <b>millionnaire en " + moisProj(P.nMp) + "</b>."
    : "À ce rythme, le million reste hors de portée : essaie les curseurs.";
}
function resumeProj(P) { return "fin " + P.h + " ≈ " + arrK(P.sc[1].fin) + (P.nMp === 0 ? " · million atteint" : P.nMp !== null ? " · million en " + MOIS_C[dateDansMois(P.nMp).getMonth()] + " " + dateDansMois(P.nMp).getFullYear() : "") + (P.regle ? " · selon tes réglages" : ""); }
function legProj(P) {
  const jal = jalonsProjection(P.fin);
  return '<div class="pj-leg"><span><i class="ce"></i>central</span><span><i class="bd"></i>de prudent à optimiste</span>' + (P.regle ? '<span class="pj-bs"><i class="bs"></i>selon ton fichier</span>' : "") +
    (jal.some(j => j.k === "artema") ? '<span><i class="ar"></i>Artema</span>' : "") + (jal.some(j => j.k === "pret") ? '<span><i class="pt"></i>fin du prêt</span>' : "") + "</div>";
}
function hypProj(P) {
  const ce = P.sc[1], pret = M.prets && M.prets.fin;
  const familles = P.mix.fam.filter(f => f.part >= .02).map(f => NOMS_FAM[f.k] + " " + pctR(f.r)).join(", ");
  const apresPret = pret && pret > isoJour(new Date()) && pret <= P.fin && M.prets.mensualite > 0
    ? (() => { const k = moisJusquA(pret), i = Math.pow(1 + ce.r, 1 / 12) - 1, mens = M.prets.mensualite; let x = 0; for (let j = k; j < P.n; j++) x = x * (1 + i) + mens; return "<li>Ton prêt se termine le " + frDate(pret) + " : si tu épargnes ensuite ta mensualité (" + eur(mens) + "), cela ferait ≈ +" + arrK(x) + " de plus fin " + P.h + " (pas compté dans la courbe).</li>"; })()
    : pret && pret > P.fin ? "<li>Ton prêt se termine le " + frDate(pret) + ", après la frise.</li>" : "";
  return "<li>Départ : ton patrimoine financier d'aujourd'hui, " + arrK(P.v) + " (épargne, bourse, assurance-vie). L'immobilier ne compte pas.</li>" +
    "<li>Chaque mois : " + eur(P.c) + (P.plus ? " + " + eur(P.plus) + " (curseur)" : "") + " versés" + (P.source ? " (ton rythme : " + esc(P.source) + ")" : "") + ". Fin " + P.h + ", tu auras versé en tout ≈ " + arrK(P.verse) + ", le reste vient des intérêts.</li>" +
    "<li>Rendement central : " + pctR(ce.r) + " par an" + (P.choisi ? ", choisi avec le curseur (ton fichier : " + pctR(P.rF) + " : " + esc(familles) + ")." : " (" + esc(familles) + ").") + "</li>" +
    (aArtema() ? "<li>Artema : rendez-vous chaque début décembre de 2029 à 2033, fin le 1er décembre 2034 (◆ sur la frise). La courbe ne suppose aucun remboursement anticipé.</li>" : "") + apresPret +
    "<li>Ni impôts, ni inflation, ni retraits. Un repère pour se projeter, pas une prévision.</li>";
}
function htmlProjection() {
  if (!M) return "";
  const g = reglagesProj(), P = calculProjection(g.plus, g.r, g.h); if (!P) return "";
  if (ETAT.discret === "oui") return acc("m-proj", "Projection", "patrimoine financier", '<p class="info">Masquée en mode discret (la courbe laisse deviner le montant). Désactive-le dans Réglages pour la voir.</p>', false);
  const [pr, ce, op] = P.sc;
  const tuile = (x, lab) => '<div class="pj-t pj-' + x.k + '"><span>' + lab + '</span><b>' + arrK(x.fin) + "</b><small>" + pctR(x.r) + " par an</small></div>";
  const rVal = Math.round(P.r / REND_PAS) * REND_PAS * 100;
  const corps = '<div class="m-proj">' +
    '<p class="pj-mil" id="pj-mil">' + phraseMil(P) + "</p>" +
    '<div class="chips m-filtre" role="group" aria-label="Horizon de la projection">' + HORIZONS_PROJ.map(h => '<button class="chip" type="button" data-pj-h="' + h + '" aria-pressed="' + (h === P.h) + '">' + h + "</button>").join("") + "</div>" +
    '<div class="pj-tuiles">' + tuile(pr, "Prudent") + tuile(ce, "Central") + tuile(op, "Optimiste") + "</div>" +
    '<div class="pj-graph" id="pj-graph">' + svgProjection(P) + "</div>" + legProj(P) +
    '<div class="pj-plus">' +
      '<div class="pj-reg-h"><span>Tes réglages <small>gardés sur cet appareil</small></span><button type="button" class="pj-raz" id="pj-raz" aria-label="Revenir aux valeurs du fichier"' + (P.regle ? "" : " hidden") + ">↺ fichier</button></div>" +
      '<label for="pj-plus"><span>Et si je versais plus chaque mois ?</span><b id="pj-plus-v">+' + F0.format(P.plus) + " €</b></label>" +
      '<input type="range" id="pj-plus" min="0" max="' + PLUS_MAX + '" step="' + PLUS_PAS + '" value="' + P.plus + '" aria-describedby="pj-plus-t">' +
      '<label for="pj-rend"><span>Rendement par an</span><b id="pj-rend-v">' + pctR(P.r) + "</b></label>" +
      '<input type="range" id="pj-rend" min="0" max="' + REND_MAX * 100 + '" step="' + REND_PAS * 100 + '" value="' + rVal + '" aria-describedby="pj-rend-t">' +
      '<p class="pj-repere" id="pj-rend-t">Ton fichier : ' + pctR(P.rF) + ". Repère : sur longue période, un ETF Monde a fait ≈ 6 à 8 % par an avant inflation, sans garantie.</p>" +
      '<p class="pj-plus-t" id="pj-plus-t">' + phrasePlus(P) + "</p></div>" +
    /* lot 41 (Théo) : les hypothèses prennent trop de place, repliées par défaut */
    '<details class="pj-hyp-d"><summary>Hypothèses <i aria-hidden="true">›</i></summary><div data-aide><p class="pj-h">Pourquoi ces chiffres ? <button type="button" class="qm-b" aria-label="Pourquoi ces chiffres ?">?</button></p>' +
    '<span class="aide">Chaque famille garde son rendement habituel : les livrets et le fonds euros à leur taux (celui de ton fichier quand il est saisi), la bourse à ' + pctR(TAUX_REPLI.bourse) + ' par an en moyenne sur longue période ; le curseur « Rendement par an » remplace cette moyenne par la tienne. Le scénario prudent retire ' + F0.format(ECART_SCENARIO * 100) + ' points par an, l\'optimiste en ajoute ' + F0.format(ECART_SCENARIO * 100) + '. La bourse peut perdre 20 % ou plus certaines années : la vraie courbe ne sera jamais aussi lisse.</span>' +
    '<ul class="pj-hyp" id="pj-hyp">' + hypProj(P) + "</ul></div></details></div>";
  /* lot 27 : la seule projection de l'appli, repliée, avec son résumé dans le titre (même date du million que Missions) */
  return acc("m-proj", "Projection", '<span id="pj-resume">' + resumeProj(P) + "</span>", corps, false);
}
function brancherProjection(v) {
  const z = v.querySelector(".m-proj"); if (!z) return;
  z.querySelectorAll(".qm-b").forEach(q => q.addEventListener("click", e => { e.preventDefault(); const a = q.closest("[data-aide]"); if (a) a.classList.toggle("aide-on"); }));
  const r = z.querySelector("#pj-plus"), rr = z.querySelector("#pj-rend"); if (!r || !rr) return;
  let tache = 0;
  /* un seul recalcul par image (requestAnimationFrame) : le curseur reste fluide même à l'horizon 2050 */
  const maj = () => { if (tache) return; tache = requestAnimationFrame(() => { tache = 0;
    const g = reglagesProj(), P = calculProjection(g.plus, g.r, g.h); if (!P) return;
    z.querySelector("#pj-graph").innerHTML = svgProjection(P);
    z.querySelector("#pj-plus-v").textContent = "+" + F0.format(P.plus) + " €";
    z.querySelector("#pj-rend-v").textContent = pctR(P.r);
    z.querySelector("#pj-plus-t").innerHTML = phrasePlus(P);
    z.querySelector("#pj-mil").innerHTML = phraseMil(P);
    z.querySelector("#pj-hyp").innerHTML = hypProj(P);
    const tu = z.querySelectorAll(".pj-t b"); P.sc.forEach((x, i) => { if (tu[i]) tu[i].textContent = arrK(x.fin); });
    const ts = z.querySelectorAll(".pj-t small"); P.sc.forEach((x, i) => { if (ts[i]) ts[i].textContent = pctR(x.r) + " par an"; });
    const leg = z.querySelector(".pj-leg"); if (leg) leg.outerHTML = legProj(P);
    const rs = document.getElementById("pj-resume"); if (rs) rs.textContent = resumeProj(P);
    z.querySelector("#pj-raz").hidden = !P.regle;
    z.querySelectorAll("[data-pj-h]").forEach(b => b.setAttribute("aria-pressed", String(+b.dataset.pjH === P.h)));
  }); };
  r.addEventListener("input", () => { PREF.proj = Object.assign(reglagesProj(), { plus: Math.max(0, Math.min(PLUS_MAX, Math.round(+r.value / PLUS_PAS) * PLUS_PAS)) }); maj(); });
  rr.addEventListener("input", () => {
    const x = Math.max(0, Math.min(REND_MAX, Math.round(+rr.value / (REND_PAS * 100)) * REND_PAS)), mix = mixFinancier();
    /* le cran le plus proche du rendement du fichier = le fichier lui-même (pas de « réglage » fantôme à 0,1 point près) */
    const surFichier = mix && Math.abs(x - Math.round(mix.r / REND_PAS) * REND_PAS) < 1e-9;
    PREF.proj = Object.assign(reglagesProj(), { r: surFichier ? null : x }); maj(); });
  [r, rr].forEach(e => e.addEventListener("change", garderPref));   // écrit sur l'appareil au lâcher, pas à chaque pixel
  z.querySelectorAll("[data-pj-h]").forEach(b => b.addEventListener("click", () => { garderReglagesProj({ h: +b.dataset.pjH }); maj(); }));
  z.querySelector("#pj-raz").addEventListener("click", () => {
    razReglagesProj(); const P = calculProjection(0, null, reglagesProj().h);
    r.value = "0"; if (P) rr.value = String(Math.round(P.rF / REND_PAS) * REND_PAS * 100); maj(); });
}

/* ---- Calendrier unique des échéances (+ fichier .ics pour l'agenda, fabriqué dans le téléphone) ---- */
function finDuMois(d) { return isoJour(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
function echeancesMoi() {
  if (!M) return [];
  const l = [], auj = isoJour(new Date()), dans = isoJour(new Date(Date.now() + 2 * 365.25 * 864e5));
  const add = (o) => { if (o.d && (o.du || (o.d >= auj && (o.d <= dans || o.loin)))) l.push(o); };
  // rappels du fichier (le Point Artema compris)
  if (M.simple) {
    if (/À mettre à jour/.test(M.rappel || "")) add({ d: auj, ico: ICO_RAPPEL.soldes, t: "Mettre à jour tes soldes", s: "tes soldes d'épargne ont plus d'un mois", du: true, k: "soldes" });
  } else rappelsFichier().forEach(x => {
    const k = cleRappel(x.nom) || x.nom, d = x.prochaine && /^\d{4}-\d\d-\d\d/.test(x.prochaine) ? String(x.prochaine).slice(0, 10) : null, du = rappelDu(x);
    const point = aArtema() && POINT_ART.includes(k);
    if (!d && !du) return;
    add({ d: d || auj, ico: point ? "🎯" : ICO_RAPPEL[k] || "◷", t: point ? "Point Artema" : nomCourtRappel(x), s: du ? (d && d < auj ? "en retard, prévu le " + frDate(d) : "à faire maintenant") : point ? nomCourtRappel(x) + " et niveau de l'indice" : "rappel de ton fichier", du, k: "r-" + k });
  });
  // relevé du Versus : chaque fin de mois
  { const auto = versusRelie() || !!dernierImportAuto(), n = new Date(), jr = typeof jourReleve === "function" ? jourReleve(n.getFullYear(), n.getMonth() + 1) : null;   // v17.99 (Théo) : relevé automatique → on le dit (Kévin garde « à saisir »)
    add({ d: jr ? isoJour(jr) : finDuMois(n), ico: "🏁", t: "Relevé du mois pour le Versus", s: auto ? "automatique, vers 19 h (dernier jour ouvré) : rien à faire" : "à saisir dans le Versus en fin de mois", k: "versus", rrule: "FREQ=MONTHLY;BYMONTHDAY=-1" }); }
  // Artema : photo de départ, rendez-vous, fin
  if (aArtema()) {
    if (auj <= ARTEMA.photo[1]) add({ d: ARTEMA.photo[0], ico: "📸", t: "Artema : photo de départ", s: "moyenne des 2, 3 et 4 décembre 2026", k: "art-photo" });
    ARTEMA.rdv.forEach((x, i) => add({ d: x[0], ico: "🎯", t: x[3] ? "Artema : fin du produit" : "Artema : rendez-vous " + (i + 1) + " sur 5", s: x[3] ? "dernière constatation de l'indice" : "si l'indice est au moins à son départ : arrêt, capital + " + pc1(netArt(i)) + " % net de frais", k: "art-" + i, loin: true }));
  }
  // prêt : prochaine échéance (tous les mois) et fin
  const p = M.prets;
  if (p && p.prochaine && p.prochaine.date >= auj) add({ d: p.prochaine.date, ico: "🏠", t: "Échéance du prêt", s: eur((p.prochaine.echeance || 0) + (p.banque ? 0 : p.prochaine.assurance || 0), 2) + " · tous les mois", k: "pret-m", rrule: "FREQ=MONTHLY" + (p.fin ? ";UNTIL=" + p.fin.replace(/-/g, "") : "") });
  if (p && p.fin) add({ d: p.fin, ico: "🎉", t: "Fin du prêt immobilier", s: "dernière échéance", k: "pret-fin", loin: true });
  // échéances connues : anniversaires fiscaux, intérêts et taux des livrets, fin du bonus du fonds euros
  ((M.ref || {}).enveloppes || []).filter(e => e.ouverture && e.statut !== "Fermé" && (e.regime === "PEA" || e.regime === "AV")).forEach(e => {
    const n = e.regime === "PEA" ? 5 : 8; add({ d: isoPlus(String(e.ouverture).slice(0, 10), n, 0), ico: "🎂", t: e.nom + " a " + n + " ans", s: e.regime === "PEA" ? "gains sans impôt (prélèvements sociaux seulement)" : "abattement sur les gains retirés chaque année", k: "fisc-" + e.nom, loin: true });
  });
  const an = new Date().getFullYear();
  if ((M.epargne || []).some(r => !/^Total/.test(r.nom || "") && genreLivret(r))) {
    // v18.0 (Théo) : pas de doublon avec les rappels du fichier (« Intérêts des livrets » le 2 janv., « Taux des livrets » le 1er févr.) : on enrichit le rappel à la place
    const ksF = new Set(M.simple ? [] : rappelsFichier().map(x => cleRappel(x.nom)).filter(Boolean)), enrichir = (k, txt) => l.filter(x => x.k === "r-" + k).forEach(x => { x.s = /^rappel de ton fichier$/.test(x.s || "") ? txt : txt + " · " + x.s; });
    if (ksF.has("interets")) enrichir("interets", "versés le 31 décembre, à noter dans ton fichier");
    else add({ d: an + "-12-31", ico: "🏦", t: "Intérêts des livrets", s: "versés sur tes livrets le 31 décembre", k: "liv-int", rrule: "FREQ=YEARLY" });
    if (ksF.has("taux")) enrichir("taux", "nouveaux taux possibles du Livret A, du LDDS et du LEP (1er février et 1er août)");
    else [an + "-02-01", an + "-08-01", (an + 1) + "-02-01"].filter(d => d >= auj).slice(0, 1).forEach(d => add({ d, ico: "📣", t: "Nouveaux taux possibles des livrets", s: "Livret A, LDDS et LEP : révisés en principe le 1er février et le 1er août", k: "liv-taux" }));
  }
  const fe = ((M.parametres || {}).fondsEuros) || {};
  if (fe.bonus && fe.bonusFin) add({ d: String(fe.bonusFin).slice(0, 10), ico: "💶", t: "Fin du bonus du fonds euros", s: "bonus de " + pct(fe.bonus, 2, false), k: "fe-bonus" });
  const vus = new Set();
  return l.filter(x => { const c = x.k + x.d; if (vus.has(c)) return false; vus.add(c); return true; })
    .sort((a, b) => (b.du ? 1 : 0) - (a.du ? 1 : 0) || (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
}
/** v17.2 : les échéances dans le panneau de la cloche (en haut), sans bouton d'agenda */
function htmlEcheancesNotif() {
  let l = []; try { l = echeancesMoi().filter(x => !x.du); } catch (e) { l = []; } if (!l.length) return "";
  const auj = isoJour(new Date());
  const ligne = x => '<div class="ec-r"><span class="ec-d">' + jourCourt(x.d, x.d.slice(0, 4) === auj.slice(0, 4)) + '</span><span class="ec-i" aria-hidden="true">' + x.ico + '</span><span class="ec-t"><b>' + esc(x.t) + "</b><small>" + esc(x.s) + "</small></span></div>";
  const vis = l.slice(0, 4), reste = l.slice(4);
  return '<h4 class="m-h4">Mes échéances</h4><div class="m-ech">' + vis.map(ligne).join("") +
    (reste.length ? '<details class="ec-plus"><summary>Voir les ' + reste.length + " suivantes</summary>" + reste.map(ligne).join("") + "</details>" : "") + "</div>";
}
function htmlEcheances() {
  const l = echeancesMoi(); if (!l.length) return "";
  const auj = isoJour(new Date());
  const ligne = x => '<div class="ec-r' + (x.du ? " du" : "") + '"><span class="ec-d">' + (x.du && x.d <= auj ? "à faire" : jourCourt(x.d, x.d.slice(0, 4) === auj.slice(0, 4))) + '</span><span class="ec-i" aria-hidden="true">' + x.ico + '</span><span class="ec-t"><b>' + esc(x.t) + "</b><small>" + esc(x.s) + "</small></span></div>";
  const vis = l.slice(0, 5), reste = l.slice(5), pro = l.find(x => !x.du) || l[0];
  return acc("m-echeances", "Mes échéances", (l.some(x => x.du) ? l.filter(x => x.du).length + " à faire · " : "") + "prochaine : " + esc(pro.t) + (pro.du ? "" : " · " + jourCourt(pro.d, pro.d.slice(0, 4) === auj.slice(0, 4))),
    '<div class="m-ech">' + vis.map(ligne).join("") +
    (reste.length ? '<details class="ec-plus"><summary>Voir les ' + reste.length + " suivantes</summary>" + reste.map(ligne).join("") + "</details>" : "") +
    "</div>", false);
}
/** le texte du fichier .ics (iCalendar) : journées entières, sans montant, identifiants stables pour ne pas créer de doublons */
function icsEcheances(l) {
  const esc2 = t => String(t).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  const plie = s => { const out = []; let cur = "", n = 0; for (const ch of s) { const b = new TextEncoder().encode(ch).length; if (n + b > 74) { out.push(cur); cur = " "; n = 1; } cur += ch; n += b; } out.push(cur); return out.join("\r\n"); };
  const jd = iso => iso.replace(/-/g, ""), lend = iso => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + 1); return jd(isoJour(d)); };
  const st = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z"), qui = String((M && M.personne) || ETAT.moi || "moi").normalize("NFD").replace(/[^\w]/g, "").toLowerCase() || "moi";
  const sansMontant = t => String(t).replace(/(?:[−-]?[\d\s\u202F\u00A0.,]+|•••)\s?€[^·]*·?\s*/g, "").trim();
  const ev = l.map(x => {
    const lignes = ["BEGIN:VEVENT", "UID:versus-" + qui + "-" + String(x.k).normalize("NFD").replace(/[^\w-]/g, "").toLowerCase() + (x.rrule ? "" : "-" + jd(x.d)) + "@versus-moi", "DTSTAMP:" + st,
      "DTSTART;VALUE=DATE:" + jd(x.d), "DTEND;VALUE=DATE:" + lend(x.d), "SUMMARY:" + esc2(x.t), "DESCRIPTION:" + esc2((sansMontant(x.s) || x.s.replace(/€/g, "")) + " · Versus › Moi"), "TRANSP:TRANSPARENT"];
    if (x.rrule) lignes.push("RRULE:" + x.rrule);
    lignes.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + esc2(x.t), "TRIGGER:PT9H", "END:VALARM", "END:VEVENT");
    return lignes.map(plie).join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Versus//Moi echeances//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Mes échéances (Versus)"].map(plie).join("\r\n") + "\r\n" + ev.join("\r\n") + "\r\nEND:VCALENDAR\r\n";
}
function telechargerIcs() {
  const l = echeancesMoi().map(x => x.du && x.d < isoJour(new Date()) ? Object.assign({}, x, { d: isoJour(new Date()) }) : x);
  if (!l.length) return;
  const blob = new Blob([icsEcheances(l)], { type: "text/calendar;charset=utf-8" }), url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = "mes-echeances-versus.ics"; a.rel = "noopener"; a.style.display = "none";
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);   // pas trop tôt : Firefox Android et iPhone lisent le fichier après le clic
  if (typeof toast === "function") toast("📅 " + l.length + " échéances prêtes : ouvre le fichier téléchargé pour les ajouter à ton agenda.");
}
function brancherEcheances(v) { const b = v.querySelector("#ec-ics"); if (b) b.addEventListener("click", telechargerIcs); }

/* ---- « Où mettre le prochain euro ? » : comparateur indicatif de TES enveloppes ---- */
const HORIZONS = [["court", "moins de 2 ans", 1], ["moyen", "2 à 5 ans", 3], ["long", "5 ans et plus", 8]];
function optionsEuro() {
  const o = [], r = (M.ref || {}), envs = (r.enveloppes || []).filter(e => e.statut !== "Fermé"), ficPEA = (M.fiscalite || []).find(x => /PEA/i.test(x.nom || ""));
  (M.epargne || []).filter(x => !/^Total/.test(x.nom || "")).forEach(x => {
    const g = genreLivret(x), t = tauxLivret(x); if (!g && !(ok(x.taux) && x.taux > 0)) return;
    const reste = g ? Math.max(0, g[1] - (x.solde || 0)) : null, regle = g && /pel|cel/.test(g[2]);
    o.push({ nom: x.nom, fam: "livret", r: t.r, repli: t.repli, reste, plafond: g ? g[1] : null, risque: 0,
      dispo: g && g[2] === "pel" ? "bloqué jusqu'à la fin du plan (le retrait le ferme)" : "à tout moment, en un jour", fisc: regle ? "Intérêts imposés (environ 30 %)." : g ? "Intérêts sans impôt ni prélèvements sociaux." : "Fiscalité selon le compte." });
  });
  const tFE = tauxFondsEuros(), aFE = (M.supports || []).some(x => cleSupport(x.nom || "") === "fe") || envs.some(e => e.regime === "AV" && /épargne/i.test(e.perimetre || ""));
  const av = envs.find(e => e.regime === "AV" && /Quintessa/i.test(e.nom)) || envs.find(e => e.regime === "AV");
  if (aFE) { const bon = tFE.fe && tFE.fe.bonus && (!tFE.fe.bonusFin || tFE.fe.bonusFin >= isoJour(new Date())) ? tFE.fe.bonus : 0;
    const age = av && av.ouverture ? (Date.now() - new Date(String(av.ouverture).slice(0, 10) + "T12:00:00")) / (365.25 * 864e5) : null;
    o.push({ nom: (av ? av.nom + " · " : "Assurance-vie · ") + "fonds euros", fam: "fe", r: tFE.r + bon, repli: tFE.repli, bonus: bon, reste: null, risque: 0,
      dispo: "en quelques jours (rachat), capital garanti", fisc: "Gains taxés seulement quand tu retires" + (age !== null && age >= 8 ? " ; après 8 ans (c'est ton cas), une part des gains chaque année sans impôt." : " ; après 8 ans" + (age !== null ? " (dans " + Math.ceil(8 - age) + " an" + (8 - age > 1 ? "s" : "") + ")" : "") + ", une part des gains chaque année sans impôt.") }); }
  const pea = envs.find(e => e.regime === "PEA") || (M.enveloppes || []).find(e => e.type === "env" && /PEA/.test(e.nom || ""));
  if (pea) {
    const apports = ficPEA && ok(ficPEA.apports) ? ficPEA.apports : null, age = pea.ouverture ? (Date.now() - new Date(String(pea.ouverture).slice(0, 10) + "T12:00:00")) / (365.25 * 864e5) : null;
    o.push({ nom: pea.nom, fam: "bourse", r: TAUX_REPLI.bourse, repli: true, reste: apports !== null ? Math.max(0, PLAFOND_PEA - apports) : null, plafond: PLAFOND_PEA, plafondVerse: true, risque: 2,
      dispo: "à tout moment, mais un retrait avant 5 ans ferme le PEA" + (age !== null && age >= 5 ? " (le tien a plus de 5 ans : retrait possible sans le fermer)" : ""),
      fisc: "Après 5 ans, gains sans impôt (prélèvements sociaux seulement)." });
  }
  const cto = envs.find(e => e.regime === "CTO") || (M.enveloppes || []).find(e => e.type === "env" && /CTO/.test(e.nom || ""));
  if (cto) o.push({ nom: cto.nom, fam: "bourse", r: TAUX_REPLI.bourse, repli: true, reste: null, risque: 2, dispo: "à tout moment (vente en bourse)", fisc: "Gains taxés à chaque vente (environ 30 %)." });
  return o;
}
/** classement + répartition du montant (les plafonds sont respectés), sans effet de bord */
function comparerEuro(montant, h) {
  const H = HORIZONS.find(x => x[0] === h) || HORIZONS[1], ans = H[2];
  const opts = optionsEuro().map(x => {
    let note = x.r, exclu = null;
    if (x.risque && h === "court") exclu = "trop court pour la bourse : elle peut baisser de 20 % ou plus en un an";
    else if (x.risque && h === "moyen") note = x.r - .035;   // prudence : une baisse peut ne pas avoir le temps de se refaire
    if (x.reste === 0) exclu = x.plafondVerse ? "plafond des versements atteint" : "plein (plafond atteint)";
    if (x.fam === "livret" && /bloqué/.test(x.dispo) && h === "court") note -= .02;
    return Object.assign({}, x, { note, exclu, gain: montant > 0 ? montant * (Math.pow(1 + x.r, ans) - 1) : 0 });
  });
  const rang = opts.filter(x => !x.exclu).sort((a, b) => b.note - a.note || (a.risque - b.risque)).concat(opts.filter(x => x.exclu));
  const rep = []; let reste = montant > 0 ? montant : 0;
  rang.filter(x => !x.exclu).forEach(x => { if (reste <= 0) return; const m = x.reste === null ? reste : Math.min(reste, x.reste); if (m > 0) { rep.push({ nom: x.nom, m }); reste -= m; } });
  return { H, ans, rang, rep, reste };
}
function phraseEuro(C, montant) {
  const p = C.rang.find(x => !x.exclu);
  if (!p) return "Toutes tes enveloppes connues sont pleines ou trop risquées pour cette durée : un livret ou l'assurance-vie fonds euros restent les choix sûrs.";
  let t = C.H[0] === "court" ? "Pour un argent dont tu auras besoin bientôt, la sécurité passe avant le rendement : " : C.H[0] === "moyen" ? "Sur 2 à 5 ans, mieux vaut un placement qui ne baisse pas : " : "Sur 5 ans et plus, la bourse a le plus de chances de rapporter, avec des années en baisse : ";
  t += "<b>" + esc(p.nom) + "</b> arrive en tête";
  if (C.rep.length > 1 && montant > 0) t += " ; comme il ne reste que " + eur(C.rep[0].m) + " de place, la suite irait sur " + C.rep.slice(1).map(x => "<b>" + esc(x.nom) + "</b>").join(" puis ") + "";
  return t + ". Garde toujours de quoi faire face à un imprévu (environ 3 mois de dépenses) sur un livret disponible.";
}
function htmlComparateur() {
  if (!M) return "";
  const opts = optionsEuro(); if (!opts.length) return "";
  const discret = ETAT.discret === "oui", h = HORIZONS.some(x => x[0] === PREF.euroH) ? PREF.euroH : "moyen";
  const m0 = ok(PREF.euroM) ? PREF.euroM : null;
  const corps = '<div class="m-euro">' +
    '<div class="eu-saisie"><label for="eu-m"><span>Montant à placer (€)</span><input id="eu-m" type="text" inputmode="decimal" autocomplete="off" placeholder="1 000" value="' + (m0 !== null && !discret ? saisieNombre(m0, 2) : "") + '"></label></div>' +
    '<div class="chips m-filtre" role="group" aria-label="J\'en aurai besoin dans">' + HORIZONS.map(([k, l]) => '<button class="chip" type="button" data-eu-h="' + k + '" aria-pressed="' + (h === k) + '">' + l + "</button>").join("") + "</div>" +
    '<div id="eu-res">' + resComparateur(m0 !== null && !discret ? m0 : 1000, h, discret) + "</div>" +
    '<p class="info">Indicatif, pas un conseil financier. Rendements attendus : les taux de ton fichier quand ils sont saisis, sinon des repères moyens (bourse ' + pctR(TAUX_REPLI.bourse) + " par an sur longue période, jamais garanti). Les règles fiscales peuvent changer.</p></div>";
  return acc("m-euro", "Où mettre le prochain euro ?", "tes enveloppes comparées", corps, false);
}
function resComparateur(montant, h, discret) {
  const C = comparerEuro(montant, h);
  const ligne = (x, i) => '<div class="eu-r' + (x.exclu ? " exclu" : i === 0 ? " tete" : "") + '"><span class="eu-n">' + (x.exclu ? "—" : i + 1) + '</span><span class="eu-t"><b>' + esc(x.nom) + "</b>" +
    "<small>" + (x.exclu ? esc(x.exclu) : (x.risque ? "≈ " : "") + pctR(x.r) + " par an" + (x.repli ? (x.risque ? " en moyenne, sans garantie" : " (taux de repli)") : x.bonus ? " bonus compris" : "") + " · ≈ " + eur(x.gain, 0, true) + " en " + C.ans + " an" + (C.ans > 1 ? "s" : "")) + "</small>" +
    "<small>Disponible : " + esc(x.dispo) + (x.plafond ? " · place restante : " + (x.reste === null ? "plafond de " + kEurP(x.plafond) + (x.plafondVerse ? " versés" : "") : discret ? "•••" : eur(x.reste)) : "") + "</small>" +
    "<small>" + esc(x.fisc) + "</small></span></div>";
  return '<p class="eu-conseil">' + phraseEuro(C, montant) + "</p>" + '<div class="eu-liste">' + C.rang.map(ligne).join("") + "</div>";
}
function brancherComparateur(v) {
  const z = v.querySelector(".m-euro"); if (!z) return;
  const maj = () => { const m = lireNombre(z.querySelector("#eu-m").value); z.querySelector("#eu-res").innerHTML = resComparateur(m > 0 ? m : 1000, HORIZONS.some(x => x[0] === PREF.euroH) ? PREF.euroH : "moyen", ETAT.discret === "oui"); };
  z.querySelector("#eu-m").addEventListener("input", e => { const m = lireNombre(e.target.value); if (m > 0 && m < 1e8) PREF.euroM = m; else delete PREF.euroM; garderPref(); maj(); });
  z.querySelectorAll("[data-eu-h]").forEach(b => b.addEventListener("click", () => { PREF.euroH = b.dataset.euH; garderPref(); z.querySelectorAll("[data-eu-h]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); maj(); }));
}

/* ================= Saisie : ordres, journal, mises à jour du fichier (repris de Cote) ================= */
const AVEC_ACTIF = ["Achat", "Vente", "Frais en parts", "Relevé"];
const AVEC_QTE = ["Achat", "Vente", "Frais en parts"];
const AVEC_FRAIS = ["Achat", "Vente"];
const PRINCIPAUX = ["Achat", "Vente", "Apport", "Retrait"];
/* v16.97 · types rangés par fréquence : 3 boutons (Achat, Versement, Relevé si assurance-vie, sinon Vente), le reste sous « Autres ».
   Seuls les libellés changent : le nom enregistré dans le fichier reste celui du type (« Apport », « Intérêts »…) */
const LIB_TYPE = { "Apport": "Versement", "Intérêts": "Dividende / intérêts", "Relevé": "Valeur AV", "Ajustement espèces": "Correction d'espèces", "Solde initial": "Solde de départ", "Frais en parts": "Frais en parts" };
/* v17.34 · date obligatoire, sans valeur par défaut : une valeur d'assurance-vie et un solde de départ sont datés par le relevé, pas par le jour de la saisie */
const DATE_OBLIG = ["Relevé", "Solde initial"];
const ORDRE_AUTRES = ["Vente", "Retrait", "Intérêts", "Frais", "Relevé", "Frais en parts", "Ajustement espèces", "Solde initial"];
function libType(t) { return LIB_TYPE[t] || t; }
function aAV() { return (refData().enveloppes || []).some(e => e.regime === "AV" && (!e.statut || e.statut === "Ouvert")); }
function typesCourants() { return ["Achat", "Apport", aAV() ? "Relevé" : "Vente"]; }
/** « Autre type » : libellé affiché et explication en une phrase (le nom enregistré dans le fichier ne change pas) */
const AUTRES_TYPES = {
  "Intérêts": { lib: "Intérêts / dividendes", g: "Courant", d: "De l'argent versé sur l'enveloppe (dividende, coupon, intérêts du compte espèces)." },
  "Frais": { lib: "Frais", g: "Courant", d: "Des frais débités en euros (droits de garde, frais de tenue de compte…)." },
  "Relevé": { lib: "Valeur sur ton relevé d'assurance-vie", g: "Rare", d: "Recopie la valeur d'une ligne telle qu'elle figure sur ton relevé d'assurance-vie : l'appli recale son cours, sans achat ni vente." },
  "Frais en parts": { lib: "Frais en parts (assurance-vie)", g: "Rare", d: "Les frais de gestion prélevés en parts sur une ligne d'assurance-vie." },
  "Ajustement espèces": { lib: "Ajustement espèces", g: "Rare", d: "Corriger un écart entre les espèces de l'appli et celles de ta banque (négatif si sortie)." },
  "Solde initial": { lib: "Solde initial", g: "Rare", d: "L'argent déjà présent sur l'enveloppe au moment où tu commences le suivi." }
};
const LIB_MONTANT = {
  "Achat": "Montant débité, frais compris (avis d'opéré)", "Vente": "Montant crédité, net de frais (avis d'opéré)", "Apport": "Montant viré sur le compte",
  "Retrait": "Montant retiré", "Relevé": "Valeur indiquée sur le relevé", "Intérêts": "Intérêts versés",
  "Frais en parts": "Valeur des parts prélevées", "Frais": "Frais débités", "Ajustement espèces": "Écart d'espèces (négatif si sortie)",
  "Solde initial": "Solde à la date choisie"
};
let F = null, confirmeSuppr = null, tousRaccourcis = false, gererRaccourcis = false, nommerRaccourci = false;
let reglageOuvert = null, reglageMsg = {}, alertePre = null;
const $f = id => document.getElementById(id);
function aujourdhuiISO() { return isoJour(new Date()); }
function lireNombre(v) {
  if (v === null || v === undefined) return null;
  let t = String(v).replace(/[\s  €]/g, "").replace(/[\u2212\u2013]/g, "-");   // v17.34 : « −500 » copié, comme lireNb (7-bilan.js)
  if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "") : t.replace(/,/g, "");   // v20.21 : le dernier signe marque les centimes (« 1.234,56 » français, « 1,234.56 » anglais)
  t = t.replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return isFinite(n) ? n : NaN;
}
/* v16.83 · « 1.500 » : point des milliers (1 500 €) ou virgule (1,5 €) ? Pour les montants en € seulement, on demande toujours
   (jamais de conversion en silence) ; ni les quantités, ni les cours, ni le niveau d'indice ne sont concernés */
function millierDouteux(v) { return /^\d{1,3}(\.\d{3})+$/.test(String(v === null || v === undefined ? "" : v).replace(/[\s  €]/g, "")); }
function lectureMilliers(v) { const t = String(v).replace(/[\s  €]/g, ""); return { milliers: t.replace(/\./g, ""), virgule: (t.match(/\./g) || []).length === 1 ? saisieNombre(+t, 6) : null }; }
function mediane(l) { const x = l.filter(v => v > 0).sort((a, b) => a - b); return x.length ? x[Math.floor(x.length / 2)] : 0; }
function saisieNombre(n, dec) { const x = n === null || n === undefined || n === "" ? NaN : Number(n); return !isFinite(x) ? "" : String(+x.toFixed(dec)).replace(".", ","); }   // v17.97 : un nombre arrivé en texte du fichier (« 1.7 ») ne casse plus « Mon fichier »
function refData() { return (M && M.ref) || { enveloppes: [], types: [], actifs: [], cours: {}, detenu: [], journal: [], raccourcis: [] }; }
function quantiteTenue(env, code) { const x = refData().detenu.find(d => d.env === env && d.code === code); return x ? x.qte : 0; }
function typeInfo(nom) { return refData().types.find(t => t.nom === nom) || { tresorerie: 0, quantite: 0, flux: 0 }; }
function qteBrute(v) { return !ok(v) ? "—" : nf(0, 6).format(v); }   // quantités de la saisie : jamais masquées

/** Dernière enveloppe utilisée si elle existe encore dans le fichier, sinon la première */
/* v17.70 (Théo) : compte favori de la saisie, par personne (évite de le choisir à chaque fois) ; AV = l'assurance-vie des versements (pas Quintessa/Artema) si possible */
const FAVORI_ENV = { "Théo": "PEA", "Clément": "AV", "Devlin": "PEA" };
function envFavori() {
  const qui = (M && M.personne) || (typeof moiVrai === "function" ? moiVrai() : null) || ETAT.moi || "";
  const n = x => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const k = Object.keys(FAVORI_ENV).find(x => n(x) === n(qui)); if (!k) return "";
  const ouv = (refData().enveloppes || []).filter(e => typeof e !== "string" && e.regime === FAVORI_ENV[k] && (!e.statut || e.statut === "Ouvert" || e.statut === "À ouvrir"));
  const e = ouv.find(x => !/quintessa|artema/i.test(x.nom || "")) || ouv[0]; return e ? e.nom : "";
}
function envParDefaut() {
  const fav = envFavori(); if (fav) return fav;
  const l = (refData().enveloppes || []).map(e => typeof e === "string" ? e : e.nom), der = stock.get("versus.moi.derniereEnv");
  return der && (!l.length || l.includes(der)) ? der : (l[0] || der || "");
}
/* v16.97 · pré-remplissage : le dernier compte utilisé POUR CE TYPE (sinon le dernier tout court), le dernier actif acheté sur ce compte,
   le cours connu, le montant habituel d'un versement, les frais de la dernière fois. Jamais pour « Refaire » ni « Vider » (auto: false) */
function envsParType() { try { return JSON.parse(stock.get("versus.moi.envType") || "{}") || {}; } catch (e) { return {}; } }
function envPourType(type) {
  const ouv = (refData().enveloppes || []).filter(e => typeof e !== "string" && (!e.statut || e.statut === "Ouvert" || e.statut === "À ouvrir"));
  if (type === "Relevé" || type === "Frais en parts") { const m0 = envsParType()[type]; if (m0 && ouv.some(e => e.nom === m0)) return m0; const av = ouv.find(e => e.regime === "AV"); if (av) return av.nom; }
  const fav = envFavori(); if (fav) return fav;   // v17.70 : le compte favori passe avant le dernier utilisé
  const m = envsParType()[type];
  if (m && ouv.some(e => e.nom === m)) return m;
  return "";
}
/** le journal du plus récent au plus ancien, sans les ordres en cours d'envoi */
function journalRecent() { return (refData().journal || []).filter(o => !o.envoi).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))); }
function montantHabituel(env) { return mediane(journalRecent().filter(o => o.type === "Apport" && o.enveloppe === env).slice(0, 6).map(o => o.montant)); }
function preRemplir(f) {
  const r = refData(), j = journalRecent();
  if (AVEC_ACTIF.includes(f.type) && !f.actif) {
    const tenus = r.detenu.filter(d => d.env === f.env && d.qte > 1e-9).map(d => d.code);
    const der = j.find(o => o.type === f.type && o.enveloppe === f.env && o.actif && (f.type === "Achat" || tenus.includes(o.actif)) && r.actifs.some(a => a.code === o.actif));
    f.actif = der ? der.actif : tenus.length === 1 || (tenus.length && f.type !== "Achat") ? tenus[0] : "";
    f.actifAuto = !!f.actif;
  }
  if (f.type === "Apport" && !String(f.montant || "").trim() && ETAT.discret !== "oui") {   // en mode discret, rien ne s'affiche tout seul (bouton « montant habituel »)
    const hab = montantHabituel(f.env); if (hab > 0) { f.montant = saisieNombre(hab, 2); f.montantHab = true; }
  }
  if (AVEC_FRAIS.includes(f.type) && !String(f.frais || "").trim()) {
    const der = j.find(o => o.type === f.type && o.enveloppe === f.env);
    if (der && der.frais > 0) { f.frais = saisieNombre(der.frais, 2); f.fraisAuto = true; }
  }
}
function formulaire(partiel) {
  const p = partiel || {}, auto = p.auto !== false;
  const f = Object.assign({ type: "Achat", date: DATE_OBLIG.includes(p.type) ? "" : aujourdhuiISO(), env: "", actif: "", qte: "", prix: "", pilote: "", montant: "", frais: "", apport: false, montantApport: "", forcer: null, erreur: "",
    prixAuto: false, montantAuto: false, montantHab: false, fraisAuto: false, actifAuto: false, envChoisi: false, dateChoisie: false, qteTape: false, prixTape: false, prixVu: false, okCoherence: false, okDoublon: false }, p);
  delete f.auto;
  if (!f.date && !DATE_OBLIG.includes(f.type)) f.date = aujourdhuiISO();   // v17.34 : en quittant « Valeur AV » (date vide), on revient à aujourd'hui
  if (f.qte && !("qteTape" in p)) f.qteTape = true;   // Refaire / raccourci : la quantité vient d'une saisie, pas d'un calcul
  if (!f.env) f.env = (auto && envPourType(f.type)) || envParDefaut();
  if (!f.pilote) f.pilote = f.qte ? "qte" : "prix";
  if (f.type === "Achat" && !("apport" in p)) f.apport = true;   // cas le plus courant : on vire l'argent puis on achète
  if (auto) preRemplir(f);
  // v17.27 (Théo) : plus jamais de prix pré-rempli avec le cours de l'appli : tout vient de l'avis d'opéré
  return f;
}
/* v17.34 · un raccourci d'achat ou de vente ne rejoue plus la quantité, le prix ni les frais (ils viennent de l'avis du jour) ;
   les raccourcis déjà enregistrés gardent leurs champs dans le fichier, seule leur relecture change */
function depuisRaccourci(rc) {
  const ordreBourse = rc.type === "Achat" || rc.type === "Vente";
  return { type: rc.type, env: rc.env, actif: rc.actif || "", montant: rc.montant !== null && rc.montant !== undefined ? saisieNombre(rc.montant, 2) : "", frais: !ordreBourse && rc.frais ? saisieNombre(rc.frais, 2) : "", qte: !ordreBourse && rc.quantite ? saisieNombre(rc.quantite, 6) : "", apport: !!rc.apport, montantApport: rc.montantApport ? saisieNombre(rc.montantApport, 2) : "" };
}
function assurerFeuille() {
  if ($f("m-saisie")) return;
  const d = document.createElement("div");
  d.className = "voile"; d.id = "m-saisie"; d.hidden = true;
  d.classList.add("m-voile-plein");
  d.innerHTML = '<div class="feuille moi m-feuille m-plein" role="dialog" aria-modal="true" aria-labelledby="m-titre-saisie">' +
    '<h3 id="m-titre-saisie"><span><span id="m-titre-t">Saisir</span> <button class="m-qm" type="button" id="f-guide" aria-label="Comment saisir un ordre">?</button></span><span class="m-tete-a"><button class="icon-btn m-menu-b" type="button" id="f-menu" aria-label="Plus d\'options" aria-expanded="false">⋯</button><button class="icon-btn" type="button" id="m-fermer-saisie" aria-label="Fermer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></span></h3>' +
    /* v17.34 (Conseil) : 2 onglets seulement ; « Mon fichier » (ex-« Mes comptes ») est un panneau à part, ouvert par la cloche et Réglages ;
       le relevé du Versus n'est plus un onglet (il ouvrait une autre feuille) : voir la carte de Mouvement et la ligne d'état de l'Historique */
    '<div class="seg m-seg2" role="group" aria-label="Saisie" id="m-seg">' +
      '<button type="button" data-m-pane="ordre">Mouvement</button><button type="button" data-m-pane="journal">Historique</button></div>' +
    '<div id="m-pane-ordre"></div><div id="m-pane-journal" hidden></div><div id="m-pane-maj" hidden></div></div>';
  document.body.appendChild(d);
  d.addEventListener("click", e => { if (e.target === d) fermerSaisieM(true); });
  $f("m-fermer-saisie").addEventListener("click", () => fermerSaisieM(true));
  $f("f-guide").addEventListener("click", guideOrdre);
  $f("f-menu").addEventListener("click", () => { menuOuvert = !menuOuvert; rendreFormulaire(); });
  d.querySelectorAll("[data-m-pane]").forEach(b => b.addEventListener("click", () => { confirmeSuppr = null; paneSaisie(b.dataset.mPane); }));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !d.hidden) fermerSaisieM(true); });
}
/* Guide de la saisie d'un ordre de bourse : s'ouvre tout seul la première fois, puis depuis « ❓ » */
const TUTO_ORDRE = [
  { ico: "🧾", t: "Saisir un ordre, en bref", html: true, p:
    "<b>1 ordre = 1 ligne</b>, recopiée de ton courtier à la date d'exécution.<br>" +
    "• <b>Achat</b>, en 4 étapes : <b>Quoi ?</b> · <b>Les chiffres</b> de ton avis d'opéré, dans son ordre (date d'exécution, quantité, cours, courtage, montant net : <b>2 des 3</b> suffisent, le 3e se calcule ; les 3 tapés, l'appli vérifie ✓) · <b>Versement</b> : as-tu viré de l'argent pour cet achat ? · <b>Relire</b>, puis enregistrer. « Suivant » du clavier passe au champ d'après ; le bouton retour du téléphone revient à l'étape d'avant. 📄 <b>Importer un avis</b> remplit tout depuis le PDF.<br>" +
    "• <b>Versement</b> : l'argent que tu mets sur un compte (ton montant habituel est proposé).<br>" +
    "• <b>Valeur AV</b> : la valeur d'une ligne d'assurance-vie, recopiée de ton relevé, à la date du relevé.<br>" +
    "• <b>Autres</b> : vente, retrait, dividende, frais… ; chaque type s'explique quand tu le choisis.<br>" +
    "Relis la phrase 📝 avant de valider. Une erreur ? Onglet <b>Historique</b> : supprimable pendant 7 jours." }
];
function guideOrdre() { if (typeof ouvrirGuide === "function") ouvrirGuide("Saisir un ordre", TUTO_ORDRE, "C'est compris"); }
function ouvrirSaisieM(partiel, onglet) {
  injecterStyle(); assurerFeuille(); lireCache();
  if (!M) { toast("Lecture de ton fichier en cours, réessaie dans un instant."); charger(false); return; }
  F = formulaire(partiel); IMP = null;   // v17.76 : un import en cours ne survit pas à une nouvelle ouverture de « + »
  etape = partiel ? 2 : 1;   // v17.78 (lot60) : « + » s'ouvre sur « Quoi ? » ; un ordre pré-rempli (rappel, raccourci, Refaire) va droit aux chiffres
  synchroniser();
  nommerRaccourci = false; detailsOuverts = false; plusTypes = false; menuOuvert = false;
  $f("m-saisie").hidden = false;
  paneSaisie(onglet || "ordre");
  if ((onglet || "ordre") === "ordre" && identiteSure() && !stock.get(cleStock("guideOrdre")) && !simulationM()) { stock.set(cleStock("guideOrdre"), "1"); setTimeout(guideOrdre, 250); }
}
function fermerSaisieM(garder) {
  const s = $f("m-saisie");
  /* v17.78 (lot60) : ✕, Échap ou retour = ce qui est tapé reste gardé pendant la visite (jamais après un envoi : envoyerOrdre ferme sans garder) */
  if (garder === true && s && !s.hidden && F && paneCourant === "ordre" && etape > 1 && entame()) brouillons[F.type] = { F: Object.assign({}, F), IMP: IMP };
  if (s) s.hidden = true; confirmeSuppr = null; gererRaccourcis = false; cibleJournal = null;
}
function paneSaisie(o) {
  paneCourant = o;
  document.querySelectorAll("[data-m-pane]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mPane === o)));
  ["ordre", "journal", "maj"].forEach(k => { const z = $f("m-pane-" + k); z.hidden = k !== o; if (k !== o) z.innerHTML = ""; });   // jamais deux formulaires « Nouvel actif » à la fois
  /* « Mon fichier » : même feuille, sans les onglets de la saisie */
  $f("m-seg").hidden = o === "maj"; $f("m-titre-t").textContent = o === "maj" ? "Mon fichier" : "Saisir"; $f("f-guide").hidden = o !== "ordre" || PREF.aides === false; $f("f-menu").hidden = o !== "ordre";
  try { if (o === "ordre") rendreFormulaire(); else if (o === "journal") rendreJournal(); else rendreMaj(); }
  catch (e) { const z = $f("m-pane-" + o); if (z) z.innerHTML = '<p class="alerte">Cet écran n\'a pas pu s\'afficher (' + esc((e && e.message) || String(e)) + '). Envoie une capture à Théo/Claude.</p>'; console.error(e); }   // v17.93 : jamais d'écran vide
}
/* quantité <-> prix par part : celui que tu as saisi en dernier pilote l'autre */
function netOrdre() {
  const m = lireNombre(F.montant), fr = lireNombre(F.frais) || 0;
  if (!(m > 0)) return null;
  return m + (isNaN(fr) ? 0 : fr) * typeInfo(F.type).tresorerie;
}
/* v16.97 · calculs automatiques, à partir du cours connu :
   - quantité tapée, montant vide (ou déjà estimé) : montant ≈ quantité × cours (+ frais à l'achat, − frais à la vente) ;
   - montant tapé, quantité vide : quantité = montant hors frais ÷ cours, en parts entières sur un PEA (ou une ligne déjà en parts entières)
     quand le calcul tombe à moins de 2 % d'un nombre entier (3,04 → 3) : le prix par part est alors recalculé */
function coursActif() { const c = F && F.actif ? refData().cours[F.actif] : null; return c > 0 ? c : null; }
function partsEntieres() {
  const e = (refData().enveloppes || []).find(x => x.nom === F.env) || {}, tenu = quantiteTenue(F.env, F.actif);
  return e.regime !== "AV" && e.regime !== "Crypto" && (/^PEA/.test(e.regime || "") || (tenu > 0 && Math.abs(tenu - Math.round(tenu)) < 1e-9));
}
function synchroniser() {
  if (!AVEC_QTE.includes(F.type)) return;
  F.arrondi = false;
  /* v17.34 · un montant n'est estimé que d'après un prix par part TAPÉ (jamais d'après un prix lui-même calculé) */
  /* v17.73 (lot57) : quantité ET cours tapés, dans n'importe quel ordre (avant : seulement cours puis quantité) */
  if (F.qteTape && F.prixTape && (F.montantAuto || !String(F.montant || "").trim())) {
    const q = lireNombre(F.qte), p = lireNombre(F.prix), fr = lireNombre(F.frais) || 0;
    if (q > 0 && p > 0) { F.montant = saisieNombre(q * p - (isNaN(fr) ? 0 : fr) * typeInfo(F.type).tresorerie, 2); F.montantAuto = true; }
    else if (F.montantAuto) { F.montant = ""; F.montantAuto = false; }
  } else if (F.montantAuto && !(F.qteTape && F.prixTape)) { F.montant = ""; F.montantAuto = false; }
  const net = netOrdre();
  if (!(net > 0)) return;
  /* v17.34 (garde-fou G1) : un nombre ou un prix TAPÉ n'est jamais écrasé par un calcul ; si les deux sont tapés, analyser() vérifie la cohérence */
  if (F.pilote === "prix") {
    const p = lireNombre(F.prix);
    if (p > 0 && !F.qteTape) F.qte = saisieNombre(net / p, 6);   // v17.26 (Théo) : jamais d'arrondi automatique des parts
  }
  else { const q = lireNombre(F.qte); if (q > 0 && !F.prixTape) F.prix = saisieNombre(net / q, 4); }
}
function rendreRaccourcis() {
  const liste = refData().raccourcis || [];
  if (!liste.length && !gererRaccourcis) return "";   // v16.97 : rien à afficher tant qu'il n'y a aucun raccourci (« Enregistrer comme raccourci » reste en bas)
  const visibles = tousRaccourcis || gererRaccourcis ? liste : liste.slice(0, 3);
  return '<div class="raccourcis"><span>Raccourcis</span>' +
    visibles.map((r, i) => gererRaccourcis
      ? '<span class="rac-g"><button class="chip" type="button" data-rac-ren="' + i + '" aria-label="Renommer ' + esc(r.nom) + '">✎ ' + esc(r.nom) + '</button><button class="chip suppr" type="button" data-rac="' + i + '" aria-label="Supprimer ' + esc(r.nom) + '">✕</button></span>'
      : '<button class="chip" type="button" data-rac="' + i + '">' + esc(r.nom) + "</button>").join("") +
    (liste.length > 3 && !gererRaccourcis ? '<button class="lien" type="button" id="rac-plus">' + (tousRaccourcis ? "Voir moins" : "Voir + (" + (liste.length - 3) + ")") + "</button>" : "") +
    (liste.length ? '<button class="lien" type="button" id="rac-gerer">' + (gererRaccourcis ? "Terminé" : "Gérer") + "</button>" : '<span class="info">aucun pour l\'instant : « Enregistrer comme raccourci » en bas</span>') +
    "</div>";
}
/* ---- 14.5 · Nouvel actif : v17.34, UN SEUL formulaire, pendant la saisie d'un ordre comme dans « Mon fichier » (mêmes champs, même action) ---- */
const CLASSES_BASE = ["Actions", "Obligations", "Or", "Crypto", "Monétaire", "Immobilier"], ZONES_BASE = ["Monde", "États-Unis", "Europe", "France", "Émergents", "Asie"];
function nouvelNA(env) {
  const e = (refData().enveloppes || []).find(x => x.nom === env) || {};
  return { code: "", nom: "", ticker: "", classe: e.regime === "Crypto" ? "Crypto" : "Actions", zone: "Monde", levier: "1", manuel: "", msg: "", envoi: false };
}
function htmlNouvelActif(na, cadre) {
  const p = (M && M.parametres) || {};
  const classes = Array.from(new Set((p.classes || []).concat(CLASSES_BASE))), zones = Array.from(new Set((p.zones || []).concat(ZONES_BASE)));
  const opt = (l, v) => l.map(x => '<option value="' + esc(x) + '"' + (String(x) === String(v) ? " selected" : "") + ">" + esc(x) + "</option>").join("");
  return '<div class="m-na' + (cadre ? " cadre" : "") + '">' + (cadre ? '<b class="m-na-t">Nouvel actif</b>' : "") +
    '<div class="rang"><div class="champ"><label for="fn-code">Code (court)</label><input id="fn-code" type="text" autocomplete="off" autocapitalize="characters" placeholder="ex. CW8" value="' + esc(na.code) + '"></div>' +
    '<div class="champ"><label for="fn-nom">Nom</label><input id="fn-nom" type="text" autocomplete="off" autocapitalize="sentences" placeholder="ex. Amundi MSCI World" value="' + esc(na.nom) + '"></div></div>' +
    '<div class="champ"><label for="fn-ticker">Ticker Google Finance</label><div class="ligne-champ"><input id="fn-ticker" type="text" autocomplete="off" autocapitalize="characters" placeholder="ex. EPA:CW8" value="' + esc(na.ticker) + '"><button class="mini-btn" type="button" id="fn-verif">Vérifier</button></div>' +
    '<span class="aide" id="fn-res">' + esc(na.msg || "EPA: pour Paris, ETR: pour Xetra, CURRENCY:ETHEUR pour une crypto. Sans ticker, indique un cours manuel.") + "</span></div>" +
    (na.isin ? '<p class="aide m-na-isin">ISIN repris du document : <b>' + esc(na.isin) + "</b></p>" : "") +
    '<div class="rang"><div class="champ"><label for="fn-classe">Classe</label><select id="fn-classe">' + opt(classes, na.classe) + "</select></div>" +
    '<div class="champ"><label for="fn-zone">Zone</label><select id="fn-zone">' + opt(zones, na.zone) + "</select></div></div>" +
    '<div class="rang"><div class="champ"><label for="fn-levier">Levier</label><select id="fn-levier">' + opt(["1", "2", "3"], na.levier) + "</select></div>" +
    '<div class="champ"><label for="fn-manuel">Cours manuel (€)</label><input id="fn-manuel" type="text" inputmode="decimal" autocomplete="off" placeholder="si pas de ticker" value="' + esc(na.manuel) + '"></div></div>' +
    '<div class="m-na-a"><button class="btn" type="button" id="fn-ok">' + (cadre ? "Créer et choisir" : "Ajouter l'actif") + "</button>" + (cadre ? '<button class="lien" type="button" id="fn-ko">Annuler</button>' : "") + "</div></div>";
}
/** apres(a) : une fois l'actif créé dans le fichier ; annuler() : bouton « Annuler » (saisie d'ordre seulement) */
function brancherNouvelActif(na, apres, annuler) {
  const lire = () => { na.code = ($f("fn-code").value || "").trim().toUpperCase(); na.nom = ($f("fn-nom").value || "").trim(); na.ticker = ($f("fn-ticker").value || "").trim().toUpperCase();
    na.classe = $f("fn-classe").value; na.zone = $f("fn-zone").value; na.levier = $f("fn-levier").value; na.manuel = ($f("fn-manuel").value || "").trim(); };
  ["fn-code", "fn-nom", "fn-ticker", "fn-manuel"].forEach(id => $f(id).addEventListener("input", lire));
  ["fn-classe", "fn-zone", "fn-levier"].forEach(id => $f(id).addEventListener("change", lire));
  const msg = t => { na.msg = t; const el = $f("fn-res"); if (el) el.textContent = t; };
  if ($f("fn-ko")) $f("fn-ko").addEventListener("click", annuler);
  $f("fn-verif").addEventListener("click", async () => {
    lire(); if (!na.ticker) { msg("Saisis d'abord un ticker."); return; }
    msg("Vérification auprès de Google Finance…");
    const rep = await posterFichier({ action: "verifierTicker", ticker: na.ticker });
    if (rep.ok) { if (!na.nom && rep.nom) { na.nom = rep.nom; $f("fn-nom").value = rep.nom; } msg("✓ " + na.ticker + " reconnu : " + cours(rep.cours) + (rep.nom ? " · " + rep.nom : "")); }
    else msg(rep.message || "Ticker introuvable.");
  });
  $f("fn-ok").addEventListener("click", async () => {
    lire(); const r = refData(), manuel = lireNombre(na.manuel);
    if (!/^[A-Z0-9_]{2,12}$/.test(na.code) || !na.nom) { msg("Code (2 à 12 lettres ou chiffres) et nom obligatoires."); return; }
    if (r.actifs.some(x => x.code === na.code)) { msg("Le code " + na.code + " existe déjà : choisis-le dans la liste."); return; }
    if (!na.ticker && !(manuel > 0)) { msg("Indique un ticker Google Finance ou un cours manuel."); return; }
    const a = { code: na.code, nom: na.nom, ticker: na.ticker, classe: na.classe, zone: na.zone, levier: lireNombre(na.levier) || 1, coursManuel: manuel };
    if (na.isin) a.isin = na.isin;   // v17.76 : seulement depuis un import (champ déjà lu par le fichier)
    const b = $f("fn-ok"), lib = b.textContent; b.disabled = true; b.textContent = "Création…";
    const rep = await posterFichier({ action: "actif", actif: a });
    if (!rep.ok) {
      if (rep.erreur === "cle") { cleRefusee(rep.message); fermerSaisieM(); toast("Clé refusée par ton fichier."); if (vueMoi()) rendre(); return; }
      b.disabled = false; b.textContent = lib; msg(rep.message || "Erreur inattendue."); if (rep.erreur === "incertain") charger(true); return;
    }
    r.actifs.push({ code: a.code, nom: a.nom, classe: a.classe });
    apres(a, rep);
  });
}
let plusTypes = false, menuOuvert = false;
/* v17.78 (lot60, Théo : « on se noie ») · parcours guidé en étapes : 1 Quoi ? · 2 Les chiffres · 3 Le versement (achat) · 4 Relire ;
   les données envoyées ne changent pas (même F, même envoyerOrdre) ; seul l'affichage est découpé.
   Bouton retour du téléphone = étape précédente (depuis l'étape 1 : ferme « + ») ; ce qui est tapé reste gardé pendant la visite (brouillons). */
let etape = 1, paneCourant = "ordre";
const brouillons = {};
/* v17.79 (Théo) : « ↻ Même achat que la dernière fois » sur « Quoi ? » : compte + actif du dernier achat, droit aux chiffres (les chiffres viennent toujours de l'avis) */
function dernierAchat() {
  const l = ((M && M.ref && M.ref.journal) || []).filter(o => o.type === "Achat" && o.enveloppe && o.actif && !o.envoi).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const o = l[0]; if (!o) return null;
  const ouv = (refData().enveloppes || []).some(e => typeof e !== "string" && e.nom === o.enveloppe && (!e.statut || e.statut === "Ouvert" || e.statut === "À ouvrir"));
  return ouv ? { env: o.enveloppe, actif: o.actif, date: String(o.date || "").slice(0, 10) } : null;
}
/* v20.22 (Théo, avis de l'agent moi-avocat-du-diable) · rappel en lecture seule du dernier achat de la MÊME ligne (même compte, même actif) :
   date et cours moyen payé, jamais le nombre de parts, rien de pré-rempli (tout vient de l'avis d'opéré). Cherché dans les 30 derniers ordres. */
function htmlDernierAchatLigne() {
  if (F.type !== "Achat" || !F.actif || F.na) return "";
  const o = ((M && M.ref && M.ref.journal) || []).filter(x => x.type === "Achat" && x.enveloppe === F.env && x.actif === F.actif && x.date && String(x.date).slice(0, 10) <= aujourdhuiISO())   // pas les achats programmés à venir
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if (!o) return "";
  const pu = o.quantite > 0 && o.montant > 0 ? (o.montant - (o.frais || 0)) / o.quantite : 0;   // montant du journal = net débité, frais compris : on les retire pour comparer au cours de l'avis
  const prix = pu > 0 && ETAT.discret !== "oui" ? ", au cours de " + nbCours(pu) + " (hors frais)" : "";   // même mot que le champ « Cours » (relecture moi-utilisateur)
  return '<p class="m-pu" id="f-dernier">Dernier achat de ' + esc(F.actif) + " sur ce compte : le " + esc(frDate(String(o.date).slice(0, 10))) + prix + "</p>";
}
function htmlMemeAchat() {
  const d = dernierAchat(); if (!d) return "";
  const mm = d.date && d.date.slice(0, 7) === isoJour(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15)).slice(0, 7);
  return '<button type="button" class="m-meme" id="f-meme">↻ <b>Même titre que ' + (mm ? "le mois dernier" : "la dernière fois") + '</b><small>' + esc(d.actif) + " · " + esc(d.env) + " · parts et montant à recopier de ton nouvel avis</small></button>";
}
const NOMS_ETAPES = { 1: "Quoi ?", 2: "Les chiffres", 3: "Versement", 4: "Relire" };
function etapesDe(t) { return t === "Achat" ? [1, 2, 3, 4] : t === "Vente" ? [1, 2, 4] : [1, 2]; }
function etapeFinale() { const l = etapesDe(F.type); return etape === l[l.length - 1]; }
function etapeApres() { const l = etapesDe(F.type), i = l.indexOf(etape); return i >= 0 ? l[i + 1] || 0 : 0; }
function etapeAvant() { const l = etapesDe(F.type), i = l.indexOf(etape); return i > 0 ? l[i - 1] : 0; }
/** analyser() comme si l'on était à cette étape : ce qui se règle plus loin (versement, espèces, doublon) ne bloque pas encore */
function analyserEtape(n) {
  if (n >= 4 || etapeFinaleN(n)) return analyser();
  const F0 = F; F = Object.assign({}, F0, n === 2 ? { okEspeces: true, okDoublon: true, apport: false } : { okDoublon: true });
  try { return analyser(); } finally { F = F0; }
}
function etapeFinaleN(n) { const l = etapesDe(F.type); return n === l[l.length - 1]; }
function entame() { return ["qte", "montant", "prix", "frais", "montantApport"].some(k => String(F[k] || "").trim()) || F.dateChoisie || F.envChoisi || !!IMP || !!F.na; }
/** l'import est relu d'un coup (carte de relecture) seulement si TOUT est sûr ; sinon on montre les chiffres */
function importPret() {
  if (!F.imp || !IMP || !IMP.ops || F.na || !(F.type === "Achat" || F.type === "Vente")) return false;
  const op = IMP.ops[F.imp.i] || {};
  if ((op.manque && op.manque.length) || op.ecart || !F.imp.envSur || (F.imp.propose && !F.imp.confirme)) return false;
  return controleAvis().c === "ok" && !analyserEtape(2).bloque;
}
function allerEtape(n) {
  if (n === 1) {
    if (entame()) brouillons[F.type] = { F: Object.assign({}, F), IMP: IMP };   // rien n'est perdu : revenir au même type le retrouve
    F = formulaire(null); IMP = null; plusTypes = false;
  }
  etape = n; menuOuvert = false; nommerRaccourci = false; rendreFormulaire();
  const f = document.querySelector("#m-saisie .m-feuille"); if (f) f.scrollTop = 0;
}
function etapeSuivante() {
  const n = etapeApres(); if (!n) return;
  if (analyserEtape(etape).bloque) { majRecap(); return; }
  allerEtape(n);
  if (n === 2) setTimeout(premierChamp, 30);
}
function premierChamp() { const el = ["f-actif", "f-qte", "f-montant"].map(id => $f(id)).find(e => e && !e.value); if (el && el.tagName === "INPUT") el.focus(); }
/** bouton retour du téléphone (7-bilan.js) : true = géré ici (étape précédente) ; false = on ferme « + » */
function retourSaisie() {
  const s = $f("m-saisie"); if (!s || s.hidden || !F) return false;
  if (paneCourant === "journal") { paneSaisie("ordre"); return true; }
  if (paneCourant !== "ordre") return false;
  if (menuOuvert) { menuOuvert = false; nommerRaccourci = false; rendreFormulaire(); return true; }
  if (etape === 1) { if (IMP) { IMP = null; rendreFormulaire(); return true; } return false; }
  allerEtape(etapeAvant() || 1); return true;
}
/* V15.2 : aides masquables (menu « ⋯ » de la saisie), retenu sur l'appareil */
function majAides() { const f = document.querySelector("#m-saisie .m-feuille"); if (f) f.classList.toggle("sans-aide", PREF.aides === false); }
let detailsOuverts = false;
/* v17.34 · seul le montant du versement reste replié (vide = même montant que l'achat), avec son résumé d'une ligne */
function resumeDetails() {
  const ma = lireNombre(F.montantApport);
  return ma > 0 ? (ETAT.discret === "oui" ? "montant à part" : nf(0, 2).format(ma) + NB + "€") : "même montant que l'achat";
}
function dateCourteIso(d) { const an = String(new Date().getFullYear()); return !d ? "" : d.slice(0, 4) === an ? d.slice(8, 10) + "/" + d.slice(5, 7) : frDate(d); }
function isoDecale(iso, jours, mois) { const d = new Date(iso + "T12:00:00"); d.setMonth(d.getMonth() + (mois || 0)); d.setDate(d.getDate() + (jours || 0)); return isoJour(d); }
/* v17.34 · « Valeur AV » : la date n'est jamais celle du jour par défaut ; on PROPOSE le relevé précédent + 1 mois, à confirmer d'un tap */
function dateProposee() {
  if (F.type !== "Relevé") return "";
  const der = journalRecent().find(o => o.type === "Relevé" && o.enveloppe === F.env && (!F.actif || o.actif === F.actif));
  if (!der || !/^\d{4}-\d{2}-\d{2}/.test(der.date)) return "";
  const d = isoDecale(der.date.slice(0, 10), 0, 1);
  return d <= aujourdhuiISO() ? d : "";
}
/* v16.97 · les petites phrases sous les champs calculés ou pré-remplis (toujours visibles, même « aides masquées ») */
function aidesCalcul() {
  const out = { montant: "", qte: "", frais: "" };
  if (F.montantAuto && AVEC_QTE.includes(F.type)) out.montant = "Calculé : quantité × cours" + (lireNombre(F.frais) > 0 ? (F.type === "Vente" ? " − courtage" : " + courtage") : "") + ". Compare-le au montant net de ton avis (c'est lui qui compte).";
  else if (F.montantHab && F.type === "Apport") out.montant = "Ton versement habituel sur ce compte : change-le si besoin.";
  if (AVEC_QTE.includes(F.type) && F.pilote === "prix" && !F.qteTape && lireNombre(F.qte) > 0) out.qte = "Calculé avec le cours : recopie plutôt la quantité de ton avis d'opéré.";
  if (F.fraisAuto && AVEC_FRAIS.includes(F.type)) out.frais = "Repris de ta dernière opération : à vérifier sur l'avis.";
  return out;
}
/** la ligne « soit … €/part », toujours affichée pour un achat ou une vente (contrôle de lecture de l'avis) */
function lignePrixPart() {
  if (!AVEC_QTE.includes(F.type) || F.type === "Frais en parts") return "";
  return controleAvis().t;
}
/* v17.73 (lot57, Conseil) · calcul croisé quantité × cours ± courtage = montant net : 2 des 3 suffisent, le 3e se calcule ;
   les 3 tapés : contrôle au centime (✓ ou écart dit en clair ; au-delà de 1 % / 1 €, analyser() demande de confirmer) */
function nbCours(v) { return nf(2, 4).format(v) + NB + "€"; }
function controleAvis() {
  const q = lireNombre(F.qte), p = lireNombre(F.prix), m = lireNombre(F.montant), fr = lireNombre(F.frais) || 0, t = typeInfo(F.type).tresorerie, discret = ETAT.discret === "oui";
  const signe = F.type === "Vente" ? " − " : " + ", net = netOrdre();
  if (F.qteTape && F.prixTape && q > 0 && p > 0 && m > 0 && !F.montantAuto) {
    const attendu = q * p - (isNaN(fr) ? 0 : fr) * t, ec = m - attendu;
    const calc = discret ? "Quantité × cours" + signe + "courtage" : qteBrute(q) + " × " + nbCours(p) + (fr > 0 ? signe + nf(2, 2).format(fr) + NB + "€" : "") + " = " + nf(2, 2).format(attendu) + NB + "€";
    if (Math.abs(ec) < .015) return { t: "✓ " + calc + (discret ? " = montant net" : "") + " : ça colle avec ton avis.", c: "ok" };
    return { t: "⚠ " + calc + (discret ? " ≠ montant net" : "") + " : écart de " + (discret ? "•••" : nf(2, 2).format(Math.abs(ec))) + NB + "€ avec le montant net. Vérifie le cours, le courtage et le montant.", c: "warn" };
  }
  if (F.montantAuto || (F.pilote === "prix" && !F.qteTape && q > 0)) return { t: "", c: "" };   // la phrase est déjà sous le champ calculé
  if (net > 0 && q > 0) return { t: "Soit " + (discret ? cours(net / q) : nbCours(+(net / q).toFixed(4))) + " par part" + (F.type === "Achat" ? " (hors frais)" : " (avant frais)") + " : compare avec le cours de ton avis.", c: "" };
  return { t: "Remplis 2 des 3 (quantité, cours, montant net) : le 3e se calcule. Les 3 : l'appli vérifie.", c: "" };
}
/** v17.34 (Conseil) : le relevé du Versus selon le profil ; fichier relié = envoyé tout seul (aucune saisie proposée ici) */
function versusRelie() { return !!(M && M.versusLie === true); }
function moisDuReleve() { const d = new Date(), fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); return d.getDate() >= fin - 2 || d.getDate() <= 5; }
/** v17.81 (Théo) : dernier relevé AUTOMATIQUE de ce joueur, lu dans le journal du Versus (import du Versus OU envoi du fichier) → Date ou null */
const MOIS_RV = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function dernierImportAuto() {
  const Dv = dVersus(), qui = (M && M.personne) || (typeof moiVrai === "function" ? moiVrai() : null) || ETAT.moi;
  const j = Dv && (Dv.journal || []).find(x => x.personne === qui && x.action === "Import auto" && x.statut !== "Annulé");   // journal : du plus récent au plus ancien
  const d = j && new Date(j.t); return d && !isNaN(d) ? d : null;
}
/** v17.83 (Théo) : une seule petite bulle (qui s'en va toute seule) à la 1re ouverture après l'envoi du relevé ; ensuite, seulement la ligne en bas de « + » */
function bulleReleve() {
  try {
    const der = dernierImportAuto(); if (!der || Date.now() - der.getTime() > 4 * 864e5 || typeof toast !== "function") return;
    const cle = "versus.rvVu", k = der.toISOString().slice(0, 10); if (localStorage.getItem(cle) === k) return;
    localStorage.setItem(cle, k);
    const r = new Date(Math.round(der.getTime() / 36e5) * 36e5), m = MOIS_RV[der.getMonth()];
    toast("✅ Relevé " + (/^[aeiouy]/i.test(m) ? "d'" : "de ") + m + " envoyé au Versus (" + String(r.getDate()).padStart(2, "0") + "/" + String(r.getMonth() + 1).padStart(2, "0") + " à " + r.getHours() + " h)");
    return true;
  } catch (e) { /* stockage indisponible : pas de bulle */ }
  return false;
}
function htmlCarteReleveVersus() {
  const der = dernierImportAuto();
  if (versusRelie() || der) {   // v17.81 (Théo) : le relevé automatique se voit de nouveau (Théo : lu par le Versus ; Clément, Devlin : envoyé par leur fichier)
    const a = new Date(), j = typeof jourReleve === "function" ? jourReleve(a.getFullYear(), a.getMonth() + 1) : null;
    const fait = der && der.getFullYear() === a.getFullYear() && der.getMonth() === a.getMonth();   // v17.82 (Théo) : le relevé de CE mois est déjà parti
    const prochain = j && !fait && j >= new Date(a.getFullYear(), a.getMonth(), a.getDate()) ? j : (typeof jourReleve === "function" ? jourReleve(a.getFullYear(), a.getMonth() + 2) : null);
    const fr = d => d ? String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") : "";
    const r = der && new Date(Math.round(der.getTime() / 36e5) * 36e5);   // heure ronde : 19 h 11 → 19 h, 19 h 40 → 20 h
    if (fait) return '<button type="button" class="m-rv-auto fait" id="f-rv-h" title="Voir mes relevés">✅ <b>Relevé ' + (/^[aeiouy]/i.test(MOIS_RV[a.getMonth()]) ? "d'" : "de ") + MOIS_RV[a.getMonth()] + " envoyé</b> au Versus le " + fr(r) + " à " + r.getHours() + " h" +
      (prochain ? "<small>Prochain le " + fr(prochain) + " vers 19 h, automatiquement</small>" : "") + '<i aria-hidden="true">›</i></button>';
    return '<button type="button" class="m-rv-auto" id="f-rv-h" title="Voir mes relevés">🏁 Relevé du mois pour le Versus : <b>automatique</b>' + (prochain ? " · prochain le " + fr(prochain) + " vers 19 h (dernier jour ouvré)" : "") +
      (r ? "<small>Dernier envoyé le " + fr(r) + " à " + r.getHours() + " h ✓</small>" : "") + '<i aria-hidden="true">›</i></button>';
  }
  if (typeof ouvrirSaisie !== "function") return "";
  const fort = moisDuReleve();
  return '<button class="m-rv' + (fort ? " fort" : "") + '" type="button" id="f-rv"><span>🏁 <b>Relevé du mois pour le Versus</b>' + (fort ? "<small>C'est le moment : la valeur de tes comptes en fin de mois.</small>" : "") + "</span><i>›</i></button>";
}
function ouvrirReleveVersus(journal) {
  fermerSaisieM(); { const s2 = $f("ms-saisie"); if (s2) s2.hidden = true; } if (typeof ouvrirSaisie !== "function") return;
  ouvrirSaisie(); if (journal && typeof ongletReleves === "function") ongletReleves("journal");
}
/* ---- v17.76 (lot59, Théo) · « 📄 Importer mon avis d'opéré » : le PDF (ou son texte collé) est lu DANS le téléphone, rien n'est envoyé ;
   chaque opération de l'avis pré-remplit la saisie habituelle (mêmes champs, même envoi), l'utilisateur relit et valide toujours.
   Jamais de valeur inventée : un champ absent de l'avis reste vide et est signalé. pdf.js est chargé à la demande depuis cdnjs. ---- */
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
/* ETF et supports courants (ISIN → code habituel, ticker Google Finance ; "" = ticker à vérifier) : seulement pour PROPOSER l'actif, jamais l'imposer.
   v20.54 : supports de Théo + ETF courants du PEA/CTO Fortuneo et de Linxea Spirit 2. Les supports PROPRES à un joueur ne sont PAS ici
   (dépôt public) : son fichier les donne à SON appli (colonne « ISIN » de Paramètres › Mes actifs, fonction listerMesIsin du script). */
const ISIN_CONNUS = {
  // Nasdaq-100
  FR0010342592: ["LQQ", "EPA:LQQ"], FR0011871110: ["PUST", "EPA:PUST"], LU1681038243: ["ANX", "EPA:ANX"], IE00B53SZB19: ["CNDX", "LON:CNDX"],
  // S&P 500
  FR0011871128: ["PSP5", "EPA:PSP5"], FR0011550185: ["ESE", "EPA:ESE"], FR0013412285: ["PE500", "EPA:PE500"], IE00B5BMR087: ["CSPX", "LON:CSPX"], LU1681048804: ["500", "EPA:500"],
  // Monde
  LU1681043599: ["CW8", "EPA:CW8"], FR0011869353: ["EWLD", "EPA:EWLD"], FR001400U5Q4: ["DCAM", "EPA:DCAM"], IE0002XZSHO1: ["WPEA", "EPA:WPEA"], FR0010315770: ["WLD", "EPA:WLD"],
  IE00B4L5Y983: ["IWDA", "AMS:IWDA"], IE00BK5BQT80: ["VWCE", "ETR:VWCE"], IE00B3RBWM25: ["VWRL", "AMS:VWRL"], LU3243907741: ["ACWI", ""],
  // Europe, France
  FR0013412038: ["PCEU", "EPA:PCEU"], FR0011550193: ["ETZ", "EPA:ETZ"], FR0007052782: ["CAC", "EPA:CAC"], LU0908500753: ["MEUD", "EPA:MEUD"],
  // Émergents
  FR001400ZGO4: ["EMPEA", ""], FR0013412020: ["PAEEM", "EPA:PAEEM"], LU1681045370: ["AEEM", "EPA:AEEM"], IE00BKM4GZ66: ["EIMI", "AMS:EMIM"],
  // Or
  FR0013416716: ["GOLD", "EPA:GOLD"], IE00B4ND3602: ["IGLN", "LON:IGLN"],
  // Monétaire, obligations
  FR0010510800: ["CSH2", "EPA:CSH2"], LU0290358497: ["XEON", "ETR:XEON"],
  // Levier (hors PEA)
  FR0010755611: ["CL2", "EPA:CL2"]
};
let IMP = null;   // { panneau, coller, texte, msg, lecture, compte, ops: [...], i }
let pdfjsP = null;
function chargerPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfjsP) return pdfjsP;
  pdfjsP = new Promise((ok, ko) => {
    const s = document.createElement("script"), fin = setTimeout(() => echec(), 20000);
    function echec() { clearTimeout(fin); pdfjsP = null; s.remove(); ko(new Error("pdfjs")); }
    s.src = PDFJS_URL + "pdf.min.js"; s.crossOrigin = "anonymous"; s.referrerPolicy = "no-referrer";
    s.onload = () => { clearTimeout(fin); if (!window.pdfjsLib) { echec(); return; } window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_URL + "pdf.worker.min.js"; ok(window.pdfjsLib); };
    s.onerror = echec;
    document.head.appendChild(s);
  });
  return pdfjsP;
}
/** texte d'un PDF, ligne par ligne (morceaux regroupés par hauteur, de gauche à droite) */
async function textePdf(fichier) {
  const lib = await chargerPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await fichier.arrayBuffer()), isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
  const lignes = [];
  for (let n = 1; n <= Math.min(doc.numPages, 6); n++) {
    const tc = await (await doc.getPage(n)).getTextContent(), rangs = [];
    tc.items.forEach(it => { if (!it.str || !it.transform) return; const y = it.transform[5], x = it.transform[4], h = Math.abs(it.transform[3]) || 10;
      let r = rangs.find(l => Math.abs(l.y - y) < h * .45); if (!r) { r = { y: y, items: [] }; rangs.push(r); } r.items.push({ x: x, w: it.width || 0, h: h, s: it.str }); });
    rangs.sort((a, b) => b.y - a.y).forEach(r => {
      r.items.sort((a, b) => a.x - b.x); let t = "", fin = null;
      r.items.forEach(it => { if (fin !== null) { const ec = it.x - fin; t += ec > it.h * 1.2 ? "   " : ec > it.h * .12 ? " " : ""; } t += it.s; fin = it.x + it.w; });
      lignes.push(t);
    });
  }
  try { doc.destroy(); } catch (e) {}
  return lignes.join("\n");
}
const NUM_AV = "(\\d{1,3}(?:\\.\\d{3})+,\\d+|\\d{1,3}(?:,\\d{3})+\\.\\d+|\\d{1,3}(?: \\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)";   // v20.54 : aussi « 1.234,56 » et « 1,234.56 »
const chiffre = v => { const x = String(v || "").replace(/ /g, "");
  if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(x)) return x.replace(/\./g, "");                       // 1.234,56 (point des milliers)
  if (/^\d{1,3}(?:,\d{3})+\.\d+$/.test(x)) return x.replace(/,/g, "").replace(".", ",");     // 1,234.56 (à l'anglaise)
  return x.replace(".", ","); };
/** cohérence d'une ligne lue : quantité × cours ± frais = montant (au centime) */
function ecartOp(op) {
  const q = lireNombre(op.qte), p = lireNombre(op.cours), fr = lireNombre(op.frais) || 0, m = lireNombre(op.montant);
  if (!(q > 0 && p > 0 && m > 0) || !op.type) return false;
  const att = op.type === "Achat" ? q * p + fr : op.type === "Vente" ? q * p - fr : q * p;
  return Math.abs(m - att) >= .015;
}
const LIB_MANQUE = { date: "date", type: "type d'opération", qte: "quantité", cours: "cours", frais: "courtage", montant: "montant net", actif: "support" };
function finirOp(op, attendus) { op.manque = attendus.filter(c => !op[c]).map(c => op.src === "linxea" && c === "qte" ? "nombre de parts" : op.src === "linxea" && c === "cours" ? "valeur de la part" : op.src === "linxea" && c === "montant" ? "montant" : LIB_MANQUE[c]); op.ecart = ecartOp(op); return op; }
/** lit un avis (texte) par ses LIBELLÉS (pas par colonnes) : Fortuneo (avis d'opéré) ou Linxea Spirit 2 (confirmation de versement, tableaux copiés du site) */
function lireAvis(brut) {
  const t = String(brut || "").replace(/[    ]/g, " ").replace(/\r/g, "");
  if (/\bSens\b/.test(t) && /Montant\s+net/i.test(t)) return lireFortuneo(t);
  if (/Niveau de risque/i.test(t) && /^\s*Valeur\d?\s+\d/im.test(t)) return lireQuintessa(t);
  if (/linxea|spirica|nombre de parts|valeur de (?:la )?parts?|versement libre|frais de gestion sur UC|rachat partiel/i.test(t)) return lireLinxea(t);
  return lireFortuneo(t);
}
/* Quintessa (BPCE Vie) : pas de PDF, la page de l'espace client copiée. Chaque support = un RELEVÉ (« Valeur AV ») de sa valeur ;
   le panneau de détail (Quantité, valeur unitaire) n'est lu que pour information : un relevé n'enregistre que la valeur */
function lireQuintessa(t) {
  const L = t.split("\n").map(x => x.trim()), ops = [], auj = aujourdhuiISO();
  const val = (l, lab) => { const x = l.match(new RegExp("^" + lab + "\\s*" + NUM_AV + "\\s*€", "i")); return x ? chiffre(x[1]) : ""; };
  L.forEach((l, n) => {
    if (!/^Niveau de risque/i.test(l)) return;
    let k = n - 1; while (k >= 0 && !L[k]) k--;
    const nom = L[k] || ""; if (!nom || /Indicateurs/i.test(nom)) return;   // panneau de détail : lu plus bas
    let v = ""; for (let j = n + 1; j <= n + 4 && j < L.length && !v; j++) v = val(L[j], "Valeur\\d?(?!\\d?\\s*unitaire)");
    if (!v) return;
    const op = { src: "quintessa", type: "Relevé", nom: nom, isin: "", date: auj, montant: v, dateAuto: true };
    if (/artema/i.test(nom)) op.note = "Le niveau de l'indice Artema n'est pas sur cette page : la « valeur unitaire » du site n'est PAS ce niveau. Saisis-le à la main dans « 🎯 Point Artema ».";
    ops.push(finirOp(op, ["montant"]));
  });
  /* panneau de détail : nom (avant « Indicateurs financiers »), Quantité, Valeur unitaire, Valorisation */
  L.forEach((l, n) => {
    if (!/^Indicateurs financiers/i.test(l)) return;
    let k = n - 1; while (k >= 0 && !L[k]) k--;
    const nom = L[k] || "", bloc = L.slice(n, n + 16);
    const q = (bloc.map(x => x.match(new RegExp("^Quantit[ée]\\s*" + NUM_AV + "\\s*$", "i"))).find(Boolean) || [])[1];
    const vu = bloc.map(x => val(x, "Valeur\\d?\\s*unitaire")).find(Boolean) || "", vt = bloc.map(x => val(x, "Valorisation\\d?")).find(Boolean) || "";
    const cible = ops.find(o => motsActif(o.nom).join(" ") === motsActif(nom).join(" ")) || ops.find(o => vt && o.montant === vt);
    if (cible) { cible.qteInfo = q ? chiffre(q) : ""; cible.vuInfo = vu; }
  });
  ops.forEach(o => { const info = o.qteInfo || o.vuInfo ? "Lu dans le détail : " + (o.qteInfo ? o.qteInfo + " parts" : "") + (o.qteInfo && o.vuInfo ? " · " : "") + (o.vuInfo ? "valeur unitaire " + o.vuInfo + " €" : "") + " (pour information : un relevé n'enregistre que la valeur)." : "";
    o.note = [info, o.note, "Valeur du site au jour du copier-coller : la date est mise à aujourd'hui, change-la si tu as copié un autre jour."].filter(Boolean).join(" "); });
  return { compte: "QUINTESSA", ops: ops };
}
function lireFortuneo(t) {
  const mc = t.match(/COMPTE\s+(PEA[\s-]*PME|PEA|TITRES|ORDINAIRE|CTO)\b/i) || t.match(/\b(PEA[\s-]*PME|PEA|COMPTE[\s-]*TITRES|CTO)\b/i);
  const compte = !mc ? "" : /PME/i.test(mc[1]) ? "PEA-PME" : /PEA/i.test(mc[1]) ? "PEA" : "CTO";
  const marques = []; let m; const re = /\(\s*([A-Z]{2}[A-Z0-9]{9}\d)\s*\)/g;
  while ((m = re.exec(t))) marques.push({ i: m.index, fin: re.lastIndex, isin: m[1] });
  if (!marques.length) { const rs = /\bSens\b/g; while ((m = rs.exec(t))) { const d0 = t.lastIndexOf("\n", m.index), d1 = d0 > 0 ? t.lastIndexOf("\n", d0 - 1) + 1 : 0; marques.push({ i: d1, fin: d1, isin: "" }); } }   // avis sans ISIN : un bloc par « Sens »
  const champ = (bloc, lab) => { const x = bloc.match(new RegExp(lab + "\\s*:?\\s*" + NUM_AV, "i")); return x ? chiffre(x[1]) : ""; };
  const ops = marques.map((k, n) => {
    const debLigne = t.lastIndexOf("\n", k.i) + 1, avant = t.slice(debLigne, k.i);
    const nom = (avant.includes(":") ? avant.slice(avant.lastIndexOf(":") + 1) : avant).replace(/^[^A-Za-z0-9]+/, "").replace(/\s+/g, " ").trim();
    const bloc = t.slice(k.fin, n + 1 < marques.length ? marques[n + 1].i : t.length);
    /* v20.54 : la date qui suit « exécution / négociation / opération » d'abord (pas la date de règlement) */
    const d = bloc.match(/(?:ex[ée]cut|n[ée]goci|op[ée]ration)[^\n\d]{0,40}(\d{2})[-\/.](\d{2})[-\/.](\d{4})/i) || bloc.match(/\b(\d{2})[-\/.](\d{2})[-\/.](\d{4})\b/), h = bloc.match(/\b(\d{2}):(\d{2})(?::\d{2})?\b/);
    const s = bloc.match(/\bSens\s*:?\s*(Achat|Vente)/i) || bloc.match(/\b(Achat|Vente)\s+(?:comptant|au comptant|SRD)/i);
    const op = { src: "fortuneo", nom: nom, isin: k.isin, date: d ? d[3] + "-" + d[2] + "-" + d[1] : "", heure: h ? h[1] + ":" + h[2] : "", type: s ? (/^a/i.test(s[1]) ? "Achat" : "Vente") : "",
      qte: champ(bloc, "Quantit[ée]s?"), cours: champ(bloc, "\\bCours(?:\\s+d'ex[ée]cution)?"), brut: champ(bloc, "Montant\\s+brut"),
      frais: champ(bloc, "(?:Courtage(?:\\s+et\\s+commissions?)?|Commissions?|Frais\\s+de\\s+courtage)"), montant: champ(bloc, "Montant\\s+net") };
    /* v20.54 : taxe sur les transactions financières (TTF) ajoutée aux frais */
    const ttf = champ(bloc, "(?:Taxe\\s+sur\\s+les\\s+transactions\\s+financi[èe]res|\\bTTF\\b)");
    if (lireNombre(ttf) > 0) { op.frais = saisieNombre((lireNombre(op.frais) || 0) + lireNombre(ttf), 2); op.note = "Taxe sur les transactions financières (" + ttf + " €) ajoutée aux frais."; }
    /* v20.54 : dividende / coupon → « Dividende / intérêts », montant NET (ce qui arrive en espèces) */
    if (!op.type && /dividende|coupon|distribution|revenus?\s+de\s+titres/i.test(bloc + "\n" + (n ? t.slice(debLigne, k.i) : t.slice(0, k.i)))) {   // le texte de CETTE opération (l'en-tête de l'avis pour la 1re)
      const dp = bloc.match(/(?:paiement|d[ée]tachement|versement)[^\n\d]{0,30}(\d{2})[-\/.](\d{2})[-\/.](\d{4})/i);
      if (dp) op.date = dp[3] + "-" + dp[2] + "-" + dp[1];
      op.type = "Intérêts"; op.note = "Dividende" + (op.qte ? " de " + op.qte + " titres" : "") + " : montant net reçu" + (op.brut ? " (brut " + op.brut + " €)" : "") + ".";
      op.qte = ""; op.cours = ""; op.frais = ""; op.texte = t.slice(debLigne, k.fin) + bloc;
      return finirOp(op, ["date", "montant"]);
    }
    op.texte = t.slice(debLigne, k.fin) + bloc;   // texte complet de l'opération (référence comprise) : sert seulement à repérer le même avis collé deux fois
    return finirOp(op, ["date", "type", "qte", "cours", "frais", "montant"]);
  }).filter(o => o.type || o.qte || o.montant);
  return { compte: compte, ops: sansDoublons(ops) };
}
/** v20.54 : le même avis collé deux fois = une seule opération (même titre, date, heure, sens, quantité, montant) */
function sansDoublons(ops) {   // v20.54 : SEULEMENT si le texte complet est identique (même référence) ; deux vrais avis pareils restent deux opérations
  // le texte de l'opération jusqu'à « Montant net » (inclus), plus sa référence si l'avis en donne une : rien de ce qui suit (l'avis suivant) ne compte
  const cle = o => { const c = (o.texte.match(/^[\s\S]*?Montant\s+net[^\n]*/i) || [o.texte])[0], r = (o.texte.match(/R[ée]f[ée]rence[^\n]*/i) || [""])[0]; return o.src + "|" + (c + "|" + r).replace(/\s+/g, " ").trim(); };
  const vus = new Map(); return ops.filter(o => { if (!o.texte) return true; const k = cle(o), d = vus.get(k);
    if (d) { d.note = [d.note, "Cet avis était collé deux fois : gardé une fois."].filter(Boolean).join(" "); return false; } vus.set(k, o); return true; }); }
/* Linxea Spirit 2 (Spirica) : « Confirmation de versement libre » (PDF) ou tableaux copiés du site (liste des opérations, « Détail du versement… »).
   Versement → Achat du support AVEC le versement (montant versé) ; frais de gestion → Frais en parts ; rachat → Vente du support puis Retrait. */
function lireLinxea(t) {
  const L = t.split("\n"), ops = [], isoFr = d => d ? d.slice(6, 10) + "-" + d.slice(3, 5) + "-" + d.slice(0, 2) : "";
  const euros = s => { const r = []; const re = new RegExp(NUM_AV + "\\s*€", "g"); let x; while ((x = re.exec(s))) r.push(chiffre(x[1])); return r; };
  const nature = s => /frais de gestion/i.test(s) ? "frais" : /rachat/i.test(s) ? "rachat" : /arbitrage/i.test(s) ? "arbitrage" : /versement/i.test(s) ? "versement" : "";
  const total = (() => { const x = t.match(new RegExp("montant du versement[^\\d\\n]*" + NUM_AV + "\\s*€", "i")) || t.match(new RegExp("Votre versement[^\\d\\n]*" + NUM_AV + "\\s*€", "i")); return x ? chiffre(x[1]) : ""; })();
  const reIsin = /(?:^|[\s\t])([A-Z]{2}[A-Z0-9]{9}\d)(?=[\s\t]|$)/;
  const blocs = {};   // un versement / rachat par tableau de détail
  let teteNature = "";
  L.forEach((ligne, n) => {
    const nat = nature(ligne); if (nat && !reIsin.test(ligne) && !/^\s*(Frais de gestion|Versement|Rachat|Arbitrage)/i.test(ligne)) teteNature = nat;   // titre (« Détail du versement… », « Confirmation… »)
    /* 1 · une ligne de support (avec son ISIN) : la plus complète */
    const mi = ligne.match(reIsin);
    if (mi && /\d{2}\/\d{2}\/\d{4}/.test(ligne)) {
      const apres = ligne.slice(ligne.indexOf(mi[1]) + 12), ds = apres.match(/\d{2}\/\d{2}\/\d{4}/g) || [];
      const sansDates = apres.replace(/\d{2}\/\d{2}\/\d{4}/g, " ").replace(new RegExp(NUM_AV + "\\s*[€%]", "g"), " ");
      const restes = sansDates.match(new RegExp("(?:^|\\s)" + NUM_AV + "(?=\\s|$)", "g")) || [];
      let nom = (apres.match(/^[\s\t]*([^\t\d€]*[A-Za-z][^\t€]*?)(?=\t|\s{2,}|\s\d)/) || [])[1] || "";
      if (!nom.trim()) { const av0 = ligne.slice(0, ligne.indexOf(mi[1])).replace(/\t+/g, " ").trim(); if (/[A-Za-z]{3}/.test(av0) && !/\d{2}\/\d{2}\/\d{4}|€/.test(av0)) nom = av0; }   // v20.54 : tableau du site, nom AVANT l'ISIN
      if (!nom.trim()) {   // PDF : le nom du support est au-dessus (et parfois en dessous) de la ligne
        const av = (L[n - 1] || "").trim(), ap = (L[n + 1] || "").trim();
        nom = (/ISIN|Support/i.test(av) ? "" : av) + (ap && !/\d|€|Page/i.test(ap) ? " " + ap : "");
      }
      const e = euros(apres), nat2 = teteNature || nature(t) || "versement";
      const brut = e[0] || "", net = e.length >= 4 ? e[2] : e[1] || "", vp = e.length >= 4 ? e[3] : e[2] || "", fraisCol = e.length >= 4 ? e[1] : "";
      const parts = restes.length ? chiffre(restes[restes.length - 1].trim()) : "";
      const op = { src: "linxea", texte: ligne, nom: nom.replace(/\s+/g, " ").trim(), isin: mi[1], date: isoFr(ds[ds.length - 1]), qte: parts, cours: vp, brut: brut, net: net };
      const fr = fraisCol || (lireNombre(brut) > 0 && lireNombre(net) > 0 && Math.abs(lireNombre(brut) - lireNombre(net)) >= .005 ? saisieNombre(lireNombre(brut) - lireNombre(net), 2) : "");
      const cle = nat2 + "|" + op.date;
      if (nat2 === "frais") {   // v20.54 : le montant des frais est celui qui vaut ≈ parts × valeur de part (l'autre nombre en € est la valeur de part)
        op.type = "Frais en parts"; op.montant = net || brut; const q = lireNombre(parts);
        if (q > 0 && e.length >= 2) { let best = null; e.forEach((m, i) => e.forEach((v, j) => { if (i === j) return; const d = Math.abs(lireNombre(m) - q * lireNombre(v)); if (!best || d < best.d) best = { d, m, v }; }));
          if (best && best.d <= Math.max(.02, lireNombre(best.m) * .02)) { op.montant = best.m; op.cours = best.v; } }
        ops.push(finirOp(op, ["date", "qte", "montant"])); }
      else if (nat2 === "rachat") { op.type = "Vente"; op.montant = brut; op.frais = fr; ops.push(finirOp(op, ["date", "qte", "cours", "montant"])); (blocs[cle] = blocs[cle] || []).push(op); }
      else if (nat2 === "versement") { op.type = "Achat"; op.montant = brut; op.frais = fr; const prem = !blocs[cle]; (blocs[cle] = blocs[cle] || []).push(op);
        op.apport = prem; op.montantApport = prem && total && lireNombre(total) - lireNombre(brut) > .005 ? total : ""; op.versDoc = true;
        if (!prem) op.note = "Le versement est déjà enregistré avec le 1er support de ce document."; ops.push(finirOp(op, ["date", "qte", "cours", "montant"])); }
      else { op.type = ""; op.note = "Arbitrage : à saisir à la main (une vente puis un achat)."; ops.push(finirOp(op, ["type"])); }
      return;
    }
    /* 2 · une ligne de la liste des opérations (sans support ni parts) */
    const ml = ligne.match(/^\s*(Frais de gestion(?: sur UC)?|Versement[^\t\d€]*|Rachat[^\t\d€]*|Arbitrage[^\t\d€]*)/i);
    if (ml && euros(ligne).length) {
      const e = euros(ligne), ds = ligne.match(/\d{2}\/\d{2}\/\d{4}/g) || [], nat2 = nature(ml[1]), date = isoFr(ds[ds.length - 1]);
      const op = { src: "linxea", liste: true, nom: ml[1].trim(), isin: "", date: date, qte: "", cours: "", brut: e[0] || "", net: e[1] || "" };
      const conseil = "Le support et le nombre de parts ne sont pas dans la liste : copie aussi le tableau « Détail » de cette opération sur le site.";
      if (nat2 === "frais") { op.type = "Frais en parts"; op.montant = op.net || op.brut; op.note = "Frais prélevés en parts : indique le nombre de parts (détail de l'opération sur le site). L'appli ne l'invente pas."; ops.push(finirOp(op, ["date", "actif", "qte", "montant"])); }
      else if (nat2 === "versement") { op.type = "Achat"; op.montant = op.brut; op.apport = true; op.versDoc = true; op.montantApport = "";
        op.frais = lireNombre(op.brut) > 0 && lireNombre(op.net) > 0 && Math.abs(lireNombre(op.brut) - lireNombre(op.net)) >= .005 ? saisieNombre(lireNombre(op.brut) - lireNombre(op.net), 2) : "";
        op.note = conseil; ops.push(finirOp(op, ["date", "actif", "qte", "cours", "montant"])); }
      else if (nat2 === "rachat") { op.type = "Vente"; op.montant = op.brut; op.note = conseil; ops.push(finirOp(op, ["date", "actif", "qte", "cours", "montant"]));
        ops.push(finirOp({ src: "linxea", liste: true, type: "Retrait", nom: "Retrait du rachat", isin: "", date: date, montant: op.brut, brut: op.brut, net: op.net,
          note: "L'argent du rachat sort du contrat : montant brut " + op.brut + " €" + (op.net && op.net !== op.brut ? ", net reçu " + op.net + " € (après prélèvements)" : "") + ". Vérifie le montant avant d'enregistrer." }, ["date", "montant"])); }
      else { op.type = ""; op.note = "Arbitrage : à saisir à la main (une vente puis un achat)."; ops.push(finirOp(op, ["type"])); }
    }
  });
  /* rachat détaillé : la sortie d'argent (Retrait) après les ventes */
  Object.keys(blocs).filter(k => k.startsWith("rachat|")).forEach(k => { const l = blocs[k], s = l.reduce((a, o) => a + (lireNombre(o.montant) || 0), 0), i = ops.indexOf(l[l.length - 1]);
    ops.splice(i + 1, 0, finirOp({ src: "linxea", type: "Retrait", nom: "Retrait du rachat", isin: "", date: l[0].date, montant: saisieNombre(s, 2), note: "L'argent du rachat sort du contrat : vérifie le montant (net reçu après prélèvements sur le site)." }, ["date", "montant"])); });
  /* une ligne de liste déjà détaillée par un tableau collé (même nature, même date, même montant) : gardée une seule fois */
  const detail = ops.filter(o => !o.liste);
  /* v20.54 : la ligne de liste et le détail du même versement n'ont pas toujours la même date (date d'opération / date de valeur) :
     même nature, à 5 jours près, et même montant total (somme des supports, ou montant du versement du document) = la même opération */
  const jours = (a, b) => a && b ? Math.abs(new Date(a + "T12:00:00") - new Date(b + "T12:00:00")) / 864e5 : 99;
  const memeOp = o => { const pres = detail.filter(d => d.type === o.type && jours(d.date, o.date) <= 5); if (!pres.length) return false; if (pres.some(d => d.date === o.date)) return true;
    const m = lireNombre(o.montant), somme = pres.reduce((a, d) => a + (lireNombre(d.montant) || 0), 0);
    return m > 0 && (Math.abs(somme - m) < .02 || pres.some(d => Math.abs((lireNombre(d.montantApport) || 0) - m) < .02) || Math.abs((lireNombre(total) || 0) - m) < .02); };
  const garde = sansDoublons(ops.filter(o => !o.liste || !memeOp(o)));
  if (!garde.length) return { compte: "LINXEA", ops: lireLinxeaFiche(t, nature) };   // v20.30 : la fiche « Libellé : valeur » de l'appli/du site Linxea
  return { compte: "LINXEA", ops: garde };
}
/* v20.30 (Théo, 24/11) · Linxea en « fiche » (copiée depuis l'appli ou le site) : un support par bloc, une ligne « Libellé : valeur » par champ.
   Ex. « Amundi Physical Gold ETC C 100 % / Montant brut : 100,00 € / Frais (€) : - / Montant net : 100,00 € / Date de valeur : 13/08/2026 /
   Valeur de part : 150,00 € / Nombre de parts : 0,6667 ». Rien n'est inventé : un champ absent reste vide et est signalé. */
function lireLinxeaFiche(t, nature) {
  const L = t.split("\n").map(x => x.trim()), ops = [], isoFr = d => d ? d.slice(6, 10) + "-" + d.slice(3, 5) + "-" + d.slice(0, 2) : "";
  const debuts = L.map((l, i) => /^Montant\s+brut\b/i.test(l) ? i : -1).filter(i => i >= 0);
  const nat = nature(t) || "versement";
  debuts.forEach((d, n) => {
    let h = d - 1; while (h >= 0 && (!L[h] || /:\s*\S/.test(L[h]) && !/^[^:]*\d+\s*%\s*$/.test(L[h]))) h--;
    const tete = h >= 0 ? L[h] : "", fin = n + 1 < debuts.length ? (() => { let x = debuts[n + 1] - 1; while (x > d && !L[x]) x--; return x; })() : L.length;
    const bloc = L.slice(d, fin).join("\n");
    const val = lab => { const x = bloc.match(new RegExp("^\\s*" + lab + "[^:\\n]*:\\s*(?:" + NUM_AV + ")?", "im")); return x && x[1] ? chiffre(x[1]) : ""; };
    const dt = bloc.match(/^\s*Date[^:\n]*:\s*(\d{2}\/\d{2}\/\d{4})/im) || bloc.match(/(\d{2}\/\d{2}\/\d{4})/);
    const isin = (bloc + "\n" + tete).match(/\b([A-Z]{2}[A-Z0-9]{9}\d)\b/);
    const nom = tete.replace(/\s*\d+(?:[.,]\d+)?\s*%\s*$/, "").replace(/\b[A-Z]{2}[A-Z0-9]{9}\d\b/, "").replace(/\s+/g, " ").trim();
    const brut = val("Montant\\s+brut"), net = val("Montant\\s+net"), fraisLu = val("Frais");
    const frais = fraisLu || (lireNombre(brut) > 0 && lireNombre(net) > 0 && Math.abs(lireNombre(brut) - lireNombre(net)) >= .005 ? saisieNombre(lireNombre(brut) - lireNombre(net), 2) : "");
    const op = { src: "linxea", nom: nom, isin: isin ? isin[1] : "", date: dt ? isoFr(dt[1]) : "", qte: val("Nombre\\s+de\\s+parts?"), cours: val("Valeur\\s+(?:de\\s+(?:la\\s+)?)?parts?"), brut: brut, net: net };
    if (nat === "frais") { op.type = "Frais en parts"; op.montant = net || brut; ops.push(finirOp(op, ["date", "qte", "montant"])); }
    else if (nat === "rachat") { op.type = "Vente"; op.montant = brut || net; op.frais = frais; ops.push(finirOp(op, ["date", "qte", "cours", "montant"])); }
    else { op.type = "Achat"; op.montant = brut || net; op.frais = frais; op.apport = n === 0; op.versDoc = true; op.montantApport = "";
      if (n > 0) op.note = "Le versement est déjà enregistré avec le 1er support de ce document.";
      ops.push(finirOp(op, ["date", "qte", "cours", "montant"])); }
  });
  return ops;
}
function envsOuverts() { return (refData().enveloppes || []).filter(e => typeof e !== "string" && (!e.statut || e.statut === "Ouvert" || e.statut === "À ouvrir")); }
/** le compte de l'avis (PEA, PEA-PME, CTO) → l'enveloppe de l'appli ; sûr seulement s'il n'y en a qu'une */
function envDeAvis(compte) {
  const tous = envsOuverts(), l = tous.filter(e => e.perimetre === "Portefeuille"), txt = e => (e.regime || "") + " " + (e.nom || "");
  if (compte === "QUINTESSA") { const q = tous.filter(e => /quintessa/i.test(e.nom || "")); return q.length ? { nom: q[0].nom, sur: q.length === 1 } : { nom: "", sur: false }; }
  if (compte === "LINXEA") { const lx = tous.filter(e => /linxea/i.test(e.nom || "")), av = tous.filter(e => e.regime === "AV");
    return lx.length ? { nom: lx[0].nom, sur: lx.length === 1 } : { nom: av.length === 1 ? av[0].nom : "", sur: false }; }
  const ok = compte === "PEA-PME" ? l.filter(e => /PME/i.test(txt(e))) : compte === "PEA" ? l.filter(e => /PEA/i.test(txt(e)) && !/PME/i.test(txt(e))) : compte === "CTO" ? l.filter(e => /CTO|titres|ordinaire/i.test(txt(e))) : [];
  return ok.length ? { nom: ok[0].nom, sur: ok.length === 1 } : { nom: "", sur: false };
}
function memoIsin() { try { return JSON.parse(stock.get(cleStock("isin")) || "{}") || {}; } catch (e) { return {}; } }
/** la clé retenue sur l'appareil pour retrouver l'actif choisi : l'ISIN, sinon (Quintessa, sans ISIN) le nom du support */
function cleOp(op) { return op.isin || (op.src === "quintessa" && op.nom ? "nom:" + motsActif(op.nom).join(" ") : ""); }
function retenirIsin(isin, code) { if (!isin || !code) return; const m = memoIsin(); if (m[isin] === code) return; m[isin] = code; stock.set(cleStock("isin"), JSON.stringify(m)); }
const MOTS_VIDES = new Set("TRACKER UCITS ETF UC ACC DIST D C EUR SICAV FCP THE DE DU LA LE LES P AMUN AMD AMUNDI LYXOR ISHARES BNP PARIBAS EASY ACTION ACTIONS INDEX".split(" "));
function motsActif(t) {
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/S&P/g, "SP").replace(/[^A-Z0-9]+/g, " ").trim().split(" ")
    .map(w => w === "NASD" ? "NASDAQ" : w === "MONDE" ? "WORLD" : w).filter(w => w && !MOTS_VIDES.has(w));
}
const MOTS_FAIBLES = new Set(["PEA", "MSCI", "SWAP", "PHYSICAL", "ETC", "SP"]);
function levierNom(t) { return /\b3X\b|X3\b|\b3 ?X/i.test(t) ? 3 : /\b2X\b|X2\b|LEV|DAILY ?\(?2/i.test(t) ? 2 : 1; }
/** l'actif de l'appli pour une ligne de l'avis : { code, sur, raison } ; sûr par l'ISIN (déjà choisi ici, ou ETF connu), sinon proposé d'après le nom */
function actifDeAvis(op) {
  const actifs = refData().actifs || [], existe = c => actifs.some(a => a.code === c);
  if (!op.isin && op.src === "linxea") return { code: "", sur: false, raison: "" };   // ligne de liste Linxea : pas de support
  const sien = op.isin && actifs.find(a => String(a.isin || "").toUpperCase() === op.isin); if (sien) return { code: sien.code, sur: true, raison: "isin" };   // v20.54 : SON fichier d'abord (comme codeDeIsin)
  const memo = memoIsin()[cleOp(op)]; if (memo && existe(memo)) return { code: memo, sur: true, raison: "isin" };   // v20.54 : l'ISIN noté dans SON fichier (Mes actifs)
  const connu = ISIN_CONNUS[op.isin]; if (connu && existe(connu[0])) return { code: connu[0], sur: true, raison: "isin" };
  const mo = motsActif(op.nom), lev = levierNom(op.nom);
  const notes = actifs.map(a => {
    const ma = motsActif(a.code + " " + (a.nom || "")), la = +a.levier || (levierNom(a.nom || "") > 1 ? levierNom(a.nom) : 0);
    let s = mo.filter(w => w.length >= 2 && !/^\d?X$|^LEV$/.test(w) && ma.some(v => v === w || (w.length >= 4 && v.length >= 4 && (v.startsWith(w) || w.startsWith(v)))))
      .reduce((t, w) => t + (MOTS_FAIBLES.has(w) ? .5 : 1), 0);   // « PEA », « MSCI » : peu distinctifs
    if (mo.includes(String(a.code).toUpperCase())) s += 3;
    if (s >= 1 && la) s += la === lev ? 1 : -3;   // levier différent : presque sûrement pas la bonne ligne
    return { code: a.code, s: s };
  }).sort((a, b) => b.s - a.s);
  if (notes[0] && notes[0].s >= 2 && (!notes[1] || notes[0].s > notes[1].s)) return { code: notes[0].code, sur: false, raison: "nom" };
  return { code: "", sur: false, raison: "" };
}
/** une opération de l'avis → le formulaire habituel (aucun calcul, aucune valeur inventée) */
function formulaireImport(i) {
  const op = IMP.ops[i], ch = op.choix || (op.choix = {});
  const envA = ch.env ? { nom: ch.env, sur: true } : envDeAvis(IMP.compte), env = envA.nom || F.env || envParDefaut();
  const act = ch.actif !== undefined ? { code: ch.actif, sur: true } : actifDeAvis(op);
  /* Théo (20/11) : l'avis ne dit pas d'où vient l'argent ; une vente ET un achat le même jour (bascule) = l'achat est payé par la vente */
  const bascule = op.src === "fortuneo" && op.type === "Achat" && IMP.ops.some(o => o !== op && o.type === "Vente" && o.date && o.date === op.date);
  const p = { type: op.type || (F && AVEC_QTE.includes(F.type) ? F.type : "Achat"), env: env, envChoisi: true, actif: act.code, date: op.date, dateChoisie: !!op.date,
    qte: op.qte, qteTape: !!op.qte, prix: op.cours, prixTape: !!op.cours, prixVu: true, pilote: op.qte ? "qte" : "prix", montant: op.montant || "", frais: op.frais || "", auto: false,
    imp: { i: i, isin: op.isin, nom: op.nom, envSur: envA.sur, actifSur: act.sur, propose: act.sur ? "" : act.code, confirme: act.sur, bascule: bascule, versDoc: !!op.versDoc, src: op.src } };
  if (op.type === "Achat" && op.apport !== undefined) { p.apport = op.apport; p.montantApport = op.montantApport || ""; }   // Linxea : le versement est dans le document
  else if (op.type === "Achat" && bascule) p.apport = false;
  const f = formulaire(p);
  if (!op.date) { f.date = ""; f.dateChoisie = false; }
  if (!act.code && op.isin && AVEC_ACTIF.includes(f.type)) {
    const connu = ISIN_CONNUS[op.isin] || [];
    f.na = Object.assign(nouvelNA(env), { code: connu[0] || "", nom: op.nom, ticker: connu[1] || "", isin: op.isin, levier: String(levierNom(op.nom)) });
  }
  return f;
}
function choisirOpImport(i) { IMP.i = i; F = formulaireImport(i); detailsOuverts = !!F.montantApport; etape = importPret() ? 4 : 2; rendreFormulaire(); const z = $f("m-pane-ordre"); if (z) z.scrollTop = 0; }
function importerTexte(txt, source) {
  const r = lireAvis(txt);
  if (!r.ops.length) { IMP.msg = source === "pdf" ? "Aucune opération trouvée dans ce PDF. Est-ce bien un avis d'opéré ? Tu peux aussi coller son texte." : "Aucune opération trouvée dans ce texte : colle tout l'avis d'opéré (de « Désignation » à « Montant NET »)."; rendreFormulaire(); return; }
  Object.assign(IMP, { compte: r.compte, ops: r.ops, panneau: false, coller: false, texte: "", msg: "", lecture: false });
  choisirOpImport(0);
}
function libOpImport(op) {
  const discret = ETAT.discret === "oui", code = op.choix && op.choix.actif || actifDeAvis(op).code;
  const nom = code || (op.nom.length > 22 ? op.nom.slice(0, 21) + "…" : op.nom) || op.isin || "titre ?";
  return (op.type ? libType(op.type) : "Opération ?") + (op.qte ? " " + op.qte : "") + " " + nom + (op.date ? " · " + dateCourteIso(op.date) : "") + (!discret && lireNombre(op.montant) > 0 ? " · " + nf(2, 2).format(lireNombre(op.montant)) + NB + "€" : "");
}
function htmlImport(bourse) {
  const avis = "";   // v17.78 (lot60) : la ligne « avis sous les yeux » (v17.27) est devenue l'aide de l'étape « Les chiffres »
  if (!M || M.simple || !envsOuverts().length || (!IMP && !["Achat", "Vente", "Frais en parts", "Relevé"].includes(F.type))) return avis;
  if (!IMP) return '<div class="m-imp m-imp-petit"><button class="m-imp-p" type="button" id="f-imp">📄 Importer un avis</button></div>';   // v17.78 (lot60, Théo) : en petit
  if (IMP.cmp) return htmlComparer();
  if (!IMP.ops) return '<div class="m-imp ouvert"><b class="m-imp-t">📄 Importer mon avis d\'opéré</b>' +
    '<p class="aide">Lu dans ton téléphone : le fichier n\'est envoyé nulle part. Tu relis tout avant d\'enregistrer.</p>' +
    '<p class="aide">Pas de PDF (versement programmé, frais Linxea, page Quintessa…) ? <b>Copie les valeurs</b> depuis le site (appui long sur le tableau › Tout sélectionner › Copier), ou fais une <b>capture d\'écran</b> et utilise <b>Google Lens › Copier le texte</b>, puis « Coller le texte » ici.</p>' +   // v17.77 (Théo)
    '<div class="m-imp-a"><label class="btn" for="f-imp-pdf"' + (IMP.lecture ? ' aria-disabled="true"' : "") + '>' + (IMP.lecture ? "Lecture…" : "Choisir le PDF") + '</label><input id="f-imp-pdf" type="file" accept="application/pdf" hidden>' +
      '<button class="btn ghost" type="button" id="f-imp-coller" aria-expanded="' + !!IMP.coller + '">Coller le texte</button></div>' +
    (IMP.coller ? '<textarea id="f-imp-txt" rows="5" aria-label="Texte de l\'avis d\'opéré" placeholder="Ouvre l\'avis, « Tout sélectionner », « Copier », puis colle ici.">' + esc(IMP.texte || "") + '</textarea><button class="btn" type="button" id="f-imp-lire">Lire ce texte</button>' : "") +
    (IMP.msg ? '<p class="m-imp-msg" role="alert">' + esc(IMP.msg) + "</p>" : "") +
    '<button class="btn ghost m-cmp-b" type="button" id="f-cmp">📋 Comparer avec mon relevé</button>' +
    '<button class="lien" type="button" id="f-imp-fin">Annuler</button></div>';
  const op = IMP.ops[IMP.i] || {}, im = F.imp && F.imp.i === IMP.i ? F.imp : null, n = IMP.ops.length;
  const notes = [];
  if (op.manque && op.manque.length) notes.push('<p class="m-imp-n warn">⚠ Pas trouvé dans ' + (IMP.compte === "LINXEA" ? "le document" : "l\'avis") + ' : <b>' + esc(op.manque.join(", ")) + "</b>. Laissé vide : recopie-le.</p>");
  if (op.note) notes.push('<p class="m-imp-n">ℹ️ ' + esc(op.note) + "</p>");
  if (op.ecart) notes.push('<p class="m-imp-n warn">⚠ Sur le document, quantité × cours ± frais ne donne pas le montant : vérifie ces chiffres.</p>');
  if (im && !im.envSur) notes.push('<p class="m-imp-n">Compte de l\'avis : <b>' + esc(IMP.compte || "non trouvé") + "</b>. Choisis le bon compte ci-dessous.</p>");
  if (im && im.propose && !im.confirme && F.actif === im.propose) notes.push('<p class="m-imp-n warn">Actif proposé d\'après le nom « ' + esc(op.nom) + ' » : <b>' + esc(im.propose) + '</b>. <button class="mini-btn" type="button" id="f-imp-ok">✓ C\'est le bon</button> ou choisis-en un autre.</p>');
  if (F.na && F.na.isin) notes.push('<p class="m-imp-n">« ' + esc(op.nom) + ' » n\'est pas encore dans ton fichier : crée-le ci-dessous (nom et ISIN repris de l\'avis).</p>');
  return '<div class="m-imp ouvert"><b class="m-imp-t">📄 ' + (n > 1 ? n + " opérations trouvées" : "1 opération trouvée") + (n > 1 ? " · saisies une par une" : "") + "</b>" +
    (n > 1 ? '<ol class="m-imp-l">' + IMP.ops.map((o, k) => '<li><button type="button" class="m-imp-o' + (o.fait ? " fait" : "") + '" data-imp-op="' + k + '" aria-current="' + (k === IMP.i) + '"' + (o.fait ? " disabled" : "") + ">" +
      (o.fait ? "✓ " : k + 1 + ". ") + esc(libOpImport(o)) + (o.ecart || (o.manque && o.manque.length) ? " ⚠" : "") + "</button></li>").join("") + "</ol>" : '<p class="m-imp-n">' + esc(libOpImport(op)) + "</p>") +
    (op.isin ? '<p class="m-imp-n petit">' + esc(op.nom || "") + " · " + esc(op.isin) + (op.heure ? " · " + esc(op.heure) : "") + "</p>" : "") +
    notes.join("") + '<p class="m-imp-n petit">Relis les champs ci-dessous, puis enregistre' + (n > 1 ? " : l'opération suivante se pré-remplit ensuite." : ".") + ' <button class="lien" type="button" id="f-imp-fin">Fermer l\'import</button></p></div>';
}
function brancherImport() {
  const z = $f("m-pane-ordre"); if (!z) return;
  if ($f("f-imp")) $f("f-imp").addEventListener("click", () => { IMP = { panneau: true }; if (etape === 1) F = formulaire(null); rendreFormulaire(); });
  z.querySelectorAll("#f-imp-fin").forEach(b => b.addEventListener("click", () => { IMP = null; if (F.imp) { F.imp = null; F.na = null; } rendreFormulaire(); }));
  if ($f("f-imp-coller")) $f("f-imp-coller").addEventListener("click", () => { IMP.coller = !IMP.coller; IMP.msg = ""; rendreFormulaire(); setTimeout(() => { const t = $f("f-imp-txt"); if (t) t.focus(); }, 30); });
  if ($f("f-imp-txt")) $f("f-imp-txt").addEventListener("input", e => { IMP.texte = e.target.value; });
  if ($f("f-imp-lire")) $f("f-imp-lire").addEventListener("click", () => importerTexte(IMP.texte, "texte"));
  if ($f("f-imp-pdf")) $f("f-imp-pdf").addEventListener("change", async e => {
    const fi = e.target.files && e.target.files[0]; if (!fi || IMP.lecture) return;
    if (fi.size > 8e6) { IMP.msg = "Ce fichier est trop gros pour un avis d'opéré (plus de 8 Mo)."; rendreFormulaire(); return; }
    IMP.lecture = true; IMP.msg = ""; rendreFormulaire();
    let txt = "";
    try { txt = await textePdf(fi); }
    catch (err) { IMP.lecture = false; IMP.coller = true;
      IMP.msg = err && err.message === "pdfjs" ? "Le lecteur de PDF n'a pas pu se charger (hors connexion ?). Colle plutôt le texte de l'avis ci-dessous." : "Ce PDF n'a pas pu être lu. Colle plutôt le texte de l'avis ci-dessous.";
      rendreFormulaire(); return; }
    IMP.lecture = false; importerTexte(txt, "pdf");
  });
  z.querySelectorAll("[data-imp-op]").forEach(b => b.addEventListener("click", () => choisirOpImport(+b.dataset.impOp)));
  brancherComparer(z);
  if ($f("f-imp-ok")) $f("f-imp-ok").addEventListener("click", () => { F.imp.confirme = true; const op = IMP.ops[F.imp.i]; op.choix.actif = F.actif; retenirIsin(cleOp(op), F.actif); if (importPret()) etape = 4; rendreFormulaire(); });
}
/* ---- v20.54 (Théo, 25/11) · « 📋 Comparer avec mon relevé » : l'évaluation de portefeuille Fortuneo (PDF ou texte collé), lue DANS le téléphone,
   comparée ligne par ligne (par ISIN) à ce que dit l'appli : quantité (à 0,0001 près), PRU (au centime) et versé du compte.
   ✓ / ⚠ avec l'écart, et « Corriger » ouvre la bonne saisie, pré-remplie, que l'utilisateur relit. Rien n'est modifié seul, rien n'est gardé, rien n'est envoyé. ---- */
/** l'évaluation (texte) : { compte, date (aaaa-mm-jj), versements, total, lignes: [{ isin, nom, qte, cours, valo, pru }] } */
function lireEvaluation(brut) {
  const t = String(brut || "").replace(/[    ]/g, " ").replace(/\r/g, ""), L = t.split("\n"), lignes = [];
  const NB = /^-?\d{1,3}(?: \d{3})*(?:,\d+)?$/;
  L.forEach((l, n) => {
    const m = l.match(/(?:^|\s)([A-Z]{2}[A-Z0-9]{9}\d)\s+(.+?)\s+(\d{2})\/(\d{2})\/(\d{2,4})\s+(.+?)\s*$/); if (!m) return;
    const av = m[2].trim().split(/\s+/), ap = m[6].trim().split(/\s+/);
    // après la date : valorisation, poids (%), PRU, plus-value ; la valorisation peut contenir des espaces (« 12 345,67 ») : elle est rebâtie depuis la fin
    const pv = ap.pop(), pru = ap.pop(), poids = ap.pop(), valo = lireNombre(ap.join(" "));
    // avant la date : quantité et cours, chacun peut contenir des espaces ; on garde la coupure qui donne quantité × cours ≈ valorisation
    let best = null;
    for (let k = 1; k < av.length; k++) { const q = lireNombre(av.slice(0, k).join(" ")), c = lireNombre(av.slice(k).join(" "));
      if (!(q > 0 && c > 0) || !NB.test(av.slice(0, k).join(" ")) || !NB.test(av.slice(k).join(" "))) continue;
      const e = isFinite(valo) && valo > 0 ? Math.abs(q * c - valo) / valo : k === av.length - 1 ? 0 : 1; if (!best || e < best.e) best = { e, q, c }; }
    if (!best || !(lireNombre(pru) > 0)) return;
    let nom = ""; for (let j = n - 1; j >= Math.max(0, n - 3) && !nom; j--) { const x = (L[j] || "").trim(); if (x && !/[A-Z]{2}[A-Z0-9]{9}\d|\d{2}\/\d{2}\/\d{2}|Valeur|Code|cours|Autres|^¾/i.test(x)) nom = x; }
    const an = m[5].length === 2 ? "20" + m[5] : m[5];
    lignes.push({ isin: m[1], nom: nom, qte: best.q, cours: best.c, valo: valo, pru: lireNombre(pru), date: an + "-" + m[4] + "-" + m[3], douteux: best.e > .02 });
  });
  const vers = t.match(/Cumul de vos versements[^\d\n]*(\d{1,3}(?: \d{3})*,\d{2})/i), tot = t.match(/Total portefeuille au[^\d\n]*\d{1,2}\s+\S+\s+\d{4}\s+(\d{1,3}(?: \d{3})*,\d{2})/i);
  // v20.54 : le compte seulement d'après « COMPTE PEA / COMPTE TITRES… » (jamais le mot « PEA » du nom d'un ETF)
  const mc = t.match(/COMPTE\s+(PEA[\s-]*PME|PEA|TITRES|ORDINAIRE|CTO)\b/i), compte = !mc ? "" : /PME/i.test(mc[1]) ? "PEA-PME" : /PEA/i.test(mc[1]) ? "PEA" : "CTO";
  return { compte: compte, date: lignes.length ? lignes[0].date : "", versements: vers ? lireNombre(vers[1]) : null, total: tot ? lireNombre(tot[1]) : null, lignes: lignes };
}
/** le code de l'actif de l'appli pour un ISIN (son fichier d'abord, puis ce que l'appareil a retenu, puis les ETF connus) */
function codeDeIsin(isin) {
  const actifs = refData().actifs || [], a = actifs.find(x => String(x.isin || "").toUpperCase() === isin); if (a) return a.code;
  const m = memoIsin()[isin]; if (m && actifs.some(x => x.code === m)) return m;
  const c = ISIN_CONNUS[isin]; return c && actifs.some(x => x.code === c[0]) ? c[0] : "";
}
/** comparaison (aucun envoi) : [{ isin, nom, code, quoi, ok, ecart, texte, corriger }] + le versé */
function comparerEvaluation(ev, envNom) {
  const r = refData(), jr = (r.journal || []).filter(o => o.enveloppe === envNom && !o.envoi), apres = o => ev.date && String(o.date).slice(0, 10) > ev.date;
  const out = [];
  ev.lignes.forEach(l => {
    const code = codeDeIsin(l.isin), d = code ? (r.detenu || []).find(x => x.env === envNom && x.code === code) : null;
    if (!code) { out.push({ l, quoi: "actif", ok: false, texte: "Support inconnu de l'appli (" + l.isin + ")", corriger: null }); return; }
    const plusTard = jr.filter(o => o.actif === code && apres(o) && typeInfo(o.type).quantite);
    const ajust = plusTard.reduce((a, o) => a + typeInfo(o.type).quantite * (+o.quantite || 0), 0);
    const qApp = (d ? d.qte : 0) - ajust, eq = l.qte - qApp;
    out.push({ l, code, quoi: "qte", ok: Math.abs(eq) <= 1e-4, ecart: eq, texte: "Quantité : relevé " + qteBrute(l.qte) + ", appli " + qteBrute(+qApp.toFixed(6)) + (plusTard.length ? " (ordres après le " + frDate(ev.date) + " retirés)" : ""),
      corriger: Math.abs(eq) > 1e-4 ? { type: eq > 0 ? "Achat" : "Vente", env: envNom, actif: code, qte: saisieNombre(Math.abs(eq), 6), date: ev.date } : null });
    if (plusTard.length) out.push({ l, code, quoi: "pru", ok: true, sans: true, texte: "PRU : pas comparé (ordre passé après le relevé)" });
    else if (d && typeof d.pru === "number") { const ep = l.pru - d.pru;
      out.push({ l, code, quoi: "pru", ok: Math.abs(ep) < .01, ecart: ep, texte: "PRU : relevé " + nf(2, 4).format(l.pru) + " €, appli " + nf(2, 4).format(d.pru) + " €", corriger: Math.abs(ep) >= .01 ? { journal: true } : null }); }
  });
  /* lignes de l'appli absentes du relevé */
  const vus = new Set(out.map(x => x.code).filter(Boolean));
  (r.detenu || []).filter(x => x.env === envNom && x.qte > 1e-6 && !vus.has(x.code) && !(r.actifs || []).some(a => a.code === x.code && /esp[eè]ces/i.test(a.nom || ""))).forEach(x =>
    out.push({ l: { isin: "", nom: x.code }, code: x.code, quoi: "qte", ok: false, ecart: -x.qte, texte: "Dans l'appli (" + qteBrute(x.qte) + ") mais pas sur le relevé", corriger: { type: "Vente", env: envNom, actif: x.code, qte: saisieNombre(x.qte, 6), date: ev.date } }));
  /* versé du compte (cumul des versements) */
  if (ev.versements !== null) {
    // versé de l'appli = « Apports nets » du compte (Patrimoine › Mes enveloppes), moins les versements passés après la date du relevé
    const fis = ((M && M.fiscalite) || []).find(x => x.nom === envNom), sens = o => (typeInfo(o.type).tresorerie || 1) * (+o.montant || 0);
    const tot = fis && typeof fis.apports === "number" ? fis.apports - jr.filter(o => typeInfo(o.type).flux && apres(o)).reduce((a, o) => a + sens(o), 0) : null;
    if (tot === null) { out.push({ l: { isin: "", nom: "Versé sur " + envNom }, quoi: "verse", ok: true, sans: true, texte: "Versé : pas comparé (ton fichier ne donne pas les apports de ce compte)" }); return out; }
    const ev2 = ev.versements - tot;
    out.push({ l: { isin: "", nom: "Versé sur " + envNom }, quoi: "verse", ok: Math.abs(ev2) < .01, ecart: ev2, texte: "Versé : relevé " + nf(2, 2).format(ev.versements) + " €, appli " + nf(2, 2).format(tot) + " €",
      corriger: Math.abs(ev2) >= .01 ? { type: ev2 > 0 ? "Apport" : "Retrait", env: envNom, montant: saisieNombre(Math.abs(ev2), 2), date: ev.date } : null });
  }
  return out;
}
function htmlComparer() {
  const C = IMP.cmp, discret = ETAT.discret === "oui";
  let h = '<div class="m-imp ouvert m-cmp"><b class="m-imp-t">📋 Comparer avec mon relevé</b>' +
    '<p class="aide">Ton « évaluation de portefeuille » Fortuneo (PDF ou texte copié) est lue dans ton téléphone : rien n\'est envoyé, rien n\'est gardé, rien n\'est modifié tout seul.</p>';
  if (C.choisir) h += '<label class="sel"><span>Compte du relevé</span><select id="f-cmp-env"><option value="">Choisis…</option>' +
    envsOuverts().filter(e => e.perimetre === "Portefeuille").map(e => '<option value="' + esc(e.nom) + '">' + esc(e.nom) + "</option>").join("") + "</select></label>";
  else if (!C.res) h += '<div class="m-imp-a"><label class="btn" for="f-cmp-pdf">' + (C.lecture ? "Lecture…" : "Choisir le PDF") + '</label><input id="f-cmp-pdf" type="file" accept="application/pdf" hidden>' +
    '<button class="btn ghost" type="button" id="f-cmp-coller" aria-expanded="' + !!C.coller + '">Coller le texte</button></div>' +
    (C.coller ? '<textarea id="f-cmp-txt" rows="5" aria-label="Texte de l\'évaluation" placeholder="Ouvre l\'évaluation, « Tout sélectionner », « Copier », puis colle ici.">' + esc(C.texte || "") + '</textarea><button class="btn" type="button" id="f-cmp-lire">Comparer</button>' : "");
  else {
    const nOk = C.res.filter(x => x.ok).length;
    h += '<p class="m-imp-n"><b>' + esc(C.env) + "</b> au " + esc(frDate(C.ev.date)) + " · " + nOk + " ✓ sur " + C.res.length + "</p>" +
      '<ul class="m-cmp-l">' + C.res.map((x, i) => '<li class="' + (x.ok ? "ok" : "ko") + '"><span>' + (x.ok ? "✓" : "⚠") + " <b>" + esc(x.code || x.l.nom || x.l.isin) + "</b> · " + esc(discret && x.quoi !== "qte" ? x.texte.replace(/[\d\s ,.]+ €/g, "••• €") : x.texte) + "</span>" +
        (x.corriger ? '<button class="mini-btn" type="button" data-cmp-corr="' + i + '">Corriger</button>' : "") + "</li>").join("") + "</ul>" +
      '<button class="lien" type="button" id="f-cmp-autre">Comparer un autre relevé</button>';
  }
  return h + (C.msg ? '<p class="m-imp-msg" role="alert">' + esc(C.msg) + "</p>" : "") + '<button class="lien" type="button" id="f-imp-fin">Fermer</button></div>';
}
function lancerComparaison(txt) {
  const C = IMP.cmp, ev = lireEvaluation(txt);
  if (!ev.lignes.length) { C.msg = "Aucune ligne trouvée : est-ce bien ton « évaluation de portefeuille » Fortuneo ? Tu peux aussi coller son texte."; C.coller = true; rendreFormulaire(); return; }
  const ea = ev.compte ? envDeAvis(ev.compte) : { nom: "", sur: false };
  if (!ea.nom || !ea.sur) { Object.assign(C, { ev: ev, env: "", res: null, choisir: true, texte: "", msg: "Compte introuvable" + (ev.compte ? " (" + ev.compte + ")" : "") + " : choisis-le." }); rendreFormulaire(); return; }   // v20.54 : jamais un compte pris au hasard
  Object.assign(C, { ev: ev, env: ea.nom, res: comparerEvaluation(ev, ea.nom), choisir: false, texte: "", msg: "" });   // le texte du relevé n'est pas gardé
  rendreFormulaire();
}
function brancherComparer(z) {
  if ($f("f-cmp")) $f("f-cmp").addEventListener("click", () => { IMP.cmp = {}; rendreFormulaire(); });
  if (!IMP || !IMP.cmp) return;
  const C = IMP.cmp;
  if ($f("f-cmp-coller")) $f("f-cmp-coller").addEventListener("click", () => { C.coller = !C.coller; C.msg = ""; rendreFormulaire(); });
  if ($f("f-cmp-txt")) $f("f-cmp-txt").addEventListener("input", e => { C.texte = e.target.value; });
  if ($f("f-cmp-lire")) $f("f-cmp-lire").addEventListener("click", () => lancerComparaison(C.texte));
  if ($f("f-cmp-env")) $f("f-cmp-env").addEventListener("change", e => { const v = e.target.value; if (!v || !C.ev) return; Object.assign(C, { env: v, res: comparerEvaluation(C.ev, v), choisir: false, msg: "" }); rendreFormulaire(); });
  if ($f("f-cmp-autre")) $f("f-cmp-autre").addEventListener("click", () => { IMP.cmp = {}; rendreFormulaire(); });
  if ($f("f-cmp-pdf")) $f("f-cmp-pdf").addEventListener("change", async e => {
    const fi = e.target.files && e.target.files[0]; if (!fi || C.lecture) return;
    if (fi.size > 8e6) { C.msg = "Ce fichier est trop gros pour un relevé (plus de 8 Mo)."; rendreFormulaire(); return; }
    C.lecture = true; rendreFormulaire(); let txt = "";
    try { txt = await textePdf(fi); } catch (err) { C.lecture = false; C.coller = true; C.msg = "Ce PDF n'a pas pu être lu. Colle plutôt le texte du relevé."; rendreFormulaire(); return; }
    C.lecture = false; lancerComparaison(txt);
  });
  z.querySelectorAll("[data-cmp-corr]").forEach(b => b.addEventListener("click", () => {
    const x = C.res[+b.dataset.cmpCorr], c = x && x.corriger; if (!c) return;
    if (c.journal) { IMP = null; paneSaisie("journal"); return; }   // PRU différent : c'est un ordre passé à corriger (Historique)
    IMP = null;
    F = formulaire({ type: c.type, env: c.env, envChoisi: true, actif: c.actif || "", date: c.date, dateChoisie: !!c.date, qte: c.qte || "", qteTape: !!c.qte, montant: c.montant || "", auto: false });
    detailsOuverts = true; etape = 2; rendreFormulaire();
  }));
}
function especesEnv(env) { const g = ((M && M.groupes) || []).find(x => x.env === env), le = g && (g.lignes || []).find(l => l.especes); return le && typeof le.valeur === "number" ? le.valeur : null; }
/** bascule vente + achat du même avis : la vente, déjà enregistrée, crédite les espèces tant que le fichier n'a pas été relu (sinon elle y est déjà) */
function creditImport(env, valeur) {
  if (!F || !F.imp || !IMP || !IMP.ops) return 0;
  return IMP.ops.reduce((a, o) => a + (o.fait && o.type === "Vente" && o.envEnvoi === env && o.especesAvant === valeur ? lireNombre(o.montant) || 0 : 0), 0);
}
/** après l'envoi réussi d'une opération importée : la suivante se pré-remplit (toujours à relire et valider) */
function suiteImport(S) {
  if (!S || !S.imp || !IMP || !IMP.ops) return;
  const op = IMP.ops[S.imp.i]; if (op) { op.fait = true; if (S.actif) retenirIsin(cleOp(op), S.actif); op.especesAvant = especesEnv(S.env); op.envEnvoi = S.env; }
  const k = IMP.ops.findIndex(o => !o.fait);
  if (k < 0) { IMP = null; return; }
  setTimeout(() => {
    if (!IMP || !M) return;
    IMP.i = k; F = formulaireImport(k); nommerRaccourci = false; detailsOuverts = !!F.montantApport; plusTypes = false; menuOuvert = false; etape = importPret() ? 4 : 2;
    $f("m-saisie").hidden = false; paneSaisie("ordre");
    toast("Opération " + (k + 1) + "/" + IMP.ops.length + " pré-remplie : relis puis enregistre.");
  }, 700);
}
/** le texte sous la case du versement, pour une opération importée (Théo, 20/11 : jamais de versement déduit d'autre chose) */
function gardeImport() {
  const im = F.imp;
  /* v17.78 (lot60) : textes de l'étape « Versement » (Oui / Non) */
  if (im.versDoc) return F.apport ? "Versement repris du document : vérifie son montant." : "Le versement est déjà enregistré avec le 1er support de ce document.";
  if (im.bascule && !F.apport) return "La vente du même avis paie cet achat : aucun versement ajouté. Choisis « Oui » si tu as aussi viré de l'argent.";
  return "L'avis ne dit pas d'où vient l'argent : vérifie le versement.";
}
function rendreFormulaire() {
  majAides();
  const r = refData();
  const ouvertes = r.enveloppes.filter(e => !e.statut || e.statut === "Ouvert" || e.statut === "À ouvrir");   // 14.5 : « À ouvrir » s'ouvre au 1er ordre
  if (!ouvertes.find(e => e.nom === F.env) && ouvertes.length) F.env = ouvertes[0].nom;
  const groupeEnv = (liste, lab) => liste.length ? '<optgroup label="' + lab + '">' + liste.map(e => '<option value="' + esc(e.nom) + '"' + (e.nom === F.env ? " selected" : "") + ">" + esc(e.nom) + (e.statut === "À ouvrir" ? " · à ouvrir" : "") + "</option>").join("") + "</optgroup>" : "";
  const courants = typesCourants(), autreType = !courants.includes(F.type), panneau = plusTypes || autreType;
  const autres = r.types.map(t => t.nom).filter(n => !courants.includes(n)).sort((a, b) => (ORDRE_AUTRES.indexOf(a) + 1 || 99) - (ORDRE_AUTRES.indexOf(b) + 1 || 99));
  const tenus = r.detenu.filter(d => d.env === F.env && d.qte > 1e-9).map(d => d.code);
  const nomA = c => (r.actifs.find(a => a.code === c) || {}).nom || "";
  const optA = c => '<option value="' + esc(c) + '"' + (c === F.actif ? " selected" : "") + ">" + esc(c) + (nomA(c) ? " · " + esc(nomA(c)) : "") + "</option>";
  const autresActifs = r.actifs.map(a => a.code).filter(c => !tenus.includes(c));
  if (AVEC_ACTIF.includes(F.type) && !F.actif && F.type !== "Achat" && tenus.length && !F.imp) { F.actif = tenus[0]; F = formulaire(Object.assign({}, F, { auto: false })); synchroniser(); }
  const avecActif = AVEC_ACTIF.includes(F.type), avecQte = AVEC_QTE.includes(F.type), avecFrais = AVEC_FRAIS.includes(F.type), bourse = F.type === "Achat" || F.type === "Vente";
  const chipT = t => '<button type="button" class="chip" data-type="' + esc(t) + '" aria-pressed="' + (F.type === t) + '">' + esc(libType(t)) + "</button>";
  const courantsAutres = autres.filter(t => (AUTRES_TYPES[t] || { g: "Courant" }).g === "Courant"), raresAutres = autres.filter(t => !courantsAutres.includes(t));
  const hab = F.type === "Apport" && ETAT.discret === "oui" && !String(F.montant || "").trim() ? montantHabituel(F.env) : 0;
  const A = aidesCalcul(), auj = aujourdhuiISO(), hier = isoDecale(auj, -1), prop = dateProposee();
  const libDate = F.type === "Relevé" ? "Date du relevé" : F.type === "Solde initial" ? "Début du suivi" : bourse ? "Date d'exécution" : "Date";
  /* v17.34 · la date est visible pour TOUS les types (plus de repli) : Aujourd'hui · Hier · Autre date */
  const puce = (d, lib, id) => '<button type="button" class="chip" id="' + id + '" data-date="' + d + '" aria-pressed="' + (F.date === d && (F.dateChoisie || !DATE_OBLIG.includes(F.type))) + '">' + lib + "</button>";
  const blocDate = '<div class="champ m-date"><label for="f-date">' + libDate + (DATE_OBLIG.includes(F.type) ? " · obligatoire" : "") + "</label><div class=\"m-date-l\">" +
    (DATE_OBLIG.includes(F.type) ? (prop ? puce(prop, "Le " + dateCourteIso(prop) + " ?", "f-date-prop") : "") : puce(auj, "Aujourd'hui", "f-date-auj") + puce(hier, "Hier", "f-date-hier")) +
    '<input id="f-date" type="date" aria-label="Autre date" value="' + esc(F.date) + '"></div>' +
    (F.type === "Relevé" && prop && !F.date ? '<span class="aide">Proposé : ton relevé précédent + 1 mois. Touche-le pour confirmer, ou choisis la date de ton relevé.</span>' : "") + '<span class="m-err" id="f-date-err" role="alert" hidden></span></div>';
  /* v17.73 (lot57, Conseil) · achat / vente : les champs dans l'ordre d'un avis d'opéré (quantité, cours, courtage, montant net), deux par ligne ;
     touche « Suivant » du clavier (enterkeyhint) ; erreur d'un champ écrite sous ce champ (span .m-err) */
  const nb = (id, val, ph, cls, kh) => '<input id="' + id + '" type="text" inputmode="decimal" enterkeyhint="' + (kh || "next") + '" autocomplete="off" value="' + esc(val) + '" placeholder="' + esc(ph) + '"' + (cls ? ' class="' + cls + '"' : "") + ' aria-describedby="' + id + '-err">';
  const err = id => '<span class="m-err" id="' + id + '-err" role="alert" hidden></span>';
  const champQte = avecQte ? '<div class="champ"><label for="f-qte">' + (bourse ? "Quantité" : "Nombre de parts") + "</label>" + nb("f-qte", F.qte, "0") +
    '<span class="calc" id="f-qte-calc"' + (A.qte ? "" : " hidden") + ">" + esc(A.qte) + "</span>" + err("f-qte") + "</div>" : "";
  const libM = bourse ? (F.type === "Achat" ? "Net débité" : "Net crédité") : LIB_MONTANT[F.type] || "Montant";
  const champMontant = '<div class="champ"><label for="f-montant">' + esc(libM) + " (€)</label>" + nb("f-montant", F.montant, "0,00", F.montantAuto || F.montantHab ? "auto" : "", etapeFinale() ? "done" : "next") +
    '<span class="calc" id="f-montant-calc"' + (A.montant ? "" : " hidden") + ">" + esc(A.montant) + "</span>" + err("f-montant") +
    (hab > 0 ? '<button class="lien" type="button" id="f-hab">Reprendre ton versement habituel</button>' : "") + "</div>";
  const champFrais = avecFrais ? '<div class="champ"><label for="f-frais">Frais, courtage (€)</label>' + nb("f-frais", F.frais, "0 si aucun", F.fraisAuto ? "auto" : "") +
    '<span class="calc" id="f-frais-calc"' + (A.frais ? "" : " hidden") + ">" + esc(A.frais) + "</span>" + err("f-frais") + "</div>" : "";
  const pcalc = () => { const n = netOrdre(), q = lireNombre(F.qte); return !F.prixTape && n > 0 && q > 0 && ETAT.discret !== "oui" ? "≈ " + nf(2, 4).format(n / q) : "0,00"; };
  const champCours = bourse ? '<div class="champ"><label for="f-prix">Cours (€)</label>' + nb("f-prix", F.prixTape ? F.prix : "", pcalc()) + "</div>" : "";
  const ctl = controleAvis();
  const champPrix = avecQte && F.type !== "Frais en parts" ? '<p class="m-pu' + (ctl.c ? " " + ctl.c : "") + '" id="f-pu" aria-live="polite"' + (ctl.t ? "" : " hidden") + ">" + esc(ctl.t) + "</p>" : "";
  /* v17.78 (lot60, Théo : « trop d'informations d'un coup ») · parcours en étapes, un écran à la fois ; mêmes champs, mêmes identifiants, même envoi */
  const fin = etapeFinale(), seq = etape === 1 ? [1, 2, 3, 4] : etapesDe(F.type), discretE = ETAT.discret === "oui", euros = v => discretE ? "•••" + NB + "€" : nf(2, 2).format(v) + NB + "€";
  const barre = '<ol class="m-etapes" aria-label="Étapes de la saisie">' + seq.map((n, k) => { const fait = n < etape, cur = n === etape, lib = '<i>' + (k + 1) + "</i> " + esc(n === 1 && etape > 1 ? libType(F.type) : NOMS_ETAPES[n]);
    return '<li class="' + (fait ? "fait" : cur ? "cur" : "") + '"' + (cur ? ' aria-current="step"' : "") + ">" + (fait ? '<button type="button" class="m-et-b" data-etape="' + n + '" aria-label="Revenir à l\'étape ' + (k + 1) + '">' + lib + "</button>" : "<span>" + lib + "</span>") + "</li>"; }).join("") + "</ol>";
  const menu = menuOuvert ? '<div class="m-menu" role="menu">' +
        (nommerRaccourci
          ? '<div class="nommer"><input id="f-nom-rac" type="text" maxlength="40" aria-label="Nom du raccourci" value="' + esc(nomParDefaut()) + '"><button class="mini-btn" type="button" id="rac-ok">Créer</button><button class="lien" type="button" id="rac-annuler">Annuler</button></div>'
          : etape > 1 ? '<button class="lien" type="button" id="rac-creer">Enregistrer comme raccourci</button>' : "") +
        (etape > 1 ? '<button class="lien" type="button" id="f-vider">Vider le formulaire</button>' : "") +
        '<button class="lien" type="button" id="f-aides">' + (PREF.aides === false ? "Afficher les aides" : "Masquer les aides") + "</button></div>" : "";
  const SOUS = { Achat: "d'après ton avis d'opéré", Apport: "argent viré sur un compte", "Relevé": "d'après ton relevé", Vente: "d'après ton avis d'opéré" };
  const tuile = t => '<button type="button" class="type-btn m-tuile" data-type="' + esc(t) + '" aria-pressed="false">' + esc(libType(t)) + "<small>" + esc(brouillons[t] ? "✎ ta saisie est gardée" : SOUS[t] || "") + "</small></button>";
  const aideE = (t) => t && PREF.aides !== false ? '<p class="m-aide-e">' + t + "</p>" : "";
  let corps = "";
  if (etape === 1 && IMP) corps = htmlImport(false);   // import ouvert : rien d'autre à l'écran (retour = fermer le panneau)
  else if (etape === 1) corps =
      htmlImport(false) + htmlMemeAchat() +
      '<div class="types m-tuiles" role="group" aria-label="Type d\'opération">' + courants.map(tuile).join("") +
        '<button type="button" class="type-btn m-tuile plus-types" id="f-plus-types" aria-expanded="' + plusTypes + '">Autres ' + (plusTypes ? "▴" : "▾") + "<small>" + (courants.includes("Vente") ? "dividende, frais, retrait…" : "vente, dividende, frais…") + "</small></button></div>" +
      (!plusTypes ? "" : '<div class="m-autres" role="group" aria-label="Autres types">' + courantsAutres.map(chipT).join("") +
        (raresAutres.length ? '<span class="m-autres-t">Plus rares</span>' + raresAutres.map(chipT).join("") : "") + "</div>") +
      rendreRaccourcis() + htmlCarteReleveVersus() + (typeof htmlRelevesMois === "function" ? htmlRelevesMois() : "");   // v20.29 : les relevés du mois de tout le monde
  else if (etape === 2) corps =
      (AUTRES_TYPES[F.type] && PREF.aides !== false ? '<p class="info aide">ℹ️ <b>' + esc(AUTRES_TYPES[F.type].lib) + "</b> : " + esc(AUTRES_TYPES[F.type].d) + "</p>" : "") +
      htmlImport(bourse) +
      (avecActif ? '<div class="rang m-ca">' : "") +
      '<div class="champ"><label for="fo-env">Compte</label><select id="fo-env">' +
        groupeEnv(ouvertes.filter(e => e.perimetre === "Portefeuille"), "Bourse") + groupeEnv(ouvertes.filter(e => e.perimetre !== "Portefeuille"), "Épargne") + "</select></div>" +
      (avecActif ? '<div class="champ"><label for="f-actif">Actif</label><select id="f-actif" aria-describedby="f-actif-err"><option value="">Choisir…</option>' +
        (tenus.length ? '<optgroup label="Détenus sur ce compte">' + tenus.map(optA).join("") + "</optgroup>" : "") +
        '<optgroup label="Autres actifs">' + autresActifs.map(optA).join("") + "</optgroup>" +
        (F.na ? "" : '<option value="__nouvel">＋ Nouvel actif…</option>') + "</select>" + err("f-actif") + "</div></div>" +
        (F.na ? htmlNouvelActif(F.na, true) : "") : "") +
      htmlDernierAchatLigne() +
      blocDate +
      (bourse ? '<div class="rang m-avis2">' + champQte + champCours + '</div><div class="rang m-avis2">' + champFrais + champMontant + "</div>" : avecQte ? champQte + champMontant : champMontant) + (bourse ? "" : champFrais) + champPrix +
      aideE(bourse && !F.imp ? "Tout est sur ton <b>avis d'opéré</b>, dans cet ordre (jamais le cours de l'appli). Pas encore reçu ? Chez Fortuneo il arrive souvent le lendemain : reviens plus tard." : F.type === "Relevé" ? "Sur ton relevé : la <b>valeur totale</b> de la ligne, à la date du relevé." : "") +
      '<div class="recap" id="m-recap"></div>';
  else if (etape === 3) { const esp = especesEnv(F.env), m = lireNombre(F.montant), garde = F.imp ? gardeImport() : F.refait ? "Le versement d'origine est une ligne à part : choisis « Oui » seulement si tu as viré de l'argent pour cet achat." : "";
    corps = '<div class="m-q" role="group" aria-labelledby="m-q-t"><b class="m-q-t" id="m-q-t">As-tu viré de l\'argent pour payer cet achat ?</b>' +
      '<button type="button" class="m-choix" data-apport="1" aria-pressed="' + !!F.apport + '"><b>Oui, un virement</b><small>On enregistre aussi ce virement, juste avant l\'achat' + (m > 0 && !discretE ? " (" + euros(m) + " sauf si tu indiques un autre montant)" : "") + ".</small></button>" +
      (F.apport ? '<div class="champ m-vers-m"><label for="f-mapport">Montant viré, s\'il diffère (€)</label><input id="f-mapport" type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" value="' + esc(F.montantApport) + '" placeholder="Le même que l\'achat" aria-describedby="f-mapport-err">' + err("f-mapport") + "</div>" : "") +
      '<button type="button" class="m-choix" data-apport="0" aria-pressed="' + !F.apport + '"><b>Non, l\'argent était déjà sur le compte</b><small>' + (esp !== null ? "Espèces sur " + esc(F.env) + " : " + euros(esp) + " (virement fait avant, vente…)." : "Virement fait avant, vente, dividende…") + "</small></button>" +
      (garde ? '<span class="aide lie m-garde">' + esc(garde) + "</span>" : "") + "</div>"; }
  else { const ma = lireNombre(F.montantApport), m = lireNombre(F.montant), im = F.imp || {};
    const vers = F.type !== "Achat" ? "" : '<p class="m-vers-l">' + (F.apport ? "💶 + versement de " + euros(ma > 0 ? ma : m > 0 ? m : 0) : "💶 Sans versement : " + (im.versDoc ? "déjà enregistré avec le 1er support du document" : im.bascule ? "payé par la vente du même avis" : "payé par les espèces du compte")) + "</p>" + (F.imp && (im.versDoc ? F.apport : !(im.bascule && !F.apport)) ? '<span class="aide lie m-garde">' + esc(gardeImport()) + "</span>" : "");
    corps = (IMP && IMP.ops && F.imp && IMP.ops.length > 1 ? '<p class="m-imp-n petit">📄 Opération ' + (F.imp.i + 1) + "/" + IMP.ops.length + " de l'avis</p>" : F.imp ? '<p class="m-imp-n petit">📄 Lu dans ton avis : relis, puis enregistre.</p>' : "") +
      '<div class="m-relire"><p class="phrase-ordre" id="m-phrase"></p>' + champPrix + vers + '<p class="m-pru" id="m-pru" hidden></p>' +
      '<div class="m-relire-a"><button class="lien" type="button" data-etape="2">Modifier les chiffres</button>' + (F.type === "Achat" ? '<button class="lien" type="button" data-etape="3">Modifier le versement</button>' : "") + "</div></div>" +
      '<div class="recap" id="m-recap"></div>'; }
  $f("m-pane-ordre").innerHTML =
    '<form class="form m-etape-' + etape + '" id="m-form-ordre" novalidate>' + barre + menu + corps +
      '<div class="alertes" id="m-alertes"></div>' +
      (etape === 1 ? "" : '<div class="m-pied">' + (fin && etape !== 4 ? '<p class="phrase-ordre" id="m-phrase"></p>' : "") +
        '<button class="btn plein acc" type="submit" id="f-envoyer">' + esc(fin ? libBoutonOrdre() : "Suivant ›") + "</button></div>") +
    "</form>";
  const form = $f("m-form-ordre");
  if ($f("f-guide")) $f("f-guide").hidden = PREF.aides === false;
  if ($f("f-menu")) $f("f-menu").setAttribute("aria-expanded", String(menuOuvert));
  if ($f("f-vers")) $f("f-vers").addEventListener("toggle", () => { detailsOuverts = $f("f-vers").open; });
  if ($f("f-rv")) $f("f-rv").addEventListener("click", () => ouvrirReleveVersus(false));
  if (typeof brancherRelevesMois === "function") brancherRelevesMois($f("m-form-ordre"));
  if ($f("f-rv-h")) $f("f-rv-h").addEventListener("click", () => ouvrirReleveVersus(true));   // v17.84 (Théo) : relevé automatique → l'historique des relevés reste accessible
  form.querySelectorAll("[data-type]").forEach(b => b.addEventListener("click", () => {
    const t = b.dataset.type;
    if (etape === 1) {   // v17.78 (lot60) : « Quoi ? » → les chiffres ; une saisie laissée par « retour » est reprise telle quelle
      const br = brouillons[t];
      if (br) { delete brouillons[t]; F = br.F; IMP = br.IMP; toast("Ta saisie est reprise."); allerEtape(2); return; }
      if (t === F.type) { allerEtape(2); setTimeout(premierChamp, 30); return; }
      etape = 2; setTimeout(premierChamp, 30);
    }
    if (t === F.type) return;
    plusTypes = !courants.includes(t);
    let env = F.envChoisi ? F.env : envPourType(t) || envParDefaut() || F.env;
    if (t === "Relevé") { const av = ouvertes.find(e => e.regime === "AV"), cur = ouvertes.find(e => e.nom === env); if (av && (!cur || cur.regime !== "AV")) env = envPourType(t) || av.nom; }   // v17.34 : « Valeur AV » bascule d'office sur une assurance-vie
    /* la date d'un relevé ou d'un solde de départ ne passe jamais à un autre type (et inversement) : elle est propre à ce document */
    const date = DATE_OBLIG.includes(t) || DATE_OBLIG.includes(F.type) ? "" : F.date;
    F = formulaire({ type: t, date: date, dateChoisie: !!date && F.dateChoisie, env: env, envChoisi: F.envChoisi && env === F.env, actif: AVEC_ACTIF.includes(t) && env === F.env ? F.actif : "", montant: F.montantAuto || F.montantHab ? "" : F.montant });
    synchroniser(); rendreFormulaire();
  }));
  if ($f("f-meme")) $f("f-meme").addEventListener("click", () => { const d = dernierAchat(); if (d) ouvrirSaisieM({ type: "Achat", env: d.env, actif: d.actif }); });   // v17.79
  if ($f("f-plus-types")) $f("f-plus-types").addEventListener("click", () => { if (etape === 1) { plusTypes = !plusTypes; rendreFormulaire(); return; } plusTypes = !panneau; if (!plusTypes && autreType) F = formulaire({ type: "Achat", date: DATE_OBLIG.includes(F.type) ? "" : F.date, env: F.env, envChoisi: F.envChoisi }); rendreFormulaire(); });
  if ($f("f-aides")) $f("f-aides").addEventListener("click", () => { PREF.aides = PREF.aides === false; garderPref(); majAides(); menuOuvert = false; rendreFormulaire(); });
  if ($f("fo-env")) $f("fo-env").addEventListener("change", e => { if (F.imp && IMP && IMP.ops) { IMP.ops[F.imp.i].choix.env = e.target.value; F = formulaireImport(F.imp.i); rendreFormulaire(); return; } F = formulaire({ type: F.type, date: F.date, dateChoisie: F.dateChoisie, env: e.target.value, envChoisi: true, montant: F.montantAuto || F.montantHab ? "" : F.montant, frais: F.fraisAuto ? "" : F.frais }); synchroniser(); rendreFormulaire(); });
  if ($f("f-actif")) $f("f-actif").addEventListener("change", e => { if (F.imp && IMP && IMP.ops && e.target.value !== "__nouvel") { IMP.ops[F.imp.i].choix.actif = e.target.value; F = formulaireImport(F.imp.i); rendreFormulaire(); return; }   // v17.76 : choisi à la main = confirmé
    if (e.target.value === "__nouvel") { e.target.value = F.actif; F.na = F.imp ? Object.assign(nouvelNA(F.env), { nom: F.imp.nom || "", isin: F.imp.isin || "", code: (ISIN_CONNUS[F.imp.isin] || [])[0] || "", ticker: (ISIN_CONNUS[F.imp.isin] || [])[1] || "" }) : nouvelNA(F.env); rendreFormulaire(); setTimeout(() => { const el = $f("fn-code"); if (el) el.focus(); }, 30); return; } F = formulaire({ type: F.type, date: F.date, dateChoisie: F.dateChoisie, env: F.env, envChoisi: F.envChoisi, actif: e.target.value, montant: F.montantAuto ? "" : F.montant, frais: F.frais, fraisAuto: F.fraisAuto, apport: F.apport, montantApport: F.montantApport, refait: F.refait, qte: F.qteTape ? F.qte : "", qteTape: F.qteTape, auto: false }); synchroniser(); rendreFormulaire(); });
  if ($f("f-apport")) $f("f-apport").addEventListener("change", e => { F.apport = e.target.checked; F.okDoublon = false; rendreFormulaire(); });
  form.querySelectorAll("[data-apport]").forEach(b => b.addEventListener("click", () => { const v = b.dataset.apport === "1"; if (v === !!F.apport) return; F.apport = v; F.okDoublon = false; F.okEspeces = false; rendreFormulaire();
    setTimeout(() => { const el = v ? $f("f-mapport") : null; const c = form.querySelector('[data-apport="' + (v ? 1 : 0) + '"]'); if (c) c.focus(); }, 20); }));
  form.querySelectorAll("[data-etape]").forEach(b => b.addEventListener("click", () => allerEtape(+b.dataset.etape)));
  if ($f("f-hab")) $f("f-hab").addEventListener("click", () => { F.montant = saisieNombre(hab, 2); F.montantHab = true; rendreFormulaire(); });
  if ($f("f-prix-voir")) $f("f-prix-voir").addEventListener("click", () => { F.prixVu = true; rendreFormulaire(); setTimeout(() => { const el = $f("f-prix"); if (el) el.focus(); }, 30); });
  form.querySelectorAll("[data-date]").forEach(b => b.addEventListener("click", () => { F.date = b.dataset.date; F.dateChoisie = true; F.forcer = null; F.erreur = ""; rendreFormulaire(); }));
  // 14.5 : le nouvel actif se crée ici même, sans quitter la saisie d'ordre
  if ($f("f-nouvel-actif")) $f("f-nouvel-actif").addEventListener("click", () => { F.na = nouvelNA(F.env); rendreFormulaire(); setTimeout(() => { const el = $f("fn-code"); if (el) el.focus(); }, 30); });
  if (F.na) brancherNouvelActif(F.na, a => { if (F.imp && IMP && IMP.ops) { retenirIsin(cleOp(IMP.ops[F.imp.i]), a.code); IMP.ops[F.imp.i].choix.actif = a.code; F = formulaireImport(F.imp.i); toast("Actif " + a.code + " créé : relis l'opération."); if (importPret()) etape = 4; rendreFormulaire(); return; } F.actif = a.code; F.na = null; toast("Actif " + a.code + " créé : tu peux saisir ton ordre."); rendreFormulaire(); }, () => { F.na = null; rendreFormulaire(); });
  [["f-date", "date"], ["f-montant", "montant"], ["f-frais", "frais"], ["f-mapport", "montantApport"], ["f-qte", "qte"], ["f-prix", "prix"]].forEach(([id, k]) => {
    const el = $f(id);
    if (!el) return;
    el.addEventListener("input", () => {
      F[k] = el.value; F.forcer = null; F.erreur = ""; F.okCoherence = false; F.okDoublon = false; F.okEspeces = false;
      if (k === "date") { F.dateChoisie = true; form.querySelectorAll("[data-date]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.date === F.date))); }
      if (k === "qte" || k === "prix") F.pilote = k;
      if (k === "qte") F.qteTape = !!el.value.trim();
      if (k === "prix") { F.prixAuto = false; F.prixTape = !!el.value.trim(); }
      if (k === "montant") { F.montantAuto = false; F.montantHab = false; el.classList.remove("auto"); }
      if (k === "frais") { F.fraisAuto = false; el.classList.remove("auto"); }
      synchroniser();
      if (k !== "qte" && $f("f-qte")) $f("f-qte").value = F.qte;
      if (k !== "montant" && $f("f-montant")) { $f("f-montant").value = F.montant; $f("f-montant").classList.toggle("auto", !!F.montantAuto); }
      majRecap();
    });
  });
  form.querySelectorAll("[data-rac]").forEach(b => b.addEventListener("click", () => {
    const i = +b.dataset.rac, liste = (refData().raccourcis || []).slice();
    if (gererRaccourcis) { liste.splice(i, 1); sauverRaccourcis(liste); rendreFormulaire(); return; }
    F = formulaire(depuisRaccourci(liste[i])); synchroniser(); rendreFormulaire();
  }));
  form.querySelectorAll("[data-rac-ren]").forEach(b => b.addEventListener("click", () => {
    const i = +b.dataset.racRen, liste = (refData().raccourcis || []).slice(), r = liste[i]; if (!r) return;
    const nom = (window.prompt("Nouveau nom du raccourci", r.nom) || "").trim().slice(0, 40);
    if (!nom || nom === r.nom) return;
    liste[i] = Object.assign({}, r, { nom: nom }); sauverRaccourcis(liste); rendreFormulaire(); toast("Raccourci renommé : « " + nom + " ».");
  }));
  if ($f("rac-plus")) $f("rac-plus").addEventListener("click", () => { tousRaccourcis = !tousRaccourcis; rendreFormulaire(); });
  if ($f("rac-gerer")) $f("rac-gerer").addEventListener("click", () => { gererRaccourcis = !gererRaccourcis; rendreFormulaire(); });
  if ($f("rac-creer")) $f("rac-creer").addEventListener("click", () => { nommerRaccourci = true; rendreFormulaire(); setTimeout(() => { const i = $f("f-nom-rac"); if (i) { i.focus(); i.select(); } }, 30); });
  if ($f("rac-annuler")) $f("rac-annuler").addEventListener("click", () => { nommerRaccourci = false; rendreFormulaire(); });
  if ($f("rac-ok")) $f("rac-ok").addEventListener("click", () => {
    const nom = ($f("f-nom-rac").value || "").trim() || nomParDefaut();
    const liste = (refData().raccourcis || []).slice();
    liste.push({ nom: nom, type: F.type, env: F.env, actif: AVEC_ACTIF.includes(F.type) ? F.actif : "", montant: lireNombre(F.montant), frais: lireNombre(F.frais), quantite: F.pilote === "qte" ? lireNombre(F.qte) : null, apport: F.type === "Achat" && F.apport, montantApport: lireNombre(F.montantApport) });
    nommerRaccourci = false; menuOuvert = false;
    sauverRaccourcis(liste);
    rendreFormulaire();
    toast("Raccourci « " + nom + " » créé.");
  });
  if ($f("f-vider")) $f("f-vider").addEventListener("click", () => { F = formulaire({ type: F.type, env: F.env, envChoisi: F.envChoisi, auto: false }); nommerRaccourci = false; menuOuvert = false; rendreFormulaire(); });
  brancherImport();
  form.addEventListener("submit", e => { e.preventDefault(); if (etapeFinale()) envoyerOrdre(false); else etapeSuivante(); });
  /* v17.73 (lot57) · touche Entrée / « Suivant » du clavier : champ suivant de l'avis ; après le dernier, le clavier se ferme et le bouton se montre
     (jamais d'envoi depuis le clavier : on relit la phrase, puis on touche le bouton) */
  form.addEventListener("keydown", e => {
    if (e.key !== "Enter" || e.isComposing || !(e.target instanceof HTMLInputElement) || e.target.type === "checkbox") return;
    e.preventDefault();
    const ordre = ["f-qte", "f-prix", "f-frais", "f-montant", "f-mapport"].map(id => $f(id)).filter(el => el && el.offsetParent !== null && !el.closest("details:not([open])"));
    const i = ordre.indexOf(e.target), suiv = i >= 0 ? ordre[i + 1] : null;
    if (suiv) { suiv.focus(); if (suiv.select) suiv.select(); return; }
    if (!etapeFinale()) { e.target.blur(); etapeSuivante(); return; }   // v17.78 (lot60) : Entrée valide l'étape (jamais l'envoi)
    e.target.blur(); const b = $f("f-envoyer"); if (b) b.scrollIntoView({ block: "nearest" });
  });
  majRecap();
}
function nomParDefaut() {
  const m = lireNombre(F.montant);
  return (F.type + (F.actif ? " " + F.actif : "") + (m > 0 ? " " + saisieNombre(m, 0) + " €" : "")).slice(0, 40);
}
async function posterFichier(corps) {
  if (simulationM()) return { ok: false, erreur: "simulation", message: MSG_SIM };
  const ctrl = window.AbortController ? new AbortController() : null;
  const minuteur = setTimeout(() => { if (ctrl) ctrl.abort(); }, 45000);
  try {
    const rep = await fetch(adresse(), { method: "POST", body: JSON.stringify(Object.assign({ cle: cle() }, corps)), signal: ctrl ? ctrl.signal : undefined });
    return await rep.json();
  } catch (e) {
    /* v16.83 · sans réseau (TypeError), rien n'est parti : on peut renvoyer. Délai dépassé ou réponse illisible : le fichier a PEUT-ÊTRE écrit */
    if (e && (e.name === "AbortError" || e.name === "SyntaxError")) return { ok: false, erreur: "incertain", message: (e.name === "AbortError" ? "Ton fichier a mis trop de temps à répondre" : "Réponse illisible de ton fichier") + (corps && corps.action === "ordre" ? " : l'ordre a peut-être été enregistré. Vérifie l'Historique avant de renvoyer." : " : c'est peut-être enregistré quand même. Vérifie avant de renvoyer.") };
    return { ok: false, erreur: "reseau", message: "Impossible de joindre ton fichier : vérifie ta connexion puis réessaie." };
  } finally { clearTimeout(minuteur); }
}
async function sauverRaccourcis(liste) {
  if (M && M.ref) M.ref.raccourcis = liste;
  stock.set(K.cache, JSON.stringify(M));
  const rep = await posterFichier({ action: "raccourcis", raccourcis: liste });
  if (!rep.ok) toast("Raccourcis non enregistrés sur ton fichier : " + (rep.message || "erreur"));
}
/* v17.34 · ordres dont l'envoi est resté incertain (délai dépassé) : comptés pour le garde-fou des doublons tant que le fichier n'a pas été relu */
let ordresIncertains = [];
let ordresEnregistres = [];   // v20.54 : ordres enregistrés depuis l'ouverture de l'appli, gardés jusqu'au rechargement (doublon d'un avis réimporté avant que le fichier soit relu)
function joursEntre(a, b) { return Math.abs(Math.round((new Date(String(a).slice(0, 10) + "T12:00:00") - new Date(String(b).slice(0, 10) + "T12:00:00")) / 864e5)); }
/** garde-fou G3 : la même opération (type, compte, actif, montant à 1 centime près) dans les 3 jours, envois en cours ou incertains compris */
function doublonOrdre(m) {
  if (!(m > 0) || !F.date) return null;
  const l = (refData().journal || []).concat(ordresIncertains, ordresEnregistres);   // v20.54 : aussi ceux enregistrés depuis l'ouverture (avant que le fichier relu les renvoie)
  return l.find(o => o.type === F.type && o.enveloppe === F.env && (!AVEC_ACTIF.includes(F.type) || (o.actif || "") === (F.actif || "")) &&
    Math.abs((+o.montant || 0) - m) <= .01 && o.date && joursEntre(o.date, F.date) <= 3) || null;
}
function analyser() {
  const r = refData(), t = typeInfo(F.type), discret = ETAT.discret === "oui";
  const q = lireNombre(F.qte), m = lireNombre(F.montant), frBrut = lireNombre(F.frais), fr = frBrut || 0;
  const msg = [], lignes = [];
  let bloque = false, manque = "", champ = "";
  /* v17.73 (lot57) : le 1er champ qui manque est signalé sur le champ lui-même (et plus seulement dans le bouton) */
  const manquer = (t2, id) => { bloque = true; if (!manque) { manque = t2; champ = id || ""; } };
  const eurD = v => discret ? "" : " (environ " + Math.round(v).toLocaleString("fr-FR") + " €)";
  if (AVEC_ACTIF.includes(F.type) && !F.actif) manquer("Choisis l'actif", "f-actif");
  else if (F.imp && F.imp.propose && !F.imp.confirme && F.actif === F.imp.propose) manquer("Confirme l'actif proposé", "f-actif");   // v17.76 : proposé, jamais imposé
  if (!F.date) { manquer(F.type === "Relevé" ? "Indique la date de ton relevé" : F.type === "Solde initial" ? "Indique la date de début du suivi" : "Choisis la date", "f-date"); if (DATE_OBLIG.includes(F.type)) msg.push(["info", F.type === "Relevé" ? "La date du relevé est obligatoire : c'est elle qui date la valeur (pas le jour où tu la saisis)." : "La date de début du suivi est obligatoire."]); }
  if (AVEC_QTE.includes(F.type)) {
    if (q === null) manquer(F.type === "Achat" || F.type === "Vente" ? "Indique la quantité de ton avis d'opéré" : "Indique le nombre de parts", "f-qte");
    else if (isNaN(q) || q <= 0) { bloque = true; msg.push(["err", isNaN(q) ? "Quantité illisible : des chiffres et une virgule seulement." : "La quantité doit être supérieure à 0.", "", "f-qte"]); }
  }
  if (m === null) manquer(F.type === "Achat" ? "Indique le montant net débité de ton avis" : F.type === "Vente" ? "Indique le montant net crédité de ton avis" : F.type === "Relevé" ? "Indique la valeur de ton relevé" : "Indique le montant", "f-montant");
  else if (isNaN(m)) { bloque = true; msg.push(["err", "Montant illisible : des chiffres et une virgule seulement (ex. 1519,99).", "", "f-montant"]); }
  else if (F.type !== "Ajustement espèces" && m <= 0) { bloque = true; msg.push(["err", "Le montant doit être positif : c'est le type qui donne le sens.", "", "f-montant"]); }
  else if (F.type === "Ajustement espèces" && m === 0) { bloque = true; msg.push(["err", "Une correction de 0 € ne change rien : indique l'écart (négatif si sortie).", "", "f-montant"]); }   // G7
  /* v16.78 · relevé d'assurance-vie : un montant bien plus petit que la ligne ressemble au prix d'UNE part (ex. 99,96 € au lieu de ~15 850 €) */
  if (F.type === "Relevé" && F.actif && m > 0 && M && M.histoAV) {
    let ref = 0; (M.histoAV.ordres || []).forEach(o => { if (o[2] !== F.actif) return; if (o[1] === "Relevé" && o[3] > ref * .2) ref = o[3]; else if (o[1] === "Achat") ref += o[3]; else if (o[1] === "Vente") ref -= o[3]; });
    if (ref > 0 && m < ref * .2) msg.push(["warn", "Ce montant ressemble au prix d'une seule part. Sur ton relevé, prends la VALEUR TOTALE de la ligne" + eurD(ref) + "."]);
  }
  /* v16.83 · un apport bien plus petit que d'habitude ; v17.34 (G4) : ou 5 fois plus grand (un zéro de trop ?) */
  if (F.type === "Apport" && m > 0) {
    const hab = mediane((r.journal || []).filter(o => o.type === "Apport" && o.enveloppe === F.env && !o.envoi).map(o => o.montant));
    if (hab > 0 && m < hab * .2) msg.push(["warn", "Ce montant est bien plus petit que tes versements habituels sur " + F.env + eurD(hab) + " : vérifie la virgule."]);
    if (hab > 0 && m > hab * 5) msg.push(["warn", "Un zéro de trop ? Ce versement est plus de 5 fois plus grand que d'habitude sur " + F.env + eurD(hab) + "."]);
  }
  if (F.type === "Achat" && m > 0 && F.actif) {
    const habA = mediane((r.journal || []).filter(o => o.type === "Achat" && o.actif === F.actif && !o.envoi).map(o => o.montant));
    if (habA > 0 && m > habA * 5) msg.push(["warn", "Un zéro de trop ? Cet achat est plus de 5 fois plus grand que tes achats habituels de " + F.actif + eurD(habA) + "."]);
  }
  const doutes = [["montant", "f-montant"]].concat(AVEC_FRAIS.includes(F.type) ? [["frais", "f-frais"]] : [], F.type === "Achat" && F.apport ? [["montantApport", "f-mapport"]] : []).filter(([k]) => millierDouteux(F[k]));
  if (doutes.length) { bloque = true; if (!manque) manque = "Réponds à la question sur le montant"; }
  /* G5 · frais : jamais négatifs (le fichier les refuserait), signalés au-delà de 5 % du montant */
  if (AVEC_FRAIS.includes(F.type)) {
    if (isNaN(frBrut) || fr < 0 || (fr && m > 0 && fr > m)) { bloque = true; msg.push(["err", fr < 0 ? "Les frais ne peuvent pas être négatifs : recopie-les sans le signe moins." : "Les frais doivent être positifs et inférieurs au montant.", "", "f-frais"]); }
    else if (fr > 0 && m > 0 && fr > m * .05) msg.push(["warn", "Frais de plus de 5 % du montant : vérifie-les sur ton avis d'opéré."]);
  }
  const tenu = F.actif ? quantiteTenue(F.env, F.actif) : 0;
  const c = F.actif ? r.cours[F.actif] : null;
  if ((F.type === "Vente" || F.type === "Frais en parts") && F.actif) {
    lignes.push(["Détenu aujourd'hui", qteBrute(tenu) + " " + esc(F.actif) + (tenu > 0 && F.type === "Vente" ? ' <button class="mini-btn" type="button" id="tout-vendre">Tout</button>' : "")]);
    if (q > tenu + 1e-9) { bloque = true; msg.push(["err", "Tu ne détiens que " + qteBrute(tenu) + " " + F.actif + " dans " + F.env + ".", "", "f-qte"]); }
  }
  /* G6 · parts à virgule sur un PEA (ou une ligne en parts entières) : jamais d'arrondi automatique, un simple avertissement */
  if (AVEC_QTE.includes(F.type) && F.type !== "Frais en parts" && q > 0 && Math.abs(q - Math.round(q)) > 1e-9 && partsEntieres())
    msg.push(["warn", "Sur un PEA les parts sont entières : recopie le nombre de ton avis d'opéré."]);
  if ((F.type === "Achat" || F.type === "Vente") && q > 0 && m > 0) {
    const pu = (m + fr * t.tresorerie) / q, p = lireNombre(F.prix);
    /* G1 · prix ET nombre de parts tapés : montant ≈ parts × prix ± frais, à 2 centimes près (Théo, 20/11 : l'avis Fortuneo tombe juste), sinon on demande */
    if (F.prixTape && F.qteTape && p > 0) {
      const attendu = q * p - fr * t.tresorerie;
      if (Math.abs(attendu - m) > .02 && !F.okCoherence) { bloque = true; if (!manque) manque = "Vérifie le montant, les parts et le prix";
        msg.push(["conf", "Montant, parts et prix ne collent pas : " + (discret ? "" : qteBrute(q) + " × " + nf(2, 4).format(p) + " € " + (F.type === "Achat" ? "+" : "−") + " frais = " + nf(2, 2).format(attendu) + " €, et non " + nf(2, 2).format(m) + " €. ") + "Corrige ou confirme.", "coherence"]); }
    }
    /* v17.75 (Théo) : un achat que les espèces du compte ne couvrent pas (sans versement, ou versement trop petit) est arrêté : on confirme ou on corrige */
    if (F.type === "Achat" && !F.okEspeces) {
      const g = (M.groupes || []).find(x => x.env === F.env), le = g && (g.lignes || []).find(l => l.especes);
      if (le && typeof le.valeur === "number") {
        const vers = F.apport ? (lireNombre(F.montantApport) > 0 ? lireNombre(F.montantApport) : m) : 0, dispo = le.valeur + vers + creditImport(F.env, le.valeur);   // v17.76 (lot59) : vente du même avis déjà enregistrée
        if (m - dispo > .01) { bloque = true; if (!manque) manque = "Les espèces ne couvrent pas cet achat";
          msg.push(["conf", "Il n'y a que " + (discret ? "•••" : nf(2, 2).format(le.valeur)) + " € d'espèces sur " + esc(F.env) + (F.apport ? " (+ le versement)" : "") + " : il manque " + (discret ? "•••" : nf(2, 2).format(m - dispo)) + " €. " + (F.apport ? "Vérifie le montant du versement." : "Choisis « Oui, un virement », ou saisis d'abord ton virement.") + " Confirme seulement si tes espèces dans l'appli ne sont pas à jour.", "especes"]); }
      }
    }
    /* écart au cours : seulement si le nombre de parts a été TAPÉ (sinon un « écart 0 % » rassurerait à tort) */
    if (c && F.qteTape) {
      const ec = pu / c - 1;
      if (Math.abs(ec) > .05) lignes.push(["Cours de l'appli", (discret ? "" : nf(c < 1 ? 4 : 2, c < 1 ? 4 : 2).format(c) + NB + "€ · ") + "écart " + pct(ec)]);
      if (Math.abs(ec) > .5) msg.push(["warn", "Écart de plus de 50 % avec le cours actuel : vérifie la quantité et le montant (virgule mal placée ?)."]);
      else if (Math.abs(ec) > .1) msg.push(["warn", "Écart de plus de 10 % avec le cours de l'appli : vérifie le nombre de parts et le montant sur ton avis."]);
    }
  }
  if (F.actif && q > 0 && t.quantite) lignes.push(["Détenu après l'ordre", qteBrute(+(tenu + q * t.quantite).toFixed(6)) + " " + esc(F.actif)]);
  if (F.type === "Achat" && F.apport) {
    const ma = lireNombre(F.montantApport);
    if (ma !== null && (isNaN(ma) || ma <= 0)) { bloque = true; msg.push(["err", "Montant de l'apport illisible.", "", "f-mapport"]); }
  }
  /* G2 · dates : programmée (déjà là), jour sans bourse, ordre ancien, début de mois */
  if (F.date && F.date > aujourdhuiISO()) msg.push(["warn", "Ordre programmé : il restera ignoré par les calculs jusqu'au " + frDate(F.date) + "."]);
  else if (F.date) {
    const jour = new Date(F.date + "T12:00:00").getDay(), env = (r.enveloppes || []).find(e => e.nom === F.env) || {}, ouv = env.ouverture ? String(env.ouverture).slice(0, 10) : "";
    if ((F.type === "Achat" || F.type === "Vente") && (jour === 0 || jour === 6)) msg.push(["warn", "Le " + frDate(F.date) + " est un " + (jour === 0 ? "dimanche" : "samedi") + " : jour sans bourse. Prends la date d'exécution de ton avis."]);
    if ((F.type !== "Solde initial" && joursEntre(F.date, aujourdhuiISO()) > 31) || (ouv && F.date < ouv)) msg.push(["warn", ouv && F.date < ouv ? "Date avant l'ouverture de " + F.env + " (" + frDate(ouv) + ") : c'est bien la bonne ?" : "Ordre ancien : c'est bien la date d'exécution ?"]);
    if (!DATE_OBLIG.includes(F.type) && !F.dateChoisie && F.date === aujourdhuiISO() && new Date().getDate() <= 5)
      msg.push(["info", "Exécuté le mois dernier ? Choisis la date de ton avis."]);
    /* v20.53 (P1, Théo 25/11) : un versement daté AVANT le dernier relevé Versus mais saisi APRÈS n'est plus une fausse performance :
       il compte dans le relevé suivant (ton fichier le prend le soir où il est saisi). On le dit, sans bloquer. */
    const rel = dernierReleveVersus(), flux = ["Apport", "Retrait", "Solde initial"].includes(F.type) || (F.type === "Achat" && F.apport);
    if (flux && rel && F.date <= rel) msg.push(["info", "Date avant ton dernier relevé Versus (" + frDate(rel) + ") : ce " + (F.type === "Retrait" ? "retrait" : "versement") + " sera compté dans ton prochain relevé, jamais comme une performance."]);
  }
  /* G7 · un 2e solde de départ sur le même compte */
  if (F.type === "Solde initial" && (r.journal || []).some(o => o.type === "Solde initial" && o.enveloppe === F.env))
    msg.push(["warn", F.env + " a déjà un solde de départ : un 2e fausserait ses espèces. Pour corriger, supprime l'ancien ou fais une correction d'espèces."]);
  /* G3 · doublon (confirmation dans l'appli, jamais « forcer » côté fichier) */
  const dbl = !bloque ? doublonOrdre(m) : null;   // seulement quand tout le reste est bon
  if (dbl && !F.okDoublon) { bloque = true; if (!manque) manque = "Confirme : déjà enregistré ?";
    msg.push(["conf", "Déjà enregistré le " + frDate(String(dbl.date).slice(0, 10)) + " : " + libType(dbl.type) + (dbl.actif ? " " + dbl.actif : "") + (discret ? "" : " de " + nf(0, 2).format(dbl.montant) + " €") + (dbl.envoi ? " (envoi en cours)" : "") + ". Doublon ?", "doublon"]); }
  if (bloque && !manque) manque = msg.some(x => x[0] === "err") ? "Corrige l'alerte ci-dessus" : "Complète le formulaire";
  return { bloque, msg, lignes, doutes, manque, champ };
}
/** Jour (aaaa-mm-jj) du dernier relevé Versus déjà parti : dernier jour ouvré d'un mois, à partir de 19 h */
function dernierReleveVersus(maintenant) {
  const n = maintenant || new Date(), iso = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  for (let i = 0; i < 3; i++) {
    const y = n.getFullYear(), m = n.getMonth() + 1 - i, d = new Date(y, m, 0, 12); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    if (new Date(d.getFullYear(), d.getMonth(), d.getDate(), 19) <= n) return iso(d);
  }
  return null;
}
/** La phrase de relecture : l'ordre dit en une phrase courte et naturelle, pour repérer une erreur d'un coup d'œil (v16.92) */
function phraseOrdre(sansVers) {   // v17.78 (lot60) : sansVers = relecture d'un achat, le versement est dit sur sa propre ligne
  const m = lireNombre(F.montant), q = lireNombre(F.qte), fr = lireNombre(F.frais), ma = lireNombre(F.montantApport);
  if ((!(m > 0) && F.type !== "Ajustement espèces") || millierDouteux(F.montant)) return "";   // v16.83 : pas de « 1,50 € » relu tant que « 1.500 » est en doute
  if (m === null || !isFinite(m) || m === 0) return "";
  const discret = ETAT.discret === "oui";   // G10 : aucun montant en clair en mode discret
  const B = x => "<b>" + x + "</b>", e = v => { if (discret) return B("•••" + NB + "€"); const d = Number.isInteger(+v.toFixed(2)) ? 0 : 2; return B(nf(d, d).format(v) + NB + "€"); };
  const env = B(esc(F.env || "?"));
  const quand = F.date ? dateCourteIso(F.date) : "date à choisir", le = ", le " + B(quand);
  const actifs = refData().actifs || [], a = actifs.find(x => x.code === F.actif), nomA = esc(a && a.nom && a.nom.length <= 22 ? a.nom : F.actif || "");
  const de = n => (/^[aeiouyhàâéèêîôû]/i.test(n) ? "d'" : "de ") + B(n);
  let titres = AVEC_QTE.includes(F.type) && q > 0 ? de(qteBrute(q) + " " + esc(F.actif)).replace(/^d'/, "de ") : F.actif ? de(nomA) : "";
  const frais = !AVEC_FRAIS.includes(F.type) || isNaN(fr) || fr < 0 ? "" : fr > 0 ? " (dont " + e(fr) + " de frais" + (F.fraisAuto ? ", comme la dernière fois : à vérifier" : "") + ")" : " (sans frais)";
  let t;
  switch (F.type) {
    case "Achat": case "Vente": { const p = lireNombre(F.prix), n = netOrdre(), pu = F.prixTape && p > 0 ? p : n > 0 && q > 0 ? +(n / q).toFixed(4) : 0;   // v17.73 (lot57) : le cours dans la phrase
      if (pu > 0 && q > 0 && !discret) titres += " à " + B(nbCours(pu)); }
      if (F.type === "Vente") { t = "Vente " + titres + " pour " + e(m) + frais + " sur " + env + le + "."; break; }
      if (sansVers) { t = "Achat " + titres + " pour " + e(m) + frais + " sur " + env + le + "."; break; }
      t = (F.apport ? B("+ un versement de " + (discret ? "•••" + NB + "€" : nf(Number.isInteger(+(ma > 0 ? ma : m).toFixed(2)) ? 0 : 2, 2).format(ma > 0 ? ma : m) + NB + "€")) + ", puis achat " : "Achat ") + titres + " pour " + e(m) + frais + " sur " + env + le + "." + (F.apport ? "" : " Sans versement (argent déjà sur le compte)."); break;
    case "Apport": t = "Versement de " + e(m) + " sur " + env + le + "."; break;
    case "Retrait": t = "Retrait de " + e(m) + " sur " + env + le + "."; break;
    case "Intérêts": t = "Dividende ou intérêts de " + e(m) + " reçus sur " + env + le + "."; break;
    case "Frais": t = "Frais de " + e(m) + " débités sur " + env + le + "."; break;
    case "Relevé": {
      const plusieursAV = (refData().enveloppes || []).filter(x => x.regime === "AV").length > 1;
      t = "Valeur " + (F.actif ? de(nomA) + " " : "") + "sur ton relevé" + (plusieursAV ? " (" + env + ")" : "") + " : " + e(m) + (F.date ? " au " + B(quand) : ", date du relevé à choisir") + "."; break; }
    case "Frais en parts": t = "Frais prélevés en parts : " + (q > 0 ? B(qteBrute(q) + " " + esc(F.actif)) + " pour " : "") + e(m) + " sur " + env + le + "."; break;
    case "Ajustement espèces": t = "Ajustement des espèces de " + e(m) + " sur " + env + le + "."; break;
    case "Solde initial": t = "Solde de départ de " + e(m) + " sur " + env + (F.date ? ", au " + B(quand) : ", date de début à choisir") + "."; break;
    default: t = esc((AUTRES_TYPES[F.type] || {}).lib || F.type) + " de " + e(m) + " sur " + env + le + ".";
  }
  return "📝 " + t;
}
function majRecap() {
  if (etape === 1 || !$f("f-envoyer")) return;   // v17.78 (lot60) : « Quoi ? » n'a ni champ ni bouton
  const a0 = analyser(), fin = etapeFinale(), a = fin ? a0 : analyserEtape(etape);
  /* chaque étape ne montre que ses alertes : les chiffres (2), le versement et les espèces (3), tout à la relecture */
  if (etape === 3) { a.msg = a.msg.filter(m => m[2] === "especes" || m[3] === "f-mapport"); a.doutes = (a.doutes || []).filter(([k]) => k === "montantApport"); }
  if ($f("m-phrase")) { const ph = phraseOrdre(etape === 4 && F.type === "Achat"); $f("m-phrase").innerHTML = ph; $f("m-phrase").hidden = !ph; }
  if ($f("m-pru")) { const h = htmlPruApres(); $f("m-pru").innerHTML = h; $f("m-pru").hidden = !h; }   // (préparé) : le PRU après cet achat, avant d'enregistrer
  if ($f("m-recap")) { $f("m-recap").innerHTML = a.lignes.map(l => "<div><span>" + l[0] + "</span><b>" + l[1] + "</b></div>").join(""); $f("m-recap").hidden = !a.lignes.length; }
  const A = aidesCalcul();
  [["f-montant-calc", "montant"], ["f-qte-calc", "qte"], ["f-frais-calc", "frais"]].forEach(([id, k]) => { const el = $f(id); if (el) { el.textContent = A[k]; el.hidden = !A[k]; } });
  if ($f("f-details-res")) $f("f-details-res").textContent = resumeDetails();
  if ((a.doutes || []).some(([k]) => k === "montantApport") && $f("f-vers") && !$f("f-vers").open) { $f("f-vers").open = true; detailsOuverts = true; }
  /* v17.73 (lot57) : une erreur qui concerne un champ s'écrit sous ce champ ; le 1er champ qui manque est entouré (seulement après une 1re saisie) */
  const sousChamp = m => m[3] && $f(m[3] + "-err");
  document.querySelectorAll("#m-form-ordre .m-err").forEach(el => { const m = a.msg.find(x => x[3] && x[3] + "-err" === el.id), c = $f(el.id.slice(0, -4));
    el.textContent = m ? m[1] : ""; el.hidden = !m; if (c) { c.classList.toggle("a-erreur", !!m); if (m) c.setAttribute("aria-invalid", "true"); else c.removeAttribute("aria-invalid"); } });
  document.querySelectorAll("#m-form-ordre .a-remplir").forEach(el => el.classList.remove("a-remplir"));
  const entame = ["qte", "montant", "prix", "frais"].some(k => String(F[k] || "").trim()) || F.dateChoisie;
  if (a.champ && entame && $f(a.champ)) $f(a.champ).classList.add("a-remplir");
  if ($f("f-prix") && !F.prixTape) { const n = netOrdre(), q = lireNombre(F.qte); $f("f-prix").placeholder = n > 0 && q > 0 && ETAT.discret !== "oui" ? "≈ " + nf(2, 4).format(n / q) : "0,00"; }
  if ($f("f-pu")) { const c = controleAvis(); $f("f-pu").textContent = c.t; $f("f-pu").hidden = !c.t; $f("f-pu").className = "m-pu" + (c.c ? " " + c.c : ""); }
  let al = a.msg.filter(m => !sousChamp(m)).map(m => m[0] === "conf"
    ? '<div class="alerte warn">' + esc(m[1]) + '<br><button class="btn" type="button" data-conf="' + m[2] + '">' + (m[2] === "doublon" ? "Enregistrer quand même" : m[2] === "especes" ? "Mes espèces ne sont pas à jour" : "C'est bien mon avis") + '</button> <button class="btn ghost" type="button" data-corr="' + m[2] + '">Corriger</button></div>'
    : '<div class="alerte ' + m[0] + '">' + esc(m[1]) + "</div>").join("");
  (a.doutes || []).forEach(([k]) => { const t = String(F[k]).trim(), l = lectureMilliers(t);
    al += '<div class="alerte warn">« ' + esc(t) + ' » veut dire ' + esc((+l.milliers).toLocaleString("fr-FR")) + NB + '€ ?<br><button class="btn" type="button" data-millier="' + k + '" data-mv="' + esc(l.milliers) + '">Oui, ' + esc((+l.milliers).toLocaleString("fr-FR")) + NB + "€</button>" +
      (l.virgule ? ' <button class="btn ghost" type="button" data-millier="' + k + '" data-mv="' + esc(l.virgule) + '">Non, ' + esc(l.virgule) + NB + "€</button>" : "") + "</div>"; });
  if (F.erreur) al += '<div class="alerte err">' + esc(F.erreur) + "</div>";
  if (F.forcer) al += '<div class="alerte warn">' + esc(F.forcer) + '<br><button class="btn" type="button" id="forcer">Enregistrer quand même</button></div>';
  $f("m-alertes").innerHTML = al;
  const btn = $f("f-envoyer");
  btn.disabled = a.bloque;
  btn.textContent = a.bloque ? a.manque : fin ? libBoutonOrdre(true) : "Suivant ›";
  btn.classList.toggle("manque", !!a.bloque);
  if ($f("tout-vendre")) $f("tout-vendre").addEventListener("click", () => { F.qte = saisieNombre(quantiteTenue(F.env, F.actif), 8); F.pilote = "qte"; F.qteTape = true; synchroniser(); $f("f-qte").value = F.qte; majRecap(); });
  if ($f("forcer")) $f("forcer").addEventListener("click", () => envoyerOrdre(true));
  $f("m-alertes").querySelectorAll("[data-conf]").forEach(b => b.addEventListener("click", () => { if (b.dataset.conf === "doublon") F.okDoublon = true; else if (b.dataset.conf === "especes") F.okEspeces = true; else F.okCoherence = true; majRecap(); }));
  $f("m-alertes").querySelectorAll("[data-corr]").forEach(b => b.addEventListener("click", () => { const el = $f(b.dataset.corr === "doublon" ? "f-date" : "f-montant"); if (el) { el.focus(); el.scrollIntoView({ block: "center" }); } }));
  $f("m-alertes").querySelectorAll("[data-millier]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.millier, id = { montant: "f-montant", frais: "f-frais", montantApport: "f-mapport" }[k];
    F[k] = b.dataset.mv; if ($f(id)) $f(id).value = F[k];
    synchroniser(); if ($f("f-qte")) $f("f-qte").value = F.qte;
    majRecap();
  }));
}
/* v16.83 · le bouton dit ce qu'on enregistre (un Relevé n'est pas un « ordre ») ; v17.34 : et pour combien (••• en mode discret) */
function libBoutonOrdre(montant) {
  const lib = F.type === "Achat" && F.apport ? "Enregistrer le versement et l'achat" : ({ "Relevé": "Enregistrer la valeur", "Apport": "Enregistrer le versement", "Retrait": "Enregistrer le retrait", "Intérêts": "Enregistrer les intérêts", "Frais": "Enregistrer les frais", "Solde initial": "Enregistrer le solde", "Achat": "Enregistrer l'achat", "Vente": "Enregistrer la vente", "Frais en parts": "Enregistrer les frais", "Ajustement espèces": "Enregistrer l'ajustement" })[F.type] || "Enregistrer l'ordre";
  const m = lireNombre(F.montant);
  if (!montant || !(m !== null && isFinite(m) && m !== 0)) return lib;
  return lib + " · " + (ETAT.discret === "oui" ? "•••" : nf(Number.isInteger(+m.toFixed(2)) ? 0 : 2, 2).format(m) + NB + "€");
}
/* Envoi optimiste : la feuille se ferme tout de suite, l'enregistrement continue en arrière-plan */
async function envoyerOrdre(forcer) {
  const a = analyser();
  if (a.bloque) return;
  const base = { date: F.date, enveloppe: F.env };
  const ordres = [];
  if (F.type === "Achat" && F.apport) {
    const ma = lireNombre(F.montantApport);
    ordres.push(Object.assign({}, base, { type: "Apport", montant: ma === null ? lireNombre(F.montant) : ma }));
  }
  ordres.push(Object.assign({}, base, {
    type: F.type, actif: AVEC_ACTIF.includes(F.type) ? F.actif : "",
    quantite: AVEC_QTE.includes(F.type) ? lireNombre(F.qte) : null,
    montant: lireNombre(F.montant), frais: AVEC_FRAIS.includes(F.type) ? lireNombre(F.frais) : null
  }));
  stock.set("versus.moi.derniereEnv", F.env);
  { const m = envsParType(); m[F.type] = F.env; stock.set("versus.moi.envType", JSON.stringify(m)); }   // v16.97 : le compte de ce type, proposé la prochaine fois
  const sauvegarde = Object.assign({}, F), vPru = pruApres();   // (préparé) : calculé AVANT l'envoi (le fichier relu contiendra déjà l'achat)
  fermerSaisieM();
  toast("Enregistrement de l'ordre…");
  const enAttente = ordres.map(o => Object.assign({ app: false, envoi: true, ligne: 0 }, o, { quantite: o.quantite === undefined ? null : o.quantite }));
  if (M && M.ref) M.ref.journal = enAttente.reverse().concat(M.ref.journal || []);
  const rep = await posterFichier({ action: "ordre", ordres: ordres, forcer: !!forcer });
  if (M && M.ref) M.ref.journal = (M.ref.journal || []).filter(o => !o.envoi);
  if (rep.ok) { ordresEnregistres = ordresEnregistres.concat(enAttente.map(o => Object.assign({}, o, { envoi: false }))); if (ordres.some(o => o.type === "Frais en parts" && /Linxea/i.test(o.enveloppe || ""))) stock.set(cleStock("fraisLx"), isoJour(new Date()));   // v17.77 : rappel des frais Linxea fait
    delete brouillons[sauvegarde.type];
    if (vPru) { memoriserVerifPru(vPru, ordres[ordres.length - 1]); signalerCloche(); }
    if (window.SONS) SONS.succes(); toast(rep.message || "Ordre enregistré."); charger(true); suiteImport(sauvegarde); return; }
  if (rep.erreur === "cle") { cleRefusee(rep.message); toast("Clé refusée par ton fichier."); if (vueMoi()) rendre(); return; }
  if (rep.erreur === "incertain") { ordresIncertains = ordresIncertains.concat(enAttente.map(o => Object.assign({}, o, { envoi: true }))); toast("L'ordre a peut-être été enregistré : vérifie l'Historique avant de renvoyer."); charger(true); return; }   // v16.83 : jamais rouvert rempli (doublon)
  toast(rep.erreur === "avertissement" ? "Ordre à confirmer." : "Ordre non enregistré.");
  F = sauvegarde;
  if (rep.erreur === "avertissement") F.forcer = rep.message; else F.erreur = rep.message || "Erreur inattendue.";
  $f("m-saisie").hidden = false;
  paneSaisie("ordre");
}
/** le versement saisi avec un achat (même date, même compte, saisi dans l'appli) : supprimer l'achat ne le supprime pas */
function versementJumeau(j, i) {
  const o = j[i]; if (!o || o.type !== "Achat") return -1;
  return j.findIndex((x, k) => k !== i && !x.envoi && x.app && x.type === "Apport" && x.date === o.date && x.enveloppe === o.enveloppe);
}
let confirmeRV = false;
/* (préparé, Théo 25/11) · « Voir plus anciens » : pages d'ordres plus anciens demandées au fichier (action « journal », serveur du 25/11).
   Rangées à côté des données reçues (WeakMap) : jamais mélangées à ref.journal (doublons, rappels…), jamais gardées en cache,
   oubliées dès que le fichier est relu (les numéros de ligne ont pu bouger). Un fichier pas encore mis à jour n'envoie pas
   « journalSuite » : pas de bouton, rien ne change. */
const anciensJ = new WeakMap();
function journalAnciens() {
  const r = M && M.ref; if (!r) return { lignes: [], suite: 0 };
  if (!anciensJ.has(r)) anciensJ.set(r, { lignes: [], suite: typeof r.journalSuite === "number" ? r.journalSuite : 0, charge: false, msg: "" });
  return anciensJ.get(r);
}
/** le journal affiché : celui du fichier + les pages plus anciennes déjà demandées (sans doublon de ligne), du plus récent au plus ancien */
function journalAffiche() {
  const base = refData().journal || [], A = journalAnciens();
  if (!A.lignes.length) return base;
  const vues = new Set(base.filter(o => !o.envoi && o.ligne).map(o => o.ligne));
  return base.concat(A.lignes.filter(o => !vues.has(o.ligne))).sort((a, b) => !!b.envoi - !!a.envoi || String(b.date).localeCompare(String(a.date)) || (b.ligne || 0) - (a.ligne || 0));
}
async function voirPlusAnciens() {
  const r = M && M.ref, A = journalAnciens(); if (!r || A.charge || !(A.suite > 0)) return;
  A.charge = true; A.msg = ""; rendreJournal();
  const rep = await posterFichier({ action: "journal", avant: A.suite });
  A.charge = false;
  if (rep.ok && Array.isArray(rep.journal)) { A.lignes = A.lignes.concat(rep.journal.filter(o => o && /^\d{4}-\d\d-\d\d/.test(String(o.date || "")))); A.suite = typeof rep.suite === "number" ? rep.suite : 0; }
  else A.msg = rep.message || "Les ordres plus anciens n'ont pas pu être lus.";
  if (M && M.ref === r && paneCourant === "journal" && !$f("m-saisie").hidden) rendreJournal();
}
function rendreJournal() {
  const j = journalAffiche(), A = journalAnciens();
  const auj = aujourdhuiISO();
  const z = $f("m-pane-journal");
  /* v17.34 (Conseil) : fichier relié au Versus = relevé envoyé tout seul ; la saisie à la main reste possible, avec un avertissement */
  const ligneRV = !versusRelie() || typeof ouvrirSaisie !== "function" ? "" : '<div class="m-rv-etat"><p>🏁 <b>Relevé du Versus</b> : envoyé automatiquement par ton fichier. <button class="lien" type="button" id="j-rv-voir">Voir les relevés</button></p>' +
    (confirmeRV ? '<p class="alerte warn">Une saisie à la main ne sera plus remplacée par l\'import de ton fichier. <button class="btn" type="button" id="j-rv-ok">Saisir quand même</button> <button class="lien" type="button" id="j-rv-non">Annuler</button></p>'
      : '<button class="lien m-rv-corr" type="button" id="j-rv-corr">Corriger à la main</button>') + "</div>";
  if (!j.length) { z.innerHTML = '<div class="vide">Aucune opération pour l\'instant.</div>' + ligneRV; brancherRV(z); return; }
  const net = o => (+o.montant || 0) + (+o.frais || 0) * typeInfo(o.type).tresorerie;
  let mois = "", rang = 0;
  const ic = cibleJournal ? j.findIndex(o => !o.envoi && memeOrdre(o, cibleJournal)) : -1;   // (préparé) : ✏️ Corriger un PRU → cet ordre
  const lignes = j.map((o, i) => {
    const m = String(o.date).slice(0, 7), tete = m !== mois ? '<h5 class="jmois">' + esc(libMois(m, true)) + "</h5>" : ""; mois = m;
    const refaire = !o.envoi && (o.app || rang < 5); if (!o.envoi) rang++;
    const pu = (o.type === "Achat" || o.type === "Vente") && o.quantite > 0 && o.montant > 0 ? " · " + cours(net(o) / o.quantite) + "/part" : "";
    const jum = confirmeSuppr === i ? versementJumeau(j, i) : -1;
    return tete + '<div class="jr' + (o.envoi ? " envoi" : "") + (i === ic ? ' cible" id="j-cible' : "") + '"><div class="jd">' + o.date.slice(8, 10) + "/" + o.date.slice(5, 7) + "<small>" + o.date.slice(0, 4) + "</small></div>" +
      '<div class="jm"><b>' + esc(libType(o.type)) + (o.actif ? " " + esc(o.actif) : "") + (o.envoi ? '<span class="tag app">envoi…</span>' : "") + (o.date > auj ? '<span class="tag prog">programmé</span>' : "") + (o.app ? '<span class="tag app">saisi ici</span>' : "") + "</b>" +
      "<span>" + esc(o.enveloppe) + (o.quantite !== null && o.quantite !== undefined ? " · " + qteBrute(o.quantite) + " part" + (o.quantite > 1 ? "s" : "") : "") + pu + (o.frais ? " · frais " + eur(o.frais, 2) : "") + "</span></div>" +
      '<div class="jv">' + eur(o.montant, 2) + "</div>" +
      (o.envoi || (!refaire && !o.app) ? "" : '<div class="ja">' + (refaire ? '<button class="lien" type="button" data-refaire="' + i + '">Refaire</button>' : "") +
      (!o.app ? "" : confirmeSuppr !== i ? '<button class="lien danger" type="button" data-suppr="' + i + '">Supprimer</button>'
        : jum >= 0 ? '<span class="jconf">Le versement de ' + eur(j[jum].montant, 2) + ' lié reste enregistré.</span><button class="lien danger" type="button" data-suppr="' + i + '">Supprimer l\'achat seul</button><button class="lien danger" type="button" data-suppr2="' + i + '" data-jum="' + jum + '">Supprimer aussi le versement</button>'
        : '<button class="lien danger" type="button" data-suppr="' + i + '">Confirmer la suppression</button>') + "</div>") + "</div>";
  }).join("");
  const plus = A.charge ? '<p class="m-jplus">Lecture des ordres plus anciens…</p>'
    : (A.msg ? '<p class="alerte warn" role="alert">' + esc(A.msg) + "</p>" : "") + (A.suite > 0 ? '<button class="lien m-jplus" type="button" id="j-plus">Voir plus anciens</button>' : "");
  const cib = !cibleJournal ? "" : '<p class="alerte warn m-jcible">✏️ ' + (ic >= 0 ? "Ton achat " + esc(cibleJournal.actif || "") + " du " + esc(dateCourteIso(cibleJournal.date)) + " est surligné ci-dessous. S'il est faux : « Supprimer », puis ressaisis-le avec les chiffres de ton avis."
    : "Ton achat du " + esc(dateCourteIso(cibleJournal.date)) + " n'est pas dans cette liste" + (A.suite > 0 ? " : touche « Voir plus anciens » en bas." : " : corrige-le dans l'onglet Ordres de ton fichier.")) + "</p>";
  z.innerHTML = cib + '<p class="info aide">Supprimable 7 jours si saisi ici · Refaire = même opération, date du jour.</p><div class="m-jo">' + lignes + "</div>" + plus + ligneRV;
  if (ic >= 0 && !rendreJournal.vu) { rendreJournal.vu = true; setTimeout(() => { const c = z.querySelector("#j-cible"); if (c && c.scrollIntoView) c.scrollIntoView({ block: "center" }); rendreJournal.vu = false; }, 60); }
  brancherRV(z);
  if (z.querySelector("#j-plus")) z.querySelector("#j-plus").addEventListener("click", voirPlusAnciens);
  /* retire un ordre de l'affichage (données du fichier ET pages anciennes) ; renvoie de quoi le remettre si le fichier refuse */
  const retirer = (...os) => { const r = M.ref, avant = [r.journal, A.lignes], lg = os.map(o => o.ligne).filter(Boolean), part = x => os.includes(x) || (!x.envoi && lg.includes(x.ligne));   // même ligne vue dans une page ancienne : retirée aussi
    r.journal = (r.journal || []).filter(x => !part(x)); A.lignes = A.lignes.filter(x => !part(x)); return () => { [r.journal, A.lignes] = avant; }; };
  z.querySelectorAll("[data-refaire]").forEach(b => b.addEventListener("click", () => {
    const o = j[+b.dataset.refaire];
    /* v17.34 : un achat refait arrive SANS le versement (celui d'origine est une ligne à part du journal) */
    ouvrirSaisieM({ type: o.type, env: o.enveloppe, actif: o.actif || "", qte: o.quantite !== null && o.quantite !== undefined ? saisieNombre(o.quantite, 8) : "", montant: saisieNombre(o.montant, 2), frais: o.frais ? saisieNombre(o.frais, 2) : "", apport: false, refait: true, auto: false }, "ordre");
  }));
  const supprimer = async (o, quoi) => { const rep = await posterFichier({ action: "supprimer", ordre: o }); if (!rep.ok) toast((quoi ? quoi + " : " : "") + (rep.message || "Suppression impossible.")); return rep; };
  z.querySelectorAll("[data-suppr]").forEach(b => b.addEventListener("click", async () => {
    const i = +b.dataset.suppr;
    if (confirmeSuppr !== i) { confirmeSuppr = i; rendreJournal(); return; }
    confirmeSuppr = null;
    const o = j[i];
    const remettre = retirer(o);
    rendreJournal();
    toast("Suppression en cours…");
    const rep = await supprimer(o);
    if (rep.ok) { toast(rep.message || "Ordre supprimé."); oublierVerifPru(null, o); charger(true); }
    else { remettre(); if (!$f("m-saisie").hidden) rendreJournal(); }
  }));
  /* l'achat puis son versement : l'un APRÈS l'autre, le second seulement si le premier a réussi */
  z.querySelectorAll("[data-suppr2]").forEach(b => b.addEventListener("click", async () => {
    const i = +b.dataset.suppr2, k = +b.dataset.jum, o = j[i], v = j[k];
    confirmeSuppr = null;
    const remettre = retirer(o, v); rendreJournal();
    toast("Suppression en cours…");
    const r1 = await supprimer(o, "Achat");
    if (!r1.ok) { remettre(); if (!$f("m-saisie").hidden) rendreJournal(); return; }
    oublierVerifPru(null, o);
    const r2 = await supprimer(v, "Achat supprimé, mais pas le versement");
    if (r2.ok) toast("Achat et versement supprimés.");
    charger(true);
  }));
}
function brancherRV(z) {
  if (z.querySelector("#j-rv-voir")) z.querySelector("#j-rv-voir").addEventListener("click", () => ouvrirReleveVersus(true));
  if (z.querySelector("#j-rv-corr")) z.querySelector("#j-rv-corr").addEventListener("click", () => { confirmeRV = true; rendreJournal(); });
  if (z.querySelector("#j-rv-non")) z.querySelector("#j-rv-non").addEventListener("click", () => { confirmeRV = false; rendreJournal(); });
  if (z.querySelector("#j-rv-ok")) z.querySelector("#j-rv-ok").addEventListener("click", () => { confirmeRV = false; ouvrirReleveVersus(false); });
}

/* ---- Mises à jour du fichier : rappels (taux, fonds euros, Artema, appartement), nouvel actif, alertes de cours ---- */
function nomRappel(n) { return String(n || "").replace(/\s*\((bloc ci-contre|Ordres[^)]*|fixe)\)/g, "").trim(); }
function cleRappel(n) {
  if (/^Taux des livrets/.test(n)) return "taux";
  if (/fonds euros/i.test(n)) return "fondsEuros";
  if (/Artema : niveau initial/.test(n)) return "artemaInitial";
  if (/Artema : niveau actuel/.test(n)) return "artemaActuel";
  if (/^Relevé Quintessa/.test(n)) return "releve";
  if (/^Intérêts annuels/.test(n)) return "interets";
  if (/appartement/i.test(n)) return "appart";
  if (/^Versement Quintessa/.test(n)) return "versement";
  if (/^Versement programm[ée] Linxea/i.test(n)) return "lxProg";   // v20.54 : réglable dans le fichier (Paramètres › rappels), comme celui de Clément
  if (/^Versement Linxea/.test(n)) return "linxea";   // v17.23 : Clément, rappel séparé du relevé Artema
  if (/Calendrier/.test(n)) return "calendrier";
  return "";
}
function pourcent(v) { return v === null || v === undefined || v === "" ? "" : saisieNombre(v * 100, 3); }
function champ(id, lab, val, attrs) {
  return '<div class="champ"><label for="' + id + '">' + lab + '</label><input id="' + id + '" type="' + ((attrs && attrs.type) || "text") + '"' + (attrs && (attrs.type === "date" || attrs.texte) ? ' autocapitalize="' + (attrs && attrs.texte === "maj" ? "characters" : "sentences") + '"' : ' inputmode="decimal"') + ' autocomplete="off" value="' + esc(val === null || val === undefined ? "" : val) + '"' + (attrs && attrs.ph ? ' placeholder="' + esc(attrs.ph) + '"' : "") + "></div>";
}
function formReglage(k) {
  const p = (M && M.parametres) || {};
  const msg = reglageMsg[k] ? '<div class="alerte ' + reglageMsg[k][0] + '">' + esc(reglageMsg[k][1]) + "</div>" : "";
  const btn = '<button class="btn" type="submit">Enregistrer</button>';
  const rap = rappelsFichier().find(r => cleRappel(r.nom) === k) || {};
  if (k === "taux") {
    const t = p.taux || {};
    return '<form class="form reg-form" data-form="taux"><p class="info">Dernier changement le ' + frDate(t.date) + ". Saisis les nouveaux taux annoncés par l'État (en %)." + (t.place !== undefined ? " Place restante : " + t.place + " ligne(s)." : "") + "</p>" +
      champ("r-date", "Date d'effet", rap.prochaine || "", { type: "date" }) +
      '<div class="rang trois">' + (t.livretA !== null && t.livretA !== undefined ? champ("r-la", "Livret A (%)", pourcent(t.livretA)) : "") + (t.ldds !== null && t.ldds !== undefined ? champ("r-ld", "LDDS (%)", pourcent(t.ldds)) : "") + (t.lep !== null && t.lep !== undefined ? champ("r-le", "LEP (%)", pourcent(t.lep)) : "") + "</div>" + msg + btn + "</form>";
  }
  if (k === "fondsEuros") {
    const f = p.fondsEuros || {};
    // V15.15 : on peut aussi réajuster le taux simulé (et le bonus) quand on veut ; les champs partent des valeurs actuelles
    return '<form class="form reg-form" data-form="fondsEuros"><p class="info">Taux servi par Quintessa (net de frais, avant bonus et prélèvements sociaux). Tant que le vrai taux n\'est pas connu, c\'est une <b>estimation</b> que tu peux réajuster ici quand tu veux. Actuel : ' + pct(f.taux, 2, false) + " (" + (f.annee || "—") + ")" + (f.bonus ? " + bonus " + pct(f.bonus, 2, false) + (f.bonusFin ? " jusqu'au " + frDate(f.bonusFin) : "") : "") + ".</p>" +
      '<div class="rang">' + champ("r-an", "Année", f.annee || "") + champ("r-taux", "Taux net (%)", f.taux ? saisieNombre(f.taux * 100, 2) : "") + "</div>" +
      '<div class="rang">' + champ("r-bonus", "Bonus (%)", f.bonus ? saisieNombre(f.bonus * 100, 2) : "") + champ("r-bfin", "Bonus jusqu'au", f.bonusFin || "", { type: "date" }) + "</div>" + msg + btn + "</form>";
  }
  if (k === "artemaInitial") {
    const a = p.artema || {};
    return '<form class="form reg-form" data-form="artemaInitial"><p class="info">Niveau de l\'indice à la date de constatation initiale (indiqué par la banque après le 5 décembre 2026).</p>' +
      champ("r-niv", "Niveau initial", a.initial === null || a.initial === undefined ? "" : saisieNombre(a.initial, 4)) + msg + btn + "</form>";
  }
  if (k === "artemaActuel") {
    const a = p.artema || {};
    return '<form class="form reg-form" data-form="artemaActuel"><p class="info">Niveau actuel de l\'indice Artema (page de l\'indice sur le site Natixis), à saisir au rythme de ton rappel. Il fait bouger la jauge de l\'écran Artema.</p>' +
      '<div class="rang">' + champ("r-niv", "Niveau actuel", a.actuel === null || a.actuel === undefined ? "" : saisieNombre(a.actuel, 4)) + champ("r-date", "Relevé le", a.date || aujourdhuiISO(), { type: "date" }) + "</div>" + msg + btn + "</form>";
  }
  if (k === "appart") {
    const a = p.appart || {};
    return '<form class="form reg-form" data-form="appart"><p class="info">Valeur utilisée pour le patrimoine net. Par défaut, le prix d\'achat hors frais de notaire.</p>' +
      champ("r-prix", "Valeur de l'appartement (€)", a.prix ? saisieNombre(a.prix, 0) : "") + msg + btn + "</form>";
  }
  if (k === "calendrier") return '<p class="info reg-info">La liste des jours fériés d\'Euronext et de Wall Street se complète directement dans Paramètres du Sheet (colonnes « Bourses fermées »), une fois par an.</p>';
  return "";
}
function coursConnu(c) { const r = refData(); let v = r.cours[c]; (M.groupes || []).forEach(g => g.lignes.forEach(l => { if (l.code === c && l.cours) v = l.cours; })); return v; }
/** v17.34 · « Mon fichier » : la dernière valeur connue de chaque réglage (les rappels « à faire » restent dans la cloche et dans À faire) */
function valeurFichier(k) {
  const p = (M && M.parametres) || {}, n4 = v => ok(+v) && v !== "" && v !== null ? nf(0, 4).format(+v) : "";
  if (k === "taux") { const t = p.taux || {}; return [["Livret A", t.livretA], ["LDDS", t.ldds], ["LEP", t.lep]].filter(x => ok(x[1])).map(x => x[0] + " " + pct(x[1], 2, false)).join(" · "); }
  if (k === "fondsEuros") { const f = p.fondsEuros || {}; return f.taux ? pct(f.taux, 2, false) + (f.annee ? " (" + f.annee + ")" : "") + (f.bonus ? " + bonus " + pct(f.bonus, 2, false) : "") : ""; }
  if (k === "artemaInitial") { const a = p.artema || {}; return n4(a.initial) ? "niveau " + n4(a.initial) : "pas encore saisi"; }
  if (k === "artemaActuel") { const a = p.artema || {}; return n4(a.actuel) ? "niveau " + n4(a.actuel) + (a.date ? " au " + frDate(String(a.date).slice(0, 10)) : "") : "pas encore saisi"; }
  if (k === "appart") { const a = p.appart || {}; return a.prix ? eur(a.prix) : ""; }
  return "";
}
let naFichier = null;
function rendreMaj() {
  const z = $f("m-pane-maj"); const p = (M && M.parametres) || null;
  if (!p) { z.innerHTML = '<p class="info">Paramètres de ton fichier indisponibles.</p>'; return; }
  const r = refData();
  /* chaque valeur du fichier sous son nom : dernière valeur, date, « Mettre à jour » (plus de pastilles À faire / À jour : c'est la cloche) */
  const htmlVal = x => {
    const k = cleRappel(x.nom), ouvert = !!k && reglageOuvert === k, maj = !!k && (!!partielRappel(k) || !!formReglage(k) || k === "releve" || k === "artemaActuel");
    const val = k ? valeurFichier(k) : "";
    const der = x.derniere && /^\d{4}-/.test(String(x.derniere)) ? "mis à jour le " + frDate(String(x.derniere).slice(0, 10)) : x.derniere ? String(x.derniere) : "";
    const quand = !der && x.prochaine && /^\d{4}-/.test(x.prochaine) ? "prochaine le " + frDate(String(x.prochaine).slice(0, 10)) : "";
    return '<div class="rap' + (ouvert ? " ouvert" : "") + '" data-reg="' + k + '"><div class="rap-h fixe">' +
      '<span class="rap-n">' + esc(nomCourtRappel(x)) + "<small>" + esc([val, der || quand].filter(Boolean).join(" · ") || "—") + "</small></span>" +
      (maj ? '<button type="button" class="mini-btn" data-rap="' + k + '" aria-expanded="' + ouvert + '">' + (ouvert ? "Fermer" : "Mettre à jour") + "</button>" : "") + "</div>" +
      (ouvert ? '<div class="rap-c">' + formReglage(k) + "</div>" : "") + "</div>";
  };
  const tous = rappelsFichier().slice().sort((x, y) => (cleRappel(y.nom) ? 1 : 0) - (cleRappel(x.nom) ? 1 : 0));
  const alertes = M.alertes || [];
  const codesAlerte = Array.from(new Set((r.detenu || []).map(d => d.code).concat(r.actifs.filter(a => r.cours[a.code]).map(a => a.code))));
  const mAl = reglageMsg.alertes ? '<div class="alerte ' + reglageMsg.alertes[0] + '">' + esc(reglageMsg.alertes[1]) + "</div>" : "";
  const pre = alertePre || {};
  if (!naFichier) naFichier = nouvelNA("");
  z.innerHTML =
    (reglageOuvert && !rappelsFichier().some(x => cleRappel(x.nom) === reglageOuvert) && formReglage(reglageOuvert) ? '<div class="rap ouvert seul" data-reg="' + reglageOuvert + '"><div class="rap-c">' + formReglage(reglageOuvert) + "</div></div>" : "") +
    (tous.length ? '<h4 class="m-h4">Valeurs du fichier <small>les rappels à faire sont dans la cloche 🔔</small></h4><div class="raps">' + tous.map(htmlVal).join("") + "</div>" : "") +
    '<details class="maj-pli" data-reg="actif"' + (naFichier.msg && naFichier.code ? " open" : "") + '><summary>➕ Ajouter un actif <small>aussi possible pendant la saisie d\'un ordre</small></summary>' +
      htmlNouvelActif(naFichier, false) + "</details>" +
    '<details class="maj-pli" data-reg="alertes"' + (reglageMsg.alertes || alertePre || alertes.length ? " open" : "") + '><summary>🔔 Alertes de cours <small>' + (alertes.length ? alertes.length + " en veille" : "aucune") + "</small></summary>" +
      (alertes.length ? '<div class="m-liste">' + alertes.map((a, i) => {
        const c = coursConnu(a.code), declenchee = c && (a.sens === "sous" ? c < a.seuil : c > a.seuil);
        return '<div class="r"><span class="a">' + esc(a.code) + " " + (a.sens === "sous" ? "sous" : "au-dessus de") + " " + cours(a.seuil) + '</span><span class="b"><button class="lien danger" type="button" data-suppr-alerte="' + i + '">Retirer</button></span>' +
          '<span class="c">' + (c ? "cours actuel " + cours(c) : "cours inconnu") + '</span><span class="d ' + (declenchee ? "down" : "") + '">' + (declenchee ? "déclenchée" : "en veille") + "</span></div>";
      }).join("") + "</div>" : '<p class="info">Aucune alerte. Exemple : LQQ sous 9 €.</p>') +
      '<form class="form reg-form" data-form="alerte">' +
        '<div class="rang trois">' +
          '<div class="champ"><label for="al-code">Actif</label><select id="al-code">' + codesAlerte.map(c => '<option' + (c === pre.code ? " selected" : "") + ">" + esc(c) + "</option>").join("") + "</select></div>" +
          '<div class="champ"><label for="al-sens">Quand</label><select id="al-sens"><option value="sous">passe sous</option><option value="dessus">passe au-dessus</option></select></div>' +
          champ("al-seuil", "Seuil (€)", pre.seuil || "") +
        "</div>" + mAl +
        '<button class="btn ghost" type="submit">Ajouter l\'alerte</button>' +
      "</form></details>";
  alertePre = null;
  z.querySelectorAll("[data-rap]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.rap;
    if ((k === "artemaActuel" || k === "releve") && aArtema()) { fermerSaisieM(); ouvrirPointArtema(k); return; }   // même chemin que « Faire » de la cloche
    const pr = partielRappel(k); if (pr) { F = formulaire(pr); synchroniser(); paneSaisie("ordre"); return; }
    reglageOuvert = reglageOuvert === k ? null : k;
    delete reglageMsg[k];
    rendreMaj();
  }));
  z.querySelectorAll("form[data-form]").forEach(f => f.addEventListener("submit", e => { e.preventDefault(); soumettreReglage(f.dataset.form, f); }));
  z.querySelectorAll("[data-suppr-alerte]").forEach(b => b.addEventListener("click", () => {
    const liste = alertes.slice(); liste.splice(+b.dataset.supprAlerte, 1);
    envoyerReglage("alertes", { action: "alertes", alertes: liste }, null, () => { M.alertes = liste; });
  }));
  brancherNouvelActif(naFichier, (a, rep) => { naFichier = null; toast(rep.message || "Actif " + a.code + " ajouté."); rendreMaj(); signalerCloche(); charger(true); }, () => {});
}
function lireChamp(id) { const el = $f(id); return el ? el.value.trim() : ""; }
function soumettreReglage(type, form) {
  const n = id => lireNombre(lireChamp(id));
  const p = M.parametres || {};
  if (type === "taux") {
    const ids = [["r-la", "livretA"], ["r-ld", "ldds"], ["r-le", "lep"]].filter(x => $f(x[0]));
    const vals = ids.map(x => n(x[0]));
    if (!lireChamp("r-date") || !ids.length || vals.some(x => !(x >= 0 && x < 20))) { reglageMsg.taux = ["err", "Saisis la date et les taux en % (ex. 1,5)."]; rendreMaj(); return; }
    const corps = { action: "taux", date: lireChamp("r-date") };
    ids.forEach((x, i) => { corps[x[1]] = vals[i] / 100; });
    return envoyerReglage("taux", corps, form, () => { p.taux = Object.assign({}, p.taux, corps, { date: lireChamp("r-date") }); propagerTaux(corps); });
  }
  if (type === "fondsEuros") {
    const an = n("r-an"), t = n("r-taux"), bo = lireChamp("r-bonus") ? n("r-bonus") : null, bf = lireChamp("r-bfin") || null;
    if (!(an >= 2020) || !(t >= 0 && t < 20)) { reglageMsg.fondsEuros = ["err", "Saisis l'année et le taux en % (ex. 3,1)."]; rendreMaj(); return; }
    if (bo !== null && !(bo >= 0 && bo < 10)) { reglageMsg.fondsEuros = ["err", "Bonus en % entre 0 et 10 (ex. 1,3)."]; rendreMaj(); return; }
    return envoyerReglage("fondsEuros", { action: "fondsEuros", annee: an, taux: t / 100, bonus: bo === null ? null : bo / 100, bonusFin: bf }, form, () => {
      p.fondsEuros = Object.assign({}, p.fondsEuros, { annee: an, taux: t / 100 }, bo === null ? {} : { bonus: bo / 100 }, bf ? { bonusFin: bf } : {}); stock.set(cleStock("feVu"), String(Date.now())); });
  }
  if (type === "artemaInitial" || type === "artemaActuel") {
    const niv = n("r-niv");
    if (!(niv > 0)) { reglageMsg[type] = ["err", "Saisis le niveau de l'indice."]; rendreMaj(); return; }
    const ini0 = +((p.artema || {}).initial) || 0;
    if (type === "artemaActuel" && ini0 && (niv < ini0 / 3 || niv > ini0 * 3)) { reglageMsg[type] = ["err", "Niveau très loin du départ : faute de frappe ?"]; rendreMaj(); return; }
    return envoyerReglage(type, { action: "artema", quoi: type === "artemaInitial" ? "initial" : "actuel", niveau: niv, date: lireChamp("r-date") }, form);
  }
  if (type === "appart") {
    const v = n("r-prix");
    if (!(v > 1000)) { reglageMsg.appart = ["err", "Saisis une valeur en euros."]; rendreMaj(); return; }
    return envoyerReglage("appart", { action: "appart", prix: v }, form);
  }
  if (type === "actif") {
    const a = { code: lireChamp("a-code").toUpperCase(), nom: lireChamp("a-nom"), ticker: lireChamp("a-ticker").toUpperCase(), classe: lireChamp("a-classe"), zone: lireChamp("a-zone"), levier: n("a-levier") || 1, coursManuel: n("a-manuel") };
    if (!/^[A-Z0-9_]{2,12}$/.test(a.code) || !a.nom) { reglageMsg.actif = ["err", "Code (2 à 12 lettres ou chiffres) et nom obligatoires."]; rendreMaj(); return; }
    if (refData().actifs.some(x => x.code === a.code)) { reglageMsg.actif = ["err", "Le code " + a.code + " existe déjà."]; rendreMaj(); return; }
    if (!a.ticker && !(a.coursManuel > 0)) { reglageMsg.actif = ["err", "Indique un ticker Google Finance ou un cours manuel."]; rendreMaj(); return; }
    return envoyerReglage("actif", { action: "actif", actif: a }, form, () => { refData().actifs.push({ code: a.code, nom: a.nom, classe: a.classe }); });
  }
  if (type === "alerte") {
    const s = n("al-seuil"), code = lireChamp("al-code");
    if (!code || !(s > 0)) { reglageMsg.alertes = ["err", "Choisis l'actif et un seuil en euros."]; rendreMaj(); return; }
    const liste = (M.alertes || []).concat([{ code: code, sens: lireChamp("al-sens"), seuil: s }]);
    return envoyerReglage("alertes", { action: "alertes", alertes: liste }, form, () => { M.alertes = liste; });
  }
}
/** Administrateur : les taux des livrets (les mêmes pour tous) sont recopiés par le Versus dans les fichiers des autres */
async function propagerTaux(corps) {
  try {
    if (!gestionAdmin() || typeof SOURCE === "undefined" || SOURCE !== "api" || simulationM()) return;
    const rep = await envoyerApi(apiUrl(), Object.assign({ cle: stock.get(CLES.cle) }, corps, { action: "tauxLivrets" }));
    toast(rep.message || (rep.ok ? "Taux recopiés chez les autres." : "Taux non recopiés chez les autres."));
  } catch (e) { toast("Taux enregistrés chez toi, mais pas recopiés chez les autres (Versus injoignable)."); }
}
async function envoyerReglage(k, corps, form, local) {
  const btn = form ? form.querySelector('button[type="submit"]') : null;
  if (btn) { btn.disabled = true; btn.textContent = "Enregistrement…"; }
  const rep = await posterFichier(corps);
  if (rep.ok) {
    if (local) local();
    delete reglageMsg[k];
    if (k !== "alertes" && k !== "actif") reglageOuvert = null;
    toast(rep.message || "Enregistré.");
    rendreMaj(); signalerCloche();
    charger(true);
  } else {
    if (rep.erreur === "cle") { cleRefusee(rep.message); fermerSaisieM(); toast("Clé refusée par ton fichier."); if (vueMoi()) rendre(); return; }
    reglageMsg[k] = ["err", rep.message || "Erreur inattendue."];
    rendreMaj();
    if (rep.erreur === "incertain") charger(true);   // v16.83 : on relit le fichier pour voir si c'est passé
  }
}

/* ================= Missions (privé) : le million, la série de versements, les paliers (repris de Cote) ================= */
/* lot 54 (Théo : « les prochains paliers sont trop loin ; plus de récompenses liées à ce qu'on fait, sans en faire trop »)
   Paliers intermédiaires sur les familles longues, une table palier → objet (fini le « un palier sur deux »),
   régularité étalée (un objet à chacun des 3 premiers mois versés, puis tous les 2 mois versés), joker de série 1 fois par an.
   Rien de ce qui a été gagné ne se perd : les objets de la régularité gagnés jusqu'à REGLES_V1_JUSQUA (anciennes règles) restent acquis,
   et chaque objet déjà placé sur un palier reste sur ce palier ou arrive plus tôt. */
const SERIES = [3, 6, 9, 12, 18, 24, 30, 36, 48, 60, 72, 84, 96, 108, 120];   // lot 55 : + 84 et 108 (un palier chaque décembre des années 7 à 10)
const REGLES_V1_JUSQUA = "2026-11";
const REGLES_VER = "3";   // lot 54 = "2" (paliers rapprochés) ; lot 56 = "3" (nouvelles missions) : ce qui était déjà mérité arrive dans l'écran unique « Les paliers se rapprochent »   // dernier mois des anciennes règles : à caler sur le mois de mise en ligne
function cleMoisD(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); }
function moisSuivant(m, n) { return cleMoisD(new Date(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)); }
function libMois(m, long) { const i = +m.slice(5, 7) - 1; return (long ? MOIS_L[i] : MOIS[i]) + " " + m.slice(0, 4); }
function kEurP(v) { return v >= 1e6 ? F0.format(v / 1e6) + " M€" : v >= 1000 ? F0.format(v / 1000) + " k€" : F0.format(v) + " €"; }
function isoPlus(iso, ans, jours) {
  const d0 = new Date(iso + "T00:00:00"), an = d0.getFullYear() + (ans || 0);
  const d = new Date(an, d0.getMonth(), Math.min(d0.getDate(), new Date(an, d0.getMonth() + 1, 0).getDate()));   // 29/02 + 1 an = 28/02
  d.setDate(d.getDate() + (jours || 0)); return isoJour(d);
}
/* Mois de versement : un versement (n'importe quel compte, n'importe quel montant) suffit */
function serieVersements() {
  const p = ((M && M.ref) || {}).parcours || {};
  const vers = {}; (p.mois || []).forEach(x => { vers[x.m] = x.apports > 0; });
  const auj = cleMoisD(new Date());
  const debut = p.premier ? p.premier.slice(0, 7) : null;
  if (!debut) return { actuelle: 0, record: 0, moisEnCours: false, liste: [], atteintes: {} };
  const liste = [];
  for (let m = debut; m <= auj; m = moisSuivant(m, 1)) liste.push({ m: m, ok: !!vers[m] });
  let run = 0, record = 0; const atteintes = {}, jokers = {};
  liste.forEach(x => {
    if (x.ok) run++;
    else if (x.m === auj) { /* le mois en cours n'est pas fini : il ne casse rien */ }
    else if (run > 0 && !jokers[x.m.slice(0, 4)]) { jokers[x.m.slice(0, 4)] = x.m; x.joker = true; }   // lot 54 : un mois sauté par an ne casse pas la série
    else run = 0;
    if (run > record) record = run; SERIES.forEach(n => { if (run >= n && !atteintes[n]) atteintes[n] = x.m; });
  });
  const moisEnCours = !!vers[auj];
  return { actuelle: run, record, moisEnCours, liste, atteintes, jokers };
}
/* Gain de marché (bourse) et versements d'une année, à partir des relevés du soir */
function bilanAnneeM(an) {
  const h = M.historique; if (!h || !h.rows || h.rows.length < 2) return null;
  const kv = h.cols.indexOf("v"), ka = h.cols.indexOf("a"), ki = h.cols.indexOf("ip"), ks = h.cols.indexOf("isp");
  const rows = h.rows.filter(r => Math.floor(r[0] / 10000) === an);
  if (!rows.length) return null;
  const avant = h.rows.filter(r => Math.floor(r[0] / 10000) < an).pop();
  const r0 = avant || null, r1 = rows[rows.length - 1];
  const verse = r1[ka] - (r0 ? r0[ka] : 0);
  const gain = (r1[kv] - (r0 ? r0[kv] : 0)) - verse;
  const base = r0 || rows[0];
  const twr = r1[ki] / base[ki] - 1, sp = ks >= 0 ? r1[ks] / base[ks] - 1 : null;
  const mois = moisParMois().filter(x => x.an === an);
  const tri = mois.slice().sort((a, b) => b.eur - a.eur);
  return { an, verse, gain, twr, sp, meilleur: tri[0] || null, pire: tri.length > 1 ? tri[tri.length - 1] : null, fin: dateNum(r1[0]), valeurFin: r1[kv] };
}
/* Paliers : chaque famille est une suite de seuils */
/* lot 44 : le 3e champ sert enfin : true = en vitrine (le comportement d'abord), false = « Autres paliers » (replié) */
/* lot 54 : « Année en cours » (gains > versements) récompensait le fait de verser MOINS → remplacée par « Année de versements » ;
   « Argent versé » passe en vitrine (ce qu'on fait), les familles du marché restent dans « Autres paliers » */
/* lot 56 (idées validées par Théo) : Versé avant le 5, Défi d'automne, Fidèle à la règle (vitrine) ; Mois économes, Retours après une pause, Saisie propre (autres) */
const FAMILLES = [
  ["serie", "Séries de versements", true], ["vente", "Sans vendre", true], ["verse", "Argent versé en bourse", true], ["pat", "Patrimoine financier", true],
  ["jourj", "Versé avant le 5", true], ["automne", "Défi d'automne", true], ["regle", "Fidèle à la règle", true],
  ["eco", "Mois économes", false], ["retour", "Retours après une pause", false], ["propre", "Saisie propre", false],
  ["anv", "Année de versements", false], ["mois", "Mois avec un versement (au total)", false], ["annee", "Ancienneté", false],
  ["bourse", "Portefeuille bourse", false], ["gains", "Gains cumulés", false], ["fisc", "Fiscalité allégée", false]
];
function paliers() {
  const s = M.synthese || {}, p = (M.ref || {}).parcours || {}, out = [];
  const auj = isoJour(new Date()), moisAuj = cleMoisD(new Date());
  const ajoute = (groupe, id, court, titre, atteint, quand, part, reste, grand) => out.push({ groupe, id, court, titre, atteint, quand, part, reste: atteint ? "" : reste, grand: grand || court });
  /* seuils en euros : premier mois où la série dépasse le seuil */
  const parSeuil = (groupe, seuils, serie, actuel, titre, unite) => seuils.forEach(seuil => {
    const premier = serie.find(x => x.v >= seuil);
    const atteint = !!premier || actuel >= seuil;
    ajoute(groupe, groupe + seuil, kEurP(seuil).replace(" ", ""), titre(seuil), atteint, atteint ? (premier ? premier.m : moisAuj) : null,
      actuel / seuil, "encore " + eur(Math.max(0, seuil - actuel)) + (unite ? " " + unite : ""), kEurP(seuil));
  });
  const pat = seriePatrimoine().map(x => ({ m: x.an + "-" + String(x.mo).padStart(2, "0"), v: x.bourse + x.epargne }));
  parSeuil("pat", [1000, 2500, 5000, 10000, 25000, 50000, 75000, 100000, 150000, 200000, 250000, 300000, 500000, 750000, 1000000], pat, s.financier || 0, x => F0.format(x) + " € de patrimoine financier", "(bourse + épargne)");
  const h = M.historique, rows = h && h.rows ? h.rows : [];
  const kv = h ? h.cols.indexOf("v") : -1, ka = h ? h.cols.indexOf("a") : -1;
  const sh = k => rows.map(r => ({ m: String(r[0]).slice(0, 4) + "-" + String(r[0]).slice(4, 6), v: k(r) }));
  if (rows.length && kv >= 0 && ka >= 0) {
    parSeuil("bourse", [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000], sh(r => r[kv]), s.valeur || 0, x => F0.format(x) + " € en bourse");
    parSeuil("verse", [1000, 2500, 5000, 10000, 25000, 50000, 100000, 200000], sh(r => r[ka]), s.apports || 0, x => F0.format(x) + " € versés en bourse au total");
    parSeuil("gains", [500, 1000, 5000, 10000, 25000, 50000, 100000], sh(r => r[kv] - r[ka]), s.gain || 0, x => F0.format(x) + " € de gains cumulés", "de gains");
  }
  const sv = serieVersements();
  SERIES.forEach(n => {
    const atteint = sv.record >= n, quand = atteint ? sv.atteintes[n] || null : null;   // lot 54 : même calcul que la série (joker compris)
    ajoute("serie", "serie" + n, n + "M", n + " mois d'affilée avec un versement", atteint, quand, sv.actuelle / n, "série actuelle : " + sv.actuelle + " / " + n + " mois", n + " MOIS");
  });
  let total = 0; const cumul = {};
  sv.liste.forEach(x => { if (x.ok) { total++; if (!cumul[total]) cumul[total] = x.m; } });
  [12, 24, 36, 50, 75, 100, 125, 150].forEach(n => ajoute("mois", "mois" + n, n + "×", n + " mois avec un versement depuis le début", total >= n, cumul[n] || null, total / n, total + " / " + n + " mois", n + " MOIS"));
  if (p.premier) {
    const dv = derniereVenteSV(p), depuis = dv.date || p.premier;
    const jours = Math.floor((Date.now() - new Date(depuis + "T00:00:00")) / 864e5);
    (M.simple ? [] : [[3, "3M", "3 mois sans vendre"], [6, "6M", "6 mois sans vendre"], [12, "1AN", "1 an sans vendre"], [18, "18M", "18 mois sans vendre"], [24, "2ANS", "2 ans sans vendre"],
      [36, "3ANS", "3 ans sans vendre"], [48, "4ANS", "4 ans sans vendre"], [60, "5ANS", "5 ans sans vendre"]]).forEach(([mo, court, titre]) => {
      const d0 = new Date(depuis + "T00:00:00"), d = new Date(d0.getFullYear(), d0.getMonth() + mo, 1);
      d.setDate(Math.min(d0.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));   // 31/08 + 6 mois = 28/02
      const date = isoJour(d), tot = Math.round((d - new Date(depuis + "T00:00:00")) / 864e5), atteint = date <= auj;
      ajoute("vente", "vente" + mo + "-" + depuis, court, titre, atteint, atteint ? date.slice(0, 7) : null, jours / tot,
        (dv.date ? "dernière vente" + (dv.horsLevier ? " (hors levier)" : "") + " le " + frDate(dv.date) + " · " : "") + jours + " j / " + tot + " · le " + frDate(date) + " sans vente", court.replace(/(\d)([A-Z])/, "$1 $2"));
    });
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20].forEach(n => {   // lot 55 : chaque anniversaire jusqu'à 10 ans
      const date = isoPlus(p.premier, n, 0), atteint = date <= auj;
      const part = (Date.now() - new Date(p.premier + "T00:00:00")) / (new Date(date + "T00:00:00") - new Date(p.premier + "T00:00:00"));
      ajoute("annee", "annee" + n, n + "A", n + (n > 1 ? " ans" : " an") + " d'investissement", atteint, atteint ? date.slice(0, 7) : null, part, "le " + frDate(date), n + (n > 1 ? " ANS" : " AN"));
    });
  }
  ((M.ref || {}).enveloppes || []).filter(e => e.ouverture && e.statut !== "Fermé" && (e.regime === "PEA" || e.regime === "AV")).forEach(e => {
    const n = e.regime === "PEA" ? 5 : 8, date = isoPlus(e.ouverture, n, 0), atteint = date <= auj;
    const part = (Date.now() - new Date(e.ouverture + "T00:00:00")) / (new Date(date + "T00:00:00") - new Date(e.ouverture + "T00:00:00"));
    ajoute("fisc", "fisc-" + e.nom, e.regime + n, e.nom + " a " + n + " ans : fiscalité allégée", atteint, atteint ? date.slice(0, 7) : null, part, "le " + frDate(date), e.regime + " " + n + " ANS");
  });
  /* lot 54 : « Année de versements » (remplace « Année en cours ») : 6 puis 9 mois versés dans l'année civile ; 12 sur 12 reste la récompense cachée « Année parfaite » */
  { const an = moisAuj.slice(0, 4), dans = sv.liste.filter(x => x.m.slice(0, 4) === an), nb = dans.filter(x => x.ok).length;
    const jouables = 12 - +moisAuj.slice(5, 7) + (sv.moisEnCours ? 0 : 1);   // mois encore possibles cette année (le mois en cours s'il n'est pas fait)
    if (dans.length) [6, 9].forEach(n => {
      let c = 0, quand = null; dans.forEach(x => { if (x.ok && ++c === n && !quand) quand = x.m; });
      const atteint = nb >= n, manque = n - nb;
      ajoute("anv", "anv" + an + "-" + n, n + "/12", n + " mois versés en " + an, atteint, quand, nb / n,
        manque > jouables ? "hors de portée cette année · on recommence en janvier" : "encore " + manque + " mois versé" + (manque > 1 ? "s" : "") + " d'ici décembre", n + " SUR 12");
      out[out.length - 1].manque = manque > jouables ? null : manque;
    });
  }
  try { paliers56(ajoute, out); } catch (e) { /* lot 56 : données incomplètes, les autres familles restent */ }
  return out;
}
/* ================= lot 56 · nouvelles missions (idées validées par Théo) =================
   Toutes se lisent sur les données du fichier (aucun euro affiché) ; une famille sans données n'apparaît pas (profil simple, ancien script). */
const ECO_S = [1, 3, 6, 12, 24, 36], JJ_S = [3, 6, 12, 24, 36, 60], AUT_S = [1, 2, 3, 4, 5, 6, 8, 10], RET_S = [1, 2, 3, 5, 8], REG_S = [3, 6, 12, 24, 36], PROPRE_S = [10, 25, 50, 100, 200];
const JOUR_J = 5;   // « versé avant le 5 » = premier versement du mois du 1er au 5
function missions56() {
  const p = ((M && M.ref) || {}).parcours || {}, sv = serieVersements(), L = sv.liste, now = new Date(), auj = cleMoisD(now), jour = now.getDate();
  const par = {}; (p.mois || []).forEach(x => { par[x.m] = x; });
  const ap = m => +((par[m] || {}).apports) || 0;
  /* a · Mois économe : le mois verse plus que la moyenne des 6 mois d'avant (6 mois d'historique, dont au moins 3 versés).
     Un mois sans versement n'entre pas dans la moyenne : sinon une simple pause rendrait « économes » les mois normaux qui suivent. */
  const eco = [];
  L.forEach((x, i) => { if (i < 6 || !x.ok) return; const v = L.slice(i - 6, i).map(y => ap(y.m)).filter(a => a > 0); if (v.length < 3) return;
    if (ap(x.m) > v.reduce((t, a) => t + a, 0) / v.length + 1) eco.push(x.m); });
  /* b · Versé avant le 5 : série de mois dont le premier versement tombe du 1er au 5 (le jour vient des scripts perso du lot 56) */
  let jj = null;
  if (p.jours === true || (p.mois || []).some(x => typeof x.j1 === "number")) {
    let run = 0, rec = 0; const at = {};
    L.forEach(x => {
      const j1 = (par[x.m] || {}).j1, tot = x.ok && typeof j1 === "number" && j1 <= JOUR_J;
      if (tot) run++; else if (x.m === auj && jour <= JOUR_J) { /* encore possible ce mois-ci */ } else run = 0;
      if (run > rec) rec = run; JJ_S.forEach(n => { if (run >= n && !at[n]) at[n] = x.m; });
    });
    const j1 = (par[auj] || {}).j1;
    jj = { run, rec, at, fait: typeof j1 === "number" && j1 <= JOUR_J, possible: jour <= JOUR_J };
  }
  /* e · Défi d'automne : un versement en octobre, novembre et décembre de la même année */
  const ans = {}; L.forEach(x => { const mo = +x.m.slice(5, 7); if (mo < 10) return; const a = x.m.slice(0, 4); (ans[a] = ans[a] || { n: 0, l: [] }); if (x.ok) { ans[a].n++; ans[a].l.push(mo); } });
  const aut = Object.keys(ans).filter(a => ans[a].n === 3).sort().map(a => a + "-12");
  const moA = now.getMonth() + 1, anA = auj.slice(0, 4), cur = ans[anA] || { n: 0, l: [] };
  const autRate = moA >= 10 && L.some(x => +x.m.slice(5, 7) >= 10 && x.m.slice(0, 4) === anA && x.m < auj && !x.ok) || (moA >= 10 && !L.some(x => x.m === anA + "-10"));
  /* g · Retours : après un mois sans versement, 3 mois versés d'affilée */
  const ret = []; for (let i = 3; i < L.length; i++) if (!L[i - 3].ok && L[i].ok && L[i - 1].ok && L[i - 2].ok) ret.push(L[i].m);
  let pause = -1; L.forEach((x, i) => { if (!x.ok && x.m !== auj) pause = i; });
  const apres = pause >= 0 ? L.slice(pause + 1).filter(x => x.ok).length : 0, enRetour = pause >= 0 && apres < 3;
  /* c · Fidèle à la règle : les achats du bloc levier du mois suivent l'apport conseillé par le signal (noté chaque soir par SignalLevier depuis le lot 56) */
  let regle = null; const g = M && M.signal, cons = g && g.conseils && typeof g.conseils === "object" ? g.conseils : null;
  if (cons && Object.keys(cons).length && (p.mois || []).some(x => x.ach !== undefined)) {
    const fid = [];
    Object.keys(cons).sort().forEach(m => {
      if (m > auj) return; const x = par[m] || {}, c = (cons[m] || []).map(Number).concat(m === auj && apportSignal(g) !== null ? [apportSignal(g)] : []), lev = (x.lev || []).map(Number);   // lot 67 : le mois en cours accepte aussi l'apport de la règle du jour
      if (!(x.ach > 0) || !c.length) return;
      if (lev.every(l => c.includes(l)) && (lev.length > 0 || c.includes(0))) fid.push(m);
    });
    const c0 = (cons[auj] || []).map(Number), ap = apportSignal(g);   // lot 67 : « ce mois-ci » = l'apport de la règle du jour (alarme → ×1, hors marché → cash)
    regle = { fid, conseil: ap !== null ? ap : c0.length ? c0[c0.length - 1] : null, fait: fid.includes(auj) };
  }
  /* d · Saisie propre : avis d'opéré saisis depuis l'app sans correction (compteur des scripts perso du lot 56) */
  const sp = p.saisie && typeof p.saisie.record === "number" ? p.saisie : null;
  return { eco, jj, aut, autCur: { n: cur.n, rate: autRate, mo: moA }, ret, enRetour, apres, aPause: pause >= 0, regle, sp };
}
function paliers56(ajoute, out) {
  if (!M) return;
  const X = missions56(), moisAuj = cleMoisD(new Date()), der = () => out[out.length - 1];
  const fixe = (mr, chemin) => { const x = der(); x.mr = mr; if (chemin) x.chemin = chemin; };
  const s = (n, mot) => n + " " + mot + (n > 1 && !/s$/.test(mot) ? "s" : "");
  // b · Versé avant le 5
  if (X.jj) JJ_S.forEach(n => {
    ajoute("jourj", "jourj" + n, n + "M", n + " mois d'affilée versés d'ici le " + JOUR_J, X.jj.rec >= n, X.jj.at[n] || null, X.jj.run / n,
      "série actuelle : " + X.jj.run + " / " + n + " mois" + (X.jj.fait ? " · ce mois-ci ✓" : X.jj.possible ? " · verse d'ici le " + JOUR_J : ""), n + " MOIS");
    const r = Math.max(1, n - X.jj.run); fixe(r, "encore " + s(r, "mois") + " versé" + (r > 1 ? "s" : "") + " d'ici le " + JOUR_J);
  });
  // e · Défi d'automne
  { const nb = X.aut.length, c = X.autCur, enJeu = c.mo >= 10 && !c.rate && c.n < 3;
    const mr = enJeu ? 3 - c.n : 12 - c.mo + 1, che = enJeu ? "encore " + s(3 - c.n, "mois") + " (oct. · nov. · déc.)" : "en oct., nov. et déc.";
    const etat = enJeu ? "cette année : " + c.n + " / 3 (oct. · nov. · déc.)" : c.mo >= 10 && c.rate ? "raté cette année · on recommence en octobre" : "à jouer en octobre, novembre et décembre";
    if (L56(X)) AUT_S.forEach(n => {
      ajoute("automne", "automne" + n, n + "×", n === 1 ? "Défi d'automne : un versement en octobre, novembre et décembre" : "Défi d'automne réussi " + n + " fois", nb >= n, X.aut[n - 1] || null,
        (nb + (enJeu ? c.n / 3 : 0)) / n, etat, n === 1 ? "AUTOMNE" : n + " AUTOMNES");
      fixe(n === nb + 1 ? mr : 99, n === nb + 1 ? che : "réussi " + nb + " / " + n + " fois");
    }); }
  // a · Mois économes
  if (L56(X)) ECO_S.forEach(n => {
    ajoute("eco", "eco" + n, n + "×", n === 1 ? "Un mois économe : plus versé que ta moyenne des 6 mois d'avant" : n + " mois économes (plus versé que ta moyenne des 6 mois d'avant)", X.eco.length >= n, X.eco[n - 1] || null,
      X.eco.length / n, X.eco.length + " / " + n + " mois économes", n + " MOIS");
    fixe(99, n === X.eco.length + 1 ? "verse plus que ta moyenne" : X.eco.length + " / " + n + " mois");
  });
  // g · Retours après une pause (seulement après un premier mois sans versement)
  if (X.aPause || X.ret.length) RET_S.forEach(n => {
    ajoute("retour", "retour" + n, n + "×", n === 1 ? "Un retour : 3 mois versés d'affilée après un mois sans versement" : n + " retours après une pause", X.ret.length >= n, X.ret[n - 1] || null,
      (X.ret.length + (X.enRetour ? X.apres / 3 : 0)) / n, X.enRetour ? "retour en cours : " + X.apres + " / 3 mois versés" : X.ret.length + " / " + n + " retours", n === 1 ? "RETOUR" : n + " RETOURS");
    const ici = X.enRetour && n === X.ret.length + 1;
    fixe(ici ? 3 - X.apres : 99, ici ? "encore " + s(3 - X.apres, "mois") + " versé" + (3 - X.apres > 1 ? "s" : "") : X.ret.length + " / " + n + " retours");
  });
  // c · Fidèle à la règle (Théo : signal levier)
  if (X.regle) REG_S.forEach(n => {
    const f = X.regle.fid, r = Math.max(1, n - f.length);
    ajoute("regle", "regle" + n, n + "M", n + " mois où tes achats du levier suivent l'apport conseillé", f.length >= n, f[n - 1] || null, f.length / n,
      f.length + " / " + n + " mois" + (X.regle.fait ? " · ce mois-ci ✓" : X.regle.conseil !== null ? " · ce mois-ci : " + (X.regle.conseil === 0 ? "pas d'achat de levier (cash)" : "achat ×" + X.regle.conseil) : ""), n + " MOIS");
    fixe(r, "encore " + s(r, "mois"));
  });
  // d · Saisie propre
  if (X.sp) PROPRE_S.forEach(n => {
    const at = X.sp.at || {}, k = Math.max(1, n - (X.sp.n || 0));
    ajoute("propre", "propre" + n, String(n), n + " avis d'opéré saisis depuis l'appli (une correction met la série en pause)", X.sp.record >= n, at[n] || (X.sp.record >= n ? moisAuj : null), (X.sp.n || 0) / n,
      "série actuelle : " + (X.sp.n || 0) + " / " + n + " avis", n + " AVIS");
    fixe(99, "encore " + s(k, "avis"));
  });
}
function L56(X) { try { return serieVersements().liste.length > 0; } catch (e) { return false; } }
/* le plus haut palier franchi et le suivant, par famille */
function paliersCles(liste, familles) {
  return liste.filter((x, i) => familles.includes(x.groupe) &&
    (x.atteint ? !liste.slice(i + 1).some(y => y.groupe === x.groupe && y.atteint) : !liste.slice(0, i).some(y => y.groupe === x.groupe && !y.atteint)));
}
/* fête d'un palier franchi : une seule fois par palier et par appareil (au premier lancement, on note sans fêter) */
/* ================= Récompenses de Moi (privées : calculées et gardées sur cet appareil) =================
   Une récompense tous les deux paliers de chaque famille, et toujours une sur le dernier palier.
   Six sortes d'objets : afficheur, thème, courbe, fête, emblème, titre. Plus des récompenses cachées. */
// [id, nom, type de rendu, famille d'afficheur]
const AFFICHEURS = [
  ["classique", "Palettes", "palette", "Palettes"], ["laiton", "Laiton", "palette", "Palettes"], ["calc", "Calculatrice", "seg", "Segments"],
  ["ticket", "Ticket de caisse", "ticket", "Papier"], ["compteur", "Compteur", "tambour", "Rouleaux"], ["led", "LED de gare", "matrice", "Matrice"],
  ["billet", "Billet", "billet", "Papier"], ["neon", "Néon", "palette", "Lumière"], ["nixie", "Nixie", "palette", "Lumière"],
  ["carte", "Carte black", "carte", "Métal"], ["lingot", "Lingot", "palette", "Métal"], ["prisme", "Prisme", "palette", "Lumière"],
  ["terminal", "Terminal", "palette", "Écran"], ["reveil", "Réveil", "seg", "Segments"],
  ["paillettes", "Paillettes", "palette", "Lumière"]   // lot 55 · vivant : des éclats passent sur les chiffres (9 ans d'investissement)
];
// [id, nom, couleur d'accent, fond de la carte du haut]
const THEMES_M = [
  ["classique", "Classique", null, null],
  ["minuit", "Minuit", "#7FB2FF", "linear-gradient(150deg, #0A1430, #17306A 62%, #0C1838)"],
  ["emeraude", "Émeraude", "#34D399", "linear-gradient(150deg, #04241D, #0F5743 60%, #062C23)"],
  ["bordeaux", "Bordeaux", "#FF7A93", "linear-gradient(150deg, #26050D, #631426 60%, #2C0710)"],
  ["glacier", "Glacier", "#67E8F9", "linear-gradient(150deg, #071F29, #1A5B6E 60%, #0A2733)"],
  ["carbone", "Carbone", "#E5E7EB", "repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0 2px, transparent 2px 6px), linear-gradient(150deg, #141416, #2A2A2E 60%, #111113)"],
  ["or", "Or", "#F5C542", "radial-gradient(120% 90% at 85% 0%, rgba(245,197,66,.35), transparent 60%), linear-gradient(150deg, #171004, #3D2C0B 60%, #140E04)"],
  ["aurore", "Aurore", "#FFB37A", "linear-gradient(150deg, #241036, #6E2550 55%, #A64E2A)"],
  // V15.4 · gagnés par la régularité
  ["lagon", "Lagon", "#5EEAD4", "linear-gradient(150deg, #032A2E, #0E6B6B 60%, #04363A)"],
  ["lavande", "Lavande", "#C4B5FD", "linear-gradient(150deg, #1B1433, #43307A 60%, #201843)"],
  ["sahara", "Sahara", "#FBBF77", "linear-gradient(150deg, #2B1806, #7A4A17 60%, #3A220A)"],
  ["foret", "Forêt", "#86EFAC", "linear-gradient(150deg, #071A0E, #1E4D2B 60%, #0A2413)"],
  ["corail", "Corail", "#FF9B85", "linear-gradient(150deg, #2E0D0A, #7A2E24 60%, #3A120E)"],
  ["acier", "Acier", "#A5B4C8", "linear-gradient(150deg, #10151C, #2F3B4C 60%, #141A22)"],
  ["cerise", "Cerise", "#FF6FA8", "linear-gradient(150deg, #2A0618, #6E1A45 60%, #33081D)"],
  ["ocean", "Océan", "#60A5FA", "linear-gradient(160deg, #031025, #0B3B78 55%, #0E5A8A)"],
  ["volcan", "Volcan", "#FF6B3D", "radial-gradient(110% 80% at 50% 110%, rgba(255,107,61,.45), transparent 60%), linear-gradient(150deg, #120707, #2E0E0A 60%, #170807)"],
  ["menthe", "Menthe", "#6EE7B7", "linear-gradient(150deg, #06201A, #145243 60%, #08281F)"],
  ["nuit-etoilee", "Nuit étoilée", "#FDE68A", "radial-gradient(1px 1px at 20% 30%, #fff 50%, transparent), radial-gradient(1px 1px at 70% 20%, #fff 50%, transparent), radial-gradient(1px 1px at 45% 70%, #fff 50%, transparent), linear-gradient(160deg, #050816, #121A3A 60%, #070B1F)"],
  ["platine", "Platine", "#F1F5F9", "radial-gradient(120% 90% at 85% 0%, rgba(241,245,249,.25), transparent 60%), linear-gradient(150deg, #15171B, #3A3F47 60%, #17191D)"],
  // lot 54 · prestige (750 k€ de patrimoine)
  ["diamant-noir", "Diamant noir", "#E0E7FF", "radial-gradient(120% 90% at 85% 0%, rgba(224,231,255,.28), transparent 60%), repeating-linear-gradient(120deg, rgba(255,255,255,.03) 0 1px, transparent 1px 9px), linear-gradient(150deg, #050507, #1C1C26 60%, #08080B)"],
  // lot 55 · pour boucher les longs trous après 5 ans (5e champ « vivant » = le fond bouge doucement)
  ["crepuscule", "Crépuscule", "#FDA4AF", "radial-gradient(130% 80% at 50% 115%, rgba(251,146,60,.45), transparent 60%), linear-gradient(170deg, #120A2A, #3B1D5C 55%, #7A2E4F)"],
  ["ambre", "Ambre", "#FBBF24", "radial-gradient(110% 90% at 15% 0%, rgba(251,191,36,.30), transparent 60%), linear-gradient(150deg, #1E1003, #5C3507 60%, #2A1704)"],
  ["opale", "Opale", "#E9D5FF", "linear-gradient(120deg, #1B2A4A, #3E2C63, #1E4B5A, #4A2A4F, #1B2A4A)", "vivant"],
  // lot 56 · nouvelles missions (Mois économes, Défi d'automne)
  ["prairie", "Prairie", "#A3E635", "radial-gradient(120% 80% at 20% 0%, rgba(163,230,53,.28), transparent 60%), linear-gradient(150deg, #0D1A05, #2C4A10 60%, #12210A)"],
  ["automne", "Automne", "#F59E0B", "radial-gradient(110% 80% at 85% 110%, rgba(234,88,12,.40), transparent 60%), linear-gradient(150deg, #1F0F05, #5A2A0C 55%, #3B1A08)"],
  // lot 62 · secrets des journées folles (invisibles tant qu'ils ne sont pas gagnés)
  ["brasier", "Brasier", "#FF8A3D", "radial-gradient(120% 70% at 50% 125%, rgba(255,110,30,.60), transparent 62%), radial-gradient(55% 40% at 82% 112%, rgba(255,200,80,.32), transparent 70%), radial-gradient(1.5px 1.5px at 18% 70%, #FFB347 50%, transparent), radial-gradient(1.5px 1.5px at 66% 58%, #FFD08A 50%, transparent), radial-gradient(1px 1px at 40% 40%, #FF9A4D 50%, transparent), linear-gradient(170deg, #0B0505, #2A0A06 55%, #4A1408)"],
  ["bouquet", "Bouquet final", "#5EEAD4", "radial-gradient(1.5px 1.5px at 14% 24%, #FF6FA8 50%, transparent), radial-gradient(1.5px 1.5px at 36% 12%, #5EEAD4 50%, transparent), radial-gradient(1px 1px at 61% 28%, #FFFFFF 50%, transparent), radial-gradient(1.5px 1.5px at 84% 18%, #C4B5FD 50%, transparent), radial-gradient(1px 1px at 26% 52%, #A3E635 50%, transparent), radial-gradient(1px 1px at 74% 60%, #7FB2FF 50%, transparent), radial-gradient(110% 60% at 50% -15%, rgba(94,234,212,.30), transparent 60%), radial-gradient(80% 50% at 85% 0%, rgba(163,230,53,.18), transparent 60%), linear-gradient(170deg, #040A1A, #0B2240 60%, #06122A)"],
  ["phenix", "Phénix", "#FFB347", "linear-gradient(120deg, #1E0805, #6E1E0B, #B4501C, #E0902E, #6E1E0B, #1E0805)", "vivant"]
];
// [id, nom, couleur (null = celle du thème), effet de la courbe]
// lot 44 : noms affichés dédoublonnés (les identifiants stockés ne changent pas)
const COURBES_M = [["classique", "Classique", null, null], ["etincelles", "Étincelles", null, "etincelles"], ["or", "Fil d'or", "#E8B931", "halo"],
  ["neon", "Néon rose", "#FF4FD8", "halo"], ["comete", "Queue de comète", "#2FD1C0", "comete"], ["flammes", "Flammes", "#FF7A1A", "flammes"],
  ["menthe", "Trait menthe", "#34D399", null], ["corail", "Trait corail", "#FF7F6B", null], ["lavande", "Halo lavande", "#A78BFA", "halo"], ["glace", "Glace", "#7DD3FC", "etincelles"],
  ["rubis", "Rubis", "#F43F5E", "halo"], ["soleil", "Soleil", "#FACC15", "comete"], ["plasma", "Plasma", "#22D3EE", "halo"], ["braise", "Braise", "#F97316", "etincelles"], ["argent", "Argent", "#CBD5E1", "comete"],
  ["aurore", "Aurore boréale", "#7CF5C4", "comete"],   // lot 54 · prestige (15 ans)
  ["pulsar", "Pulsar", "#F0ABFC", "pulsar"], ["cuivre", "Cuivre", "#D97706", "comete"],
  ["jade", "Jade", "#10B981", "halo"], ["nacre", "Nacre", "#FBCFE8", "etincelles"]];   // lot 56 · Mois économes, anniversaire surprise   // lot 55 · Pulsar vivant : une lueur court le long de la courbe
// [id, nom, aperçu, style passé à confettis()]
const FETES_M = [["confettis", "Confettis", "🎊", null], ["damier", "Damier", "🏁", "damier"], ["feu", "Feu d'artifice", "🎆", "feu"], ["billets", "Pluie de billets", "💸", "billets"],
  ["lingots", "Lingots", "🪙", "lingots"], ["etoiles", "Étoiles", "✨", "etoiles"], ["fusees", "Fusées", "🚀", "fusees"],
  ["ballons", "Ballons", "🎈", ["🎈", "🎈", "🎉", "🎈"]], ["fleurs", "Pétales", "🌸", ["🌸", "🌼", "🌷", "🌸"]], ["coeurs", "Cœurs", "💚", ["💚", "💙", "💜", "💛"]], ["neige", "Flocons", "❄️", ["❄️", "❄️", "✨", "❄️"]],
  ["trefles", "Trèfles", "🍀", ["🍀", "🍀", "✨", "🌿"]], ["diamants", "Diamants", "💎", ["💎", "💎", "✨", "💍"]], ["taureaux", "Taureaux", "🐂", ["🐂", "📈", "🐂", "💹"]], ["champagne", "Champagne", "🍾", ["🍾", "🥂", "✨", "🎉"]],
  ["feudor", "Gerbes d'or", "🎇", ["🎇", "✨", "🌟", "🎇"]],   // lot 54 · prestige (150 mois versés)
  ["meteores", "Météores", "☄️", "meteores"],
  ["aube", "Lever de soleil", "🌅", ["🌅", "☀️", "✨", "🌤️"]], ["feuilles", "Feuilles d'automne", "🍂", ["🍂", "🍁", "🍂", "🌰"]],
  ["bouquet", "Bouquet final", "🎆", ["🎆", "✨", "🎊", "🎆"]]];   // lot 62 · secret « Bouquet final »   // lot 56   // lot 55 · fête spéciale : des traînées lumineuses traversent l'écran
const EMBLEMES_M = [["pousse", "Pousse", "🌱"], ["abeille", "Abeille", "🐝"], ["hibou", "Hibou", "🦉"], ["tortue", "Tortue", "🐢"], ["renard", "Renard", "🦊"],
  ["aigle", "Aigle", "🦅"], ["lion", "Lion", "🦁"], ["dragon", "Dragon", "🐉"], ["couronne", "Étoile", "⭐"], ["taureau", "Taureau", "🐂"],
  ["fourmi", "Petite fourmi", "🐜"], ["ecureuil", "Écureuil", "🐿️"], ["castor", "Castor", "🦫"], ["dauphin", "Dauphin", "🐬"], ["loup", "Loup", "🐺"],
  ["chene", "Chêne", "🌳"], ["boussole", "Boussole", "🧭"], ["ancre", "Ancre", "⚓"], ["phare", "Phare", "🗼"], ["comete-e", "Comète", "☄️"],
  ["montagne", "Montagne", "⛰️"],   // lot 54 · prestige (5 ans sans vendre)
  ["sablier", "Sablier", "⏳"], ["sequoia", "Séquoia", "🌲"], ["baleine", "Baleine", "🐋"],
  ["tirelire", "Tirelire", "🐷"], ["matin", "Réveil matin", "⏰"], ["erable", "Feuille d'érable", "🍁"], ["arcenciel", "Arc-en-ciel", "🌈"], ["cible", "Cible", "🎯"], ["plume", "Plume", "✒️"],
  ["montagnes", "Montagnes russes", "🎢"],
  ["camion", "Camion de pompiers", "🚒"]];   // lot 62 c · secret « Pompier de service »   // lot 62 · secret   // lot 56   // lot 55
const TITRES_M = [["investisseur", "Investisseur"], ["metronome", "Le Métronome"], ["diamant", "Main de diamant"], ["batisseur", "Bâtisseur"], ["rentier", "Rentier"],
  ["veteran", "Vétéran"], ["optimiseur", "Optimiseur fiscal"], ["legende", "Légende"], ["millionnaire", "Millionnaire"], ["increvable", "Increvable"],
  ["fourmi", "La Fourmi"], ["regulier", "Régulier"], ["horloger", "L'Horloger"], ["patient", "Patient"], ["capitaine", "Capitaine"],
  ["stratege", "Stratège"], ["marathonien", "Marathonien"], ["sage", "Le Sage"], ["roc", "Le Roc"], ["maitre", "Maître du temps"],
  ["inebranlable", "L'Inébranlable"],   // lot 54 · prestige (120 mois d'affilée)
  ["pilier", "Le Pilier"], ["infatigable", "L'Infatigable"],
  ["econome", "L'Économe"], ["matinal", "Le Matinal"], ["toujourla", "Toujours là"], ["discipline", "Le Discipliné"], ["scribe", "Le Scribe"],
  ["survivant", "Survivant du brasier"],
  ["pompier", "Pompier de service"]];   // lot 62 c · secret   // lot 62 · secret   // lot 56   // lot 55
const SORTES = [["aff", "Afficheur", "🔢", "afficheur"], ["theme", "Thème", "🎨", "themeM"], ["courbe", "Courbe", "📈", "courbe"],
  ["fete", "Fête", "🎉", "fete"], ["emb", "Emblème", "🛡️", "emb"], ["titre", "Titre", "🏷️", "titre"]];
const CATALOGUE = { aff: AFFICHEURS, theme: THEMES_M, courbe: COURBES_M, fete: FETES_M, emb: EMBLEMES_M, titre: TITRES_M };
const BASE_M = { aff: "classique", theme: "classique", courbe: "classique", fete: "confettis", emb: "pousse", titre: "investisseur" };
/* Anciennes règles (jusqu'au lot 53) : la k-ième case va au k-ième palier pair (2e, 4e…), la dernière au dernier palier.
   lot 54 : ne sert plus que pour la Fiscalité (le nombre de paliers dépend du nombre d'enveloppes) ; les autres familles passent par REC_PAL. */
const REC_FAM_V1 = {
  pat: [[["aff", "led"]], [["aff", "neon"]], [["aff", "nixie"]], [["theme", "or"], ["courbe", "or"]], [["aff", "lingot"]], [["aff", "prisme"]], [["emb", "couronne"], ["titre", "millionnaire"]]],
  serie: [[["aff", "laiton"]], [["emb", "abeille"], ["fete", "damier"]], [["theme", "bordeaux"]], [["titre", "metronome"]]],
  vente: [[["theme", "minuit"]], [["emb", "tortue"], ["titre", "diamant"]]],
  gainsAn: [[["fete", "feu"]]],
  bourse: [[["aff", "ticket"]], [["theme", "emeraude"]], [["theme", "carbone"], ["emb", "lion"]], [["emb", "dragon"], ["titre", "legende"]]],
  verse: [[["aff", "calc"]], [["aff", "billet"], ["fete", "billets"]], [["titre", "batisseur"]]],
  gains: [[["courbe", "etincelles"]], [["aff", "carte"]], [["fete", "lingots"]], [["titre", "rentier"]]],
  mois: [[["aff", "compteur"]], [["emb", "renard"], ["courbe", "comete"]], [["emb", "aigle"]]],
  annee: [[["emb", "hibou"]], [["theme", "glacier"]], [["titre", "veteran"]]],
  fisc: [[["courbe", "neon"]], [["titre", "optimiseur"]]]
};
/* lot 54 · une table palier → objets (la clé = famille + seuil). Chaque objet déjà placé reste sur son palier ou arrive plus tôt
   (Damier : 18 → 12 mois d'affilée ; Prisme : 750 k€ → 500 k€) ; les nouveaux paliers prennent les 16 derniers objets de la régularité
   et 5 objets de prestige pour les paliers lointains. Comportement d'abord : séries, sans vendre, argent versé, mois versés. */
const REC_PAL = {
  serie3: [["courbe", "braise"]], serie6: [["aff", "laiton"]], serie9: [["emb", "phare"]], serie12: [["fete", "damier"]], serie18: [["emb", "abeille"]], serie24: [["titre", "marathonien"]],
  serie36: [["theme", "bordeaux"]], serie48: [["theme", "ocean"]], serie60: [["titre", "metronome"]], serie72: [["titre", "maitre"]], serie120: [["titre", "inebranlable"]],
  vente6: [["emb", "ancre"]], vente12: [["theme", "minuit"]], vente18: [["courbe", "argent"]], vente24: [["titre", "roc"]], vente36: [["emb", "tortue"], ["titre", "diamant"]], vente60: [["emb", "montagne"]],
  verse2500: [["theme", "menthe"]], verse5000: [["fete", "champagne"]], verse10000: [["aff", "calc"]], verse25000: [["theme", "volcan"]], verse50000: [["aff", "billet"], ["fete", "billets"]],
  verse100000: [["theme", "platine"]], verse200000: [["titre", "batisseur"]],
  anv9: [["fete", "feu"]],
  mois24: [["aff", "compteur"]], mois50: [["emb", "renard"], ["courbe", "comete"]], mois75: [["theme", "nuit-etoilee"]], mois100: [["emb", "aigle"]], mois150: [["fete", "feudor"]],
  annee1: [["emb", "comete-e"]], annee2: [["emb", "hibou"]], annee3: [["titre", "sage"]], annee5: [["theme", "glacier"]], annee10: [["titre", "veteran"]], annee15: [["courbe", "aurore"]],
  pat2500: [["fete", "taureaux"]], pat10000: [["aff", "led"]], pat50000: [["aff", "neon"]], pat100000: [["aff", "nixie"]], pat200000: [["theme", "or"], ["courbe", "or"]],
  pat300000: [["aff", "lingot"]], pat500000: [["aff", "prisme"]], pat750000: [["theme", "diamant-noir"]], pat1000000: [["emb", "couronne"], ["titre", "millionnaire"]],
  bourse5000: [["aff", "ticket"]], bourse25000: [["theme", "emeraude"]], bourse100000: [["theme", "carbone"], ["emb", "lion"]], bourse500000: [["emb", "dragon"], ["titre", "legende"]],
  gains1000: [["courbe", "etincelles"]], gains10000: [["aff", "carte"]], gains50000: [["fete", "lingots"]], gains100000: [["titre", "rentier"]],
  // lot 55 · après 5 ans il restait des trous jusqu'à 22 mois : un anniversaire chaque janvier, une série chaque décembre (années 6 à 9)
  annee6: [["emb", "sablier"]], annee7: [["theme", "crepuscule"]], annee8: [["courbe", "pulsar"]], annee9: [["aff", "paillettes"]],
  serie84: [["titre", "pilier"]], serie96: [["emb", "sequoia"]], serie108: [["fete", "meteores"]],
  // lot 56 · nouvelles missions (peu d'objets par famille : pas d'inflation pour un épargnant régulier)
  eco1: [["emb", "tirelire"]], eco3: [["courbe", "jade"]], eco6: [["titre", "econome"]], eco12: [["theme", "prairie"]],
  jourj3: [["emb", "matin"]], jourj12: [["titre", "matinal"]], jourj24: [["fete", "aube"]],
  automne1: [["emb", "erable"]], automne3: [["theme", "automne"]], automne5: [["fete", "feuilles"]],
  retour1: [["emb", "arcenciel"]], retour3: [["titre", "toujourla"]],
  regle3: [["emb", "cible"]], regle12: [["titre", "discipline"]],
  propre10: [["emb", "plume"]], propre50: [["titre", "scribe"]],
  annee4: [["courbe", "nacre"]]   // lot 56 · Objet surprise : l'anniversaire de la 4e année n'avait pas d'objet
};
/* lot 56 · Objet surprise : chaque anniversaire du premier ordre donne un objet, gardé secret jusqu'au jour J (🎁 « Surprise ») */
function estSurprise(t, id) { return Object.keys(REC_PAL).some(k => /^annee\d+$/.test(k) && REC_PAL[k].some(r => r[0] === t && r[1] === id)); }
function surpriseCachee(t, id) { return estSurprise(t, id) && !(M && etatObjets().ok.has(cleObj(t, id))); }
/* lot 55 · « Année de versements » : à partir de la 6e année civile où tu verses au moins 6 mois, un objet à ce palier 6/12 (vers juin) */
const ANV6_RANG = { 6: [["theme", "ambre"]], 7: [["titre", "infatigable"]], 8: [["emb", "baleine"]], 9: [["courbe", "cuivre"]], 10: [["theme", "opale"]] };
/** lot 55 · années civiles (avant l'an donné) avec au moins 6 mois versés */
function anneesA6(avant) { return Object.entries(versesParAn()).filter(([a, n]) => (!avant || a < avant) && n >= 6).map(([a]) => a).sort(); }
/* V15.4 · Régularité : chaque mois où tu verses débloque l'objet suivant de cette liste (les mois versés, pas forcément d'affilée)
   lot 54 : les 33 premiers objets seulement (RG), un à chacun des 3 premiers mois versés puis un tous les 2 mois versés ; les 16 derniers vont aux paliers.
   Ce qui a été gagné avec l'ancienne règle (un par mois, jusqu'à REGLES_V1_JUSQUA) reste acquis et la suite repart de là. */
const REGULARITE_M = [["emb", "fourmi"], ["courbe", "menthe"], ["theme", "lagon"], ["titre", "fourmi"], ["fete", "ballons"], ["emb", "ecureuil"], ["courbe", "corail"], ["theme", "lavande"],
  ["titre", "regulier"], ["fete", "fleurs"], ["emb", "castor"], ["courbe", "lavande"], ["theme", "sahara"], ["titre", "horloger"], ["fete", "coeurs"], ["emb", "dauphin"], ["courbe", "glace"],
  ["theme", "foret"], ["titre", "patient"], ["fete", "neige"], ["emb", "loup"], ["courbe", "rubis"], ["theme", "corail"], ["titre", "capitaine"], ["fete", "trefles"], ["emb", "chene"],
  ["courbe", "soleil"], ["theme", "acier"], ["titre", "stratege"], ["fete", "diamants"], ["emb", "boussole"], ["courbe", "plasma"], ["theme", "cerise"], ["titre", "marathonien"],
  ["fete", "taureaux"], ["emb", "ancre"], ["courbe", "braise"], ["theme", "ocean"], ["titre", "sage"], ["emb", "phare"], ["theme", "menthe"], ["courbe", "argent"], ["theme", "volcan"],
  ["fete", "champagne"], ["titre", "roc"], ["emb", "comete-e"], ["theme", "nuit-etoilee"], ["theme", "platine"], ["titre", "maitre"]];
function moisVerses() { try { return serieVersements().liste.filter(x => x.ok).length; } catch (e) { return 0; } }
const REGUL_M0 = 3, RG = REGULARITE_M.slice(0, 33);
function regulPas(n) { return n <= REGUL_M0 ? n : REGUL_M0 + Math.floor((n - REGUL_M0) / 2); }
/** lot 54 · la régularité : objets gagnés (avec le mois), le prochain et à quel mois versé il tombe */
function regulInfo() {
  let ok = []; try { ok = serieVersements().liste.filter(x => x.ok); } catch (e) { ok = []; }
  const n = ok.length, nc = Math.min(REGULARITE_M.length, ok.filter(x => x.m <= REGLES_V1_JUSQUA).length), a = Math.min(nc, RG.length);
  const gagnes = k => Math.min(RG.length, a + regulPas(Math.max(k, nc)) - regulPas(nc));
  const gains = REGULARITE_M.slice(0, nc).map((r, i) => ({ r, m: ok[i].m, mois: i + 1 }));
  for (let k = nc + 1, c = a; k <= n; k++) for (const g = gagnes(k); c < g; c++) gains.push({ r: RG[c], m: ok[k - 1].m, mois: k });
  const own = gagnes(n), fini = own >= RG.length;
  const auMoisDe = j => { if (j < own) { const g = gains.find(x => x.r === RG[j]); return g ? g.mois : j + 1; } let k = n + 1; while (gagnes(k) <= j && k < n + 400) k++; return k; };
  const au = fini ? null : auMoisDe(own);
  return { n, gains, prochain: fini ? null : RG[own], auMois: au, reste: au ? au - n : 0, fini, auMoisDe, legacy: new Set(REGULARITE_M.slice(RG.length, nc).map(r => cleObj(r[0], r[1]))) };
}
/** lot 54 · mois versés par année civile */
function versesParAn() { const o = {}; try { serieVersements().liste.forEach(x => { const a = x.m.slice(0, 4); o[a] = (o[a] || 0) + (x.ok ? 1 : 0); }); } catch (e) { /* pas de parcours */ } return o; }
/** lot 54 · ancienne famille « Année en cours » (gains > versements) : son objet (Feu d'artifice) reste acquis s'il avait été gagné avant REGLES_V1_JUSQUA */
function feuV1() {
  const h = M && M.historique, rows = h && h.rows ? h.rows : []; if (!rows.length) return false;
  const kv = h.cols.indexOf("v"), ka = h.cols.indexOf("a"); if (kv < 0 || ka < 0) return false;
  const lim = +REGLES_V1_JUSQUA.replace("-", "") * 100 + 31;
  for (const an of new Set(rows.filter(r => r[0] <= lim).map(r => Math.floor(r[0] / 10000)))) {
    const r0 = rows.filter(r => Math.floor(r[0] / 10000) < an).pop();
    for (const r of rows) { if (Math.floor(r[0] / 10000) !== an || r[0] > lim) continue; const ve = r[ka] - (r0 ? r0[ka] : 0), ga = (r[kv] - (r0 ? r0[kv] : 0)) - ve; if (ve > 0 && ga > ve) return true; }
  }
  return false;
}
/* Récompenses cachées : calculées sur tes relevés (ou sur tes visites, pour deux d'entre elles) */
const SECRETS_M = [
  { id: "sangfroid", nom: "Sang-froid", indice: "Garde la main quand tout baisse.", quoi: "Un versement un mois où ton portefeuille a perdu 5 % ou plus.", rec: [["courbe", "flammes"]] },
  { id: "rond", nom: "Compte rond", indice: "Un chiffre bien net…", quoi: "Une bourse qui tombe à 2 € près sur un millier tout rond.", rec: [["aff", "reveil"]] },
  { id: "verte", nom: "Sept à la suite", indice: "Encore, encore, encore…", quoi: "Sept relevés en hausse d'affilée.", rec: [["emb", "taureau"]] },
  { id: "increvable", nom: "Increvable", indice: "Tomber, puis remonter plus haut.", quoi: "Une baisse de 10 % depuis un sommet, puis un nouveau sommet.", rec: [["titre", "increvable"]] },
  { id: "noctambule", nom: "Noctambule", indice: "Les marchés dorment, pas toi.", quoi: "Ouvrir Moi entre minuit et 5 h.", rec: [["aff", "terminal"]] },
  { id: "fidele", nom: "Fidèle", indice: "Passe voir tes chiffres…", quoi: "Ouvrir Moi sept jours d'affilée.", rec: [["fete", "etoiles"]] },
  { id: "nouvelan", nom: "Bonne année", indice: "Commence l'année du bon pied.", quoi: "Un premier relevé de l'année au-dessus du dernier de l'année d'avant.", rec: [["fete", "fusees"]] },
  { id: "parfaite", nom: "Année parfaite", indice: "Douze sur douze.", quoi: "Un versement chacun des douze mois d'une année.", rec: [["theme", "aurore"]] },
  /* lot 62 · journées folles : secrets INVISIBLES (ni tuile « ??? » ni indice) tant qu'ils ne sont pas gagnés ; une fois gagnés, permanents.
     Calculés sur l'historique du fichier (variation de l'indice « ip », versements neutralisés), plus la séance en direct de la carte « Jour ». */
  { id: "brasier", invisible: true, nom: "Survivant du brasier", quoi: "Une séance à −5 % ou pire sur ton portefeuille (versements exclus), et tu es toujours là.", rec: [["theme", "brasier"], ["titre", "survivant"]] },
  { id: "bouquet", invisible: true, nom: "Bouquet final", quoi: "Une séance à +5 % ou mieux sur ton portefeuille (versements exclus).", rec: [["theme", "bouquet"], ["fete", "bouquet"]] },
  { id: "phenix", invisible: true, nom: "Phénix", quoi: "Après une séance à −2,8 % ou pire, ton portefeuille repasse au-dessus de son niveau d'avant la chute en moins d'un mois.", rec: [["theme", "phenix"]] },
  { id: "montagnes", invisible: true, nom: "Montagnes russes", quoi: "Une séance à +2,8 % ou mieux et une à −2,8 % ou pire en cinq séances.", rec: [["emb", "montagnes"]] },
  { id: "pompier", invisible: true, nom: "Pompier de service", quoi: "Un versement le jour même ou dans les 3 jours qui suivent une séance à −2,8 % ou pire de ton portefeuille.", rec: [["titre", "pompier"], ["emb", "camion"]] }
];
/** lot 62 : objet d'un secret invisible pas encore gagné → absent du Vestiaire et des totaux */
function objInvisible(t, id, E) { return SECRETS_M.some(x => x.invisible && x.rec.some(r => r[0] === t && r[1] === id)) && !(E || etatObjets()).ok.has(cleObj(t, id)); }
function catVis(t, E) { return CATALOGUE[t].filter(d => !objInvisible(t, d[0], E)); }
/** lot 62 : les secrets des journées folles (séances de l'historique + la séance en direct) */
function secretsFolles(ok) {
  const l = seancesHisto(); let x = null; try { x = seanceCarte(); } catch (e) { x = null; }
  const tous = l.filter(y => !x || y.d !== x.d).concat(x ? [x] : []);   // lot 62 d : la séance de la carte du haut remplace sa ligne d'historique
  if (tous.some(y => y.p <= -FOLLE_FORT + 1e-9)) ok.add("brasier");
  if (tous.some(y => y.p >= FOLLE_FORT - 1e-9)) ok.add("bouquet");
  for (let i = 0; i < l.length; i++) for (let j = Math.max(0, i - 4); j < i; j++) if ((l[i].p >= FOLLE_SEUIL - 1e-9 && l[j].p <= -FOLLE_SEUIL + 1e-9) || (l[i].p <= -FOLLE_SEUIL + 1e-9 && l[j].p >= FOLLE_SEUIL - 1e-9)) ok.add("montagnes");
  const h = M.historique, ki = h.cols.indexOf("ip"), rows = h.rows;
  l.forEach(y => { if (y.p > -FOLLE_SEUIL + 1e-9 || ok.has("phenix")) return; const lim = +isoJour(new Date(new Date(y.d + "T12:00:00").getTime() + 31 * 864e5)).replace(/-/g, "");
    for (let k = y.i + 1; k < rows.length && rows[k][0] <= lim; k++) if (rows[k][ki] > y.ip0) { ok.add("phenix"); break; } });
  /* lot 62 c · Pompier de service : un versement entre le jour de la chute et 3 jours après. Deux sources : les apports cumulés de l'historique
     (colonne « a » : tout l'historique, sur tout appareil) et le journal des ordres du fichier (type Apport, 30 derniers ordres, jamais un ordre programmé à venir). */
  const ka = h.cols.indexOf("a"), auj = isoJour(new Date()), plus3 = d => isoJour(new Date(new Date(d + "T12:00:00").getTime() + 3 * 864e5));
  const vers = new Set();
  const nb = v => typeof v === "number" && isFinite(v);   // (ici « ok » est l'ensemble des secrets, pas la fonction commune)
  if (ka >= 0) for (let k = 1; k < rows.length; k++) if (nb(rows[k][ka]) && nb(rows[k - 1][ka]) && rows[k][ka] - rows[k - 1][ka] > .5) vers.add(isoN(rows[k][0]));
  (((M.ref || {}).journal) || []).forEach(o => { if (/^Apport/i.test(o.type || "") && (o.montant || 0) > 0 && /^\d{4}-\d{2}-\d{2}$/.test(o.date || "") && o.date <= auj) vers.add(o.date); });
  if (vers.size) tous.forEach(y => { if (y.p > -FOLLE_SEUIL + 1e-9 || ok.has("pompier")) return; const f = plus3(y.d); for (const d of vers) if (d >= y.d && d <= f) { ok.add("pompier"); break; } });
}
const cleObj = (t, id) => t + "." + id;
const cleStock = k => "versus.moi." + k + "." + ((M && M.personne) || ETAT.moi || "moi");   // une liste par personne (l'admin peut ouvrir le fichier d'un autre)
/** On sait à qui est le fichier : son propriétaire (profil simple) ou, pour le profil complet, dès que le Versus a répondu (ETAT.moi est alors fiable) */
function identiteSure() { return !!(M && (M.personne || dVersus())); }
const defObj = (t, id) => (CATALOGUE[t] || []).find(x => x[0] === id);
function nomObj(t, id) { const d = defObj(t, id); return d ? d[1] : id; }
function apercuEmb(id) { const d = defObj("emb", id) || EMBLEMES_M[0]; return d[2]; }

/* Visites de Moi (pour Noctambule et Fidèle) : seulement des dates, gardées sur l'appareil */
function noterVisite() {
  const d = new Date(), j = isoJour(d);
  if (d.getHours() < 5) stock.set("versus.moi.nuit", "1");
  let l = []; try { l = JSON.parse(stock.get("versus.moi.jours") || "[]"); } catch (e) { l = []; }
  if (l[l.length - 1] !== j) { l.push(j); stock.set("versus.moi.jours", JSON.stringify(l.slice(-14))); }
}
function secretsAtteints() {
  const ok = new Set(), h = M && M.historique, rows = h && h.rows ? h.rows : [];
  const C = n => h ? h.cols.indexOf(n) : -1, kv = C("v"), ka = C("a"), ki = C("ip");
  if (rows.length > 1 && ki >= 0) {
    const fins = []; rows.forEach(r => { const m = Math.floor(r[0] / 100); if (fins.length && Math.floor(fins[fins.length - 1][0] / 100) === m) fins[fins.length - 1] = r; else fins.push(r); });
    if (ka >= 0) for (let i = 1; i < fins.length; i++) if (fins[i][ki] / fins[i - 1][ki] - 1 <= -0.05 && fins[i][ka] - fins[i - 1][ka] > 0.5) ok.add("sangfroid");
    if (kv >= 0 && rows.some(r => r[kv] >= 1000 && Math.abs(r[kv] - Math.round(r[kv] / 1000) * 1000) <= 2)) ok.add("rond");
    let run = 0; for (let i = 1; i < rows.length; i++) { run = rows[i][ki] > rows[i - 1][ki] ? run + 1 : 0; if (run >= 7) { ok.add("verte"); break; } }
    let pic = rows[0][ki], creux = false;
    for (const r of rows) { if (r[ki] > pic) { if (creux) { ok.add("increvable"); break; } pic = r[ki]; } else if (r[ki] <= pic * 0.9) creux = true; }
    for (let i = 1; i < rows.length; i++) if (Math.floor(rows[i][0] / 10000) > Math.floor(rows[i - 1][0] / 10000) && rows[i][ki] > rows[i - 1][ki]) { ok.add("nouvelan"); break; }
  }
  try {
    const parAn = {}; serieVersements().liste.forEach(x => { const a = x.m.slice(0, 4); parAn[a] = (parAn[a] || 0) + (x.ok ? 1 : 0); });
    if (Object.values(parAn).some(n => n >= 12)) ok.add("parfaite");
  } catch (e) { /* pas de parcours */ }
  try { if (M && !M.simple) secretsFolles(ok); } catch (e) { /* historique incomplet */ }
  if (stock.get("versus.moi.nuit") === "1") ok.add("noctambule");
  let l = []; try { l = JSON.parse(stock.get("versus.moi.jours") || "[]"); } catch (e) { l = []; }
  let suite = 1; for (let i = 1; i < l.length; i++) { suite = (new Date(l[i] + "T12:00:00") - new Date(l[i - 1] + "T12:00:00")) / 864e5 === 1 ? suite + 1 : 1; if (suite >= 7) { ok.add("fidele"); break; } }
  return ok;
}
/* Palier → récompenses. lot 54 : la table REC_PAL (famille + seuil) ; la Fiscalité garde l'ancienne règle (selon le nombre d'enveloppes).
   Un objet déjà gagné par l'ancienne régularité n'est pas redonné (ni refêté) par un palier. */
function recompensesPaliers(pal) {
  const map = new Map(), an = cleMoisD(new Date()).slice(0, 4);
  const anvAvant = Object.entries(versesParAn()).some(([a, n]) => a < an && n >= 9);   // Feu d'artifice : la première année à 9 mois versés seulement
  pal.forEach(x => {
    if (x.groupe === "fisc") return;
    if (x.groupe === "anv" && String(x.id).split("-")[1] === "6") { const rg = anneesA6(an).length + 1; if (ANV6_RANG[rg]) map.set(x.id, ANV6_RANG[rg]); return; }   // lot 55
    const k = x.groupe === "anv" ? (anvAvant ? null : "anv" + String(x.id).split("-")[1]) : cleFete(x.id);
    if (k && REC_PAL[k]) map.set(x.id, REC_PAL[k]);
  });
  const l = pal.filter(x => x.groupe === "fisc"), R = REC_FAM_V1.fisc;
  if (l.length) {
    const cases = l.map((x, i) => i).filter(i => i % 2 === 1 || i === l.length - 1);
    // lot 44 : moins de paliers récompensés que de récompenses prévues (Fiscalité avec 1 ou 2 enveloppes) → le dernier palier prend tout ce qui reste
    cases.forEach((i, j) => { const r = j === cases.length - 1 ? [].concat(...R.slice(Math.min(j, R.length - 1))) : j < R.length - 1 ? R[j] : null; if (r) map.set(l[i].id, r); });
  }
  let leg = new Set(); try { leg = regulInfo().legacy; } catch (e) { leg = new Set(); }
  if (leg.size) map.forEach((r, id) => { const f = r.filter(o => !leg.has(cleObj(o[0], o[1]))); if (f.length) map.set(id, f); else map.delete(id); });
  return map;
}
/** lot 54 · tous les objets gagnés selon les règles (sans le stockage de l'appareil) : clé → d'où il vient */
function objetsParRegle(pal, rec, sec) {
  if (!pal) { pal = paliers(); rec = recompensesPaliers(pal); sec = secretsAtteints(); }
  const ok = new Map(), met = (r, src) => { const k = cleObj(r[0], r[1]); if (!ok.has(k)) ok.set(k, src); };
  pal.forEach(x => { if (x.atteint && rec.has(x.id)) rec.get(x.id).forEach(r => met(r, "fam:" + x.groupe)); });
  try { regulInfo().gains.forEach(g => met(g.r, "regul")); } catch (e) { /* pas de parcours */ }
  try { const an = cleMoisD(new Date()).slice(0, 4); if (Object.entries(versesParAn()).some(([a, n]) => a < an && n >= 9)) met(["fete", "feu"], "fam:anv"); } catch (e) { /* idem */ }
  try { if (feuV1()) met(["fete", "feu"], "v1"); } catch (e) { /* idem */ }
  try { const an = cleMoisD(new Date()).slice(0, 4); anneesA6(an).forEach((a, i) => (ANV6_RANG[i + 1] || []).forEach(r => met(r, "fam:anv"))); } catch (e) { /* lot 55 : les années passées gardent leur objet */ }
  SECRETS_M.forEach(s => { if (sec && sec.has(s.id)) s.rec.forEach(r => met(r, "secret")); });
  return ok;
}
let MEMO_OBJ = { m: null, ok: null, pal: null, rec: null, sec: null };
function etatObjets() {
  if (MEMO_OBJ.m === M && M && MEMO_OBJ.d === ETAT.discret) return MEMO_OBJ;   // lot 44 : basculer le mode discret vide la mémoire (oublierObjets)
  const ok = new Set(Object.entries(BASE_M).map(([t, id]) => cleObj(t, id)));
  let vus = []; try { vus = JSON.parse(stock.get(cleStock("objets")) || "[]"); } catch (e) { vus = []; }
  if (!M || !M.personne || M.personne === ETAT.moi) try { JSON.parse(stock.get("versus.moi.afficheurs") || "[]").forEach(id => { if (defObj("aff", id)) ok.add(cleObj("aff", id)); }); } catch (e) { /* ancien format */ }
  vus.forEach(k => ok.add(k));
  let pal = [], rec = new Map(), sec = new Set();
  if (M) {
    try { pal = paliers(); rec = recompensesPaliers(pal); } catch (e) { /* données incomplètes */ }
    try { sec = secretsAtteints(); } catch (e) { /* idem */ }
    try { objetsParRegle(pal, rec, sec).forEach((src, k) => ok.add(k)); } catch (e) { /* idem */ }
    if (identiteSure()) {
      // lot 54 : avant la première écriture avec les nouvelles règles, on garde la liste d'avant (pour l'écran unique « Les paliers se rapprochent »)
      if (stock.get(cleStock("regles")) !== REGLES_VER && stock.get(cleStock("objetsV1")) === null && stock.get(cleStock("objets")) !== null) stock.set(cleStock("objetsV1"), stock.get(cleStock("objets")));
      stock.set(cleStock("objets"), JSON.stringify(Array.from(ok)));
    }
  }
  MEMO_OBJ = { m: M, ok, pal, rec, sec, d: ETAT.discret };
  return MEMO_OBJ;
}
function oublierObjets() { MEMO_OBJ = { m: null, ok: null, pal: null, rec: null, sec: null }; }
function actifM(t) { const s = SORTES.find(x => x[0] === t), v = PREF[s[3]] || BASE_M[t]; return M && etatObjets().ok.has(cleObj(t, v)) && defObj(t, v) ? v : BASE_M[t]; }
function afficheurActif() { return actifM("aff"); }
function themeActif() { return defObj("theme", actifM("theme")); }
function couleurMoi() { const t = themeActif(); return t && t[2] ? t[2] : maCouleur(); }
function equiper(t, id) { const s = SORTES.find(x => x[0] === t); PREF[s[3]] = id; garderPref(); if (t === "aff") dernierFlap = "";  connaitreObj(cleObj(t, id)); }
/* D'où vient un objet (pour le « ? ») */
function origineObj(t, id) {
  if (BASE_M[t] === id) return { base: true };
  const E = etatObjets();
  for (const s of SECRETS_M) if (s.rec.some(r => r[0] === t && r[1] === id)) return { secret: s, ok: E.sec.has(s.id) };
  for (const [pid, l] of E.rec) if (l.some(r => r[0] === t && r[1] === id)) return { palier: masquerPalier(E.pal.find(x => x.id === pid)) };
  { const RI = regulInfo(), g = RI.gains.find(x => x.r[0] === t && x.r[1] === id); if (g) return { regul: g.mois, faits: RI.n };
    const i = RG.findIndex(r => r[0] === t && r[1] === id); if (i >= 0) return { regul: RI.auMoisDe(i), faits: RI.n }; }   // lot 54 : au rythme de la nouvelle régularité
  { const rg = Object.keys(ANV6_RANG).find(k => ANV6_RANG[k].some(r => r[0] === t && r[1] === id)); if (rg) return { anvRang: +rg, faits: anneesA6().length }; }   // lot 55
  const cle = Object.keys(REC_PAL).find(k => REC_PAL[k].some(r => r[0] === t && r[1] === id)), g = cle ? cle.replace(/\d.*$/, "") : REC_FAM_V1.fisc.some(c => c.some(r => r[0] === t && r[1] === id)) ? "fisc" : null;
  if (g) return { famille: (FAMILLES.find(f => f[0] === g) || [, g])[1], absente: !E.pal.some(x => x.groupe === g) };   // lot 44 : famille absente du profil
  return {};
}
function apercuObj(t, id) {
  const d = defObj(t, id);
  if (t === "aff") return '<span class="m-flaps">' + flaps("128€", false, id) + "</span>";
  if (t === "theme") return '<span class="vs-sw' + (d[3] ? "" : " base") + '" style="' + (d[3] ? "background:" + d[3] + ";" : "") + "--sw:" + (d[2] || maCouleur()) + '"><i></i><i></i></span>';
  if (t === "courbe") { const c = d[2] || couleurMoi(); return '<svg class="vs-cb' + (d[3] ? " fx-" + d[3] : "") + '" viewBox="0 0 56 26" aria-hidden="true"><path class="x" d="M3 21 L13 16 L21 18 L31 9 L40 12 L53 4" stroke="' + c + '"/><path d="M3 21 L13 16 L21 18 L31 9 L40 12 L53 4" stroke="' + c + '"/></svg>'; }
  if (t === "fete" || t === "emb") return '<span class="vs-em">' + d[2] + "</span>";
  if (t === "titre") return '<span class="vs-ti">« ' + esc(d[1]) + " »</span>";
  return "";
}
/* v17.19 · objets « nouveaux » : gagnés mais pas encore équipés ni écartés (mémorisé sur l'appareil, une liste par personne).
   Au tout premier passage, tout ce qu'on a déjà est noté comme connu (pas d'encart pour l'existant). */
function objConnus() { try { const l = JSON.parse(stock.get(cleStock("objConnus")) || "null"); return Array.isArray(l) ? l : null; } catch (e) { return null; } }
function connaitreObj(k) { if (!identiteSure()) return; const l = objConnus(); if (!l || l.includes(k)) return; l.push(k); stock.set(cleStock("objConnus"), JSON.stringify(l)); }
function objetsNouveaux() {
  if (!M || !identiteSure()) return [];
  const E = etatObjets(), base = new Set(Object.entries(BASE_M).map(([t, id]) => cleObj(t, id)));
  const tous = []; SORTES.forEach(([t]) => CATALOGUE[t].forEach(d => { const k = cleObj(t, d[0]); if (E.ok.has(k) && !base.has(k)) tous.push(k); }));
  const l = objConnus();
  if (!l) { stock.set(cleStock("objConnus"), JSON.stringify(tous)); return []; }
  const c = new Set(l);
  return tous.filter(k => !c.has(k) && !SORTES.some(([t]) => actifM(t) === k.split(".")[1] && k.split(".")[0] === t));
}
function apercuTenue(t, id) { return t === "aff" ? '<span class="m-flaps">' + flaps("12", false, id) + "</span>" : t === "titre" ? '<span class="vs-em">' + SORTES.find(x => x[0] === t)[2] + "</span>" : apercuObj(t, id); }
const COURT_SORTE = { aff: "Affich.", emb: "Embl." };   // lot 44 : libellés courts de Ma tenue à 360 px
function htmlTenue() {
  const E = etatObjets();
  const tot = SORTES.reduce((n, [s]) => n + catVis(s, E).length, 0), nb = Object.entries(CATALOGUE).reduce((n, [s, l]) => n + l.filter(d => E.ok.has(cleObj(s, d[0]))).length, 0);   // lot 62 : les secrets invisibles ne comptent qu'une fois gagnés
  const nv = objetsNouveaux(), k = nv[0];
  let encart = "";
  if (k) {
    const [t, id] = k.split("."), s = SORTES.find(x => x[0] === t);
    encart = '<div class="vs-nv" role="status"><span>🎁 <b>Nouveau :</b> ' + esc(s[1].toLowerCase()) + " « " + esc(nomObj(t, id)) + " »" + (nv.length > 1 ? " <small>(+" + (nv.length - 1) + ")</small>" : "") + "</span>" +
      '<button class="btn acc" type="button" data-vt-eq="' + k + '">Équiper</button><button class="vt-x" type="button" data-vt-vu="' + k + '" aria-label="Plus tard">✕</button></div>';
  }
  return '<section class="vs-tenue" aria-label="Ma tenue"><button type="button" class="vt-h" data-vt-ouv="' + (SORTES.some(x => x[0] === PREF.vest) ? PREF.vest : "aff") + '" aria-label="' + esc("Ma tenue : " + nb + " objets sur " + tot + ", ouvrir le vestiaire") + '"><b>Ma tenue</b><small>' + nb + " / " + tot + " ›</small></button>" +
    '<div class="vt-r' + (ambTenue() ? " a7" : "") + '">' + SORTES.map(([t, l]) => { const id = actifM(t), n = nomObj(t, id);
      return '<button type="button" class="vt-o" data-vt-ouv="' + t + '" aria-label="' + esc(l + " : " + n + ", changer") + '" title="' + esc(l + " : " + n) + '"><span class="vt-p">' + apercuTenue(t, id) + '</span><span class="vt-n"><span class="vt-l">' + esc(l) + '</span><span class="vt-c">' + esc(COURT_SORTE[t] || l) + "</span></span></button>"; }).join("") +
    (ambT => ambT ? '<button type="button" class="vt-o" data-vt-ouv="amb" aria-label="' + esc("Ambiance : " + nomEv(ambT) + ", régler") + '" title="' + esc("Ambiance : " + nomEv(ambT)) + '"><span class="vt-p"><span class="vs-em">' + icoEv(ambT) + '</span></span><span class="vt-n"><span class="vt-l">Ambiance</span><span class="vt-c">Amb.</span></span></button>' : "")(ambTenue()) +   // lot 62 d (Théo)
    "</div>" + encart + "</section>";
}
/** lot 62 d : l'ambiance affichée sur Aujourd'hui (ou null) */
function ambTenue() { try { if (!M || M.simple || evTousCoupes() || reduit) return null; const L = evenementsActifs(); if (!L.length) return null; const x = evChoisi(L); return x && !ambCoupee(x.k) ? x : null; } catch (e) { return null; } }
function brancherTenue(v) {
  v.querySelectorAll("[data-vt-ouv]").forEach(b => b.addEventListener("click", () => {
    PREF.vest = b.dataset.vtOuv; PREF.acc["m-vest"] = true; garderPref(); vsSel = null; rendre();
    const d = document.querySelector('#v-moi details[data-acc="m-vest"]'); if (d) d.scrollIntoView({ block: "start", behavior: reduit ? "auto" : "smooth" });
  }));
  const eq = v.querySelector("[data-vt-eq]");
  if (eq) eq.addEventListener("click", () => { const [t, id] = eq.dataset.vtEq.split("."); equiper(t, id); rendre(); if (t === "fete") lancerFete(id); else toast(nomObj(t, id) + " équipé."); });
  const vu = v.querySelector("[data-vt-vu]");
  if (vu) vu.addEventListener("click", () => { connaitreObj(vu.dataset.vtVu); rendre(); });
}
let vsSel = null;
function htmlVestiaire() {
  const amb = htmlAmbFolles(), E = etatObjets(), t = SORTES.some(x => x[0] === PREF.vest) || (PREF.vest === "amb" && amb) ? PREF.vest : "aff";   // lot 62 : « Ambiances » = un onglet de plus, seulement après une première journée folle
  const tot = SORTES.reduce((n, [s]) => n + catVis(s, E).length, 0), nb = Object.entries(CATALOGUE).reduce((n, [s, l]) => n + l.filter(d => E.ok.has(cleObj(s, d[0]))).length, 0);   // lot 62 : les secrets invisibles ne comptent qu'une fois gagnés
  const th = themeActif(), nom = (M && M.personne) || ETAT.moi || "Moi";
  const prof = '<div class="vs-prof' + (th && th[3] ? " th" : "") + '"' + (th && th[3] ? ' style="background:' + th[3] + '"' : "") + '><span class="vs-av">' + apercuEmb(actifM("emb")) + "</span>" +
    "<div><b>" + esc(nom) + "</b><small>« " + esc(nomObj("titre", actifM("titre"))) + " »</small></div>" +
    '<span class="vs-n"><b>' + nb + "</b> / " + tot + "<small>objets</small></span></div>";
  const onglets = '<div class="chips vs-o" role="tablist" aria-label="Sortes d\'objets">' + SORTES.map(([s, l, ic]) => {
    const n = CATALOGUE[s].filter(d => E.ok.has(cleObj(s, d[0]))).length;
    return '<button class="chip" type="button" role="tab" data-vt="' + s + '" aria-pressed="' + (s === t) + '">' + "<b>" + ic + " " + l + "</b><small>" + n + " / " + catVis(s, E).length + "</small></button>";
  }).join("") + (amb ? '<button class="chip" type="button" role="tab" data-vt="amb" aria-pressed="' + (t === "amb") + '"><b>✨ Ambiances</b><small>événements</small></button>' : "") + "</div>";
  if (t === "amb") return acc("m-vest", "Vestiaire", nb + " / " + tot + " objets · privé", prof + onglets + amb, false);
  const actif = actifM(t);
  const tuiles = catVis(t, E).map(d => {
    const id = d[0], o = E.ok.has(cleObj(t, id)), org = o ? null : origineObj(t, id), cache = !o && (org.secret || estSurprise(t, id));   // lot 56 : surprise = cachée comme un secret
    const lab = cache ? "???" : d[1];
    return '<div class="vs-t' + (o ? "" : " verrou") + (cache ? " secret" : "") + (id === actif ? " on" : "") + (vsSel === cleObj(t, id) ? " vs-sel" : "") + '">' +
      '<button type="button" class="vs-b" data-vs="' + t + "." + id + '" aria-label="' + esc(lab) + (id === actif ? " (équipé)" : o ? " (équiper)" : " (verrouillé)") + '">' +
        (t === "titre" ? '<span class="vs-ti">' + esc(lab) + "</span>" + (o ? "" : '<i class="vs-l" aria-hidden="true">🔒</i>') :
        '<span class="vs-p">' + (cache ? '<span class="vs-em">?</span>' : apercuObj(t, id)) + (o ? "" : '<i class="vs-l" aria-hidden="true">🔒</i>') + "</span>" +
        '<span class="vs-nm">' + esc(lab) + "</span>") + (id === actif ? '<span class="vs-ok" aria-hidden="true">✓</span>' : "") + "</button>" +
      '<button type="button" class="vs-q" data-vsq="' + t + "." + id + '" aria-label="D\'où vient ' + esc(lab) + ' ?">?</button></div>';
  }).join("");
  return acc("m-vest", "Vestiaire", nb + " / " + tot + " objets · privé", prof + onglets +
    '<div class="vs-g' + (t === "titre" ? " vs-g2" : "") + '">' + tuiles + '</div><div class="vs-d" id="vs-d" aria-live="polite">' + htmlDetailObj() + "</div>", false);
}
function htmlDetailObj() {
  if (!vsSel) return '<p class="vs-aide">Touche un objet pour l\'équiper, ou « ? » pour savoir d\'où il vient.</p>';
  const [t, id] = vsSel.split("."), d = defObj(t, id); if (!d) return "";
  const E = etatObjets(), o = E.ok.has(vsSel), sur = !o && estSurprise(t, id), org = origineObj(t, id), cache = !o && (org.secret || sur);
  const sorte = SORTES.find(x => x[0] === t);
  let quoi;
  if (org.base) quoi = "Fourni de base.";
  else if (sur) { const p = org.palier; quoi = "🎁 Objet surprise : il se dévoile le mois d'un anniversaire de ton premier ordre" + (p && p.reste ? " (" + esc(p.reste) + ")" : "") + "."; }   // lot 56
  else if (org.secret) quoi = o || org.ok ? "Récompense cachée « " + esc(org.secret.nom) + " » : " + esc(org.secret.quoi) : "Récompense cachée. Indice : <i>" + esc(org.secret.indice) + "</i>";
  else if (org.palier && org.palier.cache) { const p = org.palier; quoi = p.atteint ? "Gagné avec un palier « " + esc((FAMILLES.find(f => f[0] === p.groupe) || [, ""])[1]) + " » (masqué en mode discret)." : "À gagner avec un palier « " + esc((FAMILLES.find(f => f[0] === p.groupe) || [, ""])[1]) + " » (masqué en mode discret)."; }   // lot 44 : ni seuil, ni %, ni jauge, ni « encore … € »
  else if (org.palier) { const p = org.palier; quoi = p.atteint ? "Gagné avec le palier « " + esc(p.titre) + " »" + (p.quand ? ", franchi en " + esc(libMois(p.quand)) : "") + "."
      : "À gagner : « " + esc(p.titre) + " » · " + pct(Math.max(0, Math.min(1, p.part)), 0, false) + (p.reste ? " · " + esc(p.reste) : "") + '<span class="jauge"><i style="width:' + Math.round(Math.max(0, Math.min(1, p.part)) * 100) + '%"></i></span>'; }
  else if (org.regul) quoi = org.faits >= org.regul ? "Gagné par ta régularité : ton " + org.regul + (org.regul === 1 ? "er" : "e") + " mois avec un versement."
      : "Régularité : se débloque à ton " + org.regul + (org.regul === 1 ? "er" : "e") + " mois avec un versement (tu en es à " + org.faits + ")." + '<span class="jauge"><i style="width:' + Math.round(Math.min(1, org.faits / org.regul) * 100) + '%"></i></span>';
  else if (org.anvRang) quoi = o ? "Gagné avec un palier « Année de versements » : ta " + org.anvRang + "e année civile avec au moins 6 mois versés."
      : "Année de versements : se débloque ta " + org.anvRang + "e année civile avec au moins 6 mois versés (tu en as " + org.faits + ")." + '<span class="jauge"><i style="width:' + Math.round(Math.min(1, org.faits / org.anvRang) * 100) + '%"></i></span>';
  else if (org.famille) quoi = o ? "Gagné avec un palier « " + esc(org.famille) + " »." : org.absente ? "Pas disponible pour ton profil (pas de paliers « " + esc(org.famille) + " »)." : "À gagner dans les paliers « " + esc(org.famille) + " ».";
  else quoi = o ? "Déjà à toi." : "Pas encore disponible pour ton profil.";
  const actif = actifM(t) === id;
  return '<div class="vs-dl"><span class="vs-di">' + (cache ? "?" : sorte[2]) + "</span><div><b>" + esc(cache ? "???" : d[1]) + "</b> <small>" + esc(sorte[1]) + "</small><p>" + quoi + '</p><p class="vs-expl">' + esc(sorte[1]) + " : " + EXPL_SORTE[t] + ".</p></div></div>" +
    '<div class="vs-da">' + (o && !actif ? '<button class="btn" type="button" data-vs-eq="' + vsSel + '">Équiper</button>' : o ? '<span class="vs-eq">✓ Équipé</span>' : "") +
      (t === "fete" && !cache ? '<button class="btn ghost" type="button" data-vs-essai="' + id + '">Essayer</button>' : "") + "</div>";
}
function embHero() { return '<i class="m-emb" title="' + esc(nomObj("emb", actifM("emb"))) + '">' + apercuEmb(actifM("emb")) + "</i>" + '<span class="m-titre-h">' + esc(nomObj("titre", actifM("titre"))) + "</span> · "; }   // v17.63 (Théo) : le titre équipé est visible en haut de Moi
/* v17.63 (Théo) : à quoi sert chaque sorte d'objet */
const EXPL_SORTE = { aff: "change le style des chiffres de ton total, en haut de Moi", theme: "change les couleurs de la carte du haut de Moi", courbe: "change le style de ta courbe dans Stats", fete: "change l'animation quand tu franchis un palier", emb: "la petite icône en haut de Moi, devant ton titre", titre: "ton surnom, affiché en haut de Moi à côté de l'emblème" };
function lancerFete(id) { const d = defObj("fete", id || actifM("fete")); if (typeof confettis === "function" && !reduit) confettis(d && d[3] ? d[3] : undefined); }
function brancherVestiaire(v) {
  const maj = () => { const z = v.querySelector("#vs-d"); if (z) { z.innerHTML = htmlDetailObj(); brancherDetail(); } v.querySelectorAll(".vs-t").forEach(x => x.classList.toggle("vs-sel", !!vsSel && x.querySelector("[data-vs]").dataset.vs === vsSel)); };
  const brancherDetail = () => {
    const eq = v.querySelector("[data-vs-eq]"); if (eq) eq.addEventListener("click", () => { const [t, id] = eq.dataset.vsEq.split("."); equiper(t, id); rendre(); toast(nomObj(t, id) + " équipé."); });
    const es = v.querySelector("[data-vs-essai]"); if (es) es.addEventListener("click", () => lancerFete(es.dataset.vsEssai));
  };
  v.querySelectorAll("[data-vt]").forEach(b => b.addEventListener("click", () => { PREF.vest = b.dataset.vt; garderPref(); vsSel = null; rendre(); }));
  v.querySelectorAll("[data-vs]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.vs, [t, id] = k.split(".");
    vsSel = k;
    if (etatObjets().ok.has(k)) { equiper(t, id); rendre(); if (t === "fete") lancerFete(id); else toast(nomObj(t, id) + " équipé."); }
    else maj();
  }));
  v.querySelectorAll("[data-vsq]").forEach(b => b.addEventListener("click", () => { vsSel = vsSel === b.dataset.vsq ? null : b.dataset.vsq; maj(); }));
  v.querySelectorAll("[data-ev-vis]").forEach(b => b.addEventListener("click", () => {   // lot 62 c : afficher / masquer un événement pendant sa fenêtre (carte + ambiance)
    const c = b.dataset.evVis, k = c.replace(/^(\d{4}-\d{2}-\d{2})[+-]\d$/, "").split(":")[0];
    let m = evMasques().filter(x => x !== c); if (!b.dataset.evOn) m.push(c); stock.set(cleStock("evMasques"), JSON.stringify(m.slice(-60)));
    if (b.dataset.evOn && Array.isArray(PREF.ambOff)) { PREF.ambOff = PREF.ambOff.filter(x => x === "tout" || (k && x !== k) || (!k && !["feu", "joie"].includes(x))); if (!PREF.ambOff.length) delete PREF.ambOff; garderPref(); }
    garderPlace(b, rendre); }));
  v.querySelectorAll("[data-amb]").forEach(b => b.addEventListener("click", () => {   // lot 62 : l'interrupteur général (appli sobre)
    const k = b.dataset.amb, l = (Array.isArray(PREF.ambOff) ? PREF.ambOff : []).filter(x => x !== k); if (!b.dataset.ambOn) l.push(k);
    if (l.length) PREF.ambOff = l; else delete PREF.ambOff; garderPref(); garderPlace(b, rendre); }));
  brancherDetail();
}

/* fête d'un palier franchi ou d'une récompense cachée : une seule fois par appareil (au premier lancement, on note sans fêter) */
let paliersVerifies = false;
function verifierPaliers() {
  if (!M || paliersVerifies || !identiteSure()) return;
  if (document.querySelector(".m-folle")) return;   // lot 62 d (Théo, 21/11) : jamais par-dessus un effet d'événement (un toucher « pour continuer » tombait sur « Équiper »)
  if (!vueMoi()) return;   // la fête attend qu'on soit sur Moi (sinon elle tomberait sur le Classement au démarrage)
  paliersVerifies = true;
  noterVisite(); oublierObjets();
  const E = etatObjets();
  const faits = E.pal.filter(x => x.atteint), ids = faits.map(x => x.id);
  let vus = null; try { vus = JSON.parse(stock.get(cleStock("paliers")) || stock.get("versus.moi.paliers") || "null"); } catch (e) { vus = null; }
  const vusF = new Set((vus || []).map(cleFete));   // lot 44 : « Sans vendre » déjà fêté = même seuil, quelle que soit la date de la dernière vente
  // lot 54 : premier passage avec les nouvelles règles → les paliers déjà franchis (anciens comme nouveaux) sont notés sans fête
  const migre = stock.get(cleStock("regles")) !== REGLES_VER;   // lot 56 : "3" (nouvelles missions) ; même écran unique qu'au lot 54
  const nouveaux = vus === null || migre ? [] : faits.filter(x => !vus.includes(x.id) && !vusF.has(cleFete(x.id)));
  stock.set(cleStock("paliers"), JSON.stringify(Array.from(new Set((vus || []).concat(ids, ids.map(cleFete))))));
  let sv = null; try { sv = JSON.parse(stock.get(cleStock("secrets")) || "null"); } catch (e) { sv = null; }
  const secrets = sv === null || migre ? [] : SECRETS_M.filter(s => E.sec.has(s.id) && !sv.includes(s.id));
  stock.set(cleStock("secrets"), JSON.stringify(Array.from(new Set((sv || []).concat(Array.from(E.sec))))));
  // V15.5 : objets gagnés par la régularité (un par mois versé) : fêtés eux aussi, regroupés
  // lot 44 : clé absente (premier lancement, nouveau téléphone, nouveau joueur) → on note sans fêter, comme les paliers et les objets cachés
  // lot 54 : « regul » = nombre d'objets de la régularité déjà fêtés (même valeur qu'avant pour tout ce qui a été gagné avec l'ancienne règle)
  const RI = regulInfo(), nV = RI.n, nbR = RI.gains.length, rv = stock.get(cleStock("regul")), avR = rv === null || migre ? nbR : Math.min(nbR, +rv || 0);
  stock.set(cleStock("regul"), String(nbR));
  const regul = nbR > avR ? [{ regul: true, titre: nbR - avR > 1 ? "Ta régularité paie : " + (nbR - avR) + " nouveaux objets" : "Ta régularité paie", grand: nV + " MOIS", recs: RI.gains.slice(avR, nbR).map(g => g.r), quand: null, id: null }] : [];
  const file = nouveaux.concat(secrets.map(secret => ({ secret, titre: secret.nom, grand: "?!", quand: null, id: null })), regul);
  // lot 54 : ce que les nouveaux paliers donnent pour ce qui était déjà fait = UN seul écran (jamais de pluie de fêtes)
  let maj = [];
  if (migre) {
    let v1 = null; try { v1 = JSON.parse(stock.get(cleStock("objetsV1")) || "null"); } catch (e) { v1 = null; }
    if (Array.isArray(v1) && vus !== null) { const avant = new Set(v1); maj = Array.from(E.ok).filter(k => !avant.has(k) && BASE_M[k.split(".")[0]] !== k.split(".")[1]).map(k => k.split(".")); }
    stock.set(cleStock("regles"), REGLES_VER); stock.del(cleStock("objetsV1"));
  }
  const go = maj.length ? () => feterMaj(maj) : file.length ? () => lancerFetes(file) : null;
  if (go) { if (typeof window.ereApres === "function") window.ereApres(go, "feteMoi"); else go(); }   // v16.93 : attend la scène du premier million
}
/** lot 55 : la vente qui compte pour « Sans vendre ». Un script récent envoie derniereVenteHorsLevier (les ventes de la stratégie levier,
 *  LQQ ×2, QQQ3 ×3 et bascules ×1 → ×2, ne cassent pas la série) ; un ancien script n'envoie que derniereVente (toute vente casse la série).
 *  lot 56 (Théo) : les scripts perso comptent aussi le Nasdaq-100 ×1 de la règle dans le bloc levier : le vendre ne casse plus la série. */
function derniereVenteSV(p) {
  p = p || {};
  if (Object.prototype.hasOwnProperty.call(p, "derniereVenteHorsLevier")) return { date: p.derniereVenteHorsLevier || null, horsLevier: true, levier: p.derniereVenteLevier || null };
  return { date: p.derniereVente || null, horsLevier: false, levier: null };
}
/* lot 44 : clé de fête d'un palier = famille + seuil (sans la date de la dernière vente pour « Sans vendre ») */
function cleFete(id) { return String(id).replace(/^(vente\d+)-.*$/, "$1"); }
function recsDe(x) { return x.recs || (x.secret ? x.secret.rec : (etatObjets().rec.get(x.id) || [])); }
/** le prochain palier non franchi d'une famille qui donne un objet */
function prochaineRec(groupe) { const E = etatObjets(), x = E.pal.find(p => p.groupe === groupe && !p.atteint && E.rec.has(p.id)); return x ? { x, r: E.rec.get(x.id) } : null; }
function regulEpuisee() { return regulInfo().fini; }
/** lot 54 : la phrase de la régularité dans les fêtes */
function phraseRegul() {
  const RI = regulInfo();
  return RI.fini ? "Tu as gagné les " + RG.length + " objets de la régularité. Tes séries et tes mois versés continuent de compter dans les paliers."
    : "Régularité : " + RI.n + " mois versés · prochain objet à ton " + RI.auMois + "<sup>e</sup> mois versé.";
}
/** lot 54 : premier passage avec les nouveaux paliers : un seul écran pour tout ce qu'ils donnent en plus (rien n'est retiré) */
function feterMaj(recs) {
  injecterStyle();
  const aff = recs.find(r => r[0] === "aff"), o = document.createElement("div");
  o.className = "m-fete moi"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
  o.innerHTML = '<div><span class="mf-k">Nouveaux paliers</span><div class="m-flaps">' + flaps("+" + recs.length, !reduit, aff ? aff[1] : null) + "</div><h3>Les paliers se rapprochent</h3>" +
    "<p>Tes Missions s'enrichissent (paliers intermédiaires, versé avant le 5, défi d'automne, mois économes…). Ce que tu avais déjà fait te rapporte " + (recs.length > 1 ? recs.length + " objets" : "un objet") + " de plus. Tout ce que tu avais est gardé.</p>" +
    '<p class="mf-af">Touche un objet pour l\'équiper</p>' + htmlRecsFete(recs.slice(0, 12)) + (recs.length > 12 ? "<p>… et " + (recs.length - 12) + " autres dans ton vestiaire.</p>" : "") +
    '<button class="wr-btn" type="button" data-continuer>Continuer</button></div>';
  document.body.appendChild(o);
  brancherFete(o, () => o.remove());
  lancerFete();
}
/** lot 44 : un seul écran pour un rattrapage ; un simple toast pour un palier sans objet ; la pleine fête pour un objet ou la régularité */
function lancerFetes(file) {
  if (file.length > 1) return feterRecap(file);
  const x = file[0];
  if (recsDe(x).length || x.regul) feter(x); else toastPalier(x);
}
function toastPalier(x) {
  const m = masquerPalier(x), n = prochaineRec(x.groupe);
  if (x.groupe === "pat" && !reduit) { const f = document.querySelector("#v-moi .m-hero .m-flaps"); if (f) { f.classList.remove("m-jourj"); void f.offsetWidth; f.classList.add("m-jourj"); setTimeout(() => f.classList.remove("m-jourj"), 3600); } if (window.SONS && SONS.succes) SONS.succes(); }   // lot 62 · « le jour J » : un reflet d'or sur le total
  toast("Palier franchi : " + m.titre + " ✓" + (n ? " · prochaine récompense : " + (surpriseCachee(n.r[0][0], n.r[0][1]) ? "une surprise" : nomObj(n.r[0][0], n.r[0][1])) : ""));
}
/** l'aperçu d'un objet dans une fête (le vrai objet : palette, nuancier, courbe…) */
function apercuFete(t, id) { return t === "aff" ? '<span class="m-flaps">' + flaps("12", false, id) + "</span>" : t === "titre" ? '<span class="vs-em">🏷️</span>' : apercuObj(t, id); }
function htmlRecsFete(recs) {
  return '<div class="mf-recs">' + recs.map(([t, id]) => {
    const s = SORTES.find(y => y[0] === t);
    return '<button class="mf-rec" type="button" data-mf-eq="' + t + "." + id + '" aria-label="' + esc("Équiper " + s[1].toLowerCase() + " " + nomObj(t, id)) + '"><span class="mf-ap">' + apercuFete(t, id) + "</span><b>" + esc(nomObj(t, id)) + "</b><small>" + esc(s[1]) + '</small><em class="mf-eq">Équiper</em></button>';
  }).join("") + "</div>";
}
function brancherFete(o, fermer) {
  o.querySelector("[data-continuer]").addEventListener("click", fermer);
  o.querySelectorAll("[data-mf-eq]").forEach(b => b.addEventListener("click", () => {
    const [t, id] = b.dataset.mfEq.split("."); oublierObjets(); equiper(t, id);
    o.querySelectorAll(".mf-rec.fait").forEach(y => { if (y !== b && y.dataset.mfEq.split(".")[0] === t) { y.classList.remove("fait"); y.querySelector(".mf-eq").textContent = "Équiper"; } });
    b.classList.add("fait"); b.querySelector(".mf-eq").textContent = "Équipé ✓";
    if (t === "fete") lancerFete(id);
    if (vueMoi()) rendre();
  }));
  const t0 = Date.now(); o.addEventListener("click", e => { if (e.target === o && Date.now() - t0 > 2200) fermer(); });   // V15.9 : laisse l'afficheur finir
}
function feter(x, suite) {
  injecterStyle();
  if (ETAT.discret === "oui" && FAM_EUR.includes(x.groupe)) x = Object.assign(masquerPalier(x), { grand: "•••", quand: null });   // lot 44 : mode discret, ni seuil ni date
  const o = document.createElement("div");
  o.className = "m-fete moi"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
  const recs = recsDe(x);
  const aff = recs.find(r => r[0] === "aff"), fini = x.regul && regulEpuisee();
  o.innerHTML = '<div><span class="mf-k">' + (x.regul ? "🛡️ Régularité" : x.secret ? "Récompense cachée trouvée" : "Palier franchi") + '</span><div class="m-flaps">' + flaps(x.grand, !reduit, aff ? aff[1] : null) + "</div><h3>" + esc(x.titre) + "</h3>" +
    (x.regul ? "<p>" + phraseRegul() + "</p>" : x.secret ? "<p>" + esc(x.secret.quoi) + "</p>" : x.quand ? "<p>Franchi en " + esc(libMois(x.quand, true)) + ".</p>" : "") +
    (recs.length ? '<p class="mf-af">' + (recs.length > 1 ? "Tes " + recs.length + " objets" : "Ton objet") + " · touche pour l'équiper</p>" + htmlRecsFete(recs) : "") +
    '<button class="wr-btn" type="button" data-continuer>Continuer</button></div>';
  document.body.appendChild(o);
  const fermer = () => { o.remove(); if (suite && suite.length) feter(suite[0], suite.slice(1)); };   // enchaîne sans trou (la clôture attend la fin des fêtes)
  brancherFete(o, fermer);
  lancerFete();
}
/** lot 44 : rattrapage (plusieurs paliers, objets cachés, régularité) : un seul écran récapitulatif */
function feterRecap(file) {
  injecterStyle();
  const disc = ETAT.discret === "oui";
  const pals = file.filter(x => !x.regul && !x.secret), secs = file.filter(x => x.secret), reg = file.find(x => x.regul);
  const vus = new Set(), recs = [];
  file.forEach(x => recsDe(x).forEach(r => { const k = cleObj(r[0], r[1]); if (!vus.has(k)) { vus.add(k); recs.push(r); } }));
  const morceaux = [];
  if (pals.length) morceaux.push(pals.length + (pals.length > 1 ? " paliers franchis" : " palier franchi"));
  if (secs.length) morceaux.push(secs.length + (secs.length > 1 ? " récompenses cachées" : " récompense cachée"));
  if (reg) morceaux.push((reg.recs.length) + (reg.recs.length > 1 ? " mois de régularité" : " mois de régularité"));
  const titre = morceaux.join(" + ") + (recs.length ? " · " + recs.length + (recs.length > 1 ? " objets" : " objet") : "");
  const lignes = pals.map(x => disc && FAM_EUR.includes(x.groupe) ? masquerPalier(x).titre : x.titre).concat(secs.map(x => "Cachée : " + x.secret.nom));
  const aff = recs.find(r => r[0] === "aff");
  const o = document.createElement("div");
  o.className = "m-fete moi"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
  o.innerHTML = '<div><span class="mf-k">Du nouveau</span><div class="m-flaps">' + flaps(recs.length ? "+" + recs.length : String(pals.length || 1), !reduit, aff ? aff[1] : null) + "</div><h3>" + esc(titre) + "</h3>" +
    (lignes.length ? '<ul class="mf-l">' + lignes.slice(0, 8).map(l => "<li>✓ " + esc(l) + "</li>").join("") + (lignes.length > 8 ? "<li>… et " + (lignes.length - 8) + " de plus</li>" : "") + "</ul>" : "") +
    (reg ? "<p>" + phraseRegul() + "</p>" : "") +
    (recs.length ? '<p class="mf-af">Touche un objet pour l\'équiper</p>' + htmlRecsFete(recs) : "") +
    '<button class="wr-btn" type="button" data-continuer>Continuer</button></div>';
  document.body.appendChild(o);
  brancherFete(o, () => o.remove());
  lancerFete();
}
const palOuverts = new Set();
function htmlBilansMoi() {
  const k = moisPrecedentK(), i = k % 100 - 1, ans = anneesPrivees().slice(0, 2);
  return '<div><h2 class="sec">Mes bilans <small>privés</small></h2></div><div class="m-bilans">' +
    (diaposCloture(k).length > 1 ? '<button class="bilan-b prive" type="button" data-m-cloture="' + k + '">🔒 Revoir la clôture ' + deMois(i) + esc(MOIS_L[i]) + " " + Math.floor(k / 100) + "</button>" : "") +
    ans.map(an => '<button class="bilan-b prive" type="button" data-m-bilan="' + an + '">🔒 Mon patrimoine ' + an + "</button>").join("") + "</div>";
}
/* D (v16.93) : en mode discret, les paliers en euros ne montrent ni le seuil, ni la jauge, ni le % (ils laisseraient deviner le montant) */
const FAM_EUR = ["pat", "bourse", "verse", "gains", "gainsAn"];
function masquerPalier(x) {
  if (!x || ETAT.discret !== "oui" || !FAM_EUR.includes(x.groupe)) return x;
  return Object.assign({}, x, { court: "•••", titre: x.titre.replace(/\d[\d\s\u202F\u00A0.,]*\s?€/g, "•••" + NB + "€"), reste: "", cache: true });
}
/* lot 44 · carte « Ce mois-ci » : le versement du mois d'abord (aucun euro : compatible mode discret ; aucune règle changée)
   lot 51 (Théo : « tuiles trop grosses ») : compacte, sans aperçus ; les objets sont dans « Récompenses » juste en dessous ; la couronne du million dans l'en-tête */
function htmlCeMois(cour) {
  let sv; try { sv = serieVersements(); } catch (e) { sv = null; }
  if (!sv || !sv.liste.length) return "";
  const now = new Date(), mo = MOIS_L[now.getMonth()], Mo = mo.charAt(0).toUpperCase() + mo.slice(1);
  const finM = new Date(now.getFullYear(), now.getMonth() + 1, 0), fin = String(finM.getDate()).padStart(2, "0") + "/" + String(finM.getMonth() + 1).padStart(2, "0");
  const RI = regulInfo(), n = RI.n, L = RG.length, fini = RI.fini, e = k => k + (k === 1 ? "<sup>er</sup>" : "<sup>e</sup>");
  const an = cleMoisD(now).slice(0, 4), jk = (sv.jokers || {})[an], libJ = jk ? MOIS_L[+jk.slice(5, 7) - 1] : "";
  let tete, sous = "";
  if (sv.moisEnCours) tete = "<b>" + esc(Mo) + " fait ✓</b> · série de " + sv.actuelle + " mois";
  else {
    tete = "<b>" + esc(Mo) + " : pas encore versé</b>";
    sous = sv.actuelle ? "Ta série de <b>" + sv.actuelle + " mois</b> est en jeu jusqu'au " + fin + (jk ? " (joker de " + an + " déjà utilisé)." : " (joker de l'année encore dispo).")
      : "Un versement d'ici le " + fin + ", même petit, lance ta série.";
  }
  // lot 54 : le joker vient d'être utilisé (mois précédent) → on le dit
  if (jk && jk === moisSuivant(cleMoisD(now), -1) && sv.actuelle) sous = (sous ? sous + " " : "") + "🛟 Joker utilisé en " + esc(libJ) + " : ta série a tenu.";
  const piste = '<p class="cm-pt">Régularité : <b>' + n + " mois versés</b>" + (fini ? " · les " + L + " objets gagnés" : " · prochain objet au " + e(RI.auMois)) + "</p>";
  return '<section class="m-cemois' + (sv.moisEnCours ? " fait" : "") + '" aria-label="Ce mois-ci"><div class="cm-h"><span class="cm-k">Ce mois-ci</span>' + (cour || "") + '</div><p class="cm-t">' + tete + "</p>" + (sous ? '<p class="cm-s">' + sous + "</p>" : "") + piste + carteFidelite(sv) + "</section>";
}
/* lot 56 · carte de fidélité (Théo) : 12 cases tamponnées pour les mois versés de l'année ; une seule ligne, rien à déplier, aucun euro */
function carteFidelite(sv) {
  const an = cleMoisD(new Date()).slice(0, 4), auj = cleMoisD(new Date()), par = {}; sv.liste.forEach(x => { par[x.m] = x; });
  let nb = 0; const cases = MOIS_L.map((nom, i) => {
    const m = an + "-" + String(i + 1).padStart(2, "0"), x = par[m];
    const cl = x && x.ok ? "ok" : x && x.joker ? "jk" : x && m < auj ? "rate" : m === auj ? "cour" : x ? "" : "hors"; if (cl === "ok") nb++;
    return '<i class="cf-' + (cl || "vide") + '" title="' + esc(nom + (cl === "ok" ? " : versé" : cl === "jk" ? " : joker" : cl === "rate" ? " : sans versement" : cl === "cour" ? " : en cours" : "")) + '">' + (cl === "ok" ? "✓" : cl === "jk" ? "🛟" : esc(nom.charAt(0).toUpperCase())) + "</i>";
  }).join("");
  return '<div class="cm-cf" role="img" aria-label="' + esc("Carte de fidélité " + an + " : " + nb + " mois tamponnés sur 12") + '"><span class="cf-k">' + an + '</span><span class="cf-c">' + cases + '</span><b class="cf-n">' + nb + "/12</b></div>";
}
/* lot 51 (Théo) : le million n'est plus un gros bloc ; une couronne discrète (« 👑 4,2 % ») en haut de Missions, un toucher déplie le détail.
   Replié à chaque ouverture de l'appli : l'ouverture n'est pas mémorisée (règle de Théo). Même calcul qu'avant (patrimoine financier seulement). */
let milOuvertM = false;
function puceMillion() {
  let t = "•••";
  if (ETAT.discret !== "oui") { const E = millionEstime(), v = E ? E.v : (valeurMillion() || 0); t = F1.format(Math.max(0, Math.min(1, v / CIBLE)) * 100) + NB + "%"; }
  return '<button type="button" class="mi-cour" data-mi-cour aria-expanded="' + milOuvertM + '" aria-controls="m-million-z" aria-label="' + esc("Cap sur le million : " + (t === "•••" ? "masqué" : t) + (milOuvertM ? ", replier" : ", voir le détail")) + '">' +
    '<span class="mi-c" aria-hidden="true">👑</span><b>' + t + '</b><i aria-hidden="true">' + (milOuvertM ? "▴" : "▾") + "</i></button>";
}
function afficherMillionM(v) {
  const z = v.querySelector("#m-million-z"); if (!z) return;
  v.querySelectorAll("[data-mi-cour]").forEach(b => { b.outerHTML = puceMillion(); });
  v.querySelectorAll("[data-mi-cour]").forEach(b => b.addEventListener("click", () => { milOuvertM = !milOuvertM; afficherMillionM(v); }));
  if (!milOuvertM || !M) { z.innerHTML = ""; z.hidden = true; return; }
  const av = PREF.millionReduit; PREF.millionReduit = false;   // le détail complet, sans toucher au réglage gardé
  let h = ""; try { h = htmlMillion(); } finally { if (av === undefined) delete PREF.millionReduit; else PREF.millionReduit = av; }
  z.hidden = false; z.innerHTML = h;
  const r = z.querySelector("#mm-reduire"); if (r) { r.textContent = "Fermer ▴"; r.setAttribute("aria-expanded", "true"); r.addEventListener("click", () => { milOuvertM = false; afficherMillionM(v); const c = v.querySelector("[data-mi-cour]"); if (c) c.focus(); }); }
  z.querySelectorAll("[data-m-razproj]").forEach(b => b.addEventListener("click", () => { razReglagesProj(); afficherMillionM(v); }));
  z.querySelectorAll("[data-m-voirproj]").forEach(b => b.addEventListener("click", () => {   // comme avant : la projection unique est dans Patrimoine
    PREF.onglet = "patrimoine"; PREF.acc["m-proj"] = true; garderPref(); rendre();
    const d = document.querySelector('#v-moi details[data-acc="m-proj"]'); if (d) d.scrollIntoView({ block: "start", behavior: reduit ? "auto" : "smooth" }); else window.scrollTo(0, 0);
  }));
}
/* lot 51 (Théo) : « Récompenses » = les derniers objets gagnés (avec le mois) et les prochains (avec ce qu'il reste à faire).
   Lu sur les données existantes (régularité, paliers) : aucune règle ni aucun stockage ne change. En mode discret, rien des familles en euros.
   Mini-Conseil : « À venir » d'abord (la suite directe de Ce mois-ci), puis « Récemment gagnées ». */
function recompensesRecentes(n) {
  const E = etatObjets(), discret = ETAT.discret === "oui", l = [], vu = new Set();
  try { regulInfo().gains.forEach((g, i) => l.push({ r: g.r, m: g.m, o: i })); } catch (e) { /* pas de parcours */ }
  (E.pal || []).forEach((x, i) => { if (!x.atteint || !x.quand || !E.rec.has(x.id) || (discret && FAM_EUR.includes(x.groupe))) return; E.rec.get(x.id).forEach(r => l.push({ r, m: x.quand, o: 1000 + i })); });
  return l.filter(x => E.ok.has(cleObj(x.r[0], x.r[1]))).sort((a, b) => a.m < b.m ? 1 : a.m > b.m ? -1 : b.o - a.o)
    .filter(x => { const k = cleObj(x.r[0], x.r[1]); if (vu.has(k)) return false; vu.add(k); return true; }).slice(0, n);
}
function recompensesAVenir(n) {
  const E = etatObjets(), discret = ETAT.discret === "oui", l = [], RI = regulInfo(), nv = RI.n;
  if (RI.prochain) {   // lot 54 : au rythme de la régularité (parfois dans 2 mois versés)
    let sv = null; try { sv = serieVersements(); } catch (e) { sv = null; }
    const pro = MOIS_L[(new Date().getMonth() + 1) % 12];
    l.push({ r: RI.prochain, quoi: RI.reste > 1 ? "encore " + RI.reste + " mois versés" : sv && sv.moisEnCours ? "verse en " + pro : nv ? "verse ce mois-ci" : "ton 1<sup>er</sup> versement", part: 2 });
  }
  const pal = [];
  FAMILLES.forEach(([g]) => { if (discret && FAM_EUR.includes(g)) return; const pr = prochaineRec(g); if (pr) pal.push({ r: pr.r[0], plus: pr.r.length - 1, quoi: cheminP(masquerPalier(pr.x)), g, part: pr.x.part || 0, mois: moisRestants(pr.x) }); });
  // lot 54 : ce qu'on fait d'abord : les paliers « en mois » à 3 mois ou moins, puis les paliers en euros (par %), puis le reste
  const proches = pal.filter(x => x.mois !== null && x.mois <= 3).sort((a, b) => a.mois - b.mois), eu = pal.filter(x => x.mois === null).sort((a, b) => b.part - a.part);
  return l.concat(proches, eu, pal.filter(x => x.mois !== null && x.mois > 3).sort((a, b) => a.mois - b.mois)).slice(0, n);
}
function htmlRecompensesM() {
  const s = new Date(), auj = s.getFullYear() + "-" + String(s.getMonth() + 1).padStart(2, "0");
  const carte = (x, sous, attr) => { const sur = x.quoi && surpriseCachee(x.r[0], x.r[1]), nm = sur ? "Surprise" : nomObj(x.r[0], x.r[1]);   // lot 56 : l'objet d'anniversaire reste secret
    return '<' + (attr ? 'button type="button" ' + attr : "span") + ' class="rc-c' + (x.quoi ? " av" : "") + '" title="' + esc(nm) + '"><span class="rc-ap">' + (sur ? '<span class="vs-em">🎁</span>' : apercuFete(x.r[0], x.r[1])) + '</span><b>' + esc(nm) + (x.plus ? " <em>+" + x.plus + "</em>" : "") + "</b><small>" + sous + "</small></" + (attr ? "button" : "span") + ">"; };
  const rec = recompensesRecentes(3), av = recompensesAVenir(3);
  if (!rec.length && !av.length) return "";
  const ligne = (k, l) => '<div class="rc-l"><span class="rc-k">' + k + '</span><div class="rc-g">' + l + "</div></div>";
  return '<section class="m-recs" aria-label="Récompenses">' +
    (av.length ? ligne("À venir", av.map(x => carte(x, x.quoi, x.g ? 'data-rc-fam="' + x.g + '"' : "")).join("")) : "") +
    (rec.length ? ligne("Récemment gagnées", rec.map(x => carte(x, x.m === auj ? "ce mois-ci" : esc(libMois(x.m)), 'data-vt-ouv="' + x.r[0] + '" aria-label="' + esc(nomObj(x.r[0], x.r[1]) + ", gagné " + (x.m === auj ? "ce mois-ci" : libMois(x.m, true)) + ", ouvrir le vestiaire") + '"')).join("")) : "") + "</section>";
}
/** lot 54 · combien de mois avant un palier « en temps » (séries, mois versés, sans vendre, ancienneté…) ; null pour les paliers en euros */
function moisRestants(x) {
  if (typeof x.mr === "number") return x.mr;   // lot 56 : les nouvelles missions disent elles-mêmes combien de mois il reste
  if (FAM_EUR.includes(x.groupe)) return null;
  const n = +String(x.id).replace(/^\D+/, "").replace(/\D.*$/, "") || 0;
  if (x.groupe === "serie") return Math.max(1, n - serieVersements().actuelle);
  if (x.groupe === "mois") return Math.max(1, n - moisVerses());
  if (x.groupe === "anv") return x.manque || 99;
  const duree = x.groupe === "vente" ? n : x.groupe === "annee" ? n * 12 : x.groupe === "fisc" ? (/^PEA/.test(x.court) ? 60 : 96) : 12;
  return Math.max(0, (1 - Math.max(0, Math.min(1, x.part))) * duree);
}
const pctNw = v => '<span class="nw">' + pct(Math.max(0, Math.min(1, v)), 0, false) + "</span>";
/** le chemin qui reste jusqu'à un palier (« encore 2 mois », « 70 % ») ; masqué en mode discret pour les familles en euros */
function cheminP(x) {
  if (x.cache) return "•••";
  if (x.chemin) return esc(x.chemin);   // lot 56
  if (x.groupe === "serie" || x.groupe === "mois") {
    const n = +String(x.id).replace(/\D/g, ""), sv = serieVersements(), fait = x.groupe === "serie" ? sv.actuelle : sv.liste.filter(z => z.ok).length, r = Math.max(1, n - fait);
    return "encore " + r + " mois" + (x.groupe === "serie" ? " d'affilée" : "");
  }
  if (x.groupe === "anv") return x.manque ? "encore " + x.manque + " mois versé" + (x.manque > 1 ? "s" : "") : "l'an prochain";   // lot 54
  return pctNw(x.part);
}
function htmlMissions() {
  const pal = paliers().map(masquerPalier), nbFaits = pal.filter(x => x.atteint).length;
  const E = etatObjets(), recDe = id => E.rec.get(id) || [];
  const icone = (t, id) => t === "emb" || t === "fete" ? defObj(t, id)[2] : SORTES.find(x => x[0] === t)[2];
  const htmlRecs = x => { const l = recDe(x.id); return l.length && !x.cache ? '<em class="pl-rec">' + l.map(([t, id]) => "<span>" + (surpriseCachee(t, id) ? "🎁 Surprise" : icone(t, id) + " " + esc(nomObj(t, id))) + "</span>").join("") + "</em>" : ""; };
  const ligneP = x => '<button type="button" class="pl-r' + (x.atteint ? " fait" : "") + '" data-palier="' + esc(x.id) + '"' + (x.atteint ? "" : " disabled") + '>' +
    '<span class="pastille">' + esc(x.court) + '</span><span class="pl-t">' + esc(x.titre) + htmlRecs(x) + (x.atteint || x.cache ? "" : '<span class="jauge"><i style="width:' + Math.round(Math.max(0, Math.min(1, x.part)) * 100) + '%"></i></span><small>' + esc(x.reste) + "</small>") + "</span>" +
    (x.atteint ? '<span class="pl-s">✓' + (x.cache ? "" : " " + esc(libMois(x.quand))) + "</span>" : '<span class="pl-s">' + (x.cache ? "•••" : pctNw(x.part)) + "</span>") + "</button>";
  const dvSV = derniereVenteSV((M.ref || {}).parcours), derVente = dvSV.date;
  const bloc = (g, nom) => {
    const l = pal.filter(x => x.groupe === g); if (!l.length) return null;
    const faits = l.filter(x => x.atteint).length, suiv = l.find(x => !x.atteint), cache = l.some(x => x.cache);
    const pr = l.find(x => !x.atteint && recDe(x.id).length), r = pr ? recDe(pr.id)[0] : null;
    const html = '<details class="pl-bloc' + (suiv ? "" : " complet") + '" data-fam="' + g + '"' + (palOuverts.has(g) ? " open" : "") + "><summary>" +
      '<span class="pb-t">' + esc(nom) + '</span><span class="pb-n">' + (cache ? "•••" : faits + " / " + l.length) + "</span>" +
      (cache ? "" : '<span class="jauge" title="vers le prochain palier"><i style="width:' + (suiv ? Math.round(Math.max(0, Math.min(1, suiv.part)) * 100) : 100) + '%"></i></span>') +
      '<span class="pb-s">' + (cache ? "Masqué en mode discret" : suiv ? "Prochain : <b>" + esc(suiv.titre) + "</b> · " + cheminP(suiv) : g === "anv" ? "Tout est franchi pour " + new Date().getFullYear() + " ✓ · on recommence en janvier" : "Tout est franchi ✓") +
        (g === "vente" && derVente ? " · depuis ta dernière vente" + (dvSV.horsLevier ? " (hors levier)" : "") + " le " + esc(frDate(derVente)) : g === "vente" && dvSV.levier ? " · aucune vente hors levier (les ventes du Nasdaq ×1, ×2 et ×3 de la règle ne comptent pas)" : "") + "</span>" +
      (r && !cache ? '<span class="pb-r"><span class="pb-ap">' + (surpriseCachee(r[0], r[1]) ? '<span class="vs-em">🎁</span>' : apercuFete(r[0], r[1])) + "</span><span>🎁 <b>" + esc(surpriseCachee(r[0], r[1]) ? "Surprise" : nomObj(r[0], r[1])) + "</b>" + (recDe(pr.id).length > 1 ? " +" + (recDe(pr.id).length - 1) : "") + " · " + cheminP(pr) + "</span></span>" : "") +
      '</summary><div class="pl-liste">' + l.map(ligneP).join("") + "</div></details>";
    return { g, html, complet: !suiv };
  };
  const tous = FAMILLES.map(([g, nom, vitrine]) => Object.assign(bloc(g, nom) || {}, { vitrine })).filter(x => x.html);
  const vit = tous.filter(x => x.vitrine && !x.complet), aut = tous.filter(x => !x.vitrine && !x.complet), fin = tous.filter(x => x.complet);
  const groupe = (cle, titre, l) => l.length ? '<details class="pl-grp" data-grp="' + cle + '"' + (palOuverts.has(cle) ? " open" : "") + "><summary>" + titre + '</summary><div class="pl-blocs">' + l.map(x => x.html).join("") + "</div></details>" : "";
  const blocs = vit.map(x => x.html).join("") + groupe("_autres", "Autres paliers <small>(" + aut.length + ")</small>", aut) + groupe("_finies", (() => {   // v20.6 (Théo) : « Année de versements » n'est finie que pour l'année, elle revient en janvier
    const an = new Date().getFullYear(), anv = fin.some(x => x.g === "anv"), n = fin.length;
    if (anv && n === 1) return "✓ 1 famille finie pour " + an + " · revient en janvier";
    return "✓ " + n + (n > 1 ? " familles terminées" : " famille terminée") + (anv ? " <small>(dont une qui revient en janvier)</small>" : "");
  })(), fin);
  /* lot 44 : Ce mois-ci, million, tenue, paliers, Vestiaire, puis les bilans */
  /* lot 51 (Théo) : couronne du million dans l'en-tête de Ce mois-ci (détail replié), Récompenses (récentes / à venir), tenue compacte */
  const ce = htmlCeMois(puceMillion());
  return (ce || '<div class="mi-haut">' + puceMillion() + "</div>") + '<div id="m-million-z" class="mi-det" hidden></div>' + htmlRecompensesM() + htmlTenue() +
    '<div><h2 class="sec">Paliers <small>' + (pal.some(x => x.cache) ? "privé en mode discret" : nbFaits + " franchis sur " + pal.length) + "</small></h2></div>" +
    '<details class="pl-aide"' + (palOuverts.has("_aide") ? " open" : "") + ' data-grp="_aide"><summary>Comment ça marche ?</summary><p>🎁 = récompense · touche un palier franchi pour revoir sa fête</p><p>Régularité : un objet à chacun de tes 3 premiers mois versés, puis un tous les 2 mois versés. 🛟 Un mois sauté par an ne casse pas ta série.</p>' +
      '<p>Sans vendre : vendre le Nasdaq ×1, ×2 ou ×3 de la règle du levier ne compte pas. Défi d\'automne : verser en octobre, novembre et décembre. Mois économe : verser plus que ta moyenne des 6 mois d\'avant. Après une pause, 3 mois versés d\'affilée = un retour. 🎁 Chaque anniversaire de ton premier ordre cache un objet surprise.</p></details>' +
    '<div class="pl-blocs">' + blocs + "</div>" +
    htmlVestiaire() + htmlBilansMoi();
}
function brancherMissions(v) {
  afficherMillionM(v);
  v.querySelectorAll("[data-rc-fam]").forEach(b => b.addEventListener("click", () => {   // lot 51 : « À venir » ouvre sa famille de paliers
    const g = b.dataset.rcFam, d = v.querySelector('details.pl-bloc[data-fam="' + g + '"]'); if (!d) return;
    const grp = d.parentElement.closest("details.pl-grp"); if (grp) { grp.open = true; palOuverts.add(grp.dataset.grp); }
    d.open = true; palOuverts.add(g); d.scrollIntoView({ block: "start", behavior: reduit ? "auto" : "smooth" });
  }));
  v.querySelectorAll("details.pl-bloc").forEach(d => d.addEventListener("toggle", () => { if (d.open) palOuverts.add(d.dataset.fam); else palOuverts.delete(d.dataset.fam); }));
  v.querySelectorAll("details[data-grp]").forEach(d => d.addEventListener("toggle", () => { if (d.open) palOuverts.add(d.dataset.grp); else palOuverts.delete(d.dataset.grp); }));
  const pal = paliers();
  brancherVestiaire(v); brancherTenue(v);
  v.querySelectorAll("[data-m-cloture]").forEach(b => b.addEventListener("click", () => ouvrirCloture(+b.dataset.mCloture)));
  v.querySelectorAll("[data-m-bilan]").forEach(b => b.addEventListener("click", () => ouvrirDiapos("Mon patrimoine · " + b.dataset.mBilan, diaposPrivees(+b.dataset.mBilan))));
  v.querySelectorAll("[data-palier]").forEach(b => b.addEventListener("click", () => { const x = pal.find(p => p.id === b.dataset.palier); if (x && x.atteint) lancerFetes([x]); }));   // lot 44 : sans objet → un simple toast
}

/* ================= Bilan de patrimoine de l'année (privé : seulement sur ton appareil) ================= */
function anneesPrivees() {
  if (!M || !M.historique || !M.historique.rows) return [];
  return Array.from(new Set(M.historique.rows.map(r => Math.floor(r[0] / 10000)))).sort((a, b) => b - a);
}
function diaposPrivees(an) {
  const L = [], b = bilanAnneeM(an), enCours = an === new Date().getFullYear();
  const cls = v => sens(v) === "flat" ? "" : sens(v);
  const s = seriePatrimoine(), fin = s.filter(x => x.an === an).pop();
  /* lot 46 : pour un profil avec un départ (Théo, Clément), l'année du départ se compare au point de départ, pas à fin décembre d'avant */
  const dk = departK(), apresDep = dk && Math.floor(dk / 100) === an && (an - 1) * 100 + 12 < dk;
  let av = s.filter(x => x.an < an).pop(); if (apresDep) av = s.find(x => x.an * 100 + x.mo === dk && x !== fin) || null;
  const surAn = apresDep ? " " + txtDepuis(dk, true) : " sur l'année";
  const net = x => x ? x.bourse + x.epargne + x.immo : null;
  const nom = esc(ETAT.moi || "toi");
  L.push({ c: "#F5C542", h: '<div class="wr-k">🔒 Privé · ' + nom + '</div><div class="wr-big titre">Mon patrimoine<br>' + an + '</div><p class="wr-p">' + (enCours ? "Ton année jusqu'ici, au " + dateLongue(b ? b.fin : new Date()) + "." : "Ton année en bourse, en épargne et en pierre.") + " Ces écrans ne sont visibles que sur ton téléphone.</p>" });
  if (fin) {
    const d = av ? net(fin) - net(av) : null;
    L.push({ c: "#9B87FF", h: '<div class="wr-k">Patrimoine net</div><div class="wr-big">' + eur(net(fin)) + "</div>" +
      (d !== null ? '<p class="wr-p">' + (d >= 0 ? "En hausse de" : "En baisse de") + ' <b class="' + cls(d) + '">' + eur(Math.abs(d)) + "</b>" + surAn + ", de " + eur(net(av)) + " à " + eur(net(fin)) + ".</p>" : '<p class="wr-p">Première année suivie : la comparaison viendra l\'an prochain.</p>') +
      '<div class="wr-g"><div class="wr-c"><span>Bourse</span><b>' + eur(fin.bourse) + '</b></div><div class="wr-c"><span>Épargne</span><b>' + eur(fin.epargne) + "</b></div>" + (fin.immo ? '<div class="wr-c" style="grid-column:1/-1"><span>Immobilier net</span><b>' + eur(fin.immo) + "</b></div>" : "") + "</div>" });
  }
  if (b) {
    const ecart = ok(b.sp) ? b.twr - b.sp : null;
    const lecture = ecart === null ? "" : ecart > 0.02 ? "Tu as battu le S&P 500 : année réussie." : ecart < -0.02 ? "Le S&P 500 a fait mieux que toi cette année : ça arrive, c'est sur la durée que ça se joue." : "Au coude-à-coude avec le S&P 500.";
    L.push({ c: couleurM(), h: '<div class="wr-k">En bourse</div><div class="wr-big"><span class="' + cls(b.gain) + '">' + eur(b.gain, 0, true) + '</span></div><p class="wr-p">' + (b.gain >= 0 ? "Ce que le marché t'a rapporté" : "Ce que le marché t'a repris") + ", en plus des <b>" + eur(b.verse) + "</b> que tu as versés.</p>" +
      '<div class="wr-g"><div class="wr-c"><span>Ta performance</span><b class="' + cls(b.twr) + '">' + pct(b.twr) + '</b></div><div class="wr-c"><span>S&amp;P 500</span><b>' + pct(b.sp) + "</b></div></div>" + (lecture ? '<p class="wr-p">' + lecture + "</p>" : "") });
    if (b.meilleur) L.push({ c: "#2FD1C0", h: '<div class="wr-k">Tes mois</div><div class="wr-g"><div class="wr-c"><span>Meilleur mois</span><b class="up">' + esc(MOIS_L[b.meilleur.mois - 1]) + "</b><em>" + eur(b.meilleur.eur, 0, true) + " · " + pct(b.meilleur.twr) + "</em></div>" +
      (b.pire ? '<div class="wr-c"><span>Pire mois</span><b class="down">' + esc(MOIS_L[b.pire.mois - 1]) + "</b><em>" + eur(b.pire.eur, 0, true) + " · " + pct(b.pire.twr) + "</em></div>" : "") + "</div>" +
      (b.pire && b.pire.eur < 0 ? '<p class="wr-p">Et tu as continué. C\'est ça qui compte.</p>' : "") });
  }
  const mpm = (M.moisParMois || []).filter(r => String(r.mois).slice(0, 4) === String(an) && ok(r.epargne));
  if (mpm.length) {
    let prevE = (M.moisParMois || []).filter(r => +String(r.mois).slice(0, 4) < an && ok(r.epargne)).pop();
    const pD = apresDep ? s.find(x => x.an * 100 + x.mo === dk && x.complet) : null;   // lot 46 : même départ que le patrimoine
    if (pD) prevE = { epargne: pD.epargne, uc: 0 };
    const e0 = prevE ? prevE.epargne + (prevE.uc || 0) : mpm[0].epargne + (mpm[0].uc || 0), e1 = mpm[mpm.length - 1].epargne + (mpm[mpm.length - 1].uc || 0);
    const tot = (M.epargne || []).find(x => /^Total/.test(x.nom));
    L.push({ c: "#F5C542", h: '<div class="wr-k">Ton épargne</div><div class="wr-big">' + eur(e1) + '</div><p class="wr-p">' + (e1 >= e0 ? "En hausse de" : "En baisse de") + " <b>" + eur(Math.abs(e1 - e0)) + "</b>" + surAn + " (livrets et assurance-vie)." + (e1 < e0 ? " Une partie a sans doute servi à un projet ou à la bourse." : "") + "</p>" +
      (enCours && tot && tot.acquis ? '<div class="wr-g"><div class="wr-c" style="grid-column:1/-1"><span>Intérêts acquis cette année</span><b class="up">' + eur(tot.acquis, 0, true) + "</b></div></div>" : "") });
  }
  const mens = (M.prets || {}).mensuel || [];
  if (mens.length) {
    const debutAn = an + "-01-01", finAn = an + "-12-31", auj = isoJour(new Date());
    let r0 = null, r1 = null;
    mens.forEach(x => { if (x[0] < debutAn) r0 = x[1]; if (x[0] <= finAn && x[0] <= auj) r1 = x[1]; });
    if (r0 === null) { const prem = mens.find(x => x[0] >= debutAn); r0 = prem ? Math.max(...mens.map(x => x[1])) : null; }
    if (r0 !== null && r1 !== null && r0 > r1) L.push({ c: "#9B87FF", h: '<div class="wr-k">Ton appartement</div><div class="wr-big"><span class="up">' + eur(r0 - r1) + '</span></div><p class="wr-p">de capital remboursé cette année. Il reste <b>' + eur(r1) + "</b> à rembourser" + ((M.prets || {}).fin ? ", jusqu'en " + String(M.prets.fin).slice(0, 4) : "") + ".</p>" });
  }
  const g = M.signal;
  if (g && g.position) {
    const sig = (g.signaux || []).filter(x => String(x.date).slice(0, 4) === String(an));
    const expose = g.expose && String(g.depuis || "") < an + "-01-01";
    L.push({ c: "#4ADE80", h: '<div class="wr-k">Ton levier</div><div class="wr-mid">' + esc(g.position) + "</div>" +
      '<p class="wr-p">' + (sig.length ? sig.length + (sig.length > 1 ? " signaux" : " signal") + " cette année : " + sig.slice(0, 4).map(x => esc(x.type) + " le " + esc(frDate(x.date))).join(", ") + (sig.length > 4 ? "…" : "") + "." : "Aucun signal cette année : la règle t'a laissé tranquille.") + "</p>" +
      (expose ? '<p class="wr-p">En position toute l\'année : le Nasdaq a fait <b>' + pct((g.perfDepuis || 0) / 100) + "</b> depuis l'entrée du " + esc(frDate(g.depuis)) + ".</p>" : "") +
      (b ? '<p class="wr-p">' + (b.twr > (b.sp || 0) ? "Avec le levier, ton portefeuille a fait mieux que le S&P 500 : il a fait son travail." : "Cette année, le levier n'a pas suffi à battre le S&P 500.") + "</p>" : "") });
  }
  const sv = serieVersements(), moisAn = sv.liste.filter(x => +x.m.slice(0, 4) === an);
  if (moisAn.length) {
    let run = 0, longue = 0; moisAn.forEach(x => { run = x.ok ? run + 1 : 0; longue = Math.max(longue, run); });
    const nbV = moisAn.filter(x => x.ok).length;
    L.push({ c: "#FF8A3D", h: '<div class="wr-k">Ta régularité</div><div class="wr-big">' + nbV + " / " + moisAn.length + '</div><p class="wr-p">mois avec au moins un versement. Plus longue série de l\'année : <b>' + longue + " mois</b>." + (nbV === moisAn.length ? " Sans faute." : "") + "</p>" });
  }
  const franchis = paliers().filter(x => x.atteint && x.quand && +x.quand.slice(0, 4) === an).filter((x, i, l) => !l.slice(i + 1).some(y => y.groupe === x.groupe));
  L.push({ c: "#F5C542", h: '<div class="wr-k">Paliers franchis · ' + franchis.length + "</div>" + (franchis.length ? '<div class="wr-l">' + franchis.slice(0, 8).map(x => '<div class="wr-r"><span class="rk">✓</span><b style="font-size:15px">' + esc(x.titre) + "</b><span></span></div>").join("") + "</div>" : '<p class="wr-p">Pas de nouveau palier cette année : le prochain n\'est pas loin.</p>') +
    '<button class="wr-btn" type="button" data-wr-fermer>Fermer</button>' });
  return L;
}
function couleurM() { try { return D ? couleur(ETAT.moi) : "#4C9AFF"; } catch (e) { return "#4C9AFF"; } }

/* ================= Clôture du mois (privée : calculée et gardée sur cet appareil, rien n'est envoyé) =================
   Rien n'est recalculé ici : marché = moisParMois (grille des Stats), versement = serieVersements (Missions),
   paliers et récompenses = paliers + etatObjets (Missions/Vestiaire), palettes = flaps, écran = ouvrirDiapos (bilans). */
function moisPrecedentK() { const d = new Date(), p = new Date(d.getFullYear(), d.getMonth() - 1, 1); return p.getFullYear() * 100 + p.getMonth() + 1; }
function deMois(i) { return /^[aeiouyéèâ]/i.test(MOIS_L[i]) ? "d'" : "de "; }   // d'avril, d'août, d'octobre
function diaposCloture(k) {
  const an = Math.floor(k / 100), mo = k % 100, i = mo - 1, nomM = MOIS_L[i], mm = an + "-" + String(mo).padStart(2, "0");
  const cls = v => sens(v) === "flat" ? "" : sens(v), p2 = n => String(Math.min(99, n)).padStart(2, "0");
  const palette = (t, anim) => '<div class="moi m-flaps cl-flaps">' + flaps(t, anim) + "</div>";
  const L = [];
  // 1. le mois en palettes
  L.push({ c: couleurM(), h: '<div class="wr-k">🔒 Privé · ' + esc(ETAT.moi || "toi") + "</div>" + palette(nomM.toUpperCase(), !reduit) +
    '<div class="wr-mid">Clôture ' + deMois(i) + esc(nomM) + " " + an + '</div><p class="wr-p">Ton mois à toi : le marché, ton versement, tes paliers. Visible seulement sur ce téléphone.</p>' });
  // 2. le marché : résultat hors versements et TWR du mois, comme la grille « Mois par mois »
  let x = null; try { x = moisParMois().find(z => z.an === an && z.mois === mo) || null; } catch (e) { x = null; }
  L.push({ c: "#4C9AFF", h: '<div class="wr-k">Le marché en ' + esc(nomM) + "</div>" + (x
    ? '<div class="wr-big"><span class="' + cls(x.eur) + '">' + eur(x.eur, 0, true) + '</span></div><p class="wr-p">' + (x.eur >= 0 ? "Ce que le marché t'a rapporté" : "Ce que le marché t'a repris") + " sur ta bourse, hors versements.</p>" +
      '<div class="wr-g"><div class="wr-c" style="grid-column:1/-1"><span>Performance du mois (TWR)</span><b class="' + cls(x.twr) + '">' + pct(x.twr) + "</b></div></div>"
    : '<p class="wr-p">' + (M.simple ? "Ta bourse se suit dans le Versus : son bilan du mois est dans l'onglet Mois." : "Pas de relevé de bourse pour ce mois dans ton fichier.") + "</p>") });
  // 3. le versement : la série de Missions, arrêtée à la fin du mois
  let sv = null; try { sv = serieVersements(); } catch (e) { sv = null; }
  const idx = sv ? sv.liste.findIndex(z => z.m === mm) : -1;
  if (idx >= 0) {
    let run = 0, avant = 0, rec = 0;
    for (let j = 0; j <= idx; j++) { avant = run; run = sv.liste[j].ok ? run + 1 : sv.liste[j].joker ? run : 0; rec = Math.max(rec, run); }   // lot 54 : joker
    L.push({ c: "#FF8A3D", h: '<div class="wr-k">Ton versement</div>' + (sv.liste[idx].ok
      ? '<div class="wr-mid">Fait ✓</div><div class="cl-serie">' + palette(p2(avant), false) + '<span class="cl-fl" aria-hidden="true">→</span>' + palette(p2(run), !reduit) + "</div>" +
        '<p class="wr-p"><b>' + run + " mois</b> d'affilée avec un versement" + (run > 1 && run >= rec ? " : c'est ton record !" : (rec > run ? " · record " + rec + " mois" : "") + ".") + "</p>"
      : '<div class="wr-mid">Pas ce mois-là</div><p class="wr-p">' + (sv.liste[idx].joker ? "🛟 Ton joker de l'année a joué : ta série de <b>" + avant + " mois</b> tient." : avant ? "Ta série de <b>" + avant + " mois</b> repart de zéro." : "La série repart de zéro.") + " Un versement ce mois-ci, même 10 €, la relance.</p>") });
  }
  // 4. paliers franchis pendant le mois, 5. le plus proche, 6. récompenses débloquées
  let E = null; try { E = etatObjets(); } catch (e) { E = null; }
  const pal = E && E.pal ? E.pal : [];
  if (pal.length) {
    const franchis = pal.filter(z => z.atteint && z.quand === mm);
    L.push({ c: "#F5C542", h: '<div class="wr-k">Paliers franchis en ' + esc(nomM) + " · " + franchis.length + "</div>" + (franchis.length
      ? '<div class="wr-l">' + franchis.slice(0, 8).map(z => '<div class="wr-r"><span class="rk">✓</span><b style="font-size:15px">' + esc(z.titre) + "</b><span></span></div>").join("") + "</div>"
      : '<p class="wr-p">Pas de nouveau palier ce mois-ci.</p>') });
    const proche = pal.filter(z => !z.atteint && z.part < 1).sort((a, b) => b.part - a.part)[0];
    if (proche) L.push({ c: "#9B87FF", h: '<div class="wr-k">Le palier le plus proche</div><div class="wr-mid">' + esc(proche.titre) + '</div><div class="wr-big">' + pct(Math.max(0, proche.part), 0, false) +
      '</div><div class="cl-jauge"><i style="width:' + Math.round(Math.max(0, Math.min(1, proche.part)) * 100) + '%"></i></div><p class="wr-p">du chemin fait · ' + esc(proche.reste) + ".</p>" });
    const recs = []; franchis.forEach(z => (E.rec.get(z.id) || []).forEach(r => recs.push(r)));
    if (recs.length) L.push({ c: "#2FD1C0", h: '<div class="wr-k">Débloqué en ' + esc(nomM) + '</div><div class="wr-l">' + recs.map(([t, id]) => {
      const so = SORTES.find(y => y[0] === t); return '<div class="wr-r"><span class="rk">' + (t === "emb" || t === "fete" ? defObj(t, id)[2] : so[2]) + '</span><b style="font-size:15px">' + esc(nomObj(t, id)) + "</b><span>" + esc(so[1]) + "</span></div>";
    }).join("") + '</div><p class="wr-p">À équiper dans Missions › Vestiaire.</p>' });
  }
  L[L.length - 1].h += '<button class="wr-btn" type="button" data-wr-fermer>Fermer</button>';
  return L;
}
function ouvrirCloture(k) { lireCache(); if (!M) return; injecterStyle(); ouvrirDiapos("Clôture · " + MOIS_L[k % 100 - 1] + " " + Math.floor(k / 100), diaposCloture(k)); }
/* Une seule fois par mois, par appareil et par personne : à la première arrivée sur Moi, avec les données fraîches du fichier */
let clotureVerifiee = 0;   // dernier mois vérifié (une PWA peut rester ouverte d'un mois à l'autre)
function verifierCloture() {
  const k = moisPrecedentK();
  if (clotureVerifiee === k || !M || SRC !== "api" || !vueMoi() || !configure() || !identiteSure()) return;   // copie locale : on attend la réponse du fichier
  clotureVerifiee = k;
  const cleC = cleStock("cloture"), vu = +(stock.get(cleC) || 0);
  if (!vu) { stock.set(cleC, String(k)); return; }          // premier lancement : on note le mois, sans rien afficher
  if (vu >= k) return;
  if (diaposCloture(k).length < 2) { stock.set(cleC, String(k)); return; }   // fichier sans historique ni parcours : rien à raconter
  apresLesFetes(() => { if (!vueMoi()) { clotureVerifiee = 0; return; } stock.set(cleC, String(k)); ouvrirCloture(k); }, () => { clotureVerifiee = 0; });
}
/* jamais par-dessus une fête de palier (ni un autre écran plein) : on attend qu'il soit fermé */
function apresLesFetes(fn, abandon) {
  const occupe = () => document.querySelector(".m-fete, .wr, .tuto, .revel, .regles");
  let essais = 0;
  const attendre = () => { if (!vueMoi()) { if (abandon) abandon(); return; } if (occupe() && essais++ < 300) { setTimeout(attendre, 400); return; } fn(); };
  setTimeout(attendre, 600);
}

/* v16.83 : plus aucun envoi des lignes de bourse au Versus (privées pour tous, décision de Théo) : le code mort de partage est retiré */
/** V13 : transmet à TON fichier l'adresse du Versus et ton code, pour qu'il envoie lui-même ton relevé de fin de mois.
    Jamais avec la clé admin (Théo reste relevé par le Versus), jamais en simulation, une fois par ouverture. */
let liaisonFaite = false;
async function lierVersus() {
  try {
    if (liaisonFaite || !M || M.simple || M.versusLie !== false || SRC !== "api" || simulationM()) return;
    if (typeof vraiAdmin !== "function" || vraiAdmin() || typeof SESSION === "undefined" || !SESSION || !SESSION.nom || typeof apiUrl !== "function" || !apiUrl() || !stock.get(CLES.cle)) return;
    liaisonFaite = true;
    const rep = await posterFichier({ action: "liaisonVersus", url: apiUrl(), code: stock.get(CLES.cle), nom: SESSION.nom });
    if (rep && rep.ok) { M.versusLie = true; toast("🔗 Ton fichier enverra lui-même ton relevé de fin de mois au Versus."); }
  } catch (e) { /* réessai à la prochaine ouverture */ }
}

/* ---------- Notifications (cloche de l'en-tête) ----------
   rouge : anomalie dans les saisies ou alerte de cours déclenchée ; orange : rappel à faire ou dans les 2 jours ; rien sinon */
function dateRappel(txt) { const m = /(\d{2})\/(\d{2})\/(\d{4})\s*$/.exec(String(txt || "")); return m ? new Date(+m[3], +m[2] - 1, +m[1], 23, 59) : null; }
/* le bloc Rappels du fichier s'arrête avant le tableau « Mes actifs » */
function rappelsFichier() {
  const out = [];
  const sansArt = !aArtema();   // pas de support Artema (Devlin, Kévin…) : ses rappels de niveau d'indice n'ont pas lieu d'être
  for (const r of ((M.parametres || {}).rappels || [])) { if (/^Mes actifs/.test(r.nom || "")) break; if (r.nom && !(sansArt && /^artema(Initial|Actuel)$/.test(cleRappel(r.nom)))) out.push(r); }
  return out;
}
/* V15.2 · rappels : un bandeau dans Moi quand c'est dû, « Faire » (ouvre la bonne saisie) ou « Plus tard » (2 jours) */
function partielRappel(k) {
  const r = refData(), quint = (r.enveloppes.find(e => /Quintessa/.test(e.nom)) || {}).nom;
  if (k === "releve") return { type: "Relevé", env: quint, actif: "ARTEMA" };
  if (k === "interets") return { type: "Intérêts", env: (r.enveloppes.find(e => /Livret A/.test(e.nom)) || {}).nom, date: (new Date().getFullYear() - 1) + "-12-31" };
  if (k === "versement") { const rc = (r.raccourcis || []).find(x => /Quintessa/.test(x.env)); return rc ? depuisRaccourci(rc) : { env: quint }; }
  if (k === "fraisLx") return { type: "Frais en parts", env: envLinxea() };   // v17.77
  if (k === "linxea") { const lx = (r.enveloppes.find(e => /Linxea/.test(e.nom)) || {}).nom, rc = (r.raccourcis || []).find(x => /Linxea/.test(x.env)); return rc ? depuisRaccourci(rc) : { type: "Apport", env: lx }; }
  return null;
}
function faireRappel(k) {
  if ((k === "artemaActuel" || k === "releve" || k === "point") && aArtema()) { ouvrirPointArtema(k); return; }   // v16.87 : le Point Artema (valeur + niveau)
  if (k === "lxProg") { ouvrirCollerLinxea(); return; }   // v20.54 : « Faire » ouvre directement « Coller le texte » de l'import
  const pr = partielRappel(k);
  if (pr) { ouvrirSaisieM(pr); return; }
  reglageOuvert = k; delete reglageMsg[k]; ouvrirSaisieM(null, "maj");
}
function plusTard() { try { return JSON.parse(stock.get(cleStock("plusTard")) || "{}") || {}; } catch (e) { return {}; } }
function rappelReporte(x) { const k = cleRappel(x.nom) || x.nom; return (plusTard()[k] || 0) > Date.now(); }
function rappelDu(x) { return /À faire|mettre à jour|retard|⚠|✏/i.test(x.statut || "") && !rappelReporte(x) && !(LX_SANS.includes(cleRappel(x.nom)) && lxSans()); }
/* v20.65 (Théo, pour Clément) · « Aucun versement ce mois-ci » sur le rappel du versement Linxea (PAS sur ceux d'Artema, toujours obligatoires) :
   le rappel est rangé jusqu'au même jour le mois suivant (sa date habituelle). Gardé sur ce téléphone ({ depuis, jusqu }), rien n'est écrit dans le fichier.
   Retour en arrière : « Annuler » juste après, « Remettre le rappel » dans À faire, et effacé tout seul dès qu'un versement Linxea est saisi ce mois-là. */
const LX_SANS = ["linxea", "lxProg"];
function lxSans(maintenant) {
  let x = null; try { x = JSON.parse(stock.get(cleStock("lxSans")) || "null"); } catch (e) { x = null; }
  if (!x || !/^\d{4}-\d\d-\d\d$/.test(x.jusqu || "") || !/^\d{4}-\d\d-\d\d$/.test(x.depuis || "")) return null;
  const auj = isoJour(maintenant || new Date()), lx = envLinxea();
  if (auj >= x.jusqu) return null;
  if (lx && ((M && M.ref && M.ref.journal) || []).some(o => o.enveloppe === lx && o.type === "Apport" && String(o.date || "").slice(0, 7) >= x.depuis.slice(0, 7))) { stock.del(cleStock("lxSans")); return null; }   // un versement saisi ce mois-ci : le choix s'efface
  return x;
}
/** range le rappel jusqu'au même jour le mois suivant (jour = celui de la date habituelle du rappel, sinon aujourd'hui) */
function rangerLxSans(dateRappel, maintenant) {
  const n = maintenant || new Date(), auj = isoJour(n), j = /^\d{4}-\d\d-(\d\d)/.exec(dateRappel || "") ? +dateRappel.slice(8, 10) : n.getDate();
  const y = n.getFullYear() + (n.getMonth() === 11 ? 1 : 0), m = (n.getMonth() + 1) % 12 + 1;
  const jusqu = y + "-" + String(m).padStart(2, "0") + "-" + String(Math.min(j, new Date(y, m, 0).getDate())).padStart(2, "0");
  stock.set(cleStock("lxSans"), JSON.stringify({ depuis: auj, jusqu }));
  return jusqu;
}
function remettreLxSans() { stock.del(cleStock("lxSans")); }
/* v16.87 : l'ancien bandeau est remplacé par la boîte unique « À faire » (gardé pour compatibilité) */
function htmlBandeauRappel(o) { return htmlAFaire(o === "artema" ? "artema" : undefined); }
function brancherBandeauRappel(v) { brancherAFaire(v); }
/* ================= v16.87 · Phrase-bilan, boîte unique « À faire », Point Artema =================
   - phraseBilan : UNE ligne en tête d'Aujourd'hui (total, variation depuis la fin du mois dernier, LA chose à faire) ;
   - tachesAFaire / htmlAFaire : tous les rappels dus du fichier au même endroit (remplace le bandeau), « Faire » et « Plus tard » (2 jours) ;
   - ouvrirPointArtema : valeur de la ligne (€, relevé) ET niveau de l'indice (pts) en une fois, par les actions existantes « ordre » et « artema ». */
const VERBES_RAPPEL = { fraisLx: "saisir les frais de gestion Linxea", point: "faire le point Artema", releve: "saisir ton relevé Artema", artemaActuel: "saisir l'indice Artema", artemaInitial: "saisir le niveau de départ d'Artema",
  taux: "mettre à jour les taux des livrets", fondsEuros: "vérifier le taux du fonds euros", interets: "saisir les intérêts des livrets", appart: "revoir la valeur de l'appartement",
  calendrier: "compléter les jours fériés des bourses", versement: "saisir ton versement Quintessa", linxea: "saisir ton versement Linxea", soldes: "mettre à jour tes soldes", lxProg: "coller ton versement programmé Linxea" };
const ICO_RAPPEL = { lxProg: "💸", point: "🎯", releve: "🧾", artemaActuel: "🎯", artemaInitial: "📌", taux: "🏦", fondsEuros: "💶", interets: "🏦", appart: "🏠", calendrier: "📅", versement: "💸", linxea: "💸", soldes: "🏦" };
const POINT_ART = ["releve", "artemaActuel"];
function reporte(k) { return (plusTard()[k] || 0) > Date.now(); }
/** les tâches dues, la plus ancienne d'abord ; o = "artema" : seulement celles d'Artema */
/* v17.77 (Théo) : rappel des frais de gestion Linxea, prélevés en parts vers le 20 de mars, juin, septembre et décembre.
   Dû à partir du 20 du dernier mois de trimestre passé, tant qu'aucun « Frais en parts » n'a été saisi sur le contrat Linxea depuis. */
function envLinxea() { const r = refData(); return ((r.enveloppes || []).find(e => typeof e !== "string" && /Linxea/i.test(e.nom || "") && (!e.statut || e.statut === "Ouvert")) || {}).nom || ""; }
function fraisLxDu() {
  const lx = envLinxea(); if (!lx) return null;
  const auj = isoJour(new Date()), y = +auj.slice(0, 4), m = +auj.slice(5, 7);
  let due = null; for (let k = 0; k < 5 && !due; k++) { const mm = m - k, yy = y + Math.floor((mm - 1) / 12), m2 = ((mm - 1) % 12 + 12) % 12 + 1; if (m2 % 3 === 0) { const d = yy + "-" + String(m2).padStart(2, "0") + "-20"; if (d <= auj) due = d; } }
  if (!due || due < "2026-09-20") return null;   // premier rappel : les frais de septembre 2026
  const faits = ((M && M.ref && M.ref.journal) || []).filter(o => o.type === "Frais en parts" && o.enveloppe === lx).map(o => String(o.date || "").slice(0, 10));
  const local = stock.get(cleStock("fraisLx")) || ""; if (local) faits.push(local);
  return faits.some(d => d >= due.slice(0, 8) + "01") ? null : due;
}
/* v20.54 (Théo, 25/11) · rappel mensuel « Versement programmé Linxea » : le jour du mois vient d'une ligne « Versement programmé Linxea »
   des rappels du fichier (réglable là, comme le rappel de Clément) ; sans elle, du dernier versement Linxea saisi (un versement programmé
   tombe le même jour chaque mois). Dû à partir de ce jour tant qu'aucun versement Linxea n'est saisi depuis (5 jours de marge) ;
   s'éteint seul si aucun versement Linxea depuis plus de 2 mois (plus de versement programmé). */
function lxProgDu(maintenant) {
  const lx = envLinxea(); if (!lx || (M && M.simple)) return null;
  if (rappelsFichier().some(x => ["lxProg", "linxea"].includes(cleRappel(x.nom)))) return null;   // le fichier a déjà son rappel (réglable)
  const v = ((M && M.ref && M.ref.journal) || []).filter(o => o.enveloppe === lx && o.type === "Apport").map(o => String(o.date || "").slice(0, 10)).filter(d => /^\d{4}-\d\d-\d\d$/.test(d)).sort();
  const der = v[v.length - 1]; if (!der) return null;
  const n = maintenant || new Date(), auj = isoJour(n), jour = +der.slice(8, 10), y = n.getFullYear(), m = n.getMonth() + 1;
  const due = y + "-" + String(m).padStart(2, "0") + "-" + String(Math.min(jour, new Date(y, m, 0).getDate())).padStart(2, "0");
  if (due > auj || joursEntre(der, auj) > 62) return null;
  const marge = isoJour(new Date(new Date(due + "T12:00:00").getTime() - 5 * 864e5));
  return v.some(d => d >= marge) ? null : due;
}
function ouvrirCollerLinxea() {
  ouvrirSaisieM({ type: "Achat", env: envLinxea() });
  IMP = { panneau: true, coller: true }; etape = 1; rendreFormulaire();
  setTimeout(() => { const t = $f("f-imp-txt"); if (t) t.focus(); }, 60);
}
/* ---- (préparé, Théo 25/11) · « Vérifie ton prix de revient » ----
   1. AVANT d'enregistrer un achat (étape « Relire ») : le PRU de la ligne que l'appli calcule avec cet achat (prix moyen pondéré,
      frais compris), et l'écart avec le PRU actuel de ton fichier ; à comparer avec celui de ton compte en ligne.
   2. APRÈS l'enregistrement : un rappel « À faire » (et la cloche) « Vérifie le PRU de X sur ton compte en ligne : l'appli trouve Y € »,
      ✅ Conforme (rangé) ou ✏️ Corriger (ouvre l'Historique sur cet ordre). Gardé sur ce téléphone seulement (rien n'est envoyé),
      30 jours au plus, retiré seul si l'ordre est supprimé depuis l'appli. Mode discret : aucun prix affiché. */
function pruApres() {
  if (!F || F.type !== "Achat" || !F.actif || !F.env) return null;
  const q = lireNombre(F.qte), m = lireNombre(F.montant);
  if (!(q > 0 && m > 0) || millierDouteux(F.montant)) return null;
  const d = (refData().detenu || []).find(x => x.env === F.env && x.code === F.actif), q0 = d && d.qte > 1e-9 ? d.qte : 0;
  const p0 = q0 && typeof d.pru === "number" && d.pru > 0 ? d.pru : null;
  if (q0 && p0 === null) return null;   // ligne détenue mais PRU inconnu du fichier : pas de calcul inventé
  const v = { env: F.env, code: F.actif, avant: p0, apres: null, date: F.date, pourquoi: "" };
  /* relecture moi-patrimoine (25/11) : pas de chiffre quand le calcul depuis la ligne d'aujourd'hui serait faux */
  const j = journalAffiche().filter(o => !o.envoi), meme = o => o.enveloppe === F.env && o.actif === F.actif;
  // (1) un ordre de cette ligne déjà enregistré depuis l'ouverture mais pas encore relu dans le fichier (2e achat d'un même avis, 2e saisie…)
  if (ordresEnregistres.some(o => meme(o) && !j.some(x => memeOrdre(x, o)))) { v.pourquoi = "relecture"; return v; }
  // (2) achat daté avant une vente ou des frais en parts de cette ligne (le PRU moyen dépend alors de l'ordre des opérations), ou journal trop court pour le savoir
  const A = journalAnciens(), r = refData(), nouveau = typeof r.journalSuite === "number";
  // les lignes « à la suite » (30 dernières + pages plus anciennes) : pas les ordres de l'appli ajoutés hors de cette suite
  const dates = j.filter(o => !nouveau || !o.ligne || o.ligne >= r.journalSuite || A.lignes.includes(o)).map(o => String(o.date || "").slice(0, 10)).filter(Boolean).sort();
  const complet = nouveau ? A.suite === 0 : (r.journal || []).length < 30;
  if (F.date && F.date < (dates[0] || "") && !complet) { v.pourquoi = "fichier"; return v; }
  if (F.date && j.concat(ordresEnregistres).some(o => meme(o) && String(o.date).slice(0, 10) > F.date && o.type !== "Achat" && typeInfo(o.type).quantite)) { v.pourquoi = "fichier"; return v; }
  const c0 = q0 ? (typeof d.cout === "number" && d.cout > 0 ? d.cout : q0 * p0) : 0;   // le coût de revient du fichier (le PRU affiché est arrondi)
  v.apres = (c0 + m) / (q0 + q);
  return v;
}
/** le PRU de la ligne dans le fichier relu APRÈS l'enregistrement de cet ordre (null tant que le fichier n'a pas été relu) */
function pruFichierApres(x) {
  const g = M && Date.parse(M.genere || ""), d = ((M && M.ref && M.ref.detenu) || []).find(y => y.env === x.env && y.code === x.code);
  return g && g >= x.t - 60000 && d && typeof d.pru === "number" && d.pru > 0 ? d.pru : null;
}
function htmlPruApres() {
  const v = pruApres(); if (!v) return "";
  const discret = ETAT.discret === "oui", c = x => discret ? "•••" + NB + "€" : nbCours(x), ec = v.avant === null ? 0 : v.apres - v.avant;
  if (v.apres === null) return "🧮 <b>PRU de " + esc(v.code) + " : " + (v.pourquoi === "relecture" ? "sera recalculé après relecture de ton fichier" : "recalculé par ton fichier") + "</b>" +
    (v.pourquoi === "fichier" ? "<br><small>Achat daté avant une vente ou des frais de cette ligne : le calcul se fait dans l'ordre des dates.</small>" : "<br><small>Un autre ordre de cette ligne vient d'être enregistré.</small>") +
    "<br><small>Une fois l'ordre passé, compare avec le PRU affiché sur ton compte en ligne : je te le rappellerai.</small>";
  return "🧮 <b>PRU de " + esc(v.code) + " après cet achat : " + c(v.apres) + "</b> (frais compris)" +
    (v.avant === null ? " · nouvelle ligne" : "<br><small>Aujourd'hui dans ton fichier : " + c(v.avant) + (discret ? "" : " (" + (ec >= 0 ? "+" : "−") + nf(2, 4).format(Math.abs(ec)) + NB + "€)") + "</small>") +
    "<br><small>Une fois l'ordre passé, compare avec le PRU affiché sur ton compte en ligne : je te le rappellerai.</small>";
}
/* relecture moi-code-donnees (25/11) : chaque rappel porte l'adresse du FICHIER qui l'a produit (src) ; il n'est montré que pour ce fichier,
   et toutes les listes sont effacées par « Oublier » et au branchement d'un autre fichier (jamais une date ou un montant d'un autre joueur) */
function verifsPru() {
  let l = []; try { l = JSON.parse(stock.get(cleStock("verifPru")) || "[]") || []; } catch (e) { l = []; }
  const lim = Date.now() - 30 * 864e5, src = adresse(); return Array.isArray(l) ? l.filter(x => x && x.id && x.t > lim && src && x.src === src) : [];
}
function clesVerifsPru() { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (/^versus\.moi\.verifPru\./.test(k || "")) out.push(k); } } catch (e) {} return out; }
function effacerVerifsPru() { clesVerifsPru().forEach(k => stock.del(k)); }
/** le même fichier change d'adresse (adresse officielle) : ses rappels le suivent */
function suivreAdresseVerifsPru(avant, apres) {
  clesVerifsPru().forEach(k => { try { const l = JSON.parse(stock.get(k) || "[]"); if (Array.isArray(l)) stock.set(k, JSON.stringify(l.map(x => x && x.src === avant ? Object.assign({}, x, { src: apres }) : x))); } catch (e) { stock.del(k); } });
}
function garderVerifsPru(l) { try { stock.set(cleStock("verifPru"), JSON.stringify(l.slice(-12))); } catch (e) {} }
function memoriserVerifPru(v, o) {
  if (!v || !o) return;
  const id = "pru" + Date.now().toString(36), l = verifsPru().filter(x => !(x.env === v.env && x.code === v.code));   // une seule vérification par ligne : la plus récente
  l.push({ id, src: adresse(), env: v.env, code: v.code, pru: v.apres === null ? null : +v.apres.toFixed(6), t: Date.now(), ordre: { date: o.date, enveloppe: o.enveloppe, type: o.type, actif: o.actif, quantite: o.quantite, montant: o.montant } });
  garderVerifsPru(l);
}
function memeOrdre(a, b) { return !!a && !!b && a.date === b.date && a.enveloppe === b.enveloppe && a.type === b.type && (a.actif || "") === (b.actif || "") && Math.abs((+a.montant || 0) - (+b.montant || 0)) < .005 && Math.abs((+a.quantite || 0) - (+b.quantite || 0)) < 1e-6; }
function oublierVerifPru(id, ordre) { garderVerifsPru(verifsPru().filter(x => x.id !== id && !(ordre && memeOrdre(x.ordre, ordre)))); signalerCloche(); }
function titreVerifPru(x) {
  const p = x.pru !== null && x.pru !== undefined ? x.pru : pruFichierApres(x);   // pas de chiffre calculé : celui du fichier relu
  return "Vérifie le PRU de " + x.code + " sur ton compte en ligne" + (p === null ? " (ton fichier le recalcule)" : " : l'appli trouve " + (ETAT.discret === "oui" ? "•••" + NB + "€" : nbCours(p)));
}
let cibleJournal = null;   // l'ordre à montrer dans l'Historique (✏️ Corriger)
function corrigerVerifPru(id) {
  const x = verifsPru().find(v => v.id === id); if (!x) return;
  cibleJournal = x.ordre; ouvrirSaisieM(null, "journal");
}
function tachesAFaire(o) {
  const l = []; if (!M) return l;
  const quand = iso => { if (!iso || !/^\d{4}-\d\d-\d\d/.test(iso)) return "à faire"; const j = Math.round((new Date(isoJour(new Date()) + "T12:00:00") - new Date(iso.slice(0, 10) + "T12:00:00")) / 864e5);
    return j > 0 ? "en retard depuis le " + iso.slice(8, 10) + "/" + iso.slice(5, 7) + (j >= 2 ? " (" + j + NB + "j)" : "") : j === 0 ? "prévu aujourd'hui" : "prévu le " + iso.slice(8, 10) + "/" + iso.slice(5, 7); };
  if (M.simple) {
    if (/À mettre à jour/.test(M.rappel || "") && !reporte("soldes")) { const q = /\(([^)]+)\)/.exec(M.rappel); l.push({ k: "soldes", cles: ["soldes"], titre: "Mettre à jour tes soldes", quand: q ? q[1] : "à faire", date: "", ico: ICO_RAPPEL.soldes, verbe: VERBES_RAPPEL.soldes }); }
    return l;
  }
  const dus = rappelsFichier().filter(rappelDu), kk = x => cleRappel(x.nom) || x.nom, dIso = x => x.prochaine && /^\d{4}-/.test(x.prochaine) ? String(x.prochaine).slice(0, 10) : "";
  const pts = aArtema() ? dus.filter(x => POINT_ART.includes(cleRappel(x.nom))) : [];
  if (pts.length) { const d = pts.map(dIso).filter(Boolean).sort()[0] || "";
    l.push({ k: pts.length > 1 ? "point" : kk(pts[0]), cles: pts.map(kk), titre: pts.length > 1 ? "Point Artema : valeur et indice" : nomCourtRappel(pts[0]), date: d, quand: quand(d), ico: "🎯" }); }
  dus.filter(x => !pts.includes(x)).forEach(x => { const k = kk(x), d = dIso(x); l.push({ k, cles: [k], titre: nomCourtRappel(x), date: d, quand: quand(d) }); });
  // v16.99 (Théo) : les 5 ans du PEA / les 8 ans d'une assurance-vie, annoncés 3 mois avant (jusqu'à 30 j après), « Compris » les range
  annivsFiscaux().filter(a => !annivVus()[a.k] && !reporte(a.k)).forEach(a => l.push({ k: a.k, cles: [a.k], titre: a.titre, date: "", quand: a.quand, ico: "🎂", anniv: a }));
  { const fx = fraisLxDu(); if (fx && !reporte("fraisLx")) l.push({ k: "fraisLx", cles: ["fraisLx"], titre: "Frais de gestion Linxea à saisir", date: fx, quand: quand(fx), ico: "🧾" }); }
  { const lp = lxProgDu(); if (lp && !reporte("lxProg") && !lxSans()) l.push({ k: "lxProg", cles: ["lxProg"], titre: "Versement programmé Linxea", date: lp, quand: quand(lp), ico: "💸" }); }
  if (feAVerifier()) l.push({ k: "fondsEuros", cles: ["fondsEuros"], titre: "Fonds euros : ton taux estimé tient toujours ?", date: "", quand: "tous les 3 mois", fe: true });
  verifsPru().forEach(x => l.push({ k: x.id, cles: [x.id], titre: titreVerifPru(x), date: x.ordre.date, quand: "après ton achat du " + dateCourteIso(x.ordre.date) + " sur " + x.env, ico: "🧮", pru: x, verbe: "vérifier le PRU de " + x.code }));
  l.forEach((t, i) => { t.i = i; t.ico = t.ico || ICO_RAPPEL[t.k] || "◷"; t.verbe = t.verbe || (t.anniv ? "noter : " + t.titre.toLowerCase() : VERBES_RAPPEL[t.k] || "faire : " + t.titre.toLowerCase()); });
  l.sort((a, b) => (a.date || "9") < (b.date || "9") ? -1 : (a.date || "9") > (b.date || "9") ? 1 : a.i - b.i);
  return o === "artema" ? l.filter(t => t.cles.every(k => /^(artema|releve)/.test(k))) : l;
}
function reportesAFaire() {
  if (!M || M.simple) return [];
  return rappelsFichier().filter(x => /À faire|mettre à jour|retard|⚠|✏/i.test(x.statut || "") && rappelReporte(x));
}
function prochainRappel() { return M && !M.simple ? rappelsFichier().filter(x => !rappelDu(x) && x.prochaine && /^\d{4}-/.test(x.prochaine) && !/À faire/i.test(x.statut || "")).sort((a, b) => a.prochaine.localeCompare(b.prochaine))[0] : null; }
/** la boîte unique « À faire (N) » (Aujourd'hui ; filtrée sur l'écran Artema) */
function htmlAFaire(o) {
  if (!M) return "";
  const l = tachesAFaire(o), rep = o === "artema" ? [] : reportesAFaire();
  const ls = o === "artema" ? null : lxSans(), remettre = ls ? '<p class="af-rep">Versement Linxea : aucun ce mois-ci, rappel rangé jusqu\'au ' + esc(dateCourteIso(ls.jusqu)) + '. <button class="lien" type="button" data-lx-remettre="1">Remettre le rappel</button></p>' : "";
  if (!l.length) {
    if (remettre) return '<section class="m-afaire m-rappel" aria-label="À faire">' + remettre + "</section>";   // v20.65 : seule trace du rappel rangé, pour revenir en arrière
    return "";   // v17.3 (Théo) : rien à faire = rien d'affiché (ni « Rien à faire », ni prochain rappel, ni reportés)
  }
  const ligne = t => '<div class="af-r"><span class="af-i" aria-hidden="true">' + t.ico + '</span><span class="af-t"><b>' + esc(t.titre) + "</b><small>" + esc(t.quand) + "</small></span>" +
    (t.pru ? '<span class="af-a"><button class="mini-btn" type="button" data-pru-ok="' + esc(t.k) + '">✅ Conforme</button><button class="lien" type="button" data-pru-corr="' + esc(t.k) + '">✏️ Corriger</button></span></div>'
      : '<span class="af-a"><button class="mini-btn" type="button" data-af-faire="' + esc(t.k) + '">Faire</button><button class="lien" type="button" data-af-tard="' + esc(t.cles.join(",")) + '">Plus tard</button>' +
        (LX_SANS.includes(t.k) ? '<button class="lien" type="button" data-lx-sans="' + esc(t.date || "") + '">Aucun versement ce mois-ci</button>' : "") + "</span></div>");
  const vis = l.slice(0, 3), reste = l.slice(3);
  return '<section class="m-afaire m-rappel" aria-label="À faire"><div class="af-h"><b>À faire</b><span class="af-n">' + l.length + "</span>" + (o === "artema" ? "" : "<small>le plus ancien d'abord</small>") + "</div>" +
    vis.map(ligne).join("") +
    (reste.length ? '<details class="af-plus"><summary>Voir ' + (reste.length > 1 ? "les " + reste.length + " autres" : "l'autre") + "</summary>" + reste.map(ligne).join("") + "</details>" : "") +
    (rep.length ? '<p class="af-rep">Reporté à demain : ' + rep.map(x => esc(nomCourtRappel(x))).join(", ") + ".</p>" : "") + remettre + "</section>";
}
/** un message avec « Annuler » (quelques secondes, comme les autres messages) */
function toastAnnuler(t, annuler) {
  toast(t); const el = document.getElementById("toast"); if (!el) return;
  const b = document.createElement("button"); b.type = "button"; b.className = "lien tst-ann"; b.textContent = "Annuler"; b.style.marginLeft = "8px";
  b.addEventListener("click", ev => { ev.stopPropagation(); el.hidden = true; annuler(); });
  const x = el.querySelector(".tst-x"); el.insertBefore(b, x);
}
function annivVus() { try { return JSON.parse(stock.get(cleStock("annivVus")) || "{}"); } catch (e) { return {}; } }
function annivsFiscaux() {
  if (!M || M.simple) return [];
  const auj = isoJour(new Date()), t0 = new Date(auj + "T12:00:00");
  return ((M.ref || {}).enveloppes || []).filter(e => e.ouverture && e.statut !== "Fermé" && (e.regime === "PEA" || e.regime === "AV")).map(e => {
    const n = e.regime === "PEA" ? 5 : 8, d = isoPlus(String(e.ouverture).slice(0, 10), n, 0), j = Math.round((new Date(d + "T12:00:00") - t0) / 864e5);
    if (j > 92 || j < -30) return null;
    const date = d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4);
    return { k: "anniv-" + e.nom + "-" + d.slice(0, 4), titre: (j > 0 ? "Les " + n + " ans de ton " : "Ton ") + e.nom + (j > 0 ? " arrivent" : " a " + n + " ans"),
      quand: (j > 0 ? "le " + date + " (dans " + j + NB + "j)" : "depuis le " + date) + " · " + (e.regime === "PEA" ? "gains sans impôt sur le revenu" : "une part des gains sans impôt chaque année"),
      info: e.regime === "PEA" ? "À partir de 5 ans, tu peux retirer de ton PEA sans le fermer, et les gains ne paient plus d'impôt sur le revenu (seulement les prélèvements sociaux). Rien à faire : c'est automatique."
        : "À partir de 8 ans, chaque année, une part des gains que tu retires échappe à l'impôt (4 600 € de gains pour une personne seule). Rien à faire : c'est automatique, à garder en tête avant un retrait." };
  }).filter(Boolean);
}
function faireTache(k) {
  if (/^anniv-/.test(k)) { const a = annivsFiscaux().find(x => x.k === k), v = annivVus(); v[k] = 1; try { stock.set(cleStock("annivVus"), JSON.stringify(v)); } catch (e) {}
    if (a) toast("🎂 " + a.info); signalerCloche(); rendre(); return; }
  if (k === "soldes") { if (window.Moi) window.Moi.saisir(); return; }
  if (k === "point") { ouvrirPointArtema("point"); return; }
  if (/^pru/.test(k)) { corrigerVerifPru(k); return; }   // (préparé) : « 👉 vérifier le PRU » de la phrase-bilan ouvre l'ordre dans l'Historique
  faireRappel(k);
}
function brancherAFaire(v) {
  v.querySelectorAll("[data-af-faire]").forEach(b => b.addEventListener("click", () => faireTache(b.dataset.afFaire)));
  v.querySelectorAll("[data-af-tard]").forEach(b => b.addEventListener("click", () => {
    const pt = plusTard(); b.dataset.afTard.split(",").forEach(k => { pt[k] = Date.now() + 864e5; }); stock.set(cleStock("plusTard"), JSON.stringify(pt));
    toast("C'est noté : je te le rappelle demain."); signalerCloche(); rendre();
  }));
  v.querySelectorAll("[data-lx-sans]").forEach(b => b.addEventListener("click", () => {
    const jusqu = rangerLxSans(b.dataset.lxSans); signalerCloche(); rendre();
    toastAnnuler("Rappel rangé jusqu'au " + dateCourteIso(jusqu) + ".", () => { remettreLxSans(); signalerCloche(); rendre(); toast("Rappel du versement Linxea remis."); });
  }));
  v.querySelectorAll("[data-lx-remettre]").forEach(b => b.addEventListener("click", () => { remettreLxSans(); signalerCloche(); rendre(); toast("Rappel du versement Linxea remis."); }));
  v.querySelectorAll("[data-bilan-faire]").forEach(b => b.addEventListener("click", () => faireTache(b.dataset.bilanFaire)));
  v.querySelectorAll("[data-pru-ok]").forEach(b => b.addEventListener("click", () => { oublierVerifPru(b.dataset.pruOk); toast("✅ PRU conforme : c'est noté."); rendre(); }));
  v.querySelectorAll("[data-pru-corr]").forEach(b => b.addEventListener("click", () => corrigerVerifPru(b.dataset.pruCorr)));
}
/** la phrase-bilan : total · variation depuis la fin du mois dernier (sinon le jour) · LA chose à faire. Rien en € en mode discret, jamais de rouge */
function phraseBilan() {
  if (!M) return "";
  const s = M.synthese || {}, discret = ETAT.discret === "oui", net = M.simple ? { montant: s.financier } : patrimoineNet(), total = net.montant;
  if (!ok(total)) return "";
  let d = null, depuis = "";
  try {
    const now = new Date(), avant = new Date(now.getFullYear(), now.getMonth() - 1, 1), cle = avant.getFullYear() * 100 + avant.getMonth() + 1;
    const prev = seriePatrimoine().filter(x => x.an * 100 + x.mo === cle && x.complet).pop();   // la fin du mois dernier, sinon rien (pas de « depuis fin nov. » en mars)
    if (prev && ok(s.financier) && (prev.bourse + prev.epargne) > 0) { d = s.financier - (prev.bourse + prev.epargne); depuis = "depuis fin " + MOIS_C[prev.mo - 1]; }
  } catch (e) { d = null; }
  if (d === null && ok(s.jour) && !M.simple) { d = s.jour; depuis = /semaine/i.test(s.jourLibelle || "") ? "cette semaine" : "aujourd'hui"; }
  const cls = d === null ? "" : d >= 1 ? "up" : "neutre";
  const varTxt = d === null ? "" : Math.abs(d) < 1 ? '<span class="neutre">stable</span> ' + esc(depuis) : discret ? '<span class="' + cls + '">' + (d >= 0 ? "▲ en hausse" : "▼ en baisse") + "</span> " + esc(depuis)
    : '<span class="' + cls + '">' + (d >= 0 ? "▲ " : "▼ ") + eur(d, 0, true) + "</span> " + esc(depuis);
  const t = tachesAFaire()[0];
  const faire = t ? '<button type="button" class="bl-faire" data-bilan-faire="' + esc(t.k) + '">👉 ' + esc(t.verbe) + "</button>" : '<span class="bl-ok">rien à faire ✓</span>';
  return ('<p class="m-bilan">' + (discret ? "<b>Ton patrimoine</b>" : "<b>" + eur(total) + "</b> au total") + (varTxt ? " · " + varTxt : "") + " · " + faire + "</p>").replace(/\u202F/g, "\u00A0");   // espace des milliers bien visible
}

/* ---- 🎯 Point Artema : la valeur de la ligne (€) et le niveau de l'indice (pts), en une fois ---- */
let PA = null;
function envQuintessa() { return (refData().enveloppes.map(e => typeof e === "string" ? { nom: e } : e).find(e => /Quintessa/.test(e.nom)) || {}).nom || ""; }
/** valeur de référence d'une ligne d'assurance-vie (dernier relevé, achats − ventes ensuite) : sert au garde-fou « prix d'une part ? » (v16.78) */
function refLigneAV(code) {
  let ref = 0; ((M && M.histoAV && M.histoAV.ordres) || []).forEach(o => { if (o[2] !== code) return; if (o[1] === "Relevé" && o[3] > ref * .2) ref = o[3]; else if (o[1] === "Achat") ref += o[3]; else if (o[1] === "Vente") ref -= o[3]; });
  if (!(ref > 0)) { const r = (M && M.supports || []).find(x => /artema/i.test(x.nom || "")); if (code === "ARTEMA" && r) ref = r.valeur || r.investi || 0; }
  return ref;
}
function ouvrirPointArtema(k) {
  injecterStyle(); lireCache();
  if (!M) { toast("Lecture de ton fichier en cours, réessaie dans un instant."); charger(false); return; }
  if (!aArtema()) { if (k === "releve") ouvrirSaisieM(partielRappel("releve")); else { reglageOuvert = "artemaActuel"; ouvrirSaisieM(null, "maj"); } return; }
  PA = { valeur: "", niveau: "", date: aujourdhuiISO(), arme: false, forcer: false, erreur: "", cle: k || "" };
  let d = $f("m-pa");
  if (!d) {
    d = document.createElement("div"); d.className = "voile"; d.id = "m-pa"; d.hidden = true; document.body.appendChild(d);
    d.addEventListener("click", e => { if (e.target === d) fermerPointArtema(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && PA) fermerPointArtema(); });
  }
  rendrePA(); d.hidden = false;
}
function fermerPointArtema() { const d = $f("m-pa"); if (d) d.hidden = true; PA = null; }
function rendrePA() {
  const d = $f("m-pa"); if (!d || !PA) return;
  const E = etatArtema(), env = envQuintessa(), linxea = rappelsFichier().some(x => cleRappel(x.nom) === "releve" && /Linxea/i.test(x.nom));
  const derV = E.releve && E.valeur ? "Dernier relevé : " + eur(E.valeur) + " le " + frDate(E.releve) : E.valeur ? "Valeur actuelle : " + eur(E.valeur) : "Aucun relevé saisi pour l'instant";
  const derN = E.act ? "Dernière saisie : " + ptsIdx(E.act) + (E.dateAct ? " le " + frDate(E.dateAct) : "") : E.phase === "attente" || E.phase === "photo" ? "Le niveau de départ sera connu le 5 décembre" : "Aucun niveau saisi pour l'instant";
  const inp = (id, lab, val, ph, aide) => '<div class="champ"><label for="' + id + '">' + lab + '</label><input id="' + id + '" type="text" inputmode="decimal" autocomplete="off" value="' + esc(val) + '" placeholder="' + esc(ph) + '"><span class="aide">' + aide + "</span></div>";
  d.innerHTML = '<div class="feuille moi m-feuille pa" role="dialog" aria-modal="true" aria-labelledby="pa-titre">' +
    '<h3 id="pa-titre">🎯 Point Artema <button class="icon-btn" type="button" id="pa-fermer" aria-label="Fermer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></h3>' +
    '<p class="pa-expl"><b>La valeur</b> = ce que vaut ta ligne en € (sur ton relevé). <b>Le niveau</b> = le cours de l\'indice. Remplis l\'un, l\'autre ou les deux.</p>' +
    '<form id="pa-form" class="form" novalidate>' +
      (env ? inp("pa-valeur", "💶 Valeur de ta ligne Artema (€)", PA.valeur, E.valeur ? saisieNombre(Math.round(E.valeur), 0) : "ex. 15 850", esc(derV) + ". Prends le <b>total de la ligne</b>, pas le prix d'une part.") : "") +
      inp("pa-niveau", "📈 Niveau de l'indice (pts)", PA.niveau, E.act ? saisieNombre(E.act, 2) : "ex. 1 234,56", esc(derN) + ' · <a class="lien" href="' + ARTEMA.lien + '" target="_blank" rel="noopener">↗ voir l\'indice</a>') +
      '<div class="champ"><label for="pa-date">Date (du relevé ou de la clôture)</label><input id="pa-date" type="date" value="' + esc(PA.date) + '" max="' + aujourdhuiISO() + '"></div>' +
      '<div class="alertes" id="pa-alertes"></div><p class="phrase-ordre" id="pa-phrase" hidden></p>' +
      '<button class="btn plein acc" type="submit" id="pa-envoyer">Enregistrer</button>' +
      (linxea ? '<p class="pa-pied">Relevé Linxea aussi ? <button class="lien" type="button" id="pa-autre">Saisie classique ›</button></p>' : "") +
    "</form></div>";
  $f("pa-fermer").addEventListener("click", fermerPointArtema);
  const lie = (id, k) => { const el = $f(id); if (el) el.addEventListener("input", () => { PA[k] = el.value; PA.arme = false; PA.forcer = false; PA.erreur = ""; majPA(); }); };
  lie("pa-valeur", "valeur"); lie("pa-niveau", "niveau"); lie("pa-date", "date");
  if ($f("pa-autre")) $f("pa-autre").addEventListener("click", () => { fermerPointArtema(); ouvrirSaisieM({ type: "Relevé", env: envQuintessa() }); });
  $f("pa-form").addEventListener("submit", e => { e.preventDefault(); envoyerPA(); });
  majPA();
}
function analysePA() {
  const E = etatArtema(), out = { msg: [], bloque: false, doute: null };
  const v = $f("pa-valeur") ? lireNombre(PA.valeur) : null, n = lireNombre(PA.niveau);
  out.v = v; out.n = n;
  if (v === null && n === null) { out.bloque = true; out.vide = true; }
  if (v !== null) {
    if (millierDouteux(PA.valeur)) { out.doute = lectureMilliers(PA.valeur); out.bloque = true; }
    else if (isNaN(v) || v <= 0) { out.bloque = true; out.msg.push(["err", "Valeur illisible : écris un montant en euros (ex. 15 850)."]); }
    else { const ref = refLigneAV("ARTEMA"); if (ref > 0 && v < ref * .2) out.msg.push(["warn", "Prix d'une part ? Sur ton relevé, prends la VALEUR TOTALE de la ligne (environ " + Math.round(ref).toLocaleString("fr-FR") + " €)."]); }
  }
  if (n !== null) {
    if (isNaN(n) || n <= 0) { out.bloque = true; out.msg.push(["err", "Niveau illisible : écris le cours de l'indice (ex. 1 234,56)."]); }
    else if (E.act && Math.abs(n - E.act) < 1e-9) out.msg.push(["warn", "Niveau identique à ta dernière saisie (" + ptsIdx(E.act) + ") : c'est bien le cours du jour ?"]);
    else if (E.act && Math.abs(n / E.act - 1) > .3) out.msg.push(["warn", "Plus de 30 % d'écart avec ta dernière saisie (" + ptsIdx(E.act) + ") : faute de frappe ?"]);
    else if (!E.act && E.ini && (n < E.ini / 3 || n > E.ini * 3)) out.msg.push(["warn", "Niveau très loin du départ (" + ptsIdx(E.ini) + ") : faute de frappe ?"]);
  }
  if (!/^\d{4}-\d\d-\d\d$/.test(PA.date || "")) { out.bloque = true; if (!out.vide) out.msg.push(["err", "Choisis la date."]); }
  else if (PA.date > aujourdhuiISO()) { out.bloque = true; out.msg.push(["err", "La date ne peut pas être dans le futur."]); }
  out.avert = out.msg.some(m => m[0] === "warn");
  return out;
}
function majPA() {
  if (!PA || !$f("pa-envoyer")) return;
  const a = analysePA(), btn = $f("pa-envoyer");
  let al = a.msg.map(m => '<div class="alerte ' + m[0] + '">' + esc(m[1]) + "</div>").join("");
  if (a.doute) al += '<div class="alerte warn">« ' + esc(String(PA.valeur).trim()) + " » veut dire " + esc((+a.doute.milliers).toLocaleString("fr-FR")) + NB + '€ ?<br><button class="btn" type="button" data-pa-mv="' + esc(a.doute.milliers) + '">Oui, ' + esc((+a.doute.milliers).toLocaleString("fr-FR")) + NB + "€</button>" +
    (a.doute.virgule ? ' <button class="btn ghost" type="button" data-pa-mv="' + esc(a.doute.virgule) + '">Non, ' + esc(a.doute.virgule) + NB + "€</button>" : "") + "</div>";
  if (PA.forcer) al += '<div class="alerte warn">' + esc(PA.forcer) + "</div>";
  if (PA.erreur) al += '<div class="alerte err">' + esc(PA.erreur) + "</div>";
  if (a.vide) al += '<p class="pa-vide">Saisis au moins la valeur ou le niveau.</p>';
  $f("pa-alertes").innerHTML = al;
  $f("pa-alertes").querySelectorAll("[data-pa-mv]").forEach(b => b.addEventListener("click", () => { PA.valeur = b.dataset.paMv; $f("pa-valeur").value = PA.valeur; PA.arme = false; majPA(); }));
  const ph = $f("pa-phrase"), quoi = [];
  if (!a.bloque) {
    if (a.v !== null) quoi.push("la valeur <b>" + nf(0, 2).format(a.v) + NB + "€</b>");
    if (a.n !== null) quoi.push("le niveau <b>" + ptsIdx(a.n) + "</b>");
  }
  ph.innerHTML = quoi.length ? "📝 Tu enregistres " + quoi.join(" et ") + ", au <b>" + frDate(PA.date) + "</b>." : ""; ph.hidden = !quoi.length;
  btn.disabled = a.bloque;
  const lib = a.v !== null && a.n !== null ? "Enregistrer la valeur et le niveau" : a.v !== null ? "Enregistrer la valeur" : a.n !== null ? "Enregistrer le niveau" : "Enregistrer";
  btn.textContent = (a.avert || PA.forcer) && PA.arme ? "Oui, enregistrer quand même" : lib;
  btn.classList.toggle("arme", !!((a.avert || PA.forcer) && PA.arme));
}
/** envoi : l'ordre « Relevé » ARTEMA (action « ordre ») puis le niveau (action « artema », quoi « actuel ») ; une alerte demande un 2e appui */
async function envoyerPA() {
  if (!PA) return;
  const a = analysePA(); if (a.bloque) return;
  if ((a.avert || PA.forcer) && !PA.arme) { PA.arme = true; majPA(); $f("pa-envoyer").focus(); return; }
  const btn = $f("pa-envoyer"); btn.disabled = true; btn.textContent = "Enregistrement…";
  const date = PA.date, env = envQuintessa(), faits = [];
  let probleme = "";
  if (a.v !== null) {
    const rep = await posterFichier({ action: "ordre", ordres: [{ date, enveloppe: env, type: "Relevé", actif: "ARTEMA", quantite: null, montant: a.v, frais: null }], forcer: !!PA.forcer });
    if (rep.erreur === "simulation") { PA.erreur = rep.message; PA.arme = false; majPA(); return; }
    if (rep.erreur === "cle") { cleRefusee(rep.message); fermerPointArtema(); toast("Clé refusée par ton fichier."); if (vueMoi()) rendre(); return; }
    if (rep.ok || rep.erreur === "incertain") {
      faits.push("releve"); if (PA) { PA.valeur = ""; PA.forcer = false; }
      if (rep.ok) { const h = (M.histoAV = M.histoAV || {}); h.ordres = (h.ordres || []).concat([[date, "Relevé", "ARTEMA", a.v]]); const r = (M.supports || []).find(x => /artema/i.test(x.nom || "")); if (r && date >= (etatArtema().releve || "")) r.valeur = a.v; }
      else probleme = "La valeur a peut-être été enregistrée : vérifie l'Historique (➕) avant de la renvoyer.";
    } else if (rep.erreur === "avertissement") { PA.forcer = rep.message || "Ton fichier demande une confirmation."; PA.arme = false; majPA(); return; }
    else { PA.erreur = "Valeur non enregistrée : " + (rep.message || "erreur inattendue."); PA.arme = false; majPA(); return; }
  }
  if (a.n !== null) {
    const rep = await posterFichier({ action: "artema", quoi: "actuel", niveau: a.n, date });
    if (rep.erreur === "simulation") { if (PA) { PA.erreur = rep.message; PA.arme = false; majPA(); } return; }
    if (rep.erreur === "cle") { cleRefusee(rep.message); fermerPointArtema(); toast("Clé refusée par ton fichier."); if (vueMoi()) rendre(); return; }
    if (rep.ok) {
      faits.push("artemaActuel");
      const ar = (M.parametres = M.parametres || {}).artema = Object.assign({}, (M.parametres || {}).artema);
      ar.actuel = a.n; ar.date = date; if (Array.isArray(ar.histo)) ar.histo = ar.histo.filter(x => String(x[0]).slice(0, 10) !== date).concat([[date, a.n]]);
    } else {
      if (PA) { PA.erreur = (faits.length ? "Valeur enregistrée. " : "") + "Niveau non enregistré : " + (rep.message || "erreur inattendue."); PA.arme = false; PA.niveau = String(PA.niveau); rendrePA(); }
      marquerFaits(faits); signalerCloche(); if (faits.length) charger(true);
      return;
    }
  }
  marquerFaits(faits);
  fermerPointArtema();
  if (window.SONS && SONS.succes && !probleme) SONS.succes();
  toast(probleme || (faits.length > 1 ? "Point Artema enregistré : valeur et niveau." : faits[0] === "releve" ? "Valeur d'Artema enregistrée." : "Niveau de l'indice enregistré."));
  artSim.v = null; signalerCloche(); if (vueMoi()) rendre(); charger(true);
}
/** en attendant la relecture du fichier : les rappels faits ne sont plus « à faire » */
function marquerFaits(cles) {
  if (!cles.length) return;
  rappelsFichier().forEach(x => { if (cles.includes(cleRappel(x.nom))) { x.statut = "✓ Fait"; } });
}
function notifications() {
  if (!M) return { niveau: "", items: [] };
  const items = [];
  const anomalie = anomaliesVues();
  if (anomalie) items.push({ t: "rouge", txt: anomalie });
  alertesDeclenchees().forEach(a => items.push({ t: "rouge", txt: "Alerte de cours : " + a }));
  { const Dv = dVersus(), l = Dv && Dv.liaison;   // v17.97 (Théo) : relevés automatiques du Versus éteints → rappel à l'admin seulement, jusqu'à ce qu'il les active
    if (l && l.active === false && typeof vraiAdmin === "function" && vraiAdmin()) items.push({ t: "rouge", txt: "Relevés automatiques de fin de mois désactivés : Réglages › Relevés automatiques de fin de mois (admin) › Activer" }); }
  const d = dateRappel(M.rappel);
  const aFaire = /À mettre à jour/.test(M.rappel || "") || (d && d - Date.now() < 2 * 864e5);
  if (feAVerifier()) items.push({ t: "orange", txt: "Fonds euros : taux estimé à vérifier" });
  if (!M.simple) verifsPru().forEach(x => items.push({ t: "orange", txt: "🧮 " + titreVerifPru(x) }));   // (préparé)
  rappelsFichier().filter(rappelDu).forEach(r => items.push({ t: "orange", txt: r.nom + " : " + String(r.statut).replace(/^[^\wÀ-ÿ]+/u, "") + (r.prochaine ? " (prévu le " + frDate(String(r.prochaine).slice(0, 10)) + ")" : "") }));
  if (aFaire && !rappelsFichier().length && !items.some(x => x.t === "orange")) items.push({ t: "orange", txt: M.rappel });
  const niveau = items.some(x => x.t === "rouge") ? "rouge" : items.some(x => x.t === "orange") ? "orange" : "";
  return { niveau, items };
}
function signalerCloche() { if (typeof majCloche === "function") majCloche(configure() ? notifications().niveau : null); }
/* V15.7 · noms courts et clairs des rappels (le Sheet garde ses intitulés longs) */
const NOMS_RAPPEL = { releve: "Relevé du mois", taux: "Taux des livrets", fondsEuros: "Rendement du fonds euros", artemaInitial: "Artema : niveau de départ", artemaActuel: "Artema : niveau actuel",
  interets: "Intérêts des livrets", appart: "Valeur de l'appartement", calendrier: "Jours fériés des bourses", versement: "Versement Quintessa", linxea: "Versement Linxea" };
function nomCourtRappel(x) { const k = cleRappel(x.nom); if (k === "releve" && /Linxea/i.test(x.nom)) return "Relevé du mois (Artema + Linxea)"; if (k === "releve") return "Relevé du mois (Artema)"; return NOMS_RAPPEL[k] || nomRappel(x.nom); }
function quandRappel(x) {
  if (!x.prochaine || !/^\d{4}-/.test(x.prochaine)) return "";
  const j = Math.round((new Date(x.prochaine.slice(0, 10) + "T12:00:00") - new Date(isoJour(new Date()) + "T12:00:00")) / 864e5);
  return j < 0 ? "depuis le " + frDate(x.prochaine) : j === 0 ? "aujourd'hui" : j === 1 ? "demain" : j <= 45 ? "dans " + j + " jours" : "le " + frDate(x.prochaine);
}
/* La cloche : seulement ce qui demande une action (sans doublon), avec « Faire » et « Plus tard » ; les valeurs du fichier vivent dans « Mon fichier » (v17.34) */
/* V15.15 · rappel discret, tous les 3 mois : réajuster (ou confirmer) le taux estimé du fonds euros */
function feAVerifier() {
  const fe = M && M.parametres && M.parametres.fondsEuros; if (!fe || !fe.taux) return false;
  const t = +(stock.get(cleStock("feVu")) || 0); if (!t) { stock.set(cleStock("feVu"), String(Date.now())); return false; }
  if ((plusTard().fondsEuros || 0) > Date.now()) return false;   // v16.87 : « Plus tard » de la boîte À faire
  return Date.now() - t > 91 * 864e5;
}
function htmlNotifications() {
  if (!configure()) return '<p class="info">Connecte ton fichier dans Réglages › Mon fichier pour recevoir tes rappels et alertes ici.</p>';
  if (!M) return '<p class="info">Lecture de ton fichier en cours…</p>';
  injecterStyle();
  const propre = t => esc(String(t || "").replace(/^[✓⚠🔔✏️\s]+/u, "").trim()).replace(/ +▸ /g, "<br>▸ ");
  const anomalie = anomaliesVues(), alertes = alertesDeclenchees(), dus = rappelsFichier().filter(rappelDu);
  const reportes = rappelsFichier().filter(x => /À faire|mettre à jour|retard|⚠|✏/i.test(x.statut || "") && rappelReporte(x));
  const sansListe = !rappelsFichier().length && /À mettre à jour/.test(M.rappel || "");   // profil simple : un seul texte de rappel
  const carte = (cls, ic, titre, sous, actions) => '<div class="nt ' + cls + '"><span class="nt-ic">' + ic + '</span><div class="nt-t"><b>' + titre + "</b>" + (sous ? "<small>" + sous + "</small>" : "") + "</div>" + (actions || "") + "</div>";
  const items = [];
  if (anomalie) items.push(carte("rouge", "!", "Anomalie dans tes saisies", propre(anomalie)));
  { const Dv = dVersus(), l = Dv && Dv.liaison;   // v17.97 (Théo) : relevés automatiques du Versus éteints → rappel à l'admin jusqu'à l'activation
    if (l && l.active === false && typeof vraiAdmin === "function" && vraiAdmin()) items.push(carte("rouge", "⚠", "Relevés automatiques de fin de mois désactivés", "sans eux, le Versus ne lira pas vos fichiers le dernier jour ouvré du mois", '<div class="nt-a"><button class="mini-btn" type="button" data-notif-liaison>Activer</button></div>')); }
  alertes.forEach(a => items.push(carte("rouge", "🔔", "Alerte de cours", esc(a))));
  dus.forEach(x => { const k = cleRappel(x.nom) || x.nom;
    items.push(carte("orange", "◷", esc(nomCourtRappel(x)), "à faire " + esc(quandRappel(x)), '<div class="nt-a"><button class="mini-btn" type="button" data-notif-faire="' + esc(k) + '">Faire</button><button class="lien" type="button" data-notif-tard="' + esc(k) + '">Plus tard</button></div>')); });
  if (sansListe) items.push(carte("orange", "◷", "À mettre à jour", propre(M.rappel)));
  if (feAVerifier()) items.push(carte("orange", "💶", "Fonds euros : ton taux estimé tient toujours ?", "tous les 3 mois · " + pct(M.parametres.fondsEuros.taux, 2, false) + (M.parametres.fondsEuros.bonus ? " + bonus " + pct(M.parametres.fondsEuros.bonus, 2, false) : ""), '<div class="nt-a"><button class="mini-btn" type="button" data-notif-faire="fondsEuros">Ajuster</button><button class="lien" type="button" data-notif-fe>C\'est bon</button></div>'));
  const prochain = rappelsFichier().filter(x => !rappelDu(x) && x.prochaine && /^\d{4}-/.test(x.prochaine) && !/À faire/i.test(x.statut || "")).sort((a, b) => a.prochaine.localeCompare(b.prochaine))[0];
  return '<div class="moi nt-l">' +
    (items.length ? '<h4 class="m-h4">À faire</h4>' + items.join("") + (reportes.length ? '<p class="nt-rep">Reporté à demain : ' + reportes.map(x => esc(nomCourtRappel(x))).join(", ") + ".</p>" : "")
      : reportes.length ? carte("orange", "◷", "Rien d'urgent", "Reporté à demain : " + reportes.map(x => esc(nomCourtRappel(x))).join(", ") + ".", '<div class="nt-a"><button class="mini-btn" type="button" data-notif-faire="' + esc(cleRappel(reportes[0].nom) || reportes[0].nom) + '">Faire</button></div>')
      : carte("vert", "✓", "Tout est à jour", "Aucun rappel ni anomalie." + (prochain ? " Prochain : " + esc(nomCourtRappel(prochain)) + " " + esc(quandRappel(prochain)) + "." : ""))) +
    htmlEcheancesNotif() +
    (M.marches ? '<h4 class="m-h4">Marchés</h4><div class="m-status">' + marches(M.marches) + "</div>" : "") +
    (rappelsFichier().length ? '<button class="nt-tous" type="button" data-notif-maj>Mon fichier <small>valeurs, actifs, alertes</small> <span>›</span></button>' : "") + "</div>";
}

/* ================= Profil simple (Kévin) : épargne saisie à la main, bourse lue dans le Versus =================
   Son fichier (API « Moi simple ») ne donne que ses comptes, ses soldes datés et ses réglages
   (appartement, prêt). Le reste est reconstruit ici, au format des autres fichiers, pour que
   les onglets Patrimoine, Stats et Missions marchent à l'identique. Pas de lignes de bourse. */
/* v16.83 : plus d'adoption automatique de l'« adresse officielle » donnée par le fichier (migration du 05/11 terminée) */
function couperLecture() { generation++; if (ctrlLecture) { try { ctrlLecture.abort(); } catch (e) { /* déjà coupée */ } } ctrlLecture = null; enCours = false; rechargerApres = false; }
function recevoir(json) {
  if (json && json.profil === "simple") { RAW = json; M = adapterSimple(json); }
  else { RAW = null; M = json; }
}
function dVersus() { return typeof D_BRUT !== "undefined" && D_BRUT ? D_BRUT : typeof D !== "undefined" && D ? D : null; }   // v20.30 : Moi lit la copie brute (ses propres chiffres)
/** Propriétaire d'un fichier simple : le nom enregistré dans le fichier ; à défaut, la personne connectée avec son code (jamais l'admin) */
function proprietaire(raw) {
  const Dv = dVersus(), nom = ((raw && raw.reglages) || {}).personne;
  if (nom && (!Dv || Dv.personnes.some(x => x.nom === nom))) return nom;
  if (Dv && !estAdmin() && SESSION && SESSION.nom && Dv.personnes.some(x => x.nom === SESSION.nom)) return SESSION.nom;
  return null;
}
/** À la première ouverture par son propriétaire (connecté avec son code), le fichier retient à qui il est */
let revendique = false;
async function revendiquerFichier() {
  if (!RAW || revendique || estAdmin() || simulationM() || (RAW.reglages || {}).personne || typeof SOURCE === "undefined" || SOURCE !== "api") return;
  const qui = proprietaire(RAW); if (!qui) return;
  revendique = true;
  const rep = await posterFichier({ action: "reglages", reglages: { "versus.nom": qui } });
  if (rep.ok) { recevoir(Object.assign({ profil: "simple" }, rep)); stock.set(K.cache, JSON.stringify(RAW)); }
}
function assurerSimple() { if (RAW && M && M._d !== dVersus()) M = adapterSimple(RAW); }
function finMoisIso(an, mo) { return isoJour(new Date(an, mo, 0)); }
function moisPlus(an, mo, n) { const d = new Date(an, mo - 1 + n, 1); return [d.getFullYear(), d.getMonth() + 1]; }
/** Échéancier d'un prêt à mensualités constantes, ramené à « ma part » */
function echeancier(pr, banque) {
  const part = (pr && ok(pr.part) && pr.part > 0 ? pr.part : 100) / 100;
  // tableau d'amortissement de la banque (onglet « Échéancier prêt ») : [date, restant dû en début, capital amorti, intérêts, assurance]
  if (banque && banque.length) {
    const L = banque.map(r => ({ date: r[0], restant: Math.max(0, r[1] - r[2]) * part, echeance: (r[2] + r[3] + (r[4] || 0)) * part, interet: r[3] * part, assurance: (r[4] || 0) * part }));
    const d0 = new Date(banque[0][0] + "T12:00:00"), avant = new Date(d0.getFullYear(), d0.getMonth() - 1, Math.min(d0.getDate(), 28));
    const auj = isoJour(new Date()), an = String(new Date().getFullYear());
    const passees = L.filter(x => x.date <= auj), futures = L.filter(x => x.date > auj), a = passees[passees.length - 1], p = futures[0];
    return {
      banque: true, actuel: a ? { date: a.date, restant: a.restant, echeance: a.echeance } : null, prochaine: p ? { date: p.date, restant: p.restant, echeance: p.echeance } : null,
      interetsAnnee: passees.filter(x => x.date.slice(0, 4) === an).reduce((s, x) => s + x.interet, 0), interetsRestants: futures.reduce((s, x) => s + x.interet, 0),
      assuranceRestante: futures.reduce((s, x) => s + x.assurance, 0), nb: L.length, debut: banque[0][0],
      fin: L[L.length - 1].date, mensuel: [[isoJour(avant), banque[0][1] * part]].concat(L.map(x => [x.date, x.restant, x.interet])),
      restantAuj: a ? a.restant : banque[0][1] * part, part, mensualite: (p || a).echeance
    };
  }
  if (!pr || !(pr.capital > 0) || !(pr.duree > 0) || !pr.debut) return null;
  const n = Math.round(pr.duree * 12), i = (pr.taux || 0) / 100 / 12;
  const C = pr.capital, mens = i ? C * i / (1 - Math.pow(1 + i, -n)) : C / n;
  const d0 = new Date(pr.debut + "T12:00:00"), jour = d0.getDate();
  let restant = C;
  const L = [];
  for (let k = 0; k < n; k++) {
    const an = d0.getFullYear(), mo = d0.getMonth() + k, d = new Date(an, mo, Math.min(jour, new Date(an, mo + 1, 0).getDate()));
    const interet = restant * i, capital = Math.min(restant, mens - interet);
    restant = Math.max(0, restant - capital);
    L.push({ date: isoJour(d), restant: restant * part, echeance: mens * part, interet: interet * part });
  }
  const avant = new Date(d0.getFullYear(), d0.getMonth() - 1, Math.min(jour, 28));
  const auj = isoJour(new Date()), an = String(new Date().getFullYear());
  const passees = L.filter(x => x.date <= auj), futures = L.filter(x => x.date > auj);
  const a = passees[passees.length - 1], p = futures[0];
  return {
    actuel: a ? { date: a.date, restant: a.restant, echeance: a.echeance } : null,
    prochaine: p ? { date: p.date, restant: p.restant, echeance: p.echeance, assurance: pr.assurance > 0 ? pr.assurance : null } : null,
    interetsAnnee: passees.filter(x => x.date.slice(0, 4) === an).reduce((s, x) => s + x.interet, 0),
    interetsRestants: futures.reduce((s, x) => s + x.interet, 0),
    fin: L[L.length - 1].date, mensuel: [[isoJour(avant), C * part]].concat(L.map(x => [x.date, x.restant, x.interet])),
    restantAuj: a ? a.restant : C * part, part, mensualite: mens * part
  };
}
function adapterSimple(raw) {
  const Dv = dVersus(), qui = proprietaire(raw);
  const p = Dv && qui ? Dv.personnes.find(x => x.nom === qui) : null;
  const noms = (Dv && Dv.enveloppes) || ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"];
  const fin = Dv ? finGlobale(Dv, 0) : 0;
  const iR = Dv ? Math.max(0, Dv.marche.indices.findIndex(n => /S&P\s*500/i.test(n))) : 0;
  /* v20.53 (P3) : un pilote dont le Versus ne reçoit plus que des % n'a plus ses euros de bourse dans le Versus :
     on montre ses %, jamais une valeur « à l'échelle » qui ressemblerait à des euros (profil complet = ses vrais montants, dans son fichier) */
  const enPct = !!(p && p.pct), sansEur = o => enPct ? Object.assign({}, o, { valeur: null, pvLatente: null, verse: null }) : o;
  const st = (e, deb) => p ? sansEur(stats(Dv, p, e, deb || 0, fin, iR, null)) : {};
  const tot = st(0);
  const sTot = p ? serie(p, 0).filter(z => z.k <= fin && z.val > 0) : [];
  const dernierR = e => { const s = p ? serie(p, e).filter(z => z.k <= fin && typeof z.r === "number") : []; return s.length ? s[s.length - 1].r : null; };
  const debAn = fin ? (Math.floor(fin / 100) - 1) * 100 + 12 : 0;
  // bourse : une enveloppe par colonne du Versus
  const envs = [1, 2, 3, 4].map(e => {
    const s = st(e); if (!(s.valeur > 0) && !(s.verse > 0) && !(enPct && serie(p, e).some(z => z.val > 0))) return null;
    const premier = p ? serie(p, e).find(z => z.val > 0) : null;
    return { nom: noms[e], type: "env", regime: e === 1 ? "PEA" : e === 2 ? "AV" : e === 3 ? "CTO" : "Crypto", valeur: s.valeur, gain: s.pvLatente, gainPct: s.pvLatentePct, latente: s.pvLatente,
      twr: s.twr, mwr: s.mwr, vol: s.vol, m1: dernierR(e), ytd: st(e, debAn).twr, s1: null, m6: null, a1: null, ouverture: premier ? premier.d : null };
  }).filter(Boolean);
  // épargne : chaque compte part d'une valeur de départ, puis versements, retraits et intérêts ; on en déduit le solde à chaque date
  const comptes = raw.comptes || [], mouvements = raw.soldes || [], courant = {};
  const soldes = mouvements.map(s => {
    const nat = s[3], v = s[2]; let b = courant[s[1]];
    if (nat === "Départ" || nat === "Mise à jour") b = v; else if (nat === "Retrait") b = (b || 0) - v; else b = (b || 0) + v;
    courant[s[1]] = Math.round(b * 100) / 100;
    return [s[0], s[1], courant[s[1]], nat, s[4], s[5], v];
  });
  const dernier = {}; soldes.forEach(s => { dernier[s[1]] = { solde: s[2], date: s[0] }; });
  const vus = comptes.filter(c => dernier[c.nom] && (c.statut !== "Fermé" || dernier[c.nom].solde > 0.5));
  const totalEp = vus.reduce((a, c) => a + dernier[c.nom].solde, 0);
  const epargne = vus.map(c => ({ nom: c.nom, type: c.type, solde: dernier[c.nom].solde, date: dernier[c.nom].date, taux: null, acquis: null, fin31: null, fiscal: null }));
  if (epargne.length) epargne.push({ nom: "Total épargne", solde: totalEp, acquis: null, fin31: null });
  // mois couverts : du premier relevé (bourse) ou du premier solde jusqu'au mois en cours
  const now = new Date(), kAuj = now.getFullYear() * 100 + now.getMonth() + 1;
  const kPrem = Math.min(sTot.length ? sTot[0].k : kAuj, soldes.length ? +soldes[0][0].slice(0, 4) * 100 + +soldes[0][0].slice(5, 7) : kAuj);
  const ks = []; for (let [a, m] = [Math.floor(kPrem / 100), kPrem % 100]; a * 100 + m <= kAuj; [a, m] = moisPlus(a, m, 1)) ks.push(a * 100 + m);
  const nomsEp = comptes.filter(c => soldes.some(s => s[1] === c.nom)).map(c => c.nom);
  const soldeA = (nom, iso) => { let v = null; soldes.forEach(s => { if (s[1] === nom && s[0] <= iso) v = s[2]; }); return v; };
  const premierSolde = soldes.length ? soldes[0][0] : null;
  const bourseA = k => { let v = null; if (!enPct) sTot.forEach(z => { if (z.k <= k) v = z.val; }); return v; };
  const moisParMois = ks.map(k => {
    const iso = finMoisIso(Math.floor(k / 100), k % 100);
    const ep = premierSolde && iso >= premierSolde.slice(0, 7) + "-01" ? nomsEp.reduce((a, n) => a + (soldeA(n, iso) || 0), 0) : null;
    const b = bourseA(k);
    return { mois: iso, bourse: b || 0, epargne: ep, uc: 0, patrimoine: (b || 0) + (ep || 0) };
  });
  const epargneMois = nomsEp.length ? { comptes: nomsEp, rows: moisParMois.filter(r => r.epargne !== null).map(r => [r.mois].concat(nomsEp.map(n => soldeA(n, r.mois) || 0))) } : null;
  // historique de la bourse : un point par relevé mensuel du Versus (indice de performance et S&P 500 rebasés)
  const mi = Dv ? rendementsIndice(Dv, iR) : {};
  // enveloppe par enveloppe (PEA, assurance vie, CTO, crypto) : valeur, versements cumulés et indice de performance
  const CLE_ENV = [null, "pea", "av", "cto", "cr"], parEnv = [], ipE = {}, colsH = ["d", "v", "a", "ip", "isp"];
  if (p) [1, 2, 3, 4].forEach(e => { if (!envs.some(x => x.nom === noms[e])) return; const m = {}; serie(p, e).forEach(z => { m[z.k] = z; }); parEnv.push([e, m]); ipE[e] = null; colsH.push(CLE_ENV[e], "v_" + CLE_ENV[e], "a_" + CLE_ENV[e]); });
  colsH.push("msp");
  let ip = 100, isp = 100;
  const rows = sTot.map((z, j) => {
    if (j > 0 && typeof z.r === "number") ip *= 1 + z.r;
    if (j > 0 && typeof mi[z.k] === "number") isp *= 1 + mi[z.k];
    const ligne = [+String(z.d).replace(/-/g, ""), enPct ? null : z.val, enPct ? null : z.cum, ip, isp];
    parEnv.forEach(([e, m]) => {
      const q = m[z.k], v = q && q.val > 0 ? q.val : null;
      if (v === null) ipE[e] = null; else if (ipE[e] === null) ipE[e] = 100; else if (typeof q.r === "number") ipE[e] *= 1 + q.r;
      ligne.push(ipE[e], enPct ? null : v, v === null || enPct ? null : q.cum);
    });
    ligne.push(j > 0 && typeof mi[z.k] === "number" ? mi[z.k] : null);   // lot 46 : S&P 500 du mois (null = inconnu), pour le marqueur de Mois par mois
    return ligne;
  });
  const prets = echeancier((raw.reglages || {}).pret, raw.echeancier);
  const ap = (raw.reglages || {}).appart || {}, partA = (ok(ap.part) && ap.part > 0 ? ap.part : 100) / 100;
  const financier = (tot.valeur || 0) + totalEp;
  let immo = [], appart = null;
  if (ap.prix > 0) {
    const prix = ap.prix * partA, dette = prets ? prets.restantAuj : 0;
    appart = { prix, date: ap.date || (prets ? prets.mensuel[0][0] : null) };
    immo = [{ nom: (ap.nom || "Appartement") + " (ma part)", montant: prix, note: partA < 1 ? F0.format(partA * 100) + " % de " + eur(ap.prix) : null },
      { nom: "Crédit immobilier : restant dû (ma part)", montant: dette, note: prets ? "fin du crédit : " + frDate(prets.fin) + " · mensualité (ma part) " + eur(prets.mensualite, 2) : "prêt pas encore saisi (➕ › Mes comptes)" },
      { nom: "Valeur nette immobilière", montant: prix - dette, note: null },
      { nom: "Patrimoine net (avec immobilier)", montant: financier + prix - dette, note: "L'immobilier pèse " + pct((prix - dette) / Math.max(1, financier + prix - dette), 0, false) + " du total" }];
  }
  // mois avec un versement : bourse (relevés du Versus) ou hausse d'un compte saisie comme « mise à jour »
  const vers = {};
  if (p) serie(p, 0).forEach(z => { if (z.k <= fin && (z.verse || 0) > 0) { const m = String(z.k).slice(0, 4) + "-" + String(z.k).slice(4, 6); vers[m] = (vers[m] || 0) + z.verse; } });
  const prec = {};
  soldes.forEach(s => { const av = prec[s[1]]; prec[s[1]] = s[2];
    const plus = s[3] === "Versement" ? s[6] : s[3] === "Mise à jour" && av !== undefined ? s[2] - av : 0;
    if (plus > 0.5) { const m = s[0].slice(0, 7); vers[m] = (vers[m] || 0) + plus; } });
  const premier = [sTot.length ? sTot[0].d : null, premierSolde].filter(Boolean).sort()[0] || null;
  const derSaisie = soldes.length ? soldes.map(s => s[0]).sort().pop() : null;
  const vieux = derSaisie && (Date.now() - new Date(derSaisie + "T12:00:00")) / 864e5 > 31;
  const total = { nom: "Portefeuille", type: "total", valeur: tot.valeur, gain: tot.pvLatente, gainPct: tot.pvLatentePct, twr: tot.twr, mwr: tot.mwr, vol: tot.vol, sharpe: tot.sharpe, m1: dernierR(0), ytd: st(0, debAn).twr, s1: null, m6: null, a1: null };
  return {
    simple: true, profil: "simple", _d: Dv, ok: true, genere: raw.genere, personne: qui,
    majTexte: (enPct ? "⚠ Bourse non comptée ici (ton relevé du Versus est en %, sans montants) : ta bourse se suit dans ton fichier complet" : fin ? "Bourse : relevé de " + MOIS_L[fin % 100 - 1] + " " + Math.floor(fin / 100) : "Bourse : pas encore de relevé") + (derSaisie ? " · épargne saisie le " + frDate(derSaisie) : ""),
    anomalies: "", marches: "",
    rappel: !comptes.length ? "🔔 À mettre à jour : ajoute tes comptes d'épargne et leur valeur de départ (➕ › Mes comptes)" : vieux ? "🔔 À mettre à jour : tes soldes d'épargne (dernière saisie il y a plus d'un mois)" : derSaisie ? "✓ Soldes à jour (saisis le " + frDate(derSaisie) + ")." : "🔔 À mettre à jour : saisis le solde de tes comptes (➕ › Mouvement)",
    synthese: { valeur: tot.valeur || 0, apports: tot.verse || 0, gain: tot.pvLatente, gainPct: tot.pvLatentePct, latente: tot.pvLatente, latentePct: tot.pvLatentePct, mwr: tot.mwr, twr: tot.twr,
      sp500: tot.i1 ? tot.i1.twr : null, epargne: totalEp, financier, jour: null, jourPct: null, timing: "—", releve: fin },
    indices: [], enveloppes: envs.concat([total]), groupes: [], fiscalite: [], supports: [], frais: [], cibles: [], alertes: [], perfLignes: {}, signal: null,
    epargne, epargneMois, moisParMois, immo, prets,
    parametres: { rappels: [], appart },
    historique: { cols: colsH, rows },
    ref: { enveloppes: envs.map(e => ({ nom: e.nom, regime: e.regime, ouverture: e.ouverture, statut: "Ouvert", perimetre: "Portefeuille" })), types: [], actifs: [], cours: {}, detenu: [], journal: [], raccourcis: [],
      parcours: { premier, derniereVente: null, mois: Object.keys(vers).map(m => ({ m, apports: vers[m] })) } },
    comptes, soldes, mouvements, joursModif: raw.joursModif || 7, reglages: raw.reglages || {}
  };
}

/* ---- Aujourd'hui (profil simple) ---- */
function ilYa(iso) { const j = Math.floor((Date.now() - new Date(iso + "T12:00:00")) / 864e5); return j <= 0 ? "aujourd'hui" : j === 1 ? "hier" : "il y a " + j + " j"; }
function htmlJourSimple() {
  const s = M.synthese || {};
  const texteFlap = ETAT.discret === "oui" ? "•••" + NB + "€" : eur(s.financier);
  const animer = !reduit && texteFlap !== dernierFlap; dernierFlap = texteFlap;
  const envs = (M.enveloppes || []).filter(e => e.type === "env"), ep = (M.epargne || []).filter(x => !/^Total/.test(x.nom));
  const c = (k, lab, val, cls, sub) => '<button type="button" data-def="' + k + '"><span class="lab">' + lab + '</span><b class="' + cls + '">' + val + "</b><small>" + sub + "</small></button>";
  const rel = s.releve ? MOIS_L[s.releve % 100 - 1] + " " + Math.floor(s.releve / 100) : null;
  const ligne = (nom, val, a, aCls, b, bCls) => '<div class="m-env-h"><b>' + esc(nom) + '</b><span class="v">' + eur(val) + '</span><span class="pv ' + (aCls || "") + '">' + a + '</span><span class="j ' + (bCls || "") + '">' + b + "</span></div>";
  const Dv = dVersus();
  const apercu = !M.personne ? '<div class="m-note warn"><span class="ic">!</span><span>Ce fichier ne sait pas encore à qui il est, donc la bourse n\'est pas affichée. ' +
      (estAdmin() && Dv ? "Choisis son propriétaire :</span></div>" + '<div class="chips ms-proprio">' + Dv.personnes.map(x => '<button class="chip" type="button" data-ms-proprio="' + esc(x.nom) + '">' + esc(x.nom) + "</button>").join("") + "</div>"
        : "Il le saura dès que son propriétaire l'ouvrira avec son code.</span></div>") : "";
  return apercu + '<div class="m-hero"><span class="eyebrow">' + embHero() + 'Patrimoine financier</span>' +
      '<div class="m-flaps" role="img" aria-label="' + esc(texteFlap) + '">' + flaps(texteFlap, animer) + "</div>" +
      '<div class="m-jour"><span class="badge big-b flat">' + (M.personne ? esc(M.personne) + " · " : "") + 'Bourse ' + eur(s.valeur) + " · épargne " + eur(s.epargne) + "</span><span>" + (rel ? "relevé de " + esc(rel) : "pas encore de relevé") + "</span></div></div>" +
    (envs.length ? '<div class="m-debut-w"><span class="eyebrow">Bourse depuis le début</span><div class="m-debut">' +
      c("gain", "Résultat", eur(s.gain, 0, true), sens(s.gain), pct(s.gainPct)) + c("verse", "Versé", eur(s.apports), "", "au total") +
      c("twr", 'TWR<i class="qm" aria-hidden="true">?</i>', pct(s.twr), sens(s.twr), "S&amp;P " + pct(s.sp500)) + c("mwr", 'MWR<i class="qm" aria-hidden="true">?</i>', pct(s.mwr), sens(s.mwr), "ton argent") +
      '</div><p class="m-def-l" hidden></p></div>' : "") +
    "<div>" + '<div class="m-tri"><h2 class="sec">Mes comptes</h2></div>' +
      (envs.length ? '<div class="m-env" style="--ce:var(--e1)"><div class="m-env-h"><b>Bourse</b><span class="v">' + eur(s.valeur) + '</span><span class="pv">relevé Versus de ' + esc(rel || "—") + '</span><span class="j"></span></div>' +
        envs.map(e => '<div class="ms-r"><b>' + esc(e.nom) + '</b><span class="v">' + eur(e.valeur) + "</span><small>" + (e.ouverture ? "depuis " + frDate(e.ouverture).slice(3) : "") + '</small><small class="s">mois <i class="' + sens(e.m1) + '">' + pct(e.m1) + '</i> · total <i class="' + sens(e.gain) + '">' + eur(e.gain, 0, true) + " · " + pct(e.gainPct) + "</i></small></div>").join("") + "</div>" : "") +
      '<div class="m-env" style="--ce:var(--e2)">' + ligne("Épargne", s.epargne, ep.length ? ep.length + " compte" + (ep.length > 1 ? "s" : "") : "aucun compte", "", "", "") +
        ep.map(x => { const vieux = (Date.now() - new Date(x.date + "T12:00:00")) / 864e5 > 31;
          return '<div class="ms-r"><b>' + esc(x.nom) + '</b><span class="v">' + eur(x.solde) + "</span><small>" + esc(x.type || "") + '</small><small class="s"><span class="badge ' + (vieux ? "warn" : "flat") + '">mis à jour ' + ilYa(x.date) + "</span></small></div>"; }).join("") + "</div>" +
    "</div>" +
    '<button class="btn acc plein" type="button" id="ms-ouvrir">✏️ Mettre à jour mes soldes</button>' +
    '<p class="info">Ton épargne, c\'est toi qui la saisis, quand tu veux : seul le dernier solde compte, les anciens servent aux courbes. Ta bourse vient de tes relevés du Versus (➕ › Mouvement › « Relevé du mois pour le Versus »).</p>';
}
function brancherJourSimple(v) {
  const def = v.querySelector(".m-def-l");
  const TXT = Object.assign({}, DEFS, { verse: "Versé : total de ce que tu as mis en bourse (PEA, assurance-vie), d'après tes relevés du Versus." });
  v.querySelectorAll("[data-def]").forEach(b => b.addEventListener("click", () => {
    const on = b.getAttribute("aria-pressed") !== "true";
    v.querySelectorAll("[data-def]").forEach(x => x.setAttribute("aria-pressed", "false"));
    b.setAttribute("aria-pressed", String(on)); def.hidden = !on; def.textContent = on ? TXT[b.dataset.def] : "";
  }));
  const b = v.querySelector("#ms-ouvrir"); if (b) b.addEventListener("click", () => ouvrirSoldes("soldes"));
  v.querySelectorAll("[data-ms-proprio]").forEach(x => x.addEventListener("click", () => envoyerSimple({ action: "reglages", reglages: { "versus.nom": x.dataset.msProprio } }, x)));
}

/* ---- Saisie (profil simple) : mêmes titre et onglets que le profil complet (v16.92) : Mouvement, Historique, Mes comptes ---- */
let paneS = "soldes", confirmeS = null;
const ETAT_S = { compte: null, type: "Versement" };
function assurerFeuilleSimple() {
  if ($f("ms-saisie")) return;
  const d = document.createElement("div");
  d.className = "voile"; d.id = "ms-saisie"; d.hidden = true;
  d.innerHTML = '<div class="feuille moi m-feuille" role="dialog" aria-modal="true" aria-labelledby="ms-titre">' +
    '<h3 id="ms-titre">Saisir <button class="icon-btn" type="button" id="ms-fermer" aria-label="Fermer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></h3>' +
    '<div class="seg m-seg4" role="group" aria-label="Saisie"><button type="button" data-ms-pane="soldes">Mouvement</button><button type="button" data-ms-pane="historique">Historique</button>' +
      '<button type="button" data-ms-pane="comptes">Mes comptes</button></div>' +
    '<div id="ms-corps"></div></div>';
  document.body.appendChild(d);
  const fermer = () => { d.hidden = true; confirmeS = null; };
  d.addEventListener("click", e => { if (e.target === d) fermer(); });
  $f("ms-fermer").addEventListener("click", fermer);
  d.querySelectorAll("[data-ms-pane]").forEach(b => b.addEventListener("click", () => { paneS = b.dataset.msPane; confirmeS = null; rendreSimple(); }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") fermer(); });
}
function ouvrirSoldes(o) {
  injecterStyle(); assurerFeuilleSimple(); lireCache();
  if (!M) { toast("Lecture de ton fichier en cours, réessaie dans un instant."); charger(false); return; }
  paneS = o || (M.comptes && M.comptes.length ? "soldes" : "comptes");
  $f("ms-saisie").hidden = false; rendreSimple();
}
async function envoyerSimple(corps, btn) {
  if (btn) { btn.disabled = true; btn.dataset.lib = btn.textContent; btn.textContent = "Envoi…"; }
  const rep = await posterFichier(corps);
  if (btn) { btn.disabled = false; btn.textContent = btn.dataset.lib; }
  if (!rep.ok) { toast(rep.message || "Enregistrement impossible."); return false; }
  recevoir(Object.assign({ profil: "simple" }, rep)); SRC = "api"; dernierAppel = Date.now();
  stock.set(K.cache, JSON.stringify(RAW));
  toast(rep.message || "Enregistré.");
  signalerCloche(); if (vueMoi()) rendre();
  return true;
}
function rendreSimple() {
  const z = $f("ms-corps"); if (!z) return;
  document.querySelectorAll("[data-ms-pane]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.msPane === paneS)));
  const comptes = (M.comptes || []), ouverts = comptes.filter(c => c.statut !== "Fermé"), soldes = M.soldes || [];
  const der = {}; soldes.forEach(s => { der[s[1]] = s; });
  const mouv = M.mouvements || soldes, jm = M.joursModif || 7;
  const aDepart = nom => mouv.some(s => s[1] === nom && (s[3] === "Départ" || s[3] === "Mise à jour"));
  if (paneS === "soldes") {
    if (!ouverts.length) {
      z.innerHTML = '<p class="info">Aucun compte pour l\'instant. Ajoute d\'abord tes livrets et assurances-vie dans « Mes comptes ».</p><button class="btn acc" type="button" id="ms-aller-comptes">Ajouter un compte</button>';
      z.querySelector("#ms-aller-comptes").addEventListener("click", () => { paneS = "comptes"; rendreSimple(); });
      return;
    }
    const sel = ouverts.find(c => c.nom === ETAT_S.compte) || ouverts[0], depart = !aDepart(sel.nom), solde = der[sel.nom] ? der[sel.nom][2] : null;
    const types = [["Versement", "➕ Versement"], ["Retrait", "➖ Retrait"], ["Intérêts", "💶 Intérêts"]];
    if (!types.some(t => t[0] === ETAT_S.type)) ETAT_S.type = "Versement";
    z.innerHTML = htmlCarteReleveVersus() + '<div class="ms-liste">' + ouverts.map(c => '<button type="button" class="ms-l ms-c' + (c.nom === sel.nom ? " on" : "") + '" data-ms-c="' + esc(c.nom) + '"><span class="ms-n"><b>' + esc(c.nom) + "</b><small>" + (aDepart(c.nom) ? "solde " + eur(der[c.nom] ? der[c.nom][2] : 0, 2) : "valeur de départ à saisir") + "</small></span></button>").join("") + "</div>" +
      '<form class="form" id="ms-form" novalidate>' +
      (depart
        ? '<p class="ms-note">🏁 <b>Valeur de départ de ' + esc(sel.nom) + '</b> : le montant sur le compte à cette date. Elle se saisit <b>une seule fois</b> et se fige ensuite : après, seuls les versements, retraits et intérêts font bouger le solde.</p>'
        : '<div class="seg" role="group" aria-label="Type de mouvement">' + types.map(t => '<button type="button" data-ms-t="' + t[0] + '" aria-pressed="' + (ETAT_S.type === t[0]) + '">' + t[1] + "</button>").join("") + "</div>") +
      '<div class="rang2"><div class="champ"><label for="ms-montant">' + (depart ? "Valeur de départ (€)" : "Montant (€)") + '</label><input id="ms-montant" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00"></div>' +
      '<div class="champ"><label for="ms-date">Date</label><input id="ms-date" type="date" value="' + aujourdhuiISO() + '" max="' + aujourdhuiISO() + '"></div></div>' +
      '<button class="btn acc plein" type="submit" id="ms-envoyer">' + (depart ? "Fixer la valeur de départ" : "Enregistrer") + "</button>" +
      '<p class="info">' + (depart ? "Regarde le montant exact dans ton appli bancaire avant de valider." : (ETAT_S.type === "Intérêts" ? "Les intérêts tombent en général au 1er janvier (livrets) : ils augmentent ton solde sans compter comme un versement dans tes séries." : ETAT_S.type === "Retrait" ? "Un retrait ne peut pas dépasser le solde du compte à cette date." : "Un versement compte dans ta série de mois avec un versement (Missions).") +
        " Solde actuel : <b>" + eur(solde || 0, 2) + "</b>. Une saisie se supprime pendant " + jm + " jours dans l'historique, puis elle est figée.") + "</p></form>";
    if (z.querySelector("#f-rv")) z.querySelector("#f-rv").addEventListener("click", () => ouvrirReleveVersus(false));
    if (z.querySelector("#f-rv-h")) z.querySelector("#f-rv-h").addEventListener("click", () => ouvrirReleveVersus(true));   // v17.34 : le relevé du Versus, en tête de Mouvement
    z.querySelectorAll("[data-ms-c]").forEach(b => b.addEventListener("click", () => { ETAT_S.compte = b.dataset.msC; rendreSimple(); }));
    z.querySelectorAll("[data-ms-t]").forEach(b => b.addEventListener("click", () => { ETAT_S.type = b.dataset.msT; rendreSimple(); }));
    z.querySelector("#ms-form").addEventListener("submit", async e => {
      e.preventDefault();
      const brut = z.querySelector("#ms-montant").value, date = z.querySelector("#ms-date").value;
      let v = lireNombre(brut);
      if (millierDouteux(brut)) {   // v16.83 : « 1.500 » = 1 500 € ? on demande
        const l = lectureMilliers(brut);
        if (!confirm("« " + brut.trim() + " » = " + (+l.milliers).toLocaleString("fr-FR") + " € ?\n\nOK : " + (+l.milliers).toLocaleString("fr-FR") + " €" + (l.virgule ? "\nAnnuler : corriger (pour " + l.virgule + " €, écris-le avec une virgule)" : "\nAnnuler : corriger"))) { toast("Corrige le montant : 1500 ou 1,5 (avec une virgule)."); return; }
        v = +l.milliers; z.querySelector("#ms-montant").value = saisieNombre(v, 2);
      }
      if (!(v >= 0) || (!depart && !(v > 0))) { toast("Montant illisible."); return; }
      if (!date) { toast("Choisis une date."); return; }
      if (!depart && ETAT_S.type === "Retrait") { const dispo = soldes.filter(x => x[1] === sel.nom && x[0] <= date).map(x => x[2]).pop(); if (v > (dispo || 0) + .005) { toast("Retrait trop élevé : " + sel.nom + " n'a que " + eur(dispo || 0, 2) + " à cette date."); return; } }
      if (!depart && ETAT_S.type !== "Intérêts") {   // v16.83 : un versement ou un retrait bien plus petit que d'habitude sur ce compte
        const hab = mediane(mouv.filter(x => x[1] === sel.nom && x[3] === ETAT_S.type).map(x => x[2]));
        if (hab > 0 && v < hab * .2 && !confirm("Ce montant (" + eur(v, 2) + ") est bien plus petit que d'habitude sur " + sel.nom + " (environ " + eur(hab) + "). L'enregistrer quand même ?")) return;
      }
      const nature = depart ? "Départ" : ETAT_S.type;
      if (await envoyerSimple({ action: "soldes", entrees: [{ date, compte: sel.nom, montant: v, nature }] }, z.querySelector("#ms-envoyer"))) rendreSimple();
    });
  } else if (paneS === "historique") {
    const l = mouv.slice().reverse().slice(0, 80), modif = s => s[4] && (Date.now() - new Date(String(s[4]).replace(" ", "T"))) / 864e5 <= jm;
    const lib = s => s[3] === "Départ" || s[3] === "Mise à jour" ? "🏁 départ " + eur(s[2], 2) : s[3] === "Retrait" ? "➖ " + eur(s[2], 2) : s[3] === "Intérêts" ? "💶 +" + eur(s[2], 2) : "➕ " + eur(s[2], 2);
    z.innerHTML = !l.length ? '<p class="info">Pas encore de saisie.</p>' : '<div class="m-liste">' + l.map(s => '<div class="r"><span class="a">' + esc(s[1]) + '</span><span class="b">' + lib(s) + '</span><span class="c">' + frDate(s[0]) + " · " + esc((s[3] === "Mise à jour" ? "solde" : s[3]).toLowerCase()) + '</span><span class="d">' +
      (modif(s) ? '<button class="lien danger" type="button" data-ms-suppr="' + s[5] + '">' + (confirmeS === s[5] ? "Confirmer" : "Supprimer") + "</button>" : '<span class="ms-fige" title="Saisie figée">🔒</span>') + "</span></div>").join("") + "</div>" +
      '<p class="info">Une saisie se supprime pendant ' + jm + " jours, puis elle est figée 🔒. Pour corriger une saisie figée, ajoute un mouvement inverse (un retrait pour annuler un versement en trop, par exemple).</p>";
    z.querySelectorAll("[data-ms-suppr]").forEach(b => b.addEventListener("click", async () => {
      const n = +b.dataset.msSuppr;
      if (confirmeS !== n) { confirmeS = n; rendreSimple(); return; }
      const s = mouv.find(x => x[5] === n); confirmeS = null;
      if (s && await envoyerSimple({ action: "supprimerSolde", solde: { ligne: n, date: s[0], compte: s[1] } }, b)) rendreSimple();
    }));
  } else {
    const r = M.reglages || {}, ap = r.appart || {}, pr = r.pret || {};
    const val = (v, dec) => ok(v) ? saisieNombre(v, dec === undefined ? 2 : dec) : "";
    z.innerHTML = '<h4 class="m-h4">Mes comptes d\'épargne</h4><div class="m-liste">' + (comptes.length ? comptes.map((c, i) => '<div class="r"><span class="a">' + esc(c.nom) + '</span><span class="b">' + (der[c.nom] ? eur(der[c.nom][2]) : "—") + '</span><span class="c">' + esc(c.type) + (c.statut === "Fermé" ? " · fermé" : "") + '</span><span class="d"><button class="lien' + (c.statut === "Fermé" ? "" : " danger") + '" type="button" data-ms-ferme="' + i + '">' + (c.statut === "Fermé" ? "Rouvrir" : confirmeS === "f" + i ? "Confirmer" : "Fermer") + "</button></span></div>").join("") : '<div class="r"><span class="a">Aucun compte</span></div>') + "</div>" +
      '<form class="form" id="ms-ajout" novalidate><div class="rang2"><div class="champ"><label for="ms-nom">Nouveau compte</label><input id="ms-nom" type="text" maxlength="40" placeholder="Livret A, LDDS, AV…"></div>' +
        '<div class="champ"><label for="ms-type">Type</label><select id="ms-type"><option>Livret</option><option>Assurance-vie</option><option>Autre épargne</option></select></div></div>' +
        '<button class="btn ghost" type="submit">Ajouter ce compte</button><p class="info">Seulement l\'épargne : ton PEA et ton assurance-vie en bourse sont déjà suivis par tes relevés du Versus.</p></form>' +
      '<h4 class="m-h4">Bien immobilier</h4><form class="form" id="ms-reg" novalidate>' +
        '<div class="rang2"><div class="champ"><label for="mr-prix">Prix d\'achat total (€)</label><input id="mr-prix" type="text" inputmode="decimal" value="' + val(ap.prix, 0) + '"></div>' +
        '<div class="champ"><label for="mr-apart">Ma part (%)</label><input id="mr-apart" type="text" inputmode="decimal" value="' + (ok(ap.part) ? val(ap.part) : "") + '" placeholder="50"></div></div>' +
        '<div class="rang2"><div class="champ"><label for="mr-adate">Date d\'achat</label><input id="mr-adate" type="date" value="' + (ap.date || "") + '"></div>' +
        '<div class="champ"><label for="mr-anom">Nom affiché</label><input id="mr-anom" type="text" maxlength="60" value="' + esc(ap.nom || "") + '" placeholder="Appartement"></div></div>' +
        '<h4 class="m-h4">Prêt immobilier</h4>' + (M.prets && M.prets.banque ? '<p class="ms-note">🏦 <b>Tableau d\'amortissement de la banque</b> : ' + M.prets.nb + " échéances, du " + frDate(M.prets.debut) + " au " + frDate(M.prets.fin) + ". L'app suit ce tableau au centime (assurance comprise) : seule « Ma part » compte ci-dessous.</p>" : "") +
        '<div class="rang2"><div class="champ"><label for="mr-cap">Capital emprunté total (€)</label><input id="mr-cap" type="text" inputmode="decimal" value="' + val(pr.capital, 0) + '"></div>' +
        '<div class="champ"><label for="mr-ppart">Ma part (%)</label><input id="mr-ppart" type="text" inputmode="decimal" value="' + (ok(pr.part) ? val(pr.part) : "") + '" placeholder="50"></div></div>' +
        '<div class="rang2"><div class="champ"><label for="mr-taux">Taux nominal (% / an)</label><input id="mr-taux" type="text" inputmode="decimal" value="' + val(pr.taux, 3) + '"></div>' +
        '<div class="champ"><label for="mr-duree">Durée (années)</label><input id="mr-duree" type="text" inputmode="decimal" value="' + val(pr.duree, 0) + '"></div></div>' +
        '<div class="rang2"><div class="champ"><label for="mr-debut">1re échéance</label><input id="mr-debut" type="date" value="' + (pr.debut || "") + '"></div>' +
        '<div class="champ"><label for="mr-ass">Assurance / mois, ma part (€)</label><input id="mr-ass" type="text" inputmode="decimal" value="' + val(pr.assurance) + '"></div></div>' +
        '<button class="btn acc plein" type="submit" id="mr-envoyer">Enregistrer le bien et le prêt</button>' +
        '<p class="info">Prêt à plusieurs : saisis le capital et le prix totaux, et ta part (la moitié = 50 %, un tiers = 33,33 %). Sans tableau de la banque, l\'app calcule l\'échéancier et ne compte que ta part dans ton patrimoine net. Tout est dans l\'offre de prêt.</p></form>';
    z.querySelectorAll("[data-ms-ferme]").forEach(b => b.addEventListener("click", async () => {
      const i = +b.dataset.msFerme, c = comptes[i];
      if (c.statut !== "Fermé" && confirmeS !== "f" + i) { confirmeS = "f" + i; rendreSimple(); return; }
      confirmeS = null;
      if (await envoyerSimple({ action: "compte", op: c.statut === "Fermé" ? "rouvrir" : "fermer", nom: c.nom }, b)) rendreSimple();
    }));
    z.querySelector("#ms-ajout").addEventListener("submit", async e => {
      e.preventDefault();
      const nom = z.querySelector("#ms-nom").value.trim(); if (!nom) { toast("Donne un nom au compte."); return; }
      if (await envoyerSimple({ action: "compte", op: "ajouter", nom, type: z.querySelector("#ms-type").value }, e.submitter)) rendreSimple();
    });
    z.querySelector("#ms-reg").addEventListener("submit", async e => {
      e.preventDefault();
      const n = id => { const t = z.querySelector(id).value.trim(); return t === "" ? null : lireNombre(t); };
      const reglages = { "appart.nom": z.querySelector("#mr-anom").value.trim() || null, "appart.prix": n("#mr-prix"), "appart.part": n("#mr-apart"), "appart.date": z.querySelector("#mr-adate").value || null,
        "pret.capital": n("#mr-cap"), "pret.part": n("#mr-ppart"), "pret.taux": n("#mr-taux"), "pret.duree": n("#mr-duree"), "pret.debut": z.querySelector("#mr-debut").value || null, "pret.assurance": n("#mr-ass") };
      if (Object.entries(reglages).some(([k, x]) => k !== "appart.nom" && typeof x === "number" && !(x >= 0))) { toast("Un montant est illisible."); return; }
      if ((reglages["appart.part"] || 0) > 100 || (reglages["pret.part"] || 0) > 100) { toast("Une part ne peut pas dépasser 100 %."); return; }
      await envoyerSimple({ action: "reglages", reglages }, z.querySelector("#mr-envoyer"));
    });
  }
}

/* ---------- Interface publique ---------- */
window.Moi = {
  rendre,
  prechauffer() { injecterStyle(); if (!configure()) { signalerCloche(); return; } lireCache(); signalerCloche(); if (Date.now() - dernierAppel > 5 * 60e3) charger(false); },
  notifications: htmlNotifications,
  retour() { if (PREF.onglet === "artema") { PREF.onglet = "patrimoine"; garderPref(); rendre(); window.scrollTo(0, 0); return true; } if (PREF.onglet && PREF.onglet !== "jour") { PREF.onglet = "jour"; garderPref(); rendre(); window.scrollTo(0, 0); return true; } return false; },
  faireRappel(k) { lireCache(); if (M) faireRappel(k); },
  pointArtema() { lireCache(); if (M) ouvrirPointArtema("point"); },
  feVerifie() { stock.set(cleStock("feVu"), String(Date.now())); signalerCloche(); },
  reporterRappel(k) { const pt = plusTard(); pt[k] = Date.now() + 864e5; stock.set(cleStock("plusTard"), JSON.stringify(pt)); signalerCloche(); if (vueMoi()) rendre(); },
  ouvrirMaj() {   // v17.93 (Théo) : fichier pas encore lu → on le lit puis on ouvre (avant : rien ne s'ouvrait, écran vide)
    lireCache();
    if (M) { reglageOuvert = null; ouvrirSaisieM(null, "maj"); return; }
    if (typeof toast === "function") toast("Lecture de ton fichier en cours…");
    const essai = (n) => { lireCache(); if (M) { reglageOuvert = null; ouvrirSaisieM(null, "maj"); } else if (n > 0) setTimeout(() => essai(n - 1), 1000); else if (typeof toast === "function") toast("Ton fichier ne répond pas pour l'instant : réessaie dans un moment."); };
    charger(false); setTimeout(() => essai(30), 1000);
  },
  saisir(partiel, onglet) { lireCache(); if (M && M.simple) ouvrirSoldes(); else ouvrirSaisieM(partiel, onglet); },
  retourSaisie,
  envoieSeul() { lireCache(); return versusRelie(); },   // v17.96 : le fichier envoie-t-il lui-même son relevé au Versus ?
  dernierReleveVersus,   // v20.53 (P1) : jour du dernier relevé Versus déjà parti (lu aussi par les tests)
  _pru() { return { verifs: verifsPru(), cloche: notifications().items.map(x => x.txt), taches: tachesAFaire().filter(t => t.pru).length }; },   // (préparé) : pour les tests
  _lxSans(d) { return lxSans(d ? new Date(d) : undefined); }, _rangerLxSans(dr, d) { return rangerLxSans(dr, d ? new Date(d) : undefined); },
  _lxProgDu(m, d) { const a = M; M = m; try { return lxProgDu(d); } finally { M = a; } },   // v20.54 : pour les tests (faux fichier)
  rafraichir(frais) { if (configure()) { rendre(); charger(!!frais); } },
  testerVersus() {   // v17.93 (Théo) : fichier lu directement par le Versus (Théo) → on le dit clairement, avec le dernier relevé
    if (!configure()) return Promise.resolve({ ok: false, message: "Aucun fichier relié à cet appareil." });
    return posterFichier({ action: "testerVersus" }).then(r => {
      const der = dernierImportAuto();
      if (r && r.ok && r.pret === false && der && !versusRelie()) { const h = new Date(Math.round(der.getTime() / 36e5) * 36e5);
        return { ok: true, message: "✅ Ton relevé est lu automatiquement par le Versus, le dernier jour ouvré du mois vers 19 h (dernier : " + String(h.getDate()).padStart(2, "0") + "/" + String(h.getMonth() + 1).padStart(2, "0") + " à " + h.getHours() + " h)." }; }
      return r;
    });
  },
  connecter(url, k) {
    url = String(url || "").trim();
    if (url && url !== adresse()) effacerVerifsPru();   // un autre fichier : aucun rappel PRU de l'ancien
    if (url) stock.set(K.api, url);
    if (k) stock.set(K.cle, k);
    if (url || k) { couperLecture(); ordresEnregistres = []; ordresIncertains = []; M = null; SRC = ""; erreur = ""; dernierAppel = 0; stock.del(K.cache); stock.del(K.cacheLe); stock.del(K.refus); }
  },
  oublier() { couperLecture(); ordresEnregistres = []; ordresIncertains = []; effacerVerifsPru(); [K.api, K.cle, K.cache, K.cacheLe, K.refus].forEach(k => stock.del(k)); M = null; SRC = ""; erreur = ""; signalerCloche(); },
};
})();
