import { ELEMENTS } from './GridBattlerGame.jsx';

// ─── RARITY ──────────────────────────────────────────────────────────────
// Five tiers, one per Platonic solid, ordered by face count as the rarity
// ramp -- simplest solid (tetrahedron, 4 faces) is most common, most complex
// (icosahedron, 20 faces) is rarest. A material's tier reflects how hard it
// is to obtain (drop odds, steps to synthesize it), not the other way
// around -- the solid is just the label the difficulty earns.
export const RARITY_TIERS = [
  { id:'tetrahedron',  tier:1, name:'Tetrahedron',  faces:4,  label:'Common',    color:'#7a9db5', icon:'▲' },
  { id:'hexahedron',   tier:2, name:'Hexahedron',   faces:6,  label:'Uncommon',  color:'#00cc66', icon:'◼' },
  { id:'octahedron',   tier:3, name:'Octahedron',   faces:8,  label:'Rare',      color:'#00c8ff', icon:'◆' },
  { id:'dodecahedron', tier:4, name:'Dodecahedron', faces:12, label:'Epic',      color:'#9b6cff', icon:'⬠' },
  { id:'icosahedron',  tier:5, name:'Icosahedron',  faces:20, label:'Legendary', color:'#ffd700', icon:'⬡' },
];
export const rarityById = (id) => RARITY_TIERS.find(r => r.id === id);

// ─── EQUIPMENT ───────────────────────────────────────────────────────────
// Six slots per Proxy: three armor pieces plus three open accessory slots.
// Accessory slots aren't individually typed (no fixed "ring slot") -- any
// item from ACCESSORY_TYPES can go in any of the three, matching how a
// player would actually stack rings/piercings/etc. in practice.
export const EQUIPMENT_SLOTS = [
  { id:'helm',       name:'Helm',      icon:'🪖', group:'armor' },
  { id:'torso',      name:'Torso',     icon:'👕', group:'armor' },
  { id:'legs',       name:'Legs',      icon:'👖', group:'armor' },
  { id:'accessory1', name:'Accessory', icon:'◈',  group:'accessory' },
  { id:'accessory2', name:'Accessory', icon:'◈',  group:'accessory' },
  { id:'accessory3', name:'Accessory', icon:'◈',  group:'accessory' },
];
export const ACCESSORY_TYPES = ['Ring', 'Piercing', 'Necklace', 'Glove', 'Charm', 'Band'];

// ─── MATERIALS ───────────────────────────────────────────────────────────
// Ten materials: one Core per base element (the raw signature a fusion or
// equipment synthesis draws elemental effects from), plus a +/- pair each
// for Damage, Health, and Energy -- the stat-shaping Cores crafting will
// use to push a piece of gear's numbers up or down. Colors/icons for the
// element Cores are pulled straight from ELEMENTS.base so they always match
// the element's own in-battle color, not a separately-maintained palette.
const el = ELEMENTS.base;
export const STAT_META = {
  damage: { label: 'Damage', icon: '⚔️', color: '#ff4d4d' },
  health: { label: 'Health', icon: '❤️', color: '#00cc66' },
  energy: { label: 'Energy', icon: '⚡', color: '#00c8ff' },
};

export const MATERIALS = [
  { id: 'fireCore',  name: 'Fire Core',  icon: el.Fire.icon,  color: el.Fire.color,  kind: 'element', element: 'Fire',
    tier: 'tetrahedron', desc: 'A condensed Fire signature -- the base building block of any Ember-aligned synthesis.' },
  { id: 'waterCore', name: 'Water Core', icon: el.Water.icon, color: el.Water.color, kind: 'element', element: 'Water',
    tier: 'tetrahedron', desc: 'A condensed Water signature -- the base building block of any Torrent-aligned synthesis.' },
  { id: 'earthCore', name: 'Earth Core', icon: el.Earth.icon, color: el.Earth.color, kind: 'element', element: 'Earth',
    tier: 'tetrahedron', desc: 'A condensed Earth signature -- the base building block of any Tremor-aligned synthesis.' },
  { id: 'airCore',   name: 'Air Core',   icon: el.Air.icon,   color: el.Air.color,   kind: 'element', element: 'Air',
    tier: 'tetrahedron', desc: 'A condensed Air signature -- the base building block of any Gale-aligned synthesis.' },

  { id: 'overclockCore',  name: 'Overclock Core',  icon: STAT_META.damage.icon, color: STAT_META.damage.color,
    kind: 'stat', stat: 'damage', sign: 1,  tier: 'octahedron',  desc: 'Pushes a synthesis past its rated output. Raises Damage.' },
  { id: 'throttleCore',   name: 'Throttle Core',   icon: STAT_META.damage.icon, color: STAT_META.damage.color,
    kind: 'stat', stat: 'damage', sign: -1, tier: 'hexahedron',  desc: 'Caps a synthesis below its rated output. Lowers Damage.' },
  { id: 'redundancyCore', name: 'Redundancy Core', icon: STAT_META.health.icon, color: STAT_META.health.color,
    kind: 'stat', stat: 'health', sign: 1,  tier: 'octahedron',  desc: 'Mirrors process state for failover. Raises Health.' },
  { id: 'corruptionCore', name: 'Corruption Core', icon: STAT_META.health.icon, color: STAT_META.health.color,
    kind: 'stat', stat: 'health', sign: -1, tier: 'hexahedron',  desc: 'Introduces instability into process state. Lowers Health.' },
  { id: 'surgeCore',      name: 'Surge Core',      icon: STAT_META.energy.icon, color: STAT_META.energy.color,
    kind: 'stat', stat: 'energy', sign: 1,  tier: 'octahedron',  desc: 'Widens the bandwidth of the Energy pool. Raises Energy.' },
  { id: 'drainCore',      name: 'Drain Core',      icon: STAT_META.energy.icon, color: STAT_META.energy.color,
    kind: 'stat', stat: 'energy', sign: -1, tier: 'hexahedron',  desc: 'Bleeds bandwidth off the Energy pool. Lowers Energy.' },
];
