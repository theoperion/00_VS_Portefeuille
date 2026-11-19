/* Versus · Ère d'or et démarrage de l'appli (extrait d'index.html, V14.2). Les fichiers js/ se chargent dans l'ordre de leur numéro. */
"use strict";
/* ============================================================
   L'ÈRE D'OR · récompense du premier millionnaire (V12.1, refaite en v16.93)
   Volontairement non décrite ailleurs : à ne pas lire si tu veux garder la surprise.
   Règle fixe : le million se compte sur le patrimoine FINANCIER (jamais l'immobilier) ; le montant ne quitte jamais l'appareil.
   ============================================================ */
let ERE_RAF = null;
const ERE = { enCours: false, file: [], param: false, bravo: 0 };
/** une scène plein écran du premier million est en cours : les autres fêtes attendent (ereApres) */
function ereEnCours() { return ERE.enCours || ereAttendue(); }
/** la cérémonie va se lancer (due, pas en simulation, pas remise à plus tard) : les fêtes rendues juste avant elle attendent aussi */
function ereAttendue() { const pm = typeof D !== "undefined" && D && D.premierMillion; return !ERE.reporte && !!pm && ereDue(pm) && typeof simulation === "function" && !simulation(); }
/** fn attend la fin de la scène ; cle = une seule attente de ce genre (la dernière gagne) */
function ereApres(fn, cle) { if (!ereEnCours()) { fn(); return; } if (cle) ERE.file = ERE.file.filter(x => x.cle !== cle); fn.cle = cle; ERE.file.push(fn); }
function ereLibere() { ERE.enCours = false; const f = ERE.file.splice(0); f.forEach(fn => { try { fn(); } catch (e) { /* rien */ } }); }
const ereCle = pm => pm.nom + "|" + pm.date;
/** la cérémonie n'a pas encore été vue sur cet appareil (une répétition ne compte jamais) */
function ereDue(pm) { return !!(pm && pm.nom && !pm.repetition && stock.get("versus.ereVue") !== ereCle(pm)); }
function ereDorActive() {
  const pm = typeof D !== "undefined" && D && D.premierMillion; if (!pm || !pm.nom) return null;
  if (ereDue(pm) && !simulation()) return null;   // v16.93 : rien de doré avant la cérémonie (c'est elle qui transforme l'appli)
  const eq = ((D.ecurie || {})[pm.nom] || {}).equip || {};
  return eq.aura === "off" ? null : pm;
}
function ereStyle() {
  if (document.getElementById("ere-style")) return;
  const st = document.createElement("style"); st.id = "ere-style";
  st.textContent = `
@property --ere-a { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
@property --ere-r { syntax: "<length>"; inherits: false; initial-value: 0px; }
@keyframes ereGlisse { to { background-position: -250% 0; } }
@keyframes ereTour { to { --ere-a: 360deg; } }
@keyframes erePouls { 0%,100% { box-shadow: 0 0 0 2px #E8B931, 0 0 10px 1px rgba(232,185,49,.45); } 50% { box-shadow: 0 0 0 2px #FFE58A, 0 0 18px 4px rgba(255,214,102,.7); } }
@keyframes ereFil { from { background-position: 0 0; } to { background-position: 400px 0; } }
@keyframes ereMonte { from { opacity: 0; transform: translateY(18px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes ereLueur { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
body.ere-or .logo b { color: transparent; background: linear-gradient(100deg, #F7E7B4 0%, #E8B931 22%, #FFF8DE 38%, #C98E1E 55%, #F7E7B4 72%, #E8B931 100%); background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; animation: ereGlisse 8s linear infinite; filter: drop-shadow(0 0 6px rgba(232,185,49,.35)); }
body.ere-or .logo i.ere-i { background: conic-gradient(from var(--ere-a), #FFF6D5, #E8B931, #9C6B12, #FFE9A0, #E8B931, #FFF6D5) !important; animation: ereTour 5s linear infinite; box-shadow: 0 0 8px rgba(232,185,49,.6); }
body.ere-or .av.av-or { animation: erePouls 3.2s ease-in-out infinite; border-radius: 50%; }
.ere-fil { position: fixed; left: 0; right: 0; top: 0; height: 2px; z-index: 9998; pointer-events: none; background: linear-gradient(90deg, transparent 0, #9C6B12 80px, #FFE58A 160px, #FFF8DE 200px, #E8B931 240px, transparent 400px); background-size: 400px 2px; animation: ereFil 3.5s linear infinite; opacity: .9; }
.ere-poussiere { position: fixed; inset: 0; z-index: 9997; pointer-events: none; }
/* --- la cérémonie --- */
@keyframes ereTremble { 0%,62%,100% { transform: none; } 66% { transform: translate(-2px,1px) rotate(-4deg); } 70% { transform: translate(2px,-1px) rotate(4deg); } 74% { transform: translate(-2px,0) rotate(-3deg); } 78% { transform: translate(1px,1px) rotate(2deg); } 82% { transform: none; } }
@keyframes ereSort { to { opacity: 0; transform: translateY(-60px) scale(.6); filter: brightness(2.2) blur(2px); } }
@keyframes ereFlip { from { transform: rotateX(-88deg); filter: brightness(1.9); } to { transform: none; filter: none; } }
@keyframes ereFlash { 0% { opacity: .95; } 100% { opacity: 0; } }
@keyframes ereOnde { 0% { opacity: 1; transform: scale(.2); } 100% { opacity: 0; transform: scale(48); } }
@keyframes ereTombe { 0% { opacity: 0; transform: translateY(-150px) rotate(-14deg) scale(1.3); } 60% { opacity: 1; transform: translateY(6px) rotate(3deg) scale(1); } 100% { opacity: 1; transform: none; } }
@keyframes ereLettre { from { opacity: 0; transform: translateY(26px) scale(1.6); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes ereRetourne { to { transform: rotateY(0); } }
@keyframes ereBat { 0%,100% { transform: none; } 50% { transform: scale(1.06); } }
@keyframes ereClap { from { opacity: 1; transform: translate(0,0) scale(.7); } to { opacity: 0; transform: translate(var(--x), -120px) scale(1.4); } }
@keyframes ereAnneau { 0% { opacity: 1; transform: scale(0); } 80% { opacity: 1; } 100% { opacity: 0; transform: scale(1); } }
@keyframes ereVague { from { --ere-r: 0px; } to { --ere-r: 160vmax; } }
@keyframes ereNait { 0% { transform: scale(1); filter: none; } 40% { transform: scale(1.22); filter: drop-shadow(0 0 14px #FFE58A); } 100% { transform: scale(1); filter: none; } }
.ere-gris { position: fixed; inset: 0; z-index: 9999; pointer-events: none; opacity: 0; transition: opacity 1.1s ease; background: rgba(8,6,2,.25); -webkit-backdrop-filter: grayscale(1) brightness(.5); backdrop-filter: grayscale(1) brightness(.5); }
.ere-gris.on { opacity: 1; } .ere-gris.cache { visibility: hidden; }
.ere-gris.vague { -webkit-mask-image: radial-gradient(circle at 50% 42%, transparent var(--ere-r), #000 calc(var(--ere-r) + 70px)); mask-image: radial-gradient(circle at 50% 42%, transparent var(--ere-r), #000 calc(var(--ere-r) + 70px)); animation: ereVague 1.5s cubic-bezier(.5,0,.6,1) forwards; opacity: 0; transition: opacity .6s ease 1.1s; }
.ere-anneau { position: fixed; left: 50%; top: 42%; width: 320vmax; height: 320vmax; margin: -160vmax 0 0 -160vmax; border-radius: 50%; z-index: 10001; pointer-events: none; box-shadow: 0 0 0 3px #FFE58A, 0 0 40px 10px rgba(255,214,102,.55), inset 0 0 40px 10px rgba(255,214,102,.35); animation: ereAnneau 1.5s cubic-bezier(.5,0,.6,1) forwards; }
body.ere-or .logo.ere-nait { animation: ereNait 1.2s ease 1; }
.ere-voile { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; align-items: safe center; overflow: hidden auto; overscroll-behavior: contain; padding: 24px 16px; color: #FFF4D2; text-align: center; background: transparent; transition: background-color 1.6s ease .3s; -webkit-tap-highlight-color: transparent; }
.ere-voile.noir { background-color: #050402; }
.ere-voile::before { content: ""; position: absolute; inset: 0; background: radial-gradient(120% 90% at 50% 40%, #2A1E06 0%, #0B0905 60%, #000 100%); opacity: 0; transition: opacity 1.2s ease; }
.ere-voile.a1::before { opacity: 1; }
.ere-voile > canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 3; }
.ere-spot { position: absolute; inset: -10% -40% 0; pointer-events: none; opacity: 0; transition: opacity 1.4s ease; background: radial-gradient(ellipse 36% 46% at 50% 40%, rgba(255,226,150,.2), transparent 72%), conic-gradient(from 168deg at 50% -6%, transparent 0deg, rgba(255,236,180,.13) 12deg, transparent 24deg); }
.ere-voile.a1 .ere-spot { opacity: 1; }
.ere-flash { position: absolute; inset: 0; background: #FFF8DE; opacity: 0; pointer-events: none; z-index: 4; }
.ere-voile.impact .ere-flash { animation: ereFlash 1s ease-out forwards; }
.ere-onde { position: absolute; left: 50%; top: 40%; width: 20px; height: 20px; margin: -10px; border-radius: 50%; border: 2px solid #FFE58A; box-shadow: 0 0 18px #FFE58A; opacity: 0; pointer-events: none; z-index: 2; }
.ere-voile.impact .ere-onde { animation: ereOnde 1.2s cubic-bezier(.1,.7,.3,1) forwards; }
.ere-a0, .ere-c { grid-area: 1 / 1; position: relative; z-index: 2; max-width: 440px; width: 100%; }
.ere-a0 { opacity: 0; transition: opacity 1s ease 1.3s; cursor: pointer; }
.ere-voile.noir .ere-a0 { opacity: 1; }
.ere-voile.a1 .ere-a0 { animation: ereSort .8s ease-in forwards; pointer-events: none; }
.ere-piece { width: 116px; height: 116px; margin: 0 auto 30px; border-radius: 50%; position: relative; display: grid; place-items: center; background: radial-gradient(circle at 35% 28%, #FFF6D5 0 7%, #F2CF63 30%, #C58F1C 64%, #7A5210 100%); box-shadow: inset 0 0 0 6px rgba(122,82,16,.55), inset 0 0 0 9px #F7DD8A, 0 0 46px rgba(232,185,49,.5); animation: ereTremble 2.6s ease-in-out infinite; }
.ere-piece b { font: italic 900 58px/1 var(--f-display); color: rgba(96,64,10,.6); text-shadow: 0 1px 0 #FFF2C4, 0 -1px 0 rgba(60,40,6,.5); }
.ere-t0 { margin: 0 0 22px; font: italic 700 clamp(22px, 7vw, 30px)/1.2 var(--f-display); letter-spacing: .02em; color: #F4E7C1; }
.ere-go { all: unset; cursor: pointer; padding: 13px 26px; border-radius: 999px; border: 1px solid rgba(232,185,49,.7); color: #FFE58A; font: 700 13px/1 var(--f-text); letter-spacing: .28em; text-transform: uppercase; animation: ereLueur 2.2s ease-in-out infinite; }
.ere-go:focus-visible, .ere-son:focus-visible, .ere-b:focus-visible { outline: 2px solid #FFE58A; outline-offset: 3px; }
.ere-son { all: unset; cursor: pointer; display: block; margin: 26px auto 0; padding: 7px 14px; border-radius: 999px; font: 500 12.5px/1.2 var(--f-text); color: rgba(244,231,193,.7); border: 1px solid rgba(244,231,193,.22); }
.ere-son[aria-pressed="true"] { color: #1D1404; background: #E8B931; border-color: #E8B931; }
.ere-c { visibility: hidden; }
.ere-voile.a1 .ere-c { visibility: visible; }
.ere-k { font: 700 12px/1 var(--f-text); letter-spacing: .35em; text-transform: uppercase; color: #E8B931; opacity: 0; transition: opacity .9s ease .5s; }
.ere-voile.a1 .ere-k { opacity: 1; }
.ere-cour { height: 64px; margin: 12px 0 4px; opacity: 0; }
.ere-cour svg { width: 82px; height: 64px; filter: drop-shadow(0 0 18px rgba(255,214,102,.75)); }
.ere-voile.s2 .ere-cour { height: 0; margin: 0; overflow: hidden; transition: height .7s ease, margin .7s ease; }
.ere-voile.s2 .ere-f { height: clamp(36px, 10.5vw, 50px); transition: height .7s ease; } .ere-voile.s2 .ere-n { font-size: clamp(34px, 11vw, 54px); margin-top: 8px; transition: font-size .7s ease; }
.ere-voile.couronne .ere-cour { animation: ereTombe .9s cubic-bezier(.3,1.2,.5,1) forwards; }
.ere-flaps { display: flex; justify-content: center; align-items: center; gap: 3px; margin: 8px 0 10px; perspective: 500px; opacity: 0; transform: translateY(14px); transition: opacity .8s ease .9s, transform .8s ease .9s; }
.ere-voile.a1 .ere-flaps { opacity: 1; transform: none; }
.ere-f { position: relative; width: clamp(28px, 8.6vw, 42px); height: clamp(44px, 13vw, 62px); border-radius: 6px; display: grid; place-items: center; overflow: hidden; background: linear-gradient(180deg, #221a09 0 49.4%, #120d04 50.6% 100%); box-shadow: inset 0 0 0 1px rgba(232,185,49,.28), 0 6px 16px rgba(0,0,0,.7); font: 700 clamp(26px, 8vw, 40px)/1 var(--f-num); color: #F4E7C1; transition: background .3s, color .3s, box-shadow .3s; }
.ere-f::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(0,0,0,.75); }
.ere-f b { display: block; font-weight: inherit; }
.ere-f b.ere-tour { animation: ereFlip .17s ease-out; }
.ere-sep { width: 7px; }
.ere-eur { margin-left: 6px; font: 800 clamp(24px, 7.5vw, 38px)/1 var(--f-display); color: #E8B931; }
.ere-flaps.or .ere-f { background: linear-gradient(180deg, #FFF0B5, #E8B931 49.4%, #C98E1E 50.6%, #8E610F); color: #2A1C03; box-shadow: 0 0 22px rgba(255,214,102,.75), inset 0 0 0 1px #FFF6D5; }
.ere-flaps.or .ere-eur { color: #FFE58A; text-shadow: 0 0 18px rgba(255,214,102,.8); }
.ere-n { min-height: 1.1em; margin: 14px 0 4px; font: italic 800 clamp(40px, 13vw, 66px)/1.05 var(--f-display); letter-spacing: .02em; }
.ere-n span { display: inline-block; opacity: 0; color: transparent; background: linear-gradient(100deg, #F7E7B4, #E8B931 30%, #FFF8DE 45%, #C98E1E 62%, #F7E7B4); background-size: 300% 100%; -webkit-background-clip: text; background-clip: text; animation: ereLettre .6s cubic-bezier(.2,.8,.2,1) var(--d) forwards; filter: drop-shadow(0 0 12px rgba(255,214,102,.35)); }
.ere-p { margin: 10px auto 0; max-width: 340px; font: 400 15px/1.55 var(--f-text); color: #E9DDBA; opacity: 0; transition: opacity 1s ease; }
.ere-p.vu { opacity: 1; }
.ere-p small { display: block; margin-top: 6px; color: rgba(233,221,186,.6); font-size: 12.5px; letter-spacing: .04em; }
.ere-scene { margin-top: 18px; }
.ere-scene > * { opacity: 0; animation: ereMonte .9s cubic-bezier(.2,.8,.2,1) forwards; }
.ere-b { all: unset; box-sizing: border-box; cursor: pointer; display: inline-block; margin-top: 18px; padding: 14px 24px; border-radius: 999px; border: 1px solid #E8B931; background: linear-gradient(180deg, #F2CF63, #C58F1C); color: #1D1404; font: 800 14px/1 var(--f-text); letter-spacing: .06em; text-transform: uppercase; box-shadow: 0 0 24px rgba(232,185,49,.45); }
.ere-b2 { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; padding: 10px 16px; border-radius: 999px; border: 1px solid rgba(232,185,49,.6); color: #FFE58A; font: 700 13px/1 var(--f-text); }
.ere-btns { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 10px 12px; margin-top: 14px; }
.ere-btns .ere-b { margin-top: 0; }
.ere-av { position: relative; width: 112px; height: 112px; margin: 26px auto 8px; display: grid; place-items: center; }
.ere-av .av { width: 104px; height: 104px; box-shadow: 0 0 0 3px #E8B931, 0 0 30px rgba(255,214,102,.55); }
.ere-av .av .casque { width: 80px !important; height: 80px !important; }
.ere-av .ere-cav { position: absolute; top: -40px; left: 50%; margin-left: -32px; opacity: 0; animation: ereTombe 1s cubic-bezier(.3,1.2,.5,1) .5s forwards; z-index: 3; }
.ere-av .ere-cav svg { width: 64px; height: 50px; filter: drop-shadow(0 0 12px rgba(255,214,102,.8)); }
.ere-ot { margin: 14px 0 8px; font: 700 11px/1 var(--f-text); letter-spacing: .3em; text-transform: uppercase; color: #E8B931; }
.ere-objs { display: flex; justify-content: center; gap: 10px; perspective: 700px; }
.ere-obj { width: 96px; height: 112px; position: relative; transform-style: preserve-3d; transform: rotateY(180deg); animation: ereRetourne .8s cubic-bezier(.3,1.3,.5,1) var(--d) forwards; }
.ere-obj > span { position: absolute; inset: 0; border-radius: 12px; display: grid; place-items: center; align-content: center; gap: 6px; padding: 8px 4px; -webkit-backface-visibility: hidden; backface-visibility: hidden; }
.ere-obj .ere-dos { transform: rotateY(180deg); background: repeating-linear-gradient(45deg, #C58F1C 0 6px, #A87612 6px 12px); box-shadow: inset 0 0 0 2px #FFE58A; font-size: 30px; }
.ere-obj .ere-face { background: linear-gradient(180deg, #2A1E06, #120d04); box-shadow: inset 0 0 0 1px rgba(232,185,49,.6), 0 0 18px rgba(232,185,49,.3); }
.ere-face svg { width: 70px; height: 52px; } .ere-face .it-emo { font-size: 34px; } .ere-face .av { width: 52px; height: 52px; }
.ere-face b { font: 700 11.5px/1.15 var(--f-text); color: #FFE58A; } .ere-face small { font-size: 10px; color: rgba(233,221,186,.65); }
.ere-br { margin: 12px 0 0; font-size: 13px; color: rgba(233,221,186,.8); }
.ere-flsp { display: inline-block; padding: 5px 12px; border-radius: 4px; background: #B3121F; color: #fff; font: 800 12px/1 var(--f-text); letter-spacing: .22em; text-transform: uppercase; box-shadow: 0 0 18px rgba(179,18,31,.5); }
.ere-tour { position: relative; width: min(320px, 82vw); aspect-ratio: 4 / 3; margin: 12px auto 0; border-radius: 14px; overflow: hidden; background: #0B0905; box-shadow: 0 0 0 1px rgba(232,185,49,.5), 0 10px 30px rgba(0,0,0,.6); }
.ere-tour img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: brightness(.5) saturate(.7) blur(1px); }
.ere-tour svg { position: absolute; inset: 7%; width: 86%; height: 86%; overflow: visible; }
.ere-tl { margin: 8px 0 0; font: 600 12.5px/1.3 var(--f-text); color: rgba(233,221,186,.75); }
.ere-bravo { position: relative; }
.ere-bravo[aria-pressed="true"] { background: rgba(232,185,49,.18); }
.ere-bravo i { position: absolute; left: 50%; top: 0; font-style: normal; font-size: 22px; pointer-events: none; animation: ereClap 1.1s ease-out forwards; }
.ere-rep { position: absolute; top: max(12px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); z-index: 5; padding: 4px 10px; border-radius: 999px; font: 600 11px/1.2 var(--f-text); color: #1D1404; background: rgba(232,185,49,.85); white-space: nowrap; }
.ere-passer { all: unset; position: absolute; right: 16px; bottom: max(18px, env(safe-area-inset-bottom)); z-index: 5; cursor: pointer; padding: 9px 14px; border-radius: 999px; font: 600 13px/1 var(--f-text); color: rgba(244,231,193,.75); border: 1px solid rgba(244,231,193,.25); }
.ere-plaque { all: unset; box-sizing: border-box; cursor: pointer; display: flex; align-items: center; gap: 10px; width: 100%; margin: 4px 0 10px; padding: 9px 14px; border-radius: 10px; background: linear-gradient(100deg, #2A1E06, #4A3509 45%, #2A1E06); box-shadow: inset 0 0 0 1px #C98E1E, inset 0 0 0 3px #1D1404, inset 0 0 0 4px rgba(232,185,49,.45); color: #F4E7C1; }
.ere-plaque svg { width: 30px; height: 24px; flex: none; }
.ere-plaque span { display: grid; text-align: left; } .ere-plaque b { font: italic 800 15px/1.1 var(--f-display); letter-spacing: .04em; color: #FFE58A; } .ere-plaque small { font: 500 11.5px/1.3 var(--f-text); color: rgba(244,231,193,.75); }
.ere-fiche { display: flex; flex-wrap: wrap; gap: 8px; margin: 8px 0 4px; }
.ere-fiche button { all: unset; cursor: pointer; padding: 8px 13px; border-radius: 999px; font: 600 13px/1 var(--f-text); color: #1D1404; background: linear-gradient(180deg, #F2CF63, #C58F1C); }
@media (prefers-reduced-motion: reduce) {
  body.ere-or .logo b, body.ere-or .logo i.ere-i, body.ere-or .av.av-or, .ere-fil { animation: none !important; } .ere-poussiere { display: none; }
  .ere-piece, .ere-go, .ere-f b.ere-tour { animation: none !important; } .ere-voile.a1 .ere-a0 { animation: none; opacity: 0; }
  .ere-n span, .ere-cour, .ere-av .ere-cav, .ere-obj, .ere-scene > * { animation: none !important; opacity: 1 !important; transform: none !important; }
  .ere-voile.impact .ere-onde { animation: none; } .ere-voile.impact .ere-flash { animation: ereFlash 1.6s ease-out forwards; }
}`;
  document.head.appendChild(st);
}
/** la couronne, dessinée par nous (pas d'émoji : même rendu sur tous les téléphones) */
const ERE_COURONNE = '<svg viewBox="0 0 82 64" aria-hidden="true"><defs><linearGradient id="ere-cg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#FFF6CC"/><stop offset=".35" stop-color="#F2CF63"/><stop offset=".6" stop-color="#B07A16"/><stop offset=".8" stop-color="#FFE596"/><stop offset="1" stop-color="#8E610F"/></linearGradient></defs>' +
  '<path d="M6 50 2 14l20 16L41 2l19 28 20-16-4 36Z" fill="url(#ere-cg)" stroke="#5E3E08" stroke-width="2" stroke-linejoin="round"/><rect x="6" y="50" width="70" height="10" rx="3" fill="url(#ere-cg)" stroke="#5E3E08" stroke-width="2"/>' +
  '<circle cx="41" cy="36" r="5" fill="#E0314B" stroke="#5E3E08" stroke-width="1.5"/><circle cx="21" cy="40" r="3.5" fill="#2E8BFF" stroke="#5E3E08" stroke-width="1.2"/><circle cx="61" cy="40" r="3.5" fill="#2EC27E" stroke="#5E3E08" stroke-width="1.2"/>' +
  '<circle cx="2" cy="14" r="3" fill="#FFF6CC"/><circle cx="41" cy="3" r="3.5" fill="#FFF6CC"/><circle cx="80" cy="14" r="3" fill="#FFF6CC"/><path d="M12 54h58" stroke="#FFF6CC" stroke-width="1.5" opacity=".7"/></svg>';
