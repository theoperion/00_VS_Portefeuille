# Versus Portefeuille · Mode d'emploi

> Document de référence de l'appli. Tout ce qui est décidé, fait ou à faire est ici.
> Dernière mise à jour : 05/11/2026

## 1. C'est quoi, en une phrase

Une appli web installée sur le téléphone (GitHub Pages) où 4 personnes comparent leurs portefeuilles.
L'onglet **Moi** lit en privé le fichier « Portefeuille & Épargne » de chacun.

## 2. Comment c'est branché

```
Téléphone (appli GitHub Pages : ce dépôt)
   ├── onglet classement ──► API Apps Script « Versus » ──► Google Sheet « Versus Portefeuille » (partagé, 4 joueurs)
   └── onglet Moi ─────────► API Apps Script personnelle ──► Google Sheet « Portefeuille & Épargne » (privé, 1 par personne)
```

| Élément | Où | Propriétaire actuel |
|---|---|---|
| Appli (page, scripts, icônes) | ce dépôt GitHub | Théo |
| API Versus (Apps Script) | Google, *pas encore dans GitHub* | Théo |
| Sheet Versus Portefeuille | Google Drive | Théo |
| Sheets Portefeuille & Épargne (×4) | Google Drive | Théo (transfert prévu plus tard) |

## 3. Décisions validées ✅

- [x] On commence par **Versus**, puis les autres applis une par une, chacune avec son `MODE_EMPLOI.md`.
- [x] Les dépôts restent **publics** (GitHub Pages gratuit), mais on **sort l'adresse et la clé de l'API du code**.
- [x] Le code Apps Script sera **rangé dans GitHub** et envoyé chez Google automatiquement (outil `clasp`), fini les copier-coller.
- [x] Connexion Google ↔ Claude faite avec **ta propre clé Google Cloud** (projet `clasp-theo`, ton compte Google principal, mode « Test »). Voir § 6.
- [x] Transfert plus tard (quand les applis seront rodées) à Clément (frère), Devlin et Carla : Sheet + Apps Script + dépôt GitHub.

## 4. À faire ⏳

- [x] Brancher Google ↔ GitHub (`clasp`) et récupérer le code Apps Script de Versus
- [x] Récupérer la structure du Sheet Versus
- [ ] Décider où ranger le code Apps Script (il contient des e-mails : pas dans ce dépôt public)
- [ ] Faire le ménage dans les déploiements (Versus en a 27, seul le @27 sert)
- [ ] Audit complet → checklist des corrections à valider
- [ ] Corriger le décalage `moi.js?v=25` (sw.js) / `v=26` (index.html)
- [ ] Sortir l'adresse API du code
- [ ] Étape « transférer la propriété » et « reconnecter les applis »

## 5. Connexion Google (clasp) : ce qui existe

| Élément | Valeur |
|---|---|
| Projet Google Cloud | `clasp-theo` (console.cloud.google.com) |
| Compte | ton compte Google principal (ajouté en « utilisateur test ») |
| Script Versus | ID `1B_mjBofeUgigFcVvN5GpWVO-DU-fmVMZ_dIuDhBJCtwgkCZbkixEFlpE` · déploiement utilisé : version 27 |
| Script Portefeuille & Épargne (Théo) | ID `1Cq2SGenlMeTyU5BtKR9i-GCaG8sPT6Co763rMu3S7NYmY4gZxpepOZOW` · dernière version : 13 |

**Si Claude n'arrive plus à se connecter** (le mode « Test » fait expirer l'accès au bout de 7 jours) : demande-lui « refais la connexion clasp ». Il te donne un lien, tu cliques « Continuer », tu lui recolles l'adresse `localhost:8888/...`.
**Retirer l'accès** : https://myaccount.google.com/permissions → « Mes applis Theo » → Supprimer l'accès.

## 6. Journal des modifications

| Date | Quoi |
|---|---|
| 05/11/2026 | Création de ce mode d'emploi |
| 05/11/2026 | Connexion Google (clasp) ; code et structure des Sheets récupérés ; audit lancé |
