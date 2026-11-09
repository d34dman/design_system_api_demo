<?php

/**
 * @file
 * Builds composer.workspace.json: composer.json plus the workspace path repositories.
 *
 * The path repositories are prepended so local checkouts win over drupal.org.
 * requires.json adds packages that exist only as workspace checkouts so far (no
 * drupal.org release yet); move each into composer.json once it has one.
 * Run by `ddev workspace-mode on`.
 */

declare(strict_types=1);

$composer = json_decode((string) file_get_contents('composer.json'), TRUE, 512, JSON_THROW_ON_ERROR);
$workspace = json_decode((string) file_get_contents(__DIR__ . '/repositories.json'), TRUE, 512, JSON_THROW_ON_ERROR);

$requires = json_decode((string) file_get_contents(__DIR__ . '/requires.json'), TRUE, 512, JSON_THROW_ON_ERROR);

$composer['repositories'] = array_merge($workspace, $composer['repositories'] ?? []);
$composer['require'] = ($composer['require'] ?? []) + $requires;
ksort($composer['require']);

file_put_contents(
  'composer.workspace.json',
  json_encode($composer, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n",
);
