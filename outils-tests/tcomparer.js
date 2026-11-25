/* Test v20.54 · « 📋 Comparer avec mon relevé » : une FAUSSE évaluation de portefeuille Fortuneo (tout inventé) lue par les VRAIES
   fonctions de moi.js (lireEvaluation, comparerEvaluation), contre un faux fichier « Moi ». Vérifie : lecture des lignes par ISIN
   (milliers avec espace, quantité × cours ≈ valorisation), ✓ / ⚠ quantité (0,0001), PRU (centime), versé, ordres passés après la date
   du relevé retirés, ligne de l'appli absente du relevé, et la saisie proposée par « Corriger ». Rien n'est envoyé : aucune fonction réseau.
   Lancer : node outils-tests/tcomparer.js   (RELEVE=/chemin/texte.txt : lit en plus un vrai relevé, en LOCAL, et n'affiche que des oui/non) */
const fs = require("fs"), vm = require("vm"), path = require("path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "moi.js"), "utf8");
const bloc = (deb, fin) => { const a = SRC.indexOf(deb), b = SRC.indexOf(fin, a); if (a < 0 || b < 0) throw new Error("bloc introuvable : " + deb); return SRC.slice(a, b); };
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };

const ctx = { console, Math, Number, String, RegExp, JSON, Object, Array, isFinite, isNaN, Set, Intl, Date };
vm.createContext(ctx);
vm.runInContext([
  "let M = null; const ETAT = { discret: 'non' }; const stock = { get: () => null, set: () => {} }; const cleStock = k => k; function ok(v) { return typeof v === 'number' && isFinite(v); }",
  "function nf(a, b) { return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: a, maximumFractionDigits: b }); }",
  SRC.match(/^function frDate\(.*$/m)[0], SRC.match(/^function saisieNombre\(.*$/m)[0], SRC.match(/^function qteBrute\(.*$/m)[0],
  "function refData() { return (M && M.ref) || { enveloppes: [], types: [], actifs: [], cours: {}, detenu: [], journal: [], raccourcis: [] }; }",
  "function typeInfo(nom) { return refData().types.find(t => t.nom === nom) || { tresorerie: 0, quantite: 0, flux: 0 }; }",
  bloc("const ISIN_CONNUS", "let IMP = null;"), bloc("function envsOuverts(", "function cleOp("), bloc("function lireNombre(", "/* v16.83"), bloc("function lireEvaluation(", "function htmlComparer("),
  "this.lireEvaluation = lireEvaluation; this.comparer = comparerEvaluation; this.setM = x => { M = x; };"
].join("\n"), ctx);

/* ---------- fausse évaluation (même découpage que le lecteur de PDF de l'appli) ---------- */
const EVAL = `FORTUNEO
EVALUATION DE PORTEFEUILLE - COMPTE PEA N° 00000000
Cumul de vos versements (**) 10 000,00 €
Valeur Code Valeur Quantité Cours V.L (€) Valorisation +/- Value
¾ Autres
AMUNDI PEA MONDE MSCI WORLD
FR001400U5Q4 1 000 5,50 30/09/26 5 500,00 55,00 5,0000 500,00
ACC FCP
AMD.P.NASD.100 D.2X
FR0010342592 40 112,50 30/09/26 4 500,00 45,00 100,1234 495,06
LEV.UC.ETF
Total portefeuille au 30 septembre 2026 10 000,00 995,06`;
const ev = ctx.lireEvaluation(EVAL);
ok(ev.compte === "PEA" && ev.date === "2026-09-30" && ev.versements === 10000 && ev.lignes.length === 2, "Lecture : compte PEA, relevé du 30/09/2026, versé 10 000 €, 2 lignes", { compte: ev.compte, date: ev.date, v: ev.versements, n: ev.lignes.length });
ok(ev.lignes[0].isin === "FR001400U5Q4" && ev.lignes[0].qte === 1000 && ev.lignes[0].cours === 5.5 && ev.lignes[0].pru === 5, "Ligne 1 : « 1 000 » parts (espace des milliers) × 5,50 € = 5 500 €, PRU 5,0000", ev.lignes[0]);
ok(ev.lignes[1].qte === 40 && ev.lignes[1].pru === 100.1234 && /NASD/.test(ev.lignes[1].nom), "Ligne 2 : 40 parts, PRU 100,1234, nom lu au-dessus", ev.lignes[1]);

/* ---------- faux fichier « Moi » : DCAM juste ; LQQ : 41 parts aujourd'hui dont 2 achetées le 05/10 (après le relevé) → 39 au 30/09 ;
   un ancien ETF encore dans l'appli mais vendu ; versé : 10 300 € aujourd'hui dont 300 € versés le 02/10 ---------- */
ctx.setM({ fiscalite: [{ nom: "PEA Test", apports: 10300 }], ref: {
  enveloppes: [{ nom: "PEA Test", regime: "PEA", perimetre: "Portefeuille", statut: "Ouvert" }],
  types: [{ nom: "Achat", tresorerie: -1, quantite: 1, flux: 0 }, { nom: "Vente", tresorerie: 1, quantite: -1, flux: 0 }, { nom: "Apport", tresorerie: 1, quantite: 0, flux: 1 }, { nom: "Retrait", tresorerie: -1, quantite: 0, flux: 1 }],
  actifs: [{ code: "DCAM", nom: "Amundi PEA Monde", isin: "FR001400U5Q4" }, { code: "LQQ", nom: "Nasdaq x2" }, { code: "VIEUX", nom: "Ancien ETF" }],
  detenu: [{ env: "PEA Test", code: "DCAM", qte: 1000, pru: 5.0 }, { env: "PEA Test", code: "LQQ", qte: 41, pru: 100.5 }, { env: "PEA Test", code: "VIEUX", qte: 3, pru: 10 }],
  journal: [{ type: "Achat", enveloppe: "PEA Test", actif: "LQQ", date: "2026-10-05", quantite: 2, montant: 230 }, { type: "Apport", enveloppe: "PEA Test", actif: "", date: "2026-10-02", montant: 300 }],
  cours: {}, raccourcis: [] } });
const res = JSON.parse(JSON.stringify(ctx.comparer(ev, "PEA Test")));
const de = (code, quoi) => res.find(x => x.code === code && x.quoi === quoi) || {};
ok(de("DCAM", "qte").ok && de("DCAM", "pru").ok, "DCAM (reconnu par l'ISIN noté dans son fichier) : quantité ✓, PRU ✓");
const q = de("LQQ", "qte");
ok(!q.ok && Math.abs(q.ecart - 1) < 1e-9 && /retirés/.test(q.texte), "LQQ (reconnu par la liste des ETF) : 40 sur le relevé, 39 dans l'appli au 30/09 (achat du 05/10 retiré) → ⚠ écart +1", q);
ok(q.corriger && q.corriger.type === "Achat" && q.corriger.qte === "1" && q.corriger.actif === "LQQ" && q.corriger.date === "2026-09-30", "« Corriger » : ouvre un Achat de 1 LQQ daté du relevé (pré-rempli, à relire, rien n'est enregistré seul)", q.corriger);
ok(de("LQQ", "pru").sans === true, "LQQ : PRU pas comparé (ordre passé après le relevé, pas de faux ⚠)");
const v = de("VIEUX", "qte");
ok(!v.ok && v.corriger && v.corriger.type === "Vente", "Ligne de l'appli absente du relevé (VIEUX) : ⚠, « Corriger » propose une vente", v);
const vv = res.find(x => x.quoi === "verse") || {};
ok(vv.ok, "Versé : 10 000 € sur le relevé = 10 300 € − 300 € versés après le relevé ✓", vv);
/* PRU faux de 2 centimes, versé faux */
ctx.setM({ fiscalite: [{ nom: "PEA Test", apports: 10050 }], ref: { enveloppes: [{ nom: "PEA Test", regime: "PEA", perimetre: "Portefeuille", statut: "Ouvert" }], types: [{ nom: "Achat", tresorerie: -1, quantite: 1, flux: 0 }, { nom: "Apport", tresorerie: 1, quantite: 0, flux: 1 }],
  actifs: [{ code: "DCAM", nom: "x", isin: "FR001400U5Q4" }, { code: "LQQ", nom: "y" }], detenu: [{ env: "PEA Test", code: "DCAM", qte: 1000, pru: 5.02 }, { env: "PEA Test", code: "LQQ", qte: 40, pru: 100.1234 }], journal: [], cours: {}, raccourcis: [] } });
const r2 = JSON.parse(JSON.stringify(ctx.comparer(ev, "PEA Test")));
const p2 = r2.find(x => x.code === "DCAM" && x.quoi === "pru"), v2 = r2.find(x => x.quoi === "verse");
ok(!p2.ok && p2.corriger && p2.corriger.journal, "PRU 5,02 € dans l'appli contre 5,0000 € : ⚠ (2 centimes), « Corriger » ouvre l'Historique des ordres", p2);
ok(r2.find(x => x.code === "LQQ" && x.quoi === "pru").ok && r2.find(x => x.code === "LQQ" && x.quoi === "qte").ok, "LQQ juste (40 parts, PRU 100,1234) : ✓ ✓");
ok(!v2.ok && v2.corriger.type === "Retrait" && v2.corriger.montant === "50", "Versé : appli 10 050 € contre 10 000 € → ⚠, « Corriger » propose un retrait de 50 € à relire", v2.corriger);
ok(ctx.lireEvaluation(EVAL.replace(/COMPTE PEA/, "COMPTE")).compte === "", "Compte absent du relevé : laissé vide (l'écran demande « Compte introuvable, choisis-le », jamais un compte au hasard)");
ok(ctx.lireEvaluation("Bonjour, rien à voir 12,00 €").lignes.length === 0, "Texte sans rapport : aucune ligne (message « est-ce bien ton évaluation ? »)");

/* ---------- facultatif : un VRAI relevé, en local seulement (rien n'est affiché sauf oui/non et des nombres de lignes) ---------- */
if (process.env.RELEVE) {
  const vrai = ctx.lireEvaluation(fs.readFileSync(process.env.RELEVE, "utf8"));
  ok(vrai.compte !== "" && vrai.lignes.length > 0 && vrai.lignes.every(l => l.qte > 0 && l.pru > 0 && !l.douteux) && vrai.versements !== null, "Vrai relevé (local) : compte reconnu, " + vrai.lignes.length + " lignes lues, quantité × cours = valorisation, versé lu");
}
console.log(ko.length ? "\n✗ " + ko.length + " NON" : "\n✓ Tout est OUI");
process.exit(ko.length ? 1 : 0);