/** Poussière d'or : quelques paillettes qui dérivent lentement sur toute l'appli ; en pause quand l'onglet est caché, pendant une course 3D ou une scène plein écran */
function ereCanvasPoussiere() {
  if (document.querySelector(".ere-poussiere") || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = document.createElement("canvas"); cv.className = "ere-poussiere"; cv.setAttribute("aria-hidden", "true"); document.body.appendChild(cv);
  const cx = cv.getContext("2d"), dpr = Math.min(2, window.devicePixelRatio || 1);
  const taille = () => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
  taille(); addEventListener("resize", taille);
  const P = Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), v: .00004 + Math.random() * .00008, r: .6 + Math.random() * 1.6, p: Math.random() * 6.28, d: (Math.random() - .5) * .00003 }));
  const enPause = () => document.hidden || ERE.enCours || (typeof BA_OUVERTE !== "undefined" && !!BA_OUVERTE) ||
    (typeof GP_INST !== "undefined" && GP_INST && GP_INST.api && GP_INST.api.type === "3d" && GP_INST.api.enCours && GP_INST.api.enCours());
  let t0 = 0, vide = false;
  const image = t => {
    ERE_RAF = null;
    if (!document.body.classList.contains("ere-or")) { cv.remove(); removeEventListener("resize", taille); return; }
    if (enPause()) { if (!vide) { cx.clearRect(0, 0, cv.width, cv.height); vide = true; } t0 = 0; setTimeout(() => { if (!ERE_RAF) ERE_RAF = requestAnimationFrame(image); }, 800); return; }
    vide = false;
    const dt = t0 ? Math.min(64, t - t0) : 16; t0 = t;
    cx.clearRect(0, 0, cv.width, cv.height);
    P.forEach(q => {
      q.y -= q.v * dt; q.x += q.d * dt; q.p += .002 * dt;
      if (q.y < -.02) { q.y = 1.02; q.x = Math.random(); }
      const a = .18 + .22 * (1 + Math.sin(q.p)) / 2, x = q.x * cv.width, y = q.y * cv.height, r = q.r * dpr;
      const g = cx.createRadialGradient(x, y, 0, x, y, r * 4); g.addColorStop(0, "rgba(255,236,170," + a + ")"); g.addColorStop(1, "rgba(232,185,49,0)");
      cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r * 4, 0, 6.283); cx.fill();
    });
    ERE_RAF = requestAnimationFrame(image);
  };
  if (!ERE_RAF) ERE_RAF = requestAnimationFrame(image);
}
/** Le logo, le fil et la classe de l'ère d'or (sans la cérémonie) */
function ereAppliquer(on, nom) {
  document.body.classList.toggle("ere-or", on);
  document.body.dataset.ereNom = on ? nom : "";
  document.querySelectorAll(".logo").forEach(l => { const i = l.querySelector("i.ere-i"); if (on && !i) { const n = document.createElement("i"); n.className = "ere-i"; l.insertBefore(n, l.querySelector("b")); } else if (!on && i) i.remove(); });
  let fil = document.querySelector(".ere-fil");
  if (on && !fil) { fil = document.createElement("div"); fil.className = "ere-fil"; document.body.appendChild(fil); } else if (!on && fil) fil.remove();
}
/** le circuit du mois en cours (pour le tour d'honneur), ou celui du Garage */
function ereCircuit() {
  try { const d = new Date(), k = d.getFullYear() * 100 + d.getMonth() + 1, ci = typeof circuitDe === "function" ? circuitDe(k) : "abudhabi"; return window.Piste && Piste.TRACES && Piste.TRACES[ci] ? ci : "abudhabi"; } catch (e) { return "abudhabi"; }
}
/* ---------- LE GRAND MOMENT : une fois par appareil, le jour où l'on découvre le premier millionnaire ----------
   o = { role: "gagnant" | "temoin" (sinon d'après la session), repetition (admin : rien n'est écrit ni envoyé), revoir (rejouer depuis la fiche) }
   Acte 0 : l'appli se fige et s'éteint, une pièce qui tremble, « Touche pour révéler » (ce geste débloque le son sur Firefox Android / iPhone).
   Actes 1-3 : projecteur, compteur à palettes qui bloque sur 999 999, puis le million, la couronne, le nom.
   Puis deux scènes : le gagnant est couronné et déballe ses pièces uniques ; les autres voient son tour d'honneur et peuvent applaudir.
   À la fin, la vague d'or repeint l'appli sous les yeux. Jamais de vrai montant, chez personne. */
