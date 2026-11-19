# Versus · Portefeuille — passation pour Claude

À lire en entier avant toute action. Ce fichier remplace la mémoire des conversations précédentes
(menées jusqu'au 18/11/2026). L'historique détaillé de chaque version est dans `MODE_EMPLOI.md` (journal en bas).

## 🎬 Teasers (Théo, 19/11)
Épisodes 1 (vendredi, 19 s) et 2 (samedi, 1 min 04) VALIDÉS par Théo et envoyés (MP4 chez lui ; teaser.html local seulement, exclu de git).
MAIL D'ANNONCE DU 21/11 ANNULÉ (V56, `VS_ANNONCE_ACTIVE = false`) : Théo envoie les vidéos MP4 lui-même sur WhatsApp (meilleurs retours). Vendredi = texte seul, aucun visuel ni circuit, 4 pilotes ; samedi = fonctionnement du championnat sans dévoiler les univers, 5ᵉ pilote ; toutes commencent par « Ils pensaient juste épargner ».
Samedi 21/11 : bande-annonce + MP4 (WhatsApp) qui NE dévoilent PAS les 12 cartes (seulement l'Atelier du Père Noël + au plus janvier ; les autres en flashes floutés) ; vendredi 20/11 : MP4 court « demain, tout commence ». Théo : PAS de « Mon portrait 11 h » dans les vidéos ni le mail (ça s'affiche dans l'appli). La révélation complète des 12 univers est gardée pour un AUTRE teaser fin décembre (à faire). Théo (19/11) : en décembre, PLUSIEURS petits teasers vidéo (WhatsApp), un par pan de règles (dont La Coupe brisée, juste évoquée), plus de détails plus tard. Calendrier VALIDÉ, à faire la SEMAINE PROCHAINE (pas avant) : ~6/12 les cartes, ~13/12 trésors + Coupe brisée (évoquée), ~20/12 badges/écurie (si refonte prête), ~28/12 révélation des 12 univers ; chacune commence par « Ils pensaient juste épargner. ». SÉRIE EN ÉPISODES (Théo, 19/11) : couverture d'1 s en 1re image (= vignette WhatsApp) « VERSUS · ÉPISODE N » + titre, une couleur par épisode : Ép.1 Demain (ven.), Ép.2 La bande-annonce (sam.), Ép.3 Les cartes, Ép.4 La Coupe brisée, Ép.5 L'écurie, Ép.6 Les 12 univers. Les bandes-annonces ne sont PAS dans l'appli (teaser*.html retirés du site, gardés en local, exclus de git). Le tour de chauffe n'a pas de classement : c'est un test + retours de bugs. Scripts MP4 : scratchpad teaser/rec2.js + son.py (perdus avec la session : recréer au besoin).

## Moi : file d'attente (Théo, 19/11 nuit)
1) Réformes de l'audit A, C, D, E, F, I, J (agent en cours, copie scratchpad reformes/) — RÈGLE FIXE : le million = patrimoine FINANCIER seulement, jamais l'immobilier. 2) Puis idées du Conseil validées par Théo : projection du patrimoine jusqu'en 2034 (prudent/central/optimiste, échéances Artema et prêt sur la frise), calendrier unique des échéances (export .ics vers l'agenda), comparateur « où mettre le prochain euro ». 2a) ✅ v16.99 rappel « dans 3 mois » des 5 ans du PEA et des 8 ans de chaque assurance-vie, dans la boîte À faire (à faire APRÈS l'intégration de la saisie). Jours fériés des bourses : fichier de Théo complété jusqu'en 2035 (Paramètres AC/AD, formules étendues à la ligne 200) ; le rappel « calendrier » s'allume seul le 1/12/2035. 2b) Saisie des ordres encore simplifiée (Théo) en GARDANT la structure (mêmes données et actions serveur) : types fréquents d'abord, pré-remplissage intelligent, moins de champs visibles, calculs automatiques. 3) Badge Premier millionnaire rendu grandiose (workflow premier-millionnaire-grandiose, SURPRISE : ne jamais le décrire à Théo). Passation Clément/Devlin : « on verra plus tard ».

