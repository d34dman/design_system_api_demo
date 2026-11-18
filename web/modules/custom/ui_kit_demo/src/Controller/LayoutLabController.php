<?php

declare(strict_types=1);

namespace Drupal\ui_kit_demo\Controller;

use Drupal\Component\Utility\Html;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\Core\Extension\ModuleExtensionList;
use Drupal\Core\Render\Markup;
use Drupal\Core\Url;
use Symfony\Component\DependencyInjection\ContainerInterface;

/**
 * The layout lab: every layout measured in frames of a fixed width.
 *
 * Two parts, each case a frame with data-case and data-width, so a browser
 * test can find and measure it:
 * - columns: columns, center and frame at 320, 640 and 1280px, and columns
 *   inside a sidebar's side (m2-e1; content plan m2-e2 for frame);
 * - nested: every layout nested three deep, with Drupal wrapper divs,
 *   children carrying browser margins and a long unbroken URL (m3-e1).
 */
final class LayoutLabController implements ContainerInjectionInterface {

  /**
   * The frame widths the lab measures, in CSS pixels (C-05).
   */
  public const WIDTHS = [320, 640, 1280];

  public function __construct(
    private readonly ModuleExtensionList $modules,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container): static {
    $modules = $container->get('extension.list.module');
    assert($modules instanceof ModuleExtensionList);
    return new static($modules);
  }

  /**
   * Builds the lab.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public function __invoke(): array {
    return [
      '#type' => 'container',
      '#attributes' => ['class' => ['ui-kit-lab']],
      '#attached' => ['library' => ['ui_kit_demo/layout-lab']],
      'columns' => $this->section('columns', 'Columns and center by width', $this->columns()),
      'nested' => $this->section('nested', 'Every layout, nested', $this->nested()),
    ];
  }

  /**
   * Columns and center at each width, and columns in a sidebar's side.
   *
   * @return list<array<string, mixed>>
   *   Render arrays.
   */
  private function columns(): array {
    $out = [];
    foreach (self::WIDTHS as $width) {
      $out[] = $this->frame("columns-2-1-$width", $width, $this->layout('columns', ['ratio' => '2-1'], [
        'first' => $this->box('First, twice as wide'),
        'second' => $this->box('Second'),
      ]));
      $out[] = $this->frame("columns-1-1-1-$width", $width, $this->layout('columns', ['ratio' => '1-1-1'], [
        'first' => $this->box('First'),
        'second' => $this->box('Second'),
        'third' => $this->box('Third'),
      ]));
      $out[] = $this->frame("center-s-$width", $width, $this->layout('center', ['measure' => 's'], [
        'content' => $this->box('Centred, no wider than 36rem.'),
      ]));
      foreach (['16-9', '1-1'] as $ratio) {
        $out[] = $this->frame("frame-$ratio-$width", $width, $this->layout('frame', ['ratio' => $ratio], [
          'content' => ['#markup' => '<div><img src="' . Url::fromUserInput('/' . $this->modules->getPath('ui_kit_demo') . '/images/portrait.svg')->toString() . '" alt="" width="600" height="900"></div>'],
        ]));
      }
    }
    // A narrow side of a wide window: the columns see the side, not the window.
    $out[] = $this->frame('columns-in-side-1280', 1280, $this->layout('sidebar', ['width' => 'l'], [
      'side' => $this->layout('columns', ['ratio' => '1-1'], [
        'first' => $this->box('In the side, first'),
        'second' => $this->box('In the side, second'),
      ]),
      'content' => $this->box('Main content'),
    ]));
    return $out;
  }

