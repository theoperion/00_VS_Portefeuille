/* Test (v20.74) · 🎄 Calendrier de l'Avent : une case par jour, à ouvrir le jour même, sinon « ❄️ Manquée » ; le serveur tranche ; 🏅 plaque Hiver 2026 dorée.
   Fausses données uniquement (serveur Google intercepté, faux Avent.js qui tient la date « du serveur » à part de celle du téléphone).
   Serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tavent-manquee.js   (PORT=… pour un autre port, CAPTURES=… pour les captures)
   Vérifie : case passée non ouverte = « Manquée » (inaccessible, toast), case déjà ouverte rejouable, case du jour ; textes (règle, plaque dorée, compte x/24) ;
   l'ouverture part au serveur ; téléphone avancé de 3 jours → le serveur refuse, l'appli se cale sur son heure ; hors réseau : date de l'appareil puis
   correction à la reconnexion ; du 25 au 31 rien de nouveau ; plaque dorée : 24/24 → dorée, 23/24 → normale, date du téléphone sans effet ;
   aperçu admin inchangé ; simulation : rien n'est envoyé ; 0 erreur JS ; 390 px clair et sombre (captures). */
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), os = require("os");
const PORT = process.env.PORT || 8771, URL = "http://localhost:" + PORT + "/index.html";
const DOSSIER = process.env.CAPTURES || path.join(os.tmpdir(), "versus-captures", "avent-manquee");
try { fs.mkdirSync(DOSSIER, { recursive: true }); } catch (e) { /* déjà là */ }
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const ligne = (k, val, r) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [50, val, 0, r, 0].concat(Array(20).fill(0))];
const donnees = session => ({ ok: true, version: 92, genere: "2026-12-05T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
  personnes: NOMS.map((n, i) => ({ nom: n, rows: [ligne(202610, 990, 0.01), ligne(202611, 1000, 0.004 + i / 1000)] })),
  marche: { indices: ["S&P 500"], mois: [[202610, 0.01], [202611, 0.005]], resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
  marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: {},
  liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session, monRappel: null, rappelsReleve: {}, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} });
