<?php

declare(strict_types=1);

namespace Drupal\ui_kit_demo\Controller;

use Drupal\Core\Extension\ModuleExtensionList;
use Drupal\Core\Render\Markup;
use Drupal\Core\Url;

/**
 * Renders every component in every tone, then with blank values.
 *
 * Each part is a wrapper with a class, so it can be captured on its own.
 */
final class ShowcaseController {

  /**
   * The tones the components share.
   */
  private const TONES = ['neutral', 'info', 'success', 'warning', 'danger'];

  /**
   * Builds the showcase.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public function __invoke(): array {
    $badges = [];
    foreach (self::TONES as $tone) {
      $badges[$tone] = [
        '#type' => 'component',
        '#component' => 'ui_kit:badge',
        '#props' => ['label' => ucfirst($tone), 'tone' => $tone],
      ];
    }
    $stats = [];
    foreach (self::TONES as $i => $tone) {
      $stats[$tone] = [
        '#type' => 'component',
        '#component' => 'ui_kit:stat',
        '#props' => [
          'label' => ucfirst($tone) . ' runs',
          'value' => 12 * ($i + 1),
          'hint' => 'last 24 hours',
          'tone' => $tone,
          'status' => $tone === 'neutral' ? NULL : ucfirst($tone),
          'href' => $i % 2 ? '/ui-kit/showcase#' . $tone : NULL,
        ],
      ];
    }
    // The showcase's sections are parts of a page: a stack with the section
    // gap, one step smaller on narrow screens (the provider's
    // space.section).
    return $this->layout('stack', [
      'normal' => $this->part('normal', $badges, $stats),
      'blank' => $this->part('blank', ...$this->blank()),
      'actions' => $this->actions(),
      'wave1' => $this->wave1(),
      'wave2' => $this->wave2(),
      'wave2b' => $this->wave2SecondPart(),
      'additions' => $this->additions(),
      'content' => $this->content(),
      'media' => $this->media(),
    ], ['gap' => 'section']);
  }

  /**
   * Pairs each button with the link that has its look (C-06).
   *
   * Each pair is captured on its own and compared pixel by pixel.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function actions(): array {
    $pairs = [];
    foreach (['primary', 'secondary'] as $appearance) {
      $pairs[$appearance] = [
        '#type' => 'container',
        // Whole-pixel columns, so both start on the same subpixel offset.
        '#attributes' => [
          'class' => ['ui-kit-showcase-pair', 'ui-kit-showcase-pair--' . $appearance],
          'style' => 'display: grid; grid-template-columns: 160px 160px; justify-items: start; gap: 16px',
        ],
        'button' => $this->component('button', ['label' => 'Run again', 'appearance' => $appearance]),
        'link' => $this->component('link', ['label' => 'Run again', 'href' => '#', 'appearance' => $appearance]),
      ];
    }
    return [
      '#type' => 'container',
      '#attributes' => ['class' => ['ui-kit-showcase--actions']],
      // Two rows of buttons are a group (gap m), under their heading.
      'stack' => $this->layout('stack', [
        'heading' => ['#markup' => '<h2>Button and link</h2>'],
        'rows' => $this->layout('stack', [
          'pairs' => $this->layout('cluster', $pairs),
          'more' => $this->layout('cluster', [
            $this->component('button', ['label' => 'Disabled', 'disabled' => TRUE]),
            $this->component('button', ['label' => 'Disabled primary', 'appearance' => 'primary', 'disabled' => TRUE]),
            $this->component('link', ['label' => 'A text link', 'href' => '#']),
          ]),
        ]),
      ], ['gap' => 's']),
    ];
  }

  /**
   * Shows the rest of wave 1 as a run dashboard would use it.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function wave1(): array {
    $messages = [];
    foreach (['info', 'success', 'warning', 'danger'] as $tone) {
      $messages[$tone] = $this->component('message', ['tone' => $tone, 'title' => ucfirst($tone)], [
        'content' => ['#markup' => '<p>The nightly import finished with 3 warnings.</p>'],
      ]);
    }
    $progress = [];
    foreach (['info', 'success', 'warning', 'danger'] as $i => $tone) {
      $progress[$tone] = $this->component('progress', [
        'label' => ucfirst($tone) . ' steps',
        'value' => 3 * ($i + 1),
        'max' => 12,
        'value_text' => (3 * ($i + 1)) . ' of 12',
        'tone' => $tone,
      ]);
    }
    $facts = [
      ['term' => 'Started', 'description' => '10:42'],
      ['term' => 'Duration', 'description' => '4 min 12 s'],
      ['term' => 'Steps', 'description' => 12],
      ['term' => 'Triggered by', 'description' => 'Schedule'],
    ];
    return [
      '#type' => 'container',
      '#attributes' => ['class' => ['ui-kit-showcase--wave1']],
      'stack' => $this->layout('stack', [
        'header' => $this->component('page-header', [
          'title' => 'Nightly import',
          'heading_level' => 2,
          'description' => 'Imports products from the warehouse every night.',
        ], [
          'actions' => [
            $this->component('link', ['label' => 'Edit', 'href' => '#', 'appearance' => 'secondary']),
            $this->component('button', ['label' => 'Run now', 'appearance' => 'primary']),
          ],
        ]),
        'strip' => $this->component('description-list', ['items' => $facts, 'layout' => 'strip']),
        'messages' => $this->layout('stack', $messages),
        'progress' => $this->layout('tiles', $progress),
        'cards' => $this->layout('tiles', [
          $this->component('card', ['title' => 'Details', 'description' => 'What this run did.'], [
            'content' => $this->component('description-list', ['items' => $facts]),
            'actions' => $this->component('link', ['label' => 'Open the log', 'href' => '#']),
          ]),
          $this->component('card', ['title' => 'Timeline'], [
            'content' => $this->component('timeline', [
              'items' => [
                ['title' => 'Queued', 'time' => '10:41', 'datetime' => '2026-11-07T10:41:00Z'],
                ['title' => 'Started', 'time' => '10:42', 'datetime' => '2026-11-07T10:42:00Z', 'tone' => 'info'],
                [
                  'title' => 'Step 3 failed',
                  'time' => '10:44',
                  'description' => 'Timeout after 30 s',
                  'tone' => 'danger',
                ],
                ['title' => 'Retried', 'time' => '10:45', 'tone' => 'warning'],
                ['title' => 'Finished', 'time' => '10:46', 'tone' => 'success'],
              ],
            ]),
          ]),
        ]),
        'table' => $this->component('table', [
          'caption' => 'Recent runs',
          'headers' => ['Run', 'Status', 'Steps', 'Duration'],
          'rows' => [
            ['Nightly import', 'Failed', 12, '4 min 12 s'],
            ['Price sync', 'Done', 4, '38 s'],
            ['Image cleanup', 'Running', 7, '1 min 2 s'],
          ],
        ]),
        'empty-table' => $this->component('table', [
          'caption' => 'Scheduled runs',
          'headers' => ['Run', 'Next'],
          'rows' => [],
          'empty' => 'No runs scheduled.',
        ]),
      ]),
    ];
  }

  /**
   * Shows wave 2's first part: avatar, tab navigation, pagination, panel.
   *
   * The last row of each is blank: optional props missing, text props ''.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function wave2(): array {
    $avatars = [];
    foreach (['s', 'm', 'l'] as $size) {
      $avatars[$size] = $this->component('avatar', ['name' => 'Mara Lind', 'size' => $size]);
    }
    $avatars['initials'] = $this->component('avatar', ['name' => '李小龍', 'initials' => '龍']);
    $avatars['picture'] = $this->component('avatar', [
      'name' => 'Jonas Ek',
      'src' => 'data:image/svg+xml,' . rawurlencode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><path fill="#6a8" d="M0 0h2v2H0z"/><circle cx="1" cy=".8" r=".4" fill="#fff"/></svg>'),
    ]);
    $avatars['blank'] = $this->component('avatar', ['name' => '']);
    $task = fn (string $title): array => $this->component('card', ['title' => $title, 'heading_level' => 3], [
      'badges' => $this->component('badge', ['label' => 'Frontend', 'tone' => 'info']),
      'content' => $this->component('avatar', ['name' => 'Priya Nair', 'size' => 's']),
    ]);
    $page = static fn (int|string $label, ?string $href, bool $current = FALSE): array => [
      'label' => $label,
      'href' => $href,
      'current' => $current,
    ];
    return [
      '#type' => 'container',
      '#attributes' => ['class' => ['ui-kit-showcase--wave2']],
      'stack' => $this->layout('stack', [
        'heading' => ['#markup' => '<h2>Wave 2, first part</h2>'],
        'avatars' => $this->layout('cluster', $avatars),
        'tabs' => $this->component('tab-navigation', [
          'label' => 'Period',
          'items' => [
            ['label' => '7 days', 'href' => '#7'],
            ['label' => '30 days', 'href' => '#30', 'current' => TRUE],
            ['label' => '90 days', 'href' => '#90'],
          ],
        ]),
        'tabs-blank' => $this->component('tab-navigation', [
          'label' => '',
          'items' => [['label' => '', 'href' => '#'], ['label' => '0', 'href' => '#', 'current' => TRUE]],
        ]),
        'segmented' => $this->layout('cluster', [
          'mode' => $this->component('segmented-control', [
            'label' => 'Color mode',
            'name' => 'showcase-mode',
            'value' => 'light',
            'options' => [
              ['value' => 'system', 'label' => 'System', 'icon' => 'system'],
              ['value' => 'light', 'label' => 'Light', 'icon' => 'light'],
              ['value' => 'dark', 'label' => 'Dark', 'icon' => 'dark'],
            ],
          ]),
          'icons' => $this->component('segmented-control', [
            'label' => 'Color mode',
            'name' => 'showcase-mode-icons',
            'label_display' => 'hidden',
            'icons_only' => TRUE,
            'value' => 'dark',
            'options' => [
              ['value' => 'system', 'label' => 'System', 'icon' => 'system'],
              ['value' => 'light', 'label' => 'Light', 'icon' => 'light'],
              ['value' => 'dark', 'label' => 'Dark', 'icon' => 'dark'],
            ],
          ]),
          'view' => $this->component('segmented-control', [
            'label' => 'View',
            'name' => 'showcase-view',
            'label_display' => 'inline',
            'value' => 'list',
            'options' => [
              ['value' => 'list', 'label' => 'List'],
              ['value' => 'board', 'label' => 'Board'],
            ],
          ]),
          'disabled' => $this->component('segmented-control', [
            'label' => 'Contrast',
            'name' => 'showcase-contrast',
            'disabled' => TRUE,
            'value' => 'system',
            'options' => [
              ['value' => 'system', 'label' => 'System', 'icon' => 'system'],
              ['value' => 'more', 'label' => 'More', 'icon' => 'contrast'],
            ],
          ], [
            'description' => ['#markup' => '<p>This page keeps its own contrast.</p>'],
          ]),
        ]),
        'segmented-blank' => $this->component('segmented-control', [
          'label' => '',
          'name' => '',
          'value' => NULL,
          'options' => [['value' => '', 'label' => ''], ['value' => '0', 'label' => '0']],
        ]),
        'pagination' => $this->component('pagination', [
          'label' => 'Pages of runs',
          'previous' => ['label' => 'Previous', 'href' => '#2'],
          'pages' => [
            $page(1, '#1'),
            $page(2, '#2'),
            $page(3, '#3', TRUE),
            $page('…', NULL),
            $page(9, '#9'),
          ],
          'next' => ['label' => 'Next', 'href' => '#4'],
        ]),
        'pagination-blank' => $this->component('pagination', [
          'label' => '',
          'pages' => [$page(0, NULL, TRUE), $page('', '#')],
        ]),
        'panels' => $this->layout('tiles', [
          $this->component('panel', ['title' => 'In progress', 'count' => 2], [
            'actions' => $this->component('link', ['label' => 'Add', 'href' => '#']),
            'content' => $this->layout('stack', [$task('Search results page'), $task('Image styles')]),
            'footer' => $this->component('link', ['label' => 'All tasks', 'href' => '#']),
          ]),
          $this->component('panel', ['title' => 'Blocked', 'count' => 0], [
            'content' => ['#markup' => '<p>Nothing is blocked.</p>'],
          ]),
          $this->component('panel', ['title' => '', 'count' => '']),
        ]),
      ]),
    ];
  }

  /**
   * Shows wave 2, second part: the parts the FlowDrop UI Catalog asked for.
   *
   * Each component shows a normal row, then a blank one (every optional prop
   * missing, then every text prop blank).
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function wave2SecondPart(): array {
    return [
      '#type' => 'container',
      '#attributes' => ['class' => ['ui-kit-showcase--wave2b']],
      'stack' => $this->layout('stack', [
        'heading' => ['#markup' => '<h2>Wave 2, second part</h2>'],
        'empty' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase-empty-state']],
          'tiles' => $this->layout('tiles', [
            $this->component('empty-state', [
              'title' => 'No runs yet',
              'heading_level' => 3,
              'description' => 'Runs show here once an import has started.',
            ], [
              'icon' => $this->component('icon', ['name' => 'info']),
              // The actions part wraps and centres its children itself.
              'actions' => [
                $this->component('link', ['label' => 'Start an import', 'href' => '#', 'appearance' => 'primary']),
                $this->component('link', ['label' => 'Read the guide', 'href' => '#']),
              ],
            ]),
            $this->component('panel', ['title' => 'Blocked', 'count' => 0], [
              'content' => $this->component('empty-state', [
                'title' => 'Nothing is blocked',
                'heading_level' => 3,
                'description' => 'Tasks that wait on someone show here.',
              ]),
            ]),
            $this->component('empty-state', ['title' => 'Minimal', 'heading_level' => 3]),
            $this->component('empty-state', ['title' => '', 'heading_level' => 3, 'description' => '']),
          ]),
        ],
        'breadcrumb' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase-breadcrumb']],
          'stack' => $this->layout('stack', [
            $this->component('breadcrumb', [
              'label' => 'Breadcrumb',
              'items' => [
                ['label' => 'Home', 'href' => '#'],
                ['label' => 'Projects', 'href' => '#projects'],
                ['label' => 'Website relaunch', 'href' => '#relaunch'],
                ['label' => 'Search results page and its very long title that wraps'],
              ],
            ]),
            $this->component('breadcrumb', [
              'label' => 'Breadcrumb, current page linked',
              'items' => [['label' => 'Runs', 'href' => '#runs'], ['label' => 'Run 12', 'href' => '#run-12']],
            ]),
            $this->component('breadcrumb', ['label' => 'Breadcrumb, one item', 'items' => [['label' => 'Home']]]),
            $this->component('breadcrumb', [
              'label' => '',
              'items' => [['label' => '', 'href' => '#'], ['label' => '0']],
            ]),
          ]),
        ],
        'side-navigation' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase-side-navigation']],
          'tiles' => $this->layout('tiles', [
            $this->component('side-navigation', [
              'label' => 'Project',
              'items' => [
                ['label' => 'Overview', 'href' => '#overview'],
                ['label' => 'Board', 'href' => '#board', 'current' => TRUE, 'count' => 12],
                ['label' => 'Runs', 'href' => '#runs', 'count' => 3],
                ['label' => 'Team and everyone who helps on the project', 'href' => '#team'],
                ['label' => 'Settings', 'href' => '#settings'],
              ],
            ]),
            $this->component('side-navigation', [
              'label' => 'Minimal',
              'items' => [['label' => 'Board', 'href' => '#board']],
            ]),
            $this->component('side-navigation', [
              'label' => '',
              'items' => [
                ['label' => '', 'href' => '#', 'count' => ''],
                ['label' => '0', 'href' => '#', 'current' => TRUE, 'count' => 0],
              ],
            ]),
          ]),
        ],
        'details' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase-details']],
          'stack' => $this->layout('stack', [
            $this->component('details', ['summary' => 'Run settings', 'open' => FALSE], [
              'content' => $this->component('description-list', [
                'items' => [
                  ['term' => 'Schedule', 'description' => 'Every night at 02:00'],
                  ['term' => 'Source', 'description' => 'Product feed'],
                ],
              ]),
            ]),
            $this->component('details', [
              'summary' => 'Why did this run fail? A summary long enough to wrap onto a second line',
              'open' => TRUE,
            ], [
              'content' => $this->component('text', ['text' => 'The product feed timed out after 30 seconds. The next run starts at 02:00.']),
            ]),
            $this->component('details', ['summary' => 'Minimal']),
            $this->component('details', ['summary' => '', 'open' => TRUE], [
              'content' => ['#markup' => ''],
            ]),
          ]),
        ],
        'spinner' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase-spinner']],
          'cluster' => $this->layout('cluster', [
            $this->component('spinner', ['label' => 'Loading']),
            $this->component('text', ['text' => 'Run activity']),
            [
              '#type' => 'html_tag',
              '#tag' => 'span',
              '#attributes' => ['style' => '--ui-kit-spinner-size: 2rem'],
              'spinner' => $this->component('spinner', ['label' => 'Loading the editor']),
            ],
            $this->component('spinner', ['label' => '']),
          ]),
        ],
      ]),
    ];
  }

  /**
   * Shows the props the FlowDrop gaps plan added to shipped components.
   *
   * Each part shows the new props, then a blank row (new props given blank).
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function additions(): array {
    $retry = $this->component('button', ['label' => 'Retry']);
    $log = $this->component('link', ['label' => 'Open the log', 'href' => '#']);
    $landscape = $this->component('image', [
      'src' => self::images() . '/landscape.svg',
      'alt' => '',
      'width' => 640,
      'height' => 360,
    ]);
    return [
      '#type' => 'container',
      '#attributes' => ['class' => ['ui-kit-showcase--additions']],
      'stack' => $this->layout('stack', [
        'heading' => ['#markup' => '<h2>Additions for FlowDrop</h2>'],
        'message' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase-message']],
          'stack' => $this->layout('stack', [
            $this->component('message', ['tone' => 'neutral', 'title' => 'Draft'], [
              'content' => ['#markup' => '<p>This workflow has changes that are not published yet.</p>'],
              'actions' => [
                $this->component('button', ['label' => 'Publish', 'appearance' => 'primary']),
                $this->component('link', ['label' => 'Compare versions', 'href' => '#']),
              ],
            ]),
            $this->component('message', ['tone' => 'danger', 'title' => 'Run failed'], [
              'content' => ['#markup' => '<p>Step 3 timed out after 30 seconds.</p>'],
              'actions' => [$retry, $log],
            ]),
            $this->component('message', ['tone' => 'neutral'], [
              'content' => ['#markup' => '<p>A neutral note without a title or actions.</p>'],
            ]),
            $this->component('message', ['tone' => 'neutral', 'title' => ''], [
              'content' => ['#markup' => ''],
              'actions' => ['#markup' => ''],
            ]),
          ]),
        ],
        'badge' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase-badge']],
          'stack' => $this->layout('stack', [
            $this->layout('cluster', array_map(
              fn (string $tone): array => $this->component('badge', [
                'label' => ucfirst($tone),
                'tone' => $tone,
                'dot' => TRUE,
              ]),
              self::TONES,
            )),
            $this->layout('cluster', [
              $this->component('badge', ['label' => 'Running', 'tone' => 'info', 'dot' => TRUE]),
              $this->component('badge', ['label' => 'Running', 'tone' => 'info']),
              $this->component('badge', ['label' => '', 'tone' => 'danger', 'dot' => TRUE]),
              $this->component('badge', ['label' => '0', 'tone' => 'success', 'dot' => TRUE]),
            ]),
          ]),
        ],
        'card' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase-card']],
          'tiles' => $this->layout('tiles', [
            ...array_map(
              fn (string $tone): array => $this->component('card', [
                'title' => ucfirst($tone) . ' workflow',
                'tone' => $tone,
                'description' => 'Imports products every night.',
              ], [
                'badges' => $this->component('badge', ['label' => ucfirst($tone), 'tone' => $tone, 'dot' => TRUE]),
                'actions' => $this->component('link', ['label' => 'Open', 'href' => '#']),
              ]),
              self::TONES,
            ),
            // Several children in one slot, no wrapper: the card spaces them
            // (composition study D-06).
            $this->component('card', ['title' => 'Nightly import', 'description' => 'Two children in the content slot.'], [
              'content' => [
                'badge' => $this->component('badge', ['label' => 'Healthy', 'tone' => 'success', 'dot' => TRUE]),
                'text' => ['#markup' => '<p>12 runs last night, none failed.</p>'],
              ],
              'actions' => $this->component('link', ['label' => 'Open', 'href' => '#']),
            ]),
            // Every region: media on top (read after the title), badges next
            // to the title, actions at the bottom edge, level with the
            // actions of the shorter cards in the row.
            $this->component('card', [
              'title' => 'Product feed',
              'description' => 'Imports the catalogue from the shop.',
            ], [
              'badges' => [
                $this->component('badge', ['label' => 'Healthy', 'tone' => 'success', 'dot' => TRUE]),
                $this->component('badge', ['label' => 'Nightly']),
              ],
              'media' => $this->component('frame', ['ratio' => '16-9'], [
                'content' => $landscape,
              ]),
              'content' => ['#markup' => '<p>12 runs last night, none failed.</p>'],
              'actions' => $this->component('link', ['label' => 'Open', 'href' => '#']),
            ]),
            $this->component('card', [
              'title' => 'Customer sync with a title long enough to push its badges onto the next line',
              'tone' => 'warning',
            ], [
              'badges' => $this->component('badge', ['label' => 'Slow', 'tone' => 'warning', 'dot' => TRUE]),
              'media' => $this->component('frame', ['ratio' => '16-9'], [
                'content' => $landscape,
              ]),
              'actions' => $this->component('link', ['label' => 'Open', 'href' => '#']),
            ]),
            $this->component('card', ['title' => '', 'tone' => 'danger', 'description' => ''], [
              'badges' => ['#markup' => ''],
              'media' => ['#markup' => ''],
              'content' => ['#markup' => ''],
              'actions' => ['#markup' => ''],
            ]),
          ]),
        ],
        'stat' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase-stat']],
          'tiles' => $this->layout('tiles', [
            $this->component('stat', [
              'label' => 'Finished runs',
              'value' => 128,
              'hint' => 'last 24 hours',
              'icon' => 'check',
            ]),
            $this->component('stat', [
              'label' => 'Failed runs',
              'value' => 3,
              'hint' => 'last 24 hours',
              'href' => '#failed',
              'tone' => 'danger',
              'status' => 'Needs attention',
              'icon' => 'error',
            ]),
            $this->component('stat', [
              'label' => 'Warnings',
              'value' => 7,
              'tone' => 'warning',
              'status' => 'Check',
              'icon' => 'warning',
            ]),
            $this->component('stat', ['label' => 'Runs', 'value' => 0, 'icon' => '']),
          ]),
        ],
      ]),
    ];
  }

  /**
   * The text sample: every element Basic HTML and Full HTML let editors use.
   */
  private const SAMPLE = <<<'HTML'
    <h2>Getting started with imports</h2>
    <p>An import reads a <strong>source</strong>, maps each row to <em>content</em> and saves it. Read the <a href="#guide">full guide</a>, or press <kbd>Ctrl</kbd> + <kbd>K</kbd> and type <code>import</code>. Rows that fail are <mark>marked for review</mark>, and H<sub>2</sub>O and E = mc<sup>2</sup> keep their place. <s>Old wording</s> and <u>underlined text</u> stay as written; <small>small print stays small</small>.</p>
    <h3>Before you start</h3>
    <ul>
      <li>A source file in CSV or JSON</li>
      <li>A mapping, with
        <ul><li>one field per column</li><li>a key for updates</li></ul>
      </li>
      <li>Permission to create content</li>
    </ul>
    <ol>
      <li>Upload the file.</li>
      <li>Check the preview.</li>
      <li>Run the import.</li>
    </ol>
    <blockquote><p>Run a small file first. It shows mapping errors in a minute instead of an hour.</p></blockquote>
    <h4>A mapping in code</h4>
    <pre><code>source:
      plugin: csv
      path: public://products.csv</code></pre>
    <hr>
    <h5>Columns</h5>
    <table>
      <caption>What each column holds</caption>
      <thead><tr><th>Column</th><th>Field</th><th>Required</th></tr></thead>
      <tbody>
        <tr><td>sku</td><td>Product code</td><td>Yes</td></tr>
        <tr><td>title</td><td>Title</td><td>Yes</td></tr>
        <tr><td>price</td><td>Price</td><td>No</td></tr>
      </tbody>
    </table>
    <h6>Terms</h6>
    <dl><dt>Source</dt><dd>Where the rows come from.</dd><dt>Mapping</dt><dd>Which column goes into which field.</dd></dl>
    <p class="text-align-center">This paragraph is centred in the editor.</p>
    <figure><img src="{images}/landscape.svg" alt="A placeholder landscape" width="640" height="360"><figcaption>An inline picture with its caption.</figcaption></figure>
    <p><img class="align-left" src="{images}/square.svg" alt="" width="96" height="96">A picture aligned to the start floats beside the text that follows it, the way CKEditor's alignment buttons place it. The text wraps around it until it runs past the picture's height, and the rich text block contains the float, so nothing below overlaps it.</p>
    HTML;