function ereCeremonie(pm, o) {
  o = o || {};
  if (!pm || !pm.nom || document.querySelector(".ere-voile")) return;
  ereStyle();
  const rep = !!(o.repetition || pm.repetition), revoir = !!o.revoir, ecrit = !rep && !revoir;   // seule la vraie première fois écrit « vu »
  const role = o.role || (typeof moiVrai === "function" && moiVrai() === pm.nom ? "gagnant" : "temoin"), gagnant = role === "gagnant";
  const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sonCoupe = !(window.SONS && SONS.actif());
  ERE.enCours = true; ERE.pmScene = pm;
  const gris = document.createElement("div"); gris.className = "ere-gris"; document.body.appendChild(gris);
  const v = document.createElement("div"); v.className = "ere-voile voile"; v.setAttribute("role", "dialog"); v.setAttribute("aria-modal", "true"); v.setAttribute("aria-label", "Un moment rare");
  const chiffres = '<span class="ere-f"><b>0</b></span><span class="ere-sep"></span>' + '<span class="ere-f"><b>0</b></span>'.repeat(3) + '<span class="ere-sep"></span>' + '<span class="ere-f"><b>0</b></span>'.repeat(3) + '<span class="ere-eur">€</span>';
  v.innerHTML = '<canvas></canvas><div class="ere-spot"></div><div class="ere-onde"></div><div class="ere-flash"></div>' +
    (rep ? '<div class="ere-rep">Répétition · rien n\'est enregistré ni envoyé</div>' : "") +
    '<button class="ere-x" type="button" aria-label="Fermer" hidden></button><button class="ere-passer" type="button" hidden>Passer ›</button>' +
    '<div class="ere-a0" role="button" tabindex="-1"><div class="ere-piece" aria-hidden="true"><b>V</b></div><p class="ere-t0">Il s\'est passé quelque chose.</p>' +
    '<button class="ere-go" type="button">Touche pour révéler</button>' +
    (sonCoupe ? '<button class="ere-son" type="button" aria-pressed="false">🔇 Son coupé · l\'activer pour ce moment</button>' : "") + "</div>" +
    '<div class="ere-c" aria-live="polite"><div class="ere-k">Premier millionnaire du Versus</div><div class="ere-cour">' + ERE_COURONNE + '</div>' +
    '<div class="ere-flaps" role="img" aria-label="Un million d\'euros">' + chiffres + '</div><div class="ere-n"></div><p class="ere-p"></p><div class="ere-scene"></div></div>';
  document.body.appendChild(v);
  requestAnimationFrame(() => { gris.classList.add("on"); requestAnimationFrame(() => v.classList.add("noir")); });
  const $e = s => v.querySelector(s), minuteurs = [], at = (ms, fn) => minuteurs.push(setTimeout(fn, ms));
  let forcerSon = false, musique = null, revele = false, ferme = false, raf = null, tourRaf = null;
  const bSon = $e(".ere-son"); if (bSon) bSon.addEventListener("click", e => { e.stopPropagation(); forcerSon = !forcerSon; bSon.setAttribute("aria-pressed", String(forcerSon)); bSon.textContent = forcerSon ? "🔊 Son activé pour ce moment" : "🔇 Son coupé · l'activer pour ce moment"; });
  /* --- les particules : salves de pièces et de paillettes (≤ 400, DPR ≤ 2) --- */
  const cv = v.querySelector("canvas"), cx = cv.getContext("2d"), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  const W = cv.width, H = cv.height, P = []; let pluie = 0;
  const salve = (n, y) => { if (calme) return; for (let i = 0; i < n && P.length < 400; i++) { const a = Math.random() * 6.283, s = (3 + Math.random() * 9) * dpr; P.push({ x: W / 2, y: H * (y || .4), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 4 * dpr, r: (2 + Math.random() * 4) * dpr, rot: Math.random() * 6, vr: (Math.random() - .5) * .3, vie: 1, piece: Math.random() < .4, c: Math.random() < .5 ? "#FFE58A" : "#E8B931" }); } };
  const image = () => {
    raf = null;
    if (pluie && P.length < 400) for (let i = 0; i < 2; i++) P.push({ x: Math.random() * W, y: -10, vx: (Math.random() - .5) * dpr, vy: (1.2 + Math.random() * 2) * dpr, r: (1.5 + Math.random() * 3) * dpr, rot: Math.random() * 6, vr: (Math.random() - .5) * .2, vie: 1, piece: Math.random() < .35, c: Math.random() < .5 ? "#FFE58A" : "#E8B931" });
    cx.clearRect(0, 0, W, H);
    for (let i = P.length - 1; i >= 0; i--) {
      const q = P[i]; q.x += q.vx; q.y += q.vy; q.vy += .14 * dpr; q.vx *= .985; q.rot += q.vr; q.vie -= q.y > H ? 1 : .005;
      if (q.vie <= 0) { P.splice(i, 1); continue; }
      cx.save(); cx.translate(q.x, q.y); cx.rotate(q.rot); cx.globalAlpha = Math.max(0, Math.min(1, q.vie));
      if (q.piece) { const g = cx.createLinearGradient(-q.r * 2, 0, q.r * 2, 0); g.addColorStop(0, "#9C6B12"); g.addColorStop(.5, "#FFE58A"); g.addColorStop(1, "#C98E1E"); cx.fillStyle = g; cx.beginPath(); cx.ellipse(0, 0, q.r * 2, q.r * 2 * Math.abs(Math.cos(q.rot * 2)) + .5, 0, 0, 6.283); cx.fill(); }
      else { cx.fillStyle = q.c; cx.fillRect(-q.r, -q.r / 3, q.r * 2, q.r * .7); }
      cx.restore();
    }
    if (P.length || pluie) raf = requestAnimationFrame(image);
  };
  const lancerParticules = () => { if (!raf && !calme) raf = requestAnimationFrame(image); };
  /* --- le compteur à palettes : il file, ralentit, et bloque sur 999 999 --- */
  const cases = [...v.querySelectorAll(".ere-f")], afficher = n => { const s = String(n).padStart(7, "0"); cases.forEach((c, i) => { const b = c.firstChild; if (b.textContent !== s[i]) { const nb = document.createElement("b"); nb.textContent = s[i]; if (!calme) nb.className = "ere-tour"; c.replaceChild(nb, b); } }); };
  const PAS = [[0, 0], [2480, 150], [14900, 150], [52300, 160], [128700, 170], [246100, 180], [389500, 190], [531200, 200], [668800, 210], [782400, 225], [866900, 245], [924300, 270], [961700, 300],
    [983200, 340], [993800, 390], [998100, 450], [999500, 520], [999900, 600], [999990, 700], [999999, 820]];
  const DEBUT = 1500, ticks = []; let tt = DEBUT; PAS.forEach(([, d]) => { tt += d; ticks.push(tt); });
  const IMPACT = tt + 1150;   // 1,15 s de silence sur 999 999
  /* --- l'impact : le million --- */
  const impact = () => {
    if (revele) return; revele = true;
    minuteurs.splice(0).forEach(clearTimeout);
    $e(".ere-passer").hidden = true;
    afficher(1000000); $e(".ere-flaps").classList.add("or");
    v.classList.add("a1", "impact"); salve(220, .38); lancerParticules();
    if (window.SONS) SONS.vibrer([60, 40, 60, 40, 220]);
    at(450, () => v.classList.add("couronne"));
    at(900, () => { const n = $e(".ere-n"); n.innerHTML = [...pm.nom].map((c, i) => '<span style="--d:' + (i * .07).toFixed(2) + 's">' + (c === " " ? "&nbsp;" : esc(c)) + "</span>").join(""); salve(120, .55); lancerParticules(); });
    at(2300, () => { const p = $e(".ere-p"), d = isoFr(pm.date);
      p.innerHTML = (gagnant ? "C'est toi. Le premier du groupe à franchir le million, et c'est pour toujours." : esc(pm.nom) + " a franchi le million en premier. C'est gravé, pour toujours.") + "<small>Le " + esc(d) + " · le montant ne sera jamais dit</small>";
      p.classList.add("vu"); pluie = 1; lancerParticules(); });
    at(3700, () => scene());
  };
  /* --- deux scènes : le couronnement (gagnant) ; le flash spécial et le tour d'honneur (les autres) --- */
  const scene = () => {
    v.classList.add("s2");
    const s = $e(".ere-scene"), nbBravos = (pm.bravos || []).length;
    const fin = '<button class="ere-b" type="button">Entrer dans l\'ère d\'or</button>';
    if (gagnant) {
      let objets = "";
      try { const e = equipDe(pm.nom); objets = GAINS_MILLION.map(([sl, id], i) => '<div class="ere-obj" style="--d:' + (1.4 + i * .55).toFixed(2) + 's"><span class="ere-dos">👑</span><span class="ere-face">' + vignetteItem(sl, id, pm.nom, e) +
        "<b>" + esc(ITEMS[sl][id]) + "</b><small>" + esc((SLOTS.find(x => x[0] === sl) || [0, ""])[1]) + "</small></span></div>").join(""); } catch (er) { objets = ""; }
      s.innerHTML = '<div class="ere-av" style="animation-delay:0s">' + (typeof avatar === "function" ? avatar(pm.nom) : "") + '<span class="ere-cav">' + ERE_COURONNE + "</span></div>" +
        (objets ? '<p class="ere-ot" style="animation-delay:1s">Tes pièces uniques</p><div class="ere-objs" style="animation-delay:1.1s">' + objets + "</div>" : "") +
        (nbBravos ? '<p class="ere-br" style="animation-delay:2.4s">👏 ' + nbBravos + " bravo" + (nbBravos > 1 ? "s" : "") + " reçu" + (nbBravos > 1 ? "s" : "") + "</p>" : "") +
        '<div class="ere-btns" style="animation-delay:' + (objets ? 3.2 : 1.2) + 's"><button class="ere-b2" type="button" data-ere-diplome>🎓 Mon diplôme 1/1</button>' + fin + "</div>";
      if (window.SONS) at(500, () => SONS.vibrer([30, 50, 30]));
    } else {
      const ci = ereCircuit(), G = typeof GPS !== "undefined" && GPS[ci] ? GPS[ci] : { ville: "" }, img = window.Piste && Piste.carte ? Piste.carte(ci) : null;
      let trace = ""; try { trace = Piste.vignette(ci, "#E8B931"); } catch (er) { trace = ""; }
      const vb = (/viewBox="([^"]+)"/.exec(trace) || [])[1], d = (/ d="([^"]+)"/.exec(trace) || [])[1];
      const deja = stock.get("versus.ereBravo") === ereCle(pm) && !rep;
      s.innerHTML = '<span class="ere-flsp">Flash spécial</span>' +
        (vb && d ? '<div class="ere-tour" style="animation-delay:.4s">' + (img ? '<img alt="" src="' + esc(img) + '">' : "") +
          '<svg viewBox="' + vb + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="rgba(232,185,49,.35)" stroke-width="5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
          '<path class="ere-trainee" d="' + d + '" fill="none" stroke="#FFE58A" stroke-width="4" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 0 4px #FFD666)"/>' +
          '<g class="ere-auto"><circle r="1" fill="#FFF6D5" stroke="' + couleurReelle(couleur(pm.nom)) + '" stroke-width="3" vector-effect="non-scaling-stroke" style="filter:drop-shadow(0 0 6px #FFE58A)"/></g></svg></div>' +
          '<p class="ere-tl" style="animation-delay:.6s">Tour d\'honneur de ' + esc(pm.nom) + (G.ville ? " · " + esc(G.ville) : "") + "</p>" : "") +
        '<div class="ere-btns" style="animation-delay:1.4s"><button class="ere-b2 ere-bravo" type="button" aria-pressed="' + deja + '">👏 Applaudir <span>' + (nbBravos ? "· " + nbBravos : "") + "</span></button>" + fin + "</div>";
      tourHonneur();
    }
    const b = s.querySelector(".ere-b"); b.addEventListener("click", () => fermer(true));
    const bv = s.querySelector(".ere-bravo"); if (bv) bv.addEventListener("click", () => bravo(bv));
    setTimeout(() => { try { b.focus({ preventScroll: true }); } catch (e) { /* rien */ } }, 3500);
  };
  const tourHonneur = () => {
    const svg = v.querySelector(".ere-tour svg"); if (!svg) return;
    const ch = svg.querySelector(".ere-trainee"), auto = svg.querySelector(".ere-auto circle"), L = ch.getTotalLength(), vbw = svg.viewBox.baseVal.width || 400;
    auto.setAttribute("r", (vbw * .028).toFixed(1));
    ch.style.strokeDasharray = L; ch.style.strokeDashoffset = L;
    const pose = k => { const p = ch.getPointAtLength(L * k); auto.setAttribute("cx", p.x.toFixed(1)); auto.setAttribute("cy", p.y.toFixed(1)); ch.style.strokeDashoffset = (L * (1 - k)).toFixed(1); };
    if (calme) { pose(1); return; }
    const d0 = performance.now() + 700, duree = 5200;
    const pas = t => { tourRaf = null; const k = Math.max(0, Math.min(1, (t - d0) / duree)), e = k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; pose(e); if (k < 1) tourRaf = requestAnimationFrame(pas); else { salve(60, .62); lancerParticules(); } };
    pose(0); tourRaf = requestAnimationFrame(pas);
  };
  const bravo = b => {
    ERE.bravo++;
    for (let i = 0; i < 5; i++) { const c = document.createElement("i"); c.textContent = "👏"; c.style.setProperty("--x", ((Math.random() - .5) * 140).toFixed(0) + "px"); c.style.animationDelay = (i * .08) + "s"; b.appendChild(c); setTimeout(() => c.remove(), 1400); }
    if (window.SONS) { SONS.succes(); }
    if (b.getAttribute("aria-pressed") === "true") return;
    b.setAttribute("aria-pressed", "true");
    const n = (pm.bravos || []).length + 1; b.querySelector("span").textContent = "· " + n;
    if (rep || pm.repetition) return;   // garde-fou : une répétition n'envoie jamais rien
    stock.set("versus.ereBravo", ereCle(pm));
    if (typeof SOURCE === "undefined" || SOURCE !== "api" || simulation() || typeof posterAdmin !== "function") return;
    posterAdmin({ action: "bravo", personne: moiVrai() }).then(r => { if (r && r.ok && r.premierMillion && D) D.premierMillion = r.premierMillion; }).catch(() => {});
  };
  /* --- l'ouverture : le geste qui débloque le son --- */
  const ouvrir = () => {
    if (v.classList.contains("a1")) return;
    v.classList.add("a1"); gris.classList.add("cache");
    const son = window.SONS && (SONS.actif() || forcerSon);
    musique = son && SONS.sacre ? SONS.sacre({ ticks, impact: IMPACT, forcer: forcerSon }) : null;
    if (window.SONS) SONS.vibrer(30);
    PAS.forEach(([n], i) => at(ticks[i], () => afficher(n)));
    at(4000, () => { if (!revele) $e(".ere-passer").hidden = false; });
    at(IMPACT, impact);
  };
  v.querySelector(".ere-a0").addEventListener("click", ouvrir);
  $e(".ere-passer").addEventListener("click", () => { if (musique) musique.sauter(); impact(); });
  /* --- la fermeture : la vague d'or repeint l'appli sous les yeux --- */
  const fermer = fini => {
    if (ferme) return; ferme = true;
    minuteurs.splice(0).forEach(clearTimeout); pluie = 0;
    if (tourRaf) cancelAnimationFrame(tourRaf);
    if (musique) musique.arreter(fini ? 1.6 : .3);
    if (revele && ecrit) stock.set("versus.ereVue", ereCle(pm));
    if (!revele && ecrit) ERE.reporte = true;   // fermé avant la révélation : elle reviendra à la prochaine ouverture de l'appli, pas tout de suite
    ERE.pmScene = null;   // vu = le nom a été révélé (fermé avant : la scène revient à la prochaine ouverture)
    const pmVrai = typeof D !== "undefined" && D && D.premierMillion, auraOff = (((D && D.ecurie || {})[pm.nom] || {}).equip || {}).aura === "off";
    const vague = revele && fini && (rep || revoir ? !auraOff : !!ereDorActive());
    v.style.transition = "opacity .6s"; v.style.opacity = "0"; gris.classList.remove("cache");
    setTimeout(() => {
      if (raf) cancelAnimationFrame(raf); v.remove();
      if (!vague) { gris.classList.remove("on"); if (revele && ecrit) ereRafraichir(); setTimeout(() => { gris.remove(); ereLibere(); ereDor(); }, 1100); return; }
      ereVague(gris, pm, rep || revoir || !pmVrai);
    }, 620);
  };
  $e(".ere-x").addEventListener("click", () => fermer(false));   // bouton retour du téléphone (modèle v15.27 : il clique « Fermer » de la fenêtre ouverte)
  ERE.scene = { fermer, impact, ouvrir };
}
/** la vague d'or : un anneau part du centre et rend ses couleurs à l'appli, dorée ; temporaire = répétition ou « revoir » (l'état réel revient ensuite) */
/** la vue affichée se redessine sous le voile (plaque du Classement, avatar doré) ; seulement les vues légères */
function ereRafraichir() { try { const vv = vueActive(); if (D && (vv === "classement" || vv === "fiche")) rendreVue(vv); } catch (e) { /* rien */ } }
function ereVague(gris, pm, temporaire) {
  const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  ereAppliquer(true, pm.nom); if (!temporaire) ereRafraichir();
  if (!calme) { const a = document.createElement("div"); a.className = "ere-anneau"; document.body.appendChild(a); setTimeout(() => a.remove(), 1600); }
  document.querySelectorAll(".logo").forEach(l => { l.classList.remove("ere-nait"); void l.offsetWidth; l.classList.add("ere-nait"); setTimeout(() => l.classList.remove("ere-nait"), 1300); });
  if (calme) gris.classList.remove("on"); else gris.classList.add("vague");
  if (window.SONS) SONS.vibrer(40);
  setTimeout(() => {
    gris.remove(); ereLibere();
    if (temporaire) setTimeout(() => { if (!ERE.enCours) ereDor(); }, 5000); else ereDor();
  }, 1800);
}
/** Diplôme 1/1 (image PNG fabriquée sur l'appareil : nom et date, jamais de montant) */
function ereDiplome(pm) {
  pm = pm || (D && D.premierMillion); if (!pm) return;
  const c = document.createElement("canvas"), W = 1080, H = 1350; c.width = W; c.height = H; const x = c.getContext("2d");
  const fD = (getComputedStyle(document.documentElement).getPropertyValue("--f-display") || "sans-serif").trim();
  const fond = x.createRadialGradient(W / 2, H * .38, 40, W / 2, H * .45, H * .8); fond.addColorStop(0, "#3A2A08"); fond.addColorStop(.55, "#120D04"); fond.addColorStop(1, "#000"); x.fillStyle = fond; x.fillRect(0, 0, W, H);
  const or = x.createLinearGradient(0, 0, W, H); or.addColorStop(0, "#FFF6CC"); or.addColorStop(.3, "#E8B931"); or.addColorStop(.5, "#FFF8DE"); or.addColorStop(.7, "#C98E1E"); or.addColorStop(1, "#F7E7B4");
  x.strokeStyle = or; x.lineWidth = 10; x.strokeRect(46, 46, W - 92, H - 92); x.lineWidth = 2; x.strokeRect(70, 70, W - 140, H - 140);
  for (let i = 0; i < 90; i++) { x.fillStyle = "rgba(255,229,138," + (Math.random() * .35).toFixed(2) + ")"; x.beginPath(); x.arc(90 + Math.random() * (W - 180), 90 + Math.random() * (H - 180), Math.random() * 2.5, 0, 6.283); x.fill(); }
  const img = new Image();
  const finir = () => {
    x.textAlign = "center"; x.fillStyle = "#E8B931"; x.font = "700 34px " + fD; x.fillText("V E R S U S", W / 2, 190);
    try { x.drawImage(img, W / 2 - 150, 250, 300, 234); } catch (e) { /* rien */ }
    x.fillStyle = "#E9DDBA"; x.font = "600 40px " + fD; x.fillText("PREMIER MILLIONNAIRE", W / 2, 580);
    x.fillStyle = or; let t = 150; do { x.font = "italic 800 " + t + "px " + fD; t -= 6; } while (x.measureText(pm.nom).width > W - 220 && t > 60); x.fillText(pm.nom, W / 2, 760);
    x.fillStyle = "#E9DDBA"; x.font = "400 36px " + fD; x.fillText("a franchi le premier le cap du million", W / 2, 860);
    const d = new Date(pm.date + "T12:00:00"); x.fillText(isNaN(d) ? isoFr(pm.date) : "le " + d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }), W / 2, 912);
    x.fillStyle = "#E8B931"; x.font = "700 30px " + fD; x.fillText("EXEMPLAIRE UNIQUE · 1/1", W / 2, 1080);
    x.fillStyle = "rgba(233,221,186,.6)"; x.font = "400 26px " + fD; x.fillText("Le montant ne sera jamais dit. Seule la couronne parle.", W / 2, 1150);
    c.toBlob(b => {
      if (!b) return; const nom = "versus-premier-millionnaire.png";
      try { const f = new File([b], nom, { type: "image/png" }); if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: "Premier millionnaire du Versus" }).catch(() => {}); return; } } catch (e) { /* téléchargement */ }
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = nom; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    }, "image/png");
  };
  img.onload = finir; img.onerror = finir; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(ERE_COURONNE.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="234" '));
}
/** Répétition (admin seulement, par l'adresse …?ere=gagnant ou ?ere=temoin) : un faux premier millionnaire LOCAL, rien d'écrit, rien d'envoyé */
function ereRepetition(role) {
  if (typeof vraiAdmin !== "function" || !vraiAdmin() || !D || !D.personnes) return;
  const moi = moiVrai(), autre = (D.personnes.find(p => p.nom !== moi) || {}).nom || "Kévin";
  const d = new Date(), iso = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  ereCeremonie({ nom: role === "temoin" ? autre : moi, date: iso, repetition: true }, { role: role === "temoin" ? "temoin" : "gagnant", repetition: true });
}
/** Revoir le sacre (fiche du gagnant, plaque du Classement) : rejoue sans rien écrire */
function ereRevoir() { const pm = D && D.premierMillion; if (pm && !ereDue(pm)) ereCeremonie(pm, { revoir: true }); }
/** la plaque-monument du Classement (reste même si l'ère d'or est masquée) */
function plaqueMillion() {
  const pm = typeof D !== "undefined" && D && D.premierMillion; if (!pm || !pm.nom || (ereDue(pm) && !simulation())) return "";
  return '<button class="ere-plaque" type="button" data-ere-revoir aria-label="Premier millionnaire : revoir le sacre">' + ERE_COURONNE + "<span><b>Premier millionnaire · " + esc(pm.nom) + "</b><small>" + esc(isoFr(pm.date)) + " · pour toujours · touche pour revoir</small></span></button>";
}
/** dans la fiche du gagnant : revoir le sacre (+ le diplôme pour lui) */
function ficheMillion(nom) {
  const pm = typeof D !== "undefined" && D && D.premierMillion; if (!pm || pm.nom !== nom || ereDue(pm)) return "";
  return '<div class="ere-fiche"><button type="button" data-ere-revoir>👑 Revoir le sacre</button>' + (moiVrai() === nom ? '<button type="button" data-ere-diplome>🎓 Mon diplôme 1/1</button>' : "") + "</div>";
}
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-ere-revoir], [data-ere-diplome]"); if (!t) return;
  if (t.hasAttribute("data-ere-revoir")) { ereStyle(); ereRevoir(); }
  else { const sc = document.querySelector(".ere-voile"), pm = sc && ERE.pmScene ? ERE.pmScene : D && D.premierMillion; ereDiplome(pm); }
});
/** compatibilité : l'ancien nom */
function ereRevelation(pm) { ereCeremonie(pm); }
/** Applique (ou retire) l'ère d'or sur toute l'appli, et lance la cérémonie si elle n'a pas été vue ici */
function ereDor() {
  if (ERE.enCours) { majReglageOr(); return; }
  const pm = typeof D !== "undefined" && D && D.premierMillion, act = ereDorActive();
  ereAppliquer(!!act, act ? act.nom : "");
  if (act) { ereStyle(); ereCanvasPoussiere(); }
  if (pm && pm.nom && !simulation() && ereDue(pm) && !ERE.reporte) ereCeremonie(pm);   // due même si le gagnant a masqué l'ère d'or (l'aura ne masque que la transformation durable)
  else if (!ERE.param) { ERE.param = true; let q = null; try { q = new URLSearchParams(location.search).get("ere"); } catch (e) { q = null; }
    if (q && vraiAdmin()) setTimeout(() => ereRepetition(q === "temoin" ? "temoin" : "gagnant"), 400); }
  majReglageOr();
}
/** Réglage réservé au premier millionnaire : afficher ou masquer l'ère d'or pour tout le monde (visible seulement après sa cérémonie) */
function majReglageOr() {
  const sec = document.getElementById("regl-or"); if (!sec) return;
  const pm = typeof D !== "undefined" && D && D.premierMillion, moi = moiPilote();
  sec.hidden = !(pm && moi && pm.nom === moi && !ereDue(pm)); if (sec.hidden) return;
  const brut = ((D.ecurie || {})[moi] || {}).equip || {}, etat = brut.aura === "off" ? "off" : "";
  sec.querySelectorAll("[data-or]").forEach(b => { b.setAttribute("aria-pressed", String(b.dataset.or === etat)); b.onclick = async () => {
    if (b.dataset.or === etat) return;
    const avant = D.ecurie, equip = Object.assign({}, brut, { aura: b.dataset.or });
    delete equip.amelios; delete equip.amelioY; delete equip.amelioT;
    D.ecurie = Object.assign({}, avant, { [moi]: Object.assign({}, (avant || {})[moi], { equip: Object.assign({}, brut, { aura: b.dataset.or }) }) });
    ereDor();
    if (SOURCE !== "api" || simulation()) { toast("Aperçu seulement : rien n'est envoyé."); return; }
    const rep = await posterAdmin({ action: "ecurie", personne: moi, equip: equip });
    if (rep.ok) { if (rep.ecurie) D.ecurie = rep.ecurie; toast(b.dataset.or === "off" ? "Masquée pour tout le monde." : "Visible par tout le monde 👑"); }
    else { D.ecurie = avant; ereDor(); toast(rep.message || "Impossible d'enregistrer."); }
  }; });
}

