/**
 * @file
 * The dropbutton as a split button of the button pattern: its action and
 * the toggle (with the contract's chevron) are both .ds-button, joined in
 * dropbutton.css. The secondary actions are gathered into one list so they
 * open as the menu pattern.
 *
 * Demo only: it rebuilds core's dropbutton markup in the browser, which a
 * module can't rely on (the markup is core's to change). A menu-button
 * pattern belongs in the module once core's dropbutton can render it
 * (backlog B34); until then Advaita keeps this.
 */
((Drupal, once) => {
  const DELETE = 'a[href*="/delete"], [data-drupal-selector$="-delete"], .button--danger';

  // A row's operations in the grey surface look; the actions of a form
  // ("Save" with more) solid, as the form's main action; a button whose
  // own action deletes (Files: "Delete" alone) in the danger look.
  const looks = (wrapper, action) => {
    if (action?.matches(DELETE)) {
      return ['ds-button', 'ds-button--danger'];
    }
    return wrapper.matches('.dropbutton--primary') || wrapper.closest('.form-actions')
      ? ['ds-button', 'ds-button--primary']
      : ['ds-button', 'ds-button--neutral'];
  };

  Drupal.theme.dropbuttonToggle = (options) =>
    `<li class="dropbutton-toggle"><button type="button" class="ds-button">${Drupal.advaita.icon('chevron')}<span class="visually-hidden">${options.title}</span></button></li>`;

  Drupal.behaviors.advaitaDropbutton = {
    attach(context) {
      once('advaita-dropbutton', '.dropbutton-wrapper', context).forEach((wrapper) => {
        const list = wrapper.querySelector('.dropbutton');
        if (!list) {
          return;
        }
        const classes = looks(wrapper, list.querySelector(':scope > li:first-child > :is(a, input, button)'));
        list
          .querySelectorAll(':scope > .dropbutton-action:not(.secondary-action) > :is(a, input, button), :scope > .dropbutton-toggle > button')
          .forEach((control) => control.classList.add(...classes));

        // Core's dropbutton.js (attached first) marks the secondary actions;
        // they stay in the button's list, so they move into a nested one:
        // the menu. Its items are the menu's, not buttons.
        const items = list.querySelectorAll(':scope > .secondary-action');
        if (!items.length) {
          return;
        }
        items.forEach((item) => {
          const control = item.querySelector(':scope > :is(a, input, button)');
          if (!control) {
            return;
          }
          [...control.classList].filter((name) => name.startsWith('ds-button')).forEach((name) => control.classList.remove(name));
          if (control.matches(DELETE)) {
            control.classList.add('ds-menu__item--danger');
          }
        });
        const menu = document.createElement('li');
        menu.className = 'dropbutton-menu';
        const inner = document.createElement('ul');
        inner.className = 'dropbutton-menu__list ds-menu';
        inner.append(...items);
        menu.append(inner);
        list.append(menu);
      });
    },
  };
})(Drupal, once);
