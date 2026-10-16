/**
 * @file
 * The dialog's close button with the contract's close icon.
 *
 * jQuery UI builds the button; its text ("Close") stays its accessible name.
 */
((Drupal) => {
  window.addEventListener('dialog:aftercreate', (event) => {
    const button = event.target
      .closest('.ui-dialog')
      ?.querySelector('.ui-dialog-titlebar-close');
    if (button && !button.querySelector('.ds-icon')) {
      button.insertAdjacentHTML('beforeend', Drupal.advaita.icon('close'));
    }
  });
})(Drupal);