/* ---------- Mode admin : désactivé par défaut, activable dans les Réglages ---------- */
function majModeAdmin() {
  const sec = $("#regl-admin"); if (!sec) return;
  sec.hidden = !vraiAdmin() || !D || !D.personnes; if (sec.hidden) return;
  const on = adminActif();
  sec.querySelectorAll("[data-admin-on]").forEach(b => { b.setAttribute("aria-pressed", String((b.dataset.adminOn === "1") === on)); b.onclick = () => {
    if ((b.dataset.adminOn === "1") === on) return;
    try { if (b.dataset.adminOn === "1") sessionStorage.setItem("versus.adminOn", "1"); else sessionStorage.removeItem("versus.adminOn"); } catch (e) { /* indisponible */ }
    ["versus.vueJoueur", "versus.dateSim", "versus.apercuSaison"].forEach(k => stock.del(k));
    location.reload();
  }; });
  $("#bloc-admin-joueur").hidden = true;   // plus de « Je joue en tant que »
  if (window.APERCUS_FINIS) { const i = sec.querySelector("p.info"); if (i) i.textContent = "Désactivé, tu es un joueur comme les autres. Activé (jusqu'à la fermeture de l'appli) : saisie de secours d'un relevé pour un autre joueur. Les codes, la clé admin et les réglages communs restent toujours accessibles plus bas."; }

}
/* ---------- Vue joueur et date simulée (admin) ---------- */
const DATES_SIM = [["", "Aujourd'hui"], ["2026-11-20", "20 nov. · teaser"], ["2026-12-02", "2 déc. · révélation"], ["2026-12-03", "3 déc. · chauffe"], ["2026-12-22", "22 déc. · cartes de janvier"],
  ["2027-01-21", "21 janv. · nouvelles règles"], ["2027-02-21", "21 févr. · tout en jeu"], ["2027-04-25", "25 avr. · piège des Androïdes"], ["2027-11-21", "21 nov. 2027 · Finale"]];
