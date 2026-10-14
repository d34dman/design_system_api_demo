<?php

declare(strict_types=1);

namespace Drupal\ds_scope_poc;

use Drupal\Core\State\StateInterface;

/**
 * Which approach is active, and which CSS belongs to which design system.
 */
class Systems {

  public const STRATEGIES = ['none', 'fence', 'fence-id', 'systems', 'ref'];

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
   * How the Media Library widget and dialog are marked: 'boundary' or 'admin'.
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
