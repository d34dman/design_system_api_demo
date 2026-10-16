<?php

declare(strict_types=1);

namespace Drupal\ds_scope_poc;

use Drupal\Core\State\StateInterface;

/**
 * Which approach is active, and which CSS belongs to which design system.
 */
class Systems {

  public const STRATEGIES = ['none', 'fence', 'fence-id', 'systems', 'layers', 'patterns', 'ref'];

  /**
   * Path prefixes per system, from systems.json.
   *
   * @var array<string, list<string>>|null
   */
  private ?array $map = NULL;

  public function __construct(private StateInterface $state) {}

  /**
   * The active approach (ddev ds-scope <name>).
   */
  public function strategy(): string {
    $strategy = $this->state->get('ds_scope_poc.strategy', 'none');
    return in_array($strategy, self::STRATEGIES, TRUE) ? $strategy : 'none';
  }

  /**
   * Whether Form API gives every form element the contract's pattern classes
   * (approach 'patterns': 'systems' plus study candidate 6).
   */
  public function formPatterns(): bool {
    return $this->strategy() === 'patterns';
  }

  /**
   * Whether each system's CSS is wrapped in @scope. 'layers' was 'systems' plus
   * page tokens; the tokens now come from design_system_api for every approach.
   */
  public function scoped(): bool {
    return in_array($this->strategy(), ['systems', 'layers', 'patterns'], TRUE);
  }

  /**
   * The region marker for a declared role.
   *
   * site maps to the site's system and app to the admin's. chrome maps to the
   * admin's system, or to a boundary in the site's values: the setting
   * `ddev ds-scope ml-admin|ml-boundary` stands in for a site builder's choice.
   *
   * @return array<string, string>
   *   Marker attributes.
   */
  public function marker(string $role): array {
    return match ($role) {
      'site' => ['data-ds-system' => 'site'],
      'app' => ['data-ds-system' => 'admin'],
      'chrome' => $this->mediaLibraryAs() === 'admin' ? ['data-ds-system' => 'admin'] : ['data-ds-boundary' => ''],
      default => [],
    };
  }

  /**
   * How chrome is mapped (the Media Library uses it): 'boundary' or 'admin'.
   */
  public function mediaLibraryAs(): string {
    return $this->state->get('ds_scope_poc.ml_as', 'boundary') === 'admin' ? 'admin' : 'boundary';
  }

  /**
   * The system a CSS file belongs to, or NULL for system-neutral CSS.
   */
  public function systemOf(string $path): ?string {
    foreach ($this->map() as $system => $prefixes) {
      foreach ($prefixes as $prefix) {
        if (str_starts_with($path, $prefix)) {
          return $system;
        }
      }
    }
    return NULL;
  }

  /**
   * The systems and their path prefixes.
   *
   * @return array<string, list<string>>
   */
  public function map(): array {
    if ($this->map === NULL) {
      $data = json_decode((string) file_get_contents(dirname(__DIR__) . '/systems.json'), TRUE);
      unset($data['_comment']);
      $this->map = $data;
    }
    return $this->map;
  }

}
