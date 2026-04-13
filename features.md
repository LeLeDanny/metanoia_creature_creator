---
title: Features
---

# Creature Creator: Features

This document is the authoritative list of what the app does, what is planned, and in what order things get built. Nothing gets built without appearing here first.

**Status labels:** `done` | `in progress` | `planned` | `future`

---

## Hosting & Deployment

- Separate public GitHub repo under `LeLeDanny` (name TBD)
- Deployed via GitHub Pages (free)
- Source files developed in the vault under `Software/Creature_Creator/`, pushed to the public repo automatically via a GitHub Actions workflow on push to `main`

---

## Output

The app produces two outputs:

1. **Save file (`.json`):** preserves the creature in progress so the GM can come back to it.
2. **Exported markdown:** a fully formatted stat block matching the Metanoia bestiary format, copied to clipboard with one click.

---

## MVP: Build Order

Features are built in this sequence. Do not skip ahead.

---

### 1. Data Model (JSON Schema)

**Status:** `done`

The full creature JSON schema is defined in `schema.md`. Every later module reads and writes against that document.

Key shape:

- `meta`: app version, schema version, last saved date
- `header`: name, category (Corrupted / Thuim NPC / Fauna / Custom), faction, realm (0-5), xp total, description, polarities (array of `{ id, name, note }`)
- `xpLedger`: single source of truth for XP allocation; holds `strain`, `stride`, `abilities`, and an `intents` map keyed by lowercase intent key
- `coreStats`: range, damage types, wound slots override
- `armor`: four fixed location keys (head, arms, legs, center) each with `as` and `label`; `label` is overridable for non-humanoids
- Resistances and vulnerabilities are modeled as `Resistant` / `Vulnerability` entries in `passiveAbilities` rather than a separate list
- `activeAbilities`: array of ability objects mirroring the Character Sheet Application model (`intents[]`, `awarenessState`, `awarenessSubstate`, `duration`, `conditionDetails[]`, `polarity`); strain cost is derived, not stored
- `passiveAbilities`: array of `{ name, level, notes }`; `name` is from `Schema.PASSIVE_ABILITIES` or the literal `"Custom"` for free-form passives
- `tpme`: `{ task, purpose, method, endstate }` — behavior framework that drives how the NPC acts (replaces the older freeform `specialMechanics` string)

Derived values (Strain Max, Stride, wound slot default, intent level, intent die, XP spent, XP remaining, active ability strain cost) are computed by the module that renders them, never persisted.

---

### 2. App Shell

**Status:** `done`

Structural frame with no creature data yet.

- `index.html`, `style.css`, `app.js`, `modules/schema.js` in place
- Saira font loaded from Google Fonts
- Dark/light mode toggle, defaulting to dark, respecting OS preference, persisted to localStorage
- Header with app brand, theme toggle, and unwired New / Open / Save / Export buttons (wired in Step 3)
- Placeholder sections (empty, labeled) for Header, Core Stats, XP Ledger, Capability Dice, Armor, Resistances, Abilities, TPME
- Three-column desktop layout that collapses to two columns below 1100px and one column below 720px

---

### 3. New / Load / Save / Export

**Status:** `done`

The core file and export workflow, owned by `modules/fileIO.js`.

- **New:** replaces state with `Schema.blankCreature()`; confirms before discarding dirty state
- **Open:** file input reads a `.json` file, validates shape, migrates missing fields against `blankCreature`, then renders
- **Save:** File System Access API with anchor-download fallback for Firefox/Safari; suggested filename slugified from creature name
- **Export:** assembles a full markdown stat block (header, core stats table, formula callouts, XP spent table, capability dice table, armor, passive abilities, polarities block, active abilities, special mechanics) and copies to clipboard; falls back to `execCommand('copy')` and then console log
- Unsaved-changes dot in header driven by `orchestrator.markDirty()` / `markClean()`; cleared on new/open/save

---

### 4. Header

**Status:** `done`

Top-of-stat-block identity fields.

