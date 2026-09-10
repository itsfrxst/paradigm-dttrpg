// Redesigned replacement for the extension's inventory-system.js collectible/
// rarity logic. Unified-economy version: exploring grants hexas + MATERIALS
// ids (from ItemData.jsx) directly instead of the old shard/fragment/relic
// currencies. Pure and synchronous -- no consumable-multiplier lookups to
// await, since that system (activeConsumables) isn't ported.
import { MATERIALS, rarityById } from '../ItemData.jsx';

// Reuses RARITY_TIERS' shape as the drop table -- chance must sum to 1.
// icosahedron ("Legendary"/Gold) is the designated tier for the explore
// badge quest. dodecahedron/icosahedron have no MATERIALS at that tier
// (see ItemData.jsx -- only tetrahedron/hexahedron/octahedron are used by
// any material), so those two tiers are hexas-only high-value drops by
// construction, not a bug -- materialChance is 0 for both.
const RARITY_ROLL_TABLE = [
  { tierId: 'tetrahedron',  chance: 0.45, hexasRange: [1, 3],   materialChance: 0.5 },
  { tierId: 'hexahedron',   chance: 0.28, hexasRange: [3, 6],   materialChance: 0.4 },
  { tierId: 'octahedron',   chance: 0.16, hexasRange: [6, 12],  materialChance: 0.45 },
  { tierId: 'dodecahedron', chance: 0.08, hexasRange: [12, 20], materialChance: 0 },
  { tierId: 'icosahedron',  chance: 0.03, hexasRange: [20, 40], materialChance: 0 },
];

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function rollTier() {
  const roll = Math.random();
  let cumulative = 0;
  for (const entry of RARITY_ROLL_TABLE) {
    cumulative += entry.chance;
    if (roll < cumulative) return entry;
  }
  return RARITY_ROLL_TABLE[0];
}

// Pure -- returns { tierId, hexas, materials }. `materials` is null when no
// material rolled (either the chance missed, or the tier has none defined).
export function rollCollectibleReward() {
  const entry = rollTier();
  const hexas = randInt(entry.hexasRange[0], entry.hexasRange[1]);

  let materials = null;
  if (Math.random() < entry.materialChance) {
    const pool = MATERIALS.filter(m => m.tier === entry.tierId);
    if (pool.length > 0) {
      const picked = pool[Math.floor(Math.random() * pool.length)];
      materials = { [picked.id]: 1 };
    }
  }

  return { tierId: entry.tierId, hexas, materials };
}

// Pure and synchronous. Spawns 2-4 collectibles in a ring around the player's
// starting position, same angle/radius math as the original extension code.
export function generateCollectiblesForDomain() {
  const count = 2 + Math.floor(Math.random() * 3);
  const collectibles = [];

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 20 + Math.random() * 25;
    const reward = rollCollectibleReward();
    const tier = rarityById(reward.tierId);
    const materialId = reward.materials ? Object.keys(reward.materials)[0] : null;
    const material = materialId ? MATERIALS.find(m => m.id === materialId) : null;

    collectibles.push({
      position: [Math.cos(angle) * radius, 1, Math.sin(angle) * radius],
      tierId: reward.tierId,
      color: tier.color,
      name: material ? material.name : 'Hexas Cache',
      reward,
    });
  }

  return collectibles;
}
