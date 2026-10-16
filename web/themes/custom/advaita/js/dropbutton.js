/**
 * @file
 * The dropbutton toggle with the contract's chevron icon.
 */
((Drupal) => {
  Drupal.theme.dropbuttonToggle = (options) =>
    `<li class="dropbutton-toggle"><button type="button">${Drupal.advaita.icon('chevron')}<span class="visually-hidden">${options.title}</span></button></li>`;
})(Drupal);
