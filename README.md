# Design System API Demo

A Drupal 11.5 site (`11.5.0-beta1`) for trying the [Design System API](https://www.drupal.org/project/design_system_api):
one design contract, admin and frontend themes. Switch the theme and watch
contract-based UI follow it without any theme-specific CSS.

> **Pre-alpha.** The Design System API is in its design phase. This demo grows with it.

## See it

The demo makes one claim: **one module, one CSS file with no theme-specific CSS,
looks native in every admin theme and acceptable in a frontend theme that has never
heard of it. It also works in dark mode, RTL and forced colors, and an author can
rebrand it without touching code.**

It proves that in seven moments, each with a before and after:

| # | Moment | Try it |
|---|---|---|
| 1 | **Before:** Media Library with the pilot off. Native in the admin themes (each ships its own Media Library CSS), bare on Olivero and Stark. | `ddev drush pmu design_system_api_media_library` |
| 2 | **One module, every admin theme:** the pilot replaces the themes' Media Library CSS; adapters map the contract to each theme. | `ddev admin-theme default_admin\|claro` |
| 3 | **Same module, frontend:** plain, deliberate defaults on Olivero and on Stark (no CSS at all). | `ddev frontend-theme olivero\|stark`, then edit an article |
| 4 | **Modes:** OS dark mode (where the theme has one), RTL at `/ar/node/1/edit`, `prefers-contrast: more`, `data-ds-mode="dark"` with more contrast (dark wins), forced colors. | DevTools rendering emulation |
| 5 | **The author fills:** a registry file turns the card border brand red on Olivero only. Authors can also edit it at Appearance » Design system. | `ddev ds-brand on`, `ddev drush ds:resolve media-card.border --theme=olivero --mode=dark` |
| 6 | **The guard rail:** the linter passes the pilot and fails a seeded literal color. | `ddev ds-lint` |
| 7 | **Receipts:** zero hex values and zero theme names in the pilot; 441 lines of CSS replacing about 1,700 lines of theme copies. | `ddev ds-lint` (last block) |

The **proof gallery** captures all of this (4 themes × 6 contexts × pilot off/on,
plus the author moment), with an axe-core scan per cell:

```bash
cd tests/proof && npm install
npm run capture     # drives the demo with Playwright; about 12 minutes
npm run gallery     # builds tests/proof/out/gallery/index.html
```

## Why Drupal 11.5 beta

The Design System API builds on core's Design Tokens API
([#3531854](https://www.drupal.org/project/drupal/issues/3531854)), which first ships
in tagged releases with Drupal `11.5.0-beta1` and `12.0.0-beta1`. The module supports
both (`^11.5 || ^12`); the demo runs 11.5 so that contrib modules run unpatched.
Drupal 12 is covered by the module's CI.

What that means here:

- PHP 8.4 (Drupal 11.5's recommended version, set in `.ddev/config.yaml`) and Drush 13.
- Claro and Olivero are core themes (11.5 marks them deprecated; they move to contrib
  in Drupal 12). Default Admin is core's admin theme, as on 12.
- Canvas, Gin and the contrib modules the demo compares (Coffee, Masquerade,
  Paragraphs, Layout Paragraphs, Webform and others) come from `composer.json` at
  releases that support 11.5, with no patches.
- Standard installs no frontend theme and no content types (as on 12); the demo content
  comes as a recipe.

## Requirements

- [DDEV](https://ddev.readthedocs.io/) 1.25 or newer, with Docker running.
- About 2 GB of free disk space for images and dependencies.

## Quick start

```bash
git clone https://github.com/d34dman/design_system_api_demo.git
cd design_system_api_demo
ddev start
ddev install-demo
```

`ddev install-demo` installs dependencies and the site (Standard profile, frontend
theme Olivero, admin theme Default Admin, the demo content recipe, Design System API
with the Media Library pilot and the Default Admin and Claro adapters) and prints a
one-time login link. The admin account is `admin` / `admin`; this is a local demo,
never expose it.

This uses the `1.0.x-dev` release from drupal.org, so it needs the module's `1.0.x`
branch to be published there.

## Switching admin themes

```bash
ddev admin-theme            # show the current admin theme and installable themes
ddev admin-theme default_admin   # core's admin theme (experimental)
ddev admin-theme claro           # core on Drupal 11.5, contrib on 12
```

## Workspace mode (for developing the modules)

This demo is part of the Design System API workspace, where the module repos are
checked out under `<workspace>/apps/`. Workspace mode makes the demo use those local
checkouts instead of drupal.org releases, so edits in `apps/` show up immediately.

```bash
ddev workspace-mode on      # mount ../../apps into the container, use path repositories
ddev workspace-mode status
ddev workspace-mode off     # back to drupal.org releases
```

How it works:

- `.ddev/workspace/docker-compose.workspace.yaml` mounts `<workspace>/apps` at
  `/var/apps` in the web container, so the relative path `../../apps` resolves the same
  on the host and in the container.
- It also sets `COMPOSER=composer.workspace.json`. That file is generated from
  `composer.json` with a path repository for `../../apps/*` prepended
  (`.ddev/workspace/build-composer-json.php`), and has its own
  `composer.workspace.lock`. It requires exactly what `composer.json` requires; only the
  repositories differ, so the committed `composer.json` never references local paths.
  There is no committed `composer.lock` yet: it can only be resolved once the module's
  `1.0.x` branch is on drupal.org.
- Generated files are gitignored. After changing `composer.json`, run
  `ddev workspace-mode on` again to regenerate.

Workspace mode only works when the demo sits at `<workspace>/demos/design_system_api_demo`.

## Two design systems on one page (test setup)

Measures how much CSS leaks between the site's theme and admin UI on the same page
(the Media Library in a frontend form, Navigation, Layout Builder), under four
approaches. Test tooling only: nothing here belongs in the modules, and
`install-demo` never applies it.

```bash
ddev ds-scope-poc on          # test module ds_scope_poc, test theme ds_hostile, Layout Builder, contextual links
ddev ds-scope systems         # none | fence | fence-id | systems | layers | ref; ml-boundary | ml-admin; status
cd tests/proof && npm run regions && npm run regions:gallery   # out/regions/: report.json, screenshots, index.html
ddev ds-scope-poc off
```

- `web/modules/custom/ds_scope_poc`: region markers (`data-ds-system`,
  `data-ds-boundary`), tokens per region, the two reset fences, and `@scope` wrapping of
  each system's CSS during aggregation (`systems.json` says which paths belong to which
  system). Approach `layers` adds one stacking order shared by every system on the page
  (`css/layers.css`).
- `tests/proof/regions.mjs` scores each approach twice: elements that leak, and how intact
  the page looks (`regions-visual.mjs`: the weakest of seven checks).
- `web/themes/custom/ds_hostile`: Olivero plus CSS rules that leak the way real themes do.

## Advaita: one theme, skins bound per context

`web/themes/custom/advaita` is a dual theme (admin and default theme at once) that
carries no values: its look is three skins in `advaita.skins.yml`, bound by the site.

```bash
ddev drush ds:bind site advaita_paper      # the site: warm paper, deep green
ddev drush ds:bind chrome advaita_indigo   # admin routes and admin regions: indigo
ddev drush ds:bind chrome advaita_ember    # the same theme with a warm chrome
ddev drush ds:binding                      # what each context uses
```

`ddev demo colour|ember|structure` does all of this in one step (Advaita as both themes,
node forms in the site theme, the Media Library dialog as chrome); `ddev demo stock` goes back.

`tests/proof/advaita.mjs` binds paper and indigo, captures, swaps the chrome to ember
(`out/advaita-skin-swap/`) and binds both contexts back to `theme` at the end;
`contrib.mjs` binds them for the Advaita column only.

## What's inside

| Part | Status |
|---|---|
| Drupal 11.5.0-beta1 (with the Design Tokens API), Standard profile, Olivero + Default Admin, Claro installed | Ready |
| Demo content: *Meridian*, a magazine about architecture, design and places. `scripts/demo-content.php` (after the recipe `recipes/design_system_api_demo_content`) adds a standfirst and body to Article, 12 articles by four writers, 26 photos from `assets/demo-photos` (Unsplash License, see `CREDITS.md` there), Arabic (RTL) translations of the first two, a pending draft on node 2, and rewrites the landing and Layout Paragraphs pages when they exist. Safe to run again: `ddev drush php:script ../scripts/demo-content.php` | Ready |
| Design System API, Default Admin and Claro adapters, Media Library pilot | Ready |
| Author brand registry for Olivero (`design-system/brand/`) | Ready |
| Proof gallery (`tests/proof/`) | Ready |
| Gin adapter (`design_system_api_gin`) | Not started (Gin 5 is installed by Composer, not enabled) |

## Useful commands

| Command | What it does |
|---|---|
| `ddev install-demo` | Install from scratch and print a login link |
| `ddev demo <preset>` | Switch demo setups: `stock`, `claro`, `colour` (paper + indigo), `ember`, `structure` (atelier + canvas), `skins <site> <chrome>`, `status`; options `--forms=site\|admin`, `--ml=admin\|boundary`, `--no-login`. Prints the state, a login link and the pages to show |
| `ddev drush uli` | New login link |
| `ddev admin-theme <name>` | Switch admin theme |
| `ddev frontend-theme <name>` | Switch frontend theme (`olivero`, `stark`) |
| `ddev ds-brand on\|off\|status` | Turn the author's brand registry for Olivero on or off |
| `ddev ds-lint` | Lint the pilot CSS and a seeded bad file; print the receipts |
| `ddev drush ds:tokens \| ds:resolve \| ds:css` | Inspect tokens, one value's provenance, the generated CSS |
| `ddev workspace-mode on\|off\|status` | Use local module checkouts |