  /**
   * Shows the content components: headings, text, rich text, quote, divider.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function content(): array {
    $headings = [];
    foreach ([1, 2, 3, 4, 5, 6] as $level) {
      $headings["h$level"] = $this->component('heading', ['text' => "Heading level $level", 'level' => $level]);
    }
    // Level and look apart: an h4 that looks like a section title.
    $headings['h4-xl'] = $this->component('heading', ['text' => 'Level 4, size xl', 'level' => 4, 'size' => 'xl']);
    return [
      '#type' => 'container',
      '#attributes' => ['class' => ['ui-kit-showcase--content']],
      'stack' => $this->layout('stack', [
        'heading' => ['#markup' => '<h2>Content</h2>'],
        'headings' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase--headings']],
          'list' => $this->layout('stack', $headings),
        ],
        'text' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase--text']],
          'list' => $this->layout('stack', [
            $this->component('text', [
              'text' => 'A lead paragraph sits under a title and says what the page is for.',
              'size' => 'lead',
            ]),
            $this->component('text', ['text' => 'Body text is what people read: plain, at the base size, in the default text colour.']),
            $this->component('text', [
              'text' => 'Small, secondary text: a date, a hint or fine print.',
              'size' => 'small',
              'tone' => 'secondary',
            ]),
          ]),
        ],
        'rich-text' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase--rich-text']],
          'sample' => $this->component('rich-text', [], ['content' => ['#markup' => str_replace('{images}', self::images(), self::SAMPLE)]]),
        ],
        'quote' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase--quote']],
          'list' => $this->layout('stack', [
            $this->component('blockquote', [
              'attribution' => 'Mara Lind, release notes',
              'cite' => 'https://example.com/notes',
            ], [
              'content' => ['#markup' => '<p>We ship small, we ship often, and we write down why.</p>'],
            ]),
            $this->component('divider', []),
            $this->component('text', ['text' => 'After the divider.']),
          ]),
        ],
        'blank' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase--content-blank']],
          'list' => $this->layout('stack', [
            $this->component('heading', ['text' => '']),
            $this->component('text', ['text' => '']),
            $this->component('rich-text', []),
            $this->component('blockquote', ['attribution' => '']),
            $this->component('text', ['text' => '0', 'tone' => 'secondary']),
          ]),
        ],
      ]),
    ];
  }

  /**
   * Shows the media components: image, figure, frame and icon.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function media(): array {
    $images = self::images();
    $landscape = fn (string $alt = 'A placeholder landscape'): array => $this->component('image', [
      'src' => "$images/landscape.svg",
      'alt' => $alt,
      'width' => 1600,
      'height' => 900,
    ]);
    $frames = [];
    foreach (['16-9', '3-2', '4-3', '1-1'] as $ratio) {
      $frames[$ratio] = $this->component('figure', ['caption' => "Frame, ratio $ratio"], [
        'media' => [
          '#type' => 'component',
          '#component' => 'ui_kit:frame',
          '#props' => ['ratio' => $ratio],
          '#slots' => ['content' => $this->component('image', [
            'src' => "$images/portrait.svg",
            'alt' => '',
            'width' => 600,
            'height' => 900,
          ])],
        ],
      ]);
    }
    $icons = [];
    foreach (['check', 'warning', 'info', 'error', 'close', 'chevron', 'menu'] as $name) {
      $icons[$name] = $this->component('icon', ['name' => $name, 'label' => ucfirst($name)]);
    }
    return [
      '#type' => 'container',
      '#attributes' => ['class' => ['ui-kit-showcase--media']],
      // The normal rows and the blank row are a group (gap m).
      'sections' => $this->layout('stack', [
        'stack' => $this->layout('stack', [
          'heading' => ['#markup' => '<h2>Media</h2>'],
          'figure' => $this->component('figure', ['caption' => 'A figure holds any picture markup, here ui_kit:image, with its caption.'], [
            'media' => $landscape(),
          ]),
          // Markup as core's image style formatter renders it: a <picture> with
          // sources, from a field, into the figure's slot.
          'markup' => $this->component('figure', ['caption' => 'Markup from an image style, in the media slot.'], [
            'media' => ['#markup' => Markup::create('<div class="field__item"><picture><source srcset="' . $images . '/landscape.svg" type="image/svg+xml"><img src="' . $images . '/landscape.svg" alt="The same landscape, from an image style" width="1600" height="900" loading="lazy"></picture></div>')],
          ]),
          'frames' => $this->layout('tiles', $frames),
          'icons' => $this->layout('cluster', $icons),
          // The provider's icon markup and UI Kit's icon, each in a fixed box,
          // for a pixel comparison (content plan m2-e3). The provider side is
          // the markup its icon engine draws (as Drupal.ds.icon() returns it),
          // printed from design_system_icon(): the provider has no icon
          // component any more.
          'icon-compare' => $this->layout('cluster', array_map(fn (string $name): array => [
            '#type' => 'container',
            '#attributes' => ['class' => ['ui-kit-showcase-icon-pair'], 'data-icon' => $name],
            'provider' => [
              '#type' => 'container',
              '#attributes' => [
                'class' => ['ui-kit-showcase-icon-box', 'ui-kit-showcase-icon-box--provider'],
                'style' => 'display: inline-block; inline-size: 32px; block-size: 32px; font-size: 24px; line-height: 32px; text-align: center',
              ],
              'icon' => [
                '#type' => 'inline_template',
                '#template' => '{% set icon = design_system_icon(name) %}{% if icon %}<svg class="ds-icon" data-ds-icon="{{ name }}" viewBox="{{ icon.viewbox }}" aria-hidden="true" focusable="false">{{ icon.default }}{% for use in icon.uses %}<use class="ds-icon__skin" data-ds-icon-system="{{ use.system }}" href="{{ use.href }}"/>{% endfor %}</svg>{{ icon.cache }}{% endif %}',
                '#context' => ['name' => $name],
              ],
            ],
            'ui_kit' => [
              '#type' => 'container',
              '#attributes' => [
                'class' => ['ui-kit-showcase-icon-box', 'ui-kit-showcase-icon-box--ui-kit'],
                'style' => 'display: inline-block; inline-size: 32px; block-size: 32px; font-size: 24px; line-height: 32px; text-align: center',
              ],
              'icon' => $this->component('icon', ['name' => $name]),
            ],
          ], ['check', 'warning', 'info', 'error', 'close', 'chevron', 'menu'])),
          'button' => $this->component('button', ['label' => 'Done'], [
            'icon' => $this->component('icon', ['name' => 'check']),
          ]),
        ]),
        'blank' => [
          '#type' => 'container',
          '#attributes' => ['class' => ['ui-kit-showcase--media-blank']],
          'list' => $this->layout('stack', [
            $this->component('figure', []),
            $this->component('figure', ['caption' => ''], ['media' => $this->component('image', [
              'src' => "$images/square.svg",
              'alt' => '',
              'width' => 96,
              'height' => 96,
            ])]),
            $this->component('icon', ['name' => 'no-such-icon']),
          ]),
        ],
      ]),
    ];
  }

  /**
   * The URL path of the test module's sample pictures.
   */
  private static function images(): string {
    $modules = \Drupal::service('extension.list.module');
    assert($modules instanceof ModuleExtensionList);
    return Url::fromUserInput('/' . $modules->getPath('ui_kit_demo') . '/images')->toString();
  }

