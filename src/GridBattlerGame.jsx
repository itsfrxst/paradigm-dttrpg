import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';

const SIZE = 9;

// Battle-row layout: reserved minimum width for each side panel (stats /
// combat log) and the grid column's own horizontal padding, used to size the
// grid square so it never grows wider than the space actually left for it.
const SIDE_PANEL_MIN_WIDTH = 260;
const MID_COL_H_PADDING = 24; // matches the middle column's `padding:'0 12px'`
const GRID_MIN_SIZE = 240;

const TILE_TYPES = {
  NORMAL:'normal', FIRE_BOOST:'fire_boost', WATER_BOOST:'water_boost',
  EARTH_BOOST:'earth_boost', AIR_BOOST:'air_boost', HEALING:'healing',
};
const ELEMENTS = {
  base: {
    Fire: {
      dice:['d4','d4'],
      color:'#ff6b00',
      icon:'🔥',
      description:'Roll 2×d4. Die 1 = pulse count. Die 2 = dmg per pulse ×20. Cost: 3 Energy fixed.',
      isFire: true,
      base:{name:'Ember Strike',desc:'pulses × dmg × 20',damage:0},
      thresholds:[],
      tierFormula:()=>0,
      accuracyApplies:true,
      COST: 3,
    },
    Water: {
      dice:['d20'],
      color:'#4aafee',
      icon:'🌊',
      description:'Roll d20. Dual-aspect matrix sets damage (50/80/120) and AoE (single/cross/spread). Range: 2 tiles forward. Cost scales 2/6/10 by AoE.',
      isWater: true,
      base:{name:'Torrent',desc:'d20 dual-aspect: damage × AoE',damage:0},
      thresholds:[],
      tierFormula:()=>0,
      accuracyApplies:true,
    },
    Earth: {
      dice:['d6'],
      color:'#c49a52',
      icon:'🪨',
      description:'Roll d6. Damage = roll×20. Range = floor(roll/2) tiles forward. Choose range 1–max. Cost: 1 (die) + chosen tiles.',
      isEarth: true,
      base:{name:'Tremor',desc:'roll×20 dmg, range floor(roll/2)',damage:0},
      thresholds:[],
      tierFormula:()=>0,
      accuracyApplies:true,
      COST_BASE: 1,
    },
    Air: {
      dice:['d8'],
      color:'#80d4f8',
      icon:'💨',
      description:'Pick range 1–8 first, then roll d8. Damage = (roll − range) × 20. Knocks back on hit. Cost: 2 Energy flat.',
      isAir: true,
      base:{name:'Gale Force',desc:'(roll − range) × 20 dmg, knockback',damage:0},
      thresholds:[],
      tierFormula:()=>0,
      accuracyApplies:true,
      COST: 2,
    },
  },
  minor: {
    Lightning: { dice:['d8','d4'], color:'#ffd54f', icon:'⚡', description:'Fire + Air. Roll d8+d4. High sums chain damage and stun.',
      base:{name:'Static Spark',desc:'Base - 30 dmg',damage:30},
      thresholds:[{value:7,name:'Shock',desc:'90 dmg + stun',damage:90},{value:10,name:'Lightning Strike',desc:'150 dmg',damage:150},{value:12,name:'Thunderclap',desc:'180 dmg area stun',damage:180}],
      tierFormula:(sum,t)=>Math.floor((sum-t)/2)+1, accuracyApplies:true },
    Plant: { dice:['d6','d20'], color:'#66bb6a', icon:'🌿', description:'Water + Earth. Roll d6+d20. Vines, shields, and area thorns.',
      base:{name:'Sprout',desc:'Base - 30 dmg',damage:30},
      thresholds:[{value:14,name:'Vine Whip',desc:'90 dmg',damage:90},{value:18,name:'Growth Shield',desc:'120 dmg',damage:120},{value:22,name:'Thorn Burst',desc:'180 dmg area',damage:180}],
      tierFormula:(sum,t)=>Math.floor((sum-t)/2)+1, accuracyApplies:true },
    Sand: { dice:['d6','d8'], color:'#e8c97a', icon:'🏜', description:'Earth + Air. Roll d6+d8. Push and blind with abrasive force.',
      base:{name:'Dust Puff',desc:'Base - 20 dmg',damage:20},
      thresholds:[{value:7,name:'Sand Blast',desc:'60 dmg + blind',damage:60},{value:10,name:'Dune Surge',desc:'90 dmg + push',damage:90},{value:14,name:'Sandstorm',desc:'120 dmg area',damage:120}],
      tierFormula:(sum,t)=>Math.floor((sum-t)/2)+1, accuracyApplies:true },
    Mist: { dice:['d4','d20'], color:'#b0c4de', icon:'🌫', description:'Water + Air. Roll d4+d20. Evasion and debuff at low cost.',
      base:{name:'Vapor Touch',desc:'Base - 20 dmg',damage:20},
      thresholds:[{value:12,name:'Fog Veil',desc:'50 dmg + slow',damage:50,slow:true},{value:17,name:'Mist Step',desc:'80 dmg + evade',damage:80},{value:22,name:'Phantom Shroud',desc:'110 dmg + blind',damage:110}],
      tierFormula:(sum,t)=>Math.floor((sum-t)/2)+1, accuracyApplies:true },
    Cloud: { dice:['d8','d4'], color:'#cfd8dc', icon:'☁', description:'Air + Water. Roll d8+d4. Soft area damage with a heal option.',
      base:{name:'Overcast',desc:'Base - 20 dmg',damage:20},
      thresholds:[{value:7,name:'Rain Burst',desc:'60 dmg area',damage:60},{value:10,name:'Cumulonimbus',desc:'90 dmg + 30 heal',damage:90,heal:30},{value:12,name:'Downpour',desc:'120 dmg area',damage:120}],
      tierFormula:(sum,t)=>Math.floor((sum-t)/2)+1, accuracyApplies:true },
    Magma: { dice:['d4','d6'], color:'#ff4500', icon:'🌋', description:'Fire + Earth. Roll d4+d6. Burn stacks and heavy delayed damage.',
      base:{name:'Lava Drip',desc:'Base - 30 dmg',damage:30},
      thresholds:[{value:5,name:'Magma Splash',desc:'60 dmg + burn',damage:60},{value:7,name:'Eruption',desc:'100 dmg area',damage:100},{value:10,name:'Caldera',desc:'150 dmg area burn',damage:150}],
      tierFormula:(sum,t)=>Math.floor((sum-t)/2)+1, accuracyApplies:true },
  },
  major: {
    Ice: { dice:['d6','d8'], color:'#a0e4ff', icon:'❄', description:'Water + Air major. Roll d6+d8. Freeze and slow. High control.',
      base:{name:'Ice Chip',desc:'Base - 30 dmg',damage:30},
      thresholds:[{value:7,name:'Frost Bite',desc:'60 dmg + slow',damage:60,slow:true},{value:10,name:'Ice Lance',desc:'90 dmg + freeze',damage:90,freeze:true},{value:14,name:'Glacial Burst',desc:'130 dmg area',damage:130},{value:16,name:'Permafrost',desc:'180 dmg + full freeze',damage:180,freeze:true}],
      tierFormula:(sum,t)=>Math.floor((sum-t)/2)+1, accuracyApplies:true },
    Metal: { dice:['d6','d6'], color:'#b0bec5', icon:'⚙', description:'Earth + Fire major. Roll 2d6. Armor shred and consistent high damage.',
      base:{name:'Iron Strike',desc:'Base - 40 dmg',damage:40},
      thresholds:[{value:5,name:'Steel Slam',desc:'80 dmg + shred',damage:80},{value:8,name:'Forge Blow',desc:'130 dmg',damage:130},{value:11,name:'Alloy Crush',desc:'180 dmg area',damage:180},{value:12,name:'Titan Smash',desc:'220 dmg',damage:220}],
      tierFormula:(sum,t)=>Math.floor((sum-t)/2)+1, accuracyApplies:true },
    Glass: { dice:['d4','d8','d4'], color:'#e0f7fa', icon:'🔮', description:'Fire + Earth + Air major. Roll d4+d8+d4. Fragile but explosive spike damage.',
      base:{name:'Shard Flick',desc:'Base - 30 dmg',damage:30},
      thresholds:[{value:9,name:'Glass Burst',desc:'90 dmg area',damage:90},{value:12,name:'Prism Shot',desc:'150 dmg',damage:150},{value:16,name:'Shatter',desc:'220 dmg area',damage:220}],
      tierFormula:(sum,t)=>Math.floor((sum-t)/2)+1, accuracyApplies:true },
    Storm: { dice:['d8','d20'], color:'#7e57c2', icon:'🌩', description:'Air + Water + Fire major. Roll d8+d20. Massive area devastation.',
      base:{name:'Gale Spark',desc:'Base - 40 dmg',damage:40},
      thresholds:[{value:14,name:'Squall',desc:'100 dmg area',damage:100},{value:18,name:'Tempest',desc:'160 dmg area',damage:160},{value:22,name:'Hurricane',desc:'220 dmg area',damage:220},{value:28,name:'Maelstrom',desc:'300 dmg area',damage:300}],
      tierFormula:(sum,t)=>Math.floor((sum-t)/2)+1, accuracyApplies:true },
  },
};
const getXPThreshold = (level) => Math.floor(1000 * Math.pow(level, 1.5));
// Per-die damage multiplier for Fire / Earth / Air base skills (v4.3: 10 -> 20).
// Raises skill output so a skill reliably out-damages an equivalent melee stack.
// Water uses its own fixed tiers in resolveTorrent instead.
const SKILL_DICE_MULT = 20;
const rollDie = (sides) => Math.floor(Math.random() * sides) + 1;
const rollD100Accuracy = () => Math.floor(Math.random() * 91) + 10;
const rollD100 = () => Math.floor(Math.random() * 100) + 1;
// Accuracy bracket (v4.3): a d100 accuracy roll maps to a damage multiplier in
// three tiers rather than scaling continuously. This removes the "roll high then
// whiff accuracy" gut-punch — clearing 79 gives full damage, and even a poor
// roll floors at quarter rather than as low as 10%.
//   roll >= 79  -> full damage
//   40..78      -> half  (rounded down)
//   < 40        -> quarter (rounded down)
// Applies to both player and enemy (all damage routes through here).
const ACCURACY_FULL = 79, ACCURACY_HALF = 40;
const applyAccuracy = (base, roll) => {
  if(roll >= ACCURACY_FULL) return base;
  if(roll >= ACCURACY_HALF) return Math.floor(base * 0.5);
  return Math.floor(base * 0.25);
};
// Label for a given accuracy roll's tier (for combat-log clarity).
const accuracyTierLabel = (roll) => roll>=ACCURACY_FULL ? 'full' : roll>=ACCURACY_HALF ? 'half' : 'quarter';
const rollD12Energy = () => rollDie(12);

const getSkillCost = (category, elementName) => {
  const el = ELEMENTS[category]?.[elementName];
  if(el?.isEarth) return 2; // minimum: 1 die + 1 tile
  if(el?.isWater) return TORRENT_AOE_COST.single; // minimum: cheapest AoE tier (2)
  return el?.COST ?? 1;
};

const rollBackRowPosition = (row) => {
  const roll = Math.floor(Math.random() * 10);
  const col = roll === 0 ? 4 : roll - 1;
  return { x: col, y: row, placementRoll: roll };
};

const getRandomFreePosition = (occupied) => {
  let x, y;
  do { x = Math.floor(Math.random()*SIZE); y = Math.floor(Math.random()*SIZE); }
  while (occupied.some(p => p.x===x && p.y===y));
  return {x,y};
};

const getMoveToward = (fx,fy,tx,ty) => {
  const moves=[]; const dx=tx-fx; const dy=ty-fy;
  if(Math.abs(dx)>Math.abs(dy)){
    if(dx>0)moves.push({x:fx+1,y:fy}); if(dx<0)moves.push({x:fx-1,y:fy});
    if(dy>0)moves.push({x:fx,y:fy+1}); if(dy<0)moves.push({x:fx,y:fy-1});
  } else {
    if(dy>0)moves.push({x:fx,y:fy+1}); if(dy<0)moves.push({x:fx,y:fy-1});
    if(dx>0)moves.push({x:fx+1,y:fy}); if(dx<0)moves.push({x:fx-1,y:fy});
  }
  return moves;
};

const isAdjacent = (a,b) => { const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y); return (dx===1&&dy===0)||(dx===0&&dy===1); };
// 8-directional adjacency (orthogonal + diagonal) — used by Compass Slash.
const isAdjacent8 = (a,b) => { const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y); return dx<=1&&dy<=1&&(dx+dy)>0; };
const facingFromMove = (o,n) => { const dx=n.x-o.x,dy=n.y-o.y; if(dx>0)return'right';if(dx<0)return'left';if(dy>0)return'down';if(dy<0)return'up';return'down'; };
// Facing from one tile toward another (used to rotate a unit to face its melee
// target). Picks the dominant axis when the target isn't orthogonally aligned.
const facingToward = (from,to) => {
  const dx=to.x-from.x, dy=to.y-from.y;
  if(Math.abs(dx)>=Math.abs(dy)) return dx>0?'right':dx<0?'left':(dy>0?'down':'up');
  return dy>0?'down':'up';
};
const facingArrow = (f) => ({up:'↑',down:'↓',left:'←',right:'→'}[f]??'○');

// Returns array of tiles in a straight line forward from pos for `count` steps.
// Clips to grid bounds. Used for Earth Tremor range calculation.
const getForwardTiles = (pos, facing, count) => {
  const dir = {up:{dx:0,dy:-1},down:{dx:0,dy:1},left:{dx:-1,dy:0},right:{dx:1,dy:0}}[facing]||{dx:0,dy:1};
  const tiles = [];
  for(let i=1;i<=count;i++){
    const x=pos.x+dir.dx*i, y=pos.y+dir.dy*i;
    if(x>=0&&x<SIZE&&y>=0&&y<SIZE) tiles.push({x,y});
  }
  return tiles;
};

// Returns the tile directly behind `targetPos` away from `attackerFacing`,
// or null if out of bounds. Used for Air Gale Force knockback.
const getKnockbackPos = (targetPos, attackerFacing) => {
  const dir = {up:{dx:0,dy:-1},down:{dx:0,dy:1},left:{dx:-1,dy:0},right:{dx:1,dy:0}}[attackerFacing]||{dx:0,dy:1};
  const x = targetPos.x + dir.dx;
  const y = targetPos.y + dir.dy;
  if(x<0||x>=SIZE||y<0||y>=SIZE) return null;
  return {x,y};
};
// ─── WATER TORRENT ─────────────────────────────────────────────────────────────
// Torrent is Water (and Water-fusion) specific: a single d20 controls BOTH the
// damage tier and the AoE tier via this locked matrix.
//   Damage tiers: 50 / 80 / 120
//   AoE tiers:    single / cross (5) / spread (9, 3x3)
//   Cost scales by AoE: single 2, cross 6, spread 10.
// Anchor is fixed 2 tiles forward along facing. Any enemy inside the resulting
// footprint takes the full center-tile damage.
const TORRENT_RANGE = 2;
const TORRENT_AOE_COST = { single:2, cross:6, spread:10 };

// Maps a d20 roll to {damage, aoe} per the locked matrix.
const resolveTorrent = (roll) => {
  // Single band: 1-7  (50/80/120 at 1-3/4-6/7)
  if(roll<=3)  return {damage:50, aoe:'single'};
  if(roll<=6)  return {damage:80, aoe:'single'};
  if(roll===7) return {damage:120,aoe:'single'};
  // Cross band: 8-14 (50/80/120 at 8-10/11-13/14)
  if(roll<=10) return {damage:50, aoe:'cross'};
  if(roll<=13) return {damage:80, aoe:'cross'};
  if(roll===14)return {damage:120,aoe:'cross'};
  // Spread band: 15-20 (50/80/120 at 15-16/17-19/20)
  if(roll<=16) return {damage:50, aoe:'spread'};
  if(roll<=19) return {damage:80, aoe:'spread'};
  return {damage:120, aoe:'spread'}; // 20
};

const AOE_LABEL = { single:'Single tile', cross:'Cross (5)', spread:'Spread (3×3)' };

// AoE tiers in ascending order/cost. A roll unlocks every tier up to and
// including the band it landed in (its "ceiling"); the player may downshift to
// any cheaper tier. Damage stays the matrix value for the rolled number
// regardless of which AoE tier is cast.
const TORRENT_AOE_ORDER = ['single','cross','spread'];

// Given a d20 roll, returns the list of AoE tiers the player may choose from,
// each tagged with its cost and whether the player can currently afford it.
// `ceiling` = the AoE tier the roll's band maps to (the highest selectable).
const getTorrentOptions = (roll, availableAP) => {
  const ceiling = resolveTorrent(roll).aoe;
  const ceilingIdx = TORRENT_AOE_ORDER.indexOf(ceiling);
  return TORRENT_AOE_ORDER.slice(0, ceilingIdx+1).map(aoe => ({
    aoe,
    cost: TORRENT_AOE_COST[aoe],
    affordable: TORRENT_AOE_COST[aoe] <= availableAP,
  }));
};

// Returns the anchor tile TORRENT_RANGE tiles forward along facing, clipped to
// the grid. If the straight line runs off the board, the anchor is the last
// in-bounds tile in that direction (so the strike still lands somewhere ahead).
const getTorrentAnchor = (pos, facing) => {
  const dir = {up:{dx:0,dy:-1},down:{dx:0,dy:1},left:{dx:-1,dy:0},right:{dx:1,dy:0}}[facing]||{dx:0,dy:1};
  let ax=pos.x, ay=pos.y;
  for(let i=1;i<=TORRENT_RANGE;i++){
    const nx=pos.x+dir.dx*i, ny=pos.y+dir.dy*i;
    if(nx<0||nx>=SIZE||ny<0||ny>=SIZE) break;
    ax=nx; ay=ny;
  }
  return {x:ax,y:ay};
};

// Returns the list of tiles in the AoE footprint centered on `anchor`, clipped
// to grid bounds. single = anchor only; cross = anchor + 4 orthogonals;
// spread = full 3x3 around anchor.
const getTorrentFootprint = (anchor, aoe) => {
  const tiles=[];
  const push=(x,y)=>{ if(x>=0&&x<SIZE&&y>=0&&y<SIZE) tiles.push({x,y}); };
  if(aoe==='single'){
    push(anchor.x,anchor.y);
  } else if(aoe==='cross'){
    push(anchor.x,anchor.y);
    push(anchor.x+1,anchor.y); push(anchor.x-1,anchor.y);
    push(anchor.x,anchor.y+1); push(anchor.x,anchor.y-1);
  } else { // spread 3x3
    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++) push(anchor.x+dx,anchor.y+dy);
  }
  return tiles;
};

// Finds the healing tile on the grid, or null if none present.
const findHealingTile = (tiles) => {
  if(!tiles) return null;
  for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++){
    if(tiles[y][x]===TILE_TYPES.HEALING) return {x,y};
  }
  return null;
};

// Returns a new tiles grid with the healing tile relocated to a random free
// position (not on either unit, not overwriting a boost tile).
const relocateHealingTile = (tiles, playerPos, enemyPos, blockers=[]) => {
  const grid = tiles.map(row=>row.slice());
  // Clear any existing healing tile
  for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++){
    if(grid[y][x]===TILE_TYPES.HEALING) grid[y][x]=TILE_TYPES.NORMAL;
  }
  // Find a fresh normal tile not occupied by a unit or summon
  const occupied=[playerPos,enemyPos,...blockers];
  let pos, guard=0;
  do {
    pos=getRandomFreePosition(occupied);
    guard++;
  } while(grid[pos.y][pos.x]!==TILE_TYPES.NORMAL && guard<200);
  grid[pos.y][pos.x]=TILE_TYPES.HEALING;
  return grid;
};

const getFlankBonus = (atk,def,defFacing) => {
  const dx=atk.x-def.x, dy=atk.y-def.y;
  let back=false,flank=false;
  switch(defFacing){
    case'up':    back=dy>0;  flank=!back&&dx!==0; break;
    case'down':  back=dy<0;  flank=!back&&dx!==0; break;
    case'left':  back=dx>0;  flank=!back&&dy!==0; break;
    case'right': back=dx<0;  flank=!back&&dy!==0; break;
    default: break;
  }
  if(back)  return {bonus:10,label:'Back attack +10'};
  if(flank) return {bonus:5, label:'Flanking +5'};
  return {bonus:0,label:''};
};

// Flat damage bonus for standing on the boost tile matching the base element
// being cast (Fire/Water/Earth/Air only — fusions don't have a dedicated tile).
// Advertised on TILE_LEGEND as "+20 dmg" but previously never wired up.
const TILE_BOOST_DMG = 20;
const getTileBoost = (tiles, pos, elementName) => {
  const key = `${elementName.toLowerCase()}_boost`;
  return tiles?.[pos.y]?.[pos.x] === key ? TILE_BOOST_DMG : 0;
};

// Damage floor for Earth and Air base skills: a landed hit always deals at
// least this much, even on the worst roll + quarter accuracy. Fixes Earth's
// low output and Air's tendency to fizzle to 0 when roll <= range.
const RANGED_SKILL_MIN_DMG = 40;

// The four tiles orthogonally adjacent to `def`, each tagged with the attack
// bonus an attacker standing there would earn against the given facing, and
// whether the tile is on-grid and unoccupied. Used by smarter enemy AI to pick
// the best square to approach. `quality`: 2 = blindspot/back, 1 = flank, 0 = front.
const getAdjacentAttackTiles = (def, defFacing, blockers) => {
  const cand=[
    {x:def.x+1,y:def.y},{x:def.x-1,y:def.y},
    {x:def.x,y:def.y+1},{x:def.x,y:def.y-1},
  ];
  return cand.map(t=>{
    const inBounds=t.x>=0&&t.x<SIZE&&t.y>=0&&t.y<SIZE;
    const blocked=blockers.some(b=>b.x===t.x&&b.y===t.y);
    const fb=getFlankBonus(t,def,defFacing);
    const quality=fb.bonus>=10?2:fb.bonus>=5?1:0;
    return {...t,inBounds,blocked,quality,bonus:fb.bonus};
  });
};

