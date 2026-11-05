# Fiche · Transférer « Portefeuille & Épargne » à son propriétaire

> Pour **Clément** et **Devlin** (Kévin reste chez Théo). Prévu : 3e semaine de novembre 2026.
> Durée : 5 min pour Théo, 10 min pour l'ami. **Aucun besoin de Claude.**
> Après le transfert, **le fichier est à lui seul** : Théo ne voit plus rien. Son relevé Versus de fin de mois reste **automatique** : c'est son fichier qui l'envoie.

---

## Avant le jour J · Théo (une seule fois, dès que possible)

Le script de chaque fichier a reçu une nouveauté (l'envoi du relevé) qui demande une autorisation Google.

Pour **chacun** des deux fichiers (« Portefeuille & Épargne Clément », puis « … Devlin ») :
1. Ouvre le fichier → menu **Extensions → Apps Script**.
2. En haut, dans la liste des fonctions, choisis **`installerTout`** → **Exécuter**.
3. Google demande une autorisation → **Examiner les autorisations** → ton compte → **Paramètres avancés** → **Accéder à … (non sécurisé)** → **Autoriser**. *(C'est ton propre script : normal.)*
4. En bas, le journal affiche « ✓ Installé ». Ferme l'onglet.

---

## Jour J · 1. Théo (≈ 2 min par fichier)

1. Ouvre le fichier → **Extensions → Apps Script** → à gauche, l'icône **⏰ Déclencheurs** → supprime **tes** déclencheurs (icône ⋮ → Supprimer). *(Ils ne marcheraient plus une fois le fichier transféré.)*
2. Reviens au fichier → bouton **Partager** → ajoute l'adresse Gmail de l'ami en **Éditeur** (s'il n'y est pas) → **Envoyer**.
3. Dans la même fenêtre, à droite de son nom → menu → **Transférer la propriété** → **Envoyer l'invitation**.

---

## Jour J · 2. L'ami (≈ 10 min, sur ordinateur de préférence)

1. **Accepter** : ouvre l'e-mail « Invitation à devenir propriétaire » → **Accepter**.
2. **Autoriser son script** : ouvre le fichier → **Extensions → Apps Script** → choisis **`installerTout`** → **Exécuter** → **Examiner les autorisations** → ton compte → **Paramètres avancés** → **Accéder à … (non sécurisé)** → **Autoriser**. Le journal affiche « ✓ Installé ».
3. **Créer ton adresse** : en haut à droite **Déployer → Nouveau déploiement** → roue ⚙️ → **Application Web** →
   - Description : `mon patrimoine`
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
   → **Déployer** → **copie l'URL** (elle finit par `/exec`).
4. **Dans l'appli Versus** (téléphone) : **Réglages → Moi** → colle la nouvelle adresse dans « Adresse de ton fichier » (la **clé ne change pas**) → **Tester** → « Ton fichier répond » → **Enregistrer**.
5. **Ouvre l'onglet Moi** : un message dit « 🔗 Ton fichier enverra lui-même ton relevé de fin de mois au Versus ». C'est fait.
6. **Retirer Théo** : bouton **Partager** du fichier → à côté de Théo → **Supprimer l'accès** → **Enregistrer**.

---

## Vérifier (Théo, dans l'appli)

- **Réglages → Relevés automatiques de fin de mois → Tester** : à côté de son nom, « **envoie lui-même son relevé (fichier transféré)** ».
- Le dernier jour ouvré du mois, vers 19 h, son relevé apparaît au classement, et « Import auto » dans l'onglet *Journal app* du Sheet Versus.

## Si quelque chose coince

| Problème | Solution |
|---|---|
| « Tester » dit que le fichier ne répond pas | Vérifier l'étape 3 : **Qui a accès : Tout le monde**, et l'adresse finit bien par `/exec`. |
| Pas de message 🔗 à l'ouverture de l'onglet Moi | Fermer et rouvrir l'appli (il réessaie à chaque ouverture). |
| Le relevé de fin de mois n'est pas arrivé | L'ami reçoit un e-mail « relevé non envoyé » : il fait son relevé à la main (bouton **+ › Relevé**). |
| Il a perdu sa clé | Dans son fichier : Extensions → Apps Script → en haut du fichier `API`, remplacer `CHANGE-MOI` par une nouvelle clé → exécuter **`definirCle`** → remettre `CHANGE-MOI`. Puis la saisir dans l'appli. |
| L'ancienne adresse marche encore | Normal tant que Théo n'a pas été retiré ; après, seule la nouvelle compte. |
