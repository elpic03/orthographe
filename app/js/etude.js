/* Ecrans d'etude : « Etude du bloc » (tous les mots) et « Vestiaire » (les 10 mots difficiles). */
(function () {
  'use strict';

  var MAX_DIFFICILES = 10;
  var ICONES = {
    hautParleur: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg>',
    bulle: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5z"/></svg>',
    maison: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>',
    fleche: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    ampoule: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z"/></svg>',
    petitBallon: '<svg width="16" height="16" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#fff" stroke="#0A1C3F" stroke-width="3"/><polygon points="20,12 27.6,17.5 24.7,26.5 15.3,26.5 12.4,17.5" fill="#0A1C3F"/></svg>'
  };

  function cheminMot(item) { return 'listes/' + item.liste.dossier + '/' + item.mot.fichier; }
  function cheminPhrase(item) { return 'listes/' + item.liste.dossier + '/phrases/' + item.mot.phrase.fichier; }

  /* ---------- Selection des mots difficiles ---------- */
  function motsDifficiles() {
    var donnees = window.DONNEES_QUIZ;
    var mots = Stockage.obtenir().mots;
    var resultat = [];
    Object.keys(donnees.listes).forEach(function (id) {
      var liste = donnees.listes[id];
      liste.mots.forEach(function (mot) {
        var info = mots[id + '/' + mot.mot];
        if (info && info.cote > 0) resultat.push({ liste: liste, mot: mot, info: info });
      });
    });
    resultat.sort(function (a, b) {
      if (b.info.cote !== a.info.cote) return b.info.cote - a.info.cote;
      return String(b.info.derniereErreur || '').localeCompare(String(a.info.derniereErreur || ''));
    });
    return resultat.slice(0, MAX_DIFFICILES);
  }

  /* ---------- Morceaux communs ---------- */
  function motSurligne(mot) {
    var el = App.el;
    return el('span', { classe: 'mot-surligne' }, mot.segments.map(function (seg) {
      return seg[1] ? el('mark', { texte: seg[0] }) : document.createTextNode(seg[0]);
    }));
  }

  function boutonsSon(item) {
    var el = App.el;
    return el('div', { classe: 'carte-mot-sons' }, [
      el('button', { type: 'button', classe: 'btn btn-contour btn-icone', 'aria-label': 'Écouter « ' + item.mot.mot + ' »', title: 'Écouter',
        icone: ICONES.hautParleur, onclick: function () { Son.jouer([cheminMot(item)]); } }),
      item.mot.phrase ? el('button', { type: 'button', classe: 'btn btn-contour btn-icone btn-phrase', 'aria-label': 'Écouter « ' + item.mot.mot + ' » dans une phrase', title: 'Phrase',
        icone: ICONES.bulle, onclick: function () { Son.jouer([cheminPhrase(item)]); } }) : null
    ]);
  }

  function entete(surtitre, titre) {
    var el = App.el;
    return el('header', { classe: 'etude-entete' }, [
      el('div', { classe: 'etude-entete-contenu' }, [
        el('div', {}, [
          el('p', { classe: 'surtitre', texte: surtitre }),
          el('h1', { classe: 'etude-titre', texte: titre })
        ]),
        el('button', { type: 'button', classe: 'btn btn-sombre btn-petit', icone: ICONES.maison, onclick: retourMenu }, ['Menu'])
      ])
    ]);
  }

  function retourMenu() { Son.arreter(); Menu.afficher(); }

  /* Regroupe par finale surlignee si la liste s'y prete (ex. Bloc 13 : -er, -é, -ier). Sinon ordre alphabetique. */
  function groupes(liste) {
    var parFinale = {};
    var tousSurlignes = liste.mots.every(function (m) {
      var marques = m.segments.filter(function (s) { return s[1]; });
      if (!marques.length) return false;
      var finale = marques[marques.length - 1][0];
      (parFinale[finale] = parFinale[finale] || []).push(m);
      return true;
    });
    var cles = Object.keys(parFinale);
    var regroupable = tousSurlignes && cles.length >= 2 && cles.length <= 4 &&
      cles.every(function (c) { return parFinale[c].length >= 3; });
    if (!regroupable) return [{ titre: null, mots: liste.mots }];
    return cles.sort(function (a, b) { return parFinale[b].length - parFinale[a].length; })
      .map(function (c) { return { titre: 'Finale -' + c, mots: parFinale[c] }; });
  }

  /* ---------- Etude du bloc ---------- */
  function afficherEtude(idBloc) {
    var el = App.el;
    var liste = window.DONNEES_QUIZ.listes[idBloc];
    if (!liste) { App.annoncer('Ce bloc n’est pas disponible.'); return; }
    App.ecranActif = 'etude';
    var mots = Stockage.obtenir().mots;

    var themes = liste.titre || liste.description ? el('div', { classe: 'theme' }, [
      el('p', { classe: 'theme-etiquette', texte: 'Le thème du bloc' }),
      liste.titre ? el('h2', { classe: 'theme-titre', texte: liste.titre }) : null,
      liste.description ? el('p', { classe: 'theme-texte', texte: liste.description }) : null
    ]) : null;

    var sections = groupes(liste).map(function (g) {
      return el('section', { classe: 'etude-groupe' }, [
        g.titre ? el('div', { classe: 'etude-groupe-entete' }, [
          el('h3', { classe: 'etude-groupe-titre', texte: g.titre }),
          el('span', { classe: 'etude-groupe-nombre', texte: g.mots.length + ' mots' })
        ]) : null,
        el('div', { classe: 'grille-mots' }, g.mots.map(function (mot) {
          var item = { liste: liste, mot: mot };
          var info = mots[liste.id + '/' + mot.mot];
          return el('article', { classe: 'carte-mot carte-mot-compacte' }, [
            el('div', { classe: 'carte-mot-texte' }, [
              motSurligne(mot),
              info && info.cote > 0 ? el('span', { classe: 'etiquette-pratiquer', texte: 'À pratiquer' }) : null
            ]),
            boutonsSon(item)
          ]);
        }))
      ]);
    });

    App.afficher(el('div', { classe: 'etude' }, [
      entete('Étude', 'Bloc ' + idBloc + ' · ' + liste.mots.length + ' mots'),
      el('main', { classe: 'etude-corps' }, [
        el('div', { classe: 'etude-intro' }, [
          themes,
          el('div', { classe: 'etude-consigne' }, [
            el('p', { texte: 'La partie surlignée, c’est le piège à surveiller. Clique sur le haut-parleur pour entendre un mot.' }),
            el('span', { classe: 'legende' }, [el('span', { classe: 'mot-surligne' }, ['mang', el('mark', { texte: 'é' })]), ' = la lettre piège'])
          ])
        ]),
        el('div', { classe: 'etude-groupes' }, sections),
        el('div', { classe: 'etude-actions' }, [
          el('button', { type: 'button', classe: 'btn btn-grenat btn-grand', icone: '', onclick: function () { Quiz.demarrerBloc(idBloc); } },
            ['Je suis prêt ! Jouer le Bloc ' + idBloc, el('span', { 'aria-hidden': 'true', icone: ICONES.fleche })]),
          el('button', { type: 'button', classe: 'btn btn-contour', onclick: retourMenu }, ['Menu'])
        ])
      ])
    ]));
  }

  /* ---------- Vestiaire (mots difficiles) ---------- */
  function afficherVestiaire() {
    var el = App.el;
    var items = motsDifficiles();
    if (!items.length) { App.annoncer('Aucun mot difficile pour l’instant. Bravo !'); Menu.afficher(); return; }
    App.ecranActif = 'vestiaire';
    var jour = Regles.jourLocal();

    var cartes = items.map(function (it) {
      var nbBallons = Math.min(it.info.cote, 5);
      var ballons = [];
      for (var i = 0; i < nbBallons; i++) ballons.push(el('span', { 'aria-hidden': 'true', icone: ICONES.petitBallon }));
      return el('article', { classe: 'carte-mot' }, [
        motSurligne(it.mot),
        el('p', { classe: 'carte-mot-origine', texte: 'Bloc ' + it.liste.id }),
        el('div', { classe: 'carte-mot-cote' }, ballons.concat([
          el('span', { texte: it.info.cote === 1 ? 'Encore 1 réussite' : 'Encore ' + it.info.cote + ' réussites' })
        ])),
        it.info.derniereBaisse === jour ? el('span', { classe: 'etiquette-jour', texte: 'Déjà pratiqué aujourd’hui' }) : null,
        boutonsSon(it)
      ]);
    });

    var avant = {};
    items.forEach(function (it) { avant[it.liste.id + '/' + it.mot.mot] = it.info.cote; });

    App.afficher(el('div', { classe: 'etude' }, [
      entete('Entrainement', 'Vestiaire'),
      el('main', { classe: 'etude-corps' }, [
        el('div', { classe: 'etude-intro' }, [
          el('div', { classe: 'etude-consigne' }, [
            el('h2', { classe: 'vestiaire-titre', texte: 'Regarde bien tes ' + (items.length === 1 ? 'mot' : items.length + ' mots') }),
            el('p', { texte: 'Clique sur le haut-parleur pour entendre un mot. Quand tu es prêt, les mots seront cachés et mélangés.' })
          ]),
          el('div', { classe: 'truc', icone: ICONES.ampoule }, [
            el('p', { texte: 'Truc de pro : regarde le mot, cache-le, écris-le dans ta tête, puis vérifie.' })
          ])
        ]),
        el('div', { classe: 'grille-mots grille-vestiaire' }, cartes),
        el('div', { classe: 'etude-actions' }, [
          el('button', { type: 'button', classe: 'btn btn-grenat btn-grand',
            onclick: function () {
              Quiz.demarrer({
                mode: 'entrainement', titre: 'Entrainement',
                items: items.map(function (it) { return { liste: it.liste, mot: it.mot }; }),
                avant: avant
              });
            } }, ['Je suis prêt !', el('span', { 'aria-hidden': 'true', icone: ICONES.fleche })]),
          el('button', { type: 'button', classe: 'btn btn-contour', onclick: retourMenu }, ['Menu'])
        ])
      ])
    ]));
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && (App.ecranActif === 'etude' || App.ecranActif === 'vestiaire')) { e.preventDefault(); retourMenu(); }
  });

  window.Etude = { afficher: afficherEtude, groupes: groupes };
  window.Vestiaire = { afficher: afficherVestiaire, motsDifficiles: motsDifficiles };
})();