  /**
   * Builds a component render array.
   *
   * @param string $name
   *   The component's machine name, without ui_kit:.
   * @param array<string, mixed> $props
   *   The props.
   * @param array<string, mixed> $slots
   *   The slots.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function component(string $name, array $props, array $slots = []): array {
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
   *   The layout component: cluster, stack or tiles.
   * @param array<mixed> $content
   *   The children.
   * @param array<string, mixed> $props
   *   The layout's props, e.g. its gap.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function layout(string $name, array $content, array $props = []): array {
    return [
      '#type' => 'component',
      '#component' => 'ui_kit:' . $name,
      '#props' => $props,
      '#slots' => ['content' => $content],
    ];
  }

  /**
   * Builds the blank row: optional values missing, blank or zero.
   *
   * Components must look as good as they can with these (VERSIONING.md,
   * "Defaults and empty values").
   *
   * @return array{0: array<string, mixed>, 1: array<string, mixed>}
   *   The badges and the stats.
   */
  private function blank(): array {
    $badge = static fn (string $label, ?string $tone = NULL): array => [
      '#type' => 'component',
      '#component' => 'ui_kit:badge',
      '#props' => $tone === NULL ? ['label' => $label] : ['label' => $label, 'tone' => $tone],
    ];
    $stat = static fn (array $props): array => [
      '#type' => 'component',
      '#component' => 'ui_kit:stat',
      '#props' => $props,
    ];
    $badges = [
      'default-tone' => $badge('No tone'),
      'blank' => $badge(''),
      'zero' => $badge('0', 'info'),
    ];
    $stats = [
      'minimal' => $stat(['label' => 'Runs', 'value' => 12]),
      'null' => $stat(['label' => 'Runs', 'value' => 12, 'hint' => NULL, 'status' => NULL, 'href' => NULL]),
      'blank-parts' => $stat(['label' => 'Runs', 'value' => 12, 'hint' => '', 'status' => '', 'tone' => 'danger']),
      'blank-text' => $stat(['label' => '', 'value' => '', 'hint' => '', 'status' => '']),
      'zero' => $stat(['label' => 'Failed runs', 'value' => 0, 'hint' => '0', 'status' => '0', 'tone' => 'success']),
    ];
    return [$badges, $stats];
  }

  /**
   * Wraps one part of the showcase so it can be captured on its own.
   *
   * @param string $name
   *   The part's name.
   * @param array<string, mixed> $badges
   *   Badge render arrays.
   * @param array<string, mixed> $stats
   *   Stat render arrays.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function part(string $name, array $badges, array $stats): array {
    return [
      '#type' => 'container',
      '#attributes' => ['class' => ['ui-kit-showcase--' . $name]],
      // A heading with what follows it (related), then the badge row and the
      // tiles (group), per the gap rule of thumb in COMPONENTS.md.
      'stack' => $this->layout('stack', [
        'heading' => ['#markup' => '<h2>' . ucfirst($name) . ' values</h2>'],
        'parts' => $this->layout('stack', [
          'badges' => $this->layout('cluster', $badges),
          'stats' => $this->layout('tiles', $stats),
        ]),
      ], ['gap' => 's']),
    ];
  }

}
