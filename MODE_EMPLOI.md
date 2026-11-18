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

**D'où viennent les valeurs des portefeuilles : le relevé automatique de fin de mois**
- **Qui le fait** : le **script Versus** (chez Google), pas le téléphone. Tous les jours vers 19 h, il regarde si on est le **dernier jour ouvré du mois** ; si oui, il agit.
- **Pour qui** : les joueurs **reliés** (Théo, Devlin, Clément). Kévin n'est pas relié (son fichier est d'un autre type) : son relevé se fait à la main.
- **Ce qu'il lit** dans chaque fichier « Portefeuille & Épargne » : les enveloppes du périmètre *Portefeuille* (onglet Paramètres), leur valeur (onglet Positions), les apports/retraits du mois (onglet Ordres).
- **Ce qu'il écrit** : la ligne du mois dans « Data <prénom> » du Sheet Versus (+ les lignes de bourse dans « Lignes app »), et une trace « Import auto » dans « Journal app ».
- **Sécurités** : il n'écrase jamais un relevé saisi à la main ; il s'arrête si une enveloppe qui avait de l'argent le mois d'avant a disparu, ou si aucune valeur n'est lue.
- **L'onglet Moi du téléphone**, lui, sert à *voir* ton patrimoine et à saisir tes ordres ; il ne fait pas le relevé.
- **Vérifier** : Réglages (mode admin) → « Relevés automatiques de fin de mois » : l'état doit être **activé** ; le bouton **Tester** montre ce qui serait importé, sans rien écrire.
- **Octobre 2026** : seul Théo était relié le 30/10 à 19 h ; Devlin a été relié le 31/10 à 19 h 38, Clément à 19 h 54, donc trop tard pour octobre (ce n'est pas un bug). Relevés de Clément et Devlin saisis à la main le 31/10 : c'était la bonne chose à faire. **Novembre (lundi 30/11, 19 h)** : les trois seront importés.

Où est le code :
- **Appli téléphone** : ce dépôt (public).
- **Scripts Google** : dépôt **privé** `theoperion/app_scripts` (un dossier par script).
- **Audit détaillé** : `app_scripts/audits/versus-2026-11.md`.

---

### Saisir un ordre (à montrer à Clément et Devlin)

> **Onglet Moi → Saisir → Ordre.** Un ordre = une ligne recopiée de ton courtier, **à la date d'exécution**. **Achat** : enveloppe, actif, montant de l'avis d'opéré **frais compris**, quantité (le prix se calcule) et frais ; l'**apport** est coché d'office (décoche si l'argent était déjà sur le compte). **Vente** : pareil, montant **net de frais**. **Apport / Retrait** : argent mis ou retiré de l'enveloppe. **Autre type** : dividendes, frais, cas d'assurance-vie (chaque type s'explique quand on le choisit). **Relis la phrase « Tu enregistres… »** avant de valider. Erreur ? Onglet **Journal** : supprimable 7 jours.

## 3. Les adresses officielles (une par script)

| Script | Adresse officielle | État |
|---|---|---|
| Versus | `…xVNsHSYT…`, inscrit dans le code | ✅ **Seule adresse** : les 25 anciennes supprimées le 05/11/2026 (un téléphone qui en gardait une s'est rangé seul sur l'officielle, v14.3.2) |
| Moi · Théo | `…wUZGrzfS…` | ✅ **Seule adresse** : les 4 anciennes supprimées le 06/11/2026 |
| Moi · Clément | `…yue_yIcK…` | à rattacher (phase 4) |
| Moi · Devlin | `…z2q12dXu…` | à rattacher (phase 4) |
| Moi · Kévin (profil simple) | `…zucvUCgb…` | ✅ Même chose (V5). ⬜ Supprimer les 2 anciennes **après** que Kévin a ouvert une fois l'onglet Moi |

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
  - Correctif (v12.9) : la **gestion** (codes des joueurs, changer la clé admin, relevés automatiques, réglages communs) est de nouveau visible dans Réglages **dès que tu es connecté avec la clé admin**, même mode admin désactivé. Le mode admin ne sert qu'aux **aperçus des nouveautés** et à la saisie de secours.
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
- ✅ 2.1 **Relevé automatique de fin de mois** · expliqué (§ 2) ; « Tester » OK chez Théo (Théo, Devlin, Clément) · validé le 05/11/2026
  - a) Si l'import échoue pour quelqu'un : une ligne est ajoutée dans l'onglet **« Bugs »** du Sheet Versus **et** Théo reçoit un **e-mail** (Versus V18).
  - b) Texte d'aide des 4 onglets Data corrigé : la ligne du mois apparaît **le dernier jour ouvré** (pas « le lendemain »).
- ✅ 2.2 **Partage des lignes de bourse** · décision de Théo (05/11/2026) : **on ne change rien** (partagé par défaut, comme avant).
- ✅ 2.3 **Bugs de l'onglet Moi** · validé par Théo le 05/11/2026
  - Un ordre saisi avec 0 € de frais peut de nouveau être supprimé.
  - Une case vide dans l'onglet Historique n'est plus comptée 0 € (plus de « pire baisse −100 % » ni de badge « Increvable » à tort).
  - Une enveloppe clôturée reste suivie par la photo quotidienne : son retrait final est compté (plus de fausse perte). Limite connue : une enveloppe clôturée **et** une nouvelle du même type (ex. deux PEA) partagent la même colonne de l'Historique.
  - Après un ordre, l'écran se met bien à jour (un rechargement demandé pendant un autre n'est plus perdu).
  - Fichiers de Clément et Devlin : mêmes corrections à faire au moment de récupérer leurs scripts (phase 4).
