<?php

declare(strict_types=1);

namespace Drupal\ui_kit_demo;

/**
 * The parts the demo needs that UI Kit doesn't ship yet.
 *
 * Each one is drawn by a stand-in (StandIn) that carries its key in
 * data-ui-kit-gap, so "Show what's missing" can outline it. The demo counts as
 * one consumer under UI Kit's inclusion rule: UI Kit's COMPONENTS.md lists it
 * for each candidate here.
 */
final class Gaps {

  /**
   * The gaps, keyed as in data-ui-kit-gap.
   *
   * @var array<string, array{part: string, candidate: string, screens: string}>
   */
  public const ALL = [
    'chart' => [
      'part' => 'Views per day',
      'candidate' => 'ui_kit:chart',
      'screens' => 'Content',
    ],
    'conversation' => [
      'part' => 'Chat messages',
      'candidate' => 'ui_kit:conversation',
      'screens' => 'Projects',
    ],
    'forms' => [
      'part' => 'Form controls and the submit button',
      'candidate' => 'The forms study',
      'screens' => 'Sign-in, New article, Projects',
    ],
  ];

}
