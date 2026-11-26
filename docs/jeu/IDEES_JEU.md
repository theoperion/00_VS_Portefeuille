# Idées pour le jeu Versus (non finalisées)

Ce fichier n'est **pas** lu automatiquement : seulement quand Théo le demande. Rien ici n'est validé.

## Badges (ce qui ne tiendra pas dans la refonte d'avant janvier)
- ~20 familles de badges, paliers facile → légendaire (un seul détenteur, cérémonie plein écran) ; badges qui se remplissent (gant aux 6 pierres : victoire, 3 mois devant le S&P, carte gagnante, gagner un Pari contre celui qui a le plus de pierres, 3 mois sans être dernier, dernier puis vainqueur) ; badges qu'on se vole (Couronne de cœur, Casque noir, Anneau sans pâleur : objet qui brille dès le 3ᵉ mois en tête, Corne d'abondance).
- Famille « Chercheur » (trésors : vitrine bronze/argent/or + badge volé « Le Flair » à points 3/2/1 ; à égalité, il reste au détenteur).
- Réserve cachée : Œuf de dragon, Némésis, Communauté, Increvable, rareté affichée (écran masqué : retirer `false &&` dans `js/3-podium.js`).
- Titre de Moi sous son nom au Classement (sans chiffre) ; fiche-vitrine (codée en v17.56, cachée jusqu'au 1/1).

## Réserve 2028 (refonte des badges, 24/11)
- 11 exclusifs gardés dans le code (`saison: 2028` dans `EXCLUSIFS`, js/3-podium.js ; ni affichés ni comptés, objets retirés de l'écurie) : 🎯 Dans le mille (klaxon Dans le mille), 🤝 Fidèle au poste (plaque), 🔢 Pointeur (plaque), 🏆 Trentenaire (klaxon Pluie de trophées), 💎 Inarrêtable (finition Diamant), 🧊 Sang-glacé (casque Glace), 🎺 Soixante (klaxon Fanfare royale), 🪐 Le mur des 25 % (livrée Galaxie), 🌈 Marathonien (traînée Arc-en-ciel), 🌹 Le mur des 50 % (livrée Or rose), 🦅 Empereur (casque Empereur).
- Les 16 anciens défis et les 5 anciens secrets (Photo finish, Contre-attaque, Le casse, Tortue, Remontada) restent aussi dans le code (`DEFIS`, `SECRETS_ANCIENS`), sans affichage : Photo finish ferait un bon secret 2028.
- Univers sans objet vraiment à leur image (à dessiner) : Chocolaterie, Mur des titans, Petit Chef, Merveilles (pas de théière ni de chapeau).

## Décors 3D et course (en pause depuis le 23/11, à ne reprendre qu'avec le feu vert de Théo)
- Décors 3D des circuits un par un (ordre : Dune → Ratatouille → Odyssée → Envers → Titans → Pandora → Anneau → Chocolaterie), avec leurs événements de course et les accessoires des pilotes en 3D. Méthode rapide : 1 modeleur → 1 contrôleur oui/non → 1 retouche → publication.
- Visite / Hélico plus fluides.
- Voiture de course 3D refaite (carrosserie, roues, ailerons, numéro, ombre).

## Idées de Théo du 24/11 (à classer avec lui)
- **Badges des secrets** : un badge par objet secret trouvé, version prestigieuse pour le 1er découvreur, versions plus simples du 2e au 5e (selon le nombre de joueurs). Le badge est lié à l'objet (aucune utilité à Noël). Dès janvier, chaque objet raconte une histoire sur toute l'année, peut-être différente pour les premiers découvreurs (modalités à définir). Recoupe la famille « Chercheur » ci-dessus : à fusionner.
- **Course au jour le jour** : faire avancer les voitures chaque jour selon la Bourse, plutôt qu'une fois par mois. À trancher : contredit la décision « résultat du mois caché jusqu'à la course » ; n'est faisable que pour les joueurs dont le patrimoine est relié automatiquement (pas avec des relevés mensuels saisis à la main). **Choix de Théo (24/11, à creuser)** : pendant le mois, une « séance d'essais » chaque soir après la clôture (météo, ambiance, vitesse de la piste selon la Bourse), les voitures roulant dans l'ordre du classement du mois d'avant, sans position du mois en cours ; la vraie course garde le résultat de fin de mois et son suspense.
- **Teasers ↔ carte des chantiers** (validée par Théo) : chaque épisode « VERSUS · ÉPISODE N » révèle une branche ; la carte privée de Théo montre ce qui a déjà été dévoilé aux joueurs.

## Autres
- Ranger le code en dossiers `jeu/` et `moi/` (plus lisible) : seulement avec des tests, au moment d'un nettoyage du code (adresses de chargement et copie hors connexion à adapter).
- Course plus longue et plus grandiose (sans réforme des points).
- Après janvier, si l'envie d'échanger revient : 3 ou 4 réactions en émojis sur le résultat du mois (une par joueur, sans texte). Le chat en direct est écarté (24/11).
- Mode photo ; décor qui réagit au classement ; un trésor sur **tous** les circuits.
- Objets de collection : reliques 2D illustrées avec effet holographique et montée en puissance par paliers, à la place des cartes actuelles.
- Tickets d'or : « tablette du mois » à déballer ; tirages par graine fixée au 1er janvier (empreinte affichée).
- **Versus multijoueur à grande échelle** (ligues d'amis qui comparent des %, jamais des montants ; saisons, défis) : ne pas pousser au risque, récompenser régularité et patience, jamais de conseil en investissement.
- **Vidéos tuto mensuelles (Théo, 26/11, à la toute fin)** : une fois toutes les règles, cosmétiques, trophées et mini-jeux validés et sans bug, préparer à l'avance une vidéo par mois/circuit 2027 qui explique en détail ce qu'il y a à faire ce mois-là (mini-jeu, trésor, règle spéciale…). Théo l'envoie juste avant le 1er de chaque mois. Méthode : plan validé par Théo avant chaque vidéo, style tuto-teaser clair et épique. Pas avant que tout soit terminé.
