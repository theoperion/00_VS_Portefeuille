/* Test · 🎲 moteur des mini-jeux du mois (js/9-minijeux.js) : secret avant l'heure, pastille, double geste, absent, vitrine, case ??? 2028, aperçu admin.
   Fausses données uniquement (serveur Google intercepté, textes inventés : tmj-commun.js). Serveur local ouvert : python3 -m http.server 8771 &
   puis node outils-tests/tmj-moteur.js (PORT=… pour un autre port, CAPTURES=… pour le dossier des captures). */
const { chromium, NOMS, ETAT, MJ_ETAT, FINI_JANV, page, allerCourse, allerVitrine, deborde, compteur, fin } = require("./tmj-commun.js");
(async () => {
  const b = await chromium.launch(), { ko, ok } = compteur();
  // 1. avant le 1/1/2027 : aucune demande « mj », rien dans l'appli ni dans les règles (même si un serveur fautif répondait)
  { const { ctx, p, err, req } = await page(b, { quand: "2026-12-15T10:00:00", session: { role: "perso", nom: "Clément" }, jusqua: 202612, mj: () => MJ_ETAT(202701, ETAT()) });
    await allerCourse(p);
    const t = await p.evaluate(async () => { ouvrirRegles(null, false); await new Promise(r => setTimeout(r, 700)); const o = document.querySelector(".regles"); const t = (o ? o.innerText : "") + document.body.innerText; document.querySelectorAll(".regles").forEach(x => x.remove()); return t; });
    ok(!err.length && !req.some(x => x.startsWith("mj")) && !(await p.$(".mj-carte, .mj-rev, #vit-mj, .mj-pas")) && !/Mini-jeu|Jeu d'essai|Règle inventée/i.test(t), "15/12/2026 : aucune demande au serveur, rien du mini-jeu (carte, règles, vitrine, pastille) " + JSON.stringify(err));
    await ctx.close(); }
  // 2. le serveur dit « pas encore » (ouvert:false) : rien non plus
  { const { ctx, p, err } = await page(b, { quand: "2027-01-05T10:00:00", session: { role: "perso", nom: "Kévin" }, jusqua: 202612, mj: () => ({ ok: true, ouvert: false }) });
    await allerCourse(p); ok(!err.length && !(await p.$(".mj-carte, .mj-rev, .mj-pas")), "serveur « pas encore » : ni carte, ni révélation, ni pastille"); await ctx.close(); }
  // 3. janvier : pastille quand le geste du jour n'est pas fait ; double clic = UN seul geste envoyé ; pastille qui s'éteint
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)"; let fait = false;
    const { ctx, p, err, req } = await page(b, { quand: "2027-01-05T10:00:00", sombre, revVu: true, session: { role: "perso", nom: "Kévin" }, jusqua: 202612,
      mj: c => c.op === "geste" ? (fait ? { ok: false, erreur: "deja", message: "Déjà joué (inventé)." } : (fait = true, { ok: true, message: "Message inventé du geste.", etat: ETAT({ fait: true }) })) : MJ_ETAT(202701, ETAT({ fait })) });
    const pas = await p.evaluate(() => !!document.querySelector(".onglet[data-vue='trophees'] .mj-pas"));
    await allerCourse(p);
    const av = await p.evaluate(() => ({ carte: !!document.querySelector("#gp-piste + .mj-carte, .gp-piste ~ .mj-carte") || !!document.querySelector(".mj-carte"), ci: (document.querySelector("#gp-piste") || {}).dataset.circuit, tab: !!document.querySelector(".pod-tabs [data-pod='gp'] .mj-pas") }));
    ok(pas && av.carte && av.ci === "silverstone" && av.tab, "janvier : pastille sur l'onglet Podium et sur Course, carte sous la piste du mois" + tag + " " + JSON.stringify(av));
    await p.evaluate(() => { const b = document.querySelector(".mj-carte [data-mj-opt='a']"); b.click(); b.click(); document.querySelector(".mj-carte [data-mj-opt='b']").click(); });
    await p.waitForTimeout(900);
    const ap = await p.evaluate(() => ({ fait: (document.querySelector(".mj-carte .mj-fait") || {}).textContent || "", boutons: document.querySelectorAll(".mj-carte [data-mj-opt]").length, pas: !!document.querySelector(".mj-pas"), txt: document.querySelector(".mj-carte").innerText }));
    ok(req.filter(x => x === "mj:geste").length === 1 && /Message inventé/.test(ap.fait) && !ap.boutons && !ap.pas, "double clic (et clic sur l'autre option) : un seul geste envoyé, plus de boutons, pastille éteinte" + tag + " " + JSON.stringify(req.filter(x => x.startsWith("mj"))));
    ok(!/€|euros?\b/i.test(ap.txt), "rien en euros dans la carte" + tag);
    const deb = await p.evaluate(deborde(".mj-carte *")); ok(!err.length && !deb.length, "0 erreur JS, rien ne déborde à 390 px " + JSON.stringify([err, deb]) + tag);
    await ctx.close(); }
  // 4. le serveur refuse (déjà joué ailleurs, sur un autre téléphone) : message, et l'état se recharge
  { let refus = 0; const { ctx, p, err, req } = await page(b, { quand: "2027-01-05T10:00:00", revVu: true, session: { role: "perso", nom: "Kévin" }, jusqua: 202612,
      mj: c => c.op === "geste" ? (refus++, { ok: false, erreur: "deja", message: "Tu as déjà joué aujourd'hui (inventé)." }) : MJ_ETAT(202701, ETAT({ fait: refus > 0 })) });
    await allerCourse(p); await p.click(".mj-carte [data-mj-opt='a']"); await p.waitForTimeout(1500);
    const t = await p.evaluate(() => ({ toast: document.body.innerText.includes("déjà joué aujourd'hui"), boutons: document.querySelectorAll(".mj-carte [data-mj-opt]").length }));
    ok(!err.length && t.toast && !t.boutons && req.filter(x => x === "mj:etat").length >= 2, "geste refusé par le serveur (déjà joué) : message affiché, état rechargé, plus de bouton " + JSON.stringify(t));
    await ctx.close(); }
  // 5. un absent : il n'a rien joué, le jeu continue pour les autres (rien ne l'attend côté appli) et il peut jouer le jour même
  { const { ctx, p, err } = await page(b, { quand: "2027-01-28T21:00:00", revVu: true, session: { role: "perso", nom: "Devlin" }, jusqua: 202612, mj: () => MJ_ETAT(202701, ETAT({ jour: 28, compteurs: [{ ico: "🏠", lib: "Compteur 1", val: 0 }] })) });
    await allerCourse(p); ok(!err.length && (await p.$$(".mj-carte [data-mj-opt]")).length === 2, "absent 27 jours : il retrouve sa carte et ses 2 choix du jour, sans rien bloquer"); await ctx.close(); }
  // 6. février : la vitrine, c'est Trophées › 🗺️ Mondes (plus de vitrine « mini-jeux » en double) : 12 cartes, janvier fini (Kévin meilleur → feuille d'or, titre),
  //    les 11 autres « à venir » (février sans état chargé) ; objectif commun manqué → trophée à personne ; plaque exclusive au seul meilleur ; Succès : case « ??? 2028 »
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)";
    const { ctx, p, err } = await page(b, { quand: "2027-02-05T10:00:00", sombre, revVu: true, session: { role: "perso", nom: "Kévin" }, jusqua: 202701, mj: () => MJ_ETAT(202702, null, [FINI_JANV(["Kévin"])]) });
    await allerVitrine(p);
    const v = await p.evaluate(async () => { const s = document.querySelector("#vit-mondes"), j = s && s.querySelector('[data-monde="m-silverstone"]');
      const r = { doublon: !!document.querySelector("#vit-mj"), cartes: s ? s.querySelectorAll(".cc-m").length : 0, aVenir: s ? s.querySelectorAll(".cc-m.a-venir").length : 0, janv: j ? j.className : "", janvTxt: j ? j.innerText : "",
        txt: s ? s.innerText : "", tropheeK: etatTropheesMondes()["m-silverstone"]["Kévin"].ok,
        plaqueK: debloques("Kévin").has("plaque.epice"), plaqueC: debloques("Clément").has("plaque.epice"), ecurie: idsSlot("plaque").includes("epice"), origine: texteOrigineItem("Clément", "plaque", "epice").t, rare: rareteItem("plaque", "epice").lib };
      VIT_ONGLET = "succes"; rendreTrophees(); await new Promise(x => setTimeout(x, 400)); r.c2028 = !!document.querySelector("#vit-succes .cc-2028"); VIT_ONGLET = "mondes"; rendreTrophees(); await new Promise(x => setTimeout(x, 400)); return r; });
    ok(!v.doublon && v.cartes === 12 && v.aVenir === 11 && /exclusif/.test(v.janv) && /Titre d'essai/.test(v.janvTxt) && !v.tropheeK && !/Règle inventée/.test(v.txt), "Trophées › Mondes : 12 cartes (11 à venir : février sans état chargé), janvier : Kévin meilleur du mois (feuille d'or, son titre), objectif commun manqué → pas de trophée ; plus de vitrine 🎲 en double" + tag + " " + JSON.stringify(v));
    ok(v.c2028, "Succès : la case « ??? 2028 » grisée" + tag);
    ok(v.plaqueK && !v.plaqueC && v.ecurie && /Exclusif/.test(v.origine) && /janvier/.test(v.origine) && v.rare === "Exclusif", "plaque du mini-jeu : exclusif doré du seul meilleur, origine « mini-jeu de janvier » dans l'écurie" + tag);
    await p.locator("#vit-mondes").screenshot({ path: require("./tmj-commun.js").DOSSIER + "/mondes-minijeux" + (sombre ? "-sombre" : "") + ".png" });
    const deb = await p.evaluate(deborde("#vit-mondes *")); ok(!err.length && !deb.length, "0 erreur JS, Mondes sans débordement à 390 px " + JSON.stringify([err, deb]) + tag);
    await ctx.close(); }
  // 6 bis. objectif commun réussi : le trophée du monde et ses objets d'univers pour TOUS les pilotes
  { const { ctx, p, err } = await page(b, { quand: "2027-02-05T10:00:00", revVu: true, session: { role: "perso", nom: "Clément" }, jusqua: 202701, mj: () => MJ_ETAT(202702, null, [FINI_JANV(["Kévin"], true)]) });
    await allerVitrine(p);
    const v = await p.evaluate(() => { const T = etatTropheesMondes()["m-silverstone"], j = document.querySelector('#vit-mondes [data-monde="m-silverstone"]');
      return { tous: D.personnes.every(x => T[x.nom].ok), objets: TROPHEES_MONDES[0].gain.every(g => debloques("Clément").has(g.join("."))), plaqueC: debloques("Clément").has("plaque.epice"), janv: j ? j.className : "",
        orig: texteOrigineItem("Clément", TROPHEES_MONDES[0].gain[0][0], TROPHEES_MONDES[0].gain[0][1]).p }; });
    ok(!err.length && v.tous && v.objets && !v.plaqueC && /\bmoi\b/.test(v.janv) && /objectif commun/.test(v.orig), "objectif commun réussi : trophée de janvier pour tous, objets du monde débloqués pour Clément (pas la plaque du meilleur) " + JSON.stringify(v));
    await ctx.close(); }
  // 7. avant la fin de janvier, l'objet n'est à personne et n'apparaît pas en décembre
  { const { ctx, p, err } = await page(b, { quand: "2026-12-20T10:00:00", session: { role: "perso", nom: "Kévin" }, jusqua: 202612 });
    const e = await p.evaluate(() => idsSlot("plaque").includes("epice")); ok(!err.length && !e, "décembre 2026 : l'objet du mini-jeu de janvier n'apparaît pas dans l'Écurie"); await ctx.close(); }
  // 8. aperçu admin : seulement avec la double sécurité ; il ne demande que l'aperçu (jamais un vrai geste)
  for (const [nomCas, session, adminOn, attendu] of [["joueur", { role: "perso", nom: "Kévin" }, true, false], ["admin sans mode admin", { role: "admin" }, false, false], ["admin + mode admin", { role: "admin" }, true, true]]) {
    const { ctx, p, err, req } = await page(b, { quand: "2026-11-25T10:00:00", session, adminOn, jusqua: 202612,
      mj: c => c.op === "apercu" ? Object.assign({ ok: true, mois: 202701, univers: "silverstone", type: "choix", contenu: { ico: "🏜️", titre: "Jeu d'essai", accroche: "Inventée.", regle: ["Règle inventée."] }, recompense: { trophee: { ico: "🏜️", nom: "Essai" }, titre: "Titre d'essai", objet: ["plaque", "epice"] }, apercu: true, jour: c.jour, fin: 31 },
        c.jour === 99 ? { resultat: { gagnants: ["Toi (aperçu)"], tableau: [{ nom: "Toi (aperçu)", val: 9, txt: "9 inventées" }], texte: "Fin inventée." } } : { message: c.geste ? "Geste d'aperçu inventé." : "", g: c.geste, etat: ETAT({ fait: !!c.geste || (c.gestes || []).some(x => x.jour === c.jour), jour: c.jour, tableau: [{ nom: "Toi (aperçu)", val: 3, txt: "3" }, { nom: "Pilote A", val: 2, txt: "2" }] }) }) : { ok: false, message: "non" } });
    await allerCourse(p);
    const a = await p.evaluate(async () => { const bouton = !!document.querySelector("[data-bamj]"); apercuMJ(202701); await new Promise(r => setTimeout(r, 900)); return { bouton, ouvert: !!document.querySelector(".mj-apercu .mj-carte") }; });
    ok(!err.length && a.ouvert === attendu && a.bouton === attendu, "aperçu admin (" + nomCas + ") : " + (attendu ? "s'ouvre" : "ne s'ouvre pas, même en forçant") + " " + JSON.stringify(a));
    if (attendu) {
      await p.locator(".mj-apercu .rg-c").screenshot({ path: require("./tmj-commun.js").DOSSIER + "/apercu-admin.png" });
      await p.evaluate(() => document.querySelector(".mj-apercu [data-mj-opt='a']").click()); await p.waitForTimeout(700);
      const g = await p.evaluate(() => (document.querySelector(".mj-apercu .mj-fait") || {}).textContent || "");
      await p.evaluate(() => document.querySelector(".mj-apercu [data-mj-j]").click()); await p.waitForTimeout(900);
      const j2 = await p.evaluate(() => document.querySelectorAll(".mj-apercu [data-mj-opt]").length);
      await p.evaluate(() => document.querySelector(".mj-apercu [data-mj-fin]").click()); await p.waitForTimeout(900);
      const c = await p.evaluate(() => (document.querySelector(".mj-cer") || {}).textContent || "");
      ok(/Geste d'aperçu inventé/.test(g) && j2 === 2 && /exemple inventé/.test(c) && /Aucun point/.test(c) && !req.includes("mj:geste") && !req.includes("mj:etat"), "aperçu : on joue, jour suivant, cérémonie d'exemple ; seulement des demandes « aperçu » (jamais un vrai geste) " + JSON.stringify(req.filter(x => x.startsWith("mj"))));
    }
    await ctx.close(); }
  // 9. relecture jeu-joueur (25/11) : pastille « à jouer » en haut de la page Course, carte sous la barre d'outils ; Mondes « ✗ Manqué » / « ⏳ En cours » ;
  //    bouton retour pendant la cérémonie = cérémonie notée vue, puis la révélation du nouveau mois
  { const { ctx, p, err } = await page(b, { quand: "2027-02-05T10:00:00", revVu: true, session: { role: "perso", nom: "Théo" }, jusqua: 202701, mj: () => MJ_ETAT(202702, ETAT({ jour: 5 }), [FINI_JANV(["Kévin"], false)]) });
    await allerCourse(p); await p.waitForTimeout(1500);
    const a = await p.evaluate(() => { const c = document.querySelector(".mj-carte"), x = document.querySelector(".mj-aller"); return { apres: c && c.previousElementSibling ? c.previousElementSibling.className : "", x: x ? x.textContent : "", haut: !!(x && x.closest(".gp-atouts") && (x.compareDocumentPosition(document.querySelector("#gp-piste")) & 4)) }; });
    await p.click(".mj-aller"); await p.waitForTimeout(1200);
    const vu = await p.evaluate(() => Math.round(document.querySelector(".mj-carte").getBoundingClientRect().top));
    ok(/gp-vues2/.test(a.apres) && a.x === "🎲 Mini-jeu du jour à jouer ↓" && a.haut && vu >= -2 && vu < 300, "pastille « 🎲 Mini-jeu du jour à jouer ↓ » en haut, qui descend jusqu'à la carte ; carte sous la barre d'outils de la piste " + JSON.stringify([a, vu]));
    await allerVitrine(p); await p.waitForTimeout(800);
    const m = await p.evaluate(() => [document.querySelector('[data-monde="m-silverstone"] .cc-pied').innerText, document.querySelector('[data-monde="m-djeddah"] .cc-pied').innerText]);
    ok(/✗ Manqué \(80 \/ 120\)/.test(m[0]) && /⏳ En cours · 37 \/ 120/.test(m[1]), "Mondes : « ✗ Manqué (80 / 120) » et « ⏳ En cours · 37 / 120 » " + JSON.stringify(m));
    await p.click('[data-monde="m-djeddah"]'); await p.waitForTimeout(500);
    const f = await p.evaluate(() => document.querySelector(".mo-ov").innerText);
    await p.click("[data-mo-jouer]"); await p.waitForTimeout(1300);
    const j = await p.evaluate(() => { const c = document.querySelector(".mj-carte"); return c ? Math.round(c.getBoundingClientRect().top) : null; });
    ok(/Objectif commun : 37 \/ 120, jusqu'au 28 février/.test(f) && j !== null && j >= -2 && j < 300, "fiche du monde en cours : objectif jusqu'au 28 février, « 🎲 Jouer aujourd'hui » mène à la carte " + j);
    ok(!err.length, "0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  { const { ctx, p, err } = await page(b, { quand: "2027-02-01T09:00:00", session: { role: "perso", nom: "Clément" }, jusqua: 202701, mj: () => MJ_ETAT(202702, ETAT({ jour: 1 }), [FINI_JANV(["Kévin"], true)]) });
    await p.evaluate(() => document.querySelectorAll(".tuto, .revel:not(.mj-cer):not(.mj-rev), .regles, .ba").forEach(x => x.remove())); await p.waitForTimeout(5000);
    const avant = !!(await p.$(".mj-cer"));
    await p.mouse.click(195, 20); await p.waitForTimeout(300); await p.goBack(); await p.waitForTimeout(1500);
    const st = await p.evaluate(() => ({ cer: !!document.querySelector(".mj-cer"), vu: localStorage.getItem("versus.mjFin.202701"), ici: /index\.html/.test(location.href) }));
    await p.waitForTimeout(2500); const rev = !!(await p.$(".mj-rev"));
    ok(avant && !st.cer && st.vu === "1" && st.ici && rev && !err.length, "bouton retour pendant la cérémonie : fermée, notée vue, on reste dans l'appli, puis la révélation de février " + JSON.stringify([avant, st, rev]));
    await ctx.close(); }
  await b.close(); fin(ko);
})();
