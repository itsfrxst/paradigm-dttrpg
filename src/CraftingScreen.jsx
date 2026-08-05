import React from 'react';
import { BATTLE_SKILLS, isSkillUnlocked } from './GridBattlerGame.jsx';

// Recipe-specific info layered on top of a BATTLE_SKILLS entry — the parts
// that matter for a "crafting bench" view (cost, and the stat breakdown
// mapped onto the five customizable axes) rather than in-battle usage text.
// Circuit Sigil is a fixed preset for now; the axes themselves are what a
// future custom-synthesis system will let players actually tune.
const RECIPES = [
  {
    skillId: 'circuitSigil',
    cost: 0, // free during the Crafting dev-unlock phase — recipe costs come online later
    parameters: [
      { label:'Range',    value:'Deploys to your back row (row 7)' },
      { label:'Damage',   value:'30 ATK per summon strike' },
      { label:'Tile AOE', value:'Single target — no splash' },
      { label:'Movement', value:'1 tile forward/turn, 3-tile forward attack arc' },
      { label:'Effects',  value:'Summons a Novice (Bug/Virus/Malware, d100 roll) — Bandwidth 2' },
    ],
  },
];

const CUSTOM_AXES = [
  { label:'Range',    hint:'How far the skill reaches from your Proxie.' },
  { label:'Damage',   hint:'Base damage or stat output per use.' },
  { label:'Tile AOE', hint:'How many tiles the effect covers.' },
  { label:'Movement', hint:'Any repositioning the skill grants.' },
  { label:'Effects',  hint:'Status effects, summons, or other side effects. Eventually.' },
];

const RecipeCard = ({ skill, recipe, learned, hexas, onLearn }) => (
  <div style={{background:'rgba(10,18,28,0.9)',border:`1px solid ${skill.color}66`,borderRadius:10,padding:'18px 20px',marginBottom:14}}>
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
      <span style={{fontSize:28}}>{skill.icon}</span>
      <div style={{flex:1}}>
        <div style={{fontSize:16,fontWeight:'bold',color:skill.color}}>{skill.name}</div>
        <div style={{fontSize:11,color:'#7a9db5'}}>{skill.tagline}</div>
      </div>
      {learned ? (
        <span style={{fontSize:10,color:'#66dd88',fontWeight:'bold',letterSpacing:'0.08em',border:'1px solid #1e6a3a',borderRadius:4,padding:'4px 9px',background:'rgba(0,200,100,0.1)'}}>✓ LEARNED</span>
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

    {!learned && (
      <button onClick={onLearn} disabled={hexas<recipe.cost}
        style={{width:'100%',padding:11,background:hexas>=recipe.cost?`${skill.color}22`:'rgba(20,30,40,0.6)',color:hexas>=recipe.cost?skill.color:'#2a4a5e',border:`1px solid ${hexas>=recipe.cost?skill.color:'#1e3a4a'}`,borderRadius:6,cursor:hexas>=recipe.cost?'pointer':'not-allowed',fontSize:13,fontWeight:'bold',letterSpacing:'0.06em'}}>
        {hexas>=recipe.cost ? `Learn ${skill.name}` : `Need ${recipe.cost - hexas} more Hexas`}
      </button>
    )}
  </div>
);

const CraftingScreen = ({ unlocked, hexas, craftedSkillIds, onLearnSkill }) => {
  if(!unlocked){
    return (
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'4rem 1.5rem',textAlign:'center',gap:16,minHeight:'70vh'}}>
        <div style={{fontSize:64,filter:'drop-shadow(0 0 20px #ff884488)'}}>🔧</div>
        <h1 style={{fontFamily:"'Advent Pro',sans-serif",fontSize:'1.7rem',letterSpacing:'0.18em',textTransform:'uppercase',color:'#ff8844',margin:0,textShadow:'0 0 18px #ff884466'}}>Crafting</h1>
        <div style={{maxWidth:440,color:'#7a9db5',fontSize:14,lineHeight:1.8}}>
          <p style={{margin:'6px 0'}}>Synthesis protocol not yet compiled.</p>
          <p style={{margin:'6px 0'}}>Complete the Campaign to bring it online.</p>
        </div>
      </div>
    );
  }

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
            hexas={hexas ?? 0} onLearn={()=>onLearnSkill(skill.id)} />
        );
      })}

      <h2 style={{fontSize:'0.78rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#00c8ff',borderBottom:'1px solid #1e3a4a',paddingBottom:8,margin:'32px 0 16px'}}>Custom Synthesis</h2>
      <div style={{background:'rgba(10,18,28,0.7)',border:'1px dashed #2a4a5e',borderRadius:10,padding:'18px 20px'}}>
        <div style={{fontSize:12,color:'#5a7a8a',lineHeight:1.6,marginBottom:16}}>
          Tune your own skill from scratch across these axes. In development — recipes above are fixed presets until this comes online.
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10}}>
          {CUSTOM_AXES.map(axis=>(
            <div key={axis.label} style={{background:'#0a1218',border:'1px solid #1e3a4a',borderRadius:6,padding:'10px 12px',opacity:0.55}}>
              <div style={{fontSize:10,color:'#5a7a8a',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:4}}>{axis.label}</div>
              <input type="range" disabled style={{width:'100%',marginBottom:6}} />
              <div style={{fontSize:9,color:'#3a5a6a',lineHeight:1.4}}>{axis.hint}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CraftingScreen;
