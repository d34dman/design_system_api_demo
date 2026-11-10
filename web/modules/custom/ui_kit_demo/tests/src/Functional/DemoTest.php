<?php

declare(strict_types=1);

namespace Drupal\Tests\ui_kit_demo\Functional;

use Drupal\Tests\BrowserTestBase;
use Drupal\ui_kit_demo\Gaps;
use PHPUnit\Framework\Attributes\Group;
use PHPUnit\Framework\Attributes\RunTestsInSeparateProcesses;

/**
 * Clicks through the demo: every screen renders, the forms lead on.
 */
#[Group('ui_kit_demo')]
#[RunTestsInSeparateProcesses]
class DemoTest extends BrowserTestBase {

  /**
   * {@inheritdoc}
   */
  protected static $modules = ['ui_kit_demo'];

  /**
   * {@inheritdoc}
   */
  protected $defaultTheme = 'stark';

  /**
   * Each screen, its UI Kit roots and its stand-ins.
   */
  public function testScreens(): void {
    $screens = [
      '/ui-kit/demo' => [
        [
          'ui-kit-side-navigation',
          'ui-kit-page-header',
          'ui-kit-message',
          'ui-kit-stat',
          'ui-kit-card',
          'ui-kit-link',
          'ui-kit-table',
        ],
        [],
      ],
      '/ui-kit/demo/login' => [
        ['ui-kit-card', 'ui-kit-link'],
        ['forms'],
      ],
      '/ui-kit/demo/content' => [
        [
          'ui-kit-page-header',
          'ui-kit-button',
          'ui-kit-link',
          'ui-kit-stat',
          'ui-kit-card',
          'ui-kit-progress',
          'ui-kit-table',
          'ui-kit-timeline',
          'ui-kit-description-list',
          'ui-kit-tab-navigation',
          'ui-kit-pagination',
          'ui-kit-spinner',
          'ui-kit-stat__icon',
        ],
        ['chart'],
      ],
      '/ui-kit/demo/projects' => [
        [
          'ui-kit-page-header',
          'ui-kit-description-list',
          'ui-kit-stat',
          'ui-kit-card',
          'ui-kit-badge',
          'ui-kit-progress',
          'ui-kit-panel',
          'ui-kit-avatar',
          'ui-kit-empty-state',
          'ui-kit-details',
          'ui-kit-description-list',
          'ui-kit-badge__dot',
          'ui-kit-card--danger',
          'ui-kit-message--neutral',
          'ui-kit-message__actions',
          'ui-kit-stat__icon',
        ],
        ['conversation', 'forms'],
      ],
      '/ui-kit/demo/article' => [
        [
          'ui-kit-side-navigation',
          'ui-kit-breadcrumb',
          'ui-kit-page-header',
          'ui-kit-message',
          'ui-kit-card',
        ],
        ['forms'],
      ],
      '/ui-kit/demo/article-preview' => [
        [
          'ui-kit-page-header',
          'ui-kit-heading',
          'ui-kit-text',
          'ui-kit-rich-text',
          'ui-kit-figure',
          'ui-kit-frame',
          'ui-kit-image',
          'ui-kit-blockquote',
          'ui-kit-divider',
          'ui-kit-icon',
          'ui-kit-breadcrumb',
        ],
        [],
      ],
    ];
    $seen = [];
    foreach ($screens as $path => [$roots, $gaps]) {
      $this->drupalGet($path);
      $this->assertSession()->statusCodeEquals(200);
      foreach ($roots as $root) {
        $this->assertSession()->elementExists('css', '.' . $root);
      }
      foreach ($gaps as $gap) {
        $this->assertSession()->elementExists('css', '[data-ui-kit-gap="' . $gap . '"]');
        $seen[$gap] = TRUE;
      }
      // The whole-page render leaves the theme's title block out: one h1.
      $this->assertCount(1, $this->getSession()->getPage()->findAll('css', 'h1'), $path);
    }
    // Every gap in the register is drawn somewhere, and nothing else is.
    $this->assertEqualsCanonicalizing(array_keys(Gaps::ALL), array_keys($seen));
    $this->assertSession()->elementNotExists('css', '.ui-kit-demo--gaps');
  }

  /**
   * Outlines the stand-ins ("Show what's missing"), kept across screens.
   */
  public function testShowGaps(): void {
    $this->drupalGet('/ui-kit/demo/content', ['query' => ['gaps' => '1']]);
    $this->assertSession()->elementExists('css', '.ui-kit-demo--gaps');
    $this->assertSession()->linkByHrefExists('/ui-kit/demo/projects?gaps=1');
    $this->clickLink('Hide what\'s missing');
    $this->assertSession()->elementNotExists('css', '.ui-kit-demo--gaps');
  }

  /**
   * Sign-in leads to the content dashboard; the forms store nothing.
   */
  public function testForms(): void {
    $this->drupalGet('/ui-kit/demo/login');
    $this->submitForm(['email' => 'someone@example.com', 'password' => 'anything'], 'Sign in');
    $this->assertSession()->addressEquals('/ui-kit/demo/content');

    $this->drupalGet('/ui-kit/demo/article');
    $this->submitForm([], 'Save');
    $this->assertSession()->pageTextContains('Title field is required.');
    $this->submitForm(['title' => 'Winter opening hours'], 'Save');
    $this->assertSession()->addressEquals('/ui-kit/demo/content');
    $this->assertSession()->pageTextContains('Article saved');

    $this->drupalGet('/ui-kit/demo/projects');
    $this->submitForm(['message' => 'Hello'], 'Send');
    $this->assertSession()->pageTextContains('In this demo messages aren\'t sent.');
  }

}
