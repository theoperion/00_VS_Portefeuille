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
| Versus | `…xVNsHSYT…`, inscrit dans le code | ✅ Les 26 anciennes adresses donnent le même code (marquées « ancienne adresse » dans Apps Script) |
| Moi · Théo | `…wUZGrzfS…` | ✅ Les 5 anciennes adresses donnent le même code |
| Moi · Clément | `…yue_yIcK…` | à rattacher (phase 4) |
| Moi · Devlin | `…z2q12dXu…` | à rattacher (phase 4) |
| Moi · Kévin (profil simple) | `…zucvUCgb…` | ✅ code récupéré (V4), les 2 anciennes adresses servent le même code |

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
- ⬜ 3.3 Quand toutes les fonctionnalités sont sorties (vers février 2027) : supprimer l'aperçu des étapes à venir ; il ne reste en admin que les codes et la saisie de secours.

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
