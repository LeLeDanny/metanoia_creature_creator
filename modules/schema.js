// schema.js
// Single source of truth for creature game constants, valid values,
// derived calculations, and the blank creature factory.
// Exposes a single global: Schema
//
// Many enums (INTENTS, ABILITY_AWARENESS, DURATIONS, PASSIVE_ABILITIES,
// DAMAGE_TYPES) and the calcAbilityStrainCost function mirror the
// Character Sheet Application's Schema. Keep them in sync by hand
// when the player ruleset changes.

const Schema = (() => {

  // ─── Enumerations ──────────────────────────────────────────

  const CATEGORIES = ['Corrupted', 'Thuim NPC', 'Fauna', 'Custom'];

  const REALM_NAMES = {
    0: 'Void', 1: 'Spark', 2: 'Flame', 3: 'Star', 4: 'Constellation', 5: 'Galaxy',
  };

  // Ordered by base d8 hit result (1=Head, 2-3=Arms, 4-5=Legs, 6-8=Center)
  const HIT_LOCATIONS = ['head', 'arms', 'legs', 'center'];

  const HIT_LOCATION_LABELS = {
    head:   'Head',
    arms:   'Arms',
    legs:   'Legs',
    center: 'Center',
  };

  const CONDITIONS = {
    weakened:           { label: 'Weakened',            strain: 1, hasDetail: false, description: 'Enemy die steps down by strain value' },
    maimed:             { label: 'Maimed',              strain: 1, hasDetail: false, description: 'Disables abilities equal to strain value' },
    escalating:         { label: 'Escalating',          strain: 1, hasDetail: true,  detailPlaceholder: 'e.g. Burning, Bleeding', description: 'Loses strain equal to condition value each round' },
    hemorrhaging:       { label: 'Hemorrhaging',        strain: 3, hasDetail: false, description: 'Every 2 turns, take a wound of severity equal to the condition value' },
    sensoryDeprivation: { label: 'Sensory Deprivation', strain: 1, hasDetail: true,  detailPlaceholder: 'e.g. Sight, Hearing',   description: 'Blocks senses equal to strain value; rolls using blocked senses lose a die' },
    slowed:             { label: 'Slowed',              strain: 1, hasDetail: false, description: 'Stride reduced by strain value' },
    elevated:           { label: 'Elevated',            strain: 1, hasDetail: true,  detailPlaceholder: 'e.g. Harm rolls',       description: 'One die steps up on the specified roll type' },
    unimpeded:          { label: 'Unimpeded',           strain: 1, hasDetail: false, description: 'Ignore terrain effects that reduce Stride' },
    hastened:               { label: 'Hastened',               strain: 1, hasDetail: false, description: 'Movement speed doubled' },
    polarityEmpowered:      { label: 'Polarity Empowered',      strain: 2, hasDetail: false, description: 'One polarity die of your choice steps up (chosen at play time)', requiresPolarity: 'Influence' },
    polarityHarmonization:  { label: 'Polarity Harmonization',  strain: 3, hasDetail: true, detailType: 'polarity', detailCount: 2, detailPlaceholders: ['Designated polarity', 'Related polarity'],    description: 'Using the designated polarity lets you use the related polarity for free', requiresPolarity: 'Harmony' },
    sealPolarity:           { label: 'Seal Polarity',           strain: 2, hasDetail: true,  detailPlaceholder: 'e.g. Heat',  description: 'Target cannot use the named polarity', requiresPolarity: 'Coalescence' },
    converted:              { label: 'Converted',               strain: 1, hasDetail: false,                                  description: 'Seal one of your polarities (chosen at play time); complications on your rolls are treated as boons while active', requiresPolarity: 'Conversion' },
    fluidity:               { label: 'Fluidity',                strain: 1, hasDetail: false,                                  description: 'Null hits grant +1 success on your next action', requiresPolarity: 'Flux' },
    rebounding:             { label: 'Rebounding',              strain: 2, hasDetail: false,                                  description: 'For every 2 strain taken from outside sources, regain 1 strain', requiresPolarity: 'Elasticity' },
    momentum:               { label: 'Momentum',                strain: 1, hasDetail: false,                                  description: 'A success accumulates from every successful roll and can be spent at any time while this condition is maintained', requiresPolarity: 'Recurrence' },
    unified:                { label: 'Unified',                 strain: 4, hasDetail: false,                                  description: 'Gain access to one polarity of your choice (chosen at play time) while this condition is maintained', requiresPolarity: 'Emergence' },
    custom:                 { label: 'Custom',                  strain: 1, hasDetail: true,  detailPlaceholder: 'Condition name',         description: 'A custom condition' },
  };

  const INTENTS = {
    harm:      { label: 'Harm',          strain: 1, description: 'Deal damage' },
    guard:     { label: 'Guard',         strain: 2, description: 'Protect against an effect, absorb damage' },
    dodge:     { label: 'Dodge',         strain: 2, description: 'Avoid an effect entirely, up to your stride' },
    heal:      { label: 'Heal',          strain: 1, description: 'Repair a wound, clear a condition, stabilize' },
    recover:   { label: 'Recover',       strain: 3, description: 'Enhance Strain recovery during rest' },
    seize:     { label: 'Seize',         strain: 1, description: 'Grab, hold, restrain, immobilize' },
    move:      { label: 'Move',          strain: 1, description: 'Physically displace self up to your stride' },
    displace:  { label: 'Displace',      strain: 1, description: 'Physically displace target' },
    teleport:  { label: 'Teleport',      strain: 2, description: 'Instant relocation' },
    condition: { label: 'Condition [X]', strain: 1, description: 'Apply a status effect or debuff' },
    hide:      { label: 'Hide',          strain: 1, description: 'Conceal something, disguise, obscure' },
    know:      { label: 'Know',          strain: 1, description: 'Gain information, detect, perceive, analyze' },
    convince:  { label: 'Convince',      strain: 1, description: 'Influence a mind, persuade, intimidate, deceive' },
    create:    { label: 'Create',        strain: 0, description: 'Make something from materials' },
    manifest:  { label: 'Manifest',      strain: 1, description: 'Make something without materials' },
    castX:     { label: 'Cast [X]',      strain: 1, description: 'Only for created or manifested things. The creation casts this ability on its own.' },
  };

  const ABILITY_AWARENESS = {
    suppressed: {
      label: 'Suppressed',
      description: 'Originates from your body. Self, touch, or traveling outward.',
      substates: {
        touch: { label: 'Touch', strain: 0, description: 'Self or direct contact' },
        arc:   { label: 'Arc',   strain: 1, description: 'Cone or sweep outward from you' },
        line:  { label: 'Line',  strain: 1, description: 'Beam from you through targets in its path' },
      },
    },
    extended: {
      label: 'Extended',
      description: 'Radiates outward from you in all directions. Radius scales with Realm.',
      substates: {
        aura: { label: 'Aura', strain: 1, description: 'Radial field around you' },
      },
    },
    focused: {
      label: 'Focused',
      description: 'Targets or manifests at a specific location, entity, or point at range.',
      substates: {
        single:    { label: 'Single',    strain: 1, description: 'One target at range' },
        ricochet:  { label: 'Ricochet',  strain: 2, description: 'Hits a total of 2 targets' },
        chain:     { label: 'Chain',     strain: 3, description: 'Hits a total of 3 targets' },
        narrow:    { label: 'Narrow',    strain: 2, description: 'Around a point at range (radius 1)', dimension: 'r1' },
        wide:      { label: 'Wide',      strain: 3, description: 'Around a point at range (radius 3)', dimension: 'r3' },
        massive:   { label: 'Massive',   strain: 4, description: 'Around a point at range (radius 5)', dimension: 'r5' },
      },
    },
  };

  const DURATIONS = {
    instant:    { label: 'Instant',    strain: 0, description: 'Resolves immediately. One round of action, a single swing, a single moment.' },
    charged:    { label: 'Charged',    strain: 1, description: 'Lies dormant until triggered, activates once, then disappears.' },
    sustained:  { label: 'Sustained',  strain: 2, description: 'Lasts a frame. A tavern negotiation, a battle, a chase through the streets.' },
    persistent: { label: 'Persistent', strain: 3, description: 'Lasts across multiple scenes, a stretch of travel, or longer.' },
    permanent:  { label: 'Permanent',  strain: 4, description: 'Until destroyed or dispelled. Outlasts the caster.' },
  };

  const DAMAGE_TYPES = [
    { name: 'Heat',     desc: 'Fire, heat, lasers, light. Anything from being too hot.' },
    { name: 'Cold',     desc: 'Ice, freezing, and all chilling sources.' },
    { name: 'Electric', desc: 'Electricity and shocking effects.' },
    { name: 'Decay',    desc: 'Poisons, diseases, withering.' },
    { name: 'Mental',   desc: 'Emotional distress, mind tricks, psychic attacks.' },
    { name: 'Sharp',    desc: 'Piercing and slashing, including telekinetic cuts.' },
    { name: 'Blunt',    desc: 'Impacts, falls, clubs, and blunt telekinesis.' },
    { name: 'Physical', desc: 'Covers both Sharp and Blunt damage.',             covers: ['Sharp', 'Blunt'],                              xpPerLevel: 2 },
    { name: 'Ren',      desc: 'Covers any Ren-sourced damage type.',             covers: ['Heat', 'Cold', 'Electric', 'Decay', 'Mental'], xpPerLevel: 5 },
    { name: 'Divine',   desc: 'Existential "holy" damage; may appear as another type.' },
    { name: 'Void',     desc: 'Inexistence, null, entropic damage.' },
    { name: 'Profane',  desc: 'Existential "unholy" damage; may appear as another type.' },
  ];

  // costType: 'flat' = 1 XP once; 'leveled' = 1 XP per level; 'multi-instance' = 1 XP per instance (different target each time)
  // maxLevel: null means no cap
  // description: shown in the creature creator dialog and row tooltip; mirrors the website rules doc.
  const PASSIVE_ABILITIES = [
    { name: 'Resistant',               costType: 'leveled',        maxLevel: null,
      description: 'Gain resistance to a specific damage type. Each level reduces incoming Strain of that type by 1.' },
    { name: 'Vulnerability',           costType: 'leveled',        maxLevel: 5,    grantsXp: true,
      description: 'Take increased damage from a specific damage type in exchange for XP. Each level increases incoming Strain of that type by 1 and grants XP back to the pool. Max level 5 per damage type.' },
    { name: 'Juggernaut',              costType: 'flat',           maxLevel: 1,
      description: 'When the creature receives a wound with a Strain rating of 1, the wound slot is filled but no condition is associated with it.' },
    { name: 'Advanced Awareness',      costType: 'leveled',        maxLevel: null,
      description: 'One state of the creature\'s Awareness gains a boost to range. Each level increases how far that state reaches.' },
    { name: 'Stability',               costType: 'leveled',        maxLevel: null,
      description: 'Each level reduces any forced movement applied to the creature by 1 Range Band.' },
    { name: 'Advanced Sense',          costType: 'multi-instance', maxLevel: 1,
      description: 'Grants an enhanced or alternative sense: dark vision, heat signatures, perceiving through a blindfold, or similar. Pick one sense per instance.' },
    { name: 'Never at Loss',           costType: 'flat',           maxLevel: 1,
      description: 'When the creature would suffer from any complications, it regains 1 Strain instead.' },
    { name: 'Armored Aura',            costType: 'leveled',        maxLevel: null,
      description: 'Natural armor with a maximum AS equal to the XP invested in this passive. Regenerates up to 2 points every rest.' },
    { name: 'Freedom of Movement',     costType: 'flat',           maxLevel: 1,
      description: 'Ignores terrain effects that reduce Stride.' },
    { name: 'Unconstrained Mind',      costType: 'flat',           maxLevel: 1,
      description: 'Immune to mind control.' },
    { name: 'Focused Execution',       costType: 'flat',           maxLevel: 1,
      description: 'When the creature\'s dice pool is built from 3 or fewer sources, it gains +1 success on the roll.' },
    { name: 'Undetected Awareness',    costType: 'multi-instance', maxLevel: 1,
      description: 'One state of the creature\'s Awareness is only detectable to those who share a specific polarity chosen at purchase. One instance per awareness state or polarity.' },
    { name: 'Buildup',                 costType: 'flat',           maxLevel: 1,
      description: 'Designate a specific trigger. Each time it occurs, gain an escalating die starting at d12 and improving by one step (d12 > d10 > d8 > d6 > d4, cap d4). Add it to any roll, then it resets.' },
    { name: 'Shared Assurance',        costType: 'flat',           maxLevel: 1,
      description: 'When the creature and an ally suffer the same specific negative effect simultaneously, it gains +1 success on its next action.' },
    { name: 'Item Proficiency',        costType: 'leveled',        maxLevel: 5,
      description: 'Choose a specific item or toolset. Gain a die (starting at d12) when using that item. Each level upgrades the die by one step, up to d4.' },
    { name: 'Invigorated',             costType: 'flat',           maxLevel: 1,
      description: 'Gain one additional wound slot. Can only be taken once.' },
    { name: 'Polarity Attunement',     costType: 'multi-instance', maxLevel: 1,
      description: 'Choose one polarity the creature owns. It is treated as one rank higher than it actually is for all purposes. One instance per polarity.' },
    { name: 'No Wound, All Condition', costType: 'flat',           maxLevel: 1,
      description: 'When the creature would successfully wound an enemy, it may instead apply an initial condition at the rolled Strain and one additional condition at 1 Strain.' },
    { name: 'Compounding',             costType: 'flat',           maxLevel: 1,
      description: 'When the creature applies a condition to a target that already has at least one condition, they also become Destabilized (1 Strain).' },
    { name: 'Relentless Application',  costType: 'flat',           maxLevel: 1,
      description: 'When the creature rolls a null result on a roll to apply a specific condition (not through a wound or attack), the condition applies at 1 Strain anyway.' },
    { name: 'Unmeasured Response',     costType: 'leveled',        maxLevel: 5,
      description: 'When the creature receives a wound, gain a bonus die on its next roll. Die starts at d12 at 1 XP invested and improves by one step per additional XP (d12 > d10 > d8 > d6 > d4).' },
    { name: 'Custom',                  costType: 'flat',           maxLevel: null,
      description: 'A free-form passive. Name and description appear in the exported stat block as written.' },
  ];

  // Creature-specific: maps intent level (XP spent on that intent) to the
  // die the creature rolls when using or defending with that intent.
  // L0 is displayed as "d3-1" and rolled as 1d3 minus 1.
  const CAPABILITY_DIE_LADDER = {
    0: 'd3-1',
    1: 'd3',
    2: 'd4',
    3: 'd5',
    4: 'd6',
    5: 'd7',
  };

  const APP_VERSION = '0.1.0';
  const SCHEMA_VERSION = 1;

  // ─── Derived calculations ───────────────────────────────────

  function calcStrainMax(realm, strainXp) {
    return 4 + 2 * ((realm || 0) + (strainXp || 0));
  }

  function calcStride(strideXp) {
    return 2 + (strideXp || 0);
  }

  // Flat default of 3 wound slots. The GM can override per creature via
  // coreStats.woundSlotsOverride when a larger or smaller creature warrants it.
  function calcWoundSlotsDefault() {
    return 3;
  }

  function calcWoundSlots(creature) {
    const override = creature.coreStats && creature.coreStats.woundSlotsOverride;
    if (override != null) return override;
    return calcWoundSlotsDefault(creature.header && creature.header.realm);
  }

  function calcIntentLevel(xpOnIntent) {
    return Math.min(Math.max(xpOnIntent || 0, 0), 5);
  }

  function calcIntentDie(level) {
    return CAPABILITY_DIE_LADDER[calcIntentLevel(level)];
  }

  // Mirrors the Character Sheet Application's calcAbilityStrainCost.
  function calcAbilityStrainCost(ability) {
    const intents = ability.intents || [];
    const intentStrain = intents.reduce(function(sum, key) {
      if (key === 'condition') {
        const details = ability.conditionDetails || [];
        if (!details.length) return sum + 1;
        const condStrain = details.reduce(function(s, c) {
          const type = (c && typeof c === 'object') ? c.type : null;
          const def = type ? CONDITIONS[type] : null;
          return s + (def != null ? def.strain : 1);
        }, 0);
        return sum + Math.max(1, condStrain);
      }
      return sum + ((INTENTS[key] || {}).strain || 0);
    }, 0);
    const state    = ABILITY_AWARENESS[ability.awarenessState];
    const substate = state && state.substates[ability.awarenessSubstate];
    const awarenessStrain = substate ? substate.strain : 0;
    const durationStrain  = (DURATIONS[ability.duration] || {}).strain || 0;
    const restrictionDiscount = (ability.restrictions || []).length;
    return Math.max(0, intentStrain + awarenessStrain + durationStrain - restrictionDiscount);
  }

  function calcIntentsXpTotal(intentsMap) {
    return Object.values(intentsMap || {}).reduce(function(sum, xp) { return sum + (xp || 0); }, 0);
  }

  // Returns the XP cost for a single passive ability. Resistant costs
  // level * damage type multiplier. Vulnerability grants XP (returns a
  // negative cost) at the same multiplier. Flat and multi-instance
  // passives cost their level (1 per entry). Leveled passives cost their
  // level directly.
  function calcPassiveXpCost(passive) {
    if (!passive) return 0;
    const level = passive.level || 0;

    if (passive.name === 'Resistant' || passive.name === 'Vulnerability') {
      const dt   = DAMAGE_TYPES.find(function (d) { return d.name === passive.notes; });
      const mult = dt ? (dt.xpPerLevel || 1) : 1;
      const magnitude = level * mult;
      return passive.name === 'Vulnerability' ? -magnitude : magnitude;
    }

    return level;
  }

  function calcPassiveXpTotal(passives) {
    return (passives || []).reduce(function (sum, p) { return sum + calcPassiveXpCost(p); }, 0);
  }

  function calcXpSpent(creature) {
    const ledger = creature.xpLedger || {};
    return (ledger.strain || 0)
      + (ledger.stride || 0)
      + calcIntentsXpTotal(ledger.intents)
      + calcPassiveXpTotal(creature.passiveAbilities);
  }

  function calcXpRemaining(creature) {
    const total = (creature.header && creature.header.xpTotal) || 0;
    return total - calcXpSpent(creature);
  }

  // ─── ID generation ─────────────────────────────────────────

  function newId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // ─── Blank creature factory ────────────────────────────────

  function blankCreature() {
    return {
      meta: {
        appVersion:    APP_VERSION,
        schemaVersion: SCHEMA_VERSION,
        lastSaved:     null,
      },
      header: {
        name:        '',
        category:    'Custom',
        faction:     '',
        realm:       0,
        xpTotal:     0,
        description: '',
        polarities:  [],
      },
      xpLedger: {
        strain:    0,
        stride:    0,
        intents:   {},
      },
      coreStats: {
        range:              '',
        damageTypes:        '',
        woundSlotsOverride: null,
      },
      armor: {
        head:   { as: 0, label: HIT_LOCATION_LABELS.head },
        arms:   { as: 0, label: HIT_LOCATION_LABELS.arms },
        legs:   { as: 0, label: HIT_LOCATION_LABELS.legs },
        center: { as: 0, label: HIT_LOCATION_LABELS.center },
      },
      activeAbilities:  [],
      passiveAbilities: [],
      tpme: {
        task:     '',
        purpose:  '',
        method:   '',
        endstate: '',
      },
    };
  }

  // ─── Public API ─────────────────────────────────────────────

  return {
    APP_VERSION, SCHEMA_VERSION,
    CATEGORIES, REALM_NAMES, HIT_LOCATIONS, HIT_LOCATION_LABELS,
    CONDITIONS, INTENTS, ABILITY_AWARENESS, DURATIONS, DAMAGE_TYPES, PASSIVE_ABILITIES,
    CAPABILITY_DIE_LADDER,
    calcStrainMax, calcStride, calcWoundSlotsDefault, calcWoundSlots,
    calcIntentLevel, calcIntentDie, calcAbilityStrainCost,
    calcIntentsXpTotal, calcPassiveXpCost, calcPassiveXpTotal,
    calcXpSpent, calcXpRemaining,
    newId, blankCreature,
  };
})();
