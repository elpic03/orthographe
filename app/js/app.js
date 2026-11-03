/* Demarrage de l'app et outils communs a tous les ecrans. */
(function () {
  'use strict';

  /* Cree un element HTML. Le texte passe par textContent : aucun risque d'injection. */
  function el(balise, attributs, enfants) {
    var noeud = document.createElement(balise);
    Object.keys(attributs || {}).forEach(function (nom) {
      var valeur = attributs[nom];
      if (valeur === null || valeur === undefined || valeur === false) return;
      if (nom === 'texte') noeud.textContent = valeur;
      else if (nom === 'classe') noeud.className = valeur;
      else if (nom === 'icone') noeud.insertAdjacentHTML('afterbegin', valeur);
      else if (nom.indexOf('on') === 0) noeud.addEventListener(nom.slice(2), valeur);
      else noeud.setAttribute(nom, valeur === true ? '' : valeur);
    });
    (enfants || []).forEach(function (enfant) {
      if (enfant === null || enfant === undefined) return;
      noeud.appendChild(typeof enfant === 'string' ? document.createTextNode(enfant) : enfant);
    });
    return noeud;
  }

  /* Icones (texte fixe, jamais construit a partir de donnees). */
  var ICONES = {
    maillot: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M8 3 4 6l2 4 2-1v12h8V9l2 1 2-4-4-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/></svg>',
    fleche: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    cadenas: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    telecharger: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
    televerser: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21V9M7 14l5-5 5 5M5 3h14"/></svg>',
    volume: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    muet: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M16 9l5 6M21 9l-5 6"/></svg>'
  };

  var ETOILE = 'points="12 2.5 14.9 8.6 21.5 9.3 16.5 13.8 17.9 20.5 12 17.1 6.1 20.5 7.5 13.8 2.5 9.3 9.1 8.6"';
  ICONES.statistiques = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/></svg>';
  ICONES.ballonOr = '<svg class="ballon-or" width="18" height="18" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#EDBB00" stroke="#8A6A00" stroke-width="2.5"/><polygon points="20,12 27.6,17.5 24.7,26.5 15.3,26.5 12.4,17.5" fill="#0A1C3F"/></svg>';

  /* n etoiles pleines sur 3 (n vient d'un calcul, jamais d'une donnee texte). */
  function etoilesHTML(n, taille, nouvelles) {
    var t = taille || 18, html = '';
    for (var i = 0; i < 3; i++) {
      var pleine = i < n;
      var neuve = nouvelles && i >= n - nouvelles && i < n;
      html += '<svg class="etoile' + (pleine ? ' pleine' : ' vide') + (neuve ? ' neuve' : '') + '" width="' + t + '" height="' + t + '" viewBox="0 0 24 24" aria-hidden="true"><polygon ' + ETOILE + '/></svg>';
    }
    return html;
  }

  var minuterieAnnonce = null;
  function annoncer(message) {
    var zone = document.getElementById('annonce');
    zone.textContent = message;
    zone.classList.add('visible');
    clearTimeout(minuterieAnnonce);
    minuterieAnnonce = setTimeout(function () { zone.classList.remove('visible'); }, 3000);
  }

  function afficher(noeud) {
    var racine = document.getElementById('app');
    racine.replaceChildren(noeud);
    window.scrollTo(0, 0);
  }

  function erreurDonnees() {
    afficher(el('div', { classe: 'message-erreur', role: 'alert' }, [
      el('h1', { texte: 'Les listes ne sont pas encore prêtes' }),
      el('p', {}, [
        'Double-clique sur ',
        el('code', { texte: 'mettre-a-jour.cmd' }),
        ' dans le dossier Orthographe, puis recharge cette page.'
      ])
    ]));
  }

  window.App = { el: el, ICONES: ICONES, etoilesHTML: etoilesHTML, annoncer: annoncer, afficher: afficher };

  document.addEventListener('DOMContentLoaded', function () {
    var donnees = window.DONNEES_QUIZ;
    if (!donnees || !donnees.listes || !Array.isArray(donnees.ordre)) {
      erreurDonnees();
      return;
    }
    Stockage.charger();
    Menu.afficher();
  });
})();
