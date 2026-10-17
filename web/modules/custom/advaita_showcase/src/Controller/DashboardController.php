<?php

declare(strict_types=1);

namespace Drupal\advaita_showcase\Controller;

use Drupal\Core\Datetime\DateFormatterInterface;
use Drupal\Core\DependencyInjection\AutowireTrait;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Extension\ThemeHandlerInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\Url;
use Drupal\design_system_api\Binding\Binding;
use Drupal\design_system_api\ContextCss;
use Drupal\design_system_api\Skin\SkinRegistry;

/**
 * The dashboard: every figure on it is read from the site.
 */
final class DashboardController implements ContainerInjectionInterface {

  use AutowireTrait;

  public function __construct(
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly DateFormatterInterface $dateFormatter,
    private readonly ContextCss $contextCss,
    private readonly ThemeHandlerInterface $themeHandler,
    private readonly Binding $binding,
    private readonly SkinRegistry $skins,
    private readonly LanguageManagerInterface $languageManager,
  ) {}

  /**
   * Builds the dashboard.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public function build(): array {
    $nodes = $this->entityTypeManager->getStorage('node');
    $published = (int) $nodes->getQuery()->accessCheck(FALSE)->condition('status', 1)->count()->execute();
    $all = (int) $nodes->getQuery()->accessCheck(FALSE)->count()->execute();
    $drafts = $this->drafts();
    $media = (int) $this->entityTypeManager->getStorage('media')->getQuery()->accessCheck(FALSE)->count()->execute();
    $no_alt = $this->imagesWithoutAlt();

    $build = [
      '#cache' => ['tags' => ['node_list', 'media_list'], 'max-age' => 0],
      'stats' => [
        '#type' => 'container',
        '#attributes' => ['class' => ['dashboard-stats']],
        'published' => $this->stat('Published', (string) $published, sprintf('of %d content items', $all), Url::fromRoute('system.admin_content')->toString()),
        'review' => $this->stat('Waiting for review', (string) count($drafts), count($drafts) ? 'Drafts with a newer revision than the live one' : 'Nothing to review', Url::fromRoute('content_moderation.admin_moderated_content')->toString(), count($drafts) ? 'warning' : 'success', count($drafts) ? 'Needs review' : 'Clear'),
        'media' => $this->stat('Media items', (string) $media, sprintf('%d without alternative text', count($no_alt)), Url::fromRoute('entity.media.collection')->toString(), count($no_alt) ? 'danger' : 'success', count($no_alt) ? 'Missing alt text' : 'All described'),
        'languages' => $this->stat('Languages', (string) count($this->languageManager->getLanguages()), 'Content in English and Arabic', NULL),
      ],
      'grid' => [
        '#type' => 'container',
        '#attributes' => ['class' => ['dashboard']],
        'recent' => $this->panel('Recently updated', 'The five most recent changes to content.', $this->recentTable(), '2', [
          '#type' => 'link',
          '#title' => 'All content',
          '#url' => Url::fromRoute('system.admin_content'),
          '#attributes' => ['class' => ['ds-button', 'ds-button--small']],
        ]),
        'review' => $this->panel('Review queue', 'Drafts waiting to be published.', $this->reviewList($drafts), '1'),
        'systems' => $this->panel('Design systems on this site', 'Both are Advaita: one set of components, two sets of tokens.', $this->systems(), '2'),
        'alt' => $this->panel('Accessibility', 'Images every visitor can perceive.', $no_alt ? [
          '#theme' => 'item_list',
          '#items' => array_map(fn ($m) => $m->toLink()->toRenderable(), $no_alt),
        ] : [
          '#type' => 'component',
          '#component' => 'advaita:empty-state',
          '#props' => [
            'heading' => 'Every image has alternative text',
            'text' => sprintf('All %d media items checked.', $media),
            'tone' => 'success',
          ],
        ], '1'),
        'activity' => $this->panel('Activity', 'Latest revisions, newest first.', $this->activity(), 'full'),
      ],
    ];
    return $build;
  }

  /**
   * A stat component.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function stat(string $label, string $value, string $hint, ?string $href, string $tone = 'neutral', ?string $status = NULL): array {
    return [
      '#type' => 'component',
      '#component' => 'advaita:stat',
      '#props' => [
        'label' => $label,
        'value' => $value,
        'hint' => $hint,
        'href' => $href,
        'tone' => $tone,
        'status' => $status,
      ],
    ];
  }

  /**
   * A panel component.
   *
   * @param string $heading
   *   The heading.
   * @param string $description
   *   The description.
   * @param array<string, mixed> $content
   *   The content.
   * @param string $span
   *   Columns to span.
   * @param array<string, mixed> $actions
   *   Header actions.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function panel(string $heading, string $description, array $content, string $span, array $actions = []): array {
    return [
      '#type' => 'component',
      '#component' => 'advaita:panel',
      '#props' => ['heading' => $heading, 'description' => $description, 'span' => $span],
      '#slots' => array_filter(['content' => $content, 'actions' => $actions]),
    ];
  }

  /**
   * The latest revision of each node that is newer than its default one.
   *
   * @return list<\Drupal\node\NodeInterface>
   *   Nodes, at their latest revision.
   */
  private function drafts(): array {
    $storage = $this->entityTypeManager->getStorage('node');
    $drafts = [];
    foreach ($storage->loadMultiple() as $node) {
      $latest = $storage->getLatestRevisionId($node->id());
      if ($latest !== NULL && (int) $latest !== (int) $node->getRevisionId()) {
        $drafts[] = $storage->loadRevision($latest);
      }
    }
    return array_values(array_filter($drafts));
  }

