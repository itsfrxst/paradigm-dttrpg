import React, { useState, useEffect } from 'react';
import { BATTLE_SKILLS, isSkillUnlocked } from './GridBattlerGame.jsx';
import { SKILL_MOD_STATS, SKILL_MOD_GROUPS, MODIFIABLE_ELEMENTS, skillModTierCost, skillModMaxTier, MATERIALS } from './ItemData.jsx';

// Recipe-specific info layered on top of a BATTLE_SKILLS entry — the parts
// that matter for a "crafting bench" view (cost, and the stat breakdown
// mapped onto the five customizable axes) rather than in-battle usage text.
// Circuit Sigil is a fixed preset for now; the axes themselves are what a
// future custom-synthesis system will let players actually tune.
const RECIPES = [
  {
    skillId: 'circuitSigil',
    cost: 0, // free during the Crafting dev-unlock phase — recipe costs come online later
    campaignRequired: true, // stays locked in the bench until the Campaign is won once, even though Crafting itself is open from the start
    parameters: [
      { label:'Range',    value:'Deploys to your back row (row 7)' },
      { label:'Damage',   value:'30 ATK per summon strike' },
      { label:'Tile AOE', value:'Single target — no splash' },
      { label:'Movement', value:'1 tile forward/turn, 3-tile forward attack arc' },
      { label:'Effects',  value:'Summons a Novice (Bug/Virus/Malware, d100 roll) — Bandwidth 2' },
    ],
  },
];

// ─── CUSTOM SYNTHESIS ────────────────────────────────────────────────────
// A mini placement board for designing your own skill's shape. Every
// existing Battle Skill is already, at its core, one of three archetypes --
// an AoE footprint (Compass Slash, Water Torrent), a straight line/reach
// (Pulse Wave, Piercing Light, Earth Tremor), or a warp-and-strike leap
// (Dark Web) -- so the board makes you pick one of those three up front
// rather than offering a free-form palette; the interaction it gives you
// then matches that archetype exactly. Coordinates are stored as {dx,dy}
// offsets from the caster (not absolute board tiles), so the design is
// portable to wherever the skill is actually cast from once this is wired
// into battle. The caster sits at dead center (rather than the original
// bottom-center) so Range has equal room in all 8 directions, not just
// "forward" -- diagonals included.
const CUSTOM_SKILL_SIZE = 7;
const CUSTOM_SKILL_CASTER = { x: 3, y: 3 }; // dead center of the mini board
const CUSTOM_SKILL_MAX_AOE_TILES = 9; // matches Water Torrent's biggest (3x3 spread) footprint
const CUSTOM_SKILL_MAX_RANGE = CUSTOM_SKILL_CASTER.y; // center-to-edge reach in any of the 8 directions
const CUSTOM_SKILL_DAMAGE = { min: 10, max: 150, step: 10 }; // spans existing skills' base damage (Compass Slash 60 .. Air's top roll 180)
const CUSTOM_SKILL_ARCHETYPES = [
  { id:'aoe',   label:'AoE',   icon:'▦', hint:'Toggle tiles to build a hit footprint around your Proxie.' },
  { id:'range', label:'Range', icon:'➔', hint:'Pick a direction, then click how far out the skill reaches.' },
  { id:'warp',  label:'Warp',  icon:'⇝', hint:'Pick one tile to leap to and strike from, like Dark Web.' },
];
// The 8 directions a Range skill can reach along, each a unit {dx,dy} step
// -- diagonals included, unlike the original forward-only version. `arrow`
// drives the direction picker's glyphs, `label` the human-readable summary
// text (Compass N/S/E/W with the four ordinals between).
const CUSTOM_SKILL_DIRECTIONS = [
  { id:'up',         arrow:'↑', label:'N' },
  { id:'up-right',   arrow:'↗', label:'NE' },
  { id:'right',      arrow:'→', label:'E' },
  { id:'down-right', arrow:'↘', label:'SE' },
  { id:'down',       arrow:'↓', label:'S' },
  { id:'down-left',  arrow:'↙', label:'SW' },
  { id:'left',       arrow:'←', label:'W' },
  { id:'up-left',    arrow:'↖', label:'NW' },
];
const customSkillDirVec = (id) => {
  const d = CUSTOM_SKILL_DIRECTIONS.find(x=>x.id===id) || CUSTOM_SKILL_DIRECTIONS[0];
  const dx = d.id.includes('right') ? 1 : d.id.includes('left') ? -1 : 0;
  const dy = d.id.includes('down') ? 1 : d.id.includes('up') ? -1 : 0;
  return { dx, dy };
};
// "None" (a physical, non-elemental hit -- same as Melee/Compass Slash/Dark
// Web) plus the 4 base elements, reusing their icon/color so a Fire-flavored
// custom skill looks exactly as Fire-flavored as Ember Strike does.
const CUSTOM_SKILL_ELEMENTS = [
  { id:null, name:'None', icon:'⚙', color:'#8ab5cc' },
  ...MODIFIABLE_ELEMENTS,
];
// The dice a Special Effect rule's "Roll >=" condition can check against --
// this is the one roll the whole skill makes when cast, same idea as Fire's
// pulse die or Water's d20 gating Burn/Flood in the base game.
const CUSTOM_SKILL_DICE = ['d4','d6','d8','d10','d12','d20'];
const CUSTOM_SKILL_MAX_EFFECTS = 4;
// The four effect types a rule's THEN can apply, reusing mechanics that
// already exist in-battle (Fire's Burn, Water's Flood, Earth's Rubble,
// Air's Knockback) rather than inventing new ones -- see the session notes
// on why "the trigger is easy, the effect is the creative part". Knockback
// is the only one with a magnitude (how many extra tiles); the other three
// are binary, they either fire or they don't.
const CUSTOM_SKILL_EFFECT_TYPES = [
  { id:'burn',      label:'Burn',      icon:'🔥', hasMagnitude:false, hint:'Target takes burn damage at the start of their next turns, and their tile catches fire.' },
  { id:'flood',     label:'Flood',     icon:'🌊', hasMagnitude:false, hint:"Turns this cast's tiles into Water terrain." },
  { id:'rubble',    label:'Rubble',    icon:'🪨', hasMagnitude:false, hint:'Cracks your own tile into rubble -- an obstacle blocking movement and skills.' },
  { id:'knockback', label:'Knockback', icon:'💨', hasMagnitude:true,  hint:'Pushes anything hit back, away from you.' },
];
const describeEffectRule = (eff) => {
  const t = CUSTOM_SKILL_EFFECT_TYPES.find(x=>x.id===eff.type);
  const cond = eff.condition==='always' ? 'Always' : `Roll ≥ ${eff.threshold}`;
  return `IF ${cond} → ${t.icon} ${t.label}${t.hasMagnitude?` +${eff.magnitude}`:''}`;
};
const describeCustomShape = (def) => {
  if(def.archetype==='aoe') return `${def.tiles.length} AoE tile${def.tiles.length>1?'s':''} around your Proxie`;
  if(def.archetype==='range'){
    const dir = CUSTOM_SKILL_DIRECTIONS.find(d=>d.id===(def.rangeDirection||'up'));
    return `${def.length}-tile line (${dir.label})${def.moveCasterOnRange?' — moves you to the end':''}`;
  }
  return 'Leaps to a fixed tile and strikes, like Dark Web';
};

