/* Test (Théo, 26/11/2026) · page Course réordonnée, puce « 🔥 Chauffe », plus de schéma, règles sans doublon, Stand allégé, raccourci « 🏆 Vitrines »
   A. Ordre de la page Course, de haut en bas : la course (titre, piste, boutons), la rangée des mois, le classement, la courbe, les annonces
      (champion, attente, grille, fenêtre), le détail des points, le calendrier, le petit texte des règles, la carte postale (15/12/2026, 15/1/2027, 10/6/2027).
   B. Plus de schéma « Comment avance la course » sur la page Course (décembre compris) ; il reste dans la fiche « La course » des règles.
   C. La puce « 🔥 Chauffe » : seule puce en décembre ; en 2027, toujours en tête (janvier et juin), avant « janv. 27 » ; elle rouvre la course
      et le classement de la chauffe, avec « ne compte pas au championnat » et « grille de départ de janvier » ; plus de puce « Départ ».
   D. Règles en tuiles : pas de « Tout le détail » qui redit la fiche courte (Mois spéciaux, Bonus) ; tuile « 🗝️ Le trésor » aussi en aperçu
      admin « Tout afficher » (sans énigme) : contrôlé dans tregles-tuiles.js.
   E. Stand le 20/1/2027 (fenêtre ouverte pour février) : fenêtre et jours restants, cartes posées, carte du mois (piège, défi) sans la phrase
      d'ambiance, « Mes cartes » sans paragraphe (le « ? » ouvre la fiche Les cartes), pronostic et pole, « Prochainement » replié.
   F. « 🏆 Vitrines » au titre des deux classements (onglet Classement et page Course) : ouvre MA fiche ; les pastilles changent de pilote ;
      le retour du téléphone ferme ; la ligne « Touche un pilote pour voir sa vitrine » disparaît après une fiche ouverte ; 390 px sans débordement.
   Fausses données uniquement (serveur Google intercepté, pilotes inventés de tregles-tuiles.js). 0 erreur JS. Captures 390 px clair et sombre.
   Serveur local : python3 -m http.server 8771 &  puis  node outils-tests/tcourse2.js   (PORT=…, API_VERSUS=…, CAPTURES=…) */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "course2");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const API = fs.readFileSync(process.env.API_VERSUS || __dirname + "/../../app_scripts/versus/API.js", "utf8");
const masquer = eval("(" + API.match(/function vsMasquerMontants_\(o, nomMoi\) \{[\s\S]*?\n\}\n/)[0].replace("function vsMasquerMontants_", "function") + ")");
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
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
  const rep = donnees("Théo", o.jusqua);
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tickets" ? { ok: true, ouvert: false } : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : rep) }); });
  await p.addInitScript(o => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.bullePortrait", "1");
    localStorage.setItem("versus.saison1", "1"); localStorage.setItem("versus.chauffe1", "1"); localStorage.setItem("versus.ecurieTeaser", "1"); localStorage.setItem("versus.chauffeFete", "202612");
    if (o.ficheVue) localStorage.setItem("versus.ficheVue", "1");
    ["2026", "2027"].forEach(y => { localStorage.setItem("versus.gpVu." + y, y + "12"); localStorage.setItem("versus.baVu." + y, y + "12"); }); }, { ficheVue: !!o.ficheVue });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  await nettoie(p);
  return { ctx, p, err };
}
const w = (p, t) => p.waitForTimeout(t);
const nettoie = p => p.evaluate(() => { document.querySelectorAll(".revel, .regles, .tuto, .ba, .av-ov, .af3d, .fc-voile, .bulle-portrait").forEach(x => x.remove()); document.documentElement.classList.remove("fige"); });
const podium = (p, o, y) => p.evaluate(async ([o, y]) => { if (y) choisirSaison(y); ETAT.podium = o; GP_ETAPE = null; GP_CHAUFFE = false; garder(); allerA("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 900));
  document.querySelectorAll(".revel, .regles, .tuto, .ba, .av-ov, .af3d, .fc-voile, .bulle-portrait").forEach(x => x.remove()); document.documentElement.classList.remove("fige"); await new Promise(r => setTimeout(r, 400)); }, [o, y || 0]);
/** l'ordre des blocs de la page Course (enfants directs de .s-corps), par famille */
const ORDRE = ["course", "mois", "classement", "courbe", "annonces", "detail", "calendrier", "regles", "postale"];
const blocs = p => p.evaluate(() => {
  const c = document.querySelector("#v-trophees .s-corps"); if (!c) return null;
  const fam = e => e.matches(".gp-h, .gp-piste, .gp-vues2, .mj-carte, .gp-tablette, .gp-enigme, .gp-tresor-appel") ? "course" : e.matches(".gp-mois") ? "mois" : e.matches(".gp-lh, .aide-vitr, .gp-liste") ? "classement"
    : e.matches(".pts-courbe") ? "courbe" : e.matches(".bref, .gp-depart, .gp-stand") ? "annonces" : e.matches("#pts-det") ? "detail" : e.matches("#gp-calend") ? "calendrier"
    : e.matches("p.info") && e.querySelector(".lien-regles") ? "regles" : e.matches(".gp-carte") ? "postale" : "? " + e.tagName + "." + e.className;
  const l = [...c.children].filter(e => getComputedStyle(e).display !== "none").map(fam); return l.filter((x, i) => x !== l[i - 1]); });
const enOrdre = l => !!l && l.every(x => ORDRE.includes(x)) && l.every((x, i) => !i || ORDRE.indexOf(x) > ORDRE.indexOf(l[i - 1]));
const puces = p => p.evaluate(() => [...document.querySelectorAll("#v-trophees .gp-mois button")].map(b => ({ t: b.textContent.trim(), on: b.getAttribute("aria-pressed") === "true", ch: b.hasAttribute("data-gpch") })));
const capture = async (p, nom) => { for (const sch of ["light", "dark"]) { await p.emulateMedia({ colorScheme: sch }); await w(p, 350); await p.screenshot({ path: DOSSIER + "/" + nom + "-" + (sch === "light" ? "clair" : "sombre") + ".png", fullPage: true }); } await p.emulateMedia({ colorScheme: "light" }); };
const deborde = p => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);