const JOUEUR = { role: "perso", nom: "Clément" }, ADMIN = { role: "admin" };
/** faux Avent.js : son heure (o.serveur, heure de Paris) peut différer de celle du téléphone ; il garde les cases de Clément ouvertes le jour même */
function fauxServeur(o, c) {
  const S = o.srv; S.envois.push(c);
  if (o.horsLigne) return null;
  const t = new Date(o.serveur + "+01:00"), j = Number(o.serveur.slice(0, 10).replace(/-/g, "")), jd = j >= 20261201 && j <= 20261224 ? j % 100 : 0;
  const etat = () => { const r = { ok: true, ouvert: j >= 20261201, maintenant: t.getTime(), aujourdhui: j, cases: S.cases.slice(), mes: {} };
    if (j >= 20261224) { r.dores = S.dores.slice(); r.doresFinal = j > 20261224; if (j > 20261224) r.gagnants = { roi: null, etoiles: {} }; } if (j < 20261201) return { ok: true, ouvert: false, maintenant: t.getTime() }; return r; };   // Avent 26/11 : le serveur attribue aussi le roi de Noël le 25 (ici : personne)
  if (c.action === "aventCase") {
    if (S.cases.includes(c.jour)) return Object.assign({ accepte: true, deja: true }, etat());
    if (c.jour !== jd) return Object.assign({ accepte: false, raison: c.jour > jd ? "pasEncore" : "manquee", message: "❄️ Case manquée : elle ne s'ouvrait que le " + c.jour + " décembre." }, etat());
    S.cases.push(c.jour); if (S.cases.length === 24) S.dores.push("Clément"); return Object.assign({ accepte: true }, etat());
  }
  return etat();
}
async function page(b, o) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", colorScheme: o.sombre ? "dark" : "light" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message)); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) err.push(m.text()); });
  await p.clock.install({ time: new Date(o.tel + "+01:00") }); await p.clock.resume();   // l'heure du TÉLÉPHONE (heure de Paris)
  o.serveur = o.serveur || o.tel;
  o.srv = o.srv || { envois: [], cases: (o.casesSrv || []).slice(), dores: (o.dores || []).slice() };
  await p.route("https://script.google.com/**", async r => { const c = JSON.parse(r.request().postData() || "{}");
    if (c.action === "avent" || c.action === "aventCase") { if (o.lent) await new Promise(z => setTimeout(z, o.lent)); const x = fauxServeur(o, c); return x ? r.fulfill({ contentType: "application/json", body: JSON.stringify(x) }) : r.abort(); }
    r.fulfill({ contentType: "application/json", body: JSON.stringify(c.action === "tickets" ? { ok: true, ouvert: false } : c.action === "tresors" ? { ok: true, tresors: [], trouves: [], total: 0 } : c.action === "ecurie" ? { ok: true } : donnees(o.session || JOUEUR)) }); });
  await p.addInitScript(f => { if (sessionStorage.getItem("t.init")) return; sessionStorage.setItem("t.init", "1");
    localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.q3dAffichette", "1"); ["versus.tuto1", "versus.bullePortrait", "versus.chauffe1", "versus.saison1", "versus.ecurieTeaser"].forEach(k => localStorage.setItem(k, "1"));
    if (f.ouvertes) localStorage.setItem("versus.avent", JSON.stringify(f.ouvertes)); if (f.admin) sessionStorage.setItem("versus.adminOn", "1"); if (f.decal) localStorage.setItem("versus.aventDecal", String(f.decal)); }, { ouvertes: o.ouvertes, admin: o.admin, decal: o.decal });
  await p.goto(URL); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(o.attente || 3800);   // l'état du serveur arrive 2,5 s après le démarrage
  await p.evaluate(() => document.querySelectorAll(".tuto").forEach(x => x.remove()));   // les annonces du jour (Nouvelles règles…) : on les ferme, comme le pilote
  await p.evaluate(() => { try { allerA("trophees"); } catch (e) { } }); await p.waitForTimeout(300);   // Avent 26/11 : le calendrier vit dans l'onglet Podium
  return { ctx, p, err, o };
}
const grille = () => { const c = cls => [...document.querySelectorAll(".av-c." + cls)].map(x => +x.dataset.av).sort((a, b) => a - b); return { manquee: c("manquee"), vue: c("vue"), jour: c("jour"), ferme: c("ferme"), libre: c("libre") }; };
const entree = () => { const x = document.querySelector("#v-trophees > .av-entree"); return x ? { t: x.innerText, pas: !!x.querySelector(".av-pas") } : null; };
const deborde = () => [...document.querySelectorAll(".av-ov *, .av-case *, .av-entree, .av-entree *")].filter(e => !e.closest(".av-neige") && !e.closest(".av-porte")).filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(e => e.className).slice(0, 5);
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  // 1 · le 9/12 : cases 1, 2, 5, 7 ouvertes le jour même (serveur d'accord) ; 3, 4, 6, 8 manquées ; 9 = case du jour ; 10 à 24 fermées. Clair puis sombre.
  for (const sombre of [false, true]) {
    const tag = sombre ? " (sombre)" : " (clair)", o = { tel: "2026-12-09T10:00:00", sombre, ouvertes: [1, 2, 5, 7], casesSrv: [1, 2, 5, 7] };
    const { ctx, p, err } = await page(b, o);
    const e = await p.evaluate(entree);
    ok(e && /la case du 9 t'attend, aujourd'hui seulement/.test(e.t) && /Une case par jour : à ouvrir le jour même, sinon elle est perdue ❄️/.test(e.t) && /plaque dorée perdue \(case du 3 manquée\)/.test(e.t) && e.pas, "9/12 · l'entrée du Classement : case du jour (pastille), la règle, « ❄️ plaque dorée perdue (case du 3 manquée) » " + JSON.stringify(e) + tag);
    ok(!(await p.evaluate(deborde)).length, "390 px : l'entrée ne déborde pas" + tag);
    await p.screenshot({ path: DOSSIER + "/entree-9dec" + (sombre ? "-sombre" : "") + ".png", clip: { x: 0, y: 0, width: 390, height: 360 } });
    await p.click(".av-entree"); await p.waitForTimeout(500);
    const g = await p.evaluate(grille);
    ok(g.manquee.join() === "3,4,6,8" && g.vue.join() === "1,2,5,7" && g.jour.join() === "9" && g.ferme.length === 15 && g.ferme[0] === 10 && !g.libre.length, "9/12 · manquées 3, 4, 6, 8 ; ouvertes 1, 2, 5, 7 ; du jour 9 ; fermées 10 à 24 " + JSON.stringify(g) + tag);
    const h = await p.evaluate(() => ({ h: document.querySelector(".av-h").innerText, m: document.querySelector('.av-c[data-av="3"]').innerText, a: document.querySelector('.av-c[data-av="3"]').getAttribute("aria-label") }));
    ok(/à ouvrir le jour même, sinon elle est perdue ❄️/.test(h.h) && !/t'attend le 24/.test(h.h) && /plaque dorée perdue/.test(h.h) && /❄️ Manquée/.test(h.m) && /manquée/.test(h.a), "l'aide du calendrier : la règle et le compte (plaque dorée perdue : plus de « t'attend le 24 ») ; la porte 3 dit « ❄️ Manquée » " + JSON.stringify(h) + tag);
    ok(!(await p.evaluate(deborde)).length, "390 px : le calendrier ne déborde pas" + tag);
    await p.screenshot({ path: DOSSIER + "/calendrier-9dec" + (sombre ? "-sombre" : "") + ".png" });
    await p.click('.av-c[data-av="3"]'); await p.waitForTimeout(400);
    const zt = await p.evaluate(() => { const t = document.getElementById("toast"), r = t.getBoundingClientRect(), e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { z: getComputedStyle(t).zIndex, dessus: !t.hidden && !!e && !!e.closest("#toast") }; });
    ok(zt.z === "99" && zt.dessus, "le message de la case manquée s'affiche AU-DESSUS du calendrier " + JSON.stringify(zt) + tag);
    if (!sombre) await p.screenshot({ path: DOSSIER + "/toast-manquee.png" });
    const m = await p.evaluate(() => { const c = !!document.querySelector(".av-case"); const t = [...document.querySelectorAll(".toast, #toast")].map(x => x.textContent).join(" "); ouvrirCaseAvent(3); marquerOuverte(3); return { c, force: !!document.querySelector(".av-case"), noteé: aventOuvertes().includes(3), t }; });
    ok(!m.c && !m.force && !m.noteé && /Case manquée/.test(m.t), "case 3 manquée : ne s'ouvre pas (même en forçant), jamais notée, un message le dit " + JSON.stringify(m) + tag);
    await p.click('.av-c[data-av="5"]'); await p.waitForTimeout(500);
    ok(await p.evaluate(() => /blague/i.test((document.querySelector(".av-case h3") || {}).textContent || "")), "case 5, ouverte le jour même : rejouable" + tag);
    await p.evaluate(() => document.querySelector(".av-case [data-av-fermer]").click());
    await p.click('.av-c[data-av="9"]'); await p.waitForTimeout(1500);
    const c9 = await p.evaluate(() => ({ c: !!document.querySelector(".av-case"), vu: aventOuvertes().includes(9), file: localStorage.getItem("versus.aventCases") }));
    ok(c9.c && c9.vu && o.srv.envois.some(x => x.action === "aventCase" && x.jour === 9 && Object.keys(x).sort().join() === "action,cle,jour") && o.srv.cases.includes(9) && c9.file === "[]", "case 9, le jour J : s'ouvre, « case 9 ouverte » part au serveur (rien d'autre), qui l'accepte " + JSON.stringify(c9) + tag);
    ok(!err.length, "1 · 0 erreur JS " + JSON.stringify(err) + tag); await ctx.close();
  }
  // 2 · triche : le téléphone avance au 12/12 alors que le serveur est le 9/12 ; il voudrait ouvrir la 12 → le serveur refuse, l'appli se cale sur son heure
  { const o = { tel: "2026-12-12T10:00:00", serveur: "2026-12-09T10:00:00", ouvertes: [9], casesSrv: [9] }; o.horsLigne = true; const { ctx, p, err } = await page(b, o);
    const avant = await p.evaluate(() => ({ jour: aventJour() }));   // pas de réponse du serveur (hors réseau) : la date de l'appareil
    o.horsLigne = false; await p.evaluate(() => { AVENT_SRV_T = 0; return chargerAvent(true); }); await p.waitForTimeout(900);
    const apres = await p.evaluate(() => { ouvrirAvent(); const g = (cls => [...document.querySelectorAll(".av-c." + cls)].map(x => +x.dataset.av)); return { jour: aventJour(), j: g("jour"), m: g("manquee"), ok12: caseOuvrable(12) }; });
    ok(avant.jour === 12 && apres.jour === 9 && apres.j.join() === "" && !apres.ok12 && apres.m.length === 8, "téléphone au 12/12, serveur au 9/12 : l'appli se cale sur le serveur (case du jour = 9, la 12 reste fermée) " + JSON.stringify({ avant, apres }));
    // même scénario si la case 12 avait été ouverte hors ligne (date du téléphone) : à la reconnexion, le serveur refuse, la case disparaît
    await p.evaluate(() => { AVENT_DECAL = 0; stock.set("versus.avent", "[9,12]"); stock.set("versus.aventCases", "[12]"); }); o.serveur = "2026-12-13T10:00:00";   // le vrai lendemain du 12 : la 12 est d'hier
    await p.evaluate(() => envoyerFileAvent()); await p.waitForTimeout(900);
    const r = await p.evaluate(() => ({ ouv: aventOuvertes(), file: fileCases(), jour: aventJour(), m12: caseManquee(12) }));
    ok(r.ouv.join() === "9" && !r.file.length && r.jour === 13 && r.m12 && !o.srv.cases.includes(12), "case 12 ouverte hors délai : refusée par le serveur, retirée de l'appareil, affichée « Manquée » " + JSON.stringify(r));
    ok(!err.length, "2 · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 3 · hors réseau : la date de l'appareil (case du jour ouvrable), l'ouverture attend en file ; à la reconnexion, le serveur confirme
  { const o = { tel: "2026-12-10T08:00:00", ouvertes: [], casesSrv: [], attente: 600 }; o.horsLigne = true; const { ctx, p, err } = await page(b, o);
    const r1 = await p.evaluate(async () => { ouvrirAvent(); document.querySelector('.av-c[data-av="10"]').click(); await new Promise(r => setTimeout(r, 1200)); return { c: !!document.querySelector(".av-case"), vu: aventOuvertes().includes(10), file: fileCases() }; });
    const at = await p.evaluate(() => texteCompteAvent());
    ok(/0\/24/.test(at) && /⏳ case du 10 pas encore comptée \(pas de réseau\)/.test(at), "hors réseau : le compteur ne compte pas encore la case 10 (« ⏳ pas encore comptée ») " + JSON.stringify(at));
    ok(r1.c && r1.vu && r1.file.join() === "10", "hors réseau, le 10/12 : la case du jour s'ouvre (date de l'appareil), « case 10 ouverte » attend en file " + JSON.stringify(r1));
    o.horsLigne = false; await p.evaluate(() => { AVENT_SRV_T = 0; return chargerAvent(true); }); await p.waitForTimeout(1200);
    const r2 = await p.evaluate(() => ({ file: fileCases(), ouv: aventOuvertes(), cpt: texteCompteAvent() }));
    ok(!r2.file.length && r2.ouv.join() === "10" && o.srv.cases.join() === "10" && /9 manquée|case du 1 manquée/.test(r2.cpt), "réseau revenu : le serveur confirme la case 10, la file se vide ; le compte dit la plaque dorée perdue " + JSON.stringify(r2));
    ok(!err.length, "3 · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 3 bis · une case ouverte PENDANT un envoi (serveur lent, 2 records en file) part quand même
  { const o = { tel: "2026-12-09T10:00:00", ouvertes: [7, 8], casesSrv: [7, 8] }, { ctx, p, err } = await page(b, o); o.lent = 2500;
    await p.evaluate(async () => { stock.set("versus.aventFile", JSON.stringify({ memory: { s: 20, deja: 0 }, cheminees: { s: 100, deja: 0 } })); envoyerFileAvent(); await new Promise(z => setTimeout(z, 300)); marquerOuverte(9); });
    await p.waitForTimeout(9000);
    const r = await p.evaluate(() => ({ file: fileCases(), recs: Object.keys(fileAvent()) }));
    ok(o.srv.cases.includes(9) && !r.file.length && !r.recs.length, "serveur lent, 2 records en file, case 9 ouverte pendant l'envoi : au bout de 9 s le serveur a la case 9, les files sont vides " + JSON.stringify(r));
    ok(!err.length, "3 bis · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 3 ter · l'écart d'heure avec le serveur est gardé : dès le démarrage (même hors réseau), la case du jour est celle du serveur
  { const o = { tel: "2026-12-12T10:00:00", decal: -3 * 86400000, attente: 300 }; o.horsLigne = true; const { ctx, p, err } = await page(b, o);
    const j = await p.evaluate(() => aventJour());
    ok(j === 9, "téléphone au 12/12, écart connu de -3 jours : dès le démarrage, la case du jour est la 9 " + j);
    ok(!err.length, "3 ter · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 4 · le serveur connaît une case ouverte sur un autre appareil : elle revient ici (une seule vérité)
  { const o = { tel: "2026-12-06T10:00:00", ouvertes: [1], casesSrv: [1, 2, 3, 4, 5] }, { ctx, p, err } = await page(b, o);
    const r = await p.evaluate(() => ({ ouv: aventOuvertes(), cpt: texteCompteAvent(), e: document.querySelector(".av-entree").innerText }));
    ok(r.ouv.join() === "1,2,3,4,5" && /5\/24 · encore possible/.test(r.cpt) && /5\/24 · encore possible/.test(r.e) && /t'attend le 24/.test(r.e), "cases ouvertes sur un autre téléphone : reprises du serveur ; « 🏅 5/24 · encore possible », la plaque dorée annoncée " + JSON.stringify(r));
    await p.click(".av-entree"); await p.waitForTimeout(400);
    ok(await p.evaluate(() => /plaque Hiver 2026 dorée t'attend le 24/.test(document.querySelector(".av-h").innerText)), "encore possible : l'aide du calendrier annonce la plaque dorée"); await p.screenshot({ path: DOSSIER + "/calendrier-6dec-encore-possible.png" });
    ok(!err.length, "4 · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 5 · du 25 au 31 : rien de nouveau (la 24 était la dernière) ; les cases ouvertes restent rejouables
  { const o = { tel: "2026-12-27T10:00:00", ouvertes: [1, 24], casesSrv: [1, 24] }, { ctx, p, err } = await page(b, o);
    const r = await p.evaluate(() => { ouvrirAvent(); const g = (cls => [...document.querySelectorAll(".av-c." + cls)].map(x => +x.dataset.av)); return { e: document.querySelector(".av-entree").textContent,   /* la page est cachée sous le calendrier ouvert (Avent 26/11) : textContent */ pas: !!document.querySelector(".av-entree .av-pas"), jour: g("jour"), vue: g("vue").sort((a, b) => a - b), m: g("manquee").length, ferme: g("ferme").length }; });
    ok(/joyeux Noël/.test(r.e) && !r.pas && !r.jour.length && r.vue.join() === "1,24" && r.m === 22 && r.ferme === 0, "27/12 : pas de case du jour, pas de pastille ; 1 et 24 rejouables, les 22 autres manquées " + JSON.stringify(r));
    ok(!err.length, "5 · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 5 bis · Noël sans avoir ouvert la 24 : « ton souvenir t'attend dans l'écurie » ; la case 24 manquée le redit ; la règle ne se répète plus
  { const o = { tel: "2026-12-27T10:00:00", ouvertes: [1], casesSrv: [1] }, { ctx, p, err } = await page(b, o);
    const e = await p.evaluate(entree);
    await p.evaluate(() => ouvrirAvent()); await p.waitForTimeout(300); await p.click('.av-c[data-av="24"]'); await p.waitForTimeout(300);
    const t = await p.evaluate(() => document.getElementById("toast").textContent);
    ok(/joyeux Noël ! ton souvenir t'attend dans l'écurie/.test(e.t) && !/Une case par jour/.test(e.t) && !/t'attend le 24/.test(e.t) && /Case manquée : elle ne s'ouvrait que le 24 décembre\. Ton souvenir \(plaque Hiver 2026 et traînée Flocons\) t'attend quand même dans l'écurie\./.test(t) && await p.evaluate(() => debloques("Clément").has("plaque.hiver26")), "27/12, case 24 pas ouverte : « joyeux Noël ! ton souvenir t'attend dans l'écurie », le message de la 24 manquée le redit, le souvenir est bien là " + JSON.stringify({ e: e.t, t }));
    // une annonce (Nouvelles règles) déjà ouverte : le calendrier attend sa fermeture (une seule fenêtre à la fois)
    const a = await p.evaluate(async () => { document.querySelectorAll(".av-ov").forEach(x => x.remove()); const tu = document.createElement("div"); tu.className = "tuto"; document.body.appendChild(tu); ouvrirAvent(); const avant = !!document.querySelector(".av-ov"); tu.remove(); await new Promise(r => setTimeout(r, 100)); return { avant, apres: !!document.querySelector(".av-ov") }; });
    ok(!a.avant && a.apres, "une annonce déjà ouverte passe d'abord : le calendrier s'ouvre à sa fermeture " + JSON.stringify(a));
    ok(!err.length, "5 bis · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 6 · 🏅 plaque Hiver 2026 dorée : Clément ouvre la 24 le 24/12 avec 23 cases déjà ouvertes → dorée (serveur) ; Kévin 23/24 → normale
  { const vingt3 = Array.from({ length: 23 }, (_, i) => i + 1), o = { tel: "2026-12-24T09:00:00", ouvertes: vingt3, casesSrv: vingt3 }, { ctx, p, err } = await page(b, o);
    const a = await p.evaluate(() => ({ d: debloques("Clément").has("plaque.hiverdore"), n: debloques("Clément").has("plaque.hiver26") }));
    await p.evaluate(() => ouvrirAvent()); await p.click('.av-c[data-av="24"]'); await p.waitForTimeout(2200);
    const r = await p.evaluate(() => ({ cl: debloques("Clément").has("plaque.hiverdore"), kv: debloques("Kévin").has("plaque.hiverdore"), kvn: debloques("Kévin").has("plaque.hiver26"), cad: !!document.querySelector(".av-case .pl-hiverdore"), txt: document.querySelector(".av-case").innerText,
      ids: idsSlot("plaque"), orig: texteOrigineItem("Clément", "plaque", "hiverdore"), cpt: texteCompteAvent(), cache: localStorage.getItem("versus.aventDores") }));
    ok(!a.d && a.n && r.cl && !r.kv && r.kvn && r.ids.includes("hiverdore") && r.ids.includes("hiver26") && /24 sur 24/.test(r.orig.t), "24/12 : 23/24 → pas encore dorée ; Clément ouvre la 24 → le serveur le met à 24/24 : plaque dorée (en plus de la normale) ; Kévin garde la normale " + JSON.stringify({ a, cl: r.cl, kv: r.kv, ids: r.ids.filter(x => /hiver/.test(x)), orig: r.orig.t }));
    ok(r.cad && /24 cases sur 24/i.test(r.txt) && /24\/24 · plaque Hiver 2026 dorée gagnée/.test(r.cpt), "case 24 : la plaque dorée s'affiche, « 🏅 24/24 · plaque Hiver 2026 dorée gagnée ! » " + JSON.stringify(r.cpt));
    await p.screenshot({ path: DOSSIER + "/case-24-doree.png" }); await p.emulateMedia({ colorScheme: "dark" }); await p.screenshot({ path: DOSSIER + "/case-24-doree-sombre.png" });
    ok(/"fin":false/.test(r.cache || "") && /Clément/.test(r.cache || ""), "la liste dorée du serveur est gardée sur l'appareil " + r.cache);
    // dans l'écurie : la plaque dorée se porte, se dessine (plaque + vignette)
    const ec = await p.evaluate(() => { document.querySelectorAll(".av-case,.av-ov").forEach(x => x.remove()); return { pl: plaqueDeTest(), v: (() => { try { return /svg/.test(svgObjet("plaque", "hiverdore", 64)); } catch (e) { return "err " + e.message; } })() };
      function plaqueDeTest() { D.ecurie = { Clément: { equip: { plaque: "hiverdore" } } }; MEMO_SAISON = { d: null, m: {} }; return equipDe("Clément").plaque; } });
    ok(ec.pl === "hiverdore" && ec.v === true, "écurie : Clément porte la plaque « Hiver 2026 doré », sa vignette se dessine " + JSON.stringify(ec));
    await p.evaluate(() => { document.body.insertAdjacentHTML("beforeend", '<div id="t-plaques" style="position:fixed;top:120px;left:16px;right:16px;z-index:999;display:grid;gap:10px;padding:16px;background:var(--panel);border-radius:12px">' +
      '<span class="plaque grande pl-hiver26">' + iconePlaque("hiver26") + "Hiver 2026</span>" + '<span class="plaque grande pl-hiverdore">' + iconePlaque("hiverdore") + "Hiver 2026 doré</span>" + '<div style="display:flex;gap:10px">' + svgObjet("plaque", "hiver26", 64) + svgObjet("plaque", "hiverdore", 64) + "</div></div>"); });
    await p.screenshot({ path: DOSSIER + "/plaques-hiver-sombre.png", clip: { x: 0, y: 100, width: 390, height: 260 } }); await p.emulateMedia({ colorScheme: "light" }); await p.screenshot({ path: DOSSIER + "/plaques-hiver.png", clip: { x: 0, y: 100, width: 390, height: 260 } });
    ok(!err.length, "6 · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 6 bis · changer la date du téléphone ne donne rien : téléphone au 24/12, serveur au 20/12, 24 cases notées sur l'appareil → pas de plaque dorée
  { const toutes = Array.from({ length: 24 }, (_, i) => i + 1), o = { tel: "2026-12-24T09:00:00", serveur: "2026-12-20T09:00:00", ouvertes: toutes, casesSrv: toutes.slice(0, 20) }, { ctx, p, err } = await page(b, o);
    const r = await p.evaluate(() => ({ d: debloques("Clément").has("plaque.hiverdore"), ids: idsSlot("plaque").filter(x => /hiver/.test(x)), ouv: aventOuvertes().length, j: aventJour() }));
    ok(!r.d && !r.ids.includes("hiverdore") && r.ouv === 20 && r.j === 20, "téléphone avancé au 24/12 (serveur au 20/12) : pas de plaque dorée, l'appli revient à 20 cases et au 20/12 " + JSON.stringify(r));
    ok(!err.length, "6 bis · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 6 ter · en 2027 : la liste dorée est relue du serveur (définitive) et reste ; la plaque dorée se porte toujours
  { const o = { tel: "2027-02-10T10:00:00", ouvertes: [], casesSrv: [], dores: ["Clément", "Devlin"] }, { ctx, p, err } = await page(b, o);
    const r = await p.evaluate(() => ({ cl: debloques("Clément").has("plaque.hiverdore"), dv: debloques("Devlin").has("plaque.hiverdore"), kv: debloques("Kévin").has("plaque.hiverdore"), cache: localStorage.getItem("versus.aventDores"), entree: !!document.querySelector(".av-entree") }));
    const n1 = o.srv.envois.length; await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes); await p.waitForTimeout(1500);
    ok(r.cl && r.dv && !r.kv && /"fin":true/.test(r.cache) && !r.entree && o.srv.envois.length === n1 && await p.evaluate(() => debloques("Clément").has("plaque.hiverdore")), "février 2027 : plaque dorée de Clément et Devlin (liste définitive du serveur, gardée ; plus redemandée), pas de calendrier " + JSON.stringify(r));
    ok(!err.length, "6 ter · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  // 7 · aperçu admin inchangé (toutes les cases, rien gardé ni envoyé) ; simulation de date : rien n'est envoyé
  { const o = { tel: "2026-12-09T10:00:00", session: ADMIN, admin: true, ouvertes: [] }, { ctx, p, err } = await page(b, o);
    const n0 = o.srv.envois.filter(c => c.action === "aventCase").length;
    const a = await p.evaluate(async () => { apercuAvent(); const r = { ferme: document.querySelectorAll(".av-c.ferme").length, man: document.querySelectorAll(".av-c.manquee").length, ok3: caseOuvrable(3) }; ouvrirCaseAvent(3); marquerOuverte(3); r.c = !!document.querySelector(".av-case"); await new Promise(x => setTimeout(x, 600)); r.vu = aventOuvertes().length; r.file = fileCases().length; return r; });
    ok(a.ferme === 0 && a.man === 0 && a.ok3 && a.c && !a.vu && !a.file && o.srv.envois.filter(c => c.action === "aventCase").length === n0, "aperçu admin : toutes les cases ouvrables (aucune manquée), rien gardé ni envoyé " + JSON.stringify(a));
    ok(!err.length, "7 · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  { const o = { tel: "2026-11-26T10:00:00", session: ADMIN, admin: true }, { ctx, p, err } = await page(b, o);
    await p.evaluate(() => { localStorage.setItem("versus.vueJoueur", "Clément"); localStorage.setItem("versus.dateSim", "2026-12-09"); }); await p.reload(); await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes); await p.waitForTimeout(3500);
    const s = await p.evaluate(async () => { ouvrirAvent(); const r = { sim: simulation(), jour: aventJour(), man: document.querySelectorAll(".av-c.manquee").length }; document.querySelector('.av-c[data-av="9"]').click(); await new Promise(x => setTimeout(x, 1200)); r.c = !!document.querySelector(".av-case"); r.vrai = localStorage.getItem("versus.avent"); r.file = localStorage.getItem("versus.aventCases"); return r; });
    ok(s.sim && s.jour === 9 && s.man === 8 && s.c && !s.vrai && !s.file && !o.srv.envois.some(c => c.action === "aventCase"), "simulation au 9/12 (vue joueur) : 8 cases manquées, la 9 s'ouvre pour voir, rien n'est envoyé ni gardé " + JSON.stringify(s));
    ok(!err.length, "7 bis · 0 erreur JS " + JSON.stringify(err)); await ctx.close(); }
  await b.close(); console.log(ko.length ? "\n" + ko.length + " NON" : "\nTout est OUI"); process.exit(ko.length ? 1 : 0);
})();
