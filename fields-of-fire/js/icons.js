/* Fields of Fire — jeu d'icônes dessinées (style médiéval), pour remplacer les émojis.
   FOF.ic('nom', taille) renvoie un SVG inline qui prend la couleur du texte (currentColor). */
(function (FOF) {
  'use strict';
  var P = {
    // déplacement : empreinte de botte
    move: '<path d="M9 3.5c2.2 0 3.4 1.2 3.4 3.2 0 1.7-.6 3-.6 4.3 0 1 .5 1.6.5 2.6 0 1.4-1.2 2.3-3.1 2.3S6 15 6 13.5c0-1.2.5-1.8.5-2.8C6.5 9.4 5.8 8.2 5.8 6.6 5.8 4.7 6.9 3.5 9 3.5Z"/><path d="M6.6 17.2c1.7.7 3.4.7 5.1 0 .5.7.8 1.4.8 2.1 0 1.4-1.3 2.2-3.3 2.2S5.8 20.7 5.8 19.3c0-.7.3-1.4.8-2.1Z"/><path d="M16.5 8.2c1.3 0 2 .8 2 2 0 .9-.4 1.6-.4 2.3 0 .6.3.9.3 1.5 0 .9-.7 1.4-1.9 1.4s-1.9-.5-1.9-1.4c0-.6.3-.9.3-1.5 0-.7-.4-1.4-.4-2.3 0-1.2.7-2 2-2Z"/><path d="M15 16.7c1 .4 2 .4 3 0 .3.4.5.9.5 1.3 0 .9-.8 1.4-2 1.4s-2-.5-2-1.4c0-.4.2-.9.5-1.3Z"/>',
    // conquête : bannière plantée
    banner: '<path d="M6 2.2v19.6" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/><path d="M7.4 3.4c3-1.5 5.4.9 8.3-.4l1.6-.7v8.9l-1.9.8c-2.7 1.1-5-1-7.6.3-.2.1-.4.1-.4.1Z"/><path d="M4.2 21.6h4.4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/>',
    // attaque : épées croisées
    swords: '<path d="m3.2 3.1 2.4-.1 9.2 9.4-2.3 2.3L3.2 5.5Z"/><path d="m20.8 3.1-2.4-.1-9.2 9.4 2.3 2.3 9.3-9.2Z"/><path d="M4.4 16.1 7 13.5l3.1 3-2.6 2.6a1.2 1.2 0 0 1-1.7 0l-1.4-1.4a1.2 1.2 0 0 1 0-1.6Z"/><path d="m19.6 16.1-2.6-2.6-3.1 3 2.6 2.6c.5.5 1.2.5 1.7 0l1.4-1.4c.5-.4.5-1.1 0-1.6Z"/>',
    // fermer : croix
    close: '<path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>',
    shield: '<path d="M12 2.4 20.4 5v6.4c0 4.6-3.3 8.4-8.4 10.2C6.9 19.8 3.6 16 3.6 11.4V5Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 6.2 17 8v3.4c0 2.9-2 5.3-5 6.6-3-1.3-5-3.7-5-6.6V8Z"/>',
    crown: '<path d="M3 17.6h18l1.1-11-5.2 3.9L12 3.2 7.1 10.5 1.9 6.6Z"/><path d="M3.4 19.6h17.2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
    castle: '<path d="M2.6 21.4V8.2h2.8V5.4h2.8v2.8h2.4V5.4h2.8v2.8h2.4V5.4h2.8v2.8h2.8v13.2Z"/><path d="M9.6 21.4v-5.2a2.4 2.4 0 0 1 4.8 0v5.2Z" fill="#1c1b1f"/>',
    hammer: '<path d="m13.6 7.4 3-3 1.2 1.2 2.6-2.6-4-4-2.6 2.6 1.2 1.2-3 3Z" transform="translate(0 2)"/><path d="m11.2 10.6 2.2 2.2-7.6 7.6a1.6 1.6 0 0 1-2.2-2.2Z"/><path d="M9.6 6.6 15 12l-2 2-5.4-5.4Z"/>',
    scroll: '<path d="M5.4 3.2h11.2c1.1 0 2 .9 2 2v13.6c0 1.1-.9 2-2 2H5.4c-1.1 0-2-.9-2-2V5.2c0-1.1.9-2 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 7.4h8M7 11h8M7 14.6h5.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/><path d="M18.6 6.4h2a1.8 1.8 0 0 1 0 3.6h-2Z"/>',
    book: '<path d="M3.4 4.2c2.6-1.4 5.4-1.4 8.6.6v15c-3.2-2-6-2-8.6-.6Z"/><path d="M20.6 4.2c-2.6-1.4-5.4-1.4-8.6.6v15c3.2-2 6-2 8.6-.6Z" opacity=".75"/>',
    cards: '<rect x="3" y="6.2" width="11" height="14.4" rx="1.6" transform="rotate(-9 8.5 13.4)"/><rect x="10.4" y="4.4" width="11" height="14.4" rx="1.6" transform="rotate(9 15.9 11.6)" opacity=".8"/>',
    coins: '<ellipse cx="12" cy="6.4" rx="8" ry="3.4"/><path d="M4 9.6c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4v3.2c0 1.9-3.6 3.4-8 3.4s-8-1.5-8-3.4Z"/><path d="M4 15.4c0 1.9 3.6 3.4 8 3.4s8-1.5 8-3.4v2.8c0 1.9-3.6 3.4-8 3.4s-8-1.5-8-3.4Z" opacity=".8"/>',
    // diplomatie : rameau d'olivier
    branch: '<path d="M4 20.4C6.8 12 11.4 6.4 20 3.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8.6 14.2c-1.8.3-3.4-.5-4-2 1.7-.9 3.5-.6 4.6.7Zm3.2-4c-1.5-.9-2.3-2.5-1.9-4 1.8.5 2.8 1.9 2.7 3.5Zm1 3.2c.3-1.8 1.6-3 3.3-3.2.2 1.8-.8 3.3-2.4 3.9Zm3.6-5.2c-1.2-1.3-1.4-3.1-.5-4.4 1.4 1.1 1.8 2.8 1.2 4.3Z"/>',
    // pacte rompu : bouclier fendu
    broken: '<path d="M12 2.4 20.4 5v6.4c0 4.6-3.3 8.4-8.4 10.2C6.9 19.8 3.6 16 3.6 11.4V5Z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m12 4.6-1.6 5.2 2.6 1.6-2.4 5.6" fill="none" stroke="currentColor" stroke-width="1.8"/>',
    flame: '<path d="M12 2.2c3.6 3.6 6.8 6 6.8 10.4A6.8 6.8 0 0 1 12 21.8a6.8 6.8 0 0 1-6.8-9.2c.7 1.2 1.6 2 2.8 2.2-.4-4 2-6.6 4-12.6Z"/>',
    skull: '<path d="M12 2.4c5 0 8.4 3.3 8.4 7.9 0 2.8-1.2 4.4-2.6 5.5-.7.6-.9 1-.9 2v1.4c0 1.4-1 2.4-2.5 2.4h-4.8c-1.5 0-2.5-1-2.5-2.4v-1.4c0-1-.2-1.4-.9-2-1.4-1.1-2.6-2.7-2.6-5.5 0-4.6 3.4-7.9 8.4-7.9Z"/><circle cx="8.8" cy="11" r="2.1" fill="#16151a"/><circle cx="15.2" cy="11" r="2.1" fill="#16151a"/>',
    warn: '<path d="M12 2.8 22.4 21H1.6Z"/><path d="M12 9.2v5.6M12 17.4v1.4" stroke="#16151a" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
    star: '<path d="m12 2.4 2.7 6.3 6.8.6-5.2 4.5 1.6 6.6L12 16.9 6.1 20.4l1.6-6.6-5.2-4.5 6.8-.6Z"/>',
    dice: '<rect x="3.2" y="3.2" width="17.6" height="17.6" rx="3.4" fill="none" stroke="currentColor" stroke-width="1.9"/><circle cx="8.2" cy="8.2" r="1.8"/><circle cx="15.8" cy="8.2" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="8.2" cy="15.8" r="1.8"/><circle cx="15.8" cy="15.8" r="1.8"/>',
    market: '<path d="M2.6 6.4h3l2.2 9.4h9.8l2-7H6.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9" cy="19.4" r="1.8"/><circle cx="16.6" cy="19.4" r="1.8"/>',
    chat: '<path d="M4 3.4h16a2 2 0 0 1 2 2v9.2a2 2 0 0 1-2 2H9.4l-5 4.2v-4.2H4a2 2 0 0 1-2-2V5.4a2 2 0 0 1 2-2Z"/>',
    bug: '<path d="M12 5.2a4.4 4.4 0 0 1 4.4 4.4v3.6a4.4 4.4 0 0 1-8.8 0V9.6A4.4 4.4 0 0 1 12 5.2Z"/><path d="M9 5.4 7.4 3.2M15 5.4l1.6-2.2M7.6 9.6H3.4M16.4 9.6h4.2M7.6 13.4H3.8M16.4 13.4h3.8M8.4 17l-2.8 2.6M15.6 17l2.8 2.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
    spark: '<path d="m12 2.6 1.9 5.9 5.9 1.9-5.9 1.9L12 18.2l-1.9-5.9-5.9-1.9 5.9-1.9Z"/><path d="m19 15.4.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9Z" opacity=".8"/>',
    note: '<path d="M9 17.4V5.6l10-2.2v11.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><ellipse cx="6.4" cy="17.8" rx="3.4" ry="2.8"/><ellipse cx="16.4" cy="15.2" rx="3.4" ry="2.8"/>',
    mute: '<path d="M4 9h3.6L12 5v14l-4.4-4H4Z"/><path d="m15.4 9.4 5.2 5.2M20.6 9.4l-5.2 5.2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
    bell: '<path d="M12 2.6c3.4 0 5.6 2.4 5.6 5.8 0 4.4 1.2 5.6 2.4 7.2H4c1.2-1.6 2.4-2.8 2.4-7.2 0-3.4 2.2-5.8 5.6-5.8Z"/><path d="M9.6 18.2h4.8a2.4 2.4 0 0 1-4.8 0Z"/>',
    bellOff: '<path d="M12 2.6c3.4 0 5.6 2.4 5.6 5.8 0 4.4 1.2 5.6 2.4 7.2H4c1.2-1.6 2.4-2.8 2.4-7.2 0-3.4 2.2-5.8 5.6-5.8Z" opacity=".45"/><path d="M9.6 18.2h4.8a2.4 2.4 0 0 1-4.8 0Z" opacity=".45"/><path d="M3.4 3.4 20.6 20.6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
    skip: '<path d="M4.4 4.6 14 12l-9.6 7.4Z"/><path d="M15.6 4.6h3.8v14.8h-3.8Z"/>',
    // humain / ordinateur
    person: '<circle cx="12" cy="7.4" r="4"/><path d="M3.6 21.4c0-4.4 3.8-7.2 8.4-7.2s8.4 2.8 8.4 7.2Z"/>',
    helm: '<path d="M12 2.6c4.6 0 7.6 3 7.6 7.6v3.4c0 4.4-3 7.8-7.6 7.8s-7.6-3.4-7.6-7.8V10.2C4.4 5.6 7.4 2.6 12 2.6Z"/><path d="M4.6 10.8h14.8M11 10.8v9.6" stroke="#16151a" stroke-width="1.9" fill="none"/><path d="M13.2 10.8v9.6" stroke="#16151a" stroke-width="1.9" fill="none"/>',
    // aménagements / autres
    tent: '<path d="M12 3 22 20.4H2Z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 8.6 16.6 20.4H7.4Z"/>',
    gear: '<path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Zm9.2 5.2-2.1-.4a7.4 7.4 0 0 0-.7-1.7l1.2-1.8-2.3-2.3-1.8 1.2c-.5-.3-1.1-.6-1.7-.7l-.4-2.1h-3.2l-.4 2.1c-.6.1-1.2.4-1.7.7L6.3 7.4 4 9.7l1.2 1.8c-.3.5-.6 1.1-.7 1.7l-2.1.4v3.2l2.1.4c.1.6.4 1.2.7 1.7L4 20.7l2.3 2.3 1.8-1.2c.5.3 1.1.6 1.7.7l.4 2.1h3.2l.4-2.1c.6-.1 1.2-.4 1.7-.7l1.8 1.2 2.3-2.3-1.2-1.8c.3-.5.6-1.1.7-1.7l2.1-.4Z" transform="translate(0 -2.4) scale(1)"/>',
    eye: '<path d="M12 4.6c5.2 0 9.2 3.4 10.6 7.4-1.4 4-5.4 7.4-10.6 7.4S2.8 16 1.4 12C2.8 8 6.8 4.6 12 4.6Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.4"/>',
    check: '<path d="m4.6 12.6 4.8 4.8 10-11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
    arrow: '<path d="M3.6 12h15.2M13 6.2 19.4 12 13 17.8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>'
  };
  FOF.ic = function (name, size, cls) {
    var d = P[name]; if (!d) return '';
    var s = size || 18;
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false" fill="currentColor">' + d + '</svg>';
  };
  FOF.hasIcon = function (n) { return !!P[n]; };
})(window.FOF = window.FOF || {});
/* remplit les <span data-ic="nom"> et boutons [data-ic] du HTML statique */
(function (FOF) {
  function fill(root) {
    (root || document).querySelectorAll('[data-ic]').forEach(function (el) {
      var n = el.dataset.ic; if (!n || el.dataset.icDone === '1') return;
      el.insertAdjacentHTML('afterbegin', FOF.ic(n, +(el.dataset.icSize || 17)));
      el.dataset.icDone = '1';
    });
  }
  FOF.fillIcons = fill;
  document.addEventListener('DOMContentLoaded', function () { fill(document); });
})(window.FOF = window.FOF || {});
