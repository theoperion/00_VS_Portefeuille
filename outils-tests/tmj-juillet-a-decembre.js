/* Test · 🎲 mini-jeux de juillet (« bahrein »), août (« spa »), septembre (« lasvegas »), novembre (« interlagos ») et décembre (« monza ») :
   la carte sous la bonne piste, le décor, le geste (un seul envoi), des cas particuliers (une seule question obligatoire, un jour sans geste,
   une question facultative), une cérémonie et etatMiniJeu. Fausses données uniquement (textes et identifiants INVENTÉS).
   Serveur local : python3 -m http.server 8771 &  puis node outils-tests/tmj-juillet-a-decembre.js (PORT=…, CAPTURES=…). */
const { chromium, DOSSIER, ETAT, MJ_ETAT, FINI, page, allerCourse, deborde, compteur, fin } = require("./tmj-commun.js");
const O3 = (ids, ico) => ids.map((id, i) => ({ id, ico: ico[i], lib: "Option " + (i + 1) + " (inventée)", sous: "" }));
const G = (id, opts, req) => ({ id, titre: "Question " + id + " (inventée)", options: opts.map(x => ({ id: x, lib: "Choix " + x })), requis: req !== false });
const CAS = [
  { mois: 202707, nom: "juillet", ci: "bahrein", svg: "svg.mj-deco.mj-d7", etat: () => ETAT({ jour: 5, options: O3(["0", "1", "2"], ["1️⃣", "2️⃣", "3️⃣"]), scene: { a: true, b: -1 } }), clic: p => p.evaluate(() => document.querySelector('.mj-carte [data-mj-opt="1"]').click()), attendu: { choix: "1" } },
  { mois: 202708, nom: "aout", ci: "spa", svg: "svg.mj-deco.mj-d8", etat: () => ETAT({ jour: 5, options: undefined, groupes: [G("g1", ["c1", "c2", "c3"])], bouton: "Valider (inventé)", scene: { b: 1 } }),
    clic: p => p.evaluate(() => { document.querySelector('[data-mj-v="c2"]').click(); const b = document.querySelector("[data-mj-env]"); b.click(); b.click(); }), attendu: { reponses: { g1: "c2" } } },
  { mois: 202709, nom: "septembre", ci: "lasvegas", svg: "svg.mj-deco.mj-d9", etat: () => ETAT({ jour: 5, options: O3(["opt1", "opt2"], ["1️⃣", "2️⃣"]), scene: { a: 9, b: 26 } }), clic: p => p.evaluate(() => document.querySelector('.mj-carte [data-mj-opt="opt2"]').click()), attendu: { choix: "opt2" } },
  { mois: 202711, nom: "novembre", ci: "interlagos", svg: "svg.mj-deco.mj-d11", etat: () => ETAT({ jour: 5, options: O3(["opt1", "opt2", "opt3"], ["1️⃣", "2️⃣", "3️⃣"]), scene: { a: 3 } }), clic: p => p.evaluate(() => document.querySelector('.mj-carte [data-mj-opt="opt2"]').click()), attendu: { choix: "opt2" } },
  { mois: 202712, nom: "decembre", ci: "monza", svg: "svg.mj-deco.mj-d12", etat: () => ETAT({ jour: 5, options: undefined, groupes: [G("g1", ["3", "7"]), G("g2", ["3", "7"], false), G("g3", ["0", "1", "2"])], bouton: "Valider (inventé)", scene: { a: [0, 4, 9] } }),
    clic: p => p.evaluate(() => { document.querySelector('[data-mj-g="g1"] [data-mj-v="3"]').click(); document.querySelector('[data-mj-g="g2"] [data-mj-v="7"]').click(); document.querySelector('[data-mj-g="g3"] [data-mj-v="2"]').click(); document.querySelector("[data-mj-env]").click(); }), attendu: { reponses: { g1: "3", g2: "7", g3: "2" } } }
];
(async () => {
  const b = await chromium.launch(), { ko, ok } = compteur();
  for (const C of CAS) for (const sombre of [false, true]) {
    const tag = " (" + C.nom + (sombre ? ", sombre)" : ", clair)"), envois = [], m = C.mois % 100;
    const { ctx, p, err } = await page(b, { quand: "2027-" + String(m).padStart(2, "0") + "-05T09:00:00", sombre, revVu: true, session: { role: "perso", nom: "Kévin" }, jusqua: C.mois - 1,
      mj: c => { if (c.op === "geste") { envois.push(c.geste); return { ok: true, message: "Message inventé du geste.", etat: Object.assign(C.etat(), { fait: true }) }; } return MJ_ETAT(C.mois, C.etat()); } });
    await allerCourse(p);
    const a = await p.evaluate(sel => { const c = document.querySelector(".mj-carte"); return c ? { but: (c.querySelector(".mj-but") || {}).textContent, ci: document.querySelector("#gp-piste").dataset.circuit, svg: !!c.querySelector(sel), commun: !!c.querySelector(".mj-commun"), pas: !!document.querySelector(".mj-pas") } : null; }, C.svg);
    ok(a && a.ci === C.ci && a.svg && a.commun && a.pas && /but inventé/.test(a.but || ""), "la carte sous la piste « " + C.ci + " », « ton but » sous le titre, son décor, l'objectif commun, la pastille" + tag + " " + JSON.stringify(a));
    await p.locator(".mj-carte").screenshot({ path: DOSSIER + "/" + C.nom + "-carte" + (sombre ? "-sombre" : "") + ".png" });
    await C.clic(p); await p.waitForTimeout(900);
    const f = await p.evaluate(() => ({ t: (document.querySelector(".mj-carte .mj-fait") || {}).textContent || "", pas: !!document.querySelector(".mj-pas") }));
    ok(envois.length === 1 && JSON.stringify(envois[0]) === JSON.stringify(C.attendu) && /Message inventé/.test(f.t) && !f.pas, "un seul geste " + JSON.stringify(envois) + ", carte « fait », pastille éteinte" + tag);
    const deb = await p.evaluate(deborde(".mj-carte *")); ok(!err.length && !deb.length, "0 erreur JS, rien ne déborde à 390 px " + JSON.stringify([err, deb]) + tag);
    await ctx.close();
  }
  // août : un autre jour, une seule question obligatoire (et un réglage du décor)
  { const envois = []; const { ctx, p, err } = await page(b, { quand: "2027-08-06T09:00:00", revVu: true, session: { role: "perso", nom: "Devlin" }, jusqua: 202707,
      mj: c => { if (c.op === "geste") { envois.push(c.geste); return { ok: true, message: "Réponse notée (inventée).", etat: ETAT({ jour: 6, fait: true, options: undefined }) }; } return MJ_ETAT(202708, ETAT({ jour: 6, options: undefined, groupes: [G("g4", ["Théo", "Kévin", "Clément"])], bouton: "Valider (inventé)", scene: { a: true, b: 0 } })); } });
    await allerCourse(p); const off = await p.evaluate(() => document.querySelector("[data-mj-env]").disabled), lianes = !!(await p.$("svg.mj-d8.e1 .p3"));
    await p.evaluate(() => { document.querySelector('[data-mj-v="Kévin"]').click(); document.querySelector("[data-mj-env]").click(); }); await p.waitForTimeout(700);
    ok(!err.length && off && envois.length === 1 && envois[0].reponses.g4 === "Kévin" && lianes, "août, autre jour : une seule question obligatoire (bouton éteint avant), le décor suit son réglage"); await ctx.close(); }
  // septembre : un jour sans geste (le serveur le dit) : pas de bouton, pas de pastille
  { const { ctx, p, err } = await page(b, { quand: "2027-09-08T09:00:00", revVu: true, session: { role: "perso", nom: "Kévin" }, jusqua: 202708, mj: () => MJ_ETAT(202709, ETAT({ jour: 8, fait: true, options: [], message: "Pas de geste (inventé).", scene: { a: 7, b: 26, c: true } })) });
    await allerCourse(p); const r = await p.evaluate(() => ({ b: document.querySelectorAll(".mj-carte [data-mj-opt]").length, pas: !!document.querySelector(".mj-pas") }));
    ok(!err.length && !r.b && !r.pas, "septembre, jour sans geste : pas de bouton, pas de pastille"); await ctx.close(); }
  // novembre fini : cérémonie et etatMiniJeu
  { const { ctx, p, err } = await page(b, { quand: "2027-12-01T09:00:00", session: { role: "perso", nom: "Théo" }, jusqua: 202711, mj: () => MJ_ETAT(202712, null, [FINI(202711, ["Nicolas"], true)]) });
    await p.waitForTimeout(1500); await p.evaluate(() => document.querySelectorAll(".tuto, .revel:not(.mj-cer):not(.mj-rev)").forEach(x => x.remove())); await p.waitForTimeout(3600);
    const c = await p.evaluate(() => { const o = document.querySelector(".mj-cer"); return o ? { t: o.textContent, ok: !!o.querySelector(".mj-cer-commun.ok"), mur: !!o.querySelector("svg.mj-d11") } : null; });
    await p.screenshot({ path: DOSSIER + "/novembre-ceremonie.png" });
    const w = await p.evaluate(() => etatMiniJeu("interlagos", "Théo"));
    ok(!err.length && c && c.ok && c.mur && /Nicolas/.test(c.t) && w.gagne && w.pourTous.length === 5 && w.meilleur.nom === "Nicolas", "1/12 : cérémonie de novembre (décor, objectif réussi, trophée pour les 5), etatMiniJeu " + JSON.stringify(w && w.progression));
    await ctx.close(); }
  // décembre fini : la cérémonie s'affiche bien en janvier 2028 (écart en mois, pas 202801 − 202712)
  { const fini = Object.assign(FINI(202711, ["Clément"], true), { mois: 202712, univers: "monza", type: "formulaire" });
    const { ctx, p, err } = await page(b, { quand: "2028-01-02T09:00:00", session: { role: "perso", nom: "Théo" }, jusqua: 202712, mj: () => Object.assign(MJ_ETAT(202801, null, [fini]), { courant: null }) });
    await p.waitForTimeout(1500); await p.evaluate(() => document.querySelectorAll(".tuto, .revel:not(.mj-cer):not(.mj-rev)").forEach(x => x.remove())); await p.waitForTimeout(3600);
    const c = await p.evaluate(() => { const o = document.querySelector(".mj-cer"); return o ? { t: o.textContent, portails: !!o.querySelector("svg.mj-d12") } : null; });
    ok(!err.length && c && c.portails && /Clément/.test(c.t), "2 janvier 2028 : la cérémonie de décembre s'affiche (décor, le meilleur)"); await ctx.close(); }
  await b.close(); fin(ko);
})();
