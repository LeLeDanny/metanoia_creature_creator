// tpme.js
// Owns the TPME section: Task, Purpose, Method, Endstate. A behavior
// framework for how to play the NPC, replacing the older freeform
// "Special Mechanics" field.
// Exposes a single global: Tpme
//
// Depends on globals: Schema

const Tpme = (() => {

  let _orchestrator = null;

  let taskEl     = null;
  let purposeEl  = null;
  let methodEl   = null;
  let endstateEl = null;

  // ─── Public API ───────────────────────────────────────────

  function init(orchestrator) {
    _orchestrator = orchestrator;

    taskEl     = document.getElementById('tpme-task');
    purposeEl  = document.getElementById('tpme-purpose');
    methodEl   = document.getElementById('tpme-method');
    endstateEl = document.getElementById('tpme-endstate');

    const onChange = function () { _orchestrator.handleChange(); };
    if (taskEl)     taskEl.addEventListener('input', onChange);
    if (purposeEl)  purposeEl.addEventListener('input', onChange);
    if (methodEl)   methodEl.addEventListener('input', onChange);
    if (endstateEl) endstateEl.addEventListener('input', onChange);
  }

  function render(creature) {
    const tpme = (creature && creature.tpme) || {};
    setInputValue(taskEl,     tpme.task     || '');
    setInputValue(purposeEl,  tpme.purpose  || '');
    setInputValue(methodEl,   tpme.method   || '');
    setInputValue(endstateEl, tpme.endstate || '');
  }

  function read() {
    const current  = _orchestrator ? _orchestrator.getCreature() : {};
    const existing = current.tpme || {};
    return {
      tpme: Object.assign({}, existing, {
        task:     taskEl     ? taskEl.value     : (existing.task     || ''),
        purpose:  purposeEl  ? purposeEl.value  : (existing.purpose  || ''),
        method:   methodEl   ? methodEl.value   : (existing.method   || ''),
        endstate: endstateEl ? endstateEl.value : (existing.endstate || ''),
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
