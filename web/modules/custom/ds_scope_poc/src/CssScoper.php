<?php

declare(strict_types=1);

namespace Drupal\ds_scope_poc;

/**
 * Wraps a stylesheet in @scope for one design system.
 *
 * @scope ([data-ds-system="X"]) to (other systems, boundaries) { … }
 *
 * Works on aggregated (optimized) CSS: no comments, compressed whitespace.
 *
 * - At-rules that are not allowed inside @scope (@import, @font-face,
 *   @keyframes, @property, @layer statements, …) are hoisted out.
 * - Selectors starting at the document (html, :root) are re-rooted to :scope,
 *   and a bare body to "the scope root, or the body of the document", so a
 *   theme's base styles apply at every region of its system.
 * - Inside @scope a selector without :scope only matches descendants of the
 *   root. Each selector also gets a variant whose first compound may be the
 *   root itself (:where(:scope):is(first) rest), so a region root keeps the
 *   styles its system gives it (#layout-builder, .contextual .trigger).
 *   Selectors that start at an ancestor outside the region
 *   (.contextual-region .contextual a) can't match: a finding, not fixed.
 */
class CssScoper {

  private const HOISTED = '/^@(-[a-z]+-)?(charset|import|namespace|font-face|keyframes|property|counter-style|font-feature-values|font-palette-values|page)\b/i';

  public function scope(string $css, string $system): string {
    $hoisted = [];
    $kept = [];
    foreach ($this->statements($css) as $statement) {
      if (preg_match(self::HOISTED, $statement) || preg_match('/^@layer\b[^{]*;$/i', $statement)) {
        $hoisted[] = $statement;
      }
      else {
        $kept[] = $this->rewriteStatement($statement);
      }
    }
    $root = '[data-ds-system="' . $system . '"]';
    $limit = '[data-ds-system]:not(' . $root . '),[data-ds-boundary]';
    return implode("\n", $hoisted) . "\n@scope (" . $root . ') to (' . $limit . "){\n" . implode("\n", $kept) . "\n}\n";
  }

  /**
   * Splits CSS into top-level statements (rules and at-rules).
   *
   * @return list<string>
   */
  public function statements(string $css): array {
    $out = [];
    $depth = 0;
    $start = 0;
    $length = strlen($css);
    for ($i = 0; $i < $length; $i++) {
      $c = $css[$i];
      if ($c === '"' || $c === "'") {
        $i = $this->skipString($css, $i);
        continue;
      }
      if ($c === '/' && ($css[$i + 1] ?? '') === '*') {
        $end = strpos($css, '*/', $i + 2);
        $i = $end === FALSE ? $length : $end + 1;
        continue;
      }
      if ($c === '{') {
        $depth++;
      }
      elseif ($c === '}') {
        $depth--;
        if ($depth === 0) {
          $out[] = trim(substr($css, $start, $i - $start + 1));
          $start = $i + 1;
        }
      }
      elseif ($c === ';' && $depth === 0) {
        $out[] = trim(substr($css, $start, $i - $start + 1));
        $start = $i + 1;
      }
    }
    $rest = trim(substr($css, $start));
    if ($rest !== '') {
      $out[] = $rest;
    }
    return array_values(array_filter($out, fn(string $s) => $s !== '' && $s !== ';'));
  }

  /**
   * Rewrites the selectors of one rule, recursing into grouping at-rules.
   */
  private function rewriteStatement(string $statement): string {
    $brace = $this->findBlockStart($statement);
    if ($brace === NULL) {
      return $statement;
    }
    $prelude = trim(substr($statement, 0, $brace));
    $body = substr($statement, $brace + 1, -1);
    if (str_starts_with($prelude, '@')) {
      if (preg_match('/^@(media|supports|layer|container|starting-style)\b/i', $prelude)) {
        return $prelude . '{' . implode('', array_map([$this, 'rewriteStatement'], $this->statements($body))) . '}';
      }
      return $statement;
    }
    return $this->rewriteSelectorList($prelude) . '{' . $body . '}';
  }

  public function rewriteSelectorList(string $list): string {
    $out = [];
    foreach ($this->splitTopLevel($list, ',') as $selector) {
      $selector = trim($selector);
      $rerooted = $this->reroot($selector);
      $out[] = $rerooted;
      if ($rerooted === $selector && !str_contains($selector, ':scope')) {
        $split = $this->firstCompoundEnd($selector);
        $first = substr($selector, 0, $split);
        // A pseudo-element can't go inside :is(): keep it after.
        $pseudo = strpos($first, '::');
        $tail = $pseudo === FALSE ? '' : substr($first, $pseudo);
        $first = $pseudo === FALSE ? $first : substr($first, 0, $pseudo);
        if ($first !== '') {
          $out[] = ':where(:scope):is(' . $first . ')' . $tail . substr($selector, $split);
        }
      }
    }
    return implode(',', $out);
  }

  private function reroot(string $selector): string {
    // html, :root (bare or qualified, e.g. html[dir="rtl"]) → :scope.
    if (preg_match('/^(html|:root)(?![\w-])/i', $selector)) {
      return preg_replace('/^(html|:root)/i', ':scope', $selector);
    }
    // A bare body → the scope root (nested region) or the document's body.
    // A qualified body (body.path-node) is left alone: it can only match at
    // the document level.
    if (preg_match('/^body(?![\w\-.#\[:])/i', $selector)) {
      return ':is(:scope:not(html),:scope>body)' . substr($selector, 4);
    }
    return $selector;
  }

  /**
   * Where the first compound selector ends (the first top-level combinator).
   */
  private function firstCompoundEnd(string $selector): int {
    $depth = 0;
    $length = strlen($selector);
    for ($i = 0; $i < $length; $i++) {
      $c = $selector[$i];
      if ($c === '"' || $c === "'") {
        $i = $this->skipString($selector, $i);
        continue;
      }
      if ($c === '(' || $c === '[') {
        $depth++;
      }
      elseif ($c === ')' || $c === ']') {
        $depth--;
      }
      elseif ($depth === 0 && (ctype_space($c) || $c === '>' || $c === '+' || $c === '~')) {
        return $i;
      }
    }
    return $length;
  }

  /**
   * @return list<string>
   */
  private function splitTopLevel(string $text, string $separator): array {
    $parts = [];
    $depth = 0;
    $start = 0;
    $length = strlen($text);
    for ($i = 0; $i < $length; $i++) {
      $c = $text[$i];
      if ($c === '"' || $c === "'") {
        $i = $this->skipString($text, $i);
        continue;
      }
      if ($c === '(' || $c === '[') {
        $depth++;
      }
      elseif ($c === ')' || $c === ']') {
        $depth--;
      }
      elseif ($c === $separator && $depth === 0) {
        $parts[] = substr($text, $start, $i - $start);
        $start = $i + 1;
      }
    }
    $parts[] = substr($text, $start);
    return $parts;
  }

  private function findBlockStart(string $statement): ?int {
    $length = strlen($statement);
    for ($i = 0; $i < $length; $i++) {
      $c = $statement[$i];
      if ($c === '"' || $c === "'") {
        $i = $this->skipString($statement, $i);
        continue;
      }
      if ($c === '{') {
        return $i;
      }
    }
    return NULL;
  }

  private function skipString(string $text, int $i): int {
    $quote = $text[$i];
    $length = strlen($text);
    for ($j = $i + 1; $j < $length; $j++) {
      if ($text[$j] === '\\') {
        $j++;
        continue;
      }
      if ($text[$j] === $quote) {
        return $j;
      }
    }
    return $length;
  }

}
