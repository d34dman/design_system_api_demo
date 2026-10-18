<?php

declare(strict_types=1);

namespace Drupal\advaita_showcase\Controller;

use Drupal\Core\Access\AccessResultInterface;
use Drupal\Core\Cache\CacheableMetadata;
use Drupal\Core\Datetime\DateFormatterInterface;
use Drupal\Core\Datetime\FormattedDateDiff;
use Drupal\Core\DependencyInjection\AutowireTrait;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drupal\Core\Extension\ThemeHandlerInterface;
use Drupal\Core\Language\LanguageManagerInterface;
use Drupal\Core\Url;
use Drupal\design_system_api\Binding\Binding;
use Drupal\design_system_api\ContextCss;
use Drupal\design_system_api\Skin\SkinRegistry;
use Drupal\node\NodeInterface;
use Symfony\Component\Routing\Exception\RouteNotFoundException;

/**
 * The dashboard: every figure on it is read from the site.
 *
 * Queries are access-checked and ranged, and every title shown is one the
 * viewer may see: an item whose access is denied is left out, an operation
 * link the viewer can't follow is not offered. The page is cached by the
 * content and media lists, the bindings and the access results it used; the
 * "… ago" texts set its maximum age.
 */
final class DashboardController implements ContainerInjectionInterface {

  use AutowireTrait;

  /**
   * Rows in the recently updated table, items in the review list.
   */
  private const LIMIT = 5;

  /**
   * Revisions on the activity timeline.
   */
  private const ACTIVITY = 6;

  /**
   * The cacheability of everything the page used.
   */
  private CacheableMetadata $cache;

  public function __construct(
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly DateFormatterInterface $dateFormatter,
    private readonly ContextCss $contextCss,
    private readonly ThemeHandlerInterface $themeHandler,
    private readonly Binding $binding,
    private readonly SkinRegistry $skins,
    private readonly LanguageManagerInterface $languageManager,
  ) {
    $this->cache = new CacheableMetadata();
  }

