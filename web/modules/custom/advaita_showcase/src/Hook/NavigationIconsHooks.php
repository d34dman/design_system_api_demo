<?php

declare(strict_types=1);

namespace Drupal\advaita_showcase\Hook;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Extension\ExtensionPathResolver;
use Drupal\Core\Hook\Attribute\Hook;
use Drupal\Core\Theme\Icon\IconExtractorPluginManager;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Thin Navigation icons while the chrome wears the Canvas UI skin.
 *
 * Canvas UI draws Radix icons, about 1px thin. Core Navigation ships Phosphor
 * regular shapes (about 1.5px at its 20px size), which look heavy next to
 * them. The skin contract's icons map cannot fix this: it maps the contract's
 * own icon names only, and Navigation renders its own `navigation` pack
 * directly (icon('navigation', ...)). So while the chrome skin is
 * advaita_canvas_ui, the pack is re-pointed at Phosphor light copies in the
 * Advaita theme, named by Navigation's icon ids.
 *
 * The icon pack definitions are cached and do not vary by config, so
 * BindingIconCacheSubscriber clears them when the binding is saved.
 */
final class NavigationIconsHooks {

  /**
   * The chrome skin that gets the thin icons.
   */
  private const SKIN = 'advaita_canvas_ui';

  public function __construct(
    private readonly ConfigFactoryInterface $configFactory,
    private readonly ExtensionPathResolver $pathResolver,
    private readonly IconExtractorPluginManager $extractorManager,
    #[Autowire(param: 'app.root')]
    private readonly string $appRoot,
  ) {}

  /**
   * Implements hook_icon_pack_alter().
   *
   * The alter runs after IconPackManager::processDefinition(), which has
   * already resolved the provider's path and discovered the pack's icons. So
   * this sets the path fields to the Advaita theme (sources are resolved
   * against 'relative_path') and discovers the icons again.
   *
   * @param array<string, array<string, mixed>> $definitions
   *   The icon pack definitions, keyed by pack id.
   */
  #[Hook('icon_pack_alter')]
  public function iconPackAlter(array &$definitions): void {
    if (!isset($definitions['navigation'])
      || $this->configFactory->get('design_system_api.binding')->get('chrome.skin') !== self::SKIN) {
      return;
    }
    $theme_path = $this->pathResolver->getPath('theme', 'advaita');
    $definition = &$definitions['navigation'];
    $definition['description'] = 'Drupal Navigation icons, redrawn in Phosphor light for the Canvas UI chrome skin (advaita_showcase).';
    $definition['config']['sources'] = ['icons/phosphor-light/{icon_id}.svg'];
    $definition['relative_path'] = $theme_path;
    $definition['absolute_path'] = $this->appRoot . '/' . $theme_path;
    $definition['icons'] = $this->extractorManager
      ->createInstance($definition['extractor'], $definition)
      ->discoverIcons();
  }

}
