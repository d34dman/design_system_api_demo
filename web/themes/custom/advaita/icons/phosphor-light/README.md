# Phosphor light, named for Drupal Navigation

Replacement shapes for core Navigation's `navigation` icon pack, used only
while the chrome skin is `advaita_canvas_ui` (config `design_system_api.binding`,
key `chrome.skin`). Canvas UI draws thin Radix icons (about 1px); Navigation
ships Phosphor *regular* (about 1.5px at 20px). Phosphor *light* has the same
shapes at 12/256 stroke, so about 0.94px at Navigation's 20px size.

`advaita_showcase` re-points the pack here with `hook_icon_pack_alter`
(`src/Hook/NavigationIconsHooks.php`). Files are named by Navigation's icon
ids, so this folder must hold every id in
`core/modules/navigation/assets/icons/`; an id missing here renders blank.

Source: `@phosphor-icons/core` 2.1.1, `assets/light/*-light.svg`, copied
unchanged and renamed (MIT, see `LICENSE`). Root carries
`viewBox="0 0 256 256" fill="currentColor"`.

| Navigation id | Phosphor light |
|---|---|
| `announcements-feed-announcement` | `megaphone` |
| `arrow-left` | `arrow-left` |
| `burger` | `list` |
| `chevron` | `caret-right` |
| `cross` | `x` |
| `database` | `database` |
| `dots` | `dots-three-vertical` |
| `entity-user-collection` | `users` |
| `error` | `radioactive` |
| `eye` | `eye` |
| `file` | `file` |
| `help` | `question` |
| `navigation-blocks` | `squares-four` |
| `navigation-content` | `article` |
| `navigation-create` | `plus-circle` |
| `navigation-files` | `files` |
| `navigation-media` | `images` |
| `navigation-user-links-user-wrapper` | `user-circle` |
| `pencil` | `pencil` |
| `return-left` | `arrow-bend-up-left` |
| `shortcuts` | `star` |
| `signpost` | `signpost` |
| `status` | `question` |
| `system-admin-config` | `sliders` |
| `system-admin-reports` | `chart-pie-slice` |
| `system-admin-structure` | `tree-structure` |
| `system-modules-list` | `puzzle-piece` |
| `system-themes-page` | `paint-brush` |
| `warning` | `warning` |
| `workspaces` | `cards-three` |
| `throbber` | none: core's own file (GPL-2.0-or-later, like this site), copied unchanged; it is an animated spinner with no Phosphor equivalent |

Notes: `error` is core's own choice (radioactive), kept as the same shape.
`help` and `status` are both a question mark in core, so both map to `question`.
