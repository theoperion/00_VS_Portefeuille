# Fiche du jeu Versus (conversation « Perso · Versus »)

Le championnat entre amis : chaque mois, les pilotes (Théo, Kévin, Clément, Devlin ; Nicolas à venir) sont classés sur la **performance en %** de leur portefeuille (PEA et assurance-vie seulement), avec cartes, pronostics, course, trésors et badges. Règles complètes : `docs/jeu/REGLES_PODIUM.md`. Saison : janvier → décembre ; **décembre 2026 = tour de chauffe** (tout marche, rien ne compte, ouvert aux joueurs depuis le 21/11).

## Secrets (Théo joue aussi)
- Emplacements, énigmes des trésors et contenu de « La Coupe brisée » : **uniquement** dans `app_scripts/versus/Tresors.js` et `Eclats.js` (privé). Ne jamais les recopier ici ni les dire à Théo.
- **Aucune mention** de ce qui arrive (nouveautés, univers, règles de janvier…) dans l'appli avant qu'on le révèle avec Théo.
- Badges secrets et scène du premier millionnaire : carte blanche, ne jamais les décrire à Théo.

## Décisions de Théo (ne pas revenir dessus sans lui)
- Le Versus ne compte et ne montre **que** le PEA et l'assurance-vie, pour tous ; CTO et crypto jamais dans le Sheet du Versus. Le détail des lignes de Moi reste privé (pas de partage dans le Versus).
- **Références assumées** (films, séries, livres : gant de l'infini, ticket d'or, anneau…), mais tout est **dessiné par nous** : aucune image ni logo officiel, pas de visage d'acteur, répliques courtes. Une carte = une seule grande scène (pas de mosaïque).
- Calendrier 2027 : jan Dune, fév Château, mars goûter (Alice), avr Anneau, mai Pandora, juin Étoiles (Côté obscur), juil Ratatouille, août Envers, sept Odyssée, oct Chocolaterie (sans Halloween), nov Titans, déc Multivers (Finale). Circuit de chauffe : « L'Atelier du Père Noël ». Mois spéciaux attachés au circuit (`circuitDe`).
- Course : 2 tours ; grille = classement d'avant le mois ; résultat du mois caché jusqu'à la course ; manche close = tous les relevés + 48 h.
- Barème à 5 joueurs : 6·4·2·1·0 (`baremeJ`). Chauffe = bases seulement (pas d'écurie, trophées, badges avant janvier).
- Gant de l'infini, ticket d'or (5 par saison, tirés par le serveur), badges qu'on se vole (sur places/points, jamais %), « Increvable » (ex-Lanterne rouge), Némésis partagée : validés pour la refonte des badges.
- Trésors : rappel dans l'appli seulement, jamais de mail aux joueurs. Le million = patrimoine **financier** seulement.
- Teasers : chacun commence par « Ils pensaient juste épargner. » ; envoyés par Théo sur WhatsApp ; pas dans l'appli (fichiers `teaser*.html` locaux, exclus de Git).
- Rubriques dépliables refermées à chaque ouverture ; seuls les filtres sont mémorisés. Bouton retour (v15.27) : ne pas y toucher. Glisser pour changer d'onglet : **abandonné**. Icônes maison codées mais coupées (`ICONES_ACTIVES = false`).

## Notions du code
- Calcul des points partagé avec le serveur : `app_scripts/outils/extraire-podium.js` régénère `versus/PodiumCommun.js`. Changer une règle de score ⇒ remettre le serveur en ligne.
- Cartes 2D : peintres `PEINTS[clé]` dans `piste.js` (`peindre` = carte 2D, `deco` = décor 3D). Après toute retouche d'un peintre : `node outils-tests/cuire-cartes.js` (fonds `img/cartes/*.webp`) puis publier.
- Sons : `js/sons.js` (Web Audio synthétisé, aucune note de film). Vues Carte / Visite / Hélico + plein écran.
- Aperçus admin : « 🗺️ Circuits 2027 », « 🔥 Voir décembre », « Tout afficher » (saison simulée).

## À faire (dans l'ordre)
1. **Urgent** : la fenêtre « NOUVELLES RÈGLES » apparaît quand on simule le 20/12 : vérifier qu'**aucun joueur ne la voit avant le 1/1** et qu'elle est à jour ; la retravailler avec Théo.
2. **Nicolas**, 5ᵉ joueur, au plus tard le 1/1/2027 : son fichier + script, l'ajouter au Versus, couleur `--p4`, portrait `PRESETS_TETE.nicolas`, vérifs d'affichage.
3. **Écran « La Coupe brisée »** avant janvier (serveur V49 prêt).
4. **Refonte des badges** avant janvier : à **réduire** avec Théo à l'essentiel faisable d'ici là (le reste dans `IDEES_JEU.md`).
5. **Teasers vidéo de décembre** (un par pan de règles, ~6/12 cartes, ~13/12 trésors + Coupe évoquée, ~20/12 écurie si prête, ~28/12 révélation des 12 univers ; couverture « VERSUS · ÉPISODE N »).
6. **Tests du jeu à ajouter** (essai de l'agent `jeu-code-donnees`, 24/11) : un test Playwright « simple joueur, sans admin » aux dates 3/12, 20/12, 31/12 et 1/1 qui vérifie qu'aucune barre ni aperçu d'admin n'apparaît ; et `ouvrirCircuits2027()` (js/4-grandprix.js) devrait revérifier qu'on est admin (double sécurité).
