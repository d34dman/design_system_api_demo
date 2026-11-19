/**
 * Screenshots for Advaita's drupal.org project page: raw viewport captures
 * (1440 × 900 at 2×) per look, page and mode.
 *
 * Usage (Advaita installed as default and admin theme):
 *   cd tests/proof && node store-shots.mjs [--only=article,edit]
 *
 * Writes out/store-shots/<id>.jpg. Site pages are taken as a visitor, the
 * rest as user 1. While it runs, the debug overlay is off and user 1's saved
 * display preferences are set aside; the demo's environment banner is hidden
 * (it is not part of the theme). Restores themes' bindings, the debug
 * switch, node.settings and the preferences as they were.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, 'out', 'store-shots');
const BASE = process.env.DEMO_URL ?? 'https://design-system-api-demo.ddev.site';
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const only = args.only ? args.only.split(',') : null;

const SITE = 'advaita_atelier';
const CHROME = 'advaita_slate';

// visitor: anonymous; adminForms: node forms in the admin page shell.
const SHOTS = [
  { id: 'article-atelier', path: '/node/2', visitor: true },
  { id: 'article-atelier-dark', path: '/node/2', visitor: true, mode: 'dark' },
  { id: 'article-rtl', path: '/ar/node/2', visitor: true },
  { id: 'landing-atelier', path: '/node/13', visitor: true },
  { id: 'front-atelier', path: '/node', visitor: true },
  { id: 'paragraphs-site', path: '/node/13/edit' },
  { id: 'layout-paragraphs-site', path: '/node/14/edit' },
  {
    id: 'media-library-site', path: '/node/2/edit',
    run: async (page) => {
      await page.getByRole('button', { name: 'Add media' }).first().click();
      await page.locator('.ui-dialog .js-media-library-item').first().waitFor();
    },
  },
  { id: 'content-slate', path: '/admin/content' },
  { id: 'content-slate-dark', path: '/admin/content', mode: 'dark' },
  { id: 'blocks-slate', path: '/admin/structure/block' },
  { id: 'skins-ui', path: '/admin/appearance/design-system/skins' },
  { id: 'seed-ui', path: '/admin/appearance/design-system/skins/add' },
  { id: 'binding-ui', path: '/admin/appearance/design-system/binding' },
  { id: 'edit-slate', path: '/node/2/edit', adminForms: true },
  { id: 'edit-slate-dark', path: '/node/2/edit', adminForms: true, mode: 'dark' },
  { id: 'edit-canvas', path: '/node/2/edit', chrome: 'advaita_canvas', adminForms: true },
  { id: 'edit-indigo', path: '/node/2/edit', chrome: 'advaita_indigo', adminForms: true },
  { id: 'edit-ember', path: '/node/2/edit', chrome: 'advaita_ember', adminForms: true },
  { id: 'article-paper', path: '/node/2', site: 'advaita_paper', visitor: true },
  { id: 'article-paper-dark', path: '/node/2', site: 'advaita_paper', visitor: true, mode: 'dark' },
  { id: 'landing-paper', path: '/node/13', site: 'advaita_paper', visitor: true },
].filter((s) => !only || only.some((o) => s.id.startsWith(o)));

function ddev(...cmd) {
  return execFileSync('ddev', cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
const drush = (...a) => ddev('drush', ...a);
const php = (code) => drush('php:eval', code);

// One call for everything to restore (each Drush call is slow on this site).
const before = JSON.parse(php(
  "echo json_encode(['debug' => (bool) Drupal::keyValue('development_settings')->get('design_system_api_debug', FALSE), "
  + "'adminForms' => (bool) Drupal::config('node.settings')->get('use_admin_theme'), "
  + "'preferences' => base64_encode(serialize(Drupal::service('user.data')->get('design_system_api', 1, 'preferences')))]);",
));
before.binding = Object.fromEntries(JSON.parse(drush('ds:binding', '--format=json')).map((r) => [r.context, r.skin || 'theme']));
console.log('before', JSON.stringify(before));

const set = (s) => php(
  `Drupal::configFactory()->getEditable('node.settings')->set('use_admin_theme', ${s.adminForms ? 'TRUE' : 'FALSE'})->save();`
  + "Drupal::keyValue('development_settings')->set('design_system_api_debug', FALSE);"
  + "Drupal::service('user.data')->delete('design_system_api', 1, 'preferences');",
);

const HIDE = '#environment-indicator, .environment-indicator-color { display: none !important; }';

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
let session;
try {
  let state = {};
  for (const s of SHOTS) {
    const want = { site: s.site ?? SITE, chrome: s.chrome ?? CHROME, adminForms: !!s.adminForms };
    if (want.site !== state.site) drush('ds:bind', 'site', want.site);
    if (want.chrome !== state.chrome) drush('ds:bind', 'chrome', want.chrome);
    if (want.adminForms !== state.adminForms) { set(want); drush('cr'); }
    state = want;
    if (!s.visitor && !session) {
      const login = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await login.newPage();
      await page.goto(drush('user:login', '--uri=' + BASE));
      session = await login.storageState();
      await login.close();
    }
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true,
      colorScheme: s.mode ?? 'light', ...(s.visitor ? {} : { storageState: session }),
    });
    const page = await context.newPage();
    await page.goto(BASE + s.path, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: HIDE });
    if (s.run) await s.run(page);
    await page.mouse.move(0, 0);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
    await page.screenshot({ path: join(OUT, `${s.id}.jpg`), type: 'jpeg', quality: 90 });
    console.log('shot', s.id, 'color-scheme', scheme);
    await context.close();
  }
}
finally {
  for (const ctx of ['site', 'chrome']) drush('ds:bind', ctx, before.binding[ctx] ?? 'theme');
  php(
    `Drupal::configFactory()->getEditable('node.settings')->set('use_admin_theme', ${before.adminForms ? 'TRUE' : 'FALSE'})->save();`
    + `Drupal::keyValue('development_settings')->set('design_system_api_debug', ${before.debug ? 'TRUE' : 'FALSE'});`
    // No PHP variables: ddev's shell would expand them.
    + (before.preferences === 'Tjs=' /* serialize(NULL): nothing saved */ ? '' : `Drupal::service('user.data')->set('design_system_api', 1, 'preferences', unserialize(base64_decode('${before.preferences}')));`),
  );
  drush('cr');
  await browser.close();
}
