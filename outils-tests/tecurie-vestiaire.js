/* Test (v20.96) · Écurie sur le modèle du Vestiaire de Moi (Théo, 26/11) : carte de la F1 (nom, numéro, « N / total objets »), pastilles des catégories
   (3 par ligne, émoji, nom, compteur), grille des objets de la catégorie choisie (4 par ligne). Remplace tecurie-etageres.js (rangées qui défilent de côté, v20.94).
   Fausses données uniquement (serveur Google intercepté). Serveur local : python3 -m http.server 8771 &  puis  node outils-tests/tecurie-vestiaire.js  (PORT=…, CAPTURES=…)
   Vérifie : pastilles = toutes les catégories (rien en dur : SLOTS + Pilote, Numéro, Badges), compteurs justes, la choisie en blanc, une seule grille de 4 colonnes,
   dernière catégorie mémorisée (et rien ne casse si la mémoire du téléphone est bloquée) ; toucher = essai sur la F1 sans envoi, ✓ et cadre ; 🎨 sous la grille ;
   objets 🔒 « Comment l'obtenir » ; bulles sous l'objet (colonne de gauche et de droite) ; badges 📌 ; 🤏 zoom ; Pilote, Numéro ; 🎲, ↩️, 💾 Enregistrer, bandeau collant,
   rappel en quittant ; échec du serveur → retour à l'état d'avant ; ✨ nouveautés : pastille marquée et en tête, grille ouverte dessus ; « Équiper maintenant » ouvre la
   bonne catégorie et met l'objet en évidence ; rien de 2027 avant le 1/1 ; garage d'un autre en lecture seule ; catégories et objets au premier écran en janvier ;
   une seule voiture 3D ; processeur ×4 : toucher et changer de catégorie sous 0,4 s ; 0 erreur JS ; 390 px clair et sombre. */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "ecurie-vestiaire");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
