<?php

/**
 * @file
 * Builds composer.workspace.json: composer.json plus the workspace path repositories.
 *
 * The path repositories are prepended so local checkouts win over drupal.org.
 * requires.json pins the workspace checkouts (1.x-dev, from the path
 * repositories) and wins over composer.json, whose constraints take releases.
 * A checkout replaces the drupal/<project>-<module> name packages.drupal.org
 * gives a project whose name an old submodule metapackage holds (chrome, Media
 * Library; drupal.org infrastructure issue 3606968), so both aren't installed.
 * Run by `ddev workspace-mode on`.
 */

declare(strict_types=1);

$composer = json_decode((string) file_get_contents('composer.json'), TRUE, 512, JSON_THROW_ON_ERROR);
$workspace = json_decode((string) file_get_contents(__DIR__ . '/repositories.json'), TRUE, 512, JSON_THROW_ON_ERROR);

$requires = json_decode((string) file_get_contents(__DIR__ . '/requires.json'), TRUE, 512, JSON_THROW_ON_ERROR);

$composer['repositories'] = array_merge($workspace, $composer['repositories'] ?? []);
$require = $composer['require'] ?? [];
foreach (array_keys($requires) as $name) {
  unset($require[$name . '-' . substr($name, strlen('drupal/'))]);
}
$composer['require'] = $requires + $require;
ksort($composer['require']);

file_put_contents(
  'composer.workspace.json',
  json_encode($composer, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n",
);
