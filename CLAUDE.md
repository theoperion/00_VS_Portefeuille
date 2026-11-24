# Versus : fiche commune pour Claude

Fiche courte, lue automatiquement. Ce dépôt contient **deux applis**, chacune avec sa conversation :
- **Perso · Versus** (le jeu : championnat entre amis) → lire aussi **`docs/jeu/FICHE_JEU.md`** ; idées dans `docs/jeu/IDEES_JEU.md`.
- **Perso · Moi** (le suivi privé du portefeuille de Théo) → lire aussi **`docs/moi/FICHE_MOI.md`** ; idées dans `docs/moi/IDEES_MOI.md`.

Chaque conversation ne lit que sa fiche et ne touche qu'à ses fichiers. Ancienne fiche et journal des versions (jusqu'au 24/11/2026) : `archives/`, à ne lire que si Théo le demande.

## Règles de travail (communes)
- Théo est **non technique** : Claude fait tout, en français simple, sans jargon.
- Claude propose → Théo valide → Claude construit, teste, publie. Une idée **nouvelle** de Claude se propose avant d'être construite ; ce qui a été validé ensemble se publie sans renvoyer de captures à Théo.
- Une chose à la fois, étape par étape. Une version publiée par lot terminé (pas de rafale).
- **Idées** : toute idée non finalisée va dans le fichier d'idées de sa partie (jamais dans les fiches). Ne le lire que si Théo le demande.
- Pas de tâche programmée sans demande explicite de Théo, une seule à la fois.
- Toujours finir par : ce qui est en ligne, tests passés, explication courte, et quels agents ont relu et pourquoi.

## Règles à ne jamais enfreindre
1. Théo ne doit **jamais voir les données financières de Clément, Devlin, Kévin** (ni copie dans un dépôt, une capture, un message). Leurs fichiers ne se lisent que pour une opération technique.
2. **Aucun identifiant, jeton ou secret** dans GitHub (`~/.clasprc.json` reste sur la machine). Le dépôt est **public**.
3. Opération destructive sur un Google Sheet : seulement sur instruction explicite de Théo.
4. Ne pas toucher aux autres applis (budgets, Compagnie de l'Aube, carnets).
5. `app_scripts` (serveur, privé) est partagé : toujours `git pull --rebase` avant de pousser. Les deux conversations Versus/Moi travaillent dans le **même dépôt** : toujours récupérer `main` avant de commencer et avant de pousser.
6. Tests : jamais les vraies données ; intercepter `https://script.google.com/**` avec de fausses données.

## Où est quoi
| Fichier | Partie |
|---|---|
| `index.html`, `css/versus.css`, `sw.js`, `manifest.webmanifest` | communs |
| `version.js` (`app` + `date`) : **seul endroit à changer** à chaque mise en ligne (sert aussi au cache hors connexion). Version actuelle : **20.21** | commun |
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
| moi-code-donnees | rien ne casse, saisie jamais perdue ni arrondie, jamais le chiffre d'un autre joueur, rien de personnel dans le dépôt public | à écrire |
| moi-utilisateur | une personne au téléphone comprend tout du premier coup | à écrire |
| moi-avocat-du-diable | conteste chaque idée ou gros changement | à écrire |
| agents du jeu | à définir avec Théo | — |

## À revoir à la fin du tri (décision de Théo, 24/11)
- Dépôt public : fiche de transfert PDF (`docs/transferts/`) et identifiants des fichiers Google dans `archives/` ; décider où les ranger.
- `archives/MODE_EMPLOI_2026-11-24.md` : supprimer à terme (l'historique Git garde déjà chaque version).