- Name (text input, full row)
- Category (dropdown): Corrupted, Thuim NPC, Fauna, Custom (sourced from `Schema.CATEGORIES`)
- Faction (free text; shown in export meta line when non-empty)
- Realm (dropdown 0-5, labeled: Void, Spark, Flame, Star, Constellation, Galaxy)
- XP total (number input)
- XP spent (calculated from ledger allocations, displayed read-only)
- XP remaining (calculated, displayed read-only; flagged red when negative)
- Polarities (structured list, full-width). `+ Add Polarity` opens a modal with Name and Usage Note fields. Each row in the list shows name, note, Edit, Remove. Polarity is flavor; intent level is power. Exported as a `### Polarities` section when the list is non-empty, one bullet per entry (`- Name: note`). The Active Abilities editor reads polarity names from this list to populate its polarity dropdown.

Field layout: Name / Category + Faction / Realm + XP Total / XP Spent + XP Remaining / Polarities (full-width list).

---

### 5. Core Stats

**Status:** `done`

Auto-calculated stats derived from realm and XP allocation.

- Strain Max: `4 + 2 × (Realm + Strain XP)` (read-only, re-renders when Realm or Strain XP changes)
- Stride: `2 + Stride XP` (read-only, re-renders when Stride XP changes)
- Wound Slots: number input; empty = use default 3 (shown as placeholder); any value stored is treated as an explicit override
- Range: free text (weapon or natural attack range bands)
- Damage Types: free text

Strain XP and Stride XP come from the XP Ledger (Step 6); until that module lands both contribute 0.

---

### 6. XP Ledger

**Status:** `done`

Tracks where every XP point went. This feeds the auto-calculated stats and the capability dice.

- Strain XP: number input
- Stride XP: number input
- Intents: curated list. "+ Add Intent" opens a modal that shows only intents not yet allocated (Cast [X] is excluded from the add flow). Each active intent row is inline-editable with a remove button.
- Passive ability XP is derived from the Passive Abilities section (step 9) and folded into XP Spent by `Schema.calcXpSpent`; there is no manual "Passive Abilities" input on the ledger
- Footer row displays Spent / Total / Remaining; Remaining flags red when negative
- Existing Cast [X] allocations in loaded JSON are still shown as rows (and can be removed) but cannot be re-added via the modal

---

### 7. Capability Dice

**Status:** `done`

Intent level and die are shown inline on each XP Ledger intent row; no separate section.

- Each intent row renders: `Label | XP select (1-5) | "XP" unit | Die | Remove`
- Add-Intent dialog XP picker is also a 1-5 dropdown
- Level = XP spent on that intent, clamped to 0-5 via `Schema.calcIntentLevel`
- Die from `Schema.CAPABILITY_DIE_LADDER`: L0 = d3-1, L1 = d3, L2 = d4, L3 = d5, L4 = d6, L5 = d7
- Both values re-render automatically whenever the XP input changes
- Fully derived: nothing is persisted beyond the intent XP already stored in the ledger

---

### 8. Armor

**Status:** `done`

Per-location Armor Strain values, owned by `modules/armor.js`.

- Four fixed locations keyed `head`, `arms`, `legs`, `center`
- Each row: editable label input (placeholder = default location name) + AS number input clamped 0-10
- Empty label falls back to the default on read; the `armor[key]` object always stores a concrete label
- Rendered into `#armor-list` via `data-armor-label` / `data-armor-as` attributes
- Exported as a formatted table by `FileIO.buildArmorTable`

---

### 9. Passive Abilities

**Status:** `done` (infrastructure + Resistant, Vulnerability, and Custom). Bespoke forms for the other `Schema.PASSIVE_ABILITIES` entries are tracked individually below.

Damage type resistances and vulnerabilities are modeled as passives (`Resistant` and `Vulnerability` entries), matching the player system. Vulnerability grants XP back to the creature's pool, allowing trade-offs for extra intent/strain/stride investment.

Owned by `modules/passives.js`.

- `+ Add Passive` opens a modal. The name dropdown lists every entry in `Schema.PASSIVE_ABILITIES` plus a `Custom…` option for free-form passives.
- Every passive carries a `description` in `Schema.PASSIVE_ABILITIES`. The dialog renders it at the top of the form (bespoke and generic) and list rows expose it as a hover tooltip.
- Each row shows: name, structured details (damage type tag, derived Strain modifier, XP cost/grant badge), Edit, Remove.
- Forms implemented with full bespoke UI:
  - **Resistant**: damage type dropdown, level input, derived reduction and XP cost (reflects `Physical`/`Ren` multipliers).
  - **Vulnerability**: damage type dropdown, level input capped at 5, derived extra Strain and XP grant (negative cost via `Schema.calcPassiveXpCost`).
  - **Custom**: free-form name, XP cost input, description textarea.
