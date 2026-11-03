/* Ecran du quiz : un mot a la fois, 2 essais, but / arret du gardien. */
(function () {
  'use strict';

  var DELAI_MIN_MS = 900;        /* temps minimal pour lire « BUT ! » */
  var DELAI_SECOURS_MS = 10000;  /* si un son ne finit jamais (fichier bloque), on avance quand meme */
  var s = null; /* etat du match en cours */

  var STADE = '' +
    '<div class="stade-ligne"></div>' +
    '<div class="stade-but">' +
      '<div class="gardien">' +
        '<div class="g-tete"></div><div class="g-bras g-bras-g"></div><div class="g-bras g-bras-d"></div>' +
        '<div class="g-corps"></div><div class="g-short"></div><div class="g-jambe g-jambe-g"></div><div class="g-jambe g-jambe-d"></div>' +
      '</div>' +
      '<svg class="ballon" width="38" height="38" viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="#fff" stroke="#0A1C3F" stroke-width="2"/><polygon points="20,12 27.6,17.5 24.7,26.5 15.3,26.5 12.4,17.5" fill="#0A1C3F"/><path d="M20 12V3M27.6 17.5l8-3M24.7 26.5l5 7M15.3 26.5l-5 7M12.4 17.5l-8-3" stroke="#0A1C3F" stroke-width="2" fill="none"/></svg>' +
    '</div>' +
    '<span class="confetti c1"></span><span class="confetti c2"></span><span class="confetti c3"></span>' +
    '<span class="confetti c4"></span><span class="confetti c5"></span><span class="confetti c6"></span>';

  var ICONES = {
    hautParleur: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
    bulle: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg>',
    ballon: '<svg width="22" height="22" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#fff"/><polygon points="20,12 27.6,17.5 24.7,26.5 15.3,26.5 12.4,17.5" fill="#A50044"/></svg>',
    crochet: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5 9.5 18 20 6"/></svg>',
    main: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 11V6a1.5 1.5 0 0 1 3 0v4M10 10V4.5a1.5 1.5 0 0 1 3 0V10M13 10V5.5a1.5 1.5 0 0 1 3 0V11M16 11V8a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L4 14a1.5 1.5 0 0 1 2.5-1.6L7 13"/></svg>'
  };

  /* ---------- Chemins audio ---------- */
  function cheminMot(item) { return 'listes/' + item.liste.dossier + '/' + item.mot.fichier; }
  function cheminPhrase(item) { return item.mot.phrase ? 'listes/' + item.liste.dossier + '/phrases/' + item.mot.phrase.fichier : null; }
  function cheminConsigne(nom) {
    if (!Stockage.obtenir().reglages.voix) return null;
    var fichier = (window.DONNEES_QUIZ.consignes || {})[nom];
    return fichier ? 'consignes/' + fichier : null;
  }
  function consigneBut() {
    var choix = ['but_1', 'but_2', 'but_3'].filter(function (n) { return (window.DONNEES_QUIZ.consignes || {})[n]; });
    return choix.length ? cheminConsigne(choix[Math.floor(Math.random() * choix.length)]) : null;
  }

  function courant() { return s.items[s.index]; }

  /* Le mot, puis « comme dans la phrase » et la phrase : seulement pour les phrases
     « pour distinguer » (auto) et seulement au 1er essai. */
  function sequencePhrase(item) {
    if (!item.mot.phrase || item.mot.phrase.auto === false || s.essais > 0) return [];
    return [cheminConsigne('comme_dans'), cheminPhrase(item)];
  }
  function jouerMot(avant) { var item = courant(); Son.jouer([avant || null, cheminMot(item)].concat(sequencePhrase(item))); }

  /* ---------- Demarrage / sortie ---------- */
  function demarrer(options) {
    annulerMinuterie();
    s = {
      mode: options.mode,             /* 'bloc' ou 'entrainement' */
      idBloc: options.idBloc || null,
      titre: options.titre,
      items: Regles.melanger(options.items),
      options: options,
      index: 0, essais: 0,
      first_try: 0, after_retry: 0,
      arrets: [], retours: [],
      phase: 'attente', derniereReponse: '', dernierResultat: null,
      erreurAudio: '', minuterie: null,
      debut: Regles.horodatageLocal(), dureeMs: 0, motsFaits: 0, serie: 0, serieMax: 0,
      chronoAccum: 0, chronoDebut: null, chronoActif: false
    };
    App.ecranActif = 'quiz';
    rendre();
    chronoDemarrer();
    jouerMot(cheminConsigne(s.mode === 'entrainement' ? 'debut_entrainement' : 'debut_match'));
  }

  function demarrerBloc(idBloc) {
    var liste = window.DONNEES_QUIZ.listes[idBloc];
    if (!liste) { App.annoncer('Ce bloc n’est pas disponible.'); return; }
    demarrer({
      mode: 'bloc', idBloc: idBloc, titre: 'Bloc ' + idBloc,
      items: liste.mots.map(function (mot) { return { liste: liste, mot: mot }; })
    });
  }

  function annulerMinuterie() {
    if (s && s.minuterie) { clearTimeout(s.minuterie); s.minuterie = null; }
    if (s && s.secours) { clearTimeout(s.secours); s.secours = null; }
  }

  /* Passe au mot suivant seulement quand le son en cours est fini (et au moins minMs plus tard). */
  function avancerApresSon(minMs) {
    var etape = (s.etape = (s.etape || 0) + 1);
    var fait = false;
    function aller() {
      if (fait || !s || s.etape !== etape) return;
      fait = true;
      motSuivant();
    }
    s.minuterie = setTimeout(function () {
      s.secours = setTimeout(aller, DELAI_SECOURS_MS);
      Son.apresFin(aller);
    }, minMs);
  }

  /* ---------- Chronometre (temps actif) ---------- */
  function chronoDemarrer() {
    s.chronoAccum = 0;
    s.chronoActif = true;
    s.chronoDebut = document.hidden ? null : Date.now();
  }

  function chronoArreter() {
    if (!s.chronoActif) return 0;
    var total = s.chronoAccum + (s.chronoDebut !== null ? Date.now() - s.chronoDebut : 0);
    s.chronoActif = false;
    s.chronoDebut = null;
    return Regles.tempsPlafonne(total);
  }

  /* Onglet cache ou fenetre reduite : le chronometre se met en pause. */
  document.addEventListener('visibilitychange', function () {
    if (!s || !s.chronoActif) return;
    if (document.hidden && s.chronoDebut !== null) { s.chronoAccum += Date.now() - s.chronoDebut; s.chronoDebut = null; }
    else if (!document.hidden && s.chronoDebut === null) { s.chronoDebut = Date.now(); }
  });

  /* Un mot est termine : statistiques du mot, du jour et du match en cours. */
  function noterResultat(item, resultat) {
    var ms = chronoArreter();
    s.dureeMs += ms;
    s.motsFaits += 1;
    if (resultat === 'but') { s.serie += 1; s.serieMax = Math.max(s.serieMax, s.serie); } else { s.serie = 0; }
    Stockage.noterMot(item.liste.id, item.mot.mot, resultat, ms, Regles.jourLocal());
  }

  function noterMatch(abandonne) {
    if (!s || s.motsFaits === 0) return;
    Stockage.noterMatch({
      mode: s.mode, bloc: s.mode === 'bloc' ? s.idBloc : null, date: s.debut,
      duree: Math.round(s.dureeMs / 1000), total: s.motsFaits,
      first_try: s.first_try, after_retry: s.after_retry, arrets: s.arrets.length,
      serie: s.serieMax, abandonne: abandonne
    });
  }

  function quitter() {
    noterMatch(true);
    annulerMinuterie();
    Son.arreter();
    s = null;
    Menu.afficher();
  }

  /* ---------- Reponses ---------- */
  function majCote(item, resultat) {
    var info = Stockage.infoMot(item.liste.id, item.mot.mot);
    Stockage.definirInfoMot(item.liste.id, item.mot.mot, Regles.nouvelleCote(info, resultat, Regles.jourLocal()));
  }

  function soumettre(valeur) {
    if (!s || (s.phase !== 'attente' && s.phase !== 'arret1')) return;
    if (!valeur.trim()) { jouerMot(); return; } /* champ vide : on reecoute, ce n'est pas un essai */
    var item = courant();
    s.erreurAudio = '';
    if (Regles.estAcceptee(valeur, item.mot.mot, item.mot.variantes)) {
      if (s.essais === 0) { s.first_try += 1; s.dernierResultat = 'but'; }
      else { s.after_retry += 1; s.retours.push(item); s.dernierResultat = 'retour'; }
      majCote(item, s.dernierResultat);
      noterResultat(item, s.dernierResultat);
      s.phase = 'but';
      rendre();
      Son.jouer([s.dernierResultat === 'but' ? consigneBut() : cheminConsigne('but_retour')]);
      avancerApresSon(DELAI_MIN_MS);
      return;
    }
    s.essais += 1;
    if (s.essais === 1) {
      s.phase = 'arret1';
      rendre();
      jouerMot(cheminConsigne('arret_1'));
    } else {
      s.phase = 'arret2';
      s.derniereReponse = valeur.trim();
      s.arrets.push(item);
      majCote(item, 'arret');
      noterResultat(item, 'arret');
      rendre();
      jouerMot(cheminConsigne('arret_2'));
    }
  }

  function motSuivant() {
    if (!s) return;
    annulerMinuterie();
    s.index += 1;
    if (s.index >= s.items.length) {
      noterMatch(false);
      var bilan = {
        mode: s.mode, idBloc: s.idBloc, titre: s.titre, options: s.options,
        total: s.items.length, first_try: s.first_try, after_retry: s.after_retry,
        arrets: s.arrets, retours: s.retours
      };
      s = null;
      Resultat.afficher(bilan);
      return;
    }
    s.essais = 0;
    s.continuerDemande = false;
    s.phase = 'attente';
    s.derniereReponse = '';
    s.erreurAudio = '';
    rendre();
    chronoDemarrer();
    jouerMot();
  }

  /* ---------- Affichage ---------- */
  function texteRecord() {
    if (s.mode !== 'bloc') return 'Tes mots difficiles';
    var r = Stockage.record(s.idBloc);
    if (!r) return 'Record : pas encore joué';
    return 'Record : ' + r.first_try + (r.first_try <= 1 ? ' but' : ' buts') + ' sur ' + r.total;
  }

  function compteur(valeur, libelle, classe, actif) {
    var el = App.el;
    return el('div', { classe: 'compteur ' + classe + (actif ? ' actif' : '') }, [
      el('span', { classe: 'compteur-valeur', texte: String(valeur) }),
      el('span', { classe: 'compteur-libelle', texte: libelle })
    ]);
  }

  function motSurligne(item, classe) {
    var el = App.el;
    return el('span', { classe: classe }, item.mot.segments.map(function (seg) {
      return seg[1] ? el('mark', { texte: seg[0] }) : document.createTextNode(seg[0]);
    }));
  }

  function zoneRetroaction(item) {
    var el = App.el;
    if (s.erreurAudio) {
      return el('div', { classe: 'retro retro-erreur-audio', role: 'alert', texte: s.erreurAudio });
    }
    if (s.phase === 'but') {
      return el('div', { classe: 'retro retro-but', role: 'status' }, [
        el('span', { classe: 'retro-titre', icone: ICONES.crochet }, [s.dernierResultat === 'but' ? 'BUT !' : 'BUT SUR RETOUR !']),
        el('span', { classe: 'retro-texte', texte: '« ' + item.mot.mot + ' » ' + (s.dernierResultat === 'but' ? '— bien écrit du premier coup' : '— bien joué !') })
      ]);
    }
    if (s.phase === 'arret1') {
      return el('div', { classe: 'retro retro-arret', role: 'status' }, [
        el('span', { classe: 'retro-titre', icone: ICONES.main }, ['Arrêt du gardien !']),
        el('span', { classe: 'retro-texte', texte: 'Essaie encore. Le mot rejoue.' })
      ]);
    }
    return el('div', { classe: 'retro', 'aria-live': 'polite' });
  }

  function carteCorrection(item) {
    var el = App.el;
    return el('div', { classe: 'correction', role: 'status' }, [
      el('p', { classe: 'correction-titre', icone: ICONES.main }, ['Arrêté ! Le bon mot, c’était :']),
      el('div', { classe: 'correction-comparaison' }, [
        el('div', { classe: 'correction-case' }, [
          el('span', { classe: 'correction-etiquette', texte: 'Tu as écrit' }),
          el('span', { classe: 'correction-faux', texte: s.derniereReponse })
        ]),
        el('div', { classe: 'correction-case correction-bonne' }, [
          el('span', { classe: 'correction-etiquette', texte: 'Le bon mot' }),
          motSurligne(item, 'correction-mot')
        ])
      ]),
      el('p', { classe: 'correction-note', texte: (item.mot.phrase && item.mot.phrase.texte ? '« ' + item.mot.phrase.texte + ' » · ' : '') + (s.mode === 'bloc' ? 'Ce mot est ajouté à ton entrainement.' : 'Il reste dans ton entrainement.') })
    ]);
  }

  function rendre() {
    var el = App.el;
    var item = courant();
    var total = s.items.length;
    var numero = s.index + 1;
    var pourcentage = (numero / total * 100).toFixed(1) + '%';
    var saisieActive = s.phase === 'attente' || s.phase === 'arret1';

    var entete = el('header', { classe: 'quiz-entete' }, [
      el('div', { classe: 'quiz-entete-contenu' }, [
        el('div', { classe: 'quiz-entete-ligne' }, [
          el('div', { classe: 'quiz-bloc' }, [
            el('p', { classe: 'quiz-bloc-nom', texte: s.titre }),
            el('p', { classe: 'quiz-bloc-record', texte: texteRecord() })
          ]),
          el('div', { classe: 'tableau', role: 'group', 'aria-label': 'Pointage' }, [
            compteur(s.first_try, 'BUTS', 'c-buts', s.phase === 'but' && s.dernierResultat === 'but'),
            compteur(s.after_retry, 'RETOURS', 'c-retours', s.phase === 'but' && s.dernierResultat === 'retour'),
            compteur(s.arrets.length, 'ARRÊTS', 'c-arrets', s.phase === 'arret2')
          ]),
          el('p', { classe: 'quiz-numero', texte: 'Mot ' + numero + ' / ' + total })
        ]),
        el('div', { classe: 'progression', role: 'progressbar', 'aria-label': 'Progression', 'aria-valuemin': '1', 'aria-valuemax': String(total), 'aria-valuenow': String(numero) }, [
          el('div', { classe: 'progression-barre', style: 'width:' + pourcentage }),
          el('span', { classe: 'progression-ballon', style: 'left:' + pourcentage, 'aria-hidden': 'true', icone: ICONES.ballon })
        ])
      ])
    ]);

    var stade = el('div', { classe: 'stade etat-' + (s.phase === 'but' ? 'but' : (s.phase === 'attente' ? 'attente' : 'arret')), 'aria-hidden': 'true', icone: STADE });

    var champ = el('input', {
      id: 'reponse', type: 'text', classe: 'champ-reponse' + (s.phase === 'arret1' ? ' champ-essai2' : ''),
      autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
      disabled: !saisieActive
    });

    var formulaire = el('form', {
      classe: 'quiz-formulaire',
      onsubmit: function (e) { e.preventDefault(); var v = champ.value; champ.value = ''; soumettre(v); }
    }, [
      el('label', { for: 'reponse', classe: 'quiz-consigne', icone: ICONES.hautParleur }, ['Écoute le mot, puis écris-le.']),
      champ,
      el('p', { classe: 'quiz-essai' + (s.phase === 'arret1' ? ' essai2' : ''), texte: s.phase === 'but' ? 'Mot suivant dans un instant…' : (s.phase === 'arret1' ? 'Essai 2 sur 2' : 'Essai 1 sur 2') }),
      zoneRetroaction(item),
      el('div', { classe: 'quiz-boutons' }, [
        el('button', { type: 'submit', classe: 'btn btn-grenat btn-tirer', disabled: !saisieActive, icone: ICONES.ballon }, ['Tirer !']),
        el('button', { type: 'button', classe: 'btn btn-contour', icone: ICONES.hautParleur, onclick: function () { jouerMot(); champ.focus(); } }, ['Réécouter']),
        item.mot.phrase ? el('button', {
          type: 'button', classe: 'btn ' + (s.phase === 'arret1' ? 'btn-aide' : 'btn-contour'), icone: ICONES.bulle,
          onclick: function () { Son.jouer([cheminPhrase(courant())]); champ.focus(); }
        }, ['Entendre dans une phrase']) : null,
        el('button', { type: 'button', classe: 'btn btn-neutre', onclick: quitter }, ['Menu'])
      ])
    ]);

    var corps;
    if (s.phase === 'arret2') {
      var continuer = el('button', { type: 'button', classe: 'btn btn-grenat btn-tirer', icone: '', onclick: function () {
        if (s.continuerDemande) return;
        s.continuerDemande = true;
        continuer.disabled = true;
        continuer.textContent = 'Un instant…';
        avancerApresSon(0);
      } }, ['Continuer']);
      corps = el('div', { classe: 'quiz-corps' }, [
        stade,
        carteCorrection(item),
        el('div', { classe: 'quiz-boutons' }, [
          continuer,
          el('button', { type: 'button', classe: 'btn btn-contour', icone: ICONES.hautParleur, onclick: function () { jouerMot(); } }, ['Réécouter']),
          el('button', { type: 'button', classe: 'btn btn-neutre', onclick: quitter }, ['Menu'])
        ]),
        el('p', { classe: 'quiz-aide' }, [el('kbd', { texte: 'Entrée' }), ' continuer · ', el('kbd', { texte: 'Échap' }), ' menu'])
      ]);
      App.afficher(el('div', { classe: 'quiz' }, [entete, corps]));
      continuer.focus();
      return;
    }

    corps = el('div', { classe: 'quiz-corps' }, [
      stade,
      formulaire,
      el('p', { classe: 'quiz-aide' }, [
        el('kbd', { texte: 'Entrée' }), ' tirer · ', el('kbd', { texte: 'Entrée' }), ' sur un champ vide : réécouter · ', el('kbd', { texte: 'Échap' }), ' menu'
      ])
    ]);
    App.afficher(el('div', { classe: 'quiz' }, [entete, corps]));
    if (saisieActive) champ.focus();
  }

  /* Echap = retour au menu, sans sauvegarder de record. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && s) { e.preventDefault(); quitter(); }
  });

  /* Erreur audio : message rouge dans le quiz, l'app continue. */
  Son.surErreur(function (chemin) {
    var message = 'Impossible de lire le son : ' + chemin.split('/').pop();
    if (s) { s.erreurAudio = message; if (s.phase !== 'arret2') rendre(); }
    else App.annoncer(message);
  });

  window.Quiz = { demarrer: demarrer, demarrerBloc: demarrerBloc, enCours: function () { return !!s; } };
})();
