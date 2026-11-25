/* Test · 🎲 mini-jeu de février 2027 (circuit « djeddah », peintre « formulaire ») : un écran, un geste (deux questions), objectif commun, cérémonie.
   Fausses données uniquement (textes INVENTÉS : les vraies règles sont dans le dépôt privé). Serveur local : python3 -m http.server 8771 &
   puis node outils-tests/tmj-fevrier.js (PORT=…, CAPTURES=…). */
const { chromium, DOSSIER, ETAT, MJ_ETAT, FINI, page, allerCourse, deborde, compteur, fin } = require("./tmj-commun.js");
const GROUPES = jour => (jour < 28 ? [{ id: "q1|" + (jour - 1), titre: "Question inventée 1", texte: "« Message inventé »", question: "Qui ?", options: ["Théo", "Clément", "Devlin", "Nicolas"].map(n => ({ id: n, lib: n })), requis: false }] : [{ id: "q1|27", titre: "Question inventée 1", texte: "« Message inventé »", question: "Qui ?", options: ["Théo", "Clément"].map(n => ({ id: n, lib: n })), requis: false }])
  .concat(jour < 28 ? [{ id: "q2", titre: "Question inventée 2", question: "Ton message :", options: [{ id: "3", lib: "« Message A inventé »" }, { id: "7", lib: "« Message B inventé »" }], requis: true }] : []);
