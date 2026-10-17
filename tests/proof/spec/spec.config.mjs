/**
 * What the design probe compares (probe.mjs).
 *
 * COMPONENTS: one entry per Radix sample in radix-reference.html (its
 * data-spec id). `variants` are further Drupal elements measured against the
 * same sample (data-spec="id@variant"). `drupal` overrides where an element
 * lives when it isn't on the spec sheet: a path, a selector, an action that
 * opens it. `states` adds hover or focus measurements. `ignore` skips
 * properties that don't apply.
 *
 * DEPARTURES: differences that are decided, keyed "<id>[:state].<prop>" or
 * "*.<prop>", each with its reason. Anything else that differs fails.
 */

export const SHEET = '/admin/advaita/spec';

const openMediaLibrary = async (page) => {
  await page.locator('.js-media-library-open-button').first().click();
  await page.waitForSelector('.media-library-widget-modal .js-media-library-item', { timeout: 20000 });
  await page.waitForTimeout(400);
};

const openRowMenu = async (page) => {
  await page.locator('.dropbutton-toggle button').first().click();
  await page.waitForTimeout(150);
};

export const COMPONENTS = [
  // Buttons.
  { id: 'button-solid', label: 'Button, solid (main submit)', states: ['hover', 'focus'], variants: ['actions'] },
  { id: 'button-surface', label: 'Button, surface (default)', states: ['hover', 'focus'], variants: ['link'] },
  { id: 'button-soft', label: 'Button, soft', states: ['hover'] },
  { id: 'button-neutral', label: 'Button, surface gray (neutral)', states: ['hover', 'focus'] },
  { id: 'button-ghost', label: 'Button, ghost gray', states: ['hover', 'focus'] },
  { id: 'button-danger', label: 'Button, danger (soft red)', states: ['hover'], variants: ['link'] },
  { id: 'button-danger-solid', label: 'Button, danger solid', states: ['hover'] },
  { id: 'button-disabled', label: 'Button, disabled' },
  { id: 'button-small', label: 'Button, size 1' },
  { id: 'button-small-neutral', label: 'Button, size 1 gray (row operations)' },
  {
    id: 'icon-button-ghost', label: 'Icon button, ghost (mode toggle)', ignore: ['fontSize', 'fontWeight', 'fontFamily'],
    drupal: { 'icon-button-ghost': { path: '/admin/content', selector: '.mode-toggle' } },
  },
  // Fields.
  { id: 'textfield', label: 'Text field', states: ['hover', 'focus'], variants: ['email', 'file'] },
  { id: 'textfield-placeholder', label: 'Text field, placeholder', ignore: ['color'] },
  { id: 'textfield-disabled', label: 'Text field, disabled' },
  { id: 'select', label: 'Select', states: ['hover', 'focus'] },
  { id: 'textarea', label: 'Text area', ignore: ['height'] },
  {
    id: 'label', label: 'Field label', ignore: ['height', 'paddingInline', 'radius', 'fill', 'edge', 'elevated'],
    drupal: { label: { selector: '.form-item-text label' } },
  },
  {
    id: 'description', label: 'Field description', ignore: ['height', 'paddingInline', 'radius', 'fill', 'edge', 'elevated'],
    drupal: { description: { selector: '.form-item-text .description' } },
  },
  // Choices.
  ...['checkbox', 'checkbox-checked', 'checkbox-disabled', 'radio', 'radio-checked'].map((id) => ({
    id, label: id.replace('-', ', '), radixBox: { edge: '::before' }, ignore: ['paddingInline', 'fontSize', 'fontWeight', 'fontFamily', 'color'],
  })),
  // Navigation.
  {
    id: 'tab-active', label: 'Page tab, current',
    drupal: { 'tab-active': { path: '/admin/content/moderated', selector: 'ul.ds-tabs:not(.ds-tabs--small) a.is-active' } },
  },
  {
    id: 'tab', label: 'Page tab', states: ['hover'],
    drupal: { tab: { path: '/admin/content/moderated', selector: '.ds-tabs:not(.ds-tabs--small) li:not(.is-active) > a' } },
  },
  {
    id: 'tab-small-active', label: 'Secondary tab, current',
    drupal: { 'tab-small-active': { path: '/admin/content/moderated', selector: 'ul.ds-tabs--small a.is-active' } },
  },
  {
    id: 'tab-small', label: 'Secondary tab',
    drupal: { 'tab-small': { path: '/admin/content/moderated', selector: '.ds-tabs--small li:not(.is-active) > a' } },
  },
  {
    id: 'segmented', label: 'Segmented control (Media Library: Grid / Table)', ignore: ['paddingInline', 'fontSize', 'fontWeight', 'fontFamily', 'color'],
    drupal: { segmented: { path: '/node/1/edit', act: openMediaLibrary, selector: '.media-library-widget-modal .ds-segmented' } },
  },
  {
    id: 'segmented-active', label: 'Segmented control, current',
    radix: '.rt-SegmentedControlIndicator', radixBox: { fill: '::before', edge: '::before' },
    ignore: ['paddingInline', 'color', 'fontSize', 'fontWeight', 'fontFamily'],
    drupal: { 'segmented-active': { path: '/node/1/edit', act: openMediaLibrary, selector: '.media-library-widget-modal .ds-segmented :is(a, button):is(.is-active, .active, [aria-current])' } },
  },
  // Menu (a row's operations).
  {
    id: 'menu', label: 'Dropdown menu', ignore: ['fontSize', 'fontWeight', 'fontFamily', 'color', 'height', 'paddingInline'],
    drupal: { menu: { path: '/admin/content', act: openRowMenu, selector: '.dropbutton-wrapper.open .ds-menu, .dropbutton-wrapper [aria-expanded="true"] ~ * .ds-menu, .ds-menu:visible' } },
  },
  {
    id: 'menu-item', label: 'Menu item',
    drupal: { 'menu-item': { path: '/admin/content', act: openRowMenu, selector: '.ds-menu:visible li:last-child > a' } },
  },
  {
    id: 'menu-item-highlighted', label: 'Menu item, highlighted (Drupal: hovered)',
    drupal: { 'menu-item-highlighted': { path: '/admin/content', act: openRowMenu, state: 'hover', selector: '.ds-menu:visible li:first-child > a' } },
  },
  {
    id: 'menu-item-danger', label: 'Menu item, danger',
    drupal: { 'menu-item-danger': { path: '/admin/content', act: openRowMenu, selector: '.ds-menu:visible a.ds-menu__item--danger' } },
  },
  {
    id: 'menu-item-danger-highlighted', label: 'Menu item, danger, highlighted (Drupal: hovered)',
    drupal: { 'menu-item-danger-highlighted': { path: '/admin/content', act: openRowMenu, state: 'hover', selector: '.ds-menu:visible a.ds-menu__item--danger' } },
  },
  // Table.
  { id: 'table-header', label: 'Table header cell', ignore: ['radius', 'elevated'] },
  { id: 'table-cell', label: 'Table cell', ignore: ['radius', 'elevated'] },
  // Feedback and containers.
  {
    id: 'callout-status', label: 'Message, status',
    drupal: { 'callout-status': { selector: '[data-drupal-messages] .message--status' } },
  },
  {
    id: 'callout-error', label: 'Message, error',
    drupal: { 'callout-error': { selector: '[data-drupal-messages] .message--error' } },
  },
  {
    id: 'callout-warning', label: 'Message, warning',
    drupal: { 'callout-warning': { selector: '[data-drupal-messages] .message--warning' } },
  },
  {
    id: 'badge-success', label: 'Badge, success',
    drupal: { 'badge-success': { path: '/admin/dashboard', selector: '.badge--success' } },
  },
  {
    id: 'badge-warning', label: 'Badge, warning',
    drupal: { 'badge-warning': { path: '/admin/dashboard', selector: '.badge--warning' } },
  },
  { id: 'card', noBase: true, label: 'Card (details, fieldset)', radixBox: { fill: '::before', edge: '::after' }, ignore: ['height', 'paddingInline', 'fontSize', 'fontWeight', 'fontFamily', 'color'], variants: ['details', 'fieldset'] },
  {
    id: 'dialog', label: 'Dialog', ignore: ['height', 'fontSize', 'fontWeight', 'color', 'fontFamily'],
    drupal: {
      dialog: {
        path: '/admin/content',
        act: async (page) => {
          await openRowMenu(page);
          await page.locator('.ds-menu:visible a[href*="/delete"]').first().click();
          await page.waitForSelector('.ui-dialog', { timeout: 15000 });
          await page.waitForTimeout(400);
        },
        selector: '.ui-dialog',
      },
    },
  },
];

