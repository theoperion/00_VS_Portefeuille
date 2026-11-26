/* Test · 📖 Règles en tuiles et « ? » d'aide (refonte de l'AFFICHAGE, contenu inchangé)
   1. sommaire en tuiles selon la date (5/12/2026, 15/1/2027, 10/6/2027) : « Ce mois-ci » en premier, chaque tuile ouvre sa fiche courte,
      « Tout le détail » déplie le texte complet ; en décembre, rien de 2027 (ni dans les tuiles, ni caché dans les fiches) ;
   2. « Ce mois-ci » juste à chaque date (circuit, règle spéciale ou piège, défi, cartes, trésor, mini-jeu, dates clés) ;
   3. chaque « ? » (Stand, pronostic, pole, points, course, titres, classement…) ouvre la bonne fiche, à la bonne ligne ; un « ? » dans un résumé
      repliable n'ouvre pas le résumé ; jamais de « ? » vers une règle pas encore visible ;
   4. Réglages › Affichage › « Afficher les ? d'aide » : Non les masque (gardé après rechargement), Oui les remet ;
   5. bouton retour du téléphone : fiche → sommaire → fermé ; 0 erreur JS ; 390 px sans débordement, clair et sombre (captures).
   Fausses données uniquement (serveur Google intercepté, mêmes pilotes inventés que tfiches-podium.js).
   Serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tregles-tuiles.js   (PORT=…, API_VERSUS=…, CAPTURES=…) */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "regles-tuiles");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const API = fs.readFileSync(process.env.API_VERSUS || __dirname + "/../../app_scripts/versus/API.js", "utf8");
const masquer = eval("(" + API.match(/function vsMasquerMontants_\(o, nomMoi\) \{[\s\S]*?\n\}\n/)[0].replace("function vsMasquerMontants_", "function") + ")");
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
/** un pilote INVENTÉ : 2 enveloppes, versements, rendements (même forme que teuros.js) */
function pilote(nom, base, jusqua) {
  const KS = []; for (let y = 2025; y <= 2027; y++) for (let m = 1; m <= 12; m++) { const k = y * 100 + m; if (k <= jusqua) KS.push(k); }
  const st = [{ v: 0, cum: 0 }, { v: 0, cum: 0 }], rows = [];
  KS.forEach((k, i) => { const sai = [], calc = [];
    const env = [0, 1].map(e => { const prev = st[e].v; const verse = i === 0 ? base * (e ? .4 : .6) : (rnd() < .6 ? Math.round((.01 + rnd() * .02) * base) : 0);
      const val = Math.round((prev + verse) * (1 + (rnd() - .45) * .08) * 100) / 100, gain = val - prev - verse, den = prev + verse / 2;
      st[e].cum += verse; st[e].v = val; return { verse, val, gain, r: den > 0 ? gain / den : null, cum: st[e].cum, prev }; });
    env.forEach(x => sai.push(x.verse, x.val)); sai.push(null, null, null, null);
    const T = { verse: env[0].verse + env[1].verse, val: env[0].val + env[1].val, prev: env[0].prev + env[1].prev, cum: env[0].cum + env[1].cum };
    T.gain = T.val - T.prev - T.verse; T.r = T.prev + T.verse / 2 > 0 ? T.gain / (T.prev + T.verse / 2) : null;
    [T, env[0], env[1]].forEach(x => calc.push(x.verse, x.val, x.gain, x.r, x.cum)); for (let j = 0; j < 10; j++) calc.push(0);
    rows.push([k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", sai, calc]); });
  return { nom, rows };
}
const ECURIES = { "Théo": { equip: { livree: "rouge", numero: 7 } }, "Kévin": { equip: { livree: "bleu", numero: 44 } }, "Clément": { equip: { numero: 3 } }, "Devlin": { equip: { numero: 16 } } };
function donnees(moi, jusqua) {
  seed = 7;
  const KS = []; for (let y = 2025; y <= 2027; y++) for (let m = 1; m <= 12; m++) { const k = y * 100 + m; if (k <= jusqua) KS.push(k); }
  const d = { ok: true, version: 91, genere: "2027-01-01T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: NOMS.map(n => pilote(n, n === moi ? 5e6 : 20000 + 90000 * rnd(), jusqua)),
    marche: { indices: ["S&P 500"], mois: KS.map(k => [k, .004]), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: ECURIES, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
  const m = masquer(d, moi); m.session = { role: "perso", nom: moi }; return m;
}
async function page(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) err.push(m.text()); });
  await p.clock.setFixedTime(new Date(o.quand));
  const rep = donnees(o.moi, o.jusqua); if (o.admin) rep.session = { role: "admin", nom: o.moi };
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tickets" ? { ok: true, ouvert: false } : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : rep) }); });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.bullePortrait", "1");
    localStorage.setItem("versus.saison1", "1"); localStorage.setItem("versus.chauffe1", "1"); localStorage.setItem("versus.ecurieTeaser", "1");
    ["2026", "2027"].forEach(y => { localStorage.setItem("versus.gpVu." + y, y + "12"); localStorage.setItem("versus.baVu." + y, y + "12"); }); });
  if (o.admin) await p.addInitScript(() => { localStorage.setItem("versus.apercuSaison", "1"); sessionStorage.setItem("versus.adminOn", "1"); });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba, .av-ov").forEach(x => x.remove()));
  return { ctx, p, err };
}

