import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { MATERIALS, rollEnemyDrop, MODIFIABLE_ELEMENTS, CUSTOM_SKILL_ENERGY_COST } from './ItemData.jsx';

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
export const ELEMENTS = {
  base: {
    Fire: {
      dice:['d4','d4'],
      color:'#ff6b00',
      icon:'🔥',
      description:'Roll 2×d4. Die 1 = pulse count. Die 2 = dmg per pulse ×20. Rolling 3+ pulses also sets the target Burning (10 dmg at the start of each of their next 2 turns) and Scorches their tile into a Fire tile. Cost: 3 Energy fixed.',
      isFire: true,
      base:{name:'Ember Strike',desc:'pulses × dmg × 20; 3+ pulses also Burns (10 dmg, 2 turns) and Scorches the tile',damage:0},
      thresholds:[],
      tierFormula:()=>0,
      accuracyApplies:true,
      COST: 3,
    },
    Water: {
      dice:['d20'],
      color:'#4aafee',
      icon:'🌊',
      description:'Roll d20. Dual-aspect matrix sets damage (50/80/120) and AoE (single/cross/spread). Range: 2 tiles forward. A roll of 10+ also Floods the whole cast footprint into Water tiles — just the anchor for Single, 5 tiles for Cross, all 9 for Spread. Cost scales 2/6/10 by AoE.',
      isWater: true,
      base:{name:'Torrent',desc:'d20 dual-aspect: damage × AoE; 10+ Floods the whole footprint',damage:0},
      thresholds:[],
      tierFormula:()=>0,
      accuracyApplies:true,
    },
    Earth: {
      dice:['d6'],
      color:'#c49a52',
      icon:'🪨',
      description:'Roll d6. Damage = roll×40. Max reach = floor(roll/2) tiles forward — commit exactly enough to reach and it\'s a cheap, clean hit; commit farther than needed and every other tile in that span cracks into rubble (an obstacle blocking movement and skills until destroyed). A pre-existing obstacle stops the shockwave cold. Cost: 1 + chosen tiles.',
      isEarth: true,
      base:{name:'Tremor',desc:'roll×40 dmg; overreach turns spare tiles into rubble',damage:0},
      thresholds:[],
      tierFormula:()=>0,
      accuracyApplies:true,
      COST_BASE: 1,
    },
    Air: {
      dice:['d8'],
      color:'#80d4f8',
      icon:'💨',
      description:'Roll d8 — that\'s both your reach and your power. Hits anything up to that many tiles ahead; damage scales 40 (roll 1) to 180 (roll 8) in steps of 20, regardless of range. Whatever roll you don\'t spend reaching the target becomes knockback (minimum 1 tile), until they hit a wall. Cost: 2 Energy flat.',
      isAir: true,
      base:{name:'Gale Force',desc:'40–180 dmg in steps of 20, range = roll, leftover = knockback',damage:0},
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
export const getXPThreshold = (level) => Math.floor(1000 * Math.pow(level, 1.5));
// Per-die damage multiplier for Fire / Air base skills (v4.3: 10 -> 20).
// Raises skill output so a skill reliably out-damages an equivalent melee stack.
// Water uses its own fixed tiers in resolveTorrent instead. Earth uses its own
// higher multiplier (EARTH_DICE_MULT) rather than this one -- its single d6
// needs to hit harder than Fire/Air's two-factor rolls to stay competitive.
const SKILL_DICE_MULT = 20;
const EARTH_DICE_MULT = 40;
const rollDie = (sides) => Math.floor(Math.random() * sides) + 1;
const rollD100Accuracy = () => Math.floor(Math.random() * 91) + 10;
const rollD100 = () => Math.floor(Math.random() * 100) + 1;
// Accuracy bracket (v4.3): a d100 accuracy roll maps to a damage multiplier in
// three tiers rather than scaling continuously. This removes the "roll high then
// whiff accuracy" gut-punch — clearing 79 gives full damage, and even a poor
// roll floors at quarter rather than as low as 10%.
//   roll >= 79  -> full damage
//   40..78      -> half  (rounded to the nearest 10)
//   < 40        -> quarter (rounded to the nearest 10)
// Every base damage value already lands on a multiple of 10 at full
// accuracy (Fire/Earth/Air/Water's own dice formulas are all multiples of
// 20), but half/quarter used to floor() straight off the raw fraction,
// which produces an odd number (e.g. 70 -> 35 -> 17) whenever the base
// isn't itself a multiple of 40. Rounding to the nearest 10 here instead
// keeps every possible result -- at any tier, for any skill -- a clean
// base-10 number, without having to retune each skill's own base damage
// constant individually. Applies to both player and enemy (all damage
// routes through here).
const ACCURACY_FULL = 79, ACCURACY_HALF = 40;
const applyAccuracy = (base, roll) => {
  if(roll >= ACCURACY_FULL) return base;
  const raw = roll >= ACCURACY_HALF ? base * 0.5 : base * 0.25;
  return Math.round(raw / 10) * 10;
};
// Label for a given accuracy roll's tier (for combat-log clarity).
const accuracyTierLabel = (roll) => roll>=ACCURACY_FULL ? 'full' : roll>=ACCURACY_HALF ? 'half' : 'quarter';
const rollD12Energy = () => rollDie(12);
// Decides who acts first each round in Gauntlet/Training (1v1) matches --
// a d12 roll-off, rerolled on ties, entirely separate from either side's own
// Energy-pool d12 roll (does not consume or affect it). Not used by Campaign,
// which keeps its fixed Summons -> Player -> Enemy order.
const rollInitiative = () => {
  let p, e;
  do { p = rollD12Energy(); e = rollD12Energy(); } while(p === e);
  return { winner: p > e ? 'player' : 'enemy', p, e };
};

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

// Preferred moves toward `to` first (getMoveToward's dominant-axis pick),
// then the remaining orthogonal directions as a reroute fallback — so a
// directed move (flee-to-heal, etc.) whose direct path is blocked by a
// player/summon sidesteps around it instead of standing still burning
// Energy every remaining step of the turn declaring itself blocked.
const getMoveCandidatesWithReroute = (from, to) => {
  const primary = getMoveToward(from.x, from.y, to.x, to.y);
  const allDirs = [{x:from.x+1,y:from.y},{x:from.x-1,y:from.y},{x:from.x,y:from.y+1},{x:from.x,y:from.y-1}];
  const detour = allDirs.filter(m=>!primary.some(p=>p.x===m.x&&p.y===m.y));
  return [...primary, ...detour];
};

// How many tiles an enemy's approach step covers per AI action — previously
// hardcoded to 1, which read as sluggish next to how far a player can dash
// in a single move click. Still capped by available Energy (1 AP/tile), same
// economy as before, just no longer stopping after the first tile.
const ENEMY_MOVE_SPEED = 2;

// Greedily walks up to `speed` tiles toward `goal` (re-picking the dominant
// direction each step via getMoveToward, same as the old single-step logic,
// so it still curves around a blocked lane instead of giving up outright),
// stopping early if a step would land on `blockers`, wouldn't reduce
// remaining distance, the goal is reached, or `actionpts` runs out. Returns
// {pos, facing, steps} — `steps` is how many tiles were actually taken (0 if
// none were possible, same meaning as the old "not moved" case).
const walkTowardGoal = (fromPos, fromFacing, goal, blockers, actionpts, speed) => {
  let pos=fromPos, facing=fromFacing, steps=0;
  while(steps<speed && steps<actionpts){
    const curDist=manhattan(pos,goal);
    if(curDist===0) break;
    const moves=getMoveToward(pos.x,pos.y,goal.x,goal.y);
    const next=moves.find(m=>m.x>=0&&m.x<SIZE&&m.y>=0&&m.y<SIZE&&manhattan(m,goal)<curDist&&!blockers.some(b=>b.x===m.x&&b.y===m.y));
    if(!next) break;
    facing=facingFromMove(pos,next);
    pos=next;
    steps++;
  }
  return {pos,facing,steps};
};

const isAdjacent = (a,b) => { const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y); return (dx===1&&dy===0)||(dx===0&&dy===1); };
// 8-directional adjacency (orthogonal + diagonal) — used by Compass Slash.
const isAdjacent8 = (a,b) => { const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y); return dx<=1&&dy<=1&&(dx+dy)>0; };
// Chess-knight offsets (±1,±2)/(±2,±1) — Rogue's Dark Web attack pattern.
const KNIGHT_OFFSETS = [
  {dx:1,dy:2},{dx:1,dy:-2},{dx:-1,dy:2},{dx:-1,dy:-2},
  {dx:2,dy:1},{dx:2,dy:-1},{dx:-2,dy:1},{dx:-2,dy:-1},
];
const getKnightTiles = (pos) => KNIGHT_OFFSETS
  .map(o=>({x:pos.x+o.dx,y:pos.y+o.dy}))
  .filter(t=>t.x>=0&&t.x<SIZE&&t.y>=0&&t.y<SIZE);
const isKnightMove = (a,b) => KNIGHT_OFFSETS.some(o=>a.x+o.dx===b.x&&a.y+o.dy===b.y);
const facingFromMove = (o,n) => { const dx=n.x-o.x,dy=n.y-o.y; if(dx>0)return'right';if(dx<0)return'left';if(dy>0)return'down';if(dy<0)return'up';return'down'; };

// The 4 diagonal directions — Longshot Protocol's line of sight. Pulse
// Wave's own 8-direction axis is derived per-click via findAxisDirection
// instead of enumerated up front.
const DIAGONAL_DIRS = [{dx:1,dy:1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:-1,dy:-1}];
// Straight line of tiles from `pos` along an arbitrary {dx,dy} unit vector,
// clipped to the board — same shape as getForwardTiles but not limited to
// the 4 cardinal facings, since Pulse Wave/Longshot Protocol also need the
// diagonals.
const getAxisLine = (pos, dir, count) => {
  const tiles=[];
  for(let i=1;i<=count;i++){
    const x=pos.x+dir.dx*i, y=pos.y+dir.dy*i;
    if(x<0||x>=SIZE||y<0||y>=SIZE) break;
    tiles.push({x,y});
  }
  return tiles;
};
// Which of the 8 axis directions `to` lies on from `from`, or null if it's
// off-axis entirely (not a straight line or exact diagonal).
const findAxisDirection = (from, to) => {
  const dx=to.x-from.x, dy=to.y-from.y;
  if(dx===0&&dy===0) return null;
  if(dx===0) return {dx:0,dy:dy>0?1:-1};
  if(dy===0) return {dx:dx>0?1:-1,dy:0};
  if(Math.abs(dx)===Math.abs(dy)) return {dx:dx>0?1:-1,dy:dy>0?1:-1};
  return null;
};
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

// Knocks `targetPos` back `distance` tiles along `castFacing`, going as far
// as it can and stopping at the board edge ("hits a wall"), a unit blocker
// (the caster's own tile, another combatant), or rubble. Always returns a
// valid tile — the original position if it can't move at all. `obstacles`
// is the actual rubble list (not just positions) so a stop caused by rubble
// specifically can be reported back as `hitObstacle` — callers use that to
// deal the knockback's own collision damage into it (a unit blocker, by
// contrast, isn't a destructible thing and takes no collision damage). Used
// for Air Gale Force knockback, whose distance is now roll-minus-range (see
// airGaleForceDamage for the matching roll-based damage table).
const getKnockbackTile = (targetPos, castFacing, distance, unitBlockers=[], obstacles=[]) => {
  const dir = {up:{dx:0,dy:-1},down:{dx:0,dy:1},left:{dx:-1,dy:0},right:{dx:1,dy:0}}[castFacing]||{dx:0,dy:1};
  const blockers = unitBlockers ? (Array.isArray(unitBlockers)?unitBlockers:[unitBlockers]) : [];
  let x=targetPos.x, y=targetPos.y, hitObstacle=null;
  for(let i=0;i<distance;i++){
    const nx=x+dir.dx, ny=y+dir.dy;
    if(nx<0||nx>=SIZE||ny<0||ny>=SIZE) break;
    if(blockers.some(b=>nx===b.x&&ny===b.y)) break;
    const obs=obstacles.find(o=>o.boardPosition.x===nx&&o.boardPosition.y===ny);
    if(obs){ hitObstacle=obs; break; }
    x=nx; y=ny;
  }
  return {x,y,hitObstacle};
};
// Air Gale Force's damage table — flat multiples of SKILL_DICE_MULT (20) so
// it adds up in your head at the table: 40/60/80/100/120/140/160/180 for
// rolls 1-8 (before accuracy). Independent of range: the same roll also sets
// max reach (hit if actual distance <= roll) and leftover roll becomes
// knockback distance (see getKnockbackTile), so a high roll no longer costs
// damage the way it used to.
const airGaleForceDamage = (roll) => (roll+1)*SKILL_DICE_MULT;
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

// skillUsed gates elemental skills; classSkillUsed gates the enemy side's
// single class ability (enemies still work the old class-locked way — see
// the Battle Skills note above BATTLE_SKILLS) as a separate once-per-round
// limit. The player side now tracks the same "once per round" rule per
// loadout skill instead, via usedSkillIds (see markSkillUsed) — each
// equipped Tactical/Core skill gets its own independent use, since a
// loadout can hold more than one at a time.
const makeCharacter = (name,hp,level,agi,ap,pos,element,elementCategory) => ({
  name,level,agi,health:hp,maxHealth:hp,actionpts:ap,boardPosition:pos,
  playerXp:0,facing:'down',frozen:0,slowed:false,skillUsed:false,rotateUsed:false,classSkillUsed:false,
  usedSkillIds:[],
  element:element||null,elementCategory:elementCategory||null,energyRollover:0,
  burn:null, // Fire's Burn status — {turns,dmg}; ticks at the start of this unit's own turn, see tickBurn
});
// Burn (Fire's terrain/status effect): a flat-damage DoT applied whenever a
// base Fire hit lands. Ticks at the start of the afflicted unit's own turn
// (mirrors how `frozen` is consumed there) — deals `dmg`, decrements
// `turns`, and clears once it hits 0. A fresh Fire hit refreshes the
// duration back to BURN_TURNS rather than stacking additional simultaneous
// burns, so repeated Ember Strikes keep someone burning without the DoT
// damage snowballing turn over turn.
const BURN_TURNS = 2;
const BURN_DMG = 10;
const applyBurn = (target) => ({...target, burn:{turns:BURN_TURNS, dmg:BURN_DMG}});
// Returns {unit, tickDmg, tickLog} — `unit` has burn ticked down (or
// cleared) and HP reduced; `tickDmg`/`tickLog` are 0/null when no burn was
// active.
const tickBurn = (unit) => {
  if(!unit.burn) return {unit, tickDmg:0, tickLog:null};
  const dmg = unit.burn.dmg;
  const newHealth = Math.max(0, unit.health-dmg);
  const turnsLeft = unit.burn.turns-1;
  const burn = turnsLeft>0 ? {...unit.burn, turns:turnsLeft} : null;
  return {unit:{...unit, health:newHealth, burn}, tickDmg:dmg, tickLog:`${unit.name} burns for ${dmg} dmg${burn?` (${turnsLeft} turn${turnsLeft>1?'s':''} left)`:' (burn fades)'}`};
};
// Marks `skillId` as used-this-round on a player object, for the loadout's
// per-skill once-per-round gate.
const markSkillUsed = (p, skillId) => ({...p, usedSkillIds:[...(p.usedSkillIds||[]), skillId]});

// ─── SUMMONS (Circuit Sigil skill) ──────────────────────────────────────────────
// Novice summons deployed via Circuit Sigil. Provisional stats for v4.0;
// behavior is forward-only toward the enemy back row (row 0). Bug / Virus /
// Malware share Novice behavior this pass (Virus species ability + Malware
// custom behavior are staged pending species/crafting systems).
const SUMMON_HP = 100;
const SUMMON_ATK = 30;
const SUMMON_MOVE = 1;          // tiles forward per summon turn
const BANDWIDTH = 2;            // max simultaneous summons
const SUMMON_ROW = 7;          // player Summoner's deploy row (row 8 is the player's own spawn row)
const ENEMY_SUMMON_ROW = 1;    // enemy Summoner's deploy row (row 0 is the enemy's own spawn row)
const ENEMY_BACK_ROW = 0;      // promotion line (Novice -> Agent)

// Pawn geometry, shared by every summon regardless of who owns it or which
// engine is running: move is one tile straight ahead (never diagonal, never
// backward — `facing` is fixed at spawn and can't turn), but the class
// attacks any of the 3 tiles directly ahead of it (left/center/right),
// widening a pawn's diagonal-only capture into "anything in front." Pure
// geometry off boardPosition/facing, so it works identically for a
// player-side summon marching toward row 0 and an enemy-side one marching
// toward row 8.
const summonForwardTile = (s) => {
  const dy = s.facing==='down' ? 1 : -1;
  const ahead = {x:s.boardPosition.x, y:s.boardPosition.y+dy};
  if(ahead.y<0||ahead.y>=SIZE) return null;
  return ahead;
};
const summonAttackTiles = (s) => {
  const dy = s.facing==='down' ? 1 : -1;
  const y = s.boardPosition.y+dy;
  if(y<0||y>=SIZE) return [];
  return [-1,0,1].map(dx=>({x:s.boardPosition.x+dx,y})).filter(t=>t.x>=0&&t.x<SIZE);
};

// d100 tier bands for the Circuit Sigil summon roll.
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
// `side`/`ownerId` let Campaign mode's shared `summons` array hold both
// player- and enemy-deployed Novices at once. Player summons (side:'player')
// march toward row 0 as before; enemy summons (side:'enemy') march the
// opposite direction, toward the player (row 8).
const makeSummon = (tier, pos, side='player', ownerId=null) => ({
  id: `S${++SUMMON_SEQ}`,
  tier,
  name: `${tier} Novice`,
  health: SUMMON_HP,
  maxHealth: SUMMON_HP,
  atk: SUMMON_ATK,
  boardPosition: pos,
  facing: side==='enemy' ? 'down' : 'up', // fixed marching direction, cannot turn
  promoted: false,       // becomes true on reaching the far row (Agent — staged)
  side,
  ownerId,
  actedRound: -1,        // last round this summon acted -- rate-limits enemy-side
                          // autonomous commanding to one action per round, same as
                          // actedSummonIds does for player-commanded summons
});

// ─── EARTH OBSTACLES ────────────────────────────────────────────────────────
// Rubble raised by a Tremor. Stationary — never moves, never attacks, never
// promotes. Lives in its own `obstacles` array (not `summons`) so none of the
// summon-turn/bandwidth/promotion machinery has to know about it; it only
// needs to occupy a tile (movement/deploy/knight-tile blocking) and absorb
// damage (line-based skill hits) until destroyed. HP reuses the flat Novice
// summon value — a wall built out of the same stuff a Novice is worth
// fighting through.
const OBSTACLE_HP = SUMMON_HP;
const OBSTACLE_META = { color:'#a08860', icon:'🧱', name:'Rubble' };
let OBSTACLE_SEQ = 0;
const makeObstacle = (pos) => ({ id:`OBS${++OBSTACLE_SEQ}`, boardPosition:pos, health:OBSTACLE_HP, maxHealth:OBSTACLE_HP });

// Resolves an Earth Tremor's line of effect: `chosenRange` sets how many
// tiles the caster commits energy to (cost = 1 + chosenRange, same as
// before) — reaching exactly as far as a target needs is cheap and tidy;
// committing farther than that costs more but cracks every *other* tile in
// that span into rubble, in front of AND behind the target. A tile a target
// occupies never turns to rubble; a pre-existing obstacle instead stops the
// shockwave cold (nothing beyond it is affected, and it takes the hit
// itself — an Earth cast reinforces/heals rubble it strikes rather than
// damaging it, see the `heal:true` obstacleHit callers) — rubble doesn't
// crack through rubble. `occupiedExtra` is every other tile that should
// block a *new* obstacle from spawning there (other targets not being hit
// this cast, summons, etc) without itself stopping the shockwave. `tiles`
// is the terrain grid — a Healing tile is excluded from `newObstacleTiles`
// the same way an occupied tile is, so a shockwave can't bury it under
// rubble.
const resolveEarthTremor = (origin, chosenRange, targets, obstacles, occupiedExtra=[], tiles=null) => {
  const rawLine = getForwardTiles(origin.boardPosition, origin.facing, chosenRange);
  let span = rawLine;
  let hitObstacle = null;
  for(let i=0;i<rawLine.length;i++){
    const t=rawLine[i];
    const existing = obstacles.find(o=>o.boardPosition.x===t.x&&o.boardPosition.y===t.y);
    if(existing){ hitObstacle=existing; span=rawLine.slice(0,i+1); break; }
  }
  // `span` already excludes anything past the first obstacle, so a target
  // beyond it simply won't be found here — a target *in front of* the
  // obstacle still takes the hit (the obstacle only blocks what's behind
  // it, not what's closer than itself).
  const hitTarget = targets.find(e=>span.some(t=>t.x===e.boardPosition.x&&t.y===e.boardPosition.y));
  const occupied = [...obstacles.map(o=>o.boardPosition), ...occupiedExtra];
  const newObstacleTiles = span.filter(t=>!occupied.some(o=>o.x===t.x&&o.y===t.y) && !(tiles && tiles[t.y][t.x]===TILE_TYPES.HEALING));
  return { span, hitObstacle: hitTarget?null:hitObstacle, hitTarget, newObstacleTiles };
};

// Nearest obstacle along a forward line within `maxDist` tiles, or null.
// Air's Gale Force (and anything else that travels a line rather than just
// checking a footprint) uses this to redirect a shot into whatever rubble
// is in the way before it ever reaches its actual target.
const findLineObstacle = (originPos, facing, maxDist, obstacles) => {
  const line = getForwardTiles(originPos, facing, maxDist);
  for(let i=0;i<line.length;i++){
    const t=line[i];
    const hit=obstacles.find(o=>o.boardPosition.x===t.x&&o.boardPosition.y===t.y);
    if(hit) return {obstacle:hit, dist:i+1};
  }
  return null;
};

const TILE_LEGEND = [
  {type:'fire_boost', label:'Fire: +20 dmg',  border:'#ff6b00',bg:'linear-gradient(135deg,#4a0e0e,#1a0505)'},
  {type:'water_boost',label:'Water: +20 dmg', border:'#4aafee',bg:'linear-gradient(135deg,#0d2a3d,#051420)'},
  {type:'earth_boost',label:'Earth: +20 dmg', border:'#c49a52',bg:'linear-gradient(135deg,#3d2a0d,#201405)'},
  {type:'air_boost',  label:'Air: +20 dmg',   border:'#80d4f8',bg:'linear-gradient(135deg,#1a2a3d,#0a1420)'},
  {type:'healing',    label:'Heal: +100 HP',  border:'#00ff88',bg:'linear-gradient(135deg,#0d3d0d,#052005)'},
];

const makeTiles = (playerPos,enemyPos,extraOccupied=[]) => {
  const grid=Array.from({length:SIZE},()=>Array(SIZE).fill(TILE_TYPES.NORMAL));
  const occupied=[playerPos,enemyPos,...extraOccupied];
  ['fire','water','earth','air'].forEach(el=>{
    for(let i=0;i<2;i++){const pos=getRandomFreePosition(occupied);grid[pos.y][pos.x]=`${el}_boost`;occupied.push(pos);}
  });
  const h=getRandomFreePosition(occupied); grid[h.y][h.x]=TILE_TYPES.HEALING;
  return grid;
};

// Terrain-free grid — used by tutorial scenes that aren't teaching terrain yet.
const makePlainTiles = () => Array.from({length:SIZE},()=>Array(SIZE).fill(TILE_TYPES.NORMAL));

// Training Mode scene registry — shared between GridBattlerGame (which reads
// `scene` to configure a focused single-battle lesson) and the Tutorial Hub
// screen (which reads it to render the selection cards).
export const TUTORIAL_SCENES = [
  { id:'movement', name:'Movement & Melee',   icon:'🧭', color:'#00c8ff',
    blurb:'Learn tile movement, positioning, and basic melee combat. No elemental skill or Tactical Skills yet.' },
  { id:'skills',   name:'Battle Skills',       icon:'⚔',  color:'#9b6cff',
    blurb:'Every Tactical Skill unlocked immediately — toggle Compass Slash and Dark Web freely to try them.' },
  { id:'elements', name:'Elements & Terrain', icon:'🔥', color:'#ff6b00',
    blurb:'Cast Fire, Water, Earth, or Air freely on a grid with elemental boost and healing tiles.' },
];

const calcAvailableSquares = (pos,ap) => {
  const sq=[];
  for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++){
    const dist=Math.abs(x-pos.x)+Math.abs(y-pos.y);
    if(dist>0&&dist<=ap) sq.push({x,y,distance:dist});
  }
  return sq;
};

// Legal Deploy tiles on `row`: normal tile only (no boost/healing), not
// occupied by the player, any enemy, or an existing summon. Shared by both
// sides — the player always deploys on SUMMON_ROW, an enemy Summoner always
// deploys on ENEMY_SUMMON_ROW, regardless of where the casting unit itself
// is currently standing. A fixed row (rather than "wherever the caster
// happens to be") is what keeps a summon's spawn point predictable instead
// of appearing anywhere the caster has wandered to.
const getDeployTilesOnRow = (row, tiles, playerPos, enemyPositions, summons) => {
  const enemyList = Array.isArray(enemyPositions) ? enemyPositions : [enemyPositions];
  const out=[];
  for(let x=0;x<SIZE;x++){
    const y=row;
    if(tiles?.[y]?.[x]!==TILE_TYPES.NORMAL) continue;
    if(playerPos.x===x&&playerPos.y===y) continue;
    if(enemyList.some(p=>p.x===x&&p.y===y)) continue;
    if(summons.some(s=>s.boardPosition.x===x&&s.boardPosition.y===y)) continue;
    out.push({x,y});
  }
  return out;
};
const getDeployTiles = (tiles, playerPos, enemyPositions, summons) =>
  getDeployTilesOnRow(SUMMON_ROW, tiles, playerPos, enemyPositions, summons);

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

// Piercing Light — a 2-tile-forward thrust melee. Base cost hits both tiles
// for PIERCING_LIGHT_BASE_DMG; every Energy point committed beyond the base
// cost buffs that same damage on both tiles, the same shape as Melee's own
// burst-multiplier scaling (see meleeBurstMultiplier) but framed as a flat
// per-point damage add rather than a hit-count multiplier.
const PIERCING_LIGHT_BASE_COST = 3;
const PIERCING_LIGHT_BASE_DMG = 30;
const PIERCING_LIGHT_PER_EXTRA = 15;
const piercingLightDamage = (energySpent) => PIERCING_LIGHT_BASE_DMG + Math.max(0,energySpent-PIERCING_LIGHT_BASE_COST)*PIERCING_LIGHT_PER_EXTRA;
// Which cardinal facing would put `to` on the 2-tile-forward thrust line
// from `from`, or null if it isn't reachable that way at all (used by the
// enemy AI to decide whether — and which way to face — to use Piercing
// Light, since enemies don't pick a direction by hand the way a player
// clicks a target tile).
const piercingLightFacing = (from, to) => {
  const dx=to.x-from.x, dy=to.y-from.y;
  if(dx===0 && dy!==0 && Math.abs(dy)<=2) return dy>0?'down':'up';
  if(dy===0 && dx!==0 && Math.abs(dx)<=2) return dx>0?'right':'left';
  return null;
};
// Same "spend just enough to kill, else spend everything available" shape
// as meleeBurstMultiplier, but for Piercing Light's flat per-point damage
// buff instead of a hit-count multiplier.
const piercingLightAutoSpend = (actionpts, targetHealth) => {
  for(let e=PIERCING_LIGHT_BASE_COST; e<actionpts; e++){
    if(piercingLightDamage(e) >= targetHealth) return e;
  }
  return actionpts;
};

// How many melee "hits" worth of AP an enemy auto-spends in one burst: enough
// to defeat the target if it has the energy for it, capped at whatever AP it
// actually has left. Replaces resolving N separate 1-AP melee actions (and N
// log lines/recursive turn-steps) with a single calculated Melee (Nx)
// command — the same total damage a fully-committed melee enemy would have
// landed anyway, just without the step-by-step churn. Capping at the kill
// threshold (rather than always spending everything) means a target that
// dies quickly doesn't eat AP the enemy could still spend elsewhere this
// turn — mirrors how leftover AP behaved before, when a mid-sequence kill
// freed the remaining single-hit steps for something else.
const meleeBurstMultiplier = (actionpts, perHitDamage, targetHealth) => {
  const neededHits = Math.max(1, Math.ceil(targetHealth / perHitDamage));
  return Math.max(1, Math.min(actionpts, neededHits));
};

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

// ─── CAMPAIGN MODE (multi-enemy squads) ────────────────────────────────────────
// Every Campaign Proxie now carries the same shape of build a player does:
// baseline Melee (always), exactly 1 element, and a loadout of Tactical
// skills — randomized from BATTLE_SKILLS' tactical pool for regular grunts.
// Core skills (Circuit Sigil) are boss-exclusive; see spawnCampaignRoster's
// mirror path for how the finale boss's loadout+element is actually filled.
// `rank` is now purely a display/sort label (badge, turn-order tiebreak) —
// it no longer drives capability rolls.
const randomEnemyLoadout = () => {
  const pool = BATTLE_SKILLS.filter(s=>s.category==='tactical').map(s=>s.id);
  const shuffled = [...pool].sort(()=>Math.random()-0.5);
  const count = 1 + Math.floor(Math.random()*Math.min(TACTICAL_SKILL_CAP, pool.length));
  return shuffled.slice(0, count);
};

// Still used by the player's own promoted-summon Agents (see
// promoteSummonToEnemy is NOT this — that's an opposing Proxie now; this
// pool remains for computeAgentStep's ally-side Agents only).
const ENEMY_CLASS_POOL = ['Summoner','Rogue'];

// Rank now doubles as the HP tier: R4 grunts are the weakest/most common,
// R1 is a full player-shaped "Proxie" build (same 1000 HP as the player
// themselves) -- matches how the finale boss already mirrors the player's
// own loadout/element 1-for-1. See rollEnemyDrop (ItemData.jsx) for how
// this same rank also sets a defeated enemy's drop odds.
const RANK_HP = { 4:150, 3:300, 2:500, 1:1000 };

let ENEMY_SEQ = 0;
const makeEnemyProxie = (rank, level, pos, { element=null, loadout=[], isBoss=false, hp=null } = {}) => {
  const hpValue = hp ?? RANK_HP[rank] ?? (ENEMY_HP_W1+(level-1)*ENEMY_HP_SCALE);
  const agi = Math.min(1+Math.floor(level/3),3);
  const name = isBoss ? 'Command Proxie' : element ? `${element} Warden` : 'Grunt Proxie';
  return {
    ...makeCharacter(name, hpValue, level, agi, 0, pos, element, element?'base':null),
    energyRollover:0,
    id: `E${++ENEMY_SEQ}`,
    rank,
    loadout,
    isBoss,
    canMelee: true,
  };
};

// The 5-battle Campaign arc: escalating from a trio of single-skill Rank 4
// grunts through mixed and same-rank squads up to a lone Rank 1 "Full
// Proxie" finale, one rank tougher each step. `level` still drives
// agility/melee-base scaling via the existing enemyTier system; HP is now
// derived per-roster-member from RANK_HP instead of one flat per-battle
// value, so a mixed-rank roster (e.g. stage 2's R4s + R3) actually
// differentiates. `narrative` is the lead-in shown before that battle
// starts (intro modal for stage 1, battle-complete "Continue" modal for
// every stage after). `victoryNarrative` is finale-only, shown on Campaign
// completion alongside the reward grant.
export const CAMPAIGN_BATTLES = [
  { stage:1, name:'Skirmish Line',   roster:[{rank:4},{rank:4},{rank:4}], level:2,
    narrative:'Grid intercepts flag a fractured patrol at the outer perimeter — three rogue processes running on minimal instruction sets. Clear them before they regroup.' },
  { stage:2, name:'Reinforced Line', roster:[{rank:4},{rank:4},{rank:3}], level:4,
    narrative:'The patrol regroups faster than expected — a heavier process has joined the line, running interference for what\'s left of the scouts.' },
  { stage:3, name:'Strike Squad',    roster:[{rank:3},{rank:3}], level:6,
    narrative:'The breach widens. A coordinated strike squad has moved in to reinforce the perimeter — better instantiated than the scouts that came before.' },
  { stage:4, name:'Elite Guard',     roster:[{rank:2},{rank:2}], level:8,
    narrative:'Deeper in the breach, the defense sharpens. These aren\'t grunts running borrowed instruction sets — Elite Guard units, fully specialized, holding the line with purpose.' },
  { stage:5, name:'Command Proxie',  roster:[{rank:1}], level:10, isFinale:true,
    narrative:'At the heart of the breach: a Command Proxie, fully instantiated, every subsystem online — mirroring your own build back at you, shadowboxing against exactly what you brought in. This is what has been holding the line.',
    victoryNarrative:'The Command Proxie\'s core destabilizes and goes dark. The breach is yours.' },
];

// Campaign's completion reward — the player's first piece of equipment.
// Placeholder until the real gear/stat system exists; for now it's a flat
// stat bump applied directly to the player, same spirit as a level-up.
export const FIRST_EQUIPMENT = { name:'Salvaged Core Chip', statBonus:'+100 Max HP', maxHealthBonus:100 };

// Places each roster slot on the enemy back row (row 0), retrying on
// collision with player/previously-placed enemies. Regular battles get a
// randomized element + tactical loadout per grunt; HP is left for
// makeEnemyProxie to derive from each slot's own rank (RANK_HP), so a
// mixed-rank roster differentiates correctly. The finale boss instead
// mirrors whatever `mirror` carries — the player's own actual loadout and
// element, "shadowboxing" a build identical to theirs, which is also how a
// boss legitimately gets a Core skill (Circuit Sigil) despite grunts never
// rolling one.
const spawnCampaignRoster = (stage, playerPos, mirror=null) => {
  const battle = CAMPAIGN_BATTLES[stage-1];
  const placed = [];
  battle.roster.forEach(({rank})=>{
    let pos, guard=0;
    do {
      pos = rollBackRowPosition(0);
      guard++;
    } while((pos.x===playerPos.x&&pos.y===playerPos.y || placed.some(p=>p.boardPosition.x===pos.x&&p.boardPosition.y===pos.y)) && guard<50);
    const isBoss = !!battle.isFinale;
    const element = isBoss && mirror ? mirror.element : BOSS_ELEMENTS[Math.floor(Math.random()*BOSS_ELEMENTS.length)];
    const loadout = isBoss && mirror ? mirror.loadout : randomEnemyLoadout();
    placed.push(makeEnemyProxie(rank, battle.level, {x:pos.x,y:pos.y}, {element, loadout, isBoss}));
  });
  return placed;
};

// Resolves an elemental skill cast by `attacker` (any enemy-shaped unit)
// against `target`, given the current `tiles` grid. Pure — no state writes.
// Mirrors the Fire/Earth/Air/Water math already used by Gauntlet's
// single-enemy `runEnemyTurn` (dice, accuracy, tile boosts, ranged min-damage
// floors, Water AoE, Air knockback), extracted here so every Campaign enemy
// with an element gets the identical mechanics rather than a stand-in.
// Returns null if the attacker has no element.
const computeElementalStrike = (attacker, target, tiles, obstacles=[], occupiedExtra=[]) => {
  const elData = attacker.element ? ELEMENTS[attacker.elementCategory]?.[attacker.element] : null;
  if(!elData) return null;
  const rolls = elData.dice.map(d=>({type:d,value:rollDie(parseInt(d.slice(1)))}));
  const ranged = elData.isEarth||elData.isAir||elData.isWater;
  const castFacing = ranged ? facingToward(attacker.boardPosition,target.boardPosition) : attacker.facing;
  let dmg=0, eCost=getSkillCost(attacker.elementCategory, attacker.element), knockbackPos=null, log='';
  let obstacleHit=null, newObstacles=[], appliesBurn=false, floodTiles=null, scorchTile=null;

  if(elData.isFire){
    const pulses=rolls[0].value, dmgEach=rolls[1].value;
    const base=pulses*dmgEach*SKILL_DICE_MULT;
    const acc=rollD100Accuracy();
    dmg=applyAccuracy(base,acc);
    const flank=getFlankBonus(attacker.boardPosition,target.boardPosition,target.facing);
    if(flank.bonus>0) dmg+=flank.bonus;
    const tileBoost=getTileBoost(tiles,attacker.boardPosition,'Fire');
    if(tileBoost>0) dmg+=tileBoost;
    appliesBurn=pulses>=3;
    // Scorch: a strong enough pulse count (3+, same threshold as Burn)
    // leaves the struck tile smoldering as a Fire tile.
    if(appliesBurn) scorchTile=target.boardPosition;
    log=`${attacker.name} Ember Strike [${pulses}x${dmgEach*SKILL_DICE_MULT}=${base}] ${acc}% (${accuracyTierLabel(acc)}) -> ${dmg} dmg${tileBoost>0?' [Fire tile +20]':''}${appliesBurn?' [Burn]':''}${scorchTile?' [Scorch]':''}`;
  } else if(elData.isEarth){
    const dieRoll=rolls[0].value;
    const maxRange=Math.max(1,Math.floor(dieRoll/2));
    const chosenRange=Math.max(1,Math.min(maxRange, attacker.actionpts-1));
    const {hitObstacle,hitTarget,newObstacleTiles}=resolveEarthTremor(
      {boardPosition:attacker.boardPosition,facing:castFacing}, chosenRange, [target], obstacles, [target.boardPosition, ...occupiedExtra], tiles
    );
    const base=dieRoll*EARTH_DICE_MULT;
    const acc=rollD100Accuracy();
    const tileBoost=getTileBoost(tiles,attacker.boardPosition,'Earth');
    const rawDmg=Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(base,acc))+tileBoost;
    dmg = hitTarget ? rawDmg : 0;
    if(hitObstacle) obstacleHit={id:hitObstacle.id, dmg:rawDmg, heal:true};
    newObstacles = newObstacleTiles.map(t=>makeObstacle(t));
    eCost=1+chosenRange;
    const outcome = hitTarget ? `${dmg} dmg` : hitObstacle ? `reinforced rubble instead` : 'MISS';
    log=`${attacker.name} Tremor [d6=${dieRoll}, ${chosenRange} tile${chosenRange>1?'s':''}, ${acc}% (${accuracyTierLabel(acc)})] -> ${outcome}${newObstacles.length>0?` (+${newObstacles.length} rubble)`:''}`;
  } else if(elData.isAir){
    const dieRoll=rolls[0].value;
    const maxLine=getForwardTiles(attacker.boardPosition,castFacing,SIZE);
    const targetStep=maxLine.findIndex(t=>t.x===target.boardPosition.x&&t.y===target.boardPosition.y);
    const targetDist=targetStep>=0?targetStep+1:-1;
    // Range and damage are synergistic now, not subtractive: the roll IS
    // the max reach (hit if the target is within that many tiles), and
    // damage comes purely from airGaleForceDamage(roll) — a high roll no
    // longer costs damage the way it used to. A closer obstacle takes the
    // gust instead of letting it through to the actual target.
    const lineObstacle=findLineObstacle(attacker.boardPosition,castFacing,dieRoll,obstacles);
    const blocked=lineObstacle && (targetDist<0||lineObstacle.dist<=targetDist);
    const hit=!blocked&&targetDist>0&&targetDist<=dieRoll;
    const base=airGaleForceDamage(dieRoll);
    const acc=rollD100Accuracy();
    const tileBoost=getTileBoost(tiles,attacker.boardPosition,'Air');
    const rawDmg=Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(base,acc))+tileBoost;
    dmg=hit?rawDmg:0;
    eCost=2;
    let knockedIntoRubble=false;
    if(hit){
      // Whatever roll wasn't spent reaching the target becomes knockback
      // distance, minimum 1 tile, traveling until it hits a wall or rubble.
      // A rubble collision stops the knockback one tile short and deals the
      // same collision damage a direct hit would, same as the "blocked"
      // line-hit case below — it's how rubble in the open, not just rubble
      // in a caster's own line, ends up destructible by Air.
      const knockDist=Math.max(1,dieRoll-targetDist);
      const kb=getKnockbackTile(target.boardPosition,castFacing,knockDist,[attacker.boardPosition],obstacles);
      knockbackPos={x:kb.x,y:kb.y};
      if(kb.hitObstacle){ obstacleHit={id:kb.hitObstacle.id, dmg:rawDmg}; knockedIntoRubble=true; }
    } else if(blocked){
      obstacleHit={id:lineObstacle.obstacle.id, dmg:rawDmg};
    }
    log=`${attacker.name} Gale Force [d8=${dieRoll}, ${acc}% (${accuracyTierLabel(acc)})] -> ${hit?dmg+' dmg'+(knockedIntoRubble?' [knocked into rubble]':''):blocked?'struck rubble instead':'MISS'}`;
  } else if(elData.isWater){
    const dieRoll=rolls[0].value;
    const res=resolveTorrent(dieRoll);
    const anchor=getTorrentAnchor(attacker.boardPosition,castFacing);
    const opts=getTorrentOptions(dieRoll,attacker.actionpts).filter(o=>o.affordable);
    if(opts.length===0){
      dmg=0; eCost=Math.min(TORRENT_AOE_COST.single,attacker.actionpts);
      log=`${attacker.name} Torrent [d20=${dieRoll}] -> insufficient Energy, disperses`;
    } else {
      let chosen=null;
      for(const o of opts){
        const fp=getTorrentFootprint(anchor,o.aoe);
        if(fp.some(t=>t.x===target.boardPosition.x&&t.y===target.boardPosition.y)){ chosen=o; break; }
      }
      if(!chosen) chosen=opts[opts.length-1];
      eCost=chosen.cost;
      const footprint=getTorrentFootprint(anchor,chosen.aoe);
      const hit=footprint.some(t=>t.x===target.boardPosition.x&&t.y===target.boardPosition.y);
      const acc=rollD100Accuracy();
      const tileBoost=getTileBoost(tiles,attacker.boardPosition,'Water');
      dmg=hit?applyAccuracy(res.damage,acc)+tileBoost:0;
      // Flood: a strong enough torrent (d20 >= 10) reshapes the ground it
      // lands on into Water tiles, regardless of whether it actually hit —
      // the whole AoE footprint floods, matching the cast's chosen AoE size.
      if(dieRoll>=10) floodTiles=footprint;
      log=`${attacker.name} Torrent [d20=${dieRoll}, ${AOE_LABEL[chosen.aoe]}, ${acc}% (${accuracyTierLabel(acc)})] -> ${hit?dmg+' dmg':'MISS'}${floodTiles?' [Flood]':''}`;
    }
  }
  return { dmg, eCost, castFacing, knockbackPos, log, obstacleHit, newObstacles, appliesBurn, floodTiles, scorchTile };
};

// Whether `attacker`'s equipped element could plausibly land on `target`
// this turn, checked BEFORE committing to cast — without this, an enemy
// would fire a ranged element at whatever the geometry couldn't actually
// reach (e.g. an Earth Tremor at a target off its cast line, a Water
// Torrent anchored nowhere near anyone) and just burn Energy on a guaranteed
// miss. Mirrors each element's real hit-check from computeElementalStrike,
// using the attacker's current facing-toward-target line/anchor and the
// element's max possible reach (its highest die face, or the richest AoE
// tier current Energy could afford) since the actual die hasn't been rolled
// yet at decision time.
const canElementReachTarget = (attacker, target, actionpts) => {
  const elData = attacker.element ? ELEMENTS[attacker.elementCategory]?.[attacker.element] : null;
  if(!elData) return false;
  if(elData.isFire) return isAdjacent(attacker.boardPosition, target.boardPosition);
  const castFacing = facingToward(attacker.boardPosition, target.boardPosition);
  if(elData.isEarth){
    const maxRange = Math.min(3, actionpts-1); // d6 max halved, capped by affordable tiles
    if(maxRange<1) return false;
    return getForwardTiles(attacker.boardPosition, castFacing, maxRange).some(t=>t.x===target.boardPosition.x&&t.y===target.boardPosition.y);
  }
  if(elData.isAir){
    return getForwardTiles(attacker.boardPosition, castFacing, 8).some(t=>t.x===target.boardPosition.x&&t.y===target.boardPosition.y); // d8 max
  }
  if(elData.isWater){
    const anchor = getTorrentAnchor(attacker.boardPosition, castFacing);
    const maxAoe = actionpts>=TORRENT_AOE_COST.spread ? 'spread' : actionpts>=TORRENT_AOE_COST.cross ? 'cross' : 'single';
    return getTorrentFootprint(anchor, maxAoe).some(t=>t.x===target.boardPosition.x&&t.y===target.boardPosition.y);
  }
  return true;
};

// Pulse Wave — "your elemental skill a second time, at a different range."
// Reuses each element's own dice, but flattened to a single damage number
// with no range/AoE scaling: Fire keeps its pulses×dmg-each product, Water
// takes resolveTorrent's damage tier for the roll (ignoring which AoE size
// it would have unlocked), and everything else just sums its dice. Pure —
// rolls dice and returns the result, no state writes, no targeting (that's
// resolved separately via findAxisDirection/getAxisLine).
const computePulseWaveDamage = (attacker) => {
  const elData = attacker.element ? ELEMENTS[attacker.elementCategory]?.[attacker.element] : null;
  if(!elData) return null;
  const rolls = elData.dice.map(d=>rollDie(parseInt(d.slice(1))));
  let base;
  if(elData.isFire) base = rolls[0]*rolls[1]*SKILL_DICE_MULT;
  else if(elData.isWater) base = resolveTorrent(rolls[0]).damage;
  else base = rolls.reduce((a,b)=>a+b,0)*SKILL_DICE_MULT;
  const acc = rollD100Accuracy();
  const dmg = applyAccuracy(base,acc);
  return { dmg, acc, rollsLabel: rolls.join('+') };
};

// Longshot Protocol — a passive diagonal snipe. Walks each of the 4
// diagonals out from `moverPos` up to LONGSHOT_RANGE tiles; the first thing
// found along a line wins that line — a target there gets sniped, anything
// else there blocks the rest of that line's line of sight. Each of the 4
// diagonals is independent, so a target sitting on one line doesn't stop
// another target on a different line from also being sniped in the same
// trigger — every diagonal that finds a target lands simultaneously. Checked
// once right after a genuine repositioning move (see handleSquareClick /
// runEnemyTurn's approach-move branch) — melee and other skills that happen
// to also change boardPosition don't re-trigger it. Pure — returns the list
// of units hit (possibly empty), no state writes.
const LONGSHOT_RANGE = 3;
const LONGSHOT_DMG = 10;
const checkLongshotProtocol = (moverPos, targets, blockers) => {
  const hits=[];
  for(const dir of DIAGONAL_DIRS){
    const line = getAxisLine(moverPos, dir, LONGSHOT_RANGE);
    for(const tile of line){
      const hit = targets.find(t=>t.health>0&&t.boardPosition.x===tile.x&&t.boardPosition.y===tile.y);
      if(hit){ hits.push(hit); break; }
      if(blockers.some(b=>b.x===tile.x&&b.y===tile.y)) break;
    }
  }
  return hits;
};

// Auto-resolves every un-acted-this-round summon owned by `thisEnemy` in one
// batch, 1 AP each: strike the player if it's on one of the 3 tiles ahead
// (pawn geometry, see summonAttackTiles), else march the single tile
// straight ahead (summonForwardTile) if clear. `actedRound` rate-limits each
// summon to exactly one action per round — without it, a Summoner with a
// long multi-AP turn would re-command the same summons on every one of its
// own recursive AP-spend steps, letting them move or strike repeatedly in a
// single round instead of once, the way a chess pawn would. Pure — returns
// results, writes no state.
const commandEnemySummons = (thisEnemy, allSummons, otherEnemies, player, currentRound) => {
  let nextSummons = allSummons;
  let apLeft = thisEnemy.actionpts;
  let playerHP = player.health;
  const logs = [];
  const promoted = [];
  const owned = allSummons.filter(s=>s.side==='enemy' && s.ownerId===thisEnemy.id && !s.promoted && s.actedRound!==currentRound);
  for(const s of owned){
    if(apLeft<=0) break;
    const cur = nextSummons.find(z=>z.id===s.id);
    if(!cur) continue;
    const inAttackRange = summonAttackTiles(cur).some(t=>t.x===player.boardPosition.x&&t.y===player.boardPosition.y);
    if(inAttackRange){
      const dmg=cur.atk;
      playerHP=Math.max(0,playerHP-dmg);
      logs.push(`${cur.name} (enemy) strikes you -> ${dmg} dmg`);
      nextSummons = nextSummons.map(z=>z.id===cur.id?{...z,actedRound:currentRound}:z);
      apLeft--;
      continue;
    }
    const fwd = summonForwardTile(cur);
    if(!fwd){
      // Reaching the far edge promotes it into a full independent enemy
      // roster entry (see promoteSummonToEnemy) — removed from summons
      // entirely, not just flagged, since it's no longer a summon at all.
      nextSummons = nextSummons.filter(z=>z.id!==cur.id);
      const newEnemy = promoteSummonToEnemy(cur, thisEnemy.level);
      promoted.push(newEnemy);
      logs.push(`* ${cur.name} reaches your line — promotes into ${newEnemy.name}!`);
      apLeft--;
      continue;
    }
    const blocked = nextSummons.some(z=>z.id!==cur.id&&z.boardPosition.x===fwd.x&&z.boardPosition.y===fwd.y)
      || otherEnemies.some(e=>e.boardPosition.x===fwd.x&&e.boardPosition.y===fwd.y)
      || (player.boardPosition.x===fwd.x&&player.boardPosition.y===fwd.y);
    if(blocked) continue; // no legal move this pass -- retries next pass, doesn't count as having acted
    nextSummons = nextSummons.map(z=>z.id===cur.id?{...z,boardPosition:fwd,actedRound:currentRound}:z);
    logs.push(`${cur.name} (enemy) advances -> (${fwd.x},${fwd.y})`);
    apLeft--;
  }
  return { nextSummons, apSpent: thisEnemy.actionpts-apLeft, playerHP, logs, promoted };
};

// Decides which class-like loadout skill `thisEnemy` uses this pass, and
// how — checked against its actual equipped loadout (BATTLE_SKILLS ids)
// instead of the old single enemyClass string, since a Campaign enemy can
// now carry any combination the same way a player's loadout can. Priority:
// Dark Web (only usable from an exact knight-move — narrowest window, so it
// takes priority when it's actually available) > Compass Slash (any of the
// 8 surrounding tiles) > Piercing Light (2 tiles dead ahead, any cardinal
// facing) > Pulse Wave (own element, any of the 8 axis directions, range 3)
// > Circuit Sigil deploy onto ENEMY_SUMMON_ROW (a fixed row, not wherever
// the caster currently stands, so a mobile caster can't scatter summons
// anywhere it's walked to) as a fallback build-up action when nothing's in
// range yet. (Longshot Protocol isn't decided here — it's a passive that
// procs off movement itself, see checkLongshotProtocol.) Pure decision — no
// state writes, no dice rolled here (that happens where the result is
// applied, same separation `computeElementalStrike` uses).
const resolveEnemyClassSkill = (thisEnemy, currentPlayer, currentSummons, tiles, enemyPositions, obstacles=[]) => {
  const loadout = thisEnemy.loadout || [];
  const used = thisEnemy.usedSkillIds || [];
  const ap = thisEnemy.actionpts;
  const has = (id, cost) => loadout.includes(id) && !used.includes(id) && ap>=cost;
  if(has('darkWeb',2) && isKnightMove(thisEnemy.boardPosition, currentPlayer.boardPosition)){
    return { kind:'darkweb', skillId:'darkWeb' };
  }
  if(has('compassSlash',2) && isAdjacent8(thisEnemy.boardPosition, currentPlayer.boardPosition)){
    return { kind:'direct', skillId:'compassSlash' };
  }
  if(has('piercingLight',PIERCING_LIGHT_BASE_COST)){
    const facing = piercingLightFacing(thisEnemy.boardPosition, currentPlayer.boardPosition);
    if(facing) return { kind:'piercingLight', skillId:'piercingLight', facing };
  }
  if(has('pulseWave',3) && thisEnemy.element){
    const dir = findAxisDirection(thisEnemy.boardPosition, currentPlayer.boardPosition);
    if(dir){
      const dist = Math.max(Math.abs(currentPlayer.boardPosition.x-thisEnemy.boardPosition.x),Math.abs(currentPlayer.boardPosition.y-thisEnemy.boardPosition.y));
      if(dist<=3) return { kind:'pulseWave', skillId:'pulseWave', dir };
    }
  }
  if(has('circuitSigil',2)){
    const ownCount = currentSummons.filter(s=>s.side==='enemy'&&s.ownerId===thisEnemy.id).length;
    if(ownCount<BANDWIDTH){
      const legal = getDeployTilesOnRow(ENEMY_SUMMON_ROW, tiles, currentPlayer.boardPosition, enemyPositions, [...currentSummons, ...obstacles]);
      if(legal.length>0){
        const tile = legal.reduce((best,t)=>
          Math.abs(t.x-thisEnemy.boardPosition.x)<Math.abs(best.x-thisEnemy.boardPosition.x)?t:best, legal[0]);
        return { kind:'deploy', tile, skillId:'circuitSigil' };
      }
    }
  }
  return null;
};

// Converts a promoted enemy-side summon into a full roster entry — from
// here on it's just another enemy with its own roll and AI turn, rank-
// sorted and player-attackable like any other, rather than a special case
// that needs its own parallel machinery. A converted grunt (random tactical
// loadout, no element — it never had one as a summon), not a rebalanced boss.
const promoteSummonToEnemy = (summon, level) => ({
  ...makeCharacter(`${summon.name} Agent`, summon.maxHealth, level, 1, 0, summon.boardPosition, null, null),
  id: `E${++ENEMY_SEQ}`,
  rank: 4,
  loadout: randomEnemyLoadout(),
  isBoss: false,
  canMelee: true,
  health: summon.health,
});

// One action-point's worth of an autonomous Agent's turn (a promoted
// player-side summon acting independently, "similar logic to the
// enemies") against `target` — an enemy character or, symmetrically, the
// player. Pure — no state writes, no target-array indexing; the caller
// resolves which target object this refers to. `blockers` excludes the
// agent's own tile and the target's tile — movement collision only.
const computeAgentStep = (agent, target, blockers) => {
  const adjacent = isAdjacent(agent.boardPosition, target.boardPosition);
  const canClass = agent.agentClass && !agent.classSkillUsed && agent.actionpts>=2 && Math.random()<0.7;
  if(canClass){
    if(agent.agentClass==='Rogue' && isKnightMove(agent.boardPosition, target.boardPosition)){
      const acc=rollD100Accuracy();
      const dmg=applyAccuracy(70,acc);
      return { kind:'darkweb', dmg, cost:2, log:`${agent.name} Dark Web -> ${dmg} dmg (${acc}% ${accuracyTierLabel(acc)})`, color:'#a0a0a0' };
    }
    if(agent.agentClass==='Summoner' && isAdjacent8(agent.boardPosition, target.boardPosition)){
      return { kind:'direct', dmg:60, cost:2, log:`${agent.name} Compass Slash -> 60 dmg`, color:'#9b6cff' };
    }
  }
  if(adjacent){
    return { kind:'melee', dmg:agent.atk, cost:1, log:`${agent.name} strikes ${target.name} -> ${agent.atk} dmg`, color:'#66dd88' };
  }
  const moves=getMoveToward(agent.boardPosition.x,agent.boardPosition.y,target.boardPosition.x,target.boardPosition.y);
  for(const m of moves){
    const blocked=blockers.some(b=>b.x===m.x&&b.y===m.y);
    if(m.x>=0&&m.x<SIZE&&m.y>=0&&m.y<SIZE&&!blocked){
      return { kind:'move', to:m, cost:1, log:`${agent.name} -> (${m.x},${m.y})` };
    }
  }
  return { kind:'hold' };
};

// Battle Skills loadout registry. Classes (Summoner/Rogue) are gone on the
// player side — what were once class-locked abilities are now individually
// selectable skills, organized into two categories so the loadout stays
// legible as more skills get added later:
//   Core Skills    — the strong, slower-growing kit. Melee is the only one
//                    available today; Circuit Sigil (summoning) is built
//                    and intended, but stays crafting-locked until that
//                    system exists, so it isn't offered in the picker yet.
//   Tactical Skills — the faster-growing pool of situational actions.
//                    Compass Slash and Dark Web (formerly Mastermind's
//                    Direct mode and the Rogue class skill) are the first
//                    two, unlocked from the start.
// Loadout caps below are a soft ceiling for future growth, not a target —
// there's currently only one Core skill (unselectable) and two Tactical
// skills, so a starting loadout is really just "pick your Tacticals."
const CORE_SKILL_CAP = 3;
const TACTICAL_SKILL_CAP = 2;

// A saved Custom Synthesis design (see CraftingScreen.jsx) isn't a
// BATTLE_SKILLS entry -- it's stored separately as `customSkillDef`, one per
// player rather than one shared definition -- but every place a skill gets
// picked, priced, or cast expects that same {id,name,icon,color,tagline}
// shape, so this builds a synthetic one on the fly from whatever the player
// designed. `null` (no design saved yet) is handled by callers, not here.
export const customSkillEntry = (def) => {
  const elMeta = def.element ? MODIFIABLE_ELEMENTS.find(e=>e.id===def.element) : null;
  return {
    id:'customSkill', category:'core', baseline:false,
    name:def.name, icon:elMeta?.icon || '⚙', color:elMeta?.color || '#9b6cff',
    tagline:'Custom Synthesis', locked:false,
  };
};

// ─── CUSTOM SYNTHESIS BATTLE RESOLUTION ──────────────────────────────────
// Turns a saved design into an actual in-battle footprint. The design board
// (CraftingScreen.jsx) always draws relative to "up" -- the caster facing
// away from the viewer -- so rotateForFacing reorients whatever {dx,dy}
// offset was authored there onto the caster's real 4-way facing at cast
// time. Same transform for a single AoE tile and for a Range/Warp vector.
const CUSTOM_SKILL_DIR_VECS = {
  up:{dx:0,dy:-1}, 'up-right':{dx:1,dy:-1}, right:{dx:1,dy:0}, 'down-right':{dx:1,dy:1},
  down:{dx:0,dy:1}, 'down-left':{dx:-1,dy:1}, left:{dx:-1,dy:0}, 'up-left':{dx:-1,dy:-1},
};
const rotateForFacing = ({dx,dy}, facing) => {
  switch(facing){
    case 'right': return {dx:-dy, dy:dx};
    case 'down':  return {dx:-dx, dy:-dy};
    case 'left':  return {dx:dy,  dy:-dx};
    default:      return {dx,dy}; // 'up'
  }
};
// The 8 tiles Melee auto-targets -- rotation-invariant (the ring around the
// caster is the same from any facing), so it's just isAdjacent8's own
// offsets rather than anything rotateForFacing needs to touch.
const CUSTOM_SKILL_MELEE_OFFSETS = [
  {dx:-1,dy:-1},{dx:0,dy:-1},{dx:1,dy:-1},{dx:-1,dy:0},{dx:1,dy:0},{dx:-1,dy:1},{dx:0,dy:1},{dx:1,dy:1},
];
// Returns the actual board tiles (in-bounds) this cast covers, plus --
// for Range/Warp only -- the tile it would reposition the caster to if that
// option is set. Callers decide whether that move is actually legal (not
// blocked by an ally/obstacle) before applying it.
const customSkillFootprint = (def, casterPos, facing) => {
  const inBounds = (t) => t.x>=0 && t.x<SIZE && t.y>=0 && t.y<SIZE;
  if(def.archetype==='melee'){
    return { tiles: CUSTOM_SKILL_MELEE_OFFSETS.map(o=>({x:casterPos.x+o.dx,y:casterPos.y+o.dy})).filter(inBounds), moveTo:null };
  }
  if(def.archetype==='aoe'){
    const tiles = (def.tiles||[]).map(t=>rotateForFacing(t,facing))
      .map(r=>({x:casterPos.x+r.dx,y:casterPos.y+r.dy})).filter(inBounds);
    return { tiles, moveTo:null };
  }
  if(def.archetype==='range'){
    const dirVec = CUSTOM_SKILL_DIR_VECS[def.rangeDirection] || CUSTOM_SKILL_DIR_VECS.up;
    const rotDir = rotateForFacing(dirVec, facing);
    const tiles = getAxisLine(casterPos, rotDir, def.length||1);
    return { tiles, moveTo: def.moveCasterOnRange && tiles.length>0 ? tiles[tiles.length-1] : null };
  }
  if(def.archetype==='warp'){
    if(!def.warpTile) return { tiles:[], moveTo:null };
    const r = rotateForFacing(def.warpTile, facing);
    const t = {x:casterPos.x+r.dx, y:casterPos.y+r.dy};
    return inBounds(t) ? { tiles:[t], moveTo:t } : { tiles:[], moveTo:null };
  }
  return { tiles:[], moveTo:null };
};
// Rolls the design's Special Effects die (only if it has any if/then rules)
// and returns which rules fired -- "Always" rules fire unconditionally,
// "Roll >=" rules check against this one shared roll, same idea as
// Fire/Water's own pulse/gating die.
const resolveCustomSkillEffects = (def) => {
  if(!def.effects || def.effects.length===0) return { roll:null, triggered:[] };
  const roll = rollDie(parseInt((def.rollDie||'d6').slice(1),10));
  const triggered = def.effects.filter(e => e.condition==='always' || roll>=e.threshold);
  return { roll, triggered };
};

export const BATTLE_SKILLS = [
  {
    id:'melee', category:'core', baseline:true,
    name:'Melee', icon:'⚔', color:'#ffd700',
    tagline:'Basic contact strike — always equipped.',
    blurb:'Every Proxie\'s baseline attack. Not part of the loadout pick; it\'s always available regardless of what else you equip.',
  },
  {
    id:'circuitSigil', category:'core', locked:true, unlockHint:'Unlocks via Crafting',
    name:'Circuit Sigil', icon:'◈', color:'#9b6cff',
    tagline:'Summon entities from the cyberworld.',
    blurb:'Roll a circuit sigil to call a Bug, Virus, or Malware onto your second row. Bandwidth 2. Intended as a strong Core skill — stays locked until Crafting unlocks it.',
  },
  {
    id:'compassSlash', category:'tactical',
    name:'Compass Slash', icon:'⊕', color:'#9b6cff',
    tagline:'An omnidirectional strike.',
    blurb:'60 dmg to any of the 8 surrounding tiles. 2 Energy, once per turn.',
  },
  {
    id:'darkWeb', category:'tactical',
    name:'Dark Web', icon:'✕', color:'#a0a0a0',
    tagline:'Strike from angles no defender expects.',
    blurb:'Moves and attacks in an L-pattern, like a chess knight — striking any of 8 offset tiles, bypassing adjacent defenders entirely. 70 base damage, 2 Energy, once per turn. Always leaps to the target tile — a finishing blow, a miss, or an empty tile used purely to reposition all land you there, unless something\'s already standing on it.',
  },
  {
    id:'pulseWave', category:'tactical',
    name:'Pulse Wave', icon:'♛', color:'#c9a7f7',
    tagline:'A second cast of your own element, at a different range.',
    blurb:'Fires a line of your equipped element 3 tiles out, in any of the 8 directions — hitting everyone caught along it. Uses your element\'s own dice, with no range or AoE scaling applied. 3 Energy, once per turn.',
  },
  {
    id:'longshotProtocol', category:'tactical',
    name:'Longshot Protocol', icon:'♗', color:'#88e0c0',
    tagline:'A passive diagonal snipe.',
    blurb:'Passive — no button, no cost. Whenever you reposition and end up within 3 tiles of an enemy along a clear diagonal, it automatically takes 10 damage. Blocked by anything standing in the line of sight. Doesn\'t trigger off melee, and doesn\'t cause any movement of its own.',
  },
  {
    id:'piercingLight', category:'tactical',
    name:'Piercing Light', icon:'♜', color:'#ffdd77',
    tagline:'A thrust that runs clean through the front line.',
    blurb:'A forward melee that hits both the adjacent tile and the one behind it in a single thrust. 3 Energy base — each additional Energy committed adds more damage, the same way a Melee burst scales.',
  },
];
// A skill is available once it's either not gated at all, or has been
// learned through Crafting (see CraftingScreen.jsx / App's craftedSkillIds).
// `locked` on the BATTLE_SKILLS entry itself never changes — it just marks
// "this one needs Crafting" — so unlock status is always derived here rather
// than mutated in place.
export const isSkillUnlocked = (skill, craftedSkillIds=[]) => !skill.locked || craftedSkillIds.includes(skill.id);
// ─── UI COMPONENTS ─────────────────────────────────────────────────────────────

const StatLine = ({label,value,accent}) => (
  <div style={{display:'flex',justifyContent:'space-between',margin:'4px 0',fontSize:'13px',minWidth:0}}>
    <span style={{color:'#7a9db5',whiteSpace:'nowrap',marginRight:8}}>{label}</span>
    <span style={{color:accent||'#b0dff4',fontWeight:accent?'bold':'normal',textAlign:'right',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{value}</span>
  </div>
);

// HP text lives below the bar (the "foot"), not inside the shrinking fill —
// cramming it inside meant it got clipped unreadable once the fill got
// narrow. At full health it reads as one centered "X / Max". Once damaged,
// it splits at the fill's edge: the current value hugs the end of the
// filled color, "/ Max" floats free in the empty remainder — so the fill's
// own edge doubles as the divisor slash. The fill's right edge is cut on a
// diagonal (rather than a flat vertical line) to actually look like that
// slash rather than just imply it.
const HEALTH_BAR_SLANT = 7;
const HealthBar = ({current,max}) => {
  const pct=Math.max(0,Math.min(100,(current/max)*100));
  const isFull=current>=max;
  const fillColor=`hsl(${pct*1.2},80%,45%)`;
  return (
    <div style={{width:'100%',margin:'6px 0 4px'}}>
      <div style={{width:'100%',height:'16px',background:'#1a1a2e',border:'1px solid #2a4a5e',borderRadius:'3px',position:'relative',overflow:'hidden'}}>
        <div style={{
          height:'100%',width:`${pct}%`,background:fillColor,transition:'width 0.3s',
          clipPath: (!isFull && pct>0) ? `polygon(0 0, 100% 0, calc(100% - ${HEALTH_BAR_SLANT}px) 100%, 0 100%)` : 'none',
        }} />
      </div>
      <div style={{position:'relative',height:12,marginTop:2,fontSize:10,fontWeight:'bold',fontFamily:'monospace',whiteSpace:'nowrap'}}>
        {isFull ? (
          <div style={{textAlign:'center',color:'#b0dff4'}}>{Math.round(current)} / {max}</div>
        ) : (
          <>
            <span style={{position:'absolute',left:`${pct}%`,transform:'translateX(-100%)',paddingRight:2,color:fillColor}}>{Math.round(current)}</span>
            <span style={{position:'absolute',left:`${pct}%`,paddingLeft:2,color:'#7a9db5'}}>/ {max}</span>
          </>
        )}
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

// Post-boss loadout unlock modal — presents Battle Skills grouped by
// category (Core / Tactical), each toggleable up to its cap. Replaces the
// old single-pick class modal now that a player builds a loadout instead of
// equipping one exclusive class. `loadout` / `onToggle` are controlled by
// the caller so the same component works for Gauntlet's post-boss unlock,
// Training's free-swap scene, and (as a picker for Campaign's own intro
// modal) skill selection.
const LoadoutModal = ({show, loadout, onToggle, onConfirm, onClose, freeSelect, craftedSkillIds=[]}) => {
  if(!show) return null;
  const core = BATTLE_SKILLS.filter(s=>s.category==='core');
  const tactical = BATTLE_SKILLS.filter(s=>s.category==='tactical');
  const tacticalCount = loadout.filter(id=>tactical.some(s=>s.id===id)).length;
  const coreCount = loadout.filter(id=>core.some(s=>s.id===id)).length;
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:4000}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#080e14',border:'2px solid #9b6cff',borderRadius:12,padding:'1.6rem',maxWidth:460,width:'92%',maxHeight:'85vh',overflowY:'auto',color:'#b0dff4',boxShadow:'0 0 50px rgba(155,108,255,0.4)'}}>
        <div style={{textAlign:'center',marginBottom:18}}>
          <div style={{fontSize:'11px',letterSpacing:'0.2em',textTransform:'uppercase',color:'#9b6cff'}}>{freeSelect ? '// Training Scene — Try Any Skill' : '// Boss Defeated — Loadout Unlocked'}</div>
          <h2 style={{fontSize:'1.3rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'#b08cff',marginTop:6}}>Choose Your Loadout</h2>
          <div style={{fontSize:'11px',color:'#5a7a8a',marginTop:4}}>{freeSelect ? `Toggle up to ${TACTICAL_SKILL_CAP} Tactical Skills to try. Swap anytime with the Change Loadout button.` : `Select up to ${TACTICAL_SKILL_CAP} Tactical Skills to equip. This persists for the run.`}</div>
        </div>

        <div style={{fontSize:'10px',color:'#3a5a6a',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>Core Skills (max {CORE_SKILL_CAP})</div>
        {core.map(s=>{
          // Baseline (Melee) is always-on and not part of the pick; a locked
          // Core skill is informational until Crafting unlocks it; once
          // unlocked it toggles just like a Tactical skill.
          if(s.baseline || !isSkillUnlocked(s, craftedSkillIds)){
            return (
              <div key={s.id}
                style={{background:'#0a1218',border:`1px solid ${s.color}44`,borderRadius:8,padding:'12px 14px',marginBottom:8,opacity:s.locked?0.6:1}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                  <span style={{fontSize:'18px'}}>{s.icon}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'13px',fontWeight:'bold',color:s.color}}>{s.name}</div>
                    <div style={{fontSize:'10px',color:'#7a9db5'}}>{s.tagline}</div>
                  </div>
                  <span style={{fontSize:'10px',color:s.locked?'#ff8866':'#66dd88',fontWeight:'bold',letterSpacing:'0.05em'}}>
                    {s.locked ? `🔒 ${s.unlockHint}` : 'EQUIPPED'}
                  </span>
                </div>
                <div style={{fontSize:'10px',color:'#8ab5cc',lineHeight:1.5}}>{s.blurb}</div>
              </div>
            );
          }
          const picked = loadout.includes(s.id);
          const disabled = !picked && coreCount>=CORE_SKILL_CAP;
          return (
            <div key={s.id} onClick={()=>!disabled&&onToggle(s.id)}
              style={{background:'#0a1218',border:`1px solid ${picked?s.color:disabled?'#1e3a4a':`${s.color}66`}`,borderRadius:8,padding:'12px 14px',marginBottom:8,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,boxShadow:picked?`0 0 12px ${s.color}55`:'none',transition:'border-color 0.15s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
                <span style={{fontSize:'18px'}}>{s.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:'13px',fontWeight:'bold',color:s.color}}>{s.name}</div>
                  <div style={{fontSize:'10px',color:'#7a9db5'}}>{s.tagline}</div>
                </div>
                {picked&&<span style={{fontSize:'14px',color:s.color}}>✓</span>}
              </div>
              <div style={{fontSize:'10px',color:'#8ab5cc',lineHeight:1.5}}>{s.blurb}</div>
            </div>
          );
        })}

        <div style={{fontSize:'10px',color:'#3a5a6a',textTransform:'uppercase',letterSpacing:'0.1em',margin:'14px 0 8px'}}>Tactical Skills — pick up to {TACTICAL_SKILL_CAP}</div>
        {tactical.map(s=>{
          const picked = loadout.includes(s.id);
          const disabled = !picked && tacticalCount>=TACTICAL_SKILL_CAP;
          return (
            <div key={s.id} onClick={()=>!disabled&&onToggle(s.id)}
              style={{background:'#0a1218',border:`1px solid ${picked?s.color:disabled?'#1e3a4a':`${s.color}66`}`,borderRadius:8,padding:'14px 16px',marginBottom:10,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,boxShadow:picked?`0 0 12px ${s.color}55`:'none',transition:'border-color 0.15s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                <span style={{fontSize:'22px'}}>{s.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:'15px',fontWeight:'bold',color:s.color}}>{s.name}</div>
                  <div style={{fontSize:'11px',color:'#7a9db5'}}>{s.tagline}</div>
                </div>
                {picked&&<span style={{fontSize:'16px',color:s.color}}>✓</span>}
              </div>
              <div style={{fontSize:'11px',color:'#8ab5cc',lineHeight:1.5}}>{s.blurb}</div>
            </div>
          );
        })}
        <button onClick={onConfirm}
          style={{width:'100%',marginTop:6,padding:11,background:'rgba(155,108,255,0.18)',color:'#b08cff',border:'1px solid #9b6cff',borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:'bold',letterSpacing:'0.06em'}}>
          Confirm Loadout
        </button>
        {freeSelect&&(
          <button onClick={onClose}
            style={{width:'100%',marginTop:8,padding:9,background:'transparent',color:'#5a7a8a',border:'1px solid #1e3a4a',borderRadius:6,cursor:'pointer',fontSize:12,letterSpacing:'0.05em'}}>
            Close
          </button>
        )}
      </div>
    </div>
  );
};

// Campaign's opening character-creation step — name the Proxie, pick a
// loadout, pick an element, before Battle 1 spawns. Unlike Gauntlet
// (loadout unlocks after a boss kill) and Training's Battle Skills scene
// (free swapping), Campaign locks these choices in up front, like loading
// into a real run.
// The character-build form: name, loadout (Core + Tactical skills, same
// caps Campaign always enforced), and element. Used by CharacterScreen.jsx
// to create/edit one of a player's up to-3 saved Proxy builds -- Campaign
// itself no longer collects this mid-battle (see the `character` prop on
// the main component below), it just requires one of these to already
// exist. Exported so CharacterScreen can render it without duplicating
// BATTLE_SKILLS/cap logic.
export const CharacterCreatorForm = ({ initial, craftedSkillIds=[], customSkillDef, onSubmit, onCancel, submitLabel='Save' }) => {
  const [name, setName] = useState(initial?.name || '');
  const [loadout, setLoadout] = useState(initial?.loadout || []);
  const [element, setElement] = useState(initial?.element || null);
  const canSubmit = name.trim().length>0 && loadout.length>0 && element;
  const elMeta = element ? ELEMENTS.base[element] : null;
  const tactical = BATTLE_SKILLS.filter(s=>s.category==='tactical');
  // Crafted Core skills (Circuit Sigil once learned) are selectable here too
  // — baseline Melee is excluded since it's always equipped, not a pick. A
  // saved Custom Synthesis design (see customSkillEntry above) is appended
  // the same way once one exists -- it's not in BATTLE_SKILLS at all.
  const availableCore = [
    ...BATTLE_SKILLS.filter(s=>s.category==='core' && !s.baseline && isSkillUnlocked(s, craftedSkillIds)),
    ...(customSkillDef ? [customSkillEntry(customSkillDef)] : []),
  ];
  const tacticalCount = loadout.filter(id=>tactical.some(s=>s.id===id)).length;
  const coreCount = loadout.filter(id=>availableCore.some(s=>s.id===id)).length;
  const toggleSkill = (id) => {
    const skill = BATTLE_SKILLS.find(s=>s.id===id) || availableCore.find(s=>s.id===id);
    if(!skill) return;
    setLoadout(prev=>{
      if(prev.includes(id)) return prev.filter(x=>x!==id);
      const cap = skill.category==='core' ? CORE_SKILL_CAP : TACTICAL_SKILL_CAP;
      const count = skill.category==='core' ? coreCount : tacticalCount;
      return count<cap ? [...prev,id] : prev;
    });
  };
  return (
    <div>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:'10px',color:'#3a5a6a',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Proxie Name</div>
        <input value={name} onChange={e=>setName(e.target.value)} maxLength={24} placeholder="e.g. Specter.EXE"
          style={{width:'100%',padding:'9px 12px',background:'#0a1218',border:'1px solid #1e3a4a',borderRadius:6,color:'#b0dff4',fontSize:14,fontFamily:"'Rajdhani',sans-serif"}} />
      </div>

      {availableCore.length>0&&(
        <div style={{marginBottom:16}}>
          <div style={{fontSize:'10px',color:'#3a5a6a',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Loadout — Core Skills (pick up to {CORE_SKILL_CAP})</div>
          {availableCore.map(s=>{
            const picked = loadout.includes(s.id);
            const disabled = !picked && coreCount>=CORE_SKILL_CAP;
            return (
              <div key={s.id} onClick={()=>!disabled&&toggleSkill(s.id)}
                style={{background:'#0a1218',border:`1px solid ${picked?s.color:s.color+'44'}`,borderRadius:8,padding:'10px 12px',marginBottom:8,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,boxShadow:picked?`0 0 12px ${s.color}55`:'none'}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:18}}>{s.icon}</span>
                  <span style={{fontSize:13,fontWeight:'bold',color:s.color}}>{s.name}</span>
                  <span style={{fontSize:10,color:'#7a9db5',marginLeft:'auto'}}>{s.tagline}</span>
                  {picked&&<span style={{fontSize:14,color:s.color}}>✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{marginBottom:16}}>
        <div style={{fontSize:'10px',color:'#3a5a6a',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Loadout — Tactical Skills (pick up to {TACTICAL_SKILL_CAP})</div>
        {tactical.map(s=>{
          const picked = loadout.includes(s.id);
          const disabled = !picked && tacticalCount>=TACTICAL_SKILL_CAP;
          return (
            <div key={s.id} onClick={()=>!disabled&&toggleSkill(s.id)}
              style={{background:'#0a1218',border:`1px solid ${picked?s.color:s.color+'44'}`,borderRadius:8,padding:'10px 12px',marginBottom:8,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,boxShadow:picked?`0 0 12px ${s.color}55`:'none'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:18}}>{s.icon}</span>
                <span style={{fontSize:13,fontWeight:'bold',color:s.color}}>{s.name}</span>
                <span style={{fontSize:10,color:'#7a9db5',marginLeft:'auto'}}>{s.tagline}</span>
                {picked&&<span style={{fontSize:14,color:s.color}}>✓</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{marginBottom:20}}>
        <div style={{fontSize:'10px',color:'#3a5a6a',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:6}}>Element</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {Object.entries(ELEMENTS.base).map(([name2,d])=>(
            <button key={name2} onClick={()=>setElement(name2)}
              style={{flex:'1 0 40%',display:'flex',alignItems:'center',gap:6,padding:'8px 10px',background:element===name2?`${d.color}22`:'#0a1218',border:`1px solid ${element===name2?d.color:d.color+'44'}`,borderRadius:6,color:element===name2?d.color:'#b0dff4',cursor:'pointer'}}>
              <span style={{fontSize:16}}>{d.icon}</span><span style={{fontWeight:'bold',fontSize:12}}>{name2}</span>
            </button>
          ))}
        </div>
        {elMeta&&<div style={{fontSize:10,color:'#7a9db5',marginTop:8,lineHeight:1.5}}>{elMeta.description}</div>}
      </div>

      <div style={{display:'flex',gap:10}}>
        <button onClick={()=>canSubmit&&onSubmit({name:name.trim(),loadout,element})} disabled={!canSubmit}
          style={{flex:1,padding:13,background:canSubmit?'rgba(204,68,34,0.18)':'rgba(20,30,40,0.6)',border:`1px solid ${canSubmit?'#cc4422':'#1e3a4a'}`,borderRadius:6,color:canSubmit?'#ff8866':'#2a4a5e',fontSize:14,fontWeight:'bold',cursor:canSubmit?'pointer':'not-allowed',letterSpacing:'0.08em'}}>
          {canSubmit ? submitLabel : 'Name your Proxie, pick a loadout and element'}
        </button>
        {onCancel && (
          <button onClick={onCancel}
            style={{padding:'13px 18px',background:'rgba(90,125,150,0.15)',border:'1px solid #3a6a8a',borderRadius:6,color:'#7a9db5',fontSize:13,fontWeight:'bold',cursor:'pointer'}}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

// Deploy roll modal — rolls the d100 sigil, reveals the tier, then prompts the
// player to pick a legal row-7 tile (handled on the grid).
const DeployRollModal = ({show, rolling, roll, tier, awaitingPlacement, onRoll, onClose}) => {
  // Once placement is awaited, the grid itself needs to be clickable — a
  // full-screen backdrop here would sit on top of it and eat every click,
  // making the highlighted row-7 tiles unreachable. Bail out to null and let
  // the fixed bottom-center banner (rendered alongside the grid) carry the
  // status + cancel affordance instead, same pattern as Compass Slash/Dark
  // Web/Summon Command targeting.
  if(!show || awaitingPlacement) return null;
  const purple='#9b6cff';
  const meta = tier ? SUMMON_TIER_META[tier] : null;
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2500}}>
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
        {roll===null
          ? <button onClick={onRoll} disabled={rolling}
              style={{width:'100%',padding:14,background:`${purple}22`,color:purple,border:`1px solid ${purple}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:rolling?'not-allowed':'pointer',letterSpacing:'0.1em'}}>
              {rolling?'Rolling...':'Roll Sigil (d100)'}
            </button>
          : null}
        <button onClick={onClose}
          style={{width:'100%',marginTop:12,padding:8,background:'transparent',color:'#3a5a6a',border:'1px solid #1e3a4a',borderRadius:5,cursor:'pointer',fontSize:12}}>
          Cancel
        </button>
      </div>
    </div>
  );
};
// Lets the player commit multiple Energy to a single melee swing instead of
// clicking Melee once per point — mirrors the enemy AI's auto-batched burst
// (meleeBurstMultiplier) but as a player-driven choice rather than an
// automatic cap, since the player may want to hold Energy back.
const MeleeMultiplierModal = ({show, perHitDamage, maxMultiplier, targetLabel, onConfirm, onClose}) => {
  const [mult, setMult] = useState(1);
  useEffect(()=>{ if(show) setMult(1); },[show]);
  if(!show) return null;
  const gold='#ffd700';
  const dmg = perHitDamage*mult;
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2500}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#080e14',border:`2px solid ${gold}`,borderRadius:10,padding:'1.4rem',maxWidth:380,width:'92%',color:'#b0dff4',boxShadow:`0 0 40px ${gold}44`}}>
        <div style={{textAlign:'center',marginBottom:16}}>
          <span style={{fontSize:24}}>⚔</span>
          <h2 style={{fontSize:'1.05rem',letterSpacing:'0.12em',textTransform:'uppercase',color:gold,marginTop:4}}>Melee Burst</h2>
          <div style={{fontSize:'11px',color:'#5a7a8a',marginTop:2}}>Spend Energy on {targetLabel||'the target'} — 1 Energy per hit.</div>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:14,marginBottom:14}}>
          <button onClick={()=>setMult(m=>Math.max(1,m-1))} disabled={mult<=1}
            style={{width:38,height:38,borderRadius:6,background:`${gold}18`,border:`1px solid ${gold}`,color:gold,fontSize:18,fontWeight:'bold',cursor:mult<=1?'not-allowed':'pointer',opacity:mult<=1?0.4:1}}>-</button>
          <div style={{minWidth:70,textAlign:'center'}}>
            <div style={{fontSize:28,fontWeight:'bold',color:gold}}>{mult}x</div>
            <div style={{fontSize:10,color:'#5a7a8a'}}>energy</div>
          </div>
          <button onClick={()=>setMult(m=>Math.min(maxMultiplier,m+1))} disabled={mult>=maxMultiplier}
            style={{width:38,height:38,borderRadius:6,background:`${gold}18`,border:`1px solid ${gold}`,color:gold,fontSize:18,fontWeight:'bold',cursor:mult>=maxMultiplier?'not-allowed':'pointer',opacity:mult>=maxMultiplier?0.4:1}}>+</button>
        </div>
        <input type="range" min={1} max={maxMultiplier} value={mult} onChange={e=>setMult(Number(e.target.value))}
          style={{width:'100%',marginBottom:14,accentColor:gold}} />
        <div style={{background:'#0a1218',border:`1px solid ${gold}55`,borderRadius:8,padding:'10px 14px',marginBottom:14,textAlign:'center'}}>
          <div style={{fontSize:11,color:'#7a9db5'}}>{perHitDamage} dmg/hit × {mult}</div>
          <div style={{fontSize:22,fontWeight:'bold',color:gold,marginTop:2}}>{dmg} damage</div>
        </div>
        <button onClick={()=>onConfirm(mult)}
          style={{width:'100%',padding:14,background:`${gold}22`,color:gold,border:`1px solid ${gold}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>
          Melee ({mult}x)
        </button>
        <button onClick={onClose}
          style={{width:'100%',marginTop:10,padding:8,background:'transparent',color:'#3a5a6a',border:'1px solid #1e3a4a',borderRadius:5,cursor:'pointer',fontSize:12}}>
          Cancel
        </button>
      </div>
    </div>
  );
};
// Piercing Light's energy-investment modal — same shape as Melee Burst, but
// starts at the skill's own base cost (3, not 1) and shows a flat per-point
// damage buff rather than a hit-count multiplier, since it always hits
// exactly the 2 tiles ahead of current facing regardless of Energy spent.
const PiercingLightModal = ({show, maxEnergy, onConfirm, onClose}) => {
  const [energy, setEnergy] = useState(PIERCING_LIGHT_BASE_COST);
  useEffect(()=>{ if(show) setEnergy(PIERCING_LIGHT_BASE_COST); },[show]);
  if(!show) return null;
  const gold='#ffdd77';
  const dmg = piercingLightDamage(energy);
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2500}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#080e14',border:`2px solid ${gold}`,borderRadius:10,padding:'1.4rem',maxWidth:380,width:'92%',color:'#b0dff4',boxShadow:`0 0 40px ${gold}44`}}>
        <div style={{textAlign:'center',marginBottom:16}}>
          <span style={{fontSize:24}}>♜</span>
          <h2 style={{fontSize:'1.05rem',letterSpacing:'0.12em',textTransform:'uppercase',color:gold,marginTop:4}}>Piercing Light</h2>
          <div style={{fontSize:'11px',color:'#5a7a8a',marginTop:2}}>Hits both tiles straight ahead — {PIERCING_LIGHT_BASE_COST} Energy minimum.</div>
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:14,marginBottom:14}}>
          <button onClick={()=>setEnergy(e=>Math.max(PIERCING_LIGHT_BASE_COST,e-1))} disabled={energy<=PIERCING_LIGHT_BASE_COST}
            style={{width:38,height:38,borderRadius:6,background:`${gold}18`,border:`1px solid ${gold}`,color:gold,fontSize:18,fontWeight:'bold',cursor:energy<=PIERCING_LIGHT_BASE_COST?'not-allowed':'pointer',opacity:energy<=PIERCING_LIGHT_BASE_COST?0.4:1}}>-</button>
          <div style={{minWidth:70,textAlign:'center'}}>
            <div style={{fontSize:28,fontWeight:'bold',color:gold}}>{energy}</div>
            <div style={{fontSize:10,color:'#5a7a8a'}}>energy</div>
          </div>
          <button onClick={()=>setEnergy(e=>Math.min(maxEnergy,e+1))} disabled={energy>=maxEnergy}
            style={{width:38,height:38,borderRadius:6,background:`${gold}18`,border:`1px solid ${gold}`,color:gold,fontSize:18,fontWeight:'bold',cursor:energy>=maxEnergy?'not-allowed':'pointer',opacity:energy>=maxEnergy?0.4:1}}>+</button>
        </div>
        <input type="range" min={PIERCING_LIGHT_BASE_COST} max={maxEnergy} value={energy} onChange={e=>setEnergy(Number(e.target.value))}
          style={{width:'100%',marginBottom:14,accentColor:gold}} />
        <div style={{background:'#0a1218',border:`1px solid ${gold}55`,borderRadius:8,padding:'10px 14px',marginBottom:14,textAlign:'center'}}>
          <div style={{fontSize:11,color:'#7a9db5'}}>{dmg} dmg to each of the 2 tiles ahead</div>
          <div style={{fontSize:22,fontWeight:'bold',color:gold,marginTop:2}}>{dmg} damage</div>
        </div>
        <button onClick={()=>onConfirm(energy)}
          style={{width:'100%',padding:14,background:`${gold}22`,color:gold,border:`1px solid ${gold}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>
          Piercing Light ({energy}E)
        </button>
        <button onClick={onClose}
          style={{width:'100%',marginTop:10,padding:8,background:'transparent',color:'#3a5a6a',border:'1px solid #1e3a4a',borderRadius:5,cursor:'pointer',fontSize:12}}>
          Cancel
        </button>
      </div>
    </div>
  );
};
const ElementPickerModal = ({selectedCategory,selectedElement,onSelect,onClose,restrictToBase}) => {
  const allEl={...ELEMENTS.base,...ELEMENTS.minor,...ELEMENTS.major};
  const elData=allEl[selectedElement];
  const categories = restrictToBase
    ? [['base','Base']]
    : [['base','Base'],['minor','Minor Fusion'],['major','Major Fusion']];
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
        {categories.map(([cat,label])=>(
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

const PlayerStatsPanel = ({player,playerRolledEnergy,selectedCategory,selectedElement,onElementSelect,canAttack,canSkill,onMelee,onSkill,onEndTurn,onRollEnergy,energyPhase,onSurrender,enemy,enemyRolledEnergy,enemies,enemyRolledEnergyById,selectedEnemyId,onSelectEnemy,isPlayerTurn,loadout,summons,canCompassSlash,onCompassSlash,canCircuitSigil,onCircuitSigil,circuitSigilReason,canRotate,onRotate,canDarkWeb,onDarkWeb,canPulseWave,onPulseWave,canPiercingLight,onPiercingLight,canCustomSkill,onCustomSkill,customSkillDef,customSkillCost,hideElementalSkill,restrictElementsToBase,lockElementPicker}) => {
  const [showPicker,setShowPicker]=useState(false);
  const allEl={...ELEMENTS.base,...ELEMENTS.minor,...ELEMENTS.major};
  const elData=allEl[selectedElement];
  // Campaign passes `enemies` (roster array) instead of a single `enemy`.
  const enemyElData=(!enemies&&enemy.element)?ELEMENTS[enemy.elementCategory]&&ELEMENTS[enemy.elementCategory][enemy.element]:null;
  const showRollBtn = isPlayerTurn && energyPhase==='roll';
  const showActions = isPlayerTurn && energyPhase==='act';
  const skillCost = getSkillCost(selectedCategory, selectedElement);
  const loadoutMeta = loadout.map(id=>id==='customSkill'&&customSkillDef?customSkillEntry(customSkillDef):BATTLE_SKILLS.find(s=>s.id===id)).filter(Boolean);
  const hasCompassSlash = loadout.includes('compassSlash');
  const hasCircuitSigil = loadout.includes('circuitSigil');
  const hasDarkWeb = loadout.includes('darkWeb');
  const hasPulseWave = loadout.includes('pulseWave');
  const hasPiercingLight = loadout.includes('piercingLight');
  const hasCustomSkill = loadout.includes('customSkill') && !!customSkillDef;
  const hasTacticalAction = hasCompassSlash || hasCircuitSigil || hasDarkWeb || hasPulseWave || hasPiercingLight || hasCustomSkill;
  // Campaign always renders alongside a floating "Main" nav button (see
  // App.jsx) that already gets you out of the session — a second, separate
  // Quit button next to it was pure redundancy. Training scenes have no such
  // nav overlay (their Quit is the only way back to the Tutorial Hub), so
  // this only suppresses it for Campaign specifically, via the same
  // `enemies` truthiness that already distinguishes the two everywhere else
  // in this component.
  const hideQuit = !!enemies;
  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minHeight:0,height:'100%'}}>
        {/* Scrollable body — stats columns live here so they can never push the
            panel (or the row) taller than the grid. Action buttons stay pinned
            below, outside the scroll region. */}
        <div style={{flex:1,minHeight:0,overflowY:'auto',display:'flex',gap:'12px',paddingRight:'2px'}}>
          <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #1e3a4a',paddingBottom:'6px',marginBottom:'10px',gap:6}}>
              <div style={{fontSize:'0.75rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#00c8ff',display:'flex',alignItems:'center',gap:'5px',whiteSpace:'nowrap'}}><span>o</span>Proxy</div>
              {!hideElementalSkill&&(
                <button onClick={lockElementPicker?undefined:()=>setShowPicker(true)}
                  style={{display:'flex',alignItems:'center',gap:'4px',background:`${elData&&elData.color||'#00c8ff'}11`,border:`1px solid ${elData&&elData.color||'#00c8ff'}55`,borderRadius:'4px',padding:'2px 7px',cursor:lockElementPicker?'default':'pointer',transition:'all 0.15s',minWidth:0}}
                  onMouseEnter={lockElementPicker?undefined:e=>e.currentTarget.style.borderColor=elData&&elData.color||'#00c8ff'}
                  onMouseLeave={lockElementPicker?undefined:e=>e.currentTarget.style.borderColor=`${elData&&elData.color||'#00c8ff'}55`}>
                  <span style={{fontSize:'12px'}}>{elData&&elData.icon}</span>
                  <span style={{fontSize:'11px',fontWeight:'bold',color:elData&&elData.color||'#b0dff4',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{selectedElement}</span>
                  {!lockElementPicker&&<span style={{fontSize:'9px',color:'#3a6a8a'}}>v</span>}
                </button>
              )}
            </div>
            {loadoutMeta.length>0&&(
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:'rgba(155,108,255,0.07)',border:'1px solid #9b6cff44',borderRadius:4,padding:'3px 8px',marginBottom:8,gap:6,flexWrap:'wrap'}}>
                <span style={{display:'flex',alignItems:'center',gap:8,fontSize:'11px',flexWrap:'wrap'}}>
                  {loadoutMeta.map(s=>(
                    <span key={s.id} style={{display:'flex',alignItems:'center',gap:3,color:s.color,fontWeight:'bold',whiteSpace:'nowrap'}}>{s.icon}{s.name}</span>
                  ))}
                </span>
                {hasCircuitSigil&&<span style={{fontSize:'10px',color:'#8ab5cc',fontFamily:'monospace',whiteSpace:'nowrap'}}>Bandwidth {summons.filter(s=>(!s.side||s.side==='player')&&!s.promoted).length}/{BANDWIDTH}</span>}
              </div>
            )}
            <StatLine
              label="Energy"
              value={playerRolledEnergy===0 ? (isPlayerTurn ? 'awaiting roll' : '-') : `${player.actionpts} / ${playerRolledEnergy}${player.energyRollover>0?` (+${player.energyRollover})`:''}`}
              accent={playerRolledEnergy===0?(isPlayerTurn?'#ffd700':'#3a5a6a'):player.actionpts>0?'#00ff88':'#ff4444'}
            />
            <EnergyBar current={player.actionpts} rolled={playerRolledEnergy} rollover={player.energyRollover} />
            {player.frozen>0&&<StatLine label="Freeze" value={`-${player.frozen} Energy next round`} accent="#a0e4ff" />}
            {player.burn&&<StatLine label="Burn" value={`-${player.burn.dmg} HP for ${player.burn.turns} more turn${player.burn.turns>1?'s':''}`} accent="#ff6b00" />}
            {summons.some(s=>!s.side||s.side==='player')&&(
              <div style={{marginTop:6,borderTop:'1px solid #1e3a4a',paddingTop:6}}>
                <div style={{fontSize:'9px',color:'#3a6a8a',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:4}}>Active Summons</div>
                {summons.filter(s=>!s.side||s.side==='player').map(s=>{
                  const m=SUMMON_TIER_META[s.tier];
                  return (
                    <div key={s.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:'10px',marginBottom:2,gap:6}}>
                      <span style={{display:'flex',alignItems:'center',gap:4,color:s.promoted?'#ffd700':m.color,whiteSpace:'nowrap'}}><span>{m.icon}{s.promoted?'★':''}</span>{s.tier}{s.promoted?' (Agent)':''}</span>
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
              <div style={{fontSize:'0.75rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#cc4422',display:'flex',alignItems:'center',gap:'5px',whiteSpace:'nowrap'}}><span>*</span>{enemies?`Enemies (${enemies.length})`:'Enemy'}</div>
              {!enemies&&enemyElData&&<span style={{display:'flex',alignItems:'center',gap:'3px',background:`${enemyElData.color}18`,border:`1px solid ${enemyElData.color}55`,borderRadius:'4px',padding:'1px 6px',fontSize:'11px',color:enemyElData.color,fontWeight:'bold',whiteSpace:'nowrap'}}><span>{enemyElData.icon}</span>{enemy.element}</span>}
              {!enemies&&<span style={{fontSize:'11px',color:'#b0dff4',fontWeight:'bold',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',minWidth:0}}>{enemy.name}</span>}
              {!enemies&&<span style={{fontSize:'11px',color:'#7a9db5',whiteSpace:'nowrap'}}>Lv<span style={{color:'#b0dff4',fontWeight:'bold',marginLeft:2}}>{enemy.level}</span></span>}
            </div>
            {enemies ? (
              enemies.map(e=>{
                const eEl = e.element?ELEMENTS[e.elementCategory]&&ELEMENTS[e.elementCategory][e.element]:null;
                const rolled = enemyRolledEnergyById?.[e.id]||0;
                const selected = e.id===selectedEnemyId;
                return (
                  <div key={e.id} onClick={()=>onSelectEnemy&&onSelectEnemy(e.id)}
                    style={{border:`1px solid ${selected?'#ffd700':'#3a1a1a'}`,borderRadius:5,padding:'6px 7px',marginBottom:6,cursor:'pointer',background:selected?'rgba(255,215,0,0.08)':'transparent'}}>
                    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:3,flexWrap:'wrap'}}>
                      <span style={{fontSize:9,color:'#cc4422',border:'1px solid #cc442266',borderRadius:3,padding:'0 4px',fontWeight:'bold'}}>R{e.rank}</span>
                      {eEl&&<span style={{fontSize:11}}>{eEl.icon}</span>}
                      <span style={{fontSize:11,color:'#b0dff4',fontWeight:'bold',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,minWidth:0}}>{e.name}</span>
                    </div>
                    <HealthBar current={e.health} max={e.maxHealth} />
                    <StatLine label="Energy" value={rolled===0?'-':`${e.actionpts} / ${rolled}`} accent={e.actionpts>0?'#ff6644':'#555'} />
                    {e.burn&&<StatLine label="Burn" value={`-${e.burn.dmg} HP × ${e.burn.turns}`} accent="#ff6b00" />}
                  </div>
                );
              })
            ) : (
              <>
                <StatLine label="HP" value={`${enemy.health} / ${enemy.maxHealth}`} />
                <HealthBar current={enemy.health} max={enemy.maxHealth} />
                <StatLine
                  label="Energy"
                  value={enemyRolledEnergy===0 ? '-' : `${enemy.actionpts} / ${enemyRolledEnergy}${enemy.energyRollover>0?` (+${enemy.energyRollover})`:''}`}
                  accent={enemy.actionpts>0?'#ff6644':'#555'}
                />
                <EnergyBar current={enemy.actionpts} rolled={enemyRolledEnergy} rollover={enemy.energyRollover} />
                {enemy.frozen>0&&<StatLine label="Freeze" value={`-${enemy.frozen} Energy next round`} accent="#a0e4ff" />}
                {enemy.burn&&<StatLine label="Burn" value={`-${enemy.burn.dmg} HP for ${enemy.burn.turns} more turn${enemy.burn.turns>1?'s':''}`} accent="#ff6b00" />}
                {enemy.element&&<StatLine label="Skill" value={enemy.skillUsed?'used':'ready'} accent={enemy.skillUsed?'#3a6a8a':'#00cc66'} />}
              </>
            )}
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
              {!hideQuit && (
                <button onClick={onSurrender}
                  style={{flex:1,padding:'9px 6px',background:'transparent',border:'1px solid #1e3a4a',borderRadius:'4px',color:'#3a6a8a',fontSize:'12px',fontWeight:600,cursor:'pointer',letterSpacing:'.05em',fontFamily:"'Rajdhani',sans-serif"}}>
                  QUIT
                </button>
              )}
            </>
          ) : showActions ? (
            <>
              <button onClick={onMelee} disabled={!canAttack}
                style={{flex:1,padding:'7px 4px',background:canAttack?'rgba(255,180,0,0.12)':'rgba(20,30,40,0.6)',border:`1px solid ${canAttack?'#cc9900':'#1e3a4a'}`,borderRadius:'4px',color:canAttack?'#ffd700':'#2a4a5e',fontSize:'11px',fontWeight:600,cursor:canAttack?'pointer':'not-allowed',letterSpacing:'.04em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                MELEE<div style={{fontSize:'8px',opacity:0.7}}>{playerMeleeBase(player.level)} · 1E</div>
              </button>
              {!hideElementalSkill&&(
                <button onClick={onSkill} disabled={!canSkill}
                  style={{flex:hasTacticalAction?1:1.2,padding:'7px 4px',background:canSkill?'rgba(200,60,0,0.2)':'rgba(20,30,40,0.6)',border:`1px solid ${canSkill?'#cc3300':'#1e3a4a'}`,borderRadius:'4px',color:canSkill?'#ff6644':'#2a4a5e',fontSize:'11px',fontWeight:600,cursor:canSkill?'pointer':'not-allowed',letterSpacing:'.04em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                  SKILL<div style={{fontSize:'8px',opacity:0.7}}>{player.skillUsed?'used':`${selectedElement.slice(0,4)}·${skillCost}E`}</div>
                </button>
              )}
              <button onClick={onRotate} disabled={!canRotate} title="Rotate facing — 0 Energy, once per turn"
                style={{flex:0.6,padding:'7px 2px',background:canRotate?'rgba(0,200,255,0.12)':'rgba(20,30,40,0.6)',border:`1px solid ${canRotate?'#0090b0':'#1e3a4a'}`,borderRadius:'4px',color:canRotate?'#00c8ff':'#2a4a5e',fontSize:'13px',fontWeight:600,cursor:canRotate?'pointer':'not-allowed',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                ⟳<div style={{fontSize:'8px',opacity:0.7}}>{player.rotateUsed?'used':'0E'}</div>
              </button>
              {hasCompassSlash&&(
                <button onClick={onCompassSlash} disabled={!canCompassSlash}
                  style={{flex:1.2,padding:'7px 4px',background:canCompassSlash?'rgba(155,108,255,0.18)':'rgba(20,30,40,0.6)',border:`1px solid ${canCompassSlash?'#9b6cff':'#1e3a4a'}`,borderRadius:'4px',color:canCompassSlash?'#b08cff':'#2a4a5e',fontSize:'11px',fontWeight:600,cursor:canCompassSlash?'pointer':'not-allowed',letterSpacing:'.03em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                  COMPASS SLASH<div style={{fontSize:'8px',opacity:0.7}}>{player.usedSkillIds.includes('compassSlash')?'used':'2E'}</div>
                </button>
              )}
              {hasCircuitSigil&&(
                <button onClick={onCircuitSigil} disabled={!canCircuitSigil} title={!canCircuitSigil&&circuitSigilReason?`Unavailable — ${circuitSigilReason}`:undefined}
                  style={{flex:1.2,padding:'7px 4px',background:canCircuitSigil?'rgba(155,108,255,0.18)':'rgba(20,30,40,0.6)',border:`1px solid ${canCircuitSigil?'#9b6cff':'#1e3a4a'}`,borderRadius:'4px',color:canCircuitSigil?'#b08cff':'#2a4a5e',fontSize:'11px',fontWeight:600,cursor:canCircuitSigil?'pointer':'not-allowed',letterSpacing:'.03em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                  CIRCUIT SIGIL<div style={{fontSize:'8px',opacity:0.7}}>{player.usedSkillIds.includes('circuitSigil')?'used':'2E'}</div>
                </button>
              )}
              {hasDarkWeb&&(
                <button onClick={onDarkWeb} disabled={!canDarkWeb}
                  style={{flex:1.2,padding:'7px 4px',background:canDarkWeb?'rgba(160,160,160,0.18)':'rgba(20,30,40,0.6)',border:`1px solid ${canDarkWeb?'#a0a0a0':'#1e3a4a'}`,borderRadius:'4px',color:canDarkWeb?'#c8c8c8':'#2a4a5e',fontSize:'11px',fontWeight:600,cursor:canDarkWeb?'pointer':'not-allowed',letterSpacing:'.03em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                  DARK WEB<div style={{fontSize:'8px',opacity:0.7}}>{player.usedSkillIds.includes('darkWeb')?'used':'2E'}</div>
                </button>
              )}
              {hasPulseWave&&(
                <button onClick={onPulseWave} disabled={!canPulseWave}
                  style={{flex:1.2,padding:'7px 4px',background:canPulseWave?'rgba(201,167,247,0.18)':'rgba(20,30,40,0.6)',border:`1px solid ${canPulseWave?'#c9a7f7':'#1e3a4a'}`,borderRadius:'4px',color:canPulseWave?'#c9a7f7':'#2a4a5e',fontSize:'11px',fontWeight:600,cursor:canPulseWave?'pointer':'not-allowed',letterSpacing:'.03em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                  PULSE WAVE<div style={{fontSize:'8px',opacity:0.7}}>{player.usedSkillIds.includes('pulseWave')?'used':'3E'}</div>
                </button>
              )}
              {hasPiercingLight&&(
                <button onClick={onPiercingLight} disabled={!canPiercingLight}
                  style={{flex:1.2,padding:'7px 4px',background:canPiercingLight?'rgba(255,221,119,0.18)':'rgba(20,30,40,0.6)',border:`1px solid ${canPiercingLight?'#ffdd77':'#1e3a4a'}`,borderRadius:'4px',color:canPiercingLight?'#ffdd77':'#2a4a5e',fontSize:'11px',fontWeight:600,cursor:canPiercingLight?'pointer':'not-allowed',letterSpacing:'.03em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                  PIERCING LIGHT<div style={{fontSize:'8px',opacity:0.7}}>{player.usedSkillIds.includes('piercingLight')?'used':`${PIERCING_LIGHT_BASE_COST}E+`}</div>
                </button>
              )}
              {hasCustomSkill&&(
                <button onClick={onCustomSkill} disabled={!canCustomSkill}
                  style={{flex:1.2,padding:'7px 4px',background:canCustomSkill?`${customSkillEntry(customSkillDef).color}30`:'rgba(20,30,40,0.6)',border:`1px solid ${canCustomSkill?customSkillEntry(customSkillDef).color:'#1e3a4a'}`,borderRadius:'4px',color:canCustomSkill?customSkillEntry(customSkillDef).color:'#2a4a5e',fontSize:'11px',fontWeight:600,cursor:canCustomSkill?'pointer':'not-allowed',letterSpacing:'.03em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                  {customSkillDef.name.toUpperCase()}<div style={{fontSize:'8px',opacity:0.7}}>{player.usedSkillIds.includes('customSkill')?'used':`${customSkillCost}E`}</div>
                </button>
              )}
              <button onClick={onEndTurn}
                style={{flex:1,padding:'7px 4px',background:'rgba(0,200,100,0.1)',border:'1px solid #1e6a3a',borderRadius:'4px',color:'#00cc66',fontSize:'11px',fontWeight:600,cursor:'pointer',letterSpacing:'.04em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                END<div style={{fontSize:'8px',opacity:0.7}}>{player.actionpts>0?`save ${player.actionpts}E`:'0E left'}</div>
              </button>
              {!hideQuit && (
                <button onClick={onSurrender}
                  style={{flex:0.7,padding:'7px 4px',background:'transparent',border:'1px solid #1e3a4a',borderRadius:'4px',color:'#3a6a8a',fontSize:'11px',fontWeight:600,cursor:'pointer',letterSpacing:'.04em',fontFamily:"'Rajdhani',sans-serif",transition:'all 0.2s'}}>
                  QUIT
                </button>
              )}
            </>
          ) : !hideQuit ? (
            <button onClick={onSurrender}
              style={{flex:1,padding:'7px 6px',background:'transparent',border:'1px solid #1e3a4a',borderRadius:'4px',color:'#3a6a8a',fontSize:'12px',fontWeight:600,cursor:'pointer',letterSpacing:'.05em',fontFamily:"'Rajdhani',sans-serif"}}>
              QUIT
            </button>
          ) : null}
        </div>
        {showPicker&&<ElementPickerModal selectedCategory={selectedCategory} selectedElement={selectedElement} onSelect={onElementSelect} onClose={()=>setShowPicker(false)} restrictToBase={restrictElementsToBase} />}
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
          const isSummon=l.includes('Novice')||l.includes('Sigil')||l.includes('Bandwidth')||l.includes('Compass')||l.includes('Loadout');
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

const Grid = ({playerPos,enemyPos,enemies,selectedEnemyId,validSquares,onSquareClick,playerSelected,tiles,playerFacing,enemyFacing,aoeTiles,knightTiles,summons,obstacles,deployTiles,castFx}) => {
  const cells=[];
  for(let y=0;y<SIZE;y++) for(let x=0;x<SIZE;x++){
    const isP=playerPos.x===x&&playerPos.y===y;
    // Campaign passes `enemies` (array, multi-target) instead of the single
    // `enemyPos`/`enemyFacing` pair Gauntlet/Training use.
    const enemyHere = enemies && enemies.find(e=>e.boardPosition.x===x&&e.boardPosition.y===y);
    const isE = enemies ? !!enemyHere : (enemyPos.x===x&&enemyPos.y===y);
    const summon=summons&&summons.find(s=>s.boardPosition.x===x&&s.boardPosition.y===y);
    const obstacle=obstacles&&obstacles.find(o=>o.boardPosition.x===x&&o.boardPosition.y===y);
    const isA=validSquares.some(s=>s.x===x&&s.y===y);
    const isAoe=aoeTiles&&aoeTiles.some(s=>s.x===x&&s.y===y);
    const isKnight=knightTiles&&knightTiles.some(s=>s.x===x&&s.y===y);
    const isDeploy=deployTiles&&deployTiles.some(s=>s.x===x&&s.y===y);
    const tileType=tiles&&tiles[y]&&tiles[y][x]||TILE_TYPES.NORMAL;
    let cls='square';
    let label='';
    if(isP){ cls+=' player'+(playerSelected?' playerSelected':''); label=facingArrow(playerFacing); }
    else if(isE){
      cls+=' enemy'+(enemyHere&&enemyHere.id===selectedEnemyId?' enemySelected':'')+(isA?' attackable':'');
      label=facingArrow(enemyHere?enemyHere.facing:enemyFacing);
    }
    else if(summon){
      cls+=' summon'+(summon.side==='enemy'?' enemySide':'')+(summon.promoted?' promoted':'');
      label=SUMMON_TIER_META[summon.tier].icon+(summon.promoted?'★':'');
    }
    else if(obstacle){
      cls+=' obstacle';
      label=OBSTACLE_META.icon;
    }
    else { if(isA) cls+=' available'; cls+=' '+tileClassName(tileType); }
    if(isAoe) cls+=' aoePreview';
    if(isKnight) cls+=' knightPreview';
    if(isDeploy) cls+=' deployTile';
    const fxHere = castFx && castFx.x===x && castFx.y===y;
    cells.push(
      <div key={`${x}-${y}`} className={cls} onClick={()=>onSquareClick(x,y)}
        title={obstacle?`Rubble — ${obstacle.health}/${obstacle.maxHealth} HP`:undefined}
        onMouseEnter={e=>e.currentTarget.classList.add('hovered')}
        onMouseLeave={e=>e.currentTarget.classList.remove('hovered')}>
        {label}
        {fxHere&&<div key={castFx.key} className="castFxRing" style={{'--fx-color':castFx.color}} />}
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
  const willBurn = pulses !== null && pulses >= 3;

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
              <div style={{fontSize:'11px',marginTop:6,color:willBurn?'#ff6b00':'#3a6a8a'}}>
                {willBurn ? '🔥 3+ pulses — sets Burning (10 dmg, 2 turns)' : `Needs 3+ pulses to Burn (rolled ${pulses})`}
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
              Ember Strike: <span style={{color:elColor}}>{pulses} x {dmgEach*SKILL_DICE_MULT} = {baseDmg}</span> base dmg{willBurn&&<span style={{color:'#ff6b00'}}> + Burn</span>}
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

// Earth Tremor — roll d6, choose reach 1–floor(roll/2). Reach exactly as far
// as the target and it's a cheap, clean hit; commit farther than needed and
// every other tile in that span cracks into rubble (an obstacle) — in front
// of AND behind the target, up to a pre-existing obstacle which stops the
// shockwave cold and takes the hit itself.
const EarthTremorSection = ({rolls, rolling, onRoll, phase, accuracyRoll, onRollAccuracy, earthRange, onSetEarthRange, onConfirmEarthRange, onApplyWithAccuracy, elColor, playerFacing, enemyDistance, obstacleDistance}) => {
  const dieRoll  = rolls.length > 0 ? rolls[0].value : null;
  // Always at least 1 tile of range, even on the worst roll (d6=1) — a Tremor
  // should never be an unusable wasted turn.
  const maxRange = dieRoll !== null ? Math.max(1, Math.floor(dieRoll / 2)) : 0;
  const baseDmg  = dieRoll !== null ? dieRoll * EARTH_DICE_MULT : null;
  const cost     = earthRange ? 1 + earthRange : null;

  // Preview of what a given reach `r` actually does, mirroring
  // resolveEarthTremor's truncate-at-obstacle / hit-target-in-front logic
  // (minus any summons in the way, which only the real Apply knows about).
  const previewFor = (r) => {
    const blockedAt = obstacleDistance>0 && obstacleDistance<=r ? obstacleDistance : null;
    const effRange = blockedAt ?? r;
    const reachesEnemy = !blockedAt && enemyDistance>0 && enemyDistance<=r;
    const rubble = Math.max(0, effRange - (reachesEnemy?1:0) - (blockedAt?1:0));
    return { blockedAt, reachesEnemy, rubble };
  };
  const selPreview = earthRange ? previewFor(earthRange) : null;

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
                  <span style={{fontSize:'11px',color:'#5a7a8a',marginLeft:8}}>on whatever it actually hits</span>
                </div>
                <span style={{fontSize:'11px',color:'#3a6a8a',fontFamily:'monospace'}}>
                  Facing: <span style={{color:elColor,textTransform:'uppercase'}}>{playerFacing}</span>
                </span>
              </div>
              <div style={{fontSize:'11px',color:'#5a7a8a',marginBottom:8}}>
                Max reach: <span style={{color:elColor,fontWeight:'bold'}}>{maxRange} tile{maxRange>1?'s':''}</span> forward.
                {enemyDistance>0 && enemyDistance<=maxRange && <span> Enemy is <span style={{color:elColor,fontWeight:'bold'}}>{enemyDistance}</span> away — reach exactly that far to keep it cheap.</span>}
                {obstacleDistance>0 && obstacleDistance<=maxRange && <span style={{color:'#ffaa44'}}> Existing rubble at {obstacleDistance} tiles will stop anything reaching that far.</span>}
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:10}}>
                {Array.from({length:maxRange},(_,i)=>i+1).map(r=>{
                  const p=previewFor(r);
                  return (
                    <button key={r} onClick={()=>onSetEarthRange(r)}
                      style={{flex:1,padding:'8px 6px',background:earthRange===r?`${elColor}33`:'transparent',border:`1px solid ${earthRange===r?elColor:'#1e3a4a'}`,borderRadius:4,color:earthRange===r?elColor:'#5a7a8a',cursor:'pointer',fontSize:'12px',textAlign:'center',transition:'all 0.15s'}}>
                      {r} tile{r>1?'s':''}
                      <div style={{fontSize:'10px',marginTop:2,color:earthRange===r?elColor:'#3a6a8a'}}>{1+r} Energy</div>
                      <div style={{fontSize:'9px',marginTop:2,color:p.reachesEnemy?'#66dd88':p.blockedAt?'#ff6644':p.rubble>0?'#c49a52':'#3a6a8a'}}>
                        {p.reachesEnemy?'hits enemy':p.blockedAt?'hits rubble':''}{p.rubble>0?`${p.reachesEnemy||p.blockedAt?' +':''}${p.rubble} rubble`:(p.reachesEnemy||p.blockedAt?'':'—')}
                      </div>
                    </button>
                  );
                })}
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
              Tremor: <span style={{color:elColor}}>{earthRange} tile{earthRange>1?'s':''} forward</span> — <span style={{color:elColor}}>{baseDmg} dmg</span> on impact
              {selPreview?.rubble>0 && <span style={{color:'#c49a52'}}> · +{selPreview.rubble} rubble</span>}
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
                <span style={{fontSize:'11px',color:'#5a7a8a',marginLeft:6}}>(on whatever's in range)</span>
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

// Air Gale Force — roll d8: that's both your reach and your power. Damage
// scales 40->180 by roll (steps of 20) regardless of distance; whatever roll isn't spent
// reaching the target becomes knockback (minimum 1 tile).
const AirGaleForceSection = ({rolls, rolling, onRoll, phase, accuracyRoll, onRollAccuracy, onProceedToAccuracy, onApplyWithAccuracy, elColor, playerFacing, enemyDistance}) => {
  const dieRoll = rolls.length > 0 ? rolls[0].value : null;
  const onLine = enemyDistance > 0;
  const hit = dieRoll !== null && onLine && enemyDistance <= dieRoll;
  const baseDmg = dieRoll !== null ? airGaleForceDamage(dieRoll) : null;
  const knockDist = hit ? Math.max(1, dieRoll - enemyDistance) : null;
  const facingLabel = {up:'↑ up',down:'↓ down',left:'← left',right:'→ right'}[playerFacing]||playerFacing;

  return (
    <>
      <div style={{textAlign:'center',fontSize:'11px',marginBottom:12,padding:'6px 8px',background:onLine?`${elColor}11`:'rgba(255,68,68,0.08)',border:`1px solid ${onLine?`${elColor}44`:'#5a2a2a'}`,borderRadius:4}}>
        <span style={{color:'#7a9db5'}}>Facing </span><span style={{color:elColor,fontWeight:'bold'}}>{facingLabel}</span>
        {onLine
          ? <span style={{color:'#7a9db5'}}> — enemy is <span style={{color:elColor,fontWeight:'bold'}}>{enemyDistance} tile{enemyDistance>1?'s':''}</span> ahead. Roll {enemyDistance}+ on the d8 to reach.</span>
          : <span style={{color:'#ff6644'}}> — enemy is not directly ahead. Move to face it first.</span>}
      </div>

      <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
        <DiceDisplay type="d8" value={dieRoll!==null?dieRoll:'--'} rolling={rolling} color={elColor} label="Gale Force" />
      </div>

      {phase==='roll'&&(
        <>
          <button onClick={onRoll} disabled={rolling||rolls.length>0}
            style={{width:'100%',padding:14,background:rolls.length>0?'#0a1218':`${elColor}22`,color:rolls.length>0?'#3a5a6a':elColor,border:`1px solid ${rolls.length>0?'#1e3a4a':elColor}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:rolling||rolls.length>0?'not-allowed':'pointer',letterSpacing:'0.1em'}}>
            {rolling?'Rolling...':rolls.length>0?'Rolled':'Roll d8'}
          </button>

          {dieRoll!==null&&!rolling&&(
            <div style={{marginTop:16,background:'#0a1218',border:`1px solid ${elColor}44`,borderRadius:8,padding:'14px 16px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:'11px',color:'#5a7a8a',textTransform:'uppercase',letterSpacing:'0.1em'}}>Breakdown</span>
                <span style={{fontSize:'11px',color:'#3a6a8a',fontFamily:'monospace'}}>Cost: <span style={{color:'#ffd700'}}>2 Energy</span></span>
              </div>
              <div style={{display:'flex',alignItems:'baseline',gap:8,fontSize:13,color:'#7a9db5',marginBottom:6}}>
                <span style={{color:'#3a6a8a'}}>Reach</span>
                <span style={{color:'#b0dff4',fontWeight:'bold'}}>{dieRoll}</span>
                <span style={{color:'#3a6a8a'}}>tiles ·</span>
                <span style={{fontSize:18,fontWeight:'bold',color:elColor}}>{baseDmg}</span>
                <span style={{color:'#3a6a8a'}}>base dmg</span>
              </div>
              {hit ? (
                <div style={{fontSize:'11px',color:'#5a7a8a',marginTop:4}}>
                  Reaches the enemy at {enemyDistance} — knocks back <span style={{color:elColor,fontWeight:'bold'}}>{knockDist} tile{knockDist>1?'s':''}</span> (or until they hit a wall).
                </div>
              ) : onLine ? (
                <div style={{fontSize:'11px',color:'#ffaa44',marginTop:4}}>
                  Doesn't reach — enemy is {enemyDistance} tiles away, roll only carries {dieRoll}.
                </div>
              ) : (
                <div style={{fontSize:'11px',color:'#ffaa44',marginTop:4}}>Enemy not on your facing line — this will miss.</div>
              )}
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
              Gale Force: d8={dieRoll} — <span style={{color:hit?elColor:'#ffaa44'}}>{baseDmg} base dmg</span>{hit&&<span style={{color:'#7a9db5'}}> · knockback {knockDist}</span>}
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
                {hit
                  ? <>{baseDmg} → <strong style={{color:elColor}}>{Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(baseDmg,accuracyRoll))} dmg</strong> ({accuracyTierLabel(accuracyRoll)})
                      <span style={{fontSize:'11px',color:'#5a7a8a',marginLeft:6}}> + knockback {knockDist}</span></>
                  : <span style={{color:'#ffaa44'}}>Out of reach — this will miss.</span>}
              </div>
            </div>
          )}
          {accuracyRoll===null
            ?<button onClick={onRollAccuracy} disabled={rolling} style={{width:'100%',padding:14,background:'#ffd70022',color:'#ffd700',border:'1px solid #ffd700',borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>Roll Accuracy (d100)</button>
            :<button onClick={()=>onApplyWithAccuracy(accuracyRoll)} style={{width:'100%',padding:14,background:`${elColor}22`,color:elColor,border:`1px solid ${elColor}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>
              {hit?'Strike + Knockback':'Cast Gale Force'}
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

const DiceModal = ({show,category,elementName,rolls,abilities,rolling,onRoll,onUseAbility,onClose,phase,accuracyRoll,onRollAccuracy,selectedAbilityForAccuracy,onAirProceedToAccuracy,onFireProceedToAccuracy,onFireApplyWithAccuracy,earthRange,onSetEarthRange,onConfirmEarthRange,onEarthApplyWithAccuracy,onAirApplyWithAccuracy,onWaterConfirm,onWaterApplyWithAccuracy,waterAoe,onSetWaterAoe,waterAvailableAP,waterAnchorInBounds,waterEnemyInFootprint,playerFacing,enemyDistance,obstacleDistance}) => {
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
            enemyDistance={enemyDistance} obstacleDistance={obstacleDistance}
          />
        ) : elementData.isAir ? (
          <AirGaleForceSection
            rolls={rolls} rolling={rolling} onRoll={onRoll}
            phase={phase} accuracyRoll={accuracyRoll} onRollAccuracy={onRollAccuracy}
            onProceedToAccuracy={onAirProceedToAccuracy}
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

// Match-start ceremony, part 1: reveals the placement roll rather than it
// just happening invisibly before the player sees the board. The roll
// itself was already determined at character creation (newHero /
// rollBackRowPosition) -- this animates a reveal of that value, same
// roll-then-reveal pattern as DeployRollModal's d100 (see handlePlacementRoll).
const PlacementRollModal = ({show, rolling, roll, onRoll, onContinue}) => {
  if(!show) return null;
  const isFree = roll===0;
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:4500}}>
      <div style={{background:'#080e14',border:'2px solid #00c8ff',borderRadius:10,padding:'1.4rem',maxWidth:360,width:'92%',textAlign:'center',color:'#b0dff4',boxShadow:'0 0 40px rgba(0,200,255,0.4)'}}>
        <div style={{fontSize:24}}>◈</div>
        <h2 style={{fontSize:'1.05rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'#00c8ff',marginTop:4}}>Placement Roll</h2>
        <div style={{fontSize:'11px',color:'#5a7a8a',marginTop:2,marginBottom:16}}>d10 sets your back-row tile — a roll of 0 means free choice.</div>
        <div style={{display:'flex',justifyContent:'center',marginBottom:16}}>
          <DiceDisplay type="d10" value={roll!==null?roll:'--'} rolling={rolling} color="#00c8ff" label="Placement" />
        </div>
        {roll!==null && !rolling && (
          <div style={{background:'#0a1218',border:'1px solid #00c8ff55',borderRadius:8,padding:'12px 14px',marginBottom:14}}>
            {isFree
              ? <div style={{fontSize:13,color:'#00c8ff'}}>Free placement! Choose any tile in your back row next.</div>
              : <div style={{fontSize:13,color:'#00c8ff'}}>Placed at tile {roll}.</div>}
          </div>
        )}
        {roll===null
          ? <button onClick={onRoll} disabled={rolling}
              style={{width:'100%',padding:14,background:'rgba(0,200,255,0.13)',color:'#00c8ff',border:'1px solid #00c8ff',borderRadius:6,fontSize:16,fontWeight:'bold',cursor:rolling?'not-allowed':'pointer',letterSpacing:'0.1em'}}>
              {rolling?'Rolling...':'Roll Placement (d10)'}
            </button>
          : <button onClick={onContinue}
              style={{width:'100%',padding:14,background:'rgba(0,200,255,0.13)',color:'#00c8ff',border:'1px solid #00c8ff',borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>
              {isFree?'Choose Tile':'Continue'}
            </button>}
      </div>
    </div>
  );
};

// Match-start ceremony, part 2 (Gauntlet/Training, 1v1 only -- Campaign never
// shows this): reveals the initiative roll-off that decides turn order for
// the whole run (see firstMoverRef / startContestedRound). Shown once
// PlacementRollModal (and, on a free-choice roll, the picker) has resolved.
const InitiativeRollModal = ({show, rolling, result, onRoll, onBegin}) => {
  if(!show) return null;
  const winColor = result?.winner==='player' ? '#00c8ff' : '#cc4422';
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:4500}}>
      <div style={{background:'#080e14',border:`2px solid ${result?winColor:'#00c8ff'}`,borderRadius:10,padding:'1.4rem',maxWidth:400,width:'92%',textAlign:'center',color:'#b0dff4',boxShadow:`0 0 40px ${(result?winColor:'#00c8ff')}44`}}>
        <div style={{fontSize:24}}>⚔</div>
        <h2 style={{fontSize:'1.05rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'#00c8ff',marginTop:4}}>Initiative Roll-Off</h2>
        <div style={{fontSize:'11px',color:'#5a7a8a',marginTop:2,marginBottom:16}}>Higher d12 acts first — every round for the rest of the match.</div>
        <div style={{display:'flex',justifyContent:'center',gap:20,marginBottom:16}}>
          <DiceDisplay type="d12" value={result?result.p:'--'} rolling={rolling} color="#00c8ff" label="You" />
          <DiceDisplay type="d12" value={result?result.e:'--'} rolling={rolling} color="#cc4422" label="Enemy" />
        </div>
        {result && !rolling && (
          <div style={{background:'#0a1218',border:`1px solid ${winColor}55`,borderRadius:8,padding:'12px 14px',marginBottom:14}}>
            <div style={{fontSize:14,fontWeight:'bold',color:winColor}}>
              {result.winner==='player' ? 'You win initiative!' : 'Enemy wins initiative!'}
            </div>
            <div style={{fontSize:11,color:'#7a9db5',marginTop:4}}>
              {result.winner==='player' ? 'You act first every round from here.' : 'The enemy acts first every round from here.'}
            </div>
          </div>
        )}
        {result===null
          ? <button onClick={onRoll} disabled={rolling}
              style={{width:'100%',padding:14,background:'rgba(0,200,255,0.13)',color:'#00c8ff',border:'1px solid #00c8ff',borderRadius:6,fontSize:16,fontWeight:'bold',cursor:rolling?'not-allowed':'pointer',letterSpacing:'0.1em'}}>
              {rolling?'Rolling...':'Roll Initiative (d12)'}
            </button>
          : <button onClick={onBegin}
              style={{width:'100%',padding:14,background:`${winColor}22`,color:winColor,border:`1px solid ${winColor}`,borderRadius:6,fontSize:16,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.1em'}}>
              Begin Battle
            </button>}
      </div>
    </div>
  );
};

// A placement roll of 0 means free choice of back-row column, instead of
// the usual roll-determined one. One button per column (0-8).
const PlacementPickerModal = ({show, onSelect}) => {
  if(!show) return null;
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:4000}}>
      <div style={{background:'#080e14',border:'2px solid #00c8ff',borderRadius:12,padding:'2rem',maxWidth:420,width:'92%',textAlign:'center',color:'#b0dff4',boxShadow:'0 0 50px rgba(0,200,255,0.4)'}}>
        <div style={{fontSize:'11px',letterSpacing:'0.2em',textTransform:'uppercase',color:'#00c8ff'}}>// Placement Roll: 0</div>
        <h2 style={{fontSize:'1.3rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'#00c8ff',marginTop:8}}>Choose Your Position</h2>
        <div style={{fontSize:12,color:'#7a9db5',marginTop:10,marginBottom:20,lineHeight:1.6}}>A roll of 0 means free placement — pick any tile (1-9) in your back row.</div>
        <div style={{display:'flex',justifyContent:'center',gap:6,flexWrap:'wrap'}}>
          {/* Labeled 1-9 (tile numbers a player reads off the board) rather
              than the underlying 0-8 array index, to match how every other
              placement roll (1-9) already reads -- onSelect still receives
              the 0-indexed column the board actually uses internally. */}
          {Array.from({length:9},(_,col)=>(
            <button key={col} onClick={()=>onSelect(col)}
              style={{width:36,height:36,background:'rgba(0,200,255,0.1)',border:'1px solid #00c8ff',borderRadius:6,color:'#00c8ff',fontWeight:'bold',cursor:'pointer',fontFamily:"'Share Tech Mono',monospace"}}>
              {col+1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Shown when a Training Mode scene's single enemy is defeated — replaces the
// normal wave-progression/boss-unlock flow, since a scene is a standalone
// lesson rather than an endless run.
const SceneCompleteModal = ({show, sceneMeta, onReturn}) => {
  if(!show) return null;
  const color = sceneMeta?.color || '#00cc66';
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:4000}}>
      <div style={{background:'#080e14',border:`2px solid ${color}`,borderRadius:12,padding:'2rem',maxWidth:420,width:'92%',textAlign:'center',color:'#b0dff4',boxShadow:`0 0 50px ${color}66`}}>
        <div style={{fontSize:'11px',letterSpacing:'0.2em',textTransform:'uppercase',color}}>// Scene Cleared</div>
        <h2 style={{fontSize:'1.4rem',letterSpacing:'0.1em',textTransform:'uppercase',color,marginTop:8}}>{sceneMeta?.name || 'Scene'} Complete</h2>
        <div style={{fontSize:12,color:'#7a9db5',marginTop:10,marginBottom:20,lineHeight:1.6}}>Nice work. You can replay this scene anytime from the Tutorial Hub.</div>
        <button onClick={onReturn}
          style={{width:'100%',padding:12,background:`${color}22`,border:`1px solid ${color}`,borderRadius:6,color,fontSize:14,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.08em'}}>
          Return to Tutorial Hub
        </button>
      </div>
    </div>
  );
};

// Shown between Campaign battles ("Continue" to the next roster) and on the
// finale ("Return to Menu"). Player HP/level/XP/hexas carry forward — only
// position/tiles/enemies reset, handled by startNextCampaignBattle.
const CampaignBattleCompleteModal = ({show, isFinale, battle, nextBattle, equipmentReward, onContinue, onFinish, onReturnToMenu}) => {
  if(!show) return null;
  const color = isFinale ? '#ffd700' : '#00c8ff';
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:4000}}>
      <div style={{background:'#080e14',border:`2px solid ${color}`,borderRadius:12,padding:'2rem',maxWidth:440,width:'92%',textAlign:'center',color:'#b0dff4',boxShadow:`0 0 50px ${color}66`}}>
        <div style={{fontSize:'11px',letterSpacing:'0.2em',textTransform:'uppercase',color}}>{isFinale ? '// Campaign Complete' : `// Battle ${battle?.stage}/${CAMPAIGN_BATTLES.length} Cleared`}</div>
        <h2 style={{fontSize:'1.4rem',letterSpacing:'0.1em',textTransform:'uppercase',color,marginTop:8}}>{isFinale ? 'The Army Falls' : `${battle?.name} Down`}</h2>
        <div style={{background:'#0a1218',border:`1px solid ${color}33`,borderRadius:8,padding:'12px 14px',margin:'14px 0',fontSize:12,color:'#7a9db5',lineHeight:1.6,fontStyle:'italic',textAlign:'left'}}>
          {isFinale ? battle?.victoryNarrative : nextBattle?.narrative}
        </div>
        {isFinale && equipmentReward && (
          <div style={{background:'rgba(255,215,0,0.08)',border:'1px solid #ffd70055',borderRadius:8,padding:'10px 14px',marginBottom:18,fontSize:12,color:'#ffd700',textAlign:'left'}}>
            <strong>◈ {equipmentReward.name}</strong> — {equipmentReward.statBonus}
          </div>
        )}
        {!isFinale && (
          <div style={{fontSize:11,color:'#5a7a8a',marginBottom:18}}>Your HP and progress carry forward — no full heal between fights. Stepping back to the menu keeps everything you've earned, so this is a good spot to go craft.</div>
        )}
        {isFinale ? (
          <button onClick={onFinish}
            style={{width:'100%',padding:12,background:`${color}22`,border:`1px solid ${color}`,borderRadius:6,color,fontSize:14,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.08em'}}>
            Return to Menu
          </button>
        ) : (
          <div style={{display:'flex',gap:10}}>
            <button onClick={onContinue}
              style={{flex:1,padding:12,background:`${color}22`,border:`1px solid ${color}`,borderRadius:6,color,fontSize:14,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.08em'}}>
              Continue
            </button>
            <button onClick={onReturnToMenu}
              style={{flex:1,padding:12,background:'rgba(90,125,150,0.15)',border:'1px solid #3a6a8a',borderRadius:6,color:'#7a9db5',fontSize:14,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.08em'}}>
              Return to Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Shown when the player's HP hits 0 in Campaign — previously nothing but a
// log line, leaving the player stuck with no way forward. Hexas/materials/XP
// already earned this run are unaffected either way (committed as they're
// gained, not held back for a clean finish), so both options are safe.
const CampaignDefeatModal = ({show, battle, onRetry, onReturnToMenu}) => {
  if(!show) return null;
  const color = '#ff4444';
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:4000}}>
      <div style={{background:'#080e14',border:`2px solid ${color}`,borderRadius:12,padding:'2rem',maxWidth:440,width:'92%',textAlign:'center',color:'#b0dff4',boxShadow:`0 0 50px ${color}66`}}>
        <div style={{fontSize:'11px',letterSpacing:'0.2em',textTransform:'uppercase',color}}>{`// Battle ${battle?.stage}/${CAMPAIGN_BATTLES.length} Failed`}</div>
        <h2 style={{fontSize:'1.4rem',letterSpacing:'0.1em',textTransform:'uppercase',color,marginTop:8}}>Proxy Down</h2>
        <div style={{fontSize:11,color:'#5a7a8a',margin:'14px 0 18px'}}>Your Hexas, materials, and XP from this run are already banked. Retry this battle at full HP, or step back to the menu to regroup — Crafting is right there.</div>
        <div style={{display:'flex',gap:10}}>
          <button onClick={onRetry}
            style={{flex:1,padding:12,background:`${color}22`,border:`1px solid ${color}`,borderRadius:6,color,fontSize:14,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.08em'}}>
            Retry Battle
          </button>
          <button onClick={onReturnToMenu}
            style={{flex:1,padding:12,background:'rgba(90,125,150,0.15)',border:'1px solid #3a6a8a',borderRadius:6,color:'#7a9db5',fontSize:14,fontWeight:'bold',cursor:'pointer',letterSpacing:'0.08em'}}>
            Return to Menu
          </button>
        </div>
      </div>
    </div>
  );
};
// ─── MAIN GAME COMPONENT ───────────────────────────────────────────────────────

export default function GridBattlerGame({ onStateSync, scene, onSceneComplete, campaign, character, leaveSignal = 0, onCampaignComplete, onReturnToMenu, onBattleCleared, onQuit, craftedSkillIds = [], skillMods = {}, initialHexas = 0, initialMaterials = {}, customSkillDef = null } = {}) {
  // Training Mode scene config. `scene` is undefined for normal Gauntlet play
  // (every flag below defaults to current behavior). Each scene isolates one
  // new mechanic on top of core movement/melee rather than accumulating —
  // simplest to reason about and keeps Gauntlet's own logic untouched. Battle
  // Skills availability isn't a separate flag here: loadoutUnlocked only
  // starts true when scene==='skills', and the boss-defeat unlock path never
  // runs in scene mode (handleEnemyDefeated returns early), so the loadout
  // stays naturally locked in every other scene without an extra check.
  // Modifier Panel bonuses (Crafting), bought with Hexas (see
  // SKILL_MOD_STATS in ItemData.jsx). `id` is a BATTLE_SKILLS id, or the
  // element name itself ('Fire'/'Water'/'Earth'/'Air') for a base elemental
  // skill. Applies only to the player's own casts — an enemy's copy of the
  // same skill/element never reads this. Memoized on skillMods so every
  // damage-calc useCallback below can list `dmgBonus`/`accBonus` themselves
  // as a dependency (a stable identity that only changes when skillMods
  // actually does) instead of needing `skillMods` directly, which eslint's
  // exhaustive-deps can't infer since it only sees `dmgBonus(...)`/
  // `accBonus(...)` calls in those bodies.
  // Damage: a flat, permanent +damage.
  const dmgBonus = useCallback((id) => skillMods?.[id]?.damage || 0, [skillMods]);
  // Accuracy: a permanent damage multiplier — +10% per tier, capped at
  // +50% (see SKILL_MOD_STATS.accuracy) — applied to the roll-based damage
  // *before* dmgBonus's flat add, so a skill's percentage bonus scales what
  // the dice actually rolled rather than the flat top-up too.
  const accBonus = useCallback((id) => (skillMods?.[id]?.accuracy || 0) * 0.10, [skillMods]);

  const sceneAllowSkill = !scene || scene==='elements';
  const sceneIncludeTerrain = !scene || scene==='elements';
  const sceneRestrictBaseElements = scene==='elements';
  const sceneMeta = scene ? TUTORIAL_SCENES.find(s=>s.id===scene) : null;

  // Campaign Mode: a squad-battle mode entirely separate from Gauntlet's
  // single-`enemy` code path (see `enemies` state below). `isCampaign` gates
  // every piece of the multi-enemy engine so Gauntlet/Training stay untouched.
  const isCampaign = !!campaign;

  // Campaign now requires a character (name/loadout/element) to already
  // exist -- created/edited on CharacterScreen.jsx, not collected mid-battle
  // (see CharacterCreatorForm above) -- so it's applied at the very first
  // player object rather than patched in later via an intro-modal submit.
  const initPlayer = () => { const p = newHero(); return (isCampaign && character) ? {...p, name: character.name} : p; };
  // Battle Skills scene: a full-kit practice Proxie (melee + element + both
  // Tactical skills + Circuit Sigil) instead of a plain goblin — "an even
  // match" now that a promoted Agent can fight alongside the player, and the
  // only scene where loadout play (and thus Agents) is actually reachable.
  // `isBoss` only affects makeEnemyProxie's naming/spawnCampaignRoster's
  // mirror path, not AI capability — Circuit Sigil in the loadout is what
  // actually enables it here, so this stays a regular (isBoss:false) grunt
  // in spite of carrying a Core skill for practice purposes.
  const initEnemy  = (p) => scene==='skills'
    ? makeEnemyProxie(1, 1, rollBackRowPosition(0), {
        element: BOSS_ELEMENTS[Math.floor(Math.random()*BOSS_ELEMENTS.length)],
        loadout: ['compassSlash','darkWeb','pulseWave','longshotProtocol','piercingLight','circuitSigil'],
      })
    : newGoblin(1, p.boardPosition);

  const [player,         setPlayer]         = useState(()=>{ const p=initPlayer(); return p; });
  const [enemy,          setEnemy]          = useState(()=>{ const p=initPlayer(); return initEnemy(p); });
  // A placement roll of 0 means free choice of back-row column (see
  // rollBackRowPosition) -- gates a picker modal shown once at mount,
  // dismissed once the player confirms a tile.
  const [showPlacementPicker, setShowPlacementPicker] = useState(()=>player._placementRoll===0);
  // Match-start ceremony: reveals the placement roll (already determined at
  // character creation, see newHero/rollBackRowPosition) and then, for
  // Gauntlet/Training only, the initiative roll-off -- rather than either
  // just happening invisibly before the player sees the board. Both default
  // to true/shown so they gate the very first thing a player sees; nothing
  // ever re-shows them later (not on new rounds, not on new waves).
  const [showPlacementRollModal, setShowPlacementRollModal] = useState(true);
  const [placementRolling,       setPlacementRolling]       = useState(false);
  const [placementRollValue,     setPlacementRollValue]     = useState(null);
  const [showInitiativeRollModal, setShowInitiativeRollModal] = useState(false);
  const [initiativeRolling,       setInitiativeRolling]       = useState(false);
  const [initiativeResult,        setInitiativeResult]        = useState(null); // {p, e, winner}
  // ── Campaign Mode: multi-enemy roster (only meaningful when isCampaign) ──
  const [enemies,          setEnemies]          = useState(()=> isCampaign ? spawnCampaignRoster(1, initPlayer().boardPosition) : []);
  const [campaignBattle,   setCampaignBattle]   = useState(1);
  const [campaignComplete, setCampaignComplete] = useState(false);
  const [showBattleComplete, setShowBattleComplete] = useState(false);
  const [showDefeatModal, setShowDefeatModal] = useState(false);
  const [selectedEnemyId,  setSelectedEnemyId]  = useState(null);
  const [enemyRolledEnergyById, setEnemyRolledEnergyById] = useState({});
  const [tiles,          setTiles]          = useState(()=>{
    const p=initPlayer();
    if(isCampaign) return makeTiles(p.boardPosition, {x:-1,y:-1}, enemies.map(e=>e.boardPosition));
    const e=initEnemy(p);
    return sceneIncludeTerrain ? makeTiles(p.boardPosition,e.boardPosition) : makePlainTiles();
  });
  const [wave,           setWave]           = useState(1);
  const [round,          setRound]          = useState(1);
  const [playerRolledEnergy, setPlayerRolledEnergy] = useState(0);
  const [enemyRolledEnergy,  setEnemyRolledEnergy]  = useState(0);
  const [energyPhase,    setEnergyPhase]    = useState('roll');
  const [hexas,          setHexas]          = useState(initialHexas);
  // Battle-acquired synthesis materials (Campaign only) -- materialId -> qty.
  // Unequipped equipment drops live on player.equipment (see FIRST_EQUIPMENT
  // and rollEnemyDrop) rather than their own top-level state, same shape.
  // Seeded from the app-level persisted pool (see App.jsx) so battle rewards
  // stack on top of what Explore/previous sessions already earned instead of
  // starting back at zero every mount.
  const [materials,      setMaterials]      = useState(initialMaterials);
  const [isPlayerTurn,   setIsPlayerTurn]   = useState(true);
  const [playerSel,      setPlayerSel]      = useState(false);
  const [validSquares,   setValidSquares]   = useState([]);
  const [logs,           setLogs]           = useState(()=>{
    const base = ['=== Battle Initiated ===','Move adjacent to attack. Position for bonuses.'];
    if(isCampaign && character){
      const skillNames = character.loadout.map(id=>id==='customSkill'&&customSkillDef?customSkillDef.name:BATTLE_SKILLS.find(s=>s.id===id)?.name).filter(Boolean).join(', ');
      base.push(`=== ${character.name} deployed — ${skillNames} · ${character.element} ===`);
    }
    return base;
  });
  const [reward,         setReward]         = useState({show:false,html:''});
  const [selCategory,    setSelCategory]    = useState('base');
  const [selElement,     setSelElement]     = useState(()=> (isCampaign && character) ? character.element : 'Fire');
  const [showDice,       setShowDice]       = useState(false);
  const [diceRolls,      setDiceRolls]      = useState([]);
  const [abilities,      setAbilities]      = useState([]);
  const [rolling,        setRolling]        = useState(false);
  const [dicePhase,      setDicePhase]      = useState('roll');
  const [accuracyRoll,   setAccuracyRoll]   = useState(null);
  const [pendingAbility, setPendingAbility] = useState(null);
  const [earthRange,     setEarthRange]     = useState(null);
  const [waterAoe,       setWaterAoe]       = useState(null); // player-chosen Torrent AoE tier
  // Per-round roll lock. Once dice are rolled for a skill, the result is locked
  // for the rest of the round to prevent reroll-to-optimize exploits.
  const [lockedRoll,     setLockedRoll]     = useState(null);
  // Set true when the healing tile is consumed (by either unit). On the next
  // round start, the tile relocates to a fresh random spot and this resets.
  const [healingConsumed, setHealingConsumed] = useState(false);

  // ── Battle Skills / loadout state ──
  const [loadout,         setLoadout]         = useState(()=> (isCampaign && character) ? character.loadout : []);   // equipped non-baseline skill ids
  const [loadoutUnlocked, setLoadoutUnlocked] = useState(scene==='skills' || (isCampaign && !!character));  // gate flag (post-boss, immediate in the Battle Skills scene, or immediate in Campaign since the character already locked a loadout in on CharacterScreen)
  const [sceneComplete,   setSceneComplete]   = useState(false);  // Training Mode: this scene's single enemy is down
  const [showLoadoutModal,setShowLoadoutModal]= useState(false);  // unlock picker
  const [meleeModalCtx,setMeleeModalCtx]= useState(null);  // {perHitDamage,maxMultiplier,targetLabel,targetId} while the melee burst modal is open
  // Landscape-only game: true when the viewport is taller than it is wide, which
  // triggers a rotate-your-device overlay (the 3-panel row needs the width).
  const [isPortrait, setIsPortrait] = useState(
    typeof window!=='undefined' ? window.innerHeight > window.innerWidth : false
  );
  const [summons,        setSummons]        = useState([]);     // active Novice summons
  const [obstacles,      setObstacles]      = useState([]);     // Earth-raised rubble; persists round-to-round like terrain, clears only at battle/wave boundaries
  // Deploy sub-flow state
  const [showDeploy,     setShowDeploy]     = useState(false);
  const [deployRolling,  setDeployRolling]  = useState(false);
  const [deployRoll,     setDeployRoll]     = useState(null);
  const [deployTier,     setDeployTier]     = useState(null);
  const [awaitingPlacement, setAwaitingPlacement] = useState(false);
  // Direct (Compass Slash) targeting state: when true, grid clicks pick a target.
  const [compassTargeting, setCompassTargeting] = useState(false);
  // Rogue's Dark Web targeting state: when true, grid clicks pick one of the
  // 8 knight-move tiles.
  const [darkWebTargeting, setDarkWebTargeting] = useState(false);
  // Pulse Wave targeting state: when true, grid clicks pick which of the 8
  // axis directions (any tile up to 3 out along it) to fire down.
  const [pulseWaveTargeting, setPulseWaveTargeting] = useState(false);
  // Piercing Light's energy-investment modal context — set when armed,
  // null when closed. No grid targeting phase; it always hits the 2 tiles
  // straight ahead of current facing, same as ordinary Melee.
  const [piercingLightCtx, setPiercingLightCtx] = useState(null);
  // Rotate: once-per-turn, 0-cost facing change. True while the direction
  // picker banner is open.
  const [rotateTargeting, setRotateTargeting] = useState(false);
  // Grid square sizing — measured from the battle row so it's capped by
  // whichever is smaller, available width or available height (see the
  // ResizeObserver effect below).
  const battleRowRef = useRef(null);
  const gridSlotRef = useRef(null);
  // Tracks whether the player has rolled their own Energy pool yet THIS
  // round -- distinct from actionpts<=0, which means either "hasn't rolled"
  // or "rolled and fully spent," depending on when it's read. A ref (not
  // state) so the enemy-went-first hand-off (finishEnemyToPlayer, reached via
  // runEnemyTurn's own setTimeout chain) can read it synchronously without
  // waiting on a re-render.
  const playerHasRolledRef = useRef(true);
  // Who won the initiative roll-off, decided once for the whole run (not
  // re-rolled each round or each wave) -- 'player' | 'enemy' | null before
  // it's been decided. Every round after the first follows this same
  // established order.
  const firstMoverRef = useRef(null);
  const [gridSize, setGridSize] = useState(480);
  // ── Player-directed summon-command sub-phase (A) ──
  const [summonPhaseActive, setSummonPhaseActive] = useState(false);
  const [selectedSummonId,  setSelectedSummonId]  = useState(null);
  const [actedSummonIds,    setActedSummonIds]    = useState([]);
  const summonCtxRef = useRef(null);

  const addLog = useCallback((msg)=>setLogs(prev=>[...prev,msg]),[]);

  // Color-coded skill-cast flash: a brief ring on whichever tile a skill
  // lands on, tinted to the element/class color that cast it. Purely
  // cosmetic (setCastFx clears itself), so it's safe to fire from anywhere,
  // player or enemy side, either engine.
  const [castFx, setCastFx] = useState(null);
  const triggerCastFx = useCallback((tile,color)=>{
    if(!tile) return;
    const key = `${Date.now()}-${Math.random()}`;
    setCastFx({x:tile.x,y:tile.y,color,key});
    setTimeout(()=>setCastFx(fx=>fx&&fx.key===key?null:fx),700);
  },[]);

  const skillCost = getSkillCost(selCategory, selElement);
  const elData = ELEMENTS[selCategory]?.[selElement];
  const canAttack = isPlayerTurn && energyPhase==='act' && player.actionpts>0 && isAdjacent(player.boardPosition,enemy.boardPosition);
  // Earth, Air, and Water bypass adjacency — they're ranged.
  const canSkill  = sceneAllowSkill && isPlayerTurn && energyPhase==='act' && !player.skillUsed && player.actionpts >= skillCost &&
    (elData?.isEarth||elData?.isAir||elData?.isWater ? true : isAdjacent(player.boardPosition,enemy.boardPosition));
  // Campaign Mode equivalents — same gates, checked against any living enemy
  // in the roster instead of the single `enemy`.
  const canAttackMulti = isPlayerTurn && energyPhase==='act' && player.actionpts>0 &&
    (enemies.some(e=>isAdjacent(player.boardPosition,e.boardPosition)) || summons.some(s=>s.side==='enemy'&&isAdjacent(player.boardPosition,s.boardPosition)));
  const canSkillMulti  = sceneAllowSkill && isPlayerTurn && energyPhase==='act' && !player.skillUsed && player.actionpts >= skillCost &&
    (elData?.isEarth||elData?.isAir||elData?.isWater ? true : enemies.some(e=>isAdjacent(player.boardPosition,e.boardPosition)));
  // Each loadout skill gets its own once-per-turn gate (usedSkillIds), not a
  // single shared class-skill flag — a loadout can hold more than one
  // Tactical Skill at a time, and each is independently usable once per
  // turn if 2 Energy is available (fixed activation cost for both).
  const canCompassSlash = loadout.includes('compassSlash') && isPlayerTurn && energyPhase==='act' && !player.usedSkillIds.includes('compassSlash') && player.actionpts >= 2;
  const canCircuitSigil = loadout.includes('circuitSigil') && isPlayerTurn && energyPhase==='act' && !player.usedSkillIds.includes('circuitSigil') && player.actionpts >= 2;
  const canDarkWeb = loadout.includes('darkWeb') && isPlayerTurn && energyPhase==='act' && !player.usedSkillIds.includes('darkWeb') && player.actionpts >= 2;
  const canPulseWave = loadout.includes('pulseWave') && isPlayerTurn && energyPhase==='act' && !player.usedSkillIds.includes('pulseWave') && player.actionpts >= 3;
  const canPiercingLight = loadout.includes('piercingLight') && isPlayerTurn && energyPhase==='act' && !player.usedSkillIds.includes('piercingLight') && player.actionpts >= PIERCING_LIGHT_BASE_COST;
  // Custom Synthesis: cost is fixed per archetype (see CUSTOM_SKILL_ENERGY_COST
  // in ItemData.jsx, mirrored by CraftingScreen's creation-cost preview) --
  // melee is cheapest at 1, aoe priciest at 3, same ordering as its Hexas cost.
  const customSkillCost = customSkillDef ? (CUSTOM_SKILL_ENERGY_COST[customSkillDef.archetype] ?? 2) : 0;
  const canCustomSkill = !!customSkillDef && loadout.includes('customSkill') && isPlayerTurn && energyPhase==='act' && !player.usedSkillIds.includes('customSkill') && player.actionpts >= customSkillCost;
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
    // The player's very first level-up (starting level is always 1) also
    // triggers the Custom Skill unlock -- a placeholder for now (see
    // Crafting's Custom Synthesis section) but a real, one-time flag on the
    // player and a real notification, not just a comment.
    const isFirstLevelUp = p.level===1;
    const updated={...p,level:p.level+1,playerXp:p.playerXp-needed,health:p.maxHealth,
      ...(isFirstLevelUp?{customSkillUnlocked:true}:{})};
    addLog(`=== LEVEL UP! ${updated.name} Lv${updated.level}! HP restored. ===`);
    if(isFirstLevelUp) addLog('◈ Custom Skill unlocked — full ability crafting comes online in a future build.');
    const customSkillBlock = isFirstLevelUp
      ? `<div style="margin-top:14px;padding-top:14px;border-top:1px solid #1e3a4a"><p style="color:#9b6cff;font-weight:bold;letter-spacing:.05em;font-size:.95rem">◈ CUSTOM SKILL UNLOCKED</p><p style="color:#7a9db5;font-size:.78rem;margin-top:4px">Full ability crafting comes online in a future build.</p></div>`
      : '';
    showReward(`<h2 style="color:#ffd700;letter-spacing:.1em">LEVEL UP</h2><p style="font-size:1.4rem;margin:10px 0;color:#00c8ff">Level ${updated.level}</p><p style="color:#00cc66;font-size:.9rem">HP fully restored</p>${customSkillBlock}`,isFirstLevelUp?4000:2500);
    return updated;
  },[addLog,showReward]);

  const startPlayerTurn = useCallback((p)=>{
    setIsPlayerTurn(true);
    setEnergyPhase('act'); // pool already rolled at round start; player spends remainder
    setValidSquares([]);
    addLog('=== Your Turn — spend remaining Energy ===');
  },[addLog]);

  // ── SUMMON COMMAND SUB-PHASE (A: player-directed) ──
  // A tile with a living enemy on it is only a legal target if it's within
  // the pawn's 3-tile attack arc (summonAttackTiles); otherwise the only
  // legal tile is the single square straight ahead (summonForwardTile), and
  // only if it's actually empty — move and attack are mutually exclusive per
  // tile, matching "moves like a pawn, attacks any tile in front."
  const summonActionAt = useCallback((s, tile, curEnemy, curSummons)=>{
    const enemyHere = curEnemy.health>0 && curEnemy.boardPosition.x===tile.x && curEnemy.boardPosition.y===tile.y;
    if(enemyHere){
      return summonAttackTiles(s).some(t=>t.x===tile.x&&t.y===tile.y) ? 'attack' : null;
    }
    const ahead=summonForwardTile(s);
    if(!ahead||ahead.x!==tile.x||ahead.y!==tile.y) return null;
    if(player.boardPosition.x===tile.x&&player.boardPosition.y===tile.y) return null;
    if(curSummons.some(o=>o.id!==s.id&&o.boardPosition.x===tile.x&&o.boardPosition.y===tile.y)) return null;
    return 'move';
  },[player]);

  const beginSummonCommandPhase = useCallback((rP, rE, currentRound)=>{
    summonCtxRef.current = { round: currentRound };
    setActedSummonIds([]);
    setSelectedSummonId(null);
    setSummonPhaseActive(true);
    setIsPlayerTurn(true);
    setEnergyPhase('summon'); // distinct phase: not roll, not act
    setValidSquares([]);
    addLog(`=== Summon Command — ${summons.length} active (pool ${rP.actionpts}E). Click a summon, then its tile. ===`);
  },[addLog,summons]);

  // Summons act first each round, then whatever's left of the shared pool
  // goes to the player, and only once the player is also spent does the
  // enemy get its turn — mirroring pawns clearing the way before the
  // stronger pieces move, and letting the player finish acting on their
  // own leftover Energy instead of eating a full enemy turn immediately
  // after committing to summon commands. If the summons used the whole
  // pool, there's nothing for the player to spend, so skip straight to
  // the enemy instead of showing an empty act phase.
  const endSummonCommandPhase = useCallback(()=>{
    setSummonPhaseActive(false);
    setSelectedSummonId(null);
    setValidSquares([]);
    const ctx = summonCtxRef.current || { round };
    setPlayer(curP=>{
      setEnemy(curE=>{
        if(curP.actionpts>0){
          addLog('=== Summons done — spend remaining Energy ===');
          setIsPlayerTurn(true);
          setEnergyPhase('act');
        } else {
          addLog('=== Summons done — enemy turn ===');
          setIsPlayerTurn(false);
          setEnemyRolledEnergy(0);
          setTimeout(()=>runEnemyTurn({...curE,actionpts:0}, curP, summons, ctx.round, obstacles), 400);
        }
        return curE;
      });
      return curP;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,round,summons,obstacles]);

  // Resolves a single summon's move/attack against the current (closured)
  // player/enemy/summons state — deliberately NOT nested setState updaters.
  // The previous version chained setSummons(curSummons => { ... setPlayer(curPlayer
  // => { ... setEnemy(curEnemy => { didAct=true; ... }) ...; if(!didAct) ... }) ...})
  // and relied on `didAct` being mutated inside the innermost updater and
  // read back by the outer ones immediately after — but React doesn't
  // guarantee an updater function runs synchronously at its call site, so
  // `didAct` was often still false when checked. That silently skipped both
  // the summon's position update AND the pool.actionpts-1 decrement, which
  // is exactly why summons sat idle and the pool never seemed to spend.
  const resolveSummonAction = useCallback((summonId, tile)=>{
    const s = summons.find(z=>z.id===summonId);
    if(!s) return;
    if(player.actionpts<=0){ addLog('// Pool empty — cannot act'); return; }
    const kind = summonActionAt(s, tile, enemy, summons);
    if(!kind) return;

    const updatedPlayer = {...player, actionpts:player.actionpts-1};
    setPlayer(updatedPlayer);

    if(kind==='attack'){
      const dmg=s.atk;
      const newHP=Math.max(0,enemy.health-dmg);
      addLog(`${s.name} strikes ${enemy.name} → ${dmg} dmg (${newHP}/${enemy.maxHealth})`);
      triggerCastFx(enemy.boardPosition,'#66dd88');
      setEnemy({...enemy,health:newHP});
      if(newHP<=0){
        addLog('=== Enemy defeated by summons! ===');
        setTimeout(()=>handleEnemyDefeated(updatedPlayer, wave),400);
      }
      // Summon holds its tile on an attack — it doesn't move into the enemy.
    } else if(tile.y===ENEMY_BACK_ROW){
      // Stays on the board, marked promoted — reads as an evolved Agent
      // instead of vanishing from play, and becomes an autonomous unit:
      // no more manual commanding, it rolls and acts for itself each round
      // (see runAgentTurn/runAgentTurnMulti), fighting under one of the
      // currently-implemented classes.
      const agentClass = ENEMY_CLASS_POOL[Math.floor(Math.random()*ENEMY_CLASS_POOL.length)];
      setSummons(prev=>prev.map(z=>z.id===summonId?{...z,boardPosition:tile,promoted:true,agentClass,
        actionpts:0,energyRollover:0,frozen:0,classSkillUsed:false}:z));
      addLog(`★ ${s.name} reaches the back row → promotes to Agent (autonomous staged)`);
    } else {
      setSummons(prev=>prev.map(z=>z.id===summonId?{...z,boardPosition:tile}:z));
      addLog(`${s.name} advances → (${tile.x},${tile.y})`);
    }

    setActedSummonIds(prev=>[...prev,summonId]);
    setSelectedSummonId(null);
    setValidSquares([]);
  // handleEnemyDefeated is defined later in the file (const, TDZ) — referenced
  // in the closure body only, can't be listed here without a definition-order crash.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[summons,player,enemy,addLog,summonActionAt,wave,triggerCastFx]);

  // ── PROMOTED AGENTS (autonomous, player-side) ──
  // A promoted summon's whole turn: rolls its own d12 (independent of the
  // player's pool — that's the point of "bandwidth isn't connected to the
  // pool anymore"), then spends it action-point by action-point exactly
  // like an enemy AI turn, via computeAgentStep. Explicit currentEnemy
  // threading mirrors runEnemyTurn — no reads from the `enemy` closure.
  const runAgentTurn = useCallback((agent, currentEnemy, currentRound, onDone)=>{
    const needsRoll = agent.actionpts===0;
    if(needsRoll){
      const eRoll=rollD12Energy();
      const rollover=agent.energyRollover||0;
      const newAP=Math.max(0,eRoll+rollover-(agent.frozen||0));
      addLog(`// ${agent.name} rolls d12=${eRoll}${rollover>0?` +${rollover} rollover`:''} -> ${newAP} AP`);
      const rolled={...agent,actionpts:newAP,frozen:0,energyRollover:0};
      setSummons(prev=>prev.map(s=>s.id===rolled.id?rolled:s));
      if(newAP<=0){ onDone(rolled, currentEnemy); return; }
      setTimeout(()=>runAgentTurn(rolled, currentEnemy, currentRound, onDone), 500);
      return;
    }
    setTimeout(()=>{
      const blockers=[player.boardPosition, ...summons.filter(s=>s.id!==agent.id).map(s=>s.boardPosition)];
      const step = computeAgentStep(agent, currentEnemy, blockers);
      if(step.kind==='hold'){
        const saved=agent.actionpts;
        const updatedAgent={...agent,actionpts:0,energyRollover:(agent.energyRollover||0)+saved};
        addLog(`${agent.name} holds position`);
        setSummons(prev=>prev.map(s=>s.id===updatedAgent.id?updatedAgent:s));
        onDone(updatedAgent, currentEnemy);
        return;
      }
      if(step.kind==='move'){
        const updatedAgent={...agent,boardPosition:step.to,actionpts:agent.actionpts-step.cost};
        addLog(step.log);
        setSummons(prev=>prev.map(s=>s.id===updatedAgent.id?updatedAgent:s));
        setTimeout(()=>{
          if(updatedAgent.actionpts>0) runAgentTurn(updatedAgent, currentEnemy, currentRound, onDone);
          else onDone(updatedAgent, currentEnemy);
        },500);
        return;
      }
      // attack (melee/direct/darkweb)
      const updatedAgent={...agent,actionpts:agent.actionpts-step.cost,classSkillUsed:step.kind==='melee'?agent.classSkillUsed:true};
      addLog(step.log);
      if(step.color) triggerCastFx(currentEnemy.boardPosition, step.color);
      const newHP=Math.max(0,currentEnemy.health-step.dmg);
      const updatedEnemy={...currentEnemy,health:newHP};
      setSummons(prev=>prev.map(s=>s.id===updatedAgent.id?updatedAgent:s));
      setEnemy(updatedEnemy);
      if(newHP<=0){
        addLog(`=== ${currentEnemy.name} defeated by ${agent.name}! ===`);
        setTimeout(()=>handleEnemyDefeated(player, wave),400);
        return;
      }
      setTimeout(()=>{
        if(updatedAgent.actionpts>0) runAgentTurn(updatedAgent, updatedEnemy, currentRound, onDone);
        else onDone(updatedAgent, updatedEnemy);
      },500);
    },600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,player,wave,summons,triggerCastFx]);

  // Sequences every promoted Agent's turn, one at a time, before handing
  // off to the rest of the round (summon-command phase or the player's own
  // act phase). `agentIds` is a snapshot taken once at roll time.
  const runAgentsSequence = useCallback((agentIds, idx, currentEnemy, currentRound, onDone)=>{
    if(idx>=agentIds.length){ onDone(currentEnemy); return; }
    setSummons(curSummons=>{
      const agent = curSummons.find(s=>s.id===agentIds[idx]);
      if(!agent || agent.health<=0){
        runAgentsSequence(agentIds, idx+1, currentEnemy, currentRound, onDone);
      } else {
        runAgentTurn(agent, currentEnemy, currentRound, (updatedAgent, updatedEnemy)=>{
          runAgentsSequence(agentIds, idx+1, updatedEnemy, currentRound, onDone);
        });
      }
      return curSummons;
    });
  },[runAgentTurn]);

  const checkEndOfRound = useCallback((latestPlayer,latestEnemy,currentRound)=>{
    if(latestPlayer.actionpts>0||latestEnemy.actionpts>0) return;
    const nextRound = currentRound + 1;
    setRound(nextRound);
    setPlayerRolledEnergy(0);
    setEnemyRolledEnergy(0);
    setLockedRoll(null); // new round — roll lock released
    setDiceRolls([]); setAbilities([]); setDicePhase('roll');
    setAccuracyRoll(null); setPendingAbility(null); setEarthRange(null); setWaterAoe(null);
    addLog(`=== Round ${nextRound} ===`);
    const rP = { ...latestPlayer, actionpts:0, frozen:latestPlayer.frozen||0, skillUsed:false, rotateUsed:false, classSkillUsed:false, usedSkillIds:[] };
    const rE = { ...latestEnemy,  actionpts:0, frozen:latestEnemy.frozen||0, skillUsed:false, usedSkillIds:[],
      energyRollover: (latestEnemy.energyRollover||0) + (latestEnemy.actionpts||0) };
    setPlayer(rP);
    setEnemy(rE);
    setTimeout(()=>startContestedRound(rP, rE, nextRound), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog]);
  // ── ENEMY TURN ──
  const runEnemyTurn = useCallback((currentEnemy,currentPlayer,currentSummons,currentRound,currentObstacles)=>{
    const needsRoll = currentEnemy.actionpts === 0;
    if(needsRoll){
      const {unit:burnedEnemy, tickLog}=tickBurn(currentEnemy);
      if(tickLog) addLog(tickLog);
      if(burnedEnemy.health<=0){
        setEnemy(burnedEnemy);
        handleEnemyDefeated(currentPlayer, wave);
        return;
      }
      currentEnemy = burnedEnemy;
      const eRoll = rollD12Energy();
      const rollover = currentEnemy.energyRollover || 0;
      const frozenPenalty = currentEnemy.frozen || 0;
      const total = eRoll + rollover;
      const newAP = Math.max(0, total - frozenPenalty);
      setEnemyRolledEnergy(total);
      addLog(`// Enemy rolls d12=${eRoll}${rollover>0?` +${rollover} rollover`:''} = ${total} Energy${frozenPenalty>0?` (freeze -${frozenPenalty})`:''}  ->  ${newAP} AP`);
      // Flee-or-not is decided once per turn, here, and carried on the enemy
      // object for the rest of the turn (see `fleeCommit` below) — rolling it
      // fresh on every action-point step let the unit flip-flop step to step
      // (flee one tile, fight the next), which read as running around at
      // random instead of committing to a retreat.
      const fleeCommit = currentEnemy.element ? Math.random()<0.6 : true;
      const rolledEnemy = { ...currentEnemy, actionpts:newAP, frozen:0, energyRollover:0, fleeCommit };
      setEnemy(rolledEnemy);
      if(newAP <= 0){
        addLog(`// Enemy has 0 Energy - passing`);
        finishEnemyToPlayer(currentPlayer, rolledEnemy, currentRound);
        return;
      }
      setTimeout(()=>runEnemyTurn(rolledEnemy, currentPlayer, currentSummons, currentRound, currentObstacles), 600);
      return;
    }

    addLog(`// Enemy computing... (${currentEnemy.actionpts} Energy)`);
    setTimeout(()=>{
      let updatedPlayer=currentPlayer, updatedEnemy=currentEnemy, updatedSummons=currentSummons, updatedObstacles=currentObstacles;
      const adjacent=isAdjacent(currentEnemy.boardPosition,currentPlayer.boardPosition);
      const eElData=currentEnemy.element?ELEMENTS[currentEnemy.elementCategory]&&ELEMENTS[currentEnemy.elementCategory][currentEnemy.element]:null;
      const eMinCost=eElData?getSkillCost(currentEnemy.elementCategory,currentEnemy.element):1;
      const canUseSkill=currentEnemy.element&&canElementReachTarget(currentEnemy,currentPlayer,currentEnemy.actionpts)&&!currentEnemy.skillUsed&&currentEnemy.actionpts>=eMinCost&&Math.random()<0.6;
      // Class-like loadout skill (only meaningful for Training's Rank-1
      // enemy, which is the only single-enemy context with a `loadout` set —
      // Gauntlet goblins/wardens never carry one). Reuses the exact Campaign
      // decision logic; Deploy is skipped here rather than adding enemy-side
      // summon-commanding to the single-enemy engine — Direct (Compass
      // Slash) and Dark Web both still work.
      const hasUnusedClassLikeSkill = (currentEnemy.loadout||[]).some(id=>['compassSlash','darkWeb','pulseWave','piercingLight','circuitSigil'].includes(id) && !(currentEnemy.usedSkillIds||[]).includes(id));
      const canUseClassSkill = hasUnusedClassLikeSkill && currentEnemy.actionpts>=2 && Math.random()<0.6;

      const lowHP = currentEnemy.health <= currentEnemy.maxHealth * 0.3;
      const healTile = findHealingTile(tiles);
      const onHealTile = healTile && currentEnemy.boardPosition.x===healTile.x && currentEnemy.boardPosition.y===healTile.y;
      const willFlee = lowHP && healTile && currentEnemy.fleeCommit;

      if(willFlee && !onHealTile){
        // Reroute only proposes candidates around the *player* — it doesn't
        // know about rubble, so a blocked primary/reroute pair here doesn't
        // mean truly no path exists, just that these two guesses missed.
        // Falling all the way through to "holds position" (like the
        // approach-move branch below) rather than burning 1 AP per blocked
        // attempt avoids draining the whole banked pool on a single failed
        // step.
        const moves=getMoveCandidatesWithReroute(currentEnemy.boardPosition,healTile);
        let moved=false;
        for(const m of moves){
          const onSummon=[...updatedSummons, ...updatedObstacles].some(s=>s.boardPosition.x===m.x&&s.boardPosition.y===m.y);
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
        if(!moved){
          const saved=currentEnemy.actionpts;
          addLog(`${currentEnemy.name} can't find a path to heal — holds position, saving ${saved} Energy`);
          const restedEnemy={...currentEnemy,actionpts:0,energyRollover:(currentEnemy.energyRollover||0)+saved};
          setEnemy(restedEnemy);
          finishEnemyToPlayer(updatedPlayer,restedEnemy,currentRound);
          return;
        }
        setEnemy(updatedEnemy);
        setTimeout(()=>{
          if(updatedEnemy.actionpts>0) runEnemyTurn(updatedEnemy,updatedPlayer,updatedSummons,currentRound,updatedObstacles);
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
          if(updatedEnemy.actionpts>0) runEnemyTurn(updatedEnemy,updatedPlayer,updatedSummons,currentRound,updatedObstacles);
          else finishEnemyToPlayer(updatedPlayer,updatedEnemy,currentRound);
        },600);
        return;
      }

      if(canUseClassSkill){
        const decision = resolveEnemyClassSkill(currentEnemy, currentPlayer, updatedSummons, tiles, [currentEnemy.boardPosition], updatedObstacles);
        if(decision?.kind==='direct'){
          const dmg=60;
          const newHP=Math.max(0,currentPlayer.health-dmg);
          const facing=facingToward(currentEnemy.boardPosition,currentPlayer.boardPosition);
          addLog(`${currentEnemy.name} Compass Slash -> ${dmg} dmg`);
          triggerCastFx(currentPlayer.boardPosition,'#9b6cff');
          updatedPlayer={...currentPlayer,health:newHP};
          updatedEnemy=markSkillUsed({...currentEnemy,actionpts:currentEnemy.actionpts-2,facing},'compassSlash');
          setPlayer(updatedPlayer); setEnemy(updatedEnemy);
          if(newHP<=0){ addLog('=== DEFEAT ==='); return; }
          setTimeout(()=>{
            if(updatedEnemy.actionpts>0) runEnemyTurn(updatedEnemy,updatedPlayer,updatedSummons,currentRound,updatedObstacles);
            else finishEnemyToPlayer(updatedPlayer,updatedEnemy,currentRound);
          },600);
          return;
        }
        if(decision?.kind==='darkweb'){
          const acc=rollD100Accuracy();
          const dmg=applyAccuracy(70,acc);
          const facing=facingToward(currentEnemy.boardPosition,currentPlayer.boardPosition);
          const newHP=Math.max(0,currentPlayer.health-dmg);
          addLog(`${currentEnemy.name} Dark Web -> ${dmg} dmg (${acc}% ${accuracyTierLabel(acc)})`);
          triggerCastFx(currentPlayer.boardPosition,'#a0a0a0');
          updatedPlayer={...currentPlayer,health:newHP};
          updatedEnemy=markSkillUsed({...currentEnemy,actionpts:currentEnemy.actionpts-2,facing,
            boardPosition: newHP<=0 ? currentPlayer.boardPosition : currentEnemy.boardPosition},'darkWeb');
          setPlayer(updatedPlayer); setEnemy(updatedEnemy);
          if(newHP<=0){ addLog('=== DEFEAT ==='); return; }
          setTimeout(()=>{
            if(updatedEnemy.actionpts>0) runEnemyTurn(updatedEnemy,updatedPlayer,updatedSummons,currentRound,updatedObstacles);
            else finishEnemyToPlayer(updatedPlayer,updatedEnemy,currentRound);
          },600);
          return;
        }
        if(decision?.kind==='piercingLight'){
          const energySpent=piercingLightAutoSpend(currentEnemy.actionpts,currentPlayer.health);
          const dmg=piercingLightDamage(energySpent);
          const newHP=Math.max(0,currentPlayer.health-dmg);
          addLog(`${currentEnemy.name} Piercing Light${energySpent>PIERCING_LIGHT_BASE_COST?` (${energySpent}E)`:''} -> ${dmg} dmg`);
          triggerCastFx(currentPlayer.boardPosition,'#ffdd77');
          updatedPlayer={...currentPlayer,health:newHP};
          updatedEnemy=markSkillUsed({...currentEnemy,actionpts:currentEnemy.actionpts-energySpent,facing:decision.facing},'piercingLight');
          setPlayer(updatedPlayer); setEnemy(updatedEnemy);
          if(newHP<=0){ addLog('=== DEFEAT ==='); return; }
          setTimeout(()=>{
            if(updatedEnemy.actionpts>0) runEnemyTurn(updatedEnemy,updatedPlayer,updatedSummons,currentRound,updatedObstacles);
            else finishEnemyToPlayer(updatedPlayer,updatedEnemy,currentRound);
          },600);
          return;
        }
        if(decision?.kind==='pulseWave'){
          const strike=computePulseWaveDamage(currentEnemy);
          const newFacing=facingToward(currentEnemy.boardPosition,currentPlayer.boardPosition);
          const newHP=Math.max(0,currentPlayer.health-strike.dmg);
          addLog(`${currentEnemy.name} Pulse Wave [${strike.rollsLabel}, ${strike.acc}% (${accuracyTierLabel(strike.acc)})] -> ${strike.dmg} dmg`);
          triggerCastFx(currentPlayer.boardPosition, ELEMENTS[currentEnemy.elementCategory]?.[currentEnemy.element]?.color||'#c9a7f7');
          updatedPlayer={...currentPlayer,health:newHP};
          updatedEnemy=markSkillUsed({...currentEnemy,actionpts:currentEnemy.actionpts-3,facing:newFacing},'pulseWave');
          setPlayer(updatedPlayer); setEnemy(updatedEnemy);
          if(newHP<=0){ addLog('=== DEFEAT ==='); return; }
          setTimeout(()=>{
            if(updatedEnemy.actionpts>0) runEnemyTurn(updatedEnemy,updatedPlayer,updatedSummons,currentRound,updatedObstacles);
            else finishEnemyToPlayer(updatedPlayer,updatedEnemy,currentRound);
          },600);
          return;
        }
        // Deploy (or no valid decision) — not supported for the single-enemy
        // engine; falls through to elemental/melee/approach below instead.
      }

      if(canUseSkill){
        const elData=eElData;
        const rolls=elData.dice.map(d=>({type:d,value:rollDie(parseInt(d.slice(1)))}));
        let dmg=0, heal=0, appliesBurn=false;
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
          appliesBurn=pulses>=3;
          if(appliesBurn) setTiles(prev=>{ const g=prev.map(r=>r.slice()); g[currentPlayer.boardPosition.y][currentPlayer.boardPosition.x]=TILE_TYPES.FIRE_BOOST; return g; });
          addLog(`${currentEnemy.name} Ember Strike [${pulses} pulses x ${dmgEach*SKILL_DICE_MULT} = ${base}] ${acc}% (${accuracyTierLabel(acc)}) -> ${dmg} dmg${tileBoost>0?' [Fire tile +20]':''}${appliesBurn?' [Burn, Scorch]':''}`);
        } else if(elData.isEarth){
          const dieRoll=rolls[0].value;
          const maxRange=Math.max(1,Math.floor(dieRoll/2));
          const avail=Math.max(1,Math.min(maxRange, currentEnemy.actionpts-1));
          const chosenRange=avail;
          const {hitObstacle,hitTarget,newObstacleTiles}=resolveEarthTremor(
            {boardPosition:currentEnemy.boardPosition,facing:castFacing}, chosenRange, [currentPlayer], updatedObstacles, [currentPlayer.boardPosition, ...updatedSummons.map(s=>s.boardPosition)], tiles
          );
          const base=dieRoll*EARTH_DICE_MULT;
          const acc=rollD100Accuracy();
          const tileBoost=getTileBoost(tiles,currentEnemy.boardPosition,'Earth');
          const rawDmg=Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(base,acc))+tileBoost;
          dmg = hitTarget ? rawDmg : 0;
          eCost=1+chosenRange;
          if(newObstacleTiles.length>0){ updatedObstacles=[...updatedObstacles, ...newObstacleTiles.map(t=>makeObstacle(t))]; setObstacles(updatedObstacles); }
          if(hitObstacle){
            const newHP=Math.min(hitObstacle.maxHealth,hitObstacle.health+rawDmg);
            addLog(`Rubble reinforced +${rawDmg} (${newHP}/${hitObstacle.maxHealth}).`);
            updatedObstacles = updatedObstacles.map(o=>o.id===hitObstacle.id?{...o,health:newHP}:o);
            setObstacles(updatedObstacles);
          }
          const outcome = hitTarget ? `${dmg} dmg${tileBoost>0?' [Earth tile +20]':''}` : hitObstacle ? 'reinforced rubble instead' : 'MISS';
          addLog(`${currentEnemy.name} Tremor [d6=${dieRoll}, ${chosenRange} tile${chosenRange>1?'s':''}, ${acc}% (${accuracyTierLabel(acc)})] -> ${outcome}${newObstacleTiles.length>0?` (+${newObstacleTiles.length} rubble)`:''}`);
        } else if(elData.isAir){
          const dieRoll=rolls[0].value;
          const maxLine=getForwardTiles(currentEnemy.boardPosition,castFacing,SIZE);
          const playerStep=maxLine.findIndex(t=>t.x===currentPlayer.boardPosition.x&&t.y===currentPlayer.boardPosition.y);
          const playerDist=playerStep>=0?playerStep+1:-1;
          // Range and damage are synergistic now: the roll is the max reach
          // (hit if the player's within that many tiles), and damage comes
          // purely from airGaleForceDamage(roll) regardless of distance. A
          // closer obstacle takes the gust instead of the player.
          const lineObstacle=findLineObstacle(currentEnemy.boardPosition,castFacing,dieRoll,updatedObstacles);
          const blocked=lineObstacle && (playerDist<0||lineObstacle.dist<=playerDist);
          const hit = !blocked && playerDist>0 && playerDist<=dieRoll;
          const base=airGaleForceDamage(dieRoll);
          const acc=rollD100Accuracy();
          const tileBoost=getTileBoost(tiles,currentEnemy.boardPosition,'Air');
          const rawDmg=Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(base,acc))+tileBoost;
          dmg=hit?rawDmg:0;
          eCost=2;
          if(hit){
            // Whatever roll wasn't spent reaching the player becomes
            // knockback distance, minimum 1 tile, until it hits a wall or
            // rubble -- a rubble collision stops it a tile short and deals
            // the same collision damage a direct hit would.
            const knockDist=Math.max(1,dieRoll-playerDist);
            const kb=getKnockbackTile(currentPlayer.boardPosition,castFacing,knockDist,[currentEnemy.boardPosition],updatedObstacles);
            updatedPlayer={...currentPlayer,boardPosition:{x:kb.x,y:kb.y}};
            addLog(`${currentEnemy.name} Gale Force [d8=${dieRoll}, ${acc}% (${accuracyTierLabel(acc)})] -> ${dmg} dmg${tileBoost>0?' [Air tile +20]':''} + knockback ${knockDist} tile${knockDist>1?'s':''}${kb.hitObstacle?' [knocked into rubble]':''}`);
            if(kb.hitObstacle){
              const newHP=Math.max(0,kb.hitObstacle.health-rawDmg);
              addLog(newHP<=0?'Rubble destroyed!':`Rubble takes ${rawDmg} dmg (${newHP}/${kb.hitObstacle.maxHealth}).`);
              updatedObstacles = newHP<=0 ? updatedObstacles.filter(o=>o.id!==kb.hitObstacle.id) : updatedObstacles.map(o=>o.id===kb.hitObstacle.id?{...o,health:newHP}:o);
              setObstacles(updatedObstacles);
            }
          } else if(blocked){
            const newHP=Math.max(0,lineObstacle.obstacle.health-rawDmg);
            addLog(`${currentEnemy.name} Gale Force [d8=${dieRoll}, ${acc}% (${accuracyTierLabel(acc)})] -> struck rubble instead — ${newHP<=0?'destroyed!':`${rawDmg} dmg (${newHP}/${lineObstacle.obstacle.maxHealth})`}`);
            updatedObstacles = newHP<=0 ? updatedObstacles.filter(o=>o.id!==lineObstacle.obstacle.id) : updatedObstacles.map(o=>o.id===lineObstacle.obstacle.id?{...o,health:newHP}:o);
            setObstacles(updatedObstacles);
          } else {
            addLog(`${currentEnemy.name} Gale Force [d8=${dieRoll}] -> MISS`);
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
            const flooded=dieRoll>=10;
            if(flooded) setTiles(prev=>{ const g=prev.map(r=>r.slice()); footprint.forEach(ft=>{ g[ft.y][ft.x]=TILE_TYPES.WATER_BOOST; }); return g; });
            addLog(`${currentEnemy.name} Torrent [d20=${dieRoll}, ${res.damage} dmg, ${AOE_LABEL[chosen.aoe]}, ${acc}% (${accuracyTierLabel(acc)})] -> ${hit?dmg+' dmg'+(tileBoost>0?' [Water tile +20]':''):'MISS'}${flooded?' [Flood]':''}`);
          }
        }

        if(dmg>0){
          const newHP=Math.max(0,currentPlayer.health-dmg);
          updatedPlayer={...updatedPlayer,health:newHP};
          if(appliesBurn) updatedPlayer=applyBurn(updatedPlayer);
          updatedEnemy={...currentEnemy,actionpts:Math.max(0,currentEnemy.actionpts-eCost),skillUsed:true,facing:castFacing};
          setPlayer(updatedPlayer); setEnemy(updatedEnemy);
          triggerCastFx(currentPlayer.boardPosition, ELEMENTS.base[currentEnemy.element]?.color||'#ff4422');
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
        const perHit=tier.meleeBase+flank.bonus;
        const mult=meleeBurstMultiplier(currentEnemy.actionpts,perHit,currentPlayer.health);
        const dmg=perHit*mult;
        const newHP=Math.max(0,currentPlayer.health-dmg);
        addLog(`${currentEnemy.name} melee${mult>1?` (${mult}x ${perHit})`:''} -> ${dmg} dmg${flank.label?' ['+flank.label+']':''}${tier.heavy?' [heavy]':''}`);
        triggerCastFx(currentPlayer.boardPosition,'#ff4422');
        updatedPlayer={...currentPlayer,health:newHP};
        const eMeleeFacing=facingToward(currentEnemy.boardPosition,currentPlayer.boardPosition);
        updatedEnemy={...currentEnemy,actionpts:currentEnemy.actionpts-mult,facing:eMeleeFacing};
        setPlayer(updatedPlayer); setEnemy(updatedEnemy);
        if(newHP<=0){addLog('=== DEFEAT ===');return;}
      } else if(updatedSummons.find(s=>isAdjacent(currentEnemy.boardPosition,s.boardPosition))){
        // A summon blocking the enemy's path is now a real target, not just
        // an inert obstacle — the enemy strikes it down instead of standing
        // there forever, so parking a summon in front of an enemy is a
        // genuine (but destructible) defensive play rather than a permafreeze.
        const targetSummon=updatedSummons.find(s=>isAdjacent(currentEnemy.boardPosition,s.boardPosition));
        const tier=enemyTier(currentEnemy.level);
        const perHit=tier.meleeBase;
        const mult=meleeBurstMultiplier(currentEnemy.actionpts,perHit,targetSummon.health);
        const dmg=perHit*mult;
        const newHP=Math.max(0,targetSummon.health-dmg);
        const eMeleeFacing=facingToward(currentEnemy.boardPosition,targetSummon.boardPosition);
        addLog(`${currentEnemy.name} strikes ${targetSummon.name}${mult>1?` (${mult}x ${perHit})`:''} -> ${dmg} dmg (${newHP}/${targetSummon.maxHealth})`);
        triggerCastFx(targetSummon.boardPosition,'#ff4422');
        updatedEnemy={...currentEnemy,actionpts:currentEnemy.actionpts-mult,facing:eMeleeFacing};
        if(newHP<=0){
          updatedSummons=updatedSummons.filter(s=>s.id!==targetSummon.id);
          addLog(`${targetSummon.name} destroyed!`);
        } else {
          updatedSummons=updatedSummons.map(s=>s.id===targetSummon.id?{...s,health:newHP}:s);
        }
        setSummons(updatedSummons);
        setEnemy(updatedEnemy);
      } else {
        const tier=enemyTier(currentEnemy.level);
        const summonBlockers=[...updatedSummons, ...updatedObstacles].map(s=>s.boardPosition);
        const target=pickApproachTile(currentEnemy.boardPosition,currentPlayer.boardPosition,currentPlayer.facing,tier,[currentPlayer.boardPosition,...summonBlockers]);
        const goal = target || currentPlayer.boardPosition;
        const walk=walkTowardGoal(currentEnemy.boardPosition,currentEnemy.facing,goal,[currentPlayer.boardPosition,...summonBlockers],currentEnemy.actionpts,ENEMY_MOVE_SPEED);
        let moved=walk.steps>0;
        if(moved){
          updatedEnemy={...currentEnemy,boardPosition:walk.pos,facing:walk.facing,actionpts:currentEnemy.actionpts-walk.steps};
          const tag = target ? (target.quality>=2?' [seeking blindspot]':target.quality>=1?' [seeking flank]':'') : '';
          addLog(`${currentEnemy.name} -> (${walk.pos.x},${walk.pos.y})${walk.steps>1?` [${walk.steps} tiles]`:''}${tag}`);
        }
        if(!moved){
          const saved=currentEnemy.actionpts;
          addLog(`${currentEnemy.name} holds position — saving ${saved} Energy`);
          const restedEnemy={...currentEnemy,actionpts:0,energyRollover:(currentEnemy.energyRollover||0)+saved};
          setEnemy(restedEnemy);
          finishEnemyToPlayer(updatedPlayer,restedEnemy,currentRound);
          return;
        }
        // Longshot Protocol — a repositioning move, so it checks right here.
        if((currentEnemy.loadout||[]).includes('longshotProtocol')){
          const blockers=updatedSummons.map(s=>s.boardPosition);
          const hits=checkLongshotProtocol(updatedEnemy.boardPosition,[currentPlayer],blockers);
          if(hits.length>0){
            const newHP=Math.max(0,currentPlayer.health-LONGSHOT_DMG);
            addLog(`◎ ${updatedEnemy.name} Longshot Protocol -> ${LONGSHOT_DMG} dmg (${newHP}/${currentPlayer.maxHealth})`);
            triggerCastFx(currentPlayer.boardPosition,'#88e0c0');
            updatedPlayer={...currentPlayer,health:newHP};
            setPlayer(updatedPlayer);
            if(newHP<=0){ setEnemy(updatedEnemy); addLog('=== DEFEAT ==='); return; }
          }
        }
        setEnemy(updatedEnemy);
      }
      setTimeout(()=>{
        if(updatedEnemy.actionpts>0) runEnemyTurn(updatedEnemy,updatedPlayer,updatedSummons,currentRound,updatedObstacles);
        else finishEnemyToPlayer(updatedPlayer,updatedEnemy,currentRound);
      },600);
    },900);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,tiles,wave,triggerCastFx]);
  // ── ROUND ORCHESTRATION ──
  // Player-facing half of round-start: prompts the "Roll Energy" step.
  // Shared by beginRound (player won initiative) and finishEnemyToPlayer's
  // enemy-went-first hand-off (see below) -- both need the exact same state
  // reset, just reached from different starting points.
  const promptPlayerRoll = useCallback((rP, rE)=>{
    playerHasRolledRef.current = false;
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

  const beginRound = useCallback((rP, rE, currentRound)=>{
    promptPlayerRoll(rP, rE);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[promptPlayerRoll]);

  // Enemy won the initiative roll-off -- runs the enemy's round-opening turn
  // (runEnemyTurn already self-sufficiently rolls the enemy's own Energy when
  // its actionpts is 0, so no separate roll step is needed here). Its
  // eventual completion routes back through finishEnemyToPlayer, which checks
  // playerHasRolledRef to hand off to promptPlayerRoll instead of the normal
  // mid-round startPlayerTurn resume.
  const beginRoundEnemyFirst = useCallback((rE, rP, currentRound)=>{
    playerHasRolledRef.current = false;
    setIsPlayerTurn(false);
    setSelectedSummonId(null);
    setSummonPhaseActive(false);
    setValidSquares([]);
    addLog("=== Initiative roll-off: Enemy wins — Enemy's Turn ===");
    runEnemyTurn(rE, rP, summons, currentRound, obstacles);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,summons,obstacles,runEnemyTurn]);

  // Locks in who won initiative (see firstMoverRef) and starts the round
  // accordingly. Normally reached from InitiativeRollModal's "Begin Battle"
  // button, which already ran the roll itself as part of the reveal
  // ceremony -- this just applies whatever `winner` it was given.
  const applyInitiativeResult = useCallback((winner, rP, rE, currentRound)=>{
    firstMoverRef.current = winner;
    addLog(winner==='enemy'
      ? '// Initiative roll-off: Enemy wins -- Enemy acts first every round from here'
      : '// Initiative roll-off: You win -- You act first every round from here');
    if(winner==='enemy') beginRoundEnemyFirst(rE, rP, currentRound);
    else beginRound(rP, rE, currentRound);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,beginRound,beginRoundEnemyFirst]);

  // Starts the round following the established turn order (Gauntlet/Training,
  // 1v1 mode only). Every round after the first just continues whichever
  // side won the initiative roll-off (see firstMoverRef) rather than
  // re-contesting it -- called from checkEndOfRound and startNextWave. The
  // `firstMoverRef.current===null` branch is a defensive fallback only (rolls
  // invisibly rather than getting stuck) -- in normal play, round 1 always
  // goes through InitiativeRollModal -> applyInitiativeResult first, which
  // already sets firstMoverRef before this could ever be called with it null.
  const startContestedRound = useCallback((rP, rE, currentRound)=>{
    if(firstMoverRef.current === null){
      const { winner } = rollInitiative();
      applyInitiativeResult(winner, rP, rE, currentRound);
      return;
    }
    if(firstMoverRef.current==='enemy'){
      beginRoundEnemyFirst(rE, rP, currentRound);
    } else {
      beginRound(rP, rE, currentRound);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[applyInitiativeResult,beginRound,beginRoundEnemyFirst]);

  const finishEnemyToPlayer = useCallback((latestPlayer, latestEnemy, currentRound)=>{
    // playerHasRolledRef stays false until the player's first Energy roll of
    // the round -- if the enemy won initiative and just finished going
    // first, the player hasn't rolled yet, so this hand-off must open with a
    // fresh roll prompt (promptPlayerRoll) rather than resuming a mid-round
    // alternation via startPlayerTurn, which assumes Energy was already
    // rolled earlier this round. actionpts<=0 can't disambiguate this on its
    // own since it means either "unrolled" or "rolled and fully spent."
    if(!playerHasRolledRef.current){
      setPlayer(latestPlayer);
      setEnemy(latestEnemy);
      promptPlayerRoll(latestPlayer, latestEnemy);
      return;
    }
    if(latestPlayer.actionpts<=0 && latestEnemy.actionpts<=0){
      checkEndOfRound(latestPlayer, latestEnemy, currentRound);
      return;
    }
    setPlayer(latestPlayer);
    setEnemy(latestEnemy);
    startPlayerTurn(latestPlayer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[promptPlayerRoll,checkEndOfRound,startPlayerTurn]);

  // ── ENERGY ROLL ──
  const handleRollEnergy = useCallback(()=>{
    const {unit:burnedPlayer, tickLog}=tickBurn(player);
    if(tickLog) addLog(tickLog);
    const roll = rollD12Energy();
    const rollover = burnedPlayer.energyRollover || 0;
    const frozenPenalty = burnedPlayer.frozen || 0;
    const total = roll + rollover;
    const newAP = Math.max(0, total - frozenPenalty);
    setPlayerRolledEnergy(total);
    playerHasRolledRef.current = true;
    addLog(`You roll d12=${roll}${rollover>0?` +${rollover} rollover`:''} = ${total} Energy${frozenPenalty>0?` (freeze -${frozenPenalty})`:''}  ->  ${newAP} AP`);
    const rolledPlayer = { ...burnedPlayer, actionpts:newAP, frozen:0, energyRollover:0 };
    setPlayer(rolledPlayer);
    const proceed = ()=>{
      if(summons.some(s=>!s.promoted)){
        setEnemy(curE=>{ beginSummonCommandPhase(rolledPlayer, curE, round); return curE; });
      } else {
        setEnergyPhase('act');
        addLog('=== Spend your Energy ===');
      }
    };
    // Promoted Agents act first, automatically — the same "pawns clear the
    // way" ordering, extended to the pieces that have already evolved.
    const agentIds = summons.filter(s=>s.promoted&&s.health>0).map(s=>s.id);
    if(agentIds.length>0){
      setEnemy(curE=>{ runAgentsSequence(agentIds, 0, curE, round, proceed); return curE; });
    } else {
      proceed();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[player,summons,round,addLog,beginSummonCommandPhase,runAgentsSequence]);

  // ── ENEMY DEFEAT / REWARDS / WAVES ──
  const handleEnemyDefeated = useCallback((curPlayer, curWave)=>{
    // Training Mode: a scene is a single standalone lesson, not an endless
    // run — no XP/wave progression, just mark it cleared.
    if(scene){
      addLog(`=== ${enemy.name} defeated! Scene complete. ===`);
      setSceneComplete(true);
      return;
    }
    const xpGain = 200 + curWave*120;
    const hexGain = 50 + curWave*25;
    addLog(`=== ${enemy.name} defeated! +${xpGain} XP, +${hexGain} Hexas ===`);
    setHexas(h=>h+hexGain);
    let leveled = { ...curPlayer, playerXp:(curPlayer.playerXp||0)+xpGain };
    leveled = applyLevelUp(leveled);
    setPlayer(leveled);

    const defeatedBoss = enemyTier(enemy.level).isBoss && enemy.level>=5;
    if(defeatedBoss && !loadoutUnlocked){
      setLoadoutUnlocked(true);
      setTimeout(()=>setShowLoadoutModal(true), 900);
      addLog('=== A boss falls — new loadout path unlocked! ===');
    }
    setTimeout(()=>startNextWave(leveled), defeatedBoss && !loadoutUnlocked ? 600 : 1400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[enemy,addLog,applyLevelUp,loadoutUnlocked,scene]);

  const startNextWave = useCallback((curPlayer)=>{
    const nextWave = wave + 1;
    const enemyLevel = nextWave;
    const freshEnemy = newGoblin(enemyLevel, curPlayer.boardPosition);
    const resetPlayer = { ...curPlayer, actionpts:0, frozen:0, skillUsed:false, rotateUsed:false, classSkillUsed:false, usedSkillIds:[], energyRollover:0,
      boardPosition: rollBackRowPosition(8) };
    const newTiles = makeTiles(resetPlayer.boardPosition, freshEnemy.boardPosition);
    setWave(nextWave);
    setRound(1);
    setEnemy(freshEnemy);
    setPlayer(resetPlayer);
    setTiles(newTiles);
    setSummons([]);            // summons do not persist across waves
    setObstacles([]);          // nor does rubble from a prior wave
    setSelectedSummonId(null);
    setSummonPhaseActive(false);
    setPlayerRolledEnergy(0);
    setEnemyRolledEnergy(0);
    setLockedRoll(null);
    setHealingConsumed(false);
    const bossTag = enemyTier(enemyLevel).isBoss ? ' [BOSS]' : '';
    addLog(`=== Wave ${nextWave} — ${freshEnemy.name} (Lv${enemyLevel})${bossTag} ===`);
    // A new wave's opening round is still a round -- same initiative
    // roll-off as any other (Gauntlet/Training only; Campaign doesn't use
    // startNextWave at all, it has its own multi-enemy wave handling).
    startContestedRound(resetPlayer, freshEnemy, 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[wave,addLog,startContestedRound]);

  // ── ROUTING AFTER A PLAYER ACTION ──
  // The enemy always gets exactly one turn per round, right after the
  // player (and any summons before them) are fully spent — summons no
  // longer skip straight to the enemy on their own.
  const routeAfterPlayerAction = useCallback((updatedPlayer, updatedEnemy)=>{
    if(updatedEnemy.health<=0) return;
    if(updatedPlayer.actionpts>0){
      setPlayer(updatedPlayer);
      setEnemy(updatedEnemy);
      return; // player keeps acting
    }
    addLog('=== Enemy Turn ===');
    setIsPlayerTurn(false);
    setEnemyRolledEnergy(0);
    setTimeout(()=>runEnemyTurn({...updatedEnemy,actionpts:0}, updatedPlayer, summons, round, obstacles), 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[round,summons,obstacles,addLog,runEnemyTurn]);

  // ── MELEE ──
  const handleMeleeOpen = useCallback(()=>{
    if(!canAttack) return;
    const flank=getFlankBonus(player.boardPosition,enemy.boardPosition,enemy.facing);
    const perHitDamage=playerMeleeBase(player.level)+flank.bonus;
    setMeleeModalCtx({perHitDamage,maxMultiplier:player.actionpts,targetLabel:enemy.name});
  },[canAttack,player,enemy]);

  const resolveMelee = useCallback((mult)=>{
    setMeleeModalCtx(null);
    const flank=getFlankBonus(player.boardPosition,enemy.boardPosition,enemy.facing);
    const perHit=playerMeleeBase(player.level)+flank.bonus;
    const dmg=perHit*mult;
    const newHP=Math.max(0,enemy.health-dmg);
    const meleeFacing=facingToward(player.boardPosition,enemy.boardPosition);
    addLog(`You melee${mult>1?` (${mult}x ${perHit})`:''} -> ${dmg} dmg${flank.label?' ['+flank.label+']':''}`);
    triggerCastFx(enemy.boardPosition,'#ffd700');
    const updatedPlayer={...player,actionpts:player.actionpts-mult,facing:meleeFacing};
    const updatedEnemy={...enemy,health:newHP};
    if(newHP<=0){
      setPlayer(updatedPlayer); setEnemy(updatedEnemy);
      handleEnemyDefeated(updatedPlayer, wave);
      return;
    }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[player,enemy,wave,addLog,handleEnemyDefeated,routeAfterPlayerAction,triggerCastFx]);

  // ── END TURN / SURRENDER ──
  const handleEndTurn = useCallback(()=>{
    const saved = player.actionpts;
    if(saved>0) addLog(`You end your turn — saving ${saved} Energy as rollover`);
    else addLog('You end your turn');
    const updatedPlayer={...player,actionpts:0,energyRollover:(player.energyRollover||0)+saved};
    setPlayer(updatedPlayer);
    setIsPlayerTurn(false);
    setEnemyRolledEnergy(0);
    addLog('=== Enemy Turn ===');
    setTimeout(()=>runEnemyTurn({...enemy,actionpts:0}, updatedPlayer, summons, round, obstacles), 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[player,enemy,summons,obstacles,round,addLog,runEnemyTurn]);

  const handleSurrender = useCallback(()=>{
    // Quitting leaves the mode entirely — hand off to the parent (returns to
    // the main screen and unmounts this session) rather than just resetting
    // in place to a fresh instance of the same mode.
    if(onQuit){ onQuit(); return; }
    addLog('=== You surrendered. Restarting... ===');
    const p=initPlayer();
    const e=initEnemy(p);
    setPlayer(p); setEnemy(e); setTiles(makeTiles(p.boardPosition,e.boardPosition));
    setWave(1); setRound(1); setHexas(0);
    setPlayerRolledEnergy(0); setEnemyRolledEnergy(0); setEnergyPhase('roll');
    setIsPlayerTurn(true); setPlayerSel(false); setValidSquares([]);
    setSelCategory('base'); setSelElement('Fire');
    setLockedRoll(null); setHealingConsumed(false);
    setLoadout([]); setLoadoutUnlocked(false); setSummons([]); setObstacles([]);
    setSummonPhaseActive(false); setSelectedSummonId(null);
    setLogs(['=== Battle Initiated ===','Move adjacent to attack. Position for bonuses.']);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,onQuit]);
  // ── SKILL / DICE FLOW ──
  const resetDiceModal = useCallback(()=>{
    setShowDice(false); setDiceRolls([]); setAbilities([]); setDicePhase('roll');
    setAccuracyRoll(null); setPendingAbility(null); setRolling(false);
    setEarthRange(null); setWaterAoe(null);
  },[]);

  const handleSkill = useCallback(()=>{
    if(!(isCampaign?canSkillMulti:canSkill)) return;
    // Resume a locked roll if one exists this round; else fresh.
    if(lockedRoll && lockedRoll.element===selElement){
      setDiceRolls(lockedRoll.rolls);
      setAbilities(lockedRoll.abilities||[]);
      setDicePhase(lockedRoll.phase||'roll');
      setEarthRange(lockedRoll.earthRange??null);
      setWaterAoe(lockedRoll.waterAoe??null);
    } else {
      setDiceRolls([]); setAbilities([]); setDicePhase('roll');
      setEarthRange(null); setWaterAoe(null);
    }
    setAccuracyRoll(null); setPendingAbility(null);
    setShowDice(true);
  },[isCampaign,canSkill,canSkillMulti,lockedRoll,selElement]);

  const handleRoll = useCallback(()=>{
    setRolling(true);
    const el=ELEMENTS[selCategory][selElement];
    // Freeze the caster's tile/facing the instant the dice are rolled — this
    // is the "cast origin" every range/line/AoE/knockback computation for
    // this roll uses from here on, even if the player closes the modal,
    // moves, and reopens it before Applying (see castOrigin above).
    const origin = {boardPosition:player.boardPosition, facing:player.facing};
    setTimeout(()=>{
      const rolls=el.dice.map(d=>({type:d,value:rollDie(parseInt(d.slice(1)))}));
      setDiceRolls(rolls);
      if(!el.isFire&&!el.isEarth&&!el.isAir&&!el.isWater){
        const ab=calcAbilities(selCategory,selElement,rolls);
        setAbilities(ab);
      }
      setRolling(false);
      setLockedRoll({element:selElement,rolls,phase:'roll',origin});
    },500);
  },[selCategory,selElement,player]);

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
    triggerCastFx(enemy.boardPosition, ELEMENTS.base[selElement]?.color||'#00c8ff');
    resetDiceModal();
    if(updatedEnemy.health<=0){
      setPlayer(updatedPlayer); setEnemy(updatedEnemy);
      handleEnemyDefeated(updatedPlayer, wave);
      return;
    }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[dicePhase,accuracyRoll,selCategory,selElement,player,enemy,wave,addLog,handleEnemyDefeated,resetDiceModal,routeAfterPlayerAction,triggerCastFx]);

  // Fire handlers
  const handleFireProceedToAccuracy = useCallback(()=>{ setDicePhase('accuracy'); setAccuracyRoll(null); },[]);
  const handleFireApplyWithAccuracy = useCallback((acc)=>{
    const origin=lockedRoll.origin;
    const pulses=diceRolls[0].value, dmgEach=diceRolls[1].value;
    const base=pulses*dmgEach*SKILL_DICE_MULT;
    let dmg=applyAccuracy(base,acc);
    const flank=getFlankBonus(origin.boardPosition,enemy.boardPosition,enemy.facing);
    if(flank.bonus>0) dmg+=flank.bonus;
    const tileBoost=getTileBoost(tiles,origin.boardPosition,'Fire');
    if(tileBoost>0) dmg+=tileBoost;
    dmg=Math.round(dmg*(1+accBonus('Fire')))+dmgBonus('Fire');
    const updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-3),skillUsed:true};
    const appliesBurn=pulses>=3;
    let updatedEnemy={...enemy,health:Math.max(0,enemy.health-dmg)};
    if(appliesBurn) updatedEnemy=applyBurn(updatedEnemy);
    if(appliesBurn) setTiles(prev=>{ const g=prev.map(r=>r.slice()); g[enemy.boardPosition.y][enemy.boardPosition.x]=TILE_TYPES.FIRE_BOOST; return g; });
    addLog(`Ember Strike [${pulses}x${dmgEach*SKILL_DICE_MULT}=${base}] ${acc}% (${accuracyTierLabel(acc)}) -> ${dmg} dmg${flank.label?' ['+flank.label+']':''}${tileBoost>0?' [Fire tile +20]':''}${appliesBurn?' [Burn, Scorch]':''}`);
    triggerCastFx(enemy.boardPosition, ELEMENTS.base.Fire.color);
    resetDiceModal();
    if(updatedEnemy.health<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[diceRolls,lockedRoll,player,enemy,tiles,dmgBonus,accBonus,wave,addLog,handleEnemyDefeated,resetDiceModal,routeAfterPlayerAction,triggerCastFx]);

  // Earth handlers
  const handleSetEarthRange = useCallback((r)=>setEarthRange(r),[]);
  const handleConfirmEarthRange = useCallback(()=>{ setDicePhase('accuracy'); setAccuracyRoll(null); },[]);
  const handleEarthApplyWithAccuracy = useCallback((acc)=>{
    const origin=lockedRoll.origin;
    const dieRoll=diceRolls[0].value;
    const base=dieRoll*EARTH_DICE_MULT;
    const {hitObstacle,hitTarget,newObstacleTiles}=resolveEarthTremor(origin, earthRange, [enemy], obstacles, [enemy.boardPosition, ...summons.map(s=>s.boardPosition)], tiles);
    const tileBoost=getTileBoost(tiles,origin.boardPosition,'Earth');
    // Guaranteed floor on a landed hit — Earth should never tick for single digits.
    const rawDmg=Math.round((Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(base,acc))+tileBoost)*(1+accBonus('Earth')))+dmgBonus('Earth');
    const dmg=hitTarget?rawDmg:0;
    const cost=1+earthRange;
    const updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-cost),skillUsed:true};
    const updatedEnemy={...enemy,health:Math.max(0,enemy.health-dmg)};
    const outcome=hitTarget?`${dmg} dmg${tileBoost>0?' [Earth tile +20]':''}`:hitObstacle?'reinforced rubble instead':'MISS (nothing in line)';
    addLog(`Tremor [d6=${dieRoll}, ${earthRange} tile${earthRange>1?'s':''}, ${acc}% (${accuracyTierLabel(acc)})] -> ${outcome}${newObstacleTiles.length>0?` (+${newObstacleTiles.length} rubble)`:''}`);
    if(newObstacleTiles.length>0) setObstacles(prev=>[...prev, ...newObstacleTiles.map(t=>makeObstacle(t))]);
    if(hitObstacle){
      setObstacles(prev=>{
        const hitOne=prev.find(o=>o.id===hitObstacle.id);
        const newHP=hitOne?Math.min(hitOne.maxHealth,hitOne.health+rawDmg):0;
        addLog(`Rubble reinforced +${rawDmg} (${newHP}/${hitOne?.maxHealth}).`);
        return prev.map(o=>o.id===hitObstacle.id?{...o,health:newHP}:o);
      });
    }
    if(hitTarget) triggerCastFx(enemy.boardPosition, ELEMENTS.base.Earth.color);
    resetDiceModal();
    if(updatedEnemy.health<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[diceRolls,lockedRoll,player,enemy,tiles,obstacles,earthRange,summons,dmgBonus,accBonus,wave,addLog,handleEnemyDefeated,resetDiceModal,routeAfterPlayerAction,triggerCastFx]);

  // Air handlers
  const handleAirProceedToAccuracy = useCallback(()=>{ setDicePhase('accuracy'); setAccuracyRoll(null); },[]);
  const handleAirApplyWithAccuracy = useCallback((acc)=>{
    const origin=lockedRoll.origin;
    const dieRoll=diceRolls[0].value;
    const line=getForwardTiles(origin.boardPosition,origin.facing,SIZE);
    const step=line.findIndex(t=>t.x===enemy.boardPosition.x&&t.y===enemy.boardPosition.y);
    const dist=step>=0?step+1:-1;
    const lineObstacle=findLineObstacle(origin.boardPosition,origin.facing,dieRoll,obstacles);
    const blocked=lineObstacle && (dist<0||lineObstacle.dist<=dist);
    const hit=!blocked&&dist>0&&dist<=dieRoll;
    const base=airGaleForceDamage(dieRoll);
    const tileBoost=getTileBoost(tiles,origin.boardPosition,'Air');
    const rawDmg=Math.round((Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(base,acc))+tileBoost)*(1+accBonus('Air')))+dmgBonus('Air');
    let dmg=hit?rawDmg:0;
    let updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-2),skillUsed:true};
    let updatedEnemy={...enemy,health:Math.max(0,enemy.health-dmg)};
    if(hit){
      const knockDist=Math.max(1,dieRoll-dist);
      const kb=getKnockbackTile(enemy.boardPosition,origin.facing,knockDist,[origin.boardPosition],obstacles);
      updatedEnemy.boardPosition={x:kb.x,y:kb.y};
      addLog(`Gale Force [d8=${dieRoll}, ${acc}% (${accuracyTierLabel(acc)})] -> ${dmg} dmg${tileBoost>0?' [Air tile +20]':''} + knockback ${knockDist} tile${knockDist>1?'s':''}${kb.hitObstacle?' [knocked into rubble]':''}`);
      if(kb.hitObstacle){
        const hitId=kb.hitObstacle.id;
        setObstacles(prev=>{
          const hitOne=prev.find(o=>o.id===hitId);
          const newHP=hitOne?Math.max(0,hitOne.health-rawDmg):0;
          addLog(newHP<=0?'Rubble destroyed!':`Rubble takes ${rawDmg} dmg (${newHP}/${hitOne.maxHealth}).`);
          return newHP<=0 ? prev.filter(o=>o.id!==hitId) : prev.map(o=>o.id===hitId?{...o,health:newHP}:o);
        });
      }
    } else if(blocked){
      setObstacles(prev=>{
        const hitOne=prev.find(o=>o.id===lineObstacle.obstacle.id);
        const newHP=hitOne?Math.max(0,hitOne.health-rawDmg):0;
        addLog(`Gale Force [d8=${dieRoll}, ${acc}% (${accuracyTierLabel(acc)})] -> struck rubble instead — ${newHP<=0?'destroyed!':`${rawDmg} dmg (${newHP}/${hitOne.maxHealth})`}`);
        return newHP<=0 ? prev.filter(o=>o.id!==lineObstacle.obstacle.id) : prev.map(o=>o.id===lineObstacle.obstacle.id?{...o,health:newHP}:o);
      });
    } else {
      addLog(`Gale Force [d8=${dieRoll}] -> MISS`);
    }
    if(hit) triggerCastFx(enemy.boardPosition, ELEMENTS.base.Air.color);
    resetDiceModal();
    if(updatedEnemy.health<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  },[diceRolls,lockedRoll,player,enemy,tiles,obstacles,dmgBonus,accBonus,wave,addLog,handleEnemyDefeated,resetDiceModal,routeAfterPlayerAction,triggerCastFx]);

  // Water handlers
  const handleSetWaterAoe = useCallback((aoe)=>setWaterAoe(aoe),[]);
  const handleWaterConfirm = useCallback(()=>{ setDicePhase('accuracy'); setAccuracyRoll(null); },[]);
  const handleWaterApplyWithAccuracy = useCallback((acc)=>{
    const origin=lockedRoll.origin;
    const dieRoll=diceRolls[0].value;
    const res=resolveTorrent(dieRoll);
    const anchor=getTorrentAnchor(origin.boardPosition,origin.facing);
    const footprint=getTorrentFootprint(anchor,waterAoe);
    const hit=footprint.some(t=>t.x===enemy.boardPosition.x&&t.y===enemy.boardPosition.y);
    const tileBoost=getTileBoost(tiles,origin.boardPosition,'Water');
    const dmg=hit?Math.round((applyAccuracy(res.damage,acc)+tileBoost)*(1+accBonus('Water')))+dmgBonus('Water'):0;
    const cost=TORRENT_AOE_COST[waterAoe];
    const updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-cost),skillUsed:true};
    const updatedEnemy={...enemy,health:Math.max(0,enemy.health-dmg)};
    const flooded=dieRoll>=10;
    if(flooded) setTiles(prev=>{ const g=prev.map(r=>r.slice()); footprint.forEach(ft=>{ g[ft.y][ft.x]=TILE_TYPES.WATER_BOOST; }); return g; });
    addLog(`Torrent [d20=${dieRoll}, ${res.damage} dmg, ${AOE_LABEL[waterAoe]}, ${acc}% (${accuracyTierLabel(acc)})] -> ${hit?dmg+' dmg'+(tileBoost>0?' [Water tile +20]':''):'MISS (enemy outside blast)'}${flooded?' [Flood]':''}`);
    if(hit) triggerCastFx(enemy.boardPosition, ELEMENTS.base.Water.color);
    resetDiceModal();
    if(updatedEnemy.health<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[diceRolls,lockedRoll,player,enemy,tiles,waterAoe,dmgBonus,accBonus,wave,addLog,handleEnemyDefeated,resetDiceModal,routeAfterPlayerAction,triggerCastFx]);

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

  // ── COMPASS SLASH (Tactical Skill) ──
  const deployTiles = getDeployTiles(tiles, player.boardPosition, enemy.boardPosition, [...summons, ...obstacles]);
  const activeSummonCount = summons.filter(s=>!s.promoted).length;
  const canDeploy = canCircuitSigil && activeSummonCount < BANDWIDTH && deployTiles.length > 0;
  const deployBlockedReason = activeSummonCount>=BANDWIDTH ? `bandwidth full (${BANDWIDTH}/${BANDWIDTH})`
                            : deployTiles.length===0 ? 'no legal tiles on row 7'
                            : player.actionpts<2 ? 'need 2 Energy'
                            : '';

  const handleCompassSlash = useCallback(()=>{
    if(!canCompassSlash) return;
    setCompassTargeting(true);
    addLog('// Compass Slash armed — click an adjacent tile (8-dir) where the enemy stands');
  },[canCompassSlash,addLog]);

  const resolveCompassSlash = useCallback((targetTile)=>{
    if(!isAdjacent8(player.boardPosition,targetTile)){ addLog('// Target not in the 8 surrounding tiles'); return; }
    const hitsEnemy = enemy.boardPosition.x===targetTile.x && enemy.boardPosition.y===targetTile.y;
    setCompassTargeting(false);
    if(!hitsEnemy){
      addLog('// Compass Slash strikes empty tile — 2 Energy spent');
      const updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-2)},'compassSlash');
      routeAfterPlayerAction(updatedPlayer, enemy);
      return;
    }
    const dmg=Math.round(60*(1+accBonus('compassSlash')))+dmgBonus('compassSlash');
    const slashFacing=facingToward(player.boardPosition,targetTile);
    const newHP=Math.max(0,enemy.health-dmg);
    addLog(`Compass Slash -> ${dmg} dmg (${newHP}/${enemy.maxHealth})`);
    triggerCastFx(enemy.boardPosition,'#9b6cff');
    const updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-2),facing:slashFacing},'compassSlash');
    const updatedEnemy={...enemy,health:newHP};
    if(newHP<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[player,enemy,wave,dmgBonus,accBonus,addLog,handleEnemyDefeated,routeAfterPlayerAction,triggerCastFx]);

  // ── DARK WEB (Tactical Skill) ──
  // Chess-knight strike pattern. Per Codex Protocols §V (Melee & Displacement):
  // a finishing blow claims the defeated unit's tile; a survived hit leaves
  // the attacker in place — same rule as ordinary melee.
  const handleDarkWeb = useCallback(()=>{
    if(!canDarkWeb) return;
    setDarkWebTargeting(true);
    addLog('// Dark Web armed — click a knight-move tile where the enemy stands');
  },[canDarkWeb,addLog]);

  // Checks whether landing on `tile` (from any movement-granting action —
  // ordinary movement, Dark Web's leap or finishing-blow claim) hits the
  // healing node, applying the heal and consuming the tile the same way
  // ordinary movement already does. Returns the post-heal HP (unchanged if
  // the tile wasn't the healing node).
  const applyHealingIfLanded = useCallback((tile, currentHealth, maxHealth)=>{
    if(tiles[tile.y][tile.x] !== TILE_TYPES.HEALING) return currentHealth;
    const healedHP = Math.min(maxHealth, currentHealth+100);
    setHealingConsumed(true);
    setTiles(prev=>{const g=prev.map(r=>r.slice()); if(g[tile.y][tile.x]===TILE_TYPES.HEALING) g[tile.y][tile.x]=TILE_TYPES.NORMAL; return g;});
    addLog(`Healing node -> +100 HP (${healedHP}/${maxHealth})`);
    return healedHP;
  },[tiles,addLog]);

  const resolveDarkWeb = useCallback((targetTile)=>{
    if(!isKnightMove(player.boardPosition,targetTile)){ addLog('// Target not a knight-move tile'); return; }
    const hitsEnemy = enemy.boardPosition.x===targetTile.x && enemy.boardPosition.y===targetTile.y;
    setDarkWebTargeting(false);
    if(!hitsEnemy){
      // No target on the tile — Dark Web now doubles as a repositioning
      // tool (leap to any knight-move tile), not just a wasted swing. Still
      // blocked if a summon already occupies the landing tile.
      const occupied = [...summons, ...obstacles].some(s=>s.boardPosition.x===targetTile.x&&s.boardPosition.y===targetTile.y);
      const leapFacing=facingFromMove(player.boardPosition,targetTile);
      const healedHP = occupied ? player.health : applyHealingIfLanded(targetTile,player.health,player.maxHealth);
      const updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-2),health:healedHP,
        ...(occupied?{}:{boardPosition:targetTile,facing:leapFacing})},'darkWeb');
      addLog(occupied ? '// Dark Web strikes an occupied tile — 2 Energy spent, no leap'
        : `Dark Web leaps to (${targetTile.x},${targetTile.y}) — 2 Energy spent`);
      // Dark Web's leap is a genuine reposition, same as a normal move — so
      // it can also land the player on a Longshot Protocol diagonal.
      if(!occupied && loadout.includes('longshotProtocol')){
        const blockers=summons.map(s=>s.boardPosition);
        const hits=checkLongshotProtocol(updatedPlayer.boardPosition,[enemy],blockers);
        if(hits.length>0){
          const hit=hits[0];
          const snipeDmg=Math.round(LONGSHOT_DMG*(1+accBonus('longshotProtocol')))+dmgBonus('longshotProtocol');
          const newHP=Math.max(0,hit.health-snipeDmg);
          addLog(`◎ Longshot Protocol -> ${snipeDmg} dmg (${newHP}/${hit.maxHealth})`);
          triggerCastFx(hit.boardPosition,'#88e0c0');
          const updatedEnemy={...enemy,health:newHP};
          if(newHP<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
          routeAfterPlayerAction(updatedPlayer, updatedEnemy);
          return;
        }
      }
      routeAfterPlayerAction(updatedPlayer, enemy);
      return;
    }
    const acc=rollD100Accuracy();
    const dmg=Math.round(applyAccuracy(70,acc)*(1+accBonus('darkWeb')))+dmgBonus('darkWeb');
    const strikeFacing=facingToward(player.boardPosition,targetTile);
    const newHP=Math.max(0,enemy.health-dmg);
    const updatedEnemy={...enemy,health:newHP};
    triggerCastFx(enemy.boardPosition,'#a0a0a0');
    if(newHP<=0){
      // Finishing blow — Dark Web claims the target's tile, same as a melee kill.
      const healedHP = applyHealingIfLanded(targetTile,player.health,player.maxHealth);
      const updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-2),facing:strikeFacing,boardPosition:targetTile,health:healedHP},'darkWeb');
      addLog(`Dark Web -> ${dmg} dmg (${acc}% ${accuracyTierLabel(acc)}) — finishing blow, claims (${targetTile.x},${targetTile.y})`);
      setPlayer(updatedPlayer); setEnemy(updatedEnemy);
      handleEnemyDefeated(updatedPlayer,wave);
      return;
    }
    addLog(`Dark Web -> ${dmg} dmg (${acc}% ${accuracyTierLabel(acc)}) (${newHP}/${enemy.maxHealth})`);
    const updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-2),facing:strikeFacing},'darkWeb');
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[player,enemy,summons,obstacles,loadout,dmgBonus,accBonus,wave,addLog,handleEnemyDefeated,routeAfterPlayerAction,triggerCastFx,applyHealingIfLanded]);

  // ── PULSE WAVE (Tactical Skill) ──
  // Your own equipped element, cast a second time down a chosen axis (any
  // of the 8 directions) at a fixed 3-tile range instead of the base SKILL
  // button's normal range/AoE rules — see computePulseWaveDamage.
  const handlePulseWave = useCallback(()=>{
    if(!canPulseWave) return;
    setPulseWaveTargeting(true);
    addLog('// Pulse Wave armed — click a tile up to 3 out on any straight or diagonal axis');
  },[canPulseWave,addLog]);

  const resolvePulseWave = useCallback((targetTile)=>{
    const dir = findAxisDirection(player.boardPosition, targetTile);
    const dist = dir ? Math.max(Math.abs(targetTile.x-player.boardPosition.x),Math.abs(targetTile.y-player.boardPosition.y)) : 0;
    setPulseWaveTargeting(false);
    if(!dir || dist>3){ addLog('// Target not on a straight or diagonal line within 3 tiles'); return; }
    const strike = computePulseWaveDamage({element:selElement,elementCategory:selCategory});
    if(!strike){ addLog('// No element equipped'); return; }
    strike.dmg = Math.round(strike.dmg*(1+accBonus('pulseWave'))) + dmgBonus('pulseWave');
    const line = getAxisLine(player.boardPosition, dir, 3);
    const hitsEnemy = line.some(t=>t.x===enemy.boardPosition.x&&t.y===enemy.boardPosition.y);
    const newFacing=facingToward(player.boardPosition,targetTile);
    const updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-3),facing:newFacing},'pulseWave');
    if(!hitsEnemy){
      addLog(`Pulse Wave [${strike.rollsLabel}, ${strike.acc}% (${accuracyTierLabel(strike.acc)})] -> no targets on the line`);
      routeAfterPlayerAction(updatedPlayer, enemy);
      return;
    }
    const newHP=Math.max(0,enemy.health-strike.dmg);
    addLog(`Pulse Wave [${strike.rollsLabel}, ${strike.acc}% (${accuracyTierLabel(strike.acc)})] -> ${strike.dmg} dmg`);
    triggerCastFx(enemy.boardPosition, ELEMENTS[selCategory]?.[selElement]?.color||'#c9a7f7');
    const updatedEnemy={...enemy,health:newHP};
    if(newHP<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  },[player,enemy,wave,selCategory,selElement,dmgBonus,accBonus,addLog,handleEnemyDefeated,routeAfterPlayerAction,triggerCastFx]);

  // ── PIERCING LIGHT (Tactical Skill) ──
  // A 2-tile-forward thrust, using current facing — no grid targeting
  // phase, same as ordinary Melee. Opens the energy-investment modal instead.
  const handlePiercingLight = useCallback(()=>{
    if(!canPiercingLight) return;
    setPiercingLightCtx({maxEnergy:player.actionpts});
  },[canPiercingLight,player]);

  const resolvePiercingLight = useCallback((energySpent)=>{
    setPiercingLightCtx(null);
    const dmg = Math.round(piercingLightDamage(energySpent)*(1+accBonus('piercingLight'))) + dmgBonus('piercingLight');
    const line = getForwardTiles(player.boardPosition, player.facing, 2);
    const hitsEnemy = line.some(t=>t.x===enemy.boardPosition.x&&t.y===enemy.boardPosition.y);
    const updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-energySpent)},'piercingLight');
    if(!hitsEnemy){
      addLog(`Piercing Light thrust -> no targets in the 2 tiles ahead — ${energySpent} Energy spent`);
      routeAfterPlayerAction(updatedPlayer, enemy);
      return;
    }
    const newHP=Math.max(0,enemy.health-dmg);
    addLog(`Piercing Light -> ${dmg} dmg (${newHP}/${enemy.maxHealth})`);
    triggerCastFx(enemy.boardPosition,'#ffdd77');
    const updatedEnemy={...enemy,health:newHP};
    if(newHP<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  },[player,enemy,wave,dmgBonus,accBonus,addLog,handleEnemyDefeated,routeAfterPlayerAction,triggerCastFx]);

  // ── CUSTOM SYNTHESIS (Core Skill — a saved design from CraftingScreen.jsx) ──
  // No separate targeting click -- every archetype's shape is already fixed
  // at design time (see customSkillFootprint), so casting just resolves
  // immediately against whatever the rotated footprint actually covers, the
  // same "auto-hits everything in the footprint" idea as Water Torrent.
  // Warp/Range-with-move reposition the caster the same way Dark Web's leap
  // and Piercing Light's thrust already do.
  const handleCustomSkill = useCallback(()=>{
    if(!canCustomSkill || !customSkillDef) return;
    const def = customSkillDef;
    const {tiles:footprint, moveTo} = customSkillFootprint(def, player.boardPosition, player.facing);
    const hitsEnemy = footprint.some(t=>t.x===enemy.boardPosition.x&&t.y===enemy.boardPosition.y);
    const meta = customSkillEntry(def);

    let newFacing = player.facing;
    let newPos = player.boardPosition;
    let newHealth = player.health;
    if(!hitsEnemy && moveTo){
      const blocked = [...summons, ...obstacles].some(s=>s.boardPosition.x===moveTo.x&&s.boardPosition.y===moveTo.y);
      if(!blocked){
        newFacing = facingFromMove(player.boardPosition, moveTo);
        newPos = moveTo;
        newHealth = applyHealingIfLanded(moveTo, player.health, player.maxHealth);
      }
    } else if(hitsEnemy && (def.archetype==='range'||def.archetype==='warp')){
      newFacing = facingToward(player.boardPosition, enemy.boardPosition);
    }

    let updatedPlayer = markSkillUsed({...player, actionpts:Math.max(0,player.actionpts-customSkillCost),
      facing:newFacing, boardPosition:newPos, health:newHealth}, 'customSkill');

    if(!hitsEnemy){
      addLog(`${def.name} -> no target hit (${customSkillCost} Energy spent)`);
      routeAfterPlayerAction(updatedPlayer, enemy);
      return;
    }

    const dmg = Math.round((def.damage||0)*(1+accBonus('customSkill'))) + dmgBonus('customSkill');
    const newHP = Math.max(0,enemy.health-dmg);
    let updatedEnemy = {...enemy,health:newHP};
    const {roll,triggered} = resolveCustomSkillEffects(def);
    addLog(`${def.name} -> ${dmg} dmg${roll!==null?` [rolled ${roll}]`:''} (${newHP}/${enemy.maxHealth})`);
    triggerCastFx(enemy.boardPosition, meta.color);

    const kbMagnitude = triggered.filter(e=>e.type==='knockback').reduce((s,e)=>s+e.magnitude,0);
    if(kbMagnitude>0 && newHP>0){
      // Pushed away from the tile the caster struck from, not necessarily
      // `newFacing` -- an AoE footprint can hit a tile behind the caster,
      // where the cast-direction facing would push the target the wrong way.
      const kbFacing = facingToward(player.boardPosition, enemy.boardPosition);
      const kb = getKnockbackTile(updatedEnemy.boardPosition, kbFacing, kbMagnitude, [updatedPlayer.boardPosition,...summons.map(s=>s.boardPosition)], obstacles);
      updatedEnemy = {...updatedEnemy, boardPosition:{x:kb.x,y:kb.y}};
      if(kb.hitObstacle) setObstacles(prev=>prev.map(o=>o.id===kb.hitObstacle.id?{...o,health:Math.max(0,o.health-dmg)}:o).filter(o=>o.health>0));
    }
    if(triggered.some(e=>e.type==='burn') && newHP>0){
      updatedEnemy = applyBurn(updatedEnemy);
      setTiles(prev=>{ const g=prev.map(r=>r.slice()); g[updatedEnemy.boardPosition.y][updatedEnemy.boardPosition.x]=TILE_TYPES.FIRE_BOOST; return g; });
    }
    if(triggered.some(e=>e.type==='flood') && footprint.length>0){
      setTiles(prev=>{ const g=prev.map(r=>r.slice()); footprint.forEach(t=>{ g[t.y][t.x]=TILE_TYPES.WATER_BOOST; }); return g; });
    }
    if(triggered.some(e=>e.type==='rubble') && !obstacles.some(o=>o.boardPosition.x===player.boardPosition.x&&o.boardPosition.y===player.boardPosition.y)){
      setObstacles(prev=>[...prev, makeObstacle(player.boardPosition)]);
    }

    if(newHP<=0){ setPlayer(updatedPlayer); setEnemy(updatedEnemy); handleEnemyDefeated(updatedPlayer,wave); return; }
    routeAfterPlayerAction(updatedPlayer, updatedEnemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[canCustomSkill,customSkillDef,customSkillCost,player,enemy,summons,obstacles,wave,dmgBonus,accBonus,addLog,handleEnemyDefeated,routeAfterPlayerAction,triggerCastFx,applyHealingIfLanded]);

  // ── CIRCUIT SIGIL (Core Skill, crafting-locked — dormant until BATTLE_SKILLS
  // drops the `locked` flag) ── canDeployMulti is defined later in the file
  // (const, TDZ) — referenced only inside this handler's own body, invoked
  // well after render completes, so the forward reference is safe; can't
  // list it in deps without a TDZ crash at render time.
  const handleCircuitSigil = useCallback(()=>{
    if(!(isCampaign?canDeployMulti:canDeploy)) return;
    setShowDeploy(true);
    setDeployRoll(null); setDeployTier(null); setAwaitingPlacement(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isCampaign,canDeploy]);

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
    const updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-2)},'circuitSigil');
    addLog(`◈ ${s.name} deployed at (${tile.x},${tile.y}). Bandwidth ${summons.length+1}/${BANDWIDTH}.`);
    setShowDeploy(false); setAwaitingPlacement(false); setDeployRoll(null); setDeployTier(null);
    routeAfterPlayerAction(updatedPlayer, enemy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[deployTiles,deployTier,player,enemy,summons,addLog,routeAfterPlayerAction]);

  const handleCloseDeploy = useCallback(()=>{
    setShowDeploy(false); setAwaitingPlacement(false); setDeployRoll(null); setDeployTier(null);
  },[]);

  // Toggles one skill in the loadout, capped per-category (Tactical vs the
  // now-craftable Core skills beyond baseline Melee — Melee itself is never
  // toggled here since it's always equipped).
  const handleToggleLoadoutSkill = useCallback((skillId)=>{
    setLoadout(prev=>{
      if(prev.includes(skillId)) return prev.filter(id=>id!==skillId);
      const skill = BATTLE_SKILLS.find(s=>s.id===skillId);
      if(!skill) return prev;
      const cap = skill.category==='core' ? CORE_SKILL_CAP : TACTICAL_SKILL_CAP;
      const count = prev.filter(id=>BATTLE_SKILLS.find(s=>s.id===id)?.category===skill.category).length;
      if(count>=cap) return prev;
      return [...prev,skillId];
    });
  },[]);

  const handleConfirmLoadout = useCallback(()=>{
    // Training Mode's Battle Skills scene allows re-opening this picker to
    // swap at will — clear summons (a mid-battle skill swap shouldn't carry
    // stray Novices from a skill you may have just unequipped) and each
    // skill's used-this-turn flag so the fresh loadout starts clean. No-op
    // impact on Gauntlet, where this only ever fires once.
    setShowLoadoutModal(false);
    setSummons([]);
    setObstacles([]);
    setSelectedSummonId(null);
    setPlayer(p=>({...p, usedSkillIds:[]}));
    const names = loadout.map(id=>BATTLE_SKILLS.find(s=>s.id===id)?.name).filter(Boolean).join(', ') || 'Melee only';
    addLog(`=== Loadout equipped: ${names}! ===`);
    showReward(`<h2 style="color:#9b6cff;letter-spacing:.1em">LOADOUT EQUIPPED</h2><p style="font-size:1.1rem;margin:10px 0;color:#b08cff">${names}</p>`,3500);
  },[addLog,showReward,loadout]);

  // ══════════════════════════════════════════════════════════════════════════
  // ── CAMPAIGN MODE ENGINE (multi-enemy) ──
  // Entirely parallel to the single-`enemy` engine above — none of it runs
  // unless isCampaign is true, and nothing above this banner was changed to
  // support it. See computeElementalStrike / commandEnemySummons /
  // resolveEnemyClassSkill (module scope, above the component) for the pure
  // per-enemy decision logic this section applies.
  // ══════════════════════════════════════════════════════════════════════════

  const checkEndOfRoundMulti = useCallback((latestPlayer, latestEnemies, currentRound)=>{
    if(latestPlayer.actionpts>0 || latestEnemies.some(e=>e.actionpts>0)) return;
    const nextRound = currentRound+1;
    setRound(nextRound);
    setPlayerRolledEnergy(0);
    setEnemyRolledEnergyById({});
    setLockedRoll(null);
    setDiceRolls([]); setAbilities([]); setDicePhase('roll');
    setAccuracyRoll(null); setPendingAbility(null); setEarthRange(null); setWaterAoe(null);
    addLog(`=== Round ${nextRound} ===`);
    const rP = { ...latestPlayer, actionpts:0, frozen:latestPlayer.frozen||0, skillUsed:false, rotateUsed:false, classSkillUsed:false, usedSkillIds:[] };
    const rEnemies = latestEnemies.map(e=>({ ...e, actionpts:0, frozen:e.frozen||0, skillUsed:false, classSkillUsed:false, usedSkillIds:[],
      energyRollover:(e.energyRollover||0)+(e.actionpts||0) }));
    setPlayer(rP);
    setEnemies(rEnemies);
    setTimeout(()=>beginRoundMulti(rP, rEnemies, nextRound), 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog]);

  const beginRoundMulti = useCallback((rP, rEnemies, currentRound)=>{
    setIsPlayerTurn(true);
    setEnergyPhase('roll');
    setSelectedSummonId(null);
    setSelectedEnemyId(null);
    setSummonPhaseActive(false);
    setValidSquares([]);
    setHealingConsumed(consumed=>{
      if(consumed){
        setTiles(prevTiles=>relocateHealingTile(prevTiles, rP.boardPosition, {x:-1,y:-1}, [...rEnemies.map(e=>e.boardPosition), ...summons.map(s=>s.boardPosition)]));
        addLog('// A new healing node materializes on the grid');
      }
      return false;
    });
    addLog('=== Your Turn — Roll Energy ===');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,summons]);

  const finishEnemiesToPlayerMulti = useCallback((latestPlayer, latestEnemies, currentRound)=>{
    if(latestPlayer.actionpts<=0 && latestEnemies.every(e=>e.actionpts<=0)){
      checkEndOfRoundMulti(latestPlayer, latestEnemies, currentRound);
      return;
    }
    setPlayer(latestPlayer);
    setEnemies(latestEnemies);
    startPlayerTurn(latestPlayer);
  },[checkEndOfRoundMulti,startPlayerTurn]);

  // Per-enemy AI turn: rolls its own independent d12, then spends the
  // resulting pool one decision at a time (own-summons, class skill,
  // elemental skill, melee, approach-move, hold), recursing via setTimeout
  // exactly the way the single-enemy engine's runEnemyTurn already does.
  const runSingleEnemyAITurn = useCallback((thisEnemy, allEnemies, currentPlayer, currentSummons, currentRound, onDone, currentObstacles)=>{
    const needsRoll = thisEnemy.actionpts===0;
    if(needsRoll){
      const {unit:burnedEnemy, tickLog}=tickBurn(thisEnemy);
      if(tickLog) addLog(tickLog);
      if(burnedEnemy.health<=0){
        const deadEnemies=allEnemies.map(e=>e.id===thisEnemy.id?burnedEnemy:e);
        setEnemies(deadEnemies);
        handleEnemyDefeatedMulti(thisEnemy.id, currentPlayer, deadEnemies);
        return;
      }
      thisEnemy = burnedEnemy;
      const eRoll=rollD12Energy();
      const rollover=thisEnemy.energyRollover||0;
      const frozenPenalty=thisEnemy.frozen||0;
      const total=eRoll+rollover;
      const newAP=Math.max(0,total-frozenPenalty);
      setEnemyRolledEnergyById(prev=>({...prev,[thisEnemy.id]:total}));
      addLog(`// ${thisEnemy.name} (R${thisEnemy.rank}) rolls d12=${eRoll}${rollover>0?` +${rollover} rollover`:''} = ${total} Energy${frozenPenalty>0?` (freeze -${frozenPenalty})`:''}  ->  ${newAP} AP`);
      // Flee-or-not decided once per turn (see the matching comment in
      // runEnemyTurn) — re-rolling it every action-point step made the unit
      // flip-flop between fleeing and fighting step to step.
      const fleeCommit = thisEnemy.element ? Math.random()<0.6 : true;
      const rolledEnemy={...thisEnemy,actionpts:newAP,frozen:0,energyRollover:0,fleeCommit};
      const rolledEnemies=allEnemies.map(e=>e.id===rolledEnemy.id?rolledEnemy:e);
      setEnemies(rolledEnemies);
      if(newAP<=0){
        addLog(`// ${thisEnemy.name} has 0 Energy — passing`);
        onDone(currentPlayer,rolledEnemies,currentSummons,currentObstacles);
        return;
      }
      setTimeout(()=>runSingleEnemyAITurn(rolledEnemy,rolledEnemies,currentPlayer,currentSummons,currentRound,onDone,currentObstacles),500);
      return;
    }

    setTimeout(()=>{
      const others = allEnemies.filter(e=>e.id!==thisEnemy.id && e.health>0);
      let updatedPlayer=currentPlayer, updatedEnemy=thisEnemy, updatedSummons=currentSummons, updatedObstacles=currentObstacles;

      // Own-summon command (only meaningful for a Circuit-Sigil-carrying
      // enemy, i.e. the boss) — batched once at the top of this enemy's
      // AP-spend pass.
      if((thisEnemy.loadout||[]).includes('circuitSigil') && updatedSummons.some(s=>s.side==='enemy'&&s.ownerId===thisEnemy.id) && updatedEnemy.actionpts>0){
        const res = commandEnemySummons(updatedEnemy, updatedSummons, others, updatedPlayer, currentRound);
        if(res.apSpent>0){
          res.logs.forEach(addLog);
          updatedSummons = res.nextSummons;
          updatedEnemy = {...updatedEnemy, actionpts:updatedEnemy.actionpts-res.apSpent};
          if(res.playerHP!==updatedPlayer.health){ updatedPlayer = {...updatedPlayer, health:res.playerHP}; triggerCastFx(updatedPlayer.boardPosition,'#ff6644'); }
          setSummons(updatedSummons);
          if(updatedPlayer!==currentPlayer) setPlayer(updatedPlayer);
          // Any promoted-this-step summons join the roster now — too late to
          // act themselves this round (the sequence already started), but
          // present and player-attackable starting next round.
          setEnemies([...allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e), ...res.promoted]);
          if(updatedPlayer.health<=0){ addLog('=== DEFEAT ==='); setShowDefeatModal(true); return; }
        }
      }

      const adjacent=isAdjacent(updatedEnemy.boardPosition,updatedPlayer.boardPosition);
      const eElData=updatedEnemy.element?ELEMENTS[updatedEnemy.elementCategory]?.[updatedEnemy.element]:null;
      const eMinCost=eElData?getSkillCost(updatedEnemy.elementCategory,updatedEnemy.element):1;
      const canUseElement = updatedEnemy.element && canElementReachTarget(updatedEnemy,updatedPlayer,updatedEnemy.actionpts) && !updatedEnemy.skillUsed && updatedEnemy.actionpts>=eMinCost && Math.random()<0.6;
      const hasUnusedClassLikeSkill = (updatedEnemy.loadout||[]).some(id=>['compassSlash','darkWeb','pulseWave','piercingLight','circuitSigil'].includes(id) && !(updatedEnemy.usedSkillIds||[]).includes(id));
      const canUseClass = hasUnusedClassLikeSkill && updatedEnemy.actionpts>=2 && Math.random()<0.6;

      const lowHP = updatedEnemy.health <= updatedEnemy.maxHealth*0.3;
      const healTile = findHealingTile(tiles);
      const onHealTile = healTile && updatedEnemy.boardPosition.x===healTile.x && updatedEnemy.boardPosition.y===healTile.y;
      const willFlee = lowHP && healTile && updatedEnemy.fleeCommit;
      const moveBlockers = [...others.map(e=>e.boardPosition), ...updatedSummons.map(s=>s.boardPosition), ...updatedObstacles.map(o=>o.boardPosition)];

      const finishStep = ()=>{
        setTimeout(()=>{
          if(updatedEnemy.actionpts>0) runSingleEnemyAITurn(updatedEnemy,allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e),updatedPlayer,updatedSummons,currentRound,onDone,updatedObstacles);
          else onDone(updatedPlayer,allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e),updatedSummons,updatedObstacles);
        },600);
      };

      if(willFlee && !onHealTile){
        // Reroute only proposes candidates around the *player* — a blocked
        // primary/reroute pair doesn't mean no path exists, just that these
        // two guesses missed. Falls through to holding position (banking the
        // rest as rollover) instead of burning 1 AP per blocked attempt,
        // which used to drain a fleeing enemy's whole banked pool on one
        // stuck step.
        const moves=getMoveCandidatesWithReroute(updatedEnemy.boardPosition,healTile);
        let moved=false;
        for(const m of moves){
          const blocked=moveBlockers.some(b=>b.x===m.x&&b.y===m.y);
          if(m.x>=0&&m.x<SIZE&&m.y>=0&&m.y<SIZE&&!(m.x===updatedPlayer.boardPosition.x&&m.y===updatedPlayer.boardPosition.y)&&!blocked){
            const nf=facingFromMove(updatedEnemy.boardPosition,m);
            let healed=false, newHP=updatedEnemy.health;
            if(m.x===healTile.x&&m.y===healTile.y){ newHP=Math.min(updatedEnemy.maxHealth,updatedEnemy.health+100); healed=true; }
            updatedEnemy={...updatedEnemy,boardPosition:m,facing:nf,actionpts:updatedEnemy.actionpts-1,health:newHP};
            if(healed){
              setHealingConsumed(true);
              setTiles(prev=>{const g=prev.map(r=>r.slice()); if(g[healTile.y][healTile.x]===TILE_TYPES.HEALING) g[healTile.y][healTile.x]=TILE_TYPES.NORMAL; return g;});
              addLog(`${updatedEnemy.name} reaches healing tile → +100 HP (${newHP}/${updatedEnemy.maxHealth})`);
            } else {
              addLog(`${updatedEnemy.name} flees to heal → (${m.x},${m.y})`);
            }
            moved=true; break;
          }
        }
        if(!moved){
          const saved=updatedEnemy.actionpts;
          addLog(`${updatedEnemy.name} can't find a path to heal — holds position, saving ${saved} Energy`);
          updatedEnemy={...updatedEnemy,actionpts:0,energyRollover:(updatedEnemy.energyRollover||0)+saved};
          setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
          onDone(updatedPlayer,allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e),updatedSummons,updatedObstacles);
          return;
        }
        setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
        finishStep();
        return;
      }
      if(willFlee && onHealTile){
        const newHP=Math.min(updatedEnemy.maxHealth,updatedEnemy.health+100);
        updatedEnemy={...updatedEnemy,health:newHP,actionpts:updatedEnemy.actionpts-1};
        setHealingConsumed(true);
        setTiles(prev=>{const g=prev.map(r=>r.slice()); if(g[healTile.y][healTile.x]===TILE_TYPES.HEALING) g[healTile.y][healTile.x]=TILE_TYPES.NORMAL; return g;});
        addLog(`${updatedEnemy.name} heals on tile → +100 HP (${newHP}/${updatedEnemy.maxHealth})`);
        setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
        finishStep();
        return;
      }

      if(canUseClass){
        const decision = resolveEnemyClassSkill(updatedEnemy, updatedPlayer, updatedSummons, tiles, [updatedEnemy.boardPosition, ...others.map(e=>e.boardPosition)], updatedObstacles);
        if(decision?.kind==='direct'){
          const dmg=60;
          const newHP=Math.max(0,updatedPlayer.health-dmg);
          const facing=facingToward(updatedEnemy.boardPosition,updatedPlayer.boardPosition);
          addLog(`${updatedEnemy.name} Compass Slash -> ${dmg} dmg`);
          triggerCastFx(updatedPlayer.boardPosition,'#9b6cff');
          updatedPlayer={...updatedPlayer,health:newHP};
          updatedEnemy=markSkillUsed({...updatedEnemy,actionpts:Math.max(0,updatedEnemy.actionpts-2),facing},'compassSlash');
          setPlayer(updatedPlayer); setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
          if(newHP<=0){ addLog('=== DEFEAT ==='); setShowDefeatModal(true); return; }
          finishStep();
          return;
        }
        if(decision?.kind==='deploy'){
          const roll=rollD100(); const tier=summonTierFromRoll(roll);
          // actedRound:currentRound marks it as already having acted this
          // round (its deployment) -- without this, finishStep()'s recursive
          // re-entry into this same AP-spend pass would let
          // commandEnemySummons see it as un-acted and immediately march or
          // strike with it later in this very turn, a free extra action a
          // freshly-deployed summon shouldn't get.
          const s={...makeSummon(tier,decision.tile,'enemy',updatedEnemy.id),actedRound:currentRound};
          updatedSummons=[...updatedSummons,s];
          setSummons(updatedSummons);
          addLog(`◈ ${updatedEnemy.name} deploys ${s.name} at (${decision.tile.x},${decision.tile.y})`);
          triggerCastFx(decision.tile,'#9b6cff');
          updatedEnemy=markSkillUsed({...updatedEnemy,actionpts:Math.max(0,updatedEnemy.actionpts-2)},'circuitSigil');
          setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
          finishStep();
          return;
        }
        if(decision?.kind==='darkweb'){
          const acc=rollD100Accuracy();
          const dmg=applyAccuracy(70,acc);
          const facing=facingToward(updatedEnemy.boardPosition,updatedPlayer.boardPosition);
          const newHP=Math.max(0,updatedPlayer.health-dmg);
          addLog(`${updatedEnemy.name} Dark Web -> ${dmg} dmg (${acc}% ${accuracyTierLabel(acc)})`);
          triggerCastFx(updatedPlayer.boardPosition,'#a0a0a0');
          updatedPlayer={...updatedPlayer,health:newHP};
          updatedEnemy=markSkillUsed({...updatedEnemy,actionpts:Math.max(0,updatedEnemy.actionpts-2),facing,
            boardPosition: newHP<=0 ? updatedPlayer.boardPosition : updatedEnemy.boardPosition},'darkWeb');
          setPlayer(updatedPlayer); setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
          if(newHP<=0){ addLog('=== DEFEAT ==='); setShowDefeatModal(true); return; }
          finishStep();
          return;
        }
        if(decision?.kind==='piercingLight'){
          const energySpent=piercingLightAutoSpend(updatedEnemy.actionpts,updatedPlayer.health);
          const dmg=piercingLightDamage(energySpent);
          const newHP=Math.max(0,updatedPlayer.health-dmg);
          addLog(`${updatedEnemy.name} Piercing Light${energySpent>PIERCING_LIGHT_BASE_COST?` (${energySpent}E)`:''} -> ${dmg} dmg`);
          triggerCastFx(updatedPlayer.boardPosition,'#ffdd77');
          updatedPlayer={...updatedPlayer,health:newHP};
          updatedEnemy=markSkillUsed({...updatedEnemy,actionpts:Math.max(0,updatedEnemy.actionpts-energySpent),facing:decision.facing},'piercingLight');
          setPlayer(updatedPlayer); setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
          if(newHP<=0){ addLog('=== DEFEAT ==='); setShowDefeatModal(true); return; }
          finishStep();
          return;
        }
        if(decision?.kind==='pulseWave'){
          const strike=computePulseWaveDamage(updatedEnemy);
          const newFacing=facingToward(updatedEnemy.boardPosition,updatedPlayer.boardPosition);
          const newHP=Math.max(0,updatedPlayer.health-strike.dmg);
          addLog(`${updatedEnemy.name} Pulse Wave [${strike.rollsLabel}, ${strike.acc}% (${accuracyTierLabel(strike.acc)})] -> ${strike.dmg} dmg`);
          triggerCastFx(updatedPlayer.boardPosition, ELEMENTS[updatedEnemy.elementCategory]?.[updatedEnemy.element]?.color||'#c9a7f7');
          updatedPlayer={...updatedPlayer,health:newHP};
          updatedEnemy=markSkillUsed({...updatedEnemy,actionpts:Math.max(0,updatedEnemy.actionpts-3),facing:newFacing},'pulseWave');
          setPlayer(updatedPlayer); setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
          if(newHP<=0){ addLog('=== DEFEAT ==='); setShowDefeatModal(true); return; }
          finishStep();
          return;
        }
      }

      if(canUseElement){
        const otherUnitPositions=[...allEnemies.filter(e=>e.id!==updatedEnemy.id&&e.health>0).map(e=>e.boardPosition), ...updatedSummons.map(s=>s.boardPosition)];
        const strike = computeElementalStrike(updatedEnemy, updatedPlayer, tiles, updatedObstacles, otherUnitPositions);
        if(strike){
          addLog(strike.log);
          updatedEnemy={...updatedEnemy,actionpts:Math.max(0,updatedEnemy.actionpts-strike.eCost),skillUsed:true,facing:strike.castFacing};
          if(strike.newObstacles?.length>0){ updatedObstacles=[...updatedObstacles, ...strike.newObstacles]; setObstacles(updatedObstacles); }
          if(strike.obstacleHit){
            const {id,dmg:obsDmg,heal}=strike.obstacleHit;
            const hitOne=updatedObstacles.find(o=>o.id===id);
            if(heal){
              const newHP=hitOne?Math.min(hitOne.maxHealth,hitOne.health+obsDmg):0;
              addLog(hitOne?`Rubble reinforced +${obsDmg} (${newHP}/${hitOne.maxHealth}).`:'');
              updatedObstacles = updatedObstacles.map(o=>o.id===id?{...o,health:newHP}:o);
            } else {
              const newHP=hitOne?Math.max(0,hitOne.health-obsDmg):0;
              addLog(newHP<=0?`Rubble destroyed!`:`Rubble takes ${obsDmg} dmg (${newHP}/${hitOne.maxHealth}).`);
              updatedObstacles = newHP<=0 ? updatedObstacles.filter(o=>o.id!==id) : updatedObstacles.map(o=>o.id===id?{...o,health:newHP}:o);
            }
            setObstacles(updatedObstacles);
          }
          if(strike.floodTiles){
            const fts=strike.floodTiles;
            setTiles(prev=>{ const g=prev.map(r=>r.slice()); fts.forEach(ft=>{ g[ft.y][ft.x]=TILE_TYPES.WATER_BOOST; }); return g; });
          }
          if(strike.scorchTile){
            const st=strike.scorchTile;
            setTiles(prev=>{ const g=prev.map(r=>r.slice()); g[st.y][st.x]=TILE_TYPES.FIRE_BOOST; return g; });
          }
          if(strike.dmg>0){
            const newHP=Math.max(0,updatedPlayer.health-strike.dmg);
            triggerCastFx(updatedPlayer.boardPosition, ELEMENTS.base[updatedEnemy.element]?.color||'#ff4422');
            updatedPlayer={...updatedPlayer,health:newHP,boardPosition:strike.knockbackPos||updatedPlayer.boardPosition};
            if(strike.appliesBurn) updatedPlayer=applyBurn(updatedPlayer);
            setPlayer(updatedPlayer); setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
            if(newHP<=0){ addLog('=== DEFEAT ==='); setShowDefeatModal(true); return; }
          } else {
            setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
          }
        }
        finishStep();
        return;
      }

      if(updatedEnemy.canMelee && adjacent){
        const tier=enemyTier(updatedEnemy.level);
        const flank=getFlankBonus(updatedEnemy.boardPosition,updatedPlayer.boardPosition,updatedPlayer.facing);
        const perHit=tier.meleeBase+flank.bonus;
        const mult=meleeBurstMultiplier(updatedEnemy.actionpts,perHit,updatedPlayer.health);
        const dmg=perHit*mult;
        const newHP=Math.max(0,updatedPlayer.health-dmg);
        addLog(`${updatedEnemy.name} melee${mult>1?` (${mult}x ${perHit})`:''} -> ${dmg} dmg${flank.label?' ['+flank.label+']':''}`);
        triggerCastFx(updatedPlayer.boardPosition,'#ff4422');
        updatedPlayer={...updatedPlayer,health:newHP};
        const eMeleeFacing=facingToward(updatedEnemy.boardPosition,updatedPlayer.boardPosition);
        updatedEnemy={...updatedEnemy,actionpts:updatedEnemy.actionpts-mult,facing:eMeleeFacing};
        setPlayer(updatedPlayer); setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
        if(newHP<=0){ addLog('=== DEFEAT ==='); setShowDefeatModal(true); return; }
        finishStep();
        return;
      }

      // A player-side summon blocking this enemy's path is a real target,
      // not just an inert obstacle — destroying it clears the way instead of
      // the enemy standing there forever. Only fires when the enemy isn't
      // already adjacent to the player.
      const adjacentOwnSummon = updatedEnemy.canMelee && updatedSummons.find(s=>s.side==='player'&&isAdjacent(updatedEnemy.boardPosition,s.boardPosition));
      if(adjacentOwnSummon){
        const tier=enemyTier(updatedEnemy.level);
        const perHit=tier.meleeBase;
        const mult=meleeBurstMultiplier(updatedEnemy.actionpts,perHit,adjacentOwnSummon.health);
        const dmg=perHit*mult;
        const newHP=Math.max(0,adjacentOwnSummon.health-dmg);
        const eMeleeFacing=facingToward(updatedEnemy.boardPosition,adjacentOwnSummon.boardPosition);
        addLog(`${updatedEnemy.name} strikes ${adjacentOwnSummon.name}${mult>1?` (${mult}x ${perHit})`:''} -> ${dmg} dmg (${newHP}/${adjacentOwnSummon.maxHealth})`);
        triggerCastFx(adjacentOwnSummon.boardPosition,'#ff4422');
        updatedEnemy={...updatedEnemy,actionpts:updatedEnemy.actionpts-mult,facing:eMeleeFacing};
        if(newHP<=0){
          updatedSummons=updatedSummons.filter(s=>s.id!==adjacentOwnSummon.id);
          addLog(`${adjacentOwnSummon.name} destroyed!`);
        } else {
          updatedSummons=updatedSummons.map(s=>s.id===adjacentOwnSummon.id?{...s,health:newHP}:s);
        }
        setSummons(updatedSummons);
        setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
        finishStep();
        return;
      }

      // Approach/reposition (also the path for no-melee ranks that are out
      // of skill range — they still reposition, they just never land here
      // with an attack attached).
      const tier=enemyTier(updatedEnemy.level);
      const target=pickApproachTile(updatedEnemy.boardPosition,updatedPlayer.boardPosition,updatedPlayer.facing,tier,[updatedPlayer.boardPosition,...moveBlockers]);
      const goal=target||updatedPlayer.boardPosition;
      const walk=walkTowardGoal(updatedEnemy.boardPosition,updatedEnemy.facing,goal,[updatedPlayer.boardPosition,...moveBlockers],updatedEnemy.actionpts,ENEMY_MOVE_SPEED);
      let moved=walk.steps>0;
      if(moved){
        updatedEnemy={...updatedEnemy,boardPosition:walk.pos,facing:walk.facing,actionpts:updatedEnemy.actionpts-walk.steps};
        addLog(`${updatedEnemy.name} -> (${walk.pos.x},${walk.pos.y})${walk.steps>1?` [${walk.steps} tiles]`:''}`);
      }
      if(!moved){
        const saved=updatedEnemy.actionpts;
        addLog(`${updatedEnemy.name} holds position — saving ${saved} Energy`);
        updatedEnemy={...updatedEnemy,actionpts:0,energyRollover:(updatedEnemy.energyRollover||0)+saved};
        setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
        onDone(updatedPlayer,allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e),updatedSummons,updatedObstacles);
        return;
      }
      // Longshot Protocol — a repositioning move, so it checks right here.
      if((updatedEnemy.loadout||[]).includes('longshotProtocol')){
        const hits=checkLongshotProtocol(updatedEnemy.boardPosition,[updatedPlayer],moveBlockers);
        if(hits.length>0){
          const newHP=Math.max(0,updatedPlayer.health-LONGSHOT_DMG);
          addLog(`◎ ${updatedEnemy.name} Longshot Protocol -> ${LONGSHOT_DMG} dmg (${newHP}/${updatedPlayer.maxHealth})`);
          triggerCastFx(updatedPlayer.boardPosition,'#88e0c0');
          updatedPlayer={...updatedPlayer,health:newHP};
          setPlayer(updatedPlayer);
          if(newHP<=0){ setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e)); addLog('=== DEFEAT ==='); setShowDefeatModal(true); return; }
        }
      }
      setEnemies(allEnemies.map(e=>e.id===updatedEnemy.id?updatedEnemy:e));
      finishStep();
    },700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,tiles,triggerCastFx]);

  // Sequences the roster: each living enemy takes its full independent turn
  // (own roll, own AP pool) before control returns to the player. Mirrors
  // finishEnemyToPlayer's role in the single-enemy engine. Weakest rank acts
  // first, strongest last — pawns clear the way before the stronger pieces
  // move, per the Codex's chess framing. Only re-sorted at the start of a
  // fresh sequence (idx===0); the resulting order is then threaded through
  // the recursive chain like everything else here.
  const runEnemiesSequence = useCallback((idx, currentEnemies, currentPlayer, currentSummons, currentRound, currentObstacles)=>{
    if(currentPlayer.health<=0) return; // mirrors the single-enemy engine's own lack of a game-over flow
    const ordered = idx===0 ? [...currentEnemies].sort((a,b)=>b.rank-a.rank) : currentEnemies;
    if(idx>=ordered.length){
      finishEnemiesToPlayerMulti(currentPlayer,ordered,currentRound);
      return;
    }
    const thisEnemy=ordered[idx];
    if(!thisEnemy||thisEnemy.health<=0){
      runEnemiesSequence(idx+1,ordered,currentPlayer,currentSummons,currentRound,currentObstacles);
      return;
    }
    runSingleEnemyAITurn(thisEnemy,ordered,currentPlayer,currentSummons,currentRound,(updatedPlayer,updatedEnemies,updatedSummons,updatedObstacles)=>{
      if(updatedPlayer.health<=0) return;
      runEnemiesSequence(idx+1,updatedEnemies,updatedPlayer,updatedSummons,currentRound,updatedObstacles);
    },currentObstacles);
  },[finishEnemiesToPlayerMulti,runSingleEnemyAITurn]);

  // Same pawns-clear-the-way sequencing as the single-enemy engine: summons
  // go first, then the player spends whatever's left of the shared pool,
  // and only once both are spent do the enemies take their (rank-ordered)
  // turns. Skips straight to the enemies if the summons used the whole pool.
  const endSummonCommandPhaseMulti = useCallback(()=>{
    setSummonPhaseActive(false);
    setSelectedSummonId(null);
    setValidSquares([]);
    const ctx = summonCtxRef.current || { round };
    setPlayer(curP=>{
      setEnemies(curE=>{
        if(curP.actionpts>0){
          addLog('=== Summons done — spend remaining Energy ===');
          setIsPlayerTurn(true);
          setEnergyPhase('act');
        } else {
          addLog('=== Summons done — enemies act ===');
          setIsPlayerTurn(false);
          setEnemyRolledEnergyById({});
          setTimeout(()=>runEnemiesSequence(0, curE.map(e=>({...e,actionpts:0})), curP, summons, ctx.round, obstacles), 400);
        }
        return curE;
      });
      return curP;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,round,summons,obstacles]);

  const routeAfterPlayerActionMulti = useCallback((updatedPlayer, updatedEnemies)=>{
    if(updatedPlayer.actionpts>0){
      setPlayer(updatedPlayer);
      setEnemies(updatedEnemies);
      return;
    }
    addLog("=== Enemies' Turn ===");
    setIsPlayerTurn(false);
    setEnemyRolledEnergyById({});
    setTimeout(()=>runEnemiesSequence(0, updatedEnemies.map(e=>({...e,actionpts:0})), updatedPlayer, summons, round, obstacles), 400);
  },[round,summons,obstacles,addLog,runEnemiesSequence]);

  const handleEnemyDefeatedMulti = useCallback((defeatedId, curPlayer, curEnemies)=>{
    const dead = curEnemies.find(e=>e.id===defeatedId);
    if(!dead) return;
    const remaining = curEnemies.filter(e=>e.id!==defeatedId);
    setEnemies(remaining);
    setSummons(prev=>prev.filter(s=>s.ownerId!==defeatedId));
    setSelectedEnemyId(null);
    const xpGain = 150 + campaignBattle*150;
    const hexGain = 40 + campaignBattle*30;
    addLog(`=== ${dead.name} (R${dead.rank}) defeated! +${xpGain} XP, +${hexGain} Hexas ===`);
    setHexas(h=>h+hexGain);
    // Battle acquisition: rank sets the drop odds (see DROP_CHANCES in
    // ItemData.jsx) -- every enemy always drops its attuned elemental Core,
    // rank only ever raises the chance of a bonus +/- stat Core and (from
    // R2 up) an equipment item on top of that.
    const drop = rollEnemyDrop(dead);
    const dropParts = Object.entries(drop.materials).map(([id,qty])=>`+${qty} ${MATERIALS.find(m=>m.id===id)?.name||id}`);
    if(dropParts.length>0) addLog(`◈ Salvaged: ${dropParts.join(', ')}`);
    if(drop.equipment) addLog(`◈ Equipment drop: ${drop.equipment.name}!`);
    setMaterials(prev=>{
      const next={...prev};
      Object.entries(drop.materials).forEach(([id,qty])=>{ next[id]=(next[id]||0)+qty; });
      return next;
    });
    let leveled = { ...curPlayer, playerXp:(curPlayer.playerXp||0)+xpGain };
    if(drop.equipment) leveled = { ...leveled, equipmentDrops:[...(leveled.equipmentDrops||[]), drop.equipment] };
    leveled = applyLevelUp(leveled);
    setPlayer(leveled);
    if(remaining.length>0) return; // battle continues with the survivors
    const battle = CAMPAIGN_BATTLES[campaignBattle-1];
    addLog(battle.isFinale ? '=== CAMPAIGN COMPLETE — the army falls. ===' : `=== Battle ${campaignBattle}/${CAMPAIGN_BATTLES.length} cleared! ===`);
    onBattleCleared?.(campaignBattle);
    if(battle.isFinale){
      setCampaignComplete(true);
      setPlayer(p=>({...p, equipment:[...(p.equipment||[]), FIRST_EQUIPMENT],
        maxHealth:p.maxHealth+FIRST_EQUIPMENT.maxHealthBonus, health:p.health+FIRST_EQUIPMENT.maxHealthBonus}));
      addLog(`◈ ${FIRST_EQUIPMENT.name} acquired — ${FIRST_EQUIPMENT.statBonus}.`);
    }
    setShowBattleComplete(true);
  },[campaignBattle,addLog,applyLevelUp,onBattleCleared]);

  const startNextCampaignBattle = useCallback((curPlayer, nextStage)=>{
    const battle = CAMPAIGN_BATTLES[nextStage-1];
    const resetPlayer = { ...curPlayer, actionpts:0, frozen:0, skillUsed:false, rotateUsed:false, classSkillUsed:false, usedSkillIds:[], energyRollover:0,
      boardPosition: rollBackRowPosition(8) };
    // The finale boss mirrors the player's own actual loadout+element
    // ("shadowboxing") — spawnCampaignRoster only uses this for isFinale
    // stages, so it's harmless to always pass through.
    const freshEnemies = spawnCampaignRoster(nextStage, resetPlayer.boardPosition, {loadout, element:selElement});
    const newTiles = makeTiles(resetPlayer.boardPosition, {x:-1,y:-1}, freshEnemies.map(e=>e.boardPosition));
    setCampaignBattle(nextStage);
    setEnemies(freshEnemies);
    setPlayer(resetPlayer);
    setTiles(newTiles);
    setSummons([]);
    setObstacles([]);
    setSelectedSummonId(null);
    setSelectedEnemyId(null);
    setSummonPhaseActive(false);
    setPlayerRolledEnergy(0);
    setEnemyRolledEnergyById({});
    setEnergyPhase('roll');
    setRound(1);
    setLockedRoll(null);
    setHealingConsumed(false);
    setIsPlayerTurn(true);
    addLog(`=== Battle ${nextStage}/${CAMPAIGN_BATTLES.length} — ${battle.name} ===`);
  },[addLog,loadout,selElement]);

  // Retry after a defeat — same stage, fresh roster, full heal (unlike a
  // normal Continue, which deliberately carries HP forward between battles).
  // Hexas/materials/XP already earned this run stay banked either way.
  const handleCampaignRetry = useCallback(()=>{
    setShowDefeatModal(false);
    startNextCampaignBattle({...player, health:player.maxHealth}, campaignBattle);
  },[player,campaignBattle,startNextCampaignBattle]);

  // Just a navigation hop back to the main menu — NOT a quit. The Campaign
  // session (player HP/level, roster, battle stage, and this very modal's
  // open/closed state) stays exactly as it is; App.jsx keeps this component
  // mounted (just hidden) the same way it already does for the floating
  // menu button, so coming back to Campaign resumes right where this left
  // off, modal and all -- *if* the battle was already decided (this modal's
  // own "Return to Menu" only fires from the Battle Complete / Defeat
  // modals, both post-decision). Deliberately distinct from
  // onQuit/onCampaignComplete, which really do end the run and reset
  // progress. See the `leaveSignal` effect below for the other exit path —
  // the floating "Main" button, which *can* fire mid-fight.
  const handleCampaignReturnToMenu = useCallback(()=>{
    onReturnToMenu?.();
  },[onReturnToMenu]);

  // App.jsx bumps `leaveSignal` whenever the player backs all the way out to
  // the main menu (the floating "Main" button, or the NavBar's) while this
  // Campaign session stays mounted-but-hidden. If that happened mid-fight —
  // no Battle Complete/Defeat modal open to have already paused things at a
  // decision point — the fight itself would otherwise just sit there
  // half-finished and resume exactly as abandoned. Quit no longer exists as
  // its own button (Main replaces it), so this is what makes leaving mid-
  // battle actually mean something: the current stage restarts fresh, full
  // HP, same as clicking Retry after a defeat — nothing about the run
  // (level, XP, loadout, stage number, Hexas/materials) is lost, only the
  // fight in progress.
  useEffect(()=>{
    if(!isCampaign || !leaveSignal) return;
    if(showBattleComplete || showDefeatModal || campaignComplete) return;
    startNextCampaignBattle({...player, health:player.maxHealth}, campaignBattle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[leaveSignal]);

  const handleRollEnergyMulti = useCallback(()=>{
    const {unit:burnedPlayer, tickLog}=tickBurn(player);
    if(tickLog) addLog(tickLog);
    const roll=rollD12Energy();
    const rollover=burnedPlayer.energyRollover||0;
    const frozenPenalty=burnedPlayer.frozen||0;
    const total=roll+rollover;
    const newAP=Math.max(0,total-frozenPenalty);
    setPlayerRolledEnergy(total);
    addLog(`You roll d12=${roll}${rollover>0?` +${rollover} rollover`:''} = ${total} Energy${frozenPenalty>0?` (freeze -${frozenPenalty})`:''}  ->  ${newAP} AP`);
    const rolledPlayer={...burnedPlayer,actionpts:newAP,frozen:0,energyRollover:0};
    setPlayer(rolledPlayer);
    const proceed = ()=>{
      if(summons.some(s=>s.side==='player'&&!s.promoted)){
        beginSummonCommandPhase(rolledPlayer, null, round);
      } else {
        setEnergyPhase('act');
        addLog('=== Spend your Energy ===');
      }
    };
    // Promoted Agents act first, automatically — same "pawns clear the way"
    // ordering, extended to the pieces that have already evolved.
    const agentIds = summons.filter(s=>s.side==='player'&&s.promoted&&s.health>0).map(s=>s.id);
    if(agentIds.length>0){
      runAgentsSequenceMulti(agentIds, 0, enemies, round, proceed);
    } else {
      proceed();
    }
  // runAgentsSequenceMulti is defined later in the file (const, TDZ) —
  // referenced only inside this handler's own body, invoked well after
  // render completes, so the forward reference is safe; can't list it here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[player,summons,enemies,round,addLog,beginSummonCommandPhase]);

  const handleEndTurnMulti = useCallback(()=>{
    const saved=player.actionpts;
    if(saved>0) addLog(`You end your turn — saving ${saved} Energy as rollover`);
    else addLog('You end your turn');
    const updatedPlayer={...player,actionpts:0,energyRollover:(player.energyRollover||0)+saved};
    setPlayer(updatedPlayer);
    setIsPlayerTurn(false);
    setEnemyRolledEnergyById({});
    addLog("=== Enemies' Turn ===");
    setTimeout(()=>runEnemiesSequence(0, enemies.map(e=>({...e,actionpts:0})), updatedPlayer, summons, round, obstacles), 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[player,enemies,summons,obstacles,round,addLog,runEnemiesSequence]);

  const handleSurrenderMulti = useCallback(()=>{
    addLog('=== You retreat from the Campaign. ===');
    onCampaignComplete?.(false); // quitting, not a real finale win
  },[addLog,onCampaignComplete]);

  // ── Melee ──
  const handleMeleeOpenMulti = useCallback(()=>{
    if(!canAttackMulti) return;
    const adjacentEnemies = enemies.filter(e=>isAdjacent(player.boardPosition,e.boardPosition));
    const target = adjacentEnemies.find(e=>e.id===selectedEnemyId) || adjacentEnemies[0];
    if(!target){
      // No enemy character in range — an enemy-deployed summon blocking the
      // way is a valid target too, so parking behind one doesn't grant it
      // immunity.
      const targetSummon = summons.find(s=>s.side==='enemy'&&isAdjacent(player.boardPosition,s.boardPosition));
      if(!targetSummon) return;
      const flank=getFlankBonus(player.boardPosition,targetSummon.boardPosition,targetSummon.facing);
      const perHitDamage=playerMeleeBase(player.level)+flank.bonus;
      setMeleeModalCtx({perHitDamage,maxMultiplier:player.actionpts,targetLabel:targetSummon.name,targetKind:'summon',targetId:targetSummon.id});
      return;
    }
    const flank=getFlankBonus(player.boardPosition,target.boardPosition,target.facing);
    const perHitDamage=playerMeleeBase(player.level)+flank.bonus;
    setMeleeModalCtx({perHitDamage,maxMultiplier:player.actionpts,targetLabel:target.name,targetKind:'enemy',targetId:target.id});
  },[canAttackMulti,player,enemies,summons,selectedEnemyId]);

  const resolveMeleeMulti = useCallback((mult)=>{
    const ctx=meleeModalCtx;
    setMeleeModalCtx(null);
    if(!ctx) return;
    if(ctx.targetKind==='summon'){
      const targetSummon = summons.find(s=>s.id===ctx.targetId);
      if(!targetSummon) return;
      const flank=getFlankBonus(player.boardPosition,targetSummon.boardPosition,targetSummon.facing);
      const perHit=playerMeleeBase(player.level)+flank.bonus;
      const dmg=perHit*mult;
      const newHP=Math.max(0,targetSummon.health-dmg);
      const meleeFacing=facingToward(player.boardPosition,targetSummon.boardPosition);
      addLog(`You melee ${targetSummon.name}${mult>1?` (${mult}x ${perHit})`:''} -> ${dmg} dmg${flank.label?' ['+flank.label+']':''}`);
      triggerCastFx(targetSummon.boardPosition,'#ffd700');
      const updatedPlayer={...player,actionpts:player.actionpts-mult,facing:meleeFacing};
      if(newHP<=0){
        setSummons(prev=>prev.filter(s=>s.id!==targetSummon.id));
        addLog(`${targetSummon.name} destroyed!`);
      } else {
        setSummons(prev=>prev.map(s=>s.id===targetSummon.id?{...s,health:newHP}:s));
      }
      routeAfterPlayerActionMulti(updatedPlayer, enemies);
      return;
    }
    const target = enemies.find(e=>e.id===ctx.targetId);
    if(!target) return;
    const flank=getFlankBonus(player.boardPosition,target.boardPosition,target.facing);
    const perHit=playerMeleeBase(player.level)+flank.bonus;
    const dmg=perHit*mult;
    const newHP=Math.max(0,target.health-dmg);
    const meleeFacing=facingToward(player.boardPosition,target.boardPosition);
    addLog(`You melee ${target.name}${mult>1?` (${mult}x ${perHit})`:''} -> ${dmg} dmg${flank.label?' ['+flank.label+']':''}`);
    triggerCastFx(target.boardPosition,'#ffd700');
    const updatedPlayer={...player,actionpts:player.actionpts-mult,facing:meleeFacing};
    if(newHP<=0){
      const remaining=enemies.map(e=>e.id===target.id?{...e,health:0}:e);
      setPlayer(updatedPlayer); setEnemies(remaining);
      handleEnemyDefeatedMulti(target.id, updatedPlayer, remaining);
      return;
    }
    routeAfterPlayerActionMulti(updatedPlayer, enemies.map(e=>e.id===target.id?{...e,health:newHP}:e));
  },[meleeModalCtx,player,enemies,summons,addLog,handleEnemyDefeatedMulti,routeAfterPlayerActionMulti,triggerCastFx]);

  // ── Elemental skill (generic + Fire/Earth/Air/Water apply) ──
  // All five share one shape: resolve `target` from selectedEnemyId (falling
  // back to the sole enemy in range), compute damage with the exact same
  // math as the single-enemy handlers, then route through the Multi helpers.
  // An enemy-deployed summon in range is exactly as legal a target as any
  // roster enemy -- parking behind one shouldn't make it immune -- so a
  // resolved `target` may be either; `target.side==='enemy'` (only summons
  // carry a `side` field) tells applySkillResultMulti which kind it got.
  const resolveTargetForSkill = useCallback((rangeCheckFn)=>{
    const inRange = enemies.filter(e=>rangeCheckFn(e));
    const picked = inRange.find(e=>e.id===selectedEnemyId) || inRange[0];
    if(picked) return picked;
    return summons.find(s=>s.side==='enemy' && rangeCheckFn(s)) || null;
  },[enemies,summons,selectedEnemyId]);

  const applySkillResultMulti = useCallback((target, dmg, updatedPlayer, extra={}, color)=>{
    if(!target || dmg<=0){
      routeAfterPlayerActionMulti(updatedPlayer, enemies);
      return;
    }
    if(color) triggerCastFx(target.boardPosition, color);
    if(target.side==='enemy'){ // an enemy-deployed summon, not a roster enemy
      const newHP=Math.max(0,target.health-dmg);
      if(newHP<=0){
        setSummons(prev=>prev.filter(s=>s.id!==target.id));
        addLog(`${target.name} destroyed!`);
      } else {
        setSummons(prev=>prev.map(s=>s.id===target.id?{...s,health:newHP,...extra}:s));
      }
      routeAfterPlayerActionMulti(updatedPlayer, enemies);
      return;
    }
    const newHP=Math.max(0,target.health-dmg);
    if(newHP<=0){
      const remaining=enemies.map(e=>e.id===target.id?{...e,health:0,...extra}:e);
      setPlayer(updatedPlayer); setEnemies(remaining);
      handleEnemyDefeatedMulti(target.id, updatedPlayer, remaining);
      return;
    }
    routeAfterPlayerActionMulti(updatedPlayer, enemies.map(e=>e.id===target.id?{...e,health:newHP,...extra}:e));
  },[enemies,addLog,handleEnemyDefeatedMulti,routeAfterPlayerActionMulti,triggerCastFx]);

  const handleModalAbilityMulti = useCallback((ability,accuracy)=>{
    if(dicePhase==='roll'){ setPendingAbility(ability); setDicePhase('accuracy'); setAccuracyRoll(null); return; }
    const acc=accuracy??accuracyRoll??100;
    const el=ELEMENTS[selCategory][selElement];
    const cost=el.COST??1;
    let dmg=0, heal=0;
    if(ability.heal){ heal=ability.heal; } else { dmg=applyAccuracy(ability.damage,acc); }
    const target = resolveTargetForSkill(e=>isAdjacent(player.boardPosition,e.boardPosition));
    const flank = target ? getFlankBonus(player.boardPosition,target.boardPosition,target.facing) : {bonus:0,label:''};
    if(dmg>0&&flank.bonus>0) dmg+=flank.bonus;
    let updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-cost),skillUsed:true};
    if(heal>0){ updatedPlayer.health=Math.min(updatedPlayer.maxHealth,updatedPlayer.health+heal); addLog(`${selElement} ${ability.name} — heal +${heal} HP`); }
    if(dmg>0 && target) addLog(`${selElement} ${ability.name} -> ${dmg} dmg${flank.label?' ['+flank.label+']':''} (${acc}% (${accuracyTierLabel(acc)}))`);
    resetDiceModal();
    applySkillResultMulti(target, dmg, updatedPlayer, {}, ELEMENTS[selCategory]?.[selElement]?.color);
  },[dicePhase,accuracyRoll,selCategory,selElement,player,addLog,resetDiceModal,resolveTargetForSkill,applySkillResultMulti]);

  const handleFireApplyWithAccuracyMulti = useCallback((acc)=>{
    const origin=lockedRoll.origin;
    const pulses=diceRolls[0].value, dmgEach=diceRolls[1].value;
    const base=pulses*dmgEach*SKILL_DICE_MULT;
    let dmg=applyAccuracy(base,acc);
    const target = resolveTargetForSkill(e=>isAdjacent(origin.boardPosition,e.boardPosition));
    const flank = target ? getFlankBonus(origin.boardPosition,target.boardPosition,target.facing) : {bonus:0,label:''};
    if(flank.bonus>0) dmg+=flank.bonus;
    const tileBoost=getTileBoost(tiles,origin.boardPosition,'Fire');
    if(tileBoost>0) dmg+=tileBoost;
    dmg=Math.round(dmg*(1+accBonus('Fire')))+dmgBonus('Fire');
    const updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-3),skillUsed:true};
    const appliesBurn=pulses>=3;
    if(appliesBurn && target) setTiles(prev=>{ const g=prev.map(r=>r.slice()); g[target.boardPosition.y][target.boardPosition.x]=TILE_TYPES.FIRE_BOOST; return g; });
    if(target) addLog(`Ember Strike [${pulses}x${dmgEach*SKILL_DICE_MULT}=${base}] ${acc}% (${accuracyTierLabel(acc)}) -> ${dmg} dmg${flank.label?' ['+flank.label+']':''}${tileBoost>0?' [Fire tile +20]':''}${appliesBurn?' [Burn, Scorch]':''}`);
    resetDiceModal();
    applySkillResultMulti(target, dmg, updatedPlayer, appliesBurn?{burn:{turns:BURN_TURNS,dmg:BURN_DMG}}:{}, ELEMENTS.base.Fire.color);
  },[diceRolls,lockedRoll,player,tiles,dmgBonus,accBonus,addLog,resetDiceModal,resolveTargetForSkill,applySkillResultMulti]);

  const handleEarthApplyWithAccuracyMulti = useCallback((acc)=>{
    const origin=lockedRoll.origin;
    const dieRoll=diceRolls[0].value;
    const base=dieRoll*EARTH_DICE_MULT;
    const strikeables=[...enemies, ...summons.filter(s=>s.side==='enemy')];
    const occupiedExtra=[...strikeables.map(e=>e.boardPosition), ...summons.filter(s=>s.side==='player').map(s=>s.boardPosition)];
    const {hitObstacle,hitTarget,newObstacleTiles}=resolveEarthTremor(origin, earthRange, strikeables, obstacles, occupiedExtra, tiles);
    const tileBoost=getTileBoost(tiles,origin.boardPosition,'Earth');
    const rawDmg=Math.round((Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(base,acc))+tileBoost)*(1+accBonus('Earth')))+dmgBonus('Earth');
    const dmg=hitTarget?rawDmg:0;
    const cost=1+earthRange;
    const updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-cost),skillUsed:true};
    const outcome=hitTarget?`${dmg} dmg${tileBoost>0?' [Earth tile +20]':''}`:hitObstacle?'reinforced rubble instead':'MISS (nothing in line)';
    addLog(`Tremor [d6=${dieRoll}, ${earthRange} tile${earthRange>1?'s':''}, ${acc}% (${accuracyTierLabel(acc)})] -> ${outcome}${newObstacleTiles.length>0?` (+${newObstacleTiles.length} rubble)`:''}`);
    if(newObstacleTiles.length>0) setObstacles(prev=>[...prev, ...newObstacleTiles.map(t=>makeObstacle(t))]);
    if(hitObstacle){
      setObstacles(prev=>{
        const hitOne=prev.find(o=>o.id===hitObstacle.id);
        const newHP=hitOne?Math.min(hitOne.maxHealth,hitOne.health+rawDmg):0;
        addLog(`Rubble reinforced +${rawDmg} (${newHP}/${hitOne?.maxHealth}).`);
        return prev.map(o=>o.id===hitObstacle.id?{...o,health:newHP}:o);
      });
    }
    resetDiceModal();
    applySkillResultMulti(hitTarget, dmg, updatedPlayer, {}, ELEMENTS.base.Earth.color);
  },[diceRolls,lockedRoll,player,tiles,obstacles,earthRange,enemies,summons,dmgBonus,accBonus,addLog,resetDiceModal,applySkillResultMulti]);

  const handleAirApplyWithAccuracyMulti = useCallback((acc)=>{
    const origin=lockedRoll.origin;
    const dieRoll=diceRolls[0].value;
    const strikeables=[...enemies, ...summons.filter(s=>s.side==='enemy')];
    const line=getForwardTiles(origin.boardPosition,origin.facing,SIZE);
    const step=line.findIndex(t=>strikeables.some(u=>u.boardPosition.x===t.x&&u.boardPosition.y===t.y));
    const dist=step>=0?step+1:-1;
    const lineObstacle=findLineObstacle(origin.boardPosition,origin.facing,dieRoll,obstacles);
    const blocked=lineObstacle && (dist<0||lineObstacle.dist<=dist);
    const hit=!blocked&&dist>0&&dist<=dieRoll;
    const target = hit ? strikeables.find(u=>u.boardPosition.x===line[step].x&&u.boardPosition.y===line[step].y) : null;
    const base=airGaleForceDamage(dieRoll);
    const tileBoost=getTileBoost(tiles,origin.boardPosition,'Air');
    const rawDmg=Math.round((Math.max(RANGED_SKILL_MIN_DMG,applyAccuracy(base,acc))+tileBoost)*(1+accBonus('Air')))+dmgBonus('Air');
    const dmg=target?rawDmg:0;
    const updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-2),skillUsed:true};
    let extra={};
    if(target){
      const knockDist=Math.max(1,dieRoll-dist);
      const blockers=[origin.boardPosition,...strikeables.filter(u=>u.id!==target.id).map(u=>u.boardPosition)];
      const kb=getKnockbackTile(target.boardPosition,origin.facing,knockDist,blockers,obstacles);
      extra.boardPosition={x:kb.x,y:kb.y};
      addLog(`Gale Force [d8=${dieRoll}, ${acc}% (${accuracyTierLabel(acc)})] -> ${dmg} dmg${tileBoost>0?' [Air tile +20]':''} + knockback ${knockDist} tile${knockDist>1?'s':''}${kb.hitObstacle?' [knocked into rubble]':''}`);
      if(kb.hitObstacle){
        const hitId=kb.hitObstacle.id;
        setObstacles(prev=>{
          const hitOne=prev.find(o=>o.id===hitId);
          const newHP=hitOne?Math.max(0,hitOne.health-rawDmg):0;
          addLog(newHP<=0?'Rubble destroyed!':`Rubble takes ${rawDmg} dmg (${newHP}/${hitOne.maxHealth}).`);
          return newHP<=0 ? prev.filter(o=>o.id!==hitId) : prev.map(o=>o.id===hitId?{...o,health:newHP}:o);
        });
      }
    } else if(blocked){
      setObstacles(prev=>{
        const hitOne=prev.find(o=>o.id===lineObstacle.obstacle.id);
        const newHP=hitOne?Math.max(0,hitOne.health-rawDmg):0;
        addLog(`Gale Force [d8=${dieRoll}, ${acc}% (${accuracyTierLabel(acc)})] -> struck rubble instead — ${newHP<=0?'destroyed!':`${rawDmg} dmg (${newHP}/${hitOne.maxHealth})`}`);
        return newHP<=0 ? prev.filter(o=>o.id!==lineObstacle.obstacle.id) : prev.map(o=>o.id===lineObstacle.obstacle.id?{...o,health:newHP}:o);
      });
    } else {
      addLog(`Gale Force [d8=${dieRoll}] -> MISS`);
    }
    resetDiceModal();
    applySkillResultMulti(target, dmg, updatedPlayer, extra, ELEMENTS.base.Air.color);
  },[diceRolls,lockedRoll,player,tiles,obstacles,enemies,summons,dmgBonus,accBonus,addLog,resetDiceModal,applySkillResultMulti]);

  // ── Compass Slash / Dark Web targeting resolution ──
  const deployTilesMulti = getDeployTiles(tiles, player.boardPosition, enemies.map(e=>e.boardPosition), [...summons, ...obstacles]);
  const canDeployMulti = canCircuitSigil && summons.filter(s=>s.side==='player'&&!s.promoted).length < BANDWIDTH && deployTilesMulti.length > 0;
  const deployBlockedReasonMulti = summons.filter(s=>s.side==='player'&&!s.promoted).length>=BANDWIDTH ? `bandwidth full (${BANDWIDTH}/${BANDWIDTH})`
                            : deployTilesMulti.length===0 ? 'no legal tiles on row 7'
                            : player.actionpts<2 ? 'need 2 Energy'
                            : '';

  const resolveCompassSlashMulti = useCallback((targetTile)=>{
    if(!isAdjacent8(player.boardPosition,targetTile)){ addLog('// Target not in the 8 surrounding tiles'); return; }
    const target = [...enemies, ...summons.filter(s=>s.side==='enemy')].find(u=>u.boardPosition.x===targetTile.x&&u.boardPosition.y===targetTile.y);
    setCompassTargeting(false);
    if(!target){
      addLog('// Compass Slash strikes empty tile — 2 Energy spent');
      routeAfterPlayerActionMulti(markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-2)},'compassSlash'), enemies);
      return;
    }
    const dmg=Math.round(60*(1+accBonus('compassSlash')))+dmgBonus('compassSlash');
    const slashFacing=facingToward(player.boardPosition,targetTile);
    addLog(`Compass Slash -> ${dmg} dmg`);
    const updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-2),facing:slashFacing},'compassSlash');
    applySkillResultMulti(target, dmg, updatedPlayer, {}, '#9b6cff');
  },[player,enemies,summons,dmgBonus,accBonus,addLog,applySkillResultMulti,routeAfterPlayerActionMulti]);

  // Shared tail for a multi-hit skill (Pulse Wave, Piercing Light, Dark
  // Web's leap, Longshot Protocol) once damage has already been applied to
  // every hit enemy in `damaged`: routes a no-kill result normally, a single
  // kill through the real defeat pipeline (XP/Hexas/battle-clear), and any
  // *additional* simultaneous kills by granting their XP/Hexas directly and
  // folding them out of the roster before that one pipeline call, so nothing
  // double-counts and the "battle cleared" check still sees the true final
  // roster. Defined ahead of its callers below — its own deps array is read
  // eagerly every render, so a forward reference here would be a genuine
  // temporal-dead-zone crash, not just a lazy-closure non-issue.
  const resolveMultiHitKills = useCallback((hitIds, damaged, updatedPlayer, skillLabel)=>{
    const firstKillId = damaged.find(e=>hitIds.has(e.id)&&e.health<=0)?.id;
    if(!firstKillId){ routeAfterPlayerActionMulti(updatedPlayer, damaged); return; }
    const otherDeadIds = damaged.filter(e=>hitIds.has(e.id)&&e.id!==firstKillId&&e.health<=0).map(e=>e.id);
    const rosterForDefeat = otherDeadIds.length===0 ? damaged : damaged.filter(e=>!otherDeadIds.includes(e.id));
    if(otherDeadIds.length>0){
      const extraXp=(150+campaignBattle*150)*otherDeadIds.length;
      const extraHex=(40+campaignBattle*30)*otherDeadIds.length;
      addLog(`+${extraXp} XP, +${extraHex} Hexas from ${otherDeadIds.length} more ${skillLabel} kill${otherDeadIds.length>1?'s':''}`);
      setHexas(h=>h+extraHex);
      handleEnemyDefeatedMulti(firstKillId, {...updatedPlayer, playerXp:(updatedPlayer.playerXp||0)+extraXp}, rosterForDefeat);
    } else {
      handleEnemyDefeatedMulti(firstKillId, updatedPlayer, rosterForDefeat);
    }
  },[campaignBattle,addLog,handleEnemyDefeatedMulti,routeAfterPlayerActionMulti]);

  const resolveDarkWebMulti = useCallback((targetTile)=>{
    if(!isKnightMove(player.boardPosition,targetTile)){ addLog('// Target not a knight-move tile'); return; }
    const target = [...enemies, ...summons.filter(s=>s.side==='enemy')].find(u=>u.boardPosition.x===targetTile.x&&u.boardPosition.y===targetTile.y);
    setDarkWebTargeting(false);
    if(!target){
      // No target on the tile — Dark Web now doubles as a repositioning
      // tool (leap to any knight-move tile), not just a wasted swing. Still
      // blocked if a summon already occupies the landing tile.
      const occupied = [...summons, ...obstacles].some(s=>s.boardPosition.x===targetTile.x&&s.boardPosition.y===targetTile.y);
      const leapFacing=facingFromMove(player.boardPosition,targetTile);
      const healedHP = occupied ? player.health : applyHealingIfLanded(targetTile,player.health,player.maxHealth);
      const updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-2),health:healedHP,
        ...(occupied?{}:{boardPosition:targetTile,facing:leapFacing})},'darkWeb');
      addLog(occupied ? '// Dark Web strikes an occupied tile — 2 Energy spent, no leap'
        : `Dark Web leaps to (${targetTile.x},${targetTile.y}) — 2 Energy spent`);
      // Dark Web's leap is a genuine reposition, same as a normal move — so
      // it can also land the player on a Longshot Protocol diagonal.
      if(!occupied && loadout.includes('longshotProtocol')){
        const blockers=[...summons.map(s=>s.boardPosition), ...enemies.map(e=>e.boardPosition)];
        const hits=checkLongshotProtocol(updatedPlayer.boardPosition, enemies, blockers);
        if(hits.length>0){
          const snipeDmg=Math.round(LONGSHOT_DMG*(1+accBonus('longshotProtocol')))+dmgBonus('longshotProtocol');
          hits.forEach(hit=>{
            addLog(`◎ Longshot Protocol -> ${hit.name} takes ${snipeDmg} dmg`);
            triggerCastFx(hit.boardPosition,'#88e0c0');
          });
          const hitIds=new Set(hits.map(h=>h.id));
          const damaged=enemies.map(e=>hitIds.has(e.id)?{...e,health:Math.max(0,e.health-snipeDmg)}:e);
          resolveMultiHitKills(hitIds, damaged, updatedPlayer, 'Longshot Protocol');
          return;
        }
      }
      routeAfterPlayerActionMulti(updatedPlayer, enemies);
      return;
    }
    const acc=rollD100Accuracy();
    const dmg=Math.round(applyAccuracy(70,acc)*(1+accBonus('darkWeb')))+dmgBonus('darkWeb');
    const strikeFacing=facingToward(player.boardPosition,targetTile);
    const newHP=Math.max(0,target.health-dmg);
    let updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-2),facing:strikeFacing},'darkWeb');
    if(newHP<=0){
      const healedHP = applyHealingIfLanded(targetTile,player.health,player.maxHealth);
      updatedPlayer={...updatedPlayer,boardPosition:targetTile,health:healedHP};
    }
    addLog(`Dark Web -> ${dmg} dmg (${acc}% ${accuracyTierLabel(acc)})${newHP<=0?' — finishing blow, claims tile':''}`);
    applySkillResultMulti(target, dmg, updatedPlayer, {}, '#a0a0a0');
  },[player,enemies,summons,obstacles,loadout,dmgBonus,accBonus,addLog,applySkillResultMulti,routeAfterPlayerActionMulti,resolveMultiHitKills,triggerCastFx,applyHealingIfLanded]);

  // Applies flat `dmg` to every enemy-side summon in `hitSummons` (the
  // summon half of a multi-hit AoE skill's damage — see resolveMultiHitKills
  // for the enemy-roster half), removing any that die. No XP/Hexas for a
  // summon kill, same as melee's summon branch.
  const applyAoeDamageToSummons = useCallback((hitSummons, dmg)=>{
    if(hitSummons.length===0) return;
    const hitIds = new Set(hitSummons.map(s=>s.id));
    setSummons(prev=>prev.reduce((acc,s)=>{
      if(!hitIds.has(s.id)){ acc.push(s); return acc; }
      const newHP=Math.max(0,s.health-dmg);
      if(newHP<=0) addLog(`${s.name} destroyed!`);
      else acc.push({...s,health:newHP});
      return acc;
    },[]));
  },[addLog]);

  // ── WATER TORRENT — Campaign ── (moved below resolveMultiHitKills /
  // applyAoeDamageToSummons since it depends on both -- referencing a
  // useCallback's own dependency array before that const is declared throws
  // a TDZ error even though the callback body itself wouldn't run until later)
  const handleWaterApplyWithAccuracyMulti = useCallback((acc)=>{
    const origin=lockedRoll.origin;
    const dieRoll=diceRolls[0].value;
    const res=resolveTorrent(dieRoll);
    const anchor=getTorrentAnchor(origin.boardPosition,origin.facing);
    const footprint=getTorrentFootprint(anchor,waterAoe);
    const tileBoost=getTileBoost(tiles,origin.boardPosition,'Water');
    const dmg=Math.round((applyAccuracy(res.damage,acc)+tileBoost)*(1+accBonus('Water')))+dmgBonus('Water');
    const cost=TORRENT_AOE_COST[waterAoe];
    const updatedPlayer={...player,actionpts:Math.max(0,player.actionpts-cost),skillUsed:true};
    const flooded=dieRoll>=10;
    if(flooded) setTiles(prev=>{ if(prev[anchor.y][anchor.x]===TILE_TYPES.WATER_BOOST) return prev; const g=prev.map(r=>r.slice()); g[anchor.y][anchor.x]=TILE_TYPES.WATER_BOOST; return g; });
    // Every enemy AND enemy summon standing anywhere in the footprint takes
    // the hit, not just the first one found -- a cross or 3x3 spread that
    // catches multiple units is supposed to hit all of them (see
    // resolvePulseWaveMulti/resolvePiercingLightMulti for the same pattern).
    const hitIds = new Set(enemies.filter(e=>footprint.some(t=>t.x===e.boardPosition.x&&t.y===e.boardPosition.y)).map(e=>e.id));
    const hitSummons = summons.filter(s=>s.side==='enemy' && footprint.some(t=>t.x===s.boardPosition.x&&t.y===s.boardPosition.y));
    const totalHits=hitIds.size+hitSummons.length;
    addLog(`Torrent [d20=${dieRoll}, ${res.damage} dmg, ${AOE_LABEL[waterAoe]}, ${acc}% (${accuracyTierLabel(acc)})] -> ${totalHits>0?`${dmg} dmg to ${totalHits} target${totalHits>1?'s':''}`+(tileBoost>0?' [Water tile +20]':''):'MISS (no enemy in blast)'}${flooded?' [Flood]':''}`);
    resetDiceModal();
    if(totalHits===0){ routeAfterPlayerActionMulti(updatedPlayer, enemies); return; }
    enemies.forEach(e=>{ if(hitIds.has(e.id)) triggerCastFx(e.boardPosition, ELEMENTS.base.Water.color); });
    hitSummons.forEach(s=>triggerCastFx(s.boardPosition, ELEMENTS.base.Water.color));
    applyAoeDamageToSummons(hitSummons, dmg);
    if(hitIds.size===0){ routeAfterPlayerActionMulti(updatedPlayer, enemies); return; }
    const damaged = enemies.map(e=>hitIds.has(e.id)?{...e,health:Math.max(0,e.health-dmg)}:e);
    resolveMultiHitKills(hitIds, damaged, updatedPlayer, 'Torrent');
  },[diceRolls,lockedRoll,player,tiles,waterAoe,enemies,summons,dmgBonus,accBonus,addLog,resetDiceModal,routeAfterPlayerActionMulti,applyAoeDamageToSummons,resolveMultiHitKills,triggerCastFx]);

  // ── PULSE WAVE (Tactical Skill) — Campaign ──
  const resolvePulseWaveMulti = useCallback((targetTile)=>{
    const dir = findAxisDirection(player.boardPosition, targetTile);
    const dist = dir ? Math.max(Math.abs(targetTile.x-player.boardPosition.x),Math.abs(targetTile.y-player.boardPosition.y)) : 0;
    setPulseWaveTargeting(false);
    if(!dir || dist>3){ addLog('// Target not on a straight or diagonal line within 3 tiles'); return; }
    const strike = computePulseWaveDamage({element:selElement,elementCategory:selCategory});
    if(!strike){ addLog('// No element equipped'); return; }
    strike.dmg = Math.round(strike.dmg*(1+accBonus('pulseWave'))) + dmgBonus('pulseWave');
    const line = getAxisLine(player.boardPosition, dir, 3);
    const hitIds = new Set(enemies.filter(e=>line.some(t=>t.x===e.boardPosition.x&&t.y===e.boardPosition.y)).map(e=>e.id));
    const hitSummons = summons.filter(s=>s.side==='enemy' && line.some(t=>t.x===s.boardPosition.x&&t.y===s.boardPosition.y));
    const newFacing=facingToward(player.boardPosition,targetTile);
    const updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-3),facing:newFacing},'pulseWave');
    if(hitIds.size===0 && hitSummons.length===0){
      addLog(`Pulse Wave [${strike.rollsLabel}, ${strike.acc}% (${accuracyTierLabel(strike.acc)})] -> no targets on the line`);
      routeAfterPlayerActionMulti(updatedPlayer, enemies);
      return;
    }
    const totalHits=hitIds.size+hitSummons.length;
    addLog(`Pulse Wave [${strike.rollsLabel}, ${strike.acc}% (${accuracyTierLabel(strike.acc)})] -> ${strike.dmg} dmg to ${totalHits} target${totalHits>1?'s':''}`);
    const color=ELEMENTS[selCategory]?.[selElement]?.color||'#c9a7f7';
    enemies.forEach(e=>{ if(hitIds.has(e.id)) triggerCastFx(e.boardPosition, color); });
    hitSummons.forEach(s=>triggerCastFx(s.boardPosition, color));
    applyAoeDamageToSummons(hitSummons, strike.dmg);
    if(hitIds.size===0){ routeAfterPlayerActionMulti(updatedPlayer, enemies); return; }
    const damaged = enemies.map(e=>hitIds.has(e.id)?{...e,health:Math.max(0,e.health-strike.dmg)}:e);
    resolveMultiHitKills(hitIds, damaged, updatedPlayer, 'Pulse Wave');
  },[player,enemies,summons,selCategory,selElement,dmgBonus,accBonus,addLog,resolveMultiHitKills,applyAoeDamageToSummons,routeAfterPlayerActionMulti,triggerCastFx]);

  // ── PIERCING LIGHT (Tactical Skill) — Campaign ──
  const resolvePiercingLightMulti = useCallback((energySpent)=>{
    setPiercingLightCtx(null);
    const dmg = Math.round(piercingLightDamage(energySpent)*(1+accBonus('piercingLight'))) + dmgBonus('piercingLight');
    const line = getForwardTiles(player.boardPosition, player.facing, 2);
    const hitIds = new Set(enemies.filter(e=>line.some(t=>t.x===e.boardPosition.x&&t.y===e.boardPosition.y)).map(e=>e.id));
    const hitSummons = summons.filter(s=>s.side==='enemy' && line.some(t=>t.x===s.boardPosition.x&&t.y===s.boardPosition.y));
    const updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-energySpent)},'piercingLight');
    if(hitIds.size===0 && hitSummons.length===0){
      addLog(`Piercing Light thrust -> no targets in the 2 tiles ahead — ${energySpent} Energy spent`);
      routeAfterPlayerActionMulti(updatedPlayer, enemies);
      return;
    }
    const totalHits=hitIds.size+hitSummons.length;
    addLog(`Piercing Light -> ${dmg} dmg to ${totalHits} target${totalHits>1?'s':''}`);
    enemies.forEach(e=>{ if(hitIds.has(e.id)) triggerCastFx(e.boardPosition,'#ffdd77'); });
    hitSummons.forEach(s=>triggerCastFx(s.boardPosition,'#ffdd77'));
    applyAoeDamageToSummons(hitSummons, dmg);
    if(hitIds.size===0){ routeAfterPlayerActionMulti(updatedPlayer, enemies); return; }
    const damaged = enemies.map(e=>hitIds.has(e.id)?{...e,health:Math.max(0,e.health-dmg)}:e);
    resolveMultiHitKills(hitIds, damaged, updatedPlayer, 'Piercing Light');
  },[player,enemies,summons,dmgBonus,accBonus,addLog,resolveMultiHitKills,applyAoeDamageToSummons,routeAfterPlayerActionMulti,triggerCastFx]);

  // ── CUSTOM SYNTHESIS (Core Skill) — Campaign ──
  // Same fixed-footprint, no-targeting-click resolution as the single-enemy
  // version, but every enemy (and enemy summon) anywhere in the footprint
  // takes the hit, same "everyone in the blast" pattern as Torrent/Pulse
  // Wave/Piercing Light above. Special Effects (Burn/Knockback) only touch
  // the hit enemies, not summons -- Flood/Rubble are tile-based so they're
  // unaffected by that distinction.
  const handleCustomSkillMulti = useCallback(()=>{
    if(!canCustomSkill || !customSkillDef) return;
    const def = customSkillDef;
    const {tiles:footprint, moveTo} = customSkillFootprint(def, player.boardPosition, player.facing);
    const hitIds = new Set(enemies.filter(e=>footprint.some(t=>t.x===e.boardPosition.x&&t.y===e.boardPosition.y)).map(e=>e.id));
    const hitSummons = summons.filter(s=>s.side==='enemy' && footprint.some(t=>t.x===s.boardPosition.x&&t.y===s.boardPosition.y));
    const meta = customSkillEntry(def);
    const hasTargets = hitIds.size>0 || hitSummons.length>0;

    let newFacing = player.facing;
    let newPos = player.boardPosition;
    let newHealth = player.health;
    if(!hasTargets && moveTo){
      const blocked = [...summons, ...obstacles].some(s=>s.boardPosition.x===moveTo.x&&s.boardPosition.y===moveTo.y);
      if(!blocked){
        newFacing = facingFromMove(player.boardPosition, moveTo);
        newPos = moveTo;
        newHealth = applyHealingIfLanded(moveTo, player.health, player.maxHealth);
      }
    } else if(hasTargets && (def.archetype==='range'||def.archetype==='warp') && hitIds.size>0){
      const firstHit = enemies.find(e=>hitIds.has(e.id));
      newFacing = facingToward(player.boardPosition, firstHit.boardPosition);
    }

    const updatedPlayer = markSkillUsed({...player, actionpts:Math.max(0,player.actionpts-customSkillCost),
      facing:newFacing, boardPosition:newPos, health:newHealth}, 'customSkill');

    if(!hasTargets){
      addLog(`${def.name} -> no target hit (${customSkillCost} Energy spent)`);
      routeAfterPlayerActionMulti(updatedPlayer, enemies);
      return;
    }

    const dmg = Math.round((def.damage||0)*(1+accBonus('customSkill'))) + dmgBonus('customSkill');
    const totalHits = hitIds.size+hitSummons.length;
    const {roll,triggered} = resolveCustomSkillEffects(def);
    addLog(`${def.name} -> ${dmg} dmg${roll!==null?` [rolled ${roll}]`:''} to ${totalHits} target${totalHits>1?'s':''}`);
    enemies.forEach(e=>{ if(hitIds.has(e.id)) triggerCastFx(e.boardPosition, meta.color); });
    hitSummons.forEach(s=>triggerCastFx(s.boardPosition, meta.color));
    applyAoeDamageToSummons(hitSummons, dmg);

    if(triggered.some(e=>e.type==='flood') && footprint.length>0){
      setTiles(prev=>{ const g=prev.map(r=>r.slice()); footprint.forEach(t=>{ g[t.y][t.x]=TILE_TYPES.WATER_BOOST; }); return g; });
    }
    // Rubble and Knockback's own obstacle-collision damage both touch
    // `obstacles` -- folded into one workingObstacles chain (rather than two
    // separate setObstacles calls) so a cast with both effects can't have the
    // second call's plain array overwrite the first's queued update.
    let workingObstacles = obstacles;
    if(triggered.some(e=>e.type==='rubble') && !obstacles.some(o=>o.boardPosition.x===player.boardPosition.x&&o.boardPosition.y===player.boardPosition.y)){
      workingObstacles = [...workingObstacles, makeObstacle(player.boardPosition)];
    }
    if(hitIds.size===0){
      if(workingObstacles!==obstacles) setObstacles(workingObstacles);
      routeAfterPlayerActionMulti(updatedPlayer, enemies);
      return;
    }

    const kbMagnitude = triggered.filter(e=>e.type==='knockback').reduce((s,e)=>s+e.magnitude,0);
    const appliesBurn = triggered.some(e=>e.type==='burn');
    let scorchedTiles = [];
    const damaged = enemies.map(e=>{
      if(!hitIds.has(e.id)) return e;
      const newHP = Math.max(0,e.health-dmg);
      let updated = {...e,health:newHP};
      if(newHP>0){
        if(kbMagnitude>0){
          // Pushed away from the caster toward each individual target, not
          // the shared cast-facing -- an AoE footprint can hit tiles on more
          // than one side of the caster at once.
          const kbFacing = facingToward(player.boardPosition, e.boardPosition);
          const otherBlockers = [updatedPlayer.boardPosition, ...summons.map(s=>s.boardPosition), ...enemies.filter(o=>o.id!==e.id).map(o=>o.boardPosition)];
          const kb = getKnockbackTile(updated.boardPosition, kbFacing, kbMagnitude, otherBlockers, workingObstacles);
          updated = {...updated, boardPosition:{x:kb.x,y:kb.y}};
          if(kb.hitObstacle){
            workingObstacles = workingObstacles.map(o=>o.id===kb.hitObstacle.id?{...o,health:Math.max(0,o.health-dmg)}:o).filter(o=>o.health>0);
          }
        }
        if(appliesBurn){ updated = applyBurn(updated); scorchedTiles.push(updated.boardPosition); }
      }
      return updated;
    });
    if(workingObstacles!==obstacles) setObstacles(workingObstacles);
    if(scorchedTiles.length>0) setTiles(prev=>{ const g=prev.map(r=>r.slice()); scorchedTiles.forEach(t=>{ g[t.y][t.x]=TILE_TYPES.FIRE_BOOST; }); return g; });
    resolveMultiHitKills(hitIds, damaged, updatedPlayer, def.name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[canCustomSkill,customSkillDef,customSkillCost,player,enemies,summons,obstacles,dmgBonus,accBonus,addLog,resolveMultiHitKills,applyAoeDamageToSummons,routeAfterPlayerActionMulti,triggerCastFx,applyHealingIfLanded]);

  const resolveDeployPlacementMulti = useCallback((tile)=>{
    const legal=deployTilesMulti.some(t=>t.x===tile.x&&t.y===tile.y);
    if(!legal){ addLog('// Illegal deploy tile'); return; }
    const s=makeSummon(deployTier,{x:tile.x,y:tile.y},'player',null);
    setSummons(prev=>[...prev,s]);
    const updatedPlayer=markSkillUsed({...player,actionpts:Math.max(0,player.actionpts-2)},'circuitSigil');
    addLog(`◈ ${s.name} deployed at (${tile.x},${tile.y}).`);
    setShowDeploy(false); setAwaitingPlacement(false); setDeployRoll(null); setDeployTier(null);
    routeAfterPlayerActionMulti(updatedPlayer, enemies);
  },[deployTilesMulti,deployTier,player,enemies,addLog,routeAfterPlayerActionMulti]);

  // ── Player's own summons (side:'player') attacking one of several enemies ──
  const summonActionAtMulti = useCallback((s, tile, curEnemies, curSummons)=>{
    const target = curEnemies.find(e=>e.health>0 && e.boardPosition.x===tile.x && e.boardPosition.y===tile.y);
    if(target){
      return summonAttackTiles(s).some(t=>t.x===tile.x&&t.y===tile.y) ? 'attack' : null;
    }
    const ahead=summonForwardTile(s);
    if(!ahead||ahead.x!==tile.x||ahead.y!==tile.y) return null;
    if(player.boardPosition.x===tile.x&&player.boardPosition.y===tile.y) return null;
    if(curSummons.some(o=>o.id!==s.id&&o.boardPosition.x===tile.x&&o.boardPosition.y===tile.y)) return null;
    return 'move';
  },[player]);

  // ── PROMOTED AGENTS (autonomous, player-side, multi-enemy) ──
  // Same shape as the single-enemy runAgentTurn, but picks its own target
  // from the live roster (nearest by tile distance) each step instead of
  // having exactly one enemy to aim at.
  const runAgentTurnMulti = useCallback((agent, currentEnemies, currentRound, onDone)=>{
    const needsRoll = agent.actionpts===0;
    if(needsRoll){
      const eRoll=rollD12Energy();
      const rollover=agent.energyRollover||0;
      const newAP=Math.max(0,eRoll+rollover-(agent.frozen||0));
      addLog(`// ${agent.name} rolls d12=${eRoll}${rollover>0?` +${rollover} rollover`:''} -> ${newAP} AP`);
      const rolled={...agent,actionpts:newAP,frozen:0,energyRollover:0};
      setSummons(prev=>prev.map(s=>s.id===rolled.id?rolled:s));
      if(newAP<=0){ onDone(rolled, currentEnemies); return; }
      setTimeout(()=>runAgentTurnMulti(rolled, currentEnemies, currentRound, onDone), 500);
      return;
    }
    const living = currentEnemies.filter(e=>e.health>0);
    if(living.length===0){ onDone(agent, currentEnemies); return; }
    setTimeout(()=>{
      const target = living.reduce((best,e)=>manhattan(agent.boardPosition,e.boardPosition)<manhattan(agent.boardPosition,best.boardPosition)?e:best, living[0]);
      const blockers=[player.boardPosition, ...summons.filter(s=>s.id!==agent.id).map(s=>s.boardPosition),
        ...currentEnemies.filter(e=>e.id!==target.id).map(e=>e.boardPosition)];
      const step = computeAgentStep(agent, target, blockers);
      if(step.kind==='hold'){
        const saved=agent.actionpts;
        const updatedAgent={...agent,actionpts:0,energyRollover:(agent.energyRollover||0)+saved};
        addLog(`${agent.name} holds position`);
        setSummons(prev=>prev.map(s=>s.id===updatedAgent.id?updatedAgent:s));
        onDone(updatedAgent, currentEnemies);
        return;
      }
      if(step.kind==='move'){
        const updatedAgent={...agent,boardPosition:step.to,actionpts:agent.actionpts-step.cost};
        addLog(step.log);
        setSummons(prev=>prev.map(s=>s.id===updatedAgent.id?updatedAgent:s));
        setTimeout(()=>{
          if(updatedAgent.actionpts>0) runAgentTurnMulti(updatedAgent, currentEnemies, currentRound, onDone);
          else onDone(updatedAgent, currentEnemies);
        },500);
        return;
      }
      const updatedAgent={...agent,actionpts:agent.actionpts-step.cost,classSkillUsed:step.kind==='melee'?agent.classSkillUsed:true};
      addLog(step.log);
      if(step.color) triggerCastFx(target.boardPosition, step.color);
      const newHP=Math.max(0,target.health-step.dmg);
      setSummons(prev=>prev.map(s=>s.id===updatedAgent.id?updatedAgent:s));
      if(newHP<=0){
        const remaining=currentEnemies.filter(e=>e.id!==target.id);
        setEnemies(remaining);
        addLog(`=== ${target.name} defeated by ${agent.name}! ===`);
        setTimeout(()=>handleEnemyDefeatedMulti(target.id, player, currentEnemies),400);
        setTimeout(()=>{
          if(updatedAgent.actionpts>0) runAgentTurnMulti(updatedAgent, remaining, currentRound, onDone);
          else onDone(updatedAgent, remaining);
        },500);
        return;
      }
      const updatedEnemies=currentEnemies.map(e=>e.id===target.id?{...e,health:newHP}:e);
      setEnemies(updatedEnemies);
      setTimeout(()=>{
        if(updatedAgent.actionpts>0) runAgentTurnMulti(updatedAgent, updatedEnemies, currentRound, onDone);
        else onDone(updatedAgent, updatedEnemies);
      },500);
    },600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[addLog,player,summons,triggerCastFx]);

  const runAgentsSequenceMulti = useCallback((agentIds, idx, currentEnemies, currentRound, onDone)=>{
    if(idx>=agentIds.length){ onDone(currentEnemies); return; }
    setSummons(curSummons=>{
      const agent = curSummons.find(s=>s.id===agentIds[idx]);
      if(!agent || agent.health<=0){
        runAgentsSequenceMulti(agentIds, idx+1, currentEnemies, currentRound, onDone);
      } else {
        runAgentTurnMulti(agent, currentEnemies, currentRound, (updatedAgent, updatedEnemies)=>{
          runAgentsSequenceMulti(agentIds, idx+1, updatedEnemies, currentRound, onDone);
        });
      }
      return curSummons;
    });
  },[runAgentTurnMulti]);

  const resolveSummonActionMulti = useCallback((summonId, tile)=>{
    const s=summons.find(z=>z.id===summonId);
    if(!s) return;
    if(player.actionpts<=0){ addLog('// Pool empty — cannot act'); return; }
    const kind=summonActionAtMulti(s,tile,enemies,summons);
    if(!kind) return;
    const updatedPlayer={...player,actionpts:player.actionpts-1};
    setPlayer(updatedPlayer);
    if(kind==='attack'){
      const target=enemies.find(e=>e.boardPosition.x===tile.x&&e.boardPosition.y===tile.y);
      const dmg=s.atk;
      const newHP=Math.max(0,target.health-dmg);
      addLog(`${s.name} strikes ${target.name} -> ${dmg} dmg (${newHP}/${target.maxHealth})`);
      triggerCastFx(target.boardPosition,'#66dd88');
      if(newHP<=0){
        const remaining=enemies.filter(e=>e.id!==target.id);
        setEnemies(remaining);
        setTimeout(()=>handleEnemyDefeatedMulti(target.id,updatedPlayer,enemies),400);
      } else {
        setEnemies(enemies.map(e=>e.id===target.id?{...e,health:newHP}:e));
      }
    } else if(tile.y===ENEMY_BACK_ROW){
      // Stays on the board, marked promoted — reads as an evolved Agent
      // instead of vanishing from play, and becomes an autonomous unit:
      // no more manual commanding, it rolls and acts for itself each round
      // (see runAgentTurn/runAgentTurnMulti), fighting under one of the
      // currently-implemented classes.
      const agentClass = ENEMY_CLASS_POOL[Math.floor(Math.random()*ENEMY_CLASS_POOL.length)];
      setSummons(prev=>prev.map(z=>z.id===summonId?{...z,boardPosition:tile,promoted:true,agentClass,
        actionpts:0,energyRollover:0,frozen:0,classSkillUsed:false}:z));
      addLog(`★ ${s.name} reaches the back row → promotes to Agent (autonomous staged)`);
    } else {
      setSummons(prev=>prev.map(z=>z.id===summonId?{...z,boardPosition:tile}:z));
      addLog(`${s.name} advances → (${tile.x},${tile.y})`);
    }
    setActedSummonIds(prev=>[...prev,summonId]);
    setSelectedSummonId(null);
    setValidSquares([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[summons,player,enemies,addLog,summonActionAtMulti,triggerCastFx]);

  // ── GRID CLICK ROUTER ──
  const handleSquareClick = useCallback((x,y)=>{
    // Deploy placement mode
    if(showDeploy && awaitingPlacement){ (isCampaign?resolveDeployPlacementMulti:resolveDeployPlacement)({x,y}); return; }
    // Compass Slash targeting mode
    if(compassTargeting){ (isCampaign?resolveCompassSlashMulti:resolveCompassSlash)({x,y}); return; }
    // Dark Web targeting mode
    if(darkWebTargeting){ (isCampaign?resolveDarkWebMulti:resolveDarkWeb)({x,y}); return; }
    // Pulse Wave targeting mode
    if(pulseWaveTargeting){ (isCampaign?resolvePulseWaveMulti:resolvePulseWave)({x,y}); return; }
    // Summon command sub-phase — only the player's own summons are
    // selectable here; any enemy-deployed summons on the board (Campaign)
    // are commanded automatically by their owner's own AI turn.
    if(summonPhaseActive && energyPhase==='summon'){
      const ownSummons = summons.filter(s=>s.side==='player'&&!s.promoted);
      const clickedSummon=ownSummons.find(s=>s.boardPosition.x===x&&s.boardPosition.y===y);
      if(clickedSummon){
        if(actedSummonIds.includes(clickedSummon.id)){ addLog('// That summon already acted'); return; }
        setSelectedSummonId(clickedSummon.id);
        // Highlight every tile summonActionAt(Multi) would actually accept a
        // click on right now — the single forward move tile plus whichever
        // of the 3 forward attack tiles currently hold a live enemy. Single
        // source of truth shared with the click-resolution below, so the
        // highlight can never drift out of sync with what's actually legal.
        const candidates=[summonForwardTile(clickedSummon), ...summonAttackTiles(clickedSummon)]
          .filter(Boolean)
          .filter((t,i,arr)=>arr.findIndex(u=>u.x===t.x&&u.y===t.y)===i);
        const legal=candidates.filter(t=>(isCampaign
          ? summonActionAtMulti(clickedSummon,t,enemies,summons)
          : summonActionAt(clickedSummon,t,enemy,summons)));
        setValidSquares(legal.map(t=>({...t,distance:1})));
        return;
      }
      if(selectedSummonId){
        const s=ownSummons.find(z=>z.id===selectedSummonId);
        const kind = s && (isCampaign
          ? summonActionAtMulti(s,{x,y},enemies,summons)
          : summonActionAt(s,{x,y},enemy,summons));
        if(kind){ (isCampaign?resolveSummonActionMulti:resolveSummonAction)(selectedSummonId,{x,y}); return; }
        addLog('// Click the highlighted tile — forward to move, an enemy ahead to attack');
      }
      return;
    }
    // Normal movement (act phase)
    if(!isPlayerTurn||energyPhase!=='act') return;
    const clickedSelf=player.boardPosition.x===x&&player.boardPosition.y===y;
    if(clickedSelf){ setPlayerSel(s=>!s); return; }
    // Campaign: clicking a live enemy tile selects it as the current target
    // for Melee/elemental skills (disambiguates when several are in range)
    // rather than being interpreted as a movement destination.
    if(isCampaign){
      const clickedEnemy = enemies.find(e=>e.boardPosition.x===x&&e.boardPosition.y===y);
      if(clickedEnemy){ setSelectedEnemyId(clickedEnemy.id); return; }
    }
    if(!playerSel) return;
    const target=validSquares.find(s=>s.x===x&&s.y===y);
    if(!target) return;
    if(player.actionpts<target.distance){ addLog(`Not enough Energy (need ${target.distance})`); return; }
    const occupiedByEnemy=isCampaign ? enemies.some(e=>e.boardPosition.x===x&&e.boardPosition.y===y) : (enemy.boardPosition.x===x&&enemy.boardPosition.y===y);
    const occupiedBySummon=[...summons, ...obstacles].some(s=>s.boardPosition.x===x&&s.boardPosition.y===y);
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
    // Longshot Protocol — a repositioning move only (not melee, not another
    // skill's own tile-claim), so it hooks in right here rather than at
    // every action that happens to change boardPosition.
    if(loadout.includes('longshotProtocol')){
      const targets = isCampaign ? enemies : [enemy];
      const blockers = [...summons.map(s=>s.boardPosition), ...(isCampaign?enemies.map(e=>e.boardPosition):[])];
      const hits = checkLongshotProtocol(updatedPlayer.boardPosition, targets, blockers);
      if(hits.length>0){
        const snipeDmg=Math.round(LONGSHOT_DMG*(1+accBonus('longshotProtocol')))+dmgBonus('longshotProtocol');
        hits.forEach(hit=>{
          const newHP=Math.max(0,hit.health-snipeDmg);
          addLog(`◎ Longshot Protocol -> ${hit.name} takes ${snipeDmg} dmg (${newHP}/${hit.maxHealth})`);
          triggerCastFx(hit.boardPosition,'#88e0c0');
        });
        if(isCampaign){
          const hitIds=new Set(hits.map(h=>h.id));
          const damaged=enemies.map(e=>hitIds.has(e.id)?{...e,health:Math.max(0,e.health-snipeDmg)}:e);
          const firstKill=damaged.find(e=>hitIds.has(e.id)&&e.health<=0);
          if(!firstKill){
            setEnemies(damaged);
          } else {
            // Multiple simultaneous kills need the same fold-out-then-defeat
            // sequencing as resolveMultiHitKills, so a second kill doesn't
            // get resurrected by a stale roster snapshot in the first call.
            const otherDeadIds=damaged.filter(e=>hitIds.has(e.id)&&e.id!==firstKill.id&&e.health<=0).map(e=>e.id);
            const rosterForDefeat=otherDeadIds.length===0?damaged:damaged.filter(e=>!otherDeadIds.includes(e.id));
            let playerForDefeat=updatedPlayer;
            if(otherDeadIds.length>0){
              const extraXp=(150+campaignBattle*150)*otherDeadIds.length;
              const extraHex=(40+campaignBattle*30)*otherDeadIds.length;
              addLog(`+${extraXp} XP, +${extraHex} Hexas from ${otherDeadIds.length} more Longshot Protocol kill${otherDeadIds.length>1?'s':''}`);
              setHexas(h=>h+extraHex);
              playerForDefeat={...updatedPlayer, playerXp:(updatedPlayer.playerXp||0)+extraXp};
            }
            setTimeout(()=>handleEnemyDefeatedMulti(firstKill.id,playerForDefeat,rosterForDefeat),300);
          }
        } else {
          const hit=hits[0];
          const newHP=Math.max(0,hit.health-snipeDmg);
          setEnemy({...enemy,health:newHP});
          if(newHP<=0) setTimeout(()=>handleEnemyDefeated(updatedPlayer,wave),300);
        }
      }
    }
    setPlayerSel(false);
    setValidSquares([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isCampaign,showDeploy,awaitingPlacement,compassTargeting,darkWebTargeting,pulseWaveTargeting,summonPhaseActive,energyPhase,summons,obstacles,actedSummonIds,selectedSummonId,isPlayerTurn,player,enemy,enemies,playerSel,validSquares,tiles,loadout,wave,campaignBattle,dmgBonus,accBonus,addLog,triggerCastFx,handleEnemyDefeated,handleEnemyDefeatedMulti,resolveDeployPlacement,resolveDeployPlacementMulti,resolveCompassSlash,resolveCompassSlashMulti,resolveDarkWeb,resolveDarkWebMulti,resolvePulseWave,resolvePulseWaveMulti,summonActionAt,summonActionAtMulti,resolveSummonAction,resolveSummonActionMulti]);

  // Auto-end the summon command phase once all of the PLAYER's own summons
  // have acted (or pool is empty) — enemy-deployed summons in Campaign act
  // automatically during their owner's own turn, not here.
  useEffect(()=>{
    if(!summonPhaseActive||energyPhase!=='summon') return;
    // Promoted summons are inert (staged Agent behavior) — they don't need
    // commanding, and requiring an empty list to "act" before continuing
    // would softlock the phase if every summon happened to be promoted.
    const ownSummons = summons.filter(s=>s.side==='player'&&!s.promoted);
    const allActed = ownSummons.every(s=>actedSummonIds.includes(s.id));
    if(allActed){ const t=setTimeout(()=>(isCampaign?endSummonCommandPhaseMulti:endSummonCommandPhase)(),300); return ()=>clearTimeout(t); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[summonPhaseActive,energyPhase,actedSummonIds,summons,isCampaign]);

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
  // Dark Web highlight: the 8 knight-move tiles around the player while targeting.
  const darkWebTiles = darkWebTargeting ? getKnightTiles(player.boardPosition) : [];
  // Deploy highlight: legal row-7 tiles while awaiting placement.
  const activeDeployTiles = (showDeploy && awaitingPlacement) ? (isCampaign?deployTilesMulti:deployTiles) : [];
  const aoeTiles = compassTiles;
  const gridDeployHighlights = activeDeployTiles;

  // Initial healing-tile guarantee on first mount handled by makeTiles.
  const didInitRef = useRef(false);
  useEffect(()=>{ didInitRef.current=true; },[]);

  // Battle Skills scene: surface the loadout picker immediately on entry
  // rather than requiring a boss defeat — the whole point of this scene is
  // trying skills out with no grind.
  useEffect(()=>{
    if(scene==='skills') setShowLoadoutModal(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Match-start ceremony -- see PlacementRollModal/InitiativeRollModal.
  // Once the placement step has fully resolved (roll revealed and, on a
  // free-choice roll, a tile actually picked), show the initiative roll-off
  // next -- Gauntlet/Training only; Campaign keeps its own fixed Summons ->
  // Player -> Enemy order and never shows this. Runs once, ever: nothing
  // ever sets showPlacementRollModal or showPlacementPicker back to true
  // after they close, so this effect's condition can only become true a
  // single time in the component's life.
  useEffect(()=>{
    if(isCampaign) return;
    if(!showPlacementRollModal && !showPlacementPicker && firstMoverRef.current===null){
      setShowInitiativeRollModal(true);
    }
  },[showPlacementRollModal, showPlacementPicker, isCampaign]);

  // Rolls the (already-determined, see newHero/rollBackRowPosition) placement
  // value and animates its reveal -- same roll-then-reveal pattern as
  // handleDeployRoll's d100.
  const handlePlacementRoll = useCallback(()=>{
    setPlacementRolling(true);
    setTimeout(()=>{
      const roll = player._placementRoll ?? 0;
      setPlacementRollValue(roll);
      setPlacementRolling(false);
      addLog(roll===0 ? 'Placement d10=0 -> Free choice.' : `Placement d10=${roll} -> Tile ${roll}.`);
    },600);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[player,addLog]);

  const handlePlacementContinue = useCallback(()=>{
    setShowPlacementRollModal(false);
  },[]);

  // Confirms a free-choice placement (see PlacementPickerModal): moves the
  // player to the chosen back-row column and regenerates tiles around the
  // new position (the initial tiles were built before this choice existed).
  // The mount effect above picks up from here to show the initiative modal.
  const handleConfirmPlacement = useCallback((col)=>{
    setShowPlacementPicker(false);
    setPlayer(p => {
      const updated = {...p, boardPosition:{x:col,y:8}};
      if(isCampaign){
        setTiles(makeTiles(updated.boardPosition, {x:-1,y:-1}, enemies.map(e=>e.boardPosition)));
      } else {
        setTiles(sceneIncludeTerrain ? makeTiles(updated.boardPosition, enemy.boardPosition) : makePlainTiles());
      }
      return updated;
    });
  },[isCampaign,enemy,enemies,sceneIncludeTerrain]);

  // Rolls initiative and animates the reveal -- the actual roll happens here
  // (unlike placement, this one genuinely hasn't happened yet).
  const handleInitiativeRoll = useCallback(()=>{
    setInitiativeRolling(true);
    setTimeout(()=>{
      const { winner, p, e } = rollInitiative();
      setInitiativeResult({p, e, winner});
      setInitiativeRolling(false);
    },600);
  },[]);

  const handleBeginBattle = useCallback(()=>{
    setShowInitiativeRollModal(false);
    applyInitiativeResult(initiativeResult.winner, player, enemy, round);
  },[initiativeResult,player,enemy,round,applyInitiativeResult]);

  // Mirror the live Proxy/session state up to a host shell (e.g. a Character
  // screen elsewhere in the app) that isn't otherwise able to see this
  // component's internal state. No-op if no callback was passed in.
  useEffect(()=>{
    onStateSync?.({ player, loadout, wave, hexas, materials });
  },[player, loadout, wave, hexas, materials, onStateSync]);

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
      // Portrait stacks Stats/Grid/Log vertically instead of side-by-side
      // (see the battleRowRef JSX below), so there are no side panels eating
      // into the grid's available width anymore — just the column's own
      // horizontal padding.
      const portrait = window.innerHeight > window.innerWidth;
      const rowWidth = battleRowRef.current.clientWidth;
      const availableHeight = gridSlotRef.current.clientHeight;
      const availableWidth = portrait
        ? rowWidth - MID_COL_H_PADDING
        : rowWidth - SIDE_PANEL_MIN_WIDTH*2 - MID_COL_H_PADDING;
      const next = Math.max(GRID_MIN_SIZE, Math.floor(Math.min(availableHeight, availableWidth)));
      setGridSize(prev => Math.abs(prev-next)>1 ? next : prev);
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    if(battleRowRef.current) ro.observe(battleRowRef.current);
    if(gridSlotRef.current) ro.observe(gridSlotRef.current);
    window.addEventListener('resize', recompute);
    return () => { ro.disconnect(); window.removeEventListener('resize', recompute); };
  },[]);

  // A skill is cast from wherever you were standing when you rolled for
  // it — not wherever you happen to be standing now. Once a roll is locked
  // in for the currently selected element, every range/line/AoE/knockback
  // computation (both this live preview and the eventual Apply) reads from
  // that frozen origin instead of the live player position/facing, so
  // closing the dice modal and repositioning mid-round can't retroactively
  // change what a roll already in progress will hit.
  const castOrigin = (lockedRoll && lockedRoll.element===selElement && lockedRoll.origin)
    ? lockedRoll.origin
    : {boardPosition:player.boardPosition, facing:player.facing};
  const enemyDistanceForAir = (()=>{
    const line=getForwardTiles(castOrigin.boardPosition,castOrigin.facing,SIZE);
    if(isCampaign){
      const idx=line.findIndex(t=>enemies.some(en=>en.boardPosition.x===t.x&&en.boardPosition.y===t.y));
      return idx>=0?idx+1:0;
    }
    const idx=line.findIndex(t=>t.x===enemy.boardPosition.x&&t.y===enemy.boardPosition.y);
    return idx>=0?idx+1:0;
  })();
  const nearestObstacleForEarth = (()=>{
    const line=getForwardTiles(castOrigin.boardPosition,castOrigin.facing,SIZE);
    const idx=line.findIndex(t=>obstacles.some(o=>o.boardPosition.x===t.x&&o.boardPosition.y===t.y));
    return idx>=0?idx+1:0;
  })();
  const waterAnchor = getTorrentAnchor(castOrigin.boardPosition,castOrigin.facing);
  const waterAnchorInBounds = (()=>{
    const dir={up:{dx:0,dy:-1},down:{dx:0,dy:1},left:{dx:-1,dy:0},right:{dx:1,dy:0}}[castOrigin.facing]||{dx:0,dy:1};
    const tx=castOrigin.boardPosition.x+dir.dx*TORRENT_RANGE, ty=castOrigin.boardPosition.y+dir.dy*TORRENT_RANGE;
    return tx>=0&&tx<SIZE&&ty>=0&&ty<SIZE;
  })();
  const waterEnemyInFootprint = waterAoe ? getTorrentFootprint(waterAnchor,waterAoe).some(t=>isCampaign ? enemies.some(en=>en.boardPosition.x===t.x&&en.boardPosition.y===t.y) : (t.x===enemy.boardPosition.x&&t.y===enemy.boardPosition.y)) : false;
  return (
    <div style={{minHeight:'100vh',background:'#0a0a0a',backgroundImage:'radial-gradient(circle at 50% 0%, rgba(0,200,255,0.06), transparent 60%)',color:'#b0dff4',fontFamily:"'Rajdhani','Share Tech Mono',sans-serif",padding:'10px 12px 24px'}}>

      {/* Portrait used to be hard-blocked behind a "rotate your device" full-
          screen prompt. It's now a first-class layout (see isPortrait usage
          below: battleRowRef switches to a stacked column, the grid is
          reordered to the top via CSS `order`, and Stats/Log split the
          remaining height instead of sitting beside the grid at full row
          height) rather than landscape being the only supported shape. */}

      <div style={{maxWidth:1180,margin:'0 auto'}}>

        {/* Status bar */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,flexWrap:'wrap',gap:6}}>
          <div style={{display:'flex',alignItems:'baseline',gap:10}}>
            <h1 style={{fontFamily:"'Advent Pro',sans-serif",fontSize:'1.25rem',fontWeight:700,letterSpacing:'0.18em',textTransform:'uppercase',color:'#00c8ff',textShadow:'0 0 18px rgba(0,200,255,0.4)',margin:0}}>Paradigm</h1>
            <span style={{fontSize:'0.7rem',letterSpacing:'0.2em',color:'#3a6a8a',textTransform:'uppercase'}}>{sceneMeta ? `Training — ${sceneMeta.name}` : isCampaign ? `Campaign — Battle ${campaignBattle}/${CAMPAIGN_BATTLES.length}: ${CAMPAIGN_BATTLES[campaignBattle-1].name}` : 'Grid Battler'}</span>
            <span style={{fontSize:'0.62rem',letterSpacing:'0.15em',color:'#2a4a5e',fontFamily:'monospace'}}>v4.3</span>
          </div>
          <div style={{display:'flex',gap:14,alignItems:'center',fontSize:'0.8rem',fontFamily:'monospace'}}>
            {!scene&&!isCampaign&&<span style={{color:'#7a9db5'}}>Wave <span style={{color:'#00c8ff',fontWeight:'bold'}}>{wave}</span></span>}
            <span style={{color:'#7a9db5'}}>Round <span style={{color:'#00c8ff',fontWeight:'bold'}}>{round}</span></span>
            {!scene&&<span style={{color:'#7a9db5'}}>Hexas <span style={{color:'#ffd700',fontWeight:'bold'}}>{hexas}</span></span>}
          </div>
        </div>

        {/* Main row: ONE unified panel. Three sections (Proxy/Enemy + Skills,
            Grid, Combat Log) separated by vertical dividers instead of gaps
            between floating boxes — reclaims the inter-panel gutters for the
            cramped stat sections. Grid stays a height-limited square.
            Portrait stacks these vertically instead of side-by-side (there's
            no room for three ~260px-minimum columns on a phone): the grid
            gets a fixed share of the column's height and is reordered to the
            top via CSS `order` (DOM order is unchanged, so tab order/reading
            order stay Stats -> Grid -> Log), while Stats and Log split the
            remaining height evenly and rely on the internal overflow-y:auto
            scrolling both already have (see PlayerStatsPanel/CombatLog)
            rather than needing new scroll handling here. */}
        <PanelBox style={{height:'calc(100dvh - 92px)',minHeight:320,padding:'12px',overflow:'hidden'}}>
          <div ref={battleRowRef} style={{display:'flex',flexDirection:isPortrait?'column':'row',minWidth:0,height:'100%'}}>
            {/* Left section: Proxy + Enemy stats + action buttons */}
            <div style={isPortrait
              ? {order:2,width:'100%',flex:'1 1 0',display:'flex',flexDirection:'column',minHeight:0,paddingTop:8}
              : {flex:1,minWidth:SIDE_PANEL_MIN_WIDTH,display:'flex',flexDirection:'column',minHeight:0,paddingRight:12}}>
              <PlayerStatsPanel
                player={player} playerRolledEnergy={playerRolledEnergy}
                selectedCategory={selCategory} selectedElement={selElement}
                onElementSelect={(c,e)=>{setSelCategory(c);setSelElement(e);}}
                canAttack={isCampaign?canAttackMulti:canAttack} canSkill={isCampaign?canSkillMulti:canSkill}
                onMelee={isCampaign?handleMeleeOpenMulti:handleMeleeOpen} onSkill={handleSkill} onEndTurn={isCampaign?handleEndTurnMulti:handleEndTurn}
                onRollEnergy={isCampaign?handleRollEnergyMulti:handleRollEnergy} energyPhase={energyPhase}
                onSurrender={isCampaign?handleSurrenderMulti:handleSurrender} enemy={enemy} enemyRolledEnergy={enemyRolledEnergy}
                enemies={isCampaign?enemies:undefined} enemyRolledEnergyById={enemyRolledEnergyById}
                selectedEnemyId={selectedEnemyId} onSelectEnemy={setSelectedEnemyId}
                isPlayerTurn={isPlayerTurn}
                loadout={loadout} summons={summons}
                canCompassSlash={canCompassSlash} onCompassSlash={handleCompassSlash}
                canCircuitSigil={canCircuitSigil} onCircuitSigil={handleCircuitSigil}
                circuitSigilReason={isCampaign?deployBlockedReasonMulti:deployBlockedReason}
                canRotate={canRotate} onRotate={handleRotateOpen}
                canDarkWeb={canDarkWeb} onDarkWeb={handleDarkWeb}
                canPulseWave={canPulseWave} onPulseWave={handlePulseWave}
                canPiercingLight={canPiercingLight} onPiercingLight={handlePiercingLight}
                canCustomSkill={canCustomSkill} onCustomSkill={isCampaign?handleCustomSkillMulti:handleCustomSkill}
                customSkillDef={customSkillDef} customSkillCost={customSkillCost}
                hideElementalSkill={!sceneAllowSkill} restrictElementsToBase={sceneRestrictBaseElements}
                lockElementPicker={isCampaign}
              />
            </div>

            {/* Middle section: grid + tile legend. The square is sized in JS
                (gridSize, see the ResizeObserver effect above) to the smaller
                of the row's available width and the slot's available height,
                so it can never overflow into the side columns as the window
                is resized — previously it was sized purely off height, which
                let it grow past its column's width and overlap the neighbors. */}
            <div style={isPortrait
              ? {order:1,flexShrink:0,width:'100%',height:'42%',display:'flex',flexDirection:'column',minHeight:0,alignItems:'center',padding:'0 4px'}
              : {flexShrink:0,width:gridSize+MID_COL_H_PADDING,height:'100%',display:'flex',flexDirection:'column',minHeight:0,alignItems:'center',padding:'0 12px'}}>
              <div ref={gridSlotRef} style={{flex:1,minHeight:0,width:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <div style={{width:gridSize,height:gridSize,flexShrink:0,display:'flex'}}>
                  <Grid
                    playerPos={player.boardPosition} enemyPos={enemy.boardPosition}
                    enemies={isCampaign?enemies:undefined} selectedEnemyId={selectedEnemyId}
                    validSquares={validSquares} onSquareClick={handleSquareClick}
                    playerSelected={playerSel} tiles={tiles}
                    playerFacing={player.facing} enemyFacing={enemy.facing}
                    aoeTiles={aoeTiles} knightTiles={darkWebTiles} summons={summons} obstacles={obstacles} deployTiles={gridDeployHighlights}
                    castFx={castFx}
                  />
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3, auto)',gap:'3px 12px',justifyContent:'center',alignItems:'center',marginTop:6,paddingTop:6,borderTop:'1px solid #1e3a4a',flexShrink:0}}>
                {sceneIncludeTerrain && TILE_LEGEND.map(l=>(
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
            <div style={isPortrait
              ? {order:3,width:'100%',flex:'1 1 0',display:'flex',flexDirection:'column',minHeight:0,paddingTop:8}
              : {flex:1,minWidth:SIDE_PANEL_MIN_WIDTH,display:'flex',flexDirection:'column',minHeight:0,paddingLeft:12}}>
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
              {loadout.includes('compassSlash')&&(
                <div style={{borderLeft:'2px solid #9b6cff',paddingLeft:10}}>
                  <div style={{color:'#b08cff',fontWeight:'bold',marginBottom:4}}>⊕ Compass Slash <span style={{fontSize:'9px',color:'#5a7a8a'}}>(Tactical, 2E, 1/turn)</span></div>
                  60 dmg to any of the 8 surrounding tiles.
                </div>
              )}
              {loadout.includes('circuitSigil')&&(
                <div style={{borderLeft:'2px solid #9b6cff',paddingLeft:10}}>
                  <div style={{color:'#b08cff',fontWeight:'bold',marginBottom:4}}>◈ Circuit Sigil <span style={{fontSize:'9px',color:'#5a7a8a'}}>(Core, 2E, 1/turn)</span></div>
                  d100 → Bug (1–34) / Virus (35–67) / Malware (68–100). Places a Novice on row 7. Bandwidth {BANDWIDTH}.<br/>
                  <span style={{color:'#5a7a8a'}}>Turn order with summons: Summons → Enemy → You. Summons march forward; reaching the back row promotes to Agent (staged).</span>
                </div>
              )}
              {loadout.includes('darkWeb')&&(
                <div style={{borderLeft:'2px solid #a0a0a0',paddingLeft:10}}>
                  <div style={{color:'#c8c8c8',fontWeight:'bold',marginBottom:4}}>✕ Dark Web <span style={{fontSize:'9px',color:'#5a7a8a'}}>(Tactical, 2E, 1/turn)</span></div>
                  Strikes any of the 8 knight-move tiles (chess-knight L-pattern) — bypasses adjacent defenders entirely. 70 base dmg, accuracy roll applies. A finishing blow claims the target's tile, same as any melee kill; a survived hit leaves you in place.
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
        onRoll={handleRoll} onUseAbility={isCampaign?handleModalAbilityMulti:handleModalAbility} onClose={resetDiceModal}
        phase={dicePhase} accuracyRoll={accuracyRoll} onRollAccuracy={handleRollAccuracy}
        selectedAbilityForAccuracy={pendingAbility}
        onAirProceedToAccuracy={handleAirProceedToAccuracy}
        onFireProceedToAccuracy={handleFireProceedToAccuracy} onFireApplyWithAccuracy={isCampaign?handleFireApplyWithAccuracyMulti:handleFireApplyWithAccuracy}
        earthRange={earthRange} onSetEarthRange={handleSetEarthRange} onConfirmEarthRange={handleConfirmEarthRange}
        onEarthApplyWithAccuracy={isCampaign?handleEarthApplyWithAccuracyMulti:handleEarthApplyWithAccuracy}
        onAirApplyWithAccuracy={isCampaign?handleAirApplyWithAccuracyMulti:handleAirApplyWithAccuracy}
        onWaterConfirm={handleWaterConfirm} onWaterApplyWithAccuracy={isCampaign?handleWaterApplyWithAccuracyMulti:handleWaterApplyWithAccuracy}
        waterAoe={waterAoe} onSetWaterAoe={handleSetWaterAoe}
        waterAvailableAP={player.actionpts}
        waterAnchorInBounds={waterAnchorInBounds} waterEnemyInFootprint={waterEnemyInFootprint}
        playerFacing={castOrigin.facing} enemyDistance={enemyDistanceForAir} obstacleDistance={nearestObstacleForEarth}
      />
      <LoadoutModal show={showLoadoutModal} loadout={loadout} onToggle={handleToggleLoadoutSkill} onConfirm={handleConfirmLoadout} onClose={()=>setShowLoadoutModal(false)} freeSelect={scene==='skills'} craftedSkillIds={craftedSkillIds} />
      <DeployRollModal
        show={showDeploy} rolling={deployRolling} roll={deployRoll} tier={deployTier}
        awaitingPlacement={awaitingPlacement} onRoll={handleDeployRoll} onClose={handleCloseDeploy}
      />
      <MeleeMultiplierModal
        show={!!meleeModalCtx}
        perHitDamage={meleeModalCtx?.perHitDamage}
        maxMultiplier={meleeModalCtx?.maxMultiplier||1}
        targetLabel={meleeModalCtx?.targetLabel}
        onConfirm={isCampaign?resolveMeleeMulti:resolveMelee}
        onClose={()=>setMeleeModalCtx(null)}
      />
      <PiercingLightModal
        show={!!piercingLightCtx}
        maxEnergy={piercingLightCtx?.maxEnergy||PIERCING_LIGHT_BASE_COST}
        onConfirm={isCampaign?resolvePiercingLightMulti:resolvePiercingLight}
        onClose={()=>setPiercingLightCtx(null)}
      />
      <RewardModal show={reward.show} html={reward.html} />
      <PlacementRollModal show={showPlacementRollModal} rolling={placementRolling} roll={placementRollValue} onRoll={handlePlacementRoll} onContinue={handlePlacementContinue} />
      <PlacementPickerModal show={showPlacementPicker && !showPlacementRollModal} onSelect={handleConfirmPlacement} />
      <InitiativeRollModal show={showInitiativeRollModal} rolling={initiativeRolling} result={initiativeResult} onRoll={handleInitiativeRoll} onBegin={handleBeginBattle} />
      <SceneCompleteModal show={sceneComplete} sceneMeta={sceneMeta} onReturn={()=>onSceneComplete?.()} />
      <CampaignBattleCompleteModal
        show={isCampaign&&showBattleComplete}
        isFinale={campaignComplete}
        battle={CAMPAIGN_BATTLES[campaignBattle-1]}
        nextBattle={CAMPAIGN_BATTLES[campaignBattle]}
        equipmentReward={FIRST_EQUIPMENT}
        onContinue={()=>{ setShowBattleComplete(false); startNextCampaignBattle(player, campaignBattle+1); }}
        onFinish={()=>{ setShowBattleComplete(false); onCampaignComplete?.(true); }}
        onReturnToMenu={handleCampaignReturnToMenu}
      />
      <CampaignDefeatModal
        show={isCampaign&&showDefeatModal}
        battle={CAMPAIGN_BATTLES[campaignBattle-1]}
        onRetry={handleCampaignRetry}
        onReturnToMenu={handleCampaignReturnToMenu}
      />

      {/* Change Loadout — Training Mode's Battle Skills scene only, lets the
          player reopen the picker and swap freely instead of a one-time
          choice. */}
      {scene==='skills'&&!showLoadoutModal&&!sceneComplete&&(
        <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',zIndex:1500}}>
          <button onClick={()=>setShowLoadoutModal(true)}
            style={{padding:'9px 18px',background:'rgba(155,108,255,0.16)',border:'1px solid #9b6cff',borderRadius:8,color:'#b08cff',fontSize:12,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',cursor:'pointer',fontFamily:"'Rajdhani',sans-serif",boxShadow:'0 0 20px rgba(155,108,255,0.3)'}}>
            ⇄ Change Loadout
          </button>
        </div>
      )}

      {/* Compass targeting banner */}
      {compassTargeting&&(
        <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',background:'#080e14',border:'1px solid #9b6cff',borderRadius:8,padding:'10px 18px',color:'#b08cff',fontSize:13,zIndex:1500,boxShadow:'0 0 24px rgba(155,108,255,0.4)'}}>
          ⚔ Compass Slash — click a highlighted tile · <span onClick={()=>setCompassTargeting(false)} style={{color:'#5a7a8a',cursor:'pointer',textDecoration:'underline'}}>cancel</span>
        </div>
      )}
      {/* Dark Web targeting banner */}
      {darkWebTargeting&&(
        <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',background:'#080e14',border:'1px solid #a0a0a0',borderRadius:8,padding:'10px 18px',color:'#c0c0c0',fontSize:13,zIndex:1500,boxShadow:'0 0 24px rgba(160,160,160,0.35)'}}>
          ⚔ Dark Web — click a highlighted knight-move tile · <span onClick={()=>setDarkWebTargeting(false)} style={{color:'#5a7a8a',cursor:'pointer',textDecoration:'underline'}}>cancel</span>
        </div>
      )}
      {/* Circuit Sigil placement banner — replaces the modal once a tier has
          rolled, so the grid's row-7 tiles are actually clickable. */}
      {showDeploy&&awaitingPlacement&&(
        <div style={{position:'fixed',bottom:20,left:'50%',transform:'translateX(-50%)',background:'#080e14',border:`1px solid ${SUMMON_TIER_META[deployTier]?.color||'#9b6cff'}`,borderRadius:8,padding:'10px 18px',color:SUMMON_TIER_META[deployTier]?.color||'#9b6cff',fontSize:13,zIndex:1500,boxShadow:`0 0 24px ${SUMMON_TIER_META[deployTier]?.color||'#9b6cff'}55`}}>
          ◈ {deployTier} Novice ready — click a highlighted tile on row 7 · <span onClick={handleCloseDeploy} style={{color:'#5a7a8a',cursor:'pointer',textDecoration:'underline'}}>cancel</span>
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
          position: relative;
        }
        .castFxRing {
          position: absolute; inset: -3px; border-radius: 4px; pointer-events: none;
          border: 3px solid var(--fx-color, #00c8ff);
          box-shadow: 0 0 18px 4px var(--fx-color, #00c8ff);
          animation: castFxPulse 0.7s ease-out forwards;
        }
        @keyframes castFxPulse {
          0% { opacity: 1; transform: scale(0.7); }
          60% { opacity: 0.9; transform: scale(1.15); }
          100% { opacity: 0; transform: scale(1.4); }
        }
        .square.hovered { border-color: #00c8ff; box-shadow: inset 0 0 8px rgba(0,200,255,0.25); }
        .square.available { background: linear-gradient(135deg, #0a2535, #061520); border-color: #1e5a7a; box-shadow: inset 0 0 6px rgba(0,200,255,0.18); }
        .square.player { background: radial-gradient(circle, #00c8ff, #006a8a); border-color: #00e0ff; color: #001018; font-weight: bold; box-shadow: 0 0 12px rgba(0,200,255,0.55); }
        .square.playerSelected { animation: pulseCyan 1s infinite; }
        .square.enemy { background: radial-gradient(circle, #ff4422, #8a1500); border-color: #ff6644; color: #1a0500; font-weight: bold; box-shadow: 0 0 12px rgba(255,68,34,0.55); }
        .square.enemy.enemySelected { border-color: #ffd700; box-shadow: 0 0 14px rgba(255,215,0,0.75), inset 0 0 8px rgba(255,215,0,0.5); }
        .square.enemy.attackable { border-color: #66dd88; box-shadow: 0 0 14px rgba(102,221,136,0.7), inset 0 0 8px rgba(102,221,136,0.45); }
        .square.summon { background: radial-gradient(circle, #9b6cff, #5a2a9a); border-color: #b08cff; color: #fff; font-weight: bold; box-shadow: 0 0 10px rgba(155,108,255,0.55); }
        .square.summon.enemySide { background: radial-gradient(circle, #ff6644, #8a2a10); border-color: #ff9966; box-shadow: 0 0 10px rgba(255,102,68,0.55); }
        .square.summon.promoted { border-color: #ffd700; box-shadow: 0 0 14px rgba(255,215,0,0.75), inset 0 0 8px rgba(255,215,0,0.5); font-size: 12px; }
        .square.obstacle { background: linear-gradient(135deg, #6b5638, #3a2e1c); border-color: #a08860; color: #e8dcc4; font-size: 13px; cursor: default; }
        .square.aoePreview { box-shadow: inset 0 0 10px rgba(155,108,255,0.6); border-color: #9b6cff; }
        .square.knightPreview { box-shadow: inset 0 0 10px rgba(160,160,160,0.6); border-color: #a0a0a0; }
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
