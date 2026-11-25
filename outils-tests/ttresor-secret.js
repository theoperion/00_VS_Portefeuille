/* Test anti-fuite (25/11/2026) · aucune cachette de trésor dans ce dépôt PUBLIC.
   Lancer depuis la racine : APP_SCRIPTS=/chemin/vers/app_scripts node outils-tests/ttresor-secret.js
   Lit versus/Tresors.js dans le dépôt PRIVÉ (git show origin/main, sinon le fichier), puis parcourt les fichiers suivis par Git ici
   (piste.js, js/, css/, docs/, outils-tests/, index.html…) et signale :
     1. une ligne qui contient la position d'une cachette (x et z, arrondis ou tels quels, sur la même ligne, sous n'importe quelle forme) ;
     2. une ligne qui parle de trésor ou de cachette ET nomme l'objet caché.
   N'affiche QUE fichier:ligne (jamais la position, l'objet ni le lieu). Sans APP_SCRIPTS : rien à vérifier (sortie 0, avec un message).
   Rouge (sortie 1) au moindre signalement. */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const A = process.env.APP_SCRIPTS, racine = path.resolve(__dirname, "..");
if (!A) { console.log("(APP_SCRIPTS non défini : vérification anti-fuite sautée)"); process.exit(0); }
let t = ""; try { t = cp.execSync("git -C " + JSON.stringify(A) + " show origin/main:versus/Tresors.js", { stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch (e) { t = fs.readFileSync(path.join(A, "versus", "Tresors.js"), "utf8"); }   // la version à jour du serveur d'abord (git fetch avant)
const C = []; t.replace(/type:\s*'(\w+)',\s*p:\s*\[([^\]]+)\]/g, (m, ty, p) => { const v = p.split(",").map(s => s.trim()); C.push({ ty, x: v[0], z: v[2] }); return m; });
if (C.length < 5) { console.log("NON : Tresors.js illisible (" + C.length + " cachettes trouvées)"); process.exit(1); }
const sansAccent = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
// une position = x puis z sur la même ligne, à quelques caractères l'un de l'autre (avec ou sans la hauteur entre les deux) : « x, z », « [x, y, z] », « x - …, … - z »
const forme = n => { const r = String(Math.round(+n)); return r === n ? r : "(?:" + r + "|" + n.replace(".", "\\.") + ")"; };
const paire = c => new RegExp("(^|[^\\d.])" + forme(c.x) + "(\\.\\d+)?[^\\d\\n]{1,16}(-?\\d*\\.?\\d+[^\\d\\n]{1,8})?" + forme(c.z) + "(\\.\\d+)?(?!\\d)");
const MOT = /tresor|cachette|planque/;   // (« cache » seul : trop courant, mémoire de l'appli)
const fichiers = cp.execSync("git ls-files", { cwd: racine }).toString().split("\n").filter(f => /^(piste\.js|index\.html|sw\.js|version\.js|moi\.js|moteur\.js|js\/|css\/|docs\/|outils-tests\/)/.test(f) && /\.(js|css|html|md|json|txt)$/.test(f));
const fuites = [];
fichiers.forEach(f => { const L = fs.readFileSync(path.join(racine, f), "utf8").split("\n");
  L.forEach((l, i) => { const s = sansAccent(l).replace(/tresor_svg\.\w+/g, "");   // TRESOR_SVG.gemme : le dessin par défaut de l'appli, pas une cachette
    const pos = C.some(c => paire(c).test(l));
    const mot = MOT.test(s) && C.some(c => c.ty.length > 3 && new RegExp("\\b" + sansAccent(c.ty) + "\\b").test(s));   // les mots de 3 lettres (« vif », « cle ») sont trop courants
    if (pos || mot) fuites.push(f + ":" + (i + 1)); }); });
console.log(fichiers.length + " fichiers publics parcourus, " + C.length + " cachettes vérifiées");
if (fuites.length) { console.log("NON : " + fuites.length + " ligne(s) suspecte(s) :\n" + fuites.join("\n")); process.exit(1); }
console.log("OUI aucune position ni description de cachette dans le dépôt public"); process.exit(0);
