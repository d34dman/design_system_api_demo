<?php

declare(strict_types=1);

namespace Drupal\ui_kit_demo;

/**
 * Small render-array builders the demo screens share.
 */
final class Build {

  /**
   * Renders a UI Kit component.
   *
   * @param string $name
   *   The component's machine name, without "ui_kit:".
   * @param array<string, mixed> $props
   *   The props.
   * @param array<string, mixed> $slots
   *   The slots, as render arrays.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public static function component(string $name, array $props, array $slots = []): array {
    return [
      '#type' => 'component',
      '#component' => 'ui_kit:' . $name,
      '#props' => $props,
      '#slots' => $slots,
    ];
  }

  /**
   * Lays children out with one of UI Kit's layouts.
   *
   * @param string $name
   *   The layout: cluster, stack or tiles.
   * @param list<array<mixed>> $content
   *   The children.
   * @param array<string, string> $props
   *   The layout's props, e.g. gap or min.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public static function layout(string $name, array $content, array $props = []): array {
    return [
      '#type' => 'component',
      '#component' => 'ui_kit:' . $name,
      '#props' => $props,
      // Core refuses an empty array in a slot: leave out parts a screen skips.
      '#slots' => ['content' => array_filter($content, static fn (mixed $child): bool => $child !== [])],
    ];
  }

  /**
   * Puts a narrow side next to the main content (ui_kit:sidebar).
   *
   * @param array<mixed> $side
   *   The side.
   * @param array<mixed> $content
   *   The main content.
   * @param string $width
   *   The side's width: s, m or l.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public static function sidebar(array $side, array $content, string $width = 'm'): array {
    return [
      '#type' => 'component',
      '#component' => 'ui_kit:sidebar',
      '#props' => ['width' => $width, 'gap' => 'l'],
      '#slots' => ['side' => $side, 'content' => $content],
    ];
  }

  /**
   * A row of equal items that shares its width, wrapping when it runs out.
   *
   * UI Kit's tiles fill the row (auto-fit), so a row of three leaves no hole
   * where a fourth would go.
   *
   * @param list<array<mixed>> $items
   *   The items.
   * @param string $min
   *   The narrowest an item gets: s, m or l.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public static function row(array $items, string $min = 'm'): array {
    return self::layout('tiles', $items, ['min' => $min, 'gap' => 'm']);
  }

  /**
   * Two parts side by side by a ratio, stacking when narrow (ui_kit:columns).
   *
   * @param array<mixed> $first
   *   The first part.
   * @param array<mixed> $second
   *   The second part.
   * @param string $ratio
   *   How they share the row: 1-1, 2-1 or 1-2.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public static function columns(array $first, array $second, string $ratio = '2-1'): array {
    return [
      '#type' => 'component',
      '#component' => 'ui_kit:columns',
      '#props' => ['ratio' => $ratio, 'gap' => 'm'],
      '#slots' => ['first' => $first, 'second' => $second],
    ];
  }

  /**
   * A titled section of a screen: an h2, an optional line, the content.
   *
   * @param string $title
   *   The section's heading.
   * @param array<mixed> $content
   *   The content.
   * @param string $description
   *   One line under the heading, or ''.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public static function section(string $title, array $content, string $description = ''): array {
    $head = [self::component('heading', ['text' => $title, 'level' => 2, 'size' => 'l'])];
    if ($description !== '') {
      $head[] = self::component('text', ['text' => $description, 'tone' => 'secondary']);
    }
    return [
      '#type' => 'inline_template',
      '#template' => '<section class="ui-kit-demo-section">{{ head }}{{ content }}</section>',
      '#context' => ['head' => self::layout('stack', $head, ['gap' => '2xs']), 'content' => $content],
    ];
  }

}
