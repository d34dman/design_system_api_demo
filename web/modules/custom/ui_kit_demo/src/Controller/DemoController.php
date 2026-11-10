<?php

declare(strict_types=1);

namespace Drupal\ui_kit_demo\Controller;

use Drupal\Core\DependencyInjection\AutowireTrait;
use Drupal\Core\DependencyInjection\ContainerInjectionInterface;
use Drupal\Core\Extension\ModuleExtensionList;
use Drupal\Core\Form\FormBuilderInterface;
use Drupal\Core\Url;
use Drupal\ui_kit_demo\Build;
use Drupal\ui_kit_demo\Form\ArticleForm;
use Drupal\ui_kit_demo\Form\ChatForm;
use Drupal\ui_kit_demo\Form\LoginForm;
use Drupal\ui_kit_demo\Gaps;
use Drupal\ui_kit_demo\StandIn;
use Symfony\Component\HttpFoundation\RequestStack;

/**
 * The demo's screens, built from UI Kit components and sample data.
 *
 * Each screen is returned as a whole page (#type page), so the theme's blocks
 * (title, tabs, menus) stay out and the screen looks like an app. Parts UI Kit
 * doesn't ship are drawn by StandIn; ?gaps=1 outlines them.
 */
final class DemoController implements ContainerInjectionInterface {

  use AutowireTrait;

  /**
   * The screens in the app navigation: route => label.
   */
  private const SCREENS = [
    'ui_kit_demo.home' => 'Home',
    'ui_kit_demo.content' => 'Content',
    'ui_kit_demo.projects' => 'Projects',
    'ui_kit_demo.article' => 'New article',
    'ui_kit_demo.login' => 'Sign out',
  ];

  public function __construct(
    private readonly FormBuilderInterface $formBuilder,
    private readonly RequestStack $requestStack,
    private readonly ModuleExtensionList $moduleList,
  ) {}

