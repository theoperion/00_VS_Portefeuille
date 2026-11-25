/* Test (refonte des badges) · « Aucun point du championnat ne doit changer » : une fausse saison 2027 complète
   (5 pilotes, 12 mois de rendements INVENTÉS, versements, cartes dont des Paris, pronostics avec pole, rivaux, un relevé en retard
   rattrapé par le délai de 7 jours, Nicolas qui entre en cours de saison), puis championnat(2027) : points par pilote et par mois,
   places, classement final. Le résultat est comparé à une EMPREINTE enregistrée ici avant la refonte : il doit être identique au centime.
   Lancer depuis la racine du dépôt, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tpoints-fige.js
   (FIGER=1 node outils-tests/tpoints-fige.js : affiche l'empreinte du code actuel, pour la recopier ici). */
const { chromium } = require("playwright"), crypto = require("crypto");
// règles avril/juin changées le 25/11 par Théo (v20.52) : ancienne empreinte d347f473dc42e5856f423f5e3d5b40502b64c0c27ec1538386031a22d3c6c0f4 (refonte des badges).
// Seuls écarts, tous expliqués par ces règles : avril (plus de cumul mars + avril : Théo 1er devant Kévin ; 🎯 à +2 pour Théo, Kévin, Devlin ; pronostics « qui gagne » de Kévin −1 et Devlin +1)
// et juin (Côté obscur : Clément, dernier du championnat, finit dernier du mois → 2 points de place au lieu de 0, moins son Pari −1 = 1 au lieu de 0). Totaux : Théo 79→82, Kévin 120→118, Devlin 73→75, Clément 15→16, Nicolas 28.
const EMPREINTE = "8fb6c423162e3d158b0ead9f4621d9d8b91939b5b8970e97b9af1761cbcd302c";
const NOMS = ["Théo", "Kévin", "Clément", "Devlin", "Nicolas"];
const IDX = ["S&P 500", "Nasdaq-100", "Or (non couvert)", "MSCI Monde", "Euro Stoxx 50", "Marchés émergents", "Semi-conducteurs"];
// générateur fixe (aucun hasard d'une exécution à l'autre)
function alea(s) { return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; }
const KS = [202610, 202611, 202612].concat(Array.from({ length: 12 }, (_, i) => 202701 + i));
function rend(nom, k) { const r = alea([...(nom + k)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483647); r(); return Math.round((-0.06 + 0.14 * r()) * 10000) / 10000; }
const ligne = (k, val, r, verse) => [k, String(k).slice(0, 4) + "-" + String(k).slice(4) + "-28", [0, val, 0, 0, null, null, null, null], [verse, val, 0, r, 0].concat(Array(20).fill(0))];
function personne(nom, i) {
  const rows = []; let val = 1000 + 100 * i;
  KS.forEach(k => {
    if (nom === "Nicolas" && k < 202702) return;                       // Nicolas : premier relevé en février, il joue à partir de mars
    if (nom === "Devlin" && k === 202705) return;                      // relevé de mai jamais arrivé : le mois se joue sans lui (délai de 7 jours passé)
    const r = nom === "Nicolas" && k === 202702 ? null : rend(nom, k), verse = (k + i) % 3 ? 50 : 0;
    val = Math.round(val * (1 + (r || 0)) + verse); rows.push(ligne(k, val, r === null ? 0 : r, verse));
  });
  return { nom, rows };
}
const CARTES = ["turbo", "aspiration", "pluie", "pari", "turbo", "pari", "aspiration", "pluie", "pari", "turbo", "aspiration", "pari"];
function donnees() {
  const cartes = { 2027: {} }, pronos = { 2027: {} }, rivaux = { 2027: {} };
  NOMS.forEach((nom, i) => {
    cartes[2027][nom] = {}; pronos[2027][nom] = {};
    for (let m = 1; m <= 12; m++) { const k = 202700 + m, c = CARTES[(m + i) % 12];
      cartes[2027][nom][k] = c === "pari" ? { c, cible: NOMS[(i + m) % 5] === nom ? NOMS[(i + 1) % 5] : NOMS[(i + m) % 5] } : { c };
      pronos[2027][nom][k] = { v: NOMS[(i * 2 + m) % 5], i: (m + i) % 2 ? "h" : "b", p: Math.round((-2 + ((m * 7 + i * 3) % 9) * 0.6) * 10) / 10 }; }
    rivaux[2027][nom] = { r: NOMS[(i + 2) % 5] };
  });
  return { ok: true, version: 85, genere: "2028-01-20T10:00:00", majTexte: "", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: NOMS.map(personne),
    marche: { indices: IDX, mois: KS.map(k => [k].concat(IDX.map((n, j) => Math.round((-0.04 + 0.08 * alea(k * 7 + j)()) * 10000) / 10000))), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 7, ecurie: {}, exclusifs: {}, cartes, duels: {}, pronos, votes: {}, rivaux, etapes: {},
    liaison: { active: true, personnes: [] }, lignes: {}, premierMillion: null, session: { role: "perso", nom: "Théo" }, monRappel: null, rappelsReleve: {},
    mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {}, monVote: {} };
}
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }), p = await ctx.newPage(), err = [];
  p.on("pageerror", e => err.push(e.message));
  await p.clock.setFixedTime(new Date("2028-01-20T10:00:00"));
  await p.route("https://script.google.com/**", r => { const c = JSON.parse(r.request().postData() || "{}");
    if (c.action === "tresors") return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, tresors: [], trouves: [], total: 0 }) });
    r.fulfill({ contentType: "application/json", body: JSON.stringify(donnees()) }); });
  await p.addInitScript(() => { localStorage.setItem("versus.cle", "x"); localStorage.setItem("versus.tuto1", "1"); });
  await p.goto("http://localhost:8771/index.html");
  await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 }); await p.waitForTimeout(1200);
  const res = await p.evaluate(() => { MEMO_SAISON = { d: null, m: {} }; const c = championnat(2027);
    return { complete: c.complete, classement: c.classement, tot: Object.fromEntries(Object.entries(c.tot).map(([n, t]) => [n, { pts: t.pts, v: t.v, pod: t.pod, bonus: t.bonus, n: t.n }])),
      mois: c.mois.map(m => ({ k: m.k, places: m.places, cumul: m.cumul, l: m.l.map(x => [x.nom, x.rg, x.p, x.base, x.bonus, x.carte ? x.carte.id + ":" + x.carte.gain : "", x.prono ? x.prono.pts : "", x.defi || 0, x.serie || 0, x.rival || "", x.regul === undefined ? "" : x.regul]) })) }; });
  await b.close();
  const txt = JSON.stringify(res), emp = crypto.createHash("sha256").update(txt).digest("hex");
  const ko = [], ok = (c, t) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t); };
  console.log("Classement final : " + res.classement.map(n => n + " " + res.tot[n].pts + " pts").join(" · ") + " · " + res.mois.length + " mois joués");
  if (process.env.FIGER) { console.log("EMPREINTE = " + JSON.stringify(emp)); process.exit(0); }
  ok(!err.length, "0 erreur JS " + JSON.stringify(err));
  ok(res.complete && res.mois.length === 12 && res.classement.length === 5, "saison 2027 inventée complète : 12 mois, 5 pilotes classés");
  ok(res.mois.some(m => m.l.some(x => /^pari:/.test(x[5]))) && res.mois.some(m => m.l.some(x => x[6] !== "" && x[6] > 0)) && res.mois[11].l.some(x => x[9]), "la saison joue vraiment les cartes (Paris), les pronostics et le rival");
  ok(!res.mois.find(m => m.k === 202705).l.some(x => x[0] === "Devlin") && !res.mois.find(m => m.k === 202702).l.some(x => x[0] === "Nicolas") && res.mois.find(m => m.k === 202703).l.some(x => x[0] === "Nicolas"), "relevé de mai de Devlin rattrapé par le délai (mois joué sans lui) ; Nicolas entre en mars");
  ok(EMPREINTE && emp === EMPREINTE, "points identiques au centime à l'empreinte (règles du 25/11) (" + emp.slice(0, 16) + "…)");
  process.exit(ko.length ? 1 : 0);
})();
