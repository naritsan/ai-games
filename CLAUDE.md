# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository hosts browser-based games built with HTML/CSS/JavaScript, published via GitHub Pages. Each game lives in its own subdirectory. The repository root serves as the index/landing page.

## Repository Structure

```
/
├── index.html          # Landing page listing all games
├── CLAUDE.md
└── games/
    └── <game-name>/    # One directory per game
        ├── index.html  # Game entry point
        ├── style.css
        └── game.js
```

## GitHub Pages

- Published from the `main` branch, root directory (`/`)
- URL pattern: `https://<username>.github.io/ai-games/<game-name>/`
- No build step — all files are served statically as-is
- Avoid server-side dependencies; everything must run in the browser

## Development

Open game files directly in a browser, or use a local static server to avoid CORS issues with assets:

```bash
# Python (no install needed)
python3 -m http.server 8080

# Node (if available)
npx serve .
```

Then open `http://localhost:8080` in a browser.

## Code Conventions

- Vanilla HTML/CSS/JS as the default; Phaser.js and Three.js are approved libraries when they provide clear value
- Keep each game self-contained in its subdirectory — no shared code across games unless a common utility is genuinely reusable
- Split files as needed within the game's directory; no rigid single-file requirement
- ES modules (`type="module"`) are fine; bundlers are not needed
- Target modern evergreen browsers only (no IE/legacy polyfills)
- No CSS methodology required — keep styles per-game and self-contained

## Adding a New Game

1. Create a new subdirectory: `games/<game-name>/index.html`
2. Add a link (name only, no description required) to the root `index.html`
3. Keep all game assets inside the game's own directory

## Workflow

- Always work on a feature branch, never commit directly to `main`
- Open a pull request to merge into `main`
