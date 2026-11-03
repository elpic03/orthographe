/* Ecran du menu : calendrier des blocs, bandeau d'entrainement, sauvegarde. */
(function () {
  'use strict';

  function pluriel(n, singulier, plurielTexte) {
    return n + ' ' + (n <= 1 ? singulier : plurielTexte);
  }

  function texteRecord(r) {
    return 'Record : ' + pluriel(r.first_try, 'but', 'buts') + ' sur ' + r.total;
  }

  function bandeauEntrainement() {
    var el = App.el;
    var n = Vestiaire.motsDifficiles().length;
    var titre = n === 0 ? 'Aucun mot difficile pour l’instant' : pluriel(n, 'mot difficile', 'mots difficiles') + ' à pratiquer';
    var texte = n === 0 ? 'Les mots ratés pendant tes matchs viendront ici.' : 'Va au vestiaire pour les revoir avant de tirer.';
    return el('section', { classe: 'bandeau-entrainement', 'aria-label': 'Entrainement' }, [
      el('div', { classe: 'bandeau-gauche' }, [
        el('div', { classe: 'pastille-maillot', 'aria-hidden': 'true', icone: App.ICONES.maillot }),
        el('div', {}, [
          el('p', { classe: 'surtitre', texte: 'Entrainement' }),
          el('h2', { classe: 'bandeau-titre', texte: titre }),
          el('p', { classe: 'bandeau-texte', texte: texte })
        ])
      ]),
      el('button', { type: 'button', classe: 'btn btn-or', disabled: n === 0, onclick: function () { Vestiaire.afficher(); } }, [
        'Aller au vestiaire',
        el('span', { 'aria-hidden': 'true', icone: App.ICONES.fleche })
      ])
    ]);
  }

  /* Titre court d'une carte, prepare pour de bons retours a la ligne (le texte reste du texte) :
     1. espace insecable devant : ; ! ? (typographie francaise) ;
     2. espace insecable apres un mot d'un seul caractere (« e + consonnes » reste groupe) ;
     3. un mot avec trait d'union n'est jamais coupe (zone .insecable ; le trait d'union
        insecable U+2011 n'existe pas dans la police Lexend). */
  function titreCarte(texte) {
    var t = texte.replace(/ ([:;!?])/g, '\u00A0$1')
                 .replace(/(?<=^|[ \u00A0])([^ \u00A0:;!?]) /g, '$1\u00A0');
    var enfants = [];
    t.split(' ').forEach(function (mot, i) {
      if (i > 0) enfants.push(' ');
      enfants.push(mot.indexOf('-') !== -1 ? App.el('span', { classe: 'insecable', texte: mot }) : mot);
    });
    return App.el('span', { classe: 'carte-theme' }, enfants);
  }

  function carteBloc(id, liste) {
    var el = App.el;
    var nom = 'Bloc ' + id;
    if (!liste) {
      return el('div', { classe: 'carte-avenir', 'aria-label': nom + ', à venir' }, [
        el('span', { classe: 'carte-nom', texte: nom }),
        el('span', { classe: 'carte-avenir-etat', icone: App.ICONES.cadenas }, ['À venir'])
      ]);
    }
    var r = Stockage.record(id);
    return el('div', { classe: 'carte-bloc' }, [
      el('span', { classe: 'carte-nom', texte: nom }),
      liste.titreCourt ? titreCarte(liste.titreCourt) : null,
      el('span', { classe: 'carte-mots', texte: pluriel(liste.mots.length, 'mot', 'mots') }),
      el('span', { classe: 'carte-record' + (r ? ' a-un-record' : ''), texte: r ? texteRecord(r) : 'Pas encore joué' }),
      (function () {
        var n = r ? Regles.etoiles(r.first_try, r.total) : 0;
        var or = r ? Regles.ballonDor(r.first_try, r.total) : false;
        return el('span', { classe: 'carte-etoiles', 'aria-label': n + (n <= 1 ? ' étoile' : ' étoiles') + ' sur 3' + (or ? ', ballon d’or' : ''),
          icone: App.etoilesHTML(n, 18) + (or ? App.ICONES.ballonOr : '') });
      })(),
      el('div', { classe: 'carte-actions' }, [
        el('button', { type: 'button', classe: 'btn btn-grenat btn-mini', 'aria-label': 'Jouer le ' + nom, onclick: function () { Quiz.demarrerBloc(id); } }, ['Jouer']),
        el('button', { type: 'button', classe: 'btn btn-contour btn-mini', 'aria-label': 'Étudier le ' + nom, onclick: function () { Etude.afficher(id); } }, ['Étudier'])
      ])
    ]);
  }

  /* Total des etoiles et des ballons d'or sur les blocs disponibles. */
  function bilanEtoiles() {
    var d = window.DONNEES_QUIZ, total = 0, max = 0, ors = 0;
    d.ordre.forEach(function (id) {
      if (!d.listes[id]) return;
      max += 3;
      var r = Stockage.record(id);
      if (r) { total += Regles.etoiles(r.first_try, r.total); if (Regles.ballonDor(r.first_try, r.total)) ors += 1; }
    });
    return { total: total, max: max, ors: ors };
  }

  function afficher() {
    var el = App.el;
    App.ecranActif = 'menu';
    var be = bilanEtoiles();
    var donnees = window.DONNEES_QUIZ;
    var nbDisponibles = donnees.ordre.filter(function (id) { return donnees.listes[id]; }).length;
    var voix = Stockage.obtenir().reglages.voix;

    var ecran = el('main', { classe: 'menu' }, [
      el('div', { classe: 'menu-contenu' }, [
        el('header', { classe: 'menu-entete' }, [
          el('div', {}, [
            el('h1', { classe: 'menu-titre', texte: 'Quiz d’orthographe' }),
            el('p', { classe: 'menu-sous-titre', texte: nbDisponibles > 0 ? 'Choisis ton match :' : 'Aucune liste trouvée. Lance mettre-a-jour.cmd.' })
          ]),
          el('div', { classe: 'compteur-etoiles', 'aria-label': be.total + ' étoiles sur ' + be.max + ', ' + be.ors + ' ballon(s) d’or' }, [
            el('span', { classe: 'compteur-etoiles-ligne', icone: App.etoilesHTML(1, 26).split('</svg>')[0] + '</svg>' }, [el('strong', { texte: String(be.total) }), ' / ' + be.max]),
            el('span', { classe: 'compteur-etoiles-ligne', icone: App.ICONES.ballonOr }, [el('strong', { texte: String(be.ors) })])
          ])
        ]),
        bandeauEntrainement(),
        el('section', { classe: 'grille-blocs', 'aria-label': 'Blocs' },
          donnees.ordre.map(function (id) { return carteBloc(id, donnees.listes[id]); })),
        Stockage.estPersistant() ? null : el('p', { classe: 'alerte-memoire', role: 'alert', texte: 'Attention : ce navigateur ne garde pas ta progression. Utilise « Sauvegarder ma progression » avant de fermer.' }),
        el('footer', { classe: 'menu-pied' }, [
          el('div', { classe: 'menu-pied-gauche' }, [
            el('button', { type: 'button', classe: 'btn btn-contour', icone: App.ICONES.statistiques, onclick: function () { Statistiques.afficher(); } }, ['Statistiques']),
            el('button', { type: 'button', classe: 'btn btn-contour', icone: App.ICONES.telecharger, onclick: function () { Sauvegarde.exporter(); } }, ['Sauvegarder ma progression']),
            el('button', { type: 'button', classe: 'btn btn-contour', icone: App.ICONES.televerser, onclick: function () { Sauvegarde.recuperer(); } }, ['Récupérer ma progression'])
          ]),
          el('button', { type: 'button', classe: 'btn btn-neutre', 'aria-pressed': voix ? 'true' : 'false', title: 'Les encouragements et consignes parlés. Les mots jouent toujours.', icone: voix ? App.ICONES.volume : App.ICONES.muet,
            onclick: function () { var v = Stockage.basculerVoix(); afficher(); App.annoncer(v ? 'Voix du coach activées.' : 'Voix du coach coupées. Les mots jouent toujours.'); } },
            [voix ? 'Voix : activées' : 'Voix : coupées'])
        ])
      ])
    ]);
    App.afficher(ecran);
  }

  window.Menu = { afficher: afficher };
})();