// The placement board itself. Click behavior depends on `archetype`: AoE
// toggles any tile on/off (capped at CUSTOM_SKILL_MAX_AOE_TILES); Range only
// responds to tiles along `rangeDirection`'s ray, setting reach to the
// clicked tile's step along it; Warp single-selects one destination tile,
// replacing any prior pick. The caster's own tile is never clickable in any
// mode.
const CustomSkillBoard = ({ archetype, aoeTiles, rangeDirection, rangeLength, warpTile, onToggleAoeTile, onSetRange, onSetWarp }) => {
  const dirVec = customSkillDirVec(rangeDirection);
  const cells = [];
  for(let y=0;y<CUSTOM_SKILL_SIZE;y++){
    for(let x=0;x<CUSTOM_SKILL_SIZE;x++){
      const isCaster = x===CUSTOM_SKILL_CASTER.x && y===CUSTOM_SKILL_CASTER.y;
      const dx=x-CUSTOM_SKILL_CASTER.x, dy=y-CUSTOM_SKILL_CASTER.y;
      let onLineStep = 0;
      if(archetype==='range' && !isCaster){
        for(let k=1;k<=CUSTOM_SKILL_MAX_RANGE;k++){
          if(dx===dirVec.dx*k && dy===dirVec.dy*k){ onLineStep=k; break; }
        }
      }
      let active=false, clickable=!isCaster;
      if(archetype==='aoe') active = !isCaster && aoeTiles.some(t=>t.dx===dx&&t.dy===dy);
      else if(archetype==='range'){ clickable = onLineStep>0; active = onLineStep>0 && onLineStep<=rangeLength; }
      else if(archetype==='warp') active = !isCaster && !!warpTile && warpTile.dx===dx && warpTile.dy===dy;
      cells.push(
        <div key={`${x}-${y}`}
          onClick={()=>{
            if(archetype==='aoe' && !isCaster) onToggleAoeTile({dx,dy});
            else if(archetype==='range' && onLineStep>0) onSetRange(onLineStep);
            else if(archetype==='warp' && !isCaster) onSetWarp({dx,dy});
          }}
          style={{aspectRatio:'1',background:isCaster?'rgba(255,215,0,0.2)':active?'rgba(155,108,255,0.35)':'rgba(255,255,255,0.03)',
            border:`1px solid ${isCaster?'#ffd700':active?'#9b6cff':'#1e3a4a'}`,borderRadius:4,
            cursor:clickable?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#ffd700'}}>
          {isCaster ? '◆' : ''}
        </div>
      );
    }
  }
  return <div style={{display:'grid',gridTemplateColumns:`repeat(${CUSTOM_SKILL_SIZE},1fr)`,gap:4,maxWidth:250,margin:'0 auto 12px'}}>{cells}</div>;
};

// Shared inline style for the Special Effects rule row's small selects/
// inputs, so IF/THEN reads as one consistent control strip.
const RULE_FIELD_STYLE = {background:'#0a1218',border:'1px solid #1e3a4a',borderRadius:4,color:'#b0dff4',padding:'3px 6px',fontSize:10};

// One "IF <condition> THEN <effect>" rule row. `rollDie` sizes the Roll>=
// input's max so a threshold can never exceed what the skill actually
// rolls.
const EffectRule = ({ effect, rollDie, onChange, onRemove }) => {
  const dieMax = parseInt(rollDie.slice(1),10);
  const effType = CUSTOM_SKILL_EFFECT_TYPES.find(t=>t.id===effect.type);
  return (
    <div style={{background:'#0a1218',border:'1px solid #1e3a4a',borderRadius:6,padding:'10px 12px',marginBottom:8}}>
      <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap',fontSize:11}}>
        <span style={{color:'#5a7a8a',fontWeight:'bold'}}>IF</span>
        <select value={effect.condition} onChange={e=>onChange({condition:e.target.value})} style={RULE_FIELD_STYLE}>
          <option value="always">Always</option>
          <option value="roll_gte">Roll ≥</option>
        </select>
        {effect.condition==='roll_gte' && (
          <input type="number" min={1} max={dieMax} value={effect.threshold}
            onChange={e=>onChange({threshold:Math.max(1,Math.min(dieMax,parseInt(e.target.value,10)||1))})}
            style={{...RULE_FIELD_STYLE,width:44}} />
        )}
        <span style={{color:'#5a7a8a',fontWeight:'bold'}}>THEN</span>
        <select value={effect.type} onChange={e=>onChange({type:e.target.value})} style={RULE_FIELD_STYLE}>
          {CUSTOM_SKILL_EFFECT_TYPES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
        </select>
        {effType.hasMagnitude && (
          <>
            <span style={{color:'#5a7a8a'}}>+</span>
            <input type="number" min={1} max={3} value={effect.magnitude}
              onChange={e=>onChange({magnitude:Math.max(1,Math.min(3,parseInt(e.target.value,10)||1))})}
              style={{...RULE_FIELD_STYLE,width:36}} />
            <span style={{color:'#5a7a8a'}}>tile(s)</span>
          </>
        )}
        <button onClick={onRemove} style={{marginLeft:'auto',background:'none',border:'none',color:'#ff6644',cursor:'pointer',fontSize:14,padding:'0 4px'}}>✕</button>
      </div>
      <div style={{fontSize:9,color:'#3a5a6a',marginTop:6}}>{effType.hint}</div>
    </div>
  );
};

// The editor itself: archetype tabs, the board, a Damage slider, an Element
// picker, and the Special Effects if/then rule list. `existing` pre-fills
// every field when re-opening a saved design to edit it.
const CustomSkillEditor = ({ existing, onSave }) => {
  const [archetype, setArchetype] = useState(existing?.archetype || 'aoe');
  const [aoeTiles, setAoeTiles] = useState(existing?.tiles || []);
  const [rangeDirection, setRangeDirection] = useState(existing?.rangeDirection || 'up');
  const [rangeLength, setRangeLength] = useState(existing?.length || 1);
  const [moveCasterOnRange, setMoveCasterOnRange] = useState(existing?.moveCasterOnRange || false);
  const [warpTile, setWarpTile] = useState(existing?.warpTile || null);
  const [damage, setDamage] = useState(existing?.damage || 60);
  const [elementId, setElementId] = useState(existing?.element ?? null);
  const [name, setName] = useState(existing?.name || 'Custom Strike');
  const [rollDie, setRollDie] = useState(existing?.rollDie || 'd6');
  const [effects, setEffects] = useState(existing?.effects || []);

  const toggleAoeTile = (t) => setAoeTiles(prev => {
    const exists = prev.some(p=>p.dx===t.dx&&p.dy===t.dy);
    if(exists) return prev.filter(p=>!(p.dx===t.dx&&p.dy===t.dy));
    if(prev.length>=CUSTOM_SKILL_MAX_AOE_TILES) return prev;
    return [...prev, t];
  });
  // A direction change invalidates whatever reach was set along the old
  // ray, so it resets to a fresh 1-tile poke rather than silently keeping a
  // now-meaningless length.
  const changeDirection = (id) => { setRangeDirection(id); setRangeLength(1); };

  const addEffect = () => setEffects(prev => prev.length>=CUSTOM_SKILL_MAX_EFFECTS ? prev
    : [...prev, { id:`eff${Date.now()}${prev.length}`, condition:'always', threshold:5, type:'burn', magnitude:1 }]);
  const updateEffect = (id, patch) => setEffects(prev => prev.map(e=>e.id===id?{...e,...patch}:e));
  const removeEffect = (id) => setEffects(prev => prev.filter(e=>e.id!==id));

  const valid = (archetype==='aoe' ? aoeTiles.length>0 : archetype==='range' ? rangeLength>0 : !!warpTile) && name.trim().length>0;
  const activeArchetype = CUSTOM_SKILL_ARCHETYPES.find(a=>a.id===archetype);

  const handleSave = () => {
    if(!valid) return;
    onSave({
      archetype, name: name.trim(), damage, element: elementId, rollDie, effects,
      tiles: archetype==='aoe' ? aoeTiles : undefined,
      rangeDirection: archetype==='range' ? rangeDirection : undefined,
      length: archetype==='range' ? rangeLength : undefined,
      moveCasterOnRange: archetype==='range' ? moveCasterOnRange : undefined,
      warpTile: archetype==='warp' ? warpTile : undefined,
    });
  };

  return (
    <div>
      <input value={name} onChange={e=>setName(e.target.value)} maxLength={24} placeholder="Skill name"
        style={{width:'100%',padding:'8px 10px',marginBottom:14,background:'#0a1218',border:'1px solid #1e3a4a',borderRadius:6,color:'#b0dff4',fontSize:13,fontFamily:"'Rajdhani',sans-serif"}} />

      <div style={{display:'flex',gap:8,marginBottom:10}}>
        {CUSTOM_SKILL_ARCHETYPES.map(a=>(
          <button key={a.id} onClick={()=>setArchetype(a.id)}
            style={{flex:1,padding:'8px 4px',background:archetype===a.id?'rgba(155,108,255,0.18)':'rgba(20,30,40,0.6)',border:`1px solid ${archetype===a.id?'#9b6cff':'#1e3a4a'}`,borderRadius:6,color:archetype===a.id?'#9b6cff':'#7a9db5',fontSize:11,fontWeight:'bold',cursor:'pointer'}}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>
      <div style={{fontSize:10,color:'#5a7a8a',marginBottom:12,textAlign:'center'}}>{activeArchetype.hint}</div>

      {archetype==='range' && (
        <div style={{display:'flex',gap:4,justifyContent:'center',marginBottom:10,flexWrap:'wrap'}}>
          {CUSTOM_SKILL_DIRECTIONS.map(d=>(
            <button key={d.id} onClick={()=>changeDirection(d.id)}
              style={{width:32,height:32,background:rangeDirection===d.id?'rgba(155,108,255,0.25)':'rgba(20,30,40,0.6)',border:`1px solid ${rangeDirection===d.id?'#9b6cff':'#1e3a4a'}`,borderRadius:6,color:rangeDirection===d.id?'#9b6cff':'#7a9db5',cursor:'pointer',fontSize:14}}>
              {d.arrow}
            </button>
          ))}
        </div>
      )}

      <CustomSkillBoard archetype={archetype} aoeTiles={aoeTiles} rangeDirection={rangeDirection} rangeLength={rangeLength} warpTile={warpTile}
        onToggleAoeTile={toggleAoeTile} onSetRange={setRangeLength} onSetWarp={setWarpTile} />

      <div style={{fontSize:10,color:'#7a9db5',textAlign:'center',marginBottom:archetype==='range'?8:16}}>
        {archetype==='aoe' && `${aoeTiles.length} / ${CUSTOM_SKILL_MAX_AOE_TILES} tiles selected`}
        {archetype==='range' && `Reach: ${rangeLength} tile${rangeLength>1?'s':''} (${CUSTOM_SKILL_DIRECTIONS.find(d=>d.id===rangeDirection).label}, max ${CUSTOM_SKILL_MAX_RANGE})`}
        {archetype==='warp' && (warpTile ? 'Destination tile picked' : 'Pick a destination tile')}
      </div>

      {archetype==='range' && (
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:10,color:'#7a9db5',marginBottom:16,cursor:'pointer'}}>
          <input type="checkbox" checked={moveCasterOnRange} onChange={e=>setMoveCasterOnRange(e.target.checked)} />
          Also move caster to the end of this line
        </label>
      )}

      <div style={{marginBottom:16}}>
        <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#7a9db5',marginBottom:4}}>
          <span>Damage</span><span>{damage}</span>
        </div>
        <input type="range" min={CUSTOM_SKILL_DAMAGE.min} max={CUSTOM_SKILL_DAMAGE.max} step={CUSTOM_SKILL_DAMAGE.step} value={damage}
          onChange={e=>setDamage(parseInt(e.target.value,10))} style={{width:'100%',accentColor:'#9b6cff'}} />
      </div>

      <div style={{marginBottom:18}}>
        <div style={{fontSize:10,color:'#7a9db5',marginBottom:6}}>Element</div>
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {CUSTOM_SKILL_ELEMENTS.map(e=>(
            <button key={e.id ?? 'none'} onClick={()=>setElementId(e.id)}
              style={{padding:'6px 10px',background:elementId===e.id?`${e.color}33`:'rgba(20,30,40,0.6)',border:`1px solid ${elementId===e.id?e.color:'#1e3a4a'}`,borderRadius:6,color:elementId===e.id?e.color:'#7a9db5',fontSize:11,cursor:'pointer'}}>
              {e.icon} {e.name}
            </button>
          ))}
        </div>
      </div>

      <div style={{marginBottom:18}}>
        <div style={{fontSize:10,color:'#7a9db5',marginBottom:6}}>Special Effects <span style={{color:'#3a5a6a'}}>(if / then)</span></div>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10,fontSize:10,color:'#5a7a8a',flexWrap:'wrap'}}>
          <span>This skill also rolls a</span>
          <select value={rollDie} onChange={e=>setRollDie(e.target.value)} style={RULE_FIELD_STYLE}>
            {CUSTOM_SKILL_DICE.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
          <span>when cast, for the Roll ≥ rules below to check against.</span>
        </div>
        {effects.map(eff=>(
          <EffectRule key={eff.id} effect={eff} rollDie={rollDie} onChange={patch=>updateEffect(eff.id,patch)} onRemove={()=>removeEffect(eff.id)} />
        ))}
        {effects.length<CUSTOM_SKILL_MAX_EFFECTS && (
          <button onClick={addEffect} style={{width:'100%',padding:8,background:'rgba(20,30,40,0.6)',border:'1px dashed #2a4a5e',borderRadius:6,color:'#7a9db5',fontSize:11,cursor:'pointer'}}>+ Add Rule</button>
        )}
      </div>

      <button onClick={handleSave} disabled={!valid}
        style={{width:'100%',padding:11,background:valid?'rgba(155,108,255,0.18)':'rgba(20,30,40,0.6)',color:valid?'#9b6cff':'#2a4a5e',border:`1px solid ${valid?'#9b6cff':'#1e3a4a'}`,borderRadius:6,cursor:valid?'pointer':'not-allowed',fontSize:13,fontWeight:'bold',letterSpacing:'0.06em'}}>
        {existing ? 'Save Changes' : 'Finalize Custom Skill'}
      </button>
    </div>
  );
};

// Read-only view of a saved design, with an Edit button to reopen the
// editor pre-filled (see CustomSkillEditor's `existing` prop).
const CustomSkillSummary = ({ def, onEdit }) => {
  const element = CUSTOM_SKILL_ELEMENTS.find(e=>e.id===(def.element ?? null));
  const archetype = CUSTOM_SKILL_ARCHETYPES.find(a=>a.id===def.archetype);
  return (
    <div style={{background:'rgba(10,18,28,0.9)',border:'1px solid #9b6cff66',borderRadius:10,padding:'16px 18px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <span style={{fontSize:24}}>{element.icon}</span>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:'bold',color:'#9b6cff'}}>{def.name}</div>
          <div style={{fontSize:10,color:'#7a9db5'}}>{archetype.label} · {element.name} · {def.damage} base dmg</div>
        </div>
        <span style={{fontSize:9,color:'#66dd88',fontWeight:'bold',letterSpacing:'0.08em',border:'1px solid #1e6a3a',borderRadius:4,padding:'4px 9px',background:'rgba(0,200,100,0.1)'}}>✓ SAVED</span>
      </div>
      <div style={{fontSize:11,color:'#8ab5cc',marginBottom:def.effects?.length>0?10:14}}>{describeCustomShape(def)}</div>
      {def.effects?.length>0 && (
        <div style={{fontSize:10,color:'#7a9db5',lineHeight:1.7,marginBottom:14}}>
          {def.effects.map(eff=><div key={eff.id}>{describeEffectRule(eff)}</div>)}
        </div>
      )}
      <button onClick={onEdit}
        style={{padding:'7px 14px',background:'rgba(155,108,255,0.15)',border:'1px solid #9b6cff',borderRadius:6,color:'#9b6cff',fontSize:11,fontWeight:'bold',cursor:'pointer'}}>
        Edit Design
      </button>
    </div>
  );
};

// The Modifier Panel's upgrade targets, grouped exactly the way
// SKILL_MOD_GROUPS prices them: Core (Melee, Circuit Sigil), Foundational
// (the 5 Tactical BATTLE_SKILLS), and Elemental (the 4 base elements). Skill
// name/icon/color are read directly off BATTLE_SKILLS so they never drift
// out of sync with in-battle text. `requiresLearn` carries BATTLE_SKILLS'
// own `locked` flag through -- today that's just Circuit Sigil, which stays
// hidden behind a "learn it in Recipes first" card until crafted. This is
// the *static* list -- the one Core skill BATTLE_SKILLS can't know about
// (a saved Custom Synthesis design) is appended at render time in
// CraftingScreen, once it exists (see modifierTargets below).
const STATIC_MODIFIER_TARGETS = [
  ...BATTLE_SKILLS.filter(s => s.category==='core' || s.category==='tactical').map(s => ({
    id:s.id, name:s.name, icon:s.icon, color:s.color, coreId:null,
    group: s.category==='core' ? 'core' : 'foundational',
    requiresLearn: !!s.locked,
  })),
  ...MODIFIABLE_ELEMENTS.map(e => ({ id:e.id, name:e.name, icon:e.icon, color:e.color, coreId:e.coreId, group:'elemental', requiresLearn:false })),
];

// A locked target (Circuit Sigil, pre-Crafting) renders as a dimmed stand-in
// for its slider card instead of one -- spending Hexas on a skill you can't
// use yet wouldn't mean anything.
const LockedModifierCard = ({ target }) => (
  <div style={{background:'rgba(10,18,28,0.6)',border:'1px solid #1e3a4a',borderRadius:10,padding:'14px 16px',opacity:0.6}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
      <span style={{fontSize:22,filter:'grayscale(1)'}}>{target.icon}</span>
      <div style={{fontSize:14,fontWeight:'bold',color:'#5a7a8a'}}>{target.name}</div>
    </div>
    <div style={{fontSize:10,color:'#5a7a8a',fontStyle:'italic'}}>🔒 Learn this skill in Recipes first.</div>
  </div>
);

// One stat's slider row inside a ModifierCard: drag to a target tier (never
// below what's already owned -- this is a one-way permanent purchase,
// there's no sell-back), see the lump cost to close the gap, then confirm
// to actually buy it. Every stat shares the same group-priced Hexas curve
// (see skillModTierCost in ItemData.jsx) -- only the step/max differ per
// stat, via SKILL_MOD_STATS.
const StatSlider = ({ target, statId, tier, hexas, coreCount, onUpgrade }) => {
  const stat = SKILL_MOD_STATS[statId];
  const maxTier = skillModMaxTier(statId);
  const maxed = tier >= maxTier;
  const [pending, setPending] = useState(tier);
  useEffect(()=>{ setPending(tier); },[tier]);

  const tiersToBuy = pending - tier;
  let cost = 0;
  for(let t=tier+1; t<=pending; t++) cost += skillModTierCost(target.id, t);
  const coreMat = target.coreId ? MATERIALS.find(m=>m.id===target.coreId) : null;
  const coresNeeded = target.coreId ? tiersToBuy : 0;
  const canAfford = tiersToBuy>0 && hexas>=cost && (!target.coreId || coreCount>=coresNeeded);
  const unit = statId==='accuracy' ? '%' : '';

  return (
    <div style={{marginBottom:12}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:4}}>
        <span style={{fontSize:11,fontWeight:'bold',color:'#b0dff4'}}>{stat.label}</span>
        <span style={{fontSize:10,color:'#7a9db5'}}>+{tier*stat.step}{unit} / +{stat.max}{unit}{maxed?' — MAXED':''}</span>
      </div>
      <input type="range" min={0} max={maxTier} step={1} value={pending} disabled={maxed}
        onChange={e=>setPending(Math.max(tier, parseInt(e.target.value,10)))}
        style={{width:'100%',marginBottom:6,accentColor:target.color}} />
      <div style={{display:'flex',justifyContent:'space-between',fontSize:9,color:'#5a7a8a',marginBottom:8}}>
        <span>Owned +{tier*stat.step}{unit}</span>
        <span style={{color:pending>tier?target.color:'#5a7a8a'}}>{pending>tier?`Target +${pending*stat.step}${unit}`:'Drag to select a target'}</span>
      </div>
      {!maxed && tiersToBuy>0 && (
        <button onClick={()=>onUpgrade(statId,pending)} disabled={!canAfford}
          style={{width:'100%',padding:9,background:canAfford?`${target.color}22`:'rgba(20,30,40,0.6)',color:canAfford?target.color:'#2a4a5e',border:`1px solid ${canAfford?target.color:'#1e3a4a'}`,borderRadius:6,cursor:canAfford?'pointer':'not-allowed',fontSize:11,fontWeight:'bold',letterSpacing:'0.03em'}}>
          Buy +{tiersToBuy*stat.step}{unit} {stat.label} — {cost} Hexas{coresNeeded>0?` + ${coresNeeded} ${coreMat.name}${coresNeeded>1?'s':''}`:''}
        </button>
      )}
    </div>
  );
};

// A skill's card: one StatSlider per SKILL_MOD_STATS entry (Damage,
// Accuracy, ...) so a future third stat is just another entry there, not a
// new card layout.
const ModifierCard = ({ target, skillMods, hexas, coreCount, onUpgrade }) => (
  <div style={{background:'rgba(10,18,28,0.9)',border:`1px solid ${target.color}66`,borderRadius:10,padding:'14px 16px'}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
      <span style={{fontSize:22}}>{target.icon}</span>
      <div style={{fontSize:14,fontWeight:'bold',color:target.color}}>{target.name}</div>
    </div>
    {Object.keys(SKILL_MOD_STATS).map(statId=>(
      <StatSlider key={statId} target={target} statId={statId} tier={skillMods?.[statId] || 0}
        hexas={hexas} coreCount={coreCount} onUpgrade={onUpgrade} />
    ))}
  </div>
);

const RecipeCard = ({ skill, recipe, learned, locked, hexas, onLearn }) => (
  <div style={{background:'rgba(10,18,28,0.9)',border:`1px solid ${locked?'#1e3a4a':skill.color+'66'}`,borderRadius:10,padding:'18px 20px',marginBottom:14,opacity:locked?0.7:1}}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
      <span style={{fontSize:28,filter:locked?'grayscale(1)':'none'}}>{skill.icon}</span>
      <div style={{flex:1}}>
        <div style={{fontSize:16,fontWeight:'bold',color:locked?'#5a7a8a':skill.color}}>{skill.name}</div>
        <div style={{fontSize:11,color:'#7a9db5'}}>{skill.tagline}</div>
      </div>
      {learned ? (
        <span style={{fontSize:10,color:'#66dd88',fontWeight:'bold',letterSpacing:'0.08em',border:'1px solid #1e6a3a',borderRadius:4,padding:'4px 9px',background:'rgba(0,200,100,0.1)'}}>✓ LEARNED</span>
      ) : locked ? (
        <span style={{fontSize:10,color:'#5a7a8a',fontWeight:'bold',letterSpacing:'0.08em',border:'1px solid #1e3a4a',borderRadius:4,padding:'4px 9px'}}>🔒 LOCKED</span>
      ) : (
        <span style={{fontSize:10,color:'#ffd700',fontWeight:'bold',letterSpacing:'0.08em'}}>{recipe.cost>0 ? `${recipe.cost} HEXAS` : 'FREE'}</span>
      )}
    </div>
    <div style={{fontSize:12,color:'#8ab5cc',lineHeight:1.6,marginBottom:14}}>{skill.blurb}</div>

    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8,marginBottom:14}}>
      {recipe.parameters.map(p=>(
        <div key={p.label} style={{background:'#0a1218',border:'1px solid #1e3a4a',borderRadius:6,padding:'8px 10px'}}>
          <div style={{fontSize:9,color:'#3a5a6a',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:3}}>{p.label}</div>
          <div style={{fontSize:11,color:'#b0dff4',lineHeight:1.4}}>{p.value}</div>
        </div>
      ))}
    </div>

    {locked ? (
      <div style={{fontSize:11,color:'#5a7a8a',fontStyle:'italic',padding:'9px 12px',background:'rgba(0,0,0,0.25)',border:'1px solid #1e3a4a',borderRadius:6}}>
        🔒 Complete the Campaign to unlock this recipe.
      </div>
    ) : !learned && (
      <button onClick={onLearn} disabled={hexas<recipe.cost}
        style={{width:'100%',padding:11,background:hexas>=recipe.cost?`${skill.color}22`:'rgba(20,30,40,0.6)',color:hexas>=recipe.cost?skill.color:'#2a4a5e',border:`1px solid ${hexas>=recipe.cost?skill.color:'#1e3a4a'}`,borderRadius:6,cursor:hexas>=recipe.cost?'pointer':'not-allowed',fontSize:13,fontWeight:'bold',letterSpacing:'0.06em'}}>
        {hexas>=recipe.cost ? `Learn ${skill.name}` : `Need ${recipe.cost - hexas} more Hexas`}
      </button>
    )}
  </div>
);

const CraftingScreen = ({ hexas, materials, craftedSkillIds, onLearnSkill, campaignCompletedOnce, customSkillUnlocked, skillMods, battle1Cleared, onUpgradeSkillMod, customSkillDef, onSaveCustomSkill }) => {
  const [editingCustomSkill, setEditingCustomSkill] = useState(false);
  // The one Core-slot target BATTLE_SKILLS can't supply itself -- only
  // exists as a Modifier Panel target once a design has actually been
  // saved, same "requiresLearn"-style gating idea as Circuit Sigil but
  // driven by customSkillDef instead of craftedSkillIds.
  const modifierTargets = customSkillDef
    ? [...STATIC_MODIFIER_TARGETS, {
        id:'customSkill', name:customSkillDef.name,
        icon:CUSTOM_SKILL_ELEMENTS.find(e=>e.id===(customSkillDef.element ?? null)).icon,
        color:'#9b6cff', coreId:null, group:'core', requiresLearn:false,
      }]
    : STATIC_MODIFIER_TARGETS;
  return (
    <div style={{maxWidth:820,margin:'0 auto',padding:'24px 20px 60px',width:'100%'}}>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:8,flexWrap:'wrap'}}>
        <div style={{width:56,height:56,borderRadius:8,background:'rgba(255,136,68,0.1)',border:'1px solid #ff8844',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>🔧</div>
        <div>
          <h1 style={{fontFamily:"'Advent Pro',sans-serif",fontSize:'1.4rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'#ff8844',margin:0}}>Synthesis Lab</h1>
          <div style={{fontSize:12,color:'#7a9db5'}}>Craft new Battle Skills for your Proxie.</div>
        </div>
        <div style={{marginLeft:'auto',fontSize:13,color:'#ffd700',fontWeight:'bold'}}>{hexas ?? 0} Hexas</div>
      </div>

      <div style={{fontSize:11,color:'#5a7a8a',lineHeight:1.7,marginBottom:24,maxWidth:640}}>
        Recipes unlock new Battle Skills, same shape as the ones you start with — a range, a damage or stat output, a tile footprint, and how it moves you. Once learned, a skill shows up as an equippable option in any loadout picker.
      </div>

      <h2 style={{fontSize:'0.78rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#00c8ff',borderBottom:'1px solid #1e3a4a',paddingBottom:8,marginBottom:16}}>Available Recipes</h2>
      {RECIPES.map(recipe=>{
        const skill = BATTLE_SKILLS.find(s=>s.id===recipe.skillId);
        if(!skill) return null;
        return (
          <RecipeCard key={recipe.skillId} skill={skill} recipe={recipe} learned={isSkillUnlocked(skill, craftedSkillIds)}
            locked={!!recipe.campaignRequired && !campaignCompletedOnce}
            hexas={hexas ?? 0} onLearn={()=>onLearnSkill(skill.id)} />
        );
      })}

      <h2 style={{fontSize:'0.78rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#00c8ff',borderBottom:'1px solid #1e3a4a',paddingBottom:8,margin:'32px 0 16px'}}>Modifier Panel</h2>
      {!battle1Cleared ? (
        <div style={{fontSize:11,color:'#5a7a8a',fontStyle:'italic',padding:'12px 14px',background:'rgba(0,0,0,0.25)',border:'1px solid #1e3a4a',borderRadius:6}}>
          🔒 Clear Battle 1 of the Campaign to unlock the Modifier Panel.
        </div>
      ) : (
        <>
          <div style={{fontSize:11,color:'#5a7a8a',lineHeight:1.7,marginBottom:16,maxWidth:640}}>
            Pick a skill — Core, Foundational, or Elemental — and drag a stat's slider to permanently raise it. Damage adds flat damage; Accuracy adds a percentage on top of everything the roll already earned, capped at +50%. Core skills (your strongest abilities) cost the most Hexas per tier; Foundational and Elemental skills share a cheaper curve, but an Elemental skill also spends a matching Core per tier. Each tier is pricier than the last.
          </div>
          {['core','foundational','elemental'].map(groupId=>{
            const group = SKILL_MOD_GROUPS[groupId];
            const targets = modifierTargets.filter(t=>t.group===groupId);
            if(targets.length===0) return null;
            return (
              <div key={groupId} style={{marginBottom:24}}>
                <div style={{fontSize:10,color:'#5a7a8a',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10}}>{group.label} Skills</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12}}>
                  {targets.map(target => (
                    target.requiresLearn && !craftedSkillIds.includes(target.id) ? (
                      <LockedModifierCard key={target.id} target={target} />
                    ) : (
                      <ModifierCard key={target.id} target={target}
                        skillMods={skillMods?.[target.id]}
                        hexas={hexas ?? 0}
                        coreCount={target.coreId ? (materials?.[target.coreId] ?? 0) : 0}
                        onUpgrade={(statId,targetTier)=>onUpgradeSkillMod(target.id,statId,targetTier)} />
                    )
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      <h2 style={{fontSize:'0.78rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#00c8ff',borderBottom:'1px solid #1e3a4a',paddingBottom:8,margin:'32px 0 16px'}}>
        Custom Synthesis
        {customSkillUnlocked && <span style={{marginLeft:10,fontSize:9,color:'#9b6cff',letterSpacing:'0.15em',border:'1px solid #9b6cff66',borderRadius:4,padding:'2px 8px',verticalAlign:'middle'}}>◈ UNLOCKED</span>}
      </h2>
      {!customSkillUnlocked ? (
        <div style={{fontSize:11,color:'#5a7a8a',fontStyle:'italic',padding:'12px 14px',background:'rgba(0,0,0,0.25)',border:'1px solid #1e3a4a',borderRadius:6}}>
          🔒 Unlocks the first time your Proxie levels up in battle.
        </div>
      ) : (
        <div style={{background:'rgba(10,18,28,0.7)',border:'1px solid #2a4a5e',borderRadius:10,padding:'18px 20px'}}>
          <div style={{fontSize:12,color:'#5a7a8a',lineHeight:1.6,marginBottom:16}}>
            Design your own skill's shape, a Damage value, an Element, and any if/then Special Effects (Burn, Flood, Rubble, Knockback). It counts as a Core skill in the Modifier Panel above once saved.
          </div>
          {editingCustomSkill || !customSkillDef ? (
            <CustomSkillEditor existing={customSkillDef} onSave={(def)=>{ onSaveCustomSkill(def); setEditingCustomSkill(false); }} />
          ) : (
            <CustomSkillSummary def={customSkillDef} onEdit={()=>setEditingCustomSkill(true)} />
          )}
        </div>
      )}
    </div>
  );
};

export default CraftingScreen;
