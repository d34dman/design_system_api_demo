<?php

declare(strict_types=1);

namespace Drupal\ds_scope_poc\Hook;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Render\Element;
use Drupal\Core\Render\Markup;
use Drupal\Core\Routing\AdminContext;
use Drupal\Core\Theme\ThemeManagerInterface;
use Drupal\design_system_api\Binding\Binding;
use Drupal\design_system_api\ContextCss;
use Drupal\ds_scope_poc\Systems;

/**
 * Region markers, tokens per region, and the fence for the active approach.
 *
 * Markers on server-rendered markup are added here; markers on markup that
 * JavaScript adds later (dialogs, contextual links) come from js/regions.js.
 */
class DsScopePocHooks {

  /**
   * Form element types and the contract pattern Form API would give them.
   */
  private const PATTERNS = [
    'textfield' => 'ds-input',
    'search' => 'ds-input',
    'email' => 'ds-input',
    'number' => 'ds-input',
    'tel' => 'ds-input',
    'url' => 'ds-input',
    'password' => 'ds-input',
    'entity_autocomplete' => 'ds-input',
    'select' => 'ds-input',
    'textarea' => 'ds-input',
    'checkbox' => 'ds-checkbox',
    'submit' => 'ds-button',
    'button' => 'ds-button',
  ];

  public function __construct(
    private Systems $systems,
    private ConfigFactoryInterface $configFactory,
    private ThemeManagerInterface $themeManager,
    private ContextCss $contextCss,
    private AdminContext $adminContext,
    private Binding $binding,
  ) {}

  /**
   * The document belongs to the system of the theme that renders it.
   *
   * A theme that is both admin and default theme (Advaita) renders admin
   * routes in the admin system and every other page in the site's.
   */
  #[Hook('preprocess_html')]
  public function preprocessHtml(array &$variables): void {
    $variables['html_attributes']['data-ds-system'] = $this->isAdminPage() ? 'admin' : 'site';
  }

  /**
   * Whether the page renders in the admin system.
   */
  private function isAdminPage(): bool {
    $themes = $this->configFactory->get('system.theme');
    $active = $this->themeManager->getActiveTheme()->getName();
    if ($themes->get('admin') === $active && $themes->get('default') === $active) {
      return $this->adminContext->isAdminRoute();
    }
    return $themes->get('admin') === $active;
  }

  /**
   * Marks server-rendered wrappers that declare a role.
   *
   * @param array<string, mixed> $variables
   *   The variables.
   */
  #[Hook('preprocess_fieldset')]
  #[Hook('preprocess_container')]
  #[Hook('preprocess_details')]
  public function preprocessRegion(array &$variables): void {
    $attributes = $variables['attributes'] ?? NULL;
    $role = is_array($attributes) ? ($attributes['data-ds-role'] ?? NULL) : NULL;
    if (is_string($role)) {
      $variables['attributes'] = $this->systems->marker($role) + $attributes;
    }
  }

  /**
   * Approach 'patterns': every form element gets its contract pattern class.
   *
   * Stands in for core Form API doing this for all modules (study candidate
   * 6); the classes are a :where() floor, so any theme rule still wins.
   *
   * @param array<mixed> $form
   *   The form.
   */
  #[Hook('form_alter')]
  public function formAlter(array &$form, FormStateInterface $form_state, string $form_id): void {
    if ($this->systems->formPatterns()) {
      self::classify($form);
    }
  }

  /**
   * Adds pattern classes to an element and its children.
   *
   * @param array<mixed> $element
   *   The element.
   */
  private static function classify(array &$element): void {
    $type = $element['#type'] ?? NULL;
    if (is_string($type) && isset(self::PATTERNS[$type])) {
      $attributes = $element['#attributes'] ?? [];
      if (is_array($attributes)) {
        $classes = is_array($attributes['class'] ?? NULL) ? $attributes['class'] : [];
        $classes[] = self::PATTERNS[$type];
        if (self::PATTERNS[$type] === 'ds-button' && ($element['#button_type'] ?? NULL) === 'primary') {
          $classes[] = 'ds-button--primary';
        }
        $attributes['class'] = $classes;
        $element['#attributes'] = $attributes;
      }
    }
    foreach (Element::children($element) as $key) {
      if (is_array($element[$key] ?? NULL)) {
        $child = $element[$key];
        self::classify($child);
        $element[$key] = $child;
      }
    }
  }

