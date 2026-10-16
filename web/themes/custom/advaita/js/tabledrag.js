/**
 * @file
 * The tabledrag handle with the contract's drag icon.
 */
((Drupal) => {
  Drupal.theme.tableDragHandle = (dragOrientation = 'drag') => {
    const title =
      dragOrientation === 'drag-y'
        ? Drupal.t('Change order')
        : Drupal.t('Move in any direction');
    return `<a href="#" title="${title}" class="tabledrag-handle"><span class="handle">${Drupal.advaita.icon('drag')}</span></a>`;
  };
})(Drupal);
