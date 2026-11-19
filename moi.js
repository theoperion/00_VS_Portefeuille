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
const PREF = Object.assign({ onglet: "jour", patri: "net", tri: "env", mode: "valeur", per: "6m", serie: "ip", moisMode: "pct", rep: "classe", acc: {} },
  (() => { try { return JSON.parse(stock.get(K.pref) || "{}"); } catch (e) { return {}; } })());
delete PREF.million;   // E (v16.93) : plus de mode « net » pour le million (ancienne préférence oubliée)
function garderPref() { stock.set(K.pref, JSON.stringify(PREF)); }

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
/* Vestiaire */
.moi .vs-o { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
.moi .vs-o .chip { display: grid; justify-items: center; gap: 3px; padding: 7px 3px 6px; border-radius: 10px; min-width: 0; }
.moi .vs-o .chip b { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.moi .vs-o .chip small { font: 500 10.5px/1 var(--f-num); color: var(--ink-3); }
.moi .vs-o .chip[aria-pressed="true"] small { color: inherit; opacity: .75; }
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
.moi .vs-nm { max-width: 100%; padding: 0 3px; font-size: 10.5px; font-weight: 600; line-height: 1.15; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
.m-fete .mf-rec span { grid-row: span 2; font-size: 24px; line-height: 1; text-align: center; }
.m-fete .mf-rec b { font: italic 800 15px/1.15 var(--f-display); letter-spacing: .05em; text-transform: uppercase; }
.m-fete .mf-rec small { font-size: 12px; opacity: .7; }
.m-fete .mf-rec.fait { border-color: #3DDC97; } .m-fete .mf-rec.fait small { color: #3DDC97; opacity: 1; }
@media (max-width: 360px) { .moi .vs-g { gap: 5px; } .moi .vs-nm { font-size: 10px; } }
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
.moi .m-seance { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; margin: 6px 0 2px; padding: 6px 11px; border-radius: 999px; font: 600 12.5px/1 var(--f-text); background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent-ink, var(--accent)); border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent); }
.moi .m-seance[aria-pressed="true"] { background: var(--accent); color: #fff; }
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
.moi .m-carte { display: flex; flex-wrap: wrap; gap: 3px; }
.moi .m-tuile { all: unset; box-sizing: border-box; cursor: pointer; flex: 1 1 64px; min-width: 64px; min-height: 54px; padding: 7px 8px; border-radius: 8px; background: var(--panel); border: 1px solid var(--rule); display: grid; align-content: space-between; gap: 2px; }
.moi .m-tuile:focus-visible { outline: 2px solid var(--accent); }
.moi .m-tuile b { font: 700 13px/1.1 var(--f-num); letter-spacing: .02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.moi .m-tuile span { font: 600 12px/1.1 var(--f-num); font-variant-numeric: tabular-nums; white-space: nowrap; }
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
.moi .m-mk-t { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.moi .m-idx-mk { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.moi .m-idx-mk button { all: unset; box-sizing: border-box; background: var(--panel); padding: 9px 10px; display: flex; justify-content: space-between; align-items: baseline; gap: 8px; min-width: 0; cursor: pointer; }
.moi .m-idx-mk button[aria-pressed="true"] { background: color-mix(in srgb, var(--accent) 14%, var(--panel)); box-shadow: inset 3px 0 0 var(--accent); }
.moi .m-idx-mk button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.moi .m-mk-panneau:not(:empty) { margin-top: 10px; padding: 10px; border: 1px solid var(--rule); border-radius: 12px; background: var(--panel); display: grid; gap: 8px; }
.moi .m-mk-svg { width: 100%; height: auto; display: block; }
.moi .m-mk-svg text { font: 10px var(--f-num, sans-serif); fill: var(--ink-2); }
.moi .m-mk-svg .gr { stroke: var(--rule); stroke-width: 1; }
.moi .m-mk-svg .b100 { stroke: var(--ink-2); stroke-width: 1; stroke-dasharray: 3 3; opacity: .6; }
.moi .m-mk-res { display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: baseline; font-size: 13px; color: var(--ink-2); }
.moi .m-mk-res > b:first-child { color: var(--ink); font-size: 14px; margin-right: auto; }
.moi .m-mk-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.moi .m-mk-chips .chip { font-size: 12px; padding: 5px 9px; display: inline-flex; align-items: center; gap: 5px; }
.moi .m-mk-chips .chip i { width: 9px; height: 9px; border-radius: 3px; display: inline-block; }
.moi .m-mk-chips .chip[aria-pressed="false"] { opacity: .45; }
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
.moi .m-rep > div { display: grid; grid-template-columns: minmax(64px, 28%) minmax(0, 1fr) 46px 72px; gap: 8px; align-items: center; padding: 7px 0; border-bottom: 1px solid var(--rule); font-size: 13px; }
.moi .m-rep .n { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.moi .m-rep .b { height: 8px; background: var(--rule-2); border-radius: 4px; overflow: hidden; }
.moi .m-rep .b i { display: block; height: 100%; background: var(--s1); border-radius: 4px; }
.moi .m-rep .p, .moi .m-rep .e { text-align: right; font: 500 12px/1 var(--f-num); font-variant-numeric: tabular-nums; white-space: nowrap; } .moi .m-rep .e { color: var(--ink-3); }
.moi .grille td.m-c { cursor: pointer; min-width: 46px; height: 34px; font-size: 11px; }
.moi .grille td.m-c.sel { box-shadow: inset 0 0 0 2px var(--ink); }
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
  .moi .m-rep > div { grid-template-columns: minmax(60px, 26%) minmax(0, 1fr) 44px 66px; }
}

/* signal levier (repris de Cote) */
.moi .sig { border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; background: var(--panel); --sc: var(--up); }
.moi .sig.hors { --sc: var(--down); } .moi .sig.x1 { --sc: var(--p0); } .moi .sig.creux { --sc: var(--accent); }
.moi .sig-tete { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 10px; width: 100%; padding: 11px 12px 11px 10px; border-left: 4px solid var(--sc); }
.moi .sig-tete:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
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
.moi .sig-pos.cto-x3 { --sc: #E0841A; } .moi .sig-pos.cto-x2 { --sc: var(--up); } .moi .sig-pos.cto-x1 { --sc: var(--p0); } .moi .sig-pos.cto-or { --sc: #B8962E; }
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
.moi .m-status { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; color: var(--ink-2); }
/* saisie (feuille ➕) */
.moi.m-feuille { min-height: 70vh; }
.moi .m-seg4 button { font-size: 12.5px; padding: 10px 4px; }
.moi .form { display: grid; gap: 14px; }
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
.m-million .mm-sim { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.m-million .mm-sim label { display: grid; gap: 5px; font-size: 12px; color: rgba(255,255,255,.75); }
.m-million .mm-sim input { font: 600 16px/1.2 var(--f-num); padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.07); color: #fff; width: 100%; min-width: 0; }
.m-million .mm-sim input:focus { outline: 2px solid var(--gold); outline-offset: 1px; }
.m-million .mm-graph { display: grid; gap: 4px; }
.m-million .mm-svg { width: 100%; height: auto; display: block; }
.m-million .mm-svg text { font: 500 9.5px var(--f-num); fill: rgba(255,255,255,.55); }
.m-million .mm-leg { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 11.5px; color: rgba(255,255,255,.7); }
.m-million .mm-leg i { display: inline-block; width: 14px; height: 0; border-top: 2.4px solid #F5C542; vertical-align: middle; margin-right: 6px; }
.m-million .mm-leg i.sans { border-top: 1.6px dashed rgba(255,255,255,.6); }
.m-million .mm-raz { all: unset; cursor: pointer; color: var(--gold); text-decoration: underline; }
.m-million .mm-badge { margin: 0; padding: 9px 11px; border-radius: 10px; font-size: 12.5px; line-height: 1.4; color: rgba(255,255,255,.85); background: rgba(245,197,66,.1); border: 1px dashed rgba(245,197,66,.45); }
.m-million .mm-badge b { color: #F5C542; }
.m-million .mm-note { margin: 0; font-size: 11.5px; color: rgba(255,255,255,.5); }

/* missions : série, paliers, fête (repris de Cote) */
.moi .m-onglets button { font-size: 12.5px; padding: 10px 2px; }
.moi .m-bilans { display: flex; flex-wrap: wrap; gap: 8px; }
.wr .cl-flaps { display: flex; flex-wrap: wrap; justify-content: center; align-self: stretch; width: 100%; margin: 14px 0 6px; gap: 3px; }
.wr .cl-flaps .m-flap { width: clamp(22px, 7vw, 40px); height: clamp(34px, 10.6vw, 60px); font-size: clamp(22px, 7vw, 40px); }
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
.moi .paliers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.moi .palier { all: unset; box-sizing: border-box; display: grid; gap: 7px; align-content: start; padding: 12px; border: 1px solid var(--rule); border-radius: 12px; background: var(--panel); min-width: 0; }
.moi .palier.fait { cursor: pointer; border-color: color-mix(in srgb, var(--gold) 50%, var(--rule)); }
.moi .palier.fait:focus-visible, .moi .pl-r.fait:focus-visible { outline: 2px solid var(--accent); }
.moi .pastille { justify-self: start; position: relative; padding: 7px 9px; border-radius: 6px; background: linear-gradient(to bottom, var(--flap-2) 0 50%, var(--flap) 50% 100%); color: var(--flap-ink); font: 600 15px/1 var(--f-num); letter-spacing: .04em; }
.moi .palier.fait .pastille, .moi .pl-r.fait .pastille { color: #F5C542; }
.moi .palier:not(.fait) .pastille, .moi .pl-r:not(.fait) .pastille { opacity: .55; }
.moi .palier .pl-t { font-size: 13px; font-weight: 600; line-height: 1.3; }
.moi .palier .pl-s { font-size: 11.5px; color: var(--ink-3); line-height: 1.35; }
.moi .palier.fait .pl-s { color: var(--up); font-weight: 600; }
.moi .palier .jauge { height: 6px; }
.moi .palier .jauge i, .moi .pl-r .jauge i { background: var(--gold); }
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
.moi .m-afaire .af-a { flex: none; display: grid; gap: 2px; justify-items: center; } .moi .m-afaire .af-a .lien { font-size: 12px; white-space: nowrap; }
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
@media (max-width: 380px) { .moi .paliers { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .moi .m-flap.go, .moi .m-flap.af-prisme, .moi .m-flap.af-lingot::after { animation: none; } }
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
async function charger(frais) {
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
  v.style.setProperty("--mc", couleurMoi());
  { const th = M ? themeActif() : null; v.classList.toggle("th", !!(th && th[3])); if (th && th[3]) v.style.setProperty("--th-fond", th[3]); else v.style.removeProperty("--th-fond"); }
  if (!configure()) { v.innerHTML = ecranConnexion(); brancherConnexion(v); return; }
  if (stock.get(K.refus)) {
    v.innerHTML = '<div class="m-vide"><div class="m-flaps" aria-hidden="true">' + flaps("MOI", false) + '</div><p>🔑 Ton fichier a refusé la clé de ce téléphone.</p><p class="info">' + "La clé enregistrée ici ne correspond plus à celle de ton fichier." + ' Elle est gardée : si c\'était un raté passager, « Réessayer » suffit ; sinon, remets ta clé dans Réglages › Mon fichier.</p>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn acc" type="button" id="m-reessayer">Réessayer</button><button class="btn" type="button" id="m-connecter">Changer la clé</button></div></div>';
    brancherConnexion(v);
    v.querySelector("#m-reessayer").addEventListener("click", () => { stock.del(K.refus); erreur = ""; rendre(); charger(true); });
    return;
  }
  lireCache(); signalerCloche();
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
  const bandeau = SRC === "cache" ? '<div class="demo-band">' + (enCours ? "Mise à jour de ton fichier…" : erreur ? "Ton fichier n'a pas répondu (" + esc(String(erreur).replace(/\.$/, "")) + ") · chiffres de la dernière ouverture" + (ageCopie() ? " (" + ageCopie() + ")" : "") + "." : "Chiffres de la dernière ouverture · mise à jour…") + " <small>" + esc(M.majTexte || "") + "</small></div>" : "";
  v.innerHTML =
    '<div class="seg m-onglets" role="tablist" aria-label="Moi">' + ONGLETS.map(([k, l]) => '<button type="button" role="tab" data-m-ong="' + k + '" aria-pressed="' + (o === k) + '" aria-selected="' + (o === k) + '">' + l + "</button>").join("") + "</div>" +
    bandeau + (o === "jour" ? htmlAFaire() : "")   /* v17.2 (Théo) : plus de phrase-bilan ; les échéances passent dans la cloche */ +   /* v16.95 : calendrier unique des échéances */   // v16.87 : phrase-bilan + boîte unique « À faire » (ailleurs, la cloche suffit)
    ({ jour: M.simple ? htmlJourSimple : htmlJour, patrimoine: htmlPatrimoine, stats: htmlStats, missions: htmlMissions, artema: htmlArtema })[o]();
  v.querySelectorAll("[data-m-ong]").forEach(b => b.addEventListener("click", () => { PREF.onglet = b.dataset.mOng; garderPref(); rendre(); window.scrollTo(0, 0); }));
  brancherAFaire(v); brancherEcheances(v);
  v.querySelectorAll("details.acc[data-acc]").forEach(d => d.addEventListener("toggle", () => { PREF.acc[d.dataset.acc] = d.open; garderPref(); if (d.open && d.dataset.acc === "m-courbe") dessinerCourbe(); }));
  ({ artema: brancherArtema, jour: M.simple ? brancherJourSimple : brancherJour, patrimoine: brancherPatrimoine, stats: brancherStats, missions: brancherMissions })[o](v);
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
function modeSeance() { return PREF.seance === seanceDu() && seanceProposee(); }   // retenu pour CETTE séance seulement
/* V15.20 · le week-end : la semaine écoulée (lundi → vendredi) plutôt que la seule séance du vendredi */
function vueSemaine() { const j = new Date().getDay(); return j === 0 || j === 6; }
function libSeance() {
  const d = seanceDu(); if (!d) return ""; const x = new Date(d + "T12:00:00");
  if (vueSemaine()) { const l = new Date(x); l.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return frDate(isoJour(l)).slice(0, 5) + " → " + frDate(d).slice(0, 5); }
  return ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."][x.getDay()] + " " + frDate(d).slice(0, 5);
}
function mSeance(m) {
  const perf = m.perfLignes || {}, c = JSON.parse(JSON.stringify(m)), sem = vueSemaine(); c.__seance = true; let tot = 0;
  (c.groupes || []).forEach(g => {
    let j = 0;
    g.lignes.forEach(l => { if (l.especes) return; const p = perf[g.env + "|" + l.code];
      const v = p ? (sem ? p.s1 : p.seance) : null;   // week-end : variation sur 1 semaine (crypto comprise)
      if (typeof v === "number") { l.pct = v; l.jour = (l.valeur || 0) * v / (1 + v); } j += l.jour || 0; });
    if (g.total) { g.total.jour = j; const base = (g.total.valeur || 0) - j; g.total.pct = base ? j / base : 0; }
    tot += j;
  });
  const sy = c.synthese = Object.assign({}, c.synthese), base = (sy.valeur || 0) - tot;
  sy.jour = tot; sy.jourPct = base ? tot / base : 0; sy.jourLibelle = (sem ? "Sur la semaine · " : "Dernière séance · ") + libSeance();
  return c;
}
function htmlJour() {
  if (!modeSeance()) return htmlJourBase();
  const m0 = M; M = mSeance(m0);
  try { return htmlJourBase(); } finally { M = m0; }
}
function htmlJourBase() {
  const s = M.synthese || {};
  const texteFlap = ETAT.discret === "oui" ? "•••" + NB + "€" : eur(s.valeur);
  const animer = !reduit && texteFlap !== dernierFlap; dernierFlap = texteFlap;
  const suffixe = (s.jourLibelle || "").replace(/^Variation du jour\s*·?\s*/, "");
  const toutes = lignesTenues();
  const detail = PREF.lignes !== false;
  const tri = detail ? (PREF.tri || "env") : "env";
  const hausse = toutes.filter(l => l.pct > 1e-9).length, baisse = toutes.filter(l => l.pct < -1e-9).length;
  // carte du jour : une tuile par ligne, taille = poids dans le portefeuille, couleur = variation du jour
  const maxP = Math.max(.01, ...toutes.map(l => Math.abs(l.pct || 0)));
  const totalV = toutes.reduce((a, l) => a + (l.valeur || 0), 0) || 1;
  const carte = toutes.slice().sort((a, b) => (b.valeur || 0) - (a.valeur || 0)).map(l =>
    '<button type="button" class="m-tuile" data-aller-ligne="' + esc(l.env + "|" + l.code) + '" style="flex:' + Math.max(1, Math.round((l.valeur || 0) / totalV * 100)) + " 1 calc(" + Math.max(0, ((l.valeur || 0) / totalV * 100) - 2).toFixed(1) + '% - 3px);' + (Math.abs(l.pct || 0) > 1e-9 ? teinte(l.pct, maxP) : "") + '">' +
    "<b>" + esc(l.code) + "</b><span>" + pct(l.pct, 2) + "</span></button>").join("");
  // liste : par enveloppe (en-tête avec le jour de l'enveloppe) ou toutes ensemble triées
  let liste;
  if (tri === "env") {
    liste = (M.groupes || []).map((g, gi) => {
      const t = g.total || {};
      return '<div class="m-env" style="--ce:var(--e' + (gi % 5 + 1) + ')">' + enteteEnv(g.env, t.valeur, t.jour, t.pct, t.pv, t.pvPct) +
        (detail ? g.lignes.filter(l => !l.especes || Math.abs(l.valeur || 0) >= 0.5).map(l => ligneJour(Object.assign({ env: g.env }, l))).join("") : "") + "</div>";
    }).join("") + (detail ? "" : '<div class="m-env total">' + enteteEnv("Portefeuille", s.valeur, s.jour, s.jourPct, s.latente, s.latentePct) + "</div>");
  } else {
    const cle = { poids: l => -(l.valeur || 0), jour: l => -(l.pct || 0), pv: l => -(l.pvPct || 0) }[tri];
    liste = '<div class="m-env">' + toutes.slice().sort((a, b) => cle(a) - cle(b)).map(l => ligneJour(l, true)).join("") + "</div>";
  }
  const indices = (M.indices || []).filter(i => i.nom !== "1 USD en EUR");
  const nomIdx = n => n.replace(/\s*\((ETF\s)?([^)]*)\)/, "");
  return '<div class="m-hero">' +
      '<span class="eyebrow">' + embHero() + (modeSeance() ? (vueSemaine() ? "La semaine · " : "Dernière séance · ") + esc(libSeance()) : 'Bourse aujourd\'hui' + (!majCourte() && heureCours() ? " · " + esc(heureCours()) : "")) + "</span>" +
      (seanceProposee() ? '<button class="m-seance" type="button" id="m-seance" aria-pressed="' + modeSeance() + '">' + (modeSeance() ? "↩ Revenir à aujourd'hui" : vueSemaine() ? "📅 Voir la semaine (" + esc(libSeance()) + ")" : "🕘 Voir la dernière séance (" + esc(libSeance()) + ")") + "</button>" : "") +
      '<div class="m-flaps" role="img" aria-label="' + esc(texteFlap) + '">' + flaps(texteFlap, animer) + "</div>" +
      '<div class="m-jour"><span class="badge big-b ' + sens(s.jour) + '">' + fleche(s.jour) + " " + eur(s.jour, 0, true) + " · " + pct(s.jourPct, 2) + "</span>" +
        "<span>" + (suffixe ? esc(suffixe) : hausse + " en hausse · " + baisse + " en baisse") + "</span></div>" +
      (majCourte() ? '<small class="m-maj">' + esc(majCourte()) + "</small>" : "") +
    "</div>" +
    bandeDebut(s) +
    '<div class="m-carte" role="group" aria-label="Carte du jour : une tuile par ligne">' + carte + "</div>" +
    blocSignal() +
    "<div>" +
      '<div class="m-tri"><h2 class="sec">' + (detail ? "Mes lignes" : "Mes enveloppes") + "</h2>" +
        '<label class="m-coche"><input type="checkbox" id="m-detail"' + (detail ? " checked" : "") + "> Lignes</label>" +
        "</div>" +
      /* F (v16.93) : le tri se choisit par puces (un toucher au lieu d'une liste déroulante) */
      (detail ? '<div class="chips m-tri-p" role="group" aria-label="Classer les lignes">' + [["env", "Enveloppe"], ["jour", "Jour"], ["poids", "Montant"], ["pv", "Plus-value"]].map(([k, l]) => '<button class="chip" type="button" data-m-tri="' + k + '" aria-pressed="' + (tri === k) + '">' + l + "</button>").join("") + "</div>" : "") +
      liste +
      (detail ? '<p class="info" style="margin-top:6px">Touche une ligne pour ses performances et son prix de revient.</p>' : "") +
    "</div>" +
    (marchesMoi() ? htmlMarches() : indices.length ? '<div><h2 class="sec">Marchés <small>variation du jour</small></h2><div class="m-idx">' + indices.map(i => '<div><span>' + esc(nomIdx(i.nom)) + '</span><b class="' + sens(i.pct) + '">' + pct(i.pct, 2) + "</b></div>").join("") + "</div></div>" : "") +
    "";
}
function enteteEnv(nom, valeur, jour, jourPct, pv, pvPct) {
  return '<div class="m-env-h"><b>' + esc(nom) + '</b><span class="v">' + eur(valeur) + "</span>" +
    '<span class="pv ' + sens(pv) + '">PV ' + eur(pv, 0, true) + " · " + pct(pvPct) + '</span><span class="j ' + sens(jour) + '">' + eur(jour, 0, true) + " · " + pct(jourPct, 2) + "</span></div>";
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
function ligneJour(l, avecEnv) {
  if (l.especes) return '<div class="m-l especes"><div class="g"><b>Espèces</b></div><div class="d"><span class="v">' + eur(l.valeur) + "</span></div></div>";
  return '<div class="m-l" role="button" tabindex="0" aria-expanded="false" data-code="' + esc(l.code) + '" data-env="' + esc(l.env) + '">' +
    '<div class="g"><b>' + esc(l.code) + (avecEnv ? '<span class="tag">' + esc(String(l.env).split(" ")[0]) + "</span>" : "") + "</b><small>" + esc(l.nom || "") + "</small></div>" +
    '<div class="d"><span class="badge ' + sens(l.pct) + '">' + pct(l.pct, 2) + '</span><small class="' + sens(l.jour) + '">' + eur(l.jour, 0, true) + "</small></div>" +
    /* F (v16.93) : rangée du bas allégée (valeur · plus-value en %), le cours et le poids sont dans le détail */
    '<div class="b"><span>' + eur(l.valeur) + '</span><span class="' + sens(l.pv) + '">PV ' + pct(l.pvPct) + "</span></div>" +
    "</div>";
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
  const d = document.createElement("div");
  d.className = "m-ligne-det";
  d.innerHTML = '<div class="mini">' + m("1 semaine", p.s1) + m("1 mois", p.m1) + m("6 mois", p.m6) + m("Depuis janv.", p.ytd) + m("1 an", p.a1) +
    "<div><span>Cours</span><b>" + cours(l.cours) + "</b></div><div><span>Poids</span><b>" + pct(l.poids, 1, false) + "</b></div>" +
    "<div><span>Quantité × PRU</span><b>" + qte(l.qte) + " × " + cours(l.pru) + "</b></div>" + e("Plus-value", l.pv, true) +
    e("Coût de revient", pos.cout) + e("Plus-value réalisée", pos.pvr, true) + e("Frais payés", pos.frais) +
    '<p style="grid-column:1/-1;margin:0;font-size:12px;color:var(--ink-2)">' + (p.ticker ? "Performance du cours (" + esc(p.ticker) + "), indépendante de tes dates d'achat." : "Pas de cotation Google Finance pour cette ligne : performances du cours indisponibles.") + "</p>" +
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
  const bs = v.querySelector("#m-seance"); if (bs) bs.addEventListener("click", () => { PREF.seance = modeSeance() ? null : seanceDu(); garderPref(); dernierFlap = ""; rendre(); });
  v.querySelectorAll(".m-l[data-code]").forEach(el => {
    el.addEventListener("click", e => { if (!e.target.closest(".m-ligne-det")) basculerLigne(el); });
    el.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && e.target === el) { e.preventDefault(); basculerLigne(el); } });
  });
  v.querySelectorAll("[data-aller-ligne]").forEach(b => b.addEventListener("click", () => {
    const [env, code] = b.dataset.allerLigne.split("|");
    const el = Array.from(v.querySelectorAll(".m-l[data-code]")).find(x => x.dataset.env === env && x.dataset.code === code);
    if (!el) return;
    if (!el.querySelector(".m-ligne-det")) basculerLigne(el);
    el.scrollIntoView({ block: "center", behavior: reduit ? "auto" : "smooth" });
    el.classList.add("eclair"); setTimeout(() => el.classList.remove("eclair"), 1200);
  }));
  v.querySelectorAll("[data-m-tri]").forEach(b => b.addEventListener("click", () => { PREF.tri = b.dataset.mTri; garderPref(); garderPlace(b, rendre); }));
  const dt = v.querySelector("#m-detail"); if (dt) dt.addEventListener("change", () => { PREF.lignes = dt.checked; garderPref(); rendre(); });
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
  const rEp = r => { const t = /^Total/.test(r.nom);
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
    /* v16.87 (Théo) : l'assurance-vie Banque Populaire en premier, la bourse en second (elle est déjà sur Aujourd'hui), puis l'épargne et l'immobilier */
    (sup.length ? bloc("p-av", "--c-av", "Quintessa", "par support", htmlAV(sup)) : "") +
    bloc("p-bourse", "--s1", "Bourse", "portefeuille", liste(envs, rEnv)) +
    bloc("p-epargne", "--s2", "Épargne", esc(s.epargneLibelle || ""), liste(ep, rEp)) +
    (net.avecImmo ? bloc("p-immo", "--s3", "Immobilier", "prix d'achat, prêts restants", pretHtml() + liste(imm, rImm)) : "") +
    (fis.length ? acc("m-fis", "Si tout était retiré", "résultat net d'impôt estimé", liste(fis, rFis), false) : "") +
    htmlComparateur();   // v16.95 : où mettre le prochain euro
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
  if ((ar.initial === null || ar.initial === undefined || ar.initial === "") && !du("artemaInitial")) rdv.push(["📌", "Artema : niveau de départ de l'indice", rap("artemaInitial") ? "à saisir dès le " + frDate(rap("artemaInitial")) : "à saisir"]);
  if (rap("releve") && !du("releve")) rdv.push(["◷", "Relevé du mois (Artema)", quandRappel({ prochaine: rap("releve") }) || frDate(rap("releve"))]);
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
function aArtema() { return !!(M && (M.supports || []).some(r => /artema/i.test(r.nom || "") && (r.valeur || r.investi))); }
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
  if (s.etat === "attente") return "rien ne se passerait : on attendrait " + moisAn(ARTEMA.rdv[ARTEMA.rdv.findIndex(x => x[0] === s.ev) + 1][0]) + ", où le gain possible monte à <b" + (s.r >= ARTEMA.barriere ? ' class="up"' : "") + ">+" + pc1(s.prochainC) + NBS + "%</b>";
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
  else if (c === "v" && !s.fin) t += "<small>Remboursement anticipé automatique si l'indice est encore au moins à son départ ce jour-là. Sinon, le gain grossit de 9,5 points par année d'attente.</small>";
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
  return '<button type="button" class="art-lien" data-m-aller="artema" style="--c:' + COUL_AV.artema + '"><span><b>🎯 Suivi Artema</b><small>' + esc(txt) + "</small></span>" + mini + '<i aria-hidden="true">›</i></button>';
}
/* ---- ⑥ le simulateur « Et si ? » : un curseur, six rendez-vous, un seul calcul (issueArtema) ---- */
let artSim = { v: null, i: null, ouvert: false }, artCourbeTout = false, artTrois = false;
const SIM_MIN = 40, SIM_MAX = 150;
function zoneSim(v) { return v >= 100 ? 2 : v >= 60 ? 1 : 0; }
function resSim(E, v, i) {
  const r = v / 100, s = issueArtema(E, r, i), cl = s.etat === "arret" ? "v" : s.etat === "attente" ? "g" : s.etat === "capital" ? "o" : "r";
  const titre = { arret: "Artema s'arrête", attente: "Rien ne se passe, on attend l'an prochain (+9,5 pts)", capital: "Capital rendu (moins les frais)", perte: "Perte = baisse" }[s.etat];
  const k0 = Math.max(0, E.ip);
  const lignes = ARTEMA.rdv.map((x, k) => {
    const q = issueArtema(E, r, k), passe = k < k0;
    const val = passe ? "passé" : q.etat === "attente" ? "on attend" : "≈ " + e10(q.montant);
    return '<tr class="' + (passe ? "gris" : q.etat) + (k === i ? " on" : "") + '"><td>' + moisAn(x[0]) + (q.fin ? " · fin" : "") + "</td><td>" + val + "</td><td>" + (passe || q.etat === "attente" ? "" : g10(q.gain)) + "</td></tr>";
  }).join("");
  return '<div class="art-sres ' + cl + '"><div class="t">' + titre + '</div><div class="m"><b>' + (s.montant === null ? "—" : "≈ " + e10(s.montant)) + "</b>" +
    (s.montant === null ? "<small>prochain rendez-vous : " + moisAn(ARTEMA.rdv[i + 1][0]) + " (+" + pc1(s.prochainC) + " % possible)</small>" : "<small>" + g10(s.gain) + (s.tra !== null ? " · ≈ " + pct(s.tra, 1, false) + "/an" : "") + "</small>") + "</div>" +
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
  if (avantPhoto) rdvTxt = "<b>2, 3 et 4 décembre 2026</b> : photo de départ de l'indice. Ensuite, rien ne se passe jusqu'au premier rendez-vous, le 7 déc. 2029.";
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
    E.ech.map(e => '<tr class="' + (p && e.ev === p.ev ? "on" : "") + (e.ev < E.auj ? " passe" : "") + '"><td>' + moisAn(e.ev) + (e.fin ? " · fin" : "") + '</td><td class="up">+' + pc1(e.c) + " %</td><td>" + e10(e.montant) + "</td><td>≈ " + pct(e.tra, 1, false) + "</td></tr>").join("") +
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
    '<details class="art-d"><summary>Comment marche Artema ?</summary><div class="art-cas"><div><i>📸</i>Déc. 2026 : photo de départ de l\'indice (moyenne des clôtures du 2 au 4 décembre).</div><div><i>⏳</i>Jusqu\'en 2029 : rien ne se passe, la valeur bouge avec les marchés.</div><div><i>🎯</i>Chaque début décembre de 2029 à 2033 : si l\'indice est au moins à son départ → Artema s\'arrête (remboursement anticipé automatique), capital + gain. Le gain grossit de 9,5 points par année d\'attente.</div><div><i>🏁</i>1er décembre 2034 : au moins au départ → +76 % · entre −40 % et 0 → capital · sous 60 % du départ → perte égale à toute la baisse.</div><div><i>🙅</i>Rien à décider : sortir avant se fait au prix du marché (protection perdue).</div></div></details>' +
    '<div class="art-mentions">Montants estimés (tes parts, 0,80 %/an de frais du contrat), avant impôts et prélèvements sociaux. · L\'indice retire 50 points par an : il monte moins vite que la bourse, c\'est normal. · Capital soumis au risque de défaut de Natixis. · Fiscalité : rien à l\'arrêt d\'Artema, l\'argent reste dans le contrat.</div>' +
    "</div></div>";
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
const COUL_MK = ["#5B8DEF", "#2BB673", "#9B6BFF", "#E5484D", "#F2A33A", "#18A9C7", "#D6619E", "#C9A227", "#8C7B5A"];
let marcheOuvert = null, mkCaches = {};   // V15.19 : toutes les courbes affichées par défaut, or couvert compris
function marchesMoi() { const Dv = dVersus(); const m = Dv && Dv.marchesMoi; return m && (m.jour || []).length ? m : null; }
function htmlMarches() {
  const m = marchesMoi(), h = (m.jour.find(x => x.heure) || {}).heure;
  return '<div class="m-mk"><div class="m-mk-t"><h2 class="sec">Marchés <small>' + (h ? "cours du " + esc(h.replace(" ", " à ").replace(":", " h ")) + " · " : "") + "touche pour la courbe</small></h2>" +
    '<button class="mini-btn" type="button" data-mk="cmp" aria-pressed="' + (marcheOuvert === "cmp") + '">Comparer</button></div>' +
    '<div class="m-idx m-idx-mk">' + m.jour.map((x, i) => '<button type="button" data-mk="' + i + '" aria-pressed="' + (marcheOuvert === i) + '"><span>' + esc(x.nom) + '</span><b class="' + sens(x.pct) + '">' + (x.pct === null ? "—" : pct(x.pct, 2)) + "</b></button>").join("") + "</div>" +
    '<div class="m-mk-panneau" id="m-mk-panneau">' + panneauMarche() + "</div></div>";
}
function serieMk(nom) { const m = marchesMoi(); return m && (m.series || []).find(x => x.nom === nom); }
function varSur(v, n) { const f = v[v.length - 1], d = v[Math.max(0, v.length - 1 - n)]; return f && d ? f / d - 1 : null; }
function courbesSVG(lignes, base100) {
  const m = marchesMoi(), sem = m.semaines, W = 320, H = 150, g = 34, dr = 6, hb = 18;
  const pts = lignes.map(l => { const i0 = l.v.findIndex(x => x); return l.v.map(x => x && base100 ? x / l.v[i0] * 100 : x); });
  const tous = pts.flat().filter(x => x); if (!tous.length) return "";
  let lo = Math.min(...tous), hi = Math.max(...tous); const mg = (hi - lo) * .08 || 1; lo -= mg; hi += mg;
  const X = i => g + i * (W - g - dr) / Math.max(1, sem.length - 1), Y = v => 6 + (hi - v) / (hi - lo) * (H - 6 - hb);
  const fmt = v => base100 ? Math.round(v) : v >= 100 ? Math.round(v) : v.toFixed(v >= 10 ? 1 : 2);
  const mois = i => ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."][+sem[i].slice(5, 7) - 1] + " " + sem[i].slice(2, 4);
  const grille = [lo + mg, (lo + hi) / 2, hi - mg].map(v => '<line x1="' + g + '" x2="' + (W - dr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="gr"/><text x="' + (g - 4) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + fmt(v) + "</text>").join("");
  const b100 = base100 && lo < 100 && hi > 100 ? '<line x1="' + g + '" x2="' + (W - dr) + '" y1="' + Y(100).toFixed(1) + '" y2="' + Y(100).toFixed(1) + '" class="b100"/>' : "";
  const traits = pts.map((p, k) => '<path fill="none" stroke="' + lignes[k].c + '" stroke-width="' + (lignes.length > 1 ? 1.6 : 2.2) + '" stroke-linejoin="round" d="' + lisse(p.map((v, i) => v ? [X(i), Y(v)] : null).filter(Boolean)) + '"/>').join("");
  return '<svg class="m-mk-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(lignes.map(l => l.nom).join(", ")) + ' sur un an">' + grille + b100 + traits +
    '<text x="' + g + '" y="' + (H - 4) + '">' + mois(0) + '</text><text x="' + (W - dr) + '" y="' + (H - 4) + '" text-anchor="end">' + mois(sem.length - 1) + "</text></svg>";
}
function panneauMarche() {
  const m = marchesMoi(); if (!m || marcheOuvert === null || !(m.semaines || []).length) return "";
  if (marcheOuvert === "cmp") {
    const lignes = m.series.map((x, i) => ({ nom: x.nom, v: x.v, c: COUL_MK[i % COUL_MK.length] }));
    return '<div class="m-mk-chips">' + lignes.map(l => '<button type="button" class="chip" data-mk-cache="' + esc(l.nom) + '" aria-pressed="' + !mkCaches[l.nom] + '"><i style="background:' + l.c + '"></i>' + esc(l.nom) + " " + '<small class="' + sens(varSur(l.v, 52)) + '">' + pct(varSur(l.v, 52), 0) + "</small></button>").join("") + "</div>" +
      courbesSVG(lignes.filter(l => !mkCaches[l.nom]), true) + '<p class="info">Base 100 il y a un an, une valeur par semaine (ETF en euros ; « Or couvert € » suivi par le GLD en dollars). Touche un nom pour l\'afficher ou le masquer.</p>';
  }
  const j = m.jour[marcheOuvert], se = j && serieMk(j.nom); if (!se) return '<p class="info">Pas d\'historique pour ce marché.</p>';
  const c = COUL_MK[m.series.indexOf(se) % COUL_MK.length], t = (lab, n) => '<span>' + lab + ' <b class="' + sens(varSur(se.v, n)) + '">' + pct(varSur(se.v, n), 1) + "</b></span>";
  return '<div class="m-mk-res"><b>' + esc(j.nom) + "</b>" + t("1 mois", 4) + t("3 mois", 13) + t("1 an", 52) + "</div>" + courbesSVG([{ nom: se.nom, v: se.v, c: c }], false) +
    (/^Or/.test(j.nom) && serieMk("Or couvert €") ? '<p class="info">Couvert ou non ? <button class="lien" type="button" data-mk="cmp-or">Comparer l\'or couvert et non couvert</button></p>' : "");
}
function brancherMarches(v) {
  const z = v.querySelector(".m-mk"); if (!z) return;
  const maj = () => { const pn = z.querySelector("#m-mk-panneau"); pn.innerHTML = panneauMarche(); z.querySelectorAll("[data-mk]").forEach(b => b.setAttribute("aria-pressed", String(String(marcheOuvert) === b.dataset.mk))); };
  z.addEventListener("click", e => {
    const b = e.target.closest("[data-mk],[data-mk-cache]"); if (!b) return;
    if (b.dataset.mkCache) { const n = b.dataset.mkCache; mkCaches[n] = !mkCaches[n]; maj(); return; }
    const k = b.dataset.mk;
    if (k === "cmp-or") { marcheOuvert = "cmp"; mkCaches = {}; marchesMoi().series.forEach(x => { if (!/^Or/.test(x.nom)) mkCaches[x.nom] = true; }); maj(); return; }
    const val = k === "cmp" ? "cmp" : +k;
    marcheOuvert = marcheOuvert === val ? null : val; maj();
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
  brancherAV(v); brancherComparateur(v);
  v.querySelectorAll("[data-cible]").forEach(b => b.addEventListener("click", () => { const c = document.getElementById(b.dataset.cible); if (c) c.scrollIntoView({ block: "start", behavior: reduit ? "auto" : "smooth" }); }));
}

/* ================= Onglet Stats ================= */
const PERIODES_M = [["1m", "1 mois"], ["3m", "3 mois"], ["6m", "6 mois"], ["ytd", "Depuis janv."], ["1a", "1 an"], ["tout", "Tout"]];
function seriesDisponibles() {
  const noms = (M.enveloppes || []).filter(e => e.type === "env").map(e => e.nom);
  const cols = (M.historique || {}).cols || [];
  const out = [["ip", "Portefeuille"]];
  [["pea", /PEA/], ["cto", /CTO/], ["av", /^AV|Assurance/i], ["cr", /Crypto/i]].forEach(([k, re]) => { const n = noms.find(x => re.test(x)); if (n && cols.includes(k)) out.push([k, n]); });
  return out;
}
/** Valeur et apports : tout le portefeuille, ou une enveloppe quand le fichier en donne le détail */
function seriesValeur() { const cols = (M.historique || {}).cols || []; return seriesDisponibles().map(([k, l]) => k === "ip" ? ["", "Tout"] : [k, l]).filter(([k]) => !k || cols.includes("v_" + k)); }
function fenetre(rows, per) {
  if (!rows.length || per === "tout") return rows;
  const fin = dateNum(rows[rows.length - 1][0]);
  const nm = ({ "1m": 1, "3m": 3, "6m": 6, "1a": 12 }[per] || 6), mDeb = new Date(fin.getFullYear(), fin.getMonth() - nm, 1);
  /* v16.83 : le 31 mai − 3 mois = le 28/29 février (et non le 3 mars) : jour borné au dernier jour du mois visé */
  const debut = per === "ytd" ? new Date(fin.getFullYear() - 1, 11, 31) : new Date(mDeb.getFullYear(), mDeb.getMonth(), Math.min(fin.getDate(), new Date(mDeb.getFullYear(), mDeb.getMonth() + 1, 0).getDate()));
  const cle = debut.getFullYear() * 10000 + (debut.getMonth() + 1) * 100 + debut.getDate();
  let i0 = 0; rows.forEach((r, i) => { if (r[0] <= cle) i0 = i; });
  return rows.slice(i0);
}
function htmlStats() {
  const h = M.historique, envs = M.enveloppes || [];
  const mode = PREF.mode, per = PREF.per, choix = seriesDisponibles();
  const derniere = h && h.rows && h.rows.length ? dateNum(h.rows[h.rows.length - 1][0]) : null;
  const perfLigne = e => '<tr class="' + (e.type === "indice" ? "indice" : "") + '"><td>' + esc(e.nom) + "</td>" +
    ["s1", "m1", "m6", "ytd", "a1", "twr", "mwr"].map(k => '<td class="' + (e.type === "indice" ? "" : sens(e[k])) + '">' + pct(e[k]) + "</td>").join("") + "<td>" + pct(e.vol, 1, false) + "</td></tr>";
  const courbe = h && h.rows && h.rows.length > 1 ?
    '<div class="seg" role="group" aria-label="Type de courbe"><button type="button" data-m-mode="valeur" aria-pressed="' + (mode === "valeur") + '">Valeur et apports</button><button type="button" data-m-mode="base" aria-pressed="' + (mode === "base") + '">Performance vs indices</button></div>' +
    (mode === "valeur" && seriesValeur().length > 1 ? '<div class="chips" role="group" aria-label="Enveloppe">' + seriesValeur().map(([k, l]) => '<button class="chip" type="button" data-m-envv="' + k + '" aria-pressed="' + ((PREF.envV || "") === k) + '">' + esc(l) + "</button>").join("") + "</div>" : "") +
    (mode === "base" && choix.length > 1 ? '<div class="chips" role="group" aria-label="Ce que tu compares">' + choix.map(([k, l]) => '<button class="chip" type="button" data-m-serie="' + k + '" aria-pressed="' + (PREF.serie === k) + '">' + esc(l) + "</button>").join("") + "</div>" : "") +
    '<div class="chips" role="group" aria-label="Période">' + PERIODES_M.map(([k, l]) => '<button class="chip" type="button" data-m-per="' + k + '" aria-pressed="' + (per === k) + '">' + l + "</button>").join("") + "</div>" +
    '<div id="m-courbe-box"></div><p class="resume" id="m-resume"></p>' : '<div class="vide">Pas encore assez de relevés pour tracer une courbe.</div>';
  const pf = envs.find(e => e.type === "total") || envs[0] || {};
  const resume = ["m1", "ytd", "twr"].map((k, i) => '<span>' + ["1 mois", "janv.", "début"][i] + ' <b class="' + sens(pf[k]) + '">' + pct(pf[k]) + "</b></span>").join("");
  /* C (v16.93) : Stats s'ouvre sur la courbe ; « En ce moment » ne garde que ce qui n'est pas ailleurs */
  return '<div><h2 class="sec">Courbe <small>' + (derniere ? "relevé du " + dateLongue(derniere) : "") + "</small></h2></div>" + courbe +
    htmlProjection() +   /* v16.95 : projection 2034, sous la courbe */
    blocEnCours() + blocJours() +
    '<details class="acc m-compact" data-acc="m-perf"' + (PREF.acc["m-perf"] ? " open" : "") + '><summary><span class="t">Performances</span><span class="m-cp-r">' + resume + "</span></summary>" +
      '<div><div class="scroll-x"><table class="tab m-perf-t"><thead><tr><th>Enveloppe</th><th>1 sem.</th><th>1 mois</th><th>6 mois</th><th>Janv.</th><th>1 an</th><th>Début</th><th>MWR</th><th>Vol.</th></tr></thead><tbody>' + envs.map(perfLigne).join("") + "</tbody></table></div></div></details>" +
    blocPatrimoineTemps() + blocEpargneTemps() + blocPret() +
    (M.simple ? blocMois() : blocRisque() + blocMois() + blocRepartition() + blocFrais());
}
function dessinerCourbe() {
  const zone = document.getElementById("m-courbe-box"); if (!zone) return;
  const h = M.historique; if (!h || !h.rows || h.rows.length < 2) return;
  const C = n => h.cols.indexOf(n);
  const rows = fenetre(h.rows, PREF.per), mc = couleurMoi(), cb = defObj("courbe", actifM("courbe")) || COURBES_M[0];
  let series;
  if (PREF.mode === "valeur") {
    const ev = seriesValeur().find(x => x[0] && x[0] === PREF.envV), kv = ev ? "_" + ev[0] : "";
    series = [{ nom: ev ? "Valeur · " + ev[1] : "Valeur", k: C(kv ? "v" + kv : "v"), c: cb[2] || mc, w: 2.2, aire: true, fx: cb[3] }, { nom: ev ? "Versé · " + ev[1] : "Apports cumulés", k: C(kv ? "a" + kv : "a"), c: "var(--idx)", w: 1.6, marche: true, dash: true }];
  } else {
    const ch = seriesDisponibles().find(x => x[0] === PREF.serie) || ["ip", "Portefeuille"];
    series = [{ nom: ch[1], k: C(ch[0]) >= 0 ? C(ch[0]) : C("ip"), c: cb[2] || mc, w: 2.2, base: true, fx: cb[3] },
      { nom: "S&P 500", k: C("isp"), c: "var(--idx)", w: 1.6, base: true, dash: "5 4" },
      { nom: "Nasdaq-100", k: C("inq"), c: "var(--gold)", w: 1.6, base: true, dash: "1.5 3.5" }];
  }
  series = series.filter(s => s.k >= 0);
  series.forEach(s => { const b = (rows.find(r => ok(r[s.k]) && r[s.k] !== 0) || [])[s.k] || 1; s.v = rows.map(r => ok(r[s.k]) ? (s.base ? r[s.k] / b - 1 : r[s.k]) : null); });
  zone.innerHTML = boiteGraphe("g-moi", series.map(s => ({ nom: s.nom, c: s.c, dash: s.dash === "1.5 3.5" ? "dot" : !!s.dash })));
  const court = PREF.per === "1m";
  const etiqX = (k, kp) => {
    if (kp === null) return "";
    const d = dateNum(k), p = dateNum(kp);
    if (court) return d.getDay() < p.getDay() ? dateCourte(d) : "";
    return d.getMonth() !== p.getMonth() ? (d.getMonth() === 0 ? String(d.getFullYear()) : MOIS[d.getMonth()]) : "";
  };
  const base = PREF.mode === "base";
  tracer(document.getElementById("g-moi"), { x: rows.map(r => r[0]), zeroMin: !base, base, finEtiq: base,
    series: series.map(s => ({ nom: s.nom, v: s.v, c: s.c, w: s.w, aire: s.aire, marche: s.marche, dash: s.dash, fx: s.fx })),
    fmt: base ? (x => pct(x)) : (x => eur(x)), fmtAxe: base ? (t => pct(t, 0)) : axeEur, titreX: k => dateLongue(dateNum(k)), etiqX });
  const n = rows.length, d0 = dateNum(rows[0][0]), d1 = dateNum(rows[n - 1][0]);
  const r = document.getElementById("m-resume");
  if (!base) {
    const i0 = Math.max(0, series[0].v.findIndex(x => ok(x))), d0b = dateNum(rows[i0][0]);
    const dv = (series[0].v[n - 1] || 0) - (series[0].v[i0] || 0), da = series[1] ? (series[1].v[n - 1] || 0) - (series[1].v[i0] || 0) : 0;
    r.innerHTML = "Du " + dateLongue(d0b) + " au " + dateLongue(d1) + " : valeur <b>" + eur(dv, 0, true) + "</b>, dont apports <b>" + eur(da, 0, true) + '</b>, soit un gain de <b class="' + sens(dv - da) + '">' + eur(dv - da, 0, true) + "</b>.";
  } else {
    const p = series[0].v[n - 1], sp = series[1] ? series[1].v[n - 1] : null;
    r.innerHTML = "Du " + dateLongue(d0) + " au " + dateLongue(d1) + ' : <b class="' + sens(p) + '">' + pct(p) + "</b>" +
      (ok(sp) ? ", S&amp;P 500 <b>" + pct(sp) + '</b>, écart <b class="' + sens(p - sp) + '">' + pts(p - sp) + "</b>" : "") + ". Indices rebasés au début de la période, apports neutralisés.";
  }
}
function blocRisque() {
  const h = M.historique; if (!h || !h.rows || h.rows.length < 2) return "";
  const k = h.cols.indexOf("ip"); if (k < 0) return "";
  let max = -Infinity, dateMax = null, pire = 0, datePire = null, dateHaut = null;
  h.rows.forEach(r => { if (r[k] > max) { max = r[k]; dateMax = r[0]; } const dd = r[k] / max - 1; if (dd < pire) { pire = dd; datePire = r[0]; dateHaut = dateMax; } });
  const actuel = h.rows[h.rows.length - 1][k] / max - 1;
  const pf = (M.enveloppes || []).find(e => e.type === "total") || {}, sp = (M.synthese || {}).sp500;
  const dc = n => dateCourte(dateNum(n)) + "/" + String(n).slice(2, 4);
  return acc("m-risque", "Risque", "portefeuille, relevés du soir", '<div class="tuiles">' +
    tuile("Baisse actuelle", pct(actuel), sens(actuel), actuel > -0.0005 ? "au plus haut" : "depuis le plus haut du " + dc(dateMax)) +
    tuile("Pire baisse", pct(pire), "down", datePire ? "du " + dc(dateHaut) + " au " + dc(datePire) : "—") +
    tuile("Volatilité 1 an", pct(pf.vol, 1, false), "", "écart type annualisé") +
    tuile("Sharpe 1 an", ok(pf.sharpe) ? F2.format(pf.sharpe) : "—", sens(pf.sharpe), "rendement / risque, &gt; 1 = bon", "Sharpe : le rendement obtenu pour le risque pris. Plus c'est haut, mieux c'est.") +
    tuile("Jours en hausse", pct(pf.hausse, 0, false), "", "sur les 12 derniers mois") +
    tuile("Écart avec le S&amp;P 500", ok(pf.twr) && ok(sp) ? pts(pf.twr - sp) : "—", sens(pf.twr - sp), "depuis le début (TWR)") +
    "</div>", false);
}
function joursRecords() {
  const h = M.historique; if (!h || !h.rows || h.rows.length < 2) return [];
  const ki = h.cols.indexOf("ip"), kv = h.cols.indexOf("v"), ka = h.cols.indexOf("a"), out = [];
  // 14.4.2 : seuls comptent les jours où le portefeuille valait au moins la moitié de sa valeur actuelle
  // (les % des débuts, sur quelques centaines d'euros, ne sont pas comparables) ; se recale seul après un gros versement
  const actuel = h.rows[h.rows.length - 1][kv], seuil = actuel > 0 ? actuel / 2 : 0;
  for (let i = 1; i < h.rows.length; i++) {
    const a = h.rows[i - 1], b = h.rows[i];
    if ((dateNum(b[0]) - dateNum(a[0])) / 864e5 > 4.5 || !(a[ki] > 0) || !(b[ki] > 0)) continue;
    if (!(a[kv] >= seuil) || !(b[kv] >= seuil)) continue;
    out.push({ j: b[0], p: b[ki] / a[ki] - 1, e: (b[kv] - a[kv]) - (b[ka] - a[ka]) });
  }
  return out;
}
/* « En ce moment » : ce qui avance ce mois-ci (série de versements, prochain jalon). C (v16.93) : palier et vestiaire sont dans Missions */
function blocEnCours() {
  const t = [], now = new Date(), mo = MOIS_L[now.getMonth()], finM = new Date(now.getFullYear(), now.getMonth() + 1, 0), discret = ETAT.discret === "oui";
  const tuile = (k, big, small, cls, aller) => t.push('<' + (aller ? 'button type="button" data-m-aller="' + aller + '"' : "div") + ' class="m-ec-t' + (cls ? " " + cls : "") + '"><span class="k">' + k + "</span><b>" + big + "</b><small>" + small + "</small></" + (aller ? "button" : "div") + ">");
  try {
    const sv = serieVersements();
    if (sv.liste.length) tuile("Versements d'affilée", sv.actuelle + " mois", "record " + sv.record + "<br>" + (sv.moisEnCours ? '<span class="up">' + esc(mo) + " fait ✓</span>" : '<span class="warn">' + esc(mo) + " : pas encore (jusqu'au " + dateCourte(finM) + ")</span>"), sv.moisEnCours ? "ok" : "attente");
  } catch (e) { /* pas de parcours : tuile absente */ }
  try {
    const P = paramsMillion(), j = JALONS.concat([CIBLE]).find(x => x > P.v);
    if (j) tuile("Prochain jalon", discret ? "•••" : F0.format(j / 1000) + NB + "000 €", discret ? "cap sur le million · privé" : "encore " + eur(j - P.v), "", "missions");
  } catch (e) { /* idem */ }
  return t.length ? '<div><h2 class="sec">En ce moment <small>' + esc(mo) + " " + now.getFullYear() + '</small></h2></div><div class="m-ec">' + t.join("") + "</div>" : "";
}
function blocJours() {
  const l = joursRecords(); if (l.length < 5) return "";
  const tri = l.slice().sort((x, y) => y.p - x.p), best = tri.slice(0, 5), pire = tri.slice(-5).reverse();
  const date = j => dateLongue(dateNum(j));
  const liste = (titre, xs) => "<div><b>" + titre + "</b>" + xs.map((x, i) => '<div class="l"><span>' + (i + 1) + ". " + date(x.j) + '</span><span class="' + sens(x.p) + '">' + pct(x.p, 2) + '</span><span class="' + sens(x.e) + '">' + eur(x.e, 0, true) + "</span></div>").join("") + "</div>";
  const pastille = (lib, x, cls) => '<span class="m-jc-p ' + cls + '"><i>' + lib + '</i><b>' + pct(x.p, 2) + "</b><small>" + dateCourte(dateNum(x.j)) + "/" + String(x.j).slice(2, 4) + " · " + eur(x.e, 0, true) + "</small></span>";
  return '<details class="acc m-compact m-jc" data-acc="m-jours"' + (PREF.acc["m-jours"] ? " open" : "") + "><summary>" + pastille("▲ Meilleur jour", best[0], "up") + pastille("▼ Pire jour", pire[0], "down") + "</summary>" +
    '<div><div class="m-jr">' + liste("Top 5", best) + liste("Flop 5", pire) + "</div>" +
    '<p class="info">Sur ' + l.length + " jours de bourse depuis le " + dateLongue(dateNum(l[0].j)) + ", classés en performance (sans l'effet de tes versements). Seuls comptent les jours où ton portefeuille valait au moins la moitié de sa valeur actuelle : après un gros versement, la période se recale toute seule.</p></div></details>";
}
function moisParMois() {
  const h = M.historique; if (!h || !h.rows || h.rows.length < 2) return [];
  const kv = h.cols.indexOf("v"), ka = h.cols.indexOf("a"), ki = h.cols.indexOf("ip");
  const fins = [];
  h.rows.forEach((r, i) => { const m = Math.floor(r[0] / 100), s = h.rows[i + 1]; if (!s || Math.floor(s[0] / 100) !== m) fins.push(r); });
  let prec = null;
  return fins.map(r => {
    const twr = prec ? r[ki] / prec[ki] - 1 : r[ki] / h.rows[0][ki] - 1;
    const eurM = prec ? (r[kv] - prec[kv]) - (r[ka] - prec[ka]) : r[kv] - r[ka];
    prec = r;
    return { an: Math.floor(r[0] / 10000), mois: Math.floor(r[0] / 100) % 100, twr, eur: eurM };
  });
}
function blocMois() {
  const m = moisParMois(); if (!m.length) return "";
  const enEur = PREF.moisMode === "eur";
  const ans = Array.from(new Set(m.map(x => x.an))).sort().reverse();
  const maxP = Math.max(.04, ...m.map(x => Math.abs(x.twr))), maxE = Math.max(500, ...m.map(x => Math.abs(x.eur)));
  const lignes = ans.map(an => {
    const ms = m.filter(x => x.an === an);
    const tot = ms.reduce((p, x) => p * (1 + x.twr), 1) - 1, totE = ms.reduce((p, x) => p + x.eur, 0);
    return '<tr><td class="nom">' + an + "</td>" + MOIS.map((nm, i) => {
      const x = ms.find(y => y.mois === i + 1);
      if (!x) return '<td class="vide">·</td>';
      const det = esc("<b>" + MOIS_L[i] + " " + an + "</b> : " + pct(x.twr) + " (TWR) · résultat " + eur(x.eur, 0, true));
      return '<td class="m-c" tabindex="0" style="' + teinte(enEur ? x.eur : x.twr, enEur ? maxE : maxP) + '" data-cel="' + det + '">' + (enEur ? kEur(x.eur) : pct(x.twr)) + "</td>";
    }).join("") + '<td style="' + teinte(enEur ? totE : tot, enEur ? maxE * 3 : maxP * 3) + '"><b>' + (enEur ? kEur(totE) : pct(tot)) + "</b></td></tr>";
  }).join("");
  return '<div><h2 class="sec">Mois par mois <small>' + (enEur ? "résultat en euros" : "TWR, sans l'effet des versements") + "</small></h2></div>" +
    '<div class="seg" role="group" aria-label="Unité"><button type="button" data-m-mois="pct" aria-pressed="' + !enEur + '">Performance (%)</button><button type="button" data-m-mois="eur" aria-pressed="' + enEur + '">Résultat (€)</button></div>' +
    '<div class="scroll-x"><table class="grille"><thead><tr><th></th>' + MOIS.map(x => "<th>" + x + "</th>").join("") + "<th>Année</th></tr></thead><tbody>" + lignes + "</tbody></table></div>" +
    '<p class="resume" id="m-mois-sel">Touche un mois pour le détail.</p>';
}
function blocRepartition() {
  const rep = PREF.rep || "classe";
  const actifs = (M.ref || {}).actifs || [];
  const info = c => actifs.find(a => a.code === c) || {};
  const cle = { classe: l => info(l.code).classe || "Non classé", zone: l => info(l.code).zone || "Non renseignée", ligne: l => l.code, levier: l => { const v = Number(info(l.code).levier) || 1; return v > 1 ? "Levier ×" + v : "Sans levier"; } }[rep] || (l => l.code);
  const groupes = {};
  (M.groupes || []).forEach(g => g.lignes.forEach(l => { if (!l.especes && l.valeur > 0) { const k = cle(l); groupes[k] = (groupes[k] || 0) + l.valeur; } }));
  const tot = Object.values(groupes).reduce((a, b) => a + b, 0) || 1;
  const tri = Object.entries(groupes).sort((a, b) => b[1] - a[1]);
  if (!tri.length) return "";
  const max = tri[0][1];
  return '<div><h2 class="sec">Répartition <small>lignes du portefeuille</small></h2></div>' +
    '<div class="chips" role="group" aria-label="Répartir par">' + [["classe", "Classe"], ["zone", "Zone"], ["ligne", "Ligne"], ["levier", "Levier"]].map(([k, l]) => '<button class="chip" type="button" data-m-rep="' + k + '" aria-pressed="' + (rep === k) + '">' + l + "</button>").join("") + "</div>" +
    '<div class="m-rep">' + tri.map(([k, v]) => '<div><span class="n">' + esc(k) + '</span><span class="b"><i style="width:' + (v / max * 100).toFixed(1) + '%"></i></span><span class="p">' + pct(v / tot, 1, false) + '</span><span class="e">' + eur(v) + "</span></div>").join("") + "</div>";
}
function blocFrais() {
  const f = M.frais || []; if (!f.length) return "";
  const tot = f.find(r => /^Total/.test(r.nom));
  return acc("m-frais", "Frais payés", tot ? eur(tot.total, 0) + " au total" : "courtage, gestion", '<div class="m-liste">' +
    f.map(r => '<div class="r' + (/^Total/.test(r.nom) ? " total" : "") + '"><span class="a">' + esc(r.nom) + '</span><span class="b">' + eur(r.total, 2) + "</span>" +
      '<span class="c">cette année ' + eur(r.annee, 2) + '</span><span class="d">' + pct(r.pct, 2, false) + " des versements</span></div>").join("") + "</div>", false);
}
function brancherStats(v) {
  brancherDefs(v);
  v.querySelectorAll("[data-m-aller]").forEach(b => b.addEventListener("click", () => { PREF.onglet = b.dataset.mAller; garderPref(); rendre(); window.scrollTo(0, 0); }));
  const re = b => garderPlace(b, rendre);
  v.querySelectorAll("[data-m-mode]").forEach(b => b.addEventListener("click", () => { PREF.mode = b.dataset.mMode; garderPref(); re(b); }));
  v.querySelectorAll("[data-m-per]").forEach(b => b.addEventListener("click", () => { PREF.per = b.dataset.mPer; garderPref(); re(b); }));
  v.querySelectorAll("[data-m-serie]").forEach(b => b.addEventListener("click", () => { PREF.serie = b.dataset.mSerie; garderPref(); re(b); }));
  v.querySelectorAll("[data-m-envv]").forEach(b => b.addEventListener("click", () => { PREF.envV = b.dataset.mEnvv; garderPref(); re(b); }));
  v.querySelectorAll("[data-m-mois]").forEach(b => b.addEventListener("click", () => { PREF.moisMode = b.dataset.mMois; garderPref(); re(b); }));
  v.querySelectorAll("[data-m-rep]").forEach(b => b.addEventListener("click", () => { PREF.rep = b.dataset.mRep; garderPref(); re(b); }));
  v.querySelectorAll("td[data-cel]").forEach(td => {
    const f = () => { v.querySelectorAll("td.m-c.sel").forEach(x => x.classList.remove("sel")); td.classList.add("sel"); v.querySelector("#m-mois-sel").innerHTML = td.dataset.cel; };
    td.addEventListener("click", f); td.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); f(); } });
  });
  const g = v.querySelector(".grille"); if (g) { const sx = g.closest(".scroll-x"); if (sx) sx.scrollLeft = sx.scrollWidth; }
  v.querySelectorAll("[data-m-patri]").forEach(b => b.addEventListener("click", () => { PREF.patri = b.dataset.mPatri; garderPref(); re(b); }));
  v.querySelectorAll("[data-m-patridet]").forEach(b => b.addEventListener("click", () => { PREF.patriDet = b.dataset.mPatridet; garderPref(); re(b); }));
  dessinerCourbe(); dessinerPatrimoine(); dessinerEpargne(); dessinerPret();
  brancherProjection(v);
}

/* ================= Signal levier Nasdaq (repris tel quel de Cote V5.6 : mêmes données, mêmes règles, mêmes textes) ================= */
let signalOuvert = false;
function blocSignal() {
  const g = M.signal;
  if (!g || !g.position) return "";
  const NNBSP = NB;
  const cls = !g.expose ? "hors" : g.reduit ? "x1" : g.creux ? "creux" : "x2";
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
  const xa = g.arbitrage || {}, xj = g.jauges || {};
  const n1 = v => v === null || v === undefined || !isFinite(v) ? "—" : F1.format(v);
  const n2 = v => v === null || v === undefined || !isFinite(v) ? "—" : F2.format(v);
  const nS = v => Number.isInteger(v) ? F0.format(v) : F1.format(v);
  const sg = v => v === null || v === undefined || !isFinite(v) ? "—" : (v >= 0 ? "+" : MOINS) + F1.format(Math.abs(v));
  const auj = t => " <b>Aujourd'hui : " + t + ".</b>";
  const VH = g.volHaut || 30, VB = g.volBas || 25, BANDE = g.bande || 5, EMAS = g.emaSem || 45;
  const TCTO = g.tauxCTO || 31.4, TPEA = g.tauxPEA || 18.6, HPEA = g.horizonPEA || 15, HCTO = xa.H || 1.2, PENTE = g.penteAns || 5;
  const SMA = xj.smaLen || 150, ECART = Math.abs(xj.seuilEcart === undefined ? -10 : xj.seuilEcart);
  const levierAuj = !g.expose ? "cash au PEA" + (g.positionCTO ? ", or au CTO" : "") : g.reduit ? "×1" : g.creux ? "×2 (position creux, exemptée)" : "×2 au PEA" + (g.positionCTO ? ", ×3 au CTO" : "");
  const EX = {
    distance: "Écart entre le Nasdaq-100 (dernière clôture) et le seuil qui déclencherait un ordre. En position, ce seuil est la vente : la moyenne mobile " + EMAS + " semaines (EMA) moins " + nS(BANDE) + " %" +
      (g.bandeSortie ? ", soit " + F0.format(g.bandeSortie) + " points" : "") + ". Hors marché, c'est la distance au seuil d'achat (l'EMA" + (g.ema ? ", " + F0.format(g.ema) + " points" : "") + ") : un chiffre négatif veut dire qu'il est encore en dessous." +
      (g.distance !== null && g.distance !== undefined ? auj(sg(g.distance) + " %, " + (g.creux ? "avant le relais par l'EMA" : g.expose ? "le Nasdaq peut encore baisser d'environ " + n1(Math.max(0, g.distance)) + " % avant un signal de vente" : "il doit encore monter d'environ " + n1(Math.max(0, -g.distance)) + " % pour un signal d'achat") + (g.zoneTendance ? " · zone d'alerte" : "")) : ""),
    vol: "Amplitude des variations quotidiennes du Nasdaq sur les 20 dernières séances, ramenée à l'année. Au-dessus de " + nS(VH) + " %, la règle passe en ×1, parce qu'un ETF à levier perd beaucoup quand le marché secoue. Elle ne revient au levier que sous " + nS(VB) + " %, pour éviter les allers-retours. Un marché calme est autour de 15 à 20 %." +
      (g.vol20 !== null && g.vol20 !== undefined ? auj(n1(g.vol20) + " %, levier " + levierAuj + (g.zoneVol ? " · zone d'alerte, proche de " + nS(VH) + " %" : "")) : ""),
    depuis: "Date du dernier changement d'exposition (entrée en position ou sortie du marché) et variation du Nasdaq depuis cette date. Une bascule ×2 ↔ ×1 ne remet pas ce compteur à zéro." +
      (g.depuis ? auj((g.expose ? "en position" : "hors marché") + " depuis le " + frDate(g.depuis) + " (" + g.joursDepuis + " j)" + (g.expose && g.perfDepuis !== null && g.perfDepuis !== undefined ? ", Nasdaq " + sg(g.perfDepuis) + " %" : "")) : ""),
    cto: "Ce que la même règle dit pour le compte-titres, le même jour que le PEA : QQQ3 (×3) en position, Nasdaq-100 ×1 quand l'alarme de volatilité est allumée (au-dessus de " + nS(VH) + " %), or quand le signal est hors marché (au lieu du cash du PEA). Au CTO, chaque bascule est une vente imposée à " + nS(TCTO) + " % sur la plus-value." +
      (g.positionCTO ? auj(esc(g.positionCTO) + (g.ordreCTO && g.ordreCTO !== "Aucun" ? " · ordre : " + esc(g.ordreCTO) : ", aucun ordre")) : ""),
    apport: "Où placer l'argent nouveau du mois selon la formule d'espérance du Pine : ×1 (ETF Nasdaq au PEA), ×2 (LQQ au PEA)" + (xa.cto ? " ou ×3 (QQQ3 au CTO)" : "") + ", après impôt. Ça ne change rien à ce que tu détiens déjà : c'est seulement pour le nouvel argent." +
      (xa.optimal ? auj(g.expose ? "×" + xa.optimal + (xa.avance !== undefined ? ", avec " + n1(xa.avance) + " pt/an d'avance sur le deuxième choix" + (xa.avance < 1 ? " (les deux se valent)" : "") : "") : "hors marché, pas d'apport en actions") : ""),
    verdict: "Le levier qui donne le meilleur rendement attendu après impôt avec la croissance (μ), la volatilité (σ) et le taux (r) du jour. « Avance » = écart avec le deuxième meilleur choix : sous 1 point par an, les deux se valent. Hors marché, la règle prime : pas d'apport en actions (cash au PEA" + (g.positionCTO ? ", or au CTO" : "") + ")." +
      (xa.optimal ? auj(g.expose ? "×" + xa.optimal + (xa.avance !== undefined ? ", avance " + n1(xa.avance) + " pt/an" : "") : "hors marché") : ""),
    donnees: "μ : croissance annuelle de fond du Nasdaq, mesurée par la pente des " + PENTE + " dernières années, dividendes compris. C'est l'hypothèse la plus fragile : elle est au plus haut juste avant les retournements (fin 1999, fin 2021). σ : volatilité du Nasdaq sur un an. Plus elle est haute, plus le levier perd (le coût grimpe avec le carré du levier). r : taux directeur de la Fed (FRED, DFF). C'est le coût d'emprunt payé par les ETF à levier sur la part empruntée : une fois sur un ×2, deux fois sur un ×3." +
      (xa.mu !== undefined ? auj("μ " + n1(xa.mu) + " %, σ " + n1(xa.sigma) + " %, r " + n2(xa.taux) + " %" + (xa.tauxSource === "secours" ? " (taux de secours : FRED illisible)" : "")) : ""),
    net: "Rendement annuel attendu de chaque option si μ, σ et r restaient constants, frais et impôts déduits. PEA : " + nS(TPEA) + " % prélevés une seule fois à la sortie (horizon " + HPEA + " ans)." + (xa.cto ? " CTO : " + nS(TCTO) + " % sur la plus-value à chaque vente, environ tous les " + n1(HCTO) + " an au rythme de la stratégie." : "") + " Ces chiffres servent à comparer les options entre elles, pas à prévoir ton rendement." +
      (xa.rendX1 !== undefined ? auj("×1 " + sg(xa.rendX1) + " %, ×2 " + sg(xa.rendX2) + " %" + (xa.cto ? ", ×3 " + sg(xa.rendX3) + " %" : "") + " par an") : ""),
    x21: "Gain (ou perte) annuel attendu du LQQ ×2 par rapport à un Nasdaq sans levier, au PEA. ✓ = le ×2 vaut le coup. « Taux max » = taux de la Fed au-delà duquel le ×2 ne battrait plus le ×1." +
      (xa.ecart !== undefined ? auj((xa.ecart > 0 ? "le ×2 rapporte " : "le ×2 coûte ") + n1(Math.abs(xa.ecart)) + " pt/an " + (xa.ecart > 0 ? "de plus" : "de moins") + " que le ×1" + (xa.tauxMax !== undefined ? (xa.tauxMax < 0 ? ", quel que soit le taux" : xa.tauxMax >= 50 ? ", même avec un taux à 50 %" : ", tant que le taux de la Fed reste sous " + n1(xa.tauxMax) + " % (il est à " + n2(xa.taux) + " %)") : "")) : ""),
    x32: "Le QQQ3 ×3 au CTO face au LQQ ×2 au PEA, impôts compris. ✓ = le ×3 rapporterait plus malgré l'impôt du CTO. « Taux max » = taux de la Fed au-delà duquel le ×3 perd (« aucun » = il perd même à taux zéro, à cause de l'impôt). « σ ≤ … » = volatilité au-dessus de laquelle le ×3 perd au taux actuel." +
      (xa.ecart32 !== undefined ? auj((xa.ecart32 > 0 ? "le ×3 rapporte " : "le ×3 coûte ") + n1(Math.abs(xa.ecart32)) + " pt/an " + (xa.ecart32 > 0 ? "de plus" : "de moins") + " que le ×2" + (xa.sigmaMax3 !== undefined && xa.sigmaMax3 >= 0 && xa.sigmaMax3 < 100 ? " · seuil de volatilité " + n1(xa.sigmaMax3) + " % (σ actuelle " + n1(xa.sigma) + " %)" : "")) : ""),
    museuil: "Croissance annuelle minimale du Nasdaq pour que le ×3 batte le ×2. Brut = sans impôt ; net = en comptant l'impôt du CTO (" + nS(TCTO) + " %) à chaque vente et celui du PEA (" + nS(TPEA) + " %) à la sortie. ✓ si la pente des " + PENTE + " dernières années dépasse le seuil net. L'écart entre brut et net, c'est ce que coûte la fiscalité du CTO." +
      (xa.muReqBrut !== undefined ? auj("seuil " + n1(xa.muReqBrut) + " % brut / " + (xa.muReqNet === null ? "n/d" : n1(xa.muReqNet) + " %") + " net, pente actuelle " + n1(xa.pente) + " %") : ""),
    vol20: "Même volatilité que la case du haut. Au-dessus de " + nS(VH) + " % : passage en ×1 au PEA (LQQ → Nasdaq ×1)" + (g.positionCTO ? " et au CTO (QQQ3 → Nasdaq ×1)" : "") + ". Retour au levier sous " + nS(VB) + " %. Une position prise sur un creux n'est pas concernée, pour ne pas vendre au pire moment." +
      (g.vol20 !== null && g.vol20 !== undefined ? auj(n1(g.vol20) + " %, levier " + levierAuj + (g.reduit ? " · retour au levier sous " + nS(VB) + " %" : g.expose && !g.creux ? " · ×1 si elle dépasse " + nS(VH) + " %" : "")) : ""),
    omen: "Le Pine utilise une deuxième alarme, le Hindenburg Omen, qui détecte une bourse de New York fragile (beaucoup de plus hauts et de plus bas en même temps). Ses données ne sont pas disponibles gratuitement, donc elle n'est pas suivie ici. Tu passeras un peu moins souvent en ×1 que le Pine.",
    creux: "Règle d'entrée anticipée, utile seulement hors marché après une forte baisse. PRÊT = toutes les sécurités sont au vert, il n'attend qu'une baisse assez large. BLOQUÉ = une sécurité est au rouge (la raison est indiquée). DÉSARMÉ = déjà utilisée pendant cet épisode. EN CREUX = la position a été prise ainsi. En position normale, la règle ne sert pas." +
      (g.creuxVerdict ? auj(esc(g.creuxVerdict) + (g.expose && !g.creux ? " (en position, la règle ne sert pas)" : "")) : ""),
    largeur: "Profondeur de la baisse : écart entre le Nasdaq et sa moyenne des " + SMA + " dernières séances. Le creux se déclenche à " + MOINS + nS(ECART) + " % ou moins. Un ✕ en marché haussier est normal : il n'y a pas de baisse." +
      (xj.ecartSMA !== null && xj.ecartSMA !== undefined ? auj(sg(xj.ecartSMA) + " % · " + (xj.declLargeur ? "baisse assez large" : "il manque " + n1(Math.max(0, xj.ecartSMA + ECART)) + " points de baisse")) : ""),
    bulle: "Combien de fois le Nasdaq a été multiplié sur 5 ans, au plus haut des 2 dernières années. Au-dessus de ×" + n2(xj.seuilBulle || 4) + ", le marché est jugé en bulle et l'entrée sur creux est refusée (en 2000, c'était ×10,5)." +
      (xj.bulle !== null && xj.bulle !== undefined ? auj("×" + n2(xj.bulle) + (xj.okBulle ? ", sous le seuil" : ", au-dessus du seuil : creux refusé")) : ""),
    sahm: "Indicateur de récession de la Fed de Saint-Louis : hausse du chômage américain (moyenne 3 mois) par rapport à son plus bas de l'année. Vers 0,50, la récession est en général déjà là ; la règle refuse le creux dès " + n2(xj.seuilSahm || 0.3) + ". 0,00 = le chômage est à son plus bas de l'année." +
      (xj.sahm !== null && xj.sahm !== undefined ? auj(n2(xj.sahm) + (xj.okSahm ? ", sous le seuil" : ", au-dessus du seuil : creux refusé")) : ""),
    prime: "Même logique, sur le taux d'emploi des 25-54 ans, moins bruité que le chômage : baisse depuis son plus haut de l'année. Refus du creux à partir de " + n2(xj.seuilPrime || 0.5) + "." +
      (xj.prime !== null && xj.prime !== undefined ? auj(n2(xj.prime) + (xj.okPrime ? ", sous le seuil" : ", au-dessus du seuil : creux refusé")) : ""),
    arme: "L'entrée sur creux ne sert qu'une fois par épisode de baisse. Elle se réarme quand la tendance redevient acheteuse." +
      (xj.arme !== undefined ? auj(xj.arme ? "armée" : "désarmée, en attente du prochain signal d'achat") : ""),
    journal: "ACHAT / VENTE : signal de tendance (EMA " + EMAS + " semaines). ×1 / ×2 : alarme de volatilité (au CTO, ×2 veut dire retour au QQQ3 ×3). CREUX : entrée anticipée. RELAIS : la tendance reprend une position creux, rien à acheter. VENTE ÉVITÉE : vente et creux le même jour, position gardée. REFUS : un creux bloqué par une sécurité." +
      (g.signaux && g.signaux.length ? auj("dernier signal " + esc(g.signaux[0].type) + " le " + frDate(g.signaux[0].date)) : "")
  };
  const seuil = g.creux ? "relais par l'EMA" : g.expose ? "avant la vente" : "avant l'achat";
  const vol = g.vol20 === null || g.vol20 === undefined ? "—" : F1.format(g.vol20) + NNBSP + "%";
  const volCls = g.vol20 !== null && g.vol20 >= g.volHaut ? "down" : "";
  let msg = "";
  if (g.transition) msg = '<p class="sig-msg ordre">⏵ PEA : ' + esc(g.ordre) + "</p>" + (g.positionCTO && g.ordreCTO && g.ordreCTO !== "Aucun" ? '<p class="sig-msg ordre">⏵ CTO : ' + esc(g.ordreCTO) + "</p>" : "");
  else if (g.provisoire && g.provisoire.changement) msg = '<p class="sig-msg alerte">Séance US en cours : ' + esc(g.provisoire.position) + " si la clôture reste à ce niveau (provisoire)</p>";
  else if (g.zoneTendance) msg = '<p class="sig-msg alerte">Zone d\'alerte : le Nasdaq est à ' + F1.format(Math.abs(g.distance)) + NNBSP + "% du seuil " + (g.expose ? "de vente" : "d'achat") + "</p>";
  else if (g.zoneVol) msg = '<p class="sig-msg alerte">Zone d\'alerte : volatilité proche de ' + g.volHaut + NNBSP + "%, passage en ×1 possible</p>";
  else msg = '<p class="sig-msg">Aucun ordre · séance du ' + esc(court(g.date)) + "</p>";

  /* une VENTE et un CREUX le même jour = la vente n'a pas lieu (anciens journaux) : une seule ligne */
  const bruts = g.signaux || [], fusion = [];
  bruts.forEach(x => {
    const jumeau = bruts.find(y => y !== x && y.date === x.date && ((x.type === "VENTE" && y.type === "CREUX") || (x.type === "CREUX" && y.type === "VENTE")));
    if (!jumeau) { fusion.push(x); return; }
    if (x.type === "VENTE") fusion.push({ type: "VENTE ÉVITÉE", date: x.date, detail: "Creux détecté le même jour : la position est gardée, aucun ordre." });
  });
  const typeCls = t => t === "VENTE ÉVITÉE" ? "t-EVITEE" : "t-" + String(t).replace("×1", "x1").replace("×2", "x2");
  const journal = fusion.slice(0, 8).map(x =>
    '<div class="r"><span class="a ' + typeCls(x.type) + '">' + esc(x.type) + '</span><span class="b">' + esc(court(x.date)) + '</span><span class="c" style="grid-column:1/-1">' + esc(x.detail) + "</span></div>").join("");

  /* arbitrage du DCA : ×1 / ×2 au PEA, ×3 au CTO, nets d'impôt (formule d'espérance du Pine) */
  const a = g.arbitrage;
  let arb = "";
  if (a) {
    const tMax = x => x === undefined || x === null ? "" : x < 0 ? "taux max : aucun" : x >= 50 ? "taux max > 50 %" : "taux max " + F1.format(x) + NNBSP + "%";
    const ou = a.optimal === 3 ? "CTO · QQQ3" : a.optimal === 2 ? "PEA · LQQ" : "PEA · ETF ×1";
    arb = '<h4 class="sig-h">Apport du mois <small>formule d\'espérance, pas une prévision</small></h4>' +
      ligne(g.expose ? "Verdict" : "Hors marché", g.expose ? "×" + a.optimal + " · " + ou : "cash PEA · or CTO", g.expose && a.avance !== undefined ? "avance de " + F1.format(a.avance) + " pt/an sur le deuxième choix, après impôt" : "le DCA ne va jamais sur ce que le signal dit de ne pas détenir", g.expose ? "acc" : "down", EX.verdict) +
      ligne("Données", "μ " + F1.format(a.mu) + " · σ " + F1.format(a.sigma) + " · r " + F2.format(a.taux) + " %", "μ = pente " + "5 ans du Nasdaq, dividendes compris · σ sur 252 séances · r = taux Fed (" + esc(a.tauxSource || "FRED") + ")", "", EX.donnees) +
      (a.rendX1 !== undefined ? ligne("Net/an", "×1 " + F1.format(a.rendX1) + " · ×2 " + F1.format(a.rendX2) + (a.cto ? " · ×3 " + F1.format(a.rendX3) : "") + " %", "rendement annuel attendu après impôt : ×1 et ×2 au PEA (impôt à la sortie), ×3 au CTO (" + (g.tauxCTO ? F1.format(g.tauxCTO) : "31,4") + " % à chaque vente, tous les " + F1.format(a.H || 1.2) + " an)", "", EX.net) : "") +
      ligne("×2 contre ×1 (PEA)", pct(a.ecart / 100, 1) + "/an " + coche(a.ecart > 0), tMax(a.tauxMax), "", EX.x21) +
      (a.cto && a.ecart32 !== undefined ? ligne("×3 CTO contre ×2 PEA", pct(a.ecart32 / 100, 1) + "/an " + coche(a.ecart32 > 0), tMax(a.tauxMax32) + (a.sigmaMax3 === undefined ? "" : " · " + (a.sigmaMax3 < 0 ? "×3 : jamais, quelle que soit la volatilité" : a.sigmaMax3 >= 100 ? "×3 quelle que soit la volatilité" : "×3 seulement si σ ≤ " + F1.format(a.sigmaMax3) + " %")), "", EX.x32) : "") +
      (a.cto && a.muReqBrut !== undefined ? ligne("μ seuil ×3", (a.muReqBrut >= 200 ? "> 200" : F1.format(a.muReqBrut)) + " / " + (a.muReqNet === null ? "n/d" : a.muReqNet >= 200 ? "> 200" : F1.format(a.muReqNet)) + " %/an " + coche(a.muReqNet === null ? null : a.pente >= a.muReqNet), "pente minimale du Nasdaq pour que le ×3 batte le ×2, brut / net d'impôt · pente 5 ans actuelle : " + F1.format(a.pente) + " % (un repère sur le passé : records juste avant les retournements)", "", EX.museuil) : "");
  }

  /* creux : les 4 conditions du Pine */
  const j = g.jauges;
  const creux = '<h4 class="sig-h">Entrée sur creux <small>utile seulement hors marché</small></h4>' +
    ligne("Verdict", esc(g.creuxVerdict || "—"), g.expose && !g.creux ? "en position : la règle ne sert pas" : "", g.creux ? "acc" : "", EX.creux) +
    (j ? ligne("Largeur (proxy)", p1(j.ecartSMA) + " " + coche(j.declLargeur), "déclenche quand le Nasdaq est à " + F1.format(Math.abs(j.seuilEcart)) + " % ou plus sous sa moyenne " + j.smaLen + " séances", "", EX.largeur) +
      ligne("1 · Bulle", (j.bulle === null ? "—" : "×" + F2.format(j.bulle)) + " " + coche(j.bulle === null ? null : j.okBulle), "montée sur 5 ans au pic des 2 ans, doit rester < ×" + F2.format(j.seuilBulle), "", EX.bulle) +
      ligne("2 · Sahm", (j.sahm === null ? "—" : F2.format(j.sahm)) + " " + coche(j.sahm === null ? null : j.okSahm), "chômage US, doit rester < " + F2.format(j.seuilSahm), "", EX.sahm) +
      ligne("3 · Sahm 25-54 ans", (j.prime === null ? "—" : F2.format(j.prime)) + " " + coche(j.prime === null ? null : j.okPrime), "emploi des 25-54 ans, doit rester < " + F2.format(j.seuilPrime), "", EX.prime) +
      ligne("Armée", j.arme ? "oui" : "non", "une seule entrée par épisode : se réarme quand la tendance repasse acheteuse", "", EX.arme) : "");

  const levier = '<h4 class="sig-h">Levier <small>PEA ×2 / CTO ×3 ↔ ×1</small></h4>' +
    ligne("Volatilité 20 séances", vol + " " + coche(g.vol20 === null ? null : g.vol20 < g.volHaut), "passe en ×1 au-dessus de " + g.volHaut + " %, revient sous " + (g.volBas || 25) + " % · position creux exemptée", "", EX.vol20) +
    ligne("Alarme Omen", "non suivie", "données NYSE introuvables gratuitement : seule la volatilité pilote le ×1", "", EX.omen);

  const detail = '<div class="sig-detail"' + (signalOuvert ? "" : " hidden") + ">" +
    '<div class="sig-cells">' +
      cell("Distance", p(g.distance), g.distance < 0 && g.expose ? "down" : "", seuil, "distance") +
      cell("Volatilité", vol, volCls, "20 j · ×1 au-dessus de " + g.volHaut + NNBSP + "%", "vol") +
      cell("Depuis", esc(court(g.depuis)), "", g.expose ? "Nasdaq " + p(g.perfDepuis) : g.joursDepuis + " j hors marché", "depuis") +
    "</div>" +
    ["distance", "vol", "depuis"].map(k => '<div class="sig-case-aide" data-pour="' + k + '" hidden><span class="aide">' + EX[k] + "</span></div>").join("") +
    '<div class="m-liste">' + arb + levier + creux + '<div data-aide><h4 class="sig-h"><span>Journal' + qm + '</span><small>8 derniers signaux</small></h4>' + aide(EX.journal) + "</div>" + journal + "</div>" +
    '<div class="sig-pied">Calcul du ' + esc(g.majLe || "") + " · données " + esc(g.source || "") + " · EMA " + (g.emaSem || 45) + " sem. " + F0.format(g.ema) + " · seuil de vente " + F0.format(g.bandeSortie) + "</div>" +
  "</div>";

  /* vue courte : la position à tenir sur chaque compte, l'apport du mois, et l'ordre éventuel */
  return '<div class="sig ' + cls + '">' +
    '<button type="button" class="sig-tete" aria-expanded="' + signalOuvert + '">' +
      '<span class="sig-lab">' + (g.positionCTO ? "Levier · PEA + CTO" : "Signal levier · PEA") + '</span><span class="sig-pos">' + esc(g.position) + '</span><span class="chev" aria-hidden="true">›</span>' +
    "</button>" +
    (g.positionCTO ? '<div class="sig-cto" data-aide><span class="sig-lab">CTO' + qm + '</span><span class="sig-pos cto-' + (g.positionCTO === "OR" ? "or" : /×1/.test(g.positionCTO) ? "x1" : "x3") + '">' + esc(g.positionCTO) + '</span><span class="sub">même signal · ×1 si alarme · or hors marché</span>' + aide(EX.cto) + "</div>" : "") +
    (a && g.expose ? '<div class="sig-cto" data-aide><span class="sig-lab">Apport' + qm + '</span><span class="sig-pos cto-' + (a.optimal === 3 ? "x3" : a.optimal === 2 ? "x2" : "x1") + '">×' + a.optimal + '</span><span class="sub">' + (a.optimal === 3 ? "CTO · QQQ3" : a.optimal === 2 ? "PEA · LQQ" : "PEA · ETF ×1") + " · net d'impôt</span>" + aide(EX.apport) + "</div>" : "") +
    msg + detail +
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
  const t = carte.querySelector(".sig-tete");
  t.addEventListener("click", () => { signalOuvert = !signalOuvert; t.setAttribute("aria-expanded", String(signalOuvert)); carte.querySelector(".sig-detail").hidden = !signalOuvert; });
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
/* A · patrimoine dans le temps, brut ou net */
function donneesPatrimoine() {
  const s = seriePatrimoine(); if (s.length < 2) return null;
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
function blocPatrimoineTemps() {
  const d = donneesPatrimoine(); if (!d) return "";
  const brut = PREF.patri === "brut", aImmo = d.some(x => x.prix > 0);
  const det0 = detailPatrimoine(d), voirDet = det0.utile && PREF.patriDet === "1", det = voirDet ? det0 : null;
  const leg = couchesPatrimoine(d, brut, aImmo, det).map(c => ({ nom: c.nom, c: c.c, op: c.op }))
    .concat(brut && aImmo ? [{ nom: "Prêts restants", c: "var(--down)", op: .5 }] : []);
  const der = d[d.length - 1], prem = d.find(x => x.complet) || d[0];
  const net = x => x.bourse + x.epargne + x.immo;
  return '<div><h2 class="sec">Patrimoine dans le temps <small>fin de mois</small></h2></div>' +
    (aImmo ? '<div class="seg" role="group" aria-label="Brut ou net"><button type="button" data-m-patri="net" aria-pressed="' + !brut + '">Net</button><button type="button" data-m-patri="brut" aria-pressed="' + brut + '">Brut (dette à part)</button></div>' : "") +
    (det0.utile ? '<div class="chips" role="group" aria-label="Niveau de détail"><button class="chip" type="button" data-m-patridet="" aria-pressed="' + !voirDet + '">Vue d\'ensemble</button><button class="chip" type="button" data-m-patridet="1" aria-pressed="' + voirDet + '">Détail par compte</button></div>' : "") +
    boiteEmpile("g-patri", leg) +
    '<p class="resume">' + (brut ? "Brut : l'appartement compté à son prix, les prêts restants en dessous de zéro. Les pointillés suivent ton patrimoine net. " : "Net : l'immobilier compte pour son prix moins les prêts restants. ") +
      (voirDet ? "Détail : une couche par enveloppe de bourse" + (det.bourse.length ? "" : " (ton fichier ne garde pas leur valeur mois par mois : la bourse reste en un bloc)") + " et une par livret. " : "") +
      "Depuis fin " + esc(libMoisK(prem.k)) + " : <b class=\"" + sens(net(der) - net(prem)) + "\">" + eur(net(der) - net(prem), 0, true) + "</b>.</p>";
}
function dessinerPatrimoine() {
  const box = document.getElementById("g-patri"); if (!box) return;
  const d = donneesPatrimoine(), brut = PREF.patri === "brut", aImmo = d.some(x => x.prix > 0);
  const det0 = detailPatrimoine(d), det = det0.utile && PREF.patriDet === "1" ? det0 : null;
  empile(box, { x: d.map(x => x.k), couches: couchesPatrimoine(d, brut, aImmo, det), trait: !!det, negs: brut && aImmo ? [{ nom: "Prêts restants", v: d.map(x => x.dette), c: "var(--down)" }] : [],
    ligne: brut && aImmo ? { nom: "Patrimoine net", v: d.map(x => x.bourse + x.epargne + x.immo) } : null });
}
/* C · épargne livret par livret (soldes envoyés par l'API V10 ; l'assurance-vie = total épargne du mois moins les livrets) */
const COUL_EP = ["var(--gold)", "var(--p1)", "var(--p2)", "var(--p3)", "var(--accent)", "var(--idx)"];
function donneesEpargne() {
  const em = M.epargneMois; if (!em || !em.rows || !em.rows.length) return null;
  const mpm = {}; (M.moisParMois || []).forEach(r => { mpm[String(r.mois).slice(0, 7)] = r; });
  const rows = em.rows.filter(r => { const t = mpm[String(r[0]).slice(0, 7)]; return t && ok(t.epargne); });
  if (rows.length < 2) return null;
  const av = rows.map(r => { const t = mpm[String(r[0]).slice(0, 7)]; return Math.max(0, (t.epargne || 0) + (t.uc || 0) - r.slice(1).reduce((a, b) => a + b, 0)); });
  const couches = em.comptes.map((nom, j) => ({ nom: nom.replace(/\s+Banque Pop\.?$/, ""), v: rows.map(r => r[j + 1]), c: COUL_EP[j % COUL_EP.length] })).filter(c => c.v.some(x => x > 0.5));
  if (av.some(x => x > 0.5)) couches.push({ nom: "Assurance-vie et autres", v: av, c: "var(--c-av)" });
  return { x: rows.map(r => cleMoisIso(r[0])), couches };
}
function blocEpargneTemps() {
  const d = donneesEpargne();
  if (!d) return M.epargneMois === undefined && (M.epargne || []).length ? '<div><h2 class="sec">Épargne livret par livret</h2></div><p class="info">Ce graphique a besoin de la version 10 de ton API patrimoine (nouveau déploiement).</p>' : "";
  const der = d.couches.map(c => c.v[c.v.length - 1]), tot = der.reduce((a, b) => a + b, 0);
  return '<div><h2 class="sec">Épargne livret par livret <small>fin de mois</small></h2></div>' + boiteEmpile("g-epargne", d.couches) +
    '<p class="resume">Aujourd\'hui : ' + d.couches.map((c, i) => esc(c.nom) + " <b>" + eur(der[i]) + "</b>").join(" · ") + " · total <b>" + eur(tot) + "</b>.</p>";
}
function dessinerEpargne() { const box = document.getElementById("g-epargne"); const d = donneesEpargne(); if (box && d) empile(box, { x: d.x, couches: d.couches }); }
/* B · prêt : capital restant dû, passé plein, à venir en pointillés */
function blocPret() {
  const p = M.prets; if (!p || !(p.mensuel || []).length) return "";
  const mens = p.mensuel, emprunte = Math.max(...mens.map(r => r[1])), auj = isoJour(new Date());
  const restant = p.actuel ? p.actuel.restant : mens[0][1], rembourse = emprunte - restant;
  const t = (lab, val, cls, sub) => "<div><span class=\"lab\">" + lab + '</span><span class="val ' + (cls || "") + '">' + val + '</span><span class="sub">' + sub + "</span></div>";
  return acc("m-pret", "Ton prêt immobilier", "année par année", '<div class="chart-box pret-an" id="g-pret"></div>' +
    '<div class="tuiles m-petit m-pret-t">' +
      t("Remboursé", pct(rembourse / emprunte, 1, false), "up", eur(rembourse) + " sur " + eur(emprunte)) +
      t("Restant dû", eur(restant), "", p.actuel ? "au " + frDate(p.actuel.date) : "") +
      t("Intérêts restants", eur(p.interetsRestants), "", "payés en " + new Date().getFullYear() + " : " + eur(p.interetsAnnee)) +
      t(p.fin && /^dans /.test(dansDuree(p.fin)) ? "Fin des prêts dans" : "Fin des prêts", p.fin ? dansDuree(p.fin).replace(/^dans /, "") : "—", "", p.fin ? "le " + frDate(p.fin) : "") +
      (p.prochaine && (p.banque || p.prochaine.assurance !== undefined && p.prochaine.assurance !== null) ? t("Prochaine échéance", eur(p.prochaine.echeance + (p.banque ? 0 : p.prochaine.assurance || 0), 2), "", "le " + frDate(p.prochaine.date) + ", assurance comprise" + (p.banque ? " (ta part)" : "")) : "") +
      tuileCapitalMois(p, t) +
    "</div>", false);
}
/* V15.13 · 6e tuile du prêt : dans la prochaine échéance, ce qui rembourse vraiment (capital) et ce qui part (intérêts, assurance) */
function tuileCapitalMois(p, t) {
  const pr = p.prochaine, av = p.actuel; if (!pr || !av || !(av.restant > pr.restant)) return "";
  const capital = av.restant - pr.restant, ass = p.banque ? 0 : pr.assurance || 0, total = (pr.echeance || 0) + ass, interets = Math.max(0, total - capital - ass);
  return t("Dont capital", eur(capital, 0), "up", (total > 0 ? Math.round(capital / total * 100) + " % de l'échéance · " : "") + "intérêts " + eur(interets, 0) + (ass ? " · assurance " + eur(ass, 2) : ""));
}
/* V15.15 · le prêt année par année : barres « capital remboursé » + « intérêts payés » (passé plein, à venir pâle, année en cours entourée) */
function dessinerPret() {
  const box = document.getElementById("g-pret"); if (!box) return;
  const mens = M.prets.mensuel || []; if (mens.length < 2) { box.innerHTML = ""; return; }
  const avecInt = mens.some(r => r[2] > 0), parAn = {};
  for (let i = 1; i < mens.length; i++) { const y = +String(mens[i][0]).slice(0, 4), a = parAn[y] = parAn[y] || { cap: 0, int: 0 }; a.cap += Math.max(0, mens[i - 1][1] - mens[i][1]); a.int += mens[i][2] || 0; }
  const ys = Object.keys(parAn).map(Number).sort((a, b) => a - b), an = new Date().getFullYear();
  const W = 320, H = 170, g = 34, dr = 4, hb = 18, n = ys.length, max = Math.max(...ys.map(y => parAn[y].cap + parAn[y].int)) || 1;
  const pas = (W - g - dr) / n, bw = Math.max(4, pas * .7), Y = v => 8 + (1 - v / max) * (H - 8 - hb);
  const kE = v => v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1).replace(".", ",") + " k" : String(Math.round(v));
  const grille = [max, max / 2].map(v => '<line x1="' + g + '" x2="' + (W - dr) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" class="gr"/><text x="' + (g - 4) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="end">' + kE(v) + "</text>").join("");
  const barres = ys.map((y, i) => {
    const a = parAn[y], x = g + i * pas + (pas - bw) / 2, op = y <= an ? 1 : .42, yc = Y(a.cap), yi = Y(a.cap + a.int);
    return '<g opacity="' + op + '"><title>' + y + " : " + Math.round(a.cap).toLocaleString("fr-FR") + " € de capital" + (avecInt ? ", " + Math.round(a.int).toLocaleString("fr-FR") + " € d'intérêts" : "") + "</title>" +
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
function paramsMillion() {
  const v = valeurMillion() || 0, ry = rythmeMillion(), c0 = ry ? ry.c : null;
  const c = ok(PREF.effort) ? PREF.effort : (c0 || 0), R = ok(PREF.rendement) ? PREF.rendement : 0.05;
  return { v, c0, c, R, source: ry ? ry.source : "" };
}
/* projection mois par mois jusqu'au million (40 ans au plus), avec et sans épargne nouvelle */
function projection(v, c, R) {
  const i = Math.pow(1 + R, 1 / 12) - 1, avec = [v], sans = [v];
  let a = v, z = v;
  for (let n = 1; n <= 480; n++) { a = a * (1 + i) + c; z = z * (1 + i); avec.push(a); sans.push(z); if (a >= CIBLE && n % 12 === 0) break; }
  return { avec, sans };
}
function svgProjection(v, c, R) {
  const { avec, sans } = projection(v, c, R), n = avec.length - 1;
  const W = 320, H = 150, m = { l: 34, r: 8, t: 8, b: 18 }, iw = W - m.l - m.r, ih = H - m.t - m.b;
  const mx = Math.max(CIBLE * 1.05, ...avec.slice(0, n + 1)), X = k => m.l + k / n * iw, Y = val => m.t + ih - Math.min(val, mx) / mx * ih;
  const d = arr => arr.map((val, k) => (k ? "L" : "M") + X(k).toFixed(1) + " " + Y(val).toFixed(1)).join("");
  const discret = ETAT.discret === "oui";
  let o = "";
  [0, 250000, 500000, 750000, 1000000].forEach(t => {
    o += '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '" stroke="rgba(255,255,255,' + (t === CIBLE ? ".55" : ".08") + ')"' + (t === CIBLE ? ' stroke-dasharray="4 3"' : "") + "/>";
    o += '<text x="' + (m.l - 5) + '" y="' + (Y(t) + 3.5).toFixed(1) + '" text-anchor="end">' + (t === 0 ? "0" : t === CIBLE ? "1M" : (t / 1000) + "k") + "</text>";
  });
  const an0 = new Date().getFullYear(), mo0 = new Date().getMonth();
  let dx = -99;
  for (let k = 0; k <= n; k++) { if ((mo0 + k) % 12 !== 0) continue; const y = an0 + Math.floor((mo0 + k) / 12), x = X(k); if (x - dx < 44) continue; dx = x; o += '<text x="' + x.toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + y + "</text>"; }
  o += '<path d="' + d(avec) + "L" + X(n).toFixed(1) + " " + Y(0).toFixed(1) + "L" + X(0).toFixed(1) + " " + Y(0).toFixed(1) + 'Z" fill="url(#mm-deg)" stroke="none"/>';
  o += '<path d="' + d(sans) + '" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="1.4" stroke-dasharray="3 3"/>';
  o += '<path d="' + d(avec) + '" fill="none" stroke="#F5C542" stroke-width="2.4" stroke-linejoin="round"/>';
  const kM = avec.findIndex(val => val >= CIBLE);
  if (kM > 0) o += '<circle cx="' + X(kM).toFixed(1) + '" cy="' + Y(CIBLE).toFixed(1) + '" r="4.5" fill="#fff" stroke="#F5C542" stroke-width="2"/>';
  return '<svg class="mm-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Projection jusqu\'au million"><defs><linearGradient id="mm-deg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#F5C542" stop-opacity=".35"/><stop offset="1" stop-color="#F5C542" stop-opacity="0"/></linearGradient></defs>' + o + "</svg>" +
    '<div class="mm-leg"><span><i></i>avec ' + (discret ? "ton épargne" : F0.format(Math.round(c)) + " €/mois") + '</span><span><i class="sans"></i>sans rien ajouter</span></div>';
}
function textesMillion(P) {
  const n = moisPourMillion(P.v, P.c, P.R), discret = ETAT.discret === "oui";
  const quand = n === null ? null : new Date(new Date().getFullYear(), new Date().getMonth() + n, 1);
  const prochain = JALONS.concat([CIBLE]).find(j => j > P.v);
  const nProchain = prochain ? moisPourMillion(P.v * CIBLE / prochain, P.c * CIBLE / prochain, P.R) : null;   // même calcul, mis à l'échelle du jalon
  const eta = quand ? 'À ce rythme, <b>millionnaire en ' + MOIS_L[quand.getMonth()] + " " + quand.getFullYear() + "</b>" + (n > 0 ? " · dans " + (n >= 24 ? Math.floor(n / 12) + " ans" + (n % 12 ? " et " + (n % 12) + " mois" : "") : n + " mois") : "") + "."
    : "Avec ces hypothèses, le million reste hors de portée en 40 ans : augmente l'épargne ou le rendement pour voir.";
  const sub = prochain && prochain < CIBLE && nProchain !== null ? "Prochain jalon : <b>" + F0.format(prochain / 1000) + " 000 €</b>" + (discret ? "" : ", encore " + eur(prochain - P.v)) + (nProchain ? " · ≈ " + (nProchain >= 24 ? Math.round(nProchain / 12) + " ans" : nProchain + " mois") : "") : "";
  return { n, quand, eta, sub };
}
function htmlMillion() {
  if (!M) return "";
  const P = paramsMillion(), part = Math.max(0, Math.min(1, P.v / CIBLE)), T = textesMillion(P);
  const discret = ETAT.discret === "oui", reduitM = PREF.millionReduit !== false;
  const texteFlap = discret ? "•••" : F0.format(Math.round(P.v));
  const piste = JALONS.map(j => '<span class="mj' + (P.v >= j ? " passe" : "") + '" style="left:' + (j / CIBLE * 100) + '%"><i></i><b>' + (j / 1000) + "k</b></span>").join("");
  const tete = '<div class="mm-h"><span class="mm-k">Cap sur le million</span><span class="mm-d"><span class="mm-prive">privé</span>' +
    '<button type="button" class="mm-plus" id="mm-reduire" aria-expanded="' + !reduitM + '">' + (reduitM ? "Voir plus ▾" : "Réduire ▴") + "</button></span></div>";
  /* D (v16.93) : en mode discret, ni %, ni jauge, ni date, ni jalon (tout cela laisse deviner le montant) */
  if (discret) return '<section class="m-million reduit discret" style="--mc:' + couleurMoi() + '"><div class="mm-h"><span class="mm-k">Cap sur le million</span><span class="mm-d"><span class="mm-prive">privé</span></span></div>' +
    '<p class="mm-mini">Masqué en mode discret. Désactive-le dans Réglages pour voir ta progression.</p></section>';
  if (reduitM) return '<section class="m-million reduit" style="--mc:' + couleurMoi() + '">' + tete +
    '<p class="mm-ligne"><b>' + F1.format(part * 100) + ' %</b><span>' + (T.quand ? "millionnaire en " + MOIS_L[T.quand.getMonth()] + " " + T.quand.getFullYear() : "hors de portée à ce rythme") + "</span></p>" +
    '<div class="mm-rail mini"><i style="width:' + (part * 100).toFixed(2) + '%"></i></div>' + (T.sub ? '<p class="mm-mini">' + T.sub + "</p>" : "") + "</section>";
  return '<section class="m-million" style="--mc:' + couleurMoi() + '">' + tete +
    '<div class="mm-pct"><b>' + F1.format(part * 100) + '</b><span>%</span></div>' +
    '<div class="m-flaps mm-flaps" aria-label="' + esc(texteFlap) + ' euros">' + flaps(texteFlap + NB + "€", false) + "</div>" +
    '<div class="mm-piste" role="img" aria-label="' + F1.format(part * 100) + ' % du million"><div class="mm-rail"><i style="width:' + (part * 100).toFixed(2) + '%"></i><em style="left:' + (part * 100).toFixed(2) + '%"></em></div>' + piste + '<span class="mj fin" style="left:100%"><i></i><b>1M</b></span></div>' +
    '<p class="mm-note">Patrimoine financier : épargne, bourse et assurance-vie. L\'immobilier ne compte pas.</p>' +
    '<p class="mm-eta" id="mm-eta">' + T.eta + "</p>" +
    '<p class="mm-sub" id="mm-sub">' + T.sub + "</p>" +
    '<div class="mm-sim"><label><span>Épargne par mois (€)</span><input id="mm-effort" type="text" inputmode="numeric" autocomplete="off" value="' + Math.round(P.c) + '"></label>' +
      '<label><span>Rendement par an (%)</span><input id="mm-rend" type="text" inputmode="decimal" autocomplete="off" value="' + String(+(P.R * 100).toFixed(1)).replace(".", ",") + '"></label></div>' +
    '<p class="mm-note" id="mm-rythme">' + (P.c0 !== null ? "Ton rythme estimé : ≈ " + (discret ? "•••" : F0.format(P.c0)) + " €/mois (" + esc(P.source) + ")" + (ok(PREF.effort) || ok(PREF.rendement) ? ' · <button type="button" class="mm-raz" id="mm-raz">revenir à ton rythme et 5 %</button>' : "") : "") + "</p>" +
    '<div class="mm-graph" id="mm-graph">' + svgProjection(P.v, P.c, P.R) + "</div>" +
    '<p class="mm-badge">' + badgeMillion() + "</p>" +
    '<p class="mm-note">Simulation : épargne et rendement constants, intérêts composés chaque mois. Un repère pour se motiver, pas une prévision.</p>' +
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
function majSimulation(el) {
  const P = paramsMillion(), T = textesMillion(P);
  el.querySelector("#mm-eta").innerHTML = T.eta;
  el.querySelector("#mm-sub").innerHTML = T.sub;
  el.querySelector("#mm-graph").innerHTML = svgProjection(P.v, P.c, P.R);
}
function brancherMillion(el) {
  const r = el.querySelector("#mm-reduire"); if (r) r.addEventListener("click", () => { PREF.millionReduit = PREF.millionReduit === false; garderPref(); afficherMillion(el); });
  const e = el.querySelector("#mm-effort"), t = el.querySelector("#mm-rend");
  if (e) e.addEventListener("input", () => { const x = lireNombre(e.value); if (x >= 0 && x <= 100000) { PREF.effort = x; garderPref(); majSimulation(el); } });
  if (t) t.addEventListener("input", () => { const x = lireNombre(t.value); if (x >= -10 && x <= 30) { PREF.rendement = x / 100; garderPref(); majSimulation(el); } });
  const z = el.querySelector("#mm-raz"); if (z) z.addEventListener("click", () => { delete PREF.effort; delete PREF.rendement; garderPref(); afficherMillion(el); });
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
let projPlus = 0;   // curseur « Et si je versais plus ? » : toujours à 0 à l'ouverture
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
/** tout le calcul de la projection (sans effet de bord) ; plus = euros ajoutés chaque mois par le curseur */
function calculProjection(plus) {
  if (!M) return null;
  const mix = mixFinancier(); if (!mix) return null;
  const ry = rythmeMillion(), c = ry ? ry.c : 0, n = moisJusquA(FIN_PROJ), cp = c + (plus || 0);
  const sc = [["prudent", Math.max(0, mix.r - ECART_SCENARIO)], ["central", mix.r], ["optimiste", mix.r + ECART_SCENARIO]].map(([k, r]) => ({ k, r, s: serieProj(mix.total, cp, r, n) }));
  sc.forEach(x => { x.fin = x.s[n]; });
  const nM = moisPourMillion(mix.total, c, mix.r), nMp = moisPourMillion(mix.total, cp, mix.r);
  return { v: mix.total, mix, c, plus: plus || 0, cp, n, sc, verse: mix.total + cp * n, source: ry ? ry.source : "", nM, nMp };
}
function dateDansMois(n) { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function jalonsProjection() {
  const l = [], fin = FIN_PROJ, auj = isoJour(new Date());
  if (aArtema()) ARTEMA.rdv.forEach((x, i) => { if (x[0] >= auj && x[0] <= fin) l.push({ d: x[0], k: "artema", t: x[3] ? "Artema : fin" : "Artema : rendez-vous " + (i + 1) }); });
  const p = M.prets; if (p && p.fin && p.fin >= auj && p.fin <= fin) l.push({ d: p.fin, k: "pret", t: "Fin du prêt" });
  return l;
}
function svgProjection2034(P) {
  const W = 320, H = 176, m = { l: 38, r: 8, t: 10, b: 30 }, iw = W - m.l - m.r, ih = H - m.t - m.b, n = P.n;
  const mx = Math.max(...P.sc[2].s) * 1.06 || 1, X = k => m.l + k / n * iw, Y = v => m.t + ih - Math.max(0, Math.min(v, mx)) / mx * ih;
  const d = arr => arr.map((v, k) => (k ? "L" : "M") + X(k).toFixed(1) + " " + Y(v).toFixed(1)).join("");
  const pas = mx > 2e6 ? 5e5 : mx > 8e5 ? 2.5e5 : mx > 3e5 ? 1e5 : mx > 1.2e5 ? 5e4 : mx > 4e4 ? 1e4 : 5e3;
  let o = "";
  for (let t = 0; t <= mx; t += pas) o += '<line class="gr" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(t).toFixed(1) + '" y2="' + Y(t).toFixed(1) + '"/><text x="' + (m.l - 4) + '" y="' + (Y(t) + 3.5).toFixed(1) + '" text-anchor="end">' + (t ? kEurP(t).replace(" ", "") : "0") + "</text>";
  if (mx > CIBLE * .7) o += '<line class="mil" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + Y(CIBLE).toFixed(1) + '" y2="' + Y(CIBLE).toFixed(1) + '"/><text class="mil-t" x="' + (W - m.r) + '" y="' + (Y(CIBLE) - 3).toFixed(1) + '" text-anchor="end">1 million</text>';
  const a0 = new Date(), kDe = iso => Math.max(0, Math.min(n, (+iso.slice(0, 4) - a0.getFullYear()) * 12 + (+iso.slice(5, 7) - 1 - a0.getMonth()) + (+iso.slice(8, 10) - 1) / 30));
  for (let y = a0.getFullYear() + 1; y <= 2034; y++) { if ((y - a0.getFullYear()) % 2) continue; const x = X(kDe(y + "-01-01")); o += '<text x="' + x.toFixed(1) + '" y="' + (H - m.b + 13) + '" text-anchor="middle">' + y + "</text>"; }
  const [pr, ce, op] = P.sc;
  o += '<path class="bande" d="' + d(op.s) + pr.s.map((v, k) => "L" + X(n - k).toFixed(1) + " " + Y(pr.s[n - k]).toFixed(1)).join("") + 'Z"/>';
  o += '<path class="l-pr" d="' + d(pr.s) + '"/><path class="l-op" d="' + d(op.s) + '"/><path class="l-ce" d="' + d(ce.s) + '"/>';
  if (P.plus) { const base = serieProj(P.v, P.c, ce.r, n); o += '<path class="l-base" d="' + d(base) + '"/>'; }
  o += '<circle class="pt" cx="' + X(0).toFixed(1) + '" cy="' + Y(P.v).toFixed(1) + '" r="3"/><circle class="pt" cx="' + X(n).toFixed(1) + '" cy="' + Y(ce.fin).toFixed(1) + '" r="3.5"/>';
  jalonsProjection().forEach(j => { const x = X(kDe(j.d)), yb = H - m.b; o += '<g class="j-' + j.k + '"><title>' + esc(j.t) + " · " + frDate(j.d) + '</title><line x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + m.t + '" y2="' + yb + '"/>' +
    (j.k === "artema" ? '<path d="M' + x.toFixed(1) + " " + (yb - 5) + "l4 4l-4 4l-4 -4z" + '"/>' : '<circle cx="' + x.toFixed(1) + '" cy="' + (yb - 1) + '" r="4"/>') + "</g>"; });
  return '<svg class="pj-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Projection du patrimoine financier jusqu\'en 2034">' + o + "</svg>";
}
const pctR = r => String(Math.round(r * 1000) / 10).replace(".", ",") + NB + "%";
const NOMS_FAM = { livrets: "livrets", fe: "fonds euros", uc: "Artema et autres supports", bourse: "bourse", autres: "le reste" };
function phrasePlus(P) {
  if (!P.plus) return 'Fais glisser pour voir l\'effet d\'un petit effort en plus (essaie +' + PLUS_PROPOSE + " €).";
  const q = P.nMp === null ? null : dateDansMois(P.nMp), gain = P.nM !== null && P.nMp !== null ? P.nM - P.nMp : null;
  const fin = P.sc[1].fin - serieProj(P.v, P.c, P.sc[1].r, P.n)[P.n];
  const dur = g => g >= 24 ? Math.floor(g / 12) + " ans" + (g % 12 ? " et " + (g % 12) + " mois" : "") : g + " mois";
  return "<b>+" + F0.format(P.plus) + " €/mois</b> → " + (q ? (gain > 0 ? "million <b>" + dur(gain) + " plus tôt</b>, en " + MOIS_L[q.getMonth()] + " " + q.getFullYear() : "million en " + MOIS_L[q.getMonth()] + " " + q.getFullYear()) : "million encore hors de portée en 80 ans") +
    " · fin 2034 : <b>+" + kEurP(Math.max(0, fin)) + "</b> (central).";
}
function htmlProjection() {
  if (!M) return "";
  const P = calculProjection(projPlus); if (!P) return "";
  if (ETAT.discret === "oui") return acc("m-proj", "Projection 2034", "patrimoine financier", '<p class="info">Masquée en mode discret (la courbe laisse deviner le montant). Désactive-le dans Réglages pour la voir.</p>', false);
  const [pr, ce, op] = P.sc, art = aArtema(), pret = M.prets && M.prets.fin;
  const tuile = (x, lab) => '<div class="pj-t pj-' + x.k + '"><span>' + lab + '</span><b>' + kEurP(Math.round(x.fin / 1000) * 1000) + "</b><small>" + pctR(x.r) + " par an</small></div>";
  const familles = P.mix.fam.filter(f => f.part >= .02).map(f => NOMS_FAM[f.k] + " " + pctR(f.r)).join(", ");
  const jal = jalonsProjection();
  const leg = '<div class="pj-leg"><span><i class="ce"></i>central</span><span><i class="bd"></i>de prudent à optimiste</span>' + (P.plus ? '<span><i class="bs"></i>sans le curseur</span>' : "") +
    (jal.some(j => j.k === "artema") ? '<span><i class="ar"></i>Artema</span>' : "") + (jal.some(j => j.k === "pret") ? '<span><i class="pt"></i>fin du prêt</span>' : "") + "</div>";
  const apresPret = pret && pret > isoJour(new Date()) && pret <= FIN_PROJ && M.prets.mensualite > 0
    ? (() => { const k = moisJusquA(pret), i = Math.pow(1 + ce.r, 1 / 12) - 1, mens = M.prets.mensualite; let x = 0; for (let j = k; j < P.n; j++) x = x * (1 + i) + mens; return "<li>Ton prêt se termine le " + frDate(pret) + " : si tu épargnes ensuite ta mensualité (" + eur(mens) + "), cela ferait ≈ +" + kEurP(Math.round(x / 1000) * 1000) + " de plus fin 2034 (pas compté dans la courbe).</li>"; })()
    : pret && pret > FIN_PROJ ? "<li>Ton prêt se termine le " + frDate(pret) + ", après la frise.</li>" : "";
  const corps = '<div class="m-proj">' +
    '<div class="pj-tuiles">' + tuile(pr, "Prudent") + tuile(ce, "Central") + tuile(op, "Optimiste") + "</div>" +
    '<div class="pj-graph" id="pj-graph">' + svgProjection2034(P) + "</div>" + leg +
    '<div class="pj-plus"><label for="pj-plus"><span>Et si je versais plus chaque mois ?</span><b id="pj-plus-v">+' + F0.format(P.plus) + " €</b></label>" +
      '<input type="range" id="pj-plus" min="0" max="' + PLUS_MAX + '" step="' + PLUS_PAS + '" value="' + P.plus + '" aria-describedby="pj-plus-t">' +
      '<p class="pj-plus-t" id="pj-plus-t">' + phrasePlus(P) + "</p></div>" +
    '<div data-aide><h4 class="pj-h">Les hypothèses <button type="button" class="qm-b" aria-label="Pourquoi ces chiffres ?">?</button></h4>' +
    '<span class="aide">Chaque famille garde son rendement habituel : les livrets et le fonds euros à leur taux (celui de ton fichier quand il est saisi), la bourse à ' + pctR(TAUX_REPLI.bourse) + ' par an en moyenne sur longue période. Le scénario prudent retire ' + F0.format(ECART_SCENARIO * 100) + ' points par an à tout, l\'optimiste en ajoute ' + F0.format(ECART_SCENARIO * 100) + '. La bourse peut perdre 20 % ou plus certaines années : la vraie courbe ne sera jamais aussi lisse.</span>' +
    '<ul class="pj-hyp"><li>Départ : ton patrimoine financier d\'aujourd\'hui, ' + kEurP(Math.round(P.v / 1000) * 1000) + " (épargne, bourse, assurance-vie). L'immobilier ne compte pas.</li>" +
      "<li>Chaque mois : " + eur(P.c) + (P.plus ? " + " + eur(P.plus) + " (curseur)" : "") + " versés" + (P.source ? " (ton rythme : " + esc(P.source) + ")" : "") + ". Fin 2034, tu auras versé en tout ≈ " + kEurP(Math.round(P.verse / 1000) * 1000) + ", le reste vient des intérêts.</li>" +
      "<li>Rendement central : " + pctR(ce.r) + " par an (" + esc(familles) + ").</li>" +
      (art ? "<li>Artema : rendez-vous chaque début décembre de 2029 à 2033, fin le 1er décembre 2034 (◆ sur la frise). La courbe ne suppose aucun remboursement anticipé.</li>" : "") + apresPret +
      "<li>Ni impôts, ni inflation, ni retraits. Un repère pour se projeter, pas une prévision.</li></ul></div></div>";
  return acc("m-proj", "Projection 2034", "fin 2034 ≈ " + kEurP(Math.round(ce.fin / 1000) * 1000) + " (central)", corps, true);
}
function brancherProjection(v) {
  const z = v.querySelector(".m-proj"); if (!z) return;
  z.querySelectorAll(".qm-b").forEach(q => q.addEventListener("click", e => { e.preventDefault(); const a = q.closest("[data-aide]"); if (a) a.classList.toggle("aide-on"); }));
  const r = z.querySelector("#pj-plus"); if (!r) return;
  r.addEventListener("input", () => {
    projPlus = Math.max(0, Math.min(PLUS_MAX, Math.round(+r.value / PLUS_PAS) * PLUS_PAS));
    const P = calculProjection(projPlus); if (!P) return;
    z.querySelector("#pj-graph").innerHTML = svgProjection2034(P);
    z.querySelector("#pj-plus-v").textContent = "+" + F0.format(projPlus) + " €";
    z.querySelector("#pj-plus-t").innerHTML = phrasePlus(P);
    const tu = z.querySelectorAll(".pj-t b"); P.sc.forEach((x, i) => { if (tu[i]) tu[i].textContent = kEurP(Math.round(x.fin / 1000) * 1000); });
    const leg = z.querySelector(".pj-leg"), bs = leg && leg.querySelector(".bs");
    if (leg && projPlus && !bs) leg.insertAdjacentHTML("beforeend", '<span class="pj-bs"><i class="bs"></i>sans le curseur</span>'); else if (leg && !projPlus && bs) bs.parentNode.remove();
  });
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
  add({ d: finDuMois(new Date()), ico: "🏁", t: "Relevé du mois pour le Versus", s: M.versusLie === true ? "ton fichier l'envoie tout seul" : "à saisir dans le Versus en fin de mois", k: "versus", rrule: "FREQ=MONTHLY;BYMONTHDAY=-1" });
  // Artema : photo de départ, rendez-vous, fin
  if (aArtema()) {
    if (auj <= ARTEMA.photo[1]) add({ d: ARTEMA.photo[0], ico: "📸", t: "Artema : photo de départ", s: "moyenne des 2, 3 et 4 décembre 2026", k: "art-photo" });
    ARTEMA.rdv.forEach((x, i) => add({ d: x[0], ico: "🎯", t: x[3] ? "Artema : fin du produit" : "Artema : rendez-vous " + (i + 1) + " sur 5", s: x[3] ? "dernière constatation de l'indice" : "si l'indice est au moins à son départ : arrêt, capital + " + pc1(x[2]) + " %", k: "art-" + i, loin: true }));
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
    add({ d: an + "-12-31", ico: "🏦", t: "Intérêts des livrets", s: "versés sur tes livrets le 31 décembre", k: "liv-int", rrule: "FREQ=YEARLY" });
    [an + "-02-01", an + "-08-01", (an + 1) + "-02-01"].filter(d => d >= auj).slice(0, 1).forEach(d => add({ d, ico: "📣", t: "Nouveau taux possible du Livret A", s: "révisé en principe le 1er février et le 1er août", k: "liv-taux" }));
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
    '<div class="chips" role="group" aria-label="J\'en aurai besoin dans">' + HORIZONS.map(([k, l]) => '<button class="chip" type="button" data-eu-h="' + k + '" aria-pressed="' + (h === k) + '">' + l + "</button>").join("") + "</div>" +
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
  const maj = () => { const m = lireNombre(z.querySelector("#eu-m").value); z.querySelector("#eu-res").innerHTML = resComparateur(m > 0 ? m : 1000, PREF.euroH || "moyen", ETAT.discret === "oui"); };
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
const LIB_TYPE = { "Apport": "Versement", "Intérêts": "Dividende / intérêts", "Relevé": "Relevé", "Ajustement espèces": "Correction d'espèces", "Solde initial": "Solde de départ", "Frais en parts": "Frais en parts" };
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
  "Achat": "Montant débité, frais compris", "Vente": "Montant crédité, net de frais", "Apport": "Montant viré sur le compte",
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
  const t = String(v).replace(/[\s  €]/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return isFinite(n) ? n : NaN;
}
/* v16.83 · « 1.500 » : point des milliers (1 500 €) ou virgule (1,5 €) ? Pour les montants en € seulement, on demande toujours
   (jamais de conversion en silence) ; ni les quantités, ni les cours, ni le niveau d'indice ne sont concernés */
function millierDouteux(v) { return /^\d{1,3}(\.\d{3})+$/.test(String(v === null || v === undefined ? "" : v).replace(/[\s  €]/g, "")); }
function lectureMilliers(v) { const t = String(v).replace(/[\s  €]/g, ""); return { milliers: t.replace(/\./g, ""), virgule: (t.match(/\./g) || []).length === 1 ? saisieNombre(+t, 6) : null }; }
function mediane(l) { const x = l.filter(v => v > 0).sort((a, b) => a - b); return x.length ? x[Math.floor(x.length / 2)] : 0; }
function saisieNombre(n, dec) { return n === null || n === undefined || !isFinite(n) ? "" : String(+n.toFixed(dec)).replace(".", ","); }
function refData() { return (M && M.ref) || { enveloppes: [], types: [], actifs: [], cours: {}, detenu: [], journal: [], raccourcis: [] }; }
function quantiteTenue(env, code) { const x = refData().detenu.find(d => d.env === env && d.code === code); return x ? x.qte : 0; }
function typeInfo(nom) { return refData().types.find(t => t.nom === nom) || { tresorerie: 0, quantite: 0, flux: 0 }; }
function qteBrute(v) { return !ok(v) ? "—" : nf(0, 6).format(v); }   // quantités de la saisie : jamais masquées

/** Dernière enveloppe utilisée si elle existe encore dans le fichier, sinon la première */
function envParDefaut() {
  const l = (refData().enveloppes || []).map(e => typeof e === "string" ? e : e.nom), der = stock.get("versus.moi.derniereEnv");
  return der && (!l.length || l.includes(der)) ? der : (l[0] || der || "");
}
/* v16.97 · pré-remplissage : le dernier compte utilisé POUR CE TYPE (sinon le dernier tout court), le dernier actif acheté sur ce compte,
   le cours connu, le montant habituel d'un versement, les frais de la dernière fois. Jamais pour « Refaire » ni « Vider » (auto: false) */
function envsParType() { try { return JSON.parse(stock.get("versus.moi.envType") || "{}") || {}; } catch (e) { return {}; } }
function envPourType(type) {
  const ouv = (refData().enveloppes || []).filter(e => typeof e !== "string" && (!e.statut || e.statut === "Ouvert" || e.statut === "À ouvrir"));
  const m = envsParType()[type];
  if (m && ouv.some(e => e.nom === m)) return m;
  if (type === "Relevé" || type === "Frais en parts") { const av = ouv.find(e => e.regime === "AV"); if (av) return av.nom; }
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
  const f = Object.assign({ type: "Achat", date: aujourdhuiISO(), env: "", actif: "", qte: "", prix: "", pilote: "", montant: "", frais: "", apport: false, montantApport: "", forcer: null, erreur: "",
    prixAuto: false, montantAuto: false, montantHab: false, fraisAuto: false, actifAuto: false, envChoisi: false }, p);
  delete f.auto;
  if (!f.env) f.env = (auto && envPourType(f.type)) || envParDefaut();
  if (!f.pilote) f.pilote = f.qte ? "qte" : "prix";
  if (f.type === "Achat" && !("apport" in p)) f.apport = true;   // cas le plus courant : on vire l'argent puis on achète
  if (auto) preRemplir(f);
  if (AVEC_QTE.includes(f.type) && f.actif && !f.prix && !f.qte) { const c = refData().cours[f.actif]; if (c) { f.prix = saisieNombre(c, c < 10 ? 4 : 2); f.prixAuto = true; } }
  return f;
}
function depuisRaccourci(rc) {
  return { type: rc.type, env: rc.env, actif: rc.actif || "", montant: rc.montant !== null && rc.montant !== undefined ? saisieNombre(rc.montant, 2) : "", frais: rc.frais ? saisieNombre(rc.frais, 2) : "", qte: rc.quantite ? saisieNombre(rc.quantite, 6) : "", apport: !!rc.apport, montantApport: rc.montantApport ? saisieNombre(rc.montantApport, 2) : "" };
}
function assurerFeuille() {
  if ($f("m-saisie")) return;
  const d = document.createElement("div");
  d.className = "voile"; d.id = "m-saisie"; d.hidden = true;
  d.innerHTML = '<div class="feuille moi m-feuille" role="dialog" aria-modal="true" aria-labelledby="m-titre-saisie">' +
    '<h3 id="m-titre-saisie">Saisir <button class="icon-btn" type="button" id="m-fermer-saisie" aria-label="Fermer"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></h3>' +
    '<div class="seg m-seg4" role="group" aria-label="Saisie">' +
      '<button type="button" data-m-pane="ordre">Mouvement</button><button type="button" data-m-pane="journal">Historique</button>' +
      '<button type="button" data-m-pane="maj">Mes comptes</button><button type="button" data-m-pane="versus">Relevé Versus</button></div>' +
    '<div id="m-pane-ordre"></div><div id="m-pane-journal" hidden></div><div id="m-pane-maj" hidden></div></div>';
  document.body.appendChild(d);
  d.addEventListener("click", e => { if (e.target === d) fermerSaisieM(); });
  $f("m-fermer-saisie").addEventListener("click", fermerSaisieM);
  d.querySelectorAll("[data-m-pane]").forEach(b => b.addEventListener("click", () => {
    confirmeSuppr = null;
    if (b.dataset.mPane === "versus") { fermerSaisieM(); if (typeof ouvrirSaisie === "function") ouvrirSaisie(); return; }
    paneSaisie(b.dataset.mPane);
  }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") fermerSaisieM(); });
}
/* Guide de la saisie d'un ordre de bourse : s'ouvre tout seul la première fois, puis depuis « ❓ » */
const TUTO_ORDRE = [
  { ico: "🧾", t: "Saisir un ordre, en bref", html: true, p:
    "<b>1 ordre = 1 ligne</b>, recopiée de ton courtier à la date d'exécution.<br>" +
    "• <b>Achat</b> : le compte, l'actif et le montant de l'avis d'opéré <b>frais compris</b> sont proposés ; le nombre de parts se calcule avec le cours (corrige-le si besoin). Le <b>versement</b> qui paie l'achat est coché : décoche si l'argent était déjà sur le compte.<br>" +
    "• <b>Versement</b> : l'argent que tu mets sur un compte (ton montant habituel est proposé).<br>" +
    "• <b>Relevé</b> : la valeur d'une ligne d'assurance-vie, recopiée de ton relevé.<br>" +
    "• <b>Autres</b> : vente, retrait, dividende, frais… ; chaque type s'explique quand tu le choisis.<br>" +
    "La date (aujourd'hui), les frais et le prix par part sont sous <b>Plus de détails</b>.<br>" +
    "Relis la phrase 📝 avant de valider. Une erreur ? Onglet <b>Historique</b> : supprimable pendant 7 jours." }
];
function guideOrdre() { if (typeof ouvrirGuide === "function") ouvrirGuide("Saisir un ordre", TUTO_ORDRE, "C'est compris"); }
function ouvrirSaisieM(partiel, onglet) {
  injecterStyle(); assurerFeuille(); lireCache();
  if (!M) { toast("Lecture de ton fichier en cours, réessaie dans un instant."); charger(false); return; }
  F = formulaire(partiel);
  synchroniser();
  nommerRaccourci = false; detailsOuverts = false; plusTypes = false;
  $f("m-saisie").hidden = false;
  paneSaisie(onglet || "ordre");
  if ((onglet || "ordre") === "ordre" && identiteSure() && !stock.get(cleStock("guideOrdre")) && !simulationM()) { stock.set(cleStock("guideOrdre"), "1"); setTimeout(guideOrdre, 250); }
}
function fermerSaisieM() { const s = $f("m-saisie"); if (s) s.hidden = true; confirmeSuppr = null; gererRaccourcis = false; }
function paneSaisie(o) {
  document.querySelectorAll("[data-m-pane]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mPane === o)));
  ["ordre", "journal", "maj"].forEach(k => { $f("m-pane-" + k).hidden = k !== o; });
  if (o === "ordre") rendreFormulaire(); else if (o === "journal") rendreJournal(); else rendreMaj();
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
  if (F.pilote === "qte" && (F.montantAuto || !String(F.montant || "").trim())) {
    const q = lireNombre(F.qte), p = lireNombre(F.prix) || coursActif(), fr = lireNombre(F.frais) || 0;
    if (q > 0 && p > 0) { F.montant = saisieNombre(q * p - (isNaN(fr) ? 0 : fr) * typeInfo(F.type).tresorerie, 2); F.montantAuto = true; }
    else if (F.montantAuto) { F.montant = ""; F.montantAuto = false; }
  }
  const net = netOrdre();
  if (!(net > 0)) return;
  if (F.pilote === "prix") {
    const p = F.prixAuto && coursActif() ? coursActif() : lireNombre(F.prix);
    if (p > 0) {
      let q = net / p; const e = Math.round(q);
      if (F.prixAuto && e >= 1 && Math.abs(q - e) <= .02 * q && Math.abs(q - e) > 1e-9 && partsEntieres()) { q = e; F.arrondi = true; F.prix = saisieNombre(net / q, 4); }
      else if (F.prixAuto) F.prix = saisieNombre(p, p < 10 ? 4 : 2);
      F.qte = saisieNombre(q, 6);
    }
  }
  else { const q = lireNombre(F.qte); if (q > 0) F.prix = saisieNombre(net / q, 4); }
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
/* ---- 14.5 · Nouvel actif directement dans la saisie d'ordre ---- */
function boiteNouvelActif() {
  const na = F.na;
  return '<div class="m-na" style="margin-top:8px;padding:10px;border:1px solid var(--rule-2);border-radius:10px">' +
    '<b style="display:block;margin-bottom:6px">Nouvel actif</b>' +
    '<div class="rang"><div class="champ"><label for="fn-code">Code (court)</label><input id="fn-code" type="text" autocomplete="off" autocapitalize="characters" placeholder="ex. CW8" value="' + esc(na.code) + '"></div>' +
    '<div class="champ"><label for="fn-nom">Nom</label><input id="fn-nom" type="text" autocomplete="off" autocapitalize="sentences" placeholder="ex. Amundi MSCI World" value="' + esc(na.nom) + '"></div></div>' +
    '<div class="champ"><label for="fn-ticker">Ticker Google Finance</label><div class="ligne-champ"><input id="fn-ticker" type="text" autocomplete="off" autocapitalize="characters" placeholder="ex. EPA:CW8" value="' + esc(na.ticker) + '"><button class="mini-btn" type="button" id="fn-verif">Vérifier</button></div>' +
    '<span class="aide" id="fn-res">' + esc(na.msg || "EPA: pour Paris, ETR: pour Xetra, CURRENCY:ETHEUR pour une crypto.") + "</span></div>" +
    '<button class="btn" type="button" id="fn-ok">Créer et choisir</button> <button class="lien" type="button" id="fn-ko" style="margin-left:10px">Annuler</button></div>';
}
function brancherNouvelActif() {
  const lire = () => { F.na.code = ($f("fn-code").value || "").trim().toUpperCase(); F.na.nom = ($f("fn-nom").value || "").trim(); F.na.ticker = ($f("fn-ticker").value || "").trim().toUpperCase(); };
  ["fn-code", "fn-nom", "fn-ticker"].forEach(id => $f(id).addEventListener("input", lire));
  const msg = t => { F.na.msg = t; const el = $f("fn-res"); if (el) el.textContent = t; };
  $f("fn-ko").addEventListener("click", () => { F.na = null; rendreFormulaire(); });
  $f("fn-verif").addEventListener("click", async () => {
    lire(); if (!F.na.ticker) { msg("Saisis d'abord un ticker."); return; }
    msg("Vérification auprès de Google Finance…");
    const rep = await posterFichier({ action: "verifierTicker", ticker: F.na.ticker });
    if (rep.ok) { if (!F.na.nom && rep.nom) { F.na.nom = rep.nom; $f("fn-nom").value = rep.nom; } msg("✓ " + F.na.ticker + " reconnu : " + cours(rep.cours) + (rep.nom ? " · " + rep.nom : "")); }
    else msg(rep.message || "Ticker introuvable.");
  });
  $f("fn-ok").addEventListener("click", async () => {
    lire(); const na = F.na, r = refData();
    if (!/^[A-Z0-9_]{2,12}$/.test(na.code) || !na.nom) { msg("Code (2 à 12 lettres ou chiffres) et nom obligatoires."); return; }
    if (r.actifs.some(x => x.code === na.code)) { msg("Le code " + na.code + " existe déjà : choisis-le dans la liste."); return; }
    if (!na.ticker) { msg("Indique le ticker Google Finance (le cours manuel se règle dans Réglages › Moi)."); return; }
    const env = r.enveloppes.find(e => e.nom === F.env) || {};
    const a = { code: na.code, nom: na.nom, ticker: na.ticker, classe: env.regime === "Crypto" ? "Crypto" : "Actions", zone: "Monde", levier: 1, coursManuel: null };
    const b = $f("fn-ok"); b.disabled = true; b.textContent = "Création…";
    const rep = await posterFichier({ action: "actif", actif: a });
    if (!rep.ok) { b.disabled = false; b.textContent = "Créer et choisir"; msg(rep.message || "Erreur inattendue."); return; }
    r.actifs.push({ code: a.code, nom: a.nom, classe: a.classe });
    F.actif = a.code; F.na = null; toast("Actif " + a.code + " créé : tu peux saisir ton ordre."); rendreFormulaire();
  });
}
let plusTypes = false;
/* V15.2 : aides masquables (« Masquer les aides » en bas de la saisie), retenu sur l'appareil */
function majAides() { const f = document.querySelector("#m-saisie .m-feuille"); if (f) f.classList.toggle("sans-aide", PREF.aides === false); }
let detailsOuverts = false;
/* v16.97 · ce qui est replié sous « Plus de détails », résumé en une ligne (rien n'est caché sans qu'on le voie) */
function resumeDetails() {
  const an = String(new Date().getFullYear()), d = F.date || "";
  const parts = [d === aujourdhuiISO() ? "aujourd'hui" : d ? "le " + (d.slice(0, 4) === an ? d.slice(8, 10) + "/" + d.slice(5, 7) : frDate(d)) : "date à choisir"];
  if (AVEC_FRAIS.includes(F.type)) { const fr = lireNombre(F.frais); parts.push(fr > 0 ? "frais " + nf(2, 2).format(fr) + NB + "€" : "sans frais"); }
  if (F.type === "Achat" && F.apport) { const ma = lireNombre(F.montantApport); if (ma > 0) parts.push("versement " + nf(0, 2).format(ma) + NB + "€"); }
  return parts.join(" · ");
}
/* v16.97 · les petites phrases sous les champs calculés ou pré-remplis (toujours visibles, même « aides masquées ») */
function aidesCalcul() {
  const c = coursActif(), out = { montant: "", qte: "", frais: "" };
  if (F.montantAuto && AVEC_QTE.includes(F.type)) out.montant = "Estimé : nombre de parts × cours (" + cours(lireNombre(F.prix) || c) + ")" + (lireNombre(F.frais) > 0 ? (F.type === "Vente" ? " − frais" : " + frais") : "") + ". Remplace-le par le montant exact de ton avis d'opéré.";
  else if (F.montantHab && F.type === "Apport") out.montant = "Ton versement habituel sur ce compte : change-le si besoin.";
  if (AVEC_QTE.includes(F.type) && F.pilote === "prix" && lireNombre(F.qte) > 0) out.qte = F.prixAuto && c ? "Calculé avec le cours connu (" + cours(c) + ")" + (F.arrondi ? ", arrondi à des parts entières" : "") + ". Corrige-le si ton avis d'opéré dit autre chose." : "Calculé avec ton prix par part.";
  if (F.fraisAuto && AVEC_FRAIS.includes(F.type)) out.frais = "Comme ta dernière opération de ce type sur ce compte.";
  return out;
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
  if (AVEC_ACTIF.includes(F.type) && !F.actif && F.type !== "Achat" && tenus.length) { F.actif = tenus[0]; F = formulaire(Object.assign({}, F, { auto: false })); synchroniser(); }
  const avecActif = AVEC_ACTIF.includes(F.type), avecQte = AVEC_QTE.includes(F.type), avecFrais = AVEC_FRAIS.includes(F.type);
  const chipT = t => '<button type="button" class="chip" data-type="' + esc(t) + '" aria-pressed="' + (F.type === t) + '">' + esc(libType(t)) + "</button>";
  const courantsAutres = autres.filter(t => (AUTRES_TYPES[t] || { g: "Courant" }).g === "Courant"), raresAutres = autres.filter(t => !courantsAutres.includes(t));
  const hab = F.type === "Apport" && ETAT.discret === "oui" && !String(F.montant || "").trim() ? montantHabituel(F.env) : 0;
  const A = aidesCalcul();
  $f("m-pane-ordre").innerHTML =
    '<form class="form" id="m-form-ordre" novalidate>' +
      (PREF.aides === false ? "" : '<button class="lien guide-l" type="button" id="f-guide">❓ Comment saisir un ordre</button>') +
      rendreRaccourcis() +
      '<div class="types" role="group" aria-label="Type d\'opération">' + courants.map(t => '<button type="button" class="type-btn" data-type="' + t + '" aria-pressed="' + (F.type === t) + '">' + esc(libType(t)) + "</button>").join("") +
        '<button type="button" class="type-btn plus-types" id="f-plus-types" aria-pressed="' + autreType + '" aria-expanded="' + panneau + '">Autres' + (panneau ? " ▴" : " ▾") + "</button></div>" +
      (!panneau ? "" : '<div class="m-autres" role="group" aria-label="Autres types">' + courantsAutres.map(chipT).join("") +
        (raresAutres.length ? '<span class="m-autres-t">Plus rares</span>' + raresAutres.map(chipT).join("") : "") + "</div>") +
      (AUTRES_TYPES[F.type] && PREF.aides !== false ? '<p class="info">ℹ️ <b>' + esc(AUTRES_TYPES[F.type].lib) + "</b> : " + esc(AUTRES_TYPES[F.type].d) + "</p>" : "") +
      '<div class="champ"><label for="fo-env">Compte</label><select id="fo-env">' +
        groupeEnv(ouvertes.filter(e => e.perimetre === "Portefeuille"), "Bourse") + groupeEnv(ouvertes.filter(e => e.perimetre !== "Portefeuille"), "Épargne") + "</select></div>" +
      (avecActif ? '<div class="champ"><label for="f-actif">Actif</label><select id="f-actif"><option value="">Choisir l\'actif…</option>' +
        (tenus.length ? '<optgroup label="Détenus sur ce compte">' + tenus.map(optA).join("") + "</optgroup>" : "") +
        '<optgroup label="Autres actifs">' + autresActifs.map(optA).join("") + "</optgroup></select>" +
        (F.na ? boiteNouvelActif() : '<span class="aide">Actif absent de la liste ? <button class="lien" type="button" id="f-nouvel-actif">Ajouter un nouvel actif</button></span>') + "</div>" : "") +
      '<div class="champ"><label for="f-montant">' + esc(LIB_MONTANT[F.type] || "Montant") + ' (€)</label><input id="f-montant" type="text" inputmode="decimal" autocomplete="off" value="' + esc(F.montant) + '" placeholder="0,00"' + (F.montantAuto || F.montantHab ? ' class="auto"' : "") + ">" +
        '<span class="calc" id="f-montant-calc"' + (A.montant ? "" : " hidden") + ">" + esc(A.montant) + "</span>" +
        (hab > 0 ? '<button class="lien" type="button" id="f-hab">Reprendre ton versement habituel</button>' : "") +
        (F.type === "Achat" || F.type === "Vente" ? '<span class="aide">Recopie-le depuis ton avis d\'opéré (le document de ton courtier).</span>' : "") + "</div>" +
      (avecQte ? '<div class="champ"><label for="f-qte">Nombre de parts</label><input id="f-qte" type="text" inputmode="decimal" autocomplete="off" value="' + esc(F.qte) + '" placeholder="0">' +
        '<span class="calc" id="f-qte-calc"' + (A.qte ? "" : " hidden") + ">" + esc(A.qte) + "</span></div>" : "") +
      (F.type === "Achat" ? '<label class="coche"><input type="checkbox" id="f-apport"' + (F.apport ? " checked" : "") + '> Avec le versement qui paie cet achat</label>' +
        '<span class="aide lie">' + (F.apport ? "L'argent viré est enregistré juste avant l'achat." : "Décoché : l'argent était déjà sur le compte (vente, dividende, versement précédent).") + "</span>" : "") +
      '<details class="m-plus" id="f-details"' + (detailsOuverts ? " open" : "") + '><summary>Plus de détails <small id="f-details-res">' + esc(resumeDetails()) + "</small></summary><div class=\"m-plus-c\">" +
        '<div class="champ"><label for="f-date">Date</label><input id="f-date" type="date" value="' + esc(F.date) + '"></div>' +
        (avecQte ? '<div class="champ"><label for="f-prix">Prix par part (€)</label><input id="f-prix" type="text" inputmode="decimal" autocomplete="off" value="' + esc(F.prix) + '" placeholder="0,00"><span class="aide">Se calcule tout seul ; tape-le si tu connais le prix mais pas le nombre de parts.</span></div>' : "") +
        (avecFrais ? '<div class="champ"><label for="f-frais">Dont frais (€)</label><input id="f-frais" type="text" inputmode="decimal" autocomplete="off" value="' + esc(F.frais) + '" placeholder="0,00">' +
          '<span class="calc" id="f-frais-calc"' + (A.frais ? "" : " hidden") + ">" + esc(A.frais) + '</span><span class="aide">Les frais de courtage (0 ou vide si tu n\'en as pas).</span></div>' : "") +
        (F.type === "Achat" && F.apport ? '<div class="champ"><label for="f-mapport">Montant du versement (€)</label><input id="f-mapport" type="text" inputmode="decimal" autocomplete="off" value="' + esc(F.montantApport) + '" placeholder="Comme l\'achat"><span class="aide">Laisse vide : même montant que l\'achat.</span></div>' : "") +
      "</div></details>" +
      '<p class="phrase-ordre" id="m-phrase"></p>' +
      '<div class="recap" id="m-recap"></div>' +
      '<div class="alertes" id="m-alertes"></div>' +
      '<button class="btn plein acc" type="submit" id="f-envoyer">' + esc(libBoutonOrdre()) + '</button>' +
      '<div class="pied-form">' +
        (nommerRaccourci
          ? '<div class="nommer"><input id="f-nom-rac" type="text" maxlength="40" aria-label="Nom du raccourci" value="' + esc(nomParDefaut()) + '"><button class="mini-btn" type="button" id="rac-ok">Créer</button><button class="lien" type="button" id="rac-annuler">Annuler</button></div>'
          : '<button class="lien" type="button" id="rac-creer">Enregistrer comme raccourci</button>') +
        '<button class="lien" type="button" id="f-vider">Vider le formulaire</button>' +
        '<button class="lien" type="button" id="f-aides">' + (PREF.aides === false ? "Afficher les aides" : "Masquer les aides") + "</button>" +
      "</div>" +
    "</form>";
  const form = $f("m-form-ordre");
  if ($f("f-guide")) $f("f-guide").addEventListener("click", guideOrdre);
  $f("f-details").addEventListener("toggle", () => { detailsOuverts = $f("f-details").open; });
  form.querySelectorAll("[data-type]").forEach(b => b.addEventListener("click", () => {
    const t = b.dataset.type; if (t === F.type) return;
    plusTypes = !courants.includes(t);
    const env = F.envChoisi ? F.env : envPourType(t) || envParDefaut() || F.env;
    F = formulaire({ type: t, date: F.date, env: env, envChoisi: F.envChoisi, actif: AVEC_ACTIF.includes(t) && env === F.env ? F.actif : "", montant: F.montantAuto || F.montantHab ? "" : F.montant });
    synchroniser(); rendreFormulaire();
  }));
  $f("f-plus-types").addEventListener("click", () => { plusTypes = !panneau; if (!plusTypes && autreType) F = formulaire({ type: "Achat", date: F.date, env: F.env, envChoisi: F.envChoisi }); rendreFormulaire(); });
  $f("f-aides").addEventListener("click", () => { PREF.aides = PREF.aides === false; garderPref(); majAides(); rendreFormulaire(); });
  $f("fo-env").addEventListener("change", e => { F = formulaire({ type: F.type, date: F.date, env: e.target.value, envChoisi: true, montant: F.montantAuto || F.montantHab ? "" : F.montant, frais: F.fraisAuto ? "" : F.frais }); synchroniser(); rendreFormulaire(); });
  if ($f("f-actif")) $f("f-actif").addEventListener("change", e => { F = formulaire({ type: F.type, date: F.date, env: F.env, envChoisi: F.envChoisi, actif: e.target.value, montant: F.montantAuto ? "" : F.montant, frais: F.frais, fraisAuto: F.fraisAuto, apport: F.apport, montantApport: F.montantApport, auto: false }); synchroniser(); rendreFormulaire(); });
  if ($f("f-apport")) $f("f-apport").addEventListener("change", e => { F.apport = e.target.checked; rendreFormulaire(); });
  if ($f("f-hab")) $f("f-hab").addEventListener("click", () => { F.montant = saisieNombre(hab, 2); F.montantHab = true; rendreFormulaire(); });
  // 14.5 : le nouvel actif se crée ici même, sans quitter la saisie d'ordre
  if ($f("f-nouvel-actif")) $f("f-nouvel-actif").addEventListener("click", () => { F.na = { code: "", nom: "", ticker: "", msg: "" }; rendreFormulaire(); setTimeout(() => { const el = $f("fn-code"); if (el) el.focus(); }, 30); });
  if (F.na) brancherNouvelActif();
  [["f-date", "date"], ["f-montant", "montant"], ["f-frais", "frais"], ["f-mapport", "montantApport"], ["f-qte", "qte"], ["f-prix", "prix"]].forEach(([id, k]) => {
    const el = $f(id);
    if (!el) return;
    el.addEventListener("input", () => {
      F[k] = el.value; F.forcer = null; F.erreur = "";
      if (k === "qte" || k === "prix") F.pilote = k;
      if (k === "prix") F.prixAuto = false;
      if (k === "montant") { F.montantAuto = false; F.montantHab = false; el.classList.remove("auto"); }
      if (k === "frais") F.fraisAuto = false;
      synchroniser();
      if (k !== "qte" && $f("f-qte")) $f("f-qte").value = F.qte;
      if (k !== "prix" && $f("f-prix")) $f("f-prix").value = F.prix;
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
    nommerRaccourci = false;
    sauverRaccourcis(liste);
    rendreFormulaire();
    toast("Raccourci « " + nom + " » créé.");
  });
  $f("f-vider").addEventListener("click", () => { F = formulaire({ type: F.type, env: F.env, envChoisi: F.envChoisi, auto: false }); nommerRaccourci = false; rendreFormulaire(); });
  form.addEventListener("submit", e => { e.preventDefault(); envoyerOrdre(false); });
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
function analyser() {
  const r = refData(), t = typeInfo(F.type);
  const q = lireNombre(F.qte), m = lireNombre(F.montant), fr = lireNombre(F.frais) || 0;
  const msg = [], lignes = [];
  let bloque = false;
  if (!F.date) { bloque = true; msg.push(["err", "Choisis une date."]); }
  if (AVEC_ACTIF.includes(F.type) && !F.actif) bloque = true;
  if (m === null) bloque = true;
  else if (isNaN(m)) { bloque = true; msg.push(["err", "Montant illisible."]); }
  else if (F.type !== "Ajustement espèces" && m <= 0) { bloque = true; msg.push(["err", "Le montant doit être positif : c'est le type qui donne le sens."]); }
  /* v16.78 · relevé d'assurance-vie : un montant bien plus petit que la ligne ressemble au prix d'UNE part (ex. 99,96 € au lieu de ~15 850 €) */
  if (F.type === "Relevé" && F.actif && m > 0 && M && M.histoAV) {
    let ref = 0; (M.histoAV.ordres || []).forEach(o => { if (o[2] !== F.actif) return; if (o[1] === "Relevé" && o[3] > ref * .2) ref = o[3]; else if (o[1] === "Achat") ref += o[3]; else if (o[1] === "Vente") ref -= o[3]; });
    if (ref > 0 && m < ref * .2) msg.push(["warn", "Ce montant ressemble au prix d'une seule part. Sur ton relevé, prends la VALEUR TOTALE de la ligne (environ " + Math.round(ref).toLocaleString("fr-FR") + " €)."]);
  }
  /* v16.83 · un apport bien plus petit que d'habitude (comme le garde-fou du relevé) */
  if (F.type === "Apport" && m > 0) {
    const hab = mediane((r.journal || []).filter(o => o.type === "Apport" && o.enveloppe === F.env && !o.envoi).map(o => o.montant));
    if (hab > 0 && m < hab * .2) msg.push(["warn", "Ce montant est bien plus petit que tes versements habituels sur " + F.env + " (environ " + Math.round(hab).toLocaleString("fr-FR") + " €) : vérifie la virgule."]);
  }
  const doutes = [["montant", "f-montant"]].concat(AVEC_FRAIS.includes(F.type) ? [["frais", "f-frais"]] : [], F.type === "Achat" && F.apport ? [["montantApport", "f-mapport"]] : []).filter(([k]) => millierDouteux(F[k]));
  if (doutes.length) bloque = true;
  if (AVEC_QTE.includes(F.type)) {
    if (q === null) bloque = true;
    else if (isNaN(q) || q <= 0) { bloque = true; msg.push(["err", "La quantité doit être supérieure à 0."]); }
  }
  if (isNaN(fr) || (fr && m > 0 && fr > m)) { bloque = true; msg.push(["err", "Les frais doivent être positifs et inférieurs au montant."]); }
  const tenu = F.actif ? quantiteTenue(F.env, F.actif) : 0;
  const c = F.actif ? r.cours[F.actif] : null;
  if ((F.type === "Vente" || F.type === "Frais en parts") && F.actif) {
    lignes.push(["Détenu aujourd'hui", qteBrute(tenu) + " " + esc(F.actif) + (tenu > 0 && F.type === "Vente" ? ' <button class="mini-btn" type="button" id="tout-vendre">Tout</button>' : "")]);
    if (q > tenu + 1e-9) { bloque = true; msg.push(["err", "Tu ne détiens que " + qteBrute(tenu) + " " + F.actif + " dans " + F.env + "."]); }
  }
  if ((F.type === "Achat" || F.type === "Vente") && q > 0 && m > 0 && c) {
    const pu = (m + fr * t.tresorerie) / q;
    lignes.push(["Cours actuel", nf(c < 1 ? 4 : 2, c < 1 ? 4 : 2).format(c) + NB + "€ · écart " + pct(pu / c - 1)]);
    if (Math.abs(pu / c - 1) > .5) msg.push(["warn", "Écart de plus de 50 % avec le cours actuel : vérifie la quantité et le montant (virgule mal placée ?)."]);
  }
  if (F.actif && q > 0 && t.quantite) lignes.push(["Détenu après l'ordre", qteBrute(+(tenu + q * t.quantite).toFixed(6)) + " " + esc(F.actif)]);
  if (F.type === "Achat" && F.apport) {
    const ma = lireNombre(F.montantApport);
    if (ma !== null && (isNaN(ma) || ma <= 0)) { bloque = true; msg.push(["err", "Montant de l'apport illisible."]); }
    lignes.push(["Versement enregistré avant l'achat", nf(2, 2).format(ma === null ? m : ma) + NB + "€"]);
  }
  if (F.date && F.date > aujourdhuiISO()) msg.push(["warn", "Ordre programmé : il restera ignoré par les calculs jusqu'au " + frDate(F.date) + "."]);
  return { bloque, msg, lignes, doutes };
}
/** La phrase de relecture : l'ordre dit en une phrase courte et naturelle, pour repérer une erreur d'un coup d'œil (v16.92) */
function phraseOrdre() {
  const m = lireNombre(F.montant), q = lireNombre(F.qte), fr = lireNombre(F.frais), ma = lireNombre(F.montantApport);
  if ((!(m > 0) && F.type !== "Ajustement espèces") || millierDouteux(F.montant)) return "";   // v16.83 : pas de « 1,50 € » relu tant que « 1.500 » est en doute
  if (m === null || !isFinite(m) || m === 0) return "";
  const B = x => "<b>" + x + "</b>", e = v => { const d = Number.isInteger(+v.toFixed(2)) ? 0 : 2; return B(nf(d, d).format(v) + NB + "€"); };
  const env = B(esc(F.env || "?")), an = String(new Date().getFullYear());
  const quand = (F.date || "").slice(0, 4) === an ? (F.date || "").slice(8, 10) + "/" + (F.date || "").slice(5, 7) : frDate(F.date), le = ", le " + B(quand);
  const actifs = refData().actifs || [], a = actifs.find(x => x.code === F.actif), nomA = esc(a && a.nom && a.nom.length <= 22 ? a.nom : F.actif || "");
  const de = n => (/^[aeiouyhàâéèêîôû]/i.test(n) ? "d'" : "de ") + B(n);
  const titres = AVEC_QTE.includes(F.type) && q > 0 ? de(qteBrute(q) + " " + esc(F.actif)).replace(/^d'/, "de ") : F.actif ? de(nomA) : "";
  const frais = !AVEC_FRAIS.includes(F.type) ? "" : fr > 0 ? " (dont " + e(fr) + " de frais)" : " (sans frais)";
  let t;
  switch (F.type) {
    case "Achat": t = "Achat " + titres + " pour " + e(m) + frais + " sur " + env + le + ". " + (F.apport ? "Avec un versement de " + e(ma > 0 ? ma : m) + "." : "Sans versement (argent déjà sur le compte)."); break;
    case "Vente": t = "Vente " + titres + " pour " + e(m) + frais + " sur " + env + le + "."; break;
    case "Apport": t = "Versement de " + e(m) + " sur " + env + le + "."; break;
    case "Retrait": t = "Retrait de " + e(m) + " sur " + env + le + "."; break;
    case "Intérêts": t = "Dividende ou intérêts de " + e(m) + " reçus sur " + env + le + "."; break;
    case "Frais": t = "Frais de " + e(m) + " débités sur " + env + le + "."; break;
    case "Relevé": {
      const plusieursAV = (refData().enveloppes || []).filter(x => x.regime === "AV").length > 1;
      t = "Valeur " + (F.actif ? de(nomA) + " " : "") + "sur ton relevé" + (plusieursAV ? " (" + env + ")" : "") + " : " + e(m) + " au " + B(quand) + "."; break; }
    case "Frais en parts": t = "Frais prélevés en parts : " + (q > 0 ? B(qteBrute(q) + " " + esc(F.actif)) + " pour " : "") + e(m) + " sur " + env + le + "."; break;
    case "Ajustement espèces": t = "Ajustement des espèces de " + e(m) + " sur " + env + le + "."; break;
    case "Solde initial": t = "Solde de départ de " + e(m) + " sur " + env + ", au " + B(quand) + "."; break;
    default: t = esc((AUTRES_TYPES[F.type] || {}).lib || F.type) + " de " + e(m) + " sur " + env + le + ".";
  }
  return "📝 " + t;
}
function majRecap() {
  const a = analyser();
  if ($f("m-phrase")) { const ph = phraseOrdre(); $f("m-phrase").innerHTML = ph; $f("m-phrase").hidden = !ph; }
  $f("m-recap").innerHTML = a.lignes.map(l => "<div><span>" + l[0] + "</span><b>" + l[1] + "</b></div>").join("");
  $f("m-recap").hidden = !a.lignes.length;
  /* v16.97 · phrases des champs calculés, résumé de « Plus de détails », qu'on ouvre tout seul si un champ replié pose problème */
  const A = aidesCalcul();
  [["f-montant-calc", "montant"], ["f-qte-calc", "qte"], ["f-frais-calc", "frais"]].forEach(([id, k]) => { const el = $f(id); if (el) { el.textContent = A[k]; el.hidden = !A[k]; } });
  if ($f("f-details-res")) $f("f-details-res").textContent = resumeDetails();
  const replie = !F.date || (a.doutes || []).some(([k]) => k !== "montant") || a.msg.some(m => m[0] === "err" && /frais|apport/i.test(m[1]));
  if (replie && $f("f-details") && !$f("f-details").open) { $f("f-details").open = true; detailsOuverts = true; }
  let al = a.msg.map(m => '<div class="alerte ' + m[0] + '">' + esc(m[1]) + "</div>").join("");
  (a.doutes || []).forEach(([k]) => { const t = String(F[k]).trim(), l = lectureMilliers(t);
    al += '<div class="alerte warn">« ' + esc(t) + ' » veut dire ' + esc((+l.milliers).toLocaleString("fr-FR")) + NB + '€ ?<br><button class="btn" type="button" data-millier="' + k + '" data-mv="' + esc(l.milliers) + '">Oui, ' + esc((+l.milliers).toLocaleString("fr-FR")) + NB + "€</button>" +
      (l.virgule ? ' <button class="btn ghost" type="button" data-millier="' + k + '" data-mv="' + esc(l.virgule) + '">Non, ' + esc(l.virgule) + NB + "€</button>" : "") + "</div>"; });
  if (F.erreur) al += '<div class="alerte err">' + esc(F.erreur) + "</div>";
  if (F.forcer) al += '<div class="alerte warn">' + esc(F.forcer) + '<br><button class="btn" type="button" id="forcer">Enregistrer quand même</button></div>';
  $f("m-alertes").innerHTML = al;
  const btn = $f("f-envoyer");
  btn.disabled = a.bloque;
  btn.textContent = libBoutonOrdre();
  if ($f("tout-vendre")) $f("tout-vendre").addEventListener("click", () => { F.qte = saisieNombre(quantiteTenue(F.env, F.actif), 8); F.pilote = "qte"; synchroniser(); $f("f-qte").value = F.qte; if ($f("f-prix")) $f("f-prix").value = F.prix; majRecap(); });
  if ($f("forcer")) $f("forcer").addEventListener("click", () => envoyerOrdre(true));
  $f("m-alertes").querySelectorAll("[data-millier]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.millier, id = { montant: "f-montant", frais: "f-frais", montantApport: "f-mapport" }[k];
    F[k] = b.dataset.mv; if ($f(id)) $f(id).value = F[k];
    synchroniser(); if ($f("f-qte")) $f("f-qte").value = F.qte; if ($f("f-prix")) $f("f-prix").value = F.prix;
    majRecap();
  }));
}
/* v16.83 · le bouton dit ce qu'on enregistre (un Relevé n'est pas un « ordre ») */
function libBoutonOrdre() {
  return F.type === "Achat" && F.apport ? "Enregistrer le versement et l'achat" : ({ "Relevé": "Enregistrer la valeur", "Apport": "Enregistrer le versement", "Retrait": "Enregistrer le retrait", "Intérêts": "Enregistrer les intérêts", "Frais": "Enregistrer les frais", "Solde initial": "Enregistrer le solde", "Achat": "Enregistrer l'achat", "Vente": "Enregistrer la vente", "Frais en parts": "Enregistrer les frais", "Ajustement espèces": "Enregistrer l'ajustement" })[F.type] || "Enregistrer l'ordre";
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
  const sauvegarde = Object.assign({}, F);
  fermerSaisieM();
  toast("Enregistrement de l'ordre…");
  const enAttente = ordres.map(o => Object.assign({ app: false, envoi: true, ligne: 0 }, o, { quantite: o.quantite === undefined ? null : o.quantite }));
  if (M && M.ref) M.ref.journal = enAttente.reverse().concat(M.ref.journal || []);
  const rep = await posterFichier({ action: "ordre", ordres: ordres, forcer: !!forcer });
  if (M && M.ref) M.ref.journal = (M.ref.journal || []).filter(o => !o.envoi);
  if (rep.ok) { if (window.SONS) SONS.succes(); toast(rep.message || "Ordre enregistré."); charger(true); return; }
  if (rep.erreur === "cle") { cleRefusee(rep.message); toast("Clé refusée par ton fichier."); if (vueMoi()) rendre(); return; }
  if (rep.erreur === "incertain") { toast("L'ordre a peut-être été enregistré : vérifie l'Historique avant de renvoyer."); charger(true); return; }   // v16.83 : jamais rouvert rempli (doublon)
  toast(rep.erreur === "avertissement" ? "Ordre à confirmer." : "Ordre non enregistré.");
  F = sauvegarde;
  if (rep.erreur === "avertissement") F.forcer = rep.message; else F.erreur = rep.message || "Erreur inattendue.";
  $f("m-saisie").hidden = false;
  paneSaisie("ordre");
}
function rendreJournal() {
  const j = refData().journal || [];
  const auj = aujourdhuiISO();
  const z = $f("m-pane-journal");
  if (!j.length) { z.innerHTML = '<div class="vide">Aucun ordre pour l\'instant.</div>'; return; }
  z.innerHTML = '<p class="info">Les 30 derniers ordres de ton onglet Ordres. « Refaire » reprend un ordre à la date du jour ; seuls les ordres saisis depuis l\'app depuis moins de 7 jours peuvent être supprimés.</p><div class="m-jo">' +
    j.map((o, i) => '<div class="jr' + (o.envoi ? " envoi" : "") + '"><div class="jd">' + o.date.slice(8, 10) + "/" + o.date.slice(5, 7) + "<small>" + o.date.slice(0, 4) + "</small></div>" +
      '<div class="jm"><b>' + esc(o.type) + (o.actif ? " " + esc(o.actif) : "") + (o.envoi ? '<span class="tag app">envoi…</span>' : "") + (o.date > auj ? '<span class="tag prog">programmé</span>' : "") + (o.app ? '<span class="tag app">saisi ici</span>' : "") + "</b>" +
      "<span>" + esc(o.enveloppe) + (o.quantite !== null && o.quantite !== undefined ? " · " + qteBrute(o.quantite) + " part" + (o.quantite > 1 ? "s" : "") : "") + (o.frais ? " · frais " + eur(o.frais, 2) : "") + "</span></div>" +
      '<div class="jv">' + eur(o.montant, 2) + "</div>" +
      (o.envoi ? "" : '<div class="ja"><button class="lien" type="button" data-refaire="' + i + '">Refaire</button>' +
      (o.app ? '<button class="lien danger" type="button" data-suppr="' + i + '">' + (confirmeSuppr === i ? "Confirmer la suppression" : "Supprimer") + "</button>" : "") + "</div>") + "</div>").join("") + "</div>";
  z.querySelectorAll("[data-refaire]").forEach(b => b.addEventListener("click", () => {
    const o = j[+b.dataset.refaire];
    ouvrirSaisieM({ type: o.type, env: o.enveloppe, actif: o.actif || "", qte: o.quantite !== null && o.quantite !== undefined ? saisieNombre(o.quantite, 8) : "", montant: saisieNombre(o.montant, 2), frais: o.frais ? saisieNombre(o.frais, 2) : "", auto: false }, "ordre");
  }));
  z.querySelectorAll("[data-suppr]").forEach(b => b.addEventListener("click", async () => {
    const i = +b.dataset.suppr;
    if (confirmeSuppr !== i) { confirmeSuppr = i; rendreJournal(); return; }
    confirmeSuppr = null;
    const o = j[i];
    M.ref.journal = j.filter((x, k) => k !== i);
    rendreJournal();
    toast("Suppression en cours…");
    const rep = await posterFichier({ action: "supprimer", ordre: o });
    if (rep.ok) { toast(rep.message || "Ordre supprimé."); charger(true); }
    else { toast(rep.message || "Suppression impossible."); M.ref.journal = j; if (!$f("m-saisie").hidden) rendreJournal(); }
  }));
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
function rendreMaj() {
  const z = $f("m-pane-maj"); const p = (M && M.parametres) || null;
  if (!p) { z.innerHTML = '<p class="info">Paramètres de ton fichier indisponibles.</p>'; return; }
  const r = refData();
  const utile = x => cleRappel(x.nom) && ((x.prochaine && /^\d{4}-/.test(x.prochaine)) || /À faire|mettre à jour/i.test(x.statut || ""));
  const htmlRap = x => {
    const k = cleRappel(x.nom);
    const etat = /À faire|mettre à jour/i.test(x.statut) ? "faire" : /À jour|Fait/.test(x.statut) ? "ok" : "neutre";
    const quand = x.prochaine && /^\d{4}-/.test(x.prochaine) ? "prochaine le " + frDate(x.prochaine) : (x.derniere && !/^\d{4}-/.test(String(x.derniere)) ? String(x.derniere) : (x.derniere ? "dernière le " + frDate(x.derniere) : ""));
    const ouvert = reglageOuvert === k;
    return '<div class="rap' + (ouvert ? " ouvert" : "") + '" data-reg="' + k + '">' +
      (k ? '<button type="button" class="rap-h" data-rap="' + k + '" aria-expanded="' + ouvert + '">' : '<div class="rap-h fixe">') + '<span class="pt ' + etat + '"></span><span class="rap-n">' + esc(nomCourtRappel(x)) + "<small>" + esc(etat === "faire" ? "à faire " + quandRappel(x) : quandRappel(x) ? "prochaine " + quandRappel(x) : quand) + "</small></span>" +
      '<span class="st ' + etat + '">' + (etat === "faire" ? "À faire" : etat === "ok" ? "À jour" : "—") + "</span>" + (k ? "</button>" : "</div>") +
      (ouvert ? '<div class="rap-c">' + formReglage(k) + "</div>" : "") + "</div>";
  };
  const tous = rappelsFichier(), autres = tous.filter(x => !utile(x));
  const rappels = tous.filter(utile).sort((x, y) => (/À faire/i.test(y.statut || "") ? 1 : 0) - (/À faire/i.test(x.statut || "") ? 1 : 0) || String(x.prochaine).localeCompare(String(y.prochaine))).map(htmlRap).join("") +
    (autres.length ? '<details class="rap-autres"><summary>Valeurs fixes du fichier (' + autres.length + ") · rarement à changer</summary>" + autres.map(htmlRap).join("") + "</details>" : "");
  const alertes = M.alertes || [];
  const codesAlerte = Array.from(new Set((r.detenu || []).map(d => d.code).concat(r.actifs.filter(a => r.cours[a.code]).map(a => a.code))));
  const classes = Array.from(new Set((p.classes || []).concat(["Actions", "Obligations", "Or", "Crypto", "Monétaire", "Immobilier"])));
  const zones = Array.from(new Set((p.zones || []).concat(["Monde", "États-Unis", "Europe", "France", "Émergents", "Asie"])));
  const opt = (l, v) => l.map(x => '<option value="' + esc(x) + '"' + (x === v ? " selected" : "") + ">" + esc(x) + "</option>").join("");
  const mA = reglageMsg.actif ? '<div class="alerte ' + reglageMsg.actif[0] + '">' + esc(reglageMsg.actif[1]) + "</div>" : "";
  const mAl = reglageMsg.alertes ? '<div class="alerte ' + reglageMsg.alertes[0] + '">' + esc(reglageMsg.alertes[1]) + "</div>" : "";
  const pre = alertePre || {};
  z.innerHTML =
    (reglageOuvert && !rappelsFichier().some(x => cleRappel(x.nom) === reglageOuvert) && formReglage(reglageOuvert) ? '<div class="rap ouvert seul" data-reg="' + reglageOuvert + '"><div class="rap-c">' + formReglage(reglageOuvert) + "</div></div>" : "") +
    '<h4 class="m-h4">Rappels <small>touche une ligne pour la mettre à jour</small></h4><div class="raps">' + rappels + "</div>" +
    '<details class="maj-pli" data-reg="actif"' + (reglageMsg.actif ? " open" : "") + '><summary>➕ Ajouter un actif <small>aussi possible pendant la saisie d\'un ordre</small></summary>' +
      '<form class="form reg-form" data-form="actif">' +
        '<div class="rang">' + champ("a-code", "Code (court, unique)", "", { ph: "ex. CW8", texte: "maj" }) + champ("a-nom", "Nom", "", { ph: "ex. Amundi MSCI World", texte: true }) + "</div>" +
        '<div class="champ"><label for="a-ticker">Ticker Google Finance</label><div class="ligne-champ"><input id="a-ticker" type="text" autocomplete="off" autocapitalize="characters" placeholder="ex. EPA:CW8"><button class="mini-btn" type="button" id="a-verif">Vérifier</button></div><span class="aide" id="a-verif-res">EPA: pour Paris, ETR: pour Xetra, CURRENCY:ETHEUR pour une crypto. Sans ticker, saisis un cours manuel.</span></div>' +
        '<div class="rang">' +
          '<div class="champ"><label for="a-classe">Classe</label><select id="a-classe">' + opt(classes, "Actions") + "</select></div>" +
          '<div class="champ"><label for="a-zone">Zone</label><select id="a-zone">' + opt(zones, "Monde") + "</select></div>" +
        "</div>" +
        '<div class="rang">' +
          '<div class="champ"><label for="a-levier">Levier</label><select id="a-levier"><option>1</option><option>2</option><option>3</option></select></div>' +
          champ("a-manuel", "Cours manuel (€)", "", { ph: "si pas de ticker" }) +
        "</div>" + mA +
        '<button class="btn" type="submit">Ajouter l\'actif</button>' +
      "</form></details>" +
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
  const v = $f("a-verif");
  if (v) v.addEventListener("click", async () => {
    const t = ($f("a-ticker").value || "").trim().toUpperCase();
    const res = $f("a-verif-res");
    if (!t) { res.textContent = "Saisis d'abord un ticker."; return; }
    v.disabled = true; res.textContent = "Vérification auprès de Google Finance…";
    const rep = await posterFichier({ action: "verifierTicker", ticker: t });
    v.disabled = false;
    if (rep.ok) { res.textContent = "✓ " + t + " reconnu : " + cours(rep.cours) + (rep.nom ? " · " + rep.nom : ""); if (!$f("a-nom").value && rep.nom) $f("a-nom").value = rep.nom; }
    else res.textContent = rep.message || "Ticker introuvable.";
  });
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
const SERIES = [3, 6, 12, 18, 24, 36, 48, 60];
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
  let run = 0, record = 0; const atteintes = {};
  liste.forEach(x => { run = x.ok ? run + 1 : 0; if (run > record) record = run; SERIES.forEach(n => { if (run >= n && !atteintes[n]) atteintes[n] = x.m; }); });
  const moisEnCours = !!vers[auj];
  let actuelle = 0;
  for (let i = liste.length - 1 - (moisEnCours ? 0 : 1); i >= 0 && liste[i].ok; i--) actuelle++;
  return { actuelle, record, moisEnCours, liste, atteintes };
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
const FAMILLES = [
  ["pat", "Patrimoine financier", true], ["serie", "Séries de versements", true], ["vente", "Sans vendre", true], ["gainsAn", "Année en cours", true],
  ["bourse", "Portefeuille bourse", false], ["verse", "Argent versé en bourse", false], ["gains", "Gains cumulés", false],
  ["mois", "Mois avec un versement (au total)", false], ["annee", "Ancienneté", false], ["fisc", "Fiscalité allégée", false]
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
  parSeuil("pat", [5000, 10000, 25000, 50000, 75000, 100000, 150000, 200000, 250000, 300000, 500000, 750000, 1000000], pat, s.financier || 0, x => F0.format(x) + " € de patrimoine financier", "(bourse + épargne)");
  const h = M.historique, rows = h && h.rows ? h.rows : [];
  const kv = h ? h.cols.indexOf("v") : -1, ka = h ? h.cols.indexOf("a") : -1;
  const sh = k => rows.map(r => ({ m: String(r[0]).slice(0, 4) + "-" + String(r[0]).slice(4, 6), v: k(r) }));
  if (rows.length && kv >= 0 && ka >= 0) {
    parSeuil("bourse", [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000], sh(r => r[kv]), s.valeur || 0, x => F0.format(x) + " € en bourse");
    parSeuil("verse", [5000, 10000, 25000, 50000, 100000, 200000], sh(r => r[ka]), s.apports || 0, x => F0.format(x) + " € versés en bourse au total");
    parSeuil("gains", [500, 1000, 5000, 10000, 25000, 50000, 100000], sh(r => r[kv] - r[ka]), s.gain || 0, x => F0.format(x) + " € de gains cumulés", "de gains");
  }
  const sv = serieVersements();
  SERIES.forEach(n => {
    const atteint = sv.record >= n;
    let quand = null, run = 0;
    if (atteint) for (const x of sv.liste) { run = x.ok ? run + 1 : 0; if (run >= n) { quand = x.m; break; } }
    ajoute("serie", "serie" + n, n + "M", n + " mois d'affilée avec un versement", atteint, quand, sv.actuelle / n, "série actuelle : " + sv.actuelle + " / " + n + " mois", n + " MOIS");
  });
  let total = 0; const cumul = {};
  sv.liste.forEach(x => { if (x.ok) { total++; if (!cumul[total]) cumul[total] = x.m; } });
  [12, 24, 36, 50, 100].forEach(n => ajoute("mois", "mois" + n, n + "×", n + " mois avec un versement depuis le début", total >= n, cumul[n] || null, total / n, total + " / " + n + " mois", n + " MOIS"));
  if (p.premier) {
    const depuis = p.derniereVente || p.premier;
    const jours = Math.floor((Date.now() - new Date(depuis + "T00:00:00")) / 864e5);
    (M.simple ? [] : [[6, "6M", "6 mois sans vendre"], [12, "1AN", "1 an sans vendre"], [24, "2ANS", "2 ans sans vendre"], [36, "3ANS", "3 ans sans vendre"]]).forEach(([mo, court, titre]) => {
      const d0 = new Date(depuis + "T00:00:00"), d = new Date(d0.getFullYear(), d0.getMonth() + mo, 1);
      d.setDate(Math.min(d0.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));   // 31/08 + 6 mois = 28/02
      const date = isoJour(d), tot = Math.round((d - new Date(depuis + "T00:00:00")) / 864e5), atteint = date <= auj;
      ajoute("vente", "vente" + mo + "-" + depuis, court, titre, atteint, atteint ? date.slice(0, 7) : null, jours / tot,
        (p.derniereVente ? "dernière vente le " + frDate(p.derniereVente) + " · " : "") + jours + " j / " + tot + " · le " + frDate(date) + " sans vente", court.replace(/(\d)([A-Z])/, "$1 $2"));
    });
    [1, 2, 3, 5, 10].forEach(n => {
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
  const an = new Date().getFullYear(), b = bilanAnneeM(an);
  if (b && b.verse > 0) {
    const atteint = b.gain > b.verse;
    ajoute("gainsAn", "gains" + an, "G>V", "Les gains " + an + " dépassent tes versements de l'année", atteint, atteint ? moisAuj : null,
      Math.max(0, b.gain) / b.verse, "gains " + eur(b.gain, 0, true) + " · versements " + eur(b.verse), "GAINS > VERSÉ");
  }
  return out;
}
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
  ["terminal", "Terminal", "palette", "Écran"], ["reveil", "Réveil", "seg", "Segments"]
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
  ["platine", "Platine", "#F1F5F9", "radial-gradient(120% 90% at 85% 0%, rgba(241,245,249,.25), transparent 60%), linear-gradient(150deg, #15171B, #3A3F47 60%, #17191D)"]
];
// [id, nom, couleur (null = celle du thème), effet de la courbe]
const COURBES_M = [["classique", "Classique", null, null], ["etincelles", "Étincelles", null, "etincelles"], ["or", "Or", "#E8B931", "halo"],
  ["neon", "Néon", "#FF4FD8", "halo"], ["comete", "Comète", "#2FD1C0", "comete"], ["flammes", "Flammes", "#FF7A1A", "flammes"],
  ["menthe", "Menthe", "#34D399", null], ["corail", "Corail", "#FF7F6B", null], ["lavande", "Lavande", "#A78BFA", "halo"], ["glace", "Glace", "#7DD3FC", "etincelles"],
  ["rubis", "Rubis", "#F43F5E", "halo"], ["soleil", "Soleil", "#FACC15", "comete"], ["plasma", "Plasma", "#22D3EE", "halo"], ["braise", "Braise", "#F97316", "etincelles"], ["argent", "Argent", "#CBD5E1", "comete"]];
// [id, nom, aperçu, style passé à confettis()]
const FETES_M = [["confettis", "Confettis", "🎊", null], ["damier", "Damier", "🏁", "damier"], ["feu", "Feu d'artifice", "🎆", "feu"], ["billets", "Pluie de billets", "💸", "billets"],
  ["lingots", "Lingots", "🪙", "lingots"], ["etoiles", "Étoiles", "✨", "etoiles"], ["fusees", "Fusées", "🚀", "fusees"],
  ["ballons", "Ballons", "🎈", ["🎈", "🎈", "🎉", "🎈"]], ["fleurs", "Pétales", "🌸", ["🌸", "🌼", "🌷", "🌸"]], ["coeurs", "Cœurs", "💚", ["💚", "💙", "💜", "💛"]], ["neige", "Flocons", "❄️", ["❄️", "❄️", "✨", "❄️"]],
  ["trefles", "Trèfles", "🍀", ["🍀", "🍀", "✨", "🌿"]], ["diamants", "Diamants", "💎", ["💎", "💎", "✨", "💍"]], ["taureaux", "Taureaux", "🐂", ["🐂", "📈", "🐂", "💹"]], ["champagne", "Champagne", "🍾", ["🍾", "🥂", "✨", "🎉"]]];
const EMBLEMES_M = [["pousse", "Pousse", "🌱"], ["abeille", "Abeille", "🐝"], ["hibou", "Hibou", "🦉"], ["tortue", "Tortue", "🐢"], ["renard", "Renard", "🦊"],
  ["aigle", "Aigle", "🦅"], ["lion", "Lion", "🦁"], ["dragon", "Dragon", "🐉"], ["couronne", "Couronne", "👑"], ["taureau", "Taureau", "🐂"],
  ["fourmi", "Fourmi", "🐜"], ["ecureuil", "Écureuil", "🐿️"], ["castor", "Castor", "🦫"], ["dauphin", "Dauphin", "🐬"], ["loup", "Loup", "🐺"],
  ["chene", "Chêne", "🌳"], ["boussole", "Boussole", "🧭"], ["ancre", "Ancre", "⚓"], ["phare", "Phare", "🗼"], ["comete-e", "Comète", "☄️"]];
const TITRES_M = [["investisseur", "Investisseur"], ["metronome", "Le Métronome"], ["diamant", "Main de diamant"], ["batisseur", "Bâtisseur"], ["rentier", "Rentier"],
  ["veteran", "Vétéran"], ["optimiseur", "Optimiseur fiscal"], ["legende", "Légende"], ["millionnaire", "Millionnaire"], ["increvable", "Increvable"],
  ["fourmi", "La Fourmi"], ["regulier", "Régulier"], ["horloger", "L'Horloger"], ["patient", "Patient"], ["capitaine", "Capitaine"],
  ["stratege", "Stratège"], ["marathonien", "Marathonien"], ["sage", "Le Sage"], ["roc", "Le Roc"], ["maitre", "Maître du temps"]];
const SORTES = [["aff", "Afficheur", "🔢", "afficheur"], ["theme", "Thème", "🎨", "themeM"], ["courbe", "Courbe", "📈", "courbe"],
  ["fete", "Fête", "🎉", "fete"], ["emb", "Emblème", "🛡️", "emb"], ["titre", "Titre", "🏷️", "titre"]];
const CATALOGUE = { aff: AFFICHEURS, theme: THEMES_M, courbe: COURBES_M, fete: FETES_M, emb: EMBLEMES_M, titre: TITRES_M };
const BASE_M = { aff: "classique", theme: "classique", courbe: "classique", fete: "confettis", emb: "pousse", titre: "investisseur" };
/* Récompenses par famille de paliers : la k-ième case va au k-ième palier pair (2e, 4e…), la dernière au dernier palier. */
const REC_FAM = {
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
/* V15.4 · Régularité : chaque mois où tu verses débloque l'objet suivant de cette liste (les mois versés, pas forcément d'affilée) */
const REGULARITE_M = [["emb", "fourmi"], ["courbe", "menthe"], ["theme", "lagon"], ["titre", "fourmi"], ["fete", "ballons"], ["emb", "ecureuil"], ["courbe", "corail"], ["theme", "lavande"],
  ["titre", "regulier"], ["fete", "fleurs"], ["emb", "castor"], ["courbe", "lavande"], ["theme", "sahara"], ["titre", "horloger"], ["fete", "coeurs"], ["emb", "dauphin"], ["courbe", "glace"],
  ["theme", "foret"], ["titre", "patient"], ["fete", "neige"], ["emb", "loup"], ["courbe", "rubis"], ["theme", "corail"], ["titre", "capitaine"], ["fete", "trefles"], ["emb", "chene"],
  ["courbe", "soleil"], ["theme", "acier"], ["titre", "stratege"], ["fete", "diamants"], ["emb", "boussole"], ["courbe", "plasma"], ["theme", "cerise"], ["titre", "marathonien"],
  ["fete", "taureaux"], ["emb", "ancre"], ["courbe", "braise"], ["theme", "ocean"], ["titre", "sage"], ["emb", "phare"], ["theme", "menthe"], ["courbe", "argent"], ["theme", "volcan"],
  ["fete", "champagne"], ["titre", "roc"], ["emb", "comete-e"], ["theme", "nuit-etoilee"], ["theme", "platine"], ["titre", "maitre"]];
function moisVerses() { try { return serieVersements().liste.filter(x => x.ok).length; } catch (e) { return 0; } }
/* Récompenses cachées : calculées sur tes relevés (ou sur tes visites, pour deux d'entre elles) */
const SECRETS_M = [
  { id: "sangfroid", nom: "Sang-froid", indice: "Garde la main quand tout baisse.", quoi: "Un versement un mois où ton portefeuille a perdu 5 % ou plus.", rec: [["courbe", "flammes"]] },
  { id: "rond", nom: "Compte rond", indice: "Un chiffre bien net…", quoi: "Une bourse qui tombe à 2 € près sur un millier tout rond.", rec: [["aff", "reveil"]] },
  { id: "verte", nom: "Sept à la suite", indice: "Encore, encore, encore…", quoi: "Sept relevés en hausse d'affilée.", rec: [["emb", "taureau"]] },
  { id: "increvable", nom: "Increvable", indice: "Tomber, puis remonter plus haut.", quoi: "Une baisse de 10 % depuis un sommet, puis un nouveau sommet.", rec: [["titre", "increvable"]] },
  { id: "noctambule", nom: "Noctambule", indice: "Les marchés dorment, pas toi.", quoi: "Ouvrir Moi entre minuit et 5 h.", rec: [["aff", "terminal"]] },
  { id: "fidele", nom: "Fidèle", indice: "Passe voir tes chiffres…", quoi: "Ouvrir Moi sept jours d'affilée.", rec: [["fete", "etoiles"]] },
  { id: "nouvelan", nom: "Bonne année", indice: "Commence l'année du bon pied.", quoi: "Un premier relevé de l'année au-dessus du dernier de l'année d'avant.", rec: [["fete", "fusees"]] },
  { id: "parfaite", nom: "Année parfaite", indice: "Douze sur douze.", quoi: "Un versement chacun des douze mois d'une année.", rec: [["theme", "aurore"]] }
];
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
  if (stock.get("versus.moi.nuit") === "1") ok.add("noctambule");
  let l = []; try { l = JSON.parse(stock.get("versus.moi.jours") || "[]"); } catch (e) { l = []; }
  let suite = 1; for (let i = 1; i < l.length; i++) { suite = (new Date(l[i] + "T12:00:00") - new Date(l[i - 1] + "T12:00:00")) / 864e5 === 1 ? suite + 1 : 1; if (suite >= 7) { ok.add("fidele"); break; } }
  return ok;
}
/* Palier → récompenses (selon la règle « un palier sur deux + le dernier ») */
function recompensesPaliers(pal) {
  const map = new Map();
  FAMILLES.forEach(([g]) => {
    const l = pal.filter(x => x.groupe === g), R = REC_FAM[g]; if (!R || !l.length) return;
    const cases = l.map((x, i) => i).filter(i => i % 2 === 1 || i === l.length - 1);
    cases.forEach((i, j) => { const r = j === cases.length - 1 ? R[R.length - 1] : j < R.length - 1 ? R[j] : null; if (r) map.set(l[i].id, r); });
  });
  return map;
}
let MEMO_OBJ = { m: null, ok: null, pal: null, rec: null, sec: null };
function etatObjets() {
  if (MEMO_OBJ.m === M && M) return MEMO_OBJ;
  const ok = new Set(Object.entries(BASE_M).map(([t, id]) => cleObj(t, id)));
  let vus = []; try { vus = JSON.parse(stock.get(cleStock("objets")) || "[]"); } catch (e) { vus = []; }
  if (!M || !M.personne || M.personne === ETAT.moi) try { JSON.parse(stock.get("versus.moi.afficheurs") || "[]").forEach(id => { if (defObj("aff", id)) ok.add(cleObj("aff", id)); }); } catch (e) { /* ancien format */ }
  vus.forEach(k => ok.add(k));
  let pal = [], rec = new Map(), sec = new Set();
  if (M) {
    try { pal = paliers(); rec = recompensesPaliers(pal); pal.forEach(x => { if (x.atteint && rec.has(x.id)) rec.get(x.id).forEach(([t, id]) => ok.add(cleObj(t, id))); }); } catch (e) { /* données incomplètes */ }
    try { REGULARITE_M.slice(0, moisVerses()).forEach(([t, id]) => ok.add(cleObj(t, id))); } catch (e) { /* pas de parcours */ }
    try { sec = secretsAtteints(); SECRETS_M.forEach(s => { if (sec.has(s.id)) s.rec.forEach(([t, id]) => ok.add(cleObj(t, id))); }); } catch (e) { /* idem */ }
    if (identiteSure()) stock.set(cleStock("objets"), JSON.stringify(Array.from(ok)));
  }
  MEMO_OBJ = { m: M, ok, pal, rec, sec };
  return MEMO_OBJ;
}
function oublierObjets() { MEMO_OBJ = { m: null, ok: null, pal: null, rec: null, sec: null }; }
function actifM(t) { const s = SORTES.find(x => x[0] === t), v = PREF[s[3]] || BASE_M[t]; return M && etatObjets().ok.has(cleObj(t, v)) && defObj(t, v) ? v : BASE_M[t]; }
function afficheurActif() { return actifM("aff"); }
function themeActif() { return defObj("theme", actifM("theme")); }
function couleurMoi() { const t = themeActif(); return t && t[2] ? t[2] : maCouleur(); }
function equiper(t, id) { const s = SORTES.find(x => x[0] === t); PREF[s[3]] = id; garderPref(); if (t === "aff") dernierFlap = ""; }
/* D'où vient un objet (pour le « ? ») */
function origineObj(t, id) {
  if (BASE_M[t] === id) return { base: true };
  const E = etatObjets();
  for (const s of SECRETS_M) if (s.rec.some(r => r[0] === t && r[1] === id)) return { secret: s, ok: E.sec.has(s.id) };
  for (const [pid, l] of E.rec) if (l.some(r => r[0] === t && r[1] === id)) return { palier: E.pal.find(x => x.id === pid) };
  { const i = REGULARITE_M.findIndex(r => r[0] === t && r[1] === id); if (i >= 0) return { regul: i + 1, faits: moisVerses() }; }
  for (const [g, R] of Object.entries(REC_FAM)) if (R.some(c => c.some(r => r[0] === t && r[1] === id))) return { famille: (FAMILLES.find(f => f[0] === g) || [, g])[1] };
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
let vsSel = null;
function htmlVestiaire() {
  const E = etatObjets(), t = SORTES.some(x => x[0] === PREF.vest) ? PREF.vest : "aff";
  const tot = Object.values(CATALOGUE).reduce((n, l) => n + l.length, 0), nb = Object.entries(CATALOGUE).reduce((n, [s, l]) => n + l.filter(d => E.ok.has(cleObj(s, d[0]))).length, 0);
  const th = themeActif(), nom = (M && M.personne) || ETAT.moi || "Moi";
  const prof = '<div class="vs-prof' + (th && th[3] ? " th" : "") + '"' + (th && th[3] ? ' style="background:' + th[3] + '"' : "") + '><span class="vs-av">' + apercuEmb(actifM("emb")) + "</span>" +
    "<div><b>" + esc(nom) + "</b><small>« " + esc(nomObj("titre", actifM("titre"))) + " »</small></div>" +
    '<span class="vs-n"><b>' + nb + "</b> / " + tot + "<small>objets</small></span></div>";
  const onglets = '<div class="chips vs-o" role="tablist" aria-label="Sortes d\'objets">' + SORTES.map(([s, l, ic]) => {
    const n = CATALOGUE[s].filter(d => E.ok.has(cleObj(s, d[0]))).length;
    return '<button class="chip" type="button" role="tab" data-vt="' + s + '" aria-pressed="' + (s === t) + '">' + "<b>" + ic + " " + l + "</b><small>" + n + " / " + CATALOGUE[s].length + "</small></button>";
  }).join("") + "</div>";
  const actif = actifM(t);
  const tuiles = CATALOGUE[t].map(d => {
    const id = d[0], o = E.ok.has(cleObj(t, id)), org = o ? null : origineObj(t, id), cache = !o && org.secret;
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
  const E = etatObjets(), o = E.ok.has(vsSel), org = origineObj(t, id), cache = !o && org.secret;
  const sorte = SORTES.find(x => x[0] === t);
  let quoi;
  if (org.base) quoi = "Fourni de base.";
  else if (org.secret) quoi = o || org.ok ? "Récompense cachée « " + esc(org.secret.nom) + " » : " + esc(org.secret.quoi) : "Récompense cachée. Indice : <i>" + esc(org.secret.indice) + "</i>";
  else if (org.palier) { const p = org.palier; quoi = p.atteint ? "Gagné avec le palier « " + esc(p.titre) + " »" + (p.quand ? ", franchi en " + esc(libMois(p.quand)) : "") + "."
      : "À gagner : « " + esc(p.titre) + " » · " + pct(Math.max(0, Math.min(1, p.part)), 0, false) + (p.reste ? " · " + esc(p.reste) : "") + '<span class="jauge"><i style="width:' + Math.round(Math.max(0, Math.min(1, p.part)) * 100) + '%"></i></span>'; }
  else if (org.regul) quoi = org.faits >= org.regul ? "Gagné par ta régularité : ton " + org.regul + (org.regul === 1 ? "er" : "e") + " mois avec un versement."
      : "Régularité : se débloque à ton " + org.regul + (org.regul === 1 ? "er" : "e") + " mois avec un versement (tu en es à " + org.faits + ")." + '<span class="jauge"><i style="width:' + Math.round(Math.min(1, org.faits / org.regul) * 100) + '%"></i></span>';
  else if (org.famille) quoi = o ? "Gagné avec un palier « " + esc(org.famille) + " »." : "À gagner dans les paliers « " + esc(org.famille) + " ».";
  else quoi = o ? "Déjà à toi." : "Pas encore disponible pour ton profil.";
  const actif = actifM(t) === id;
  return '<div class="vs-dl"><span class="vs-di">' + (cache ? "?" : sorte[2]) + "</span><div><b>" + esc(cache ? "???" : d[1]) + "</b> <small>" + esc(sorte[1]) + "</small><p>" + quoi + "</p></div></div>" +
    '<div class="vs-da">' + (o && !actif ? '<button class="btn" type="button" data-vs-eq="' + vsSel + '">Équiper</button>' : o ? '<span class="vs-eq">✓ Équipé</span>' : "") +
      (t === "fete" && !cache ? '<button class="btn ghost" type="button" data-vs-essai="' + id + '">Essayer</button>' : "") + "</div>";
}
function embHero() { return '<i class="m-emb" title="' + esc(nomObj("emb", actifM("emb"))) + '">' + apercuEmb(actifM("emb")) + "</i>"; }
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
  brancherDetail();
}

/* fête d'un palier franchi ou d'une récompense cachée : une seule fois par appareil (au premier lancement, on note sans fêter) */
let paliersVerifies = false;
function verifierPaliers() {
  if (!M || paliersVerifies || !identiteSure()) return;
  if (!vueMoi()) return;   // la fête attend qu'on soit sur Moi (sinon elle tomberait sur le Classement au démarrage)
  paliersVerifies = true;
  noterVisite(); oublierObjets();
  const E = etatObjets();
  const faits = E.pal.filter(x => x.atteint), ids = faits.map(x => x.id);
  let vus = null; try { vus = JSON.parse(stock.get(cleStock("paliers")) || stock.get("versus.moi.paliers") || "null"); } catch (e) { vus = null; }
  const nouveaux = vus === null ? [] : faits.filter(x => !vus.includes(x.id));
  stock.set(cleStock("paliers"), JSON.stringify(Array.from(new Set((vus || []).concat(ids)))));
  let sv = null; try { sv = JSON.parse(stock.get(cleStock("secrets")) || "null"); } catch (e) { sv = null; }
  const secrets = sv === null ? [] : SECRETS_M.filter(s => E.sec.has(s.id) && !sv.includes(s.id));
  stock.set(cleStock("secrets"), JSON.stringify(Array.from(new Set((sv || []).concat(Array.from(E.sec))))));
  // V15.5 : objets gagnés par la régularité (un par mois versé) : fêtés eux aussi, regroupés
  const rv = stock.get(cleStock("regul")), nbR = Math.min(REGULARITE_M.length, moisVerses()), avR = rv === null ? 0 : +rv || 0;
  stock.set(cleStock("regul"), String(nbR));
  const regul = nbR > avR ? [{ regul: true, titre: nbR - avR > 1 ? "Ta régularité paie : " + (nbR - avR) + " nouveaux objets" : "Un mois de plus avec un versement", grand: nbR + " MOIS", recs: REGULARITE_M.slice(avR, nbR), quand: null, id: null }] : [];
  const file = nouveaux.concat(secrets.map(secret => ({ secret, titre: secret.nom, grand: "?!", quand: null, id: null })), regul);
  if (file.length) { const go = () => feter(file[0], file.slice(1)); if (typeof window.ereApres === "function") window.ereApres(go, "feteMoi"); else go(); }   // v16.93 : attend la scène du premier million
}
function feter(x, suite) {
  injecterStyle();
  const o = document.createElement("div");
  o.className = "m-fete moi"; o.setAttribute("role", "dialog"); o.setAttribute("aria-modal", "true");
  const recs = x.recs || (x.secret ? x.secret.rec : (etatObjets().rec.get(x.id) || []));
  const aff = recs.find(r => r[0] === "aff");
  o.innerHTML = '<div><span class="mf-k">' + (x.regul ? "🛡️ Régularité" : x.secret ? "Récompense cachée trouvée" : "Palier franchi") + '</span><div class="m-flaps">' + flaps(x.grand, !reduit, aff ? aff[1] : null) + "</div><h3>" + esc(x.titre) + "</h3>" +
    (x.regul ? "<p>Chaque mois où tu verses débloque un objet. Le prochain : ton " + (moisVerses() + 1) + "<sup>e</sup> mois.</p>" : x.secret ? "<p>" + esc(x.secret.quoi) + "</p>" : x.quand ? "<p>Franchi en " + esc(libMois(x.quand, true)) + ".</p>" : "") +
    (recs.length ? '<p class="mf-af">Débloque :</p><div class="mf-recs">' + recs.map(([t, id]) => {
      const s = SORTES.find(y => y[0] === t);
      return '<button class="mf-rec" type="button" data-mf-eq="' + t + "." + id + '"><span>' + (t === "emb" || t === "fete" ? defObj(t, id)[2] : s[2]) + "</span><b>" + esc(nomObj(t, id)) + "</b><small>" + esc(s[1]) + " · équiper</small></button>";
    }).join("") + "</div>" : "") +
    '<button class="wr-btn" type="button" data-continuer>Continuer</button></div>';
  document.body.appendChild(o);
  const fermer = () => { o.remove(); if (suite && suite.length) feter(suite[0], suite.slice(1)); };   // enchaîne sans trou (la clôture attend la fin des fêtes)
  o.querySelector("[data-continuer]").addEventListener("click", fermer);
  o.querySelectorAll("[data-mf-eq]").forEach(b => b.addEventListener("click", () => {
    const [t, id] = b.dataset.mfEq.split("."); oublierObjets(); equiper(t, id);
    b.classList.add("fait"); b.querySelector("small").textContent = "équipé ✓";
    if (t === "fete") lancerFete(id);
    if (vueMoi()) rendre();
  }));
  const t0 = Date.now(); o.addEventListener("click", e => { if (e.target === o && Date.now() - t0 > 2200) fermer(); });   // V15.9 : laisse l'afficheur finir
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
  if (ETAT.discret !== "oui" || !FAM_EUR.includes(x.groupe)) return x;
  return Object.assign({}, x, { court: "•••", titre: x.titre.replace(/\d[\d\s\u202F\u00A0.,]*\s?€/g, "•••" + NB + "€"), reste: "", cache: true });
}
function htmlMissions() {
  const pal = paliers().map(masquerPalier), nbFaits = pal.filter(x => x.atteint).length;
  const carte = x => '<button type="button" class="palier' + (x.atteint ? " fait" : "") + '" data-palier="' + esc(x.id) + '"' + (x.atteint ? "" : " disabled") + '>' +
    '<span class="pastille">' + esc(x.court) + '</span><span class="pl-t">' + esc(x.titre) + "</span>" +
    (x.atteint ? '<span class="pl-s">✓ franchi en ' + esc(libMois(x.quand)) + "</span>"
               : '<span class="jauge"><i style="width:' + Math.round(Math.max(0, Math.min(1, x.part)) * 100) + '%"></i></span><span class="pl-s">' + esc(x.reste) + "</span>") + "</button>";
  const E = etatObjets(), recDe = id => E.rec.get(id) || [];
  const icone = (t, id) => t === "emb" || t === "fete" ? defObj(t, id)[2] : SORTES.find(x => x[0] === t)[2];
  const htmlRecs = x => { const l = recDe(x.id); return l.length ? '<em class="pl-rec">' + l.map(([t, id]) => "<span>" + icone(t, id) + " " + esc(nomObj(t, id)) + "</span>").join("") + "</em>" : ""; };
  const ligneP = x => '<button type="button" class="pl-r' + (x.atteint ? " fait" : "") + '" data-palier="' + esc(x.id) + '"' + (x.atteint ? "" : " disabled") + '>' +
    '<span class="pastille">' + esc(x.court) + '</span><span class="pl-t">' + esc(x.titre) + htmlRecs(x) + (x.atteint || x.cache ? "" : '<span class="jauge"><i style="width:' + Math.round(Math.max(0, Math.min(1, x.part)) * 100) + '%"></i></span><small>' + esc(x.reste) + "</small>") + "</span>" +
    (x.atteint ? '<span class="pl-s">✓ ' + esc(libMois(x.quand)) + "</span>" : '<span class="pl-s">' + (x.cache ? "•••" : pct(Math.max(0, Math.min(1, x.part)), 0, false)) + "</span>") + "</button>";
  const blocs = FAMILLES.map(([g, nom]) => {
    const l = pal.filter(x => x.groupe === g); if (!l.length) return "";
    const faits = l.filter(x => x.atteint).length, suiv = l.find(x => !x.atteint), cache = l.some(x => x.cache);
    const recs = l.filter(x => !x.atteint).reduce((n, x) => n + recDe(x.id).length, 0);
    return '<details class="pl-bloc' + (suiv ? "" : " complet") + '" data-fam="' + g + '"' + (palOuverts.has(g) ? " open" : "") + "><summary>" +
      '<span class="pb-t">' + esc(nom) + '</span><span class="pb-n">' + (cache ? "•••" : faits + " / " + l.length) + "</span>" +
      '<span class="jauge"><i style="width:' + (cache ? 0 : Math.round(faits / l.length * 100)) + '%"></i></span>' +
      '<span class="pb-s">' + (cache ? "Masqué en mode discret" : suiv ? "Prochain : <b>" + esc(suiv.titre) + "</b> · " + pct(Math.max(0, Math.min(1, suiv.part)), 0, false) : "Tout est franchi ✓") +
        (recs ? ' · <span class="pb-r">🎁 ' + recs + (recs > 1 ? " récompenses" : " récompense") + " à gagner</span>" : "") + "</span>" +
      '</summary><div class="pl-liste">' + l.map(ligneP).join("") + "</div></details>";
  }).join("");
  /* C (v16.93) : million, paliers, bilans, puis le Vestiaire replié */
  return '<div id="m-million-z"></div>' +
    '<div><h2 class="sec">Paliers <small>' + (pal.some(x => x.cache) ? "privé en mode discret" : nbFaits + " franchis sur " + pal.length) + "</small></h2></div>" +
    '<div class="pl-blocs">' + blocs + "</div>" +
    '<p class="info">Un palier sur deux, et toujours le dernier de chaque famille, débloque une récompense pour ton onglet Moi : afficheur, thème, courbe, fête, emblème ou titre. D\'autres sont cachées. Tout reste privé et à toi, même si tu repasses sous le palier. Touche un palier franchi pour revoir sa fête.</p>' +
    htmlBilansMoi() + htmlVestiaire();
}
function brancherMissions(v) {
  const z = v.querySelector("#m-million-z"); if (z) afficherMillion(z);
  v.querySelectorAll("details.pl-bloc").forEach(d => d.addEventListener("toggle", () => { if (d.open) palOuverts.add(d.dataset.fam); else palOuverts.delete(d.dataset.fam); }));
  const pal = paliers();
  brancherVestiaire(v);
  v.querySelectorAll("[data-m-cloture]").forEach(b => b.addEventListener("click", () => ouvrirCloture(+b.dataset.mCloture)));
  v.querySelectorAll("[data-m-bilan]").forEach(b => b.addEventListener("click", () => ouvrirDiapos("Mon patrimoine · " + b.dataset.mBilan, diaposPrivees(+b.dataset.mBilan))));
  v.querySelectorAll("[data-palier]").forEach(b => b.addEventListener("click", () => { const x = pal.find(p => p.id === b.dataset.palier); if (x && x.atteint) feter(x); }));
}

/* ================= Bilan de patrimoine de l'année (privé : seulement sur ton appareil) ================= */
function anneesPrivees() {
  if (!M || !M.historique || !M.historique.rows) return [];
  return Array.from(new Set(M.historique.rows.map(r => Math.floor(r[0] / 10000)))).sort((a, b) => b - a);
}
function diaposPrivees(an) {
  const L = [], b = bilanAnneeM(an), enCours = an === new Date().getFullYear();
  const cls = v => sens(v) === "flat" ? "" : sens(v);
  const s = seriePatrimoine(), av = s.filter(x => x.an < an).pop(), fin = s.filter(x => x.an === an).pop();
  const net = x => x ? x.bourse + x.epargne + x.immo : null;
  const nom = esc(ETAT.moi || "toi");
  L.push({ c: "#F5C542", h: '<div class="wr-k">🔒 Privé · ' + nom + '</div><div class="wr-big titre">Mon patrimoine<br>' + an + '</div><p class="wr-p">' + (enCours ? "Ton année jusqu'ici, au " + dateLongue(b ? b.fin : new Date()) + "." : "Ton année en bourse, en épargne et en pierre.") + " Ces écrans ne sont visibles que sur ton téléphone.</p>" });
  if (fin) {
    const d = av ? net(fin) - net(av) : null;
    L.push({ c: "#9B87FF", h: '<div class="wr-k">Patrimoine net</div><div class="wr-big">' + eur(net(fin)) + "</div>" +
      (d !== null ? '<p class="wr-p">' + (d >= 0 ? "En hausse de" : "En baisse de") + ' <b class="' + cls(d) + '">' + eur(Math.abs(d)) + "</b> sur l'année, de " + eur(net(av)) + " à " + eur(net(fin)) + ".</p>" : '<p class="wr-p">Première année suivie : la comparaison viendra l\'an prochain.</p>') +
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
    const prevE = (M.moisParMois || []).filter(r => +String(r.mois).slice(0, 4) < an && ok(r.epargne)).pop();
    const e0 = prevE ? prevE.epargne + (prevE.uc || 0) : mpm[0].epargne + (mpm[0].uc || 0), e1 = mpm[mpm.length - 1].epargne + (mpm[mpm.length - 1].uc || 0);
    const tot = (M.epargne || []).find(x => /^Total/.test(x.nom));
    L.push({ c: "#F5C542", h: '<div class="wr-k">Ton épargne</div><div class="wr-big">' + eur(e1) + '</div><p class="wr-p">' + (e1 >= e0 ? "En hausse de" : "En baisse de") + " <b>" + eur(Math.abs(e1 - e0)) + "</b> sur l'année (livrets et assurance-vie)." + (e1 < e0 ? " Une partie a sans doute servi à un projet ou à la bourse." : "") + "</p>" +
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
    for (let j = 0; j <= idx; j++) { avant = run; run = sv.liste[j].ok ? run + 1 : 0; rec = Math.max(rec, run); }
    L.push({ c: "#FF8A3D", h: '<div class="wr-k">Ton versement</div>' + (sv.liste[idx].ok
      ? '<div class="wr-mid">Fait ✓</div><div class="cl-serie">' + palette(p2(avant), false) + '<span class="cl-fl" aria-hidden="true">→</span>' + palette(p2(run), !reduit) + "</div>" +
        '<p class="wr-p"><b>' + run + " mois</b> d'affilée avec un versement" + (run > 1 && run >= rec ? " : c'est ton record !" : (rec > run ? " · record " + rec + " mois" : "") + ".") + "</p>"
      : '<div class="wr-mid">Pas ce mois-là</div><p class="wr-p">' + (avant ? "Ta série de <b>" + avant + " mois</b> repart de zéro." : "La série repart de zéro.") + " Un versement ce mois-ci, même 10 €, la relance.</p>") });
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
  for (const r of ((M.parametres || {}).rappels || [])) { if (/^Mes actifs/.test(r.nom || "")) break; if (r.nom) out.push(r); }
  return out;
}
/* V15.2 · rappels : un bandeau dans Moi quand c'est dû, « Faire » (ouvre la bonne saisie) ou « Plus tard » (2 jours) */
function partielRappel(k) {
  const r = refData(), quint = (r.enveloppes.find(e => /Quintessa/.test(e.nom)) || {}).nom;
  if (k === "releve") return { type: "Relevé", env: quint, actif: "ARTEMA" };
  if (k === "interets") return { type: "Intérêts", env: (r.enveloppes.find(e => /Livret A/.test(e.nom)) || {}).nom, date: (new Date().getFullYear() - 1) + "-12-31" };
  if (k === "versement") { const rc = (r.raccourcis || []).find(x => /Quintessa/.test(x.env)); return rc ? depuisRaccourci(rc) : { env: quint }; }
  return null;
}
function faireRappel(k) {
  if ((k === "artemaActuel" || k === "releve" || k === "point") && aArtema()) { ouvrirPointArtema(k); return; }   // v16.87 : le Point Artema (valeur + niveau)
  const pr = partielRappel(k);
  if (pr) { ouvrirSaisieM(pr); return; }
  reglageOuvert = k; delete reglageMsg[k]; ouvrirSaisieM(null, "maj");
}
function plusTard() { try { return JSON.parse(stock.get(cleStock("plusTard")) || "{}") || {}; } catch (e) { return {}; } }
function rappelReporte(x) { const k = cleRappel(x.nom) || x.nom; return (plusTard()[k] || 0) > Date.now(); }
function rappelDu(x) { return /À faire|mettre à jour|retard|⚠|✏/i.test(x.statut || "") && !rappelReporte(x); }
/* v16.87 : l'ancien bandeau est remplacé par la boîte unique « À faire » (gardé pour compatibilité) */
function htmlBandeauRappel(o) { return htmlAFaire(o === "artema" ? "artema" : undefined); }
function brancherBandeauRappel(v) { brancherAFaire(v); }
/* ================= v16.87 · Phrase-bilan, boîte unique « À faire », Point Artema =================
   - phraseBilan : UNE ligne en tête d'Aujourd'hui (total, variation depuis la fin du mois dernier, LA chose à faire) ;
   - tachesAFaire / htmlAFaire : tous les rappels dus du fichier au même endroit (remplace le bandeau), « Faire » et « Plus tard » (2 jours) ;
   - ouvrirPointArtema : valeur de la ligne (€, relevé) ET niveau de l'indice (pts) en une fois, par les actions existantes « ordre » et « artema ». */
const VERBES_RAPPEL = { point: "faire le point Artema", releve: "saisir ton relevé Artema", artemaActuel: "saisir l'indice Artema", artemaInitial: "saisir le niveau de départ d'Artema",
  taux: "mettre à jour les taux des livrets", fondsEuros: "vérifier le taux du fonds euros", interets: "saisir les intérêts des livrets", appart: "revoir la valeur de l'appartement",
  calendrier: "compléter les jours fériés des bourses", versement: "saisir ton versement Quintessa", soldes: "mettre à jour tes soldes" };
const ICO_RAPPEL = { point: "🎯", releve: "🧾", artemaActuel: "🎯", artemaInitial: "📌", taux: "🏦", fondsEuros: "💶", interets: "🏦", appart: "🏠", calendrier: "📅", versement: "💸", soldes: "🏦" };
const POINT_ART = ["releve", "artemaActuel"];
function reporte(k) { return (plusTard()[k] || 0) > Date.now(); }
/** les tâches dues, la plus ancienne d'abord ; o = "artema" : seulement celles d'Artema */
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
  if (feAVerifier()) l.push({ k: "fondsEuros", cles: ["fondsEuros"], titre: "Fonds euros : ton taux estimé tient toujours ?", date: "", quand: "tous les 3 mois", fe: true });
  l.forEach((t, i) => { t.i = i; t.ico = t.ico || ICO_RAPPEL[t.k] || "◷"; t.verbe = t.anniv ? "noter : " + t.titre.toLowerCase() : VERBES_RAPPEL[t.k] || "faire : " + t.titre.toLowerCase(); });
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
  if (!l.length) {
    return "";   // v17.3 (Théo) : rien à faire = rien d'affiché (ni « Rien à faire », ni prochain rappel, ni reportés)
  }
  const ligne = t => '<div class="af-r"><span class="af-i" aria-hidden="true">' + t.ico + '</span><span class="af-t"><b>' + esc(t.titre) + "</b><small>" + esc(t.quand) + "</small></span>" +
    '<span class="af-a"><button class="mini-btn" type="button" data-af-faire="' + esc(t.k) + '">Faire</button><button class="lien" type="button" data-af-tard="' + esc(t.cles.join(",")) + '">Plus tard</button></span></div>';
  const vis = l.slice(0, 3), reste = l.slice(3);
  return '<section class="m-afaire m-rappel" aria-label="À faire"><div class="af-h"><b>À faire</b><span class="af-n">' + l.length + "</span>" + (o === "artema" ? "" : "<small>le plus ancien d'abord</small>") + "</div>" +
    vis.map(ligne).join("") +
    (reste.length ? '<details class="af-plus"><summary>Voir ' + (reste.length > 1 ? "les " + reste.length + " autres" : "l'autre") + "</summary>" + reste.map(ligne).join("") + "</details>" : "") +
    (rep.length ? '<p class="af-rep">Reporté à demain : ' + rep.map(x => esc(nomCourtRappel(x))).join(", ") + ".</p>" : "") + "</section>";
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
  faireRappel(k);
}
function brancherAFaire(v) {
  v.querySelectorAll("[data-af-faire]").forEach(b => b.addEventListener("click", () => faireTache(b.dataset.afFaire)));
  v.querySelectorAll("[data-af-tard]").forEach(b => b.addEventListener("click", () => {
    const pt = plusTard(); b.dataset.afTard.split(",").forEach(k => { pt[k] = Date.now() + 864e5; }); stock.set(cleStock("plusTard"), JSON.stringify(pt));
    toast("C'est noté : je te le rappelle demain."); signalerCloche(); rendre();
  }));
  v.querySelectorAll("[data-bilan-faire]").forEach(b => b.addEventListener("click", () => faireTache(b.dataset.bilanFaire)));
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
  const anomalie = M.anomalies && !/^\s*✓/.test(M.anomalies);
  if (anomalie) items.push({ t: "rouge", txt: M.anomalies });
  alertesDeclenchees().forEach(a => items.push({ t: "rouge", txt: "Alerte de cours : " + a }));
  const d = dateRappel(M.rappel);
  const aFaire = /À mettre à jour/.test(M.rappel || "") || (d && d - Date.now() < 2 * 864e5);
  if (feAVerifier()) items.push({ t: "orange", txt: "Fonds euros : taux estimé à vérifier" });
  rappelsFichier().filter(rappelDu).forEach(r => items.push({ t: "orange", txt: r.nom + " : " + String(r.statut).replace(/^[^\wÀ-ÿ]+/u, "") + (r.prochaine ? " (prévu le " + frDate(String(r.prochaine).slice(0, 10)) + ")" : "") }));
  if (aFaire && !rappelsFichier().length && !items.some(x => x.t === "orange")) items.push({ t: "orange", txt: M.rappel });
  const niveau = items.some(x => x.t === "rouge") ? "rouge" : items.some(x => x.t === "orange") ? "orange" : "";
  return { niveau, items };
}
function signalerCloche() { if (typeof majCloche === "function") majCloche(configure() ? notifications().niveau : null); }
/* V15.7 · noms courts et clairs des rappels (le Sheet garde ses intitulés longs) */
const NOMS_RAPPEL = { releve: "Relevé du mois", taux: "Taux des livrets", fondsEuros: "Rendement du fonds euros", artemaInitial: "Artema : niveau de départ", artemaActuel: "Artema : niveau actuel",
  interets: "Intérêts des livrets", appart: "Valeur de l'appartement", calendrier: "Jours fériés des bourses", versement: "Versement Quintessa" };
function nomCourtRappel(x) { const k = cleRappel(x.nom); if (k === "releve" && /Linxea/i.test(x.nom)) return "Relevé du mois (Artema + Linxea)"; if (k === "releve") return "Relevé du mois (Artema)"; return NOMS_RAPPEL[k] || nomRappel(x.nom); }
function quandRappel(x) {
  if (!x.prochaine || !/^\d{4}-/.test(x.prochaine)) return "";
  const j = Math.round((new Date(x.prochaine.slice(0, 10) + "T12:00:00") - new Date(isoJour(new Date()) + "T12:00:00")) / 864e5);
  return j < 0 ? "depuis le " + frDate(x.prochaine) : j === 0 ? "aujourd'hui" : j === 1 ? "demain" : j <= 45 ? "dans " + j + " jours" : "le " + frDate(x.prochaine);
}
/* La cloche : seulement ce qui demande une action (sans doublon), avec « Faire » et « Plus tard » ; la liste complète vit dans Saisir › Mes comptes */
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
  const anomalie = M.anomalies && !/^\s*✓/.test(M.anomalies), alertes = alertesDeclenchees(), dus = rappelsFichier().filter(rappelDu);
  const reportes = rappelsFichier().filter(x => /À faire|mettre à jour|retard|⚠|✏/i.test(x.statut || "") && rappelReporte(x));
  const sansListe = !rappelsFichier().length && /À mettre à jour/.test(M.rappel || "");   // profil simple : un seul texte de rappel
  const carte = (cls, ic, titre, sous, actions) => '<div class="nt ' + cls + '"><span class="nt-ic">' + ic + '</span><div class="nt-t"><b>' + titre + "</b>" + (sous ? "<small>" + sous + "</small>" : "") + "</div>" + (actions || "") + "</div>";
  const items = [];
  if (anomalie) items.push(carte("rouge", "!", "Anomalie dans tes saisies", propre(M.anomalies)));
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
    (rappelsFichier().length ? '<button class="nt-tous" type="button" data-notif-maj>Tous les rappels et réglages du fichier <span>›</span></button>' : "") + "</div>";
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
function dVersus() { return typeof D !== "undefined" && D ? D : null; }
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
  const st = (e, deb) => p ? stats(Dv, p, e, deb || 0, fin, iR, null) : {};
  const tot = st(0);
  const sTot = p ? serie(p, 0).filter(z => z.k <= fin && z.val > 0) : [];
  const dernierR = e => { const s = p ? serie(p, e).filter(z => z.k <= fin && typeof z.r === "number") : []; return s.length ? s[s.length - 1].r : null; };
  const debAn = fin ? (Math.floor(fin / 100) - 1) * 100 + 12 : 0;
  // bourse : une enveloppe par colonne du Versus
  const envs = [1, 2, 3, 4].map(e => {
    const s = st(e); if (!(s.valeur > 0) && !(s.verse > 0)) return null;
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
  const bourseA = k => { let v = null; sTot.forEach(z => { if (z.k <= k) v = z.val; }); return v; };
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
  let ip = 100, isp = 100;
  const rows = sTot.map((z, j) => {
    if (j > 0 && typeof z.r === "number") ip *= 1 + z.r;
    if (j > 0 && typeof mi[z.k] === "number") isp *= 1 + mi[z.k];
    const ligne = [+String(z.d).replace(/-/g, ""), z.val, z.cum, ip, isp];
    parEnv.forEach(([e, m]) => {
      const q = m[z.k], v = q && q.val > 0 ? q.val : null;
      if (v === null) ipE[e] = null; else if (ipE[e] === null) ipE[e] = 100; else if (typeof q.r === "number") ipE[e] *= 1 + q.r;
      ligne.push(ipE[e], v, v === null ? null : q.cum);
    });
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
    majTexte: (fin ? "Bourse : relevé de " + MOIS_L[fin % 100 - 1] + " " + Math.floor(fin / 100) : "Bourse : pas encore de relevé") + (derSaisie ? " · épargne saisie le " + frDate(derSaisie) : ""),
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
    '<p class="info">Ton épargne, c\'est toi qui la saisis, quand tu veux : seul le dernier solde compte, les anciens servent aux courbes. Ta bourse vient de tes relevés du Versus (➕ › Relevé Versus).</p>';
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
      '<button type="button" data-ms-pane="comptes">Mes comptes</button><button type="button" data-ms-pane="versus">Relevé Versus</button></div>' +
    '<div id="ms-corps"></div></div>';
  document.body.appendChild(d);
  const fermer = () => { d.hidden = true; confirmeS = null; };
  d.addEventListener("click", e => { if (e.target === d) fermer(); });
  $f("ms-fermer").addEventListener("click", fermer);
  d.querySelectorAll("[data-ms-pane]").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.msPane === "versus") { fermer(); if (typeof ouvrirSaisie === "function") ouvrirSaisie(); return; }
    paneS = b.dataset.msPane; confirmeS = null; rendreSimple();
  }));
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
    z.innerHTML = '<div class="ms-liste">' + ouverts.map(c => '<button type="button" class="ms-l ms-c' + (c.nom === sel.nom ? " on" : "") + '" data-ms-c="' + esc(c.nom) + '"><span class="ms-n"><b>' + esc(c.nom) + "</b><small>" + (aDepart(c.nom) ? "solde " + eur(der[c.nom] ? der[c.nom][2] : 0, 2) : "valeur de départ à saisir") + "</small></span></button>").join("") + "</div>" +
      '<form class="form" id="ms-form" novalidate>' +
      (depart
        ? '<p class="ms-note">🏁 <b>Valeur de départ de ' + esc(sel.nom) + '</b> : le montant sur le compte à cette date. Elle se saisit <b>une seule fois</b> et se fige ensuite : après, seuls les versements, retraits et intérêts font bouger le solde.</p>'
        : '<div class="seg" role="group" aria-label="Type de mouvement">' + types.map(t => '<button type="button" data-ms-t="' + t[0] + '" aria-pressed="' + (ETAT_S.type === t[0]) + '">' + t[1] + "</button>").join("") + "</div>") +
      '<div class="rang2"><div class="champ"><label for="ms-montant">' + (depart ? "Valeur de départ (€)" : "Montant (€)") + '</label><input id="ms-montant" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00"></div>' +
      '<div class="champ"><label for="ms-date">Date</label><input id="ms-date" type="date" value="' + aujourdhuiISO() + '" max="' + aujourdhuiISO() + '"></div></div>' +
      '<button class="btn acc plein" type="submit" id="ms-envoyer">' + (depart ? "Fixer la valeur de départ" : "Enregistrer") + "</button>" +
      '<p class="info">' + (depart ? "Regarde le montant exact dans ton appli bancaire avant de valider." : (ETAT_S.type === "Intérêts" ? "Les intérêts tombent en général au 1er janvier (livrets) : ils augmentent ton solde sans compter comme un versement dans tes séries." : ETAT_S.type === "Retrait" ? "Un retrait ne peut pas dépasser le solde du compte à cette date." : "Un versement compte dans ta série de mois avec un versement (Missions).") +
        " Solde actuel : <b>" + eur(solde || 0, 2) + "</b>. Une saisie se supprime pendant " + jm + " jours dans l'historique, puis elle est figée.") + "</p></form>";
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
  ouvrirMaj() { lireCache(); if (M) { reglageOuvert = null; ouvrirSaisieM(null, "maj"); } },
  saisir(partiel, onglet) { lireCache(); if (M && M.simple) ouvrirSoldes(); else ouvrirSaisieM(partiel, onglet); },
  rafraichir(frais) { if (configure()) { rendre(); charger(!!frais); } },
  testerVersus() { return configure() ? posterFichier({ action: "testerVersus" }) : Promise.resolve({ ok: false, message: "Aucun fichier relié à cet appareil." }); },
  connecter(url, k) {
    url = String(url || "").trim();
    if (url) stock.set(K.api, url);
    if (k) stock.set(K.cle, k);
    if (url || k) { couperLecture(); M = null; SRC = ""; erreur = ""; dernierAppel = 0; stock.del(K.cache); stock.del(K.cacheLe); stock.del(K.refus); }
  },
  oublier() { couperLecture(); [K.api, K.cle, K.cache, K.cacheLe, K.refus].forEach(k => stock.del(k)); M = null; SRC = ""; erreur = ""; signalerCloche(); },
};
})();
