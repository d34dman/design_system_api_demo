<?php

declare(strict_types=1);

namespace Drupal\ds_scope_poc\Hook;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Form\FormStateInterface;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Render\Markup;
use Drupal\Core\Theme\ThemeManagerInterface;
use Drupal\design_system_api\ContextCss;
use Drupal\ds_scope_poc\Systems;

/**
 * Region markers, tokens per region, and the fence for the active approach.
 *
 * Markers on server-rendered markup are added here; markers on markup that
 * JavaScript adds later (dialogs, contextual links) come from js/regions.js.
 */
class DsScopePocHooks {

  public function __construct(
    private Systems $systems,
    private ConfigFactoryInterface $configFactory,
    private ThemeManagerInterface $themeManager,
    private ContextCss $contextCss,
  ) {}

  /**
   * The document belongs to the system of the theme that renders it.
   */
  #[Hook('preprocess_html')]
  public function preprocessHtml(array &$variables): void {
    $admin = $this->configFactory->get('system.theme')->get('admin');
    $variables['html_attributes']['data-ds-system'] = $this->themeManager->getActiveTheme()->getName() === $admin ? 'admin' : 'site';
  }

  /**
   * The Media Library widget: a boundary (site values) or admin UI.
   */
  #[Hook('field_widget_complete_media_library_widget_form_alter')]
  public function widgetAlter(array &$field_widget_complete_form, FormStateInterface $form_state, array $context): void {
    if (!isset($field_widget_complete_form['widget']) || !is_array($field_widget_complete_form['widget'])) {
      return;
    }
    if ($this->systems->mediaLibraryAs() === 'admin') {
      $field_widget_complete_form['widget']['#attributes']['data-ds-system'] = 'admin';
    }
    else {
      $field_widget_complete_form['widget']['#attributes']['data-ds-boundary'] = '';
    }
  }

  #[Hook('page_attachments')]
  public function pageAttachments(array &$attachments): void {
    $strategy = $this->systems->strategy();
    $attachments['#cache']['tags'][] = 'ds_scope_poc';
    $attachments['#attached']['library'][] = 'ds_scope_poc/regions';
    $attachments['#attached']['drupalSettings']['dsScopePoc'] = [
      'strategy' => $strategy,
      'mediaLibraryAs' => $this->systems->mediaLibraryAs(),
    ];
    if ($strategy === 'none') {
      return;
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
    $css = $this->rescope($this->contextCss->css((string) $themes->get('default')), 'site');
    $admin = (string) $themes->get('admin');
    if ($admin === 'default_admin') {
      // Default Admin's tokens alias its own --admin-* variables, which don't
      // exist on frontend pages: carry them along.
      foreach (['color-primitive', 'color-semantic', 'spacing', 'typography', 'misc'] as $file) {
        $css .= $this->rescope((string) file_get_contents(DRUPAL_ROOT . "/core/themes/default_admin/css/_variables/variables-$file.css"), 'admin');
      }
    }
    $css .= $this->rescope($this->contextCss->css($admin), 'admin');
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

  private function rescope(string $css, string $system): string {
    $root = '[data-ds-system="' . $system . '"]';
    $css = str_replace(':root', $root, $css);
    // Page-side contexts set on a region root apply to that region's system only.
    return str_replace(['[data-ds-mode="dark"]', '[data-ds-mode="light"]', '[data-ds-contrast="more"]'], [$root . '[data-ds-mode="dark"]', $root . '[data-ds-mode="light"]', $root . '[data-ds-contrast="more"]'], $css);
  }

}
