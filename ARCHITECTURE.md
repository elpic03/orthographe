# Quiz d'orthographe — Architecture (guide pour un développeur ou un LLM)

Ce document décrit l'app web telle qu'elle est construite. **Il fait autorité** pour l'app web.
`REBUILD_SPEC.md` décrit l'ancienne app Python (dossier `src/`) : il sert d'historique, et la
section « Écarts volontaires » ci-dessous liste ce qui a changé depuis.

Lire en entier avant de modifier quoi que ce soit. Respecter la section « Règles à ne pas briser ».

---

## 1. Contexte et contraintes

- **Public** : un garçon de 10 ans (5e–6e année, Québec). Thème : match de soccer, couleurs
  inspirées du FC Barcelona (couleurs seulement : aucun logo, nom ou écusson du club).
- **Langue** : interface en français, **tutoiement**, ton encourageant.
  **Orthographe rectifiée** dans l'interface (« entrainement », sans circonflexe), car l'école l'enseigne.
- **Exécution locale** : l'utilisateur double-clique sur `Quiz.html`. La page est ouverte en
  `file://` dans Chrome ou Firefox (Windows). Pas de serveur, pas d'internet requis.
- Conséquences techniques de `file://` (ne pas les contourner) :
  - **Pas de modules ES** (`type="module"` est bloqué en `file://`) → scripts classiques et
    objets globaux sur `window`.
  - **Pas de `fetch` de fichiers locaux** ni de lecture d'un dossier → l'inventaire des listes est
    produit d'avance par un script Python dans `app/donnees.js`.
  - Les `<audio>` en chemin relatif fonctionnent. `localStorage` fonctionne (Chrome et Firefox vérifiés).
- **Aucune dépendance** : HTML, CSS, JavaScript sans framework, sans npm, sans compilation.
  Les seules ressources externes possibles sont les polices locales optionnelles.
