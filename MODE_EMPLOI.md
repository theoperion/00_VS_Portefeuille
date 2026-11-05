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
- [x] Transfert plus tard (quand les applis seront rodées) à Clément (frère), Devlin et Carla : Sheet + Apps Script + dépôt GitHub.

## 4. À faire ⏳

- [ ] Brancher Google ↔ GitHub (`clasp`) et récupérer le code Apps Script de Versus
- [ ] Récupérer la structure du Sheet Versus
- [ ] Audit complet → checklist des corrections à valider
- [ ] Corriger le décalage `moi.js?v=25` (sw.js) / `v=26` (index.html)
- [ ] Sortir l'adresse API du code
- [ ] Étape « transférer la propriété » et « reconnecter les applis »

## 5. Journal des modifications

| Date | Quoi |
|---|---|
| 05/11/2026 | Création de ce mode d'emploi |
