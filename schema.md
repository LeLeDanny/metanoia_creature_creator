---
title: Creature JSON Schema
schemaVersion: 1
---

# Creature JSON Schema

This document defines the structure of a creature `.json` file. Every field the app reads or writes is described here. Bump `schemaVersion` whenever a breaking change is made.

---

## Top-Level Shape

```json
{
  "meta": { ... },
  "header": { ... },
  "xpLedger": { ... },
  "coreStats": { ... },
  "armor": { ... },
  "activeAbilities": [ ... ],
  "passiveAbilities": [ ... ],
  "specialMechanics": ""
}
```

---

## `meta`

| Field | Type | Notes |
|---|---|---|
| `appVersion` | string | App version that wrote the file (e.g. `"0.1.0"`). |
| `schemaVersion` | integer | Bumps on breaking schema changes. Current: `1`. |
| `lastSaved` | string (ISO-8601) \| null | Timestamp of last save. `null` on a fresh creature. |

---

## `header`

| Field | Type | Notes |
|---|---|---|
| `name` | string | Free text. |
| `category` | enum | One of: `Corrupted`, `Thuim NPC`, `Fauna`, `Custom`. |
| `faction` | string | Free text. Shown in the exported meta line when non-empty. |
| `realm` | integer | 0 to 5. Labels: Void (0), Spark (1), Flame (2), Star (3), Constellation (4), Galaxy (5). |
| `xpTotal` | integer | Total XP budget for this creature. |
| `description` | string | Short flavor blurb (the italic line above the stat table in exports). |
| `polarities` | array of `{ id, name, note }` | Structured list of the creature's elemental or conceptual affinities. `name` is free text; `note` is an optional usage description. Each entry is rendered as `- Name: note` in the exported `### Polarities` section, and the active-ability editor populates its polarity dropdown from `name`s here. Polarity is flavor; intent level is power. No value rank on enemies. |

---

## `xpLedger`

The single source of truth for how every XP point is spent. Capability dice, Strain Max, and Stride all derive from this.

| Field | Type | Notes |
|---|---|---|
| `strain` | integer | XP spent on Strain. Feeds `Strain Max = 4 + 2 × (realm + strain)`. |
| `stride` | integer | XP spent on Stride. Feeds `Stride = 2 + stride`. |
| `intents` | object | Map of intent key to XP spent. Only intents with XP > 0 need a key; omitted intents are level 0. |

