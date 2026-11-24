/* Test v20.26 · « jamais un montant des autres » (écrit avec l'agent jeu-code-donnees).
   Parcourt toute l'appli avec de FAUSSES données masquées par la VRAIE fonction du serveur (vsMasquerMontants_, lue dans app_scripts/versus/API.js),
   côté simple joueur (Kévin) et côté admin (Théo). Le pilote connecté a plus de 1 M€ : tout montant < 60 000 € affiché trahit donc un autre pilote.
   Lancer depuis la racine du dépôt, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/teuros.js
   (API_VERSUS=/chemin/vers/API.js si app_scripts n'est pas à côté de ce dépôt) */
const { chromium } = require("playwright"), fs = require("fs");
const API = fs.readFileSync(process.env.API_VERSUS || __dirname + "/../../app_scripts/versus/API.js", "utf8");
const masquer = eval("(" + API.match(/function vsMasquerMontants_\(o, nomMoi\) \{[\s\S]*?\n\}\n/)[0].replace("function vsMasquerMontants_", "function") + ")");
const tn = fs.readFileSync(__dirname + "/tnicolas.js", "utf8");
const fausses = eval("(" + tn.match(/function fausses\(avecNicolas\) \{[\s\S]*?\n\}/)[0].replace("function fausses(avecNicolas)", "function (avecNicolas)") + ")");
eval(tn.match(/const ligne = [\s\S]*?\n\}\n/)[0].replace(/^const ligne/, "global.ligne").replace(/\nfunction joueur/, "\nglobal.joueur = function"));
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const KS = []; for (let y = 2025; y <= 2027; y++) for (let m = 1; m <= 12; m++) { const k = y * 100 + m; if (k <= 202701) KS.push(k); }
function pilote(nom, base) {
  const st = [{ v: 0, cum: 0 }, { v: 0, cum: 0 }], rows = [];
  KS.forEach((k, i) => { const sai = [], calc = [];
    const env = [0, 1].map(e => { const prev = st[e].v; const verse = i === 0 ? base * (e ? .4 : .6) : (rnd() < .6 ? Math.round((.01 + rnd() * .02) * base) : 0);
      const val = Math.round((prev + verse) * (1 + (rnd() - .45) * .08) * 100) / 100, gain = val - prev - verse, den = prev + verse / 2;
      st[e].cum += verse; st[e].v = val; return { verse, val, gain, r: den > 0 ? gain / den : null, cum: st[e].cum, prev }; });
    env.forEach(x => sai.push(x.verse, x.val)); sai.push(null, null, null, null);
    const T = { verse: env[0].verse + env[1].verse, val: env[0].val + env[1].val, prev: env[0].prev + env[1].prev, cum: env[0].cum + env[1].cum };
    T.gain = T.val - T.prev - T.verse; T.r = T.gain / (T.prev + T.verse / 2 || 1); if (!(T.prev + T.verse / 2 > 0)) T.r = null;
    [T, env[0], env[1]].forEach(x => calc.push(x.verse, x.val, x.gain, x.r, x.cum)); for (let j = 0; j < 10; j++) calc.push(0);
    rows.push([k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", sai, calc]); });
  return { nom, rows };
}
async function parcours(b, moi, session) {
  const d = fausses(true);
  d.personnes = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"].map(n => pilote(n, n === moi ? 5e6 : 20000 + 90000 * rnd()));
  d.marche.mois = KS.map(k => [k, .004, .006, .002]);
  d.journal = d.personnes.map((p, i) => ({ ligne: 2 + i, t: "2027-02-03T10:00:00+01:00", personne: p.nom, cle: 202701, action: "Saisie", par: p.nom, avant: p.rows[p.rows.length - 2][2], apres: p.rows[p.rows.length - 1][2], statut: "" }));
  d.objectifs = d.personnes.map(p => ({ personne: p.nom, objectif: 900000, valeur: 800000, projection: 950000, ecart: 50000 }));
  const m = masquer(JSON.parse(JSON.stringify(d)), moi); m.session = session;
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2027-02-05T10:00:00"));
  await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(m) }));
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.tuto1", "1"); sessionStorage.setItem("versus.adminOn", "1"); });
  await p.goto("http://localhost:8771/index.html");
  await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
  await p.waitForTimeout(1500);
  const res = await p.evaluate(async moi => {
    const w = (t = 400) => new Promise(r => setTimeout(r, t)), autres = D.personnes.map(x => x.nom).filter(n => n !== moi), vus = [];
    const re = /(?:[−+-]\s?)?\d[\d\s  .,]*\s?€/g;
    const scan = ou => { const h = document.body.innerHTML.replace(/<[^>]+>/g, " ") + " " + [...document.querySelectorAll("[title],[aria-label],[data-cv]")].map(e => (e.getAttribute("title") || "") + " " + (e.getAttribute("aria-label") || "") + " " + (e.dataset.cf === "eur" ? e.dataset.cv + " €" : "")).join(" ");
      (h.match(re) || []).forEach(x => { const v = Math.abs(parseFloat(x.replace(/[^\d,]/g, "").replace(",", "."))); if (v > 0.5 && v < 60000) vus.push(ou + " : " + x.trim()); }); };
    const ouvrir = () => document.querySelectorAll("details").forEach(x => x.open = true);
    allerA("classement"); await w(); ouvrir(); scan("classement");
    for (const el of [...document.querySelectorAll("#v-classement .pos[data-nom]")]) { el.click(); await w(200); scan("classement détail " + el.dataset.nom); }
    for (const per of ["mois", "6m", "ytd", "12m", "tout"]) { ETAT.per = per; for (const env of [0, 1, 2]) { ETAT.env = env; allerA("classement"); await w(150); scan("classement " + per + "/" + env);
      for (const n of D.personnes.map(x => x.nom)) { ETAT.fiche = n; allerA("fiche"); await w(150); ouvrir(); document.querySelectorAll("#v-fiche [aria-expanded=false]").forEach(b => { try { b.click(); } catch (e) {} }); await w(100); scan("fiche " + n + " " + per + "/" + env); } } }
    for (const v of ["mois", "trophees"]) { allerA(v); await w(); ouvrir(); scan(v); }
    try { ouvrirRecap(202701); await w(500); scan("récap janv."); document.querySelectorAll(".wr, .wrap-recap, [class*=recap]").forEach(() => {}); } catch (e) { vus.push("ouvrirRecap a planté " + e.message); }
    try { ouvrirBilan(2026); await w(500); scan("bilan 2026"); } catch (e) { vus.push("ouvrirBilan a planté " + e.message); }
    try { for (const n of D.personnes.map(x => x.nom)) { JNOM = n; ongletReleves("journal"); await w(150); scan("journal " + n); } } catch (e) { vus.push("journal a planté " + e.message); }
    let saisie = null;
    try { ouvrirSaisie(); await w(400); document.querySelectorAll(".guide, [data-guide-fermer]").forEach(()=>{}); const chips = [...document.querySelectorAll("#corps-saisie [data-rp]")].map(b => b.dataset.rp);
      saisie = { chips, peut: D.personnes.map(x => x.nom + "=" + peutModifier(x.nom)).join(" ") };
      const autre = chips.find(n => n !== moi); if (autre) { document.querySelector('#corps-saisie [data-rp="' + autre + '"]').click(); await w(300); saisie.autreForm = !!document.querySelector("#form-releve"); saisie.prerempli = [...document.querySelectorAll("#form-releve input")].map(i => i.value).filter(Boolean).slice(0, 4); saisie.vraiPrerempli = D.personnes.find(x=>x.nom===autre).rows.slice(-1)[0][2].slice(0,4); saisie.bouton = !!document.querySelector("#form-releve [type=submit]"); saisie.texte = document.querySelector("#corps-saisie").innerText.replace(/\n+/g," | ").slice(0,500); scan("saisie de " + autre); }
    } catch (e) { saisie = "plante " + e.message; }
    return { vus: [...new Set(vus)], saisie };
  }, moi);
  await ctx.close(); return { err, ...res };
}
(async () => {
  const b = await chromium.launch(), ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  for (const [moi, s] of [["Kévin", { role: "perso", nom: "Kévin" }], ["Théo", { role: "admin" }]]) {
    const r = await parcours(b, moi, s);
    ok(!r.err.length, "vue de " + moi + " : 0 erreur JS " + r.err.join(" | "));
    const autres = r.vus.filter(x => !x.startsWith("fiche " + moi + " ") && !x.startsWith("journal " + moi + " "));   // ses propres euros : normal
    ok(!autres.length, "vue de " + moi + " : aucun montant d'un autre pilote " + autres.slice(0, 5).join(" ; "));
    ok(r.saisie && Array.isArray(r.saisie.chips) && r.saisie.chips.join() === moi, "vue de " + moi + " : la saisie ne propose que " + moi + " " + JSON.stringify(r.saisie && r.saisie.chips));
  }
  await b.close(); process.exit(ko.length ? 1 : 0);
})();
