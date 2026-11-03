/* Ecran de resultat d'un match (bloc). Le record est enregistre ici, seulement en fin de match. */
(function () {
  'use strict';

  var TROPHEE = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 21h8M9 17h6"/></svg>';
  var REJOUER = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';

  function buts(n) { return n + (n <= 1 ? ' but' : ' buts'); }

  function consigne(nom) {
    if (!Stockage.obtenir().reglages.voix) return null;
    var f = (window.DONNEES_QUIZ.consignes || {})[nom];
    return f ? 'consignes/' + f : null;
  }

  function puces(items, classe) {
    var el = App.el;
    return el('div', { classe: 'puces' }, items.map(function (item) {
      return el('span', { classe: 'puce ' + classe, texte: item.mot.mot });
    }));
  }

  function tuile(libelle, valeur, classe) {
    var el = App.el;
    return el('div', { classe: 'tuile' }, [
      el('span', { classe: 'tuile-libelle', texte: libelle }),
      el('span', { classe: 'tuile-valeur ' + classe, texte: String(valeur) })
    ]);
  }

  function afficher(b) {
    if (b.mode === 'entrainement') { afficherEntrainement(b); return; }
    var el = App.el;
    App.ecranActif = 'resultat';
    var parfait = b.first_try === b.total;
    var messageRecord = null;
    var nouveauRecord = false;
    var blocEtoiles = null;
    var nouvellesEtoiles = 0;

    if (b.mode === 'bloc') {
      var nouveau = { total: b.total, first_try: b.first_try, after_retry: b.after_retry, date: Regles.horodatageLocal() };
      var ancien = Stockage.record(b.idBloc);
      /* Etoiles : celles de ce match, comparees a celles deja gagnees dans ce bloc. */
      var etoilesMatch = Regles.etoiles(b.first_try, b.total);
      var etoilesAvant = ancien ? Regles.etoiles(ancien.first_try, ancien.total) : 0;
      nouvellesEtoiles = Math.max(0, etoilesMatch - etoilesAvant);
      var orAvant = ancien ? Regles.ballonDor(ancien.first_try, ancien.total) : false;
      var orNouveau = Regles.ballonDor(b.first_try, b.total) && !orAvant;
      var texteEtoiles;
      if (nouvellesEtoiles > 0) texteEtoiles = nouvellesEtoiles === 1 ? 'Nouvelle étoile !' : nouvellesEtoiles + ' nouvelles étoiles !';
      else if (etoilesMatch === 3) texteEtoiles = '3 étoiles !';
      else texteEtoiles = 'Prochaine étoile : ' + buts(Regles.butsExiges(Regles.SEUILS_ETOILES[etoilesMatch], b.total)) + ' du premier coup sur ' + b.total + '.';
      blocEtoiles = el('section', { classe: 'resultat-etoiles' + (nouvellesEtoiles > 0 ? ' gain' : ''), 'aria-label': etoilesMatch + ' étoiles sur 3 pour ce match' }, [
        el('div', { classe: 'resultat-etoiles-rangee', icone: App.etoilesHTML(etoilesMatch, 52, nouvellesEtoiles) }),
        el('p', { classe: 'resultat-etoiles-texte', texte: texteEtoiles }),
        orNouveau ? el('p', { classe: 'resultat-ballon-or', icone: App.ICONES.ballonOr }, ['Ballon d’or ! Bloc réussi sans aucune faute.']) : null
      ]);
      if (Regles.estMeilleur(nouveau, ancien)) {
        nouveauRecord = true;
        var sauve = Stockage.definirRecord(b.idBloc, nouveau);
        messageRecord = el('div', { classe: 'bandeau-record', icone: TROPHEE }, [
          el('p', { texte: 'Nouveau record au ' + b.titre + ' : ' + buts(b.first_try) + ' sur ' + b.total + ' !' }),
          sauve ? null : el('p', { classe: 'bandeau-record-note', texte: '(Ce record n’a pas pu être sauvegardé sur l’ordinateur.)' })
        ]);
      } else if (ancien) {
        messageRecord = el('div', { classe: 'bandeau-record-neutre' }, [
          el('p', { texte: 'Ton record au ' + b.titre + ' : ' + buts(ancien.first_try) + ' sur ' + ancien.total })
        ]);
      }
    }

    var sections = [];
    if (b.arrets.length) {
      sections.push(el('section', { classe: 'panneau', 'aria-label': 'Mots à pratiquer' }, [
        el('div', { classe: 'panneau-entete' }, [
          el('h2', { texte: 'Mots à pratiquer (' + b.arrets.length + ')' }),
          el('p', { texte: 'Ils sont ajoutés à ton entrainement.' })
        ]),
        puces(b.arrets, 'puce-arret')
      ]));
    } else {
      sections.push(el('section', { classe: 'panneau' }, [
        el('h2', { texte: 'Aucun arrêt du gardien, bravo !' })
      ]));
    }
    if (b.retours.length) {
      sections.push(el('section', { classe: 'panneau', 'aria-label': 'Réussis au 2e essai' }, [
        el('div', { classe: 'panneau-entete' }, [
          el('h2', { texte: 'Réussis au 2e essai (' + b.retours.length + ')' }),
          el('p', { texte: 'Presque ! Ils sont aussi ajoutés à ton entrainement.' })
        ]),
        puces(b.retours, 'puce-retour')
      ]));
    }

    var rejouer = el('button', {
      type: 'button', classe: 'btn btn-grenat', icone: REJOUER,
      onclick: function () {
        if (b.mode === 'bloc') Quiz.demarrerBloc(b.idBloc);
        else Quiz.demarrer(b.options);
      }
    }, [b.mode === 'bloc' ? 'Rejouer le match' : 'Recommencer']);

    var ecran = el('div', { classe: 'resultat' }, [
      el('header', { classe: 'resultat-entete' }, [
        el('div', { classe: 'resultat-entete-contenu' }, [
          el('p', { classe: 'surtitre', texte: b.titre }),
          el('h1', { classe: 'resultat-titre', texte: parfait ? 'Match parfait !' : 'Coup de sifflet final !' }),
          el('div', { classe: 'resultat-score' }, [
            el('span', { classe: 'resultat-score-valeur', texte: String(b.first_try) }),
            el('span', { classe: 'resultat-score-texte', texte: (b.first_try <= 1 ? 'but' : 'buts') + ' sur ' + b.total + ' tirs' })
          ])
        ])
      ]),
      el('main', { classe: 'resultat-corps' }, [
        blocEtoiles,
        messageRecord,
        el('section', { classe: 'tuiles', 'aria-label': 'Détail du match' }, [
          tuile('Buts du premier coup', b.first_try, 't-buts'),
          tuile('Buts sur retour', b.after_retry, 't-retours'),
          tuile('Arrêts du gardien', b.arrets.length, 't-arrets')
        ]),
        sections[0], sections[1] || null,
        el('div', { classe: 'resultat-boutons' }, [
          rejouer,
          el('button', { type: 'button', classe: 'btn btn-contour', onclick: function () { Vestiaire.afficher(); } }, ['Aller au vestiaire']),
          el('button', { type: 'button', classe: 'btn btn-neutre', onclick: function () { Son.arreter(); Menu.afficher(); } }, ['Menu'])
        ])
      ])
    ]);
    App.afficher(ecran);
    rejouer.focus();
    Son.jouer([consigne('fin_match'), nouvellesEtoiles > 0 ? consigne('etoile') : null, parfait ? consigne('match_parfait') : (nouveauRecord ? consigne('record') : null)]);
  }

  /* Bilan d'un entrainement : on compare la cote de chaque mot avant et apres. */
  function afficherEntrainement(b) {
    var el = App.el;
    App.ecranActif = 'resultat';
    var avant = (b.options && b.options.avant) || {};
    var groupes = { maitrises: [], progres: [], dejaComptes: [], aRetravailler: [] };
    b.options.items.forEach(function (item) {
      var cle = item.liste.id + '/' + item.mot.mot;
      var info = Stockage.infoMot(item.liste.id, item.mot.mot);
      var apres = info ? info.cote : 0;
      var av = avant[cle] || 0;
      if (apres > av) groupes.aRetravailler.push(item);
      else if (apres === 0) groupes.maitrises.push(item);
      else if (apres < av) groupes.progres.push(item);
      else groupes.dejaComptes.push(item);
    });
    var cartes = [
      ['Maîtrisés', 'Sortis de ta liste. Bravo !', groupes.maitrises, 'puce-or'],
      ['En progrès', 'Un cran de moins aujourd\u2019hui.', groupes.progres, 'puce-retour'],
      ['Déjà comptés aujourd\u2019hui', 'Réussis ! Ils baisseront demain.', groupes.dejaComptes, 'puce-neutre'],
      ['À retravailler', 'Ils restent dans ton entrainement.', groupes.aRetravailler, 'puce-arret']
    ].filter(function (c) { return c[2].length; }).map(function (c) {
      return el('section', { classe: 'panneau' }, [
        el('div', { classe: 'panneau-entete' }, [el('h2', { texte: c[0] }), el('p', { texte: c[1] })]),
        puces(c[2], c[3])
      ]);
    });
    var n = groupes.maitrises.length;
    var restants = Vestiaire.motsDifficiles().length;
    App.afficher(el('div', { classe: 'resultat' }, [
      el('header', { classe: 'resultat-entete' }, [
        el('div', { classe: 'resultat-entete-contenu' }, [
          el('p', { classe: 'surtitre', texte: 'Vestiaire' }),
          el('h1', { classe: 'resultat-titre', texte: 'Entrainement terminé !' }),
          el('div', { classe: 'resultat-score' }, [
            el('span', { classe: 'resultat-score-valeur', texte: String(n) }),
            el('span', { classe: 'resultat-score-texte', texte: n <= 1 ? 'mot maîtrisé' : 'mots maîtrisés' })
          ])
        ])
      ]),
      el('main', { classe: 'resultat-corps' }, [
        el('div', { classe: 'grille-bilan' }, cartes),
        el('div', { classe: 'bandeau-record-neutre' }, [el('p', { texte: 'Un mot peut baisser d\u2019un cran par jour. Reviens demain pour continuer !' })]),
        el('div', { classe: 'resultat-boutons' }, [
          el('button', { type: 'button', classe: 'btn btn-grenat', onclick: function () { Son.arreter(); Menu.afficher(); } }, ['Retour au menu']),
          restants ? el('button', { type: 'button', classe: 'btn btn-contour', onclick: function () { Vestiaire.afficher(); } }, ['Revoir mes mots']) : null
        ])
      ])
    ]));
    Son.jouer([consigne('fin_match')]);
  }

  window.Resultat = { afficher: afficher };
})();