## ⏸️ PAUSE (Théo, 19/11 soir, crédits limités)
Aussi en pause (Théo, 19/11 nuit) : refonte des badges (~20 familles, Couronne de cœur, gant, ticket d'or, vols, Réserve admin, secrets) → semaine prochaine ; écran « La Coupe brisée » (reprendre le workflow ecran-la-coupe, resumeFromRunId wf_e6d7fbf7-b36 ; serveur V49 déjà prêt) et la vidéo de fin décembre (teaser-revelation.html, scratchpad videos/).
Seul l'URGENT pour le lancement de décembre : vidéo teaser avec les nouvelles cartes, vidéo + mail du samedi 21/11, corrections bloquantes. EN PAUSE (à reprendre « la semaine prochaine ») : 3D des circuits 2027 (lot 1 : Dune publiée v16.89 ; Château r3d-chateau-1 et goûter r3d-terrier inachevés, scratchpad wf-3d-lot.js), retouche 3D de Noël si non finie, (Ordre validé par Théo : 1) bilan/À faire/Point Artema en cours, 2) puis petit lot saisie : phrase de relecture raccourcie + titre « Saisir » et mêmes onglets pour tous les profils, 3) Coupe, 4) badges. REPRIS à la demande de Théo : phrase-bilan + boîte « À faire » + Point Artema, écran « La Coupe », refonte des badges en ~20 familles après la Coupe.) Travailler étape par étape, une chose à la fois.

## Qui, quoi
- **Théo** (GitHub `theoperion`), francophone : toujours répondre **en français**, simplement, sans jargon.
- Apps : Google Sheets + Apps Script + pages GitHub Pages. Joueurs du Versus : Théo, Kévin, Clément, Devlin.
- **Méthode convenue (mise à jour le 19/11)** : Théo ne valide plus chaque étape ; il fait confiance au plan du Conseil (rapport du 19/11).
  Claude construit, teste, publie (une ligne de journal dans `MODE_EMPLOI.md` par version) et ne demande l'avis de Théo que pour les vraies
  questions (choix de règles, changements visibles importants, désaccords). Objectif : simple à comprendre au début, nouveautés petit à petit. Claude peut publier directement sur `main` de
  `00_VS_Portefeuille` et des carnets T3/T4.

## Façon de travailler avec Théo (demandée par Théo le 19/11/2026, valable pour TOUTES les conversations)
- **Être force de proposition** : à chaque échange, proposer de soi-même des idées, des améliorations et des pistes originales, pas seulement exécuter ce qui est demandé.
- **Être innovant et ambitieux** (« pousser l'IA et le code dans leurs retranchements ») et **challenger Théo** : donner un avis franc, dire quand une idée peut être meilleure, proposer une alternative.
- **Travailler ensemble** : Claude propose → Théo choisit et valide → Claude construit. Après chaque étape, relancer avec la suite et 2 ou 3 idées nouvelles.

## Règles à ne jamais enfreindre
0. (v16.77/V51, Théo) Le détail des lignes de bourse de Moi reste PRIVÉ pour tous : plus de partage dans le Versus, ni par l'appli ni par le relevé automatique (LiaisonVersus.js), onglet « Lignes app » supprimé ; ne pas le remettre.
1. Théo ne doit **jamais voir les données financières de Clément et Devlin** (pas de copie de leurs chiffres dans
   un dépôt, une capture, un message).
2. **Aucun identifiant / jeton / secret dans GitHub** (`~/.clasprc.json` reste sur la machine).
3. Opération destructive sur des données (Sheets) : seulement sur instruction explicite.
4. Ne pas toucher aux applis gérées ailleurs : budgets 02/05/06, Compagnie de l'Aube, W4M (lecture seule).
5. `app_scripts` est partagé avec une autre conversation : toujours `git pull --rebase` avant de pousser.
6. **Références assumées (décision de Théo du 19/11, qui remplace l'ancienne règle « créations originales »)** : on GARDE les références aux
   films, séries et livres qu'ils adorent (gant de l'infini, ticket d'or, anneau, seigneur noir, chapelier…), sinon « ça n'a pas de sens ». Limites
   maintenues : tout est **dessiné par nous** (aucune image, logo ou photo officielle, pas de visage d'acteur), répliques courtes seulement.

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
  hors connexion `sw.js`). Version actuelle : **17.0**.
- Le calcul des points est partagé avec le serveur : `outils/extraire-podium.js` (dans app_scripts) régénère
  `versus/PodiumCommun.js` à partir de l'appli. Un changement de règle de score ⇒ remettre le serveur en ligne.

## Serveur Apps Script (dépôt app_scripts)
- Prérequis une fois par machine : `npx -y @google/clasp@3.4.1 login` (compte Google de Théo) → crée `~/.clasprc.json`.
- Versus : `sh outils/mettre-en-ligne-versus.sh "V31 : ce qui change"` (APPLI=chemin de ce dépôt si besoin).
  Versions actuelles : VS_VERSION 58, version Google 73.
- Scripts perso : dans `portefeuille-epargne/<nom>` : `clasp push --force` puis `python3 ../../outils/deployer.py "desc"`
  (garde les mêmes adresses). Versions actuelles : Théo 34, Clément 13, Devlin 12 (v34 : cache pré-calculé toutes les 10 min, `prechaufferDonnees`, installé au 1er appel).
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

## Artema (produit structuré Natixis, Théo et Clément)
- Écran à part dans Moi (`PREF.onglet = "artema"`, `htmlArtema`/`etatArtema` dans `moi.js`, constantes `ARTEMA`), ouvert par
  « 🎯 Suivi Artema » dans Moi › Patrimoine › Quintessa ; visible seulement si le support Artema existe ; chacun ses chiffres.
- Règles (DIC Natixis + fiche BPCE Vie, Drive de Théo) : photo de départ = moyenne 2-3-4 déc. 2026 ; rendez-vous ~7 déc. 2029→2033
  (si indice ≥ départ : arrêt, capital + 28,5 % +9,5 pts/an) ; fin 1er déc. 2034 : ≥ départ +76 %, entre −40 % et 0 capital,
  sous 60 % perte = baisse ; frais contrat 0,80 %/an ; parts = achats ÷ (100 € moins 1 %/an jusqu'au 4/12/2026).
- v16.85 : écran refait (`issueArtema` = fonction unique des issues, verdict, jauge, frise des rendez-vous, simulateur, courbe `parametres.artema.histo` = onglet « Artema histo » des fichiers Théo/Clément). v16.91 : formulaire « 🎯 Point Artema » (valeur € + niveau en une fois, via les actions existantes ordre Relevé ARTEMA + artema actuel), phrase-bilan en tête de Moi, boîte unique « À faire (N) » ; les rappels artemaActuel/releve ouvrent le Point Artema.
- Niveau de l'indice saisi à la main (pas sur Google Finance) : rappels « artemaInitial » / « artemaActuel » du fichier.
  Rythme du rappel « niveau actuel » (Paramètres!V8 de chaque fichier, 18/11) : Théo chaque lundi (1er : 07/12/2026),
  Clément chaque 20 du mois avec son relevé (1er : 20/12/2026). Les deux démarrent une fois le niveau initial saisi.

## Points de vigilance connus
- Bouton retour (v15.27, modèle de l'appli Budget) : validé par Théo, ne pas y toucher sans raison.
- Le cosmétique « Filtre de course » (ex-« Ambiance » : Nocturne, Golden hour, Hiver, Synthwave) n'est plus qu'une
  touche par-dessus le thème du circuit (`ambiance()` dans `piste.js`, v16.5) : le thème (`def.amb`) s'applique toujours.

## Refonte des circuits, un par un (demandée par Théo le 18/11 : « visuellement une horreur », 2D vide)
Méthode imposée : pour chaque circuit, fiche (inspiration + éléments) → maquette image → validation de Théo →
construction 2D + 3D → captures → publication. 2 à 4 clins d'œil discrets par circuit (jeux de société / deck-building,
films, séries, la bande des 4 ; jamais de licence). Pas de copie « à l'identique » d'une œuvre (droits d'auteur).
- Moteur : `def.peint` (TRACES) → `PEINTS[...]` dans `piste.js` = { peindre(T, Z) → carte 2D illustrée (image fixe + couche
  animée SVG), deco(ctx) → décor 3D aux mêmes positions } ; un plan commun (`planForet`) sert aux deux ; `D.terre` = chemin
  de terre (pas de lignes blanches ni vibreurs) ; `rotors` = objets qui tournent (ailes du moulin).
- ✅ Janvier · Forêt aux lucioles (v16.6). ✅ Décembre · Garage des rêves (v16.9 ; `peindreGarage`/`decorGarage`, positions fixes de la carte en u). 
- ✅ Nuit du 18→19/11 (autorisé par Théo sans validation, à revoir avec lui) : cartes 2D peintes pour les 11 autres circuits
  (`kit()` + `peindreChateau`, `peindreArmoire`, `peindreBasfonds`, `peindreMegapole`, `peindrePlateau`, `peindreSolstice`,
  `peindreEnvers`, `peindreSurvivants`, `peindreDunes`, `peindreTitans`, `peindreOlympe` ; monuments placés par `posRepere`
  comme en 3D) + style de piste 3D par thème (`D.kerb`, `D.terre`). Leur 3D garde les décors v16.2 : à enrichir circuit par
  circuit comme janvier/décembre si Théo le demande. Théo trouve certaines références obscures : à revoir avec lui.
- **Fonds peints cuits (v16.17)** : `img/cartes/<clé>.webp` + `img/cartes/cartes.js` (empreintes). Après TOUTE retouche d'un peintre de piste.js :
  `node outils-tests/cuire-cartes.js` puis publier (sinon l'appli affiche l'ancienne image). La couche animée reste en SVG.
- Course (v16.10) : une manche par mois, grille = classement d'avant le mois, le meilleur du mois boucle un tour (`mancheGP`),
  mois en cours visible dès le 1er sur la grille (`etapesGP` ajoute une étape `avenir`).

## Feuille de route validée par Théo le 19/11 (à suivre dans l'ordre, une version publiée par étape)
- Univers finaux : jan Forêt ✅ · fév **Château pièce par pièce** (carte-parchemin `peindreChateau3` ✅ en ligne, 3D intérieure + **balais** à faire) ·
  mars **Alice** (`peindreTerrier2`, livre de 1865 libre de droits, personnages autorisés) · avr **Seigneur des Anneaux** (tracé suzuka) · oct **Chocolaterie** (`peindreChocolat2`, tracé singapour, Halloween, ticket d’or) ·
  mai **Hunger Games** (`peindreArene2` ✅ v16.30, dessinée par un agent : arène-horloge 12 pièges) · juin **Star Wars** (`peindreEtoiles` + personnages à ajouter ; **petits chasseurs** comme véhicules) ·
  juil **Dune** (`peindreDunes2` ✅) · août **Stranger Things** (à refaire : deux mondes, failles qui font basculer la course, tête en bas) ·
  sept **Marvel multivers** (à dessiner) · oct **Seigneur des Anneaux** (à refaire : voyage Comté → Montagne du Destin sur la grande carte) ·
  nov **Titans** (`peindreTitans2`, à agrandir : toute l'île, 3 murs, mer, moins de maisons) · déc **Odyssée d'Homère** (libre de droits, à dessiner).
  **v16.34 : toutes les cartes 2D refaites au niveau de l'Arène** (peintres `peindreGarage6` (v16.76, Atelier du Père Noël, choix A de Théo : le Père Noël dévoile la voiture), `peindreForet3`, `peindreChateau5` (v16.68 : choix A de Théo, balais devant la lune), `peindreGouter` (v16.48, clé terrier), `peindreEtoiles4` (v16.46, la tranchée), `peindreDunes4` (v16.46 retouché), `peindreMultivers` (monza), `peindreChocolat3`, `peindreTitans4` (v16.39), `peindreOdyssee2` (lasvegas, v16.36 : une seule mer), + `peindreArene2`, `peindreEnvers3` (v16.46, la faille), `peindreAnneau4` (v16.46, perspective) ; chacun renvoie `portraits`) ; à faire valider par Théo une par une. **v16.37** : accessoire mérité (`accessoireMerite` dans 3-podium.js, utilisé par `avatar()` sans équipement explicite). **v16.35** : accessoires du thème sur les portraits des cartes 2D (`SKINS_TETE` dans 5-plateau.js, `eq.skin` = clé `peint`) ; événements en course 2D (`EVENEMENTS` dans piste.js, un par clé `peint` depuis v16.38 : anneau/œil, garage/bâche, chateau/escalier, terrier/changement de place, foret/ballons, arene/parachute, etoiles/looping, dunes/ver, envers/bascule, multivers/portail, chocolat/tickets, titans/main, odyssee/foudre ; `RES.lieux` d'un peintre = points de la carte). Idées d'événements en course dans les notes des agents (bâche sur le vainqueur, chat-bus qui double, escalier qui pivote, Bois-moi…). **Validation des cartes (Théo, 19/11)** : note de l'agent critique ≥ 8 (7,5 en dernier recours après 4 tours de retouche) ; boucle critique → retouche. **Dès qu'une carte 2D est validée, son décor 3D sur mesure part dans la même boucle** (fonction `decorX(ctx)` branchée par `PEINTS.<clé>.deco`, seuil 3D = 7 (Théo, 19/11), **Méthode v2 (Théo, 19/11)** : directeur artistique → 2 illustrateurs en parallèle (angles A/B) → contrôleur technique rapide → 2 critiques indépendants avec grille sur 10 (2D : héros/composition 2, lisible 390 px 1,5, film reconnaissable 1,5, clins d'œil 1, lumière 1,5, vie 1, propreté 0,5, waouh 1 ; 3D (depuis v16.58 : course en 2D ou hélico, Visite 3D libre ; plus de vue TV ni embarquée) : vue hélico et Visite rapprochée 2,5, piste lisible 1,5, film 1,5, clins d'œil 1, lumière 1, détails 1, fluidité 0,5, waouh 1 ; éliminatoire = plafond 6), références fixes Arène 8,5 / Multivers 8,7 ; Théo veut TOUT : beau, clins d'œil (plus que drôle), film reconnaissable. Ensuite **directeur artistique** (2D et 3D : il ne dessine pas, il écrit composition, valeurs, palette, lumière, textes, 3 changements prioritaires ; l'illustrateur/modeleur exécute ; le critique note ; il remet aussi en question les cartes déjà en ligne) et passage d'un **agent spécialiste des détails et effets 3D** (Théo : « ça manque de détails ») vérifié par le critique, poids de scène ≤ +30 % du plus lourd, 0 bug vérifié par l'agent). Mai devient **Pandora (Avatar)** en 2027 ; l'Arène (Hunger Games) passe en 2028 : à faire quand Pandora atteint 8 (redessiner sur le tracé miami, renommer le GP, piège, accessoire, événement, serveur/mail). **Nouvelles idées (Théo, 19/11)** : dès que les agents (critique + vérificateur de bugs) ont validé une idée entre eux, Claude la met en ligne sans attendre Théo (les vraies questions de règles restent pour lui) ; tout élément visible ajouté par Claude (bulle, événement…) passe aussi devant le critique. **Règle de Théo (19/11)** : une carte = UNE seule grande scène globale (une lumière, lue dans le sens de la course), jamais une mosaïque d'îlots ; Multivers et Arène gardées telles quelles. Janvier 2027 = **Ratatouille** seule (accessoire = toque du petit chef ; carte `peindreRatatouille` en boucle critique) ; « L'Arbre aux histoires » (patchwork des studios à la lampe, `peindrePixar`, 7,5) gardé pour **2028**, comme l'Arène (Hunger Games). Mai 2027 = **Pandora** (`peindrePandora`, l'Arbre des Âmes ; TRACES.miami a repris le tracé de monaco) ; l'Arène est dans `TRACES.arene2028` (son tracé d'origine) et les montagnes flottantes (`peindrePandora2`, scratchpad) sont pour 2028. Chocolaterie : PLUS d'Halloween (Théo, 19/11 : citrouille et fantôme n'ont rien à y faire). Voiture 3D refaite (v16.54). **Calendrier 2027 (v16.55, Théo)** : jan Dune (silverstone, Chevaucheur), fév Château, mars goûter, avr Anneau, mai Pandora, juin Étoiles (Côté obscur), juil Ratatouille (bahrein), août Envers, sept Odyssée (lasvegas, piège Sirènes = Pari interdit), oct Chocolaterie, nov Titans, déc Multivers (monza) = Finale + Rassemblement des héros (`spe.heros`). Mois spéciaux attachés au circuit (`circuitDe(k)`), plus au numéro du mois. Leçon : les cartes pleines de petits bâtiments vus du dessus sont « moches » ; ce qui plaît = grandes scènes illustrées avec personnages (Alice, Star Wars).
  Pas de licence : évoquer (silhouettes, objets, scènes, répliques détournées), jamais visages d'acteurs ni designs officiels copiés.
- Idées « hors limites » validées : ✅ bande-annonce (v16.12, `bandeAnnonce` dans 4-grandprix.js, `Piste.carte`) ; à faire : événements en pleine course
  (ver qui surgit, titan qui enjambe…), chasse au trésor (objet caché par carte → badge secret), décor qui réagit au classement, mode photo,
  autres circuits pièce par pièce. Reste aussi : brancher noms/pièges/serveur/mail des nouveaux univers (calendrier : juil=singapour, oct=silverstone).
- Validé aussi le 19/11 : les 3 changements d'univers (mai Hunger Games, sept Marvel, déc Odyssée), les principes Stranger Things / Seigneur des Anneaux / Titans,
  et l'ordre des étapes 1 (brancher les univers) → 2 (événements en course) → 3 (décor qui réagit + chasse au trésor) → 4 (mode photo) → 5 (château 3D) → 6 (maquettes).
- Badges à refaire « waouh » : paliers facile → légendaire (un seul détenteur, cérémonie plein écran, inclinaison), badges qu'on se **vole** (record),
  badges qui **se remplissent** (gant aux 6 pierres) : maquette de 4 badges soignés à faire avant de coder.
- Badges, décisions du 19/11 : **Gant aux 6 pierres** validé (pierres : victoire, 3 mois devant le S&P, carte gagnante, pronostic juste, 3 mois sans être dernier, dernier puis vainqueur ; le 1er à 6 pierres = claquement ~10 s chez tout le monde, gant légendaire unique ; les suivants = gant simple, sans animation).
  **Ticket d'or** validé (5 par saison, tirés par le serveur) MAIS le relevé est automatique : proposer une « tablette du mois » à déballer dans l'appli. Théo voudrait la Chocolaterie plus tard dans l'année.
  Badges qu'on se vole validés : Couronne de cœur, Casque noir, Anneau (leader, l'avatar pâlit), Corne d'abondance (attention : écarts de points faibles).
  Réserve validée (à coder mais cachée, visible et réglable par l'admin, lancement progressif) : Œuf de dragon, Némésis, Communauté, Lanterne rouge, rareté affichée. Badges secrets : carte blanche (garder la surprise).
  Théo trouve la course trop courte : la vouloir grandiose (plus longue, plus de tours) sans réforme des points si possible.
- **Conseil du Versus (19/11, 9 agents, rapport : synthèse dans la conversation)** — décisions validées par Théo : ~~compromis licences~~ ANNULÉ par Théo le 19/11 : on garde
  gant de l'infini, ticket d'or, anneau, personnages (voir règle 6) ; résultat du mois caché jusqu'à la course ; Lanterne rouge →
  « Increvable » ; Némésis partagée ; records qu'on se vole fondés sur places/points (jamais %). Plan : v16.16 réparations (retour, course 2D figée, « vu »
  trop tôt, Passer), v16.17 fluidité (fonds peints en images WebP), v16.18 nettoyage licences, v16.19 Garage amélioré, puis 5 joueurs, banc de tests sur
  FAUSSES données (l'ancien repet.js utilisait une copie du vrai Sheet : supprimée), course en 3 tours, badges vague 1.
- **Décisions de Théo du 19/11 (soir) sur le rapport du Conseil** : ticket d'or / Chocolaterie gardés tels quels ; Anneau sans pâleur (objet qui brille à partir
  du 3e mois en tête, cible sur la voiture, badge pour qui fait tomber le leader) ; pierre « pronostic » remplacée par « gagner un Pari contre celui qui a le
  plus de pierres », pierre manquante affichée ; manche close = tous les relevés + 48 h (avant : « provisoire », pas de cérémonie ni de vol) ; la course en
  3 tours doit être prête pour la course du Garage (vue début janvier) ; Côté obscur fixé en juin ✅ v16.22 ; barème 5 ✅ ; **chauffe = bases seulement** ✅
  v16.22 (pas d'écurie/trophées/badges avant janvier, pour recueillir l'avis des joueurs) ; **refonte des récompenses en ~20 familles AVANT janvier** ;
  tirages des billets par graine fixée au 1er janvier (empreinte affichée, révélée le 31/12 ; la Réserve admin ne montre pas les tirages) ; vibration à
  tester sur l'appli installée (Firefox Android) ; une cérémonie par ouverture (file : course, vol, pierre, billet) ; **icônes maison** à la place des
  émojis (≈30) ; repeindre les cartes petit à petit ; storyboard à réajuster ; corriger tous les bugs du rapport. Gant : **gant de l'infini GARDÉ** (Théo, 19/11).
- **Mon portrait (v16.24)** : `ouvrirPortrait()` (3-podium.js), ouvert par Réglages › « 👤 Mon portrait » ou en touchant sa propre tête ; disponible dès la chauffe (hors Écurie). v16.26 : « ↺ Par défaut » + 4 têtes enregistrées (`equip.tetes`, serveur V41), bulle « Fais ton portrait ! » une fois (`bullePortrait`) ; « Mon casque » MASQUÉ (`CASQUE_CACHE`) en attendant d'être redessiné. Badges secrets : conditions à mettre côté serveur (dépôt privé), validé par Théo.
- **« Tout afficher » (v16.83)** : présenté comme la saison 2027 simulée avec les résultats de 2026 (`anAff(k)` dans 1-base.js décale l'année affichée dans le Podium seulement ; v16.84 : `fauxVerdict(k)` invente les mois manquants jusqu'à décembre, et `circuitDe` met le Multivers en décembre dans la simulation). Théo : les « circuits 2026 » n'ont aucun intérêt.
- **Aperçu admin des circuits 2027 (v16.81)** : `ouvrirCircuits2027()` (4-grandprix.js), bouton « 🗺️ Circuits 2027 » de la barre admin : 2D / hélico / Visite pour les 13 circuits.
- **Aperçu de décembre (v16.63)** : bouton admin « 🔥 Voir décembre » (barre admin du Podium, avant le 1/12) = Vue joueur simulée au 3 déc.
- **Mon portrait ouvert aux joueurs le samedi 21/11 à 11 h** (`PORTRAIT_OUVRE`, `portraitDispo()` dans 3-podium.js ; avant : seulement en mode admin ACTIF, v16.71).
- **Icônes maison (v16.29)** : 39 icônes dans `js/icones.js` (`ico`, `icoOu(cle, emoji)`), branchées sur les onglets du Podium, Règles, boutons de la Course et cartes, mais **coupées** (`ICONES_ACTIVES = false`) : Théo préfère garder les émojis pour l'instant. Course : **2 tours** (Théo : le 1er de 3 faisait doublon).
- **Sons et vibrations (v16.43)** : `js/sons.js` (`SONS` : `course`, `arrivee`, `feuxBA`, `ev(clé)`, `klaxon`, `succes`, `vibrer`), Web Audio synthétisé, son ACTIVÉ par défaut depuis v16.74 (Théo) (`versus.son`), vibrations oui par défaut (`versus.vibre`) ; boutons `[data-son]`, `[data-son-choix]`, `[data-vibre-choix]`.
- **Chasse au trésor (serveur V45, appli « v16.61 » sur la branche)** : un objet caché par circuit dans la Visite 3D (hélico), visible seulement de très près (v16.64 : zoom ≤ 0,2 et distance < 92, petit, un éclat bref ; Théo le veut « un peu difficile ») ; emplacements, types et énigmes UNIQUEMENT dans `app_scripts/versus/Tresors.js` (privé : ne jamais les recopier ici ni les dire à Théo, qui joue). Le serveur ne les donne qu'à partir du 1er du mois du circuit (saison 2027, admin compris) ; actions `tresors` / `tresorTrouve`, onglet masqué « Trésors » (Nom, Circuit, Date). Appli : `chargerTresors`/`poserTresorDOM`/`majTresor` (4-grandprix.js), `api.projeter/zoom/viser` (piste.js). 5 circuits pour l'instant (Garage = trésor du tour de chauffe en déc. 2026, Château, goûter, tranchée, Multivers) ; **V47** : `indice2` révélé le 11 du mois si personne n'a trouvé avant, `chercheurs` (qui + jour, ordre) affichés dans l'encadré de l'énigme (`chercheursTxt`) ; v16.67 : bouton `.gp-tresor-appel` en carte 2D → Visite 3D. **Conseil du 19/11 (trésors)** : famille « Chercheur » (vitrine d'objets bronze/argent/or + badge volé « Le Flair » à points 3/2/1, à partir du 2e trésor 2027, Garage hors badges) à faire DANS la refonte des récompenses ; décor 3D de Dune lancé (date butoir 20/12, sinon pas de trésor en janvier) ; ensuite boucher juillet→novembre (Ratatouille, Odyssée). **Méthode RAPIDE pour la 3D (Théo, 19/11 nuit : « trop lent, réformer les notes »)** : 1 modeleur (avec œil de DA) → 1 contrôleur avec 5 questions OUI/NON (joyeux/waouh, fidèle au choix de Théo et à la 2D, piste lisible, détails visibles en Visite, 0 bug + fluide) → 1 retouche maximum → publication ; par LOTS DE 3 dans l'ordre du calendrier (script scratchpad wf-3d-lot.js, args = clés peint : lot 1 dunes/chateau/terrier, lot 2 anneau/pandora/etoiles, lot 3 ratatouille/envers/odyssee, lot 4 chocolat/titans/multivers), on publie le lot puis on lance le suivant en réutilisant les objets déjà faits ; Théo demande des retouches après coup s'il veut. Plus de notes sur 10 ni de 4 tours de critique. **Validation (Théo, 19/11 nuit, redit)** : si tout le Conseil est d'accord, Claude met en ligne SANS attendre Théo ; ne lui demander que s'il y a désaccord. **Efficience (Théo, 19/11 nuit)** : peu de chantiers à la fois, priorité au 1er décembre (Atelier du Père Noël 2D+3D, musique de la bande-annonce) ; écran « La Coupe » mis en pause (reprendre le workflow ecran-la-coupe avec resumeFromRunId wf_e6d7fbf7-b36 en décembre) ; pas de vidéo MP4 ni d'extras sonores pour l'instant. **3D (Théo, 19/11 nuit)** : les décors 3D actuels sont « une horreur, ni fait ni à faire », sauf le Château (Poudlard), « pas mal mais pas waouh » : ce n'est PAS le modèle, la cible est au-dessus (effet waouh) ; on fait UN circuit 3D après l'autre, en commençant par l'Atelier du Père Noël ; Dune et Ratatouille en pause, le reste après validation de Noël par Théo (lui montrer chaque 3D avant mise en ligne). Goûter, Étoiles, Multivers 3D à revoir aussi. **Décisions de Théo (19/11, soir)** : le circuit de chauffe s'appelle « L'Atelier du Père Noël » 🎅 (GPS.abudhabi, v16.72) ; fil rouge des trésors « La Coupe brisée » adopté par le Conseil (12 éclats, Coupe commune + vitrine perso, éclat « rendu par la piste » si pas trouvé, Finale = coffre dans le Multivers, badge « Gardien de la Coupe », aucun point) : contenu SECRET dans app_scripts/versus/Eclats.js (Théo joue : ne jamais le montrer), serveur branché (V49 : `coupe` dans l'action tresors = prologue + 12 éclats avenir/trouve/terne, `eclat` dans tresorTrouve ; éclat visible par tous dès la 1re trouvaille, décision de Théo), écran « La Coupe » de l'appli à faire avant janvier ; Garage 3D refait JOYEUX : `decorNoel` (v16.88, mélange A+B choisi par Théo, heure `fete`, amb `noel`) remplace decorGarage ; trésor de décembre replacé (Tresors.js V52) ; contrôle rapide : pistes d'amélioration notées (voiture trop cachée par la bâche, dôme de verre peu lisible d'en haut, vides en vue hélico, orage lourd) ; pas de gel au 25/11 (Théo : on peut modifier jusqu'au 1er décembre, les joueurs n'ont pas accès avant ; seul le teaser part le samedi 21/11) ; ordre des décors 3D = avis du game designer : Dune → Ratatouille → Odyssée → Envers → Titans → Pandora → Anneau → Chocolaterie ; **à terme un trésor sur TOUS les circuits** ; le Conseil doit surtout **varier les thèmes et les genres** d'un mois à l'autre (pas seulement boucher les trous du calendrier). **Conseil 19/11 (unanime)** : trésors = rappel dans l'appli seulement, PAS de mail aux joueurs (règle V26 maintenue) ; Le Flair à égalité de points reste au détenteur (vol si strictement supérieur ; afficher « à égalité : encore une 1re place pour le prendre »). ATTENTION : si decorGarage est remplacé (decorGarage2), revérifier la cachette du Garage dans Tresors.js : ajouter une ligne à `VS_TRESORS` quand un nouveau décor 3D sur mesure est prêt (cachette vérifiée par captures).
- **Bande-annonce d'avant-course (v16.73)** : épurée « affiche de cinéma » (Théo : circuit + règle du mois + trésor/énigme, rien d'autre ; `bandeAnnonce` dans 4-grandprix.js, `bref` dans PIEGES/mois spéciaux) ; `window.SONS` exporté (avant : sons muets).
- **Musique (v16.80)** : `SONS.musiqueBA(cle, …)` + recettes `MUSIQUES` (les 13 univers, v16.82), jingle `SONS.jingle(cle, 'motif'|'accord')` + `JINGLE_TIMBRE` (sol-do-mi, accord final de la bande-annonce et arrivée avant le klaxon ; jamais à l'ouverture), astuce son (`versus.astuceVolume`). Aucune note de film.
- Bande-annonce de lancement : `teaser.html` (bouton dans le mail du 20/11, serveur V35) ; vidéo MP4 faite avec Playwright + bande-son synthétisée (numpy + ffmpeg).
- Maquettes de travail : scratchpad `galerie/` (perdu avec la session ; les peintres sont dans `piste.js`, rendu via `tpeints.js`, `PEINT=clé`, `ANIM=1 ATT=2600`).

## À venir
- 5ᵉ joueur : **Nicolas**, au plus tard le 1er janvier 2027 (PEA, peut-être une assurance-vie) ; à voir la semaine du 23/11.
  À prévoir : son fichier + script, l'ajouter au Versus, barème à 5 = 6·4·2·1·0 (validé, codé v16.20 : `baremeJ`), couleur `--p4` vert citron, 5e bande du logo `.l5` visible dès 5 pilotes, vérifs d'affichage.
- Objets à collectionner : Théo veut une **montée en puissance par paliers** (premiers paliers = beaux objets ; paliers
  hauts = effets dans l'appli, comme le badge millionnaire) à la place des cartes actuelles (« ignobles ») : proposer, ne pas coder.

## Chantiers proposés, validés sur le principe par Théo (18/11), pas encore faits
1. ✅ **Badges du Classement** (fait en v16.4 + serveur V31) : 3 max, épinglés dans Podium › Écurie › Badges
   (`equip.badges`, absent = l'appli choisit les 3 plus prestigieux), le reste en « +N » ; plaque dans la fiche et au podium.
2. **F1 en 3D** (`voiture()` dans `piste.js`) jugée « ignoble » : option A recommandée = refaire la voiture
   dans le moteur actuel (carrosserie arrondie, vraies roues/jantes, ailerons avec dérives, numéro, ombre douce,
   reflets). Option B (three.js) seulement si A ne suffit pas. + l'ambiance cosmétique ne doit plus écraser le
   thème (✅ fait en v16.5) ; le klaxon pourrait se jouer en 3D à l'arrivée.
3. **Objets de collection** : remplacer les cartes (jugées sans effet « waouh ») par des **reliques 2D illustrées**
   originales, une par exclusif (24), effet holographique qui suit l'inclinaison/le doigt, relief en couches,
   ouverture mise en scène, raretés bronze/argent/holo, étagère-vitrine par monde avec bonus à la complétion.
4. Théo a signalé que « quelques circuits buguent » en plus des dépassements (corrigés en v16.3) : lui demander
   lesquels / une capture.
Ordre proposé : 1 → 2 → 3. Toujours présenter le détail à Théo avant de construire.
