/* Test (25/11/2026, Théo) · la page Course s'ouvre toujours sur la 🗺️ Carte 2D (même si la 3D avait été choisie avant) ; le choix 3D reste gardé
   pendant la visite de l'appli (changer d'onglet et revenir) ; le 🛸 / 🎬 Survol est de retour (menu ⋯, sélecteur du plein écran) et le 🎥 Tour de présentation a disparu.
   Fausses données (serveur intercepté). Serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tvue2d.js (PORT=…). */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
const donnees = () => ({ ok: true, version: 91, genere: "2026-11-26T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: NOMS.map((n, i) => ({ nom: n, rows: [ligne(202611, 1000, 0.01 + i / 1000)] })),
  marche: { indices: ["S&P 500"], mois: [[202611, 0.01]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session: { role: "perso", nom: "Kévin" }, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-11-26T10:00:00"));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(["tresors", "avent", "tickets", "ecurie"].includes(c.action) ? { ok: true, tresors: [], trouves: [], total: 0 } : donnees()) }); });
  // un appareil qui avait choisi la 3D (📺 Visite) lors d'une visite précédente
  await p.addInitScript(() => { if (sessionStorage.getItem("init")) return; sessionStorage.setItem("init", "1");
    ["versus.tuto1", "versus.bullePortrait", "versus.chauffe1", "versus.chauffeFete", "versus.saison1", "versus.aideVisite", "versus.aideVue.visite", "versus.aideVue.poursuite"].forEach(k => localStorage.setItem(k, "1"));
    localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.gpVu.2026", "202612");
    localStorage.setItem("versus.etat", JSON.stringify({ podium: "gp", gp2d: "0", gpVue3: "visite" })); });
  const course = async () => { await p.evaluate(async () => { document.querySelectorAll(".revel,.regles,.tuto,.ba,.ecu-rev").forEach(x => x.remove()); ETAT.podium = "gp"; GP_ETAPE = null; garder(); allerA("trophees"); rendreTrophees();
    await new Promise(r => setTimeout(r, 1500)); document.querySelectorAll(".revel,.ba,.ere-voile").forEach(x => x.remove()); }); };
  const vue = () => p.evaluate(() => { const pi = document.getElementById("gp-piste"); return { en2d: !!(pi && pi.classList.contains("en2d")), vue: pi ? vueGP(pi.dataset.circuit) : null, type: GP_INST && GP_INST.api.type, gp2d: ETAT.gp2d }; });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(800);
  const cle = await p.evaluate(() => CLES.etat); ok(cle === "versus.etat", "clé de l'état de l'appli : " + cle);
  await course();
  const v1 = await vue(); ok(v1.en2d && v1.vue === "2d" && v1.type === "2d", "réouverture : la course s'ouvre sur la Carte 2D (3D choisie la fois d'avant) " + JSON.stringify(v1));
  const m = await p.evaluate(() => ({ survol: !!document.querySelector("#gp-survol"), txt: (document.querySelector("#gp-survol") || {}).textContent || "", pres: !!document.querySelector("#gp-tourp, .gpp-tourp, .gp-pres") }));
  ok(m.survol && /🛸 Survol guidé/.test(m.txt) && !m.pres, "menu ⋯ : « 🛸 Survol guidé » est de retour, plus de 🎥 Tour de présentation " + JSON.stringify(m));
  // pendant la visite, le choix 3D est gardé
  await p.evaluate(() => choisirVueGP("visite", saisonCourante() || 2026)); await p.waitForTimeout(1200);
  const v2 = await vue(); ok(!v2.en2d && v2.vue === "visite" && v2.type === "3d", "choisir 📺 Visite : la 3D " + JSON.stringify(v2));
  await p.evaluate(() => allerA("classement")); await p.waitForTimeout(600); await course();
  const v3 = await vue(); ok(!v3.en2d && v3.vue === "visite", "autre onglet puis retour sur Course, même visite : la 3D est gardée " + JSON.stringify(v3));
  // 🛸 Survol : le segment du plein écran le lance, il se termine tout seul, la course n'a pas démarré
  await p.evaluate(() => ouvrirPleinGP(saisonCourante() || 2026)); await p.waitForTimeout(1000);
  const seg = await p.evaluate(() => { const s = document.querySelector(".gpp-bar [data-gpv-survol]"); return { s: !!s, t: s ? s.textContent.trim() : "", tourp: !!document.querySelector(".gpp-tourp") }; });
  ok(seg.s && /Survol/.test(seg.t) && !seg.tourp, "plein écran : le segment « 🛸 Survol » est dans le sélecteur, pas de bouton 🎥 " + JSON.stringify(seg));
  await p.evaluate(() => document.querySelector(".gpp-bar [data-gpv-survol]").click()); await p.waitForTimeout(900);
  const s1 = await p.evaluate(() => ({ en: GP_INST.api.survolEnCours(), allume: document.querySelector(".gpp-bar [data-gpv-survol]").getAttribute("aria-pressed"), course: GP_INST.api.enCours() }));
  ok(s1.en && s1.allume === "true" && !s1.course, "toucher 🛸 Survol : le survol part, le segment est allumé, aucune course ne démarre " + JSON.stringify(s1));
  await p.waitForFunction(() => !GP_INST.api.survolEnCours(), null, { timeout: 40000 }).catch(() => {}); await p.waitForTimeout(600);
  const s2 = await p.evaluate(() => ({ en: GP_INST.api.survolEnCours(), allume: document.querySelector(".gpp-bar [data-gpv-survol]").getAttribute("aria-pressed"), zoom: GP_INST.api.zoom() }));
  ok(!s2.en && s2.allume === "false" && s2.zoom === 1, "le survol se termine tout seul et rend la vue d'ensemble " + JSON.stringify(s2));
  await p.evaluate(() => fermerPleinGP()); await p.waitForTimeout(300);
  // nouvelle ouverture de l'appli : retour en 2D
  await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(800); await course();
  const v4 = await vue(); ok(v4.en2d && v4.vue === "2d" && v4.type === "2d", "rouvrir l'appli : de nouveau la Carte 2D " + JSON.stringify(v4));
  ok(!err.length, "0 erreur JS " + JSON.stringify(err.slice(0, 3)));
  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