- 🔧 2.4 **Fichier de Kévin** (« PF & Epargne Kévin », hébergé chez Théo) · ✅ en ligne (V4) · ⬜ **toi / Kévin** : vérifier
  - Ce que c'est : un fichier « Moi simple » pour l'**épargne** (livrets, assurances-vie, autre épargne), l'appartement et le prêt. Kévin y saisit ses mouvements depuis l'appli. **Il n'y a pas de bourse dedans** (c'est voulu).
  - Code rangé dans `app_scripts/portefeuille-epargne/kevin/` ; mêmes corrections de sécurité que le tien : lecture en POST, la bonne clé n'est jamais bloquée.
  - Relevé automatique : **pas possible** pour Kévin, puisque son fichier ne contient pas ses PEA / CTO / crypto. Son relevé Versus reste **saisi à la main** chaque fin de mois (par lui, ou par toi en secours).
- ✅ 2.5 **Saisir un ordre facilement** · validé par Théo le 05/11/2026
  - Achat : l'**apport est coché d'office** (même montant que l'achat) ; un texte explique quand le décocher.
  - « Autre type » rangé en *Courant* (Intérêts / dividendes, Frais) et *Rare* (assurance-vie, corrections), avec une phrase d'explication pour chacun.
  - Une **phrase de vérification** avant d'enregistrer : « Tu enregistres : achat de 100 DCAM sur PEA Fortuneo, le 05/11/2026, pour 520 € dont 2 € de frais, financé par un apport de 520 €. »
  - Une ligne d'aide sous le montant et les frais.
  - Tutoriel de l'appli en **un seul écran**, et fiche « Saisir un ordre » ci-dessus (§ 2).

**Phase 2 terminée ✅** (05/11/2026).

### Phase 3 · Podium (novembre)
- ✅ 3.1 **Règles écrites en clair** et **validées** : [`REGLES_PODIUM.md`](REGLES_PODIUM.md) (décisions D1 à D9 du 05/11/2026).
- 🔧 3.2 **Règles simples** · ✅ en ligne (appli v13.2, Versus V19) : tout en jeu dès janvier, égalité Pari = 0, un duel par paire, bouchon si les deux marquent, « inactive en janvier » sur les cartes, victoire partagée partout, page admin et code mort nettoyés. Testé sur une fausse saison.
- ✅ 3.4 **Nouvelles règles de points** (appli v13.3, Versus V20) : duels retirés ; 🎰 Monaco réactivé ; 🇬🇧 Silverstone (vainqueur +2) ; 🇮🇹 Monza (🎯 +2) ; 🤝 bonus d'équipe ; 🔥 série ; DRS supprimé. Testé sur une fausse saison.
- ✅ 3.5 **Pronostic du mois + rival de la saison** (appli v13.4, Versus V21) : saisie dans le Stand (fenêtre du 20 au 1er ; rival pendant la fenêtre de janvier), secrets jusqu'au 2 (rival : jusqu'à la Finale), points comptés automatiquement. Testé sur une fausse saison.
- ✅ 3.3 **Anti-triche + exclusifs partagés** (appli v13.6, Versus V22) : le serveur refait **le même calcul** que l'appli (code extrait automatiquement à chaque mise en ligne : `app_scripts/versus/PodiumCommun.js`), attribue et fige lui-même les exclusifs (plusieurs le même mois → chacun) ; l'appli ne peut plus en revendiquer. Badge millionnaire vérifié dans le fichier perso (Théo, Clément, Devlin ; pour Kévin, seulement via son portefeuille du Versus). Testé sur une fausse saison.
  - **Mise en ligne du script Versus** : toujours `app_scripts/outils/mettre-en-ligne-versus.sh "V… : …"` (il régénère le calcul commun avant d'envoyer).
- ✅ 3.8 **Règles réécrites, courtes et limpides** (v13.5) : bloc « L'essentiel » en haut des règles de l'appli, détail raccourci, tutoriel en un seul écran (plus de duels) ; `REGLES_PODIUM.md` au même format.
- ✅ 3.6 **📸 Carte postale du mois** (v13.8) : bouton sous la course du Podium → image du mois (Grand Prix, météo, podium et bonus, classement) à partager (WhatsApp…) ou télécharger.
- ✅ 3.7 **🗳️ Vote de fin de saison** (v13.9, Versus V23) : du 2 au 31 décembre dans le Stand, un vote pour un autre pilote ; résultat le 1er janvier ; le gagnant (égalité : chacun) débloque la plaque « Coup de la saison ».

**Phase 3 terminée ✅** (05/11/2026).
- ✅ 3.3 bis **Fin des aperçus admin, automatique le 1er février 2027** (appli v14.4, programmé dès maintenant) : plus de barre admin du Podium, de vue joueur, de date simulée ni de panneau « réserve ». Restent : **codes des joueurs, clé admin, réglages communs** (toujours) et **saisie de secours** (mode admin activé). Rien à faire ce jour-là.

### Phase 4 · Transferts (Clément et Devlin ; Kévin reste chez Théo)

- ✅ 4.0 **Leurs scripts mis au niveau du tien** (V12 : sécurité + 3 bugs), rangés dans `app_scripts/portefeuille-epargne/clement|devlin`. Leurs adresses ne changent pas.
- ✅ 4.1 **Décisions** (05/11/2026) : **transfert complet** (Théo n'a plus aucun accès à leurs fichiers). Les applis budget attendent la fin du travail en cours dans l'autre conversation.
- ✅ 4.1b **Relevé envoyé par leur propre fichier** (appli v14.0, Versus V24, fichiers perso V13) : `LiaisonVersus.js` dans leur script ; l'appli configure la liaison toute seule ; le Versus arrête de lire un fichier qui envoie lui-même. Testé sur les vraies données de Clément (lecture seule).
- 🟡 4.1c **Toi, dès que possible** : autoriser la nouveauté dans les 2 fichiers (fiche, partie « Avant le jour J »).
- 📄 **La fiche à suivre (et à leur envoyer)** : [`FICHE_TRANSFERT.md`](FICHE_TRANSFERT.md), aussi en PDF à télécharger : [`FICHE_TRANSFERT.pdf`](FICHE_TRANSFERT.pdf). Aucun besoin de Claude.
- ✅ 4.1d **Fiche validée par Théo** (05/11/2026). **Phase 4 prête** : il ne reste que le transfert lui-même, prévu la 3e semaine de novembre, à faire avec la fiche, sans Claude.
- ⬜ 4.2 Transfert de Clément · ⬜ 4.3 Transfert de Devlin

#### 🔁 Transférer un fichier « Portefeuille & Épargne » à un ami (≈ 5 min)

> Ce qui se passe : le fichier (et son script, qui le suit) devient **à lui**. Si tu restes **éditeur**, **rien d'autre ne change** : même adresse, même clé, relevé automatique de fin de mois toujours actif, et Claude peut toujours entretenir le script.

1. **Claude** met à jour son script (étape 4.0).
2. **Toi** : Google Drive → clic droit sur le fichier → **Partager** → ajoute son adresse en **Éditeur** (s'il n'y est pas) → **Envoyer**.
3. **Toi** : dans la même fenêtre, menu à côté de son nom → **Transférer la propriété** → **Envoyer l'invitation**.
4. **Lui** : il reçoit un e-mail « invitation à devenir propriétaire » → **Accepter**. Il ne doit **pas** te retirer l'accès.
5. **Vérifier** : son onglet Moi s'ouvre normalement ; dans tes Réglages (admin) → « Relevés automatiques » → **Tester** : il apparaît « OK ».

**S'il veut un jour te retirer complètement** (plus d'accès pour toi) :
- dans son fichier : Extensions → Apps Script → **Déployer → Nouveau déploiement** (type « Application Web », exécuter en tant que **moi**, accès **Tout le monde**) → copier l'adresse `/exec` ;
- dans **son** appli : Réglages → Moi → coller cette nouvelle adresse (même clé) → Tester ;
- son relevé Versus de fin de mois redevient **manuel** (Claude le retire de la liste des fichiers reliés).

#### 🔁 Transférer un dépôt GitHub (une appli) à un ami

1. Il crée un compte GitHub (gratuit) et te donne son **nom d'utilisateur**.
2. **Toi** : sur github.com, le dépôt → **Settings** → tout en bas **Transfer ownership** → tape son nom d'utilisateur → confirme.
3. **Lui** : il accepte l'invitation reçue par e-mail, puis dans le dépôt → **Settings → Pages** : vérifier que la branche `main` est publiée.
4. ⚠️ **L'adresse de l'appli change** : `https://SON-NOM.github.io/NOM-DU-DÉPÔT/`. Il ouvre la nouvelle adresse, l'**installe** sur son téléphone (Partager → Sur l'écran d'accueil) et **ressaisit** dans Réglages l'adresse de son API et sa clé (les réglages ne suivent pas : nouvelle adresse = nouvel espace sur le téléphone). Il peut supprimer l'ancienne icône.
5. Pour que Claude continue à l'aider, il l'ajoute (ou t'ajoute) en **collaborateur** : Settings → Collaborators.

### Phase 5 · Plus tard
- ✅ 5.1 **Code découpé** (v14.2) : `index.html` passe de 5 377 à 227 lignes. Rien ne change à l'écran (code serveur extrait identique octet pour octet, tous les tests repassés, hors connexion vérifié).
  | Fichier | Contenu |
  |---|---|
  | `index.html` | la page (structure) |
  | `css/versus.css` | les styles (ceux de l'onglet Moi sont dans `moi.js`) |
  | `js/1-base.js` | socle : configuration, stockage, chargement, classement, mois, fiches |
  | `js/2-jeu.js` | verdict du mois, positions, confettis |
  | `js/3-podium.js` | Podium : saison, cartes, écurie, défis, exclusifs |
  | `js/4-grandprix.js` | Grand Prix : circuits, course, stand, pronostic, rival, vote, carte postale |
  | `js/5-plateau.js` | pioche, étapes, règles, tutoriel |
  | `js/6-voiture3d.js` | voiture 3D |
  | `js/7-bilan.js` | bilan de l'année, réglages, onglet Moi, saisie du relevé |
  | `js/8-eredor-demarrage.js` | Ère d'or et démarrage |
  | `moteur.js` · `moi.js` · `piste.js` · `version.js` · `sw.js` | calculs · onglet Moi · circuit 3D/2D · numéro de version · hors connexion |
  Les fichiers `js/` se chargent dans l'ordre de leur numéro ; un nouveau fichier doit aussi être ajouté à `sw.js`.
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
| 05/11/2026 | 2.1 | Explication du relevé automatique (§ 2) ; cause d'octobre trouvée (Devlin et Clément reliés le 31/10 au soir, après l'import) |
| 05/11/2026 | 1.1 | v12.9 : gestion (codes, relevés automatiques, réglages communs) visible avec la clé admin sans activer le mode admin (Théo ne la voyait plus) |
| 05/11/2026 | 2.1 | ✅ Validé. Versus V18 (version Google 33) : import raté → onglet Bugs + e-mail. Textes d'aide des onglets Data corrigés |
| 05/11/2026 | 2.2 | ✅ Décision : partage des lignes inchangé |
| 05/11/2026 | 2.3 | 4 bugs de l'onglet Moi corrigés. Appli v13.0 ; Moi Théo V12 (version Google 15) |
| 05/11/2026 | 2.3 | ✅ Validé par Théo |
| 05/11/2026 | 2.4 | Fichier de Kévin récupéré ; script Moi simple V4 (sécurité). Relevé auto impossible (pas de bourse dans son fichier) |
| 05/11/2026 | 2.5 | Saisie d'un ordre simplifiée (apport coché, types expliqués, phrase de vérification, tutoriel en 1 écran). Appli v13.1 |
| 05/11/2026 | 2.5 | ✅ Validé. **Phase 2 terminée** |
| 05/11/2026 | 3.1 | Règles du Podium relevées dans le code et écrites en clair (`REGLES_PODIUM.md`) ; 9 décisions proposées |
| 05/11/2026 | 3.1, 3.2 | Règles validées (D1–D9). Appli v13.2 ; Versus V19 (version Google 34) |
| 05/11/2026 | 3.4 | Duels retirés, Monaco, Silverstone, Monza, équipe, série, DRS supprimé. Appli v13.3 ; Versus V20 (version Google 35) |
| 05/11/2026 | 3.5 | Pronostic du mois (+1 vainqueur, +1 sens du S&P 500) et rival de la saison (+5). Appli v13.4 ; Versus V21 (version Google 36) |
| 05/11/2026 | 3.8 | Règles de l'appli et tutoriel réécrits (essentiel + détail court). Appli v13.5 |
| 05/11/2026 | 3.3 | Anti-triche : exclusifs calculés et figés par le serveur (partagés si même mois), badge millionnaire vérifié. Appli v13.6 ; Versus V22 (version Google 37) |
| 05/11/2026 | — | Correctif v13.7 : ta ligne du Podium (et ta voiture, ton étiquette « moi ») prenait les styles de l'onglet Moi après sa visite (score décalé, rond gris). Classe renommée. |
| 05/11/2026 | 3.6, 3.7 | Carte postale du mois ; vote de fin de saison. Appli v13.9 ; Versus V23 (version Google 38). **Phase 3 terminée** |
| 05/11/2026 | 4 | Mode d'emploi des transferts (fichier Google, dépôt GitHub, reconnexion) ; état des accès relevé (fichiers de Clément et Devlin à Théo ; Clément éditeur du sien, Devlin sans accès) |
| 05/11/2026 | 4.0 | Scripts de Clément et Devlin récupérés et mis à jour (V12). Décision : transfert complet |
| 05/11/2026 | 4.1 | Relevé envoyé par le fichier perso (V13), réception par le Versus (V24), liaison automatique (appli v14.0). Fiche de transfert autonome |
| 05/11/2026 | 4.1 | Bouton « 🔗 Tester l'envoi du relevé au Versus » pour chaque joueur (Réglages → Moi), sans rien écrire. Appli v14.1. Fiche complétée |
| 05/11/2026 | 5.1 | index.html découpé en css/versus.css + 8 fichiers js/ (v14.2) ; hors connexion et outil d'extraction du serveur adaptés |
| 05/11/2026 | 5.1 | Correctif v14.3 : thème appliqué avant l'affichage (plus d'écran blanc à l'ouverture) ; au démarrage, un « hors ligne » passager de l'iPhone ne déclenche plus le bandeau « Hors connexion » (un nouvel essai d'abord) |
| 05/11/2026 | 5.1 | v14.3.1 : le hors connexion ne nettoie plus que ses propres caches (il effaçait celui des carnets, même site) |
| 05/11/2026 | E1 | v14.3.2 : chaque téléphone se range sur l'adresse officielle ; 25 anciennes adresses Versus et 7 du Carnet T3 supprimées (liste : app_scripts/audits/sauvegardes/2026-11-05-adresses-supprimees.json) |
| 05/11/2026 | 3.3 bis | v14.4 : les aperçus admin s'arrêtent seuls le 01/02/2027 (codes et saisie de secours gardés). Testé avant/après la date ; calcul serveur inchangé |
| 06/11/2026 | 5.1 | v14.4.1 : onglet Moi, nouvel actif : clavier lettres pour le code et le nom (il n'affichait que des chiffres) |
| 06/11/2026 | E1 | Fichier perso de Théo : 4 anciennes adresses supprimées ; actif PUST (Amundi PEA Nasdaq-100, EPA:PUST) ajouté dans Paramètres › Mes actifs |
| 06/11/2026 | 2.x | Fichier de Théo (version Google 19) : une ligne entièrement vendue n'est plus envoyée à l'onglet Moi ; ligne PUST ajoutée dans Aujourd'hui › Mes lignes (un NOUVEL actif doit y avoir sa ligne pour apparaître dans Moi) |
| 06/11/2026 | 2.x | Lignes de l'onglet Moi automatiques (Théo version Google 20 ; Clément/Devlin : code prêt, actif à leur nouveau déploiement) : tout actif détenu apparaît même sans ligne dans Aujourd'hui › Mes lignes ; lignes ajoutées chez Théo pour ETDD, STOXX600, ANX, ESE, GOLD (CTO), ETH (détenus d'abord, puis les anciens) |
| 06/11/2026 | 2.x | Fichier de Théo : ligne QQQ3 ajoutée (CTO, cachée à 0) ; Google Finance ne connaît pas QQQ3 → cours lu dans Paramètres › Cours manuel (AA30), à remplir s'il est racheté |
| 06/11/2026 | 2.x | Fichier de Théo (version Google 21) : CoursBourso.js lit sur Boursorama le cours des actifs absents de Google Finance (QQQ3) → Paramètres, colonne « Cours Boursorama (€) » (AB) ; secours : Cours manuel (AA) |
| 06/11/2026 | 5.1 | v14.4.2 : onglet Moi, meilleurs/pires jours : seuls comptent les jours où le portefeuille valait au moins la moitié de sa valeur actuelle (aujourd'hui : depuis le 10/08/2026) ; se recale seul après un gros versement |
| 16/11/2026 | 2.x | v14.5 + fichiers perso : enveloppes « À ouvrir » (préparées à zéro, invisibles dans Moi, ouvertes au 1er ordre) ; Devlin : LDDS, LEP, CTO, Crypto ; Clément : CTO, Crypto ; nouvel actif créé directement dans la saisie d'ordre |
| 16/11/2026 | 3.x | Répétition générale : vrai code serveur sur une copie des vraies données, appli rejouée du 19/11/2026 au 02/02/2027 en joueur (Clément) : 0 erreur ; cartes acceptées/refusées comme prévu (fenêtre de la chauffe jusqu'au 5 déc., pas deux fois la même carte de suite) ; révélation et atout du circuit OK |
| 16/11/2026 | 3.x | **Podium V15** (appli 15.0, Versus V25 · version Google 40), validé par Théo : barème 6·4·2·0, 🌧️ Pneus pluie = résister à la baisse, 🔥 série = 3 mois sans finir dernier, 😈 rival +3, 🔮 « S&P > +1 % ? », 🏁 défi du mois, 🅿️ pole position, 🛡️ trophée de la régularité. Règles réécrites avec schémas (appli + REGLES_PODIUM.md). Testé : saison 2027 simulée (9/9 règles), écrans en clair/sombre, pronostic avec pole enregistré par le vrai serveur |
| 16/11/2026 | 4.0 | installerTout lancé par Théo chez Clément et Devlin (autorisations validées) ; leurs adresses passées sur la dernière version (version Google 4) : liaison Versus, enveloppes à ouvrir, lignes automatiques |
| 17/11/2026 | 3.x | v15.1 + Versus V26 : un seul mail pour tous (annonce du championnat le 20/11), rappels de cartes par mail pour Théo seulement ; dans l'appli, bandeau « carte / pronostic » qui reste tant que ce n'est pas fait, et rien du Podium dans Classement/Mois/Moi avant le 20/11 (l'onglet Podium garde son teaser) |
| 17/11/2026 | 1 (plan) | Quintessa (Théo et Clément) : versements restants saisis d'avance (5/11, 5/12, 5/01 : apport 75 € = 45 € fonds euros + achat Ostrum 30 € (60/40), cours estimé) → 40 000 € d'apports au total ; plus de rappel « Versement Quintessa du 5 » |
| 17/11/2026 | plan 8-10 | v15.2 : la page ne saute plus quand un bouton redessine l'écran (Versus et Moi : Patrimoine Net/Brut, Stats, filtres) ; en-tête « Relevé oct. 26 » en pastille courte (détail en info-bulle) ; onglet Moi : « cours du JJ/MM à HH h MM » en petit sous le chiffre du jour ; bouton retour du téléphone : ferme la fenêtre ouverte, puis revient à l'onglet d'accueil, puis quitte (fini l'écran noir). Testé : répétition générale sans erreur, retour arrière, position de la page. |
| 17/11/2026 | plan 2-5 | v15.3 · **Rappels** : bandeau dans Moi quand un rappel est dû, avec « Faire » (ouvre directement la bonne saisie) et « Plus tard » (2 jours, la cloche se tait aussi) ; relevé mensuel le 1er du mois chez Théo, le 20 chez Clément (Paramètres V9 des deux fichiers) ; rappel « Versement Quintessa du 5 » retiré (versements saisis d'avance jusqu'en janvier ; ancienne ligne gardée dans le scratchpad) ; « Mises à jour » : le plus urgent en haut, réglages fixes repliés. **Réglages** : rubriques repliables (touche le titre), « Accès au Versus » remonté avant l'admin. **Raccourcis** : « Gérer » permet maintenant de renommer (✎) ou supprimer (✕). **Saisie** : les types rares passent sous « Plus… » (plus de liste « Autre type » à côté de Vente), et « Masquer les aides » en bas de la saisie (retenu sur l'appareil). |
| 17/11/2026 | plan 6,7,11,12 | v15.4 + Versus V27 (version Google 42) + fichiers perso (Théo 26, Clément 5, Devlin 5). **Prêt** : fin affichée « dans 14 ans 6 mois » (date complète dessous) ; prochaine échéance assurance comprise (assurance MAIF ajoutée au script de chacun : Théo 7,55 € puis 5,18 € après le 10/11/2036, Clément 5,05 €). **Marchés** (Moi › Aujourd'hui) : 8 cases dans l'ordre S&P 500, MSCI Monde, Nasdaq-100, Nasdaq ×2, Euro Stoxx 50, Stoxx 600, Émergents, Or ; toucher une case = sa courbe d'un an (une valeur par semaine) avec 1 mois / 3 mois / 1 an ; « Comparer » = toutes les courbes en base 100, et « or couvert / non couvert » depuis la case Or. Source : onglet Cours du Versus (Stoxx 600 ajouté en AH:AI, bloc « Marchés du jour (onglet Moi) » en AK:AN). **Cosmétiques** : thèmes 20, courbes 15, fêtes 15, emblèmes 20, titres 20 (afficheurs inchangés : 14) ; les nouveaux se gagnent par la régularité : chaque mois avec un versement débloque l'objet suivant (49 au total). **Classement** (à partir du 20/11/2026) : podium du mois, flèches de place depuis le mois dernier, mini-courbe par pilote. |
| 17/11/2026 | 3.x | v15.5 + Versus V29 (version Google 44) · **Pièges des circuits** (validés par Théo) : Bahreïn 🏜️ Mirage (🎯 à +0,5 pt), Djeddah 🧱 Murs proches (place partagée à moins de 0,2 pt), Melbourne 💥 Départ chaotique (pronostic +2/−1), Suzuka ➰ Le huit (places sur 2 mois), Miami 🥵 Chaleur (Turbo interdit, refusé aussi par le serveur), Spa 🌦️ Ardennes (Pneus pluie +3), Singapour 🌃 Safety car de nuit (dernier = 2 pts), Interlagos ⛈️ Averse (Pari +3/−2). Rien les mois spéciaux ni le mois de Monaco. Annoncés le 20/12 (étape « pieges »), en jeu dès janvier 2027. **Mise en avant** : carte « Ce mois-ci à … » (circuit, piège ou mois spécial, défi) en haut du Classement du 20 au 7 et dans le Stand ; calendrier et course affichent le piège. **Punch** : bandeau « Nouvelle manche » dans le Classement (la course se joue toute seule), éclat + gerbe d'étoiles à la révélation des cartes (et message du Pari enfin lisible), fête pour les objets gagnés par la régularité (Moi). Mesures : 60 images/s sur révélation, fêtes, Classement et Stand, aucune tâche longue ; Classement rendu en ~70 ms. Testé : 8 pièges sur saison simulée, répétition générale, retour arrière, page stable. |
| 17/11/2026 | 3.x | v15.6 · Course en plein écran : bouton ↻ pour rejouer sans quitter. Admin : « Tout afficher » montre aussi les nouveautés du Classement avant le 20/11 ; dates d'aperçu ajoutées en « Vue joueur » (2 déc. révélation, 25 avr. 2027 piège de Miami). Classement : « podium du mois » retiré (doublon de la carte Verdict) ; le Classement reste centré sur la performance, le Podium sur les points du jeu. |
| 17/11/2026 | plan 2 (suite) | v15.7 · **Cloche** : seulement ce qui demande une action, sans doublon (le texte « À mettre à jour… » du Sheet ne s'ajoute plus en double), chaque rappel avec « Faire » / « Plus tard », « Tout est à jour » (avec le prochain rappel) sinon ; la liste complète des rappels n'est plus dans la cloche mais derrière « Tous les rappels et réglages du fichier › » (= Saisir › Mises à jour). **Mises à jour** : noms courts (« Relevé du mois (Artema + Linxea) »), dates relatives (« dans 12 jours »), valeurs fixes (appartement, Artema actuel…) repliées ; « Ajouter un actif » et « Alertes de cours » repliés. |
| 17/11/2026 | plan 12 (suite) | v15.8 · **Verdict du mois en podium** (mêmes infos) : marches 2-1-3 qui montent, pilotes qui tombent sur leur marche, couronne 👑 et reflet pour le vainqueur, chiffres qui défilent, 🎯 en pastille ; 4e et suivants en lignes (lanterne rouge 🐢 teintée) ; S&P 500 en barre avec jauge « qui l'a battu ». Confettis la première fois qu'on voit le verdict d'un nouveau mois. Classement : lignes qui entrent en cascade à l'ouverture (pas aux changements de filtre), reflet sur « LEADER ». |
| 17/11/2026 | anim | v15.9 · Les animations ne se coupent plus par un tapotement à côté : révélation des cartes (fermable à côté seulement une fois toutes les cartes retournées ; « Fermer » marche toujours), fêtes de Moi (2,2 s). Confettis du verdict pas en double avec ceux du champion. Exclusif décroché : vraie annonce (icône qui surgit, damier, bouton « Mon écurie ») au lieu d'un message de 4 s. |
| 17/11/2026 | anim | v15.10 · Plein écran de la course : le bouton de relance affiche « ↻ Rejouer » (pastille de couleur), au lieu d'une simple flèche. |
| 17/11/2026 | retours | v15.11 + fichiers perso (Théo 27, Clément 6, Devlin 6) · **Classement** : les animations ne se jouent plus deux fois à l'ouverture (copie locale puis données fraîches) ; elles se rejouent en revenant sur l'onglet ou avec « Actualiser », jamais au rafraîchissement automatique. « LEADER » devient une pastille dorée, reflet une seule fois à l'ouverture (plus de boucle toutes les 3 s). **Fiches** : toucher un pilote du podium du Verdict ouvre sa fiche ; dans le tableau, le détail d'un pilote commence par « 📂 Fiche de … » ; aide « Touche un pilote… » sous le tableau. **Moi · dernière séance** : quand la bourse est fermée (nuit, week-end), bouton « 🕘 Voir la dernière séance (ven. 14/11) » : variations et € de chaque ligne à la dernière séance, puis « ↩ Revenir à aujourd'hui ». Source : onglet Perf lignes, colonnes K « Dernière séance » et L « Séance du » (Google Finance), ajoutées dans les 3 fichiers. |
| 17/11/2026 | retours | v15.12 · Prêt (Moi) : « Fin des prêts dans » / « 14 ans 6 mois » sur une seule ligne, tuiles du prêt à la même taille (testé sur écran de 375 px). |
| 17/11/2026 | retours | v15.13 · Prêt (Moi) : 6e tuile « Dont capital » (part de la prochaine échéance qui rembourse vraiment, en € et en %, avec intérêts et assurance) : plus de case grise. |
| 17/11/2026 | Quintessa | v15.14 + fichiers perso (Théo 28, Clément 7, Devlin 7) · **Carte « Quintessa »** dans Moi › Patrimoine : tuiles Valeur / Versé (à ce jour, sans les versements programmés) / Gain / part garantie ; barre de répartition ; chaque support (fonds euros, Artema, Ostrum) avec valeur, versé, gain € et % ; au toucher, sa courbe valeur vs versé (Artema et Ostrum : points = tes relevés ; fonds euros : intérêts répartis au prorata du temps, courbe estimée) ; « Toute l'assurance-vie » ; rendez-vous (niveau initial d'Artema, relevé du mois, taux et bonus du fonds euros). Les scripts envoient l'historique des ordres Quintessa déjà passés (histoAV) et le bonus du fonds euros. |
| 17/11/2026 | retours | v15.15 + fichiers perso (Théo 29, Clément 8, Devlin 8) · **Prêt** : le graphique « restant dû » (droite descendante) est remplacé par des barres année par année : capital remboursé + intérêts payés (passé plein, à venir pâle, année en cours entourée), avec le total des intérêts sur la durée et ce qu'il reste à payer (les scripts envoient maintenant les intérêts de chaque mois). **Fonds euros** : taux estimé réajustable quand on veut (Saisir › Mises à jour, ou « Ajuster » dans la carte Quintessa), bonus et date de fin compris ; rappel discret tous les 3 mois dans la cloche (« Ajuster » / « C'est bon »). |
| 17/11/2026 | Clément | Scripts (Clément 9, Théo 30, Devlin 9) : quand le fichier n'a pas d'onglet « Prêts », l'échéancier est calculé depuis Paramètres (capital, taux, durée, 1re échéance) → Clément voit enfin son prêt dans Moi (tuiles, graphique année par année, « Dont capital », assurance 5,05 €). Vérifié : 98 912 € restant dû, 487 €/mois, fin 06/2051, comme son Sheet. Kévin (profil simple) : son prêt est calculé dans l'appli, déjà couvert par la 15.15. |
| 17/11/2026 | retours | v15.16 · Graphiques empilés de Moi (patrimoine dans le temps, détail par enveloppe, épargne livret par livret) : couches lissées, dégradé et liseré, vraies couleurs distinctes par enveloppe (bleus/violets pour la bourse, verts/ors pour l'épargne) au lieu de nuances d'une même teinte, nom de chaque couche à droite quand elle est assez épaisse, total du mois dans l'info-bulle, grille plus légère. |
| 17/11/2026 | retours | v15.17 · Graphiques empilés : à plat (plus de dégradé ni de relief), couches séparées par un fin trait de la couleur du fond ; courbes lissées, couleurs distinctes et noms des couches gardés. |
| 17/11/2026 | retours | v15.18 · Graphiques empilés : retour au relief de la 15.16 (dégradé + liseré), à la demande de Théo. |
| 17/11/2026 | retours | v15.19 · Marchés : « Comparer » affiche toutes les courbes par défaut, or couvert compris. Dernière séance : la variation vient maintenant des deux dernières clôtures (Perf lignes K:L, 3 fichiers) — Google Finance remettait la « variation du jour » à 0 la nuit, d'où des lignes grises ; le bouton ne vaut que pour la séance où on l'a activé et disparaît dès qu'une nouvelle séance commence (une ligne cotée bouge). Lignes vertes/rouges comme les rubriques. |
| 17/11/2026 | retours | v15.20 · Moi le week-end : le bouton devient « 📅 Voir la semaine (16/11 → 20/11) » et affiche la variation sur la semaine écoulée de chaque ligne (colonne « 1 semaine » de Perf lignes, crypto comprise), en % et en €, avec le total ; en semaine (la nuit) il reste « dernière séance ». |
| 17/11/2026 | données | Fichier de Théo, onglet Aujourd'hui E47:E48 (BTC, ETH) : la variation du jour de la crypto était toujours à 0 (Google Finance refuse l'historique « jusqu'à hier » pour les devises) → nouvelle formule : cours / dernier prix avant aujourd'hui − 1 (anciennes formules gardées dans le scratchpad, correctifs-crypto.json). Perf lignes K:L (3 fichiers) : si Google Finance n'a pas d'historique (EPA:GOLD), la dernière séance se calcule avec cours / clôture de la veille. Reste : GOLD n'a pas de « 1 semaine » (pas d'historique Google) → 0 dans la vue « semaine » du week-end. |
| 17/11/2026 | bug | v15.21 · Bouton retour (Android et iPhone) : plus d'écran blanc. Avant, sur l'accueil, l'appli reculait au-delà de sa première page (page vide). Maintenant : fenêtre ouverte → fermée ; Moi › Patrimoine/Stats/Missions → Moi › Aujourd'hui ; autre onglet → onglet d'accueil ; sur l'accueil → « Retour encore une fois pour quitter », et un 2e retour tente de fermer l'appli (sinon on reste, jamais de page blanche). |
| 17/11/2026 | retours | v15.22 · Carte Quintessa : tuile « Versé » → simplement « à ce jour » (mention des versements programmés retirée). |
| 17/11/2026 | bug | v15.23 · Retour Android encore blanc : Chrome saute au retour les étapes d'historique créées sans geste de l'utilisateur (la « garde » l'était au démarrage) et sortait donc de l'appli. La garde est maintenant (re)créée au premier toucher de l'écran, et chaque retour est traité même s'il tombe sur une ancienne garde. Non reproductible dans le simulateur : à vérifier sur le téléphone (version 15.23 en bas des Réglages). |
| 17/11/2026 | jeu | v15.24 · **Plateau des trophées** (Podium › Trophées, en tête) : 1) **le circuit des exclusifs** : 23 cases + 👑 sur un circuit, 4 secteurs (Facile vert, Intermédiaire bleu, Difficile rouge, Légendaire or) ; case prise = couleur + pion de son détenteur ; case libre = anneau de la couleur du pilote le plus proche (avancement calculé sur les relevés : points, séries, victoires, cumul…) ; toucher une case = détail et barres d'avancement des 4 pilotes ; au centre, le compte de chacun. 2) **la course aux trophées** façon jeu de plateau : piste en serpentin, chaque défi/secret = 1 case, chaque exclusif = 3 cases, étoile tous les 5, pions qui sautent. La liste détaillée reste dessous. Aucun changement de règle ni de calcul serveur. |
| 17/11/2026 | jeu | v15.25 · Course aux trophées : phrase d'explication sous la piste (comment on avance ; les ⭐ = repères de palier pour l'instant). |
| 17/11/2026 | bug | v15.26 · Écran blanc au retour toujours présent sur Firefox Android (non reproductible ici) : ajout d'un journal de diagnostic (Réglages › tout en bas › « Diagnostic du bouton retour » : chargements, retours, pages montrées/cachées, erreurs ; 20 derniers évènements, sur l'appareil seulement) pour voir ce que fait le navigateur. |
| 17/11/2026 | bug | v15.27 · Bouton retour réécrit sur le modèle de l'appli Budget (qui marche sur Firefox, Chrome, iPhone) : une seule étape « garde », posée seulement après un vrai geste (navigator.userActivation) ; retour = fenêtre ouverte → Moi › Aujourd'hui → onglet d'accueil → petit message, jamais de sortie ni de fermeture forcée ; redessin de la page au retour de veille (pageshow persisted / page vide), cause probable de l'écran blanc. Journal de diagnostic gardé (Réglages, tout en bas). |
| 17/11/2026 | jeu | **v16.0 · La route des 4 mondes** (Podium › Trophées) : piste Mario Party retirée. 4 mondes originaux (Royaume enchanté, Ville néon, Terres sombres, Dieux et l'Épice), un par niveau de difficulté, repliables, avec leur décor. Sur la route de chaque monde : 6 **cartes de collection** uniques (les exclusifs, chacune illustrée, avec texte d'ambiance et fragment d'histoire lisible par son seul détenteur, reflet holographique, carte qui se retourne à l'ouverture et à l'annonce) et 7 **badges** pour tous (les 4 défis du niveau + 3 nouveaux trophées par monde, sans points). **Vitrine** de chaque pilote sur sa fiche (cartes + badges par monde). Règles, points et calcul serveur inchangés. |
| 17/11/2026 | jeu | **v16.1 · 12 circuits à thème** + Versus V30 (version Google 45) : les villes deviennent des circuits originaux, 3 par monde (Forêt aux lucioles, Château aux sortilèges, Pays derrière l'armoire · Bas-fonds sous la pluie, Mégapole des androïdes, Arène virtuelle · Village du solstice, Monde à l'envers, Ville des survivants · Mer de dunes, Mur des titans, Sommet des dieux) + le Plateau maudit (ex-Monaco) et le Garage des rêves (chauffe). Pièges renommés (Feux follets, Couloirs mouvants, Tempête de neige, Double vie, Surchauffe, Brume, Tempête de sable, Assaut), mois spéciaux renommés (Sacre du solstice, Instinct de survie). Chaque circuit : ambiance 3D (heure, décor, neige/néon/désert, monuments réels retirés) et calque animé (lucioles, étincelles, neige, pluie néon, pixels, pétales, brume rouge, spores, sable, cendres, éclairs, dés). Mail du 20/11 mis à jour. Points identiques (vérifié sur 40 saisons simulées). |
| 17/11/2026 | jeu | **v16.2 · Tracés et décors 3D sur mesure** : plus aucune copie de vrai circuit (sauf le huit des Bas-fonds). Chaque circuit a sa propre forme, qui se lit sur la carte et dans le calendrier : piston (Garage), remparts crénelés (Château), lac gelé (Armoire), ligne d'immeubles (Mégapole), flèche d'arcade (Arène), fleur à 5 pétales (Solstice), champignon (Survivants), ver ondulant (Dunes), plateau carré (Plateau maudit), boucles en relief (Monde à l'envers, Sommet des dieux : jusqu'à 40 m de dénivelé). Nouveaux décors 3D : château avec orbe magique, armoire ouverte dans la neige, cheminées d'usine sous la pluie, tour holographique, dôme néon, mât fleuri et feu de joie, faille rouge et arbres morts, champignons géants sur ruines, ver des sables, mur géant, temple sur son rocher, dés et pions géants sur un sol en damier, garage à clé géante ; lucioles, spores, cendres et sable qui volent dans l'air. Vérifié : aucun tracé ne se recoupe, 60 images/s en 3D, répétition générale sans erreur, calcul des points inchangé. |
| 18/11/2026 | retours | v16.3 · Dépassements réécrits : chaque voiture a son couloir (ordre de départ), se rapproche de la trajectoire idéale quand elle est seule et s'écarte en douceur près d'un rival ; plus de téléportation de 11 m ni de changement de voie brutal quand quelqu'un double (vérifié : 1,2 m max par image, 3,5 m d'écart latéral côte à côte). Podium du verdict : les marches montent par découpe et plus par étirement (Firefox laissait des traces et masquait le % du 3e). Diagnostic du bouton retour retiré (bouton validé par Théo). |
| 18/11/2026 | jeu | **v16.4 · Badges épinglés** + Versus V31 (version Google 46) : sur la ligne du Classement, 🟡 (en tête du championnat, automatique) puis **3 badges au plus**, choisis dans Podium › Écurie › Badges (touche pour épingler / retirer ; sans choix, l'appli prend les 3 plus prestigieux), les autres résumés en « +N » (le toucher les liste). La plaque quitte la ligne (elle coupait les points) : elle s'affiche sous le nom au podium du verdict et en tête de la vitrine de la fiche. Testé : 4e badge refusé, choix envoyé au serveur et repris au Classement, tout tient sur la ligne en 400 px, 0 erreur, répétition générale OK. |
| 18/11/2026 | jeu | **v16.5 · Filtre de course** : le cosmétique « Ambiance » devient « Filtre de course » et ne remplace plus le thème du circuit. Le thème (ciel, décor, particules : neige du Pays derrière l'armoire, sable des Dunes, nuit du Château…) s'applique toujours ; le filtre ajoute seulement une touche : Nocturne assombrit, Golden hour réchauffe, Hiver refroidit (+ quelques flocons s'il n'y a pas déjà des particules), Synthwave teinte en rose néon. Vérifié en images sur 3 circuits × 5 filtres ; 0 erreur, répétition générale OK. |
| 18/11/2026 | jeu | **v16.6 · Janvier refait : Forêt aux lucioles** (1er circuit de la refonte « un par un », maquette validée par Théo). 2D : vraie carte peinte (chemin de terre bordé de pierres et de lanternes, arbre géant creux où passe la piste, hibou, rivière sous un pont de bois éclairé, bassin et cascade, vieux moulin dont les ailes tournent, 7 maisons-champignons, prairie fleurie, lucioles et feux follets animés) à la place du trait bleu. 3D : les mêmes éléments aux mêmes endroits (tunnel dans le tronc, pont, cascade, moulin animé, maisons, lanternes), piste en chemin de terre (plus d'asphalte ni de vibreurs). 4 clins d'œil cachés : partie de jeu de plateau sur une souche avec 4 pions aux couleurs des joueurs, coffre du Versus, initiales T·K·C·D gravées dans l'arbre, petite porte lumineuse. 0 erreur, 60 i/s en 3D, répétition générale OK. |
