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
patch -p1 -d web/modules/contrib/canvas < patches/canvas-1.12.0-symfony-8-constraints.patch
ddev drush en canvas -y
```

`canvas-1.12.0-symfony-8-constraints.patch` (apply after the first): Drupal 12 builds
constraints with `new $class(...$options)` and Symfony Validator 8 reads no options
array, so without it every node form's AJAX request (the Media Library, "Add another
item") and cron fail. Canvas's constraints that declare options as properties take them
through a `NamedOptionsTrait` constructor; `Choice` lists in the config schema become
`choices:`, scalar options get their option name, and two validators pass named
arguments.
