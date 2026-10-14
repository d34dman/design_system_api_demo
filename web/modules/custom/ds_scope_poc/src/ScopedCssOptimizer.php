<?php

declare(strict_types=1);

namespace Drupal\ds_scope_poc;

use Drupal\Core\Asset\AssetOptimizerInterface;

/**
 * Decorates asset.css.optimizer: wraps each file in its system's @scope.
 *
 * Runs per file while Drupal builds a CSS aggregate, so it only applies with
 * CSS aggregation on, and only to files with preprocess enabled.
 */
class ScopedCssOptimizer implements AssetOptimizerInterface {

  public function __construct(
    private AssetOptimizerInterface $inner,
    private Systems $systems,
    private CssScoper $scoper,
  ) {}

  public function optimize(array $asset) {
    $css = $this->inner->optimize($asset);
    if (!$this->systems->scoped()) {
      return $css;
    }
    $system = $this->systems->systemOf((string) $asset['data']);
    return $system === NULL ? $css : $this->scoper->scope($css, $system);
  }

  public function clean($contents) {
    return $this->inner->clean($contents);
  }

}
