<?php

declare(strict_types=1);

namespace Drupal\Tests\ui_kit_demo\Functional;

use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * The same click-through under Advaita, a theme built on the provider.
 */
#[Group('ui_kit_demo')]
#[RunTestsInSeparateProcesses]
final class DemoAdvaitaTest extends DemoTest {

  /**
   * {@inheritdoc}
   */
  protected static $modules = ['ui_kit_demo', 'block', 'design_system_api_patterns'];

  /**
   * {@inheritdoc}
   */
  protected function setUp(): void {
    parent::setUp();
    // Advaita needs design_system_api, which the modules bring, so it can't
    // be $defaultTheme (the default theme installs before the modules).
    $this->container->get('theme_installer')->install(['advaita']);
    $this->config('system.theme')->set('default', 'advaita')->save();
  }

}
