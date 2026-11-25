/* Test (v20.47) · 🎫 Le ticket d'or (Chocolaterie, octobre 2027) : la tablette du jour, la cérémonie, la vitrine, la plaque, l'aperçu admin.
   Fausses données uniquement (serveur Google intercepté : actions data, tickets, deballer, tresors) ; le vrai tirage est côté serveur (app_scripts/versus/TicketsOr.js).
   Serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tticket.js
   Vérifie : avant octobre rien (sauf l'empreinte dans les règles dès le 1/1/2027) ; en octobre le bouton « déballer » marche une fois par jour ;
   réponse ticket → cérémonie + badge + plaque ; sans ticket → petit message ; aperçu admin seulement avec la double sécurité ; 0 erreur JS ; 390 px clair / sombre. */
const { chromium } = require("playwright"), fs = require("fs");
const DOSSIER = process.env.CAPTURES || require("path").join(require("os").tmpdir(), "versus-ticket");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const KS = [202701, 202702, 202703, 202704, 202705, 202706, 202707, 202708, 202709];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
function personne(nom, i, jusqua) {
  const rows = [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)]; let v = 1010;
  KS.filter(k => k <= jusqua).forEach(k => { const r = ((k + i) % 5 - 2) / 100; v = Math.round(v * (1 + r) + 50); rows.push(ligne(k, v, r)); });
  return { nom, rows };
}
function donnees(session, jusqua) {
  const chauffe = jusqua < 202701;
  return { ok: true, version: 87, genere: "2027-10-12T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: NOMS.map((n, i) => chauffe ? { nom: n, rows: [ligne(202611, 1000, 0.01)] } : personne(n, i, jusqua)),
    marche: { indices: ["S&P 500"], mois: [[202611, 0.01], [202612, 0.005]].concat(KS.filter(k => k <= jusqua).map(k => [k, 0.004])), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
const EMP = "9f3c2a71" + "0".repeat(48) + "c0ffee42";   // empreinte INVENTÉE pour le test
const ETAT_T = (o) => Object.assign({ ok: true, ouvert: true, empreinte: EMP, mois: 202710, n: 5, enCours: false, fini: false, aujourdhui: 0, dejaAujourdhui: false, mesTablettes: 0, monTicket: null, gagnants: [{ nom: "Clément", n: 1 }], restants: 4, revele: null }, o);
/** ouvre l'appli : quand, session, jusqua (dernier relevé), tickets (réponse de l'action tickets ou null = pas encore), deballer (fonction) */
async function page(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light", reducedMotion: o.reduit ? "reduce" : "no-preference" }), p = await ctx.newPage(), err = [], req = [];
  p.on("pageerror", e => err.push(e.message)); await p.clock.setFixedTime(new Date(o.quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}"); req.push(c.action);
    const rep = c.action === "tickets" ? (o.tickets || { ok: true, ouvert: false }) : c.action === "deballer" ? (o.deballer ? o.deballer() : { ok: false, erreur: "tot", message: "Pas encore." })
      : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : donnees(o.session, o.jusqua);
    r.fulfill({ contentType: "application/json", body: JSON.stringify(rep) }); });
  await p.addInitScript(([adminOn]) => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.bullePortrait", "1");
    localStorage.setItem("versus.saison1", "1"); localStorage.setItem("versus.gpVu.2027", "202709"); localStorage.setItem("versus.baVu.2027", "202712"); if (adminOn) sessionStorage.setItem("versus.adminOn", "1"); }, [!!o.adminOn]);
  await p.goto("http://localhost:8771/index.html"); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  await p.evaluate(async () => { document.querySelectorAll(".revel, .regles, .tuto, .bulle-portrait, .ba").forEach(x => x.remove()); if (saisonVisible()) { ETAT.podium = "gp"; GP_ETAPE = null; garder(); } montrerVue("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 1800)); document.querySelectorAll(".revel, .ba").forEach(x => x.remove()); });
  return { ctx, p, err, req };
}
const regles = async p => p.evaluate(async () => { ouvrirRegles(null, false); await new Promise(r => setTimeout(r, 900)); const o = document.querySelector(".regles"); const t = o ? o.innerText : ""; document.querySelectorAll(".regles").forEach(x => x.remove()); document.documentElement.classList.remove("fige"); return t; });
const deborde = () => [...document.querySelectorAll(".gp-tablette *, .tk-or *, .vit-tk *")].filter(x => { const r = x.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) && !x.closest(".cbo-rayons, .tb-papier") && !x.classList.contains("cbo-rayons"); }).map(x => x.className.baseVal !== undefined ? x.className.baseVal : x.className).slice(0, 5);
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  // 1. avant le 1/1/2027 : rien, même pas dans les règles ; aucune demande « tickets »
  { const { ctx, p, err, req } = await page(b, { quand: "2026-12-15T10:00:00", session: { role: "perso", nom: "Clément" }, jusqua: 202612, tickets: ETAT_T({}) });
    const t = await regles(p), h = await p.evaluate(() => document.body.innerText);
    ok(!err.length && !/ticket d'or|tablette/i.test(t + h) && !req.includes("tickets") && !(await p.$(".gp-tablette")), "15/12/2026 : rien du ticket d'or (ni règles, ni tablette, aucune demande au serveur) " + JSON.stringify(err));
    await ctx.close(); }
  // 2. de janvier à septembre 2027 : seulement l'empreinte dans les règles ; ni tablette, ni vitrine, ni plaque
  for (const [quand, jq] of [["2027-03-15T10:00:00", 202702], ["2027-09-30T10:00:00", 202709]]) {
    const { ctx, p, err, req } = await page(b, { quand, session: { role: "perso", nom: "Kévin" }, jusqua: jq, tickets: ETAT_T({ gagnants: [], restants: 5 }) });
    const t = await regles(p);
    const a = await p.evaluate(async () => { const tab = !!document.querySelector(".gp-tablette"), ci = (document.querySelector("#gp-piste") || {}).dataset;
      ETAT.podium = "defis"; garder(); rendreTrophees(); await new Promise(r => setTimeout(r, 600)); const vit = !!document.querySelector("#vit-tickets");
      return { tab, vit, plaque: idsSlot("plaque").includes("ticketor"), badge: badgesPossedes("Kévin").some(x => x.id === "ticket"), ci: ci && ci.circuit }; });
    ok(!err.length && /Ticket d'or/.test(t) && t.includes(EMP) && /dévoilé le 1er novembre 2027/.test(t.replace(/\s+/g, " ")), quand.slice(0, 10) + " : les règles montrent la mécanique et l'empreinte du tirage");
    ok(!a.tab && !a.vit && !a.plaque && !a.badge && !req.includes("deballer"), quand.slice(0, 10) + " : ni tablette, ni vitrine des tickets, ni plaque dans l'Écurie " + JSON.stringify(a));
    await ctx.close(); }
  // 3. octobre 2027, sans ticket : une tablette par jour, un petit message drôle, jamais de montant
  for (const sombre of [false, true]) {
    let n = 0; const tag = sombre ? " (sombre)" : " (clair)";
    const o = { quand: "2027-10-12T10:00:00", sombre, session: { role: "perso", nom: "Kévin" }, jusqua: 202709, tickets: ETAT_T({ enCours: true, aujourdhui: 20271012 }), deballer: () => (n++ ? { ok: false, erreur: "deja", message: "Tu as déjà déballé ta tablette aujourd'hui. Reviens demain !" } : { ok: true, ticket: null, monTicket: null, gagnants: [{ nom: "Clément", n: 1 }], restants: 4 }) };
    const { ctx, p, err, req } = await page(b, o);
    const av = await p.evaluate(() => ({ ci: document.querySelector("#gp-piste").dataset.circuit, tab: !!document.querySelector(".gp-tablette [data-deballer]"), txt: (document.querySelector(".gp-tablette") || {}).innerText || "" }));
    ok(av.ci === "singapour" && av.tab && /4 tickets d'or encore cachés/.test(av.txt), "12/10/2027 : sur la page Course de la Chocolaterie, la tablette du jour et son bouton" + tag);
    await p.locator(".gp-tablette").screenshot({ path: DOSSIER + "/tablette-fermee" + (sombre ? "-sombre" : "") + ".png" });
    await p.click(".gp-tablette [data-deballer]"); await p.waitForTimeout(1100);
    await p.locator(".gp-tablette").screenshot({ path: DOSSIER + "/tablette-chocolat" + (sombre ? "-sombre" : "") + ".png" });
    const ap = await p.evaluate(() => ({ mot: document.querySelector(".gp-tablette .tb-mot").textContent, b: !!document.querySelector(".gp-tablette [data-deballer]"), cer: !!document.querySelector(".tk-or"), MOTS: MOTS_TABLETTE }));
    ok(ap.MOTS.includes(ap.mot) && !ap.b && !ap.cer && !/€|\d+ ?(euros?)/.test(ap.mot), "sans ticket : un petit message (« " + ap.mot + " »), pas de cérémonie, plus de bouton" + tag);
    await p.waitForTimeout(2800);
    const ap2 = await p.evaluate(() => ({ b: !!document.querySelector(".gp-tablette [data-deballer]"), f: !!document.querySelector(".gp-tablette .tb-fait") }));
    const deb = await p.evaluate(`(${deborde})()`);
    ok(!ap2.b && ap2.f && req.filter(x => x === "deballer").length === 1, "une seule tablette par jour : le bouton ne revient pas (« Déballée aujourd'hui »), une seule demande au serveur" + tag);
    ok(!err.length && !deb.length, "0 erreur JS, rien ne déborde à 390 px " + JSON.stringify([err, deb]) + tag);
    await ctx.close(); }
  // 3 bis. déjà déballée (le serveur le dit) : pas de bouton
  { const { ctx, p, err } = await page(b, { quand: "2027-10-12T18:00:00", session: { role: "perso", nom: "Kévin" }, jusqua: 202709, tickets: ETAT_T({ enCours: true, dejaAujourdhui: true }) });
    ok(!err.length && !(await p.$(".gp-tablette [data-deballer]")) && !!(await p.$(".gp-tablette .tb-fait")), "rechargée le même jour, la tablette reste déballée (pas de 2e bouton)"); await ctx.close(); }
  // 4. octobre 2027, avec ticket : cérémonie + badge + plaque + vitrine (clair, sombre, animations réduites)
  for (const [sombre, reduit] of [[false, false], [true, false], [false, true]]) {
    const tag = (sombre ? " (sombre)" : " (clair)") + (reduit ? " (animations réduites)" : "");
    const G = [{ nom: "Clément", n: 1 }, { nom: "Nicolas", n: 2 }];
    const { ctx, p, err } = await page(b, { quand: "2027-10-14T10:00:00", sombre, reduit, session: { role: "perso", nom: "Nicolas" }, jusqua: 202709, tickets: ETAT_T({ enCours: true }), deballer: () => ({ ok: true, ticket: 2, monTicket: 2, gagnants: G, restants: 3 }) });
    await p.click(".gp-tablette [data-deballer]"); await p.waitForTimeout(reduit ? 600 : 1000);
    if (!reduit) await p.locator(".gp-tablette").screenshot({ path: DOSSIER + "/tablette-ticket" + (sombre ? "-sombre" : "") + ".png" });
    await p.waitForTimeout(reduit ? 400 : 2700);
    const c = await p.evaluate(() => { const o = document.querySelector(".tk-or"); return o ? { t: o.textContent, plaque: !!o.querySelector(".plaque.pl-ticketor"), reduit: o.classList.contains("reduit") } : null; });
    await p.screenshot({ path: DOSSIER + "/ceremonie-ticket" + (sombre ? "-sombre" : "") + (reduit ? "-reduit" : "") + ".png" });
    const deb = await p.evaluate(`(${deborde})()`);
    ok(c && /Ticket d'or n° 2 \/ 5/i.test(c.t) && /Nicolas/.test(c.t) && c.plaque && /Aucun point/.test(c.t) && c.reduit === reduit && !/€/.test(c.t), "ticket gagné : cérémonie plein écran (ascenseur de verre, ticket n° 2, son nom, la plaque « Ticket d'or », aucun point)" + tag);
    const v = await p.evaluate(async () => { document.querySelector(".tk-or [data-tk-vit]").click(); await new Promise(r => setTimeout(r, 900));
      const s = document.querySelector("#vit-tickets"); return { s: s ? s.innerText : "", pris: s ? [...s.querySelectorAll(".tk-s.pris b")].map(x => x.textContent) : [], moi: !!(s && s.querySelector(".tk-s.a-moi")),
        badge: badgesPossedes("Nicolas").some(x => x.id === "ticket"), plaque: debloques("Nicolas").has("plaque.ticketor"), ecurie: idsSlot("plaque").includes("ticketor"), autre: debloques("Kévin").has("plaque.ticketor") }; });
    ok(v.pris.join(",") === "Clément,Nicolas" && v.moi && v.badge && v.plaque && v.ecurie && !v.autre, "vitrine « Mes trophées » : section 🎫 (5 places, noms des gagnants), badge 🎫, plaque débloquée pour lui seul " + JSON.stringify(v) + tag);
    if (!reduit) await p.locator("#vit-tickets").screenshot({ path: DOSSIER + "/vitrine-tickets" + (sombre ? "-sombre" : "") + ".png" });
    ok(!err.length && !deb.length, "0 erreur JS, rien ne déborde à 390 px " + JSON.stringify([err, deb]) + tag);
    await ctx.close(); }
  // 5. aperçu admin : seulement avec la double sécurité (rôle admin donné par le serveur ET mode admin allumé), rien n'est envoyé
  for (const [nomCas, session, adminOn, attendu] of [["joueur", { role: "perso", nom: "Kévin" }, true, false], ["admin sans mode admin", { role: "admin" }, false, false], ["admin + mode admin", { role: "admin" }, true, true]]) {
    const { ctx, p, err, req } = await page(b, { quand: "2026-11-25T10:00:00", session, adminOn, jusqua: 202612, tickets: ETAT_T({}) });
    const a = await p.evaluate(async () => { const bouton = !!document.querySelector("[data-baticket]"); apercuTicket(); await new Promise(r => setTimeout(r, 300)); return { bouton, ouvert: !!document.querySelector(".tk-apercu") }; });
    ok(!err.length && a.ouvert === attendu && a.bouton === attendu, "aperçu admin (" + nomCas + ") : " + (attendu ? "s'ouvre" : "ne s'ouvre pas, même en forçant") + " " + JSON.stringify(a));
    if (attendu) {
      await p.locator(".tk-apercu .rg-c").screenshot({ path: DOSSIER + "/apercu-admin-ticket.png" });
      await p.click(".tk-apercu [data-deballer]"); await p.waitForTimeout(1900);
      const m = await p.evaluate(() => ({ mot: (document.querySelector(".tk-apercu .tb-mot") || {}).textContent, encore: !!document.querySelector("[data-tk-encore]") }));
      await p.click("[data-tk-encore]"); await p.waitForTimeout(300); await p.click(".tk-apercu [data-deballer]"); await p.waitForTimeout(3400);
      const c = await p.evaluate(() => { const o = document.querySelector(".tk-or"); return o ? o.textContent : ""; });
      ok(MOTS_OK(m.mot) && m.encore && /exemple inventé/i.test(c) && /Pilote d'exemple/.test(c) && !req.includes("deballer"), "aperçu : 1re tablette = chocolat, 2e = ticket et cérémonie (exemple inventé), aucune tablette envoyée au serveur " + JSON.stringify([m, req]));
    }
    await ctx.close(); }
  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI.");
  process.exit(ko.length ? 1 : 0);
})();
function MOTS_OK(m) { return typeof m === "string" && m.length > 5 && !/ticket d'or brille/.test(m); }
