// header.js
// Owns the Header section: name, category, realm, XP total, the read-only
// XP Spent / XP Remaining displays derived from the ledger, and the
// structured Polarities list (name + usage note per entry).
// Exposes a single global: Header
//
// Depends on globals: Schema

const Header = (() => {

  let _orchestrator = null;
  let _editingPolarityId = null;

  let nameEl        = null;
  let categoryEl    = null;
  let factionEl     = null;
  let realmEl       = null;
  let xpTotalEl     = null;
  let xpSpentEl     = null;
  let xpRemainingEl = null;

  let polarityListEl    = null;
  let polarityEmptyEl   = null;
  let polarityAddBtnEl  = null;
  let polarityDialogEl  = null;
  let polarityTitleEl   = null;
  let polaritySaveEl    = null;
  let polarityCancelEl  = null;
  let polarityNameEl    = null;
  let polarityNoteEl    = null;

  // ─── Public API ───────────────────────────────────────────

  function init(orchestrator) {
    _orchestrator = orchestrator;

    nameEl        = document.getElementById('hdr-name');
    categoryEl    = document.getElementById('hdr-category');
    factionEl     = document.getElementById('hdr-faction');
    realmEl       = document.getElementById('hdr-realm');
    xpTotalEl     = document.getElementById('hdr-xp-total');
    xpSpentEl     = document.getElementById('hdr-xp-spent');
    xpRemainingEl = document.getElementById('hdr-xp-remaining');

    polarityListEl   = document.getElementById('polarity-list');
    polarityEmptyEl  = document.getElementById('polarity-empty');
    polarityAddBtnEl = document.getElementById('btn-add-polarity');
    polarityDialogEl = document.getElementById('polarity-dialog');
    polarityTitleEl  = document.getElementById('polarity-dialog-title');
    polaritySaveEl   = document.getElementById('polarity-dialog-save');
    polarityCancelEl = document.getElementById('polarity-dialog-cancel');
    polarityNameEl   = document.getElementById('polarity-dialog-name');
    polarityNoteEl   = document.getElementById('polarity-dialog-note');

    populateCategoryOptions();
    populateRealmOptions();

    const onChange = function () { _orchestrator.handleChange(); };
    if (nameEl)       nameEl.addEventListener('input', onChange);
    if (categoryEl)   categoryEl.addEventListener('change', onChange);
    if (factionEl)    factionEl.addEventListener('input', onChange);
    if (realmEl)      realmEl.addEventListener('change', onChange);
    if (xpTotalEl)    xpTotalEl.addEventListener('input', onChange);

    if (polarityAddBtnEl) polarityAddBtnEl.addEventListener('click', openPolarityForNew);
    if (polarityCancelEl) polarityCancelEl.addEventListener('click', function () {
      if (polarityDialogEl) polarityDialogEl.close('cancel');
    });
    if (polarityDialogEl) polarityDialogEl.addEventListener('close', onPolarityDialogClose);
    if (polarityListEl) {
      polarityListEl.addEventListener('click', onPolarityListClick);
      polarityListEl.addEventListener('keydown', onPolarityListKeydown);
    }
  }

  function render(creature) {
    const header = (creature && creature.header) || {};

    setInputValue(nameEl,     header.name || '');
    setInputValue(categoryEl, header.category || 'Custom');
    setInputValue(factionEl,  header.faction || '');
    setInputValue(realmEl,    String(header.realm || 0));
    setInputValue(xpTotalEl,  String(header.xpTotal || 0));

    renderPolarityList(Array.isArray(header.polarities) ? header.polarities : []);

    const spent     = Schema.calcXpSpent(creature || {});
    const remaining = (header.xpTotal || 0) - spent;
    if (xpSpentEl)     xpSpentEl.textContent     = String(spent);
    if (xpRemainingEl) {
      xpRemainingEl.textContent = String(remaining);
      xpRemainingEl.classList.toggle('is-negative', remaining < 0);
    }
  }

  function read() {
    const current  = _orchestrator ? _orchestrator.getCreature() : {};
    const existing = current.header || {};
    return {
      header: Object.assign({}, existing, {
        name:       nameEl ? nameEl.value : (existing.name || ''),
        category:   categoryEl ? categoryEl.value : (existing.category || 'Custom'),
        faction:    factionEl ? factionEl.value : (existing.faction || ''),
        realm:      realmEl ? (parseInt(realmEl.value, 10) || 0) : (existing.realm || 0),
        xpTotal:    xpTotalEl ? (parseInt(xpTotalEl.value, 10) || 0) : (existing.xpTotal || 0),
        polarities: Array.isArray(existing.polarities) ? existing.polarities.slice() : [],
      }),
    };
  }

  // ─── Polarity list rendering ──────────────────────────────

  function renderPolarityList(polarities) {
    if (!polarityListEl) return;
    polarityListEl.innerHTML = '';

    if (polarities.length === 0) {
      if (polarityEmptyEl) polarityEmptyEl.hidden = false;
      return;
    }
    if (polarityEmptyEl) polarityEmptyEl.hidden = true;

    polarities.forEach(function (p) {
      polarityListEl.appendChild(createPolarityRow(p));
    });
  }

  function createPolarityRow(polarity) {
    const row = document.createElement('div');
    row.className = 'polarity-row';
    row.dataset.id = polarity.id || '';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.title = 'Click to edit';

    const name = document.createElement('span');
    name.className = 'polarity-row-name';
    name.textContent = polarity.name || 'Unnamed';
    row.appendChild(name);

    const note = document.createElement('span');
    note.className = 'polarity-row-note';
    note.textContent = polarity.note || '';
    row.appendChild(note);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-icon-remove polarity-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', 'Remove ' + (polarity.name || 'polarity'));
    row.appendChild(removeBtn);

    return row;
  }

  // ─── Polarity list clicks ─────────────────────────────────

  function onPolarityListClick(e) {
    const row = e.target.closest('.polarity-row');
    if (!row) return;
    const id = row.dataset.id;

    if (e.target.closest('.polarity-remove-btn')) {
      removePolarity(id);
      return;
    }
    const p = findPolarity(id);
    if (p) openPolarityForEdit(p);
  }

  function onPolarityListKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.polarity-row');
    if (!row || e.target !== row) return;
    e.preventDefault();
    const p = findPolarity(row.dataset.id);
    if (p) openPolarityForEdit(p);
  }

  function findPolarity(id) {
    const current = _orchestrator.getCreature();
    const list = ((current.header || {}).polarities) || [];
    return list.find(function (p) { return p.id === id; });
  }

  function removePolarity(id) {
    const current = _orchestrator.getCreature();
    const existing = ((current.header || {}).polarities) || [];
    const filtered = existing.filter(function (p) { return p.id !== id; });
    const updated = Object.assign({}, current, {
      header: Object.assign({}, current.header, { polarities: filtered }),
    });
    _orchestrator.setCreature(updated);
    _orchestrator.markDirty();
  }

  // ─── Polarity dialog ──────────────────────────────────────

  function openPolarityForNew() {
    _editingPolarityId = null;
    if (polarityTitleEl) polarityTitleEl.textContent = 'Add Polarity';
    if (polaritySaveEl)  polaritySaveEl.textContent  = 'Add';
    if (polarityNameEl)  polarityNameEl.value = '';
    if (polarityNoteEl)  polarityNoteEl.value = '';
    showPolarityDialog();
  }

  function openPolarityForEdit(polarity) {
    _editingPolarityId = polarity.id;
    if (polarityTitleEl) polarityTitleEl.textContent = 'Edit Polarity';
    if (polaritySaveEl)  polaritySaveEl.textContent  = 'Save';
    if (polarityNameEl)  polarityNameEl.value = polarity.name || '';
    if (polarityNoteEl)  polarityNoteEl.value = polarity.note || '';
    showPolarityDialog();
  }

  function showPolarityDialog() {
    if (!polarityDialogEl) return;
    if (typeof polarityDialogEl.showModal === 'function') {
      polarityDialogEl.showModal();
    } else {
      polarityDialogEl.setAttribute('open', '');
    }
    if (polarityNameEl) polarityNameEl.focus();
  }

  function onPolarityDialogClose() {
    if (polarityDialogEl.returnValue !== 'save') {
      _editingPolarityId = null;
      return;
    }
    commitPolarityDialog();
    _editingPolarityId = null;
  }

  function commitPolarityDialog() {
    const name = polarityNameEl ? polarityNameEl.value.trim() : '';
    const note = polarityNoteEl ? polarityNoteEl.value.trim() : '';
    if (!name) return;

    const current  = _orchestrator.getCreature();
    const existing = ((current.header || {}).polarities) || [];
    const entry = {
      id:   _editingPolarityId || Schema.newId(),
      name: name,
      note: note,
    };
    let next;
    if (_editingPolarityId) {
      next = existing.map(function (p) { return p.id === _editingPolarityId ? entry : p; });
    } else {
      next = existing.concat([entry]);
    }
    const updated = Object.assign({}, current, {
      header: Object.assign({}, current.header, { polarities: next }),
    });
    _orchestrator.setCreature(updated);
    _orchestrator.markDirty();
  }

  // ─── Helpers ──────────────────────────────────────────────

  function populateCategoryOptions() {
    if (!categoryEl) return;
    categoryEl.innerHTML = '';
    Schema.CATEGORIES.forEach(function (name) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      categoryEl.appendChild(opt);
    });
  }

  function populateRealmOptions() {
    if (!realmEl) return;
    realmEl.innerHTML = '';
    for (let i = 0; i <= 5; i++) {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = i + ' - ' + Schema.REALM_NAMES[i];
      realmEl.appendChild(opt);
    }
  }

  function setInputValue(el, value) {
    if (!el) return;
    if (document.activeElement === el && el.value === value) return;
    if (el.value !== value) el.value = value;
  }

  return { init, render, read };
})();
