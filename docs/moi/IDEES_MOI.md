# Idées pour Moi (non finalisées)

Ce fichier n'est **pas** lu automatiquement : seulement quand Théo le demande. Rien ici n'est validé.

## 1. Copilote d'investissement (gros projet, à découper)
**Méthode demandée par Théo (24/11)** : hiérarchiser, puis avancer **une étape après l'autre**, chacune validée avant la suivante.
- But ultime de Théo : des **règles fixées à l'avance** pour que les émotions ne décident plus (« si tu me dis de ne pas vendre, je ne vends pas »), perfectible petit à petit ; conseille sans exécuter ; jamais un conseil financier professionnel.
- Étendre l'esprit de la stratégie levier (tendance EMA 45 semaines / bande −5 %, alarme de volatilité, creux) au reste du portefeuille (ETF Monde, émergents, or, CTO…) : quand renforcer, quand alléger.
- Avant toute proposition : **test sur l'historique** de chaque ligne (fiscalité PEA/AV/CTO, frais, faux signaux) ; comparer honnêtement « tout Nasdaq » et un cœur diversifié (pertes max type 2000-2002 / 2022, durée de récupération).
- Assurance-vie Linxea Spirit 2 comprise (pas Quintessa) : revoir la part d'or et l'idée des « 10 000 € sur l'or ». Règle d'or : rester le plus simple possible.
- Équipe à monter pour ce chantier : allocation d'actifs, stratégies de tendance et levier, test sur l'historique, fiscalité, avocat du diable.
- Esquisse plus ancienne (20/11) : cœur ETF Monde ~80-85 % en versements fixes + satellite Nasdaq ×2 ~15-20 % piloté par le signal ; « où mettre ton versement » chaque mois.

## 2. Autres idées
- Projection du patrimoine jusqu'en 2034 (prudent / central / optimiste, avec Artema et le prêt).
- Comparateur « où mettre le prochain euro ».
- Variation de clôture par ligne enregistrée chaque jour (détail 5 jours des jours anciens identique à « Jour »).
- Kévin en profil complet (s'il le veut) : tout activer selon son portefeuille (chercher `M.simple` dans `moi.js`).
- **Kit « Moi » pour Kevin** (et d'autres) : sa propre partie Moi en autonomie, en important ses ordres de bourse (exports du courtier) ou en les saisissant, données dans **son** Drive, sans que Théo voie ses montants. Crash test du 24/11 annulé : nouvelle date à fixer.
- Import de documents du courtier (CSV/Excel, PDF des courtiers courants).
- **Script de déclaration d'impôts** de Théo (HTML, dans son Google Drive, fonctionne) : à revérifier ensemble ; piste d'un récapitulatif annuel d'aide à la déclaration (sans engagement de responsabilité).
- **Risque Google Finance** : les cours dépendent de GOOGLEFINANCE (peut être limité ou arrêté). Prévoir une source de cours interchangeable et un mode secours (derniers cours connus, saisie manuelle).
- Comparaison honnête avec Finary, TradingView, Yahoo Finance, Google Finance : où Moi est meilleur (personnalisation, jeu, données chez soi), où il ne l'est pas.
- Nettoyage du code : retirer l'export agenda (.ics) resté inactif dans `moi.js` (`icsEcheances`, `telechargerIcs`, bouton `#ec-ics` jamais affiché), puisque Théo l'a refusé.

## 3. Notées par Théo le 24/11 (pas encore regardées)
- **À vérifier en premier (possible erreur)** : l'événement « crash du S&P 500 » de vendredi s'affiche encore aujourd'hui. Règle attendue : un événement n'apparaît qu'à la clôture du jour, si ses conditions sont remplies.
- **Durée des événements** : visibles le jour même et le lendemain, retirés à l'ouverture du jour suivant ; un événement du vendredi reste tout le week-end.
- **Stratégie levier** : ajouter un indicateur « cash » pour savoir quand repasser en ×1 quand le prix casse la moyenne mobile, tout en gardant la règle actuelle (qui a permis de rester investi aujourd'hui). À examiner avec l'équipe d'agents du copilote.
- **Marchés de l'onglet Moi** : ajouter les semi-conducteurs (SEMI) et SOXL (×3 des semi-conducteurs ; Théo a écrit ×4, à vérifier), pour tout le monde.
- **Fiche de chaque produit** : ajouter la volatilité de l'ETF à levier aux autres données.
- **Connecteur TradingView** pour l'historique des cours (à étudier : disponibilité, fiabilité).
- **Kévin** : passage en profil complet lancé le 24/11 (voir la fiche, À faire n°5). Piste : ensuite, relevé automatique de fin de mois vers le Versus (plus de saisie à la main).
- **Transfert des fichiers (décision de Théo, 24/11)** : on garde le dépôt `app_scripts` (code sans données) et on transfère le Sheet **avec** son script (fiche de transfert actuelle). Conséquence acceptée : après le transfert, le script de l'ami ne se met plus à jour depuis Git (sauf s'il refait un « clasp push » lui-même ou redonne l'accès). Donc juste avant chaque transfert : pousser la dernière version du script commun dans son fichier.
- **Bouton « J'ai mes lignes »** (24/11, Théo pas convaincu tant que Kévin envoie ses lignes) : chacun recopie lui-même son portefeuille (nom, quantité, prix de revient) depuis Moi, sans passer par Théo. Utile surtout pour de nouveaux joueurs.
- **Cloudflare** (plus tard, décision de Théo 24/11) : remplacer les scripts Google par un petit serveur Cloudflare (plus rapide, sans Sheet). À trancher avant : source des cours, envoi du relevé au Versus, sauvegarde.
- **Signal levier, bilan après coup** (Théo, 25/11) : quand il y a eu un creux, dire pour chaque indicateur s'il aurait fallu sortir ou non (comparer « sortir au signal » à « rester »), pour savoir quels indicateurs sont fiables.
- **Volatilité de chaque actif** (Théo, 25/11) : afficher la volatilité (écart des variations, sur 1 an glissant) à côté de chaque ligne et du portefeuille.
