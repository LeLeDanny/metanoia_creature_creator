// coreStats.js
// Owns the Core Stats section:
//   - Strain Max  (derived: 4 + 2 x (Realm + Strain XP))
//   - Stride      (derived: 2 + Stride XP)
//   - Wound Slots (default 3, GM-overridable)
//   - Range       (free text)
//   - Damage Types(free text)
// Exposes a single global: CoreStats
//
// Depends on globals: Schema

const CoreStats = (() => {

  let _orchestrator = null;

  let strainMaxEl   = null;
  let strideEl      = null;
  let woundSlotsEl  = null;
  let rangeEl       = null;
  let damageTypesEl = null;

  // ─── Public API ───────────────────────────────────────────

  function init(orchestrator) {
    _orchestrator = orchestrator;

    strainMaxEl   = document.getElementById('cs-strain-max');
    strideEl      = document.getElementById('cs-stride');
    woundSlotsEl  = document.getElementById('cs-wound-slots');
    rangeEl       = document.getElementById('cs-range');
    damageTypesEl = document.getElementById('cs-damage-types');

    const onChange = function () { _orchestrator.handleChange(); };
    if (woundSlotsEl)  woundSlotsEl.addEventListener('input', onChange);
    if (rangeEl)       rangeEl.addEventListener('input', onChange);
    if (damageTypesEl) damageTypesEl.addEventListener('input', onChange);
  }

  function render(creature) {
    const c      = creature || {};
    const header = c.header    || {};
    const ledger = c.xpLedger  || {};
    const stats  = c.coreStats || {};

    const realm    = header.realm    || 0;
    const strainXp = ledger.strain   || 0;
    const strideXp = ledger.stride   || 0;

    const strainMax   = Schema.calcStrainMax(realm, strainXp);
    const stride      = Schema.calcStride(strideXp);
    const woundDefault = Schema.calcWoundSlotsDefault(realm);

    if (strainMaxEl) strainMaxEl.textContent = String(strainMax);
    if (strideEl)    strideEl.textContent    = String(stride);

    if (woundSlotsEl) {
      woundSlotsEl.placeholder = String(woundDefault);
      const override = stats.woundSlotsOverride;
      const displayed = (override == null) ? '' : String(override);
      if (document.activeElement !== woundSlotsEl && woundSlotsEl.value !== displayed) {
        woundSlotsEl.value = displayed;
      }
    }

    setInputValue(rangeEl,       stats.range       || '');
    setInputValue(damageTypesEl, stats.damageTypes || '');
  }

  function read() {
    const current  = _orchestrator ? _orchestrator.getCreature() : {};
    const existing = current.coreStats || {};

    let override = existing.woundSlotsOverride;
    if (woundSlotsEl) {
      const raw = woundSlotsEl.value.trim();
      if (raw === '') {
        override = null;
      } else {
        const parsed = parseInt(raw, 10);
        override = isNaN(parsed) ? null : parsed;
      }
    }

    return {
      coreStats: Object.assign({}, existing, {
        range:              rangeEl       ? rangeEl.value       : (existing.range       || ''),
        damageTypes:        damageTypesEl ? damageTypesEl.value : (existing.damageTypes || ''),
        woundSlotsOverride: override,
      }),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────

  function setInputValue(el, value) {
    if (!el) return;
    if (document.activeElement === el && el.value === value) return;
    if (el.value !== value) el.value = value;
  }

  return { init, render, read };
})();