const w = (p, t) => p.waitForTimeout(t);
const nettoie = p => p.evaluate(() => { document.querySelectorAll(".revel, .regles, .tuto, .ba, .av-ov, .af3d, .fc-voile, .bulle-portrait").forEach(x => x.remove()); document.documentElement.classList.remove("fige"); });
const podium = (p, o) => p.evaluate(async o => { ETAT.podium = o; GP_ETAPE = null; garder(); allerA("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 700)); document.querySelectorAll(".revel, .regles, .tuto, .ba, .av-ov, .af3d, .fc-voile, .bulle-portrait").forEach(x => x.remove()); document.documentElement.classList.remove("fige"); await new Promise(r => setTimeout(r, 400)); }, o);
const vue = (p, v) => p.evaluate(async v => { allerA(v); await new Promise(r => setTimeout(r, 700)); document.querySelectorAll(".revel, .regles, .tuto, .ba, .av-ov, .af3d, .fc-voile, .bulle-portrait").forEach(x => x.remove()); document.documentElement.classList.remove("fige"); await new Promise(r => setTimeout(r, 400)); }, v);
/** l'état de la fenêtre des règles */
const etat = p => p.evaluate(() => { const o = document.querySelector(".regles"); if (!o) return { ouvert: false };
  const f = [...o.querySelectorAll(".rgt-f")].find(x => !x.hidden), vise = o.querySelector(".rgt-vise");
  return { ouvert: true, sommaire: !o.querySelector(".rgt-som").hidden, fiche: f ? f.dataset.fiche : "", vise: vise ? (vise.dataset.ancre || vise.dataset.qa || "") : "", viseVu: !!(vise && vise.getBoundingClientRect().height),
    deborde: o.querySelector(".rg-c").scrollWidth > o.querySelector(".rg-c").clientWidth + 1 || document.documentElement.scrollWidth > innerWidth + 1 }; });
const SECRET_2027 = /Mer de dunes|Chevaucheur|Nasdaq|Mini-jeu|mini-jeu|Trophées|Côté obscur|éclat|Flair|piège|Piège|Rattrapage|Pronostic|Pole position|Mondes|Gant de l'infini/;
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  const CAS = [
    { tag: "5/12/2026", quand: "2026-12-05T10:00:00", jusqua: 202611, tuiles: "mois,essentiel,champ,cartes,gp,tresor",
      mois: [/Tour de chauffe/, /Calendrier de l'Avent/, /Trésor d'entraînement/, /Chercheur de Noël/, /Écurie ouverte/, /à partir du 20 décembre/], pas: SECRET_2027 },
    { tag: "15/1/2027", quand: "2027-01-15T10:00:00", jusqua: 202612, tuiles: "mois,essentiel,champ,cartes,bonus,speciaux,pieges,pioche,gp,tresor,mj,trophees,bientot",
      mois: [/Mer de dunes/, /Chevaucheur des sables/, /Bats le Nasdaq-100/, /Prochaine fenêtre le 20 janvier, pour février/, /2e indice depuis le 11/, /jauge chaud-froid le 21/, /Mini-jeu du mois/, /Fin du mois/], pas: /Côté obscur|Calendrier de l'Avent|Tour de chauffe/ },
    { tag: "10/6/2027", quand: "2027-06-10T10:00:00", jusqua: 202705, tuiles: "mois,essentiel,champ,cartes,bonus,speciaux,pieges,pioche,gp,tresor,mj,trophees,bientot",
      mois: [/Étoiles/, /Le Côté obscur/, /Défi du mois/, /Prochaine fenêtre le 20 juin, pour juillet/, /2e indice le 11/, /Mini-jeu du mois/], pas: /Chevaucheur|Calendrier de l'Avent|Tour de chauffe/ }
  ];
  /* ---------- 1 et 2. sommaire, fiches, « Ce mois-ci » ---------- */
  for (const cas of CAS) {
    const { ctx, p, err } = await page(b, { quand: cas.quand, jusqua: cas.jusqua, moi: "Théo" });
    await podium(p, "stand");
    await p.click("#regles-ouvrir"); await w(p, 300);
    const s = await p.evaluate(() => { const o = document.querySelector(".regles"), t = [...o.querySelectorAll(".rgt-som [data-rgt]")];
      return { tuiles: t.map(x => x.dataset.rgt).join(), premiere: t[0] && t[0].classList.contains("rgt-hero"), mois: o.querySelector("#rgt-mois .rgt-court").innerText, tout: o.textContent, html: o.innerHTML }; });
    ok(s.tuiles === cas.tuiles, cas.tag + " : les tuiles du sommaire (" + s.tuiles + ")");
    ok(s.premiere, cas.tag + " : « Ce mois-ci » en premier, en grand");
    cas.mois.forEach(re => ok(re.test(s.mois), cas.tag + " : Ce mois-ci dit " + re));
    ok(!cas.pas.test(cas.tag === "5/12/2026" ? s.tout : s.mois), cas.tag + " : rien en trop " + (cas.tag === "5/12/2026" ? "(aucun mot de 2027, même caché dans une fiche)" : "dans Ce mois-ci") + " " + ((cas.tag === "5/12/2026" ? s.tout : s.mois).match(cas.pas) || [""])[0]);
    const h = await p.evaluate(() => { const o = document.querySelector(".regles"), hero = o.querySelector(".rgt-hero");
      return { hero: hero.innerText, pioche: (o.querySelector('.rgt-som [data-rgt="pioche"]') || {}).innerText || "", pas: [...o.querySelectorAll(".rgt-pas.expl > li")].map(l => !!(l.querySelector("small") && l.querySelector("small").textContent.trim().length > 8)) }; });
    ok(!/🗺️/.test(h.hero) && /Ce mois-ci/i.test(h.hero), cas.tag + " : la grande tuile sans doublon d'en-tête (« " + h.hero.replace(/\s+/g, " ").slice(0, 60) + " »)");
    ok(h.pas.every(Boolean), cas.tag + " : chaque pastille (bonus, mois spéciaux) garde son explication (" + h.pas.length + ")");
    if (h.pioche) ok(/si tu finis dernier/.test(h.pioche) && !/\?/.test(h.pioche), cas.tag + " : tuile Rattrapage « si tu finis dernier »");
    ok(!/\d\s?€/.test(s.tout), cas.tag + " : aucun montant dans les règles");
    ok(!/atout du circuit/i.test(s.tuiles), cas.tag + " : pas de tuile pour l'atout du circuit");
    if (cas.tag === "15/1/2027") { await w(p, 200); await p.screenshot({ path: DOSSIER + "/sommaire-janvier-clair.png" }); await p.emulateMedia({ colorScheme: "dark" }); await w(p, 200); await p.screenshot({ path: DOSSIER + "/sommaire-janvier-sombre.png" }); await p.emulateMedia({ colorScheme: "light" }); }
    // chaque tuile : sa fiche, courte, avec « Tout le détail » qui déplie le texte complet
    const fiches = await p.evaluate(async () => { const o = document.querySelector(".regles"), out = [];
      for (const b of [...o.querySelectorAll(".rgt-som [data-rgt]")]) { b.click(); await new Promise(r => setTimeout(r, 60));
        const f = [...o.querySelectorAll(".rgt-f")].find(x => !x.hidden), c = f && f.querySelector(".rgt-court"), d = f && f.querySelector(".rgt-det");
        const lignes = c ? [...c.querySelectorAll(":scope > p, :scope > ul.rgt-l > li")].length + (c.querySelector(".rgt-pas") ? 1 : 0) : 0, avant = d ? d.getBoundingClientRect().height : 0; if (d) d.querySelector("summary").click();
        out.push({ id: b.dataset.rgt, fiche: f && f.dataset.fiche, sommaireCache: o.querySelector(".rgt-som").hidden, lignes, det: !!d, deplie: d ? d.open && d.getBoundingClientRect().height > avant + 20 : true,
          deborde: o.querySelector(".rg-c").scrollWidth > o.querySelector(".rg-c").clientWidth + 1 });
        if (d) d.open = false; o.querySelector(".rg-retour").click(); }
      return out; });
    fiches.forEach(f => ok(f.fiche === f.id && f.sommaireCache && !f.deborde && f.deplie && (f.id === "mois" ? f.lignes <= 9 : f.lignes <= 5),
      cas.tag + " : tuile " + f.id + " → sa fiche (" + f.lignes + " lignes" + (f.det ? ", « Tout le détail » se déplie" : ", tout tient dans la fiche") + ")"));
    if (cas.tag !== "10/6/2027") { await p.evaluate(() => document.querySelector('.regles [data-rgt="mois"]').click()); await w(p, 200);
      for (const sch of ["light", "dark"]) { await p.emulateMedia({ colorScheme: sch }); await w(p, 200); await p.screenshot({ path: DOSSIER + "/ce-mois-ci-" + (cas.tag === "5/12/2026" ? "decembre" : "janvier") + "-" + (sch === "light" ? "clair" : "sombre") + ".png" }); }
      await p.emulateMedia({ colorScheme: "light" }); }
    if (cas.tag === "15/1/2027") for (const [t, n] of [["champ", "fiche-points"], ["bonus", "fiche-bonus"], ["tresor", "fiche-tresor"]]) {
      await p.evaluate(t => document.querySelector('.regles .rgt-som [data-rgt="' + t + '"]') ? document.querySelector('.regles .rgt-som [data-rgt="' + t + '"]').click() : document.querySelector('.regles [data-rgt="' + t + '"]').click(), t);
      await p.evaluate(t => { const o = document.querySelector(".regles"); o.querySelector(".rgt-som").hidden = true; o.querySelectorAll(".rgt-f").forEach(f => { f.hidden = f.dataset.fiche !== t; }); o.querySelector(".rg-corps").scrollTop = 0; }, t);
      await w(p, 200); await p.screenshot({ path: DOSSIER + "/" + n + "-clair.png" }); await p.emulateMedia({ colorScheme: "dark" }); await w(p, 200); await p.screenshot({ path: DOSSIER + "/" + n + "-sombre.png" }); await p.emulateMedia({ colorScheme: "light" }); }
    // une ligne de « Ce mois-ci » ouvre sa fiche
    if (cas.tag === "15/1/2027") { await p.evaluate(() => { const o = document.querySelector(".regles"); o.querySelector('[data-rgt="mois"]').click(); o.querySelector('#rgt-mois li[data-qa="bonus#defi"]').click(); }); await w(p, 100);
      const e = await etat(p); ok(e.fiche === "bonus" && e.vise === "defi", "15/1/2027 : dans Ce mois-ci, la ligne du défi ouvre la fiche Bonus, défi en évidence"); }
    // 5. bouton retour du téléphone : fiche → sommaire → fermé
    await nettoie(p); await p.click("#regles-ouvrir"); await w(p, 200); await p.click('.regles .rgt-som [data-rgt="cartes"]'); await w(p, 150);
    const r0 = await etat(p); await p.evaluate(() => history.back()); await w(p, 400); const r1 = await etat(p); await p.evaluate(() => history.back()); await w(p, 400); const r2 = await etat(p);
    ok(r0.fiche === "cartes" && r1.ouvert && r1.sommaire && !r2.ouvert, cas.tag + " : retour du téléphone : fiche → sommaire → fermé " + JSON.stringify([r0.fiche, r1.sommaire, r2.ouvert]));
    ok(!err.length, cas.tag + " : 0 erreur JS " + JSON.stringify(err));
    await ctx.close();
  }
  /* ---------- 3. les « ? » ---------- */
  const essaiQ = async (p, tag, ou, aller, sel, fiche, vise) => {
    await aller(); const n = await p.evaluate(sel => { const q = [...document.querySelectorAll(sel)].filter(x => x.getBoundingClientRect().height && getComputedStyle(x).visibility === "visible" && !x.closest("[hidden]")); document.querySelectorAll("[data-qtest]").forEach(x => x.removeAttribute("data-qtest")); if (q[0]) { q[0].dataset.qtest = "1"; q[0].scrollIntoView({ block: "center" }); } return q.length; }, sel);
    if (!n) { ok(false, tag + " : « ? » " + ou + " introuvable (" + sel + ")"); return; }
    await w(p, 150); await p.click("[data-qtest]"); await w(p, 250);
    const e = await etat(p);
    ok(e.ouvert && e.fiche === fiche && (!vise || (e.vise === vise && e.viseVu)) && !e.deborde, tag + " : « ? » " + ou + " → fiche " + fiche + (vise ? " (" + vise + " en évidence)" : "") + " " + JSON.stringify(e));
    await nettoie(p);
  };
  { const { ctx, p, err } = await page(b, { quand: "2027-01-22T10:00:00", jusqua: 202612, moi: "Théo" });
    const st = () => podium(p, "stand"), tag = "22/1/2027 (fenêtre ouverte)";
    await essaiQ(p, tag, "Mes cartes", st, '#v-trophees h3.s-h3 .qr[data-qr="cartes"]', "cartes");
    await essaiQ(p, tag, "pronostic", st, '.qr[data-qr="bonus#prono"]', "bonus", "prono");
    await essaiQ(p, tag, "pole", st, '.qr[data-qr="bonus#pole"]', "bonus", "pole");
    await essaiQ(p, tag, "fenêtre ouverte", st, '.st-etat .qr[data-qr="mois"]', "mois");
    await essaiQ(p, tag, "Ce mois-ci à … (après le 20 : le mois suivant)", st, '.regles-mois .rm-h .qr[data-qr="mois#prochain"]', "mois", "prochain");
    await essaiQ(p, tag, "piège du mois", st, '.regles-mois .qr[data-qr="pieges"]', "pieges");
    await essaiQ(p, tag, "défi (Ce mois-ci à …)", st, '.regles-mois .qr[data-qr="bonus#defi"]', "bonus", "defi");
    { await st(); await p.evaluate(() => document.querySelector('.qr[data-qr="bonus#prono"]').scrollIntoView({ block: "center" })); await p.click('.qr[data-qr="bonus#prono"]'); await w(p, 250);
      const e0 = await etat(p); await p.evaluate(() => history.back()); await w(p, 400); const e1 = await etat(p);
      ok(e0.fiche === "bonus" && !e1.ouvert, tag + " : fiche ouverte par un « ? » : un seul retour du téléphone ferme la fenêtre"); await nettoie(p); }
    // le « ? » d'un titre n'est jamais seul sur sa ligne (collé au dernier mot)
    { await st(); const nw = await p.evaluate(() => [...document.querySelectorAll('#v-trophees .st-etat .st-h > b .qr, #v-trophees .regles-mois .rm-h .qr')].map(q => q.parentElement.classList.contains("qr-nw") && q.parentElement.textContent.length > 2));
      ok(nw.length >= 2 && nw.every(Boolean), tag + " : « ? » des titres collés au dernier mot (" + nw.length + ")"); }
    // capture : un « ? » en situation (pronostic et pole)
    await st(); await p.evaluate(() => document.querySelector('.qr[data-qr="bonus#prono"]').scrollIntoView({ block: "start" })); await p.evaluate(() => scrollBy(0, -80)); await w(p, 300);
    await p.screenshot({ path: DOSSIER + "/aide-en-situation-clair.png" }); await p.emulateMedia({ colorScheme: "dark" }); await w(p, 300); await p.screenshot({ path: DOSSIER + "/aide-en-situation-sombre.png" }); await p.emulateMedia({ colorScheme: "light" });
    ok(!err.length, tag + " : 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  { const { ctx, p, err } = await page(b, { quand: "2027-06-10T10:00:00", jusqua: 202705, moi: "Théo" }), tag = "10/6/2027";
    await essaiQ(p, tag, "titre du Grand Prix", () => podium(p, "gp"), '.gp-h .qr[data-qr="gp"]', "gp");
    await essaiQ(p, tag, "Détail des points", () => podium(p, "gp"), '#pts-det > summary .qr', "champ");
    ok(await p.evaluate(() => !document.querySelector("#pts-det").open || ETAT.ptsOuvert === "1"), tag + " : toucher le « ? » n'ouvre pas le détail des points");
    await essaiQ(p, tag, "Les titres", () => podium(p, "defis").then(() => p.evaluate(async () => { const b = [...document.querySelectorAll(".vit-apart button")].find(x => /Titres/.test(x.textContent)); if (b) b.click(); await new Promise(r => setTimeout(r, 500)); })), '#vit-titres .qr', "trophees", "titres");
    await essaiQ(p, tag, "Les 12 mondes", () => podium(p, "defis").then(() => p.evaluate(async () => { const b = [...document.querySelectorAll(".vit-tabs button")].find(x => /Mondes/.test(x.textContent)); if (b) b.click(); await new Promise(r => setTimeout(r, 500)); })), '#vit-mondes .qr', "trophees");
    await essaiQ(p, tag, "Classement", () => vue(p, "classement"), '#v-classement h2.sec > .qr', "essentiel");
    await essaiQ(p, tag, "Verdict du mois", () => vue(p, "classement"), '#v-classement .verdict .qr', "champ");
    /* 4. le réglage */
    await vue(p, "classement");
    await p.evaluate(() => ouvrirReglages()); await w(p, 300);
    await p.evaluate(() => document.querySelector("#regl-aides-jeu").scrollIntoView({ block: "center" })); await w(p, 200);
    await p.screenshot({ path: DOSSIER + "/reglage-aides-clair.png" }); await p.emulateMedia({ colorScheme: "dark" }); await w(p, 200); await p.screenshot({ path: DOSSIER + "/reglage-aides-sombre.png" }); await p.emulateMedia({ colorScheme: "light" });
    await w(p, 600);
    const oui = await p.evaluate(() => ({ presse: document.querySelector('[data-qr-choix="1"]').getAttribute("aria-pressed"), vus: [...document.querySelectorAll("#v-classement .qr")].filter(x => x.getBoundingClientRect().height).length }));
    ok(oui.presse === "true" && oui.vus >= 2, "réglage : « Oui » par défaut, les « ? » sont là (" + oui.vus + ")");
    await p.click('[data-qr-choix="0"]'); await w(p, 200);
    const non = await p.evaluate(() => ({ cls: document.documentElement.classList.contains("sans-qr"), vus: [...document.querySelectorAll(".qr")].filter(x => x.getBoundingClientRect().height).length, ls: localStorage.getItem("versus.aidesJeu") }));
    ok(non.cls && non.vus === 0 && non.ls === "0", "réglage : « Non » masque tous les « ? » " + JSON.stringify(non));
    await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await w(p, 1500); await podium(p, "stand");
    const apres = await p.evaluate(() => [...document.querySelectorAll(".qr")].filter(x => x.getBoundingClientRect().height).length);
    ok(apres === 0, "réglage : toujours masqués après rechargement (" + apres + ")");
    await p.evaluate(() => ouvrirReglages()); await w(p, 200); await p.click('[data-qr-choix="1"]'); await w(p, 200); await p.evaluate(() => document.querySelector("#fermer-reglages").click()); await podium(p, "gp");
    const remis = await p.evaluate(() => [...document.querySelectorAll(".qr")].filter(x => x.getBoundingClientRect().height).length);
    ok(remis >= 2, "réglage : « Oui » les remet (" + remis + ")");
    ok(!err.length, tag + " : 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  /* décembre : jamais de « ? » vers une règle pas encore visible */
  { const { ctx, p, err } = await page(b, { quand: "2026-12-05T10:00:00", jusqua: 202611, moi: "Théo" });
    const l = [];
    for (const o of ["gp", "stand"]) { await podium(p, o); l.push(...await p.evaluate(() => [...document.querySelectorAll(".qr")].map(x => x.dataset.qr))); }
    await vue(p, "classement"); l.push(...await p.evaluate(() => [...document.querySelectorAll(".qr")].map(x => x.dataset.qr)));
    ok(l.length >= 3 && l.every(q => ["essentiel", "champ", "cartes", "gp", "tresor", "mois"].includes(q.split("#")[0])), "5/12/2026 : les « ? » ne mènent qu'aux règles de décembre (" + [...new Set(l)].join(", ") + ")");
    await essaiQ(p, "5/12/2026", "Mes cartes", () => podium(p, "stand"), '#v-trophees h3.s-h3 .qr[data-qr="cartes"]', "cartes");
    ok(!err.length, "5/12/2026 (« ? ») : 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  /* Théo, 26/11 : en aperçu admin « Tout afficher » (avant le 1er décembre), la tuile 🗝️ Le trésor est là aussi, sans aucune énigme */
  { const { ctx, p, err } = await page(b, { quand: "2026-11-26T10:00:00", jusqua: 202610, moi: "Théo", admin: true });
    const ap = await p.evaluate(() => apercuSaison()); await podium(p, "stand"); await p.click("#regles-ouvrir"); await w(p, 300);
    const t = await p.evaluate(() => { const o = document.querySelector(".regles"), b = o && o.querySelector('.rgt-som [data-rgt="tresor"]'), f = o && o.querySelector("#rgt-tresor");
      return { tuile: !!b, etapes: f ? f.querySelectorAll(".rgt-court .tr-e").length : 0, txt: f ? f.textContent : "" }; });
    ok(ap && t.tuile && t.etapes === 4, "aperçu admin « Tout afficher » (26/11/2026) : la tuile 🗝️ Le trésor est là, avec ses 4 étapes " + JSON.stringify({ ap, tuile: t.tuile, etapes: t.etapes }));
    ok(!/gp-enigme|Énigme du mois :|💡 2e indice :/.test(t.txt) && !/« [^»]{25,} »/.test(t.txt), "aperçu admin : la fiche du trésor ne dévoile aucune énigme");
    ok(!err.length, "aperçu admin (trésor) : 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI. Captures : " + DOSSIER);
  process.exit(ko.length ? 1 : 0);
})();