  /**
   * Image media whose source image has no alternative text.
   *
   * @return list<\Drupal\media\MediaInterface>
   *   Media entities.
   */
  private function imagesWithoutAlt(): array {
    $out = [];
    foreach ($this->entityTypeManager->getStorage('media')->loadMultiple() as $media) {
      $field = $media->getSource()->getConfiguration()['source_field'] ?? NULL;
      if ($field && $media->hasField($field) && $media->get($field)->getFieldDefinition()->getType() === 'image' && trim((string) $media->get($field)->alt) === '') {
        $out[] = $media;
      }
    }
    return $out;
  }

  /**
   * The recently updated table: core's table, badges from the theme.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function recentTable(): array {
    $storage = $this->entityTypeManager->getStorage('node');
    $ids = $storage->getQuery()->accessCheck(FALSE)->sort('changed', 'DESC')->range(0, 5)->execute();
    $rows = [];
    foreach ($storage->loadMultiple($ids) as $node) {
      /** @var \Drupal\node\NodeInterface $node */
      $rows[] = [
        ['data' => $node->toLink()->toRenderable()],
        $node->type->entity?->label(),
        ['data' => [
          '#type' => 'component',
          '#component' => 'advaita:badge',
          '#props' => $node->isPublished()
            ? ['label' => 'Published', 'tone' => 'success']
            : ['label' => 'Unpublished', 'tone' => 'neutral'],
        ]],
        $this->dateFormatter->formatTimeDiffSince($node->getChangedTime()) . ' ago',
        ['data' => [
          '#type' => 'operations',
          '#links' => [
            'edit' => ['title' => 'Edit', 'url' => $node->toUrl('edit-form')],
            'revisions' => ['title' => 'Revisions', 'url' => $node->toUrl('version-history')],
            'delete' => ['title' => 'Delete', 'url' => $node->toUrl('delete-form')],
          ],
        ]],
      ];
    }
    return [
      '#type' => 'table',
      '#header' => ['Title', 'Type', 'Status', 'Updated', 'Operations'],
      '#rows' => $rows,
    ];
  }

  /**
   * The review queue.
   *
   * @param list<\Drupal\node\NodeInterface> $drafts
   *   Drafts.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function reviewList(array $drafts): array {
    if (!$drafts) {
      return [
        '#type' => 'component',
        '#component' => 'advaita:empty-state',
        '#props' => ['heading' => 'Nothing to review', 'text' => 'New drafts show up here.', 'tone' => 'success'],
      ];
    }
    $items = [];
    foreach ($drafts as $draft) {
      $items[] = [
        '#type' => 'inline_template',
        '#template' => '<div class="review-item"><a href="{{ url }}">{{ title }}</a> {{ badge }}<div class="review-item__meta">{{ meta }}</div></div>',
        '#context' => [
          'url' => Url::fromRoute('entity.node.latest_version', ['node' => $draft->id()])->toString(),
          'title' => $draft->label(),
          'badge' => [
            '#type' => 'component',
            '#component' => 'advaita:badge',
            '#props' => [
              'label' => ucfirst((string) ($draft->moderation_state->value ?? 'draft')),
              'tone' => 'warning',
            ],
          ],
          'meta' => sprintf('By %s, %s ago', $draft->getRevisionUser()?->getDisplayName() ?? 'unknown', $this->dateFormatter->formatTimeDiffSince($draft->getRevisionCreationTime())),
        ],
      ];
    }
    return ['#theme' => 'item_list', '#items' => $items, '#attributes' => ['class' => ['review-list']]];
  }

  /**
   * One card per design system, each drawn in its own tokens.
   *
   * Each card names the skin its context is bound to (drush ds:binding).
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function systems(): array {
    $cards = [];
    $theme = $this->themeHandler->getDefault();
    $bindings = $this->binding->effective();
    $systems = [
      'site' => ['site', 'Site', 'Articles, landing pages, everything visitors see.'],
      'admin' => ['chrome', 'Admin', 'This dashboard, forms, lists, Media Library.'],
    ];
    foreach ($systems as $system => [$context, $name, $summary]) {
      $bound = $bindings[$context];
      $result = $bound->skin === NULL ? $this->contextCss->resolveAll($theme, $bound->role()) : $this->contextCss->resolveBinding($bound);
      $base = $result['values']['base'] ?? [];
      $faces = array_unique(array_filter([
        $this->typeface($base['font.family.heading'] ?? ''),
        $this->typeface($base['font.family.base'] ?? ''),
      ]));
      $face = implode(' / ', $faces);
      $name .= ': ' . ($bound->skin === NULL ? 'theme' : ($this->skins->get($bound->skin)?->label() ?? $bound->skin));
      $cards[] = [
        '#type' => 'component',
        '#component' => 'advaita:system-card',
        '#props' => [
          'name' => $name,
          'system' => $system,
          'summary' => $summary,
          'typeface' => $face === '' ? NULL : $face,
          'tokens' => count($result['values']['base'] ?? []),
          'problems' => count($result['problems']),
        ],
      ];
    }
    return [
      '#type' => 'component',
      '#component' => 'design_system_api:tiles',
      '#props' => ['gap' => 's', 'min' => 'l'],
      '#slots' => ['content' => $cards],
    ];
  }

  /**
   * The first family of a font stack, named for people.
   *
   * A stack that starts with the platform's own font (-apple-system,
   * system-ui and the like) is the system font, whatever comes after it.
   *
   * @param string $stack
   *   A resolved font.family value, e.g. "Fraunces, Georgia, serif".
   *
   * @return string
   *   The first family ("Fraunces"), "System UI", or '' for an empty stack.
   */
  private function typeface(string $stack): string {
    $first = trim(explode(',', $stack)[0], " \t\n\"'");
    if ($first === '') {
      return '';
    }
    $system = [
      '-apple-system', 'blinkmacsystemfont', 'system-ui', 'ui-sans-serif', 'ui-serif',
      'ui-monospace', 'ui-rounded', 'sans-serif', 'serif', 'monospace',
    ];
    return in_array(strtolower($first), $system, TRUE) ? 'System UI' : $first;
  }

  /**
   * The latest revisions across content.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function activity(): array {
    $storage = $this->entityTypeManager->getStorage('node');
    $ids = $storage->getQuery()->accessCheck(FALSE)->allRevisions()->sort('changed', 'DESC')->range(0, 6)->execute();
    $items = [];
    foreach (array_keys($ids) as $vid) {
      $revision = $storage->loadRevision($vid);
      if (!$revision) {
        continue;
      }
      /** @var \Drupal\node\NodeInterface $revision */
      $items[] = [
        'time' => $this->dateFormatter->format($revision->getRevisionCreationTime(), 'custom', 'j M, H:i'),
        'datetime' => $this->dateFormatter->format($revision->getRevisionCreationTime(), 'custom', 'c'),
        'text' => sprintf('%s “%s”', $revision->isDefaultRevision() ? 'Published' : 'Saved a draft of', $revision->label()),
        'meta' => trim((string) $revision->getRevisionLogMessage()) ?: sprintf('%s, %s', $revision->type->entity?->label(), $revision->language()->getName()),
      ];
    }
    return ['#type' => 'component', '#component' => 'advaita:timeline', '#props' => ['items' => $items]];
  }

}
