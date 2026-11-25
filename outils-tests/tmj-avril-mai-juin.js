/* Test · 🎲 mini-jeux d'avril (« suzuka », choix), mai (« miami », choix) et juin (« montreal », formulaire) :
   la carte sous la bonne piste, le décor, le geste (un seul envoi), la cérémonie avec l'objectif commun, etatMiniJeu ;
   un jour sans geste (pas de boutons, pas de pastille). Fausses données uniquement (textes et identifiants INVENTÉS).
   Serveur local : python3 -m http.server 8771 &  puis node outils-tests/tmj-avril-mai-juin.js (PORT=…, CAPTURES=…). */
const { chromium, DOSSIER, ETAT, MJ_ETAT, FINI, page, allerCourse, deborde, compteur, fin } = require("./tmj-commun.js");
const OPTS_A = [{ id: "opt1", ico: "🅰️", lib: "Option 1 (inventée)", sous: "+1" }].concat(["Théo", "Clément", "Devlin", "Nicolas"].map(n => ({ id: "opt2:" + n, ico: "🅱️", lib: "Option 2 pour " + n, sous: "0" })));
const OPTS_M = ["opt1", "opt2", "opt3"].map((id, i) => ({ id, ico: ["1️⃣", "2️⃣", "3️⃣"][i], lib: "Option " + (i + 1), sous: "5 / 21" }));
const G_J = q1 => (q1 ? [] : [{ id: "g1", titre: "Question 1 (inventée)", options: [{ id: "c1", lib: "Choix 1" }, { id: "c2", lib: "Choix 2" }], requis: true }]).concat([{ id: "g2", titre: "Question 2 (inventée)", options: ["c3", "c4", "c5"].map(x => ({ id: x, lib: x })), requis: true }]);
const CAS = [
  { mois: 202704, nom: "avril", ci: "suzuka", svg: "svg.mj-deco.mj-d4", quand: "2027-04-05T09:00:00", etat: f => ETAT({ jour: 5, options: f ? [] : OPTS_A, scene: { b: true, d: 2 } }), clic: async p => p.evaluate(() => document.querySelector('.mj-carte [data-mj-opt="opt2:Clément"]').click()), attendu: { choix: "opt2:Clément" } },
  { mois: 202705, nom: "mai", ci: "miami", svg: "svg.mj-deco.mj-d5", quand: "2027-05-05T09:00:00", etat: () => ETAT({ jour: 5, options: OPTS_M, scene: { a: [0.2, 0.6, 1], b: true, c: 1 } }), clic: async p => p.evaluate(() => { const b = document.querySelector('.mj-carte [data-mj-opt="opt3"]'); b.click(); b.click(); }), attendu: { choix: "opt3" } },
  { mois: 202706, nom: "juin", ci: "montreal", svg: "svg.mj-deco.mj-d6", quand: "2027-06-05T09:00:00", etat: () => ETAT({ jour: 5, options: undefined, groupes: G_J(false), bouton: "Valider (inventé)", scene: { a: 0 } }),
    clic: async p => p.evaluate(() => { document.querySelector('[data-mj-g="g1"] [data-mj-v="c2"]').click(); document.querySelector('[data-mj-g="g2"] [data-mj-v="c5"]').click(); const b = document.querySelector("[data-mj-env]"); b.click(); b.click(); }), attendu: { reponses: { g1: "c2", g2: "c5" } } }
];
(async () => {
  const b = await chromium.launch(), { ko, ok } = compteur();
  for (const C of CAS) for (const sombre of [false, true]) {
    const tag = " (" + C.nom + (sombre ? ", sombre)" : ", clair)"), suf = (sombre ? "-sombre" : ""), envois = [];
    const { ctx, p, err } = await page(b, { quand: C.quand, sombre, revVu: true, session: { role: "perso", nom: "Kévin" }, jusqua: C.mois - 1,
      mj: c => { if (c.op === "geste") { envois.push(c.geste); return { ok: true, message: "Message inventé du geste.", etat: Object.assign(C.etat(true), { fait: true }) }; } return MJ_ETAT(C.mois, C.etat(false)); } });
    await allerCourse(p);
    const a = await p.evaluate(sel => { const c = document.querySelector(".mj-carte"); return c ? { ci: document.querySelector("#gp-piste").dataset.circuit, svg: !!c.querySelector(sel), commun: !!c.querySelector(".mj-commun"), pas: !!document.querySelector(".mj-pas") } : null; }, C.svg);
    ok(a && a.ci === C.ci && a.svg && a.commun && a.pas, "la carte sous la piste « " + C.ci + " », son décor, l'objectif commun, la pastille" + tag + " " + JSON.stringify(a));
    await p.locator(".mj-carte").screenshot({ path: DOSSIER + "/" + C.nom + "-carte" + suf + ".png" });
    await C.clic(p); await p.waitForTimeout(900);
    const f = await p.evaluate(() => ({ t: (document.querySelector(".mj-carte .mj-fait") || {}).textContent || "", pas: !!document.querySelector(".mj-pas") }));
    ok(envois.length === 1 && JSON.stringify(envois[0]) === JSON.stringify(C.attendu) && /Message inventé/.test(f.t) && !f.pas, "un seul geste " + JSON.stringify(envois) + ", carte « fait », pastille éteinte" + tag);
    const deb = await p.evaluate(deborde(".mj-carte *")); ok(!err.length && !deb.length, "0 erreur JS, rien ne déborde à 390 px " + JSON.stringify([err, deb]) + tag);
    await ctx.close();
  }
  // avril : un pilote sans geste aujourd'hui (le serveur le dit) : pas de boutons, pas de pastille
  { const { ctx, p, err } = await page(b, { quand: "2027-04-06T09:00:00", revVu: true, session: { role: "perso", nom: "Devlin" }, jusqua: 202703, mj: () => MJ_ETAT(202704, ETAT({ jour: 6, fait: true, options: [], message: "Pas de geste aujourd'hui (inventé).", scene: { b: false } })) });
    await allerCourse(p); const r = await p.evaluate(() => ({ b: document.querySelectorAll(".mj-carte [data-mj-opt]").length, pas: !!document.querySelector(".mj-pas"), t: (document.querySelector(".mj-carte .mj-fait") || {}).textContent || "" }));
    ok(!err.length && !r.b && !r.pas && /Pas de geste/.test(r.t), "avril, sans geste aujourd'hui : pas de bouton, pas de pastille, le mot du serveur"); await ctx.close(); }
  // cérémonies (objectif commun réussi en mai, manqué en juin) et etatMiniJeu
  for (const [mois, ci, nomF, reussi] of [[202705, "miami", "mai", true], [202706, "montreal", "juin", false]]) {
    const { ctx, p, err } = await page(b, { quand: new Date(Math.floor(mois / 100), mois % 100, 1, 9).toISOString(), session: { role: "perso", nom: "Clément" }, jusqua: mois, mj: () => MJ_ETAT(mois + 1, null, [FINI(mois, ["Clément"], reussi)]) });
    await p.waitForTimeout(1500); await p.evaluate(() => document.querySelectorAll(".tuto, .revel:not(.mj-cer):not(.mj-rev)").forEach(x => x.remove())); await p.waitForTimeout(3600);
    const c = await p.evaluate(() => { const o = document.querySelector(".mj-cer"); return o ? { t: o.textContent, ok: !!o.querySelector(".mj-cer-commun.ok") } : null; });
    await p.screenshot({ path: DOSSIER + "/" + nomF + "-ceremonie.png" });
    const w = await p.evaluate(x => etatMiniJeu(x, "Clément"), ci);
    ok(!err.length && c && c.ok === reussi && /Clément/.test(c.t) && /Aucun point/.test(c.t) && w.etat === "fini" && w.gagne === reussi && w.pourTous.length === (reussi ? 5 : 0) && w.meilleur.nom === "Clément", nomF + " : cérémonie (objectif commun " + (reussi ? "réussi" : "manqué") + "), etatMiniJeu " + JSON.stringify(w));
    await ctx.close(); }
  await b.close(); fin(ko);
})();
