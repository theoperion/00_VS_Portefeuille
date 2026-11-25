/* Test · 🔒 aucun secret des mini-jeux dans le dépôt PUBLIC.
   Lit les vraies règles (dépôt privé : app_scripts/versus/MJ_*.js), en tire tous les textes (phrases) et les identifiants de choix
   (id: '…', valeurs comparées avec ===), puis échoue si l'un d'eux apparaît dans un fichier du dépôt public
   (js/, piste.js, outils-tests/, docs/, css/, index.html). N'affiche que fichier:ligne, JAMAIS le texte trouvé.
   Lancer : node outils-tests/tsecrets-mj.js   (APP_SCRIPTS=/chemin/vers/app_scripts si le dépôt serveur n'est pas à côté ;
   sans dépôt privé, le test est ignoré proprement). */
const fs = require("fs"), path = require("path");
const RACINE = process.env.APP_SCRIPTS || path.join(__dirname, "..", "..", "app_scripts"), DOS = path.join(RACINE, "versus"), PUB = path.join(__dirname, "..");
if (!fs.existsSync(DOS)) { console.log("IGNORÉ : dépôt privé introuvable (" + DOS + "), rien à comparer."); process.exit(0); }
const MJ = fs.readdirSync(DOS).filter(f => /^MJ_.*\.js$/.test(f));
if (!MJ.length) { console.log("IGNORÉ : aucun fichier MJ_*.js dans le dépôt privé."); process.exit(0); }

/* identifiants permis : ce que l'appli publique connaît déjà par conception (circuits, onglets de l'appli, objets d'écurie, types d'écran) */
const PERMIS = new Set(["silverstone", "djeddah", "melbourne", "suzuka", "miami", "montreal", "bahrein", "spa", "lasvegas", "singapour", "interlagos", "monza",
  "classement", "mois", "fiche", "trophees", "choix", "formulaire", "chasse", "plaque",
  "function", "undefined", "object", "string", "number",                                   // mots du langage (typeof x === 'function')
  // mots déjà publics AVANT les mini-jeux, avec un autre sens : couleurs d'accent (rouge, rose), objets d'écurie (feu, parade, chat),
  // piège du Grand Prix (sirenes), réglage d'affichage (large), murs du décor 3D du circuit (maria, rose, sina : piste.js)
  "rouge", "rose", "feu", "parade", "chat", "sirenes", "large", "maria", "sina"]);
const textes = new Set(), ids = new Set();
const sansEchap = s => s.replace(/\\(['"`\\])/g, "$1").replace(/\\n/g, " ");
MJ.forEach(f => {
  const src = fs.readFileSync(path.join(DOS, f), "utf8");
  src.split("\n").forEach(l => {
    const lit = [...l.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\$]|\\.)*)`/g)].map(m => sansEchap(m[1] ?? m[2] ?? m[3] ?? ""));
    const objet = /objet:|recompense:\s*\{|univers:/.test(l);   // les objets d'écurie et le circuit sont publics
    lit.forEach(t => {
      const x = t.trim();
      if (x.length >= 24 && x.split(/\s+/).length >= 4 && /[a-zà-ÿ]{3}/i.test(x)) textes.add(x);   // une phrase (ou un morceau de phrase), pas un simple nom d'univers
    });
    [...l.matchAll(/\bid:\s*['"]([^'"]+)['"]/g), ...l.matchAll(/[=!]==\s*['"]([^'"]+)['"]/g), ...l.matchAll(/['"]([^'"]+)['"]\s*[=!]==/g), ...l.matchAll(/\bchoix:\s*['"]([^'"]+)['"]/g)]
      .forEach(m => { const v = m[1]; if (!objet && v.length >= 3 && /[a-z]/i.test(v) && !PERMIS.has(v)) ids.add(v); });
  });
});

/* les fichiers publics */
const publics = [];
const parcourir = (d, filtre) => { if (!fs.existsSync(d)) return; fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const p = path.join(d, e.name);
  if (e.isDirectory()) { if (!/^(node_modules|\.git|archives)$/.test(e.name)) parcourir(p, filtre); } else if (filtre(e.name)) publics.push(p); }); };
parcourir(path.join(PUB, "js"), n => n.endsWith(".js"));
parcourir(path.join(PUB, "css"), n => n.endsWith(".css"));
parcourir(path.join(PUB, "docs"), n => /\.(md|txt|html)$/.test(n));
parcourir(path.join(PUB, "outils-tests"), n => n.endsWith(".js") && n !== "tsecrets-mj.js");
["piste.js", "index.html"].forEach(n => { if (fs.existsSync(path.join(PUB, n))) publics.push(path.join(PUB, n)); });

const ko = [], idRe = [...ids].map(v => ({ v, re: new RegExp("[\"'`=]" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "[\"'`|:]") }));
const T = [...textes];
publics.forEach(f => {
  const rel = path.relative(PUB, f), lignes = fs.readFileSync(f, "utf8").split("\n");
  lignes.forEach((l, i) => {
    const ln = sansEchap(l);
    if (T.some(t => ln.includes(t))) ko.push(rel + ":" + (i + 1) + " (texte de règle)");
    if (idRe.some(x => x.re.test(l))) ko.push(rel + ":" + (i + 1) + " (identifiant de choix)");
  });
});
console.log("Lus : " + MJ.length + " fichiers MJ_*.js (" + textes.size + " textes, " + ids.size + " identifiants) ; " + publics.length + " fichiers publics parcourus.");
if (ko.length) { console.log("NON " + ko.length + " fuite(s) possible(s) (le texte n'est pas affiché) :\n  " + ko.join("\n  ")); console.log("\n1 NON"); process.exit(1); }
console.log("OUI aucun texte ni identifiant des mini-jeux dans le dépôt public\n\nTout est OUI.");