const lignes = (n, i) => n === "Nicolas" ? [ligne(202612, 1000, 0)] : [ligne(202611, 1000, 0.01), ligne(202612, 1010, 0.004 + i / 1000)];
const donnees = (session, ecurie) => ({ ok: true, version: 91, genere: "2026-12-02T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: NOMS.map((n, i) => ({ nom: n, rows: lignes(n, i) })),
  marche: { indices: ["S&P 500"], mois: [[202611, 0.01], [202612, 0.005]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: ecurie || {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
const TRESORS = { ok: true, tresors: [{ circuit: "abudhabi", saison: 2026, mois: 12, chercheurs: [{ nom: "Kévin", j: 20261205 }, { nom: "Clément", j: 20261207 }] }], trouves: [], total: 0 };
async function page(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light" });
  const p = await ctx.newPage(), err = [], envois = [], S = { ecurie: { "Kévin": { equip: { casque: "damier", numero: 44 } } } };
  p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error") err.push(m.text()); });
  await p.clock.setFixedTime(new Date(o.quand));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    if (c.action === "ecurie" && o.refuse) { envois.push(c.equip); return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: false, message: "Refusé par le serveur (test)." }) }); }
    if (c.action === "ecurie") { envois.push(c.equip); S.ecurie[c.personne] = { equip: c.equip }; return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, ecurie: S.ecurie }) }); }
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tresors" ? TRESORS : c.action === "tickets" || c.action === "avent" ? { ok: true } : donnees({ role: "perso", nom: "Kévin" }, S.ecurie)) }); });
  await p.addInitScript(() => { if (sessionStorage.getItem("init")) return; sessionStorage.setItem("init", "1");
    ["versus.tuto1", "versus.bullePortrait", "versus.chauffe1", "versus.chauffeFete", "versus.saison1", "versus.ecurieTeaser", "versus.q3dAffichette"].forEach(k => localStorage.setItem(k, "1")); localStorage.setItem("versus.exclVus", "[]"); localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.gpVu.2026", "202612"); });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
  await p.evaluate(async () => { if (typeof chargerTresors === "function") { TRESORS = null; TRESORS_T = 0; try { await chargerTresors(); } catch (e) { } } });
  await p.waitForTimeout(1200);
  return { ctx, p, err, envois };
}
const nettoyer = "document.querySelectorAll('.ecu-rev, .revel, .regles, .tuto, .bulle-portrait, .ba, .av-ov, .av-case, .ere-voile, .mj-rev, .cn-rev, .af3d').forEach(x => x.remove())";
const ouvrirEcurie = p => p.evaluate(async n => { eval(n); ETAT.podium = "ecurie"; ECU = null; ECU_SLOT = ""; ECU_Q = null; ECU_NOUV = null; garder(); allerA("trophees"); rendreTrophees(); scrollTo(0, 0); await new Promise(r => setTimeout(r, 700)); }, nettoyer);
const ouvrirCat = (p, s) => p.evaluate(async s => { const b = document.querySelector('#v-trophees [data-ecu-cat="' + s + '"]'); if (!b) return false; b.click(); await new Promise(r => setTimeout(r, 300)); return true; }, s);
const pastilles = p => p.evaluate(() => [...document.querySelectorAll("#v-trophees .ecu-cats [data-ecu-cat]")].map(x => x.dataset.ecuCat).join());
const deborde = p => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", suf = sombre ? "-sombre" : "-clair";
    // 1. 2 janvier 2027 : la carte de la F1, les pastilles, une grille
    { const { ctx, p, err, envois } = await page(b, { quand: "2027-01-02T10:00:00", sombre });
      await ouvrirEcurie(p);
      const a = await p.evaluate(() => { const pas = [...document.querySelectorAll("#v-trophees .ecu-cats [data-ecu-cat]")], ouv = debloques("Kévin"), cs = getComputedStyle(document.querySelector(".ecu-cats"));
        const sr = document.querySelector(".showroom"), txt = sr.innerText;
        return { cats: pas.map(x => x.dataset.ecuCat), attendu: rangsEcurie().map(x => x[0]), colsPastilles: cs.gridTemplateColumns.split(" ").length,
          compteurs: SLOTS.every(([s]) => { const x = pas.find(y => y.dataset.ecuCat === s), l = idsSlot(s); return x && x.querySelector("small").textContent === l.filter(id => ouv.has(s + "." + id)).length + " / " + l.length; }),
          emojis: pas.every(x => /^\S+\s\S/.test(x.querySelector("b").textContent)), choisie: pas.filter(x => x.getAttribute("aria-pressed") === "true").map(x => x.dataset.ecuCat),
          grilles: document.querySelectorAll("#v-trophees .etageres .eta").length, cols: (document.querySelector(".eta-g") ? getComputedStyle(document.querySelector(".eta-g")).gridTemplateColumns.split(" ").length : 0),
          ouverte: (document.querySelector(".etageres .eta") || { dataset: {} }).dataset.ecuSlot, nom: /KÉVIN|Kévin/i.test(txt), numero: /#44/.test(txt), objets: /\d+\s*\/\s*\d+\s*objets/.test(txt.replace(/\n/g, " ")),
          onglets: !!document.querySelector(".slot-tabs"), voitures3D: document.querySelectorAll("#v-trophees canvas").length, aide: (document.querySelector(".eta-aide") || {}).innerText || "" }; });
      ok(JSON.stringify(a.cats) === JSON.stringify(a.attendu) && a.cats.length === 11 && a.cats.includes("badges") && a.colsPastilles === 3 && a.compteurs && a.emojis && a.choisie.length === 1 && a.choisie[0] === a.ouverte && a.grilles === 1 && a.cols === 4,
        "pastilles des 11 catégories (3 par ligne, émoji, nom, compteur juste), une seule choisie, une seule grille de 4 colonnes dessous " + JSON.stringify({ cats: a.cats, choisie: a.choisie, cols: a.cols }) + tag);
      ok(a.nom && a.numero && a.objets && !a.onglets && a.voitures3D <= 1 && /Touche un objet pour l'essayer.*« \? » pour savoir d'où il vient/.test(a.aide), "en haut la F1 3D, le nom, #44 et « N / total objets » ; une seule voiture 3D ; phrase d'aide en bas " + JSON.stringify({ v3d: a.voitures3D, aide: a.aide }) + tag);
      // chaque catégorie montre tous ses objets ; les pastilles changent la grille sans faire sauter la page
      const tous = await p.evaluate(async () => { const r = [], att = ms => new Promise(x => setTimeout(x, ms)); scrollBy(0, document.querySelector(".ecu-cats").getBoundingClientRect().top - 120); await att(100);
        for (const [s] of SLOTS) { const pa = document.querySelector('[data-ecu-cat="' + s + '"]'), y0 = pa.getBoundingClientRect().top; pa.click(); await att(120);
          const y1 = document.querySelector('[data-ecu-cat="' + s + '"]').getBoundingClientRect().top;
          r.push([s, document.querySelectorAll('.eta-g[data-eta-l="' + s + '"] .it').length, idsSlot(s).length, Math.round(y1 - y0), document.querySelector('[data-ecu-cat="' + s + '"]').getAttribute("aria-pressed")]); }
        return r; });
      ok(tous.every(x => x[1] === x[2] && x[1] > 0 && Math.abs(x[3]) <= 2 && x[4] === "true"), "chaque pastille ouvre sa grille avec tous ses objets, sans faire sauter la page " + JSON.stringify(tous) + tag);
      // mémoire : la dernière catégorie ouverte revient ; mémoire du téléphone bloquée = rien ne casse
      await ouvrirCat(p, "klaxon"); await ouvrirEcurie(p);
      const mem = await p.evaluate(() => ({ cat: (document.querySelector(".etageres .eta") || { dataset: {} }).dataset.ecuSlot, garde: localStorage.getItem("versus.ecuCat") }));
      const bloque = await p.evaluate(async n => { const g = Storage.prototype.getItem, s = Storage.prototype.setItem; Storage.prototype.getItem = () => { throw new Error("bloqué"); }; Storage.prototype.setItem = () => { throw new Error("bloqué"); };
        let ok1 = true; try { eval(n); ECU = null; ECU_SLOT = ""; rendreTrophees(); document.querySelector('[data-ecu-cat="casque"]').click(); await new Promise(r => setTimeout(r, 200)); } catch (e) { ok1 = false; }
        const cat = (document.querySelector(".etageres .eta") || { dataset: {} }).dataset.ecuSlot; Storage.prototype.getItem = g; Storage.prototype.setItem = s; return { ok1, cat }; }, nettoyer);
      ok(mem.cat === "klaxon" && mem.garde === "klaxon" && bloque.ok1 && bloque.cat === "casque", "la dernière catégorie ouverte est mémorisée sur l'appareil ; mémoire bloquée = l'écurie marche quand même " + JSON.stringify({ mem, bloque }) + tag);
      await ouvrirEcurie(p);
      await p.screenshot({ path: DOSSIER + "/vestiaire-haut" + suf + ".png" });
      // photos des livrées : prises une à une, jamais de voiture 3D en plus
      await ouvrirCat(p, "livree"); await p.evaluate(() => document.querySelector('[data-eta-l="livree"]').scrollIntoView({ block: "center" })); await p.waitForTimeout(2500);
      const ph = await p.evaluate(() => ({ att: document.querySelectorAll('[data-eta-l="livree"] .vg-attente').length, img: document.querySelectorAll('[data-eta-l="livree"] img[src^="data:"]').length, n: idsSlot("livree").filter(id => !(!debloques("Kévin").has("livree." + id) && objetCache("livree", id))).length, cv: document.querySelectorAll("#v-trophees canvas").length }));
      ok(!ph.att && ph.img === ph.n && ph.cv <= 1, "livrées : une photo par objet (prise en douceur), aucune voiture 3D en plus " + JSON.stringify(ph) + tag);
      await p.locator(".etageres").screenshot({ path: DOSSIER + "/grille-livrees" + suf + ".png" });
      // 2. toucher = essai sur la voiture, ✓ et cadre ; rien d'envoyé ; la grille ne saute pas
      await ouvrirCat(p, "casque");
      const t = await p.evaluate(async () => { const g = document.querySelector('[data-eta-l="casque"]'), ouv = debloques("Kévin");
        const cible = [...g.querySelectorAll(".it:not(.verrou)")].find(x => x.dataset.item !== ECU.e.casque && ouv.has("casque." + x.dataset.item));
        cible.scrollIntoView({ block: "center" }); await new Promise(r => setTimeout(r, 200));
        const y0 = cible.getBoundingClientRect().top; cible.click(); await new Promise(r => setTimeout(r, 900));
        const n = document.querySelector('[data-slot="casque"][data-item="' + cible.dataset.item + '"]'), eq = V3D.inst && V3D.inst.equipe ? V3D.inst.equipe() : null, cs = getComputedStyle(n);
        return { id: cible.dataset.item, porte: ECU.e.casque, on: n.classList.contains("on"), coche: !!n.querySelector(".it-ok"), cadre: cs.borderTopColor, seulOn: document.querySelectorAll('[data-eta-l="casque"] .it.on').length, voiture: eq && eq.casque, dy: Math.round(n.getBoundingClientRect().top - y0), garde: equipDe("Kévin").casque }; });
      ok(t.porte === t.id && t.on && t.coche && t.seulOn === 1 && t.voiture === t.id && t.garde === "damier" && envois.length === 0 && Math.abs(t.dy) <= 2,
        "toucher un casque : essayé tout de suite sur la F1 3D, ✓ et cadre sur sa case (une seule), rien d'envoyé, la grille ne saute pas " + JSON.stringify(t) + tag);
      // 3. 🎨 sous la grille ; une autre catégorie la referme ; la couleur reste
      await ouvrirCat(p, "livree"); await p.click('[data-slot="livree"][data-item="rayures"]'); await p.waitForTimeout(500);
      const c1 = await p.evaluate(() => ({ ou: [...document.querySelectorAll(".teintes")].map(x => x.closest(".eta").dataset.ecuSlot), sous: (() => { const tt = document.querySelector(".teintes"), g = document.querySelector('[data-eta-l="livree"]'); return !!tt && tt.getBoundingClientRect().top >= g.getBoundingClientRect().bottom; })(), tt: [...document.querySelectorAll('.teintes [data-teinte]')].map(x => x.dataset.teinte) }));
      await p.click('.teintes [data-teinte="or"]'); await p.waitForTimeout(600);
      const c2 = await p.evaluate(() => ({ t: ECU.e.teintes && ECU.e.teintes.livree, voiture: V3D.inst && V3D.inst.equipe && V3D.inst.equipe().livree, presse: (document.querySelector('.teintes [aria-pressed="true"]') || {}).dataset }));
      await p.locator(".etageres").screenshot({ path: DOSSIER + "/couleurs-livree" + suf + ".png" });
      await ouvrirCat(p, "klaxon"); await p.click('[data-slot="klaxon"][data-item="pouet"]'); await p.waitForTimeout(500);
      const c3 = await p.evaluate(() => ({ teintes: document.querySelectorAll(".teintes").length, klaxon: ECU.e.klaxon, couleurGardee: ECU.e.teintes && ECU.e.teintes.livree }));
      ok(c1.ou.join() === "livree" && c1.sous && c1.tt.join() === "blanc,noir,or" && c2.t === "or" && c2.voiture === "rayures" && c2.presse && c2.presse.teinte === "or" && !c3.teintes && c3.klaxon === "pouet" && c3.couleurGardee === "or",
        "🎨 Rayures : les couleurs sous la grille des livrées ; une autre catégorie les referme, la couleur reste choisie " + JSON.stringify({ c1, c2, c3 }) + tag);
      // 4. objet 🔒 2027 : « ? » et toucher = « Comment l'obtenir » sous l'objet, sans essai
      await ouvrirCat(p, "casque");
      const lk = await p.evaluate(async () => { const v = document.querySelector('[data-eta-l="casque"] .it.verrou'); if (!v) return null; const avant = ECU.e.casque; v.scrollIntoView({ block: "center" }); v.click(); await new Promise(r => setTimeout(r, 400));
        const d = document.querySelector("#it-d"); return { essai: ECU.e.casque !== avant, det: d ? d.innerText : "", lock: !!document.querySelector('[data-eta-l="casque"] .it.verrou .it-lock'), q: !!document.querySelector('[data-eta-l="casque"] .it-w.it-bloque .it-q') }; });
      ok(lk && !lk.essai && /Comment l'obtenir/i.test(lk.det) && lk.lock && lk.q, "objet 🔒 à gagner en 2027 : 🔒 et « ? » sur la case, toucher = « Comment l'obtenir », sans essai " + JSON.stringify(lk) + tag);
      await p.evaluate(() => fermerBulleEta());
      // 4 bis. la bulle s'ouvre JUSTE SOUS l'objet (colonne de gauche, colonne de droite), dans l'écran ; une seule ; toucher ailleurs ou retour = fermée
      const bu = await p.evaluate(async () => { const att = ms => new Promise(r => setTimeout(r, ms)), res = [];
        for (const ou of ["gauche", "droite"]) { const ws = [...document.querySelectorAll('[data-eta-l="casque"] .it-w')], w = ou === "gauche" ? ws[4] : ws[7]; w.scrollIntoView({ block: "center" }); await att(150); w.querySelector("[data-itq]").click(); await att(350);
          const b = document.querySelector(".eta-bulle"), it = document.querySelector('[data-eta-l="casque"] .it-w.q-on'), rb = b && b.getBoundingClientRect(), ri = it && it.getBoundingClientRect();
          res.push({ ou, n: document.querySelectorAll(".eta-bulle").length, sous: !!(rb && ri) && rb.top - ri.bottom >= 0 && rb.top - ri.bottom < 20, aplomb: !!(rb && ri) && ri.left + ri.width / 2 > rb.left && ri.left + ri.width / 2 < rb.right, dansEcran: !!rb && rb.left >= 0 && rb.right <= innerWidth && rb.bottom <= innerHeight && rb.top >= 0 && ri.top >= 120, txt: b ? b.innerText.slice(0, 40) : "" }); }
        const w2 = () => document.querySelectorAll('[data-eta-l="casque"] .it-w')[1]; w2().querySelector("[data-itq]").click(); await att(300); const une = document.querySelectorAll(".eta-bulle").length === 1;
        document.querySelector(".eta-aide").click(); await att(200); const ailleurs = !document.querySelector(".eta-bulle");
        w2().querySelector("[data-itq]").click(); await att(300); history.replaceState(null, "", location.hash); dispatchEvent(new PopStateEvent("popstate", { state: null })); await att(300);
        return { res, une, ailleurs, retour: !document.querySelector(".eta-bulle") && vueActive() === "trophees" }; });
      await p.evaluate(async () => { const ws = document.querySelectorAll('[data-eta-l="casque"] .it-w'); ws[7].scrollIntoView({ block: "center" }); ws[7].querySelector("[data-itq]").click(); await new Promise(r => setTimeout(r, 400)); });
      await p.screenshot({ path: DOSSIER + "/bulle-sous-objet" + suf + ".png" }); await p.evaluate(() => fermerBulleEta());
      ok(bu.res.every(x => x.n === 1 && x.sous && x.aplomb && x.dansEcran && x.txt) && bu.une && bu.ailleurs && bu.retour,
        "« ? » : la bulle s'ouvre juste sous l'objet, à son aplomb, dans l'écran (colonne de gauche et de droite) ; une seule ; toucher ailleurs ou retour la ferme " + JSON.stringify(bu) + tag);
      // 4 ter. Badges : badge obtenu = ce que le pilote a fait (+ 📌) ; badge à gagner = comment l'avoir
      const bd = await p.evaluate(async () => { const att = ms => new Promise(r => setTimeout(r, ms)), orig = badgesPossedes;
        window.badgesPossedes = nom => nom === "Kévin" ? [{ id: "t-drapeau", ico: "🚩", nom: "Le Drapeau de tête", niv: 4, html: '<span class="bdg" data-bdg="🚩 Le Drapeau de tête : titre détenu par Kévin depuis janvier 2027.">🚩</span>' }] : orig(nom);
        rendreTrophees(); await att(300); document.querySelector('[data-ecu-cat="badges"]').click(); await att(300); document.querySelector('.eta[data-ecu-slot="badges"]').scrollIntoView({ block: "center" }); await att(200);
        const cpt = document.querySelector('[data-ecu-cat="badges"] small').textContent;
        document.querySelector('[data-ecu-bdgq="t-drapeau"]').click(); await att(400); const b1 = document.querySelector(".eta-bulle"), t1 = b1 ? b1.innerText : "";
        for (let i = 0; i < 2; i++) { const pin = document.querySelector('.eta-bulle [data-ecu-bdg="t-drapeau"]'); if (pin) pin.click(); await att(400); }
        const epingle = Array.isArray(ECU.e.badges) && ECU.e.badges.includes("t-drapeau");
        const lk = document.querySelector('.bdg-c.bdg-bloque'); const nomLk = lk && lk.innerText; if (lk) lk.click(); await att(400); const b2 = document.querySelector(".eta-bulle"), t2 = b2 ? b2.innerText : "", r2 = b2 && b2.getBoundingClientRect(), rl = document.querySelector(".bdg-c.q-on").getBoundingClientRect();
        window.badgesPossedes = orig; return { cpt, t1, epingle, nomLk, t2, sous: !!r2 && r2.top >= rl.bottom && r2.top - rl.bottom < 20 && r2.left >= 0 && r2.right <= innerWidth }; });
      await p.screenshot({ path: DOSSIER + "/bulle-badge" + suf + ".png" }); await p.evaluate(() => { fermerBulleEta(); ECU = null; rendreTrophees(); });
      ok(/^1 \/ \d+$/.test(bd.cpt) && /titre détenu par Kévin/.test(bd.t1) && /📌|Retirer/.test(bd.t1) && bd.epingle && bd.nomLk && /Comment l'obtenir/i.test(bd.t2) && /Pour l'avoir/.test(bd.t2) && bd.sous,
        "Badges : pastille « 1 / N » ; badge obtenu = ce que Kévin a fait, « 📌 Afficher à côté de mon nom » ; badge 🔒 = comment l'avoir, dans la bulle sous le badge " + JSON.stringify(bd) + tag);
      // 4 quater. 🤏 zoom sur la F1 3D
      const zm = await p.evaluate(async () => { const att = ms => new Promise(r => setTimeout(r, ms)); scrollTo(0, 0); await att(300); const cv = document.querySelector("#sr-3d canvas.v3d"); if (!cv || !V3D.inst || !V3D.inst.zoom) return null;
        const r = cv.getBoundingClientRect(), y = r.top + r.height / 2, ev = (t, id, x) => cv.dispatchEvent(new PointerEvent(t, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: "touch", isPrimary: id === 1 }));
        const z0 = V3D.inst.zoom(); ev("pointerdown", 1, r.left + 150); ev("pointerdown", 2, r.left + 210); for (let i = 1; i <= 6; i++) { ev("pointermove", 2, r.left + 210 + i * 15); await att(16); } ev("pointerup", 2, r.left + 300); ev("pointerup", 1, r.left + 150);
        const z1 = V3D.inst.zoom(); await att(400);
        for (let i = 0; i < 2; i++) { ev("pointerdown", 1, r.left + 100); ev("pointerup", 1, r.left + 100); }
        await att(100);
        const z2 = V3D.inst.zoom(); return { z0, z1, z2, ta: getComputedStyle(cv).touchAction, aide: /zoome/.test(document.querySelector(".showroom").innerText), vue: !!document.querySelector("[data-ecu-vue]") }; });
      ok(zm && zm.z0 === 1 && zm.z1 < .8 && zm.z1 >= .55 && zm.z2 === 1 && /pan-y/.test(zm.ta) && zm.aide && zm.vue, "🤏 F1 3D : pincer rapproche (limité), double toucher revient ; la page défile ; aide « 🤏 zoome » ; bouton 2D/3D " + JSON.stringify(zm) + tag);
      // 5. Pilote : tête / casque d'un toucher, ✏️ éditeur sous la grille
      await ouvrirCat(p, "pilote");
      await p.click('[data-ecu-pmode="casque"]'); await p.waitForTimeout(300);
      const pm = await p.evaluate(() => ({ m: ECU.e.pilote, pastille: document.querySelector('[data-ecu-cat="pilote"] small').textContent }));
      await p.click('[data-ecu-ouvrir="pilote"]'); await p.waitForTimeout(300);
      const ed = await p.evaluate(() => { const tp = document.querySelector("#tp"); return { tp: !!tp, ligne: tp && tp.closest(".eta").dataset.ecuSlot }; });
      await p.click('#tp [data-tp="coupe"][data-v="2"]'); await p.waitForTimeout(200);
      const ed2 = await p.evaluate(() => ({ pilote: ECU.e.pilote, tp: !!document.querySelector("#tp"), pastille: document.querySelector('[data-ecu-cat="pilote"] small').textContent }));
      ok(pm.m === "casque" && pm.pastille === "Casque" && ed.tp && ed.ligne === "pilote" && ed2.pilote === "tete" && ed2.tp && ed2.pastille === "Tête", "Pilote : « Mon casque » d'un toucher (pastille « Casque »), ✏️ ouvre l'éditeur de tête sous la grille " + JSON.stringify({ pm, ed, ed2 }) + tag);
      // 6. Numéro
      await ouvrirCat(p, "numero");
      const nb = await p.evaluate(async () => { const n = document.querySelector('.eta[data-ecu-slot="numero"] #ecu-num'); n.value = "12"; n.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(r => setTimeout(r, 300));
        return { num: ECU.e.numero, pastille: document.querySelector('[data-ecu-cat="numero"] small').textContent, carte: /#12/.test(document.querySelector(".showroom .sr-h").innerText) }; });
      ok(nb.num === 12 && nb.pastille === "#12" && nb.carte, "Numéro : #12 dans la pastille et dans la carte de la F1 " + JSON.stringify(nb) + tag);
      // 7. 🎲, ↩️, Enregistrer
      const hz = await p.evaluate(async () => { scrollTo(0, 0); const ouv = debloques("Kévin"), faux = []; for (let i = 0; i < 12; i++) { document.querySelector("#ecu-hasard").click(); await new Promise(r => setTimeout(r, 30)); SLOTS_HASARD.forEach(s => { if (!ouv.has(s + "." + ECU.e[s])) faux.push(s + "." + ECU.e[s]); }); }
        return { faux, retour: !!document.querySelector("#ecu-retour"), envois: 0 }; });
      const av0 = envois.length; await p.click("#ecu-garder"); await p.waitForTimeout(700);
      ok(!hz.faux.length && hz.retour && av0 === 0 && envois.length === 1, "🎲 Au hasard (objets possédés), ↩️ Annuler les changements, rien d'envoyé avant « Enregistrer », puis un envoi " + JSON.stringify({ hz, envois: envois.length }) + tag);
      // 7 bis. 💾 en haut : éteint, puis « modifié » après un essai ; bandeau collant en défilant (fenêtre basse : la grille dépasse l'écran)
      const g0 = await p.evaluate(async () => { scrollTo(0, 0); await new Promise(r => setTimeout(r, 300)); const h = document.querySelector(".showroom #ecu-garder-haut"); return { h: !!h, on: h && h.classList.contains("modifie") }; });
      await ouvrirCat(p, "casque");
      const autreCasque = () => p.evaluate(() => { const ouv = debloques("Kévin"); return idsSlot("casque").find(id => ouv.has("casque." + id) && id !== ECU.e.casque && id !== equipDe("Kévin").casque); });
      const cq1 = await autreCasque();
      await p.click('[data-slot="casque"][data-item="' + cq1 + '"]'); await p.waitForTimeout(400);
      await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(400);
      const g1 = await p.evaluate(() => { const h = document.querySelector("#ecu-garder-haut"), r = h.getBoundingClientRect(), c = document.querySelector(".ecu-collant-b"); return { on: h.classList.contains("modifie"), pastille: /modifié/i.test(h.innerText), visible: r.top >= 0 && r.bottom < innerHeight, collant: getComputedStyle(c).visibility }; });
      await p.locator(".showroom").first().screenshot({ path: DOSSIER + "/enregistrer-haut" + suf + ".png" });
      await p.setViewportSize({ width: 390, height: 600 }); await p.waitForTimeout(200);
      await p.evaluate(() => { const g = document.querySelector(".eta-g").getBoundingClientRect(); scrollTo(0, scrollY + g.top - 70); }); await p.waitForTimeout(300);
      await p.waitForFunction(() => getComputedStyle(document.querySelector(".ecu-collant-b")).opacity === "1", null, { timeout: 4000 }).catch(() => {});
      const g2 = await p.evaluate(() => { const c = document.querySelector(".ecu-collant-b"), r = c.getBoundingClientRect(), t = document.querySelector(".top").getBoundingClientRect(); return { vis: getComputedStyle(c).visibility, op: getComputedStyle(c).opacity, sousEntete: r.top >= t.bottom - 2 }; });
      await p.screenshot({ path: DOSSIER + "/bandeau-collant" + suf + ".png" });
      await p.evaluate(() => document.querySelector("#ecu-garder").scrollIntoView({ block: "center" })); await p.waitForTimeout(300);
      await p.waitForFunction(() => getComputedStyle(document.querySelector(".ecu-collant-b")).visibility === "hidden", null, { timeout: 4000 }).catch(() => {});
      const g3 = await p.evaluate(() => getComputedStyle(document.querySelector(".ecu-collant-b")).visibility);
      await p.evaluate(() => { const g = document.querySelector(".eta-g").getBoundingClientRect(); scrollTo(0, scrollY + g.top - 70); }); await p.waitForTimeout(300);
      await p.waitForFunction(() => getComputedStyle(document.querySelector(".ecu-collant-b")).opacity === "1", null, { timeout: 4000 }).catch(() => {});
      await p.click(".ecu-collant-b [data-ecu-voir]", { timeout: 5000 }).catch(() => {}); await p.waitForTimeout(1200);
      const g4 = await p.evaluate(() => { const r = document.querySelector(".showroom").getBoundingClientRect(); return { vu: r.top >= 0 && r.top < 200 }; });
      await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(200);
      ok(g0.h && !g0.on && g1.on && g1.pastille && g1.visible && g1.collant === "hidden" && g2.vis === "visible" && +g2.op > .9 && g2.sousEntete && g3 === "hidden" && g4.vu,
        "💾 en haut de la carte : éteint, puis « modifié » après un essai ; en défilant, bandeau collant « 💾 Enregistrer » sous l'en-tête (caché quand « Enregistrer » du bas est à l'écran) ; « 🏎️ Voir ↑ » remonte à la F1 " + JSON.stringify({ g0, g1, g2, g3, g4 }) + tag);
      // rappel en quittant
      await p.click('.onglet[data-vue="classement"]'); await p.waitForTimeout(400);
      const r1 = await p.evaluate(() => ({ rap: !!document.querySelector(".ecu-rappel"), txt: (document.querySelector(".ecu-rappel") || {}).innerText || "", vue: vueActive() }));
      await p.screenshot({ path: DOSSIER + "/rappel-quitter" + suf + ".png" });
      await p.mouse.click(195, 40); await p.waitForTimeout(300);
      const r2 = await p.evaluate(() => ({ rap: !!document.querySelector(".ecu-rappel"), vue: vueActive(), porte: ECU && ECU.e.casque }));
      await p.click('[data-pod="stand"]'); await p.waitForTimeout(300); await p.click('.ecu-rappel [data-rap="non"]'); await p.waitForTimeout(500);
      const r3 = await p.evaluate(() => ({ pod: ETAT.podium, rap: !!document.querySelector(".ecu-rappel"), porte: equipDe("Kévin").casque }));
      await p.evaluate(async () => { ETAT.podium = "ecurie"; rendreTrophees(); await new Promise(r => setTimeout(r, 300)); });
      await ouvrirCat(p, "casque");
      const cq2 = await autreCasque(); await p.evaluate(async id => { document.querySelector('[data-slot="casque"][data-item="' + id + '"]').click(); await new Promise(r => setTimeout(r, 300)); }, cq2);
      const av = envois.length; await p.click('.onglet[data-vue="classement"]'); await p.waitForTimeout(300); await p.click('.ecu-rappel [data-rap="oui"]'); await p.waitForTimeout(700);
      const r4 = await p.evaluate(() => ({ vue: vueActive(), porte: equipDe("Kévin").casque }));
      await p.evaluate(async () => { allerA("trophees"); ETAT.podium = "ecurie"; rendreTrophees(); await new Promise(r => setTimeout(r, 300)); });
      await p.click('.onglet[data-vue="mois"]'); await p.waitForTimeout(300);
      const r5 = await p.evaluate(() => ({ rap: !!document.querySelector(".ecu-rappel"), vue: vueActive() }));
      ok(r1.rap && /pas enregistré ton écurie/i.test(r1.txt) && r1.vue === "trophees" && !r2.rap && r2.vue === "trophees" && r2.porte === cq1 && r3.pod === "stand" && !r3.rap && r3.porte !== cq1 &&
        envois.length === av + 1 && r4.vue === "classement" && r4.porte === cq2 && !r5.rap && r5.vue === "mois",
        "quitter l'écurie sans enregistrer : rappel (à côté = on reste ; Annuler = tenue d'avant puis on part ; Enregistrer = envoyé puis on part) ; rien quand tout est enregistré " + JSON.stringify({ r1: r1.rap, cq1, cq2, r2, r3, r4, r5 }) + tag);
      // essai → 🏆 Vitrine d'un autre → rappel → Enregistrer : envoyé ET la fiche s'ouvre
      await p.evaluate(async () => { allerA("trophees"); ETAT.podium = "ecurie"; ECU = null; rendreTrophees(); await new Promise(r => setTimeout(r, 300)); });
      await ouvrirCat(p, "casque");
      const cq3 = await autreCasque(); await p.evaluate(async id => { document.querySelector('[data-slot="casque"][data-item="' + id + '"]').click(); await new Promise(r => setTimeout(r, 300)); }, cq3);
      const av2 = envois.length; await p.evaluate(() => document.querySelector('.grille-dep [data-gp-fiche="Clément"]').click()); await p.waitForTimeout(300);
      const f0 = await p.evaluate(() => !!document.querySelector(".ecu-rappel")); await p.click('.ecu-rappel [data-rap="oui"]'); await p.waitForTimeout(800);
      const f1 = await p.evaluate(() => ({ vue: vueActive(), fiche: ETAT.fiche, porte: equipDe("Kévin").casque }));
      ok(f0 && envois.length === av2 + 1 && f1.vue === "fiche" && f1.fiche === "Clément" && f1.porte === cq3, "essai puis 🏆 Vitrine de Clément : rappel → Enregistrer = envoyé, et la fiche de Clément s'ouvre " + JSON.stringify({ f0, f1, cq3 }) + tag);
      // garage d'un autre pilote : en lecture seule
      await ouvrirEcurie(p);
      const gar = await p.evaluate(async () => { document.querySelector('.grille-dep [data-voir="Clément"]').click(); await new Promise(r => setTimeout(r, 500)); const g = document.querySelector("#garage");
        return { g: !!g, objets: g ? g.querySelectorAll("[data-slot], [data-ecu-cat], [data-itq], #ecu-garder-haut").length : -1, nom: g ? /Clément/.test(g.innerText) : false, voitures: document.querySelectorAll("#v-trophees canvas").length }; });
      await p.evaluate(() => { const f = document.querySelector("#garage-fermer"); if (f) f.click(); });
      ok(gar.g && gar.objets === 0 && gar.nom && gar.voitures <= 2, "garage de Clément : sa voiture et son équipement, en lecture seule (rien à toucher) " + JSON.stringify(gar) + tag);
      // premier écran (janvier) : catégories et objets visibles ; ↩️ ; bouton retour du téléphone
      await ouvrirEcurie(p);
      const pe = await p.evaluate(() => { const n = Math.min(...[...document.querySelectorAll(".onglet")].map(x => x.getBoundingClientRect().top)), c = document.querySelector(".ecu-cats").getBoundingClientRect(), it = document.querySelector(".etageres .it-w, .etageres .bdg-c, .etageres #ecu-num").getBoundingClientRect();
        return { cats: Math.round(c.bottom), objet: Math.round(it.top), barre: Math.round(n), hasardDansCarte: !!document.querySelector(".showroom #ecu-hasard"), annuler: !!document.querySelector("#ecu-retour") }; });
      await p.screenshot({ path: DOSSIER + "/premier-ecran" + suf + ".png" });
      const an = await p.evaluate(async () => { document.querySelector('[data-ecu-cat="numero"]').click(); await new Promise(r => setTimeout(r, 200)); const n = document.querySelector("#ecu-num"); n.value = "8"; n.dispatchEvent(new Event("change", { bubbles: true })); await new Promise(r => setTimeout(r, 300)); const b = document.querySelector("#ecu-retour"); return { txt: b && b.innerText }; });
      const rt = await p.evaluate(async () => { const att = ms => new Promise(r => setTimeout(r, ms));
        const retour = () => { history.replaceState(null, "", location.hash); dispatchEvent(new PopStateEvent("popstate", { state: null })); };
        retour(); await att(400); const a = { rap: !!document.querySelector(".ecu-rappel"), vue: vueActive() };
        retour(); await att(400); const b = { rap: !!document.querySelector(".ecu-rappel"), vue: vueActive(), num: ECU.e.numero };
        retour(); await att(400); document.querySelector('.ecu-rappel [data-rap="non"]').click(); await att(400); const c = { vue: vueActive(), num: equipDe("Kévin").numero };
        return { a, b, c }; });
      ok(pe.cats < pe.barre && pe.objet + 40 < pe.barre && pe.hasardDansCarte && !pe.annuler && an.txt && /Annuler les changements/.test(an.txt) && rt.a.rap && rt.a.vue === "trophees" && !rt.b.rap && rt.b.vue === "trophees" && rt.b.num === 8 && rt.c.vue !== "trophees" && rt.c.num !== 8,
        "premier écran : les catégories et la 1re rangée d'objets se voient au-dessus de la barre du bas ; « ↩️ Annuler les changements » dès un changement ; retour du téléphone = rappel " + JSON.stringify({ pe, an, rt }) + tag);
      ok(!(await deborde(p)) && !err.length, "2/1/2027 : 390 px sans débordement, 0 erreur JS " + JSON.stringify(err.slice(0, 3)) + tag);
      await ctx.close(); }
    // 8. décembre : ✨ nouveautés (trésor de Noël) en tête, « Équiper maintenant » ; rien de 2027
    { const { ctx, p, err } = await page(b, { quand: "2026-12-15T10:00:00", sombre });
      await ouvrirEcurie(p);
      const nv = await p.evaluate(() => { const s = document.querySelector('.etageres .eta'), its = [...s.querySelectorAll(".it")], pas = [...document.querySelectorAll(".ecu-cats [data-ecu-cat]")];
        return { ouverte: s.dataset.ecuSlot, tete: pas[0].dataset.ecuCat, point: pas.filter(x => x.querySelector(".ecu-cat-nv")).map(x => x.dataset.ecuCat), ordre: its.slice(0, 2).map(x => x.dataset.item), nv: its.filter(x => x.closest(".it-w").querySelector(".it-nv")).length }; });
      ok(nv.ouverte === "plaque" && nv.tete === "plaque" && nv.point.join() === "plaque" && nv.ordre.join() === "chercheuror,chercheur" && nv.nv === 2,
        "décembre : pastille Plaque marquée ✨ et en tête, sa grille ouverte, les 2 nouvelles plaques en premier, marquées ✨ " + JSON.stringify(nv) + tag);
      await p.locator(".etageres").screenshot({ path: DOSSIER + "/nouveau-plaque" + suf + ".png" });
      await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300); await p.screenshot({ path: DOSSIER + "/ordre-nouveautes" + suf + ".png" });
      const o1 = await pastilles(p);
      await ouvrirCat(p, "casque"); await p.evaluate(async () => { document.querySelector('[data-slot="casque"][data-item="carbone"]').click(); await new Promise(r => setTimeout(r, 400)); });
      const o2 = await pastilles(p);
      await ouvrirEcurie(p); const o3 = await pastilles(p), ouv3 = await p.evaluate(() => document.querySelector(".etageres .eta").dataset.ecuSlot);
      const normal = "livree,casque,finition,trainee,plaque,pilote,fond,klaxon,circuit,numero";
      ok(o1 === "plaque,livree,casque,finition,trainee,pilote,fond,klaxon,circuit,numero" && o2 === o1 && o3 === normal && ouv3 === "casque",
        "✨ la pastille Plaque (nouveautés) passe en tête ; l'ordre ne bouge pas pendant les essais ; ordre habituel ensuite, sur la dernière catégorie ouverte " + JSON.stringify({ o1, o2, o3, ouv3 }) + tag);
      const dec = await p.evaluate(async () => { const vus = [], ouv = debloques("Kévin"); let verrous = 0, mots = false;
        for (const x of [...document.querySelectorAll(".ecu-cats [data-ecu-cat]")].map(y => y.dataset.ecuCat)) { document.querySelector('[data-ecu-cat="' + x + '"]').click(); await new Promise(r => setTimeout(r, 80));
          document.querySelectorAll("#v-trophees .etageres [data-item]").forEach(y => vus.push(y.dataset.slot + "." + y.dataset.item)); verrous += document.querySelectorAll("#v-trophees .it.verrou").length; if (/Gant de l|Légende|2028|🗺️/.test(document.querySelector(".etageres").innerText)) mots = true; }
        return { n: vus.length, hors: vus.filter(k => { const [s, id] = k.split("."); return !estDepart(s, id) && !ouv.has(k); }), verrous, badges: !!document.querySelector('[data-ecu-cat="badges"]'), mots }; });
      ok(dec.n >= 30 && !dec.hors.length && !dec.verrous && !dec.badges && !dec.mots, "décembre : rien de 2027 dans les grilles (ni objet bloqué, ni pastille Badges) " + JSON.stringify(dec) + tag);
      // Équiper maintenant depuis la cérémonie du Chercheur de Noël
      await p.evaluate(async () => { ETAT.podium = "gp"; ECU = null; garder(); allerA("classement"); await new Promise(r => setTimeout(r, 300)); ceremonieChercheurNoel(1); await new Promise(r => setTimeout(r, 500)); });
      await p.click(".cn-rev [data-equiper]"); await p.waitForTimeout(1300);
      const eq = await p.evaluate(() => { const w = document.querySelector('.it[data-slot="plaque"][data-item="chercheuror"]').closest(".it-w"), r = w.getBoundingClientRect();
        return { vue: vueActive(), cat: (document.querySelector('.ecu-cats [aria-pressed="true"]') || { dataset: {} }).dataset.ecuCat, porte: ECU.e.plaque, on: w.querySelector(".it").classList.contains("on"), cible: w.classList.contains("eta-cible"), dansEcran: r.top >= 60 && r.bottom <= innerHeight - 70, garde: equipDe("Kévin").plaque, cer: !!document.querySelector(".cn-rev") }; });
      await p.screenshot({ path: DOSSIER + "/equiper-maintenant" + suf + ".png" });
      ok(eq.vue === "trophees" && eq.cat === "plaque" && eq.porte === "chercheuror" && eq.on && eq.cible && eq.dansEcran && eq.garde === "aucune" && !eq.cer,
        "« 🏎️ Équiper maintenant » : l'écurie s'ouvre sur la catégorie Plaque, la plaque dorée visible, essayée et mise en évidence (pas encore enregistrée) " + JSON.stringify(eq) + tag);
      const loin = await p.evaluate(async () => { const s = "casque", l = idsSlot(s), id = l[l.length - 1]; scrollTo(0, 0); equiperMaintenant(s, id); await new Promise(r => setTimeout(r, 1300));
        const w = document.querySelector('.it[data-slot="' + s + '"][data-item="' + id + '"]').closest(".it-w"), r = w.getBoundingClientRect();
        return { id, cat: document.querySelector('.ecu-cats [aria-pressed="true"]').dataset.ecuCat, dansEcran: r.top >= 0 && r.bottom <= innerHeight, cible: w.classList.contains("eta-cible") }; });
      ok(loin.cat === "casque" && loin.dansEcran && loin.cible, "« Équiper maintenant » vers le dernier casque : la bonne catégorie, l'objet à l'écran et mis en évidence " + JSON.stringify(loin) + tag);
      ok(!(await deborde(p)) && !err.length, "décembre : 390 px sans débordement, 0 erreur JS " + JSON.stringify(err.slice(0, 3)) + tag);
      await ctx.close(); }
  }
  // 9. 31/12 à 23 h 30 puis 1/1 : rien de 2027 avant l'heure
  for (const [q, att] of [["2026-12-31T23:30:00", false], ["2027-01-01T00:30:00", true]]) {
    const { ctx, p, err } = await page(b, { quand: q });
    await ouvrirEcurie(p);
    const r = await p.evaluate(async () => { let verrous = 0;
      for (const x of [...document.querySelectorAll(".ecu-cats [data-ecu-cat]")].map(y => y.dataset.ecuCat)) { document.querySelector('[data-ecu-cat="' + x + '"]').click(); await new Promise(r => setTimeout(r, 60)); verrous += document.querySelectorAll("#v-trophees .it.verrou").length; }
      return { verrous, badges: !!document.querySelector('[data-ecu-cat="badges"]') }; });
    ok((att ? r.verrous > 0 && r.badges : !r.verrous && !r.badges) && !err.length, q + " : " + (att ? "les objets 2027 à gagner apparaissent (🔒) et la pastille Badges" : "aucun objet 2027, pas de pastille Badges") + " " + JSON.stringify(r));
    await ctx.close(); }
  // 9 bis. le serveur refuse l'enregistrement : tout revient comme avant, avec un message
  { const { ctx, p, err, envois } = await page(b, { quand: "2027-01-02T10:00:00", refuse: true });
    await ouvrirEcurie(p); await ouvrirCat(p, "casque");
    const r = await p.evaluate(async () => { const avant = equipDe("Kévin").casque, ouv = debloques("Kévin"), id = idsSlot("casque").find(x => ouv.has("casque." + x) && x !== avant);
      document.querySelector('[data-slot="casque"][data-item="' + id + '"]').click(); await new Promise(r => setTimeout(r, 300));
      const t0 = []; const tst = document.querySelector("#toast"); const mo = new MutationObserver(() => t0.push(tst.innerText)); mo.observe(tst, { childList: true, subtree: true, characterData: true });
      document.querySelector("#ecu-garder-haut").click(); await new Promise(r => setTimeout(r, 1200)); mo.disconnect();
      return { avant, id, apres: equipDe("Kévin").casque, msg: t0.join(" | "), modifie: ecuModifie(), grille: !!document.querySelector('.etageres [data-eta-l="casque"]') }; });
    ok(envois.length === 1 && r.apres === r.avant && /revenue comme avant/.test(r.msg) && !r.modifie && r.grille && !err.length, "le serveur refuse : l'écurie revient comme avant, avec un message, sur la même catégorie " + JSON.stringify(r));
    await ctx.close(); }
  // 10. fluidité, processeur ×4 : toucher un objet, changer de catégorie
  { const { ctx, p, err } = await page(b, { quand: "2027-01-02T10:00:00" });
    await p.evaluate(() => stock.set("versus.ecuVue", "2d"));   // la voiture en 2D : on mesure l'écurie, pas le moteur 3D logiciel de la machine de test
    await ouvrirEcurie(p);
    const cdp = await ctx.newCDPSession(p); await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const m = await p.evaluate(async () => { const att = ms => new Promise(r => setTimeout(r, ms)), frame = () => new Promise(r => requestAnimationFrame(() => r()));
      const t0 = performance.now(); ECU = null; rendreTrophees(); await frame(); const ouvrir = performance.now() - t0;
      const touches = [], cats = [];
      for (const s of ["casque", "fond", "trainee", "plaque", "finition"]) { const a0 = performance.now(); document.querySelector('[data-ecu-cat="' + s + '"]').click(); await frame(); cats.push(Math.round(performance.now() - a0)); await att(200);
        const its = [...document.querySelectorAll('[data-eta-l="' + s + '"] .it:not(.verrou)')], it = its[Math.min(2, its.length - 1)];
        it.scrollIntoView({ block: "center" }); await att(150); const a = performance.now(); it.click(); await frame(); touches.push(Math.round(performance.now() - a)); await att(300); }
      const med = l => l.slice().sort((a, b) => a - b)[2];
      return { ouvrir: Math.round(ouvrir), touches, cats, medT: med(touches), medC: med(cats) }; });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    ok(m.medT < 400 && m.medC < 400 && !err.length, "processeur ×4 : un toucher redessine en " + m.medT + " ms, changer de catégorie en " + m.medC + " ms (médianes) " + JSON.stringify(m));
    await ctx.close(); }
  await b.close();
  console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
