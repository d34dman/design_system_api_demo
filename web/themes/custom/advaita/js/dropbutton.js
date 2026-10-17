/**
 * @file
 * The dropbutton toggle with the contract's chevron icon, and the secondary
 * actions gathered into one list so they open as a menu.
 */
((Drupal, once) => {
  Drupal.theme.dropbuttonToggle = (options) =>
    `<li class="dropbutton-toggle"><button type="button">${Drupal.advaita.icon('chevron')}<span class="visually-hidden">${options.title}</span></button></li>`;

  // Core's dropbutton.js (attached first) marks the secondary actions; they
  // stay in the button's list, so they move into a nested one: the menu.
  Drupal.behaviors.advaitaDropbutton = {
    attach(context) {
      once('advaita-dropbutton', '.dropbutton-multiple', context).forEach((wrapper) => {
        const list = wrapper.querySelector('.dropbutton');
        const items = list.querySelectorAll(':scope > .secondary-action');
        const menu = document.createElement('li');
        menu.className = 'dropbutton-menu';
        const inner = document.createElement('ul');
        inner.className = 'dropbutton-menu__list';
        inner.append(...items);
        menu.append(inner);
        list.append(menu);
      });
    },
  };
})(Drupal, once);
