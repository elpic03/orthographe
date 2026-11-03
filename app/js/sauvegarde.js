/* Sauvegarder la progression dans un fichier, et la recuperer.
   Le fichier est verifie avant de remplacer quoi que ce soit. */
(function () {
  'use strict';

  var MARQUE = 'quiz-orthographe';
  var VERSION = 2; /* 2 = ajout des statistiques ; les fichiers version 1 restent acceptes */
  var TAILLE_MAX = 1024 * 1024; /* 1 Mo : une vraie sauvegarde fait quelques Ko */

  function resume(etat) {
    var records = Object.keys(etat.records).length;
    var difficiles = Object.keys(etat.mots).filter(function (k) { return etat.mots[k].cote > 0; }).length;
    return { records: records, difficiles: difficiles };
  }

  function texteResume(r) {
    return r.records + (r.records <= 1 ? ' record' : ' records') + ' et ' +
      r.difficiles + (r.difficiles <= 1 ? ' mot difficile' : ' mots difficiles');
  }

  /* ---------- Sauvegarder ---------- */
  function exporter() {
    var contenu = {
      app: MARQUE,
      version: VERSION,
      sauvegardeLe: Regles.horodatageLocal(),
      progression: Stockage.obtenir()
    };
    var blob = new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var lien = document.createElement('a');
    lien.href = url;
    lien.download = 'progression-quiz-orthographe-' + Regles.jourLocal() + '.json';
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    App.annoncer('Progression sauvegardée dans tes Téléchargements.');
  }

  /* ---------- Recuperer ---------- */
  function lireFichier(fichier) {
    return new Promise(function (resoudre, rejeter) {
      if (fichier.size > TAILLE_MAX) { rejeter(new Error('Ce fichier est trop gros pour être une sauvegarde du quiz.')); return; }
      var lecteur = new FileReader();
      lecteur.onload = function () { resoudre(String(lecteur.result)); };
      lecteur.onerror = function () { rejeter(new Error('Impossible de lire ce fichier.')); };
      lecteur.readAsText(fichier, 'utf-8');
    });
  }

  /* Retourne l'etat propre, ou lance une erreur avec un message clair. */
  function valider(texte) {
    var brut;
    try { brut = JSON.parse(texte); } catch (e) { throw new Error('Ce fichier n’est pas une sauvegarde du quiz.'); }
    if (!brut || brut.app !== MARQUE || typeof brut.progression !== 'object') {
      throw new Error('Ce fichier n’est pas une sauvegarde du quiz.');
    }
    if (typeof brut.version !== 'number' || brut.version > VERSION) {
      throw new Error('Cette sauvegarde vient d’une version plus récente du quiz.');
    }
    var propre = Stockage.nettoyer(brut.progression);
    var r = resume(propre);
    if (r.records === 0 && Object.keys(propre.mots).length === 0 && propre.stats.matchs.length === 0) {
      throw new Error('Ce fichier ne contient aucune progression.');
    }
    return { etat: propre, date: typeof brut.sauvegardeLe === 'string' ? brut.sauvegardeLe : null };
  }

  function dateLisible(iso) {
    if (!iso) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return null;
    var mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return parseInt(m[3], 10) + ' ' + mois[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }

  function confirmer(nouveau, date) {
    var el = App.el;
    var actuel = resume(Stockage.obtenir());
    var dialogue = el('dialog', { classe: 'dialogue', 'aria-labelledby': 'dialogue-titre' });
    function fermer() { dialogue.close(); dialogue.remove(); }
    dialogue.appendChild(el('div', { classe: 'dialogue-contenu' }, [
      el('h2', { id: 'dialogue-titre', texte: 'Récupérer cette progression ?' }),
      el('p', { texte: 'Le fichier' + (date ? ' du ' + dateLisible(date) : '') + ' contient ' + texteResume(resume(nouveau)) + '.' }),
      el('p', { classe: 'dialogue-attention', texte: 'Il va remplacer ta progression actuelle (' + texteResume(actuel) + ').' }),
      el('div', { classe: 'dialogue-boutons' }, [
        el('button', { type: 'button', classe: 'btn btn-grenat', onclick: function () {
          var ok = Stockage.remplacer(nouveau);
          fermer();
          Menu.afficher();
          App.annoncer(ok ? 'Progression récupérée !' : 'Progression récupérée pour cette session, mais pas gardée sur l’ordinateur.');
        } }, ['Remplacer']),
        el('button', { type: 'button', classe: 'btn btn-contour', onclick: function () { exporter(); } }, ['Sauvegarder l’actuelle d’abord']),
        el('button', { type: 'button', classe: 'btn btn-neutre', onclick: fermer }, ['Annuler'])
      ])
    ]));
    dialogue.addEventListener('cancel', function (e) { e.preventDefault(); fermer(); });
    document.body.appendChild(dialogue);
    dialogue.showModal();
  }

  function recuperer() {
    var champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = '.json,application/json';
    champ.addEventListener('change', function () {
      var fichier = champ.files && champ.files[0];
      if (!fichier) return;
      lireFichier(fichier)
        .then(function (texte) { var v = valider(texte); confirmer(v.etat, v.date); })
        .catch(function (e) { App.annoncer(e.message); });
    });
    champ.click();
  }

  window.Sauvegarde = { exporter: exporter, recuperer: recuperer, valider: valider };
})();