  /**
   * Every layout three deep, as Drupal renders content into them.
   *
   * @return list<array<string, mixed>>
   *   Render arrays.
   */
  private function nested(): array {
    $out = [];
    foreach (self::WIDTHS as $width) {
      $side = $this->layout('stack', ['gap' => 's'], ['content' => [
        $this->wrapped($this->box('Filter by status')),
        $this->wrapped($this->box('Filter by owner')),
      ]]);
      $tiles = $this->layout('tiles', ['min' => 's', 'gap' => 's'], ['content' => [
        $this->box('Tile one', 'figure'),
        $this->wrapped($this->box('Tile two', 'figure')),
        $this->box('Tile three', 'figure'),
      ]]);
      $actions = $this->layout('cluster', ['gap' => 'xs'], ['content' => [
        $this->box('Run', 'div'),
        $this->wrapped($this->box('Pause', 'div')),
        $this->box('Retry', 'div'),
        $this->box('Delete', 'div'),
      ]]);
      $reading = $this->layout('center', ['measure' => 's'], ['content' => [
        $this->box('Source: https://example.com/a/very/long/unbroken/path/to/the/nightly-import-run-2026-11-08-with-all-of-its-parameters?status=failed&owner=everyone'),
      ]]);
      $main = $this->layout('columns', ['ratio' => '2-1'], [
        'first' => $tiles,
        'second' => $this->layout('stack', ['gap' => 's'], ['content' => [$actions, $reading]]),
      ]);
      $page = $this->layout('stack', ['gap' => 's'], ['content' => [
        $this->box('Heading of the page', 'h3'),
        $this->layout('sidebar', ['width' => 'm'], ['side' => $side, 'content' => $main]),
      ]]);
      $out[] = $this->frame("nested-$width", $width, [
        '#type' => 'container',
        '#attributes' => ['class' => ['ui-kit-lab-outer']],
        'page' => $page,
      ]);
    }
    return $out;
  }

  /**
   * A titled section of the lab.
   *
   * @param string $id
   *   The section's id.
   * @param string $title
   *   Its heading.
   * @param list<array<string, mixed>> $cases
   *   Its cases.
   *
   * @return array<int|string, mixed>
   *   A render array.
   */
  private function section(string $id, string $title, array $cases): array {
    return [
      '#type' => 'container',
      '#attributes' => ['class' => ['ui-kit-lab-section'], 'id' => "lab-$id"],
      'title' => ['#markup' => '<h2>' . Html::escape($title) . '</h2>'],
    ] + $cases;
  }

  /**
   * A frame of a fixed width around one case.
   *
   * @param string $case
   *   The case's name, as data-case.
   * @param int $width
   *   The frame's width in CSS pixels.
   * @param array<string, mixed> $content
   *   What it holds.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function frame(string $case, int $width, array $content): array {
    return [
      '#type' => 'container',
      '#attributes' => ['class' => ['ui-kit-lab-case']],
      'label' => ['#markup' => '<p>' . Html::escape("$case ({$width}px)") . '</p>'],
      'frame' => [
        '#type' => 'container',
        '#attributes' => [
          'class' => ['ui-kit-lab-frame'],
          'data-case' => $case,
          'data-width' => (string) $width,
          'style' => "inline-size: {$width}px",
        ],
        'content' => $content,
      ],
    ];
  }

  /**
   * One of UI Kit's layouts.
   *
   * @param string $name
   *   The layout.
   * @param array<string, string> $props
   *   Its props.
   * @param array<string, mixed> $slots
   *   Its slots.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function layout(string $name, array $props, array $slots): array {
    return [
      '#type' => 'component',
      '#component' => "ui_kit:$name",
      '#props' => $props,
      '#slots' => $slots,
    ];
  }

  /**
   * A box of content, in an element that keeps its browser margins.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function box(string $text, string $element = 'p'): array {
    return ['#markup' => Markup::create("<$element class=\"ui-kit-lab-box\">" . Html::escape($text) . "</$element>")];
  }

  /**
   * Wraps content the way Drupal's form and field wrappers do.
   *
   * @param array<string, mixed> $content
   *   The content.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function wrapped(array $content): array {
    return [
      '#type' => 'container',
      '#attributes' => ['class' => ['js-form-item', 'form-item']],
      'content' => $content,
    ];
  }

}
