/**
 * @file
 * Contract icons for markup core builds in JavaScript.
 *
 * The page carries each icon once, rendered by the Design System API's icon
 * component into a <template data-advaita-icon> (advaita_preprocess_html()).
 * The markup fits any context: the component's CSS picks the icon of the skin
 * bound to the context it lands in, so a clone is right wherever it goes.
 */
((Drupal) => {
  Drupal.advaita = Drupal.advaita || {};

  /**
   * The markup of a contract icon, decorative ('' if the page has none).
   *
   * @param {string} name
   *   A contract icon name: chevron, close or drag.
   *
   * @return {string}
   *   The icon's <svg>.
   */
  Drupal.advaita.icon = (name) =>
    document
      .querySelector(`template[data-advaita-icon="${name}"]`)
      ?.innerHTML.trim() ?? '';
})(Drupal);