const ETAT_F = (jour, o) => ETAT(Object.assign({ jour, groupes: GROUPES(jour), options: undefined, bouton: jour < 28 ? "Envoyer (inventé)" : "Valider (inventé)", scene: { a: 3, b: true } }, o || {}));
(async () => {
  const b = await chromium.launch(), { ko, ok } = compteur();
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", suf = sombre ? "-sombre" : "";
    const envois = [];
    const { ctx, p, err, req } = await page(b, { quand: "2027-02-05T09:00:00", sombre, revVu: true, session: { role: "perso", nom: "Kévin" }, jusqua: 202701,
      mj: c => { if (c.op === "geste") { envois.push(c.geste); return { ok: true, message: "Message inventé du geste.", etat: ETAT_F(5, { fait: true }) }; } return MJ_ETAT(202702, ETAT_F(5)); } });
    await allerCourse(p);
    const a = await p.evaluate(() => { const c = document.querySelector(".mj-carte.mj-t-formulaire"), b = c && c.querySelector("[data-mj-env]"); return c ? { ci: document.querySelector("#gp-piste").dataset.circuit, g: c.querySelectorAll(".mj-g").length, off: b.disabled, svg: !!c.querySelector("svg.mj-deco.mj-d2"), commun: !!c.querySelector(".mj-commun") } : null; });
    ok(a && a.ci === "djeddah" && a.g === 2 && a.off && a.svg && a.commun, "5/2 : la carte de février sous la piste (2 questions, décor, objectif commun) ; bouton éteint tant que la question obligatoire n'a pas de réponse" + tag + " " + JSON.stringify(a));
    await p.locator(".mj-carte").screenshot({ path: DOSSIER + "/fevrier-carte" + suf + ".png" });
    const clic = sel => p.evaluate(x => document.querySelector(x).click(), sel);
    await clic('.mj-g[data-mj-g="q1|4"] [data-mj-v="Clément"]');
    const b1 = await p.evaluate(() => document.querySelector("[data-mj-env]").disabled);
    await clic('.mj-g[data-mj-g="q2"] [data-mj-v="7"]');
    const b2 = await p.evaluate(() => document.querySelector("[data-mj-env]").disabled);
    ok(b1 && !b2, "la question 1 seule ne suffit pas (la 2 est obligatoire) ; avec les deux, le bouton s'allume" + tag);
    await p.evaluate(() => { const x = document.querySelector("[data-mj-env]"); x.click(); x.click(); }); await p.waitForTimeout(900);
    const f = await p.evaluate(() => ({ t: (document.querySelector(".mj-carte .mj-fait") || {}).textContent || "", g: document.querySelectorAll(".mj-carte .mj-g").length }));
    ok(envois.length === 1 && JSON.stringify(envois[0]) === JSON.stringify({ reponses: { "q1|4": "Clément", q2: "7" } }) && /Message inventé du geste/.test(f.t) && !f.g, "un seul geste envoyé (les deux réponses ensemble), puis la carte « fait »" + tag + " " + JSON.stringify(envois));
    await p.locator(".mj-carte").screenshot({ path: DOSSIER + "/fevrier-fait" + suf + ".png" });
    const deb = await p.evaluate(deborde(".mj-carte *")); ok(!err.length && !deb.length, "0 erreur JS, rien ne déborde à 390 px " + JSON.stringify([err, deb]) + tag);
    await ctx.close();
  }
  // dernier jour : une seule question facultative, le bouton s'allume dès une réponse
  { const envois = []; const { ctx, p, err } = await page(b, { quand: "2027-02-28T20:00:00", revVu: true, session: { role: "perso", nom: "Devlin" }, jusqua: 202701,
      mj: c => { if (c.op === "geste") { envois.push(c.geste); return { ok: true, message: "C'est noté (inventé).", etat: ETAT_F(28, { fait: true }) }; } return MJ_ETAT(202702, ETAT_F(28)); } });
    await allerCourse(p); const off = await p.evaluate(() => document.querySelector("[data-mj-env]").disabled);
    await p.evaluate(() => { document.querySelector('[data-mj-v="Théo"]').click(); document.querySelector("[data-mj-env]").click(); }); await p.waitForTimeout(700);
    ok(!err.length && off && envois.length === 1 && envois[0].reponses["q1|27"] === "Théo" && !("q2" in envois[0].reponses), "dernier jour : une seule question"); await ctx.close(); }
  // le 1er mars : cérémonie avec l'objectif commun réussi (trophée pour tous)
  for (const sombre of [false, true]) {
    const { ctx, p, err } = await page(b, { quand: "2027-03-01T09:00:00", sombre, session: { role: "perso", nom: "Clément" }, jusqua: 202702, mj: () => MJ_ETAT(202703, null, [FINI(202702, ["Kévin"], true)]) });
    await p.waitForTimeout(1500); await p.evaluate(() => document.querySelectorAll(".tuto, .revel:not(.mj-cer):not(.mj-rev)").forEach(x => x.remove())); await p.waitForTimeout(3600);
    const c = await p.evaluate(() => { const o = document.querySelector(".mj-cer"); return o ? { t: o.textContent, ok: !!o.querySelector(".mj-cer-commun.ok"), plaque: !!o.querySelector(".plaque") } : null; });
    ok(!err.length && c && c.ok && /pour tout le monde/.test(c.t) && /Kévin/.test(c.t) && c.plaque && /Aucun point/.test(c.t), "1/3 : cérémonie, objectif commun réussi (trophée pour tous), le meilleur et son objet" + (sombre ? " (sombre)" : " (clair)"));
    await p.waitForTimeout(800); await p.screenshot({ path: DOSSIER + "/fevrier-ceremonie" + (sombre ? "-sombre" : "") + ".png" });
    const w = await p.evaluate(() => ({ w: etatMiniJeu("djeddah", "Clément"), rev: window.MINIJEUX_REV, pont: (m => m && !m.aVenir && m.gagne && m.meilleurs.join() === "Kévin" && m.titre === "Titre d'essai")(etatMondeMiniJeu("djeddah", "Clément")) }));
    ok(w.w && w.w.etat === "fini" && w.w.gagne && w.w.pourTous.length === 5 && w.w.pourTous.includes("Clément") && w.w.meilleur.nom === "Kévin" && w.w.progression.p === 130 && w.w.progression.c === 120 && w.rev > 0 && w.pont, "etatMiniJeu(djeddah, Clément) : trophée pour les 5, le meilleur (Kévin), la progression ; MINIJEUX_REV > 0 ; le pont etatMondeMiniJeu (js/3-podium.js) le lit pareil " + JSON.stringify(w));
    await ctx.close(); }
  await b.close(); fin(ko);
})();
