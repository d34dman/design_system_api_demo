<?php

declare(strict_types=1);

namespace Drupal\advaita_showcase\Hook;

use Drupal\Core\Entity\Display\EntityViewDisplayInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\node\NodeInterface;

/**
 * The demo content's field rules under Advaita.
 *
 * Advaita draws core's node markup only. The demo's own fields (standfirst,
 * media, tags, landing page sections) get their look here, scoped to
 * Advaita's site pages (.advaita-site), so other themes are left alone.
 */
final class ArticleHooks {

  /**
   * Implements hook_node_view().
   *
   * @param array<string, mixed> $build
   *   The node's render array.
   * @param \Drupal\node\NodeInterface $node
   *   The node.
   * @param \Drupal\Core\Entity\Display\EntityViewDisplayInterface $display
   *   The display.
   * @param string $view_mode
   *   The view mode.
   */
  #[Hook('node_view')]
  public function nodeView(array &$build, NodeInterface $node, EntityViewDisplayInterface $display, string $view_mode): void {
    $attached = is_array($build['#attached'] ?? NULL) ? $build['#attached'] : [];
    $libraries = is_array($attached['library'] ?? NULL) ? $attached['library'] : [];
    $libraries[] = 'advaita_showcase/article';
    $attached['library'] = $libraries;
    $build['#attached'] = $attached;
  }

}
