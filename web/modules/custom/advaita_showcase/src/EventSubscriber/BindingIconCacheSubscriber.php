<?php

declare(strict_types=1);

namespace Drupal\advaita_showcase\EventSubscriber;

use Drupal\Core\Cache\CacheTagsInvalidatorInterface;
use Drupal\Core\Config\ConfigCrudEvent;
use Drupal\Core\Config\ConfigEvents;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

/**
 * Clears the icon caches when the chrome skin changes.
 *
 * NavigationIconsHooks picks the Navigation icon set by the chrome skin, but
 * the icon pack definitions (tag icon_pack_plugin), the loaded icons (tag
 * icon_pack_collector) and the rendered Navigation markup are cached without
 * any tie to the binding. Invalidating them on a chrome skin change makes a
 * new binding take effect on the next request.
 *
 * The icon pack tags stay demo business: only NavigationIconsHooks makes the
 * packs depend on the binding. The `rendered` tag covers markup that should
 * carry the binding's cache tag itself; once the module adds that metadata to
 * what bindings render (backlog B34), drop `rendered` here.
 */
final class BindingIconCacheSubscriber implements EventSubscriberInterface {

  public function __construct(
    private readonly CacheTagsInvalidatorInterface $cacheTagsInvalidator,
  ) {}

  /**
   * {@inheritdoc}
   */
  public static function getSubscribedEvents(): array {
    return [ConfigEvents::SAVE => 'onSave'];
  }

  /**
   * Invalidates the icon and render caches if chrome.skin changed.
   */
  public function onSave(ConfigCrudEvent $event): void {
    if ($event->getConfig()->getName() === 'design_system_api.binding'
      && $event->isChanged('chrome.skin')) {
      $this->cacheTagsInvalidator->invalidateTags(['icon_pack_plugin', 'icon_pack_collector', 'rendered']);
    }
  }

}
