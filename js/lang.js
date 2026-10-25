/* Nube Games - langue du site (25/10/2026) : l'anglais par défaut, le français seulement si le visiteur l'a choisi.
   Le choix est gardé dans le navigateur (ng-lang, partagé avec le jeu sous fof-lang). Les robots d'indexation ne sont
   pas redirigés, pour que les deux versions restent référencées. */
(function () {
  var s = document.currentScript, alt = s && s.getAttribute('data-alt'), ici = document.documentElement.lang, choix = null;
  try { choix = localStorage.getItem('ng-lang') || localStorage.getItem('fof-lang'); } catch (e) {}
  var robot = /bot|crawl|spider|slurp|lighthouse|preview/i.test(navigator.userAgent);
  if (alt && !robot && (choix || 'en') !== ici) location.replace(alt + location.hash);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-lang]'); if (!a) return;
    try { localStorage.setItem('ng-lang', a.getAttribute('data-lang')); localStorage.setItem('fof-lang', a.getAttribute('data-lang')); } catch (x) {}
  });
})();
