# Design System API Demo

A Drupal 12 site (`12.0.0-beta1`) for trying the [Design System API](https://www.drupal.org/project/design_system_api):
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
| 4 | **Modes:** OS dark mode (where the theme has one), RTL at `/ar/node/1/edit`, `prefers-contrast: more`, forced colors. | DevTools rendering emulation |
| 5 | **The author fills:** a registry file turns the card border brand red on Olivero only. Authors can also edit it at Appearance » Design system. | `ddev ds-brand on`, `ddev drush ds:resolve media-card.border --theme=olivero --mode=dark` |
| 6 | **The guard rail:** the linter passes the pilot and fails a seeded literal color. | `ddev ds-lint` |
| 7 | **Receipts:** zero hex values and zero theme names in the pilot; 418 lines of CSS replacing about 1,700 lines of theme copies. | `ddev ds-lint` (last block) |

The **proof gallery** captures all of this (4 themes × 5 contexts × pilot off/on,
plus the author moment), with an axe-core scan per cell:

```bash
cd tests/proof && npm install
npm run capture     # drives the demo with Playwright; about 12 minutes
npm run gallery     # builds tests/proof/out/gallery/index.html
```

## Why Drupal 12 beta

The Design System API builds on core's Design Tokens API
([#3531854](https://www.drupal.org/project/drupal/issues/3531854)), which first ships
in a tagged release with Drupal `12.0.0-beta1`. Drupal 12 is also the landscape the
module is designed for: core has one admin theme (Default Admin) and no frontend theme.

What that means here:

- PHP 8.5 (set in `.ddev/config.yaml`) and Drush `14.x-dev` (Drush 13 doesn't support
  Drupal 12).
- Claro and Olivero come from contrib (`drupal/claro` 3.x, `drupal/olivero` 2.x).
- **Gin is not included:** no Gin release supports Drupal 12 yet. It returns, with the
  Gin adapter, once it does.
- Standard installs no content types on Drupal 12; the demo content comes as a recipe.

## Requirements

- [DDEV](https://ddev.readthedocs.io/) 1.25 or newer (PHP 8.5 support), with Docker running.
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
ddev admin-theme claro           # contrib on Drupal 12
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
  `composer.workspace.lock`. The committed `composer.json` and `composer.lock` never
  reference local paths.
- Generated files are gitignored. After changing `composer.json`, run
  `ddev workspace-mode on` again to regenerate.

Workspace mode only works when the demo sits at `<workspace>/demos/design_system_api_demo`.

## What's inside

| Part | Status |
|---|---|
| Drupal 12.0.0-beta1 (with the Design Tokens API), Standard profile, Olivero + Default Admin, Claro installed | Ready |
| Demo content recipe (`recipes/design_system_api_demo_content`): Article with a Media Library field, 12 generated images, Arabic (RTL), content editing in the frontend theme | Ready |
| Design System API, Default Admin and Claro adapters, Media Library pilot | Ready |
| Author brand registry for Olivero (`design-system/brand/`) | Ready |
| Proof gallery (`tests/proof/`) | Ready |
| Gin adapter (`design_system_api_gin`) | Waiting for a Drupal 12 release of Gin |

## Useful commands

| Command | What it does |
|---|---|
| `ddev install-demo` | Install from scratch and print a login link |
| `ddev drush uli` | New login link |
| `ddev admin-theme <name>` | Switch admin theme |
| `ddev frontend-theme <name>` | Switch frontend theme (`olivero`, `stark`) |
| `ddev ds-brand on\|off\|status` | Turn the author's brand registry for Olivero on or off |
| `ddev ds-lint` | Lint the pilot CSS and a seeded bad file; print the receipts |
| `ddev drush ds:tokens \| ds:resolve \| ds:css` | Inspect tokens, one value's provenance, the generated CSS |
| `ddev workspace-mode on\|off\|status` | Use local module checkouts |
