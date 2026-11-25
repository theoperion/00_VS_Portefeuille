/* Test · 🎲 mini-jeu de mars 2027 (circuit « melbourne », peintre « chasse ») : l'objet caché dans un onglet (dessin et texte envoyés par le serveur), la collection, la cérémonie.
   Fausses données uniquement (textes INVENTÉS). Serveur local : python3 -m http.server 8771 &  puis node outils-tests/tmj-mars.js (PORT=…, CAPTURES=…). */
const { chromium, DOSSIER, ETAT, MJ_ETAT, FINI, page, allerCourse, deborde, compteur, fin } = require("./tmj-commun.js");
const CARTES = n => Array.from({ length: 10 }, (_, i) => ({ ico: i === 9 ? "⭐" : "🔹", nom: "Carte inventée " + (i + 1), n: i < n ? 1 : 0, rare: i === 9 }));
const ETAT_M = (o) => ETAT(Object.assign({ jour: 5, options: undefined, chasse: { onglet: "mois", x: 40, y: 50, aide: "Objet inventé : touche-le", svg: '<svg viewBox="0 0 60 30" aria-hidden="true"><rect width="60" height="30" rx="8" fill="#888"/></svg>' }, indice: "Indice inventé.", cartes: CARTES(3), ligne: ["Ligne inventée : cherche."], scene: { a: 3, b: false } }, o || {}));
(async () => {
  const b = await chromium.launch(), { ko, ok } = compteur();
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", suf = sombre ? "-sombre" : "";
    let pris = false; const envois = [];
    const { ctx, p, err } = await page(b, { quand: "2027-03-05T09:00:00", sombre, revVu: true, session: { role: "perso", nom: "Kévin" }, jusqua: 202702,
      mj: c => { if (c.op === "geste") { envois.push(c.geste); pris = true; return { ok: true, message: "Message inventé de la chasse.", etat: ETAT_M({ fait: true, chasse: null, cartes: CARTES(4) }) }; } return MJ_ETAT(202703, ETAT_M(pris ? { fait: true, chasse: null } : {})); } });
    await allerCourse(p);
    const a = await p.evaluate(() => { const c = document.querySelector(".mj-carte.mj-t-chasse"); return c ? { ci: document.querySelector("#gp-piste").dataset.circuit, cartes: c.querySelectorAll(".mj-cc").length, a: c.querySelectorAll(".mj-cc.a").length, svg: !!c.querySelector("svg.mj-deco.mj-d3"), pas: !!document.querySelector(".onglet[data-vue='trophees'] .mj-pas"), cache: !!document.querySelector(".mj-cache") } : null; });
    ok(a && a.ci === "melbourne" && a.cartes === 10 && a.a === 3 && a.svg && a.pas && !a.cache, "5/3 : la carte de mars (collection 10 cases, 3 trouvées, décor), pastille ; pas d'objet caché sur la page Course (il est ailleurs)" + tag + " " + JSON.stringify(a));
    await p.locator(".mj-carte").screenshot({ path: DOSSIER + "/mars-carte" + suf + ".png" });
    await p.evaluate(() => montrerVue("classement")); await p.waitForTimeout(1500);
    const s1 = await p.evaluate(() => !!document.querySelector(".mj-cache"));
    await p.evaluate(() => montrerVue("mois")); await p.waitForTimeout(1600);
    const s2 = await p.evaluate(() => { const s = document.querySelector(".mj-cache"); if (!s) return null; const r = s.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; });
    ok(!s1 && s2 && Math.abs(s2.x - 156) < 6 && Math.abs(s2.y - 422) < 6, "l'objet n'apparaît que dans l'onglet tiré (Mois), à sa place " + JSON.stringify(s2) + tag);
    await p.screenshot({ path: DOSSIER + "/mars-cache" + suf + ".png" });
    await p.evaluate(() => { const s = document.querySelector(".mj-cache"); s.click(); s.click(); }); await p.waitForTimeout(1500);
    const f = await p.evaluate(() => ({ s: !!document.querySelector(".mj-cache"), toast: document.body.innerText.includes("Message inventé de la chasse"), pas: !!document.querySelector(".mj-pas") }));
    ok(envois.length === 1 && JSON.stringify(envois[0]) === JSON.stringify({ attraper: 1, onglet: "mois" }) && !f.s && f.toast && !f.pas, "toucher l'objet : un seul geste (même en double clic), le message, il s'évapore, la pastille s'éteint" + tag + " " + JSON.stringify([envois, f]));
    await p.evaluate(() => montrerVue("classement")); await p.waitForTimeout(1300);
    ok(!(await p.$(".mj-cache")), "une fois attrapé, il ne revient plus de la journée" + tag);
    ok(!err.length, "0 erreur JS " + JSON.stringify(err) + tag);
    await ctx.close();
  }
  // aperçu admin : la chasse se joue dans la fenêtre (bouton d'aperçu), jamais un vrai geste
  { const req2 = []; const { ctx, p, err, req } = await page(b, { quand: "2026-11-25T10:00:00", session: { role: "admin" }, adminOn: true, jusqua: 202612,
      mj: c => { req2.push(c); return c.op === "apercu" ? Object.assign({ ok: true, mois: 202703, univers: "melbourne", type: "chasse", contenu: { ico: "🎲", titre: "Jeu d'essai", regle: ["Règle inventée."] }, recompense: { trophee: { ico: "🏆", nom: "Essai" }, titre: "Titre d'essai", objet: ["plaque", "cheshire"] }, apercu: true, jour: c.jour, fin: 31 },
        { message: c.geste ? "Geste d'aperçu inventé." : "", g: c.geste, etat: ETAT_M(c.geste ? { fait: true, chasse: null, tableau: [{ nom: "Toi (aperçu)", val: 1, txt: "1" }] } : { tableau: [{ nom: "Toi (aperçu)", val: 0, txt: "0" }] }) }) : { ok: false }; } });
    await allerCourse(p); await p.evaluate(async () => { apercuMJ(202703); await new Promise(r => setTimeout(r, 900)); });
    const bt = await p.evaluate(() => !!document.querySelector(".mj-apercu [data-mj-ap]"));
    await p.evaluate(() => document.querySelector(".mj-apercu [data-mj-ap]").click()); await p.waitForTimeout(800);
    const t = await p.evaluate(() => (document.querySelector(".mj-apercu .mj-fait") || {}).textContent || "");
    ok(!err.length && bt && /Geste d'aperçu inventé/.test(t) && !req.includes("mj:geste") && req2.some(c => c.op === "apercu" && c.geste && c.geste.onglet === "mois"), "aperçu de mars : l'objet s'attrape dans la fenêtre d'aperçu, aucune vraie demande de geste");
    await ctx.close(); }
  // le 1er avril : cérémonie (objectif commun manqué) et etatMiniJeu pour le meilleur
  { const { ctx, p, err } = await page(b, { quand: "2027-04-01T09:00:00", session: { role: "perso", nom: "Kévin" }, jusqua: 202703, mj: () => MJ_ETAT(202704, null, [FINI(202703, ["Kévin"], false)]) });
    await p.waitForTimeout(1500); await p.evaluate(() => document.querySelectorAll(".tuto, .revel:not(.mj-cer):not(.mj-rev)").forEach(x => x.remove())); await p.waitForTimeout(3600);
    const c = await p.evaluate(() => { const o = document.querySelector(".mj-cer"); return o ? { t: o.textContent, ok: !!o.querySelector(".mj-cer-commun.ok"), commun: !!o.querySelector(".mj-cer-commun") } : null; });
    await p.screenshot({ path: DOSSIER + "/mars-ceremonie.png" });
    const w = await p.evaluate(() => etatMiniJeu("melbourne", "Kévin"));
    ok(!err.length && c && c.commun && !c.ok && /manqué/.test(c.t) && w.meilleur.nom === "Kévin" && w.meilleur.txt === "Titre d'essai" && !w.gagne && !w.pourTous.length, "1/4 : cérémonie (objectif commun manqué) ; Kévin a le titre du mois mais pas le trophée " + JSON.stringify(w));
    await ctx.close(); }
  await b.close(); fin(ko);
})();
