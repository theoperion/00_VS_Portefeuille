/* Test v20.54 · import des avis (Fortuneo, Linxea Spirit 2) : FAUX avis (tout inventé) passés dans les VRAIES fonctions de moi.js.
   Dividendes, date d'exécution, TTF, milliers « 1.234,56 » / « 1,234.56 », même avis collé deux fois, Linxea : nom avant l'ISIN,
   frais de gestion (montant ≈ parts × valeur de part), liste + détail du même versement. Lancer : node outils-tests/timport-avis.js */
/* Charge les fonctions d'import de moi.js (lecture seule) dans un bac à sable Node. Aucune donnée réelle. */
const fs = require("fs"), vm = require("vm");
const SRC = fs.readFileSync(require("path").join(__dirname, "..", "moi.js"), "utf8").split("\n");
const ligne = re => SRC.findIndex(l => re.test(l));
const morceau = (a, b) => SRC.slice(a, b).join("\n");
const iIso = ligne(/^function isoJour\(/), iAuj = ligne(/^function aujourdhuiISO\(/), iSaisie = ligne(/^function saisieNombre\(/);
const iDeb = ligne(/^const PDFJS_URL/), iFin = ligne(/^function formulaireImport\(/);
const code = [SRC[iIso], morceau(iAuj, iAuj + 10), SRC[iSaisie], "let M = null; const stock = { get: () => null, set: () => {} }; const cleStock = k => k;",
  "function refData() { return (M && M.ref) || { enveloppes: [], types: [], actifs: [], cours: {}, detenu: [], journal: [], raccourcis: [] }; }",
  morceau(iDeb, iFin), "this.lireAvis = lireAvis; this.envDeAvis = envDeAvis; this.actifDeAvis = actifDeAvis; this.lireNombre = lireNombre; this.setM = x => { M = x; };"].join("\n");
const ctx = { console, Date, Math, Number, String, RegExp, JSON, Object, Array, isFinite, isNaN, Set, Promise };
vm.createContext(ctx); vm.runInContext(code, ctx);
const X = ctx;

/* Faux avis Fortuneo / Linxea (tout inventé) passés dans les VRAIES fonctions d'import de moi.js */
const ko = [], ok = (c, t, d) => { if (!c) ko.push(t); console.log((c ? "OUI " : "NON ") + t + (c || d === undefined ? "" : "  →  " + JSON.stringify(d))); };
const lire = t => JSON.parse(JSON.stringify(X.lireAvis(t)));
const op0 = r => r.ops[0] || {};

/* ---------- FORTUNEO ---------- */
const F1 = `FORTUNEO
AVIS D'OPERE
COMPTE PEA N° 00000000
Désignation : AMUNDI PEA NASDAQ-100 DAILY 2X LEV (FR0010342592)
Date d'exécution : 03/11/2026 à 09:12:45
Lieu d'exécution : EURONEXT PARIS
Sens : Achat
Quantité : 12
Cours : 1 234,5678 EUR
Montant brut : 14 814,81 EUR
Courtage : 1,99 EUR
Montant net : 14 816,80 EUR`;
let r = lire(F1), o = op0(r);
ok(r.compte === "PEA" && r.ops.length === 1, "F1 · achat PEA : 1 opération, compte PEA", r);
ok(o.type === "Achat" && o.isin === "FR0010342592" && o.date === "2026-11-03" && o.heure === "09:12", "F1 · type, ISIN, date, heure", o);
ok(o.qte === "12" && o.cours === "1234,5678" && o.frais === "1,99" && o.montant === "14816,8" || o.montant === "14816,80", "F1 · quantité, cours (4 décimales), courtage, montant net avec espace des milliers", o);
ok(!o.ecart && !o.manque.length, "F1 · cohérence 12 × 1234,5678 + 1,99 = 14 816,80 (au centime), rien ne manque", o);
const nom = o.nom; ok(/NASDAQ/.test(nom), "F1 · nom du titre lu", nom);

/* F2 · vente partielle + achat le même jour (bascule), CTO, centimes */
const F2 = `COMPTE TITRES ORDINAIRE N° 00000000
Désignation : SEMI CONDUCTEURS ETF (IE00TESTTST1)
Date d'exécution : 31/10/2026 à 17:29:59
Sens : Vente
Quantité : 3
Cours : 10,01 EUR
Montant brut : 30,03 EUR
Courtage : 0,99 EUR
Montant net : 29,04 EUR
Désignation : AMUNDI MSCI WORLD (LU1681043599)
Date d'exécution : 31/10/2026 à 17:30:10
Sens : Achat
Quantité : 0,5
Cours : 55,55 EUR
Montant brut : 27,78 EUR
Courtage : 0,99 EUR
Montant net : 28,77 EUR`;
r = lire(F2);
ok(r.compte === "CTO" && r.ops.length === 2, "F2 · CTO, 2 opérations", r);
ok(r.ops[0].type === "Vente" && r.ops[0].qte === "3" && r.ops[0].montant === "29,04" && r.ops[0].date === "2026-10-31", "F2 · vente partielle 3 parts, 29,04 €, date de fin de mois 31/10", r.ops[0]);
ok(!r.ops[0].ecart, "F2 · vente : 3 × 10,01 − 0,99 = 29,04 cohérent", r.ops[0]);
ok(r.ops[1].qte === "0,5" && r.ops[1].type === "Achat", "F2 · achat 0,5 part (fraction gardée)", r.ops[1]);
ok(!r.ops[1].ecart, "F2 · achat : 0,5 × 55,55 + 0,99 = 28,765 ≈ 28,77 (arrondi) : pas d alerte à tort", r.ops[1]);

/* F3 · séparateur des milliers en point (format possible d'un copier-coller) */
const F3 = F1.replace("14 814,81", "14.814,81").replace("14 816,80", "14.816,80").replace("1 234,5678", "1.234,5678");
r = lire(F3); o = op0(r);
ok(o.montant === "14816,8" || o.montant === "14816,80", "F3 · montant « 14.816,80 » (point des milliers) lu 14 816,80", { montant: o.montant, cours: o.cours, ecart: o.ecart });

/* F4 · espaces insécables (PDF) */
const F4 = F1.replace(/14 8/g, "14 8").replace("1 234", "1 234");
r = lire(F4); o = op0(r);
ok((o.montant === "14816,8" || o.montant === "14816,80") && o.cours === "1234,5678", "F4 · espaces insécables / fines dans les nombres", o);

/* F5 · date de règlement AVANT la date d'exécution */
const F5 = F1.replace("Date d'exécution : 03/11/2026 à 09:12:45", "Date de règlement : 05/11/2026\nDate d'exécution : 30/10/2026 à 09:12:45");
r = lire(F5); o = op0(r);
ok(o.date === "2026-10-30", "F5 · deux dates (règlement 05/11 écrit avant exécution 30/10) : la date d'exécution est prise", o.date);

/* F6 · taxe sur les transactions financières (CTO, action française) */
const F6 = `COMPTE TITRES N° 0
Désignation : TOTALENERGIES (FR0000120271)
Date d'exécution : 12/11/2026 à 10:00:00
Sens : Achat
Quantité : 10
Cours : 60,00 EUR
Montant brut : 600,00 EUR
Courtage : 1,95 EUR
Taxe sur les transactions financières : 2,40 EUR
Montant net : 604,35 EUR`;
r = lire(F6); o = op0(r);
ok(o.frais === "4,35" || o.ecart, "F6 · TTF 2,40 € : soit comptée dans les frais (4,35), soit écart signalé", o);
ok(o.frais === "4,35", "F6 · TTF 2,40 € comptée dans les frais (sinon l'utilisateur doit corriger à la main)", o.frais);

/* F7 · dividende (avis de paiement de coupon) */
const F7 = `COMPTE TITRES N° 0
AVIS DE PAIEMENT DE DIVIDENDES
Désignation : TOTALENERGIES (FR0000120271)
Date de paiement : 02/11/2026
Quantité : 10
Dividende brut unitaire : 0,79 EUR
Montant brut : 7,90 EUR
Prélèvements sociaux : 1,36 EUR
Montant net : 6,54 EUR`;
r = lire(F7);
ok(r.ops.length === 1 && /Dividende|Intérêts|Coupon/i.test(r.ops[0].type || ""), "F7 · dividende reconnu comme dividende", r.ops);

/* F8 · avis sans « Sens » mais « Achat comptant » ; quantité « 1 000 » */
const F8 = `COMPTE PEA
ACHAT COMPTANT
Désignation : AMUNDI MSCI WORLD (LU1681043599)
Exécuté le 14/11/2026 à 11:11:11
Achat comptant
Quantité : 1 000
Cours : 5,1234 EUR
Montant brut : 5 123,40 EUR
Courtage : 0,00 EUR
Montant net : 5 123,40 EUR`;
r = lire(F8); o = op0(r);
ok(o.type === "Achat" && o.qte === "1000" && o.frais === "0,00" && !o.ecart, "F8 · « Achat comptant », 1 000 parts, courtage 0,00", o);

/* F10 · vide, texte quelconque, Linxea seule ligne inconnue */
ok(lire("").ops.length === 0, "F10 · texte vide : aucune opération (→ message « Aucune opération trouvée… »)");
ok(lire("Bonjour, voici ma liste de courses : 3 pommes, 2,50 €").ops.length === 0, "F10 · texte sans rapport : aucune opération");
ok(lire("Sens : Achat\nMontant net : 12,00").ops.length === 1 && lire("Sens : Achat\nMontant net : 12,00").ops[0].manque.length >= 3, "F10 · avis tronqué : opération gardée, champs manquants signalés", lire("Sens : Achat\nMontant net : 12,00"));

/* F11 · deux fois le même avis collé dans le même texte */
r = lire(F1 + "\n\n" + F1);
ok(r.ops.length === 1, "F11 · même avis collé deux fois dans le même texte : 1 seule opération", r.ops.length);


/* v20.54 · milliers à l'anglaise « 1,234.56 » */
r = lire(F1.replace("14 816,80", "14,816.80").replace("14 814,81", "14,814.81")); o = op0(r);
ok(o.montant === "14816,80" || o.montant === "14816,8", "F12 · « 14,816.80 » (virgule des milliers) lu 14 816,80", o.montant);


/* v20.54 (relecture) · deux VRAIS avis différents, même minute et même montant, références différentes : gardés tous les deux */
{ const A = F1.replace("COMPTE PEA N° 00000000", "COMPTE PEA N° 00000000\nRéférence : AAA111"), B = F1.replace("COMPTE PEA N° 00000000", "COMPTE PEA N° 00000000\nRéférence : BBB222");
  const ref = t => t.replace("Désignation", "Référence de l'ordre : " + (t === A ? "AAA111" : "BBB222") + "\nDésignation");
  r = lire(ref(A) + "\n\n" + ref(B));
  ok(r.ops.length === 2, "F13 · deux avis distincts (références différentes, même minute, même montant) : 2 opérations, aucune perdue", r.ops.length);
  r = lire(F1 + "\n\n" + F1);
  ok(r.ops.length === 1 && /collé deux fois/.test(r.ops[0].note || ""), "F13 · le MÊME avis collé deux fois : 1 opération, et c'est dit", r.ops.map(x => x.note)); }
/* v20.54 (relecture) · « dividende » dans l'opération d'avant ne transforme pas la suivante en dividende */
{ const T = "COMPTE TITRES N° 0\nDésignation : TOTALENERGIES (FR0000120271)\nDate de paiement : 02/11/2026\nDividende brut unitaire : 0,79 EUR\nMontant net : 6,54 EUR\nDésignation : AUTRE TITRE (FR0000131104)\nQuantité : 5\nMontant net : 50,00 EUR";
  r = lire(T);
  ok(r.ops.length === 2 && r.ops[0].type === "Intérêts" && r.ops[1].type === "", "F14 · dividende seulement pour SA ligne : la suivante n'est pas un faux dividende", r.ops.map(x => x.type)); }
/* v20.54 (relecture) · l'ISIN noté dans SON fichier : actif reconnu et marqué sûr (même absent de la liste de l'appli) */
X.setM({ ref: { enveloppes: [], types: [], actifs: [{ code: "MONETF", nom: "Mon ETF à moi", isin: "LU0000000006" }], cours: {}, detenu: [], journal: [], raccourcis: [] } });
{ const a = JSON.parse(JSON.stringify(X.actifDeAvis({ src: "fortuneo", isin: "LU0000000006", nom: "NOM SANS RAPPORT" })));
  ok(a.code === "MONETF" && a.sur === true, "F15 · ISIN absent de la liste de l'appli mais présent dans le fichier : actif proposé et sûr", a); }
X.setM(null);

/* ---------- LINXEA SPIRIT 2 ---------- */
/* L1 · tableau « Détail du versement » copié du site (tabulations) */
const L1 = `Détail du versement libre du 13/11/2026
Montant du versement : 1 500,00 €
Support\tISIN\tMontant brut\tFrais\tMontant net\tDate de valeur\tValeur de part\tNombre de parts
Amundi MSCI World\tLU1681043599\t1 000,00 €\t0,00 €\t1 000,00 €\t15/11/2026\t512,34 €\t1,9518
Fonds euros Spirica\tFR0000000000\t500,00 €\t0,00 €\t500,00 €\t15/11/2026\t1,00 €\t500`;
r = lire(L1);
ok(r.compte === "LINXEA" && r.ops.length === 2, "L1 · versement sur 2 supports : 2 opérations", r);
o = r.ops[0] || {};
ok(o.type === "Achat" && o.isin === "LU1681043599" && o.date === "2026-11-15" && o.montant === "1000,00" && o.cours === "512,34" && o.qte === "1,9518", "L1 · support 1 : achat, ISIN, date de valeur, montant, valeur de part, parts", o);
ok(o.apport === true && (r.ops[1] || {}).apport === false, "L1 · le versement n'est compté qu'une fois (1er support)", r.ops.map(x => x.apport));
ok(o.montantApport === "1500,00" || o.montantApport === "1500", "L1 · versement total 1 500 € (document) repris sur le 1er support", o.montantApport);
ok(/World/i.test(o.nom), "L1 · nom du support 1 = « Amundi MSCI World »", o.nom);
ok(!o.ecart, "L1 · 1,9518 × 512,34 ≈ 1 000,00 (pas d'écart signalé à tort)", o);

/* L2 · frais de gestion (prélevés en parts) */
const L2 = `Détail des frais de gestion sur UC du 20/09/2026
Support\tISIN\tMontant\tDate de valeur\tValeur de part\tNombre de parts
Amundi MSCI World\tLU1681043599\t3,21 €\t20/09/2026\t500,00 €\t0,00642`;
r = lire(L2); o = op0(r);
ok(o.type === "Frais en parts" && o.montant === "3,21" && o.qte === "0,00642" && o.date === "2026-09-20", "L2 · frais de gestion → Frais en parts 3,21 € / 0,00642 part", o);

/* L3 · rachat partiel */
const L3 = `Détail du rachat partiel du 02/11/2026
Support\tISIN\tMontant brut\tFrais\tMontant net\tDate de valeur\tValeur de part\tNombre de parts
Amundi MSCI World\tLU1681043599\t200,00 €\t0,00 €\t200,00 €\t03/11/2026\t500,00 €\t0,4`;
r = lire(L3);
ok(r.ops.length === 2 && r.ops[0].type === "Vente" && r.ops[1].type === "Retrait" && r.ops[1].montant === "200", "L3 · rachat partiel → Vente 0,4 part puis Retrait 200 €", r.ops);

/* L4 · arbitrage */
const L4 = `Détail de l'arbitrage du 05/11/2026
Support\tISIN\tMontant brut\tFrais\tMontant net\tDate de valeur\tValeur de part\tNombre de parts
Fonds euros Spirica\tFR0000000000\t300,00 €\t0,00 €\t300,00 €\t06/11/2026\t1,00 €\t300
Amundi MSCI World\tLU1681043599\t300,00 €\t0,00 €\t300,00 €\t06/11/2026\t500,00 €\t0,6`;
r = lire(L4);
ok(r.ops.length === 2 && r.ops.every(x => x.type === "" && /Arbitrage/.test(x.note)), "L4 · arbitrage : signalé « à saisir à la main », rien d'inventé", r.ops.map(x => [x.type, x.note]));

/* L5 · liste des opérations seule (sans détail) */
const L5 = `Opération\tMontant brut\tMontant net\tDate
Versement libre\t1 500,00 €\t1 500,00 €\t13/11/2026
Frais de gestion sur UC\t3,21 €\t3,21 €\t20/09/2026`;
r = lire(L5);
ok(r.ops.length === 2 && r.ops[0].type === "Achat" && r.ops[0].apport === true && r.ops[0].manque.includes("support") && r.ops[1].type === "Frais en parts", "L5 · liste seule : versement + frais, support/parts signalés manquants", r.ops.map(x => [x.type, x.manque]));

/* L6 · liste + détail collés ensemble : pas de doublon */
r = lire(L5.split("\n").slice(0, 2).join("\n") + "\n" + L1);
ok(r.ops.length === 2, "L6 · liste + détail du même versement : pas de doublon (2 supports, pas 3)", r.ops.map(x => [x.type, x.date, x.liste]));

/* L7 · fiche « Libellé : valeur » (appli Linxea) */
const L7 = `Versement libre
Amundi Physical Gold ETC C 100 %
Montant brut : 100,00 €
Frais (€) : -
Montant net : 100,00 €
Date de valeur : 31/08/2026
Valeur de part : 150,00 €
Nombre de parts : 0,6667`;
r = lire(L7); o = op0(r);
ok(o.type === "Achat" && o.montant === "100,00" && o.qte === "0,6667" && o.cours === "150,00" && o.date === "2026-08-31" && /Gold/.test(o.nom), "L7 · fiche appli Linxea, date de fin de mois 31/08", o);

/* L8 · PDF « Confirmation de versement libre » : le nom du support est sur la ligne au-dessus */
const L8 = `LINXEA SPIRIT 2 - SPIRICA
Confirmation de versement libre
Votre versement : 1 000,00 €
Amundi MSCI World
LU1681043599   1 000,00 €   0,00 €   1 000,00 €   15/11/2026   512,34 €   1,9518`;
r = lire(L8); o = op0(r);
ok(r.ops.length === 1 && o.type === "Achat" && /World/.test(o.nom) && o.qte === "1,9518" && o.montant === "1000,00", "L8 · PDF Spirica : nom au-dessus de la ligne", o);

/* L10 · versement de 1 234,5 € : 2 décimales arrondies par Spirica */
const L10 = `Détail du versement libre du 13/11/2026
Montant du versement : 1 000,00 €
Support\tISIN\tMontant brut\tFrais\tMontant net\tDate de valeur\tValeur de part\tNombre de parts
Amundi MSCI World\tLU1681043599\t1 000,00 €\t0,00 €\t1 000,00 €\t15/11/2026\t333,33 €\t3,0000`;
r = lire(L10); o = op0(r);
ok(!o.ecart, "L10 · 3,0000 × 333,33 = 999,99 vs 1 000,00 (arrondi de l'assureur) : pas d'alerte à tort ?", o);


/* ---------- LINXEA AVENIR 2 (Suravenir) · v21.16 : faux documents au format des confirmations Suravenir ---------- */
const S1 = `Références :
Contrat : LINXEA AVENIR 2
N°: 000000 L8 000000000
Objet : Confirmation de versement
Ÿ Date du versement : 05/03/2099
1 234,56 €
Montant brut (frais inclus) :
0,00 €
Frais sur versement :
1 234,56 €
Montant net :
Suravenir - Siège social
l Répartition du versement :
Unités de compte Code Isin liquidatives
EUR SURAVENIR OPPORTUNITES 2 234,56
AMUNDI MSCI WORLD SWAP II ETF FR0010315770 06/03/2099 400,00 1,2500 500,00
DB X-TRACKERS ETC PHYS GOLD HDG DE000A1EK0G 06/03/2099 250,00 2,0000 500,00
3
Total 1 234,56`;
r = lire(S1);
ok(r.compte === "LINXEA" && r.ops.length === 2 && r.ops.every(o => o.type === "Achat"), "S1 · versement Avenir 2 : 2 achats (le fonds en euros reste en espèces)", r.ops);
ok(r.ops[0].apport && r.ops[0].montantApport === "1234,56" && !r.ops[1].apport, "S1 · un seul apport, du montant net total (fonds en euros compris)", r.ops.map(o => [o.apport, o.montantApport]));
ok(r.ops[1].isin === "DE000A1EK0G3" && r.ops[1].qte === "2,0000" && r.ops[1].cours === "250,00" && r.ops[1].date === "2099-03-06", "S1 · ISIN coupé en fin de cellule recollé, parts et valeur de part lues", r.ops[1]);
const S2 = `Contrat : LINXEA AVENIR 2
Objet : Confirmation d'arbitrage
l Date de l'arbitrage 10 mars 2099
Montant brut de l'arbitrage : 999,99 €
Frais d’arbitrage : 0,00 €
Frais de gestion : 0,15 €
Montant net : 999,75 €
l Désinvestissement :
Unités de compte Code Isin liquidatives
AMUNDI EURO STOXX 50 II UCIT ETF FR0007054358 11/03/2099 99,99 10,0007 999,99
l Réinvestissement :
Unités de compte Code Isin liquidatives
AMUNDI MSCI EMER MARK III UC ETF FR0010429068 11/03/2099 19,99 50,0125 999,75`;
r = lire(S2);
ok(r.ops.length === 3 && r.ops[0].type === "Vente" && r.ops[1].type === "Achat" && r.ops[2].type === "Frais" && r.ops[2].montant === "0,24", "S2 · arbitrage Avenir 2 : 1 vente, 1 achat, 0,24 € de frais", r.ops.map(o => [o.type, o.montant]));
ok(r.ops.every(o => !o.apport), "S2 · un arbitrage n'est jamais un apport", r.ops.map(o => o.apport));


/* ---------- LINXEA (site) · v21.16 : page de détail d'une opération copiée (faux chiffres) ---------- */
const W1 = "← Retour\nVersement\nM. Test Exemple\tLinxea Avenir 2 N° L8 000000000\nCaractéristiques\nMontant brut\n250,00 €\nTaux de frais\n0,00 %\nFrais d'entrée\n0,00 €\nMontant net\n250,00 €\nDate de validation\n28/11/2099\nDate d'effet\n01/12/2099\nRépartition\n1\nCompartiment 1\n250,00 €\nMode de gestion\tGestion libre\nSupport\tRépartition\tMontant net\tNbr. de parts\tValeur de la part\nEUR SURAVENIR OPPORTUNITES 2\n20,00 %\t50,00 €\t-\t-\nAMUNDI MSCI WORLD SWAP II ETF\nFR0010315770\n40,00 %\t100,00 €\t0.2500\t400,00 € au 01/12/2099\nDB X-TRACKERS ETC PHYS GOLD HDG\nDE000A1EK0G3\n40,00 %\t100,00 €\t0.5000\t200,00 € au 01/12/2099";
r = lire(W1);
ok(r.ops.length === 2 && r.ops.every(o => o.type === "Achat") && r.ops[0].qte === "0,2500" && r.ops[0].cours === "400,00" && r.ops[0].montant === "100,00" && r.ops[1].isin === "DE000A1EK0G3", "W1 · versement copié du site : 2 achats (parts, valeur de part, montant)", r.ops);
ok(r.ops[0].apport && r.ops[0].montantApport === "250,00" && !r.ops[1].apport && r.ops[0].date === "2099-12-01", "W1 · un seul apport de 250 € (fonds en euros compris)", r.ops.map(o => [o.apport, o.montantApport, o.date]));
const W2 = "Arbitrage\nCaractéristiques\nMontant brut\n300,00 €\nPrélèvements sociaux sur les intérêts de l'année des fonds en €\n-0,11 €\nFrais de gestion\n0,24 €\nMontant net\n299,65 €\nDate de saisie\n08/10/2099\nDate d'effet\n09/10/2099\nDésinvestissement\n1\nCompartiment 1\n300,00 €\nSupport\tMontant brut (€)\tNbr. de parts\tValeur de la part\nEUR SURAVENIR OPPORTUNITES 2\n300,00 €\t-\t-\nRéinvestissement\n1\nCompartiment 1\n299,65 €\nSupport\tRépartition\tMontant net\tNbr. de parts\tValeur de la part\nAMUNDI MSCI EMER MARK III UC ETF\nFR0010429068\n100,00 %\t299,65 €\t20.0000\t14,98 € au 09/10/2099";
r = lire(W2);
ok(r.ops.length === 2 && r.ops[0].type === "Achat" && !r.ops[0].apport && r.ops[0].qte === "20,0000" && r.ops[1].type === "Frais" && r.ops[1].montant === "0,35", "W2 · arbitrage depuis le fonds euros : 1 achat (pas d'apport) + 0,35 € de frais", r.ops.map(o => [o.type, o.qte, o.montant, o.apport]));
const W3 = "Distribution\nCaractéristiques\nSupport concerné\nAMUNDI MSCI WORLD SWAP II ETF\nDate d'effet\n18/12/2099\nMontant net distribution\n9,99 €\nRépartition des supports\nSupport\tRépartition\tMontant net\tNbr. de parts\tValeur de la part\nAMUNDI MSCI WORLD SWAP II ETF\nFR0010315770\n100,00 %\t9,99 €\t0.0250\t399,60 € au 18/12/2099";
r = lire(W3);
ok(r.ops.length === 2 && r.ops[0].type === "Intérêts" && r.ops[0].montant === "9,99" && r.ops[1].type === "Achat" && r.ops[1].qte === "0,0250" && !r.ops[1].apport, "W3 · distribution : dividende (Intérêts) puis achat des parts réinvesties", r.ops.map(o => [o.type, o.qte, o.montant]));
const W4 = "Prime exceptionnelle\nCaractéristiques\nSupport concerné\nEUR SURAVENIR OPPORTUNITES 2\nDate d'effet\n01/01/2099\nMontant prime\n0,80 €";
r = lire(W4); ok(r.ops.length === 1 && r.ops[0].type === "Intérêts" && r.ops[0].montant === "0,80" && r.ops[0].date === "2099-01-01", "W4 · prime du fonds en euros → Intérêts", r.ops);
const W5 = "Prélèvements sociaux sur revalorisation\nCaractéristiques\nSupport concerné\nEUR SURAVENIR OPPORTUNITES 2\nDate d'effet\n01/01/2099\nAssiette\n0,84 €\nMontant\n0,14 €";
r = lire(W5); ok(r.ops.length === 1 && r.ops[0].type === "Frais" && r.ops[0].montant === "0,14", "W5 · prélèvements sociaux → Frais 0,14 € (pas l'assiette)", r.ops);

console.log("\n" + (ko.length ? ko.length + " NON" : "tout OUI"));
