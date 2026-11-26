/* Test v20.71 · Podium → fiche : partout dans le Podium où un pilote apparaît, un toucher ouvre SA fiche (la même que dans le Classement).
   Endroits : liste de la course (nom), détail des points (bilan), grille de l'Écurie (🏆 Vitrine), garage d'une écurie (🏆 Vitrine de X).
   Vérifie aussi : le toucher sur la ligne de la grille ouvre toujours l'écurie (pas la fiche) ; « ‹ Retour au Podium » et le bouton retour
   du téléphone ramènent au Podium ; en décembre, pas de vitrine (rien de 2027), en saison la vitrine ; jamais un montant d'un autre pilote
   (données masquées par la VRAIE fonction du serveur, vsMasquerMontants_ de app_scripts/versus/API.js ; le pilote connecté a plus de 1 M€,
   donc tout montant < 60 000 € affiché trahirait un autre pilote) ; 0 erreur JS ; captures 390 px clair et sombre.
   Fausses données uniquement (serveur Google intercepté). Serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tfiches-podium.js
   (PORT=… pour un autre port, API_VERSUS=/chemin/vers/API.js si app_scripts n'est pas à côté de ce dépôt, CAPTURES=… pour le dossier des captures) */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "fiches");
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
  const rep = donnees(o.moi, o.jusqua);
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tickets" ? { ok: true, ouvert: false } : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : rep) }); });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.bullePortrait", "1");
    localStorage.setItem("versus.saison1", "1"); localStorage.setItem("versus.chauffe1", "1"); localStorage.setItem("versus.ecurieTeaser", "1");
    ["2026", "2027"].forEach(y => { localStorage.setItem("versus.gpVu." + y, y + "12"); localStorage.setItem("versus.baVu." + y, y + "12"); }); });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  await p.evaluate(() => document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba, .av-ov").forEach(x => x.remove()));
  return { ctx, p, err };
}
/** dans la page : ouvre le Podium sur un onglet, touche chaque élément trouvé, contrôle la fiche ouverte, revient */
const PARCOURS = async ({ moi }) => {
  const w = (t = 350) => new Promise(r => setTimeout(r, t)), out = { places: {}, ko: [], euros: [] };
  const re = /(?:[−+-]\s?)?\d[\d\s  .,]*\s?€/g;
  const scan = ou => { const v = document.querySelector("#v-fiche"); const h = v.innerHTML.replace(/<[^>]+>/g, " ") + " " + [...v.querySelectorAll("[title],[aria-label],[data-cv]")].map(e => (e.getAttribute("title") || "") + " " + (e.getAttribute("aria-label") || "") + " " + (e.dataset.cf === "eur" ? e.dataset.cv + " €" : "")).join(" ");
    (h.match(re) || []).forEach(x => { const n = Math.abs(parseFloat(x.replace(/[^\d,]/g, "").replace(",", "."))); if (n > 0.5 && n < 60000) out.euros.push(ou + " : " + x.trim()); }); };
  const nettoie = () => document.querySelectorAll(".revel, .regles, .tuto, .ba, .av-ov").forEach(x => x.remove());
  const podium = async (onglet, avant) => { ETAT.podium = onglet; GP_ETAPE = null; garder(); allerA("trophees"); rendreTrophees(); await w(500); nettoie(); if (avant) await avant(); };
  const essai = async (lieu, onglet, sel, avant, retour) => {
    await podium(onglet, avant);
    const noms = [...document.querySelectorAll(sel)].map(e => e.dataset.gpFiche || e.dataset.voir);
    out.places[lieu] = noms.length;
    for (let i = 0; i < noms.length; i++) {
      await podium(onglet, avant);
      const el = [...document.querySelectorAll(sel)][i]; if (!el) { out.ko.push(lieu + " : élément " + i + " disparu"); continue; }
      el.scrollIntoView({ block: "center" }); el.click(); await w(400);
      const n = noms[i], f = document.querySelector("#v-fiche");
      const pressee = f && f.querySelector('.chips [data-fiche][aria-pressed="true"]');
      if (vueActive() !== "fiche" || ETAT.fiche !== n || !pressee || pressee.dataset.fiche !== n || f.hidden) out.ko.push(lieu + " : " + n + " → vue " + vueActive() + ", fiche " + ETAT.fiche);
      if (!f.querySelector("#fiche-retour")) out.ko.push(lieu + " : " + n + " → pas de « Retour au Podium »");
      out.vitrine = (out.vitrine || 0) + (f.querySelector(".vitrine") ? 1 : 0); out.ouvertes = (out.ouvertes || 0) + 1;
      if (!saisonJouee() && /2027/.test(f.innerText)) out.ko.push(lieu + " : " + n + " → la fiche parle de 2027 en décembre");
      if (n !== moi) { document.querySelectorAll("#v-fiche details").forEach(d => d.open = true); scan(lieu + " · fiche de " + n); }
      if (retour === "pop" || !f.querySelector("#fiche-retour")) { nettoie(); if (history.state && history.state.vs === "garde") history.back(); else dispatchEvent(new PopStateEvent("popstate", { state: null })); await w(300); }   // le vrai bouton retour du téléphone
      else f.querySelector("#fiche-retour").click();
      await w(400); if (vueActive() !== "trophees") out.ko.push(lieu + " : " + n + " → le retour mène à " + vueActive());
    }
  };
  // 1. liste de la course (classement du mois)
  await essai("course", "gp", ".gp-liste [data-gp-fiche]");
  // 2. détail des points (bilan), s'il y a déjà des manches
  await essai("points", "gp", "#pts-det [data-gp-fiche]", async () => { const d = document.querySelector("#pts-det"); if (d) d.open = true; }, "pop");
  // 3. grille de l'Écurie : 🏆 Vitrine → fiche
  await essai("grille", "ecurie", ".grille-dep .gr-f");
  // 4. la ligne de la grille ouvre toujours l'écurie (pas la fiche), puis le garage propose la fiche
  await podium("ecurie"); const lg = [...document.querySelectorAll(".grille-dep [data-voir]")]; out.places.ligneEcurie = 0;
  for (let i = 0; i < lg.length; i++) { await podium("ecurie"); const el = [...document.querySelectorAll(".grille-dep [data-voir]")][i], n = el.dataset.voir; el.click(); await w(500);
    const g = document.querySelector("#garage");
    if (vueActive() !== "trophees" || !g || !g.textContent.includes("Écurie de") || ECU_VOIR !== n) out.ko.push("ligne de la grille " + n + " : l'écurie ne s'ouvre plus"); else out.places.ligneEcurie++; }
  let nG = 0;
  for (const pp of D.personnes) { await essai("garage", "ecurie", "#garage .gar-fiche", async () => { ECU_VOIR = pp.nom; rendreTrophees(); await w(300); }); nG += out.places.garage; }
  out.places.garage = nG; ECU_VOIR = null;
  return out;
};
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  const CAS = [
    { tag: "décembre (tour de chauffe)", quand: "2026-12-10T10:00:00", jusqua: 202611, saison: false },
    { tag: "janvier (saison 1)", quand: "2027-01-20T10:00:00", jusqua: 202612, saison: true },
    { tag: "février (1re manche jouée)", quand: "2027-02-10T10:00:00", jusqua: 202701, saison: true, points: true }
  ];
  for (const cas of CAS) for (const moi of ["Kévin", "Théo"]) {
    const { ctx, p, err } = await page(b, { quand: cas.quand, jusqua: cas.jusqua, moi });
    const r = await p.evaluate(PARCOURS, { moi });
    const t = " · " + cas.tag + " · vu par " + moi;
    ok(r.places.course === 5, "liste de la course : les 5 noms ouvrent une fiche" + t + " (" + r.places.course + ")");
    if (cas.points) ok(r.places.points === 5, "détail des points : les 5 noms ouvrent une fiche" + t + " (" + r.places.points + ")");
    ok(r.places.grille === 5, "grille de l'Écurie : 5 boutons 🏆 Vitrine" + t + " (" + r.places.grille + ")");
    ok(r.places.ligneEcurie === 5, "grille de l'Écurie : toucher la ligne ouvre toujours l'écurie" + t + " (" + r.places.ligneEcurie + ")");
    ok(r.places.garage === 5, "garage de chaque écurie : bouton « 🏆 Vitrine de X »" + t + " (" + r.places.garage + ")");
    ok(!r.ko.length, "chaque toucher ouvre la fiche du BON pilote, avec « Retour au Podium » (bouton et retour du téléphone)" + t + " " + r.ko.slice(0, 4).join(" ; "));
    ok(cas.saison ? r.vitrine === r.ouvertes : r.vitrine === 0, (cas.saison ? "la vitrine est sur chaque fiche" : "pas de vitrine en décembre (rien de 2027)") + t + " (" + r.vitrine + "/" + r.ouvertes + ")");
    ok(!r.euros.length, "aucun montant d'un autre pilote sur les fiches ouvertes" + t + " " + r.euros.slice(0, 4).join(" ; "));
    ok(!err.length, "0 erreur JS" + t + " " + err.slice(0, 3).join(" | "));
    await ctx.close();
  }
  // captures 390 px clair et sombre (vu par Kévin) : grille de l'Écurie, garage, liste de la course, fiche ouverte depuis le Podium
  for (const [cas, nom] of [[CAS[0], "dec"], [CAS[2], "fev"]]) for (const sombre of [false, true]) {
    const s = (sombre ? "-sombre" : "-clair"), { ctx, p, err } = await page(b, { quand: cas.quand, jusqua: cas.jusqua, moi: "Kévin", sombre });
    await p.evaluate(async () => { ETAT.podium = "ecurie"; garder(); allerA("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 700)); });
    await p.evaluate(() => document.querySelectorAll(".revel, .regles, .tuto, .ba, .av-ov").forEach(x => x.remove()));
    await p.locator(".grille-dep").screenshot({ path: DOSSIER + "/" + nom + "-grille" + s + ".png" });
    const net = () => p.evaluate(() => document.querySelectorAll(".revel, .regles, .tuto, .ba, .av-ov").forEach(x => x.remove()));
    await net(); await p.locator('.grille-dep [data-voir="Clément"]').click(); await p.waitForTimeout(900);
    await net(); await p.locator("#garage").screenshot({ path: DOSSIER + "/" + nom + "-garage" + s + ".png" });
    await p.evaluate(async () => { ECU_VOIR = null; ETAT.podium = "gp"; GP_ETAPE = null; garder(); rendreTrophees(); await new Promise(r => setTimeout(r, 700)); document.querySelectorAll(".revel, .ba").forEach(x => x.remove()); });
    await p.locator(".gp-liste").screenshot({ path: DOSSIER + "/" + nom + "-course" + s + ".png" });
    await net(); await p.locator('.gp-liste [data-gp-fiche="Devlin"]').click(); await p.waitForTimeout(900);
    await net(); await p.screenshot({ path: DOSSIER + "/" + nom + "-fiche-devlin" + s + ".png" });
    const large = await p.evaluate(() => document.documentElement.scrollWidth <= 390);
    ok(large && !err.length, "captures " + nom + s + " : rien ne déborde à 390 px, 0 erreur JS " + err.slice(0, 2).join(" | "));
    await ctx.close();
  }
  await b.close(); console.log(ko.length ? ko.length + " NON" : "Tout est OUI"); process.exit(ko.length ? 1 : 0);
})();
