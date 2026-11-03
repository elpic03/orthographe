/* Stockage de la progression dans la memoire du navigateur (localStorage).
   Tout est verifie a la lecture : une donnee abimee est ignoree, jamais bloquante. */
(function () {
  'use strict';

  var CLE = 'quizOrthographe.v1';
  var etat = null;
  var persistant = true;

  function vide() {
    return { version: 1, records: {}, mots: {}, reglages: { voix: true }, stats: statsVides() };
  }

  var MAX_MATCHS = 2000;

  function statsVides() {
    return { matchs: [], jours: {}, mots: {}, maitrises: 0 };
  }

  function estObjet(x) {
    return x !== null && typeof x === 'object' && !Array.isArray(x);
  }

  function estEntier(x, min) {
    return Number.isInteger(x) && x >= min;
  }

  function recordValide(r) {
    return estObjet(r) && estEntier(r.total, 1) && estEntier(r.first_try, 0) &&
      estEntier(r.after_retry, 0) && r.first_try + r.after_retry <= r.total &&
      typeof r.date === 'string';
  }

  function dateOuNull(x) {
    return typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x) ? x : null;
  }

  /* Garde seulement ce qui est valide ; le reste est ignore. */
  function nettoyer(brut) {
    var propre = vide();
    if (!estObjet(brut)) return propre;
    if (estObjet(brut.records)) {
      Object.keys(brut.records).forEach(function (id) {
        var r = brut.records[id];
        if (recordValide(r)) {
          propre.records[id] = { total: r.total, first_try: r.first_try, after_retry: r.after_retry, date: r.date };
        }
      });
    }
    if (estObjet(brut.mots)) {
      Object.keys(brut.mots).forEach(function (cle) {
        var m = brut.mots[cle];
        if (estObjet(m) && estEntier(m.cote, 0)) {
          propre.mots[cle] = { cote: m.cote, derniereBaisse: dateOuNull(m.derniereBaisse), derniereErreur: dateOuNull(m.derniereErreur) };
        }
      });
    }
    if (estObjet(brut.reglages) && typeof brut.reglages.voix === 'boolean') {
      propre.reglages.voix = brut.reglages.voix;
    }
    propre.stats = nettoyerStats(brut.stats);
    return propre;
  }

  function matchValide(m) {
    return estObjet(m) && (m.mode === 'bloc' || m.mode === 'entrainement') &&
      (m.bloc === null || typeof m.bloc === 'string') && typeof m.date === 'string' &&
      estEntier(m.duree, 0) && estEntier(m.total, 0) && estEntier(m.first_try, 0) &&
      estEntier(m.after_retry, 0) && estEntier(m.arrets, 0) && estEntier(m.serie, 0) &&
      m.first_try + m.after_retry + m.arrets <= m.total && typeof m.abandonne === 'boolean';
  }

  function nettoyerStats(brut) {
    var propre = statsVides();
    if (!estObjet(brut)) return propre;
    if (Array.isArray(brut.matchs)) {
      propre.matchs = brut.matchs.filter(matchValide).slice(-MAX_MATCHS).map(function (m) {
        return { mode: m.mode, bloc: m.bloc, date: m.date, duree: m.duree, total: m.total, first_try: m.first_try,
          after_retry: m.after_retry, arrets: m.arrets, serie: m.serie, abandonne: m.abandonne };
      });
    }
    if (estObjet(brut.jours)) {
      Object.keys(brut.jours).forEach(function (j) {
        var d = brut.jours[j];
        if (/^\d{4}-\d{2}-\d{2}$/.test(j) && estObjet(d) && estEntier(d.ms, 0) && estEntier(d.mots, 0)) {
          propre.jours[j] = { ms: d.ms, mots: d.mots };
        }
      });
    }
    if (estObjet(brut.mots)) {
      Object.keys(brut.mots).forEach(function (cle) {
        var m = brut.mots[cle];
        if (estObjet(m) && estEntier(m.tirs, 1) && estEntier(m.buts, 0) && estEntier(m.retours, 0) &&
            estEntier(m.arrets, 0) && estEntier(m.ms, 0) && m.buts + m.retours + m.arrets <= m.tirs) {
          propre.mots[cle] = { tirs: m.tirs, buts: m.buts, retours: m.retours, arrets: m.arrets, ms: m.ms };
        }
      });
    }
    if (estEntier(brut.maitrises, 0)) propre.maitrises = brut.maitrises;
    return propre;
  }

  function charger() {
    try {
      var texte = window.localStorage.getItem(CLE);
      etat = nettoyer(texte ? JSON.parse(texte) : null);
    } catch (e) {
      etat = vide();
      persistant = false;
    }
    return etat;
  }

  function enregistrer() {
    try {
      window.localStorage.setItem(CLE, JSON.stringify(etat));
      persistant = true;
      return true;
    } catch (e) {
      persistant = false;
      return false;
    }
  }

  function obtenir() {
    return etat || charger();
  }

  function record(idListe) {
    return obtenir().records[idListe] || null;
  }

  function nombreMotsDifficiles() {
    var mots = obtenir().mots;
    return Object.keys(mots).filter(function (cle) { return mots[cle].cote > 0; }).length;
  }

  /* Remplace le record d'une liste. Retourne false si la sauvegarde a echoue
     (le record reste quand meme en memoire pour la session). */
  function definirRecord(idListe, r) {
    obtenir().records[idListe] = { total: r.total, first_try: r.first_try, after_retry: r.after_retry, date: r.date };
    return enregistrer();
  }

  function cleMot(idListe, mot) {
    return idListe + '/' + mot;
  }

  function infoMot(idListe, mot) {
    return obtenir().mots[cleMot(idListe, mot)] || null;
  }

  /* Met a jour la cote d'un mot et sauvegarde tout de suite. */
  function definirInfoMot(idListe, mot, info) {
    var mots = obtenir().mots;
    var cle = cleMot(idListe, mot);
    if (mots[cle] && mots[cle].cote > 0 && info.cote <= 0) obtenir().stats.maitrises += 1; /* mot maitrise */
    if (info.cote <= 0 && !info.derniereErreur) delete mots[cle];
    else mots[cle] = { cote: info.cote, derniereBaisse: info.derniereBaisse, derniereErreur: info.derniereErreur };
    return enregistrer();
  }

  /* Remplace toute la progression (recuperation d'un fichier deja verifie). */
  function remplacer(nouvelEtat) {
    etat = nettoyer(nouvelEtat);
    return enregistrer();
  }

  function basculerVoix() {
    var r = obtenir().reglages;
    r.voix = !r.voix;
    enregistrer();
    return r.voix;
  }

  /* Statistiques : un mot vient d'etre termine (resultat = 'but' | 'retour' | 'arret'). */
  function noterMot(idListe, mot, resultat, ms, jour) {
    var st = obtenir().stats;
    var cle = cleMot(idListe, mot);
    var m = st.mots[cle] || { tirs: 0, buts: 0, retours: 0, arrets: 0, ms: 0 };
    m.tirs += 1;
    if (resultat === 'but') m.buts += 1; else if (resultat === 'retour') m.retours += 1; else m.arrets += 1;
    m.ms += ms;
    st.mots[cle] = m;
    var j = st.jours[jour] || { ms: 0, mots: 0 };
    j.ms += ms;
    j.mots += 1;
    st.jours[jour] = j;
    return enregistrer();
  }

  /* Statistiques : un match vient de finir (ou d'etre abandonne). */
  function noterMatch(m) {
    var st = obtenir().stats;
    st.matchs.push(m);
    if (st.matchs.length > MAX_MATCHS) st.matchs = st.matchs.slice(-MAX_MATCHS);
    return enregistrer();
  }

  window.Stockage = {
    noterMot: noterMot,
    noterMatch: noterMatch,
    stats: function () { return obtenir().stats; },
    remplacer: remplacer,
    basculerVoix: basculerVoix,
    definirRecord: definirRecord,
    infoMot: infoMot,
    definirInfoMot: definirInfoMot,
    charger: charger,
    enregistrer: enregistrer,
    obtenir: obtenir,
    nettoyer: nettoyer,
    record: record,
    nombreMotsDifficiles: nombreMotsDifficiles,
    estPersistant: function () { return persistant; }
  };
})();
