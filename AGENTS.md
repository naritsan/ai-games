# Repository Guidelines

## Project Structure & Module Organization

This repository is a static GitHub Pages site for browser games. The root `index.html` is the landing page and should link to each playable game. Game implementations live under `games/<game-name>/`, with each game kept self-contained.

Typical game layout:

```text
games/<game-name>/
  index.html
  style.css
  game.js
  assets/
```

Keep game-specific assets, scripts, and styles inside that game directory. Add shared utilities only when more than one game clearly needs them.

## Build, Test, and Development Commands

There is no build step; files are served directly by GitHub Pages.

```bash
python3 -m http.server 8080
```

Starts a local static server from the repository root. Open `http://localhost:8080/` to test the landing page and game links.

```bash
npx serve .
```

Alternative static server if Node tooling is available.

## Coding Style & Naming Conventions

Use vanilla HTML, CSS, and JavaScript unless a game benefits from a focused browser library such as Phaser.js or Three.js. Prefer modern browser APIs and avoid bundlers unless the repository adopts one explicitly.

Use two-space indentation in HTML and CSS, and follow the existing JavaScript style: `const`/`let`, semicolons, descriptive camelCase names, and small functions grouped by responsibility. Directory names should be lowercase kebab-case, for example `games/alien-shooting/`.

## Testing Guidelines

No automated test framework is configured. Validate changes manually in a browser through the local static server. For each changed game, check load behavior, controls, restart/game-over flows, responsive canvas or layout behavior, and the browser console for errors.

When adding complex game logic, consider adding focused tests only after introducing the required test tooling in a separate, documented change.

## Commit & Pull Request Guidelines

Recent commits use short imperative summaries such as `Add Alien Shooting game` and `Rename space-invaders directory to alien-shooting`. Follow that style: one clear sentence, capitalized, without trailing punctuation.

Work on a feature branch and open a pull request into `main`. PRs should describe the gameplay or site change, list manual browser checks performed, link related issues when applicable, and include screenshots or short recordings for visible UI or game changes.

## GitHub Pages & Configuration

The site is published from the `main` branch root. Keep paths relative so games work under the GitHub Pages URL prefix. Avoid server-side dependencies, secrets, or generated files that are not needed at runtime.