function majVueJoueur() {
  const sec = $("#regl-vue"); if (!sec) return;
  sec.hidden = window.APERCUS_FINIS || !adminActif() || !D || !D.personnes;
  if (sec.hidden) return;
  const vj = stock.get("versus.vueJoueur") || "", ds = stock.get("versus.dateSim") || "";
  $("#choix-vue").innerHTML = '<button class="chip" type="button" data-vuej="" aria-pressed="' + !vj + '">👑 Admin</button><button class="chip" type="button" data-vuej="' + esc(joueurAdmin()) + '" aria-pressed="' + !!vj + '">👁️ Joueur (toi, sans admin)</button>';
  $("#choix-date").innerHTML = DATES_SIM.map(([d, l]) => '<button class="chip" type="button" data-dsim="' + d + '" aria-pressed="' + (ds === d) + '">' + esc(l) + "</button>").join("");
  document.querySelectorAll("[data-vuej]").forEach(b => b.addEventListener("click", () => { if (b.dataset.vuej) { stock.set("versus.vueJoueur", b.dataset.vuej); stock.set("versus.apercuSaison", "0"); } else { stock.del("versus.vueJoueur"); stock.del("versus.dateSim"); } location.reload(); }));
  document.querySelectorAll("[data-dsim]").forEach(b => b.addEventListener("click", () => { if (b.dataset.dsim) stock.set("versus.dateSim", b.dataset.dsim); else stock.del("versus.dateSim"); location.reload(); }));
  const band = $("#simu-band"), parts = [];
  if (vj) parts.push("👁️ Vue joueur (toi, sans admin)");
  if (window.DATE_SIM) parts.push("📅 Simulé au " + esc(new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })) + " · rien n'est envoyé");
  band.hidden = !parts.length;
  band.innerHTML = parts.length ? "<span>" + parts.join(" · ") + '</span><button class="lien" type="button" id="simu-quitter">Revenir à l\'admin, aujourd\'hui</button>' : "";
  const q = $("#simu-quitter"); if (q) q.addEventListener("click", () => { stock.del("versus.vueJoueur"); stock.del("versus.dateSim"); location.reload(); });
}
/* Lien direct vers le Stand (bouton des e-mails de rappel) : …/#stand */
if (location.hash === "#stand") { ETAT.podium = "stand"; const ko = moisCarteOuvert(); if (ko) choisirSaison(ko === CHAUFFE_K ? SAISON.premiere - 1 : Math.floor(ko / 100)); garder(); history.replaceState(null, "", location.pathname + location.search + "#trophees"); }
montrerVue(vueActive());
(function () {   // la dernière copie s'affiche tout de suite ; la mise à jour arrive par-dessus
  const c = stock.get(CLES.cache); if (!c || !apiUrl() || !stock.get(CLES.cle)) return;
  try { D = JSON.parse(c); SOURCE = "cache"; EN_CHARGEMENT = true; afficherTout(); } catch (e) { D = null; }
})();
charger(false);
window.addEventListener("online", () => { if (SOURCE === "cache") charger(false); if (window.Moi && moiConnecte()) window.Moi.rafraichir(false); });   // v16.83 : Moi se relit aussi au retour du réseau
setTimeout(verifierMiseAJour, 3000);
window.addEventListener("offline", () => { if (D && SOURCE === "api") { SOURCE = "cache"; afficherTout(); } });
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
setTimeout(prechaufferMoi, 600);
/* v16.65 · demande au navigateur de ne pas effacer les données de l'appli quand le téléphone manque de place (adresse et clé de ton fichier, réglages) */
window.addEventListener("load", () => { try { if (navigator.storage && navigator.storage.persist && stock.get("versus.moi.api")) navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist(); }).catch(() => {}); } catch (e) { /* indisponible */ } });