  /**
   * The home screen: what the demo is, its screens and what's missing.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public function home(): array {
    $screens = [
      ['ui_kit_demo.login', 'Sign-in', 'A centered card with a form: the first screen of an app.'],
      [
        'ui_kit_demo.content',
        'Content dashboard',
        'Figures, a chart, a table and recent activity for a site\'s content.',
      ],
      ['ui_kit_demo.projects', 'Project dashboard', 'A task board, milestones and a team chat.'],
      ['ui_kit_demo.article', 'Form', 'A typical editing form with a breadcrumb and messages.'],
      [
        'ui_kit_demo.article_preview',
        'Article preview',
        'An article as readers see it: headings, rich text, pictures and a quote.',
      ],
    ];
    $cards = [];
    foreach ($screens as [$route, $title, $description]) {
      $cards[] = Build::component('card', ['title' => $title, 'description' => $description], [
        'actions' => Build::component('link', [
          'label' => 'Open ' . mb_strtolower($title),
          'href' => $this->url($route),
          'appearance' => 'secondary',
        ]),
      ]);
    }
    $rows = [];
    foreach (Gaps::ALL as $gap) {
      $rows[] = [$gap['part'], $gap['candidate'], $gap['screens']];
    }
    $main = Build::layout('stack', [
      Build::component('page-header', [
        'title' => 'UI Kit demo',
        'description' => 'A sample app built from UI Kit components, with sample data. Click through it to see the components in use.',
      ], [
        'actions' => Build::component('link', [
          'label' => 'Start at sign-in',
          'href' => $this->url('ui_kit_demo.login'),
          'appearance' => 'primary',
        ]),
      ]),
      Build::component('message', ['tone' => 'info', 'title' => 'Nothing here is real'], [
        'content' => ['#markup' => '<p>The figures, people and messages are made up, and no form stores what you enter.</p>'],
      ]),
      Build::row([
        Build::component('stat', ['label' => 'Screens', 'value' => count($screens) + 1]),
        Build::component('stat', ['label' => 'UI Kit components in use', 'value' => 35]),
        Build::component('stat', [
          'label' => 'Parts UI Kit lacks',
          'value' => count(Gaps::ALL),
          'hint' => 'drawn by stand-ins',
          'tone' => 'warning',
          'status' => 'Gaps',
        ]),
      ]),
      Build::section('Screens', Build::row($cards)),
      Build::section(
        'What the demo needs that UI Kit lacks',
        Build::component('table', [
          'caption' => 'Parts drawn by stand-ins',
          'headers' => ['Part', 'Becomes', 'Screens'],
          'rows' => $rows,
        ]),
        'Each part is drawn by a plain stand-in. "Show what\'s missing" outlines them on every screen. The demo counts as a consumer for these candidates (UI Kit\'s COMPONENTS.md).',
      ),
    ], ['gap' => 'xl']);
    return $this->shell('ui_kit_demo.home', 'UI Kit demo', $main);
  }

  /**
   * The sign-in screen: a card with the form, without the app navigation.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public function login(): array {
    // A card's heading starts at h2; the page's h1 is a page header above it.
    $card = Build::component('card', [
      'title' => 'Your account',
      'heading_level' => 2,
      'description' => 'Demo screen: any address and password work, and nothing is sent or kept.',
    ], [
      'content' => StandIn::form($this->formBuilder->getForm(LoginForm::class)),
      'actions' => [
        Build::component('link', ['label' => 'Forgot your password?', 'href' => $this->url('ui_kit_demo.login')]),
        Build::component('link', ['label' => 'Back to the demo', 'href' => $this->url('ui_kit_demo.home')]),
      ],
    ]);
    $content = [
      '#type' => 'container',
      '#attributes' => ['class' => $this->rootClasses('ui-kit-demo--login')],
      'main' => $this->main([
        ['#markup' => '<p class="ui-kit-demo-brand"><span class="ui-kit-demo-brand__mark" aria-hidden="true"></span>UI Kit demo</p>'],
        ['#type' => 'status_messages'],
        Build::component('page-header', [
          'title' => 'Sign in',
          'description' => 'Welcome back. Sign in to see your dashboards.',
        ]),
        $card,
      ], 'ui-kit-demo-login'),
    ];
    return $this->page('Sign in', $content);
  }

  /**
   * Dashboard one: how a site's content is doing.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public function content(): array {
    $saved = $this->query('saved')
      ? Build::component('message', ['tone' => 'success', 'title' => 'Article saved'], [
        'content' => ['#markup' => '<p>In this demo nothing is stored, so it doesn\'t show up below.</p>'],
      ])
      : [];
    $periods = [];
    foreach (['7 days', '30 days', '90 days'] as $period) {
      $periods[] = ['label' => $period, 'href' => $this->url('ui_kit_demo.content'), 'current' => $period === '30 days'];
    }
    $views = [
      '25 Oct' => 1240,
      '26 Oct' => 1580,
      '27 Oct' => 1490,
      '28 Oct' => 1720,
      '29 Oct' => 1310,
      '30 Oct' => 640,
      '31 Oct' => 590,
      '1 Nov' => 1380,
      '2 Nov' => 1660,
      '3 Nov' => 1810,
      '4 Nov' => 1950,
      '5 Nov' => 1420,
      '6 Nov' => 710,
      '7 Nov' => 680,
    ];
    $by_type = [];
    foreach ([
      ['Article', 812, 'info'],
      ['Basic page', 241, 'info'],
      ['Event', 156, 'success'],
      ['Press release', 75, 'warning'],
    ] as [$type, $count, $tone]) {
      $by_type[] = Build::component('progress', [
        'label' => $type,
        'value' => $count,
        'max' => 1284,
        'value_text' => number_format($count),
        'tone' => $tone,
      ]);
    }
    $main = Build::layout('stack', [
      $saved,
      Build::component('page-header', [
        'title' => 'Content',
        'description' => 'How the site\'s content is doing.',
      ], [
        'actions' => [
          Build::component('button', ['label' => 'Export']),
          Build::component('link', [
            'label' => 'New article',
            'href' => $this->url('ui_kit_demo.article'),
            'appearance' => 'primary',
          ]),
        ],
      ]),
      Build::component('tab-navigation', ['label' => 'Period', 'items' => $periods]),
      Build::row([
        Build::component('stat', ['label' => 'Published', 'value' => '1,284', 'hint' => '38 more than last month']),
        Build::component('stat', ['label' => 'Drafts', 'value' => 46, 'hint' => '9 older than a month']),
        Build::component('stat', [
          'label' => 'Waiting for review',
          'value' => 12,
          'hint' => 'oldest: 6 days',
          'tone' => 'warning',
          'status' => 'Behind',
          'icon' => 'warning',
        ]),
        Build::component('stat', [
          'label' => 'Broken links',
          'value' => 3,
          'hint' => 'found last night',
          'tone' => 'danger',
          'status' => 'Fix',
          'icon' => 'error',
        ]),
      ]),
      Build::columns(
        Build::component('card', [
          'title' => 'Views per day',
          'heading_level' => 2,
          'description' => '20,180 views in the last 14 days, 12 % more than the 14 before.',
        ], ['content' => StandIn::chart('Views per day, last 14 days', $views, 'views')]),
        Build::component('card', [
          'title' => 'Published by type',
          'heading_level' => 2,
        ], ['content' => Build::layout('stack', $by_type, ['gap' => 's'])]),
      ),
      Build::section('Most viewed', Build::layout('stack', [
        Build::component('table', [
          'caption' => 'Most viewed content, last 30 days',
          'headers' => ['Title', 'Type', 'Views', 'Updated'],
          'rows' => [
            ['Getting started with design tokens', 'Article', '4,812', '2 Nov'],
            ['Spring conference: the programme', 'Event', '3,940', '28 Oct'],
            ['Accessibility statement', 'Basic page', '2,615', '14 Sep'],
            ['Ten years of the newsroom', 'Article', '2,201', '5 Nov'],
            ['New partners announced', 'Press release', '1,977', '30 Oct'],
          ],
        ]),
        Build::component('pagination', [
          'label' => 'Pages of most viewed content',
          'pages' => [
            ['label' => 1, 'href' => $this->url('ui_kit_demo.content'), 'current' => TRUE],
            ['label' => 2, 'href' => $this->url('ui_kit_demo.content')],
            ['label' => 3, 'href' => $this->url('ui_kit_demo.content')],
          ],
          'next' => ['label' => 'Next', 'href' => $this->url('ui_kit_demo.content')],
        ]),
      ], ['gap' => 's'])),
      Build::row([
        Build::component('card', ['title' => 'Recent activity', 'heading_level' => 2], [
          'content' => Build::component('timeline', [
            'items' => [
              [
                'title' => 'Ada Okafor published "Ten years of the newsroom"',
                'time' => '09:12',
                'datetime' => '2026-11-07T09:12:00Z',
                'tone' => 'success',
              ],
              [
                'title' => 'Jonas Ek sent "Winter opening hours" for review',
                'time' => '08:40',
                'datetime' => '2026-11-07T08:40:00Z',
                'tone' => 'info',
              ],
              [
                'title' => 'Link check found 3 broken links',
                'time' => '02:00',
                'datetime' => '2026-11-07T02:00:00Z',
                'tone' => 'danger',
              ],
              [
                'title' => 'Priya Nair updated "Accessibility statement"',
                'time' => 'Yesterday',
                'datetime' => '2026-11-06T16:25:00Z',
              ],
            ],
          ]),
        ]),
        Build::component('card', ['title' => 'Editorial workflow', 'heading_level' => 2], [
          'content' => Build::component('description-list', [
            'items' => [
              ['term' => 'Waiting for review', 'description' => 12],
              ['term' => 'Average time to publish', 'description' => '2.4 days'],
              ['term' => 'Scheduled', 'description' => 7],
              ['term' => 'Editors active this week', 'description' => 5],
            ],
          ]),
          'actions' => Build::component('link', [
            'label' => 'Open the review queue',
            'href' => $this->url('ui_kit_demo.content'),
          ]),
        ]),
        Build::component('card', [
          'title' => 'Nightly import',
          'heading_level' => 2,
          'description' => 'Products and prices from the shop feed.',
        ], [
          'content' => Build::layout('stack', [
            Build::layout('cluster', [
              Build::component('spinner', ['label' => 'Import running']),
              Build::component('text', ['text' => 'Running since 02:10']),
            ], ['gap' => 'xs']),
            Build::component('text', ['text' => '1,240 of 3,000 rows imported', 'tone' => 'secondary']),
          ], ['gap' => '2xs']),
        ]),
      ], 'l'),
    ], ['gap' => 'l']);
    return $this->shell('ui_kit_demo.content', 'Content', $main, ['url.query_args:saved']);
  }

  /**
   * Dashboard two: a project's board, milestones and team chat.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public function projects(): array {
    $board = Build::row([
      Build::component('panel', ['title' => 'To do', 'count' => 3, 'heading_level' => 3], ['content' => Build::layout('stack', [
        self::task('Write the launch post', 'Draft for the newsroom', 'Content', 'Ada Okafor', [
          'Due' => '4 Dec',
          'Estimate' => '1 day',
        ]),
        self::task('Redirects for old URLs', 'Map the 140 legacy paths', 'Migration', 'Tomás Ruiz', [
          'Due' => '28 Nov',
          'Estimate' => '3 days',
        ]),
        self::task('Cookie banner copy', 'Waiting for legal', 'Legal', 'Mara Lind', [
          'Due' => '20 Nov',
          'Waiting for' => 'Legal team',
        ], ['Waiting', 'warning']),
      ], ['gap' => 's'])]),
      Build::component('panel', ['title' => 'In progress', 'count' => 2, 'heading_level' => 3], ['content' => Build::layout('stack', [
        self::task('Search results page', 'Facets and empty results', 'Design', 'Priya Nair', [
          'Due' => '18 Nov',
          'Estimate' => '4 days',
        ]),
        self::task('Image styles', 'Overdue since Monday', 'Frontend', 'Jonas Ek', [
          'Due' => '2 Nov',
          'Estimate' => '2 days',
        ], ['Overdue', 'danger']),
      ], ['gap' => 's'])]),
      Build::component('panel', ['title' => 'Review', 'count' => 1, 'heading_level' => 3], ['content' => Build::layout('stack', [
        self::task('Event listing', 'Ready for the client', 'Frontend', 'Jonas Ek', [
          'Due' => '14 Nov',
          'Reviewer' => 'Mara Lind',
        ], ['Ready', 'success']),
      ], ['gap' => 's'])]),
      Build::component('panel', ['title' => 'Blocked', 'count' => 0, 'heading_level' => 3], [
        'content' => Build::component('empty-state', [
          'title' => 'Nothing is blocked',
          'heading_level' => 4,
          'description' => 'Tasks that wait on someone outside the team show up here.',
        ]),
      ]),
    ], 's');
    $milestones = [];
    foreach ([
      ['Design', 12, 12, 'success'],
      ['Build', 18, 26, 'info'],
      ['Content migration', 4, 15, 'warning'],
    ] as [$label, $done, $total, $tone]) {
      $milestones[] = Build::component('progress', [
        'label' => $label,
        'value' => $done,
        'max' => $total,
        'value_text' => $done . ' of ' . $total . ' tasks',
        'tone' => $tone,
      ]);
    }
    $team = [];
    foreach (['Mara Lind', 'Jonas Ek', 'Priya Nair', 'Tomás Ruiz', 'Ada Okafor'] as $person) {
      $team[] = Build::component('avatar', ['name' => $person]);
    }
    $sent = $this->query('sent')
      ? Build::component('message', ['tone' => 'info'], [
        'content' => ['#markup' => '<p>In this demo messages aren\'t sent.</p>'],
      ])
      : [];
    $chat = Build::component('card', ['title' => 'Team chat', 'heading_level' => 2], [
      'content' => Build::layout('stack', [
        StandIn::conversation([
          [
            'name' => 'Mara Lind',
            'time' => '09:02',
            'datetime' => '2026-11-07T09:02:00Z',
            'text' => 'Morning. The client moved the review to Thursday.',
          ],
          [
            'name' => 'Jonas Ek',
            'time' => '09:05',
            'datetime' => '2026-11-07T09:05:00Z',
            'text' => 'Good, that gives us time for the image styles.',
          ],
          [
            'name' => 'Priya Nair',
            'time' => '09:11',
            'datetime' => '2026-11-07T09:11:00Z',
            'text' => 'Search page is up on staging, feedback welcome.',
          ],
          [
            'name' => 'Tomás Ruiz',
            'time' => '09:20',
            'datetime' => '2026-11-07T09:20:00Z',
            'text' => 'Redirect map is half done. 70 to go.',
          ],
        ]),
        $sent,
        StandIn::form($this->formBuilder->getForm(ChatForm::class)),
      ], ['gap' => 's']),
    ]);
    $main = Build::layout('stack', [
      Build::component('page-header', [
        'title' => 'Website relaunch',
        'description' => 'Sprint 14 of 16. Launch on 12 December.',
      ], [
        'actions' => [
          Build::component('link', [
            'label' => 'Settings',
            'href' => $this->url('ui_kit_demo.projects'),
            'appearance' => 'secondary',
          ]),
          Build::component('button', ['label' => 'New task', 'appearance' => 'primary']),
        ],
      ]),
      Build::component('description-list', [
        'layout' => 'strip',
        'items' => [
          ['term' => 'Launch', 'description' => '12 Dec 2026'],
          ['term' => 'Lead', 'description' => 'Mara Lind'],
          ['term' => 'Team', 'description' => '5 people'],
          ['term' => 'Budget used', 'description' => '64 %'],
        ],
      ]),
      Build::component('message', ['tone' => 'neutral', 'title' => 'Review moved to Thursday'], [
        'content' => ['#markup' => '<p>The client moved the sprint review to Thursday, 10:00.</p>'],
        'actions' => Build::component('link', [
          'label' => 'Open the agenda',
          'href' => $this->url('ui_kit_demo.projects'),
          'appearance' => 'secondary',
        ]),
      ]),
      Build::row([
        Build::component('stat', ['label' => 'Open tasks', 'value' => 6]),
        Build::component('stat', [
          'label' => 'Done this week',
          'value' => 9,
          'tone' => 'success',
          'status' => 'On track',
          'icon' => 'check',
        ]),
        Build::component('stat', [
          'label' => 'Overdue',
          'value' => 1,
          'tone' => 'danger',
          'status' => 'Late',
          'icon' => 'error',
        ]),
        Build::component('stat', ['label' => 'Hours this sprint', 'value' => 112, 'hint' => 'of 160 planned']),
      ]),
      Build::section('Board', $board),
      Build::sidebar(
        Build::layout('stack', [
          Build::component('card', ['title' => 'Milestones', 'heading_level' => 2], [
            'content' => Build::layout('stack', $milestones, ['gap' => 's']),
          ]),
          Build::component('card', [
            'title' => 'Team',
            'heading_level' => 2,
            'description' => 'Five people, two of them part time.',
          ], [
            'content' => Build::layout('cluster', $team, ['gap' => 'xs']),
          ]),
        ]),
        $chat,
        'l',
      ),
    ], ['gap' => 'l']);
    return $this->shell('ui_kit_demo.projects', 'Website relaunch', $main, ['url.query_args:sent']);
  }

  /**
   * A task on the project board.
   *
   * Its tag (and, when it has a status, the status as a dot badge) in the
   * card's badges, with the card's tone; its person and its record in a
   * details part in the content.
   *
   * @param string $title
   *   The task.
   * @param string $description
   *   One line about it.
   * @param string $tag
   *   Its category.
   * @param string $person
   *   Who works on it.
   * @param array<string, string> $record
   *   Its record: term => value.
   * @param array{string, string}|null $status
   *   Its status's label and tone, or NULL.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private static function task(string $title, string $description, string $tag, string $person, array $record, ?array $status = NULL): array {
    $facts = [];
    foreach ($record as $term => $value) {
      $facts[] = ['term' => $term, 'description' => $value];
    }
    $badges = [Build::component('badge', ['label' => $tag])];
    if ($status !== NULL) {
      [$label, $tone] = $status;
      $badges[] = Build::component('badge', ['label' => $label, 'tone' => $tone, 'dot' => TRUE]);
    }
    return Build::component('card', [
      'title' => $title,
      'heading_level' => 4,
      'description' => $description,
      'tone' => $status[1] ?? 'neutral',
    ], [
      'badges' => $badges,
      'content' => [
        Build::component('avatar', ['name' => $person, 'size' => 's']),
        Build::component('details', ['summary' => 'Details'], [
          'content' => Build::component('description-list', ['items' => $facts]),
        ]),
      ],
    ]);
  }

  /**
   * The form screen: a new article, inside the app.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public function article(): array {
    $main = Build::layout('stack', [
      Build::component('breadcrumb', [
        'label' => 'Breadcrumb',
        'items' => [
          ['label' => 'Home', 'href' => $this->url('ui_kit_demo.home')],
          ['label' => 'Content', 'href' => $this->url('ui_kit_demo.content')],
          ['label' => 'New article'],
        ],
      ]),
      Build::component('page-header', [
        'title' => 'New article',
        'description' => 'Fields marked as required need a value before you can save.',
      ], [
        'actions' => Build::component('link', [
          'label' => 'Preview',
          'href' => $this->url('ui_kit_demo.article_preview'),
          'appearance' => 'secondary',
        ]),
      ]),
      Build::component('message', ['tone' => 'warning', 'title' => 'Demo form'], [
        'content' => ['#markup' => '<p>Saving takes you back to the content dashboard; nothing is stored.</p>'],
      ]),
      Build::component('card', ['title' => 'Article', 'heading_level' => 2], [
        'content' => StandIn::form($this->formBuilder->getForm(ArticleForm::class)),
      ]),
    ], ['gap' => 'l']);
    return $this->shell('ui_kit_demo.article', 'New article', $main, [], TRUE);
  }

  /**
   * The article preview: the article as readers will see it (content plan M3).
   *
   * Every content component in use: heading, text, rich text, figure, frame,
   * image, blockquote, divider and icon.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public function articlePreview(): array {
    $images = Url::fromUserInput('/' . $this->moduleList->getPath('ui_kit_demo') . '/images')->toString();
    $body = <<<'HTML'
      <p>An import reads a <strong>source</strong>, maps each row to <em>content</em> and saves it. It runs every night, and you can start it by hand from the content dashboard.</p>
      <h2>Before you start</h2>
      <p>Check three things first. A mapping that is wrong costs an hour; a check costs a minute.</p>
      <ul>
        <li>The source is a CSV or JSON file with one row per item.</li>
        <li>Every column has a field to go to, and one column is the <code>key</code> for updates.</li>
        <li>You may create content in the section you import into.</li>
      </ul>
      <h2>Run the import</h2>
      <ol>
        <li>Upload the file on the <a href="#">import page</a>.</li>
        <li>Check the preview of the first ten rows.</li>
        <li>Press <kbd>Run</kbd> and keep the page open until it finishes.</li>
      </ol>
      <h3>When rows fail</h3>
      <p>Rows that fail are <mark>marked for review</mark> with the reason. Fix the source and run the import again: rows with a known key update instead of duplicating.</p>
      HTML;
    $main = Build::layout('stack', [
      Build::component('breadcrumb', [
        'label' => 'Breadcrumb',
        'items' => [
          ['label' => 'Home', 'href' => $this->url('ui_kit_demo.home')],
          ['label' => 'Content', 'href' => $this->url('ui_kit_demo.content')],
          ['label' => 'New article', 'href' => $this->url('ui_kit_demo.article')],
          ['label' => 'Preview'],
        ],
      ]),
      Build::component('page-header', [
        'title' => 'Getting started with imports',
        'description' => 'Guides · Preview of a draft, not published yet.',
      ], [
        'actions' => [
          Build::component('link', [
            'label' => 'Back to editing',
            'href' => $this->url('ui_kit_demo.article'),
            'appearance' => 'secondary',
          ]),
          Build::component('button', ['label' => 'Publish', 'appearance' => 'primary'], [
            'icon' => Build::component('icon', ['name' => 'check']),
          ]),
        ],
      ]),
      Build::component('center', ['measure' => 'm'], [
        'content' => Build::layout('stack', [
          Build::component('figure', ['caption' => 'Imports run every night; the dashboard shows the last run.'], [
            'media' => Build::component('frame', ['ratio' => '16-9'], [
              'content' => Build::component('image', [
                'src' => "$images/landscape.svg",
                'alt' => 'A landscape: the picture at the top of the article',
                'width' => 1600,
                'height' => 900,
                'loading' => 'eager',
              ]),
            ]),
          ]),
          Build::component('text', [
            'text' => 'Bring products, prices and pictures in from a file, check them, and keep them up to date with one nightly run.',
            'size' => 'lead',
          ]),
          Build::component('rich-text', [], ['content' => ['#markup' => $body]]),
          Build::component('blockquote', ['attribution' => 'Mara Lind, content lead'], [
            'content' => ['#markup' => '<p>Run a small file first. It shows mapping errors in a minute instead of an hour.</p>'],
          ]),
          Build::component('divider', []),
          Build::section('Related guides', Build::row([
            Build::component('card', [
              'title' => 'Mapping fields',
              'heading_level' => 3,
              'description' => 'Which column goes into which field.',
            ], [
              'media' => Build::component('frame', ['ratio' => '3-2'], [
                'content' => Build::component('image', [
                  'src' => "$images/portrait.svg",
                  'alt' => '',
                  'width' => 600,
                  'height' => 900,
                ]),
              ]),
            ]),
            Build::component('card', [
              'title' => 'Scheduling runs',
              'heading_level' => 3,
              'description' => 'When imports run and how to change it.',
            ], [
              'media' => Build::component('frame', ['ratio' => '3-2'], [
                'content' => Build::component('image', [
                  'src' => "$images/landscape.svg",
                  'alt' => '',
                  'width' => 1600,
                  'height' => 900,
                ]),
              ]),
            ]),
          ], 's')),
          Build::component('text', [
            'text' => 'Last edited by Mara Lind, 8 November 2026',
            'size' => 'small',
            'tone' => 'secondary',
          ]),
        ], ['gap' => 'l']),
      ]),
    ], ['gap' => 'l']);
    return $this->shell('ui_kit_demo.article', 'Article preview', $main);
  }

  /**
   * Wraps a screen in the app: a navigation rail, the screen beside it.
   *
   * @param string $current
   *   The current screen's route.
   * @param string $title
   *   The page title.
   * @param array<string, mixed> $main
   *   The screen.
   * @param list<string> $contexts
   *   Further cache contexts the screen varies by.
   * @param bool $narrow
   *   TRUE for a screen that reads better narrow, such as a form.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function shell(string $current, string $title, array $main, array $contexts = [], bool $narrow = FALSE): array {
    $items = [];
    foreach (self::SCREENS as $route => $label) {
      $items[] = ['label' => $label, 'href' => $this->url($route), 'current' => $route === $current];
    }
    $gaps = $this->query('gaps');
    $toggle = Url::fromRoute($current, [], $gaps ? [] : ['query' => ['gaps' => '1']])->toString();
    $rail = [
      '#type' => 'container',
      '#attributes' => ['class' => ['ui-kit-demo-rail']],
      'brand' => ['#markup' => '<p class="ui-kit-demo-brand"><span class="ui-kit-demo-brand__mark" aria-hidden="true"></span>UI Kit demo</p>'],
      'nav' => Build::component('side-navigation', ['label' => 'Demo', 'items' => $items]),
      'toggle' => [
        '#type' => 'inline_template',
        '#template' => '<a class="ui-kit-demo-toggle" href="{{ url }}" data-on="{{ on ? \'true\' : \'false\' }}">{{ label }}</a>',
        '#context' => [
          'url' => $toggle,
          'on' => $gaps,
          'label' => $gaps ? 'Hide what\'s missing' : 'Show what\'s missing',
        ],
      ],
    ];
    $content = [
      '#type' => 'container',
      '#attributes' => ['class' => $this->rootClasses('ui-kit-demo--app')],
      'rail' => $rail,
      'main' => $this->main([['#type' => 'status_messages'], $main], $narrow ? 'ui-kit-demo-main--narrow' : ''),
    ];
    return $this->page($title, $content, $contexts);
  }

  /**
   * The main landmark around a screen, the skip link's target.
   *
   * @param list<array<mixed>> $children
   *   What goes in it.
   * @param string $class
   *   A further class on the inner column, or ''.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function main(array $children, string $class = ''): array {
    return [
      '#type' => 'inline_template',
      '#template' => '<main id="main-content" class="ui-kit-demo-main" tabindex="-1">{{ column }}</main>',
      '#context' => [
        'column' => Build::component('center', ['measure' => 'l'], [
          'content' => [
            '#type' => 'container',
            '#attributes' => ['class' => array_filter(['ui-kit-demo-main__inner', $class])],
            'stack' => Build::layout('stack', $children, ['gap' => 'l']),
          ],
        ]),
      ],
    ];
  }

  /**
   * Returns a whole page, so the theme's blocks stay out.
   *
   * @param string $title
   *   The page title.
   * @param array<string, mixed> $content
   *   The page's content.
   * @param list<string> $contexts
   *   Further cache contexts the page varies by.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  private function page(string $title, array $content, array $contexts = []): array {
    return [
      '#type' => 'page',
      '#title' => $title,
      'content' => $content,
      '#attached' => ['library' => ['ui_kit_demo/demo']],
      '#cache' => ['contexts' => ['url.query_args:gaps', ...$contexts]],
    ];
  }

  /**
   * The demo root's classes, with the gap outline when it is switched on.
   *
   * @param string $modifier
   *   The screen kind's class.
   *
   * @return list<string>
   *   The classes.
   */
  private function rootClasses(string $modifier): array {
    $classes = ['ui-kit-demo', $modifier];
    if ($this->query('gaps')) {
      $classes[] = 'ui-kit-demo--gaps';
    }
    return $classes;
  }

  /**
   * A demo URL that keeps the gap outline on while it is on.
   *
   * @param string $route
   *   The route.
   *
   * @return string
   *   The URL.
   */
  private function url(string $route): string {
    $options = $this->query('gaps') ? ['query' => ['gaps' => '1']] : [];
    return Url::fromRoute($route, [], $options)->toString();
  }

  /**
   * Whether a query flag is set.
   *
   * @param string $name
   *   The query parameter.
   *
   * @return bool
   *   TRUE when it is "1".
   */
  private function query(string $name): bool {
    return $this->requestStack->getCurrentRequest()?->query->get($name) === '1';
  }

}
