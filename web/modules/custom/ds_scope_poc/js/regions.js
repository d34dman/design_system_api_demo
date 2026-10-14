/**
 * @file
 * Region markers for markup that JavaScript adds after the page loads:
 * dialogs appended to <body>, contextual links, Layout Builder's parts.
 *
 * data-ds-system="X": this region belongs to design system X.
 * data-ds-boundary: this region keeps the system around it but is fenced off
 * from the theme (module UI in the site's values).
 */
((Drupal, drupalSettings) => {
  const mlAs = () => drupalSettings.dsScopePoc?.mediaLibraryAs ?? 'boundary';

  // Order matters: outer regions first.
  const RULES = [
    ['.ui-dialog.media-library-widget-modal', () => mlAs()],
    ['.ui-dialog-off-canvas', () => 'admin'],
    ['#layout-builder', () => 'admin'],
    // The layout inside each section is the site's: its blocks are page content.
    ['#layout-builder .layout-builder__section > .layout', () => 'site'],
    ['.layout-builder__add-block', () => 'admin'],
    ['.contextual', () => 'admin'],
    // Navigation and the top bar already carry core's own marker.
    ['[data-drupal-admin-styles]:not([data-drupal-admin-styles] *)', () => 'admin'],
  ];

  function mark(root) {
    RULES.forEach(([selector, as]) => {
      root.querySelectorAll(selector).forEach((el) => {
        if (el.hasAttribute('data-ds-system') || el.hasAttribute('data-ds-boundary')) {
          return;
        }
        const value = as();
        if (value === 'boundary') {
          el.setAttribute('data-ds-boundary', '');
        }
        else {
          el.setAttribute('data-ds-system', value);
        }
      });
    });
  }

  mark(document);
  new MutationObserver(() => mark(document)).observe(document.body, { childList: true, subtree: true });
})(Drupal, drupalSettings);
