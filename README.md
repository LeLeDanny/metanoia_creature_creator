---
title: Creature Creator
---

# Metanoia Creature Creator

A browser-based tool for building enemy and NPC stat blocks for the Metanoia TTRPG. Fill in the fields, allocate XP, and click Export to get a formatted markdown stat block ready to paste into any document.

---

## How to Run

1. Open `index.html` in a browser (Chrome or Firefox recommended).
2. That is it. There is nothing to install.

---

## How to Save, Load, and Export

- **Load:** Click "Open Creature" and select a `.json` file from your drive.
- **Save:** Click "Save Creature" to write the current state to a `.json` file on your drive. This preserves your work in progress.
- **New:** Click "New Creature" to start a blank stat block.
- **Export Markdown:** Click "Export Stat Block" to copy a formatted markdown stat block to your clipboard, ready to paste into the bestiary or any document.

---

## Project Structure

```
Creature_Creator/
  index.html        # Entry point. Open this in a browser.
  style.css         # All styles.
  app.js            # Orchestrator.
  features.md       # What the app does and what is planned.
  guardrails.md     # Rules for how this project is built.
  schema.md         # Creature JSON schema definition.
  README.md         # This file.
  modules/
    header.js       # Name, Category, Realm, XP
    xpLedger.js     # XP allocation + inline intent level/die display
    armor.js        # Per-location Armor Strain
    passives.js     # Passive abilities (Resistant, Vulnerability, Custom, etc.)
    abilities.js    # Active and passive abilities
    specialMechanics.js # Freeform special rules
    fileIO.js       # Save / load / new / export markdown
```

---

## Deployment

The Creature Creator lives in a **separate public GitHub repository** under `LeLeDanny`, deployed via **GitHub Pages**. Source files are developed here in the vault. A GitHub Actions workflow in this vault automatically pushes the contents of `Software/Creature_Creator/` to that public repo whenever this repo's `main` branch is updated.

This keeps the Metanoia vault (private) separate from the publicly accessible tool.

---

## For AI Assistants

Read these files before doing any work:

1. `guardrails.md` -- rules for how to build, what tech to use, and what not to build.
2. `features.md` -- what exists, what is in progress, and what is planned.
3. The enemy stat block design doc at `../../raw_input_files/enemy_stat_block_design_session.md` for the mechanical rules this tool encodes.

**The core rule: build one feature at a time, confirm it works, then move on.**

---

## Rules Reference

The stat block format is drawn from the Metanoia enemy design rules. Key values the app calculates or enforces:

| Stat | Formula |
|---|---|
| Strain Max | `4 + 2 × (Realm + Strain XP)` |
| Stride | `2 + Stride XP` |
| Wound Slots (default) | 3 (flat; GM can override per creature) |
| Intent Die | d3-1 (L0), d3 (L1), d4 (L2), d5 (L3), d6 (L4), d7 (L5) |

All of these are calculated automatically. The user inputs XP and realm; the tool derives the rest.