// The entries without a Drupal element of their own (not on the sheet).
for (const c of COMPONENTS) {
  c.drupal ??= {};
}

export const DEPARTURES = {
  // Solid buttons are Radix's: white on blue-9, a contrast departure the
  // skin declares (D28), not one of this probe's.
  // Red-9 (#e5484d) takes white at 3.9:1: the contract's error colour holds 4.5:1.
  'button-danger-solid.fill': 'contrast: white on red-9 is 3.9:1; status.error',
  'button-danger-solid:hover.fill': 'contrast: white on red-10 is 3.6:1; status.error',
  'button-danger-solid.color': 'contrast: dark text on the light error red in dark mode',
  'button-danger-solid:hover.color': 'contrast: dark text on the light error red in dark mode',
  // Pointed at, a field shows the 3:1 edge (D26); Radix's TextField has no
  // hover edge and its Select darkens to gray-a8.
  'textfield:hover.edge': 'pointed at, the 3:1 edge (D26)',
  'select:hover.edge': 'pointed at, the 3:1 edge (D26)',
  // The focus ring is blue-9: Radix's focus-8 (blue-8) is 2.3:1 on the page.
  '*:focus.outline': 'focus colour blue-9: blue-8 is 2.3:1 (Canvas UI skin)',
  // Checkboxes and radios keep a 3:1 edge (a11y/field-edge); Radix's and
  // Canvas's is gray-a7, 1.6:1. Checked, the edge is the fill's colour.
  'checkbox.edge': 'a 3:1 edge (a11y/field-edge); Radix gray-a7 is 1.6:1',
  'checkbox-disabled.edge': 'disabled edge border.soft',
  'radio.edge': 'a 3:1 edge (a11y/field-edge); Radix gray-a7 is 1.6:1',
  'checkbox-checked.edge': 'an edge in the fill colour (forced colours keep it)',
  'radio-checked.edge': 'an edge in the fill colour (forced colours keep it)',
  // Shibin, round 2: no solid blue highlight in menus; the soft variant.
  'menu-item-highlighted.fill': 'soft highlight (Shibin: no dark blue on hover)',
  'menu-item-highlighted.color': 'soft highlight (Shibin: no dark blue on hover)',
  'menu-item-danger-highlighted.fill': 'soft highlight, red tint',
  'menu-item-danger-highlighted.color': 'soft highlight, red text',
  // Green and amber text are a shade darker than Radix's step 11, which is
  // 4.2:1 on its own tint (Canvas UI skin).
  'callout-status.color': 'contrast: green-11 is 4.2:1 on green-a3',
  'callout-warning.color': 'contrast: amber-11 is 4.25:1 on amber-a3',
  'badge-success.color': 'contrast: green-11 is 4.2:1 on green-a3',
  'badge-warning.color': 'contrast: amber-11 is 4.25:1 on amber-a3',
  // Pointed at, red text keeps the error colour (Radix's red-a11 shifts
  // over its tint), and the tint is a mix of the error colour, not red-a4.
  'button-danger:hover.color': 'the error colour on hover',
  'button-danger:hover.fill': 'hover tint mixed from status.error (Radix red-a4)',
  'button-soft:hover.fill': 'hover tint mixed from the accent (Radix accent-a4)',
  // Disabled text is fg.disabled (gray-8); Radix's is gray-a8 over its fill.
  'button-disabled.color': 'fg.disabled is gray-8 (Radix gray-a8 over gray-a3)',
  // A file field holds the browser's button; Radix has no file field.
  'textfield.paddingInline': 'a file field holds a button inside its edge',
  // Radix's indicator is a pseudo-element inset 1px, its ring over the
  // track's edge; the item with an inset ring draws the same.
  'segmented-active.height': 'Radix measures its inset indicator (22px of 24px)',
  'segmented-active.fill': 'dark: the indicator is the surface (Radix: gray-a5 over its track)',
  'segmented-active.edge': 'dark: the soft edge (Radix: gray-a4 over its indicator)',
  // Cards' ring in dark: border.soft (gray-a6); Radix's card ring is gray-a5.
  'card.edge': 'dark: border.soft (Radix gray-a5)',
};
