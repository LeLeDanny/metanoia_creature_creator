// abilities.js
// Owns the Active Abilities section. Mirrors the Character Sheet Application's
// active ability model: { id, name, polarity, description, intents[],
// awarenessState, awarenessSubstate, duration, conditionDetails[] }. Strain
// cost is derived via Schema.calcAbilityStrainCost and never stored.
//
// Exposes a single global: Abilities
//
// Depends on globals: Schema

const Abilities = (() => {

  let _orchestrator = null;
  let _editingId    = null;

  let listEl         = null;
  let emptyEl        = null;
  let addBtnEl       = null;

  let dialogEl       = null;
  let dialogTitleEl  = null;
  let dialogSaveEl   = null;
  let dialogCancelEl = null;
  let nameEl         = null;
  let polarityEl     = null;
  let descEl         = null;
  let intentsGridEl  = null;
  let conditionSecEl = null;
  let conditionListEl = null;
  let addConditionBtn = null;
  let awStatesEl     = null;
  let awSubstatesEl  = null;
  let awDescEl       = null;
  let durEl          = null;
  let durDescEl      = null;
  let costValueEl       = null;
  let freeTagEl         = null;
  let intentWarnEl      = null;
  let restrictionListEl = null;
  let addRestrictionBtn = null;

  // ─── Public API ───────────────────────────────────────────

  function init(orchestrator) {
    _orchestrator = orchestrator;

    listEl      = document.getElementById('ability-list');
    emptyEl     = document.getElementById('ability-empty');
    addBtnEl    = document.getElementById('btn-add-ability');

    dialogEl       = document.getElementById('ability-dialog');
    dialogTitleEl  = document.getElementById('ability-dialog-title');
    dialogSaveEl   = document.getElementById('ability-dialog-save');
    dialogCancelEl = document.getElementById('ability-dialog-cancel');
    nameEl         = document.getElementById('ability-dialog-name');
    polarityEl     = document.getElementById('ability-dialog-polarity');
    descEl         = document.getElementById('ability-dialog-desc');
    intentsGridEl  = document.getElementById('ability-intents-grid');
    conditionSecEl = document.getElementById('ability-condition-section');
    conditionListEl = document.getElementById('ability-condition-list');
    addConditionBtn = document.getElementById('btn-add-condition');
    awStatesEl     = document.getElementById('ability-awareness-states');
    awSubstatesEl  = document.getElementById('ability-awareness-substates');
    awDescEl       = document.getElementById('ability-awareness-desc');
    durEl          = document.getElementById('ability-duration');
    durDescEl      = document.getElementById('ability-duration-desc');
    costValueEl       = document.getElementById('ability-cost-value');
    freeTagEl         = document.getElementById('ability-free-tag');
    intentWarnEl      = document.getElementById('ability-intent-warning');
    restrictionListEl = document.getElementById('ability-restriction-list');
    addRestrictionBtn = document.getElementById('btn-add-restriction');

    buildStaticDialogContent();

    if (addBtnEl)        addBtnEl.addEventListener('click', openForNew);
    if (dialogCancelEl)  dialogCancelEl.addEventListener('click', function () {
      if (dialogEl) dialogEl.close('cancel');
    });
    if (dialogEl)        dialogEl.addEventListener('close', onDialogClose);
    if (listEl)          listEl.addEventListener('click', onListClick);
    if (listEl)          listEl.addEventListener('keydown', onListKeydown);
    if (addConditionBtn)  addConditionBtn.addEventListener('click', onAddCondition);
    if (conditionListEl)  conditionListEl.addEventListener('click', onConditionListClick);
    if (conditionListEl)  conditionListEl.addEventListener('input', onAnyDialogInput);
    if (addRestrictionBtn) addRestrictionBtn.addEventListener('click', onAddRestriction);
    if (restrictionListEl) restrictionListEl.addEventListener('click', onRestrictionListClick);
    if (restrictionListEl) restrictionListEl.addEventListener('input', onAnyDialogInput);

    if (intentsGridEl)  intentsGridEl.addEventListener('change', onIntentsChange);
    if (awStatesEl)     awStatesEl.addEventListener('change', onAwarenessStateChange);
    if (awSubstatesEl)  awSubstatesEl.addEventListener('change', onAnyDialogInput);
    if (durEl)          durEl.addEventListener('change', onDurationChange);
    if (polarityEl)     polarityEl.addEventListener('change', onAnyDialogInput);
  }

  function render(creature) {
    const abilities = (creature && creature.activeAbilities) || [];
    renderList(abilities);
    if (dialogEl && dialogEl.open) {
      populatePolaritySelect(creature, polarityEl ? polarityEl.value : '');
    }
  }

  function read() {
    const current = _orchestrator ? _orchestrator.getCreature() : {};
    return { activeAbilities: (current.activeAbilities || []).slice() };
  }

  // ─── List rendering ───────────────────────────────────────

  function renderList(abilities) {
    if (!listEl) return;
    listEl.innerHTML = '';

    if (abilities.length === 0) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    abilities.forEach(function (a) {
      listEl.appendChild(createRow(a));
    });
  }

  function createRow(ability) {
    const row = document.createElement('div');
    row.className = 'ability-row';
    row.dataset.id = ability.id || '';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.title = 'Click to edit';

    const info = document.createElement('div');
    info.className = 'ability-row-info';

    const name = document.createElement('span');
    name.className = 'ability-row-name';
    name.textContent = ability.name || 'Unnamed Ability';
    info.appendChild(name);

    const summary = document.createElement('span');
    summary.className = 'ability-row-summary';
    summary.textContent = buildRowSummary(ability);
    info.appendChild(summary);

    const desc = (ability.description || '').trim();
    if (desc) {
      const descEl = document.createElement('span');
      descEl.className = 'ability-row-desc';
      descEl.textContent = desc;
      info.appendChild(descEl);
    }

    row.appendChild(info);

    const cost = Schema.calcAbilityStrainCost(ability);
    const creature = _orchestrator ? _orchestrator.getCreature() : {};
    const realm = ((creature.header) || {}).realm || 0;
    const isFree = cost > 0 && cost <= realm;

    const costBadge = document.createElement('span');
    costBadge.className = 'ability-row-cost';
    if (isFree) {
      costBadge.textContent = 'Free';
      costBadge.classList.add('ability-row-free');
    } else {
      costBadge.textContent = cost + ' Strain';
    }
    row.appendChild(costBadge);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-icon-remove ability-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', 'Remove ' + (ability.name || 'ability'));
    row.appendChild(removeBtn);

    return row;
  }

  function buildRowSummary(ability) {
    const parts = [];
    if (ability.polarity) parts.push(ability.polarity);

    const intentLabels = (ability.intents || []).map(function (key) {
      if (key === 'condition') {
        const details = (ability.conditionDetails || []).filter(Boolean);
        return 'Condition [' + (details.length ? details.join(', ') : 'X') + ']';
      }
      return (Schema.INTENTS[key] && Schema.INTENTS[key].label) || key;
    });
    if (intentLabels.length) parts.push(intentLabels.join(', '));

    const state = Schema.ABILITY_AWARENESS[ability.awarenessState];
    const sub   = state && state.substates[ability.awarenessSubstate];
    if (sub) parts.push(sub.dimension ? sub.label + ' (' + sub.dimension + ')' : sub.label);

    const dur = Schema.DURATIONS[ability.duration];
    if (dur && ability.duration && ability.duration !== 'instant') parts.push(dur.label);

    const rCount = (ability.restrictions || []).length;
    if (rCount) parts.push(rCount === 1 ? '1 Restriction' : rCount + ' Restrictions');

    return parts.join(' \u00b7 ');
  }

  // ─── List clicks ──────────────────────────────────────────

  function onListClick(e) {
    const row = e.target.closest('.ability-row');
    if (!row) return;
    const id = row.dataset.id;

    if (e.target.closest('.ability-remove-btn')) {
      removeAbility(id);
      return;
    }
    const a = findAbility(id);
    if (a) openForEdit(a);
  }

  function onListKeydown(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const row = e.target.closest('.ability-row');
    if (!row || e.target !== row) return;
    e.preventDefault();
    const a = findAbility(row.dataset.id);
    if (a) openForEdit(a);
  }

  function findAbility(id) {
    const list = _orchestrator.getCreature().activeAbilities || [];
    return list.find(function (a) { return a.id === id; });
  }

  function removeAbility(id) {
    const current  = _orchestrator.getCreature();
    const filtered = (current.activeAbilities || []).filter(function (a) { return a.id !== id; });
    const updated  = Object.assign({}, current, { activeAbilities: filtered });
    _orchestrator.setCreature(updated);
    _orchestrator.markDirty();
  }

  // ─── Dialog: static content ───────────────────────────────

  function buildStaticDialogContent() {
    if (intentsGridEl) {
      const html = Object.keys(Schema.INTENTS)
        .filter(function (key) { return key !== 'castX'; })
        .map(function (key) {
          const def = Schema.INTENTS[key];
          return '' +
            '<label class="ability-intent-label">' +
              '<input type="checkbox" class="ability-intent-check" value="' + key + '">' +
              '<span class="ability-intent-info">' +
                '<span class="ability-intent-name">' + esc(def.label) +
                  ' <span class="ability-intent-cost">(' + def.strain + ')</span></span>' +
                '<span class="ability-intent-desc">' + esc(def.description) + '</span>' +
              '</span>' +
            '</label>';
        }).join('');
      intentsGridEl.innerHTML = html;
    }

    if (awStatesEl) {
      const html = Object.keys(Schema.ABILITY_AWARENESS).map(function (key) {
        const def = Schema.ABILITY_AWARENESS[key];
        return '' +
          '<label class="ability-radio-label">' +
            '<input type="radio" name="ability-aw-state" value="' + key + '">' +
            '<span>' + esc(def.label) + '</span>' +
          '</label>';
      }).join('');
      awStatesEl.innerHTML = html;
    }

    if (durEl) {
      const html = Object.keys(Schema.DURATIONS).map(function (key) {
        const def = Schema.DURATIONS[key];
        return '' +
          '<label class="ability-radio-label">' +
            '<input type="radio" name="ability-dur" value="' + key + '">' +
            '<span>' + esc(def.label) +
              ' <span class="ability-intent-cost">(+' + def.strain + ')</span></span>' +
          '</label>';
      }).join('');
      durEl.innerHTML = html;
    }
  }

  function populatePolaritySelect(creature, selected) {
    if (!polarityEl) return;
    const polarities = ((creature && creature.header && creature.header.polarities) || [])
      .map(function (p) { return (p && p.name ? String(p.name).trim() : ''); })
      .filter(Boolean);

    let html = '<option value="">\u2014 none \u2014</option>';
    polarities.forEach(function (name) {
      const sel = name === selected ? ' selected' : '';
      html += '<option value="' + esc(name) + '"' + sel + '>' + esc(name) + '</option>';
    });
    if (selected && polarities.indexOf(selected) === -1) {
      html += '<option value="' + esc(selected) + '" selected>' + esc(selected) + ' (removed)</option>';
    }
    polarityEl.innerHTML = html;
  }

  // ─── Dialog: open / close ─────────────────────────────────

  function openForNew() {
    _editingId = null;
    if (dialogTitleEl) dialogTitleEl.textContent = 'Add Active Ability';
    if (dialogSaveEl)  dialogSaveEl.textContent  = 'Add';
    loadIntoDialog({
      name: '', polarity: '', description: '',
      intents: [], awarenessState: 'suppressed',
      awarenessSubstate: 'touch', duration: 'instant',
      conditionDetails: [], restrictions: [],
    });
    showDialog();
  }

  function openForEdit(ability) {
    _editingId = ability.id;
    if (dialogTitleEl) dialogTitleEl.textContent = 'Edit Active Ability';
    if (dialogSaveEl)  dialogSaveEl.textContent  = 'Save';
    loadIntoDialog(ability);
    showDialog();
  }

  function loadIntoDialog(data) {
    if (nameEl) nameEl.value = data.name || '';
    if (descEl) descEl.value = data.description || '';
    populatePolaritySelect(_orchestrator.getCreature(), data.polarity || '');

    const intents = data.intents || [];
    document.querySelectorAll('.ability-intent-check').forEach(function (cb) {
      cb.checked = intents.indexOf(cb.value) !== -1;
    });

    const state = data.awarenessState || 'suppressed';
    const stateRadio = document.querySelector('input[name="ability-aw-state"][value="' + state + '"]');
    if (stateRadio) stateRadio.checked = true;
    rebuildSubstates(state, data.awarenessSubstate);

    const dur = data.duration || 'instant';
    const durRadio = document.querySelector('input[name="ability-dur"][value="' + dur + '"]');
    if (durRadio) durRadio.checked = true;

    renderConditionList(data.conditionDetails || []);
    renderRestrictionList(data.restrictions || []);
    updateConditionSectionVisibility();
    updateAwDescription();
    updateDurDescription();
    updateIntentValidation();
    updateStrainCost();
  }

  function showDialog() {
    if (!dialogEl) return;
    if (typeof dialogEl.showModal === 'function') {
      dialogEl.showModal();
    } else {
      dialogEl.setAttribute('open', '');
    }
    if (nameEl) nameEl.focus();
  }

  function onDialogClose() {
    if (dialogEl.returnValue !== 'save') {
      _editingId = null;
      return;
    }
    commitDialog();
    _editingId = null;
  }

  function commitDialog() {
    const data = readDialog();
    if (!data.name) return;

    const ability = Object.assign({ id: _editingId || Schema.newId() }, data);
    const current = _orchestrator.getCreature();
    const existing = current.activeAbilities || [];
    let next;
    if (_editingId) {
      next = existing.map(function (a) { return a.id === _editingId ? ability : a; });
    } else {
      next = existing.concat([ability]);
    }
    const updated = Object.assign({}, current, { activeAbilities: next });
    _orchestrator.setCreature(updated);
    _orchestrator.markDirty();
  }

  function readDialog() {
    const intents = [];
    document.querySelectorAll('.ability-intent-check:checked').forEach(function (cb) {
      intents.push(cb.value);
    });
    const stateRadio = document.querySelector('input[name="ability-aw-state"]:checked');
    const subRadio   = document.querySelector('input[name="ability-aw-sub"]:checked');
    const durRadio   = document.querySelector('input[name="ability-dur"]:checked');

    return {
      name:              nameEl ? nameEl.value.trim() : '',
      polarity:          polarityEl ? polarityEl.value : '',
      description:       descEl ? descEl.value.trim() : '',
      intents:           intents,
      awarenessState:    stateRadio ? stateRadio.value : 'suppressed',
      awarenessSubstate: subRadio ? subRadio.value : 'touch',
      duration:          durRadio ? durRadio.value : 'instant',
      conditionDetails:  readConditionList(),
      restrictions:      readRestrictionList(),
    };
  }

  // ─── Dialog: live updates ─────────────────────────────────

  function onAnyDialogInput() {
    updateStrainCost();
  }

  function onIntentsChange() {
    updateConditionSectionVisibility();
    updateIntentValidation();
    updateStrainCost();
  }

  function onAwarenessStateChange(e) {
    const val = (e && e.target && e.target.name === 'ability-aw-state') ? e.target.value : null;
    if (!val) return;
    rebuildSubstates(val, null);
    updateAwDescription();
    updateIntentValidation();
    updateStrainCost();
  }

  function onDurationChange() {
    updateDurDescription();
    updateStrainCost();
  }

  function rebuildSubstates(stateKey, preferredSubstate) {
    if (!awSubstatesEl) return;
    const state = Schema.ABILITY_AWARENESS[stateKey];
    if (!state) { awSubstatesEl.innerHTML = ''; return; }
    const subs = Object.keys(state.substates);
    const selectedSub = preferredSubstate && subs.indexOf(preferredSubstate) !== -1
      ? preferredSubstate
      : subs[0];
    awSubstatesEl.innerHTML = subs.map(function (key) {
      const def  = state.substates[key];
      const sel  = key === selectedSub ? ' checked' : '';
      const dim  = def.dimension ? ' <span class="ability-intent-cost">(' + def.dimension + ')</span>' : '';
      return '' +
        '<label class="ability-radio-label ability-radio-with-desc">' +
          '<input type="radio" name="ability-aw-sub" value="' + key + '"' + sel + '>' +
          '<span class="ability-radio-info">' +
            '<span>' + esc(def.label) +
              ' <span class="ability-intent-cost">(+' + def.strain + ')</span>' + dim + '</span>' +
            '<span class="ability-radio-desc">' + esc(def.description) + '</span>' +
          '</span>' +
        '</label>';
    }).join('');
  }

  function updateAwDescription() {
    if (!awDescEl) return;
    const stateRadio = document.querySelector('input[name="ability-aw-state"]:checked');
    const def = stateRadio ? Schema.ABILITY_AWARENESS[stateRadio.value] : null;
    awDescEl.textContent = def ? def.description : '';
  }

  function updateDurDescription() {
    if (!durDescEl) return;
    const durRadio = document.querySelector('input[name="ability-dur"]:checked');
    const def = durRadio ? Schema.DURATIONS[durRadio.value] : null;
    durDescEl.textContent = def ? def.description : '';
  }

  function updateIntentValidation() {
    // No intent constraints; all intents are available for all awareness states.
    document.querySelectorAll('.ability-intent-check').forEach(function (cb) {
      const label = cb.closest('.ability-intent-label');
      if (label) label.classList.remove('ability-intent-disabled');
    });
    if (intentWarnEl) {
      intentWarnEl.textContent = '';
      intentWarnEl.hidden = true;
    }
  }

  function updateStrainCost() {
    if (!costValueEl) return;
    var cost = Schema.calcAbilityStrainCost(readDialog());
    costValueEl.textContent = String(cost);
    var creature = _orchestrator ? _orchestrator.getCreature() : {};
    var realm = ((creature.header) || {}).realm || 0;
    if (freeTagEl) {
      if (cost > 0 && cost <= realm) {
        freeTagEl.textContent = 'Free at Realm ' + realm;
        freeTagEl.hidden = false;
      } else {
        freeTagEl.hidden = true;
      }
    }
  }

  // ─── Condition details ────────────────────────────────────

  function updateConditionSectionVisibility() {
    if (!conditionSecEl) return;
    const conditionChecked = !!document.querySelector('.ability-intent-check[value="condition"]:checked');
    conditionSecEl.hidden = !conditionChecked;
    if (conditionChecked && conditionListEl && !conditionListEl.querySelector('.ability-condition-item')) {
      conditionListEl.appendChild(buildConditionItem(''));
    }
  }

  function renderConditionList(values) {
    if (!conditionListEl) return;
    conditionListEl.innerHTML = '';
    const vals = (values && values.length) ? values : [];
    vals.forEach(function (v) { conditionListEl.appendChild(buildConditionItem(v)); });
  }

  function buildConditionItem(value) {
    const wrap = document.createElement('div');
    wrap.className = 'ability-condition-item';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ability-condition-input';
    input.placeholder = 'e.g. Burning';
    input.value = value || '';
    wrap.appendChild(input);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-icon-remove ability-condition-remove';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', 'Remove condition');
    wrap.appendChild(removeBtn);

    return wrap;
  }

  function readConditionList() {
    if (!conditionListEl) return [];
    const out = [];
    conditionListEl.querySelectorAll('.ability-condition-input').forEach(function (inp) {
      const v = (inp.value || '').trim();
      if (v) out.push(v);
    });
    return out;
  }

  function onAddCondition() {
    if (!conditionListEl) return;
    conditionListEl.appendChild(buildConditionItem(''));
    updateStrainCost();
  }

  function onConditionListClick(e) {
    if (e.target.closest('.ability-condition-remove')) {
      const item = e.target.closest('.ability-condition-item');
      if (item) item.remove();
      if (conditionListEl && !conditionListEl.querySelector('.ability-condition-item')) {
        conditionListEl.appendChild(buildConditionItem(''));
      }
      updateStrainCost();
    }
  }

  // ─── Restriction details ──────────────────────────────────

  function renderRestrictionList(values) {
    if (!restrictionListEl) return;
    restrictionListEl.innerHTML = '';
    (values || []).forEach(function (v) {
      if (v) restrictionListEl.appendChild(buildRestrictionItem(v));
    });
  }

  function buildRestrictionItem(value) {
    const wrap = document.createElement('div');
    wrap.className = 'ability-restriction-item';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ability-restriction-input';
    input.placeholder = 'e.g. Target must have a condition';
    input.value = value || '';
    wrap.appendChild(input);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-icon-remove ability-restriction-remove';
    removeBtn.textContent = '×';
    removeBtn.setAttribute('aria-label', 'Remove restriction');
    wrap.appendChild(removeBtn);

    return wrap;
  }

  function readRestrictionList() {
    if (!restrictionListEl) return [];
    const out = [];
    restrictionListEl.querySelectorAll('.ability-restriction-input').forEach(function (inp) {
      const v = (inp.value || '').trim();
      if (v) out.push(v);
    });
    return out;
  }

  function onAddRestriction() {
    if (!restrictionListEl) return;
    restrictionListEl.appendChild(buildRestrictionItem(''));
    updateStrainCost();
  }

  function onRestrictionListClick(e) {
    if (e.target.closest('.ability-restriction-remove')) {
      const item = e.target.closest('.ability-restriction-item');
      if (item) item.remove();
      updateStrainCost();
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  function esc(str) {
    return (str == null ? '' : String(str))
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { init, render, read };
})();