// Manhattan distance helper for AI tile scoring.
const manhattan = (a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

// Picks the approach tile an enemy should head toward, given its capability
// tier. Blindspot-capable units prefer the back tile; flank-capable units prefer
// a side tile; basic units just take the closest reachable adjacent tile. Among
// equal-quality options the nearest (by current distance) wins. Returns a tile
// {x,y} or null if none are reachable/open.
const pickApproachTile = (enemyPos, def, defFacing, tier, blockers) => {
  const tiles=getAdjacentAttackTiles(def,defFacing,blockers).filter(t=>t.inBounds&&!t.blocked);
  if(tiles.length===0) return null;
  // Cap the quality the unit is "aware" of by its tier.
  const maxQuality = tier.canBlindspot ? 2 : tier.canFlank ? 1 : 0;
  const effective = tiles.map(t=>({...t,eff:Math.min(t.quality,maxQuality)}));
  const bestEff = Math.max(...effective.map(t=>t.eff));
  const pool = effective.filter(t=>t.eff===bestEff);
  pool.sort((a,b)=>manhattan(enemyPos,a)-manhattan(enemyPos,b));
  return {x:pool[0].x,y:pool[0].y,quality:pool[0].quality};
};

const makeCharacter = (name,hp,level,agi,ap,pos,element,elementCategory) => ({
  name,level,agi,health:hp,maxHealth:hp,actionpts:ap,boardPosition:pos,
  playerXp:0,facing:'down',frozen:0,slowed:false,skillUsed:false,rotateUsed:false,
  element:element||null,elementCategory:elementCategory||null,energyRollover:0,
});

// ─── SUMMONS (Summoner class) ──────────────────────────────────────────────────
// Novice summons deployed via Mastermind's Deploy mode. Provisional stats for
// v4.0; behavior is forward-only toward the enemy back row (row 0). Bug / Virus /
// Malware share Novice behavior this pass (Virus species ability + Malware
// custom behavior are staged pending species/crafting systems).
const SUMMON_HP = 100;
const SUMMON_ATK = 30;
const SUMMON_MOVE = 1;          // tiles forward per summon turn
const BANDWIDTH = 2;            // max simultaneous summons
const SUMMON_ROW = 7;          // Summoner's second row
const ENEMY_BACK_ROW = 0;      // promotion line (Novice -> Agent)

// d100 tier bands for the Mastermind summon roll.
const summonTierFromRoll = (roll) => {
  if(roll<=34) return 'Bug';
  if(roll<=67) return 'Virus';
  return 'Malware';
};
const SUMMON_TIER_META = {
  Bug:     { color:'#66dd88', icon:'🐛', band:'1–34',  blurb:'Base Novice. Forward-only; strikes the tile ahead.' },
  Virus:   { color:'#cc66ee', icon:'🦠', band:'35–67', blurb:'Adaptive Novice. Inherits host species ability (staged).' },
  Malware: { color:'#ff5566', icon:'💾', band:'68–100',blurb:'Custom Novice. Pre-built behavior (crafting staged).' },
};

let SUMMON_SEQ = 0;
const makeSummon = (tier, pos) => ({
  id: `S${++SUMMON_SEQ}`,
  tier,
  name: `${tier} Novice`,
  health: SUMMON_HP,
  maxHealth: SUMMON_HP,
  atk: SUMMON_ATK,
  boardPosition: pos,
  facing: 'up',          // summons march toward row 0; fixed, cannot turn
  promoted: false,       // becomes true on reaching ENEMY_BACK_ROW (Agent — staged)
});

const TILE_LEGEND = [
  {type:'fire_boost', label:'Fire: +20 dmg',  border:'#ff6b00',bg:'linear-gradient(135deg,#4a0e0e,#1a0505)'},
  {type:'water_boost',label:'Water: +20 dmg', border:'#4aafee',bg:'linear-gradient(135deg,#0d2a3d,#051420)'},
  {type:'earth_boost',label:'Earth: +20 dmg', border:'#c49a52',bg:'linear-gradient(135deg,#3d2a0d,#201405)'},
  {type:'air_boost',  label:'Air: +20 dmg',   border:'#80d4f8',bg:'linear-gradient(135deg,#1a2a3d,#0a1420)'},
  {type:'healing',    label:'Heal: +100 HP',  border:'#00ff88',bg:'linear-gradient(135deg,#0d3d0d,#052005)'},
];

const makeTiles = (playerPos,enemyPos) => {
  const grid=Array.from({length:SIZE},()=>Array(SIZE).fill(TILE_TYPES.NORMAL));
  const occupied=[playerPos,enemyPos];
  ['fire','water','earth','air'].forEach(el=>{
    for(let i=0;i<2;i++){const pos=getRandomFreePosition(occupied);grid[pos.y][pos.x]=`${el}_boost`;occupied.push(pos);}
  });
  const h=getRandomFreePosition(occupied); grid[h.y][h.x]=TILE_TYPES.HEALING;
  return grid;
};

const calcAvailableSquares = (pos,ap) => {
  const sq=[];
  for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++){
    const dist=Math.abs(x-pos.x)+Math.abs(y-pos.y);
    if(dist>0&&dist<=ap) sq.push({x,y,distance:dist});
  }
  return sq;
};

// Legal Deploy tiles: row 7, normal tile only (no boost/healing), not occupied
// by the player, enemy, or an existing summon.
const getDeployTiles = (tiles, playerPos, enemyPos, summons) => {
  const out=[];
  for(let x=0;x<SIZE;x++){
    const y=SUMMON_ROW;
    if(tiles?.[y]?.[x]!==TILE_TYPES.NORMAL) continue;
    if(playerPos.x===x&&playerPos.y===y) continue;
    if(enemyPos.x===x&&enemyPos.y===y) continue;
    if(summons.some(s=>s.boardPosition.x===x&&s.boardPosition.y===y)) continue;
    out.push({x,y});
  }
  return out;
};

const calcAbilities = (category,elementName,rolls) => {
  const el=ELEMENTS[category]?.[elementName];
  if(!el||el.isAir||el.isFire||el.isEarth||el.isWater) return [];
  const abilities=[{...el.base,tier:0,unlocked:true,isBase:true}];
  const isSingle=el.dice.length===1;
  if(isSingle){
    const roll=rolls[0].value;
    el.thresholds.forEach(t=>{ if(roll>=t.value) abilities.push({...t,tier:el.tierFormula(roll),unlocked:true,isBase:false}); });
  } else {
    const sum=rolls.reduce((a,r)=>a+r.value,0);
    el.thresholds.forEach(t=>{ if(sum>=t.value) abilities.push({...t,tier:el.tierFormula(sum,t.value),unlocked:true,isBase:false}); });
  }
  return abilities;
};

const PLAYER_HP=1000, ENEMY_HP_W1=250, ENEMY_HP_SCALE=75, MELEE_BASE=10;
const MELEE_PER_LEVEL=5; // player gains +5 melee damage per level
// Player melee base scales with level: Lv1=10, Lv2=15, Lv3=20, ...
// (Enemies use the tier system's meleeBase instead — left untouched.)
const playerMeleeBase = (level) => MELEE_BASE + (level-1)*MELEE_PER_LEVEL;

// Enemy behavior tiers are cumulative and keyed off enemy level. A unit at level
// N has every capability unlocked at or below N:
//   Lv1+  survive: attack, flee-to-heal, and save/rest (bank AP when nothing
//                  better is reachable)
//   Lv2+  flank:   route to a flanking tile for +5 rather than nearest adjacent
//   Lv3+  blindspot: prioritize the back tile for +10 when reachable
//   Lv4+  heavy:   melee base 20 instead of 10
//   Lv5,10,15,20   elemental boss (Fire/Earth/Air/Water) on top of all the above
// The level→tier mapping repeats every 5 levels, so level 6 behaves like a
// "fresh" Lv1 survivor again but with scaled HP, and 7/8/9 re-add flank/
// blindspot/heavy, with 10 the next boss.
const enemyTier = (level) => {
  const stage = ((level - 1) % 5) + 1; // 1..5 within the current block
  return {
    stage,
    canFlee:     true,           // all enemies can flee/heal-seek and save
    canSave:     true,
    canFlank:    stage >= 2,
    canBlindspot:stage >= 3,
    heavy:       stage >= 4,
    isBoss:      stage === 5,
    meleeBase:   stage >= 4 ? 20 : MELEE_BASE,
  };
};

// Boss element by block: blocks of 5 → Fire, Earth, Air, Water (then repeat).
const BOSS_ELEMENTS = ['Fire','Earth','Air','Water'];

const newHero = () => {
  const pos = rollBackRowPosition(8);
  return { ...makeCharacter('Hero', PLAYER_HP, 1, 2, 0, pos), energyRollover:0, _placementRoll:pos.placementRoll };
};

const newGoblin = (level, _playerPos) => {
  const pos = rollBackRowPosition(0);
  const hp=ENEMY_HP_W1+(level-1)*ENEMY_HP_SCALE, agi=Math.min(1+Math.floor(level/3),3);
  const tier = enemyTier(level);
  if(tier.isBoss){
    const blockIdx = Math.floor((level-1)/5);            // 0,1,2,3,...
    const el = BOSS_ELEMENTS[blockIdx % BOSS_ELEMENTS.length];
    return {...makeCharacter(`${el} Warden`,hp,level,agi,0,pos,el,'base'),energyRollover:0};
  }
  // Non-boss goblins are named by the capability they showcase.
  const tierName = tier.heavy ? 'Brute Goblin'
                 : tier.canBlindspot ? 'Stalker Goblin'
                 : tier.canFlank ? 'Skirmisher Goblin'
                 : (level===1 ? 'Goblin' : `Goblin Lv${level}`);
  return {...makeCharacter(tierName,hp,level,agi,0,pos,null,null),energyRollover:0};
};

// Available classes for the post-boss unlock modal. Summoner is the first;
// the list is structured so more classes can slot in later.
const UNLOCKABLE_CLASSES = [
  {
    id:'Summoner',
    name:'Summoner',
    icon:'🜨',
    color:'#9b6cff',
    tagline:'Mastermind — strike or deploy entities from the cyberworld.',
    blurb:'Hybrid skill chosen on activation. Direct: Compass Slash (60 dmg, any of 8 surrounding tiles). Deploy: roll a circuit sigil to call a Bug, Virus, or Malware onto your second row. Bandwidth 2.',
  },
];
// ─── UI COMPONENTS ─────────────────────────────────────────────────────────────

const StatLine = ({label,value,accent}) => (
  <div style={{display:'flex',justifyContent:'space-between',margin:'4px 0',fontSize:'13px',minWidth:0}}>
    <span style={{color:'#7a9db5',whiteSpace:'nowrap',marginRight:8}}>{label}</span>
    <span style={{color:accent||'#b0dff4',fontWeight:accent?'bold':'normal',textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{value}</span>
  </div>
);

const HealthBar = ({current,max}) => {
  const pct=Math.max(0,(current/max)*100);
  return (
    <div style={{width:'100%',height:'16px',background:'#1a1a2e',border:'1px solid #2a4a5e',borderRadius:'3px',overflow:'hidden',margin:'6px 0'}}>
      <div style={{height:'100%',width:`${pct}%`,background:`hsl(${pct*1.2},80%,45%)`,transition:'width 0.3s',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:'bold',color:'#fff',fontFamily:'monospace'}}>
        {Math.round(current)} / {max}
      </div>
    </div>
  );
};

const EnergyBar = ({current, rolled, rollover}) => {
  if(rolled === 0) return (
    <div style={{width:'100%',height:'12px',background:'#0a1218',border:'1px solid #1e3a4a',borderRadius:'2px',margin:'4px 0',position:'relative',overflow:'hidden'}}>
      {rollover>0&&(
        <div style={{position:'absolute',right:4,top:0,height:'100%',display:'flex',alignItems:'center',fontSize:'9px',color:'#ffd700',fontFamily:'monospace'}}>
          +{rollover}
        </div>
      )}
    </div>
  );
  const pct = Math.max(0, (current / rolled) * 100);
  return (
    <div style={{width:'100%',height:'12px',background:'#0a1218',border:'1px solid #1e3a4a',borderRadius:'2px',overflow:'hidden',margin:'4px 0',position:'relative'}}>
      <div style={{height:'100%',width:`${pct}%`,background:'linear-gradient(90deg,#005a6a,#00c8ff)',transition:'width 0.3s'}} />
      {rollover>0&&(
        <div style={{position:'absolute',right:4,top:0,height:'100%',display:'flex',alignItems:'center',fontSize:'9px',color:'#ffd700',fontFamily:'monospace'}}>
          +{rollover}
        </div>
      )}
    </div>
  );
};

const PanelBox = ({children,style}) => (
  <div style={{background:'rgba(10,18,28,0.92)',border:'1px solid #1e3a4a',boxShadow:'0 0 12px rgba(0,200,255,0.08)',borderRadius:'6px',padding:'12px',minWidth:0,...style}}>
    {children}
  </div>
);

const PanelTitle = ({children,icon}) => (
  <div style={{fontSize:'0.75rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#00c8ff',borderBottom:'1px solid #1e3a4a',paddingBottom:'6px',marginBottom:'10px',display:'flex',alignItems:'center',gap:'6px'}}>
    {icon&&<span>{icon}</span>}{children}
  </div>
);

// Post-boss class unlock modal — first gated-content test. Presents available
// classes; selection persists on the Proxy.
const ClassUnlockModal = ({show, onSelect, onClose}) => {
  if(!show) return null;
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:4000}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#080e14',border:'2px solid #9b6cff',borderRadius:12,padding:'1.6rem',maxWidth:460,width:'92%',maxHeight:'85vh',overflowY:'auto',color:'#b0dff4',boxShadow:'0 0 50px rgba(155,108,255,0.4)'}}>
        <div style={{textAlign:'center',marginBottom:18}}>
          <div style={{fontSize:'11px',letterSpacing:'0.2em',textTransform:'uppercase',color:'#9b6cff'}}>// Boss Defeated — Class Unlocked</div>
          <h2 style={{fontSize:'1.3rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'#b08cff',marginTop:6}}>Choose Your Path</h2>
          <div style={{fontSize:'11px',color:'#5a7a8a',marginTop:4}}>Select a class to equip on your Proxy. This persists for the run.</div>
        </div>
        {UNLOCKABLE_CLASSES.map(c=>(
          <div key={c.id} onClick={()=>onSelect(c.id)}
            style={{background:'#0a1218',border:`1px solid ${c.color}66`,borderRadius:8,padding:'14px 16px',marginBottom:10,cursor:'pointer',transition:'border-color 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=c.color}
            onMouseLeave={e=>e.currentTarget.style.borderColor=`${c.color}66`}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
              <span style={{fontSize:'22px'}}>{c.icon}</span>
              <div>
                <div style={{fontSize:'15px',fontWeight:'bold',color:c.color}}>{c.name}</div>
                <div style={{fontSize:'11px',color:'#7a9db5'}}>{c.tagline}</div>
              </div>
            </div>
            <div style={{fontSize:'11px',color:'#8ab5cc',lineHeight:1.5}}>{c.blurb}</div>
          </div>
        ))}
        <button onClick={onClose}
          style={{width:'100%',marginTop:6,padding:9,background:'transparent',color:'#5a7a8a',border:'1px solid #1e3a4a',borderRadius:6,cursor:'pointer',fontSize:12,letterSpacing:'0.05em'}}>
          Decide later
        </button>
      </div>
    </div>
  );
};

// Mastermind mode picker — appears when the Summoner activates Mastermind.
// Forks into Direct (Compass Slash) or Deploy (Circuit Sigil).
const MastermindModeModal = ({show, canDeploy, deployReason, onPickDirect, onPickDeploy, onClose}) => {
  if(!show) return null;
  const purple='#9b6cff';
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2500}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#080e14',border:`2px solid ${purple}`,borderRadius:10,padding:'1.4rem',maxWidth:420,width:'92%',maxHeight:'85vh',overflowY:'auto',color:'#b0dff4',boxShadow:`0 0 40px ${purple}44`}}>
        <div style={{textAlign:'center',marginBottom:16}}>
          <span style={{fontSize:24}}>🜨</span>
          <h2 style={{fontSize:'1.1rem',letterSpacing:'0.12em',textTransform:'uppercase',color:purple,marginTop:4}}>Mastermind</h2>
          <div style={{fontSize:'11px',color:'#5a7a8a',marginTop:2}}>Choose a mode — costs 2 Energy, one activation this turn.</div>
        </div>
        <div onClick={onPickDirect}
          style={{background:'#0a1218',border:`1px solid ${purple}66`,borderRadius:8,padding:'13px 15px',marginBottom:10,cursor:'pointer'}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=purple}
          onMouseLeave={e=>e.currentTarget.style.borderColor=`${purple}66`}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:'14px',fontWeight:'bold',color:'#c9b3ff'}}>⚔ Direct — Compass Slash</span>
            <span style={{fontSize:'12px',color:purple,fontWeight:'bold'}}>60 dmg</span>
          </div>
          <div style={{fontSize:'11px',color:'#8ab5cc',marginTop:4}}>Strike any one of the 8 surrounding tiles. Enemy must occupy the tile.</div>
        </div>
        <div onClick={canDeploy?onPickDeploy:undefined}
          style={{background:'#0a1218',border:`1px solid ${canDeploy?`${purple}66`:'#1e3a4a'}`,borderRadius:8,padding:'13px 15px',cursor:canDeploy?'pointer':'not-allowed',opacity:canDeploy?1:0.55}}
          onMouseEnter={e=>{if(canDeploy)e.currentTarget.style.borderColor=purple;}}
          onMouseLeave={e=>{if(canDeploy)e.currentTarget.style.borderColor=`${purple}66`;}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:'14px',fontWeight:'bold',color:canDeploy?'#c9b3ff':'#3a5a6a'}}>◈ Deploy — Circuit Sigil</span>
            <span style={{fontSize:'12px',color:canDeploy?purple:'#3a5a6a',fontWeight:'bold'}}>d100 tier</span>
          </div>
          <div style={{fontSize:'11px',color:canDeploy?'#8ab5cc':'#5a7a8a',marginTop:4}}>
            {canDeploy
              ? 'Roll to call a Bug / Virus / Malware onto your second row, then place it.'
              : `Unavailable — ${deployReason}`}
          </div>
        </div>
        <button onClick={onClose}
          style={{width:'100%',marginTop:12,padding:8,background:'transparent',color:'#3a5a6a',border:'1px solid #1e3a4a',borderRadius:5,cursor:'pointer',fontSize:12}}>
          Cancel
        </button>
      </div>
    </div>
  );
};

