/* Test (v21.11) · la livrée sur le NOM SEUL, le halo des Flammes, la ligne « ce que les autres voient » de l'Écurie, et le même profil partout hors course.
   Fausses données uniquement (serveur Google intercepté). Serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tlivree-nom.js   (PORT=…, CAPTURES=…)
   Vérifie, le 26/11/2026 et le 5/12/2026, en clair et en sombre, à 390 px :
   - classement de l'accueil, liste « Classement » du Podium, grille et carte de l'Écurie : la livrée est sur un <span class="lv"> qui ne contient que le nom (ni couronne, ni « (moi) », ni badge) ;
   - le Bicolore se coupe au même endroit du nom même dans une boîte étroite ; le halo des Flammes est fin (2px) ;
   - Podium (liste Classement) : le profil de l'écurie (avatar, casque si « Mon casque »), comme au classement de l'accueil ;
   - EN COURSE (pastilles de la carte 2D/3D, voiture suivie, portraits) : le visage + l'accessoire du mois, jamais le casque ni le fond de l'écurie ;
   - Écurie : la ligne « Ce que les autres voient au classement » ; le mot « bonnet » seulement à partir du 1/12 ;
   - 0 erreur JS, pas de défilement horizontal. */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "livree-nom");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
const lignes = i => [ligne(202609, 1000, 0.01), ligne(202610, 1010, 0.004 + i / 1000), ligne(202611, 1020, 0.002 + i / 700)];
/** écuries INVENTÉES (Nicolas n'a rien choisi) */
const ECU = {
  "Théo": { equip: { livree: "flammes", fond: "damier", casque: "damier", pilote: "casque", numero: 7 } },
  "Clément": { equip: { livree: "bicolore", fond: "carbone", numero: 3 } },
  "Kévin": { equip: { livree: "or", fond: "etoile", numero: 44 } },
  "Devlin": { equip: { livree: "chrome", fond: "degrade", numero: 16 } }
};
const donnees = session => ({ ok: true, version: 103, genere: "2026-11-26T20:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: NOMS.map((n, i) => ({ nom: n, rows: lignes(i) })),
  marche: { indices: ["S&P 500"], mois: [[202609, 0.01], [202610, 0.005], [202611, 0.003]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: ECU, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });

const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
const nettoyer = () => document.querySelectorAll(".ecu-rev, .revel, .regles, .tuto, .bulle-portrait, .ba, .av-ov, .av-case, .ere-voile, .ecu-bandeau, .toast").forEach(x => x.remove());

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  for (const [quand, jour] of [["2026-11-26T21:30:00+01:00", "26-11"], ["2026-12-05T10:00:00+01:00", "05-12"]]) for (const sombre of [false, true]) {
    const tag = " (" + jour + (sombre ? ", sombre)" : ", clair)"), suf = jour + (sombre ? "-sombre" : "-clair");
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: sombre ? "dark" : "light", timezoneId: "Europe/Paris", deviceScaleFactor: 2 });
    const p = await ctx.newPage(), err = [];
    p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) err.push(m.text()); });
    await p.clock.setFixedTime(new Date(quand));
    await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
      r.fulfill({ contentType: "application/json", body: JSON.stringify(["tresors", "tickets", "avent"].includes(c.action) ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "ecurie" ? { ok: true } : donnees({ role: "perso", nom: "Théo" })) }); });
    await p.addInitScript(th => { if (sessionStorage.getItem("init")) return; sessionStorage.setItem("init", "1");
      ["versus.tuto1", "versus.bullePortrait", "versus.chauffe1", "versus.chauffeFete", "versus.saison1", "versus.ecurieTeaser", "versus.exclVus", "versus.ecuBandeau", "versus.q3dAffichette"].forEach(k => localStorage.setItem(k, k === "versus.exclVus" ? "[]" : "1"));
      localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.theme", th); }, sombre ? "dark" : "light");
    await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
    await p.waitForTimeout(2500);
    // Or et Chrome ne sont pas des objets de départ : pour les voir sur un nom, on les « débloque » ici (test seulement)
    await p.evaluate(nt => { (0, eval)("(" + nt + ")")(); const tout = new Set(SLOTS.flatMap(([s]) => idsSlot(s).map(id => s + "." + id)).concat(["livree.chrome", "livree.or"])); window.debloques = () => tout; MERITE = null; allerA("classement"); rendreVue("classement"); }, nettoyer.toString());
    await p.waitForTimeout(800);

    // 1. classement de l'accueil
    const cl = await p.evaluate(() => [...document.querySelectorAll(".tour .pos:not(.ghost)")].map(x => { const b = x.querySelector(".who b"), s = b.querySelector("span.lv"), cs = s && getComputedStyle(s);
      return { nom: x.dataset.nom, bLv: /\blv\b/.test(b.className), lv: s ? s.className : "", txt: s ? s.textContent : "", seul: s ? !s.querySelector("*") : true, disp: cs ? cs.display : "", pr: cs ? cs.paddingRight : "", ts: cs ? cs.textShadow : "",
        fond: (x.querySelector(".av") || {}).className || "", casque: !!x.querySelector(".av svg.casque") }; }));
    const parNom = n => cl.find(x => x.nom === n) || {};
    ok(cl.length === 5 && cl.every(x => !x.bLv) && ["Théo", "Clément", "Kévin", "Devlin"].every(n => parNom(n).txt === n && parNom(n).seul && parNom(n).disp === "inline-block") && !/lv/.test(parNom("Nicolas").lv),
      "classement : la livrée est sur le nom seul (span.lv inline-block, sans couronne ni « (moi) »)" + tag + " " + JSON.stringify(cl.map(x => [x.nom, x.lv, x.txt])));
    ok(/lv-flammes/.test(parNom("Théo").lv) && /0px 0px 2px/.test(parNom("Théo").ts) && !/6px/.test(parNom("Théo").ts), "Flammes : halo fin de 2px" + tag + " " + parNom("Théo").ts);
    ok(parseFloat(parNom("Clément").pr) > 1, "dernière lettre en italique non rognée : marge à droite du nom " + parNom("Clément").pr + tag);
    ok(/av-damier/.test(parNom("Théo").fond) && parNom("Théo").casque && /av-carbone/.test(parNom("Clément").fond), "classement : fond Avatar et casque de l'écurie" + tag);
    const tour = p.locator(".tour").first(); await tour.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await tour.screenshot({ path: DOSSIER + "/classement-" + suf + ".png", animations: "disabled" });

    // 2. le Bicolore se coupe toujours au même endroit, même dans une boîte étroite
    const bi = await p.evaluate(async () => { const pos = document.querySelector('.tour .pos[data-nom="Clément"]'), s = pos.querySelector(".who b span.lv"), w0 = s.getBoundingClientRect().width;
      pos.querySelector(".who").style.maxWidth = "150px"; pos.querySelector(".who > div").style.width = "70px"; await new Promise(r => setTimeout(r, 100)); const w1 = s.getBoundingClientRect().width;
      pos.querySelector(".who").style.maxWidth = ""; pos.querySelector(".who > div").style.width = "300px"; await new Promise(r => setTimeout(r, 100)); const w2 = s.getBoundingClientRect().width;
      pos.querySelector(".who > div").style.width = "70px";
      return { w0: +w0.toFixed(1), w1: +w1.toFixed(1), w2: +w2.toFixed(1) }; });
    ok(bi.w0 > 20 && Math.abs(bi.w0 - bi.w1) < 0.6 && Math.abs(bi.w0 - bi.w2) < 0.6, "Bicolore : même largeur de dégradé (donc même coupure) en boîte normale, étroite et large " + JSON.stringify(bi) + tag);
    await p.locator('.tour .pos[data-nom="Clément"]').screenshot({ path: DOSSIER + "/bicolore-boite-etroite-" + suf + ".png", animations: "disabled" });
    await p.evaluate(() => rendreVue("classement"));

    // 3. Podium : la liste Classement (profil de l'écurie) et la course (visage + accessoire du mois)
    await p.evaluate(async nt => { (0, eval)("(" + nt + ")")(); ETAT.podium = "gp"; ETAT.gp2d = "1"; GP_ETAPE = null; garder(); allerA("trophees"); rendreTrophees(); await new Promise(r => setTimeout(r, 2500)); (0, eval)("(" + nt + ")")(); }, nettoyer.toString());
    await p.waitForTimeout(1500);
    const po = await p.evaluate(() => {
      const L = [...document.querySelectorAll(".gp-l")].map(x => { const n = x.querySelector("[data-gp-fiche]").dataset.gpFiche, s = x.querySelector(".gp-nom span.lv");
        return { n, av: x.querySelector(":scope > .av").className, casque: !!x.querySelector(":scope > .av svg.casque"), lv: s ? s.className : "", txt: s ? s.textContent : "", seul: s ? !s.querySelector("*") : true }; });
      const course = [...document.querySelectorAll(".gp-t3 .av, .gp-suivi .av, .p2-portrait .av, .gpp-tour .av")];
      const acc = accessoireDuMois();
      return { L, acc, nCourse: course.length, casqueCourse: course.filter(a => a.querySelector("svg.casque")).length, fondCourse: course.filter(a => !a.classList.contains("av-couleur")).length,
        sansTete: course.filter(a => !a.classList.contains("av-tete")).length, avecAcc: acc ? course.filter(a => a.querySelector(".t-acc-" + acc)).length : 0,
        deb: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    const th = po.L.find(x => x.n === "Théo") || {}, cm = po.L.find(x => x.n === "Clément") || {};
    ok(po.L.length === 5 && /av-damier/.test(th.av) && th.casque && /av-carbone/.test(cm.av) && !cm.casque, "Podium, liste Classement : le profil de l'écurie, comme à l'accueil (Théo : avatar Damier + casque ; Clément : avatar Carbone)" + tag + " " + JSON.stringify(po.L.map(x => [x.n, x.av, x.casque])));
    ok(po.L.filter(x => x.lv).every(x => x.txt === x.n && x.seul) && /lv-bicolore/.test(cm.lv), "Podium : la livrée sur le nom seul (pas sur « › »)" + tag);
    ok(po.nCourse >= 5 && !po.casqueCourse && !po.fondCourse && !po.sansTete && (po.acc ? po.avecAcc === po.nCourse : true),
      "en course : visage + accessoire du mois (" + (po.acc || "aucun avant le 1/12") + "), jamais le casque ni le fond de l'écurie " + JSON.stringify(po) + tag);
    ok(jour === "05-12" ? po.acc === "noel" : po.acc === null, "accessoire du mois : " + po.acc + tag);
    await p.evaluate(() => { const l = document.querySelector(".gp-lh"); if (l) l.scrollIntoView({ block: "start" }); });
    await p.waitForTimeout(400); await p.screenshot({ path: DOSSIER + "/podium-classement-" + suf + ".png", animations: "disabled" });
    await p.evaluate(() => { const l = document.querySelector("#gp-piste"); if (l) l.scrollIntoView({ block: "start" }); });
    await p.waitForTimeout(600); await p.screenshot({ path: DOSSIER + "/podium-course-" + suf + ".png", animations: "disabled" });

    // 4. Écurie : la ligne « ce que les autres voient », la grille et la carte
    const ec = await p.evaluate(async () => { ETAT.podium = "ecurie"; ECU = null; garder(); rendreTrophees(); await new Promise(r => setTimeout(r, 900));
      const a = document.querySelector("#v-trophees .ecu-vu"), g = [...document.querySelectorAll(".gr-l b")].map(b => { const s = b.querySelector("span.lv"); return { lvB: /\blv\b/.test(b.className), txt: s ? s.textContent : b.textContent }; });
      const sr = document.querySelector(".sr-nm b"), r = a && a.getBoundingClientRect();
      return { t: a ? a.innerText : "", vis: !!(r && r.width > 0), g, sr: sr ? { lvB: /\blv\b/.test(sr.className), lv: (sr.querySelector("span.lv") || {}).className || "" } : null, toutT: document.querySelector("#v-trophees").innerText,
        deb: document.documentElement.scrollWidth > innerWidth + 1 }; });
    ok(ec.vis && /Ce que les autres voient au classement/.test(ec.t) && /avatar/.test(ec.t) && /livrée sur ton nom/.test(ec.t) && /Mon casque/.test(ec.t), "Écurie : la ligne « Ce que les autres voient au classement » " + JSON.stringify(ec.t) + tag);
    ok(jour === "05-12" ? /bonnet de Noël/.test(ec.t) : !/bonnet|Noël/i.test(ec.toutT) && /1er décembre/.test(ec.t), "Écurie : le bonnet n'est nommé qu'à partir du 1/12" + tag);
    ok(ec.g.length === 5 && ec.g.every(x => !x.lvB) && ec.sr && !ec.sr.lvB && /lv-flammes/.test(ec.sr.lv), "Écurie : grille et carte, la livrée sur le nom seul" + tag + " " + JSON.stringify(ec.sr));
    await p.evaluate(() => { const l = document.querySelector(".ecu-vu"); if (l) l.scrollIntoView({ block: "center" }); });
    await p.waitForTimeout(400); await p.screenshot({ path: DOSSIER + "/ecurie-aide-" + suf + ".png", animations: "disabled" });
    await p.evaluate(() => { const l = document.querySelector(".grille-dep"); if (l) l.scrollIntoView({ block: "start" }); });
    await p.waitForTimeout(400); await p.screenshot({ path: DOSSIER + "/ecurie-grille-" + suf + ".png", animations: "disabled" });

    // 5. vitrine (fiche) : le nom avec sa livrée
    const vt = await p.evaluate(async () => { try { ouvrirFicheDe("Clément"); } catch (e) { } await new Promise(r => setTimeout(r, 900)); const s = document.querySelector(".f-tete-n > span:first-child"); return s ? { c: s.className, t: s.textContent } : null; });
    ok(!vt || (/lv-bicolore/.test(vt.c) && vt.t === "Clément"), "vitrine : la livrée sur le nom seul " + JSON.stringify(vt) + tag);

    ok(!err.length && !po.deb && !ec.deb, "0 erreur JS, pas de défilement horizontal" + tag + " " + JSON.stringify(err.slice(0, 3)));
    await ctx.close();
  }
  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); console.log("Captures : " + DOSSIER);
  process.exit(ko.length ? 1 : 0);
})();