  #[Hook('page_attachments')]
  public function pageAttachments(array &$attachments): void {
    $strategy = $this->systems->strategy();
    $attachments['#cache']['tags'][] = 'ds_scope_poc';
    $attachments['#attached']['library'][] = 'ds_scope_poc/regions';
    $attachments['#attached']['drupalSettings']['dsScopePoc'] = [
      'strategy' => $strategy,
      'roles' => [
        'site' => $this->systems->marker('site'),
        'app' => $this->systems->marker('app'),
        'chrome' => $this->systems->marker('chrome'),
      ],
    ];
    if ($strategy === 'none') {
      return;
    }
    if ($this->systems->formPatterns()) {
      $attachments['#attached']['library'][] = 'design_system_api/forms';
    }
    if ($strategy === 'fence' || $strategy === 'fence-id') {
      $attachments['#attached']['library'][] = 'ds_scope_poc/' . $strategy;
    }
    $attachments['#attached']['html_head'][] = [
      [
        '#type' => 'html_tag',
        '#tag' => 'style',
        '#value' => Markup::create($this->regionCss()),
        '#attributes' => ['data-ds-scope-poc' => 'tokens'],
      ],
      'ds_scope_poc_tokens',
    ];
  }

  /**
   * Tokens for each system on its regions, and a base for module UI regions.
   */
  private function regionCss(): string {
    $themes = $this->configFactory->get('system.theme');
    $site = $this->boundCss('site', (string) $themes->get('default'));
    // Page tokens (the stacking order) stay on the document: every system on
    // the page shares them, including UI outside any region, such as a
    // dialog's overlay.
    preg_match_all('/--ds-layer-[a-z0-9-]+:[^;]+;/', $site, $matches);
    $css = ':root { ' . implode(' ', array_unique($matches[0])) . " }\n";
    $css .= $this->rescope($site, 'site');
    $admin = (string) $themes->get('admin');
    if ($admin === 'default_admin') {
      // Default Admin's tokens alias its own --admin-* variables, which don't
      // exist on frontend pages: carry them along.
      foreach (['color-primitive', 'color-semantic', 'spacing', 'typography', 'misc'] as $file) {
        $css .= $this->rescope((string) file_get_contents(DRUPAL_ROOT . "/core/themes/default_admin/css/_variables/variables-$file.css"), 'admin');
      }
    }
    $css .= $this->rescope($this->boundCss('chrome', $admin), 'admin');
    return $css . <<<CSS
@layer ds.base {
  [data-ds-system="admin"], [data-ds-boundary] {
    color: var(--ds-color-fg-default);
    font-family: var(--ds-font-family-base, system-ui, sans-serif);
    font-size: var(--ds-font-size-m);
    font-weight: var(--ds-font-weight-normal);
    font-style: normal;
    line-height: 1.5;
    letter-spacing: normal;
    word-spacing: normal;
    text-transform: none;
    text-align: start;
    text-shadow: none;
    white-space: normal;
    list-style: disc outside;
    box-sizing: border-box;
  }
}
CSS;
  }

  /**
   * A context's values at the page root: its bound skin's, else the theme's.
   */
  private function boundCss(string $context, string $theme): string {
    $binding = $this->binding->effective()[$context];
    return $binding->skin === NULL ? $this->contextCss->css($theme, $binding->role()) : $this->contextCss->skinCss($binding, [NULL]);
  }

  private function rescope(string $css, string $system): string {
    $root = '[data-ds-system="' . $system . '"]';
    $css = str_replace(':root', $root, $css);
    // Page-side contexts set on a region root apply to that region's system only.
    return str_replace(['[data-ds-mode="dark"]', '[data-ds-mode="light"]', '[data-ds-contrast="more"]'], [$root . '[data-ds-mode="dark"]', $root . '[data-ds-mode="light"]', $root . '[data-ds-contrast="more"]'], $css);
  }

}
