/* Test v20.83 · la vitrine d'une fiche s'explique au toucher (demande de Théo, 26/11), pour soi comme pour un autre :
   la plaque (comment il l'a eue ; pour un autre : « tu l'as aussi » ou comment l'avoir), les 3 chiffres du palmarès (ce qu'ils comptent),
   « 🎖️ Ses badges » (l'ancienne étagère d'icônes fusionnée avec les médailles : la médaille ouvre la fiche du succès qui dit QUAND ce pilote l'a eu
   et s'il était le premier ; 📌 = badge affiché au Classement), « 📈 Sa saison » (mondes, pierres, éclats, titres : ce que ça compte).
   Une seule bulle à la fois ; elle se ferme au toucher ailleurs et au bouton retour du téléphone. Aucun montant, aucun secret, pas de vitrine en décembre ;
   0 erreur JS ; 390 px clair et sombre, rien ne déborde ni ne se recouvre.
   Fausses données uniquement (serveur Google intercepté, même saison inventée que tbadges.js : janvier et février 2027 joués).
   Serveur local : python3 -m http.server 8771 &  puis  node outils-tests/tvitrine-bulles.js   (PORT=…, CAPTURES=…) */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-vitrine");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const R = { 202701: [0.02, 0.06, 0.01, 0.005, -0.03], 202702: [0.01, 0, 0.055, -0.02, 0.07] };
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
function personne(nom, i) { const rows = [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)]; let v = 1010;
  [202701, 202702].forEach(k => { v = Math.round(v * (1 + R[k][i]) + 50); rows.push(ligne(k, v, R[k][i])); }); return { nom, rows }; }