(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  /* ---------- A, B, C : la page Course ---------- */
  for (const cas of [{ tag: "15/12/2026", quand: "2026-12-15T10:00:00", jusqua: 202611, cap: "course-2026-12-15" }, { tag: "15/1/2027", quand: "2027-01-15T10:00:00", jusqua: 202612, cap: "course-2027-01-15" }, { tag: "10/6/2027", quand: "2027-06-10T10:00:00", jusqua: 202705 }]) {
    const { ctx, p, err } = await page(b, cas);
    await podium(p, "gp", cas.tag === "15/12/2026" ? 0 : 2027);
    const l = await blocs(p), pu = await puces(p);
    ok(enOrdre(l), cas.tag + " : ordre de la page Course " + JSON.stringify(l));
    const sch = await p.evaluate(() => ({ s: document.querySelectorAll("#v-trophees .gp-schema").length, t: /Comment avance la course/.test(document.querySelector("#v-trophees").textContent) }));
    ok(!sch.s && !sch.t, cas.tag + " : pas de schéma « Comment avance la course » " + JSON.stringify(sch));
    ok(!pu.some(x => /Départ/.test(x.t)), cas.tag + " : plus de puce « Départ » " + JSON.stringify(pu.map(x => x.t)));
    if (cas.tag === "15/12/2026") ok(pu.length === 1 && pu[0].t === "🔥 Chauffe" && pu[0].on, "15/12/2026 : une seule puce, « 🔥 Chauffe » " + JSON.stringify(pu));
    else ok(pu[0] && pu[0].t === "🔥 Chauffe" && pu[0].ch && !pu[0].on && /janv\. 27/.test((pu[1] || {}).t || ""), cas.tag + " : « 🔥 Chauffe » en tête, avant « janv. 27 » " + JSON.stringify(pu.map(x => x.t)));
    if (cas.tag === "10/6/2027") { await p.evaluate(() => [...document.querySelectorAll("#v-trophees .gp-mois [data-gpe]")].find(x => /mai 27/.test(x.textContent)).click()); await w(p, 1200); await nettoie(p);
      const lm = await blocs(p); ok(enOrdre(lm) && ["courbe", "detail", "postale"].every(x => lm.includes(x)) && lm[lm.length - 1] === "postale", "10/6/2027, mai (manche courue) : courbe, détail des points, carte postale tout en bas " + JSON.stringify(lm));
      await capture(p, "course-2027-06-10-mai"); }
    if (cas.cap) await capture(p, cas.cap);
    if (cas.tag !== "15/12/2026") {
      const avant = await p.evaluate(() => JSON.stringify(championnat(2027).tot));
      await p.click('#v-trophees .gp-mois [data-gpch]'); await w(p, 1200); await nettoie(p);
      const e = await p.evaluate(() => ({ sk: (document.querySelector("#v-trophees .gp-h .s-k") || {}).textContent || "", info: (document.querySelector("#v-trophees .gp-ch-info") || {}).textContent || "", lignes: document.querySelectorAll("#v-trophees .gp-liste .gp-l").length,
        onglet: saisonCourante(), titre: (document.querySelector("#v-trophees .gp-titre") || {}).textContent || "" }));
      const pu2 = await puces(p), l2 = await blocs(p);
      ok(/Tour de chauffe/.test(e.sk) && /décembre 2026/.test(e.sk) && e.lignes >= 4 && e.onglet === 2027, cas.tag + " : la puce Chauffe rouvre la course et le classement de la chauffe " + JSON.stringify(e));
      ok(/ne compte pas au championnat/.test(e.info) && /grille de départ de janvier/.test(e.info) && /pole/.test(e.info), cas.tag + " : « tour de chauffe : ne compte pas au championnat », sauf la grille de départ de janvier (pole) « " + e.info.trim() + " »");
      ok(pu2[0] && pu2[0].on && pu2.some(x => /janv\. 27/.test(x.t)), cas.tag + " : en chauffe, la rangée garde les mois de 2027 " + JSON.stringify(pu2.map(x => x.t + (x.on ? "*" : ""))));
      ok(enOrdre(l2), cas.tag + " : ordre de la page en chauffe " + JSON.stringify(l2));
      if (cas.cap) await capture(p, cas.cap + "-chauffe");
      await p.evaluate(() => [...document.querySelectorAll("#v-trophees .gp-mois [data-gpe]")].find(x => /janv\. 27/.test(x.textContent)).click()); await w(p, 1200); await nettoie(p);
      const e3 = await p.evaluate(() => ({ sk: document.querySelector("#v-trophees .gp-h .s-k").textContent, ch: GP_CHAUFFE, tot: JSON.stringify(championnat(2027).tot) }));
      ok(/Manche 1/.test(e3.sk) && !e3.ch && e3.tot === avant, cas.tag + " : retour sur « janv. 27 », points de 2027 inchangés " + JSON.stringify(e3.sk));
    }
    ok(!(await deborde(p)), cas.tag + " : 390 px sans débordement");
    ok(!err.length, cas.tag + " (Course) : 0 erreur JS " + JSON.stringify(err));
    await ctx.close();
  }
  /* ---------- D : pas de « Tout le détail » qui redit la fiche courte ---------- */
  for (const [tag, quand, jusqua] of [["5/12/2026", "2026-12-05T10:00:00", 202611], ["15/1/2027", "2027-01-15T10:00:00", 202612]]) {
    const { ctx, p, err } = await page(b, { quand, jusqua });
    await podium(p, "stand"); await p.click("#regles-ouvrir"); await w(p, 300);
    const r = await p.evaluate(() => { const mots = t => new Set((t.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []));
      return [...document.querySelectorAll(".regles .rgt-f")].map(f => { const c = f.querySelector(".rgt-court"), d = f.querySelector(".rgt-det"); if (!d) return { id: f.dataset.fiche, det: false };
        const dd = d.cloneNode(true); dd.querySelectorAll("summary, h4").forEach(x => x.remove()); d.open = true; const md = [...mots(dd.innerText || dd.textContent)], mc = mots(c.innerText);
        return { id: f.dataset.fiche, det: true, nouveau: md.filter(m => !mc.has(m)).length / Math.max(1, md.length) }; }); });
    const doubles = r.filter(x => x.det && x.nouveau < 0.1);
    ok(!doubles.length, tag + " : aucun « Tout le détail » qui redit la fiche courte " + JSON.stringify(r.map(x => x.id + (x.det ? ":" + Math.round(x.nouveau * 100) + "%" : ":-"))));
    if (tag === "15/1/2027") ok(["speciaux", "bonus"].every(id => r.some(x => x.id === id && !x.det)), "15/1/2027 : Mois spéciaux et Bonus sans « Tout le détail »");
    ok(!err.length, tag + " (règles) : 0 erreur JS " + JSON.stringify(err)); await ctx.close();
  }
  /* ---------- E : le Stand allégé ---------- */
  for (const [tag, quand, jusqua, y, nom] of [["20/1/2027", "2027-01-20T10:00:00", 202612, 2027, "stand-2027-01-20"], ["22/12/2026", "2026-12-22T10:00:00", 202611, 2027, "stand-2026-12-22"]]) {
    const { ctx, p, err } = await page(b, { quand, jusqua });
    await podium(p, "stand", y);
    const s = await p.evaluate(() => { const v = document.querySelector("#v-trophees"), h = [...v.querySelectorAll("h3.s-h3")].find(x => /^Mes cartes/.test(x.textContent));
      const apresH = h && h.parentElement.nextElementSibling, pole = v.querySelector("#prono-pole"), bt = v.querySelector(".bientot-det"), st = v.querySelector(".st-gp small");
      return { fen: (v.querySelector(".st-etat .st-h") || {}).textContent || "", pel: !!v.querySelector(".st-pel"), rm: (v.querySelector(".regles-mois") || {}).textContent || "", pg: !!v.querySelector(".regles-mois .rm-pg"), df: /Défi du mois/.test((v.querySelector(".regles-mois") || {}).textContent || ""),
        stgp: st ? st.textContent : "", apresH: apresH ? apresH.className : "", qr: !!(h && h.querySelector(".qr")), cartes: v.querySelectorAll(".main-cartes .carte").length, prono: !!v.querySelector(".prono, #prono-pole, [id^=prono]"),
        poleBas: pole ? Math.round(pole.getBoundingClientRect().bottom + scrollY) : null, bientot: bt ? { ouvert: bt.open } : null, vieuxBientot: !!v.querySelector(":scope .s-corps > .bientot") }; });
    if (tag === "20/1/2027") {
      ok(/Fenêtre ouverte/.test(s.fen) && /février 2027/.test(s.fen) && /il reste \d+ jours|dernier jour/.test(s.fen) && s.pel, tag + " : en haut, « Fenêtre ouverte · il reste N jours » et les cartes posées « " + s.fen.trim() + " »");
      ok(s.pg && s.df && /Février 2027|février 2027/i.test(s.rm), tag + " : la carte du mois de février : piège et défi");
      ok(!/escaliers|couloirs se referment/.test(s.stgp), tag + " : plus de phrase d'ambiance de l'univers (« " + s.stgp + " »)");
      ok(s.apresH === "main-cartes" && s.qr && s.cartes >= 4, tag + " : « Mes cartes » sans paragraphe d'explication, le « ? » est là (" + s.apresH + ")");
      ok(s.prono && s.poleBas !== null, tag + " : pronostic et pole gardés (bas de la pole à " + s.poleBas + " px)");
      ok(s.poleBas !== null && s.poleBas < 844 * 3.2, tag + " : tout l'utile (fenêtre → pole) tient en ~3 écrans de 390 × 844 (" + s.poleBas + " px)");
      await p.evaluate(() => { const q = [...document.querySelectorAll("#v-trophees h3.s-h3")].find(x => /^Mes cartes/.test(x.textContent)).querySelector(".qr"); q.scrollIntoView({ block: "center" }); q.click(); }); await w(p, 300);
      const f = await p.evaluate(() => { const o = document.querySelector(".regles"), x = o && [...o.querySelectorAll(".rgt-f")].find(z => !z.hidden); return x ? x.dataset.fiche : ""; });
      ok(f === "cartes", tag + " : le « ? » de « Mes cartes » ouvre la fiche « Les cartes » (" + f + ")"); await nettoie(p);
    }
    ok(!s.vieuxBientot && (!s.bientot || s.bientot.ouvert === false), tag + " : « Prochainement » replié, fermé par défaut " + JSON.stringify(s.bientot));
    await capture(p, nom + "-apres");
    ok(!(await deborde(p)), tag + " (Stand) : 390 px sans débordement");
    ok(!err.length, tag + " (Stand) : 0 erreur JS " + JSON.stringify(err)); await ctx.close();
  }
  /* ---------- F : 🏆 Vitrines ---------- */
  for (const [tag, quand, jusqua] of [["15/12/2026", "2026-12-15T10:00:00", 202611], ["15/1/2027", "2027-01-15T10:00:00", 202612]]) {
    const { ctx, p, err } = await page(b, { quand, jusqua });
    await p.evaluate(async () => { allerA("classement"); await new Promise(r => setTimeout(r, 800)); }); await nettoie(p);
    const c0 = await p.evaluate(() => { const bt = document.querySelector("#v-classement #vers-fiches"), h = bt && bt.closest("h2"); const r = bt && bt.getBoundingClientRect(), rh = h && h.getBoundingClientRect();
      return { bt: bt ? bt.textContent.trim() : "", droite: !!(r && rh && r.right > rh.right - 4 && r.left > rh.left + rh.width / 2), aide: (document.querySelector("#v-classement .aide-vitr") || {}).textContent || "" }; });
    ok(c0.bt === "🏆 Vitrines" && c0.droite, tag + " : Classement : « 🏆 Vitrines » en haut à droite du titre " + JSON.stringify(c0));
    ok(/Touche un pilote pour voir sa vitrine/.test(c0.aide), tag + " : Classement : la ligne « Touche un pilote pour voir sa vitrine »");
    if (tag === "15/1/2027") { await p.evaluate(() => document.querySelector("#v-classement").scrollIntoView()); await capture(p, "vitrines-classement-2027-01-15"); }
    await p.click("#v-classement #vers-fiches"); await w(p, 700); await nettoie(p);
    const f1 = await p.evaluate(() => ({ vue: vueActive(), fiche: ETAT.fiche, puces: [...document.querySelectorAll("#v-fiche .chips [data-fiche]")].map(b => b.dataset.fiche), on: (document.querySelector('#v-fiche .chips [aria-pressed="true"]') || {}).textContent || "", montant: /\d\s?€/.test(document.querySelector("#v-fiche").innerText.replace(/Théo[\s\S]*/, "")) }));
    ok(f1.vue === "fiche" && f1.fiche === "Théo" && /Théo/.test(f1.on), tag + " : « 🏆 Vitrines » ouvre MA fiche " + JSON.stringify([f1.vue, f1.fiche, f1.on]));
    ok(f1.puces.length === 5, tag + " : la fiche a la rangée des pilotes (" + f1.puces.join(", ") + ")");
    await p.click('#v-fiche .chips [data-fiche="Kévin"]'); await w(p, 500);
    const f2 = await p.evaluate(() => ({ fiche: ETAT.fiche, on: (document.querySelector('#v-fiche .chips [aria-pressed="true"]') || {}).textContent || "", d: document.documentElement.scrollWidth > innerWidth + 1 }));
    ok(f2.fiche === "Kévin" && /Kévin/.test(f2.on) && !f2.d, tag + " : une pastille passe à la vitrine de Kévin, sans débordement");
    await p.evaluate(() => history.back()); await w(p, 700);
    ok(await p.evaluate(() => vueActive() !== "fiche"), tag + " : le retour du téléphone ferme la fiche (" + await p.evaluate(() => vueActive()) + ")");
    await p.evaluate(async () => { allerA("classement"); await new Promise(r => setTimeout(r, 600)); });
    ok(await p.evaluate(() => !document.querySelector("#v-classement .aide-vitr")), tag + " : la ligne d'aide disparaît après une fiche ouverte");
    await ctx.close();
    // page Course
    const P2 = await page(b, { quand, jusqua });
    await podium(P2.p, "gp", tag === "15/12/2026" ? 0 : 2027);
    const g0 = await P2.p.evaluate(() => { const h = document.querySelector("#v-trophees .gp-lh"), bt = h && h.querySelector(".vers-fiches"); const r = bt && bt.getBoundingClientRect(), rh = h && h.getBoundingClientRect();
      return { titre: h ? h.querySelector("b").textContent : "", bt: bt ? bt.textContent.trim() : "", droite: !!(r && rh && r.right > rh.right - 4), aide: !!document.querySelector("#v-trophees .aide-vitr"), avantListe: !!(h && h.nextElementSibling && (h.nextElementSibling.matches(".gp-liste") || h.nextElementSibling.matches(".aide-vitr"))) }; });
    ok(g0.titre === "Classement" && g0.bt === "🏆 Vitrines" && g0.droite && g0.aide && g0.avantListe, tag + " : page Course : « 🏆 Vitrines » en haut à droite du titre du classement " + JSON.stringify(g0));
    await P2.p.evaluate(() => document.querySelector("#v-trophees .gp-lh .vers-fiches").scrollIntoView({ block: "center" })); await w(P2.p, 200);
    await P2.p.click("#v-trophees .gp-lh .vers-fiches"); await w(P2.p, 700); await nettoie(P2.p);
    const g1 = await P2.p.evaluate(() => ({ vue: vueActive(), fiche: ETAT.fiche, retour: !!document.querySelector("#fiche-retour") }));
    ok(g1.vue === "fiche" && g1.fiche === "Théo" && g1.retour, tag + " : depuis la Course, ma fiche, avec « ‹ Retour au Podium » " + JSON.stringify(g1));
    await P2.p.evaluate(() => history.back()); await w(P2.p, 700);
    ok(await P2.p.evaluate(() => vueActive() === "trophees"), tag + " : le retour du téléphone ramène à la Course");
    ok(!(await deborde(P2.p)), tag + " (Vitrines) : 390 px sans débordement");
    ok(!err.length && !P2.err.length, tag + " (Vitrines) : 0 erreur JS " + JSON.stringify(err.concat(P2.err)));
    await P2.ctx.close();
  }
  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI. Captures : " + DOSSIER);
  process.exit(ko.length ? 1 : 0);
})();
