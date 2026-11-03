/* Cas de test des regles du quiz. Utilises par tests.html (navigateur) et regles.test.js (Node). */
(function (racine) {
  'use strict';

  function lancer(R, verifier, extra) {
    var S = extra && extra.Stockage, V = extra && extra.Sauvegarde;

    // --- Verification des reponses ---
    verifier('Accents obligatoires : « activite » refusé', R.estAcceptee('activite', 'une activité'), false);
    verifier('Accents obligatoires : « une activite » refusé', R.estAcceptee('une activite', 'une activité'), false);
    verifier('Déterminant omis : « activité » accepté', R.estAcceptee('activité', 'une activité'), true);
    verifier('Majuscules ignorées : « ACTIVITÉ » accepté', R.estAcceptee('ACTIVITÉ', 'une activité'), true);
    verifier('Espaces en trop ignorés', R.estAcceptee('  une   activité ', 'une activité'), true);
    verifier('« adieux » accepté pour « des adieux »', R.estAcceptee('adieux', 'des adieux'), true);
    verifier('« adieu » refusé pour « des adieux »', R.estAcceptee('adieu', 'des adieux'), false);
    verifier('« des adieu » refusé', R.estAcceptee('des adieu', 'des adieux'), false);
    verifier('« desormais » refusé', R.estAcceptee('desormais', 'désormais'), false);
    verifier('« DÉSORMAIS » accepté', R.estAcceptee('DÉSORMAIS', 'désormais'), true);
    verifier('Réponse vide refusée', R.estAcceptee('   ', 'désormais'), false);
    verifier('« de » seul refusé pour « hors de »', R.estAcceptee('de', 'hors de'), false);
    verifier('« coup » seul refusé pour « tout à coup »', R.estAcceptee('coup', 'tout à coup'), false);
    verifier('« tout à coup » accepté', R.estAcceptee('tout à coup', 'tout à coup'), true);
    verifier('« pitié » accepté pour « la pitié »', R.estAcceptee('pitié', 'la pitié'), true);
    verifier('« eau » accepté pour « l\'eau »', R.estAcceptee('eau', 'l\'eau'), true);
    verifier('Apostrophe courbe acceptée', R.estAcceptee('l\u2019eau', 'l\'eau'), true);
    verifier('Variante : « traîner » accepté pour « trainer »', R.estAcceptee('traîner', 'trainer', ['traîner']), true);
    verifier('« trainer » accepté', R.estAcceptee('trainer', 'trainer', ['traîner']), true);
    verifier('« trainner » refusé', R.estAcceptee('trainner', 'trainer', ['traîner']), false);
    verifier('Sans variante écrite, « traîner » refusé', R.estAcceptee('traîner', 'trainer'), false);
    verifier('« oeil » accepté pour « un œil »', R.estAcceptee('oeil', 'un œil'), true);

    // --- Records ---
    function r(f, t) { return { first_try: f, total: t }; }
    verifier('Record : premier résultat = record', R.estMeilleur(r(0, 23), null), true);
    verifier('Record : meilleur ratio gagne', R.estMeilleur(r(19, 23), r(18, 23)), true);
    verifier('Record : moins bon ne remplace pas', R.estMeilleur(r(17, 23), r(18, 23)), false);
    verifier('Record : égalité, la plus longue liste gagne', R.estMeilleur(r(20, 40), r(10, 20)), true);
    verifier('Record : égalité, la plus courte perd', R.estMeilleur(r(10, 20), r(20, 40)), false);
    verifier('Record : résultat identique ne remplace pas', R.estMeilleur(r(18, 23), r(18, 23)), false);
    verifier('Record : total nul ne remplace pas', R.estMeilleur(r(0, 0), r(1, 23)), false);

    // --- Cote des mots difficiles (option C) ---
    var c = R.nouvelleCote(undefined, 'arret', '2026-11-01');
    verifier('Cote : arrêt = +3', c.cote, 3);
    c = R.nouvelleCote(c, 'but', '2026-11-01');
    verifier('Cote : but = -1', c.cote, 2);
    c = R.nouvelleCote(c, 'but', '2026-11-01');
    verifier('Cote : 2e but le même jour, pas de baisse', c.cote, 2);
    c = R.nouvelleCote(c, 'but', '2026-11-03');
    verifier('Cote : un autre jour, -1', c.cote, 1);
    c = R.nouvelleCote(c, 'retour', '2026-11-03');
    verifier('Cote : but sur retour = +1', c.cote, 2);
    verifier('Cote : jamais sous 0', R.nouvelleCote({ cote: 0, derniereBaisse: null, derniereErreur: null }, 'but', '2026-11-04').cote, 0);

    verifier('Mélange : tous les mots gardés', R.melanger([1, 2, 3, 4, 5]).slice().sort(), [1, 2, 3, 4, 5]);

    // --- Etoiles (50 / 75 / 95 %, arrondi a la baisse) ---
    verifier('Étoiles : 21/23 = 3 (95 % de 23 = 21,85 → 21)', R.etoiles(21, 23), 3);
    verifier('Étoiles : 20/23 = 2', R.etoiles(20, 23), 2);
    verifier('Étoiles : 17/23 = 2 (75 % = 17,25 → 17)', R.etoiles(17, 23), 2);
    verifier('Étoiles : 16/23 = 1', R.etoiles(16, 23), 1);
    verifier('Étoiles : 11/23 = 1 (50 % = 11,5 → 11)', R.etoiles(11, 23), 1);
    verifier('Étoiles : 10/23 = 0', R.etoiles(10, 23), 0);
    verifier('Étoiles : 7/8 = 3 (95 % de 8 = 7,6 → 7)', R.etoiles(7, 8), 3);
    verifier('Étoiles : 0/8 = 0', R.etoiles(0, 8), 0);
    verifier('Étoiles : 60/80 = 2 (75 % exactement)', R.etoiles(60, 80), 2);
    verifier('Ballon d\'or : 23/23', R.ballonDor(23, 23), true);
    verifier('Pas de ballon d\'or : 22/23', R.ballonDor(22, 23), false);

    // --- Temps actif d'un mot ---
    verifier('Temps : 8,4 s gardé', R.tempsPlafonne(8400), 8400);
    verifier('Temps : plafonné à 60 s', R.tempsPlafonne(300000), 60000);
    verifier('Temps : négatif ou invalide = 0', [R.tempsPlafonne(-5), R.tempsPlafonne(NaN)], [0, 0]);

    // --- Memoire abimee (navigateur seulement) ---
    if (S) {
      var propre = S.nettoyer({ records: { '7': { total: 23, first_try: 18, after_retry: 3, date: 'x' }, '8': { total: -1 } }, mots: { 'a/b': { cote: 2 }, 'c/d': { cote: 'x' } }, reglages: { voix: 'oui' } });
      verifier('Mémoire : record valide gardé', Object.keys(propre.records), ['7']);
      verifier('Mémoire : mot invalide ignoré', Object.keys(propre.mots), ['a/b']);
      verifier('Mémoire : réglage invalide remplacé par défaut', propre.reglages.voix, true);
      verifier('Mémoire : contenu illisible = progression vide', JSON.stringify(S.nettoyer('n\'importe quoi').records), '{}');
      var bonMatch = { mode: 'bloc', bloc: '7', date: '2026-11-01T10:00:00', duree: 300, total: 23, first_try: 20, after_retry: 2, arrets: 1, serie: 12, abandonne: false };
      var st = S.nettoyer({ stats: {
        matchs: [bonMatch, { mode: 'bloc', bloc: '7', date: 'x', duree: -1, total: 1, first_try: 0, after_retry: 0, arrets: 0, serie: 0, abandonne: false },
                 Object.assign({}, bonMatch, { first_try: 30 })],
        jours: { '2026-11-01': { ms: 300000, mots: 23 }, 'hier': { ms: 5000, mots: 1 } },
        mots: { '7/avant': { tirs: 3, buts: 2, retours: 0, arrets: 1, ms: 15000 }, '7/si': { tirs: 1, buts: 5, retours: 0, arrets: 0, ms: 1 } },
        maitrises: 4 } }).stats;
      verifier('Stats : seul le match valide est gardé', st.matchs.length, 1);
      verifier('Stats : jour mal écrit ignoré', Object.keys(st.jours), ['2026-11-01']);
      verifier('Stats : mot incohérent ignoré', Object.keys(st.mots), ['7/avant']);
      verifier('Stats : mots maîtrisés gardés', st.maitrises, 4);
      var beaucoup = []; for (var i = 0; i < 2100; i++) beaucoup.push(bonMatch);
      verifier('Stats : au plus 2000 matchs gardés', S.nettoyer({ stats: { matchs: beaucoup } }).stats.matchs.length, 2000);
      verifier('Stats : sauvegarde sans stats (version 1) = stats vides', S.nettoyer({ records: {} }).stats.matchs.length, 0);
    }
    if (V) {
      function erreurDe(texte) { try { V.valider(texte); return 'accepté'; } catch (e) { return e.message; } }
      verifier('Récupération : pas du JSON refusé', erreurDe('bonjour'), 'Ce fichier n\u2019est pas une sauvegarde du quiz.');
      verifier('Récupération : autre app refusée', erreurDe('{"app":"x","version":1,"progression":{}}'), 'Ce fichier n\u2019est pas une sauvegarde du quiz.');
      verifier('Récupération : version future refusée', erreurDe('{"app":"quiz-orthographe","version":9,"progression":{}}'), 'Cette sauvegarde vient d\u2019une version plus récente du quiz.');
      verifier('Récupération : fichier version 1 accepté', erreurDe('{"app":"quiz-orthographe","version":1,"progression":{"records":{"7":{"total":23,"first_try":1,"after_retry":0,"date":"2026"}}}}'), 'accepté');
      verifier('Récupération : fichier valide accepté', erreurDe('{"app":"quiz-orthographe","version":1,"progression":{"records":{"7":{"total":23,"first_try":1,"after_retry":0,"date":"2026"}}}}'), 'accepté');
    }
  }

  racine.CasDeTest = lancer;
  if (typeof module !== 'undefined' && module.exports) module.exports = lancer;
})(typeof window !== 'undefined' ? window : globalThis);
