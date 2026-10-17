/**
 * @file
 * Core's vertical tabs menu (built in JavaScript) as the list pattern.
 */
((Drupal, once) => {
  Drupal.behaviors.advaitaVerticalTabs = {
    attach(context) {
      once('advaita-vertical-tabs', '.vertical-tabs__menu', context).forEach((menu) => menu.classList.add('ds-list'));
    },
  };
})(Drupal, once);
