# Local patches

Contrib modules tried on Drupal 12 before they have a Drupal 12 release. Workspace
mode only (`composer.workspace.json` allows them through `drupal-lenient`); a
`composer install` drops these changes, so apply them again afterwards.

## Drupal Canvas 1.12.0

`canvas-1.12.0-drupal-12.patch`: `core_version_requirement` plus `^12`, and the
Drupal 12 signatures it is missing (`getSortedDefinitions()`/`getGroupedDefinitions()`
`$label_key`, `getOperations()` `$cacheability`, `BreadcrumbBuilderInterface::applies()`
`$cacheable_metadata`, `EntityType`/`Bundle` constraint options as arrays).

```bash
patch -p1 -d web/modules/contrib/canvas < patches/canvas-1.12.0-drupal-12.patch
# The built UI reads window.transliterate; Drupal 12's transliteration 2.x exposes
# window.transliteration.transliterate.
sed -i 's/const{transliterate:e}=window;return e/return window.transliterate??window.transliteration?.transliterate/' \
  web/modules/contrib/canvas/ui/dist/assets/index.js
ddev drush en canvas -y
```
