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
  // Declared role => marker attributes, as the site maps them.
  const roles = drupalSettings.dsScopePoc?.roles ?? {};

  // Order matters: outer regions first.
  const RULES = [
    ['.ui-dialog-off-canvas', () => 'admin'],
    ['#layout-builder', () => 'admin'],
    // The layout inside each section is the site's: its blocks are page content.
    ['#layout-builder .layout-builder__section > .layout', () => 'site'],
    ['.layout-builder__add-block', () => 'admin'],
    ['.contextual', () => 'admin'],
    // Navigation and the top bar already carry core's own marker.
    ['[data-drupal-admin-styles]:not([data-drupal-admin-styles] *)', () => 'admin'],
    // Contrib and core editor UI on frontend pages, as a declared chrome or
    // app role would map it by default (tests/proof/contrib.mjs).
    ['.coffee-form-wrapper', () => 'admin'],
    ['.block-masquerade', () => 'admin'],
    ['.entity-moderation-form', () => 'admin'],
    ['.field--widget-paragraphs', () => 'admin'],
    ['.lp-builder', () => 'admin'],
  ];

  // A dialog takes the role its content declares: jQuery UI builds the
  // dialog's frame in the browser, so the server can't mark it.
  function markDialogs(root) {
    root.querySelectorAll('.ui-dialog').forEach((dialog) => {
      if (dialog.hasAttribute('data-ds-system') || dialog.hasAttribute('data-ds-boundary')) {
        return;
      }
      const declared = dialog.querySelector(':scope > .ui-dialog-content [data-ds-role]');
      const marker = declared && roles[declared.getAttribute('data-ds-role')];
      if (marker) {
        Object.entries(marker).forEach(([name, value]) => dialog.setAttribute(name, value));
      }
    });
  }

  function mark(root) {
    markDialogs(root);
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