- **Standard de qualité** : rigueur, faible tolérance au risque. Toute donnée lue (mémoire du
  navigateur, fichier importé, fichiers texte de l'utilisatrice) est validée, et une donnée invalide
  est ignorée sans faire planter l'app.

---

## 2. Arborescence

```
Orthographe/
  Quiz.html              point d'entrée : charge le CSS, donnees.js puis les scripts dans l'ordre
  mettre-a-jour.cmd      lance app/outils/generer_donnees.py (Windows, py -3 ou python)
  audio-a-generer.csv    GÉNÉRÉ : liste de tous les audios (mots, phrases, consignes) et leur statut
  LISEZ-MOI.txt          mode d'emploi pour l'utilisatrice (non technique)
  ARCHITECTURE.md        ce document
  REBUILD_SPEC.md        spécification de l'ancienne app Python (historique)
  listes/<id>/           un dossier par bloc (id = « 6b », « 7 », « 14-15 »…)
    <mot>.mp3|.wav         un audio par mot ; le nom du fichier (sans extension) EST le mot attendu
    bloc.txt               thème + pièges surlignés + variantes acceptées
    phrases/phrases.txt    phrases de contexte (texte) ; phrases/<mot>.mp3 = audio de la phrase
  consignes/             consignes audio communes (<nom>.mp3) + consignes.txt (textes à générer)
  modele-liste/          gabarit à copier pour une nouvelle liste (+ son LISEZ-MOI.txt)
  app/
    donnees.js           GÉNÉRÉ par generer_donnees.py : ne jamais modifier à la main
    style.css            tous les styles (variables de couleur dans :root)
    polices/             optionnel : fichiers .ttf (voir LISEZ-MOI.txt, section 7)
    outils/generer_donnees.py
    js/                  voir section 4
    tests/               tests.html (navigateur), cas.js (cas de test), regles.test.js (Node)
  src/                   ancienne app Python, non utilisée
```

---

## 3. Flux de données

```
listes/ + consignes/  --(mettre-a-jour.cmd → generer_donnees.py)-->  app/donnees.js
app/donnees.js        --(<script>)-->  window.DONNEES_QUIZ  (lecture seule pour l'app)
progression           <-->  localStorage « quizOrthographe.v1 »  (stockage.js)
progression           <-->  fichier .json exporté/importé  (sauvegarde.js)
```

### 3.1 `generer_donnees.py`

- Parcourt `listes/` (sous-dossiers ne commençant pas par `.` ou `_`). Un dossier sans audio est ignoré.
- Mot = nom du fichier sans extension, normalisé **NFC** (le nom de fichier réel est conservé
  dans `fichier`, pour les URL). Tri des mots : `str.casefold`.
- Ordre des blocs : les 38 ids attendus (liste `IDS_ATTENDUS`), puis les dossiers en plus,
  en tri naturel (`7` avant `12`).
- Lit `bloc.txt` et `phrases/phrases.txt` ; liste les audios de `phrases/` et de `consignes/`.
- Écrit `app/donnees.js` de façon atomique (fichier `.tmp` puis remplacement).
- Écrit `audio-a-generer.csv` (UTF-8 avec marque d'encodage, séparateur `;`, CRLF, pour Excel) :
  colonnes `type;bloc;fichier_a_creer;texte_a_lire;statut` ; `type` = mot | phrase | consigne ;
  `statut` = existe | manquant. Sources : audios présents, mots de `bloc.txt` sans audio,
  `phrases.txt`, `consignes/consignes.txt`. Un dossier de bloc qui a un `bloc.txt` mais aucun audio
  (liste en préparation) apparaît dans le CSV mais pas dans l'app. Si le CSV est verrouillé
  (ouvert dans Excel), un avertissement est affiché et `donnees.js` est quand même produit.
- Affiche « A VERIFIER » : chaque anomalie est signalée, la ligne fautive est ignorée, le script
  ne plante pas.

### 3.2 Schéma de `window.DONNEES_QUIZ`

```js
{
  version: 1,
  genereLe: "2026-10-31T15:14:36",
  ordre: ["1", "2", …, "36", "37"],          // ordre d'affichage du menu
  listes: {
    "13": {
      id: "13", dossier: "13",
      titreCourt: "Le son « é » à la fin",       // carte du menu
      titre: "Le son « é » à la fin des mots",   // écran Étude
      description: "…",
      mots: [{
        mot: "mangé",                            // réponse attendue (NFC)
        fichier: "mangé.mp3",                    // nom réel du fichier
        segments: [["mang", 0], ["é", 1]],       // 1 = partie piège à surligner
        variantes: [],                           // autres graphies acceptées
        phrase: { fichier: "mangé.mp3", texte: "Hier, j'ai mangé une pomme.", auto: true } // ou null
      }]
    }
  },
  consignes: { "but_1": "but_1.mp3", … },        // seulement les fichiers présents
  avertissements: ["…"]
}
```

### 3.3 Formats des fichiers texte (UTF-8, fins de ligne CRLF, `#` = commentaire)

`listes/<id>/bloc.txt`
```
Titre court : Le son « é » à la fin
Titre : Le son « é » à la fin des mots
Description : Ce son peut s'écrire -er, -é ou -ier. …

Pièges :
mang[é]
tr[ai]n[er]          ← plusieurs crochets permis
un cah[ier]

Variantes :
trainer = traîner ; autre variante
```
- Les mots de « Pièges » et « Variantes » doivent correspondre exactement à un fichier audio.
- Un mot absent de « Pièges » s'affiche sans surlignage.

`listes/<id>/phrases/phrases.txt` : une ligne `mot | phrase` = phrase « pour distinguer » (lue
automatiquement après le mot, au 1er essai seulement) ; une ligne `* mot | phrase` = phrase « pour
comprendre le sens » (`phrase.auto = false` dans `donnees.js` : jamais lue automatiquement, seulement
avec les boutons Phrase du quiz et de l'Étude). Le bouton « Phrase » apparaît
seulement si l'audio `phrases/<mot>.mp3` existe.

`consignes/consignes.txt` : une ligne `fichier.mp3 | texte`. Noms reconnus par l'app :
`debut_match`, `debut_entrainement`, `but_1`, `but_2`, `but_3` (choisis au hasard), `but_retour`,
`arret_1`, `arret_2`, `fin_match`, `record`, `match_parfait`, `comme_dans` (« Comme dans la phrase »).
Une consigne absente est ignorée.

**Interdit** : mettre un audio autre qu'un mot directement dans `listes/<id>/` (il deviendrait
un mot du quiz).

---

## 4. Modules JavaScript (`app/js/`)

Chaque fichier est une fonction auto-exécutée qui expose **un** objet global. Ordre de
chargement dans `Quiz.html` (à respecter) :

| # | Fichier | Global | Rôle |
|---|---|---|---|
| 0 | `../donnees.js` | `DONNEES_QUIZ` | Inventaire généré |
| 1 | `regles.js` | `Regles` | Règles pures, sans DOM : vérification des réponses, record, cote, mélange, dates. Aussi exporté pour Node. |
| 2 | `stockage.js` | `Stockage` | Lecture, validation et écriture de la progression (localStorage) |
| 3 | `audio.js` | `Son` | Lecture audio séquentielle (un seul lecteur) |
| 4 | `menu.js` | `Menu` | Écran du menu |
| 5 | `quiz.js` | `Quiz` | Écran du quiz (blocs et entrainement) |
| 6 | `resultat.js` | `Resultat` | Résultat d'un bloc, bilan d'un entrainement |
| 7 | `etude.js` | `Etude`, `Vestiaire` | Étude d'un bloc ; Vestiaire et sélection des mots difficiles |
| 8 | `sauvegarde.js` | `Sauvegarde` | Export et import de la progression (fichier .json) |
| 9 | `statistiques.js` | `Statistiques` | Écran Statistiques (calculs à partir de `stats`, graphiques en CSS) |
| 10 | `app.js` | `App` | Utilitaires d'affichage + démarrage (`DOMContentLoaded`) |

Les modules s'appellent entre eux **au moment de l'exécution** (jamais au chargement), donc
l'ordre ci-dessus suffit même si `menu.js` utilise `Vestiaire` défini plus loin.

### 4.1 API publiques

- `App.el(balise, attributs, enfants)` : crée un élément DOM. Attributs spéciaux :
  `texte` (→ `textContent`), `classe`, `icone` (HTML **constant** inséré au début),
  `onXxx` (écouteur). Les enfants sont des nœuds ou des chaînes (insérées comme texte).
- `App.ICONES`, `App.annoncer(message)` (bulle temporaire, région `aria-live`),
  `App.afficher(noeud)` (remplace le contenu de `#app`), `App.ecranActif`
  (`'menu' | 'quiz' | 'resultat' | 'etude' | 'vestiaire' | 'statistiques'`),
  `App.etoilesHTML(n, taille, nouvelles)` (3 étoiles en SVG constant ; les `nouvelles` dernières
  sont animées).
- `Regles` : `normaliser`, `estAcceptee(reponse, mot, variantes)`, `estMeilleur(nouveau, ancien)`,
  `nouvelleCote(info, resultat, jour)`, `melanger`, `jourLocal`, `horodatageLocal`,
  `tempsPlafonne(ms)`, `MAX_MS_PAR_MOT`, `etoiles(firstTry, total)`, `ballonDor(firstTry, total)`,
  `butsExiges(seuil, total)`, `SEUILS_ETOILES`.
- `Stockage` : `charger`, `enregistrer` (retourne false si l'écriture échoue), `obtenir`,
  `nettoyer(brut)`, `record(id)`, `definirRecord(id, r)`, `infoMot(id, mot)`,
  `definirInfoMot(id, mot, info)`, `remplacer(etat)`, `basculerVoix`, `estPersistant`,
  `nombreMotsDifficiles` (non utilisé par l'interface), `noterMot(idListe, mot, resultat, ms, jour)`,
  `noterMatch(m)`, `stats()`.
- `Son` : `jouer([chemins])` (les valeurs vides sont ignorées ; une nouvelle demande
  **interrompt** la précédente), `arreter()`, `surErreur(fn)`, `apresFin(fn)` (appelle `fn` quand la séquence en cours est
  finie, tout de suite s'il n'y en a pas). Les chemins sont relatifs à
  `Quiz.html` (`listes/13/mangé.mp3`) et encodés segment par segment.
- `Menu.afficher()`, `Quiz.demarrerBloc(id)`, `Quiz.demarrer(options)`, `Quiz.enCours()`,
  `Resultat.afficher(bilan)`, `Etude.afficher(id)`, `Etude.groupes(liste)`,
  `Vestiaire.afficher()`, `Vestiaire.motsDifficiles()`, `Sauvegarde.exporter()`,
  `Sauvegarde.recuperer()`, `Sauvegarde.valider(texte)`, `Statistiques.afficher(garderDefilement)`,
  `Statistiques.calculer()`.

### 4.2 Rendu

Pas de framework : chaque écran est **reconstruit en entier** avec `App.el` à chaque changement
d'état, puis placé avec `App.afficher`. Le focus est replacé après le rendu (champ de réponse ou
bouton *Continuer*). Ne jamais utiliser `innerHTML` avec une donnée (mot, titre, fichier importé…).

---

## 5. Écrans et machine à états

```
Menu ──Jouer──▶ Quiz(bloc) ──fin──▶ Résultat ──Rejouer──▶ Quiz(bloc)
 │  ──Étudier──▶ Étude ──Je suis prêt──▶ Quiz(bloc)
 │  ──Vestiaire──▶ Vestiaire ──Je suis prêt──▶ Quiz(entrainement) ──fin──▶ Bilan
 │  ──Statistiques──▶ Statistiques
 └─ Échap ou « Menu » depuis n'importe quel écran ──▶ Menu (sans enregistrer de record)
```

### 5.1 Quiz (`quiz.js`)

État `s` : `mode` (`'bloc' | 'entrainement'`), `idBloc`, `titre`, `items` (mélangés ;
`{liste, mot}`), `index`, `essais`, `first_try`, `after_retry`, `arrets[]`, `retours[]`,
`phase`, `derniereReponse`, `dernierResultat`, `erreurAudio`, `minuterie`, `options`.

| Phase | Entrée | Sortie |
|---|---|---|
| `attente` | Début du mot : le mot joue (précédé de `debut_match` ou `debut_entrainement` au 1er mot). Si le mot a une phrase « pour distinguer » (`auto`) et qu'on est au 1er essai : mot → `comme_dans` → phrase (`sequencePhrase`), aussi pour Réécouter. Au 2e essai (`arret_1`, Réécouter) et à la correction (`arret_2`) : le mot seul. Voix coupées : mot → phrase. | Réponse vide → réécoute (pas un essai). Bonne → `but`. Fausse → `arret1`. |
| `arret1` | Consigne `arret_1` puis le mot | Bonne → `but` (résultat `retour`). Fausse → `arret2`. |
| `but` | Consigne `but_n` ou `but_retour` ; mot suivant quand le son est fini (`avancerApresSon`) : au moins `DELAI_MIN_MS` (900 ms), au plus `DELAI_SECOURS_MS` (10 s) si un son ne finit jamais | `motSuivant()` |
| `arret2` | Consigne `arret_2` puis le mot ; correction affichée (réponse barrée, bon mot avec pièges surlignés) | Bouton *Continuer* (Entrée) → « Un instant… » jusqu'à la fin du son → `motSuivant()` |

- Cote du mot mise à jour **immédiatement** à chaque résultat (`majCote`), même si l'enfant
  quitte le match ensuite (choix validé).
- Statistiques : chronomètre par mot (`chronoDemarrer` / `chronoArreter`), en pause quand l'onglet
  est caché (`visibilitychange`), plafonné à 60 s par mot (`Regles.tempsPlafonne`). Chaque
  résultat appelle `Stockage.noterMot` ; la fin du match ou un abandon (Échap, Menu) appelle
  `Stockage.noterMatch` (`abandonne: true` pour un abandon).
- Fin des mots → `Resultat.afficher(bilan)`.
- Erreur audio : message rouge dans le quiz, le jeu continue.

### 5.2 Résultat (`resultat.js`)

- **Bloc** : le record est comparé (`Regles.estMeilleur`) et enregistré **ici seulement**.
  Affiche le score, le bandeau record (nouveau ou existant), les **étoiles** du match (section 6.4 ;
  « Nouvelle étoile ! » ou « Prochaine étoile : X buts du premier coup sur Y »), le ballon d'or,
  les mots arrêtés et les mots réussis au 2e essai. Sons : `fin_match`, puis `etoile` si une
  étoile est gagnée, puis `match_parfait` ou `record`. Les étoiles sont **déduites du record** :
  rien de plus n'est stocké.
- **Entrainement** : aucun record. Compare la cote de chaque mot avant (`options.avant`,
  photo prise au Vestiaire) et après : Maîtrisés (0), En progrès (baisse), Déjà comptés
  aujourd'hui (but sans baisse), À retravailler (hausse).

### 5.3 Étude et Vestiaire (`etude.js`)

- Étude d'un bloc : thème, tous les mots avec pièges surlignés, boutons Écouter et Phrase.
  Regroupement par finale (dernier segment surligné) **seulement si** tous les mots ont un
  piège et qu'on obtient 2 à 4 groupes d'au moins 3 mots ; sinon ordre alphabétique.
- Vestiaire : `motsDifficiles()` = mots avec `cote > 0` qui existent encore dans
  `DONNEES_QUIZ`, triés par cote décroissante puis par erreur la plus récente, limités à
  `MAX_DIFFICILES` (10).

---

## 6. Règles métier (`regles.js`)

### 6.1 Vérification d'une réponse

1. Normalisation : NFC, apostrophes courbes → `'`, espaces de début et de fin retirés,
   espaces multiples réduits, minuscules.
2. **Les accents comptent** (`activite` ≠ `activité`).
3. Formes acceptées : le mot complet et chaque **variante** de `bloc.txt` ; pour chacune,
   aussi la forme **sans déterminant initial** (`DETERMINANTS` : un, une, des, le, la, les, du,
   au, aux, de la, de l', l').
4. `ACCEPTER_OE_POUR_LIGATURE = true` : « oe » vaut « œ », « ae » vaut « æ » (choix validé).

### 6.2 Record (identique à la spec Python, section 4.3)

Meilleur ratio `first_try / total` (comparé par produits croisés) ; à égalité, la liste la plus
longue gagne. `after_retry` est stocké mais ne compte pas.

### 6.3 Cote des mots difficiles (« option C », validée)

| Résultat | Effet |
|---|---|
| Arrêt (2 erreurs) | `cote += 3`, `derniereErreur = jour` |
| But sur retour | `cote += 1`, `derniereErreur = jour` |
| But du 1er coup | `cote -= 1` seulement si `cote > 0` et `derniereBaisse ≠ jour` ; puis `derniereBaisse = jour` |

`jour` = date locale `AAAA-MM-JJ`. Les mêmes règles s'appliquent en bloc et en entrainement.

### 6.4 Étoiles et ballon d'or (validés)

| Étoiles | Buts du premier coup exigés (`butsExiges`) |
|---|---|
| 1 | `floor(50 % × total)` |
| 2 | `floor(75 % × total)` |
| 3 | `floor(95 % × total)` |

- Arrondi **à la baisse** (choix validé), minimum 1. Exemple, 23 mots : 11, 17, 21.
- Calculées sur le **record** du bloc (meilleur `first_try`), jamais perdues.
- Ballon d'or : `first_try === total` (100 %), distinct de la 3e étoile.
- Total affiché au menu : somme des étoiles des blocs disponibles / `3 × nombre de blocs`.
- Dépenser les étoiles : reporté (pas implémenté).

### 6.5 Temps compté

Temps **actif** : du moment où le mot est joué jusqu'à la réponse finale, en pause si l'onglet
est caché, plafonné à `MAX_MS_PAR_MOT` (60 s). Les abandons comptent dans le temps et les mots
écrits, pas dans les scores ni les pourcentages.

---

## 7. Persistance

### 7.1 localStorage — clé `quizOrthographe.v1`

```js
{
  version: 1,
  records: { "7": { total: 23, first_try: 18, after_retry: 3, date: "2026-10-30T10:59:53" } },
  mots:    { "13/mangé": { cote: 3, derniereBaisse: null, derniereErreur: "2026-10-31" } },
  reglages: { voix: true },       // false = consignes parlées coupées ; les mots jouent toujours
  stats: {
    matchs: [ { mode: "bloc", bloc: "7", date: "2026-10-31T10:59:53", duree: 312, total: 23,
                first_try: 18, after_retry: 3, arrets: 2, serie: 9, abandonne: false } ],
                                // au plus 2000 (les plus anciens sont retirés) ; bloc = null en entrainement
    jours:  { "2026-10-31": { ms: 312000, mots: 23 } },
    mots:   { "7/hors de": { tirs: 4, buts: 2, retours: 1, arrets: 1, ms: 41000 } },
    maitrises: 3                // mots dont la cote est revenue à 0
  }
}
```
- Clé d'un mot : `idBloc + "/" + mot`.
- `duree` en secondes ; `ms` en millisecondes ; `serie` = plus longue série de buts du premier coup.
- Les étoiles ne sont pas stockées : elles se recalculent à partir de `records`.
- `Stockage.nettoyer` valide tout (entiers ≥ 0, `first_try + after_retry ≤ total`, dates au
  format `AAAA-MM-JJ…`) et ignore le reste. Un JSON illisible donne une progression vide.
- Si `localStorage` est indisponible, l'app fonctionne en mémoire et le menu affiche un
  avertissement (`.alerte-memoire`).

### 7.2 Fichier de sauvegarde

```js
{ app: "quiz-orthographe", version: 2, sauvegardeLe: "…", progression: { …même schéma… } }
```
Version 2 = ajout de `stats`. Import : taille ≤ 1 Mo, marque `app`, `version ≤ 2` (un fichier
version 1 est accepté : `stats` vides), contenu passé par `Stockage.nettoyer`, refus si aucune
progression ni aucun match. Une fenêtre (`<dialog>`) demande confirmation avant de remplacer.
Pour un changement de schéma : incrémenter `VERSION`, et migrer les anciennes versions dans
`valider()` et `Stockage.nettoyer()`. Ne jamais refuser les anciennes sauvegardes.

---

## 8. Interface et style

- Variables dans `:root` de `style.css` : `--marine #0A1C3F`, `--bleu #004D98`,
  `--grenat #A50044` (bouton principal), `--or #EDBB00` (succès / but), `--orange #C2410C`
  (arrêt / erreur), `--fond #EEF3FA`, `--gris-texte #4A5873`.
  Le **grenat ne signifie jamais « erreur »** (c'est une couleur de l'équipe) ; l'erreur est
  orange. Succès (or, clair) et erreur (orange, foncé) diffèrent aussi en luminosité (daltonisme).
- Polices : `--police-titre` (Barlow Condensed → Bahnschrift), `--police-texte`
  (Lexend → Segoe UI).
- Le terrain, le but et le gardien sont dessinés en CSS (`.stade`, `.gardien`). L'état
  visuel vient de la classe `etat-attente | etat-but | etat-arret`.
- Accessibilité : vrais `<button>`, `<label for>`, `aria-live` pour les annonces et la
  rétroaction, `aria-label` sur les boutons à icône, contraste ≥ 4,5:1, cibles ≥ 44 px.
- Champ de réponse : `spellcheck=false`, `autocomplete=off`, `autocorrect=off`,
  `autocapitalize=off` (sinon le navigateur corrige les fautes à la place de l'enfant).
- Mise en page fluide : aucun débordement horizontal à 390 px de large.
- Cartes du menu : titre court sur 2 lignes réservées (`min-height: 2.5em`, cartes de même
  hauteur) et équilibrées (`text-wrap: balance`). `titreCarte()` dans `menu.js` ajoute une espace
  insécable devant `: ; ! ?` et après un mot d'un seul caractère, et garde les mots à trait
  d'union entiers (`.insecable`, `white-space: nowrap` ; U+2011 absent de Lexend). Titres de
  26 caractères au plus vérifiés de 390 à 1920 px.

---

## 9. Tests

- `app/tests/tests.html` : ouvrir dans le navigateur ; affiche « Tout est bon : N tests réussis ».
- `node app/tests/regles.test.js` : mêmes cas (règles seulement) avec Node, si installé.
- Les cas sont dans `app/tests/cas.js` (`CasDeTest(Regles, verifier, {Stockage, Sauvegarde})`).
  **Toute modification d'une règle doit ajouter ou adapter un cas.**
- Pendant le développement, les écrans ont été vérifiés avec Playwright (Chromium) en
  `file://`, avec `--autoplay-policy=no-user-gesture-required`. Le mot joué peut être lu en
  interceptant `HTMLMediaElement.prototype.play`.

---

## 10. Recettes de modification

| Besoin | Où et comment |
|---|---|
| Changer les points de la cote | `Regles.nouvelleCote` + cas dans `cas.js` + section 6.3 de ce document + `LISEZ-MOI.txt` |
| Changer le nombre de mots du Vestiaire | `MAX_DIFFICILES` dans `etude.js` |
| Changer le délai après un but | `DELAI_MIN_MS` et `DELAI_SECOURS_MS` dans `quiz.js` |
| Changer les seuils des étoiles | `SEUILS_ETOILES` dans `regles.js` + cas dans `cas.js` + section 6.4 + `LISEZ-MOI.txt` |
| Ajouter une statistique | Si elle se calcule à partir de `stats` : `Statistiques.calculer` seulement. Sinon : nouveau champ dans `Stockage.noterMot`/`noterMatch`, validé dans `nettoyerStats`, cas dans `cas.js`, section 7.1 |
| Ajouter une consigne audio | Choisir un nom, l'appeler avec `cheminConsigne('nom')` dans `quiz.js` ou `consigne('nom')` dans `resultat.js`, l'ajouter à `consignes/consignes.txt` et à la section 3.3 |
| Ajouter un écran | Nouveau fichier `js/xxx.js` exposant `window.Xxx = { afficher }`, le charger dans `Quiz.html` **avant** `app.js`, fixer `App.ecranActif`, prévoir un retour au menu et Échap |
| Ajouter un champ à `bloc.txt` | `CHAMPS` dans `generer_donnees.py` → nouveau champ dans `donnees.js` → section 3 de ce document → `modele-liste/bloc.txt` |
| Ajouter un bloc attendu au menu | `IDS_ATTENDUS` dans `generer_donnees.py`, puis relancer le script |
| Mettre l'app en ligne | Publier le dossier tel quel sur un hébergement statique. Les audios deviennent publics ; `localStorage` sera propre à l'adresse du site (prévoir l'export depuis la version locale). |

---

## 11. Règles à ne pas briser

1. Ne jamais modifier `app/donnees.js` à la main : modifier les sources, puis relancer le script.
2. Pas de modules ES, pas de `fetch` local, pas de framework, pas de CDN : l'app doit
   fonctionner en `file://`, hors ligne.
3. Aucune donnée (mot, titre, fichier importé, mémoire) dans `innerHTML` : utiliser `App.el`
   (`texte`). Les icônes SVG sont des chaînes constantes.
4. Toute lecture de la mémoire ou d'un fichier passe par `Stockage.nettoyer`.
5. Le record ne s'enregistre qu'en fin de match complet ; Échap ou Menu n'enregistre jamais de record.
6. Les accents restent significatifs. Une nouvelle tolérance d'orthographe passe par une
   **variante explicite** dans `bloc.txt`, jamais par une règle automatique (par exemple, ignorer
   tous les circonflexes ferait accepter « sur » pour « sûr »).
7. Interface en français, au tutoiement, orthographe rectifiée ; pas de nom ni de logo du club.
8. Aucune donnée personnelle sur l'enfant (pas de nom) dans l'app, la mémoire ou les sauvegardes.
9. Après toute modification : `tests.html` doit afficher « Tout est bon », et un match complet
   doit se jouer sans erreur dans la console.

---

## 12. Écarts volontaires par rapport à `REBUILD_SPEC.md` (app Python)

| Spec Python | App web | Raison |
|---|---|---|
| Vouvoiement, textes exacts | Tutoiement, thème soccer | Public de 10 ans (validé) |
| Dernier mot d'un groupe accepté | Seul un déterminant initial peut être omis | La règle acceptait « de » pour « hors de » |
| Avance automatique 1,5 s après 2 erreurs | Correction affichée + bouton *Continuer* | Laisser le temps de comparer |
| Délai 600 ms après un but | 1300 ms | Lire « BUT ! » et le mot |
| Réécouter : mise en file d'attente | Réécouter interrompt le son en cours | Plus naturel |
| Menu sans défilement, 3 colonnes | Grille fluide (6–7 colonnes) ; défile sur un écran bas | Cartes plus riches (thème, Jouer, Étudier) |
| Bouton *Quitter* | Retiré | Une page web ne ferme pas son onglet |
| Scores dans `%LOCALAPPDATA%` | localStorage + export/import | Contraintes du navigateur |
| — | Ajouts : variantes, pièges surlignés, phrases de contexte, consignes audio, Étude, Vestiaire, cote des mots difficiles, sauvegarde, statistiques, étoiles et ballon d'or | Demandes de l'utilisatrice |

## 13. Limites connues

- `listes/_originaux/` contient les fiches d'origine tapées à la main (ignorées par le script : dossier commençant par `_`).

- Le menu défile sur un écran de moins d'environ 1 250 px de haut.
- Progression propre à chaque navigateur et à chaque ordinateur (transfert par export/import).
- Les phrases et les consignes audio n'avaient pas encore été générées lors des derniers tests :
  leur affichage et leur lecture n'ont été vérifiés qu'en l'absence des fichiers.
- `stats.matchs` est limité à 2000 matchs : au-delà, les plus anciens disparaissent du détail
  (les totaux par jour et par mot restent complets).
