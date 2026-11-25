/* Test · 🎲 mini-jeu de janvier 2027 (circuit « silverstone ») : révélation du 1er, carte du jour avec son décor, geste, cérémonie de fin, vitrine.
   Fausses données uniquement (textes INVENTÉS : les vraies règles sont dans le dépôt privé). Serveur local : python3 -m http.server 8771 &
   puis node outils-tests/tmj-janvier.js (PORT=…, CAPTURES=…). Captures 390 px clair / sombre dans CAPTURES. */
const { chromium, DOSSIER, ETAT, MJ_ETAT, FINI_JANV, page, allerCourse, allerVitrine, deborde, compteur, fin } = require("./tmj-commun.js");
(async () => {
  const b = await chromium.launch(), { ko, ok } = compteur();
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", suf = sombre ? "-sombre" : "";
    // 1. le 1er janvier : la révélation animée s'ouvre toute seule, une seule fois ; « C'est parti » mène à la carte
    { let fait = false;
      const { ctx, p, err, req } = await page(b, { quand: "2027-01-01T09:00:00", sombre, session: { role: "perso", nom: "Kévin" }, jusqua: 202612,
        mj: c => c.op === "geste" ? (fait = true, { ok: true, message: "Message inventé : +3.", etat: ETAT({ fait: true, jour: 1, scene: { a: 5, b: 4, anim: 1 } }) }) : MJ_ETAT(202701, ETAT({ fait, jour: 1 })) });
      // d'autres fenêtres du 1er janvier (nouvelles règles…) passent d'abord : la révélation attend qu'elles se ferment
      const avant = await p.evaluate(() => !!document.querySelector(".mj-rev")); await p.evaluate(() => document.querySelectorAll(".tuto, .revel:not(.mj-rev)").forEach(x => x.remove())); await p.waitForTimeout(3600);
      const r = await p.evaluate(() => { const o = document.querySelector(".mj-rev"); return o ? { t: o.textContent, regle: o.querySelectorAll(".mj-rv-regle li").length, plaque: !!o.querySelector(".plaque.pl-epice") } : null; });
      ok(!avant && !!r && /Jeu d'essai/.test(r.t) && r.regle === 2 && r.plaque && /Aucun point/i.test(r.t), "1/1 : révélation plein écran, après les autres fenêtres du jour (titre, règle, objet à gagner, aucun point)" + tag + " " + JSON.stringify(r && r.regle));
      await p.waitForTimeout(sombre ? 1400 : 1400); await p.screenshot({ path: DOSSIER + "/revelation" + suf + ".png" });
      await p.click(".mj-rev [data-mj-go]"); await p.waitForTimeout(2200);
      const c = await p.evaluate(() => ({ rev: !!document.querySelector(".mj-rev"), carte: !!document.querySelector(".mj-carte"), dune: !!document.querySelector(".mj-carte svg.mj-deco.mj-d1"), vu: localStorage.getItem("versus.mjRev.202701") }));
      ok(!c.rev && c.carte && c.dune && c.vu === "1", "« C'est parti ! » : page Course, la carte du jour avec son décor ; révélation notée vue" + tag + " " + JSON.stringify(c));
      await p.locator(".mj-carte").screenshot({ path: DOSSIER + "/carte-jour" + suf + ".png" });
      await p.click(".mj-carte [data-mj-opt='a']"); await p.waitForTimeout(900);
      await p.locator(".mj-carte").screenshot({ path: DOSSIER + "/carte-faite" + suf + ".png" });
      const f = await p.evaluate(() => ({ t: (document.querySelector(".mj-carte .mj-fait") || {}).textContent || "", anim: !!document.querySelector(".mj-carte svg.a-1") }));
      ok(/Message inventé/.test(f.t) && f.anim && req.filter(x => x === "mj:geste").length === 1, "geste : le message du serveur, l'animation du jour, une seule demande" + tag);
      const deb = await p.evaluate(deborde(".mj-carte *")); ok(!err.length && !deb.length, "0 erreur JS, rien ne déborde à 390 px " + JSON.stringify([err, deb]) + tag);
      await ctx.close(); }
    // 2. rechargée le 2 : plus de révélation (déjà vue), la carte suffit ; la règle se relit depuis la carte
    { const { ctx, p, err } = await page(b, { quand: "2027-01-02T09:00:00", sombre, revVu: true, session: { role: "perso", nom: "Kévin" }, jusqua: 202612, mj: () => MJ_ETAT(202701, ETAT({ jour: 2 })) });
      await p.waitForTimeout(1500); const rev = !!(await p.$(".mj-rev"));
      await allerCourse(p); await p.click(".mj-carte [data-mj-regle]"); await p.waitForTimeout(500);
      const rl = await p.evaluate(() => { const o = document.querySelector(".mj-rev.relire"); return o ? o.innerText : ""; });
      ok(!err.length && !rev && /Règle inventée numéro deux/.test(rl), "le 2 : pas de 2e révélation ; « 📖 La règle » la relit" + tag);
      await ctx.close(); }
    // 3. le 1er février : la cérémonie de fin, une seule fois (gagnant : Kévin, vu par Clément), objet d'écurie, aucun point
    for (const [qui, reduit] of [["Clément", false], ["Kévin", true]]) {
      const { ctx, p, err } = await page(b, { quand: "2027-02-01T09:00:00", sombre, reduit, session: { role: "perso", nom: qui }, jusqua: 202701, mj: () => MJ_ETAT(202702, null, [FINI_JANV(["Kévin"])]) });
      await p.waitForTimeout(1500); await p.evaluate(() => document.querySelectorAll(".tuto, .revel:not(.mj-cer):not(.mj-rev)").forEach(x => x.remove())); await p.waitForTimeout(3600);
      const c = await p.evaluate(() => { const o = document.querySelector(".mj-cer"); return o ? { t: o.textContent, plaque: !!o.querySelector(".plaque.pl-epice"), ver: !!o.querySelector(".mj-scene svg.mj-deco"), reduit: o.classList.contains("reduit") } : null; });
      ok(!!c && /Kévin/.test(c.t) && /Titre d'essai/.test(c.t) && c.plaque && c.ver && /Aucun point/.test(c.t) && !/€/.test(c.t) && c.reduit === reduit, "1/2 : cérémonie de fin vue par " + qui + " (gagnant, titre, objet, le décor, aucun point, jamais d'euros)" + (reduit ? " (animations réduites)" : "") + tag);
      if (!reduit) { await p.waitForTimeout(1600); await p.screenshot({ path: DOSSIER + "/ceremonie" + suf + ".png" }); }
      await p.click(".mj-cer [data-mj-vit]"); await p.waitForTimeout(1200);
      const v = await p.evaluate(() => ({ cer: !!document.querySelector(".mj-cer"), vit: !!document.querySelector('#vit-mondes [data-monde="m-silverstone"]') && VIT_ONGLET === "mondes", vu: localStorage.getItem("versus.mjFin.202701") }));
      ok(!err.length && !v.cer && v.vit && v.vu === "1", "« Voir le trophée » : Trophées › 🗺️ Mondes, sur la carte de janvier ; cérémonie notée vue" + tag);
      if (qui === "Kévin") await p.locator('#vit-mondes [data-monde="m-silverstone"]').screenshot({ path: DOSSIER + "/monde-gagnant" + suf + ".png" });
      await ctx.close(); }
  }
  // 3 bis. objectif commun atteint : le décor change avec les réglages envoyés par le serveur
  for (const sombre of [false, true]) {
    const { ctx, p, err } = await page(b, { quand: "2027-01-24T09:00:00", sombre, revVu: true, session: { role: "perso", nom: "Kévin" }, jusqua: 202612,
      mj: () => MJ_ETAT(202701, ETAT({ jour: 24, nuit: "Nuit inventée.", commun: { ico: "🤝", lib: "Objectif commun inventé", val: 130, objectif: 128, reussi: true }, scene: { a: 6, b: 8, d: true, e: true } })) });
    await allerCourse(p);
    const c = await p.evaluate(() => ({ ch: !!document.querySelector(".mj-carte svg.mj-d1.e2 .p3 .p4"), ok: !!document.querySelector(".mj-commun.ok") }));
    ok(!err.length && c.ch && c.ok, "objectif commun atteint : le décor suit les réglages du serveur et la jauge « réussi »" + (sombre ? " (sombre)" : " (clair)"));
    await p.locator(".mj-carte").screenshot({ path: DOSSIER + "/janvier-commun" + (sombre ? "-sombre" : "") + ".png" });
    await ctx.close(); }
  // 4. la page Course d'un autre mois n'affiche pas la carte de janvier ; l'Écurie de Kévin montre la plaque
  { const { ctx, p, err } = await page(b, { quand: "2027-02-05T09:00:00", revVu: true, session: { role: "perso", nom: "Kévin" }, jusqua: 202701, mj: () => MJ_ETAT(202702, null, [FINI_JANV(["Kévin"])]) });
    await allerCourse(p); const carte = !!(await p.$(".mj-carte"));
    const pl = await p.evaluate(() => vignetteItem("plaque", "epice", "Kévin", equipDe("Kévin")));
    ok(!err.length && !carte && /pl-epice/.test(pl) && /Yeux de l/.test(pl), "février : plus de carte de janvier ; la plaque « Yeux de l'Épice » existe dans l'Écurie");
    await ctx.close(); }
  await b.close(); fin(ko);
})();
