// app.js
// Orchestrator for the Creature Creator. Holds the single source of truth
// (the current creature object) in memory, coordinates module render/read,
// and tracks unsaved-changes state.
//
// At Step 3, no field modules exist yet. render() and collect() iterate
// over a module registry that is empty for now; later steps will register
// their modules here. The load/save/new/export workflow works end to end
// as a JSON round trip even without field modules.
//
// Depends on globals: Schema, FileIO

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────

  let _creature = Schema.blankCreature();
  let _dirty    = false;
  const _modules = []; // { name, render(creature), read() -> partial creature }

  // ─── Theme ────────────────────────────────────────────────

  const THEME_STORAGE_KEY = 'metanoia-creature-creator-theme';

  function getStoredTheme() {
    try { return localStorage.getItem(THEME_STORAGE_KEY); }
    catch (e) { return null; }
  }

  function setStoredTheme(theme) {
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); }
    catch (e) { /* storage unavailable, continue without persistence */ }
  }

  function prefersLightOS() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  }

  function resolveInitialTheme() {
    const stored = getStoredTheme();
    if (stored === 'light' || stored === 'dark') return stored;
    return prefersLightOS() ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = theme === 'dark' ? '☀' : '☾';
  }

  function initTheme() {
    applyTheme(resolveInitialTheme());
    const btn = document.getElementById('btn-theme');
    if (!btn) return;
    btn.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      setStoredTheme(next);
    });
  }

  // ─── Dirty flag ───────────────────────────────────────────

  function markDirty() {
    if (_dirty) return;
    _dirty = true;
    updateUnsavedDot();
  }

  function markClean() {
    _dirty = false;
    updateUnsavedDot();
  }

  function isDirty() {
    return _dirty;
  }

  function updateUnsavedDot() {
    const dot = document.getElementById('unsaved-dot');
    if (dot) dot.hidden = !_dirty;
  }

  // ─── Module registry ──────────────────────────────────────

  function registerModule(mod) {
    _modules.push(mod);
  }

  function render() {
    for (let i = 0; i < _modules.length; i++) {
      try { _modules[i].render(_creature); }
      catch (err) { console.error('Module render failed: ' + _modules[i].name, err); }
    }
  }

  function collect() {
    let snapshot = _creature;
    for (let i = 0; i < _modules.length; i++) {
      try {
        const partial = _modules[i].read();
        if (partial) snapshot = Object.assign({}, snapshot, partial);
      } catch (err) {
        console.error('Module read failed: ' + _modules[i].name, err);
      }
    }
    return snapshot;
  }

  // Called by a module whenever the user changes a field. Pulls the latest
  // values from every module into _creature, marks dirty, and re-renders so
  // derived read-only displays (XP Spent, XP Remaining, Strain Max, ...)
  // reflect the new state. Modules guard focused inputs during render so
  // typing is not disrupted.
  function handleChange() {
    _creature = collect();
    markDirty();
    render();
  }

  // ─── Creature state access ────────────────────────────────

  function getCreature() {
    return _creature;
  }

  function setCreature(creature) {
    _creature = creature;
    render();
  }

  // ─── Orchestrator API exposed to modules ──────────────────

  const orchestrator = {
    getCreature,
    setCreature,
    collect,
    render,
    markDirty,
    markClean,
    isDirty,
    registerModule,
    handleChange,
  };

  // ─── Boot ─────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    initTheme();
    updateUnsavedDot();

    if (typeof Schema === 'undefined') {
      console.error('Schema global is missing. Check script load order in index.html.');
      return;
    }
    if (typeof FileIO === 'undefined') {
      console.error('FileIO global is missing. Check script load order in index.html.');
      return;
    }
    if (typeof Header === 'undefined') {
      console.error('Header global is missing. Check script load order in index.html.');
      return;
    }
    if (typeof CoreStats === 'undefined') {
      console.error('CoreStats global is missing. Check script load order in index.html.');
      return;
    }
    if (typeof XpLedger === 'undefined') {
      console.error('XpLedger global is missing. Check script load order in index.html.');
      return;
    }
    if (typeof Armor === 'undefined') {
      console.error('Armor global is missing. Check script load order in index.html.');
      return;
    }
    if (typeof Passives === 'undefined') {
      console.error('Passives global is missing. Check script load order in index.html.');
      return;
    }
    if (typeof Abilities === 'undefined') {
      console.error('Abilities global is missing. Check script load order in index.html.');
      return;
    }

    FileIO.init(orchestrator);
    Header.init(orchestrator);
    CoreStats.init(orchestrator);
    XpLedger.init(orchestrator);
    Armor.init(orchestrator);
    Passives.init(orchestrator);
    Abilities.init(orchestrator);
    registerModule({ name: 'header',    render: Header.render,    read: Header.read });
    registerModule({ name: 'coreStats', render: CoreStats.render, read: CoreStats.read });
    registerModule({ name: 'xpLedger',  render: XpLedger.render,  read: XpLedger.read });
    registerModule({ name: 'armor',     render: Armor.render,     read: Armor.read });
    registerModule({ name: 'passives',  render: Passives.render,  read: Passives.read });
    registerModule({ name: 'abilities', render: Abilities.render, read: Abilities.read });

    render();
  });

  // Expose orchestrator for future module init calls made outside DOMContentLoaded.
  window.CreatureApp = orchestrator;

})();
