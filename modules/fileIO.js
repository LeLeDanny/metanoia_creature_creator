// fileIO.js
// Owns the New / Open / Save / Export workflow and the markdown assembler.
// Exposes a single global: FileIO
//
// Depends on globals: Schema

const FileIO = (() => {

  let _orchestrator = null;

  // ─── Public API ───────────────────────────────────────────

  function init(orchestrator) {
    _orchestrator = orchestrator;

    const btnNew    = document.getElementById('btn-new');
    const btnSave   = document.getElementById('btn-save');
    const btnExport = document.getElementById('btn-export');
    const fileInput = document.getElementById('file-input');

    if (btnNew)    btnNew.addEventListener('click', onNew);
    if (btnSave)   btnSave.addEventListener('click', onSave);
    if (btnExport) btnExport.addEventListener('click', onExport);
    if (fileInput) fileInput.addEventListener('change', onFileChosen);
  }

  // ─── Button handlers ──────────────────────────────────────

  function onNew() {
    const current = _orchestrator.getCreature();
    const dirty   = _orchestrator.isDirty();
    const hasData = current && (current.header.name || current.header.xpTotal > 0);
    if (dirty || hasData) {
      const ok = confirm('Discard the current creature and start a new one?');
      if (!ok) return;
    }
    _orchestrator.setCreature(Schema.blankCreature());
    _orchestrator.markClean();
  }

  async function onSave() {
    const creature = _orchestrator.collect();
    creature.meta.lastSaved = new Date().toISOString();
    const json = JSON.stringify(creature, null, 2);
    const filename = suggestedFilename(creature);

    let saved = false;
    if ('showSaveFilePicker' in window) {
      saved = await saveViaPicker(json, filename);
    }
    if (!saved) {
      saved = saveViaDownload(json, filename);
    }

    if (saved) {
      _orchestrator.setCreature(creature);
      _orchestrator.markClean();
    }
  }

  function onFileChosen(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;

    const dirty = _orchestrator.isDirty();
    if (dirty) {
      const ok = confirm('Discard unsaved changes and open this file?');
      if (!ok) return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      let parsed;
      try { parsed = JSON.parse(reader.result); }
      catch (err) {
        alert('That file is not valid JSON.');
        return;
      }
      if (!isCreatureShape(parsed)) {
        alert('That file does not look like a creature file.');
        return;
      }
      _orchestrator.setCreature(migrate(parsed));
      _orchestrator.markClean();
    };
    reader.onerror = function () {
      alert('Could not read that file.');
    };
    reader.readAsText(file);
  }

  async function onExport() {
    const creature = _orchestrator.collect();
    const markdown = buildMarkdown(creature);
    const copied = await copyToClipboard(markdown);
    if (copied) {
      flashExportButton('Copied');
    } else {
      alert('Could not copy to clipboard. The markdown is printed to the console.');
      console.log(markdown);
    }
  }

  // ─── Save helpers ─────────────────────────────────────────

  async function saveViaPicker(json, filename) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'Creature JSON',
          accept: { 'application/json': ['.json'] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return true;
    } catch (err) {
      if (err && err.name === 'AbortError') return false;
      console.warn('File System Access save failed, falling back to download.', err);
      return false;
    }
  }

  function saveViaDownload(json, filename) {
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 500);
      return true;
    } catch (err) {
      console.error('Download save failed.', err);
      return false;
    }
  }

  function suggestedFilename(creature) {
    const name = ((creature.header && creature.header.name) || '').trim();
    const slug = name
      ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : 'creature';
    return (slug || 'creature') + '.json';
  }

  // ─── Load helpers ─────────────────────────────────────────

  function isCreatureShape(obj) {
    return obj && typeof obj === 'object'
      && obj.meta && typeof obj.meta.schemaVersion === 'number'
      && obj.header && typeof obj.header === 'object'
      && obj.xpLedger && typeof obj.xpLedger === 'object';
  }

  function migrate(creature) {
    const blank = Schema.blankCreature();
    const ledgerIn = creature.xpLedger || {};
    const mergedLedger = {
      strain:  ledgerIn.strain  || 0,
      stride:  ledgerIn.stride  || 0,
      intents: Object.assign({}, ledgerIn.intents || {}),
    };
    const mergedHeader = Object.assign({}, blank.header, creature.header || {});
    mergedHeader.polarities = normalizePolarities(mergedHeader.polarities, creature.polarities);
    const migrated = Object.assign({}, blank, creature, {
      meta:      Object.assign({}, blank.meta, creature.meta || {}),
      header:    mergedHeader,
      xpLedger:  mergedLedger,
      coreStats: Object.assign({}, blank.coreStats, creature.coreStats || {}),
      armor:     Object.assign({}, blank.armor, creature.armor || {}),
      activeAbilities:  Array.isArray(creature.activeAbilities)
        ? creature.activeAbilities.map(normalizeAbility)
        : [],
      passiveAbilities: Array.isArray(creature.passiveAbilities)
        ? creature.passiveAbilities.map(function (p) { return Object.assign({ id: Schema.newId() }, p); })
        : [],
      specialMechanics: typeof creature.specialMechanics === 'string' ? creature.specialMechanics : '',
    });
    delete migrated.polarities;
    return migrated;
  }

  // ─── Clipboard ────────────────────────────────────────────

  async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('Clipboard API failed, trying fallback.', err);
      }
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity  = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (err) {
      return false;
    }
  }

  function flashExportButton(label) {
    const btn = document.getElementById('btn-export');
    if (!btn) return;
    const original = btn.textContent;
    btn.textContent = label;
    btn.disabled = true;
    setTimeout(function () {
      btn.textContent = original;
      btn.disabled = false;
    }, 1200);
  }

  // ─── Markdown export ──────────────────────────────────────

  function buildMarkdown(creature) {
    const parts = [];

    const header = creature.header || {};
    const name   = (header.name || '').trim() || 'Unnamed Creature';
    const realmName = Schema.REALM_NAMES[header.realm || 0] || '';
    const titleLine = '## ' + name;
    const metaParts = [header.category || 'Custom'];
    const faction   = (header.faction || '').trim();
    if (faction) metaParts.push(faction);
    metaParts.push('Realm ' + (header.realm || 0) + (realmName ? ' ' + realmName : ''));
    metaParts.push('XP ' + (header.xpTotal || 0));
    const metaLine = '*' + metaParts.join(' | ') + '*';

    parts.push(titleLine);
    parts.push(metaLine);

    if (header.description && header.description.trim()) {
      parts.push('');
      parts.push(header.description.trim());
    }

    parts.push('');
    parts.push(buildCoreStatsTable(creature));

    parts.push('');
    parts.push(buildFormulaLines(creature));

    parts.push('');
    parts.push(buildXpSpentTable(creature));

    parts.push('');
    parts.push(buildCapabilityDiceTable(creature));

    parts.push('');
    parts.push(buildArmorTable(creature));

    const passives = buildPassiveAbilitiesBlock(creature);
    if (passives) { parts.push(''); parts.push(passives); }

    const polarities = buildPolaritiesBlock(creature);
    if (polarities) { parts.push(''); parts.push(polarities); }
    const abilities = buildAbilitiesBlock(creature);
    if (abilities) { parts.push(''); parts.push(abilities); }

    const special = (creature.specialMechanics || '').trim();
    if (special) {
      parts.push('');
      parts.push('### Special Mechanics');
      parts.push(special);
    }

    return parts.join('\n') + '\n';
  }

  function buildCoreStatsTable(creature) {
    const strainMax = Schema.calcStrainMax(
      (creature.header || {}).realm || 0,
      (creature.xpLedger || {}).strain || 0
    );
    const stride    = Schema.calcStride((creature.xpLedger || {}).stride || 0);
    const wounds    = Schema.calcWoundSlots(creature);
    const range     = ((creature.coreStats || {}).range || '').trim() || '-';
    const dmg       = ((creature.coreStats || {}).damageTypes || '').trim() || '-';

    return [
      '| Strain Max | Wound Slots | Stride | Range | Damage Types |',
      '|---|---|---|---|---|',
      '| ' + strainMax + ' | ' + wounds + ' | ' + stride + ' | ' + range + ' | ' + dmg + ' |',
    ].join('\n');
  }

  function buildFormulaLines(creature) {
    const realm    = (creature.header || {}).realm || 0;
    const strainXp = (creature.xpLedger || {}).strain || 0;
    const strideXp = (creature.xpLedger || {}).stride || 0;
    return [
      'Strain Max: 4 + 2x(Realm ' + realm + ' + Strain XP ' + strainXp + ') = ' + Schema.calcStrainMax(realm, strainXp),
      'Stride: 2 + Stride XP ' + strideXp + ' = ' + Schema.calcStride(strideXp),
    ].join('\n');
  }

  function buildXpSpentTable(creature) {
    const ledger = creature.xpLedger || {};
    const rows = [];
    rows.push(['Category', 'XP']);
    if ((ledger.strain || 0) > 0) rows.push(['Strain XP', ledger.strain]);
    if ((ledger.stride || 0) > 0) rows.push(['Stride XP', ledger.stride]);

    const intents = ledger.intents || {};
    Object.keys(intents).forEach(function (key) {
      const xp = intents[key] || 0;
      if (xp > 0) {
        const label = (Schema.INTENTS[key] && Schema.INTENTS[key].label) || key;
        rows.push([label, xp]);
      }
    });

    const passiveTotal = Schema.calcPassiveXpTotal(creature.passiveAbilities);
    if (passiveTotal !== 0) {
      const label = passiveTotal < 0 ? 'Passive Abilities (grants)' : 'Passive Abilities';
      rows.push([label, passiveTotal]);
    }
    rows.push(['Total', Schema.calcXpSpent(creature)]);

    const out = ['### XP Spent'];
    out.push('| ' + rows[0].join(' | ') + ' |');
    out.push('|' + rows[0].map(function () { return '---'; }).join('|') + '|');
    for (let i = 1; i < rows.length; i++) {
      out.push('| ' + rows[i].join(' | ') + ' |');
    }
    return out.join('\n');
  }

  function buildCapabilityDiceTable(creature) {
    const intents = (creature.xpLedger || {}).intents || {};
    const entries = Object.keys(intents)
      .filter(function (key) { return (intents[key] || 0) > 0; })
      .map(function (key) {
        const level = Schema.calcIntentLevel(intents[key]);
        const die   = Schema.calcIntentDie(level);
        const label = (Schema.INTENTS[key] && Schema.INTENTS[key].label) || key;
        return [label, level, die];
      });

    const out = ['### Capability Dice'];
    if (entries.length === 0) {
      out.push('All intents: level 0, d3-1');
      return out.join('\n');
    }
    out.push('| Intent | Level | Die |');
    out.push('|---|---|---|');
    entries.forEach(function (row) {
      out.push('| ' + row.join(' | ') + ' |');
    });
    out.push('Unlisted intents: level 0, d3-1');
    return out.join('\n');
  }

  function buildArmorTable(creature) {
    const armor = creature.armor || {};
    const out = ['### Armor', '| Location | AS |', '|---|---|'];
    Schema.HIT_LOCATIONS.forEach(function (key) {
      const slot = armor[key] || {};
      const label = (slot.label || Schema.HIT_LOCATION_LABELS[key]);
      const as = slot.as || 0;
      out.push('| ' + label + ' | ' + as + ' |');
    });
    return out.join('\n');
  }

  function buildPassiveAbilitiesBlock(creature) {
    const list = (creature.passiveAbilities || []).filter(function (p) { return p && p.name; });
    if (list.length === 0) return '';
    const lines = list.map(function (p) { return '- ' + formatPassiveLine(p); });
    return '### Passive Abilities\n' + lines.join('\n');
  }

  function formatPassiveLine(p) {
    const cost  = Schema.calcPassiveXpCost(p);
    const level = p.level || 0;

    if (p.name === 'Resistant') {
      return 'Resistant (' + (p.notes || '—') + ') Lv ' + level +
        ': −' + level + ' Strain [' + cost + ' XP]';
    }
    if (p.name === 'Vulnerability') {
      return 'Vulnerability (' + (p.notes || '—') + ') Lv ' + level +
        ': +' + level + ' Strain [+' + Math.abs(cost) + ' XP]';
    }

    let line = p.name;
    if (level > 1) line += ' Lv ' + level;
    if (p.notes)   line += ': ' + p.notes;
    if (cost !== 0) line += ' [' + (cost < 0 ? '+' + Math.abs(cost) : cost) + ' XP]';
    return line;
  }

  function buildPolaritiesBlock(creature) {
    const list = ((creature.header || {}).polarities) || [];
    if (!Array.isArray(list) || list.length === 0) return '';
    const lines = list.map(function (p) {
      const name = (p && p.name ? String(p.name) : '').trim();
      const note = (p && p.note ? String(p.note) : '').trim();
      if (!name) return null;
      return '- ' + name + (note ? ': ' + note : '');
    }).filter(Boolean);
    if (lines.length === 0) return '';
    return '### Polarities\n' + lines.join('\n');
  }

  // Normalize polarities into the structured [{ id, name, note }] shape.
  // Handles three legacy inputs: the new array format, the free-text string
  // format (one "Name: note" per line), and the very-old top-level
  // `polarities` array of { name, usageNote }.
  function normalizePolarities(headerPolarities, legacyTopLevel) {
    if (Array.isArray(headerPolarities) && headerPolarities.length > 0) {
      return headerPolarities
        .map(function (p) {
          const name = p && p.name ? String(p.name).trim() : '';
          const note = p && (p.note || p.usageNote) ? String(p.note || p.usageNote).trim() : '';
          if (!name) return null;
          return { id: (p && p.id) || Schema.newId(), name: name, note: note };
        })
        .filter(Boolean);
    }
    if (typeof headerPolarities === 'string' && headerPolarities.trim()) {
      return parsePolaritiesString(headerPolarities);
    }
    if (Array.isArray(legacyTopLevel)) {
      return legacyTopLevel
        .map(function (p) {
          const name = p && p.name ? String(p.name).trim() : '';
          const note = p && p.usageNote ? String(p.usageNote).trim() : '';
          if (!name) return null;
          return { id: (p && p.id) || Schema.newId(), name: name, note: note };
        })
        .filter(Boolean);
    }
    return [];
  }

  function normalizeAbility(a) {
    const src = a || {};
    return {
      id:                src.id || Schema.newId(),
      name:              typeof src.name === 'string' ? src.name : '',
      polarity:          typeof src.polarity === 'string' ? src.polarity : '',
      description:       typeof src.description === 'string' ? src.description : '',
      intents:           Array.isArray(src.intents) ? src.intents.slice() : [],
      awarenessState:    Schema.ABILITY_AWARENESS[src.awarenessState] ? src.awarenessState : 'suppressed',
      awarenessSubstate: src.awarenessSubstate || 'touch',
      duration:          Schema.DURATIONS[src.duration] ? src.duration : 'instant',
      conditionDetails:  Array.isArray(src.conditionDetails)
        ? src.conditionDetails.map(function (v) {
            if (typeof v === 'string') return v;
            if (v && typeof v === 'object' && v.variant) return String(v.variant);
            if (v && typeof v === 'object' && v.type)    return String(v.type);
            return '';
          }).filter(Boolean)
        : [],
    };
  }

  function parsePolaritiesString(text) {
    return String(text || '')
      .split('\n')
      .map(function (line) {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const idx  = trimmed.indexOf(':');
        const name = idx >= 0 ? trimmed.slice(0, idx).trim() : trimmed;
        const note = idx >= 0 ? trimmed.slice(idx + 1).trim() : '';
        if (!name) return null;
        return { id: Schema.newId(), name: name, note: note };
      })
      .filter(Boolean);
  }

  function buildAbilitiesBlock(creature) {
    const actives = creature.activeAbilities || [];
    if (actives.length === 0) return '';

    const out = ['### Active Abilities'];

    actives.forEach(function (a) {
      const cost = Schema.calcAbilityStrainCost(a);
      const name = (a.name || 'Unnamed Ability').trim();
      const desc = (a.description || '').trim();

      const tags = [];
      if (a.polarity) tags.push(a.polarity);
      const state = Schema.ABILITY_AWARENESS[a.awarenessState];
      const sub   = state && state.substates[a.awarenessSubstate];
      if (sub) tags.push(sub.dimension ? sub.label + ' (' + sub.dimension + ')' : sub.label);
      const dur = Schema.DURATIONS[a.duration];
      if (dur && a.duration && a.duration !== 'instant') tags.push(dur.label);

      const intentLabels = (a.intents || []).map(function (k) {
        if (k === 'condition') {
          const details = (a.conditionDetails || []).filter(Boolean);
          return 'Condition [' + (details.length ? details.join(', ') : 'X') + ']';
        }
        return (Schema.INTENTS[k] && Schema.INTENTS[k].label) || k;
      });

      let line = '**' + name + '** (' + cost + ' Strain)';
      if (tags.length) line += ' _' + tags.join(' · ') + '_';
      if (desc) line += ': ' + desc;
      if (intentLabels.length) line += ' [' + intentLabels.join(', ') + ']';
      out.push(line);
    });

    return out.join('\n\n');
  }

  // ─── Public API ─────────────────────────────────────────────

  return {
    init,
    buildMarkdown,
  };
})();
