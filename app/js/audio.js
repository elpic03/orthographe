/* Lecture audio : un son a la fois. Une nouvelle demande remplace ce qui joue
   (consigne puis mot, par exemple). L'ecran n'est jamais bloque. */
(function () {
  'use strict';

  var lecteur = new Audio();
  lecteur.preload = 'auto';
  var file = [];
  var courant = null;
  var jeton = 0;
  var surErreur = function () {};
  var enCours = false;   /* une sequence joue encore */
  var attente = [];      /* fonctions a appeler quand la sequence est finie */

  function url(chemin) {
    return chemin.split('/').map(encodeURIComponent).join('/');
  }

  function signaler(chemin) {
    surErreur(chemin);
  }

  function termine(j) {
    if (j !== jeton) return;
    enCours = false;
    var a = attente;
    attente = [];
    a.forEach(function (fn) { fn(); });
  }

  function suivant(j) {
    if (j !== jeton) return;
    courant = file.shift() || null;
    if (!courant) { termine(j); return; }
    lecteur.src = url(courant);
    var promesse = lecteur.play();
    if (promesse && promesse.catch) {
      var chemin = courant;
      promesse.catch(function (e) {
        if (j === jeton && e && e.name !== 'AbortError') signaler(chemin);
      });
    }
  }

  lecteur.addEventListener('ended', function () { suivant(jeton); });
  lecteur.addEventListener('error', function () {
    if (!courant) return;
    signaler(courant);
    suivant(jeton);
  });

  /* chemins : liste de chemins relatifs (ex. "listes/13/mangé.mp3"). Les valeurs vides sont ignorees. */
  function jouer(chemins) {
    jeton += 1;
    file = chemins.filter(Boolean);
    enCours = file.length > 0;
    lecteur.pause();
    suivant(jeton);
  }

  function arreter() {
    jeton += 1;
    file = [];
    courant = null;
    enCours = false;
    attente = [];
    lecteur.pause();
  }

  window.Son = {
    jouer: jouer,
    arreter: arreter,
    /* Appelle fn quand la sequence en cours est finie (tout de suite si rien ne joue). */
    apresFin: function (fn) { if (enCours) attente.push(fn); else fn(); },
    surErreur: function (fn) { surErreur = fn; }
  };
})();
