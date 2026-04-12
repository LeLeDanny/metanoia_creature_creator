// passives.js
// Owns the Passive Abilities section. Each passive is stored as
// { id, name, level, notes } and rendered through per-passive form
// definitions. Resistant and Vulnerability have structured damage-type
// forms; all other entries in Schema.PASSIVE_ABILITIES (and free-form
// custom passives) use a generic level + notes form until a bespoke
// form is added for them.
//
// Exposes a single global: Passives
//
// Depends on globals: Schema

const Passives = (() => {

  let _orchestrator = null;
  let _editingId    = null;
  let _currentForm  = null;

  let listEl       = null;
  let emptyEl      = null;
  let addBtnEl     = null;

  let dialogEl     = null;
  let dialogTitle  = null;
  let dialogNameRow   = null;
  let dialogNameSelect = null;
  let dialogCustomWrap = null;
  let dialogCustomInput = null;
  let dialogContentEl  = null;
  let dialogCancelEl   = null;
  let dialogSaveEl     = null;

  // ─── Public API ───────────────────────────────────────────

  function init(orchestrator) {
    _orchestrator = orchestrator;

    listEl      = document.getElementById('passives-list');
    emptyEl     = document.getElementById('passives-empty');
    addBtnEl    = document.getElementById('btn-add-passive');

    dialogEl          = document.getElementById('passive-dialog');
    dialogTitle       = document.getElementById('passive-dialog-title');
    dialogNameRow     = document.getElementById('passive-dialog-name-row');
    dialogNameSelect  = document.getElementById('passive-dialog-name-select');
    dialogCustomWrap  = document.getElementById('passive-dialog-custom-wrap');
    dialogCustomInput = document.getElementById('passive-dialog-name-custom');
    dialogContentEl   = document.getElementById('passive-dialog-content');
    dialogCancelEl    = document.getElementById('passive-dialog-cancel');
    dialogSaveEl      = document.getElementById('passive-dialog-save');

    if (addBtnEl)        addBtnEl.addEventListener('click', openForNew);
    if (dialogCancelEl)  dialogCancelEl.addEventListener('click', function () { if (dialogEl) dialogEl.close('cancel'); });
    if (dialogEl)        dialogEl.addEventListener('close', onDialogClose);
    if (dialogNameSelect) dialogNameSelect.addEventListener('change', onNameChange);
    if (dialogContentEl) dialogContentEl.addEventListener('input', onContentInput);
    if (listEl)          listEl.addEventListener('click', onListClick);
  }

  function render(creature) {
    const passives = (creature && creature.passiveAbilities) || [];
    renderList(passives);
  }

  function read() {
    const current = _orchestrator ? _orchestrator.getCreature() : {};
    return { passiveAbilities: (current.passiveAbilities || []).slice() };
  }

  // ─── List rendering ───────────────────────────────────────

  function renderList(passives) {
    if (!listEl) return;
    listEl.innerHTML = '';

    if (passives.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    passives.forEach(function (p) {
      listEl.appendChild(createRow(p));
    });
  }

  function createRow(passive) {
    const row = document.createElement('div');
    row.className = 'passive-row';
    row.dataset.id = passive.id || '';
    const desc = passiveDescription(passive);
    if (desc) row.title = desc;

    const name = document.createElement('span');
    name.className = 'passive-row-name';
    name.textContent = passive.name || 'Unnamed';
    if (desc) name.title = desc;
    row.appendChild(name);

    const details = document.createElement('span');
    details.className = 'passive-row-details';
    details.innerHTML = buildRowDetails(passive);
    row.appendChild(details);

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-sm passive-edit-btn';
    editBtn.textContent = 'Edit';
    row.appendChild(editBtn);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-icon-remove passive-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', 'Remove ' + (passive.name || 'passive'));
    row.appendChild(removeBtn);

    return row;
  }

  function buildRowDetails(passive) {
    const name  = passive.name;
    const level = passive.level || 0;
    const notes = passive.notes || '';
    const cost  = Schema.calcPassiveXpCost(passive);

    if (name === 'Resistant') {
      const dt = notes ? notes : '—';
      return tag(dt) + derived('−' + level + ' Strain') + xpBadge(cost);
    }
    if (name === 'Vulnerability') {
      const dt = notes ? notes : '—';
      return tag(dt) + derived('+' + level + ' Strain') + xpBadge(cost);
    }

    let out = '';
    if (level > 1) out += '<span class="passive-row-level">Lv&nbsp;' + level + '</span>';
    if (notes) out += '<span class="passive-row-notes">' + esc(notes) + '</span>';
    if (cost !== 0) out += xpBadge(cost);
    return out;
  }

  function tag(text) {
    return '<span class="passive-row-tag">' + esc(text) + '</span>';
  }

  function derived(text) {
    return '<span class="passive-row-derived">' + esc(text) + '</span>';
  }

  function xpBadge(cost) {
    if (cost === 0) return '';
    if (cost < 0) return '<span class="passive-row-xp passive-row-xp-grant">+' + Math.abs(cost) + ' XP</span>';
    return '<span class="passive-row-xp">' + cost + ' XP</span>';
  }

  // ─── List clicks ──────────────────────────────────────────

  function onListClick(e) {
    const row = e.target.closest('.passive-row');
    if (!row) return;
    const id = row.dataset.id;

    if (e.target.closest('.passive-remove-btn')) {
      removePassive(id);
      return;
    }
    if (e.target.closest('.passive-edit-btn')) {
      const p = findPassive(id);
      if (p) openForEdit(p);
    }
  }

  function findPassive(id) {
    const passives = (_orchestrator.getCreature().passiveAbilities || []);
    return passives.find(function (p) { return p.id === id; });
  }

  function removePassive(id) {
    const current  = _orchestrator.getCreature();
    const filtered = (current.passiveAbilities || []).filter(function (p) { return p.id !== id; });
    const updated  = Object.assign({}, current, { passiveAbilities: filtered });
    _orchestrator.setCreature(updated);
    _orchestrator.markDirty();
  }

  // ─── Dialog ───────────────────────────────────────────────

  function openForNew() {
    _editingId = null;
    if (dialogTitle) dialogTitle.textContent = 'Add Passive Ability';
    if (dialogSaveEl) dialogSaveEl.textContent = 'Add';
    if (dialogNameRow) dialogNameRow.hidden = false;
    populateNameSelect();
    if (dialogNameSelect) dialogNameSelect.value = Schema.PASSIVE_ABILITIES[0].name;
    if (dialogCustomWrap) dialogCustomWrap.hidden = true;
    if (dialogCustomInput) dialogCustomInput.value = '';
    populateContent(dialogNameSelect.value, { level: 1, notes: '' });
    showDialog();
  }

  function openForEdit(passive) {
    _editingId = passive.id;
    if (dialogTitle) dialogTitle.textContent = 'Edit ' + (passive.name || 'Passive');
    if (dialogSaveEl) dialogSaveEl.textContent = 'Save';
    const meta   = Schema.PASSIVE_ABILITIES.find(function (p) { return p.name === passive.name; });
    const custom = !meta;
    populateNameSelect();
    if (dialogNameSelect) dialogNameSelect.value = custom ? '_custom' : passive.name;
    if (dialogNameRow) dialogNameRow.hidden = false;
    if (dialogCustomWrap) dialogCustomWrap.hidden = !custom;
    if (dialogCustomInput) dialogCustomInput.value = custom ? (passive.name || '') : '';
    populateContent(dialogNameSelect.value, passive);
    showDialog();
  }

  function populateNameSelect() {
    if (!dialogNameSelect) return;
    dialogNameSelect.innerHTML = '';
    Schema.PASSIVE_ABILITIES.forEach(function (p) {
      const opt = document.createElement('option');
      opt.value = p.name;
      opt.textContent = p.name;
      dialogNameSelect.appendChild(opt);
    });
    const custom = document.createElement('option');
    custom.value = '_custom';
    custom.textContent = 'Custom…';
    dialogNameSelect.appendChild(custom);
  }

  function onNameChange() {
    const val = dialogNameSelect.value;
    if (dialogCustomWrap) dialogCustomWrap.hidden = val !== '_custom';
    populateContent(val, { level: 1, notes: '' });
  }

  function populateContent(selectVal, data) {
    const name = selectVal === '_custom' ? '_custom' : selectVal;
    const form = PASSIVE_FORMS[name] || genericForm(name);
    _currentForm = form;
    if (dialogContentEl) dialogContentEl.innerHTML = form.buildContent(data || { level: 1, notes: '' });
  }

  function onContentInput() {
    if (_currentForm && _currentForm.onInput) _currentForm.onInput();
  }

  function showDialog() {
    if (!dialogEl) return;
    if (typeof dialogEl.showModal === 'function') {
      dialogEl.showModal();
    } else {
      dialogEl.setAttribute('open', '');
    }
  }

  function onDialogClose() {
    if (dialogEl.returnValue !== 'save') {
      _editingId = null;
      _currentForm = null;
      return;
    }
    commitDialog();
    _editingId = null;
    _currentForm = null;
  }

  function commitDialog() {
    if (!_currentForm) return;

    const selectVal = dialogNameSelect ? dialogNameSelect.value : '';
    const name = selectVal === '_custom'
      ? (dialogCustomInput ? dialogCustomInput.value.trim() : '')
      : selectVal;
    if (!name) return;

    const data = _currentForm.readData();
    const passive = {
      id:    _editingId || Schema.newId(),
      name:  name,
      level: data.level || 0,
      notes: data.notes || '',
    };

    const current  = _orchestrator.getCreature();
    const existing = current.passiveAbilities || [];
    let next;
    if (_editingId) {
      next = existing.map(function (p) { return p.id === _editingId ? passive : p; });
    } else {
      next = existing.concat([passive]);
    }
    const updated = Object.assign({}, current, { passiveAbilities: next });
    _orchestrator.setCreature(updated);
    _orchestrator.markDirty();
  }

  // ─── Form helpers ─────────────────────────────────────────

  function esc(str) {
    return (str == null ? '' : String(str))
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function pfVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function pfLevel() {
    const el = document.getElementById('pf-level');
    return el ? Math.max(1, parseInt(el.value, 10) || 1) : 1;
  }

  function passiveDescription(passive) {
    if (!passive || !passive.name) return '';
    if (passive.name === 'Custom') {
      return (passive.notes || '').trim() || customMeta().description || '';
    }
    const meta = Schema.PASSIVE_ABILITIES.find(function (p) { return p.name === passive.name; });
    return (meta && meta.description) || '';
  }

  function customMeta() {
    return Schema.PASSIVE_ABILITIES.find(function (p) { return p.name === 'Custom'; }) || {};
  }

  function descriptionBlock(name) {
    const key  = name === '_custom' ? 'Custom' : name;
    const meta = Schema.PASSIVE_ABILITIES.find(function (p) { return p.name === key; });
    const desc = meta && meta.description;
    if (!desc) return '';
    return '<p class="pf-desc">' + esc(desc) + '</p>';
  }

  function damageTypeOptions(selected) {
    return Schema.DAMAGE_TYPES.map(function (dt) {
      const sel = dt.name === selected ? ' selected' : '';
      return '<option value="' + esc(dt.name) + '"' + sel + '>' + esc(dt.name) + '</option>';
    }).join('');
  }

  // ─── Per-passive forms ────────────────────────────────────

  const PASSIVE_FORMS = {

    'Resistant': {
      buildContent: function (data) {
        const level    = data.level || 1;
        const selected = data.notes || Schema.DAMAGE_TYPES[0].name;
        const dt       = Schema.DAMAGE_TYPES.find(function (d) { return d.name === selected; }) || Schema.DAMAGE_TYPES[0];
        const mult     = dt.xpPerLevel || 1;
        return (
          descriptionBlock('Resistant') +
          '<div class="field">' +
            '<label for="pf-damage-type">Damage Type</label>' +
            '<select id="pf-damage-type">' + damageTypeOptions(selected) + '</select>' +
          '</div>' +
          '<p class="pf-type-desc" id="pf-type-desc">' + esc(dt.desc || '') + '</p>' +
          '<div class="pf-row">' +
            '<div class="field">' +
              '<label for="pf-level">Level</label>' +
              '<input type="number" id="pf-level" min="1" value="' + level + '">' +
            '</div>' +
            '<div class="field">' +
              '<label>Reduction</label>' +
              '<span class="pf-derived" id="pf-derived">−' + level + ' Strain</span>' +
            '</div>' +
            '<div class="field">' +
              '<label>XP Cost</label>' +
              '<span class="pf-derived" id="pf-total-xp">' + (level * mult) + '</span>' +
            '</div>' +
          '</div>'
        );
      },
      readData: function () {
        return { level: pfLevel(), notes: pfVal('pf-damage-type') };
      },
      onInput: function () {
        const level = pfLevel();
        const type  = pfVal('pf-damage-type');
        const dt    = Schema.DAMAGE_TYPES.find(function (d) { return d.name === type; }) || Schema.DAMAGE_TYPES[0];
        const mult  = dt.xpPerLevel || 1;
        const derivedEl = document.getElementById('pf-derived');
        const descEl    = document.getElementById('pf-type-desc');
        const totalEl   = document.getElementById('pf-total-xp');
        if (derivedEl) derivedEl.textContent = '−' + level + ' Strain';
        if (descEl)    descEl.textContent    = dt.desc || '';
        if (totalEl)   totalEl.textContent   = String(level * mult);
      },
    },

    'Vulnerability': {
      buildContent: function (data) {
        const level    = Math.min(data.level || 1, 5);
        const selected = data.notes || Schema.DAMAGE_TYPES[0].name;
        const dt       = Schema.DAMAGE_TYPES.find(function (d) { return d.name === selected; }) || Schema.DAMAGE_TYPES[0];
        const mult     = dt.xpPerLevel || 1;
        return (
          descriptionBlock('Vulnerability') +
          '<div class="field">' +
            '<label for="pf-damage-type">Damage Type</label>' +
            '<select id="pf-damage-type">' + damageTypeOptions(selected) + '</select>' +
          '</div>' +
          '<p class="pf-type-desc" id="pf-type-desc">' + esc(dt.desc || '') + '</p>' +
          '<div class="pf-row">' +
            '<div class="field">' +
              '<label for="pf-level">Level</label>' +
              '<input type="number" id="pf-level" min="1" max="5" value="' + level + '">' +
            '</div>' +
            '<div class="field">' +
              '<label>Extra Strain</label>' +
              '<span class="pf-derived" id="pf-derived">+' + level + ' Strain</span>' +
            '</div>' +
            '<div class="field">' +
              '<label>XP Granted</label>' +
              '<span class="pf-derived pf-grant" id="pf-total-xp">+' + (level * mult) + '</span>' +
            '</div>' +
          '</div>'
        );
      },
      readData: function () {
        return { level: Math.min(5, pfLevel()), notes: pfVal('pf-damage-type') };
      },
      onInput: function () {
        const level = Math.min(5, pfLevel());
        const type  = pfVal('pf-damage-type');
        const dt    = Schema.DAMAGE_TYPES.find(function (d) { return d.name === type; }) || Schema.DAMAGE_TYPES[0];
        const mult  = dt.xpPerLevel || 1;
        const derivedEl = document.getElementById('pf-derived');
        const descEl    = document.getElementById('pf-type-desc');
        const totalEl   = document.getElementById('pf-total-xp');
        if (derivedEl) derivedEl.textContent = '+' + level + ' Strain';
        if (descEl)    descEl.textContent    = dt.desc || '';
        if (totalEl)   totalEl.textContent   = '+' + (level * mult);
      },
    },

    '_custom': {
      buildContent: function (data) {
        const level = data.level || 1;
        const notes = data.notes || '';
        return (
          descriptionBlock('Custom') +
          '<div class="pf-row">' +
            '<div class="field">' +
              '<label for="pf-level">XP Cost</label>' +
              '<input type="number" id="pf-level" min="0" value="' + level + '">' +
            '</div>' +
          '</div>' +
          '<div class="field">' +
            '<label for="pf-notes">Description</label>' +
            '<textarea id="pf-notes" rows="3">' + esc(notes) + '</textarea>' +
          '</div>'
        );
      },
      readData: function () {
        return { level: Math.max(0, parseInt(pfVal('pf-level'), 10) || 0), notes: pfVal('pf-notes').trim() };
      },
      onInput: function () {},
    },

  };

  // Generic fallback for Schema.PASSIVE_ABILITIES entries without a
  // bespoke form: shows level (respecting costType/maxLevel) and notes.
  function genericForm(name) {
    const meta = Schema.PASSIVE_ABILITIES.find(function (p) { return p.name === name; });
    return {
      buildContent: function (data) {
        const level = data.level || 1;
        const notes = data.notes || '';
        const flat  = meta && meta.costType === 'flat';
        const maxAttr = (meta && meta.maxLevel) ? ' max="' + meta.maxLevel + '"' : '';
        const lvlField = flat
          ? '<input type="hidden" id="pf-level" value="1">'
          : '<div class="field">' +
              '<label for="pf-level">Level</label>' +
              '<input type="number" id="pf-level" min="1"' + maxAttr + ' value="' + level + '">' +
            '</div>';
        const costHint = meta
          ? '<p class="pf-cost-note">' + costNoteText(meta) + '</p>'
          : '';
        return (
          descriptionBlock(name) +
          costHint +
          '<div class="pf-row">' + lvlField + '</div>' +
          '<div class="field">' +
            '<label for="pf-notes">Notes</label>' +
            '<textarea id="pf-notes" rows="3" placeholder="Configuration, targets, or free-form description">' + esc(notes) + '</textarea>' +
          '</div>'
        );
      },
      readData: function () {
        const rawLevel = meta && meta.costType === 'flat' ? 1 : pfLevel();
        const capped   = (meta && meta.maxLevel) ? Math.min(rawLevel, meta.maxLevel) : rawLevel;
        return { level: capped, notes: pfVal('pf-notes').trim() };
      },
      onInput: function () {},
    };
  }

  function costNoteText(meta) {
    if (meta.costType === 'flat')           return '1 XP, purchased once.';
    if (meta.costType === 'multi-instance') return '1 XP per instance. Add a separate entry for each target.';
    if (meta.maxLevel)                      return '1 XP per level, max ' + meta.maxLevel + '.';
    return '1 XP per level.';
  }

  return { init, render, read };
})();
