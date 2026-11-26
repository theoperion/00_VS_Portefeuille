# Versus : fiche commune pour Claude

Fiche courte, lue automatiquement. Ce dépôt contient **deux applis**, suivies dans **une seule conversation « Perso · Versus »** (choix de Théo, 24/11), un chantier à la fois, avec `/clear` entre un chantier du jeu et un chantier de Moi :
- **le jeu** (championnat entre amis) → pour un chantier du jeu, lire **`docs/jeu/FICHE_JEU.md`** ; idées dans `docs/jeu/IDEES_JEU.md` ; agents `jeu-*`.
- **Moi** (le suivi privé du portefeuille) → pour un chantier de Moi, lire **`docs/moi/FICHE_MOI.md`** ; idées dans `docs/moi/IDEES_MOI.md` ; agents `moi-*`.

Ne lire que la fiche de la partie du chantier en cours. Ancienne fiche et journal des versions (jusqu'au 24/11/2026) : `archives/`, à ne lire que si Théo le demande.

## Règles de travail (communes)
- Théo est **non technique** : Claude fait tout, en français simple, sans jargon.
- Claude propose → Théo valide → Claude construit, teste, publie. Une idée **nouvelle** de Claude se propose avant d'être construite ; ce qui a été validé ensemble se publie sans renvoyer de captures à Théo.
- Une chose à la fois, étape par étape. Une version publiée par lot terminé (pas de rafale).
- **Idées** : toute idée non finalisée va dans le fichier d'idées de sa partie (jamais dans les fiches). Ne le lire que si Théo le demande.
- Pas de tâche programmée sans demande explicite de Théo, une seule à la fois.
- GitHub (Théo, 24/11) : Claude fusionne lui-même ses demandes de fusion (PR) une fois les tests passés, sans demander à Théo à chaque fois.
- Toujours finir par : ce qui est en ligne, tests passés, explication courte, et quels agents ont relu et pourquoi.

## Règles à ne jamais enfreindre
1. Théo ne doit **jamais voir les données financières de Clément, Devlin, Kévin** (ni copie dans un dépôt, une capture, un message). Leurs fichiers ne se lisent que pour une opération technique.
2. **Aucun identifiant, jeton ou secret** dans GitHub (`~/.clasprc.json` reste sur la machine). Le dépôt est **public**.
3. Opération destructive sur un Google Sheet : seulement sur instruction explicite de Théo.
4. Ne pas toucher aux autres applis (budgets, Compagnie de l'Aube, carnets). Dans `app_scripts`, ne modifier **que** `versus/`, `portefeuille-epargne/` et, si besoin, `outils/` (jamais `carnet-t3/`, `carnet-t4-carla/`, `compagnie-de-l-aube/`). À la fin de chaque version, lister à Théo les fichiers modifiés, dépôt par dépôt.
5. `app_scripts` (serveur, privé) est partagé : toujours `git pull --rebase` avant de pousser. Toujours récupérer `main` avant de commencer et avant de pousser.
6. Tests : jamais les vraies données ; intercepter `https://script.google.com/**` avec de fausses données.

## Où est quoi
| Fichier | Partie |
|---|---|
| `index.html`, `css/versus.css`, `sw.js`, `manifest.webmanifest` | communs |
| `version.js` (`app` + `date`) : **seul endroit à changer** à chaque mise en ligne (sert aussi au cache hors connexion). Version actuelle : **20.89** | commun |
| `js/1-base.js` … `js/8-eredor-demarrage.js`, `js/icones.js`, `js/sons.js`, `piste.js`, `img/cartes/` | jeu |
| `moi.js`, `moteur.js` (calculs) | Moi |
| `outils-tests/` | tests (harness, scènes 3D, captures) |
| `docs/jeu/` | fiche, idées et règles du championnat (`REGLES_PODIUM.md`) |
| `docs/moi/` | fiche et idées de Moi |
| `docs/transferts/` | transfert des fichiers de Clément et Devlin (`FICHE_TRANSFERT.md/.pdf`) |
| Serveur : dépôt privé `theoperion/app_scripts` (`versus/` = serveur du jeu ; `portefeuille-epargne/<nom>` = scripts perso) | — |

## Tester et publier
- Serveur local `python3 -m http.server 8771` depuis ce dépôt ; Playwright + Chromium. Théo est sur **Firefox Android** (doit aussi marcher sur Chrome et iPhone).
- Après chaque version : 0 erreur JS, lisible à 390 px en clair et en sombre, fluide.
- Publier : changer `version.js`, commit « vX.Y : … », push sur `main`. Une ligne par version suffit dans le message de commit (plus de journal séparé).
- Serveur Apps Script : prérequis `npx -y @google/clasp@3.4.1 login` (compte de Théo). Versus : `sh outils/mettre-en-ligne-versus.sh "VNN : …"` depuis `app_scripts`. Scripts perso : `clasp push --force` puis `python3 ../../outils/deployer.py "…"` (adresses inchangées). Outil Sheets : `outils/gs.py`.
- Validation (Théo, 21/11) : contrôles oui/non prouvés par test ou capture, pas de notes sur 10. Un seul NON → corriger et revérifier.

## Agents
Dans `.claude/agents/`, préfixés `moi-` ou `jeu-` (4 au plus par partie). Méthode (comme le Budget) : besoin réel → rôle en une phrase → points de contrôle validés par Théo → essai avec une erreur cachée.

| Agent | Rôle | État |
|---|---|---|
| `moi-patrimoine` | chaque chiffre de Moi juste, partout pareil, fidèle aux règles et aux documents officiels | ✅ essai réussi (24/11) |
| `moi-code-donnees` | rien ne casse, saisie jamais perdue, jamais le chiffre d'un autre joueur, rien de personnel dans le dépôt public | ✅ essai réussi (24/11) |
| `moi-utilisateur` | une personne au téléphone comprend tout du premier coup | ✅ essai réussi (24/11) |
| `moi-avocat-du-diable` | conteste chaque idée ou gros changement | ✅ essai réussi (24/11) |
| `jeu-arbitre` | chaque point du championnat donné selon les règles, appli et serveur d'accord | ✅ essai réussi (24/11) |
| `jeu-code-donnees` | rien ne casse, fluide, jamais un montant (seulement des %), aucun secret qui fuit | ✅ essai réussi (24/11) |
| `jeu-joueur` | une personne au téléphone comprend tout, rien ne se recouvre | ✅ essai réussi (24/11) |
| `jeu-avocat-du-diable` | conteste chaque idée ou gros changement | ✅ essai réussi (24/11) |

### Renforts prévus (seulement au démarrage du chantier, puis retirés)
- Décors 3D et cartes : un « directeur artistique » (beauté, effet waouh).
- Teasers vidéo de décembre : adapter les agents vidéo de Chez moi (ton épique).
- Copilote (Moi) : équipe allocation d'actifs, tendance/levier, test sur l'historique, fiscalité, avocat du diable.

## À revoir à la fin du tri (décision de Théo, 24/11)
- Dépôt public : fiche de transfert PDF (`docs/transferts/`) et identifiants des fichiers Google dans `archives/` ; décider où les ranger.
- `archives/MODE_EMPLOI_2026-11-24.md` : supprimer à terme (l'historique Git garde déjà chaque version).