- All other `Schema.PASSIVE_ABILITIES` entries use a generic fallback form (level input respecting `costType`/`maxLevel` + notes textarea) until a bespoke form is added.
- XP cost of each passive is derived; `Schema.calcPassiveXpTotal` feeds the XP Spent total on the ledger. Vulnerability costs are negative so they reduce Spent.

#### Passive Ability Forms (incremental)

Each of the following gets its own bespoke form as a future feature. Until then they use the generic fallback.

| Passive | Status |
|---|---|
| Resistant | `done` |
| Vulnerability | `done` |
| Juggernaut | `planned` |
| Advanced Awareness | `planned` |
| Stability | `planned` |
| Advanced Sense | `planned` (may not apply to creatures) |
| Never at Loss | `planned` |
| Armored Aura | `planned` |
| Freedom of Movement | `planned` |
| Unconstrained Mind | `planned` |
| Focused Execution | `planned` |
| Undetected Awareness | `planned` (may not apply to creatures) |
| Buildup | `planned` (may not apply to creatures) |
| Shared Assurance | `planned` |
| Item Proficiency | `planned` |
| Invigorated | `planned` |
| Polarity Attunement | `planned` (may not apply to creatures) |
| No Wound, All Condition | `planned` |
| Compounding | `planned` |
| Relentless Application | `planned` |
| Unmeasured Response | `planned` |

---

### 10. Active Abilities

**Status:** `done`

Passive abilities have their own section (step 9). This section is active-only and mirrors the Character Sheet Application's active ability model.

- Add and remove abilities freely, owned by `modules/abilities.js`
- Each ability has: Name, Polarity, Description, Intents, Awareness state/substate, Duration, Condition details
- `+ Add Ability` opens a dialog with collapsible Intents / Awareness / Duration sections; strain cost displays live in the footer
- Polarity dropdown is populated from `header.polarities`; `castX` is excluded from the creature creator intent grid
- Condition details appear as free-text rows when the `condition` intent is selected; each entry adds +1 strain (minimum 1)
- Awareness state changes rebuild the substate radios; `extended` awareness disables intents outside its `allowedIntents` list with a warning when one is selected
- Cards in the list render name, polarity · intents · substate · duration summary, description preview, and derived strain cost; the row is click-to-edit with a remove button
- Strain cost is derived via `Schema.calcAbilityStrainCost` and never stored
- Exported as a `### Active Abilities` block with one entry per ability: `**Name** (X Strain) _Polarity · Substate · Duration_: Description [Intent labels]`

---

### 11. TPME

**Status:** `done`

A behavior framework that tells the GM (and any AI running the creature) what the NPC is after and how to play them. Replaces the older freeform `specialMechanics` field.

- Owned by `modules/tpme.js`
- Four textareas, stored as `tpme: { task, purpose, method, endstate }`:
  - **Task** — what the NPC is after in life (a standing drive, not a single-scene objective)
  - **Purpose** — the "In order to..." behind the task
  - **Method** — how they pursue it; default to the easy path unless forced to the hard path, with priorities the NPC weighs
  - **Endstate** — what counts as success
- Loaded JSON migrates by moving any legacy `specialMechanics` string into `tpme.method` so no written text is lost
- Exported as a `### TPME` section with one bolded row per non-empty field (e.g. `**Task:** ...`); the whole block is omitted when all four fields are blank
- Rules-that-change-the-game content (immunities, death behaviors, field effects) belongs on a passive ability, not here

---

### 12. Markdown Export

**Status:** `planned`

Assembles all sections into a formatted markdown stat block and copies it to the clipboard.

- Format matches the Metanoia bestiary standard (see design doc)
- One-click copy
- No special characters that break markdown tables

---

## Post-MVP (Future)

| Feature | Notes |
|---|---|
| Encounter XP budget tool | Given party realm and size, suggest total XP budget for a balanced encounter |
| Print / export view | Clean layout for printing or saving as PDF |
| Batch export | Export multiple saved creatures into one markdown document |
