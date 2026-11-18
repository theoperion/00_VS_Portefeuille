# Versus · Portefeuille — passation pour Claude

À lire en entier avant toute action. Ce fichier remplace la mémoire des conversations précédentes
(menées jusqu'au 18/11/2026). L'historique détaillé de chaque version est dans `MODE_EMPLOI.md` (journal en bas).

## Qui, quoi
- **Théo** (GitHub `theoperion`), francophone : toujours répondre **en français**, simplement, sans jargon.
- Apps : Google Sheets + Apps Script + pages GitHub Pages. Joueurs du Versus : Théo, Kévin, Clément, Devlin.
- **Méthode convenue** : Claude propose → Théo valide → Claude construit, teste, publie (une ligne de journal
  dans `MODE_EMPLOI.md` par version) → Théo vérifie. Claude peut publier directement sur `main` de
  `00_VS_Portefeuille` et des carnets T3/T4.

## Règles à ne jamais enfreindre
1. Théo ne doit **jamais voir les données financières de Clément et Devlin** (pas de copie de leurs chiffres dans
   un dépôt, une capture, un message).
2. **Aucun identifiant / jeton / secret dans GitHub** (`~/.clasprc.json` reste sur la machine).
3. Opération destructive sur des données (Sheets) : seulement sur instruction explicite.
4. Ne pas toucher aux applis gérées ailleurs : budgets 02/05/06, Compagnie de l'Aube, W4M (lecture seule).
5. `app_scripts` est partagé avec une autre conversation : toujours `git pull --rebase` avant de pousser.
6. Uniquement des créations originales : aucun nom, personnage, logo ou visuel d'œuvre existante
   (les thèmes « s'inspirent » des goûts de Théo : cinéma, séries, jeux, sans rien reprendre).

## Dépôts
| Dépôt | Contenu |
|---|---|
| `theoperion/00_VS_Portefeuille` | l'appli web Versus (ce dépôt) |
| `theoperion/app_scripts` | scripts Apps Script : `versus/` (serveur du Versus), `portefeuille-epargne/{theo,clement,devlin,kevin}` (scripts perso), `outils/` |
| `theoperion/03_carnet_d_entretien`, `theoperion/07_carnet_t4_carla` | carnets T3 / T4 |

## L'appli (ce dépôt)
- `index.html` + `js/1-base.js` (Classement), `2-jeu.js` (verdict, cartes), `3-podium.js` (saison, exclusifs,
  écurie/cosmétiques `ITEMS`, mondes `MONDES`, objets de collection `CARTES_COLL`), `4-grandprix.js` (calendrier
  des circuits `GPS`, page Course), `5-plateau.js` (pièges `PIEGES`, mois spéciaux, règles du mois),
  `6-voiture3d.js`, `7-bilan.js` (bouton retour, Réglages), `8-eredor-demarrage.js`.
- `moi.js` (onglet Moi : rappels, assurance vie, prêt, marchés, séance/semaine), `moteur.js` (calculs),
  `piste.js` (moteur 3D WebGL maison + carte 2D des circuits), `css/versus.css`.
- **Version** : `version.js` (`app` + `date`) — seul endroit à changer à chaque mise en ligne (sert aussi au cache
  hors connexion `sw.js`). Version actuelle : **16.3**.
- Le calcul des points est partagé avec le serveur : `outils/extraire-podium.js` (dans app_scripts) régénère
  `versus/PodiumCommun.js` à partir de l'appli. Un changement de règle de score ⇒ remettre le serveur en ligne.

## Serveur Apps Script (dépôt app_scripts)
- Prérequis une fois par machine : `npx -y @google/clasp@3.4.1 login` (compte Google de Théo) → crée `~/.clasprc.json`.
- Versus : `sh outils/mettre-en-ligne-versus.sh "V31 : ce qui change"` (APPLI=chemin de ce dépôt si besoin).
  Versions actuelles : VS_VERSION 30, version Google 45.
- Scripts perso : dans `portefeuille-epargne/<nom>` : `clasp push --force` puis `python3 ../../outils/deployer.py "desc"`
  (garde les mêmes adresses). Versions actuelles : Théo 30, Clément 9, Devlin 9.
- Sheets en direct : `outils/gs.py` (`SS(id).get/put/batch`). Classeurs : Théo `1pbpJRMwZR64LqP_wwlhiw-6m7-lUg-Q3pVAF4Dv9j8U`,
  Clément `1srJuvBQ7Pksf0gpO1v3XLC8E7FVSBihKdEnFmGXD6LU`, Devlin `1xilETvIo9uR7RhHJHNbP1x1FPK0knWCtNh2IB6mJxGY`,
  Versus `1p9bZv5jP-BAnlAUVhsPKd2TeEyZDk8RG2vzia9p0kUk` (ne lire ceux de Clément/Devlin que pour une
  opération technique, jamais pour montrer leurs chiffres).

## Tester avant de publier
- Serveur local : `python3 -m http.server 8771` depuis ce dépôt ; Playwright + Chromium (pas de Firefox dispo :
  Théo est sur **Firefox Android**, l'appli doit aussi marcher sur Chrome et iPhone).
- Pour simuler l'appli : intercepter `https://script.google.com/**` avec des données factices (jamais les vraies).
- `outils-tests/` : `harness.js` (aucun tracé ne se recoupe), `scenes.js` (poids des scènes 3D), `t3d.js` (captures
  3D, `CAM=tv`, `ZOOM=1`), `tdep.js` (dépassements sans saut), `tvign.js` (vignettes). À lancer depuis la racine.
- Après chaque version : 0 erreur JS, fluidité ~60 i/s, calcul des points inchangé si on n'a pas touché aux règles.

## Publier
Commit (message en français, « vX.Y : … »), ligne dans le journal de `MODE_EMPLOI.md`, push sur `main`.

## Points de vigilance connus
- Bouton retour (v15.27, modèle de l'appli Budget) : validé par Théo, ne pas y toucher sans raison.
- Le cosmétique « ambiance de circuit » (Nocturne, Hiver, Synthwave…) **remplace** le thème du circuit
  (`ambiance()` dans `piste.js`) : à changer en simple touche par-dessus (voir chantiers).

## Chantiers proposés, validés sur le principe par Théo (18/11), pas encore faits
1. **Badges du Classement** : 3 max sur la ligne, épinglés par le joueur dans l'Écurie, le reste en « +N » ;
   la plaque (ex. « CONTRE-ATTAQUE ») quitte la ligne (elle coupe le texte) → sous-titre dans la fiche et au podium.
2. **F1 en 3D** (`voiture()` dans `piste.js`) jugée « ignoble » : option A recommandée = refaire la voiture
   dans le moteur actuel (carrosserie arrondie, vraies roues/jantes, ailerons avec dérives, numéro, ombre douce,
   reflets). Option B (three.js) seulement si A ne suffit pas. + l'ambiance cosmétique ne doit plus écraser le
   thème ; le klaxon pourrait se jouer en 3D à l'arrivée.
3. **Objets de collection** : remplacer les cartes (jugées sans effet « waouh ») par des **reliques 2D illustrées**
   originales, une par exclusif (24), effet holographique qui suit l'inclinaison/le doigt, relief en couches,
   ouverture mise en scène, raretés bronze/argent/holo, étagère-vitrine par monde avec bonus à la complétion.
4. Théo a signalé que « quelques circuits buguent » en plus des dépassements (corrigés en v16.3) : lui demander
   lesquels / une capture.
Ordre proposé : 1 → 2 → 3. Toujours présenter le détail à Théo avant de construire.
