/* Ecran Statistiques : temps, resultats, etoiles, blocs, mots difficiles, records.
   Tout est calcule a partir de Stockage.stats() et des records ; rien n'est modifie ici. */
(function () {
  'use strict';

  var JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var ouvert = {}; /* blocs dont le detail est deplie */

  /* ---------- Formats ---------- */
  function duree(ms) {
    var sec = Math.round((ms || 0) / 1000);
    if (sec < 60) return sec + ' s';
    var min = Math.floor(sec / 60), h = Math.floor(min / 60);
    if (h > 0) return h + ' h ' + String(min % 60).padStart(2, '0') + ' min';
    return min < 10 && sec % 60 ? min + ' min ' + (sec % 60) + ' s' : min + ' min';
  }
  function pourcent(n, d) { return d > 0 ? Math.round(100 * n / d) + ' %' : '—'; }
  function dateCourte(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? parseInt(m[3], 10) + ' ' + MOIS[parseInt(m[2], 10) - 1] : '';
  }
  function jourDe(dateObj) { return Regles.jourLocal(dateObj); }
  function decaler(jour, n) {
    var p = jour.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2]); d.setDate(d.getDate() + n); return d;
  }
  function pluriel(n, s, p) { return n + ' ' + (n <= 1 ? s : p); }

  /* ---------- Calculs ---------- */
  function calculer() {
    var st = Stockage.stats();
    var donnees = window.DONNEES_QUIZ;
    var c = { tirs: 0, buts: 0, retours: 0, arrets: 0, ms: 0, motsJours: 0 };
    Object.keys(st.mots).forEach(function (k) {
      var m = st.mots[k]; c.tirs += m.tirs; c.buts += m.buts; c.retours += m.retours; c.arrets += m.arrets;
    });
    Object.keys(st.jours).forEach(function (j) { c.ms += st.jours[j].ms; c.motsJours += st.jours[j].mots; });
    var complets = st.matchs.filter(function (m) { return !m.abandonne; });
    c.matchs = complets.filter(function (m) { return m.mode === 'bloc'; }).length;
    c.entrainements = complets.filter(function (m) { return m.mode === 'entrainement'; }).length;
    c.maitrises = st.maitrises;

    /* Jours d'affilee : serie actuelle (jusqu'a aujourd'hui ou hier) et meilleure serie */
    var jours = Object.keys(st.jours).filter(function (j) { return st.jours[j].mots > 0; }).sort();
    var ensemble = {}; jours.forEach(function (j) { ensemble[j] = true; });
    var meilleure = 0, courante = 0, prec = null;
    jours.forEach(function (j) {
      courante = prec && jourDe(decaler(prec, 1)) === j ? courante + 1 : 1;
      meilleure = Math.max(meilleure, courante); prec = j;
    });
    var aujourdhui = Regles.jourLocal();
    var depart = ensemble[aujourdhui] ? aujourdhui : (ensemble[jourDe(decaler(aujourdhui, -1))] ? jourDe(decaler(aujourdhui, -1)) : null);
    var serie = 0;
    while (depart && ensemble[jourDe(decaler(depart, -serie))]) serie += 1;
    c.serieJours = serie; c.meilleureSerieJours = meilleure;

    /* Etoiles */
    c.etoiles = 0; c.etoilesMax = 0; c.ors = 0; c.blocs3 = 0;
    donnees.ordre.forEach(function (id) {
      if (!donnees.listes[id]) return;
      c.etoilesMax += 3;
      var r = Stockage.record(id);
      if (!r) return;
      var n = Regles.etoiles(r.first_try, r.total);
      c.etoiles += n; if (n === 3) c.blocs3 += 1;
      if (Regles.ballonDor(r.first_try, r.total)) c.ors += 1;
    });

    /* 7 derniers jours */
    c.semaine = [];
    for (var i = 6; i >= 0; i--) {
      var d = decaler(aujourdhui, -i), cle = jourDe(d), info = st.jours[cle];
      c.semaine.push({ cle: cle, nom: JOURS[d.getDay()], date: d.getDate(), ms: info ? info.ms : 0, mots: info ? info.mots : 0, auj: i === 0 });
    }

    /* Par bloc */
    c.blocs = [];
    donnees.ordre.concat(Object.keys(donnees.listes).filter(function (id) { return donnees.ordre.indexOf(id) === -1; }))
      .forEach(function (id) {
        var prefixe = id + '/';
        var mots = Object.keys(st.mots).filter(function (k) { return k.indexOf(prefixe) === 0; });
        var matchsBloc = st.matchs.filter(function (m) { return m.mode === 'bloc' && m.bloc === id; });
        if (!mots.length && !matchsBloc.length) return;
        var ms = 0, tirs = 0;
        mots.forEach(function (k) { ms += st.mots[k].ms; tirs += st.mots[k].tirs; });
        var finis = matchsBloc.filter(function (m) { return !m.abandonne; });
        var moyenne = finis.length ? finis.reduce(function (a, m) { return a + m.first_try / m.total; }, 0) / finis.length : null;
        var derniers = finis.slice(-5).map(function (m) { return Math.round(100 * m.first_try / m.total); });
        var tendance = derniers.length >= 2 ? Math.sign(derniers[derniers.length - 1] - derniers[0]) : 0;
        var r = Stockage.record(id);
        var difficiles = mots.map(function (k) { var m = st.mots[k]; return { mot: k.slice(prefixe.length), m: m }; })
          .filter(function (x) { return x.m.arrets + x.m.retours > 0; })
          .sort(function (a, b) { return (b.m.arrets * 2 + b.m.retours) - (a.m.arrets * 2 + a.m.retours); }).slice(0, 5);
        c.blocs.push({ id: id, ms: ms, tirs: tirs, matchs: finis.length, moyenne: moyenne, derniers: derniers, tendance: tendance,
          record: r, etoiles: r ? Regles.etoiles(r.first_try, r.total) : 0, or: r ? Regles.ballonDor(r.first_try, r.total) : false,
          historique: matchsBloc.slice(-10).reverse(), difficiles: difficiles });
      });

    /* Mots les plus difficiles (tous blocs) */
    c.difficiles = Object.keys(st.mots).map(function (k) {
      var i = k.indexOf('/'); return { bloc: k.slice(0, i), mot: k.slice(i + 1), m: st.mots[k] };
    }).filter(function (x) { return x.m.arrets + x.m.retours > 0; })
      .sort(function (a, b) { return (b.m.arrets * 2 + b.m.retours) - (a.m.arrets * 2 + a.m.retours) || b.m.tirs - a.m.tirs; }).slice(0, 10);

    /* Records personnels */
    c.meilleureSerie = st.matchs.reduce(function (a, m) { return Math.max(a, m.serie); }, 0);
    var sansFaute = complets.filter(function (m) { return m.mode === 'bloc' && m.arrets === 0 && m.after_retry === 0 && m.duree > 0; })
      .sort(function (a, b) { return a.duree / a.total - b.duree / b.total; });
    c.plusRapide = sansFaute[0] || null;
    var jourMax = Object.keys(st.jours).sort(function (a, b) { return st.jours[b].ms - st.jours[a].ms; })[0];
    c.jourMax = jourMax ? { cle: jourMax, ms: st.jours[jourMax].ms, mots: st.jours[jourMax].mots } : null;
    return c;
  }

  /* ---------- Morceaux d'affichage ---------- */
  function tuile(libelle, valeur, detail, icone) {
    var el = App.el;
    return el('div', { classe: 'stat-tuile' }, [
      el('span', { classe: 'stat-libelle', texte: libelle }),
      el('span', { classe: 'stat-valeur', icone: icone || '' }, [valeur]),
      detail ? el('span', { classe: 'stat-detail', texte: detail }) : null
    ]);
  }

  function graphiqueSemaine(semaine) {
    var el = App.el;
    var max = Math.max.apply(null, semaine.map(function (j) { return j.ms; }).concat([60000]));
    var total = semaine.reduce(function (a, j) { return a + j.ms; }, 0);
    var resume = semaine.map(function (j) { return j.nom + ' ' + j.date + ' : ' + duree(j.ms); }).join(', ');
    return el('section', { classe: 'panneau' }, [
      el('div', { classe: 'panneau-entete' }, [
        el('h2', { texte: 'Cette semaine' }),
        el('p', { texte: 'Total des 7 derniers jours : ' + duree(total) })
      ]),
      el('div', { classe: 'barres', role: 'img', 'aria-label': 'Temps de pratique par jour. ' + resume },
        semaine.map(function (j) {
          var h = j.ms > 0 ? Math.max(4, Math.round(100 * j.ms / max)) : 0;
          return el('div', { classe: 'barre-colonne' + (j.auj ? ' aujourdhui' : ''), title: j.nom + ' ' + j.date + ' : ' + duree(j.ms) + ' · ' + pluriel(j.mots, 'mot', 'mots') }, [
            el('span', { classe: 'barre-valeur', texte: j.ms > 0 ? duree(j.ms) : '' }),
            el('div', { classe: 'barre-zone' }, [el('div', { classe: 'barre', style: 'height:' + h + '%' })]),
            el('span', { classe: 'barre-jour', texte: j.auj ? 'auj.' : j.nom }),
            el('span', { classe: 'barre-date', texte: String(j.date) })
          ]);
        }))
    ]);
  }

  function tableauBlocs(blocs) {
    var el = App.el;
    if (!blocs.length) return el('section', { classe: 'panneau' }, [el('h2', { texte: 'Par bloc' }), el('p', { classe: 'stat-vide', texte: 'Joue un premier match pour voir tes statistiques par bloc.' })]);
    var lignes = [];
    blocs.forEach(function (b) {
      var fleche = b.tendance > 0 ? '↗' : (b.tendance < 0 ? '↘' : '→');
      var deplie = !!ouvert[b.id];
      lignes.push(el('tr', {}, [
        el('th', { scope: 'row' }, [el('button', { type: 'button', classe: 'lien-bloc', 'aria-expanded': deplie ? 'true' : 'false',
          onclick: function () { ouvert[b.id] = !ouvert[b.id]; afficher(true); } }, [(deplie ? '▾ ' : '▸ ') + 'Bloc ' + b.id])]),
        el('td', { 'aria-label': b.etoiles + ' étoiles', icone: App.etoilesHTML(b.etoiles, 16) + (b.or ? App.ICONES.ballonOr : '') }),
        el('td', { classe: 'nombre', texte: String(b.matchs) }),
        el('td', { classe: 'nombre', texte: duree(b.ms) }),
        el('td', { classe: 'nombre', texte: b.tirs ? duree(b.ms / b.tirs) : '—' }),
        el('td', { classe: 'nombre', texte: b.record ? b.record.first_try + '/' + b.record.total : '—' }),
        el('td', { classe: 'nombre', texte: b.moyenne === null ? '—' : Math.round(b.moyenne * 100) + ' %' }),
        el('td', { texte: b.derniers.length ? b.derniers.join(' · ') + ' % ' + fleche : '—' })
      ]));
      if (deplie) {
        lignes.push(el('tr', { classe: 'detail-bloc' }, [el('td', { colspan: '8' }, [
          el('div', { classe: 'detail-grille' }, [
            el('div', {}, [
              el('h3', { texte: 'Derniers matchs' }),
              b.historique.length ? el('ul', { classe: 'liste-simple' }, b.historique.map(function (m) {
                return el('li', { texte: dateCourte(m.date) + ' — ' + m.first_try + '/' + m.total + ' du premier coup · ' + duree(m.duree * 1000) + (m.abandonne ? ' (abandonné)' : '') });
              })) : el('p', { classe: 'stat-vide', texte: 'Aucun match.' })
            ]),
            el('div', {}, [
              el('h3', { texte: 'Mots les plus ratés' }),
              b.difficiles.length ? el('ul', { classe: 'liste-simple' }, b.difficiles.map(function (x) {
                return el('li', { texte: x.mot + ' — ' + pluriel(x.m.arrets, 'arrêt', 'arrêts') + ', ' + pluriel(x.m.retours, 'retour', 'retours') });
              })) : el('p', { classe: 'stat-vide', texte: 'Aucune erreur dans ce bloc. Bravo !' })
            ])
          ])
        ])]));
      }
    });
    return el('section', { classe: 'panneau' }, [
      el('h2', { texte: 'Par bloc' }),
      el('div', { classe: 'tableau-defilant' }, [el('table', { classe: 'tableau-stats' }, [
        el('thead', {}, [el('tr', {}, ['Bloc', 'Étoiles', 'Matchs', 'Temps total', 'Temps / mot', 'Record', 'Moyenne 1er coup', '5 derniers matchs']
          .map(function (t) { return el('th', { scope: 'col', texte: t }); }))]),
        el('tbody', {}, lignes)
      ])])
    ]);
  }

  function motsDifficiles(liste) {
    var el = App.el;
    return el('section', { classe: 'panneau' }, [
      el('h2', { texte: 'Mots les plus difficiles' }),
      liste.length ? el('div', { classe: 'tableau-defilant' }, [el('table', { classe: 'tableau-stats' }, [
        el('thead', {}, [el('tr', {}, ['Mot', 'Bloc', 'Arrêts', 'Buts sur retour', 'Tirs'].map(function (t) { return el('th', { scope: 'col', texte: t }); }))]),
        el('tbody', {}, liste.map(function (x) {
          return el('tr', {}, [el('th', { scope: 'row', texte: x.mot }), el('td', { texte: x.bloc }), el('td', { classe: 'nombre', texte: String(x.m.arrets) }),
            el('td', { classe: 'nombre', texte: String(x.m.retours) }), el('td', { classe: 'nombre', texte: String(x.m.tirs) })]);
        }))
      ])]) : el('p', { classe: 'stat-vide', texte: 'Aucune erreur pour l’instant.' })
    ]);
  }

  function records(c) {
    var el = App.el;
    return el('section', { classe: 'panneau' }, [
      el('h2', { texte: 'Records personnels' }),
      el('div', { classe: 'stat-tuiles' }, [
        tuile('Plus longue série de buts d’affilée', String(c.meilleureSerie), c.meilleureSerie ? 'dans un même match' : 'à venir'),
        tuile('Match sans faute le plus rapide', c.plusRapide ? duree(c.plusRapide.duree * 1000) : '—',
          c.plusRapide ? 'Bloc ' + c.plusRapide.bloc + ' · ' + pluriel(c.plusRapide.total, 'mot', 'mots') + ' · ' + dateCourte(c.plusRapide.date) : 'aucun match sans faute'),
        tuile('Jour le plus actif', c.jourMax ? duree(c.jourMax.ms) : '—', c.jourMax ? dateCourte(c.jourMax.cle) + ' · ' + pluriel(c.jourMax.mots, 'mot', 'mots') : '')
      ])
    ]);
  }

  /* ---------- Ecran ---------- */
  function afficher(garderDefilement) {
    var el = App.el;
    var y = garderDefilement ? window.scrollY : 0;
    App.ecranActif = 'statistiques';
    var c = calculer();
    App.afficher(el('div', { classe: 'etude statistiques' }, [
      el('header', { classe: 'etude-entete' }, [
        el('div', { classe: 'etude-entete-contenu' }, [
          el('div', {}, [el('p', { classe: 'surtitre', texte: 'Ton parcours' }), el('h1', { classe: 'etude-titre', texte: 'Statistiques' })]),
          el('button', { type: 'button', classe: 'btn btn-sombre btn-petit', onclick: function () { Menu.afficher(); } }, ['Menu'])
        ])
      ]),
      el('main', { classe: 'etude-corps' }, [
        el('section', { classe: 'stat-tuiles', 'aria-label': 'Vue d’ensemble' }, [
          tuile('Temps de pratique', duree(c.ms), 'temps actif, toutes sessions'),
          tuile('Matchs complétés', String(c.matchs), pluriel(c.entrainements, 'entrainement', 'entrainements')),
          tuile('Mots écrits', String(c.tirs), ''),
          tuile('Buts du premier coup', pourcent(c.buts, c.tirs), c.buts + ' sur ' + c.tirs),
          tuile('Buts sur retour / arrêts', c.retours + ' / ' + c.arrets, ''),
          tuile('Jours d’affilée', String(c.serieJours), 'record : ' + pluriel(c.meilleureSerieJours, 'jour', 'jours')),
          tuile('Mots maîtrisés', String(c.maitrises), 'sortis de l’entrainement'),
          tuile('Étoiles', c.etoiles + ' / ' + c.etoilesMax, pluriel(c.blocs3, 'bloc', 'blocs') + ' à 3 étoiles · ' + pluriel(c.ors, 'ballon', 'ballons') + ' d’or')
        ]),
        graphiqueSemaine(c.semaine),
        tableauBlocs(c.blocs),
        motsDifficiles(c.difficiles),
        records(c)
      ])
    ]));
    window.scrollTo(0, y);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && App.ecranActif === 'statistiques') { e.preventDefault(); Menu.afficher(); }
  });

  window.Statistiques = { afficher: afficher, calculer: calculer };
})();
