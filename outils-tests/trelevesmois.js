/* Test v20.29 · « Relevés du mois » (tout le monde, jamais un montant) et « Le rappeler » (admin → rappel dans l'appli du joueur).
   Lancer depuis la racine du dépôt, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/trelevesmois.js
   Aucune vraie donnée : le serveur Google est intercepté et renvoie des chiffres inventés. */
const { chromium } = require("playwright");
const ligne = (k, val) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, 0, 0, 0, 0], [0, val, 0, 0.01, 0].concat(Array(20).fill(0))];
const vide = k => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-30", [null, null, null, null, null, null, null, null], Array(25).fill(0)];
function fausses(session, monRappel) {
  const P = (nom, nov) => ({ nom, rows: [ligne(202610, 12345), nov] });
  return { ok: true, version: 75, genere: "2026-12-01T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: [P("Théo", ligne(202611, 13001)), P("Kévin", ligne(202611, 13002)), P("Clément", vide(202611)), P("Devlin", vide(202611))],
    marche: { indices: ["S&P 500"], mois: [[202610, 0.01], [202611, 0.01]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
    journal: [{ personne: "Théo", cle: 202611, action: "Import auto", statut: "", t: "2026-11-30T19:07:00", ligne: 2, par: "Portefeuille & Épargne" },
      { personne: "Kévin", cle: 202611, action: "Saisie", statut: "", t: "2026-11-30T21:15:00", ligne: 3, par: "Kévin" }],
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel, rappelsReleve: session.role === "admin" ? { Devlin: { cle: 202611 } } : {},
    mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
async function voir(b, session, monRappel, sombre) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [], envois = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2026-12-01T10:00:00"));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    if (c.action === "rappelReleve") { envois.push(c); return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, message: "🔔 Rappel envoyé à " + c.personne + "." }) }); }
    return r.fulfill({ contentType: "application/json", body: JSON.stringify(fausses(session, monRappel)) }); });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); });
  await p.goto("http://localhost:8771/index.html");
  await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
  await p.waitForTimeout(2500);
  const toasts = await p.evaluate(() => (localStorage.getItem("versus.rappelVu.202611") ? "RAPPEL_AFFICHE " : "") + [...document.querySelectorAll(".toast, #toast")].map(x => x.innerText).join(" | "));
  await p.evaluate(() => { document.querySelectorAll(".ere, .ere-fond, [id^=ere], .revel, .modal-fond").forEach(x => x.remove()); });
  await p.evaluate(() => ouvrirSaisie());
  await p.waitForTimeout(600); await p.evaluate(() => document.querySelectorAll(".tuto").forEach(x => x.remove()));
  await p.waitForTimeout(800);
  const rm = await p.evaluate(() => { const s = document.querySelector("#corps-saisie .rm"); return s ? { texte: s.innerText, boutons: [...s.querySelectorAll("[data-rappel]")].map(x => x.dataset.rappel) } : null; });
  if (rm) await p.locator("#corps-saisie .rm").scrollIntoViewIfNeeded();
  const nom = "rm-" + (session.role === "admin" ? "admin" : "joueur") + (sombre ? "-sombre" : "-clair");
  if (rm) await p.locator("#corps-saisie .rm").screenshot({ path: "/tmp/" + nom + ".png" });
  const deborde = await p.evaluate(() => { const s = document.querySelector("#corps-saisie .rm"); return s ? [...s.querySelectorAll("*")].some(x => x.getBoundingClientRect().right > window.innerWidth + 1) : null; });
  let apres = null;
  if (rm && rm.boutons.length) { await p.locator('#corps-saisie [data-rappel="' + rm.boutons[0] + '"]').click(); await p.waitForTimeout(500); apres = await p.evaluate(() => document.querySelector("#corps-saisie .rm").innerText); }
  await ctx.close();
  return { err, rm, toasts, envois, apres, deborde };
}
(async () => {
  const b = await chromium.launch();
  const A = await voir(b, { role: "admin" }, null, false), As = await voir(b, { role: "admin" }, null, true);
  const J = await voir(b, { role: "perso", nom: "Clément" }, { cle: 202611, t: "2026-12-01" }, false), Js = await voir(b, { role: "perso", nom: "Clément" }, null, true);
  await b.close();
  if (process.env.DBG) console.log(JSON.stringify({ A: A.rm, Jt: J.toasts }, null, 1));
  const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  ok(![A, As, J, Js].some(x => x.err.length), "0 erreur JS " + JSON.stringify([A, As, J, Js].map(x => x.err)));
  ok(A.rm && /Relevés de novembre 2026/.test(A.rm.texte), "le tableau « Relevés de novembre 2026 · tout le monde » est sous le relevé");
  ok(A.rm && /Théo\s*✅ import automatique le 30\/11\s*à 19\s*h\s*07/.test(A.rm.texte), "Théo : ✅ import automatique avec la date et l'heure");
  ok(A.rm && /Kévin\s*✍️ saisi dans l'appli le 30\/11/.test(A.rm.texte), "Kévin : ✍️ saisi à la main");
  ok(A.rm && /Clément\s*⏳ pas encore arrivé/.test(A.rm.texte), "Clément : ⏳ pas encore arrivé");
  ok(A.rm && JSON.stringify(A.rm.boutons) === '["Clément"]' && /Devlin[\s\S]*🔔 rappelé/.test(A.rm.texte), "admin : « Le rappeler » seulement pour un relevé manquant pas encore rappelé (Devlin déjà rappelé)");
  ok(A.envois.length === 1 && A.envois[0].personne === "Clément" && A.envois[0].mois === 202611 && /Clément\s*⏳ pas encore arrivé\s*🔔 rappelé/.test(A.apres || ""), "clic : rappel envoyé au serveur pour Clément / novembre, la ligne passe à « rappelé »");
  ok(![A, As, J, Js].some(x => x.rm && /\d[\d\s ]*€|1300|12345/.test(x.rm.texte)), "jamais un montant dans le tableau");
  ok(J.rm && !J.rm.boutons.length && /Théo\s*✅/.test(J.rm.texte), "joueur : il voit les relevés de tout le monde, sans bouton");
  ok(/RAPPEL_AFFICHE|Ton relevé de novembre 2026 n'est pas arrivé/.test(J.toasts) && !/RAPPEL_AFFICHE/.test(Js.toasts), "joueur rappelé : la bulle « ton relevé n'est pas arrivé » s'affiche à l'ouverture (et pas sans rappel)");
  ok(![A, As, J, Js].some(x => x.deborde), "rien ne déborde à 390 px (clair et sombre)");
  console.log("captures : /tmp/rm-admin-clair.png, /tmp/rm-admin-sombre.png, /tmp/rm-joueur-clair.png, /tmp/rm-joueur-sombre.png");
  process.exit(ko.length ? 1 : 0);
})();