**Intent keys** (lowercase, matching the Character Sheet Application's `Schema.INTENTS`):
`harm`, `guard`, `dodge`, `heal`, `recover`, `seize`, `move`, `displace`, `teleport`, `condition`, `hide`, `know`, `convince`, `create`, `manifest`, `castX`.

**XP spent** equals the sum of `strain + stride + sum(intents) + passive ability costs`. Passive ability XP (including negative costs from `Vulnerability`) is derived via `Schema.calcPassiveXpTotal(passiveAbilities)`; it is not stored in the ledger. The header's `xpTotal` minus XP spent is "XP remaining."

---

## `coreStats`

| Field | Type | Notes |
|---|---|---|
| `range` | string | Free text (e.g. `"1-2"`). Range bands of the default attack. |
| `damageTypes` | string | Free text (e.g. `"Sharp, Electric"`). |
| `woundSlotsOverride` | integer \| null | `null` uses the realm default (0-1: 2, 2-3: 3, 4-5: 4). An integer overrides. |

---

## `armor`

Four fixed location keys so mechanics stay stable across humanoid and non-humanoid creatures. The GM can rename locations narratively via `label` without changing the underlying slot.

```json
"armor": {
  "head":   { "as": 1, "label": "Head" },
  "arms":   { "as": 1, "label": "Arms" },
  "legs":   { "as": 1, "label": "Legs" },
  "center": { "as": 1, "label": "Center" }
}
```

| Field | Type | Notes |
|---|---|---|
| `as` | integer | Armor Strain, 0 to 10. |
| `label` | string | Display name. Defaults to the canonical name; overridable (e.g. `"Carapace"` for `center`). |

Hit location is still determined by the player's base d8 roll using the canonical mapping (1=head, 2-3=arms, 4-5=legs, 6-8=center).

---

## `activeAbilities`

Mirrors the Character Sheet Application's active ability model. Strain cost is derived from the composition of intents, awareness substate, and duration via the same `calcAbilityStrainCost` logic. Strain cost is not stored.

```json
{
  "id": "1712345678-ab3",
  "name": "Roc Slash",
  "description": "Launches an attack in a line extending 3 range bands.",
  "intents": ["harm"],
  "awarenessState": "suppressed",
  "awarenessSubstate": "line",
  "duration": "instant",
  "conditionDetails": [],
  "polarity": ""
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable unique id (e.g. `${timestamp}-${random}`). Used for DOM keys. |
| `name` | string | Free text. |
| `description` | string | Free text. Rendered in the exported stat block. |
| `intents` | array of strings | Intent keys from `Schema.INTENTS`. Multiple intents sum their strain costs. |
| `awarenessState` | enum | `suppressed`, `extended`, or `focused`. |
| `awarenessSubstate` | enum | One of the substates valid for the selected state (e.g. `touch`, `arc`, `line`, `aura`, `single`, `ricochet`, `chain`, `narrow`, `wide`, `massive`). |
| `duration` | enum | `instant`, `charged`, `sustained`, `persistent`, or `permanent`. |
| `conditionDetails` | array of strings | Free text labels when `"condition"` is in `intents` (e.g. `["Burning"]`). Each entry adds +1 strain; minimum 1 if the condition intent is selected. |
| `polarity` | string | Optional. Polarity tag for display; no mechanical effect. |

---

## `passiveAbilities`

Mirrors the Character Sheet Application's passive ability model. Passives are drawn from `Schema.PASSIVE_ABILITIES` or marked `"Custom"` to hold a free-form entry.

```json
[
  { "id": "1712...-pa1", "name": "Resistant",     "level": 2, "notes": "Heat" },
  { "id": "1712...-pa2", "name": "Vulnerability", "level": 3, "notes": "Cold" },
  { "id": "1712...-pa3", "name": "Custom",        "level": 1, "notes": "Electric Body: Regains 1 Strain when struck by Electric damage." }
]
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable unique id. |
| `name` | string | Name from `Schema.PASSIVE_ABILITIES`, or the literal string `"Custom"`. |
| `level` | integer | 1 or higher. `maxLevel` enforced per-passive by the Schema (e.g. `Vulnerability` caps at 5). |
| `notes` | string | Free text. For `Custom`, holds the full ability description. For listed passives, holds parameter text (e.g. the damage type for `Resistant` and `Vulnerability`). |

**XP cost** is derived per passive by `Schema.calcPassiveXpCost(passive)`. `Resistant` and `Vulnerability` both use the chosen damage type's `xpPerLevel` multiplier from `Schema.DAMAGE_TYPES` (default `1`, `2` for `Physical`, `5` for `Ren`). `Vulnerability` is a negative cost: it grants XP back to the creature's pool rather than spending it. Other passives cost their `level` directly.

---

## `specialMechanics`

A single string. Markdown is allowed. For immunities, field effects, unique death behaviors, multiplication rules, and anything else that changes how players interact with the creature at a fundamental level.

---

## Derived Values (Not Stored)

These are computed by the module that renders them, never persisted:

| Value | Formula |
|---|---|
| Strain Max | `4 + 2 × (realm + xpLedger.strain)` |
| Stride | `2 + xpLedger.stride` |
| Wound Slots (default) | `3` (flat). Overridden by `coreStats.woundSlotsOverride` if set. |
| Intent Level (per intent) | `xpLedger.intents[key] ?? 0`, clamped 0 to 5. |
| Intent Die | L0: d3-1, L1: d3, L2: d4, L3: d5, L4: d6, L5: d7. |
| XP Spent | `strain + stride + abilities + sum(intents)`. |
| XP Remaining | `header.xpTotal - XP Spent`. |
| Active Ability Strain Cost | Sum of each intent's strain, plus the awareness substate's strain, plus the duration's strain. Condition intent adds +1 per entry in `conditionDetails` (min 1). |

---

## Blank Creature Factory

A "New Creature" produces this object:

```json
{
  "meta":        { "appVersion": "0.1.0", "schemaVersion": 1, "lastSaved": null },
  "header":      { "name": "", "category": "Custom", "faction": "", "realm": 0, "xpTotal": 0, "description": "", "polarities": [] },
  "xpLedger":    { "strain": 0, "stride": 0, "intents": {} },
  "coreStats":   { "range": "", "damageTypes": "", "woundSlotsOverride": null },
  "armor": {
    "head":   { "as": 0, "label": "Head" },
    "arms":   { "as": 0, "label": "Arms" },
    "legs":   { "as": 0, "label": "Legs" },
    "center": { "as": 0, "label": "Center" }
  },
  "activeAbilities":  [],
  "passiveAbilities": [],
  "specialMechanics": ""
}
```
