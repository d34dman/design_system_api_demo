<?php

declare(strict_types=1);

namespace Drupal\Tests\ds_claro_adapter\Kernel;

use Drupal\Component\Serialization\Yaml;
use Drupal\KernelTests\KernelTestBase;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * Tests that the custom properties the adapter maps to exist in Claro.
 */
#[Group('ds_claro_adapter')]
#[RunTestsInSeparateProcesses]
final class ClaroDriftTest extends KernelTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = ['system'];

  /**
   * Tests every var(--…) in the adapter against Claro's stylesheets.
   *
   * When it fails: Claro renamed or dropped a custom property; map the token
   * to its replacement.
   */
  public function testCustomPropertiesExist(): void {
    $themes = $this->container->get('extension.list.theme');
    if (!$themes->exists('claro')) {
      $this->markTestSkipped('Claro is not in the codebase (contrib on Drupal 12).');
    }
    $claro = $this->root . '/' . $themes->getPath('claro');
    $defined = [];
    $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($claro . '/css', \FilesystemIterator::SKIP_DOTS));
    foreach ($files as $file) {
      if ($file instanceof \SplFileInfo && $file->getExtension() === 'css') {
        preg_match_all('/(--[\w-]+)\s*:/', (string) file_get_contents($file->getPathname()), $matches);
        $defined += array_fill_keys($matches[1], TRUE);
      }
    }
    $this->assertNotEmpty($defined);

    $adapter = Yaml::decode((string) file_get_contents(dirname(__DIR__, 3) . '/ds_claro_adapter.design_system_adapter.yml'));
    $this->assertIsArray($adapter);
    $values = $adapter['values'] ?? NULL;
    $this->assertIsArray($values);
    $used = [];
    array_walk_recursive($values, static function (mixed $value) use (&$used): void {
      if (is_string($value) && preg_match_all('/var\(\s*(--[\w-]+)/', $value, $matches)) {
        $used += array_fill_keys($matches[1], TRUE);
      }
    });
    $this->assertNotEmpty($used);
    $this->assertSame([], array_keys(array_diff_key($used, $defined)), "Custom properties the Claro adapter uses that Claro doesn't define.");
  }

}
