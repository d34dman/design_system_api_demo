/**
 * The demo's landing page: Paragraphs content, a form with an author field.
 *
 * Its node ID depends on the install (ddev install-demo makes the articles
 * first), so the proof scripts look it up instead of naming a number.
 */
import { execFileSync } from 'node:child_process';

/**
 * The first landing page's node ID.
 *
 * @param {string} root The demo's root directory (where ddev runs).
 * @returns {string} The node ID.
 */
export function landingNode(root) {
  const code = "$ids = Drupal::entityQuery('node')->accessCheck(FALSE)->condition('type', 'landing')->sort('nid')->range(0, 1)->execute(); echo reset($ids) ?: '';";
  const id = execFileSync('ddev', ['drush', 'php:eval', code], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  if (!id) throw new Error('No landing page on the site: run ddev install-demo.');
  return id;
}
