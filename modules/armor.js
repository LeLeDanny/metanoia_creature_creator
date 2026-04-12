// armor.js
// Owns the Armor section: per-location Armor Strain (AS) values for the
// four fixed hit locations (head, arms, legs, center). Labels default to
// the location name and are overridable for non-humanoid creatures.
// Exposes a single global: Armor
//
// Depends on globals: Schema

const Armor = (() => {

  let _orchestrator = null;
  let listEl        = null;

  const AS_MIN = 0;
  const AS_MAX = 10;

  // ─── Public API ───────────────────────────────────────────

  function init(orchestrator) {
    _orchestrator = orchestrator;
    listEl = document.getElementById('armor-list');
    buildRows();
  }

  function render(creature) {
    if (!listEl) return;
    const armor = (creature && creature.armor) || {};

    Schema.HIT_LOCATIONS.forEach(function (key) {
      const slot    = armor[key] || {};
      const labelEl = listEl.querySelector('[data-armor-label="' + key + '"]');
      const asEl    = listEl.querySelector('[data-armor-as="' + key + '"]');
      const label   = (slot.label != null && slot.label !== '') ? slot.label : Schema.HIT_LOCATION_LABELS[key];
      const as      = slot.as || 0;
      setInputValue(labelEl, label);
      setInputValue(asEl, String(as));
    });
  }

  function read() {
    const current  = _orchestrator ? _orchestrator.getCreature() : {};
    const existing = current.armor || {};
    const out = {};

    Schema.HIT_LOCATIONS.forEach(function (key) {
      const slot    = existing[key] || {};
      const labelEl = listEl ? listEl.querySelector('[data-armor-label="' + key + '"]') : null;
      const asEl    = listEl ? listEl.querySelector('[data-armor-as="' + key + '"]') : null;

      const rawLabel = labelEl ? labelEl.value.trim() : '';
      const label    = rawLabel || Schema.HIT_LOCATION_LABELS[key];

      let as = slot.as || 0;
      if (asEl) {
        const parsed = parseInt(asEl.value, 10);
        as = isNaN(parsed) ? 0 : Math.max(AS_MIN, Math.min(AS_MAX, parsed));
      }

      out[key] = { as: as, label: label };
    });

    return { armor: out };
  }

  // ─── Helpers ──────────────────────────────────────────────

  function buildRows() {
    if (!listEl) return;
    listEl.innerHTML = '';

    Schema.HIT_LOCATIONS.forEach(function (key) {
      const defaultLabel = Schema.HIT_LOCATION_LABELS[key];

      const row = document.createElement('div');
      row.className = 'armor-row';

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'armor-label-input';
      labelInput.placeholder = defaultLabel;
      labelInput.setAttribute('data-armor-label', key);
      labelInput.setAttribute('aria-label', defaultLabel + ' label');
      labelInput.autocomplete = 'off';

      const asLabel = document.createElement('label');
      asLabel.className = 'armor-as-label';
      asLabel.textContent = 'AS';
      const asId = 'armor-as-' + key;
      asLabel.setAttribute('for', asId);

      const asInput = document.createElement('input');
      asInput.type = 'number';
      asInput.className = 'armor-as-input';
      asInput.id = asId;
      asInput.min = String(AS_MIN);
      asInput.max = String(AS_MAX);
      asInput.step = '1';
      asInput.setAttribute('data-armor-as', key);

      row.appendChild(labelInput);
      row.appendChild(asLabel);
      row.appendChild(asInput);
      listEl.appendChild(row);

      const onChange = function () { _orchestrator.handleChange(); };
      labelInput.addEventListener('input', onChange);
      asInput.addEventListener('input', onChange);
    });
  }

  function setInputValue(el, value) {
    if (!el) return;
    if (document.activeElement === el && el.value === value) return;
    if (el.value !== value) el.value = value;
  }

  return { init, render, read };
})();
