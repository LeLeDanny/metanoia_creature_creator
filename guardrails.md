---
title: Development Guardrails
---

# Development Guardrails

This document governs how the Creature Creator is built. It exists so that any AI assistant working on this project builds incrementally, predictably, and in a way the project owner can follow and verify at each step.

---

## Core Rule

**One feature at a time.**

No feature is introduced until the previous one is complete, committed, and confirmed working by the project owner. Do not anticipate future features by adding scaffolding, abstractions, or "hooks for later." Build exactly what is in scope for the current task.

---

## Feature Introduction Process

1. A feature must exist in `features.md` before it is built.
2. Before building, confirm with the project owner that the feature is the next priority.
3. Build only that feature. Do not refactor adjacent code unless the feature cannot work otherwise.
4. When done, ask the project owner to confirm it works before moving on.

---

## Hosting

The app lives in a **separate public GitHub repository** under the `LeLeDanny` account, deployed via **GitHub Pages**. This keeps the Metanoia vault (private) separate from the publicly accessible tool.

The source files in `Software/Creature_Creator/` in the vault are the working copy. A GitHub Actions workflow in the vault pushes this folder to the public repo automatically on push to `main`.

---

## Technical Stack

The application uses:

- **Vanilla HTML, CSS, and JavaScript only.** No frameworks (no React, Vue, Svelte, etc.). No build tools (no npm, webpack, vite, etc.).
- **No external dependencies.** The only external resource allowed is the Saira font from Google Fonts (matching the website and Character Sheet app).
- **A single `index.html`** as the entry point. The app runs by opening this file in a browser.
- **CSS in a single `style.css` file.**
- **JavaScript in a single `app.js` file** acting as orchestrator, with feature logic split into module files under `modules/`.

This keeps the project accessible: there is nothing to install, nothing to compile, and nothing to configure.

**No ES module syntax (`import`/`export`).** ES modules are blocked by browsers when opening HTML files directly from the filesystem (`file://`). Each module uses an IIFE that exposes a single capitalised global. Scripts are loaded via `<script src="...">` tags in `index.html` in dependency order. This ensures the app works by double-clicking `index.html` with no server required.

---

## Visual Design

Match the Metanoia website and Character Sheet app aesthetic exactly.

**Font:** Saira (Google Fonts), sans-serif fallback.

**Accent:** `#cc7070`

**Dark mode (default):**
- Background: `#111111`
- Surface: `#1a1a1a`
- Border: `#2a2a2a`
- Text: `#e8e8e8`
- Accent: `#cc7070`
- Accent high: `#f0b8b8`

**Light mode:**
- Background: `#ffffff`
- Surface: `#f5f5f5`
- Border: `#e5e5e5`
- Text: `#333333`
- Accent: `#cc7070`
- Accent high: `#8b4545`

Headings: italic, bold. The theme toggle defaults to dark mode and respects the user's OS preference.

---

## Layout

- **Responsive but desktop-primary.** Designed for a wide screen first. Mobile must be readable and usable, but the experience is optimized for desktop.
- Do not build a separate mobile layout. Use a single responsive layout with breakpoints.

---

## Code Architecture

JavaScript is split into focused module files. Each module owns exactly one section of the form. No module reaches into another module's logic directly.

**Structure:**

```
app.js                  (orchestrator only)
modules/
  header.js             (name, category, realm, xp total, structured polarities list)
  xpLedger.js           (XP allocation + inline intent level/die display)
  armor.js              (per-location AS)
  passives.js           (passive abilities including Resistant and Vulnerability)
  abilities.js          (active and passive abilities)
  specialMechanics.js   (freeform special rules text)
  fileIO.js             (save / load / new / export markdown)
```

**Each module exposes three things and nothing else:**

- `render(creature)`: takes the full creature object, updates the DOM for that section
- `read()`: reads the DOM for that section, returns a partial creature object
- `init(onUpdate)`: sets up event listeners; calls `onUpdate` whenever the user changes something

**The orchestrator (`app.js`) does:**

- Holds the single source of truth: the current creature object in memory
- On load: passes the creature to every module's `render()`
- On any change: calls `read()` on the changed module, merges into the creature object, updates the unsaved-changes flag
- On save: assembles the full creature from all modules via `read()`, writes to file
- On export: assembles the markdown stat block from the creature object, copies to clipboard
- Never contains section-specific logic

**Rules:**

- No module imports another module. All coordination goes through `app.js`.
- Calculated values (Strain Max, Stride, intent die) are computed in the module that displays them, not in `app.js`.

---

## Calculated Values

The following values are derived from other inputs and must be calculated by the app, not entered manually:

- Strain Max: `4 + 2 × (Realm + Strain XP)`
- Stride: `2 + Stride XP`
- Wound Slots default: 3 (flat; override per creature via `coreStats.woundSlotsOverride`)
- Intent Level: equals XP spent on that intent (min 0, max 5)
- Intent Die: L0 = d3-1, L1 = d3, L2 = d4, L3 = d5, L4 = d6, L5 = d7

---

## File Save and Load

- Creatures are saved as `.json` files to the user's local drive.
- Save uses the browser's File System Access API with a fallback to a standard file download.
- Load uses a standard file input (`<input type="file">`).
- The JSON schema is defined before any UI is built (see `features.md`).

---

## Markdown Export

The export function assembles a stat block matching the format documented in `../../raw_input_files/enemy_stat_block_design_session.md`. The output is copied to the clipboard. Do not render the markdown inside the app.

---

## What Not to Build

- No user accounts, authentication, or server-side storage.
- No in-app markdown preview or renderer.
- No dice roller.
- No party encounter builder until listed in `features.md`.
- No separate mobile layout.

---

## Browser Target

Test in Chrome first. The app must also work in Firefox. Safari is a secondary concern.

---

## Commits

Each feature gets its own commit. Commit messages should name the feature. Do not bundle unrelated changes.