  /**
   * Builds the dashboard.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public function build(): array {
    $this->cache = (new CacheableMetadata())
      ->addCacheTags(['node_list', 'media_list', 'config:configurable_language_list', ...ContextCss::CACHE_TAGS])
      ->addCacheContexts(['user.permissions', 'user.node_grants:view']);

    $nodes = $this->entityTypeManager->getStorage('node');
    $published = (int) $nodes->getQuery()->accessCheck(TRUE)->condition('status', 1)->count()->execute();
    $all = (int) $nodes->getQuery()->accessCheck(TRUE)->count()->execute();
    [$draft_count, $drafts] = $this->drafts();
    $media = (int) $this->entityTypeManager->getStorage('media')->getQuery()->accessCheck(TRUE)->count()->execute();
    [$no_alt_count, $no_alt] = $this->imagesWithoutAlt();
    $languages = array_map(fn ($language) => $language->getName(), $this->languageManager->getLanguages());

    $build = [
      'stats' => [
        '#type' => 'container',
        '#attributes' => ['class' => ['dashboard-stats']],
        'published' => $this->stat('Published', (string) $published, sprintf('of %d content items', $all), $this->href('system.admin_content')),
        'review' => $this->stat('Waiting for review', (string) $draft_count, $draft_count ? 'Drafts with a newer revision than the live one' : 'Nothing to review', $this->href('content_moderation.admin_moderated_content'), $draft_count ? 'warning' : 'success', $draft_count ? 'Needs review' : 'Clear'),
        'media' => $this->stat('Media items', (string) $media, sprintf('%d without alternative text', $no_alt_count), $this->href('entity.media.collection'), $no_alt_count ? 'danger' : 'success', $no_alt_count ? 'Missing alt text' : 'All described'),
        'languages' => $this->stat('Languages', (string) count($languages), 'Content in ' . implode(' and ', $languages), NULL),
      ],
      'grid' => [
        '#type' => 'container',
        '#attributes' => ['class' => ['dashboard']],
        'recent' => $this->panel('Recently updated', 'The most recent changes to content.', $this->recentTable(), '2', $this->href('system.admin_content') === NULL ? [] : [
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
            'heading' => $no_alt_count ? 'Some images have no alternative text' : 'Every image has alternative text',
            'text' => sprintf('%d media items checked.', $media),
            'tone' => $no_alt_count ? 'danger' : 'success',
          ],
        ], '1'),
        'activity' => $this->panel('Activity', 'Latest revisions, newest first.', $this->activity(), 'full'),
      ],
    ];
    $this->cache->applyTo($build);
    /** @var array<string, mixed> $build */
    return $build;
  }

  /**
   * The URL of a route the viewer may open, or NULL.
   *
   * NULL as well for a route that doesn't exist (the moderation list without
   * Content Moderation).
   */
  private function href(string $route): ?string {
    try {
      $url = Url::fromRoute($route);
      $access = $url->access(NULL, TRUE);
    }
    catch (RouteNotFoundException) {
      return NULL;
    }
    $this->cache->addCacheableDependency($access);
    return $access->isAllowed() ? $url->toString() : NULL;
  }

  /**
   * Whether an access result allows, recording its cacheability.
   */
  private function allowed(AccessResultInterface $access): bool {
    $this->cache->addCacheableDependency($access);
    return $access->isAllowed();
  }

  /**
   * The time since a timestamp ("3 hours ago"), lowering the maximum age.
   */
  private function ago(int $timestamp): string {
    $diff = $this->dateFormatter->formatTimeDiffSince($timestamp, ['return_as_object' => TRUE]);
    if (!$diff instanceof FormattedDateDiff) {
      return $diff . ' ago';
    }
    $this->cache->addCacheableDependency($diff);
    return $diff->getString() . ' ago';
  }

  /**
   * Loaded revisions in the order their IDs were queried.
   *
   * @param array<int|string, \Drupal\Core\Entity\RevisionableInterface> $revisions
   *   Revisions keyed by revision ID, in any order.
   * @param array<int|string> $vids
   *   Revision IDs in the wanted order.
   *
   * @return list<\Drupal\Core\Entity\RevisionableInterface>
   *   The revisions that loaded, in that order.
   */
  private function inOrder(array $revisions, array $vids): array {
    return array_values(array_filter(array_map(fn ($vid) => $revisions[$vid] ?? NULL, $vids)));
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
   * Nodes whose latest revision is newer than their default one.
   *
   * Two ID-only queries find them; only the newest few are loaded, and of
   * those only the ones whose latest version the viewer may open.
   *
   * @return array{int, list<\Drupal\node\NodeInterface>}
   *   The number of drafts, and the newest ones at their latest revision.
   */
  private function drafts(): array {
    /** @var \Drupal\Core\Entity\RevisionableStorageInterface $storage */
    $storage = $this->entityTypeManager->getStorage('node');
    // Both keyed by revision ID.
    $latest = $storage->getQuery()->accessCheck(TRUE)->latestRevision()->execute();
    $default = $storage->getQuery()->accessCheck(TRUE)->execute();
    $vids = array_keys(array_diff_key($latest, $default));
    rsort($vids);
    $newest = array_slice($vids, 0, self::LIMIT);
    $drafts = [];
    foreach ($this->inOrder($storage->loadMultipleRevisions($newest), $newest) as $draft) {
      if ($draft instanceof NodeInterface && $this->allowed(Url::fromRoute('entity.node.latest_version', ['node' => $draft->id()])->access(NULL, TRUE))) {
        $drafts[] = $draft;
      }
    }
    return [count($vids), $drafts];
  }

  /**
   * Image media whose source image has no alternative text.
   *
   * @return array{int, list<\Drupal\media\MediaInterface>}
   *   How many there are, and the first few the viewer may see.
   */
  private function imagesWithoutAlt(): array {
    $storage = $this->entityTypeManager->getStorage('media');
    $count = 0;
    $items = [];
    foreach ($this->entityTypeManager->getStorage('media_type')->loadMultiple() as $type) {
      $field = $type->getSource()->getSourceFieldDefinition($type);
      if ($field === NULL || $field->getType() !== 'image') {
        continue;
      }
      $this->cache->addCacheableDependency($type);
      $query = static function () use ($storage, $type, $field) {
        $query = $storage->getQuery()->accessCheck(TRUE)->condition('bundle', $type->id());
        $missing = $query->orConditionGroup()
          ->notExists($field->getName() . '.alt')
          ->condition($field->getName() . '.alt', '');
        return $query->condition($missing);
      };
      $count += (int) $query()->count()->execute();
      $ids = $query()->sort('changed', 'DESC')->range(0, self::LIMIT)->execute();
      foreach ($storage->loadMultiple($ids) as $media) {
        if ($this->allowed($media->access('view', NULL, TRUE))) {
          $items[] = $media;
        }
      }
    }
    return [$count, array_slice($items, 0, self::LIMIT)];
  }

  /**
   * The recently updated table: core's table, badges from the theme.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function recentTable(): array {
    $storage = $this->entityTypeManager->getStorage('node');
    // A few more than shown, for the ones the viewer may not see.
    $ids = $storage->getQuery()->accessCheck(TRUE)->sort('changed', 'DESC')->range(0, self::LIMIT * 2)->execute();
    $rows = [];
    foreach ($storage->loadMultiple($ids) as $node) {
      if (!$this->allowed($node->access('view', NULL, TRUE))) {
        continue;
      }
      $links = [];
      $operations = [
        'edit' => ['Edit', 'update', 'edit-form'],
        'revisions' => ['Revisions', 'view all revisions', 'version-history'],
        'delete' => ['Delete', 'delete', 'delete-form'],
      ];
      foreach ($operations as $key => [$title, $operation, $rel]) {
        if ($this->allowed($node->access($operation, NULL, TRUE))) {
          $links[$key] = ['title' => $title, 'url' => $node->toUrl($rel)];
        }
      }
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
        $this->ago((int) $node->getChangedTime()),
        ['data' => ['#type' => 'operations', '#links' => $links]],
      ];
      if (count($rows) === self::LIMIT) {
        break;
      }
    }
    return [
      '#type' => 'table',
      '#header' => ['Title', 'Type', 'Status', 'Updated', 'Operations'],
      '#rows' => $rows,
      '#empty' => 'No content yet.',
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
      $author = $draft->getRevisionUser();
      if ($author) {
        $this->cache->addCacheableDependency($author);
      }
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
              'label' => ucfirst(($draft->hasField('moderation_state') ? $draft->get('moderation_state')->getString() : '') ?: 'draft'),
              'tone' => 'warning',
            ],
          ],
          'meta' => sprintf('By %s, %s', $author?->getDisplayName() ?? 'unknown', $this->ago((int) $draft->getRevisionCreationTime())),
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
   * The latest revisions across content the viewer may see.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function activity(): array {
    /** @var \Drupal\Core\Entity\RevisionableStorageInterface $storage */
    $storage = $this->entityTypeManager->getStorage('node');
    $vids = $storage->getQuery()->accessCheck(TRUE)->allRevisions()->sort('changed', 'DESC')->range(0, self::ACTIVITY * 2)->execute();
    $items = [];
    foreach ($this->inOrder($storage->loadMultipleRevisions(array_keys($vids)), array_keys($vids)) as $revision) {
      if (!$revision instanceof NodeInterface
        || !$this->allowed($revision->access($revision->isDefaultRevision() ? 'view' : 'view revision', NULL, TRUE))) {
        continue;
      }
      $items[] = [
        'time' => $this->dateFormatter->format((int) $revision->getRevisionCreationTime(), 'custom', 'j M, H:i'),
        'datetime' => $this->dateFormatter->format((int) $revision->getRevisionCreationTime(), 'custom', 'c'),
        'text' => sprintf('%s “%s”', $revision->wasDefaultRevision() ? 'Published' : 'Saved a draft of', $revision->label()),
        'meta' => trim((string) $revision->getRevisionLogMessage()) ?: sprintf('%s, %s', $revision->type->entity?->label(), $revision->language()->getName()),
      ];
      if (count($items) === self::ACTIVITY) {
        break;
      }
    }
    return ['#type' => 'component', '#component' => 'advaita:timeline', '#props' => ['items' => $items]];
  }

}
