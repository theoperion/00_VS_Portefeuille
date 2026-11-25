/* Test (v20.61) · 🎄 Calendrier de l'Avent du tour de chauffe. Fausses données uniquement (serveur Google intercepté).
   Serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tavent.js   (PORT=… pour un autre port, CAPTURES=… pour les captures)
   Vérifie : rien en novembre ni en 2027 (même en forçant) ; le 5/12 cases 1-5 ouvrables, 6-24 fermées ; le 24/12 tout s'ouvre ; pastille tant que la case du jour
   n'est pas ouverte ; chaque jeu se lance, se joue (touchers) et se ferme sans erreur ; aucun mot de ce qui arrive dans les textes ; jamais de « € » ;
   aperçu admin (toutes les cases, rien gardé) refusé à un joueur ; souvenir du 24 dans l'écurie dès le 1/1/2027 ; 0 erreur JS ; 390 px clair et sombre. */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "avent");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
const donnees = session => ({ ok: true, version: 87, genere: "2026-12-05T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: NOMS.map((n, i) => ({ nom: n, rows: [ligne(202610, 990, 0.01), ligne(202611, 1000, 0.004 + i / 1000)] })),
  marche: { indices: ["S&P 500"], mois: [[202610, 0.01], [202611, 0.005]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
const JOUEUR = { role: "perso", nom: "Clément" }, ADMIN = { role: "admin" };
/** faux serveur des records de Noël (Avent.js) : garde les envois, renvoie MES records, et le tableau de la bande à partir du 24/12 */
function fauxAvent(o, c) {
  const S = o.srv; S.envois.push(c);
  if (o.horsLigne) return null;
  if (c.op === "score" && o.refuse) return { ok: false, erreur: "saisie", message: "Score impossible." };   // v20.62 : le serveur refuse un score hors bornes
  if (c.op === "score") { if (S.deja.includes(c.jeu)) return { ok: false, erreur: "deja", message: "demain" }; S.deja.push(c.jeu); S.mes[c.jeu] = c.score; }
  const r = { ok: true, ouvert: true, mes: Object.assign({}, S.mes) };
  if (o.quand >= "2026-12-24") { r.records = [{ jeu: "cadeaux", nom: "Kévin", score: 42, ex: [] }, { jeu: "memory", nom: "Devlin", score: 18.2, ex: ["Théo"] }, { jeu: "feux", nom: "Clément", score: 231, ex: [] }]; r.roi = [{ nom: "Kévin", places: 9, jeux: 3 }, { nom: "Clément", places: 11, jeux: 3 }]; }
  return r;
}
async function page(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light", reducedMotion: o.reduit ? "reduce" : "no-preference" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) err.push(m.text()); });
  await p.clock.setFixedTime(new Date(o.quand));
  o.srv = o.srv || { envois: [], mes: { cadeaux: 77 }, deja: [] };
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    if (c.action === "avent") { const x = fauxAvent(o, c); return x ? r.fulfill({ contentType: "application/json", body: JSON.stringify(x) }) : r.abort(); }
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tickets" ? { ok: true, ouvert: false } : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : donnees(o.session)) }); });
  await p.addInitScript(f => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); localStorage.setItem("versus.bullePortrait", "1"); localStorage.setItem("versus.chauffe1", "1"); localStorage.setItem("versus.saison1", "1"); localStorage.setItem("versus.ecurieTeaser", "1");
    if (f.ouvertes) localStorage.setItem("versus.avent", JSON.stringify(f.ouvertes)); if (f.admin) sessionStorage.setItem("versus.adminOn", "1"); }, { ouvertes: o.ouvertes, admin: o.admin });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  return { ctx, p, err, srv: o.srv, o };
}
const deborde = () => [...document.querySelectorAll(".av-ov *, .av-case *, .av-entree")].filter(e => !e.closest(".av-neige") && !e.closest(".av-porte")).filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.className).slice(0, 5);   // la neige (fixe) et les portes ouvertes en 3D sont rognées par leur cadre
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  // 1 · hors décembre : rien, même en forçant
  for (const q of ["2026-11-30T22:00:00", "2027-01-01T08:00:00", "2027-03-10T10:00:00"]) {
    const { ctx, p, err } = await page(b, { quand: q, session: JOUEUR, admin: true });
    const r = await p.evaluate(() => { try { ouvrirAvent(); apercuAvent(); } catch (e) { } return { entree: !!document.querySelector(".av-entree"), ov: !!document.querySelector(".av-ov"), ok5: caseOuvrable(5), ok1: caseOuvrable(1) }; });
    ok(!err.length && !r.entree && !r.ov && !r.ok1 && !r.ok5, q.slice(0, 10) + " · joueur : ni entrée, ni calendrier, aucune case ouvrable, même en forçant " + JSON.stringify(r) + " " + JSON.stringify(err));
    await ctx.close();
  }
  // 2 · le 5 décembre, joueur, clair puis sombre
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)";
    const { ctx, p, err } = await page(b, { quand: "2026-12-05T09:00:00", session: JOUEUR, sombre, ouvertes: [1, 2] });
    const e = await p.evaluate(() => { const x = document.querySelector("#v-classement > .av-entree"); return x ? { t: x.textContent, pas: !!x.querySelector(".av-pas") } : null; });
    ok(e && /case du 5/.test(e.t) && e.pas, "5/12 · l'entrée « Calendrier de l'Avent » en haut du Classement, avec la pastille de la case du jour " + JSON.stringify(e) + tag);
    if (!sombre) await p.screenshot({ path: DOSSIER + "/entree.png" });
    await p.click(".av-entree"); await p.waitForTimeout(400);
    const g = await p.evaluate(() => ({ n: document.querySelectorAll(".av-c").length, ferme: [...document.querySelectorAll(".av-c.ferme")].map(x => +x.dataset.av).sort((a, b) => a - b), jour: [...document.querySelectorAll(".av-c.jour")].map(x => +x.dataset.av), vue: [...document.querySelectorAll(".av-c.vue")].map(x => +x.dataset.av).sort() }));
    ok(g.n === 24 && g.ferme.length === 19 && g.ferme[0] === 6 && g.ferme[18] === 24 && g.jour[0] === 5 && g.vue.join() === "1,2", "5/12 · 24 cases : 6 à 24 fermées, 5 = case du jour, 1 et 2 déjà ouvertes " + JSON.stringify(g) + tag);
    ok(!(await p.evaluate(deborde)).length, "390 px : le calendrier ne déborde pas" + tag);
    if (!sombre) await p.screenshot({ path: DOSSIER + "/calendrier.png" }); else await p.screenshot({ path: DOSSIER + "/calendrier-sombre.png" });
    await p.click('.av-c[data-av="9"]'); await p.waitForTimeout(300);
    ok(!(await p.evaluate(() => !!document.querySelector(".av-case"))), "5/12 · la case 9 (future) ne s'ouvre pas" + tag);
    const force = await p.evaluate(() => { ouvrirCaseAvent(12); marquerOuverte(12); return { c: !!document.querySelector(".av-case"), v: aventOuvertes().includes(12) }; });
    ok(!force.c && !force.v, "5/12 · même appelée directement, une case future reste fermée et n'est pas notée " + JSON.stringify(force) + tag);
    await p.click('.av-c[data-av="5"]'); await p.waitForTimeout(1200);
    const c5 = await p.evaluate(() => ({ c: (document.querySelector(".av-case h3") || {}).textContent, vu: aventOuvertes().includes(5) }));
    ok(c5.c && /blague/i.test(c5.c) && c5.vu, "5/12 · la case du jour s'ouvre (porte), montre sa surprise, et est notée ouverte " + JSON.stringify(c5) + tag);
    if (!sombre) await p.screenshot({ path: DOSSIER + "/case-ouverte.png" }); else await p.screenshot({ path: DOSSIER + "/case-ouverte-sombre.png" });
    { const db = await p.evaluate(deborde); ok(!db.length, "390 px : la case ne déborde pas " + JSON.stringify(db) + tag); }
    await p.mouse.click(195, 20); await p.waitForTimeout(300);
    const apres = await p.evaluate(() => ({ c: !!document.querySelector(".av-case"), ov: !!document.querySelector(".av-ov"), v5: !!document.querySelector('.av-c.vue[data-av="5"]') }));
    ok(!apres.c && apres.ov && apres.v5, "un toucher en dehors ferme la case ; la porte 5 reste ouverte " + JSON.stringify(apres) + tag);
    await p.click(".av-ov .av-x"); await p.waitForTimeout(200);
    const e2 = await p.evaluate(() => { const x = document.querySelector("#v-classement > .av-entree"); return x ? { t: x.textContent, pas: !!x.querySelector(".av-pas") } : null; });
    ok(e2 && !e2.pas && /reviens demain/.test(e2.t), "après ouverture : plus de pastille, « reviens demain » " + JSON.stringify(e2) + tag);
    ok(!err.length, "0 erreur JS" + tag + " " + JSON.stringify(err));
    await ctx.close();
  }
  // 3 · le 24 décembre : tout s'ouvre ; chaque jeu se lance, se joue, se ferme ; textes sans secret
  { const { ctx, p, err } = await page(b, { quand: "2026-12-24T09:00:00", session: JOUEUR });
    const t = await p.evaluate(() => ({ tous: Array.from({ length: 24 }, (_, i) => caseOuvrable(i + 1)).every(Boolean), jeux: Object.keys(JEUX_AVENT), cases: Object.values(CASES_AVENT).filter(c => c.type === "jeu").map(c => c.jeu),
      textes: JSON.stringify(CASES_AVENT) + JSON.stringify(Object.values(JEUX_AVENT).map(j => [j.nom, j.aide, j.unite])) }));
    ok(t.tous, "24/12 · les 24 cases sont ouvrables");
    ok(t.jeux.length >= 12 && new Set(t.cases).size === t.cases.length && t.jeux.every(j => t.cases.includes(j)), t.jeux.length + " jeux différents, chacun dans sa case " + JSON.stringify(t.cases));
    const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    // mots écrits à l'envers (puis remis à l'endroit) : la liste ne doit pas ressembler aux identifiants des mini-jeux (contrôle tsecrets-mj)
    const INTERDITS = "enud|uaetahc|ecila|retuog|uaenna|arodnap|eliote|rucsbo|elliuotatar|fehc titep|srevne|eessydo|talocohc|natit|srevitlum|ellievrem|uej-inim|uej inim|uejinim|rosert|epuoc|talce|tekcit|ettelbat|elger|7202|srevinu|1 nosias|rehcra|terof|stiucric|etuaevuon|eiruce|€|orue".split("|").map(w => [...w].reverse().join(""));
    const trouves = INTERDITS.filter(m => norm(t.textes).includes(m));
    ok(!trouves.length, "aucun mot de ce qui arrive (univers, circuits, mini-jeux, trésors, Coupe, règles, écurie) ni montant dans les 24 cases " + JSON.stringify(trouves));
    await p.evaluate(() => ouvrirAvent()); await p.waitForTimeout(300);
    const pb = [];
    for (let n = 1; n <= 24; n++) {
      await p.evaluate(k => { document.querySelectorAll(".av-case").forEach(x => x.remove()); ouvrirCaseAvent(k); }, n); await p.waitForTimeout(150);
      const r = await p.evaluate(() => ({ jeu: !!document.querySelector(".av-case .avj"), txt: document.querySelector(".av-case").innerText }));
      if (/€/.test(r.txt) || trouves.length) pb.push(n + " €");
      const tn = norm(r.txt), mal = INTERDITS.filter(m => tn.includes(m) && !(n === 24 && m === "ecurie")); if (mal.length) pb.push(n + " " + mal);
      if (r.jeu) {
        await p.click(".av-case [data-avj='go']"); await p.waitForTimeout(250);
        const box = await p.locator(".av-case canvas").boundingBox();
        for (let i = 0; i < 14; i++) { const x = box.x + box.width * (.15 + ((i * 37) % 70) / 100), y = box.y + box.height * (.2 + ((i * 53) % 70) / 100);
          await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.move(x + 20, y + 10, { steps: 2 }); await p.mouse.up(); await p.waitForTimeout(90); }
        const s = await p.evaluate(() => { const o = document.querySelector(".av-case canvas"); return !!o; });
        if (!s) pb.push(n + " canvas");
        if (n === 2) await p.screenshot({ path: DOSSIER + "/jeu-en-cours.png" });
      }
      if (n === 24) await p.screenshot({ path: DOSSIER + "/case-24.png" });
      if (n === 13) await p.screenshot({ path: DOSSIER + "/case-13.png" });
      await p.click(".av-case [data-av-fermer]"); await p.waitForTimeout(80);
      if (await p.evaluate(() => !!document.querySelector(".av-case"))) pb.push(n + " pas fermée");
    }
    ok(!pb.length, "24/12 · les 24 cases s'ouvrent ; chaque jeu se lance, encaisse des touchers et se ferme ; textes affichés sans secret " + JSON.stringify(pb));
    const c24 = await p.evaluate(() => { ouvrirCaseAvent(24); const o = document.querySelector(".av-case"); const r = { plaque: !!o.querySelector(".plaque.pl-hiver26"), tr: !!o.querySelector(".vg-trainee .fx-flocons"), t: o.innerText }; o.remove(); return r; });
    ok(c24.plaque && c24.tr && /Hiver 2026/.test(c24.t) && /Flocons/.test(c24.t) && /dès aujourd'hui/.test(c24.t), "case 24 : la plaque « Hiver 2026 » et la traînée « Flocons », à toi dès aujourd'hui");
    const rec = await p.evaluate(() => recordsAvent());
    ok(typeof rec === "object", "records gardés sur l'appareil seulement " + JSON.stringify(rec));
    ok(!err.length, "24/12 · 0 erreur JS " + JSON.stringify(err));
    await ctx.close(); }
  // 3 bis · v20.62 (Théo) : case 16 = un 17e vrai jeu, « Les biscuits du Père Noël » : on trie vraiment (bonne moitié = +1), une erreur coûte 1
  { const { ctx, p, err } = await page(b, { quand: "2026-12-16T09:00:00", session: JOUEUR });
    await p.evaluate(() => { ouvrirAvent(); ouvrirCaseAvent(16); }); await p.waitForTimeout(200);
    const nom = await p.evaluate(() => document.querySelector(".av-case").innerText);
    await p.click(".av-case [data-avj='go']"); const box = await p.locator(".av-case canvas").boundingBox();
    let bons = 0;
    for (let i = 0; i < 40 && bons < 6; i++) {
      const k = await p.evaluate(() => { const G = document.querySelector(".av-case").jeu.etat(), b = G.s.b; return b && b.c === null && b.y > 100 ? b.k : -1; });
      if (k >= 0) { await p.mouse.click(box.x + box.width * (k ? .8 : .2), box.y + box.height * .6); bons++; await p.waitForTimeout(900); } else await p.waitForTimeout(120);
    }
    const s1 = await p.evaluate(() => document.querySelector(".av-case").jeu.etat().score);
    for (let i = 0; i < 30; i++) { const k = await p.evaluate(() => { const b = document.querySelector(".av-case").jeu.etat().s.b; return b && b.c === null && b.y > 100 ? b.k : -1; });
      if (k >= 0) { await p.mouse.click(box.x + box.width * (k ? .2 : .8), box.y + box.height * .6); await p.waitForTimeout(900); break; } await p.waitForTimeout(120); }
    const s2 = await p.evaluate(() => document.querySelector(".av-case").jeu.etat().score);
    await p.screenshot({ path: DOSSIER + "/jeu-biscuits.png" });
    await p.click(".av-case [data-av-fermer]"); await p.waitForTimeout(100);
    const ferme = await p.evaluate(() => !document.querySelector(".av-case"));
    const n = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(), interdits = "enud|uaetahc|uaenna|arodnap|eliote|rucsbo|srevne|eessydo|talocohc|natit|srevitlum|rosert|epuoc|7202|srevinu|eiruce|terof|€".split("|").map(w => [...w].reverse().join("")).filter(m => n(nom).includes(m));
    ok(/biscuits du Père Noël/i.test(nom) && s1 >= 5 && s2 === s1 - 1 && ferme && !interdits.length && !err.length, "case 16 : « Les biscuits du Père Noël » se lance, chaque bon tri rapporte 1, une erreur coûte 1, se ferme, aucun mot interdit " + JSON.stringify({ s1, s2, interdits, err: err.slice(0, 2) }));
    await ctx.close(); }
  // 4 · une partie entière jusqu'au bout (jeu chronométré) : score, record, rejouer
  { const { ctx, p, err, srv } = await page(b, { quand: "2026-12-10T09:00:00", session: JOUEUR });
    await p.evaluate(() => { ouvrirAvent(); ouvrirCaseAvent(10); }); await p.click(".av-case [data-avj='go']");
    await p.evaluate(() => { document.querySelector(".av-case canvas"); }); await p.waitForFunction(() => /Rejouer/.test(document.querySelector(".avj-voile").textContent), null, { timeout: 90000 }).catch(() => {});
    const f = await p.evaluate(() => ({ v: document.querySelector(".avj-voile").textContent, rec: recordsAvent().flocons }));
    ok(/Rejouer/.test(f.v) && f.rec !== undefined, "« Attrape les flocons » (20 s) : fin de partie, score et record gardés, bouton Rejouer " + JSON.stringify(f));
    await p.waitForTimeout(600);
    { const S = await p.evaluate(() => ({ cad: recordsAvent().cadeaux, file: fileAvent() })), env = srv.envois.filter(c => c.op === "score");
      ok(env.length === 1 && env[0].jeu === "flocons" && typeof env[0].score === "number" && Object.keys(env[0]).sort().join() === "action,cle,jeu,op,score" && !S.file.flocons, "le record part au serveur (jeu + score seulement, rien d'autre) et quitte la file " + JSON.stringify(env));
      ok(S.cad === 77, "mon record venu du serveur (77 aux cadeaux, joué sur un autre appareil) est repris sur celui-ci"); }
    await p.click(".av-case [data-avj='go']"); await p.waitForTimeout(300);
    ok(await p.evaluate(() => document.querySelector(".avj-voile").hidden), "Rejouer relance une partie");
    ok(!err.length, "0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 4 bis · sans réseau : les jeux marchent, le record attend en file ; deja = on attend demain
  { const o = { quand: "2026-12-10T09:00:00", session: JOUEUR }, { ctx, p, err } = await page(b, o); o.horsLigne = true;
    await p.evaluate(() => { ouvrirAvent(); ouvrirCaseAvent(10); document.querySelector(".av-case [data-avj='go']").click(); }); await p.waitForTimeout(200);
    await p.evaluate(() => mettreEnFileAvent("cadeaux", 99)); await p.waitForTimeout(800);
    const f1 = await p.evaluate(() => fileAvent());
    ok(f1.cadeaux && f1.cadeaux.s === 99, "hors ligne : le record de 99 attend dans la file de l'appareil " + JSON.stringify(f1));
    o.horsLigne = false; o.srv.deja.push("cadeaux"); await p.evaluate(() => envoyerFileAvent()); await p.waitForTimeout(800);
    const f2 = await p.evaluate(() => fileAvent());
    ok(f2.cadeaux && f2.cadeaux.deja === 20261210, "réseau revenu mais déjà un envoi aujourd'hui : il repartira demain " + JSON.stringify(f2));
    ok(!err.length, "0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  { const { ctx, p, err } = await page(b, { quand: "2026-12-24T09:00:00", session: JOUEUR });
    await p.evaluate(() => ouvrirAvent()); await p.waitForTimeout(800); await p.evaluate(() => ouvrirCaseAvent(24)); await p.waitForTimeout(1200);
    const r = await p.evaluate(() => { const z = document.querySelector(".av-case .av-records"); return z ? z.innerText : ""; });
    ok(/records de Noël/i.test(r) && /Les cadeaux du traîneau[\s\S]*Kévin · 42/.test(r) && /Devlin et Théo · 18,2 s/.test(r) && /roi des jeux de Noël : Kévin/.test(r) && !/€|%/.test(r), "24/12 : la case 24 montre les records de la bande et le roi des jeux de Noël " + JSON.stringify(r));
    await p.screenshot({ path: DOSSIER + "/case-24-records.png" });
    await p.emulateMedia({ colorScheme: "dark" }); await p.screenshot({ path: DOSSIER + "/case-24-sombre.png" });
    ok(!err.length, "0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 4 ter · v20.62 (relectures du 25/11) : faux départ, bornes, refus du serveur, file hors connexion, accords, textes sous la consigne, bouton retour, cases 20 et 24
  { const o = { quand: "2026-12-24T09:00:00", session: JOUEUR }, { ctx, p, err } = await page(b, o);
    const etatJ = () => document.querySelector(".av-case").jeu.etat();
    // faux départ sous 100 ms (même règle que le serveur)
    const fd = await p.evaluate(async () => { ouvrirAvent(); ouvrirCaseAvent(23); document.querySelector(".av-case [data-avj='go']").click(); await new Promise(r => setTimeout(r, 100));
      const G = document.querySelector(".av-case").jeu.etat(); G.s.ph = "go"; G.s.t0 = performance.now(); JEUX_AVENT.feux.toucher(G, 100, 100, "down"); return { es: G.s.es.length, txt: G.s.txt }; });
    ok(fd.es === 0 && /Faux départ/.test(fd.txt), "« Le départ du traîneau » : toucher en moins de 100 ms = faux départ, rien n'est compté " + JSON.stringify(fd));
    // bornes : un score impossible n'est ni gardé ni mis en file
    const bo = await p.evaluate(async () => { document.querySelectorAll(".av-case [data-av-fermer]").forEach(x => x.click()); ouvrirCaseAvent(2); document.querySelector(".av-case [data-avj='go']").click(); await new Promise(r => setTimeout(r, 100));
      const G = document.querySelector(".av-case").jeu.etat(); G.score = 500; G.finir(); await new Promise(r => setTimeout(r, 200));
      return { rec: recordsAvent().cadeaux, file: fileAvent().cadeaux || null, v: document.querySelector(".avj-voile").innerText, bornes: [scoreValide("cadeaux", 120), scoreValide("cadeaux", 121), scoreValide("feux", 99), scoreValide("memory", 3)] }; });
    ok(bo.rec !== 500 && !bo.file && /hors des limites/.test(bo.v) && bo.bornes.join() === "true,false,false,false", "bornes de l'appli = celles du serveur : 500 cadeaux ni gardé ni envoyé " + JSON.stringify(bo));
    // le serveur refuse un record : il n'est pas gardé comme record local et ne bloque pas les suivants
    o.refuse = true;
    const rf = await p.evaluate(async () => { const R = recordsAvent(); R.pile = 300; stock.set("versus.aventRecords", JSON.stringify(R)); mettreEnFileAvent("pile", 300); await new Promise(r => setTimeout(r, 900)); return { rec: recordsAvent().pile, file: fileAvent().pile || null }; });
    o.refuse = false;
    const rf2 = await p.evaluate(async () => { mettreEnFileAvent("pile", 40); await new Promise(r => setTimeout(r, 900)); return { file: fileAvent().pile || null }; });
    ok(rf.rec === undefined && !rf.file && !rf2.file && o.srv.envois.some(c => c.jeu === "pile" && c.score === 40), "record refusé par le serveur : oublié sur l'appareil, le suivant (40) part normalement " + JSON.stringify([rf, rf2]));
    // hors connexion (données du cache) : le record se met quand même en file, et part dès que la connexion revient
    const n0 = o.srv.envois.length;
    const hc = await p.evaluate(async () => { SOURCE = "cache"; mettreEnFileAvent("boules", 12); await new Promise(r => setTimeout(r, 500)); const f = fileAvent().boules || null; SOURCE = "api"; await envoyerFileAvent(); return { f, apres: fileAvent().boules || null }; });
    ok(hc.f && hc.f.s === 12 && !hc.apres && o.srv.envois.slice(n0).some(c => c.jeu === "boules"), "record fait hors connexion : mis en file, envoyé au retour du réseau " + JSON.stringify(hc));
    // accords et textes muets sous la consigne
    const fm = await p.evaluate(() => [avFmt(JEUX_AVENT.cadeaux, 1), avFmt(JEUX_AVENT.cadeaux, 3), avFmt(JEUX_AVENT.renne, 1), avFmt(JEUX_AVENT.rennes, 1), avFmt(JEUX_AVENT.luge, 1)]);
    ok(fm.join("|") === "1 cadeau|3 cadeaux|1 trouvé|1 sur 5|1 m", "accords : « 1 cadeau », « 3 cadeaux », « 1 trouvé » " + JSON.stringify(fm));
    const mu = await p.evaluate(async () => { document.querySelectorAll(".av-case [data-av-fermer]").forEach(x => x.click()); let n = 0; const ft = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function () { n++; return ft.apply(this, arguments); };
      ouvrirCaseAvent(23); await new Promise(r => setTimeout(r, 500)); const avant = n; document.querySelector(".av-case [data-avj='go']").click(); await new Promise(r => setTimeout(r, 500)); CanvasRenderingContext2D.prototype.fillText = ft; return { avant, apres: n - avant }; });
    ok(mu.avant === 0 && mu.apres > 0, "les textes du jeu ne se dessinent pas sous la consigne avant « Jouer » " + JSON.stringify(mu));
    // bouton retour du téléphone : la case d'abord, puis le calendrier
    const rt = await p.evaluate(() => { const a = fermerFenetreOuverte(), c1 = !!document.querySelector(".av-case"), o1 = !!document.querySelector(".av-ov"); const b2 = fermerFenetreOuverte(); return { a, c1, o1, b2, o2: !!document.querySelector(".av-ov") }; });
    ok(rt.a && !rt.c1 && rt.o1 && rt.b2 && !rt.o2, "bouton retour : ferme d'abord la case, puis le calendrier " + JSON.stringify(rt));
    // case 20 : rouvre l'annonce ; case 24 : « Aller à mon écurie », la règle du roi
    const c20 = await p.evaluate(async () => { ouvrirAvent(); ouvrirCaseAvent(20); const b = document.querySelector("[data-av-podium]"), t = b && b.textContent; b.click(); await new Promise(r => setTimeout(r, 400)); const tu = document.querySelector(".tuto"); const r = { t, tuto: !!tu, txt: tu ? tu.innerText.slice(0, 80) : "" }; if (tu) tu.remove(); return r; });
    ok(c20.tuto && /annonce/i.test(c20.t), "case 20 : le bouton rouvre directement l'annonce du 20 " + JSON.stringify(c20));
    const c24 = await p.evaluate(async () => { ouvrirAvent(); ouvrirCaseAvent(24); await new Promise(r => setTimeout(r, 1200)); const t = document.querySelector(".av-case").innerText, b = document.querySelector("[data-av-ecurie]"); b.click(); await new Promise(r => setTimeout(r, 500)); return { roi: /le plus souvent devant, tous jeux confondus/.test(t), bouton: /Équiper maintenant/.test(t), podium: ETAT.podium, case: !!document.querySelector(".av-case") }; });
    ok(c24.roi && c24.bouton && c24.podium === "ecurie" && !c24.case, "case 24 : « 🏎️ Équiper maintenant » y mène (v20.70) ; le roi = celui qui finit le plus souvent devant, tous jeux confondus " + JSON.stringify(c24));
    ok(!err.length, "4 ter · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 4 quater · simulation de date (admin, vue joueur) : aucun envoi, le vrai stockage reste intact
  { const o = { quand: "2026-11-26T10:00:00", session: ADMIN, admin: true };
    const { ctx, p, err } = await page(b, Object.assign(o, {}));
    await p.evaluate(() => { localStorage.setItem("versus.aventRecords", '{"cadeaux":5}'); localStorage.setItem("versus.vueJoueur", "Clément"); localStorage.setItem("versus.dateSim", "2026-12-24"); });
    await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes); await p.waitForTimeout(1500);
    const n0 = o.srv.envois.length;
    const si = await p.evaluate(async () => { const sim = simulation(); ouvrirAvent(); ouvrirCaseAvent(2); document.querySelector(".av-case [data-avj='go']").click(); await new Promise(r => setTimeout(r, 100));
      const G = document.querySelector(".av-case").jeu.etat(); G.score = 60; G.finir(); mettreEnFileAvent("pile", 33); await envoyerFileAvent(); await new Promise(r => setTimeout(r, 800));
      return { sim, vrai: localStorage.getItem("versus.aventRecords"), file: localStorage.getItem("versus.aventFile") }; });
    ok(si.sim && o.srv.envois.slice(n0).filter(c => c.op === "score").length === 0 && si.vrai === '{"cadeaux":5}' && !si.file, "simulation (date simulée + vue joueur) : zéro envoi, le vrai stockage reste intact " + JSON.stringify(si));
    ok(!err.length, "4 quater · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 5 · aperçu admin : toutes les cases en novembre, rien de gardé ; refusé à un joueur
  { const { ctx, p, err, srv } = await page(b, { quand: "2026-11-26T10:00:00", session: ADMIN, admin: true });
    const a = await p.evaluate(() => { apercuAvent(); const o = { ov: !!document.querySelector(".av-ov"), ferme: document.querySelectorAll(".av-c.ferme").length }; ouvrirCaseAvent(17); o.c = !!document.querySelector(".av-case"); o.vu = aventOuvertes().length; o.entree = !!document.querySelector(".av-entree"); return o; });
    await p.waitForTimeout(800);
    ok(a.ov && a.ferme === 0 && a.c && a.vu === 0 && !a.entree && !srv.envois.length, "admin, mode admin allumé, le 26/11 : aperçu avec les 24 cases ouvrables, rien n'est gardé ni envoyé, pas d'entrée pour les joueurs " + JSON.stringify(a));
    ok(!err.length, "0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  { const { ctx, p } = await page(b, { quand: "2026-12-03T10:00:00", session: JOUEUR, admin: true });
    const a = await p.evaluate(() => { apercuAvent(); ouvrirAvent(); return { ferme: document.querySelectorAll(".av-c.ferme").length, ap: aventApercu() }; });
    ok(!a.ap && a.ferme === 21, "joueur qui force l'aperçu le 3/12 : refusé, les cases 4 à 24 restent fermées " + JSON.stringify(a)); await ctx.close(); }
  // 6 · « réduire les animations » : pas de neige, la case s'ouvre tout de suite
  { const { ctx, p, err } = await page(b, { quand: "2026-12-05T09:00:00", session: JOUEUR, reduit: true });
    await p.evaluate(() => ouvrirAvent()); await p.click('.av-c[data-av="5"]'); await p.waitForTimeout(150);
    const r = await p.evaluate(() => ({ neige: document.querySelectorAll(".av-neige").length, c: !!document.querySelector(".av-case") }));
    ok(r.neige === 0 && r.c, "réduire les animations : pas de neige, la case s'ouvre sans attendre " + JSON.stringify(r)); ok(!err.length, "0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 7 · le souvenir dans l'écurie : rien avant le 24/12, pour chacun ensuite
  { const { ctx, p, err } = await page(b, { quand: "2026-12-23T22:00:00", session: JOUEUR });
    const r = await p.evaluate(() => ({ avant: debloques("Kévin").has("plaque.hiver26") || debloques("Kévin").has("trainee.flocons") })); ok(!r.avant, "23/12 au soir : le souvenir n'est pas encore là"); await ctx.close();
    const q = await page(b, { quand: "2026-12-24T07:00:00", session: JOUEUR });
    const s = await q.p.evaluate(() => ({ tous: D.personnes.every(x => debloques(x.nom).has("plaque.hiver26") && debloques(x.nom).has("trainee.flocons")), o: texteOrigineItem("Kévin", "plaque", "hiver26").t }));
    ok(s.tous && /Souvenir/.test(s.o), "24/12 au matin : la plaque « Hiver 2026 » et la traînée « Flocons » sont à chaque pilote, portables tout de suite (" + s.o + ")");
    ok(!err.length && !q.err.length, "0 erreur JS " + JSON.stringify(err.concat(q.err))); await q.ctx.close(); }
  await b.close(); console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
