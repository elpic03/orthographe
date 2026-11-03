// Tests des regles avec Node (optionnel). Lancer : node app/tests/regles.test.js
// Sans Node : ouvrir app/tests/tests.html dans le navigateur.
const R = require('../js/regles.js');
const lancer = require('./cas.js');
let ok = 0, echec = 0;
lancer(R, function (nom, obtenu, attendu) {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) ok++;
  else { echec++; console.log('ECHEC : ' + nom + ' -> obtenu ' + JSON.stringify(obtenu) + ', attendu ' + JSON.stringify(attendu)); }
});
console.log(`${ok} tests réussis, ${echec} échec(s).`);
process.exit(echec ? 1 : 0);
