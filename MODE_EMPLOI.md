# Versus Portefeuille · Mode d'emploi

> **Le seul document à suivre.** Tout ce qu'on fait passe par ici : la feuille de route, ce qui est validé, ce qui est fait.
> Dernière mise à jour : 05/11/2026

---

## 1. Comment on travaille (la règle du jeu)

1. **Claude propose** une étape (ce qu'il va faire, pourquoi, ce que ça change pour toi).
2. **Tu valides** en écrivant « OK étape X » (ou tu dis non / plus tard).
3. **Claude fait** : code dans GitHub, test, puis **mise en ligne** (branche `main` = ce qui est sur ton téléphone ; scripts Google sur leur adresse officielle). Autorisé par Théo le 05/11/2026, à condition que Claude dise à chaque fois ce qu'il met en ligne.
4. **Tu vérifies** sur ton téléphone ce que Claude te dit de regarder.
5. **On coche** l'étape ici et on l'ajoute au journal (§ 6).

**Les 3 interdits** (c'est ce qui créait le bazar) :
- ❌ Plus de copier-coller de code dans l'éditeur Apps Script : le code vit dans GitHub, Claude l'envoie.
- ❌ Plus jamais « **Nouveau déploiement** » : ça crée une nouvelle adresse. Chaque script a **une seule adresse, pour toujours** (§ 3).
- ❌ Pas de modification sans étape validée ici.

---

## 2. Ce que fait l'appli (en clair)

| Morceau | Rôle | Qui le voit |
|---|---|---|
| **Classement Versus** | 4 joueurs (Théo, Kévin, Clément, Devlin) comparent la perf de leurs portefeuilles, mois par mois, enveloppe par enveloppe. | Les 4 |
| **Onglet Moi** | « L'appli dans l'appli » : le patrimoine complet de chacun (bourse, livrets, assurances-vie, immobilier…). À la fin du mois, il **remplit automatiquement** le relevé Versus. | Chacun le sien |
| **Podium** | Arrive en novembre : saisons, règles, récompenses. | Les 4 |

```
Téléphone (ce dépôt, GitHub Pages)
  ├── Classement ──► Script « Versus » ──► Sheet « Versus Portefeuille » (partagé)
  └── Onglet Moi ──► Script perso      ──► Sheet « Portefeuille & Épargne » (1 par joueur)
                         └── fin de mois : envoie le relevé au Sheet Versus
```

**D'où viennent les chiffres de bourse (indices)** : tout est en formules dans le Sheet Versus, aucun script.
1. Onglet **Cours** : `GOOGLEFINANCE` télécharge, pour chaque indice, **tout l'historique des cours quotidiens** depuis le début du jeu jusqu'à aujourd'hui. Google le complète tout seul chaque jour.
2. Onglet **Marché** : pour chaque fin de mois (dates prises dans Data Théo, colonne A), une formule va chercher le dernier cours de ce mois dans Cours, puis calcule les performances.
3. L'appli lit Marché.

**D'où viennent les valeurs des portefeuilles** : le relevé de fin de mois de chaque joueur (saisi à la main, ou envoyé automatiquement par l'onglet Moi → étape 2.1).

Où est le code :
- **Appli téléphone** : ce dépôt (public).
- **Scripts Google** : dépôt **privé** `theoperion/app_scripts` (un dossier par script).
- **Audit détaillé** : `app_scripts/audits/versus-2026-11.md`.

---

## 3. Les adresses officielles (une par script)

| Script | Adresse officielle | État |
|---|---|---|
| Versus | `…xVNsHSYT…`, inscrit dans le code | ✅ Les 26 anciennes adresses donnent le même code (marquées « ancienne adresse » dans Apps Script) |
| Moi · Théo | `…wUZGrzfS…` | ✅ Les 5 anciennes adresses donnent le même code |
| Moi · Clément | `…yue_yIcK…` | à rattacher (phase 4) |
| Moi · Devlin | `…z2q12dXu…` | à rattacher (phase 4) |
| Moi · Kévin (profil simple) | `…zucvUCgb…` | à rattacher (phase 2) |

---

## 4. Feuille de route

Légende : ⬜ à faire · 🟡 proposé, attend ton OK · 🔧 en cours · ✅ fait et vérifié

### Phase 0 · Remettre de l'ordre (aucun changement visible dans l'appli)
- ✅ 0.1 Connexion Google ↔ Claude (clé Google Cloud `clasp-theo`, § 5)
- ✅ 0.2 Code des scripts rangé dans le dépôt privé `app_scripts`
- ✅ 0.3a Audit complet de Versus et de l'onglet Moi
- ✅ 0.3b **Une seule adresse par script** : toutes les anciennes adresses servent le même code. À chaque mise à jour, Claude met à jour **toutes** les adresses d'un coup (donc plus jamais de téléphone en retard). Les supprimer : plus tard, optionnel.
- ✅ 0.4 **Un seul numéro de version** : fichier `version.js` (le seul endroit à changer), lu par l'appli et le hors connexion. Version **12.2** en ligne, vérifiée par Théo le 05/11 (mise à jour arrivée toute seule).

### Phase 1 · Classement Versus
- ✅ 1.1 **Qui suis-je ?** · validé par Théo le 05/11/2026
  - Constat : en admin, toucher « Kévin » dans le classement faisait croire à l'appli que tu *étais* Kévin → tes lignes de bourse d'octobre enregistrées sous Kévin (ligne 3 de « Lignes app »), cartes cachées de Kévin visibles.
  - Correction : pour tout ce qui est **à toi** (lignes, badge million, écurie, cartes, duels), l'appli utilise toujours **ton joueur** (Théo). Toucher un nom ne change plus que **l'affichage**. Pour voir l'appli comme un autre : Réglages → « Voir comme un joueur » (rien n'est envoyé).
  - Et : le mode « Voir comme un joueur » / date simulée ne peut plus rien envoyer (relevé, clé, lignes, million, taux).
  - Et (v12.4) : **plus de « Je suis » ni de « Je joue en tant que »**, pour personne. Chacun ne joue qu'en son nom (celui de son code ; la clé admin = Théo). La « vue joueur » de l'admin montre l'appli **à toi, sans tes droits d'admin**, jamais comme un autre joueur.
  - Et (serveur Versus V14) : avec la clé admin, **impossible** d'agir au nom d'un autre joueur (écurie, cartes, duels, lignes, badge million) ni de recevoir ses cartes cachées. Seule exception gardée : saisir un relevé en secours.
  - Et : le **mode admin s'éteint quand tu fermes l'appli** (et une date simulée oubliée est effacée à l'ouverture). Il ne sert plus qu'à : voir/régler les étapes à venir, gérer les codes, saisir un relevé en secours.
  - Nettoyage : supprimer la ligne 3 de « Lignes app » (Kévin, 202610) ; Kévin re-partagera ses lignes.
- ✅ 1.2 **Sécurité** · validé par Théo le 05/11/2026
  - La clé n'est plus jamais écrite dans l'adresse des requêtes (lecture en POST). Les anciens fichiers Moi (Clément, Devlin, Kévin) continuent de marcher : l'appli repasse à l'ancienne méthode pour eux jusqu'à leur mise à jour (phase 2/4).
  - Anti-force brute : la **bonne clé passe toujours**, même si quelqu'un a tapé 10 mauvaises clés (avant, ton fichier Moi te bloquait 15 min). Les codes des joueurs (8 caractères tirés au hasard) sont impossibles à deviner.
  - Clé admin : **12 caractères minimum** pour toute nouvelle clé (avant 6).
  - Reporté en phase 3 (règles du Podium) : vérification par le serveur du badge « Premier millionnaire » et des exclusifs (ce sont des règles de jeu, on les tranche avec le reste).
- ✅ 1.3 **Fiabilité** · validé par Théo le 05/11/2026
  - Délai maximal de 30 s sur tous les envois : plus d'« Enregistrement… » sans fin, un message clair à la place.
  - Si le fichier répond par une erreur, le bandeau affiche **cette erreur** (avant : « 📴 Hors connexion », trompeur).
  - Plus de double envoi avec « Enregistrer quand même ».
  - Saisie : « −500 » copié depuis l'appli et « 1.234,56 » sont acceptés.
  - % de plus-value : plus de pourcentage inversé quand on a retiré plus que versé (affiché « — »).
  - Récap des lignes : un code bizarre ne peut plus le faire planter.
  - **MWR** : désormais **cumulé sur la période** (comparable au TWR juste à côté ; avant, annualisé au-delà d'un an), versements comptés en milieu de mois comme dans le Sheet, et calculé même sur un mois crypto à ±50 %.
  - E-mails de rappel : le lien ouvre bien l'appli (`00_VS_Portefeuille`).
- ✅ 1.4 **Hors connexion** · validé par Théo le 05/11/2026
  - Sur réseau lent, l'appli s'ouvre tout de suite avec la copie du téléphone **et** garde la nouvelle version pour la prochaine ouverture (avant : elle restait bloquée sur l'ancienne).
  - Cache qui ne gonfle plus (fait en 0.4).
  - Au démarrage, pendant la mise à jour des chiffres, un relevé n'est plus refusé « Hors connexion » : message « réessaie dans quelques secondes ».
- ✅ 1.5 **Ménage** · validé par Théo le 05/11/2026
  - « Script par mois » supprimé (il écrivait dans un onglet qui n'existe plus). Si son déclencheur traînait encore, il se retire tout seul à sa prochaine exécution.
  - Cartes et duels rangés **une case par saison** (avant : une seule case limitée à 9 Ko, pleine vers 2030). Les anciennes données sont reprises automatiquement.
  - Code jamais utilisé retiré (moteur de calcul, onglet Moi).
  - Laissé volontairement (sans risque, à revoir au découpage 5.1) : branches du mode « démo », restes de la carte « Huile », quelques styles inutilisés, doublons internes de l'onglet Moi.
  - Les 25 anciennes adresses Versus et 4 adresses Moi : gardées (elles servent le même code). À supprimer seulement quand tout le monde sera sûr d'utiliser l'officielle.

- ✅ 1.6 **Timing des versements** (v12.8) : dans la fiche d'un joueur, sous « MWR », une ligne « Timing des versements : favorable / défavorable (± x pts) » quand l'écart MWR − TWR dépasse 0,5 point. Un appui l'explique en une phrase.

**Phase 1 terminée ✅** (05/11/2026). Reste volontairement pour plus tard : anti-triche du badge million et des exclusifs (phase 3), petits restes de code (5.1).

### Phase 2 · Onglet Moi
- ⬜ 2.1 Comprendre et documenter **le lien automatique de fin de mois** (Moi → Versus) : qui envoie quoi, quand ; pourquoi il n'a tourné que pour Théo en octobre.
- ⬜ 2.2 Choix : quelles lignes de bourse sont partagées avec les autres (réglage respecté partout).
- ⬜ 2.3 Bugs : ordre à 0 € de frais non supprimable, cases vides comptées 0 (fausse perte −100 %), enveloppes clôturées, rechargement après un ordre.
- ⬜ 2.4 Profil simple de Kévin : récupérer son script, même ménage.
- ⬜ 2.5 **Saisir un ordre (achat / vente) facilement** : revoir le parcours de saisie dans l'onglet Moi et ajouter un mini-tutoriel clair, étape par étape.

### Phase 3 · Podium (novembre)
- ⬜ 3.1 Écrire les règles en clair ici, les valider ensemble **avant** de coder.
- ⬜ 3.2 Coder, tester avec une date simulée, ouvrir. Inclut : badge million et exclusifs vérifiés par le serveur (anti-triche).
- ⬜ 3.3 Quand toutes les fonctionnalités sont sorties (vers février 2027) : supprimer l'aperçu des étapes à venir ; il ne reste en admin que les codes et la saisie de secours.

### Phase 4 · Transferts (quand tout est rodé)
- ⬜ 4.1 Mode d'emploi « transférer » : Sheet + script + dépôt à Clément, puis Devlin (Kévin reste hébergé chez Théo).
- ⬜ 4.2 Mode d'emploi « reconnecter » : nouvelle adresse dans Réglages → Moi, nouvelle clé.

### Phase 5 · Plus tard
- ⬜ 5.1 Découper `index.html` (5 000 lignes) en fichiers plus petits.
- ⬜ 5.2 Les autres applis (budget, carnet d'entretien…) avec la même méthode.

---

## 5. Connexion Google (clasp)

| Élément | Valeur |
|---|---|
| Projet Google Cloud | `clasp-theo`, appli « Mes applis Theo » (mode Test) |
| Compte | ton compte Google principal (ajouté en « utilisateur test ») |
| Script Versus | ID `1B_mjBofeUgigFcVvN5GpWVO-DU-fmVMZ_dIuDhBJCtwgkCZbkixEFlpE` |
| Script Moi · Théo | ID `1Cq2SGenlMeTyU5BtKR9i-GCaG8sPT6Co763rMu3S7NYmY4gZxpepOZOW` |

- **Si Claude n'arrive plus à se connecter** (le mode Test fait expirer l'accès après 7 jours) : dis-lui « refais la connexion clasp » → un lien → « Continuer » → tu recolles l'adresse `localhost:8888/...`.
- **Retirer l'accès** : https://myaccount.google.com/permissions → « Mes applis Theo » → Supprimer.

---

## 6. Journal

| Date | Étape | Quoi |
|---|---|---|
| 05/11/2026 | — | Création du mode d'emploi |
| 05/11/2026 | 0.1, 0.2 | Connexion Google ; code des scripts dans `app_scripts` (privé) |
| 05/11/2026 | 0.3a | Audit : 3 urgents, 11 bugs, 5 points sécurité, 3 hors connexion, 5 ménage |
| 05/11/2026 | — | Mode d'emploi réorganisé en feuille de route |
| 05/11/2026 | 0.3b | Toutes les anciennes adresses Versus (26) → code n°27 ; Moi Théo (5) → code n°13 |
| 05/11/2026 | 0.4 | `version.js` : version unique 12.2 ; le cache hors connexion ne gonfle plus (vérif de mise à jour jamais gardée) |
| 05/11/2026 | 1.1 | v12.3 : identité = toujours ton joueur ; mode admin limité à la session ; simulation n'envoie plus rien. Connexion Google refaite avec droit d'écriture sur les Sheets |
| 05/11/2026 | 1.1 | Ligne 3 de « Lignes app » (Kévin, 202610, contenait le portefeuille de Théo) supprimée à la demande de Théo ; copie de sauvegarde dans `app_scripts/audits/sauvegardes/` |
| 05/11/2026 | 1.1 | Serveur Versus V14 (version Google n°28, sur les 26 adresses) : l'admin reste Théo. Outil `app_scripts/outils/deployer.py` pour les mises en ligne. Note : une version n°29 vide a été créée par erreur (même code, inutilisée) |
| 05/11/2026 | 1.1 | v12.4 : suppression de « Je suis », « Je joue en tant que » et du choix du joueur dans la vue joueur (testé par Théo : mode admin bien éteint à la réouverture) |
| 05/11/2026 | 1.1 | ✅ Validé par Théo |
| 05/11/2026 | 1.2 | Sécurité : lecture en POST, bonne clé jamais bloquée, clé admin ≥ 12. Appli v12.5 ; Versus V15 (version Google 30) ; Moi Théo V11 (version Google 14) |
| 05/11/2026 | 1.2 | ✅ Validé par Théo |
| 05/11/2026 | 1.3 | Fiabilité : délais d'envoi, vraie erreur affichée, double envoi, saisie des nombres, MWR cumulé (milieu de mois), lien des e-mails. Appli v12.6 ; Versus V16 (version Google 31) |
| 05/11/2026 | 1.3 | ✅ Validé par Théo |
| 05/11/2026 | 1.4 | Hors connexion : nouvelle version gardée même sur réseau lent. Appli v12.7 |
| 05/11/2026 | 1.5 | Ménage : « Script par mois » supprimé, cartes/duels par saison, code mort retiré. Versus V17 (version Google 32) |
| 05/11/2026 | 1.4, 1.5 | ✅ Validés par Théo |
| 05/11/2026 | 1.6 | « Timing des versements » dans la fiche joueur. Appli v12.8. **Phase 1 terminée** |
