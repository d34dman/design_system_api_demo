<?php

declare(strict_types=1);

namespace Drupal\ui_kit_demo\Hook;

use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Routing\RouteMatchInterface;

/**
 * Gives the demo's screens a page of their own.
 */
final class DemoHooks {

  public function __construct(
    private readonly RouteMatchInterface $routeMatch,
  ) {}

  /**
   * Implements hook_theme().
   *
   * @return array<string, array<string, string>>
   *   The demo's page template, a suggestion for "page".
   */
  #[Hook('theme')]
  public function theme(): array {
    return ['page__ui_kit_demo' => ['base hook' => 'page']];
  }

  /**
   * Implements hook_theme_suggestions_HOOK_alter() for page.
   *
   * @param list<string> $suggestions
   *   The suggestions so far.
   */
  #[Hook('theme_suggestions_page_alter')]
  public function pageSuggestions(array &$suggestions): void {
    if (str_starts_with((string) $this->routeMatch->getRouteName(), 'ui_kit_demo.')) {
      $suggestions[] = 'page__ui_kit_demo';
    }
  }

}
