# Fiche de Moi (conversation « Perso · Moi »)

L'onglet **Moi** : le suivi **privé** du portefeuille de chacun (lignes de bourse, assurance-vie, prêt, marchés, levier, Artema, rappels, événements). Données dans le Google Sheet de chaque personne, lu par son script perso (`app_scripts/portefeuille-epargne/<nom>`). Code : `moi.js` (écrans), `moteur.js` (calculs). Kévin est en profil simple (`M.simple` : soldes seulement).

## Décisions de Théo (ne pas revenir dessus sans lui)
- **Privé** : le détail des lignes reste dans Moi, jamais partagé dans le Versus. Aucun chiffre d'un autre joueur nulle part.
- **Saisie** : tout vient de l'**avis d'opéré** (jamais le cours Google pour pré-remplir) ; nombre de parts **jamais arrondi** ; « Plus de détails » (date, prix, frais) toujours ouvert pour un achat/une vente ; types fréquents d'abord, moins de champs visibles, mêmes données envoyées.
- **Levier** : la stratégie ne concerne **que** le Nasdaq ×2 (LQQ, PEA) et le CTO semi-conducteurs ; le reste est hors stratégie. Le script du signal (SignalLevier.js) et la stratégie ne se touchent pas : Théo l'applique lui-même.
- Le million = patrimoine **financier** seulement, jamais l'immobilier.
- Événements temporaires (journées folles, sommet du S&P 500, krach, tempête crypto, série verte, bourse en relâche) : chacun dit pourquoi, jamais deux le même jour, masquables. Refusé : « jour de paie ».
- Pas d'export vers l'agenda (« pollution visuelle ») ; « Mes échéances » dans la cloche ; boîte unique « À faire (N) ».
- Ce n'est **jamais** un conseil en investissement.

## Artema (Théo et Clément)
- Écran à part (`PREF.onglet = "artema"`, `htmlArtema`/`etatArtema`, constantes `ARTEMA` dans `moi.js`), visible seulement si le support existe ; chacun ses chiffres.
- Règles (DIC Natixis + fiche BPCE Vie) : photo de départ = moyenne des 2-3-4 déc. 2026 ; rendez-vous ~7 déc. 2029→2033 (si indice ≥ départ : arrêt, capital + 28,5 % + 9,5 pts/an) ; fin 1er déc. 2034 (≥ départ + 76 % ; entre −40 % et 0 : capital ; sous 60 % : perte = baisse) ; frais du contrat 0,80 %/an.
- Niveau de l'indice saisi à la main (rappels « artemaInitial » / « artemaActuel ») : Théo chaque lundi (1er : 07/12/2026), Clément chaque 20 du mois (1er : 20/12/2026).

## À faire (dans l'ordre)
1. **5/12/2026 ou juste après** : calculer pour Théo le niveau de départ d'Artema = moyenne des clôtures **officielles** de l'indice (RDIGTDG, page Natixis) des 2, 3 et 4 décembre, puis l'aider à le saisir. Si Natixis publie sa valeur officielle, c'est elle qui compte.
2. **Mail du signal levier** plus clair et plus visuel (consigne en tête, phrases simples, historique), sans changer les calculs.
3. **Scène secrète du premier millionnaire** (surprise : ne jamais la décrire à Théo ; une fois par appareil + « Revoir le sacre »). Priorité à reconfirmer avec Théo.
4. **Finaliser Moi**, puis **transfert de Moi à Clément et Devlin** : piste prioritaire de Théo (24/11) = données sur leur téléphone plutôt qu'un Google Sheet. Points à trancher avant : Moi tire les cours de Google Finance via le Sheet, et le relevé de fin de mois vers le Versus part du Sheet ; sans Sheet, il faut une autre source de cours et un autre envoi du relevé. Ancienne méthode (transfert du Sheet) : `FICHE_TRANSFERT.md`.