// Deploy roll modal — rolls the d100 sigil, reveals the tier, then prompts the
// player to pick a legal row-7 tile (handled on the grid).
const DeployRollModal = ({show, rolling, roll, tier, awaitingPlacement, onRoll, onClose}) => {
  if(!show) return null;
  const purple='#9b6cff';
  const meta = tier ? SUMMON_TIER_META[tier] : null;
  return (
    <div onClick={awaitingPlacement?undefined:onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2500}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#080e14',border:`2px solid ${meta?meta.color:purple}`,borderRadius:10,padding:'1.4rem',maxWidth:400,width:'92%',maxHeight:'85vh',overflowY:'auto',color:'#b0dff4',boxShadow:`0 0 40px ${(meta?meta.color:purple)}44`}}>
        <div style={{textAlign:'center',marginBottom:16}}>
          <span style={{fontSize:24}}>◈</span>
          <h2 style={{fontSize:'1.05rem',letterSpacing:'0.12em',textTransform:'uppercase',color:purple,marginTop:4}}>Circuit Sigil</h2>
          <div style={{fontSize:'11px',color:'#5a7a8a',marginTop:2}}>d100 selects the summon tier.</div>
        </div>
        <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
          <DiceDisplay type="d100" value={roll!==null?roll:'--'} rolling={rolling} color={meta?meta.color:purple} label="Sigil Roll" />
        </div>
        {tier&&!rolling&&(
          <div style={{background:'#0a1218',border:`1px solid ${meta.color}55`,borderRadius:8,padding:'12px 14px',marginBottom:14,textAlign:'center'}}>
            <div style={{fontSize:'22px'}}>{meta.icon}</div>
            <div style={{fontSize:'15px',fontWeight:'bold',color:meta.color,marginTop:2}}>{tier} Novice</div>
            <div style={{fontSize:'10px',color:'#5a7a8a',fontFamily:'monospace'}}>roll band {meta.band}</div>
            <div style={{fontSize:'11px',color:'#8ab5cc',marginTop:6,lineHeight:1.4}}>{meta.blurb}</div>
            <div style={{fontSize:'11px',color:'#7a9db5',marginTop:8,borderTop:'1px solid #1e3a4a',paddingTop:8}}>
              HP {SUMMON_HP} · ATK {SUMMON_ATK} · moves {SUMMON_MOVE} forward/turn
            </div>
          </div>
        )}
        {awaitingPlacement
          ? <div style={{textAlign:'center',fontSize:'12px',color:meta.color,padding:'8px 0',animation:'pulseGold 1.2s infinite'}}>
              ▸ Pick a highlighted tile on row 7 to deploy
            </div>
          : roll===null
            ? <button onClick={onRoll} disabled={rolling}
                style={{width:'100%',padding:14,background:`${purple}22`,color:purple,border:`1px solid ${purple}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:rolling?'not-allowed':'pointer',letterSpacing:'0.1em'}}>
                {rolling?'Rolling...':'Roll Sigil (d100)'}
              </button>
            : null}
        {!awaitingPlacement&&(
          <button onClick={onClose}
            style={{width:'100%',marginTop:12,padding:8,background:'transparent',color:'#3a5a6a',border:'1px solid #1e3a4a',borderRadius:5,cursor:'pointer',fontSize:12}}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
const ElementPickerModal = ({selectedCategory,selectedElement,onSelect,onClose}) => {
  const allEl={...ELEMENTS.base,...ELEMENTS.minor,...ELEMENTS.major};
  const elData=allEl[selectedElement];
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:3000}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#080e14',border:`2px solid ${elData&&elData.color||'#00c8ff'}`,borderRadius:10,padding:'1.2rem',width:340,maxHeight:'85vh',overflowY:'auto',boxShadow:`0 0 30px ${elData&&elData.color||'#00c8ff'}44`,color:'#b0dff4'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px',borderBottom:'1px solid #1e3a4a',paddingBottom:'10px'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <span style={{fontSize:'20px'}}>{elData&&elData.icon}</span>
            <div>
              <div style={{fontSize:'13px',fontWeight:'bold',color:elData&&elData.color||'#b0dff4'}}>{selectedElement}</div>
              <div style={{fontSize:'10px',color:'#5a7a8a'}}>{elData&&elData.description}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#3a6a8a',cursor:'pointer',fontSize:'16px'}}>X</button>
        </div>
        {[['base','Base'],['minor','Minor Fusion'],['major','Major Fusion']].map(([cat,label])=>(
          <div key={cat} style={{marginBottom:'10px'}}>
            <div style={{fontSize:'10px',color:'#3a5a6a',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'6px'}}>{label}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:'5px'}}>
              {Object.entries(ELEMENTS[cat]).map(([el,data])=>(
                <button key={el} onClick={()=>{onSelect(cat,el);onClose();}}
                  style={{padding:'5px 10px',fontSize:'12px',cursor:'pointer',borderRadius:'4px',border:`1px solid ${selectedElement===el?data.color:'#1e3a4a'}`,background:selectedElement===el?`${data.color}22`:'transparent',color:selectedElement===el?data.color:'#5a7a8a',transition:'all 0.15s',display:'flex',alignItems:'center',gap:'5px'}}>
                  <span>{data.icon}</span>{el}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PlayerStatsPanel = ({player,playerRolledEnergy,selectedCategory,selectedElement,onElementSelect,canAttack,canSkill,onMelee,onSkill,onEndTurn,onRollEnergy,energyPhase,onSurrender,enemy,enemyRolledEnergy,isPlayerTurn,playerClass,summons,canMastermind,onMastermind,canRotate,onRotate}) => {
  const [showPicker,setShowPicker]=useState(false);
  const allEl={...ELEMENTS.base,...ELEMENTS.minor,...ELEMENTS.major};
  const elData=allEl[selectedElement];
  const enemyElData=enemy.element?ELEMENTS[enemy.elementCategory]&&ELEMENTS[enemy.elementCategory][enemy.element]:null;
  const showRollBtn = isPlayerTurn && energyPhase==='roll';
  const showActions = isPlayerTurn && energyPhase==='act';
  const skillCost = getSkillCost(selectedCategory, selectedElement);
  const classMeta = playerClass ? UNLOCKABLE_CLASSES.find(c=>c.id===playerClass) : null;
  const hasSummoner = playerClass==='Summoner';
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0,height:'100%'}}>
        {/* Scrollable body — stats columns live here so they can never push the
            panel (or the row) taller than the grid. Action buttons stay pinned
            below, outside the scroll region. */}
        <div style={{flex:1,minHeight:0,overflowY:'auto',display:'flex',gap:'12px',paddingRight:'2px'}}>
          <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #1e3a4a',paddingBottom:'6px',marginBottom:'10px',gap:6}}>
              <div style={{fontSize:'0.75rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#00c8ff',display:'flex',alignItems:'center',gap:'5px',whiteSpace:'nowrap'}}><span>o</span>Proxy</div>
              <button onClick={()=>setShowPicker(true)}
                style={{display:'flex',alignItems:'center',gap:'4px',background:`${elData&&elData.color||'#00c8ff'}11`,border:`1px solid ${elData&&elData.color||'#00c8ff'}55`,borderRadius:'4px',padding:'2px 7px',cursor:'pointer',transition:'all 0.15s',minWidth:0}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=elData&&elData.color||'#00c8ff'}
                onMouseLeave={e=>e.currentTarget.style.borderColor=`${elData&&elData.color||'#00c8ff'}55`}>
                <span style={{fontSize:'12px'}}>{elData&&elData.icon}</span>
                <span style={{fontSize:'11px',fontWeight:'bold',color:elData&&elData.color||'#b0dff4',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selectedElement}</span>
                <span style={{fontSize:'9px',color:'#3a6a8a'}}>v</span>
              </button>
            </div>
            {classMeta&&(
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:`${classMeta.color}11`,border:`1px solid ${classMeta.color}44`,borderRadius:4,padding:'3px 8px',marginBottom:8,gap:6}}>
                <span style={{display:'flex',alignItems:'center',gap:5,fontSize:'11px',color:classMeta.color,fontWeight:'bold',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  <span>{classMeta.icon}</span>{classMeta.name}
                </span>
                {hasSummoner&&<span style={{fontSize:'10px',color:'#8ab5cc',fontFamily:'monospace',whiteSpace:'nowrap'}}>Bandwidth {summons.length}/{BANDWIDTH}</span>}
              </div>
            )}
            <StatLine
              label="Energy"
              value={playerRolledEnergy===0 ? (isPlayerTurn ? 'awaiting roll' : '-') : `${player.actionpts} / ${playerRolledEnergy}${player.energyRollover>0?` (+${player.energyRollover})`:''}`}
              accent={playerRolledEnergy===0?(isPlayerTurn?'#ffd700':'#3a5a6a'):player.actionpts>0?'#00ff88':'#ff4444'}
            />
            <EnergyBar current={player.actionpts} rolled={playerRolledEnergy} rollover={player.energyRollover} />
            {player.frozen>0&&<StatLine label="Freeze" value={`-${player.frozen} Energy next round`} accent="#a0e4ff" />}
            {hasSummoner&&summons.length>0&&(
              <div style={{marginTop:6,borderTop:'1px solid #1e3a4a',paddingTop:6}}>
                <div style={{fontSize:'9px',color:'#3a6a8a',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4}}>Active Summons</div>
                {summons.map(s=>{
                  const m=SUMMON_TIER_META[s.tier];
                  return (
                    <div key={s.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'10px',marginBottom:2,gap:6}}>
                      <span style={{display:'flex',alignItems:'center',gap:4,color:m.color,whiteSpace:'nowrap'}}><span>{m.icon}</span>{s.tier}</span>
                      <span style={{color:'#7a9db5',fontFamily:'monospace',whiteSpace:'nowrap'}}>{s.health}/{s.maxHealth} · ({s.boardPosition.x},{s.boardPosition.y})</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{width:1,background:'#1e3a4a',flexShrink:0,alignSelf:'stretch'}} />
          <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #3a1a1a',paddingBottom:'6px',marginBottom:'10px',gap:6,flexWrap:'wrap'}}>
              <div style={{fontSize:'0.75rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#cc4422',display:'flex',alignItems:'center',gap:'5px',whiteSpace:'nowrap'}}><span>*</span>Enemy</div>
              {enemyElData&&<span style={{display:'flex',alignItems:'center',gap:'3px',background:`${enemyElData.color}18`,border:`1px solid ${enemyElData.color}55`,borderRadius:'4px',padding:'1px 6px',fontSize:'11px',color:enemyElData.color,fontWeight:'bold',whiteSpace:'nowrap'}}><span>{enemyElData.icon}</span>{enemy.element}</span>}
              <span style={{fontSize:'11px',color:'#b0dff4',fontWeight:'bold',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>{enemy.name}</span>
              <span style={{fontSize:'11px',color:'#7a9db5',whiteSpace:'nowrap'}}>Lv<span style={{color:'#b0dff4',fontWeight:'bold',marginLeft:2}}>{enemy.level}</span></span>
            </div>
            <StatLine label="HP" value={`${enemy.health} / ${enemy.maxHealth}`} />
            <HealthBar current={enemy.health} max={enemy.maxHealth} />
            <StatLine
              label="Energy"
              value={enemyRolledEnergy===0 ? '-' : `${enemy.actionpts} / ${enemyRolledEnergy}${enemy.energyRollover>0?` (+${enemy.energyRollover})`:''}`}
              accent={enemy.actionpts>0?'#ff6644':'#555'}
            />
            <EnergyBar current={enemy.actionpts} rolled={enemyRolledEnergy} rollover={enemy.energyRollover} />
            {enemy.frozen>0&&<StatLine label="Freeze" value={`-${enemy.frozen} Energy next round`} accent="#a0e4ff" />}
            {enemy.element&&<StatLine label="Skill" value={enemy.skillUsed?'used':'ready'} accent={enemy.skillUsed?'#3a6a8a':'#00cc66'} />}
          </div>
        </div>
        <div style={{height:1,background:'#1e3a4a',margin:'10px 0',flexShrink:0}} />
        <div style={{display:'flex',gap:'6px',flexShrink:0}}>
          {showRollBtn ? (
            <>
              <button onClick={onRollEnergy}
                style={{flex:2,padding:'9px 6px',background:'rgba(255,215,0,0.15)',border:'1px solid #ffd700',borderRadius:'4px',color:'#ffd700',fontSize:'13px',fontWeight:700,cursor:'pointer',letterSpacing:'.06em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s',animation:'pulseGold 1.2s infinite'}}>
                ROLL ENERGY
                <div style={{fontSize:'9px',opacity:0.75,marginTop:1}}>d12{player.energyRollover>0?` + ${player.energyRollover} rollover`:''}</div>
              </button>
              <button onClick={onSurrender}
                style={{flex:1,padding:'9px 6px',background:'transparent',border:'1px solid #1e3a4a',borderRadius:'4px',color:'#3a6a8a',fontSize:'12px',fontWeight:600,cursor:'pointer',letterSpacing:'.05em',fontFamily:"'Rajdhani',sans-serif"}}>
                QUIT
              </button>
            </>
          ) : showActions ? (
            <>
              <button onClick={onMelee} disabled={!canAttack}
                style={{flex:1,padding:'7px 4px',background:canAttack?'rgba(255,180,0,0.12)':'rgba(20,30,40,0.6)',border:`1px solid ${canAttack?'#cc9900':'#1e3a4a'}`,borderRadius:'4px',color:canAttack?'#ffd700':'#2a4a5e',fontSize:'11px',fontWeight:600,cursor:canAttack?'pointer':'not-allowed',letterSpacing:'.04em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                MELEE<div style={{fontSize:'8px',opacity:0.7}}>{playerMeleeBase(player.level)} · 1E</div>
              </button>
              <button onClick={onSkill} disabled={!canSkill}
                style={{flex:hasSummoner?1:1.2,padding:'7px 4px',background:canSkill?'rgba(200,60,0,0.2)':'rgba(20,30,40,0.6)',border:`1px solid ${canSkill?'#cc3300':'#1e3a4a'}`,borderRadius:'4px',color:canSkill?'#ff6644':'#2a4a5e',fontSize:'11px',fontWeight:600,cursor:canSkill?'pointer':'not-allowed',letterSpacing:'.04em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                SKILL<div style={{fontSize:'8px',opacity:0.7}}>{player.skillUsed?'used':`${selectedElement.slice(0,4)}·${skillCost}E`}</div>
              </button>
              <button onClick={onRotate} disabled={!canRotate} title="Rotate facing — 0 Energy, once per turn"
                style={{flex:0.6,padding:'7px 2px',background:canRotate?'rgba(0,200,255,0.12)':'rgba(20,30,40,0.6)',border:`1px solid ${canRotate?'#0090b0':'#1e3a4a'}`,borderRadius:'4px',color:canRotate?'#00c8ff':'#2a4a5e',fontSize:'13px',fontWeight:600,cursor:canRotate?'pointer':'not-allowed',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                ⟳<div style={{fontSize:'8px',opacity:0.7}}>{player.rotateUsed?'used':'0E'}</div>
              </button>
              {hasSummoner&&(
                <button onClick={onMastermind} disabled={!canMastermind}
                  style={{flex:1.2,padding:'7px 4px',background:canMastermind?'rgba(155,108,255,0.18)':'rgba(20,30,40,0.6)',border:`1px solid ${canMastermind?'#9b6cff':'#1e3a4a'}`,borderRadius:'4px',color:canMastermind?'#b08cff':'#2a4a5e',fontSize:'11px',fontWeight:600,cursor:canMastermind?'pointer':'not-allowed',letterSpacing:'.03em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                  MASTERMIND<div style={{fontSize:'8px',opacity:0.7}}>{player.skillUsed?'used':'2E'}</div>
                </button>
              )}
              <button onClick={onEndTurn}
                style={{flex:1,padding:'7px 4px',background:'rgba(0,200,100,0.1)',border:'1px solid #1e6a3a',borderRadius:'4px',color:'#00cc66',fontSize:'11px',fontWeight:600,cursor:'pointer',letterSpacing:'.04em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                END<div style={{fontSize:'8px',opacity:0.7}}>{player.actionpts>0?`save ${player.actionpts}E`:'0E left'}</div>
              </button>
              <button onClick={onSurrender}
                style={{flex:0.7,padding:'7px 4px',background:'transparent',border:'1px solid #1e3a4a',borderRadius:'4px',color:'#3a6a8a',fontSize:'11px',fontWeight:600,cursor:'pointer',letterSpacing:'.04em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                QUIT
              </button>
            </>
          ) : (
            <button onClick={onSurrender}
              style={{flex:1,padding:'7px 6px',background:'transparent',border:'1px solid #1e3a4a',borderRadius:'4px',color:'#3a6a8a',fontSize:'12px',fontWeight:600,cursor:'pointer',letterSpacing:'.05em',fontFamily:"'Rajdhani',sans-serif"}}>
              QUIT
            </button>
          )}
        </div>
        {showPicker&&<ElementPickerModal selectedCategory={selectedCategory} selectedElement={selectedElement} onSelect={onElementSelect} onClose={()=>setShowPicker(false)} />}
    </div>
  );
};

const CombatLog = ({logs,gridHeight}) => {
  const ref=useRef(null);
  useEffect(()=>{ if(ref.current) ref.current.scrollTop=ref.current.scrollHeight; },[logs]);
  return (
    <div style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0}}>
      <PanelTitle icon="*">Combat Log</PanelTitle>
      <div ref={ref} style={{flex:1,minHeight:0,overflowY:'scroll',fontFamily:"'Share Tech Mono',monospace",fontSize:'11px',lineHeight:1.6,paddingRight:'4px',scrollbarWidth:'thin',scrollbarColor:'#1e3a4a #060c12'}}>
        {logs.map((l,i)=>{
          const isSys=l.startsWith('===');
          const isEnergy=l.includes('d12')||l.includes('Energy')||l.includes('rollover');
          const isGood=l.includes('+')||l.includes('heal')||l.includes('HP')||l.includes('Level');
          const isHit=l.includes('dmg')||l.includes('Defeat')||l.includes('DEFEAT');
          const isSummon=l.includes('Novice')||l.includes('Sigil')||l.includes('Bandwidth')||l.includes('Compass')||l.includes('Mastermind');
          return <div key={i} style={{padding:'2px 0',color:isSummon?'#b08cff':isSys?'#00c8ff':isEnergy?'#ffd700':isHit?'#ff8866':isGood?'#00cc66':'#6a9ab5',borderBottom:'1px solid rgba(30,58,74,0.3)',wordBreak:'break-word'}}>{l}</div>;
        })}
      </div>
    </div>
  );
};

const tileClassName = (t) => {
  switch(t){
    case'fire_boost': return'tile-fire'; case'water_boost':return'tile-water';
    case'earth_boost':return'tile-earth'; case'air_boost':  return'tile-air';
    case'healing':   return'tile-healing';
    default: return'';
  }
};

const Grid = ({playerPos,enemyPos,validSquares,onSquareClick,playerSelected,tiles,playerFacing,enemyFacing,aoeTiles,summons,deployTiles}) => {
  const cells=[];
  for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++){
    const isP=playerPos.x===x&&playerPos.y===y;
    const isE=enemyPos.x===x&&enemyPos.y===y;
    const summon=summons&&summons.find(s=>s.boardPosition.x===x&&s.boardPosition.y===y);
    const isA=validSquares.some(s=>s.x===x&&s.y===y);
    const isAoe=aoeTiles&&aoeTiles.some(s=>s.x===x&&s.y===y);
    const isDeploy=deployTiles&&deployTiles.some(s=>s.x===x&&s.y===y);
    const tileType=tiles&&tiles[y]&&tiles[y][x]||TILE_TYPES.NORMAL;
    let cls='square';
    let label='';
    if(isP){ cls+=' player'+(playerSelected?' playerSelected':''); label=facingArrow(playerFacing); }
    else if(isE){ cls+=' enemy'; label=facingArrow(enemyFacing); }
    else if(summon){ cls+=' summon'; label=SUMMON_TIER_META[summon.tier].icon; }
    else { if(isA) cls+=' available'; cls+=' '+tileClassName(tileType); }
    if(isAoe) cls+=' aoePreview';
    if(isDeploy) cls+=' deployTile';
    cells.push(
      <div key={`${x}-${y}`} className={cls} onClick={()=>onSquareClick(x,y)}
        onMouseEnter={e=>e.currentTarget.classList.add('hovered')}
        onMouseLeave={e=>e.currentTarget.classList.remove('hovered')}>
        {label}
      </div>
    );
  }
  return <div id="gridInstance">{cells}</div>;
};

const DiceDisplay = ({type,value,rolling,color,label}) => (
  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
    {label&&<div style={{fontSize:'9px',color:'#5a7a8a',textTransform:'uppercase',letterSpacing:'0.12em'}}>{label}</div>}
    <div style={{width:72,height:72,border:`2px solid ${color||'#00c8ff'}`,borderRadius:6,background:'#0a1218',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',animation:rolling?'diceBounce 0.4s infinite alternate':'none',boxShadow:rolling?`0 0 16px ${color||'#00c8ff'}66`:'none',transition:'box-shadow 0.2s'}}>
      <div style={{fontSize:10,color:'#5a7a8a',letterSpacing:'0.1em'}}>{type}</div>
      <div style={{fontSize:28,fontWeight:'bold',color:rolling?'#5a7a8a':(color||'#00c8ff'),fontFamily:'monospace',transition:'color 0.1s'}}>{rolling?'?':value}</div>
    </div>
  </div>
);
// Fire-specific section inside the DiceModal
const FireDiceSection = ({rolls, rolling, onRoll, phase, accuracyRoll, onRollAccuracy, onProceedToAccuracy, onApplyWithAccuracy, elColor}) => {
  const pulses   = rolls.length > 0 ? rolls[0].value : null;
  const dmgEach  = rolls.length > 1 ? rolls[1].value : null;
  const baseDmg  = pulses !== null && dmgEach !== null ? pulses * dmgEach * SKILL_DICE_MULT : null;

  return (
    <>
      <div style={{display:'flex',justifyContent:'center',gap:20,marginBottom:20}}>
        <DiceDisplay type="d4" value={pulses!==null?pulses:'--'} rolling={rolling} color={elColor} label="Pulses" />
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',fontSize:22,color:'#3a5a6a',paddingTop:20}}>x</div>
        <DiceDisplay type="d4" value={dmgEach!==null?dmgEach:'--'} rolling={rolling} color={elColor} label="Dmg / Pulse" />
      </div>

      {phase==='roll'&&(
        <>
          <button onClick={onRoll} disabled={rolling||rolls.length>0}
            style={{width:'100%',padding:14,background:rolls.length>0?'#0a1218':`${elColor}22`,color:rolls.length>0?'#3a5a6a':elColor,border:`1px solid ${rolls.length>0?'#1e3a4a':elColor}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:rolling||rolls.length>0?'not-allowed':'pointer',letterSpacing:'0.1em'}}>
            {rolling?'Rolling...':rolls.length>0?'Rolled':'Roll 2xd4'}
          </button>

          {rolls.length===2&&!rolling&&(
            <div style={{marginTop:16,background:'#0a1218',border:`1px solid ${elColor}44`,borderRadius:8,padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:'11px',color:'#5a7a8a',textTransform:'uppercase',letterSpacing:'0.1em'}}>Breakdown</span>
                <span style={{fontSize:'11px',color:'#3a6a8a',fontFamily:'monospace'}}>Cost: <span style={{color:'#ffd700'}}>3 Energy</span></span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',marginBottom:10}}>
                {Array.from({length:pulses},(_,i)=>(
                  <div key={i} style={{display:'flex',alignItems:'center',gap:4}}>
                    <div style={{width:36,height:36,borderRadius:'50%',border:`2px solid ${elColor}`,background:`${elColor}22`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:'bold',color:elColor}}>
                      {dmgEach*SKILL_DICE_MULT}
                    </div>
                    {i<pulses-1&&<span style={{fontSize:'10px',color:'#3a5a6a'}}>+</span>}
                  </div>
                ))}
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:8,fontSize:13,color:'#7a9db5'}}>
                <span style={{color:'#b0dff4',fontWeight:'bold'}}>{pulses}</span>
                <span style={{color:'#3a6a8a'}}>pulses x</span>
                <span style={{color:'#b0dff4',fontWeight:'bold'}}>{dmgEach*SKILL_DICE_MULT}</span>
                <span style={{color:'#3a6a8a'}}>=</span>
                <span style={{fontSize:18,fontWeight:'bold',color:elColor}}>{baseDmg}</span>
                <span style={{color:'#3a6a8a'}}>base dmg</span>
              </div>
              <button onClick={onProceedToAccuracy}
                style={{width:'100%',marginTop:12,padding:11,background:`${elColor}22`,color:elColor,border:`1px solid ${elColor}`,borderRadius:6,fontSize:14,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.08em'}}>
                Roll Accuracy
              </button>
            </div>
          )}
        </>
      )}

      {phase==='accuracy'&&(
        <>
          <div style={{textAlign:'center',marginBottom:14}}>
            <div style={{fontSize:13,color:'#7a9db5',marginBottom:4}}>
              Ember Strike: <span style={{color:elColor}}>{pulses} x {dmgEach*SKILL_DICE_MULT} = {baseDmg}</span> base dmg
            </div>
            <div style={{fontSize:'11px',color:'#5a7a8a'}}>Roll d100. ≥79 full · 40–78 half · under 40 quarter</div>
          </div>
          <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
            <DiceDisplay type="d100" value={accuracyRoll!==null?accuracyRoll:'--'} rolling={rolling} color="#ffd700" />
          </div>
          {accuracyRoll!==null&&!rolling&&(
            <div style={{textAlign:'center',marginBottom:14}}>
              <div style={{fontSize:22,fontWeight:'bold',color:'#ffd700'}}>{accuracyRoll}%</div>
              <div style={{fontSize:13,color:'#b0dff4',marginTop:4}}>
                {baseDmg} → <strong style={{color:elColor}}>{applyAccuracy(baseDmg,accuracyRoll)} dmg</strong> ({accuracyTierLabel(accuracyRoll)})
              </div>
            </div>
          )}
          {accuracyRoll===null
            ?<button onClick={onRollAccuracy} disabled={rolling} style={{width:'100%',padding:14,background:'#ffd70022',color:'#ffd700',border:'1px solid #ffd700',borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>Roll Accuracy (d100)</button>
            :<button onClick={()=>onApplyWithAccuracy(accuracyRoll)} style={{width:'100%',padding:14,background:`${elColor}22`,color:elColor,border:`1px solid ${elColor}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>Apply {pulses} Pulses</button>
          }
        </>
      )}
    </>
  );
};

// Earth Tremor — roll d6, choose range 1–floor(roll/2), accuracy, apply
const EarthTremorSection = ({rolls, rolling, onRoll, phase, accuracyRoll, onRollAccuracy, earthRange, onSetEarthRange, onConfirmEarthRange, onApplyWithAccuracy, elColor, playerFacing}) => {
  const dieRoll  = rolls.length > 0 ? rolls[0].value : null;
  // Always at least 1 tile of range, even on the worst roll (d6=1) — a Tremor
  // should never be an unusable wasted turn.
  const maxRange = dieRoll !== null ? Math.max(1, Math.floor(dieRoll / 2)) : 0;
  const baseDmg  = dieRoll !== null ? dieRoll * SKILL_DICE_MULT : null;
  const cost     = earthRange ? 1 + earthRange : null;

  return (
    <>
      <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
        <DiceDisplay type="d6" value={dieRoll!==null?dieRoll:'--'} rolling={rolling} color={elColor} label="Tremor Roll" />
      </div>

      {phase==='roll'&&(
        <>
          <button onClick={onRoll} disabled={rolling||rolls.length>0}
            style={{width:'100%',padding:14,background:rolls.length>0?'#0a1218':`${elColor}22`,color:rolls.length>0?'#3a5a6a':elColor,border:`1px solid ${rolls.length>0?'#1e3a4a':elColor}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:rolling||rolls.length>0?'not-allowed':'pointer',letterSpacing:'0.1em'}}>
            {rolling?'Rolling...':rolls.length>0?'Rolled':'Roll d6'}
          </button>

          {rolls.length===1&&!rolling&&(
            <div style={{marginTop:16,background:'#0a1218',border:`1px solid ${elColor}44`,borderRadius:8,padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <div>
                  <span style={{fontSize:'13px',color:'#b0dff4',fontWeight:'bold'}}>{baseDmg} dmg</span>
                  <span style={{fontSize:'11px',color:'#5a7a8a',marginLeft:8}}>per tile hit</span>
                </div>
                <span style={{fontSize:'11px',color:'#3a6a8a',fontFamily:'monospace'}}>
                  Facing: <span style={{color:elColor,textTransform:'uppercase'}}>{playerFacing}</span>
                </span>
              </div>
              <div style={{fontSize:'11px',color:'#5a7a8a',marginBottom:8}}>
                Max range: <span style={{color:elColor,fontWeight:'bold'}}>{maxRange} tile{maxRange>1?'s':''}</span> forward. Choose range (cost = 1 + tiles):
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                {Array.from({length:maxRange},(_,i)=>i+1).map(r=>(
                  <button key={r} onClick={()=>onSetEarthRange(r)}
                    style={{flex:1,padding:'8px 6px',background:earthRange===r?`${elColor}33`:'transparent',border:`1px solid ${earthRange===r?elColor:'#1e3a4a'}`,borderRadius:4,color:earthRange===r?elColor:'#5a7a8a',cursor:'pointer',fontSize:'12px',textAlign:'center',transition:'all 0.15s'}}>
                    {r} tile{r>1?'s':''}
                    <div style={{fontSize:'10px',marginTop:2,color:earthRange===r?elColor:'#3a6a8a'}}>{1+r} Energy</div>
                  </button>
                ))}
              </div>
              {earthRange&&(
                <button onClick={onConfirmEarthRange}
                  style={{width:'100%',padding:11,background:`${elColor}22`,color:elColor,border:`1px solid ${elColor}`,borderRadius:6,fontSize:14,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.08em'}}>
                  Confirm {earthRange} tile{earthRange>1?'s':''} ({cost} Energy) — Roll Accuracy
                </button>
              )}
            </div>
          )}
        </>
      )}

      {phase==='accuracy'&&(
        <>
          <div style={{textAlign:'center',marginBottom:14}}>
            <div style={{fontSize:13,color:'#7a9db5',marginBottom:4}}>
              Tremor: <span style={{color:elColor}}>{earthRange} tile{earthRange>1?'s':''} forward</span> — <span style={{color:elColor}}>{baseDmg} dmg</span> per hit
            </div>
            <div style={{fontSize:'11px',color:'#5a7a8a',marginBottom:2}}>Cost: <span style={{color:'#ffd700'}}>{cost} Energy</span></div>
            <div style={{fontSize:'11px',color:'#5a7a8a'}}>Roll d100. ≥79 full · 40–78 half · under 40 quarter · min {RANGED_SKILL_MIN_DMG} dmg on hit</div>
          </div>
          <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
            <DiceDisplay type="d100" value={accuracyRoll!==null?accuracyRoll:'--'} rolling={rolling} color="#ffd700" />
          </div>
          {accuracyRoll!==null&&!rolling&&(
            <div style={{textAlign:'center',marginBottom:14}}>
              <div style={{fontSize:22,fontWeight:'bold',color:'#ffd700'}}>{accuracyRoll}%</div>
              <div style={{fontSize:13,color:'#b0dff4',marginTop:4}}>
                {baseDmg} → <strong style={{color:elColor}}>{Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(baseDmg,accuracyRoll))} dmg</strong> ({accuracyTierLabel(accuracyRoll)})
                <span style={{fontSize:'11px',color:'#5a7a8a',marginLeft:6}}>(if enemy in range)</span>
              </div>
            </div>
          )}
          {accuracyRoll===null
            ?<button onClick={onRollAccuracy} disabled={rolling} style={{width:'100%',padding:14,background:'#ffd70022',color:'#ffd700',border:'1px solid #ffd700',borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>Roll Accuracy (d100)</button>
            :<button onClick={()=>onApplyWithAccuracy(accuracyRoll)} style={{width:'100%',padding:14,background:`${elColor}22`,color:elColor,border:`1px solid ${elColor}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>Strike {earthRange} Tile{earthRange>1?'s':''}</button>
          }
        </>
      )}
    </>
  );
};

// Air Gale Force — pick range first, then roll d8, damage = (roll-range)×20, knockback on hit
const AirGaleForceSection = ({rolls, rolling, onRoll, phase, accuracyRoll, onRollAccuracy, airRange, onSetAirRange, onConfirmAirRange, onApplyWithAccuracy, elColor, playerFacing, enemyDistance}) => {
  const dieRoll = rolls.length > 0 ? rolls[0].value : null;
  const baseDmg = (dieRoll !== null && airRange !== null) ? Math.max(0, (dieRoll - airRange) * SKILL_DICE_MULT) : null;
  const facingLabel = {up:'↑ up',down:'↓ down',left:'← left',right:'→ right'}[playerFacing]||playerFacing;
  const onLine = enemyDistance > 0;

  return (
    <>
      {phase==='roll'&&rolls.length===0&&(
        <div style={{marginBottom:16}}>
          <div style={{textAlign:'center',fontSize:'11px',marginBottom:10,padding:'6px 8px',background:onLine?`${elColor}11`:'rgba(255,68,68,0.08)',border:`1px solid ${onLine?`${elColor}44`:'#5a2a2a'}`,borderRadius:4}}>
            <span style={{color:'#7a9db5'}}>Facing </span><span style={{color:elColor,fontWeight:'bold'}}>{facingLabel}</span>
            {onLine
              ? <span style={{color:'#7a9db5'}}> — enemy is <span style={{color:elColor,fontWeight:'bold'}}>{enemyDistance} tile{enemyDistance>1?'s':''}</span> ahead. Pick range <span style={{color:elColor,fontWeight:'bold'}}>{enemyDistance}</span> to hit.</span>
              : <span style={{color:'#ff6644'}}> — enemy is not directly ahead. Move to face it first.</span>}
          </div>
          <div style={{fontSize:'12px',color:'#7a9db5',marginBottom:10,textAlign:'center'}}>
            Choose range <span style={{color:elColor,fontWeight:'bold'}}>first</span> — damage = (d8 − range) × 10
          </div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'center',marginBottom:12}}>
            {Array.from({length:8},(_,i)=>i+1).map(r=>{
              const reaches = r===enemyDistance;
              return (
                <button key={r} onClick={()=>onSetAirRange(r)}
                  style={{width:44,height:44,position:'relative',background:airRange===r?`${elColor}33`:'transparent',border:`1px solid ${airRange===r?elColor:(reaches?`${elColor}66`:'#1e3a4a')}`,borderRadius:4,color:airRange===r?elColor:(reaches?elColor:'#5a7a8a'),cursor:'pointer',fontSize:'13px',fontWeight:'bold',transition:'all 0.15s'}}>
                  {r}
                  {reaches&&<span style={{position:'absolute',top:-6,right:-6,fontSize:'9px',background:elColor,color:'#000',borderRadius:'50%',width:14,height:14,display:'flex',alignItems:'center',justifyContent:'center'}}>•</span>}
                </button>
              );
            })}
          </div>
          {airRange&&(
            <div style={{textAlign:'center',fontSize:'11px',color:'#5a7a8a',marginBottom:12}}>
              Range <span style={{color:elColor,fontWeight:'bold'}}>{airRange}</span> selected — need d8 &gt; {airRange} to deal damage
              {onLine && airRange!==enemyDistance && <span style={{color:'#ff6644'}}> · won't reach enemy at {enemyDistance}</span>}
            </div>
          )}
          <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
            <DiceDisplay type="d8" value="--" rolling={false} color={airRange?elColor:'#2a4a5e'} label="Gale Force" />
          </div>
          <button onClick={onRoll} disabled={!airRange||rolling}
            style={{width:'100%',padding:14,background:airRange?`${elColor}22`:'#0a1218',color:airRange?elColor:'#2a4a5e',border:`1px solid ${airRange?elColor:'#1e3a4a'}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:airRange&&!rolling?'pointer':'not-allowed',letterSpacing:'0.1em'}}>
            {rolling?'Rolling...':(airRange?'Roll d8':'Select a range first')}
          </button>
        </div>
      )}

      {phase==='roll'&&rolls.length>0&&!rolling&&(
        <>
          <div style={{display:'flex',justifyContent:'center',marginBottom:14}}>
            <DiceDisplay type="d8" value={dieRoll} rolling={false} color={elColor} label="Gale Force" />
          </div>
          <div style={{background:'#0a1218',border:`1px solid ${elColor}44`,borderRadius:8,padding:'14px 16px',marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:'11px',color:'#5a7a8a',textTransform:'uppercase',letterSpacing:'0.1em'}}>Breakdown</span>
              <span style={{fontSize:'11px',color:'#3a6a8a',fontFamily:'monospace'}}>Cost: <span style={{color:'#ffd700'}}>2 Energy</span></span>
            </div>
            <div style={{display:'flex',alignItems:'baseline',gap:8,fontSize:13,color:'#7a9db5',marginBottom:6}}>
              <span style={{color:'#b0dff4',fontWeight:'bold'}}>{dieRoll}</span>
              <span style={{color:'#3a6a8a'}}>roll −</span>
              <span style={{color:'#b0dff4',fontWeight:'bold'}}>{airRange}</span>
              <span style={{color:'#3a6a8a'}}>range × 10 =</span>
              <span style={{fontSize:18,fontWeight:'bold',color:baseDmg>0?elColor:'#ff4444'}}>{baseDmg}</span>
              <span style={{color:'#3a6a8a'}}>base dmg</span>
            </div>
            {baseDmg===0&&(
              <div style={{fontSize:'11px',color:'#ffaa44',marginTop:4}}>
                Roll didn't exceed range — floors to a guaranteed {RANGED_SKILL_MIN_DMG} dmg on hit, still knocks back.
              </div>
            )}
            {baseDmg>0&&(
              <div style={{fontSize:'11px',color:'#5a7a8a',marginTop:4}}>
                Hit knocks enemy back 1 tile (if space is clear). Minimum {RANGED_SKILL_MIN_DMG} dmg guaranteed.
              </div>
            )}
          </div>
          <button onClick={onConfirmAirRange}
            style={{width:'100%',padding:11,background:`${elColor}22`,color:elColor,border:`1px solid ${elColor}`,borderRadius:6,fontSize:14,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.08em'}}>
            Roll Accuracy
          </button>
        </>
      )}

      {phase==='accuracy'&&(
        <>
          <div style={{textAlign:'center',marginBottom:14}}>
            <div style={{fontSize:13,color:'#7a9db5',marginBottom:4}}>
              Gale Force: range <span style={{color:elColor}}>{airRange}</span>, d8={dieRoll} — <span style={{color:baseDmg>0?elColor:'#ffaa44'}}>{baseDmg} base dmg</span>
            </div>
            <div style={{fontSize:'11px',color:'#5a7a8a'}}>Roll d100. ≥79 full · 40–78 half · under 40 quarter · min {RANGED_SKILL_MIN_DMG} dmg on hit</div>
          </div>
          <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
            <DiceDisplay type="d100" value={accuracyRoll!==null?accuracyRoll:'--'} rolling={rolling} color="#ffd700" />
          </div>
          {accuracyRoll!==null&&!rolling&&(
            <div style={{textAlign:'center',marginBottom:14}}>
              <div style={{fontSize:22,fontWeight:'bold',color:'#ffd700'}}>{accuracyRoll}%</div>
              <div style={{fontSize:13,color:'#b0dff4',marginTop:4}}>
                {baseDmg} → <strong style={{color:elColor}}>{Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(baseDmg,accuracyRoll))} dmg</strong> ({accuracyTierLabel(accuracyRoll)})
                <span style={{fontSize:'11px',color:'#5a7a8a',marginLeft:6}}> + knockback</span>
              </div>
            </div>
          )}
          {accuracyRoll===null
            ?<button onClick={onRollAccuracy} disabled={rolling} style={{width:'100%',padding:14,background:'#ffd70022',color:'#ffd700',border:'1px solid #ffd700',borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>Roll Accuracy (d100)</button>
            :<button onClick={()=>onApplyWithAccuracy(accuracyRoll)} style={{width:'100%',padding:14,background:`${elColor}22`,color:elColor,border:`1px solid ${elColor}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>
              Strike + Knockback
            </button>
          }
        </>
      )}
    </>
  );
};
// Water Torrent — single d20 sets damage AND the AoE ceiling via the locked matrix.
const WaterTorrentSection = ({rolls, rolling, onRoll, phase, accuracyRoll, onRollAccuracy, waterAoe, onSetWaterAoe, onConfirm, onApplyWithAccuracy, elColor, playerFacing, anchorInBounds, enemyInFootprint, availableAP}) => {
  const dieRoll = rolls.length > 0 ? rolls[0].value : null;
  const res = dieRoll !== null ? resolveTorrent(dieRoll) : null;
  const options = dieRoll !== null ? getTorrentOptions(dieRoll, availableAP) : [];
  const selCost = waterAoe ? TORRENT_AOE_COST[waterAoe] : null;
  const facingLabel = {up:'↑ up',down:'↓ down',left:'← left',right:'→ right'}[playerFacing]||playerFacing;

  return (
    <>
      <div style={{display:'flex',justifyContent:'center',marginBottom:18}}>
        <DiceDisplay type="d20" value={dieRoll!==null?dieRoll:'--'} rolling={rolling} color={elColor} label="Torrent Roll" />
      </div>

      {phase==='roll'&&(
        <>
          <div style={{textAlign:'center',fontSize:'11px',marginBottom:12,padding:'6px 8px',background:`${elColor}11`,border:`1px solid ${elColor}44`,borderRadius:4}}>
            <span style={{color:'#7a9db5'}}>Facing </span><span style={{color:elColor,fontWeight:'bold'}}>{facingLabel}</span>
            <span style={{color:'#7a9db5'}}> — strike anchors </span><span style={{color:elColor,fontWeight:'bold'}}>{TORRENT_RANGE} tiles</span><span style={{color:'#7a9db5'}}> ahead</span>
            {!anchorInBounds && <span style={{color:'#ff6644'}}> · clipped to grid edge</span>}
          </div>

          <button onClick={onRoll} disabled={rolling||rolls.length>0}
            style={{width:'100%',padding:14,background:rolls.length>0?'#0a1218':`${elColor}22`,color:rolls.length>0?'#3a5a6a':elColor,border:`1px solid ${rolls.length>0?'#1e3a4a':elColor}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:rolling||rolls.length>0?'not-allowed':'pointer',letterSpacing:'0.1em'}}>
            {rolling?'Rolling...':rolls.length>0?'Rolled':'Roll d20'}
          </button>

          {res&&!rolling&&(
            <div style={{marginTop:16,background:'#0a1218',border:`1px solid ${elColor}44`,borderRadius:8,padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:'11px',color:'#5a7a8a',textTransform:'uppercase',letterSpacing:'0.1em'}}>Matrix Result</span>
                <span style={{fontSize:'11px',color:'#3a6a8a',fontFamily:'monospace'}}>d20 = <span style={{color:elColor}}>{dieRoll}</span></span>
              </div>
              <div style={{textAlign:'center',background:`${elColor}11`,border:`1px solid ${elColor}33`,borderRadius:6,padding:'8px 4px',marginBottom:12}}>
                <div style={{fontSize:'9px',color:'#5a7a8a',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:2}}>Damage (locked)</div>
                <div style={{fontSize:22,fontWeight:'bold',color:elColor}}>{res.damage}</div>
              </div>
              <div style={{fontSize:'11px',color:'#5a7a8a',marginBottom:8}}>
                Choose AoE — roll unlocks up to <span style={{color:elColor,fontWeight:'bold'}}>{AOE_LABEL[res.aoe]}</span>:
              </div>
              <div style={{display:'flex',gap:6,marginBottom:10}}>
                {options.map(opt=>{
                  const selected=waterAoe===opt.aoe;
                  const disabled=!opt.affordable;
                  return (
                    <button key={opt.aoe} onClick={()=>!disabled&&onSetWaterAoe(opt.aoe)} disabled={disabled}
                      style={{flex:1,padding:'8px 4px',background:selected?`${elColor}33`:disabled?'rgba(20,30,40,0.5)':'transparent',border:`1px solid ${selected?elColor:disabled?'#1e3a4a':`${elColor}55`}`,borderRadius:4,color:selected?elColor:disabled?'#3a5a6a':'#8ab5cc',cursor:disabled?'not-allowed':'pointer',fontSize:'11px',textAlign:'center',transition:'all 0.15s'}}>
                      <div style={{fontWeight:'bold'}}>{AOE_LABEL[opt.aoe]}</div>
                      <div style={{fontSize:'10px',marginTop:2,color:selected?elColor:disabled?'#3a5a6a':'#ffd700'}}>
                        {opt.cost} Energy{disabled?' ✕':''}
                      </div>
                    </button>
                  );
                })}
              </div>
              {waterAoe&&(
                <>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'11px',marginBottom:10}}>
                    <span style={{color:enemyInFootprint?'#00cc66':'#ff6644'}}>
                      {enemyInFootprint?'Enemy in blast — full damage':'Enemy outside blast'}
                    </span>
                    <span style={{color:'#3a6a8a',fontFamily:'monospace'}}>Cost: <span style={{color:'#ffd700'}}>{selCost} Energy</span></span>
                  </div>
                  <button onClick={onConfirm}
                    style={{width:'100%',padding:11,background:`${elColor}22`,color:elColor,border:`1px solid ${elColor}`,borderRadius:6,fontSize:14,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.08em'}}>
                    Confirm {AOE_LABEL[waterAoe]} ({selCost} Energy) — Roll Accuracy
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}

      {phase==='accuracy'&&res&&waterAoe&&(
        <>
          <div style={{textAlign:'center',marginBottom:14}}>
            <div style={{fontSize:13,color:'#7a9db5',marginBottom:4}}>
              Torrent: <span style={{color:elColor}}>{res.damage} dmg</span> · <span style={{color:elColor}}>{AOE_LABEL[waterAoe]}</span>
            </div>
            <div style={{fontSize:'11px',color:'#5a7a8a',marginBottom:2}}>Cost: <span style={{color:'#ffd700'}}>{selCost} Energy</span></div>
            <div style={{fontSize:'11px',color:'#5a7a8a'}}>Roll d100. ≥79 full · 40–78 half · under 40 quarter</div>
          </div>
          <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
            <DiceDisplay type="d100" value={accuracyRoll!==null?accuracyRoll:'--'} rolling={rolling} color="#ffd700" />
          </div>
          {accuracyRoll!==null&&!rolling&&(
            <div style={{textAlign:'center',marginBottom:14}}>
              <div style={{fontSize:22,fontWeight:'bold',color:'#ffd700'}}>{accuracyRoll}%</div>
              <div style={{fontSize:13,color:'#b0dff4',marginTop:4}}>
                {res.damage} → <strong style={{color:elColor}}>{applyAccuracy(res.damage,accuracyRoll)} dmg</strong> ({accuracyTierLabel(accuracyRoll)})
                <span style={{fontSize:'11px',color:'#5a7a8a',marginLeft:6}}>{enemyInFootprint?'(enemy in blast)':'(if enemy in blast)'}</span>
              </div>
            </div>
          )}
          {accuracyRoll===null
            ?<button onClick={onRollAccuracy} disabled={rolling} style={{width:'100%',padding:14,background:'#ffd70022',color:'#ffd700',border:'1px solid #ffd700',borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>Roll Accuracy (d100)</button>
            :<button onClick={()=>onApplyWithAccuracy(accuracyRoll)} style={{width:'100%',padding:14,background:`${elColor}22`,color:elColor,border:`1px solid ${elColor}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>Unleash {AOE_LABEL[waterAoe]}</button>
          }
        </>
      )}
    </>
  );
};

const DiceModal = ({show,category,elementName,rolls,abilities,rolling,onRoll,onUseAbility,onClose,phase,accuracyRoll,onRollAccuracy,selectedAbilityForAccuracy,airRange,onSetAirRange,onConfirmAirRange,onFireProceedToAccuracy,onFireApplyWithAccuracy,earthRange,onSetEarthRange,onConfirmEarthRange,onEarthApplyWithAccuracy,onAirApplyWithAccuracy,onWaterConfirm,onWaterApplyWithAccuracy,waterAoe,onSetWaterAoe,waterAvailableAP,waterAnchorInBounds,waterEnemyInFootprint,playerFacing,enemyDistance}) => {
  if(!show) return null;
  const elementData=ELEMENTS[category]&&ELEMENTS[category][elementName];
  if(!elementData) return null;
  const elColor=elementData.color||'#00c8ff';

  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#080e14',border:`2px solid ${elColor}`,borderRadius:10,padding:'1.5rem',maxWidth:480,width:'92%',maxHeight:'85vh',overflowY:'auto',color:'#b0dff4',boxShadow:`0 0 40px ${elColor}44`}}>
        <div style={{textAlign:'center',marginBottom:18}}>
          <span style={{fontSize:28}}>{elementData.icon}</span>
          <h2 style={{fontSize:'1.1rem',letterSpacing:'0.12em',textTransform:'uppercase',color:elColor,marginTop:4}}>{elementName} Attack</h2>
          <div style={{fontSize:'11px',color:'#5a7a8a',marginTop:2}}>{elementData.description}</div>
        </div>

        {elementData.isFire ? (
          <FireDiceSection
            rolls={rolls} rolling={rolling} onRoll={onRoll}
            phase={phase} accuracyRoll={accuracyRoll} onRollAccuracy={onRollAccuracy}
            onProceedToAccuracy={onFireProceedToAccuracy}
            onApplyWithAccuracy={onFireApplyWithAccuracy}
            elColor={elColor}
          />
        ) : elementData.isEarth ? (
          <EarthTremorSection
            rolls={rolls} rolling={rolling} onRoll={onRoll}
            phase={phase} accuracyRoll={accuracyRoll} onRollAccuracy={onRollAccuracy}
            earthRange={earthRange} onSetEarthRange={onSetEarthRange}
            onConfirmEarthRange={onConfirmEarthRange}
            onApplyWithAccuracy={onEarthApplyWithAccuracy}
            elColor={elColor} playerFacing={playerFacing}
          />
        ) : elementData.isAir ? (
          <AirGaleForceSection
            rolls={rolls} rolling={rolling} onRoll={onRoll}
            phase={phase} accuracyRoll={accuracyRoll} onRollAccuracy={onRollAccuracy}
            airRange={airRange} onSetAirRange={onSetAirRange}
            onConfirmAirRange={onConfirmAirRange}
            onApplyWithAccuracy={onAirApplyWithAccuracy}
            elColor={elColor} playerFacing={playerFacing} enemyDistance={enemyDistance}
          />
        ) : elementData.isWater ? (
          <WaterTorrentSection
            rolls={rolls} rolling={rolling} onRoll={onRoll}
            phase={phase} accuracyRoll={accuracyRoll} onRollAccuracy={onRollAccuracy}
            waterAoe={waterAoe} onSetWaterAoe={onSetWaterAoe}
            onConfirm={onWaterConfirm}
            onApplyWithAccuracy={onWaterApplyWithAccuracy}
            elColor={elColor} playerFacing={playerFacing}
            anchorInBounds={waterAnchorInBounds} enemyInFootprint={waterEnemyInFootprint}
            availableAP={waterAvailableAP}
          />
        ) : (
          <>
            {phase==='roll'&&(
              <>
                <div style={{display:'flex',justifyContent:'center',gap:14,marginBottom:20}}>
                  {elementData.dice.map((d,i)=><DiceDisplay key={i} type={d} value={rolls[i]&&rolls[i].value||'--'} rolling={rolling} color={elColor} />)}
                </div>
                {rolls.length>0&&!rolling&&(
                  <div style={{textAlign:'center',marginBottom:16,fontSize:20,fontWeight:'bold',color:elColor}}>
                    {elementData.dice.length===1?`Roll: ${rolls[0].value}`:`Total: ${rolls.reduce((a,r)=>a+r.value,0)} (${rolls.map(r=>r.value).join(' + ')})`}
                  </div>
                )}
                <button onClick={onRoll} disabled={rolling||rolls.length>0}
                  style={{width:'100%',padding:14,background:rolls.length>0?'#0a1218':`${elColor}22`,color:rolls.length>0?'#3a5a6a':elColor,border:`1px solid ${rolls.length>0?'#1e3a4a':elColor}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:rolling||rolls.length>0?'not-allowed':'pointer',letterSpacing:'0.1em'}}>
                  {rolling?'Rolling...':rolls.length>0?'Rolled':'Roll Dice'}
                </button>
                {abilities.length>0&&!rolling&&(
                  <div style={{marginTop:16}}>
                    <div style={{fontSize:'11px',color:'#5a7a8a',marginBottom:8,letterSpacing:'0.08em',textTransform:'uppercase'}}>Unlocked - select to roll accuracy</div>
                    {abilities.map((ab,i)=>(
                      <div key={i} onClick={()=>onUseAbility(ab)}
                        style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'#0a1218',border:`1px solid ${elColor}55`,borderRadius:6,padding:'9px 12px',marginBottom:6,cursor:'pointer',transition:'border-color 0.15s'}}
                        onMouseEnter={e=>e.currentTarget.style.borderColor=elColor}
                        onMouseLeave={e=>e.currentTarget.style.borderColor=`${elColor}55`}>
                        <div>
                          <span style={{fontWeight:'bold',color:'#b0dff4'}}>{ab.name}</span>
                          {ab.tier>0&&<span style={{marginLeft:7,background:elColor,color:'#000',padding:'1px 5px',borderRadius:8,fontSize:10}}>T{ab.tier}</span>}
                          <div style={{fontSize:11,color:'#5a7a8a',marginTop:2}}>{ab.desc}</div>
                        </div>
                        <span style={{color:elColor,fontWeight:'bold',fontSize:13}}>{ab.damage>0?`${ab.damage}`:ab.heal?`+${ab.heal}HP`:'--'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {phase==='accuracy'&&(
              <>
                <div style={{textAlign:'center',marginBottom:16}}>
                  <div style={{fontSize:'13px',color:'#7a9db5',marginBottom:6}}>Using: <strong style={{color:elColor}}>{selectedAbilityForAccuracy&&selectedAbilityForAccuracy.name}</strong> ({selectedAbilityForAccuracy&&selectedAbilityForAccuracy.damage>0?`${selectedAbilityForAccuracy.damage} base dmg`:`+${selectedAbilityForAccuracy&&selectedAbilityForAccuracy.heal} HP`})</div>
                  <div style={{fontSize:'11px',color:'#5a7a8a'}}>Roll d100. ≥79 full · 40–78 half · under 40 quarter</div>
                </div>
                <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
                  <DiceDisplay type="d100" value={accuracyRoll!==null?accuracyRoll:'--'} rolling={rolling} color="#ffd700" />
                </div>
                {accuracyRoll!==null&&!rolling&&(
                  <div style={{textAlign:'center',marginBottom:16}}>
                    <div style={{fontSize:22,fontWeight:'bold',color:'#ffd700'}}>{accuracyRoll}%</div>
                    {selectedAbilityForAccuracy&&selectedAbilityForAccuracy.damage>0&&<div style={{fontSize:14,color:'#b0dff4',marginTop:4}}>{selectedAbilityForAccuracy.damage} → <strong style={{color:elColor}}>{applyAccuracy(selectedAbilityForAccuracy.damage,accuracyRoll)} dmg</strong> ({accuracyTierLabel(accuracyRoll)})</div>}
                  </div>
                )}
                {accuracyRoll===null
                  ?<button onClick={onRollAccuracy} disabled={rolling} style={{width:'100%',padding:14,background:'#ffd70022',color:'#ffd700',border:'1px solid #ffd700',borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>Roll Accuracy (d100)</button>
                  :<button onClick={()=>onUseAbility(selectedAbilityForAccuracy,accuracyRoll)} style={{width:'100%',padding:14,background:`${elColor}22`,color:elColor,border:`1px solid ${elColor}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>Apply Attack</button>
                }
              </>
            )}
          </>
        )}

        <button onClick={onClose} style={{width:'100%',marginTop:14,padding:8,background:'transparent',color:'#3a5a6a',border:'1px solid #1e3a4a',borderRadius:5,cursor:'pointer',fontSize:12}}>Close</button>
      </div>
    </div>
  );
};

const RewardModal = ({show,html}) => {
  if(!show) return null;
  return <div style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',background:'#080e14',border:'2px solid #00c8ff',boxShadow:'0 0 40px rgba(0,200,255,0.5)',padding:'2rem',borderRadius:10,zIndex:1000,minWidth:300,maxWidth:'90vw',textAlign:'center',color:'#b0dff4'}} dangerouslySetInnerHTML={{__html:html}} />;
};
// ─── MAIN GAME COMPONENT ───────────────────────────────────────────────────────

export default function GridBattlerGame() {
  const initPlayer = () => newHero();
  const initEnemy  = (p) => newGoblin(1, p.boardPosition);

  const [player,         setPlayer]         = useState(()=>{ const p=initPlayer(); return p; });
  const [enemy,          setEnemy]          = useState(()=>{ const p=initPlayer(); return initEnemy(p); });
  const [tiles,          setTiles]          = useState(()=>{ const p=initPlayer(); const e=initEnemy(p); return makeTiles(p.boardPosition,e.boardPosition); });
  const [wave,           setWave]           = useState(1);
  const [round,          setRound]          = useState(1);
  const [playerRolledEnergy, setPlayerRolledEnergy] = useState(0);
  const [enemyRolledEnergy,  setEnemyRolledEnergy]  = useState(0);
  const [energyPhase,    setEnergyPhase]    = useState('roll');
  const [hexas,          setHexas]          = useState(0);
  const [isPlayerTurn,   setIsPlayerTurn]   = useState(true);
  const [playerSel,      setPlayerSel]      = useState(false);
  const [validSquares,   setValidSquares]   = useState([]);
  const [logs,           setLogs]           = useState(['=== Battle Initiated ===','Move adjacent to attack. Position for bonuses.']);
  const [reward,         setReward]         = useState({show:false,html:''});
  const [selCategory,    setSelCategory]    = useState('base');
  const [selElement,     setSelElement]     = useState('Fire');
  const [showDice,       setShowDice]       = useState(false);
  const [diceRolls,      setDiceRolls]      = useState([]);
  const [abilities,      setAbilities]      = useState([]);
  const [rolling,        setRolling]        = useState(false);
  const [dicePhase,      setDicePhase]      = useState('roll');
  const [accuracyRoll,   setAccuracyRoll]   = useState(null);
  const [pendingAbility, setPendingAbility] = useState(null);
  const [airRange,       setAirRange]       = useState(null);
  const [earthRange,     setEarthRange]     = useState(null);
  const [waterAoe,       setWaterAoe]       = useState(null); // player-chosen Torrent AoE tier
  // Per-round roll lock. Once dice are rolled for a skill, the result is locked
  // for the rest of the round to prevent reroll-to-optimize exploits.
  const [lockedRoll,     setLockedRoll]     = useState(null);
  // Set true when the healing tile is consumed (by either unit). On the next
  // round start, the tile relocates to a fresh random spot and this resets.
  const [healingConsumed, setHealingConsumed] = useState(false);

  // ── Summoner / class state (v4.0) ──
  const [playerClass,    setPlayerClass]    = useState(null);   // null until unlocked+selected
  const [classUnlocked,  setClassUnlocked]  = useState(false);  // gate flag (post-boss)
  const [showClassModal, setShowClassModal] = useState(false);  // unlock picker
  // Landscape-only game: true when the viewport is taller than it is wide, which
  // triggers a rotate-your-device overlay (the 3-panel row needs the width).
  const [isPortrait, setIsPortrait] = useState(
    typeof window!=='undefined' ? window.innerHeight > window.innerWidth : false
  );
  const [summons,        setSummons]        = useState([]);     // active Novice summons
  const [showMmModal,    setShowMmModal]    = useState(false);  // Mastermind mode picker
  // Deploy sub-flow state
  const [showDeploy,     setShowDeploy]     = useState(false);
  const [deployRolling,  setDeployRolling]  = useState(false);
  const [deployRoll,     setDeployRoll]     = useState(null);
  const [deployTier,     setDeployTier]     = useState(null);
  const [awaitingPlacement, setAwaitingPlacement] = useState(false);
  // Direct (Compass Slash) targeting state: when true, grid clicks pick a target.
  const [compassTargeting, setCompassTargeting] = useState(false);
  // Rotate: once-per-turn, 0-cost facing change. True while the direction
  // picker banner is open.
  const [rotateTargeting, setRotateTargeting] = useState(false);
  // Grid square sizing — measured from the battle row so it's capped by
  // whichever is smaller, available width or available height (see the
  // ResizeObserver effect below).
  const battleRowRef = useRef(null);
  const gridSlotRef = useRef(null);
  const [gridSize, setGridSize] = useState(480);
  // ── Player-directed summon-command sub-phase (A) ──
  const [summonPhaseActive, setSummonPhaseActive] = useState(false);
  const [selectedSummonId,  setSelectedSummonId]  = useState(null);
  const [actedSummonIds,    setActedSummonIds]    = useState([]);
  const summonCtxRef = useRef(null);
  // True only when a summon COMMAND phase ran this round (summons existed at the
  // energy roll). Distinguishes "summons → enemy already happened" from a legacy
  // round where the player deploys a summon mid-turn (enemy still owed a turn).
  const summonPhaseRanRef = useRef(false);

  const addLog = useCallback((msg)=>setLogs(prev=>[...prev,msg]),[]);

  const skillCost = getSkillCost(selCategory, selElement);
  const elData = ELEMENTS[selCategory]?.[selElement];
  const canAttack = isPlayerTurn && energyPhase==='act' && player.actionpts>0 && isAdjacent(player.boardPosition,enemy.boardPosition);
  // Earth, Air, and Water bypass adjacency — they're ranged.
  const canSkill  = isPlayerTurn && energyPhase==='act' && !player.skillUsed && player.actionpts >= skillCost &&
    (elData?.isEarth||elData?.isAir||elData?.isWater ? true : isAdjacent(player.boardPosition,enemy.boardPosition));
  // Mastermind: available to a Summoner during the act phase, once per turn,
  // if at least 2 Energy is available (fixed activation cost).
  const canMastermind = playerClass==='Summoner' && isPlayerTurn && energyPhase==='act' && !player.skillUsed && player.actionpts >= 2;
  // Rotate: 0 Energy, once per turn — a free facing change for tactical
  // repositioning (evade a flank, line up a ranged skill) without spending AP.
  const canRotate = isPlayerTurn && energyPhase==='act' && !player.rotateUsed;

  const showReward = useCallback((html,ms)=>{
    setReward({show:true,html});
    setTimeout(()=>setReward({show:false,html:''}),ms||3000);
  },[]);

  const applyLevelUp = useCallback((p)=>{
    const needed=getXPThreshold(p.level);
    if(p.playerXp<needed) return p;
    const updated={...p,level:p.level+1,playerXp:p.playerXp-needed,health:p.maxHealth};
    addLog(`=== LEVEL UP! ${updated.name} Lv${updated.level}! HP restored. ===`);
    showReward(`<h2 style="color:#ffd700;letter-spacing:.1em">LEVEL UP</h2><p style="font-size:1.4rem;margin:10px 0;color:#00c8ff">Level ${updated.level}</p><p style="color:#00cc66;font-size:.9rem">HP fully restored</p>`,2500);
    return updated;
  },[addLog,showReward]);

  const startPlayerTurn = useCallback((p)=>{
    setIsPlayerTurn(true);
    setEnergyPhase('act'); // pool already rolled at round start; player spends remainder
    setValidSquares([]);
    addLog('=== Your Turn — spend remaining Energy ===');
  },[addLog]);

  // ── SUMMON COMMAND SUB-PHASE (A: player-directed) ──
  const summonForwardTile = useCallback((s)=>{
    const ahead={x:s.boardPosition.x,y:s.boardPosition.y-1};
    if(ahead.y<0) return null;
    return ahead;
  },[]);

  const summonActionAt = useCallback((s, tile, curEnemy, curSummons)=>{
    const ahead=summonForwardTile(s);
    if(!ahead||ahead.x!==tile.x||ahead.y!==tile.y) return null;
    if(player.boardPosition.x===tile.x&&player.boardPosition.y===tile.y) return null;
    if(curSummons.some(o=>o.id!==s.id&&o.boardPosition.x===tile.x&&o.boardPosition.y===tile.y)) return null;
    if(curEnemy.health>0&&curEnemy.boardPosition.x===tile.x&&curEnemy.boardPosition.y===tile.y) return 'attack';
    return 'move';
  },[player,summonForwardTile]);

  const beginSummonCommandPhase = useCallback((rP, rE, currentRound)=>{
    summonCtxRef.current = { round: currentRound };
    summonPhaseRanRef.current = true;
    setActedSummonIds([]);
    setSelectedSummonId(null);
    setSummonPhaseActive(true);
    setIsPlayerTurn(true);
    setEnergyPhase('summon'); // distinct phase: not roll, not act
    setValidSquares([]);
    addLog(`=== Summon Command — ${summons.length} active (pool ${rP.actionpts}E). Click a summon, then its tile. ===`);
  },[addLog,summons]);

  const endSummonCommandPhase = useCallback(()=>{
    setSummonPhaseActive(false);
    setSelectedSummonId(null);
    setValidSquares([]);
    const ctx = summonCtxRef.current || { round };
    addLog('=== Summons done — enemy turn ===');
    setIsPlayerTurn(false);
    setEnemyRolledEnergy(0);
    setEnemy(curE=>{
      setPlayer(curP=>{
        setTimeout(()=>runEnemyTurn({...curE,actionpts:0}, curP, ctx.round), 400);
        return curP;
      });
      return curE;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,round]);

  const resolveSummonAction = useCallback((summonId, tile)=>{
    setSummons(curSummons=>{
      const idx=curSummons.findIndex(s=>s.id===summonId);
      if(idx<0) return curSummons;
      const s=curSummons[idx];
      let didAct=false;
      let wasAttack=false;
      setPlayer(curPlayer=>{
        if(curPlayer.actionpts<=0){ addLog('// Pool empty — cannot act'); return curPlayer; }
        setEnemy(curEnemy=>{
          const kind=summonActionAt(s,tile,curEnemy,curSummons);
          if(!kind) return curEnemy;
          didAct=true;
          if(kind==='attack'){
            wasAttack=true;
            const dmg=s.atk;
            const newHP=Math.max(0,curEnemy.health-dmg);
            addLog(`${s.name} strikes ${curEnemy.name} → ${dmg} dmg (${newHP}/${curEnemy.maxHealth})`);
            const ne={...curEnemy,health:newHP};
            if(newHP<=0){
              addLog('=== Enemy defeated by summons! ===');
              setTimeout(()=>handleEnemyDefeated({...curPlayer,actionpts:curPlayer.actionpts-1}, wave),400);
            }
            return ne;
          }
          return curEnemy;
        });
        if(!didAct) return curPlayer;
        return {...curPlayer, actionpts:curPlayer.actionpts-1};
      });
      if(!didAct) return curSummons;
      const next=curSummons.slice();
      if(wasAttack){
        next[idx]={...s};
      } else if(tile.y===ENEMY_BACK_ROW){
        next[idx]={...s,boardPosition:tile,promoted:true};
        addLog(`★ ${s.name} reaches the back row → promotes to Agent (autonomous staged)`);
      } else {
        next[idx]={...s,boardPosition:tile};
        addLog(`${s.name} advances → (${tile.x},${tile.y})`);
      }
      return next.filter(z=>!z.promoted);
    });
    setActedSummonIds(prev=>[...prev,summonId]);
    setSelectedSummonId(null);
    setValidSquares([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,summonActionAt,wave]);

  const checkEndOfRound = useCallback((latestPlayer,latestEnemy,currentRound)=>{
    if(latestPlayer.actionpts>0||latestEnemy.actionpts>0) return;
    const nextRound = currentRound + 1;
    setRound(nextRound);
    setPlayerRolledEnergy(0);
    setEnemyRolledEnergy(0);
    setLockedRoll(null); // new round — roll lock released
    setDiceRolls([]); setAbilities([]); setDicePhase('roll');
    setAccuracyRoll(null); setPendingAbility(null); setAirRange(null); setEarthRange(null); setWaterAoe(null);
    addLog(`=== Round ${nextRound} ===`);
    const rP = { ...latestPlayer, actionpts:0, frozen:latestPlayer.frozen||0, skillUsed:false, rotateUsed:false };
    const rE = { ...latestEnemy,  actionpts:0, frozen:latestEnemy.frozen||0, skillUsed:false,
      energyRollover: (latestEnemy.energyRollover||0) + (latestEnemy.actionpts||0) };
    setPlayer(rP);
    setEnemy(rE);
    setTimeout(()=>beginRound(rP, rE, nextRound), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog]);
  // ── ENEMY TURN ──
  const runEnemyTurn = useCallback((currentEnemy,currentPlayer,currentRound)=>{
    const needsRoll = currentEnemy.actionpts === 0;
    if(needsRoll){
      const eRoll = rollD12Energy();
      const rollover = currentEnemy.energyRollover || 0;
      const frozenPenalty = currentEnemy.frozen || 0;
      const total = eRoll + rollover;
      const newAP = Math.max(0, total - frozenPenalty);
      setEnemyRolledEnergy(total);
      addLog(`// Enemy rolls d12=${eRoll}${rollover>0?` +${rollover} rollover`:''} = ${total} Energy${frozenPenalty>0?` (freeze -${frozenPenalty})`:''}  ->  ${newAP} AP`);
      const rolledEnemy = { ...currentEnemy, actionpts:newAP, frozen:0, energyRollover:0 };
      setEnemy(rolledEnemy);
      if(newAP <= 0){
        addLog(`// Enemy has 0 Energy - passing`);
        finishEnemyToPlayer(currentPlayer, rolledEnemy, currentRound);
        return;
      }
      setTimeout(()=>runEnemyTurn(rolledEnemy, currentPlayer, currentRound), 600);
      return;
    }

    addLog(`// Enemy computing... (${currentEnemy.actionpts} Energy)`);
    setTimeout(()=>{
      let updatedPlayer=currentPlayer, updatedEnemy=currentEnemy;
      const adjacent=isAdjacent(currentEnemy.boardPosition,currentPlayer.boardPosition);
      const eElData=currentEnemy.element?ELEMENTS[currentEnemy.elementCategory]&&ELEMENTS[currentEnemy.elementCategory][currentEnemy.element]:null;
      const eMinCost=eElData?getSkillCost(currentEnemy.elementCategory,currentEnemy.element):1;
      const eRanged = eElData?.isEarth||eElData?.isAir||eElData?.isWater;
      const canUseSkill=(eRanged?true:adjacent)&&currentEnemy.element&&!currentEnemy.skillUsed&&currentEnemy.actionpts>=eMinCost&&Math.random()<0.6;

      const lowHP = currentEnemy.health <= currentEnemy.maxHealth * 0.3;
      const healTile = findHealingTile(tiles);
      const onHealTile = healTile && currentEnemy.boardPosition.x===healTile.x && currentEnemy.boardPosition.y===healTile.y;
      const willFlee = lowHP && healTile && (currentEnemy.element ? Math.random()<0.6 : true);

      if(willFlee && !onHealTile){
        const moves=getMoveToward(currentEnemy.boardPosition.x,currentEnemy.boardPosition.y,healTile.x,healTile.y);
        let moved=false;
        for(const m of moves){
          const onSummon=summons.some(s=>s.boardPosition.x===m.x&&s.boardPosition.y===m.y);
          if(m.x>=0&&m.x<SIZE&&m.y>=0&&m.y<SIZE&&!(m.x===currentPlayer.boardPosition.x&&m.y===currentPlayer.boardPosition.y)&&!onSummon){
            const nf=facingFromMove(currentEnemy.boardPosition,m);
            let healed=false, newHP=currentEnemy.health;
            if(m.x===healTile.x && m.y===healTile.y){
              newHP=Math.min(currentEnemy.maxHealth, currentEnemy.health+100);
              healed=true;
            }
            updatedEnemy={...currentEnemy,boardPosition:m,facing:nf,actionpts:currentEnemy.actionpts-1,health:newHP};
            if(healed){
              setHealingConsumed(true);
              setTiles(prev=>{const g=prev.map(r=>r.slice()); if(g[healTile.y][healTile.x]===TILE_TYPES.HEALING) g[healTile.y][healTile.x]=TILE_TYPES.NORMAL; return g;});
              addLog(`${currentEnemy.name} reaches healing tile → +100 HP (${newHP}/${currentEnemy.maxHealth})`);
            } else {
              addLog(`${currentEnemy.name} flees to heal → (${m.x},${m.y}) [${Math.round(currentEnemy.health/currentEnemy.maxHealth*100)}% HP]`);
            }
            moved=true; break;
          }
        }
        if(!moved){ updatedEnemy={...currentEnemy,actionpts:currentEnemy.actionpts-1}; addLog(`${currentEnemy.name} blocked from healing path`); }
        setEnemy(updatedEnemy);
        setTimeout(()=>{
          if(updatedEnemy.actionpts>0) runEnemyTurn(updatedEnemy,updatedPlayer,currentRound);
          else finishEnemyToPlayer(updatedPlayer,updatedEnemy,currentRound);
        },600);
        return;
      }

      if(willFlee && onHealTile){
        const newHP=Math.min(currentEnemy.maxHealth, currentEnemy.health+100);
        updatedEnemy={...currentEnemy,health:newHP,actionpts:currentEnemy.actionpts-1};
        setHealingConsumed(true);
        setTiles(prev=>{const g=prev.map(r=>r.slice()); if(g[healTile.y][healTile.x]===TILE_TYPES.HEALING) g[healTile.y][healTile.x]=TILE_TYPES.NORMAL; return g;});
        addLog(`${currentEnemy.name} heals on tile → +100 HP (${newHP}/${currentEnemy.maxHealth})`);
        setEnemy(updatedEnemy);
        setTimeout(()=>{
          if(updatedEnemy.actionpts>0) runEnemyTurn(updatedEnemy,updatedPlayer,currentRound);
          else finishEnemyToPlayer(updatedPlayer,updatedEnemy,currentRound);
        },600);
        return;
      }

      if(canUseSkill){
        const elData=eElData;
        const rolls=elData.dice.map(d=>({type:d,value:rollDie(parseInt(d.slice(1)))}));
        let dmg=0, heal=0;
        let eCost = getSkillCost(currentEnemy.elementCategory, currentEnemy.element);
        const ranged = elData.isEarth||elData.isAir||elData.isWater;
        const castFacing = ranged ? facingToward(currentEnemy.boardPosition,currentPlayer.boardPosition) : currentEnemy.facing;

        if(elData.isFire){
          const pulses=rolls[0].value, dmgEach=rolls[1].value;
          const base=pulses*dmgEach*SKILL_DICE_MULT;
          const acc=rollD100Accuracy();
          dmg=applyAccuracy(base,acc);
          const flank=getFlankBonus(currentEnemy.boardPosition,currentPlayer.boardPosition,currentPlayer.facing);
          if(flank.bonus>0) dmg+=flank.bonus;
          const tileBoost=getTileBoost(tiles,currentEnemy.boardPosition,'Fire');
          if(tileBoost>0) dmg+=tileBoost;
          addLog(`${currentEnemy.name} Ember Strike [${pulses} pulses x ${dmgEach*SKILL_DICE_MULT} = ${base}] ${acc}% (${accuracyTierLabel(acc)}) -> ${dmg} dmg${tileBoost>0?' [Fire tile +20]':''}`);
        } else if(elData.isEarth){
          const dieRoll=rolls[0].value;
          const maxRange=Math.max(1,Math.floor(dieRoll/2));
          const avail=Math.max(1,Math.min(maxRange, currentEnemy.actionpts-1));
          const chosenRange=avail;
          const line=getForwardTiles(currentEnemy.boardPosition,castFacing,chosenRange);
          const hit=line.some(t=>t.x===currentPlayer.boardPosition.x&&t.y===currentPlayer.boardPosition.y);
          const base=dieRoll*SKILL_DICE_MULT;
          const acc=rollD100Accuracy();
          const tileBoost=getTileBoost(tiles,currentEnemy.boardPosition,'Earth');
          dmg=hit?Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(base,acc))+tileBoost:0;
          eCost=1+chosenRange;
          addLog(`${currentEnemy.name} Tremor [d6=${dieRoll}, ${chosenRange} tile${chosenRange>1?'s':''}, ${acc}% (${accuracyTierLabel(acc)})] -> ${hit?dmg+' dmg'+(tileBoost>0?' [Earth tile +20]':''):'MISS'}`);
        } else if(elData.isAir){
          const dieRoll=rolls[0].value;
          const maxLine=getForwardTiles(currentEnemy.boardPosition,castFacing,SIZE);
          const playerStep=maxLine.findIndex(t=>t.x===currentPlayer.boardPosition.x&&t.y===currentPlayer.boardPosition.y);
          const playerDist=playerStep>=0?playerStep+1:-1;
          const canReach = playerDist>0 && playerDist<dieRoll;
          const chosenRange = canReach ? playerDist : Math.max(1,dieRoll-1);
          const base=Math.max(0,(dieRoll-chosenRange)*SKILL_DICE_MULT);
          const line=getForwardTiles(currentEnemy.boardPosition,castFacing,chosenRange);
          const hit=line.some(t=>t.x===currentPlayer.boardPosition.x&&t.y===currentPlayer.boardPosition.y);
          const acc=rollD100Accuracy();
          const tileBoost=getTileBoost(tiles,currentEnemy.boardPosition,'Air');
          dmg=hit?Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(base,acc))+tileBoost:0;
          eCost=2;
          if(hit){
            const kbPos=getKnockbackPos(currentPlayer.boardPosition,castFacing);
            const kbBlocked=!kbPos||(kbPos.x===currentEnemy.boardPosition.x&&kbPos.y===currentEnemy.boardPosition.y);
            if(kbPos&&!kbBlocked){
              updatedPlayer={...currentPlayer,boardPosition:kbPos};
              addLog(`${currentEnemy.name} Gale Force [d8=${dieRoll}, range ${chosenRange}, ${acc}% (${accuracyTierLabel(acc)})] -> ${dmg} dmg${tileBoost>0?' [Air tile +20]':''} + knockback`);
            } else {
              addLog(`${currentEnemy.name} Gale Force [d8=${dieRoll}, range ${chosenRange}, ${acc}% (${accuracyTierLabel(acc)})] -> ${dmg} dmg${tileBoost>0?' [Air tile +20]':''} (knockback blocked)`);
            }
          } else {
            addLog(`${currentEnemy.name} Gale Force [d8=${dieRoll}, range ${chosenRange}] -> MISS`);
          }
        } else if(elData.isWater){
          const dieRoll=rolls[0].value;
          const res=resolveTorrent(dieRoll);
          const anchor=getTorrentAnchor(currentEnemy.boardPosition,castFacing);
          const opts=getTorrentOptions(dieRoll,currentEnemy.actionpts).filter(o=>o.affordable);
          if(opts.length===0){
            dmg=0; eCost=Math.min(TORRENT_AOE_COST.single,currentEnemy.actionpts);
            addLog(`${currentEnemy.name} Torrent [d20=${dieRoll}] -> insufficient Energy, disperses`);
          } else {
            let chosen=null;
            for(const o of opts){
              const fp=getTorrentFootprint(anchor,o.aoe);
              if(fp.some(t=>t.x===currentPlayer.boardPosition.x&&t.y===currentPlayer.boardPosition.y)){ chosen=o; break; }
            }
            if(!chosen) chosen=opts[opts.length-1];
            eCost=chosen.cost;
            const footprint=getTorrentFootprint(anchor,chosen.aoe);
            const hit=footprint.some(t=>t.x===currentPlayer.boardPosition.x&&t.y===currentPlayer.boardPosition.y);
            const acc=rollD100Accuracy();
            const tileBoost=getTileBoost(tiles,currentEnemy.boardPosition,'Water');
            dmg=hit?applyAccuracy(res.damage,acc)+tileBoost:0;
            addLog(`${currentEnemy.name} Torrent [d20=${dieRoll}, ${res.damage} dmg, ${AOE_LABEL[chosen.aoe]}, ${acc}% (${accuracyTierLabel(acc)})] -> ${hit?dmg+' dmg'+(tileBoost>0?' [Water tile +20]':''):'MISS'}`);
          }
        }

        if(dmg>0){
          const newHP=Math.max(0,currentPlayer.health-dmg);
          updatedPlayer={...updatedPlayer,health:newHP};
          updatedEnemy={...currentEnemy,actionpts:Math.max(0,currentEnemy.actionpts-eCost),skillUsed:true,facing:castFacing};
          setPlayer(updatedPlayer); setEnemy(updatedEnemy);
          if(newHP<=0){addLog('=== DEFEAT ===');return;}
        } else if(heal>0){
          updatedEnemy={...currentEnemy,health:Math.min(currentEnemy.maxHealth,currentEnemy.health+heal),actionpts:Math.max(0,currentEnemy.actionpts-eCost),skillUsed:true,facing:castFacing};
          setEnemy(updatedEnemy);
        } else {
          updatedEnemy={...currentEnemy,actionpts:Math.max(0,currentEnemy.actionpts-eCost),skillUsed:true,facing:castFacing};
          setEnemy(updatedEnemy);
        }
      } else if(adjacent){
        const tier=enemyTier(currentEnemy.level);
        const flank=getFlankBonus(currentEnemy.boardPosition,currentPlayer.boardPosition,currentPlayer.facing);
        const dmg=tier.meleeBase+flank.bonus;
        const newHP=Math.max(0,currentPlayer.health-dmg);
        addLog(`${currentEnemy.name} melee ${dmg} dmg${flank.label?' ['+flank.label+']':''}${tier.heavy?' [heavy]':''}`);
        updatedPlayer={...currentPlayer,health:newHP};
        const eMeleeFacing=facingToward(currentEnemy.boardPosition,currentPlayer.boardPosition);
        updatedEnemy={...currentEnemy,actionpts:currentEnemy.actionpts-1,facing:eMeleeFacing};
        setPlayer(updatedPlayer); setEnemy(updatedEnemy);
        if(newHP<=0){addLog('=== DEFEAT ===');return;}
      } else {
        const tier=enemyTier(currentEnemy.level);
        const summonBlockers=summons.map(s=>s.boardPosition);
        const target=pickApproachTile(currentEnemy.boardPosition,currentPlayer.boardPosition,currentPlayer.facing,tier,[currentPlayer.boardPosition,...summonBlockers]);
        const goal = target || currentPlayer.boardPosition;
        const curDist = manhattan(currentEnemy.boardPosition, goal);
        const moves=getMoveToward(currentEnemy.boardPosition.x,currentEnemy.boardPosition.y,goal.x,goal.y);
        let moved=false;
        for(const m of moves){
          const onSummon=summons.some(s=>s.boardPosition.x===m.x&&s.boardPosition.y===m.y);
          if(m.x>=0&&m.x<SIZE&&m.y>=0&&m.y<SIZE&&!(m.x===currentPlayer.boardPosition.x&&m.y===currentPlayer.boardPosition.y)&&!onSummon){
            if(manhattan(m,goal) < curDist){
              const nf=facingFromMove(currentEnemy.boardPosition,m);
              updatedEnemy={...currentEnemy,boardPosition:m,facing:nf,actionpts:currentEnemy.actionpts-1};
              const tag = target ? (target.quality>=2?' [seeking blindspot]':target.quality>=1?' [seeking flank]':'') : '';
              addLog(`${currentEnemy.name} -> (${m.x},${m.y})${tag}`); moved=true; break;
            }
          }
        }
        if(!moved){
          const saved=currentEnemy.actionpts;
          addLog(`${currentEnemy.name} holds position — saving ${saved} Energy`);
          const restedEnemy={...currentEnemy,actionpts:0,energyRollover:(currentEnemy.energyRollover||0)+saved};
          setEnemy(restedEnemy);
          finishEnemyToPlayer(updatedPlayer,restedEnemy,currentRound);
          return;
        }
        setEnemy(updatedEnemy);
      }
      setTimeout(()=>{
        if(updatedEnemy.actionpts>0) runEnemyTurn(updatedEnemy,updatedPlayer,currentRound);
        else finishEnemyToPlayer(updatedPlayer,updatedEnemy,currentRound);
      },600);
    },900);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,tiles,summons,wave]);
  // ── ROUND ORCHESTRATION ──
  const beginRound = useCallback((rP, rE, currentRound)=>{
    summonPhaseRanRef.current = false; // reset; set true only if command phase runs
    setIsPlayerTurn(true);
    setEnergyPhase('roll');
    setSelectedSummonId(null);
    setSummonPhaseActive(false);
    setValidSquares([]);
    setHealingConsumed(consumed=>{
      if(consumed){
        setTiles(prevTiles=>relocateHealingTile(prevTiles, rP.boardPosition, rE.boardPosition, summons.map(s=>s.boardPosition)));
        addLog('// A new healing node materializes on the grid');
      }
      return false;
    });
    addLog('=== Your Turn — Roll Energy ===');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,summons]);

  const finishEnemyToPlayer = useCallback((latestPlayer, latestEnemy, currentRound)=>{
    if(latestPlayer.actionpts<=0 && latestEnemy.actionpts<=0){
      checkEndOfRound(latestPlayer, latestEnemy, currentRound);
      return;
    }
    setPlayer(latestPlayer);
    setEnemy(latestEnemy);
    startPlayerTurn(latestPlayer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[checkEndOfRound,startPlayerTurn]);

  // ── ENERGY ROLL ──
  const handleRollEnergy = useCallback(()=>{
    const roll = rollD12Energy();
    const rollover = player.energyRollover || 0;
    const frozenPenalty = player.frozen || 0;
    const total = roll + rollover;
    const newAP = Math.max(0, total - frozenPenalty);
    setPlayerRolledEnergy(total);
    addLog(`You roll d12=${roll}${rollover>0?` +${rollover} rollover`:''} = ${total} Energy${frozenPenalty>0?` (freeze -${frozenPenalty})`:''}  ->  ${newAP} AP`);
    const rolledPlayer = { ...player, actionpts:newAP, frozen:0, energyRollover:0 };
    setPlayer(rolledPlayer);
    if(summons.length>0){
      setEnemy(curE=>{ beginSummonCommandPhase(rolledPlayer, curE, round); return curE; });
    } else {
      setEnergyPhase('act');
      addLog('=== Spend your Energy ===');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[player,summons,round,addLog,beginSummonCommandPhase]);

  // ── ENEMY DEFEAT / REWARDS / WAVES ──
  const handleEnemyDefeated = useCallback((curPlayer, curWave)=>{
    const xpGain = 200 + curWave*120;
    const hexGain = 50 + curWave*25;
    addLog(`=== ${enemy.name} defeated! +${xpGain} XP, +${hexGain} Hexas ===`);
    setHexas(h=>h+hexGain);
    let leveled = { ...curPlayer, playerXp:(curPlayer.playerXp||0)+xpGain };
    leveled = applyLevelUp(leveled);
    setPlayer(leveled);

    const defeatedBoss = enemyTier(enemy.level).isBoss && enemy.level>=5;
    if(defeatedBoss && !classUnlocked){
      setClassUnlocked(true);
      setTimeout(()=>setShowClassModal(true), 900);
      addLog('=== A boss falls — new class path unlocked! ===');
    }
    setTimeout(()=>startNextWave(leveled), defeatedBoss && !classUnlocked ? 600 : 1400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[enemy,addLog,applyLevelUp,classUnlocked]);

  const startNextWave = useCallback((curPlayer)=>{
    const nextWave = wave + 1;
    const enemyLevel = nextWave;
    const freshEnemy = newGoblin(enemyLevel, curPlayer.boardPosition);
    const resetPlayer = { ...curPlayer, actionpts:0, frozen:0, skillUsed:false, rotateUsed:false, energyRollover:0,
      boardPosition: rollBackRowPosition(8) };
    const newTiles = makeTiles(resetPlayer.boardPosition, freshEnemy.boardPosition);
    setWave(nextWave);
    setRound(1);
    setEnemy(freshEnemy);
    setPlayer(resetPlayer);
    setTiles(newTiles);
    setSummons([]);            // summons do not persist across waves
    setSelectedSummonId(null);
    setSummonPhaseActive(false);
    setPlayerRolledEnergy(0);
    setEnemyRolledEnergy(0);
    setEnergyPhase('roll');
    setLockedRoll(null);
    setHealingConsumed(false);
    setIsPlayerTurn(true);
    const bossTag = enemyTier(enemyLevel).isBoss ? ' [BOSS]' : '';
    addLog(`=== Wave ${nextWave} — ${freshEnemy.name} (Lv${enemyLevel})${bossTag} ===`);
  },[wave,addLog]);

  // ── ROUTING AFTER A PLAYER ACTION ──
  // Whether the current round had a summon command phase (summons → enemy already
  // resolved). If so, after the player spends their remainder the round simply
  // ends. If not (legacy/no-summon or mid-turn deploy), the enemy is still owed a turn.
  const roundHadSummonPhase = useCallback(()=>summonPhaseRanRef.current===true,[]);

  const routeAfterPlayerAction = useCallback((updatedPlayer, updatedEnemy)=>{
    if(updatedEnemy.health<=0) return;
    if(updatedPlayer.actionpts>0){
      setPlayer(updatedPlayer);
      setEnemy(updatedEnemy);
      return; // player keeps acting
    }
    // Player exhausted pool.
    if(roundHadSummonPhase()){
      checkEndOfRound(updatedPlayer, updatedEnemy, round);
    } else {
      addLog('=== Enemy Turn ===');
      setIsPlayerTurn(false);
      setEnemyRolledEnergy(0);
      setTimeout(()=>runEnemyTurn({...updatedEnemy,actionpts:0}, updatedPlayer, round), 400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[round,addLog,checkEndOfRound,roundHadSummonPhase,runEnemyTurn]);

  // ── MELEE ──
  const handleMelee = useCallback(()=>{
    if(!canAttack) return;
    const flank=getFlankBonus(player.boardPosition,enemy.boardPosition,enemy.facing);
    const base=playerMeleeBase(player.level);
    const dmg=base+flank.bonus;
    const newHP=Math.max(0,enemy.health-dmg);
    const meleeFacing=facingToward(player.boardPosition,enemy.boardPosition);
    addLog(`You melee ${dmg} dmg${flank.label?' ['+flank.label+']':''}`);
    const updatedPlayer={...player,actionpts:player.actionpts-1,facing:meleeFacing};
    const updatedEnemy={...enemy,health:newHP};
    if(newHP<=0){
      setPlayer(updatedPlayer); setEnemy(updatedEnemy);
      handleEnemyDefeated(updatedPlayer, wave);
      return;
    }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[canAttack,player,enemy,wave,addLog,handleEnemyDefeated,routeAfterPlayerAction]);

  // ── END TURN / SURRENDER ──
  const handleEndTurn = useCallback(()=>{
    const saved = player.actionpts;
    if(saved>0) addLog(`You end your turn — saving ${saved} Energy as rollover`);
    else addLog('You end your turn');
    const updatedPlayer={...player,actionpts:0,energyRollover:(player.energyRollover||0)+saved};
    if(roundHadSummonPhase()){
      checkEndOfRound(updatedPlayer, enemy, round);
    } else {
      setPlayer(updatedPlayer);
      setIsPlayerTurn(false);
      setEnemyRolledEnergy(0);
      addLog('=== Enemy Turn ===');
      setTimeout(()=>runEnemyTurn({...enemy,actionpts:0}, updatedPlayer, round), 400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[player,enemy,round,addLog,checkEndOfRound,roundHadSummonPhase,runEnemyTurn]);

  const handleSurrender = useCallback(()=>{
    addLog('=== You surrendered. Restarting... ===');
    const p=initPlayer();
    const e=initEnemy(p);
    setPlayer(p); setEnemy(e); setTiles(makeTiles(p.boardPosition,e.boardPosition));
    setWave(1); setRound(1); setHexas(0);
    setPlayerRolledEnergy(0); setEnemyRolledEnergy(0); setEnergyPhase('roll');
    setIsPlayerTurn(true); setPlayerSel(false); setValidSquares([]);
    setSelCategory('base'); setSelElement('Fire');
    setLockedRoll(null); setHealingConsumed(false);
    setPlayerClass(null); setClassUnlocked(false); setSummons([]);
    setSummonPhaseActive(false); setSelectedSummonId(null);
    setLogs(['=== Battle Initiated ===','Move adjacent to attack. Position for bonuses.']);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog]);
  // ── SKILL / DICE FLOW ──
  const resetDiceModal = useCallback(()=>{
    setShowDice(false); setDiceRolls([]); setAbilities([]); setDicePhase('roll');
    setAccuracyRoll(null); setPendingAbility(null); setRolling(false);
    setAirRange(null); setEarthRange(null); setWaterAoe(null);
  },[]);

  const handleSkill = useCallback(()=>{
    if(!canSkill) return;
    // Resume a locked roll if one exists this round; else fresh.
    if(lockedRoll && lockedRoll.element===selElement){
      setDiceRolls(lockedRoll.rolls);
      setAbilities(lockedRoll.abilities||[]);
      setDicePhase(lockedRoll.phase||'roll');
      setAirRange(lockedRoll.airRange??null);
      setEarthRange(lockedRoll.earthRange??null);
      setWaterAoe(lockedRoll.waterAoe??null);
    } else {
      setDiceRolls([]); setAbilities([]); setDicePhase('roll');
      setAirRange(null); setEarthRange(null); setWaterAoe(null);
    }
    setAccuracyRoll(null); setPendingAbility(null);
    setShowDice(true);
  },[canSkill,lockedRoll,selElement]);

  const handleRoll = useCallback(()=>{
    setRolling(true);
    const el=ELEMENTS[selCategory][selElement];
    setTimeout(()=>{
      const rolls=el.dice.map(d=>({type:d,value:rollDie(parseInt(d.slice(1)))}));
      setDiceRolls(rolls);
      if(!el.isFire&&!el.isEarth&&!el.isAir&&!el.isWater){
        const ab=calcAbilities(selCategory,selElement,rolls);
        setAbilities(ab);
      }
      setRolling(false);
      setLockedRoll({element:selElement,rolls,phase:'roll'});
    },500);
  },[selCategory,selElement]);

  const handleRollAccuracy = useCallback(()=>{
    setRolling(true);
    setTimeout(()=>{ setAccuracyRoll(rollD100Accuracy()); setRolling(false); },500);
  },[]);

  // Generic (fusion) ability application
  const handleModalAbility = useCallback((ability,accuracy)=>{
    if(dicePhase==='roll'){
      setPendingAbility(ability);
      setDicePhase('accuracy');
      setAccuracyRoll(null);
      return;
    }
    const acc=accuracy??accuracyRoll??100;
    const el=ELEMENTS[selCategory][selElement];
    let cost=el.COST??1;
    let dmg=0, heal=0;
    if(ability.heal){ heal=ability.heal; }
    else { dmg=applyAccuracy(ability.damage,acc); }
    const flank=getFlankBonus(player.boardPosition,enemy.boardPosition,enemy.facing);
    if(dmg>0&&flank.bonus>0) dmg+=flank.bonus;

    let updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-cost),skillUsed:true};
    let updatedEnemy={...enemy};
    if(heal>0){ updatedPlayer.health=Math.min(updatedPlayer.maxHealth,updatedPlayer.health+heal); addLog(`${selElement} ${ability.name} — heal +${heal} HP`); }
    if(dmg>0){
      updatedEnemy.health=Math.max(0,enemy.health-dmg);
      addLog(`${selElement} ${ability.name} -> ${dmg} dmg${flank.label?' ['+flank.label+']':''} (${acc}% (${accuracyTierLabel(acc)}))`);
    }
    resetDiceModal();
    if(updatedEnemy.health<=0){
      setPlayer(updatedPlayer); setEnemy(updatedEnemy);
      handleEnemyDefeated(updatedPlayer, wave);
      return;
    }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[dicePhase,accuracyRoll,selCategory,selElement,player,enemy,wave,addLog,handleEnemyDefeated,resetDiceModal,routeAfterPlayerAction]);

  // Fire handlers
  const handleFireProceedToAccuracy = useCallback(()=>{ setDicePhase('accuracy'); setAccuracyRoll(null); },[]);
  const handleFireApplyWithAccuracy = useCallback((acc)=>{
    const pulses=diceRolls[0].value, dmgEach=diceRolls[1].value;
    const base=pulses*dmgEach*SKILL_DICE_MULT;
    let dmg=applyAccuracy(base,acc);
    const flank=getFlankBonus(player.boardPosition,enemy.boardPosition,enemy.facing);
    if(flank.bonus>0) dmg+=flank.bonus;
    const tileBoost=getTileBoost(tiles,player.boardPosition,'Fire');
    if(tileBoost>0) dmg+=tileBoost;
    const updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-3),skillUsed:true};
    const updatedEnemy={...enemy,health:Math.max(0,enemy.health-dmg)};
    addLog(`Ember Strike [${pulses}x${dmgEach*SKILL_DICE_MULT}=${base}] ${acc}% (${accuracyTierLabel(acc)}) -> ${dmg} dmg${flank.label?' ['+flank.label+']':''}${tileBoost>0?' [Fire tile +20]':''}`);
    resetDiceModal();
    if(updatedEnemy.health<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[diceRolls,player,enemy,tiles,wave,addLog,handleEnemyDefeated,resetDiceModal,routeAfterPlayerAction]);

  // Earth handlers
  const handleSetEarthRange = useCallback((r)=>setEarthRange(r),[]);
  const handleConfirmEarthRange = useCallback(()=>{ setDicePhase('accuracy'); setAccuracyRoll(null); },[]);
  const handleEarthApplyWithAccuracy = useCallback((acc)=>{
    const dieRoll=diceRolls[0].value;
    const base=dieRoll*SKILL_DICE_MULT;
    const line=getForwardTiles(player.boardPosition,player.facing,earthRange);
    const hit=line.some(t=>t.x===enemy.boardPosition.x&&t.y===enemy.boardPosition.y);
    const tileBoost=getTileBoost(tiles,player.boardPosition,'Earth');
    // Guaranteed floor on a landed hit — Earth should never tick for single digits.
    const dmg=hit?Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(base,acc))+tileBoost:0;
    const cost=1+earthRange;
    const updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-cost),skillUsed:true};
    const updatedEnemy={...enemy,health:Math.max(0,enemy.health-dmg)};
    addLog(`Tremor [d6=${dieRoll}, ${earthRange} tile${earthRange>1?'s':''}, ${acc}% (${accuracyTierLabel(acc)})] -> ${hit?dmg+' dmg'+(tileBoost>0?' [Earth tile +20]':''):'MISS (enemy not in line)'}`);
    resetDiceModal();
    if(updatedEnemy.health<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[diceRolls,player,enemy,tiles,earthRange,wave,addLog,handleEnemyDefeated,resetDiceModal,routeAfterPlayerAction]);

  // Air handlers
  const handleSetAirRange = useCallback((r)=>setAirRange(r),[]);
  const handleConfirmAirRange = useCallback(()=>{ setDicePhase('accuracy'); setAccuracyRoll(null); },[]);
  const handleAirApplyWithAccuracy = useCallback((acc)=>{
    const dieRoll=diceRolls[0].value;
    const base=Math.max(0,(dieRoll-airRange)*SKILL_DICE_MULT);
    const line=getForwardTiles(player.boardPosition,player.facing,airRange);
    const hit=line.some(t=>t.x===enemy.boardPosition.x&&t.y===enemy.boardPosition.y);
    const tileBoost=getTileBoost(tiles,player.boardPosition,'Air');
    // Guaranteed floor on any landed hit — a gust that connects no longer
    // "collapses" to 0 just because roll <= range.
    let dmg=hit?Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(base,acc))+tileBoost:0;
    let updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-2),skillUsed:true};
    let updatedEnemy={...enemy,health:Math.max(0,enemy.health-dmg)};
    if(hit){
      const kbPos=getKnockbackPos(enemy.boardPosition,player.facing);
      const kbBlocked=!kbPos||(kbPos.x===player.boardPosition.x&&kbPos.y===player.boardPosition.y);
      if(kbPos&&!kbBlocked){ updatedEnemy.boardPosition=kbPos; addLog(`Gale Force [d8=${dieRoll}, range ${airRange}, ${acc}% (${accuracyTierLabel(acc)})] -> ${dmg} dmg${tileBoost>0?' [Air tile +20]':''} + knockback`); }
      else addLog(`Gale Force [d8=${dieRoll}, range ${airRange}, ${acc}% (${accuracyTierLabel(acc)})] -> ${dmg} dmg${tileBoost>0?' [Air tile +20]':''} (knockback blocked)`);
    } else {
      addLog(`Gale Force [d8=${dieRoll}, range ${airRange}] -> MISS`);
    }
    resetDiceModal();
    if(updatedEnemy.health<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[diceRolls,player,enemy,tiles,airRange,wave,addLog,handleEnemyDefeated,resetDiceModal,routeAfterPlayerAction]);

  // Water handlers
  const handleSetWaterAoe = useCallback((aoe)=>setWaterAoe(aoe),[]);
  const handleWaterConfirm = useCallback(()=>{ setDicePhase('accuracy'); setAccuracyRoll(null); },[]);
  const handleWaterApplyWithAccuracy = useCallback((acc)=>{
    const dieRoll=diceRolls[0].value;
    const res=resolveTorrent(dieRoll);
    const anchor=getTorrentAnchor(player.boardPosition,player.facing);
    const footprint=getTorrentFootprint(anchor,waterAoe);
    const hit=footprint.some(t=>t.x===enemy.boardPosition.x&&t.y===enemy.boardPosition.y);
    const tileBoost=getTileBoost(tiles,player.boardPosition,'Water');
    const dmg=hit?applyAccuracy(res.damage,acc)+tileBoost:0;
    const cost=TORRENT_AOE_COST[waterAoe];
    const updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-cost),skillUsed:true};
    const updatedEnemy={...enemy,health:Math.max(0,enemy.health-dmg)};
    addLog(`Torrent [d20=${dieRoll}, ${res.damage} dmg, ${AOE_LABEL[waterAoe]}, ${acc}% (${accuracyTierLabel(acc)})] -> ${hit?dmg+' dmg'+(tileBoost>0?' [Water tile +20]':''):'MISS (enemy outside blast)'}`);
    resetDiceModal();
    if(updatedEnemy.health<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[diceRolls,player,enemy,tiles,waterAoe,wave,addLog,handleEnemyDefeated,resetDiceModal,routeAfterPlayerAction]);

  // ── ROTATE (0 cost, once per turn) ──
  const handleRotateOpen = useCallback(()=>{
    if(!canRotate) return;
    setRotateTargeting(true);
  },[canRotate]);

  const handleRotateConfirm = useCallback((direction)=>{
    const updatedPlayer={...player,facing:direction,rotateUsed:true};
    addLog(`You rotate to face ${direction}.`);
    setPlayer(updatedPlayer);
    setRotateTargeting(false);
  },[player,addLog]);

  // ── MASTERMIND (Summoner skill) ──
  const deployTiles = getDeployTiles(tiles, player.boardPosition, enemy.boardPosition, summons);
  const canDeploy = summons.length < BANDWIDTH && deployTiles.length > 0 && player.actionpts >= 2;
  const deployBlockedReason = summons.length>=BANDWIDTH ? `bandwidth full (${BANDWIDTH}/${BANDWIDTH})`
                            : deployTiles.length===0 ? 'no legal tiles on row 7'
                            : player.actionpts<2 ? 'need 2 Energy'
                            : '';

  const handleMastermind = useCallback(()=>{
    if(!canMastermind) return;
    setShowMmModal(true);
  },[canMastermind]);

  const handlePickDirect = useCallback(()=>{
    setShowMmModal(false);
    setCompassTargeting(true);
    addLog('// Compass Slash armed — click an adjacent tile (8-dir) where the enemy stands');
  },[addLog]);

  const resolveCompassSlash = useCallback((targetTile)=>{
    if(!isAdjacent8(player.boardPosition,targetTile)){ addLog('// Target not in the 8 surrounding tiles'); return; }
    const hitsEnemy = enemy.boardPosition.x===targetTile.x && enemy.boardPosition.y===targetTile.y;
    setCompassTargeting(false);
    if(!hitsEnemy){
      addLog('// Compass Slash strikes empty tile — 2 Energy spent');
      const updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-2),skillUsed:true};
      routeAfterPlayerAction(updatedPlayer, enemy);
      return;
    }
    const dmg=60;
    const slashFacing=facingToward(player.boardPosition,targetTile);
    const newHP=Math.max(0,enemy.health-dmg);
    addLog(`Compass Slash -> ${dmg} dmg (${newHP}/${enemy.maxHealth})`);
    const updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-2),skillUsed:true,facing:slashFacing};
    const updatedEnemy={...enemy,health:newHP};
    if(newHP<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[player,enemy,wave,addLog,handleEnemyDefeated,routeAfterPlayerAction]);

  const handlePickDeploy = useCallback(()=>{
    setShowMmModal(false);
    setShowDeploy(true);
    setDeployRoll(null); setDeployTier(null); setAwaitingPlacement(false);
  },[]);

  const handleDeployRoll = useCallback(()=>{
    setDeployRolling(true);
    setTimeout(()=>{
      const roll=rollD100();
      const tier=summonTierFromRoll(roll);
      setDeployRoll(roll); setDeployTier(tier); setDeployRolling(false);
      setAwaitingPlacement(true);
      addLog(`Circuit Sigil d100=${roll} -> ${tier} Novice. Pick a row-7 tile.`);
    },600);
  },[addLog]);

  const resolveDeployPlacement = useCallback((tile)=>{
    const legal=deployTiles.some(t=>t.x===tile.x&&t.y===tile.y);
    if(!legal){ addLog('// Illegal deploy tile'); return; }
    const s=makeSummon(deployTier, {x:tile.x,y:tile.y});
    setSummons(prev=>[...prev,s]);
    const updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-2),skillUsed:true};
    addLog(`◈ ${s.name} deployed at (${tile.x},${tile.y}). Bandwidth ${summons.length+1}/${BANDWIDTH}.`);
    setShowDeploy(false); setAwaitingPlacement(false); setDeployRoll(null); setDeployTier(null);
    routeAfterPlayerAction(updatedPlayer, enemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[deployTiles,deployTier,player,enemy,summons,addLog,routeAfterPlayerAction]);

  const handleCloseDeploy = useCallback(()=>{
    if(awaitingPlacement) return; // must place once rolled
    setShowDeploy(false); setDeployRoll(null); setDeployTier(null);
  },[awaitingPlacement]);

  const handleSelectClass = useCallback((classId)=>{
    setPlayerClass(classId);
    setShowClassModal(false);
    const meta=UNLOCKABLE_CLASSES.find(c=>c.id===classId);
    addLog(`=== Class equipped: ${meta?meta.name:classId}! ===`);
    showReward(`<h2 style="color:#9b6cff;letter-spacing:.1em">CLASS UNLOCKED</h2><p style="font-size:1.3rem;margin:10px 0;color:#b08cff">${meta?meta.icon+' '+meta.name:classId}</p><p style="color:#8ab5cc;font-size:.85rem;max-width:320px">${meta?meta.blurb:''}</p>`,3500);
  },[addLog,showReward]);

  // ── GRID CLICK ROUTER ──
  const handleSquareClick = useCallback((x,y)=>{
    // Deploy placement mode
    if(showDeploy && awaitingPlacement){ resolveDeployPlacement({x,y}); return; }
    // Compass Slash targeting mode
    if(compassTargeting){ resolveCompassSlash({x,y}); return; }
    // Summon command sub-phase
    if(summonPhaseActive && energyPhase==='summon'){
      const clickedSummon=summons.find(s=>s.boardPosition.x===x&&s.boardPosition.y===y);
      if(clickedSummon){
        if(actedSummonIds.includes(clickedSummon.id)){ addLog('// That summon already acted'); return; }
        setSelectedSummonId(clickedSummon.id);
        const fwd=summonForwardTile(clickedSummon);
        setValidSquares(fwd?[{x:fwd.x,y:fwd.y,distance:1}]:[]);
        return;
      }
      if(selectedSummonId){
        const s=summons.find(z=>z.id===selectedSummonId);
        if(s){
          const fwd=summonForwardTile(s);
          if(fwd&&fwd.x===x&&fwd.y===y){ resolveSummonAction(selectedSummonId,{x,y}); return; }
        }
        addLog('// Click the highlighted forward tile, or another summon');
      }
      return;
    }
    // Normal movement (act phase)
    if(!isPlayerTurn||energyPhase!=='act') return;
    const clickedSelf=player.boardPosition.x===x&&player.boardPosition.y===y;
    if(clickedSelf){ setPlayerSel(s=>!s); return; }
    if(!playerSel) return;
    const target=validSquares.find(s=>s.x===x&&s.y===y);
    if(!target) return;
    if(player.actionpts<target.distance){ addLog(`Not enough Energy (need ${target.distance})`); return; }
    const occupiedByEnemy=enemy.boardPosition.x===x&&enemy.boardPosition.y===y;
    const occupiedBySummon=summons.some(s=>s.boardPosition.x===x&&s.boardPosition.y===y);
    if(occupiedByEnemy||occupiedBySummon){ addLog('// Tile occupied'); return; }
    const oldPos=player.boardPosition;
    const newFacing=facingToward(oldPos,{x,y});
    let newTiles=tiles, healMsg=null, healedHP=player.health;
    const steppedTile=tiles[y][x];
    if(steppedTile===TILE_TYPES.HEALING){
      healedHP=Math.min(player.maxHealth,player.health+100);
      healMsg=`Healing node -> +100 HP (${healedHP}/${player.maxHealth})`;
      setHealingConsumed(true);
      newTiles=tiles.map(r=>r.slice()); newTiles[y][x]=TILE_TYPES.NORMAL;
      setTiles(newTiles);
    }
    const updatedPlayer={...player,boardPosition:{x,y},facing:newFacing,actionpts:player.actionpts-target.distance,health:healedHP};
    addLog(`You move to (${x},${y})${target.distance>1?` [-${target.distance}E]`:''}`);
    if(healMsg) addLog(healMsg);
    setPlayer(updatedPlayer);
    setPlayerSel(false);
    setValidSquares([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[showDeploy,awaitingPlacement,compassTargeting,summonPhaseActive,energyPhase,summons,actedSummonIds,selectedSummonId,isPlayerTurn,player,enemy,playerSel,validSquares,tiles,addLog,resolveDeployPlacement,resolveCompassSlash,summonForwardTile,resolveSummonAction]);

  // Auto-end the summon command phase once all summons have acted (or pool is empty)
  useEffect(()=>{
    if(!summonPhaseActive||energyPhase!=='summon') return;
    const allActed = summons.length>0 && summons.every(s=>actedSummonIds.includes(s.id));
    if(allActed){ const t=setTimeout(()=>endSummonCommandPhase(),300); return ()=>clearTimeout(t); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[summonPhaseActive,energyPhase,actedSummonIds,summons]);

  // Movement-range highlight while selected in the act phase
  useEffect(()=>{
    if(isPlayerTurn&&energyPhase==='act'&&playerSel&&player.actionpts>0){
      setValidSquares(calcAvailableSquares(player.boardPosition,player.actionpts));
    } else if(!summonPhaseActive){
      setValidSquares(prev=>prev.length?prev:prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isPlayerTurn,energyPhase,playerSel,player.actionpts,player.boardPosition]);

  // ── DERIVED RENDER VALUES ──
  // Compass Slash highlight: the 8 tiles around the player while targeting.
  const compassTiles = compassTargeting ? [
    {x:player.boardPosition.x+1,y:player.boardPosition.y},{x:player.boardPosition.x-1,y:player.boardPosition.y},
    {x:player.boardPosition.x,y:player.boardPosition.y+1},{x:player.boardPosition.x,y:player.boardPosition.y-1},
    {x:player.boardPosition.x+1,y:player.boardPosition.y+1},{x:player.boardPosition.x-1,y:player.boardPosition.y-1},
    {x:player.boardPosition.x+1,y:player.boardPosition.y-1},{x:player.boardPosition.x-1,y:player.boardPosition.y+1},
  ].filter(t=>t.x>=0&&t.x<SIZE&&t.y>=0&&t.y<SIZE) : [];
  // Deploy highlight: legal row-7 tiles while awaiting placement.
  const activeDeployTiles = (showDeploy && awaitingPlacement) ? deployTiles : [];
  // AoE preview overlay. v4.1: simplified — only Compass Slash contributes a
  // preview overlay here; deploy uses its own deployTile highlight, so the old
  // (always-empty when deploying) branch was redundant.
  const aoeTiles = compassTiles;
  const gridDeployHighlights = activeDeployTiles;

  // Initial healing-tile guarantee on first mount handled by makeTiles.
  const didInitRef = useRef(false);
  useEffect(()=>{ didInitRef.current=true; },[]);

  // Track viewport orientation so the rotate prompt reacts to resize/rotation.
  useEffect(()=>{
    if(typeof window==='undefined') return;
    const onResize=()=>setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize',onResize);
    window.addEventListener('orientationchange',onResize);
    onResize();
    return ()=>{
      window.removeEventListener('resize',onResize);
      window.removeEventListener('orientationchange',onResize);
    };
  },[]);

  // Grid square sizing: the battle row previously sized the grid purely off
  // available height (aspectRatio + height:100%), so a taller window grew the
  // square without any horizontal cap — it overflowed into the stat panel
  // (painted on top, since it's earlier in DOM) and under the combat log
  // (painted under, since it's later in DOM). Measure both the row's actual
  // width and the vertical slot's height, and size the square to the smaller
  // of the two so it can never exceed the space either column has.
  useLayoutEffect(()=>{
    const recompute = () => {
      if(!battleRowRef.current || !gridSlotRef.current) return;
      const rowWidth = battleRowRef.current.clientWidth;
      const availableHeight = gridSlotRef.current.clientHeight;
      const availableWidth = rowWidth - SIDE_PANEL_MIN_WIDTH*2 - MID_COL_H_PADDING;
      const next = Math.max(GRID_MIN_SIZE, Math.floor(Math.min(availableHeight, availableWidth)));
      setGridSize(prev => Math.abs(prev-next)>1 ? next : prev);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    if(battleRowRef.current) ro.observe(battleRowRef.current);
    window.addEventListener('resize', recompute);
    return () => { ro.disconnect(); window.removeEventListener('resize', recompute); };
  },[]);

  const enemyDistanceForAir = (()=>{
    const line=getForwardTiles(player.boardPosition,player.facing,SIZE);
    const idx=line.findIndex(t=>t.x===enemy.boardPosition.x&&t.y===enemy.boardPosition.y);
    return idx>=0?idx+1:0;
  })();
  const waterAnchor = getTorrentAnchor(player.boardPosition,player.facing);
  const waterAnchorInBounds = (()=>{
    const dir={up:{dx:0,dy:-1},down:{dx:0,dy:1},left:{dx:-1,dy:0},right:{dx:1,dy:0}}[player.facing]||{dx:0,dy:1};
    const tx=player.boardPosition.x+dir.dx*TORRENT_RANGE, ty=player.boardPosition.y+dir.dy*TORRENT_RANGE;
    return tx>=0&&tx<SIZE&&ty>=0&&ty<SIZE;
  })();
  const waterEnemyInFootprint = waterAoe ? getTorrentFootprint(waterAnchor,waterAoe).some(t=>t.x===enemy.boardPosition.x&&t.y===enemy.boardPosition.y) : false;
  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',backgroundImage:'radial-gradient(circle at 50% 0%, rgba(0,200,255,0.06), transparent 60%)',color:'#b0dff4',fontFamily:"'Rajdhani','Share Tech Mono',sans-serif",padding:'10px 12px 24px'}}>

      {/* Landscape-only: cover the screen with a rotate prompt in portrait. */}
      {isPortrait&&(
        <div style={{position:'fixed',inset:0,zIndex:9000,background:'#060a0e',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',padding:'2rem',gap:18}}>
          <div style={{fontSize:54,animation:'rotateHint 2s ease-in-out infinite',transformOrigin:'center'}}>📱</div>
          <div style={{fontFamily:"'Advent Pro',sans-serif",fontSize:'1.4rem',letterSpacing:'0.14em',textTransform:'uppercase',color:'#00c8ff',textShadow:'0 0 18px rgba(0,200,255,0.4)'}}>Rotate Your Device</div>
          <div style={{fontSize:'0.85rem',color:'#7a9db5',maxWidth:300,lineHeight:1.5}}>
            Paradigm Grid Battler is built for landscape. Turn your device sideways to play.
          </div>
          <div style={{fontSize:'0.62rem',letterSpacing:'0.15em',color:'#2a4a5e',fontFamily:'monospace',marginTop:6}}>// awaiting landscape //</div>
        </div>
      )}

      <div style={{maxWidth:1180,margin:'0 auto'}}>

        {/* Status bar */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:6}}>
          <div style={{display:'flex',alignItems:'baseline',gap:10}}>
            <h1 style={{fontFamily:"'Advent Pro',sans-serif",fontSize:'1.25rem',fontWeight:700,letterSpacing:'0.18em',textTransform:'uppercase',color:'#00c8ff',textShadow:'0 0 18px rgba(0,200,255,0.4)',margin:0}}>Paradigm</h1>
            <span style={{fontSize:'0.7rem',letterSpacing:'0.2em',color:'#3a6a8a',textTransform:'uppercase'}}>Grid Battler</span>
            <span style={{fontSize:'0.62rem',letterSpacing:'0.15em',color:'#2a4a5e',fontFamily:'monospace'}}>v4.3</span>
          </div>
          <div style={{display:'flex',gap:14,alignItems:'center',fontSize:'0.8rem',fontFamily:'monospace'}}>
            <span style={{color:'#7a9db5'}}>Wave <span style={{color:'#00c8ff',fontWeight:'bold'}}>{wave}</span></span>
            <span style={{color:'#7a9db5'}}>Round <span style={{color:'#00c8ff',fontWeight:'bold'}}>{round}</span></span>
            <span style={{color:'#7a9db5'}}>Hexas <span style={{color:'#ffd700',fontWeight:'bold'}}>{hexas}</span></span>
            {playerClass&&(()=>{const m=UNLOCKABLE_CLASSES.find(c=>c.id===playerClass);return <span style={{color:m.color,fontWeight:'bold',display:'flex',alignItems:'center',gap:3}}>{m.icon}{m.name}</span>;})()}
          </div>
        </div>

        {/* Proxy HP banner */}
        <div style={{marginBottom:8}}>
          <PanelBox style={{padding:'7px 12px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <span style={{fontSize:'0.72rem',letterSpacing:'0.14em',textTransform:'uppercase',color:'#00c8ff',whiteSpace:'nowrap'}}>Proxy — {player.name} <span style={{color:'#7a9db5'}}>Lv{player.level}</span></span>
              <div style={{flex:1,maxWidth:520}}><HealthBar current={player.health} max={player.maxHealth} /></div>
            </div>
          </PanelBox>
        </div>

        {/* Main row: ONE unified panel. Three sections (Proxy/Enemy + Skills,
            Grid, Combat Log) separated by vertical dividers instead of gaps
            between floating boxes — reclaims the inter-panel gutters for the
            cramped stat sections. Grid stays a height-limited square. */}
        <PanelBox style={{height:'calc(100dvh - 92px)',minHeight:320,padding:'12px',overflow:'hidden'}}>
          <div ref={battleRowRef} style={{display:'flex',minWidth:0,height:'100%'}}>
            {/* Left section: Proxy + Enemy stats + action buttons */}
            <div style={{flex:1,minWidth:SIDE_PANEL_MIN_WIDTH,display:'flex',flexDirection:'column',minHeight:0,paddingRight:12}}>
              <PlayerStatsPanel
                player={player} playerRolledEnergy={playerRolledEnergy}
                selectedCategory={selCategory} selectedElement={selElement}
                onElementSelect={(c,e)=>{setSelCategory(c);setSelElement(e);}}
                canAttack={canAttack} canSkill={canSkill}
                onMelee={handleMelee} onSkill={handleSkill} onEndTurn={handleEndTurn}
                onRollEnergy={handleRollEnergy} energyPhase={energyPhase}
                onSurrender={handleSurrender} enemy={enemy} enemyRolledEnergy={enemyRolledEnergy}
                isPlayerTurn={isPlayerTurn}
                playerClass={playerClass} summons={summons}
                canMastermind={canMastermind} onMastermind={handleMastermind}
                canRotate={canRotate} onRotate={handleRotateOpen}
              />
            </div>

            {/* Middle section: grid + tile legend. The square is sized in JS
                (gridSize, see the ResizeObserver effect above) to the smaller
                of the row's available width and the slot's available height,
                so it can never overflow into the side columns as the window
                is resized — previously it was sized purely off height, which
                let it grow past its column's width and overlap the neighbors. */}
            <div style={{flexShrink:0,width:gridSize+MID_COL_H_PADDING,height:'100%',display:'flex',flexDirection:'column',minHeight:0,alignItems:'center',padding:'0 12px'}}>
              <div ref={gridSlotRef} style={{flex:1,minHeight:0,width:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{width:gridSize,height:gridSize,flexShrink:0,display:'flex'}}>
                  <Grid
                    playerPos={player.boardPosition} enemyPos={enemy.boardPosition}
                    validSquares={validSquares} onSquareClick={handleSquareClick}
                    playerSelected={playerSel} tiles={tiles}
                    playerFacing={player.facing} enemyFacing={enemy.facing}
                    aoeTiles={aoeTiles} summons={summons} deployTiles={gridDeployHighlights}
                  />
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3, auto)',gap:'3px 12px',justifyContent:'center',alignItems:'center',marginTop:6,paddingTop:6,borderTop:'1px solid #1e3a4a',flexShrink:0}}>
                {TILE_LEGEND.map(l=>(
                  <div key={l.type} style={{display:'flex',alignItems:'center',gap:4,fontSize:'9px',color:'#5a7a8a',whiteSpace:'nowrap'}}>
                    <span style={{width:10,height:10,borderRadius:2,border:`1px solid ${l.border}`,background:l.bg,display:'inline-block',flexShrink:0}} />
                    {l.label}
                  </div>
                ))}
                {summons.length>0&&(
                  <div style={{display:'flex',alignItems:'center',gap:4,fontSize:'9px',color:'#b08cff',whiteSpace:'nowrap'}}>
                    <span style={{width:10,height:10,borderRadius:2,border:'1px solid #9b6cff',background:'rgba(155,108,255,0.2)',display:'inline-block',flexShrink:0}} />
                    Summon
                  </div>
                )}
              </div>
            </div>

            {/* Right section: Combat Log */}
            <div style={{flex:1,minWidth:SIDE_PANEL_MIN_WIDTH,display:'flex',flexDirection:'column',minHeight:0,paddingLeft:12}}>
              <CombatLog logs={logs} gridHeight />
            </div>
          </div>
        </PanelBox>

        {/* Tactical reference */}
        <div style={{marginTop:12}}>
          <PanelBox>
            <PanelTitle icon="//">Tactical Reference</PanelTitle>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:12,fontSize:'11px',color:'#7a9db5',lineHeight:1.5}}>
              <div>
                <div style={{color:'#00c8ff',fontWeight:'bold',marginBottom:4}}>Energy</div>
                Roll d12 at the start of each round. Movement costs 1 per tile. Unspent Energy banks as rollover; freeze subtracts next round.
              </div>
              <div>
                <div style={{color:'#ffd700',fontWeight:'bold',marginBottom:4}}>Positioning</div>
                Flanking +5, back attack +10. Face your target — attacks rotate you toward it. Rotate (⟳) freely faces you any direction for 0 Energy, once per turn. Healing nodes restore 100 HP and relocate. Standing on your element's boost tile adds +20 dmg.
              </div>
              <div>
                <div style={{color:'#ff6644',fontWeight:'bold',marginBottom:4}}>Skills</div>
                Once per round. Fire (3E pulses), Earth (1+tiles, ranged line, min {RANGED_SKILL_MIN_DMG} dmg on hit), Air (2E, knockback, min {RANGED_SKILL_MIN_DMG} dmg on hit), Water (2/6/10, AoE matrix). Roll locks for the round. Accuracy d100: ≥79 full · 40–78 half · under 40 quarter.
              </div>
              {playerClass==='Summoner'&&(
                <div style={{borderLeft:'2px solid #9b6cff',paddingLeft:10}}>
                  <div style={{color:'#b08cff',fontWeight:'bold',marginBottom:4}}>🜨 Mastermind <span style={{fontSize:'9px',color:'#5a7a8a'}}>(2E, 1/turn)</span></div>
                  <strong style={{color:'#c9b3ff'}}>Direct:</strong> Compass Slash — 60 dmg to any of 8 surrounding tiles.<br/>
                  <strong style={{color:'#c9b3ff'}}>Deploy:</strong> Circuit Sigil d100 → Bug (1–34) / Virus (35–67) / Malware (68–100). Places a Novice on row 7. Bandwidth {BANDWIDTH}.<br/>
                  <span style={{color:'#5a7a8a'}}>Turn order with summons: Summons → Enemy → You. Summons march forward; reaching the back row promotes to Agent (staged).</span>
                </div>
              )}
            </div>
          </PanelBox>
        </div>
      </div>

      {/* Modals */}
      <DiceModal
        show={showDice} category={selCategory} elementName={selElement}
        rolls={diceRolls} abilities={abilities} rolling={rolling}
        onRoll={handleRoll} onUseAbility={handleModalAbility} onClose={resetDiceModal}
        phase={dicePhase} accuracyRoll={accuracyRoll} onRollAccuracy={handleRollAccuracy}
        selectedAbilityForAccuracy={pendingAbility}
        airRange={airRange} onSetAirRange={handleSetAirRange} onConfirmAirRange={handleConfirmAirRange}
        onFireProceedToAccuracy={handleFireProceedToAccuracy} onFireApplyWithAccuracy={handleFireApplyWithAccuracy}
        earthRange={earthRange} onSetEarthRange={handleSetEarthRange} onConfirmEarthRange={handleConfirmEarthRange}
        onEarthApplyWithAccuracy={handleEarthApplyWithAccuracy}
        onAirApplyWithAccuracy={handleAirApplyWithAccuracy}
        onWaterConfirm={handleWaterConfirm} onWaterApplyWithAccuracy={handleWaterApplyWithAccuracy}
        waterAoe={waterAoe} onSetWaterAoe={handleSetWaterAoe}
        waterAvailableAP={player.actionpts}
        waterAnchorInBounds={waterAnchorInBounds} waterEnemyInFootprint={waterEnemyInFootprint}
        playerFacing={player.facing} enemyDistance={enemyDistanceForAir}
      />
      <ClassUnlockModal show={showClassModal} onSelect={handleSelectClass} onClose={()=>setShowClassModal(false)} />
      <MastermindModeModal
        show={showMmModal} canDeploy={canDeploy} deployReason={deployBlockedReason}
        onPickDirect={handlePickDirect} onPickDeploy={handlePickDeploy} onClose={()=>setShowMmModal(false)}
      />
      <DeployRollModal
        show={showDeploy} rolling={deployRolling} roll={deployRoll} tier={deployTier}
        awaitingPlacement={awaitingPlacement} onRoll={handleDeployRoll} onClose={handleCloseDeploy}
      />
      <RewardModal show={reward.show} html={reward.html} />

      {/* Compass targeting banner */}
      {compassTargeting&&(
        <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',background:'#080e14',border:'1px solid #9b6cff',borderRadius:8,padding:'10px 18px',color:'#b08cff',fontSize:13,zIndex:1500,boxShadow:'0 0 24px rgba(155,108,255,0.4)'}}>
          ⚔ Compass Slash — click a highlighted tile · <span onClick={()=>setCompassTargeting(false)} style={{color:'#5a7a8a',cursor:'pointer',textDecoration:'underline'}}>cancel</span>
        </div>
      )}
      {/* Rotate direction-picker banner */}
      {rotateTargeting&&(
        <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',background:'#080e14',border:'1px solid #00c8ff',borderRadius:8,padding:'10px 18px',color:'#00c8ff',fontSize:13,zIndex:1500,boxShadow:'0 0 24px rgba(0,200,255,0.4)',display:'flex',alignItems:'center',gap:10}}>
          <span>⟳ Face:</span>
          {['up','left','down','right'].map(d=>(
            <button key={d} onClick={()=>handleRotateConfirm(d)}
              style={{width:32,height:32,background:player.facing===d?'rgba(0,200,255,0.25)':'transparent',border:'1px solid #00c8ff',borderRadius:4,color:'#00c8ff',cursor:'pointer',fontSize:16,fontWeight:'bold'}}>
              {facingArrow(d)}
            </button>
          ))}
          <span onClick={()=>setRotateTargeting(false)} style={{color:'#5a7a8a',cursor:'pointer',textDecoration:'underline',marginLeft:4}}>cancel</span>
        </div>
      )}
      {summonPhaseActive&&(
        <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',background:'#080e14',border:'1px solid #9b6cff',borderRadius:8,padding:'10px 18px',color:'#b08cff',fontSize:13,zIndex:1500,boxShadow:'0 0 24px rgba(155,108,255,0.4)',display:'flex',alignItems:'center',gap:12}}>
          <span>🜨 Summon Command — {summons.filter(s=>!actedSummonIds.includes(s.id)).length} left · pool {player.actionpts}E</span>
          <span onClick={endSummonCommandPhase} style={{color:'#00cc66',cursor:'pointer',textDecoration:'underline'}}>Summons Done</span>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Advent+Pro:wght@400;600;700&family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');
        * { box-sizing: border-box; }
        #gridInstance {
          display: grid;
          grid-template-columns: repeat(${SIZE}, 1fr);
          grid-template-rows: repeat(${SIZE}, 1fr);
          gap: 2px;
          width: 100%;
          height: 100%;
          background: #060c12;
          border: 1px solid #1e3a4a;
          padding: 4px;
          border-radius: 4px;
        }
        .square {
          background: linear-gradient(135deg, #0d1a24, #081218);
          border: 1px solid #15293a;
          border-radius: 2px;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; cursor: pointer;
          transition: background 0.12s, box-shadow 0.12s, border-color 0.12s;
          color: #b0dff4; user-select: none;
        }
        .square.hovered { border-color: #00c8ff; box-shadow: inset 0 0 8px rgba(0,200,255,0.25); }
        .square.available { background: linear-gradient(135deg, #0a2535, #061520); border-color: #1e5a7a; box-shadow: inset 0 0 6px rgba(0,200,255,0.18); }
        .square.player { background: radial-gradient(circle, #00c8ff, #006a8a); border-color: #00e0ff; color: #001018; font-weight: bold; box-shadow: 0 0 12px rgba(0,200,255,0.55); }
        .square.playerSelected { animation: pulseCyan 1s infinite; }
        .square.enemy { background: radial-gradient(circle, #ff4422, #8a1500); border-color: #ff6644; color: #1a0500; font-weight: bold; box-shadow: 0 0 12px rgba(255,68,34,0.55); }
        .square.summon { background: radial-gradient(circle, #9b6cff, #5a2a9a); border-color: #b08cff; color: #fff; font-weight: bold; box-shadow: 0 0 10px rgba(155,108,255,0.55); }
        .square.aoePreview { box-shadow: inset 0 0 10px rgba(155,108,255,0.6); border-color: #9b6cff; }
        .square.deployTile { background: linear-gradient(135deg, #2a1a4a, #1a0a3a); border-color: #9b6cff; box-shadow: inset 0 0 8px rgba(155,108,255,0.4); animation: pulsePurple 1.1s infinite; }
        .square.tile-fire { background: linear-gradient(135deg,#4a0e0e,#1a0505); border-color: #ff6b00; }
        .square.tile-water { background: linear-gradient(135deg,#0d2a3d,#051420); border-color: #4aafee; }
        .square.tile-earth { background: linear-gradient(135deg,#3d2a0d,#201405); border-color: #c49a52; }
        .square.tile-air { background: linear-gradient(135deg,#1a2a3d,#0a1420); border-color: #80d4f8; }
        .square.tile-healing { background: linear-gradient(135deg,#0d3d0d,#052005); border-color: #00ff88; box-shadow: inset 0 0 8px rgba(0,255,136,0.3); }
        @keyframes pulseCyan { 0%,100%{box-shadow:0 0 12px rgba(0,200,255,0.55);} 50%{box-shadow:0 0 22px rgba(0,200,255,0.9);} }
        @keyframes pulseGold { 0%,100%{opacity:1;} 50%{opacity:0.65;} }
        @keyframes pulsePurple { 0%,100%{box-shadow:inset 0 0 8px rgba(155,108,255,0.4);} 50%{box-shadow:inset 0 0 14px rgba(155,108,255,0.8);} }
        @keyframes diceBounce { from{transform:translateY(0);} to{transform:translateY(-6px);} }
        @keyframes rotateHint { 0%,40%{transform:rotate(0deg);} 60%,100%{transform:rotate(-90deg);} }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #060c12; }
        ::-webkit-scrollbar-thumb { background: #1e3a4a; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #2a5a7a; }
      `}</style>
    </div>
  );
}
