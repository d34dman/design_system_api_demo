# Design System API Demo

A Drupal 11 site for trying the [Design System API](https://www.drupal.org/project/design_system_api):
one design contract, several admin themes. Switch the admin theme and watch
contract-based UI follow it without any theme-specific CSS.

> **Pre-alpha.** The Design System API is in its design phase. This demo grows with it.

## Requirements

- [DDEV](https://ddev.readthedocs.io/) 1.24 or newer, with Docker running.
- About 2 GB of free disk space for images and dependencies.

## Quick start

```bash
git clone https://github.com/d34dman/design_system_api_demo.git
cd design_system_api_demo
ddev start
ddev install-demo
```

`ddev install-demo` installs dependencies and the site (Standard profile, admin theme
Gin, Design System API enabled) and prints a one-time login link. The admin account is
`admin` / `admin`; this is a local demo, never expose it.

This uses the `1.0.x-dev` release from drupal.org, so it needs the module's `1.0.x`
branch to be published there.

## Switching admin themes

```bash
ddev admin-theme            # show the current admin theme and installable themes
ddev admin-theme claro
ddev admin-theme default_admin   # Drupal 11.4's experimental Default Admin theme
ddev admin-theme gin
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
| Drupal 11.4, Standard profile, Gin admin theme | Ready |
| Design System API enabled | Ready (no visible effect yet) |
| Theme switcher command | Ready |
| Gin adapter (`design_system_api_gin`) | Planned |
| Media Library pilot under Claro, Default Admin and Gin | Planned |

## Useful commands

| Command | What it does |
|---|---|
| `ddev install-demo` | Install from scratch and print a login link |
| `ddev drush uli` | New login link |
| `ddev admin-theme <name>` | Switch admin theme |
| `ddev workspace-mode on\|off\|status` | Use local module checkouts |
