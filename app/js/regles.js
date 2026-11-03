/* Regles du quiz : verification des reponses, comparaison des records, cote des mots difficiles.
   Aucune dependance a l'ecran : ce fichier est aussi teste automatiquement. */
(function (racine) {
  'use strict';

  /* Determinants qu'on peut omettre dans la reponse : « une activité » -> « activité » accepte. */
  var DETERMINANTS = ['de la', 'de l\'', 'une', 'des', 'les', 'aux', 'un', 'le', 'la', 'du', 'au', 'l\''];

  /* Accepter « oe » pour « œ » et « ae » pour « æ » (difficiles a taper au clavier). */
  var ACCEPTER_OE_POUR_LIGATURE = true;

  function normaliser(texte) {
    return String(texte === undefined || texte === null ? '' : texte)
      .normalize('NFC')
      .replace(/[’‘ʼ`]/g, '\'')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function sansLigatures(texte) {
    return texte.replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  }

  function sansDeterminant(forme) {
    for (var i = 0; i < DETERMINANTS.length; i++) {
      var d = DETERMINANTS[i];
      if (d.charAt(d.length - 1) === '\'') {
        if (forme.indexOf(d) === 0 && forme.length > d.length) return forme.slice(d.length).trim();
      } else if (forme.indexOf(d + ' ') === 0) {
        return forme.slice(d.length + 1);
      }
    }
    return null;
  }

  function formesAcceptees(mot, variantes) {
    var formes = [];
    [mot].concat(variantes || []).forEach(function (candidat) {
      var n = normaliser(candidat);
      if (!n) return;
      formes.push(n);
      var reste = sansDeterminant(n);
      if (reste) formes.push(reste);
    });
    return formes;
  }

  function estAcceptee(reponse, mot, variantes) {
    var r = normaliser(reponse);
    if (!r) return false;
    var formes = formesAcceptees(mot, variantes);
    if (formes.indexOf(r) !== -1) return true;
    if (ACCEPTER_OE_POUR_LIGATURE) {
      var r2 = sansLigatures(r);
      return formes.some(function (f) { return sansLigatures(f) === r2; });
    }
    return false;
  }

  /* Le nouveau resultat remplace le record seulement s'il est meilleur (spec, section 4.3). */
  function estMeilleur(nouveau, ancien) {
    if (!ancien) return true;
    if (!(nouveau.total > 0)) return false;
    if (!(ancien.total > 0)) return true;
    var gauche = nouveau.first_try * ancien.total;
    var droite = ancien.first_try * nouveau.total;
    if (gauche !== droite) return gauche > droite;
    return nouveau.total > ancien.total;
  }

  function jourLocal(date) {
    var d = date || new Date();
    function deux(n) { return (n < 10 ? '0' : '') + n; }
    return d.getFullYear() + '-' + deux(d.getMonth() + 1) + '-' + deux(d.getDate());
  }

  function horodatageLocal(date) {
    var d = date || new Date();
    function deux(n) { return (n < 10 ? '0' : '') + n; }
    return jourLocal(d) + 'T' + deux(d.getHours()) + ':' + deux(d.getMinutes()) + ':' + deux(d.getSeconds());
  }

  /* Cote d'un mot difficile (option C) :
     arret = +3, but sur retour = +1, but du premier coup = -1 au plus une fois par jour. */
  function nouvelleCote(entree, resultat, jour) {
    var e = {
      cote: entree ? entree.cote : 0,
      derniereBaisse: entree ? entree.derniereBaisse : null,
      derniereErreur: entree ? entree.derniereErreur : null
    };
    if (resultat === 'arret') {
      e.cote += 3;
      e.derniereErreur = jour;
    } else if (resultat === 'retour') {
      e.cote += 1;
      e.derniereErreur = jour;
    } else if (resultat === 'but' && e.cote > 0 && e.derniereBaisse !== jour) {
      e.cote -= 1;
      e.derniereBaisse = jour;
    }
    return e;
  }

  function melanger(tableau, aleatoire) {
    var hasard = aleatoire || Math.random;
    var copie = tableau.slice();
    for (var i = copie.length - 1; i > 0; i--) {
      var j = Math.floor(hasard() * (i + 1));
      var t = copie[i]; copie[i] = copie[j]; copie[j] = t;
    }
    return copie;
  }

  /* Temps actif d'un mot : jamais negatif, au maximum 60 s (au-dela, l'enfant fait autre chose). */
  var MAX_MS_PAR_MOT = 60000;
  function tempsPlafonne(ms) {
    if (!(ms > 0)) return 0;
    return Math.min(Math.round(ms), MAX_MS_PAR_MOT);
  }

  /* Etoiles d'un bloc (a partir du meilleur resultat) : 50 %, 75 %, 95 % de buts du premier coup.
     Le nombre de buts exige est arrondi a la baisse (95 % de 23 mots = 21,85 -> 21 buts). */
  var SEUILS_ETOILES = [0.5, 0.75, 0.95];
  function butsExiges(seuil, total) {
    return Math.max(1, Math.floor(seuil * total + 1e-9));
  }
  function etoiles(firstTry, total) {
    if (!(total > 0)) return 0;
    return SEUILS_ETOILES.filter(function (sx) { return firstTry >= butsExiges(sx, total); }).length;
  }
  /* Ballon d'or : bloc reussi sans aucune faute (100 % du premier coup). */
  function ballonDor(firstTry, total) {
    return total > 0 && firstTry === total;
  }

  var Regles = {
    etoiles: etoiles,
    ballonDor: ballonDor,
    butsExiges: butsExiges,
    SEUILS_ETOILES: SEUILS_ETOILES,
    tempsPlafonne: tempsPlafonne,
    MAX_MS_PAR_MOT: MAX_MS_PAR_MOT,
    normaliser: normaliser,
    estAcceptee: estAcceptee,
    estMeilleur: estMeilleur,
    jourLocal: jourLocal,
    horodatageLocal: horodatageLocal,
    nouvelleCote: nouvelleCote,
    melanger: melanger
  };
  racine.Regles = Regles;
  if (typeof module !== 'undefined' && module.exports) module.exports = Regles;
})(typeof window !== 'undefined' ? window : globalThis);