function donnees(session, chauffe) {
  return { ok: true, version: 85, genere: "2027-03-15T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: chauffe ? NOMS.map(nom => ({ nom, rows: [ligne(202611, 1000, 0.01)] })) : NOMS.map(personne),
    marche: { indices: ["S&P 500"], mois: [[202611, 0.01], [202612, 0.005], [202701, 0.008], [202702, 0.015]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7,
    ecurie: chauffe ? {} : { "Kévin": { equip: { plaque: "premiersang", badges: ["decollage"] } }, "Nicolas": { equip: { plaque: "premiersang" } } },
    exclusifs: chauffe ? {} : { decollage: { nom: "Kévin", mois: 202701 } },
    cartes: chauffe ? {} : { 2027: { Nicolas: { 202702: { c: "pari", cible: "Kévin" } } } }, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
const TRESORS = { ok: true, total: 2, trouves: ["silverstone", "djeddah"], tresors: [
  { circuit: "silverstone", chercheurs: [{ nom: "Clément", j: 20270104 }, { nom: "Théo", j: 20270106 }, { nom: "Kévin", j: 20270110 }] },
  { circuit: "djeddah", chercheurs: [{ nom: "Théo", j: 20270203 }, { nom: "Clément", j: 20270205 }] }] };
async function page(b, quand, moi, sombre, chauffe) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) err.push(m.text()); });
  await p.clock.setFixedTime(new Date(quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? (chauffe ? { ok: true, tresors: [], trouves: [], total: 0 } : TRESORS) : c.action === "tickets" ? { ok: true, ouvert: false } : donnees({ role: "perso", nom: moi }, chauffe)) }); });
  await p.addInitScript(() => { ["versus.cle", "versus.q3dAffichette", "versus.tuto1", "versus.bullePortrait", "versus.saison1", "versus.chauffe1", "versus.ecurieTeaser"].forEach(k => localStorage.setItem(k, k === "versus.cle" ? "x" : "1")); localStorage.setItem("versus.exclVus", "[]"); });
  await p.goto("http://localhost:" + PORT + "/index.html"); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba, .av-ov").forEach(x => x.remove()));
  return { ctx, p, err };
}
/** dans la page : ouvre la fiche de « nom », touche chaque élément de la vitrine et lit ce qui s'ouvre */
const PARCOURS = async ({ nom }) => {
  const w = (t = 250) => new Promise(r => setTimeout(r, t)), toastTxt = () => { const t = document.querySelector("#toast"); return t && !t.hidden ? t.querySelector(".tst-t").textContent : null; };
  const ouvrir = async () => { document.querySelectorAll(".revel").forEach(x => x.remove()); ETAT.fiche = nom; garder(); allerA("fiche"); await w(500); document.querySelectorAll(".revel, .regles, .tuto, .ba").forEach(x => x.remove()); };
  await ouvrir(); await w(500); rendreFiche(); await w(300);   // éclats chargés
  const v = document.querySelector("#v-fiche .vitrine"); if (!v) return { vitrine: false };
  const out = { vitrine: true, txt: v.innerText, html: v.outerHTML, plaque: null, chif: [], puces: [], meds: [], spe: [], etagere: !!v.querySelector(".vt-etagere"), titres: [...v.querySelectorAll(".vt-st b")].map(b => b.textContent), pins: v.querySelectorAll(".vt-pin").length };
  const retour = async () => { if (history.state && history.state.vs === "garde") history.back(); else dispatchEvent(new PopStateEvent("popstate", { state: null })); await w(350); };   // le vrai bouton retour du téléphone
  const touche = async el => { el.scrollIntoView({ block: "center" }); el.click(); await w(200); return toastTxt(); };
  const pl = v.querySelector(".vt-plaque [data-bdg]"); if (pl) out.plaque = { lib: pl.textContent.trim(), b: await touche(pl) };
  for (const c of v.querySelectorAll(".vt-chif")) out.chif.push({ lib: c.innerText.replace(/\s+/g, " "), b: await touche(c) });
  for (const c of v.querySelectorAll(".vt-badges > span")) out.puces.push({ lib: c.textContent.trim(), b: await touche(c) });
  for (const c of v.querySelectorAll(".vt-meds .vt-spe")) out.spe.push({ b: await touche(c) });
  // une seule bulle à la fois : deux touchers de suite → un seul message, le dernier
  { const c = v.querySelectorAll(".vt-chif"); await touche(c[0]); const t2 = await touche(c[1]); out.uneSeule = document.querySelectorAll("#toast:not([hidden])").length === 1 && t2 === out.chif[1].b; }
  // toucher ailleurs ferme la bulle (sans rien ouvrir)
  { await touche(v.querySelector(".vt-chif")); v.querySelector(".vt-h").click(); await w(150); out.fermeAilleurs = toastTxt() === null; }
  // bouton retour du téléphone : ferme la bulle, on reste sur la fiche
  { await touche(v.querySelector(".vt-chif")); await retour(); out.fermeRetour = toastTxt() === null && vueActive() === "fiche" && ETAT.fiche === nom; }
  // les médailles : la fiche du succès dit quand CE pilote l'a eu, et s'il était le premier ; la bulle se ferme
  const ids = [...v.querySelectorAll(".vt-meds [data-carte-coll]")].map(b => b.dataset.carteColl);
  for (let i = 0; i < ids.length; i++) {
    await ouvrir(); const b = document.querySelectorAll("#v-fiche .vt-meds [data-carte-coll]")[i];
    await touche(document.querySelector("#v-fiche .vt-chif")); b.scrollIntoView({ block: "center" }); b.click(); await w(400);
    const ov = document.querySelectorAll(".sc-ov"), q = ov.length ? ov[0].querySelector(".vt-qui") : null;
    out.meds.push({ id: ids[i], n: ov.length, qui: q ? q.innerText : "", h3: ov.length ? ov[0].querySelector("h3").textContent : "", bulle: toastTxt() });
    await retour(); out.meds[i].fermeRetour = !document.querySelector(".sc-ov") && vueActive() === "fiche";
  }
  await ouvrir();
  // rien ne se recouvre : les éléments touchables de la vitrine, deux à deux ; rien ne déborde à 390 px
  const els = [...document.querySelectorAll("#v-fiche .vitrine .vt-chif, #v-fiche .vitrine .vt-med, #v-fiche .vitrine .vt-badges > span, #v-fiche .vitrine .vt-plaque [data-bdg], #v-fiche .vitrine .vt-st")].map(e => e.getBoundingClientRect());
  out.recouvre = 0; for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i], c = els[j]; if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > 2 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 2) out.recouvre++; }
  out.deborde = [...document.querySelectorAll("#v-fiche .vitrine *")].filter(x => { const r = x.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).length + (document.documentElement.scrollWidth > 390 ? 1 : 0);
  return out;
};
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  const CAS = [["Théo", "Théo"], ["Théo", "Kévin"], ["Kévin", "Kévin"], ["Kévin", "Nicolas"], ["Kévin", "Théo"]];
  for (const sombre of [false, true]) for (const [moi, nom] of CAS) {
    const { ctx, p, err } = await page(b, "2027-03-15T10:00:00", moi, sombre), soi = moi === nom, t = " · fiche de " + nom + " vue par " + moi + (sombre ? " (sombre)" : " (clair)");
    const r = await p.evaluate(PARCOURS, { nom });
    ok(r.vitrine, "la vitrine est là en saison" + t);
    if (!r.vitrine) { await ctx.close(); continue; }
    const tous = [r.plaque && r.plaque.b].concat(r.chif.map(x => x.b), r.puces.map(x => x.b), r.spe.map(x => x.b)).filter(x => x !== null);
    // (a) la plaque
    if (nom === "Kévin" || nom === "Nicolas") ok(r.plaque && (soi ? /^🏷️ Ta plaque « Premier sang » : /.test(r.plaque.b) : new RegExp("Plaque « Premier sang » de " + nom + ", gagnée avec le succès").test(r.plaque.b) && (moi === "Kévin" ? /Tu l.as aussi/.test(r.plaque.b) : /(Pour toi|Pour l'avoir toi aussi) : /.test(r.plaque.b))),
      "(a) la plaque dit comment elle a été gagnée" + (soi ? "" : " et, pour toi, « tu l'as aussi » ou comment l'avoir") + t + " " + JSON.stringify(r.plaque && r.plaque.b));
    else ok(!r.plaque, "(a) pas de plaque : rien à expliquer" + t);
    // (b) les 3 chiffres
    const il = soi ? "Tu en as " : nom + " en a ";
    ok(r.chif.length === 3 && /^🏆 Titres : les saisons du championnat remportées/.test(r.chif[0].b) && /^🏁 Manches gagnées : chaque mois est une manche/.test(r.chif[1].b) && /^🟡 Mois en tête : /.test(r.chif[2].b) && r.chif.every((x, i) => x.b.includes(il + x.lib.match(/\d+/)[0])),
      "(b) les 3 chiffres disent ce qu'ils comptent, avec le bon nombre" + t + " " + JSON.stringify(r.chif.map(x => x.b.slice(0, 60))));
    // (c) + (f) plus d'étagère d'icônes en double : « 🎖️ Ses badges » au-dessus des médailles, « 📈 Sa saison » au-dessus des pastilles
    ok(!r.etagere && r.titres[0] === "🎖️ " + (soi ? "Tes" : "Ses") + " badges" && r.titres[1] === "📈 " + (soi ? "Ta" : "Sa") + " saison", "(c/f) plus d'étagère d'icônes en double : un titre clair au-dessus des badges et des pastilles" + t + " " + JSON.stringify(r.titres));
    // (d) les médailles
    if (nom === "Kévin") ok(r.meds.some(m => m.id === "decollage" && /Décollage/.test(m.h3) && new RegExp("^🎖️ " + (soi ? "Toi" : "Kévin") + " : réussi en janvier 2027, en premier 🥇").test(m.qui)) && r.pins >= 1,
      "(d) la médaille dorée « Décollage » ouvre son succès : réussi en janvier 2027, en premier 🥇 ; 📌 sur le badge affiché au Classement" + t + " " + JSON.stringify(r.meds.map(m => m.qui)));
    if (nom === "Nicolas") ok(r.meds.some(m => m.id === "decollage" && /^🎖️ Nicolas : réussi en février 2027, après Kévin \(le premier\) · toi aussi, tu l'as réussi\./.test(m.qui)), "(d) la médaille argentée de Nicolas : quand, après qui, et toi" + t + " " + JSON.stringify(r.meds.map(m => m.qui)));
    ok(r.meds.every(m => m.n === 1 && m.qui && m.bulle === null && m.fermeRetour), "(d) chaque médaille ouvre UNE fiche de succès (avec la ligne du pilote), la bulle se ferme, le retour la ferme" + t + " (" + r.meds.length + " médailles)");
    // (e) les pastilles
    const P = r.puces.map(x => x.b);
    ok(/^🗺️ Mondes : /.test(P[0]) && P[0].includes(il) && /^🧤 Pierres du Gant de l'infini : /.test(P[1]) && P.some(x => /^🏆 Éclats de la Coupe brisée : un éclat par trésor/.test(x)) && r.puces.every(x => x.b),
      "(e) chaque pastille (🗺️ mondes, 🧤 pierres, 🏆 éclats, titres) dit ce qu'elle compte et comment l'avoir" + t + " " + JSON.stringify(r.puces.map(x => x.lib)));
    const tit = r.puces.filter(x => /^(🚩|🔥|🔍)/.test(x.lib));
    ok(tit.every(x => / depuis [a-zé]+ 2027\. Il se vole chaque mois/.test(x.b)), "(e) un titre détenu dit ce qu'il récompense et depuis quand" + t + " " + JSON.stringify(tit.map(x => x.b.slice(0, 50))));
    ok(r.uneSeule && r.fermeAilleurs && r.fermeRetour, "une seule bulle à la fois, fermée au toucher ailleurs et au bouton retour (on reste sur la fiche)" + t + " " + JSON.stringify([r.uneSeule, r.fermeAilleurs, r.fermeRetour]));
    ok(!tous.concat(r.txt).some(x => /€|\d\s?k€/.test(x)) && !/MATIERE|mithril|sève lumineuse|2028/.test(r.html + tous.join(" ")), "aucun montant, aucun secret (trésors, Coupe), rien de 2028" + t);
    ok(!r.deborde && !r.recouvre, "390 px : rien ne déborde, rien ne se recouvre" + t + " " + JSON.stringify([r.deborde, r.recouvre]));
    ok(!err.length, "0 erreur JS" + t + " " + err.slice(0, 3).join(" | "));
    if (moi === "Théo") {   // captures : la vitrine, puis une bulle ouverte
      const s = sombre ? "-sombre" : "-clair", f = nom === "Théo" ? "theo" : "kevin";
      await p.evaluate(async n => { ETAT.fiche = n; garder(); allerA("fiche"); await new Promise(r => setTimeout(r, 500)); document.querySelectorAll(".revel, .regles, .tuto, .ba").forEach(x => x.remove()); document.querySelector(".vitrine").scrollIntoView({ block: "start" }); scrollBy(0, -60); }, nom);
      await p.locator(".vitrine").screenshot({ path: DOSSIER + "/vitrine-" + f + s + ".png" });
      await p.evaluate(() => document.querySelectorAll(".vitrine .vt-badges > span")[1].click()); await p.waitForTimeout(300);
      await p.screenshot({ path: DOSSIER + "/bulle-pierres-" + f + s + ".png" });
      if (nom === "Kévin") { await p.evaluate(() => document.querySelector('.vitrine [data-carte-coll="decollage"]').click()); await p.waitForTimeout(700); await p.screenshot({ path: DOSSIER + "/medaille-decollage-kevin" + s + ".png" }); }
    }
    await ctx.close();
  }
  // décembre 2026 (tour de chauffe) : pas de vitrine, donc rien de 2027 avant l'heure
  { const { ctx, p, err } = await page(b, "2026-12-15T10:00:00", "Clément", false, true);
    const r = await p.evaluate(async () => { ETAT.fiche = "Kévin"; garder(); allerA("fiche"); await new Promise(r => setTimeout(r, 500)); return { v: !!document.querySelector(".vitrine"), b: document.querySelectorAll("#v-fiche .vt-chif, #v-fiche .vt-med").length }; });
    ok(!r.v && !r.b && !err.length, "décembre 2026 : pas de vitrine ni de bulle (rien de 2027 avant l'heure), 0 erreur JS " + JSON.stringify(r)); await ctx.close(); }
  await b.close(); console.log(ko.length ? ko.length + " NON" : "Tout est OUI"); process.exit(ko.length ? 1 : 0);
})();
