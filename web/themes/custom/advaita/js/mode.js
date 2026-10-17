/**
 * @file
 * The admin header's light/dark switch. Sets data-ds-mode on <html>, which
 * the Design System API's token CSS already understands; without a choice the
 * OS setting applies.
 */
((Drupal, once) => {
  const KEY = 'advaita.mode';
  const root = document.documentElement;
  const stored = (() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  })();
  if (stored === 'dark' || stored === 'light') {
    root.setAttribute('data-ds-mode', stored);
  }

  const isDark = () => (root.getAttribute('data-ds-mode') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';

  Drupal.behaviors.advaitaMode = {
    attach(context) {
      once('advaita-mode', '[data-advaita-mode-toggle]', context).forEach((button) => {
        const label = button.querySelector('.mode-toggle__label');
        const sync = () => {
          button.setAttribute('aria-pressed', String(isDark()));
          label.textContent = isDark() ? Drupal.t('Light mode') : Drupal.t('Dark mode');
          button.title = label.textContent;
        };
        sync();
        button.addEventListener('click', () => {
          const next = isDark() ? 'light' : 'dark';
          root.setAttribute('data-ds-mode', next);
          try {
            localStorage.setItem(KEY, next);
          } catch {
            // Not stored: the choice lasts for this page only.
          }
          sync();
        });
      });
    },
  };
})(Drupal, once);
