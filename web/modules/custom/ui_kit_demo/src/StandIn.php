<?php

declare(strict_types=1);

namespace Drupal\ui_kit_demo;

/**
 * Plain stand-ins for the parts UI Kit doesn't ship yet (Gaps).
 *
 * Each root carries data-ui-kit-gap with its key in Gaps::ALL. The markup is
 * the simplest accessible version of the part, so the gap shows what the
 * component will have to do. None of this is UI Kit API.
 */
final class StandIn {

  /**
   * A bar chart with the figures as text for assistive technology.
   *
   * @param string $caption
   *   What the chart shows.
   * @param array<string, int> $values
   *   The bars: label => value. The label's first word shows under the bar.
   * @param string $unit
   *   The unit after each value, e.g. "views".
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public static function chart(string $caption, array $values, string $unit): array {
    $max = max(1, ...array_values($values));
    $bars = [];
    foreach ($values as $label => $value) {
      $bars[] = [
        // The day only on screen; the full label for assistive technology.
        'short' => strtok($label, ' '),
        'label' => $label,
        'value' => number_format($value),
        'height' => round($value / $max * 100, 1),
      ];
    }
    return [
      '#type' => 'inline_template',
      '#template' => '<figure class="ui-kit-demo-chart" data-ui-kit-gap="chart"><figcaption class="visually-hidden">{{ caption }}</figcaption><ol class="ui-kit-demo-chart__bars">{% for bar in bars %}<li><span class="ui-kit-demo-chart__bar" style="block-size: {{ bar.height }}%"></span><span class="ui-kit-demo-chart__label" aria-hidden="true">{{ bar.short }}</span><span class="visually-hidden">{{ bar.label }}: {{ bar.value }} {{ unit }}</span></li>{% endfor %}</ol></figure>',
      '#context' => ['caption' => $caption, 'bars' => $bars, 'unit' => $unit],
    ];
  }

  /**
   * A conversation: messages with who wrote them and when.
   *
   * @param array<int, array{name: string, time: string, datetime: string, text: string}> $messages
   *   The messages, oldest first.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public static function conversation(array $messages): array {
    $items = [];
    foreach ($messages as $message) {
      // The name is written next to the avatar: decorative, read once.
      $items[] = $message + ['avatar' => Build::component('avatar', ['name' => $message['name'], 'decorative' => TRUE])];
    }
    return [
      '#type' => 'inline_template',
      '#template' => '<ol class="ui-kit-demo-conversation" data-ui-kit-gap="conversation">{% for m in items %}<li class="ui-kit-demo-conversation__message">{{ m.avatar }}<div><p class="ui-kit-demo-conversation__meta"><strong>{{ m.name }}</strong> <time datetime="{{ m.datetime }}">{{ m.time }}</time></p><p>{{ m.text }}</p></div></li>{% endfor %}</ol>',
      '#context' => ['items' => $items],
    ];
  }

  /**
   * Wraps a Form API form, whose controls UI Kit doesn't draw yet.
   *
   * @param array<mixed> $form
   *   The built form.
   *
   * @return array<string, mixed>
   *   A render array.
   */
  public static function form(array $form): array {
    return [
      '#type' => 'container',
      '#attributes' => ['class' => ['ui-kit-demo-form'], 'data-ui-kit-gap' => 'forms'],
      'form' => $form,
    ];
  }

}
