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

Où est le code :
- **Appli téléphone** : ce dépôt (public).
- **Scripts Google** : dépôt **privé** `theoperion/app_scripts` (un dossier par script).
- **Audit détaillé** : `app_scripts/audits/versus-2026-11.md`.

---

## 3. Les adresses officielles (une par script)

| Script | Adresse officielle | État |
|---|---|---|
| Versus | déploiement n°27 (`…xVNsHSYT…`), inscrit dans le code | ✅ Les 26 anciennes adresses donnent le même code (marquées « ancienne adresse » dans Apps Script) |
| Moi · Théo | déploiement n°13 (`…wUZGrzfS…`) | ✅ Les 5 anciennes adresses donnent le même code |
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
- 🟡 1.1 **Qui suis-je ?** (données mal enregistrées)
  - Constat : en admin, toucher « Kévin » dans le classement faisait croire à l'appli que tu *étais* Kévin → tes lignes de bourse d'octobre enregistrées sous Kévin (ligne 3 de « Lignes app »), cartes cachées de Kévin visibles.
  - Correction : pour tout ce qui est **à toi** (lignes, badge million, écurie, cartes, duels), l'appli utilise toujours **ton joueur** (Théo). Toucher un nom ne change plus que **l'affichage**. Pour voir l'appli comme un autre : Réglages → « Voir comme un joueur » (rien n'est envoyé).
  - Et : le mode « Voir comme un joueur » / date simulée ne peut plus rien envoyer (relevé, clé, lignes, million, taux).
  - Nettoyage : supprimer la ligne 3 de « Lignes app » (Kévin, 202610) ; Kévin re-partagera ses lignes.
- ⬜ 1.2 Sécurité : clé jamais dans l'adresse, vrai anti-force brute, badges vérifiés par le serveur.
- ⬜ 1.3 Fiabilité : délai max d'envoi, vrais messages d'erreur, double envoi, petits bugs de saisie, MWR.
- ⬜ 1.4 Hors connexion : cache qui ne gonfle plus, mise à jour même sur réseau lent.
- ⬜ 1.5 Ménage : script mort « Script par mois », code mort, stockage des cartes.

### Phase 2 · Onglet Moi
- ⬜ 2.1 Comprendre et documenter **le lien automatique de fin de mois** (Moi → Versus) : qui envoie quoi, quand ; pourquoi il n'a tourné que pour Théo en octobre.
- ⬜ 2.2 Choix : quelles lignes de bourse sont partagées avec les autres (réglage respecté partout).
- ⬜ 2.3 Bugs : ordre à 0 € de frais non supprimable, cases vides comptées 0 (fausse perte −100 %), enveloppes clôturées, rechargement après un ordre.
- ⬜ 2.4 Profil simple de Kévin : récupérer son script, même ménage.

### Phase 3 · Podium (novembre)
- ⬜ 3.1 Écrire les règles en clair ici, les valider ensemble **avant** de coder.
- ⬜ 3.2 Coder, tester avec une date simulée, ouvrir.

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
