// xpLedger.js
// Owns the XP Ledger section: Strain XP, Stride XP, and a user-curated list
// of intent allocations. The ledger feeds Strain Max, Stride, and Capability
// Dice. Passive ability XP comes from the Passive Abilities section and is
// folded into XP Spent by Schema.calcXpSpent.
//
// Exposes a single global: XpLedger
//
// Depends on globals: Schema

const XpLedger = (() => {

  let _orchestrator = null;

  let strainEl    = null;
  let strideEl    = null;

  let intentsListEl  = null;
  let intentsEmptyEl = null;
  let addBtnEl       = null;

  let dialogEl        = null;
  let dialogSelectEl  = null;
  let dialogXpEl      = null;
  let dialogCancelEl  = null;

  let spentEl     = null;
  let totalEl     = null;
  let remainingEl = null;

  // ─── Public API ───────────────────────────────────────────

  function init(orchestrator) {
    _orchestrator = orchestrator;

    strainEl    = document.getElementById('xp-strain');
    strideEl    = document.getElementById('xp-stride');

    intentsListEl  = document.getElementById('xp-intents-list');
    intentsEmptyEl = document.getElementById('xp-intents-empty');
    addBtnEl       = document.getElementById('xp-intent-add');

    dialogEl       = document.getElementById('xp-intent-dialog');
    dialogSelectEl = document.getElementById('xp-intent-dialog-select');
    dialogXpEl     = document.getElementById('xp-intent-dialog-xp');
    dialogCancelEl = document.getElementById('xp-intent-dialog-cancel');

    spentEl     = document.getElementById('xp-ledger-spent');
    totalEl     = document.getElementById('xp-ledger-total');
    remainingEl = document.getElementById('xp-ledger-remaining');

    const onChange = function () { _orchestrator.handleChange(); };
    if (strainEl)    strainEl.addEventListener('input', onChange);
    if (strideEl)    strideEl.addEventListener('input', onChange);

    if (addBtnEl) addBtnEl.addEventListener('click', openAddDialog);
    if (dialogCancelEl) dialogCancelEl.addEventListener('click', function () {
      if (dialogEl) dialogEl.close('cancel');
    });
    if (dialogEl) dialogEl.addEventListener('close', onDialogClose);
  }

  function render(creature) {
    const c       = creature || {};
    const ledger  = c.xpLedger || {};
    const intents = ledger.intents || {};

    setInputValue(strainEl, String(ledger.strain || 0));
    setInputValue(strideEl, String(ledger.stride || 0));

    renderIntentList(intents);

    const spent     = Schema.calcXpSpent(c);
    const total     = (c.header && c.header.xpTotal) || 0;
    const remaining = total - spent;

    if (spentEl)     spentEl.textContent = String(spent);
    if (totalEl)     totalEl.textContent = String(total);
    if (remainingEl) {
      remainingEl.textContent = String(remaining);
      remainingEl.classList.toggle('is-negative', remaining < 0);
    }
  }

  function read() {
    const current  = _orchestrator ? _orchestrator.getCreature() : {};
    const existing = current.xpLedger || {};

    const intents = {};
    if (intentsListEl) {
      const rows = intentsListEl.querySelectorAll('.xp-intent-row');
      rows.forEach(function (row) {
        const key   = row.dataset.intentKey;
        const input = row.querySelector('.xp-intent-xp');
        if (key) intents[key] = readIntValue(input);
      });
    }

    return {
      xpLedger: Object.assign({}, existing, {
        strain:  readIntValue(strainEl, existing.strain),
        stride:  readIntValue(strideEl, existing.stride),
        intents: intents,
      }),
    };
  }

  // ─── Intent list rendering ────────────────────────────────

  function renderIntentList(intents) {
    if (!intentsListEl) return;

    const focusedKey = rememberFocusedIntent();
    intentsListEl.innerHTML = '';

    const keys = Object.keys(intents).filter(function (k) {
      return (intents[k] || 0) > 0;
    });

    keys.forEach(function (key) {
      intentsListEl.appendChild(createIntentRow(key, intents[key]));
    });

    if (intentsEmptyEl) intentsEmptyEl.hidden = keys.length > 0;

    if (focusedKey) {
      const input = intentsListEl.querySelector(
        '[data-intent-key="' + focusedKey + '"] .xp-intent-xp'
      );
      if (input) input.focus();
    }
  }

  function rememberFocusedIntent() {
    const active = document.activeElement;
    if (!active || !intentsListEl || !intentsListEl.contains(active)) return null;
    const row = active.closest('.xp-intent-row');
    return row ? row.dataset.intentKey : null;
  }

  function createIntentRow(key, value) {
    const meta  = Schema.INTENTS[key] || { label: key };
    const level = Schema.calcIntentLevel(value);
    const die   = Schema.calcIntentDie(level);

    const row = document.createElement('div');
    row.className = 'xp-intent-row';
    row.dataset.intentKey = key;

    const inputId = 'xp-intent-' + key;

    const label = document.createElement('label');
    label.setAttribute('for', inputId);
    label.textContent = meta.label;

    const input = document.createElement('select');
    input.id = inputId;
    input.className = 'xp-intent-xp';
    for (let i = 1; i <= 5; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = String(i);
      input.appendChild(opt);
    }
    input.value = String(Math.min(Math.max(level, 1), 5));
    input.addEventListener('change', function () { _orchestrator.handleChange(); });

    const xpUnit = document.createElement('span');
    xpUnit.className = 'xp-intent-unit';
    xpUnit.textContent = 'XP';

    const dieCell = document.createElement('span');
    dieCell.className = 'xp-intent-die';
    dieCell.textContent = die;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-icon-remove';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', 'Remove ' + meta.label);
    removeBtn.addEventListener('click', function () { removeIntent(key); });

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(xpUnit);
    row.appendChild(dieCell);
    row.appendChild(removeBtn);
    return row;
  }

  function removeIntent(key) {
    const row = intentsListEl && intentsListEl.querySelector(
      '[data-intent-key="' + key + '"]'
    );
    if (row) row.remove();
    _orchestrator.handleChange();
  }

  // ─── Add-intent dialog ────────────────────────────────────

  function openAddDialog() {
    if (!dialogEl) return;

    const current  = _orchestrator.getCreature();
    const existing = (current.xpLedger && current.xpLedger.intents) || {};

    dialogSelectEl.innerHTML = '';
    Object.keys(Schema.INTENTS).forEach(function (key) {
      if (key === 'castX') return;
      if ((existing[key] || 0) > 0) return;
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = Schema.INTENTS[key].label;
      dialogSelectEl.appendChild(opt);
    });

    if (dialogSelectEl.options.length === 0) {
      alert('All intents are already allocated.');
      return;
    }

    dialogXpEl.value = '1';
    if (typeof dialogEl.showModal === 'function') {
      dialogEl.showModal();
    } else {
      // Very old browsers without <dialog>; fall back to confirm-style prompt.
      const xp = prompt('XP for ' + dialogSelectEl.options[0].textContent + '?', '1');
      if (xp != null) addIntent(dialogSelectEl.value, parseInt(xp, 10) || 0);
    }
  }

  function onDialogClose() {
    if (dialogEl.returnValue !== 'add') return;

    const key = dialogSelectEl.value;
    const xp  = parseInt(dialogXpEl.value, 10);
    if (!key || !xp || xp < 1) return;

    addIntent(key, xp);
  }

  function addIntent(key, xp) {
    const current  = _orchestrator.getCreature();
    const existing = (current.xpLedger && current.xpLedger.intents) || {};
    if ((existing[key] || 0) > 0) return;

    if (!intentsListEl) return;
    intentsListEl.appendChild(createIntentRow(key, xp));
    if (intentsEmptyEl) intentsEmptyEl.hidden = true;
    _orchestrator.handleChange();
  }

  // ─── Helpers ──────────────────────────────────────────────

  function setInputValue(el, value) {
    if (!el) return;
    if (document.activeElement === el && el.value === value) return;
    if (el.value !== value) el.value = value;
  }

  function readIntValue(el, fallback) {
    if (!el) return fallback || 0;
    const raw = el.value.trim();
    if (raw === '') return 0;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  return { init, render, read };
})();
