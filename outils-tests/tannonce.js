/* Test v20.24 · « simple joueur, sans admin » : que voit-on des règles 2027 selon la date ?
   Lancer depuis la racine du dépôt, serveur local ouvert : python3 -m http.server 8771 &  puis  node outils-tests/tannonce.js
   Aucune vraie donnée : le serveur Google est intercepté et renvoie des chiffres inventés. */
const { chromium } = require("playwright");
const PORT = process.env.PORT || 8771, CAPT = process.env.CAPTURES || "";   // v20.58 : PORT=… pour un autre port ; CAPTURES=dossier pour les captures 390 px (clair et sombre) des deux annonces
const NOMS = ["Théo", "Kévin", "Clément", "Devlin"];
function fausses(etapes, cinq) {   // relevés inventés de janvier à novembre 2026
  const rows = i => { const l = []; for (let m = 1; m <= 11; m++) { const v = 10000 + 300 * m + 50 * i * m; l.push([202600 + m, "2026-" + String(m).padStart(2, "0") + "-28", [v, v * 0.6, v * 0.4, 0, 0, 0, 0, 0], Array(25).fill(0).map((_, j) => j === 1 ? v : 0)]); } return l; };
  return { ok: true, genere: "2026-11-24T10:00:00", majTexte: "Dernier relevé : novembre 2026", enveloppes: ["Portefeuille", "PEA", "Assurance vie", "CTO", "Crypto"],
    personnes: NOMS.concat(cinq ? ["Nicolas"] : []).map((n, i) => ({ nom: n, rows: rows(i) })),
    marche: { indices: ["S&P 500", "Nasdaq-100", "Or"], mois: Array.from({ length: 11 }, (_, m) => [202601 + m, 0.01, 0.012, 0.005]), resume: [], dateComparaison: null, tauxSansRisque: 0.03, libelleDepuis: "" },
    marchesMoi: null, objectifs: [], journal: [], joursModif: 5, ecurie: {}, exclusifs: {}, cartes: {}, duels: {}, pronos: {}, votes: {}, rivaux: {}, etapes: etapes || {},
    liaison: { active: false, personnes: [] }, lignes: {}, premierMillion: null,
    session: { role: "perso", nom: "Kévin" }, mesCartes: {}, mesDuels: {}, mesPronos: {}, monRival: {} };
}
// mots des règles annoncées le 1er janvier : jamais avant
const CACHES = [/archer elfe/i, /forêt endormie/i, /12 circuits sont dévoilés/i, /rattrapage/i, /éclipse/i, /côté obscur/i, /bonus d'équipe/i, /🤝/, /La série/i, /🔥 Série/, /Finale/, /Rassemblement des héros/i, /Les niveaux/i, /🎴/];
// règles à jouer en janvier : visibles dès le 20 décembre
const JOUER = [/Défi du mois/, /Pronostic/i, /Rival/, /pièges/i];
// v20.58 : la promesse du 20/12 (sans rien dévoiler), jamais avant le 20/12, jamais dans l'annonce du 1/1
const PROMESSE = [/Chaque univers cache une surprise/, /mini-jeu à jouer ensemble/, /révélé le 1er de son mois/, /Trophées en 4 vitrines \(Mondes, Succès, Gant, Légendes\)/, /course en direct au rythme du S&P 500/, /de nouveaux objets à gagner pour ton écurie/];
// v20.58 : la révélation du 1/1 cite les règles 2027 à jour
const PREMIER = [/Le Côté obscur/, /points de place en double, et au moins 2/, /Juin[\s\S]{0,60}Bataille spatiale[\s\S]{0,20}🌑 Le Côté obscur : Le dernier du classement marque double \(2 points au moins\)/i, /Avr[\s\S]{0,60}🏹 L'œil de l'archer elfe : Battre le S&P 500 rapporte 2 points au lieu d'un/i, /Mai\s*🌿 Pandora\s*La forêt endormie : Carte 🚀 Turbo interdite/i,
  /Janv[\s\S]{0,60}🪱 Le Chevaucheur des sables/i, /Déc[\s\S]{0,60}🦸 Le Rassemblement des héros/i, /Couloirs mouvants : À moins de 0,2 point d'écart \(ex\. 3,1 % et 3,2 %\)/, /Le thé du Chapelier/, /Le chant des Sirènes/];
// textes faux ou périmés : jamais, à aucune date
const PERIMES = [/aller et retour/i, /graines sacrées/i, /Chaleur/, /atout du circuit|atouts? des circuits|bouchon/i];   // atout du circuit supprimé le 26/11 (Théo)
// v20.59 : « Le Podium en bref » ne cite une règle 2027 qu'une fois révélée
const TUTO_AVANT_20 = /défi|pronostic|pole|rival|chevaucheur/i, TUTO_AVANT_1 = /côté obscur|série|rassemblement/i, TUTO_JAMAIS_JANV = /finale|régularité/i;
const ADMIN = [/admin/i, /Aperçu/, /Prochainement/, /Circuits 2027/, /Voir décembre/, /Tout afficher/];
const CAS = [
  { d: "2026-12-19T12:00:00", jouer: false, caches: true },
  { d: "2026-12-20T09:00:00", jouer: true, caches: true },
  { d: "2026-12-31T22:00:00", jouer: true, caches: true },
  { d: "2027-01-01T10:00:00", jouer: true, caches: false },
  { d: "2027-01-02T10:00:00", jouer: true, caches: false, cinq: true },   // 5 pilotes : barème 6 · 4 · 2 · 1 · 0
  // dates réglées à janvier par l'admin (ou ramenées à janvier par le serveur) : toujours annoncées le 1/1 seulement
  { d: "2026-12-20T09:00:00", jouer: true, caches: true, neuf: true, etapes: { pioche: 202701, monaco: 202701, equipe: 202701, serie: 202701 } },
  { d: "2026-12-31T22:00:00", jouer: true, caches: true, etapes: { pioche: 202701, monaco: 202701, equipe: 202701, serie: 202701 } }
];
(async () => {
  const b = await chromium.launch(); let nok = 0;
  // un seul téléphone pour toutes les dates : comme un vrai joueur qui revient jour après jour
  let ctx = null;
  for (const c of CAS) {
    if (!ctx || c.neuf) { if (ctx) await ctx.close(); ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" }); }
    const p = await ctx.newPage(), err = [];
    p.on("pageerror", e => err.push(e.message));
    await p.clock.setFixedTime(new Date(c.d));
    await p.route("https://script.google.com/**", r => r.fulfill({ contentType: "application/json", body: JSON.stringify(fausses(c.etapes, c.cinq)) }));
    await p.addInitScript(() => { localStorage.setItem("versus.cle", "cle-de-test"); localStorage.setItem("versus.q3dAffichette", "1"); localStorage.setItem("versus.tuto1", "1"); });
    await p.goto("http://localhost:" + PORT + "/index.html");
    await p.waitForFunction(() => typeof D !== "undefined" && D && D.personnes, null, { timeout: 15000 });
    await p.waitForTimeout(2500);
    if (CAPT && (c.d.startsWith("2026-12-20") && !c.etapes || c.d.startsWith("2027-01-01")) && await p.$(".tuto-c")) {
      const nom = c.d.startsWith("2026") ? "annonce-20dec" : "revelation-1jan";
      for (const sch of ["light", "dark"]) { await p.emulateMedia({ colorScheme: sch }); await p.waitForTimeout(300); await p.screenshot({ path: CAPT + "/" + nom + "-" + (sch === "light" ? "clair" : "sombre") + ".png", fullPage: false }); const h = await p.evaluate(() => document.querySelector(".tuto-c").scrollHeight + 60); await p.setViewportSize({ width: 390, height: Math.max(844, h) }); await p.waitForTimeout(300); await p.screenshot({ path: CAPT + "/" + nom + "-" + (sch === "light" ? "clair" : "sombre") + "-entier.png" }); await p.setViewportSize({ width: 390, height: 844 }); }
    }
    const pop = await p.evaluate(() => { const t = document.querySelector(".tuto"); const s = t ? t.innerText : ""; if (t) t.remove(); return s; });
    const textes = await p.evaluate(async () => {
      const out = [document.body.innerText];
      for (const y of [2026, 2027]) { try { choisirSaison(y); ETAT.podium = "stand"; garder(); allerA("trophees"); rendreTrophees(); } catch (e) { } await new Promise(r => setTimeout(r, 400)); out.push(document.body.innerText); }
      try { ouvrirTuto(); const t = document.querySelector(".tuto"); out.push("@@TUTO@@" + t.innerText + "@@FIN@@"); t.remove(); } catch (e) { out.push("@@TUTO@@ERREUR tuto " + e.message + "@@FIN@@"); }
      try { ouvrirRegles(); out.push(document.querySelector(".regles").innerText); document.querySelector(".regles").remove(); } catch (e) { out.push("ERREUR règles " + e.message); }
      return out.join("\n");
    });
    const tout = pop + "\n" + textes, ko = [];
    if (err.length) ko.push("erreurs JS : " + err.join(" | "));
    if (c.caches) CACHES.forEach(r => { const m = tout.match(r); if (m) ko.push("visible trop tôt : « " + m[0] + " » …" + tout.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, " ")); });
    ADMIN.forEach(r => { const m = tout.match(r); if (m) ko.push("trace d'admin : « " + m[0] + " » …" + tout.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, " ")); });
    if (c.jouer) JOUER.forEach(r => { if (!r.test(tout)) ko.push("absent alors qu'attendu : " + r); });
    else JOUER.slice(0, 3).forEach(r => { if (r.test(tout)) ko.push("visible trop tôt : " + r); });
    if (c.d.startsWith("2026-12-20") && !/nouvelle/i.test(pop)) ko.push("pas de fenêtre « Nouvelles règles » le 20/12");
    if (c.d.startsWith("2026-12-20") && !/pronostic/i.test(pop)) ko.push("le 20/12, la fenêtre ne présente pas le pronostic");
    if (c.d.startsWith("2027-01-01") && !/nouvelle/i.test(pop)) ko.push("pas de fenêtre « Nouvelles règles » le 1/1");
    if (c.d.startsWith("2027-01-01") && (/pronostic|défi du mois|rival/i.test(pop.split(/12 circuits sont dévoilés/i)[0]) || !/rattrapage/i.test(pop))) ko.push("le 1/1, la fenêtre devrait montrer seulement les règles restantes");
    const tuto = (tout.match(/@@TUTO@@([\s\S]*?)@@FIN@@/) || [, "(pas de guide)"])[1];
    if (/ERREUR|pas de guide/.test(tuto)) ko.push("guide « Le Podium en bref » : " + tuto);
    const bar = c.cinq ? "6 · 4 · 2 · 1 · 0" : "6 · 4 · 2 · 0";
    if (!tuto.includes(bar + " points")) ko.push("guide : barème attendu « " + bar + " »");
    if (c.cinq && tuto.includes("6 · 4 · 2 · 0")) ko.push("guide : ancien barème à 4 alors qu'il y a 5 pilotes");
    if (!c.jouer) { const m = tuto.match(TUTO_AVANT_20); if (m) ko.push("guide : « " + m[0] + " » cité avant le 20/12"); }
    if (c.caches) { const m = tuto.match(TUTO_AVANT_1); if (m) ko.push("guide : « " + m[0] + " » cité avant le 1/1"); }
    { const m = tuto.match(TUTO_JAMAIS_JANV); if (m) ko.push("guide : « " + m[0] + " » cité avant son annonce (novembre 2027)"); }
    if (c.jouer && !/Chevaucheur des sables/.test(tuto)) ko.push("guide : le Chevaucheur (janvier) manque dès le 20/12");
    if (!c.caches && !/Côté obscur[^.]*2 points au moins/.test(tuto)) ko.push("guide : le Côté obscur (2 points au moins) manque le 1/1");
    if (process.env.VOIR) console.log("  guide : " + tuto.replace(/\s+/g, " "));
    if (c.d.startsWith("2026-12-20") && !c.etapes && !/^\s*Nouvelles règles\s*🎁 Et ce n'est que le début/i.test(pop)) ko.push("le 20/12, l'encadré « Et ce n'est que le début » n'est pas en haut");
    if (c.d.startsWith("2026-12-20") && !c.etapes) PROMESSE.forEach(r => { if (!r.test(pop)) ko.push("le 20/12, la promesse manque : " + r); });
    if (!c.jouer || c.d.startsWith("2027")) PROMESSE.forEach(r => { if (r.test(tout)) ko.push("promesse du 20/12 visible hors de son annonce : " + r); });
    if (c.d.startsWith("2027-01-01")) PREMIER.forEach(r => { if (!r.test(pop)) ko.push("le 1/1, la révélation ne cite pas : " + r); });
    if (c.d.startsWith("2027-01-01") && (pop.match(/🌿/g) || []).length !== 1) ko.push("le 1/1, 🌿 doit apparaître une seule fois (mai)");
    if (c.d.startsWith("2027-01-01") && /Finale|éclipse/i.test(pop)) ko.push("le 1/1, la révélation parle de la Finale (annoncée en novembre) ou garde l'ancien nom « éclipse »");
    PERIMES.forEach(r => { const m = tout.match(r); if (m) ko.push("texte périmé : « " + m[0] + " » …" + tout.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, " ")); });
    if (c.d.startsWith("2027-01-02") && pop) ko.push("le 2/1, la fenêtre revient alors que tout a été vu");
    if (process.env.VOIR && pop) console.log(pop);
    console.log((ko.length ? "NON " : "OUI ") + c.d.slice(0, 10) + (c.etapes ? " (dates réglées)" : "") + (pop ? "  · fenêtre : " + pop.replace(/\s+/g, " ").slice(0, 140) : ""));
    ko.forEach(k => console.log("     ✗ " + k)); nok += ko.length;
    await p.close();
  }
  await b.close(); process.exit(nok ? 1 : 0);
})();
