import React, { useState } from 'react';
import { CharacterCreatorForm, BATTLE_SKILLS, ELEMENTS, getXPThreshold } from './GridBattlerGame.jsx';

const MAX_CHARACTER_SLOTS = 3;

const StatBar = ({ label, current, max, color }) => {
  const pct = max > 0 ? Math.max(0, Math.min(100, (current / max) * 100)) : 0;
  return (
    <div style={{marginBottom:10}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#7a9db5',marginBottom:4}}>
        <span>{label}</span><span style={{color,fontWeight:'bold'}}>{current} / {max}</span>
      </div>
      <div style={{height:10,background:'#0a1218',border:'1px solid #1e3a4a',borderRadius:3,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,transition:'width 0.3s'}} />
      </div>
    </div>
  );
};

const EmptySlotCard = ({ onCreate }) => (
  <button onClick={onCreate}
    style={{background:'rgba(10,18,28,0.6)',border:'1px dashed #2a4a5e',borderRadius:10,padding:'28px 16px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,cursor:'pointer',color:'#5a7a8a',minHeight:180}}>
    <span style={{fontSize:28}}>+</span>
    <span style={{fontSize:12,fontWeight:'bold',letterSpacing:'0.05em',textTransform:'uppercase'}}>Create Character</span>
  </button>
);

// The slot currently running Campaign shows live stats pulled from
// liveState (the same onStateSync mirror the old Gauntlet-only version of
// this screen used) instead of the static saved build, since HP/level/XP
// only exist once a session is actually live.
const ActiveSlotCard = ({ character, liveState, onOpen }) => {
  const player = liveState?.player;
  const loadoutMeta = (liveState?.loadout || character.loadout).map(id=>BATTLE_SKILLS.find(s=>s.id===id)).filter(Boolean);
  return (
    <div style={{background:'rgba(10,18,28,0.92)',border:'1px solid #00c8ff',borderRadius:10,padding:'16px 18px',boxShadow:'0 0 16px rgba(0,200,255,0.15)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:'bold',color:'#00c8ff'}}>{character.name}</div>
          <div style={{fontSize:10,color:'#7a9db5'}}>Level {player?.level ?? 1}{liveState?.wave ? ` · Wave ${liveState.wave}` : ''}</div>
        </div>
        <span style={{fontSize:9,color:'#00cc66',fontWeight:'bold',letterSpacing:'0.08em',border:'1px solid #1e6a3a',borderRadius:4,padding:'4px 9px',background:'rgba(0,200,100,0.1)'}}>▸ IN PROGRESS</span>
      </div>
      {player && (
        <>
          <StatBar label="Health" current={player.health} max={player.maxHealth} color="#00cc66" />
          <StatBar label="Experience" current={player.playerXp} max={getXPThreshold(player.level)} color="#ffd700" />
        </>
      )}
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',margin:'10px 0'}}>
        {loadoutMeta.map(m=>(
          <div key={m.id} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',background:`${m.color}18`,border:`1px solid ${m.color}66`,borderRadius:5}}>
            <span style={{fontSize:12}}>{m.icon}</span><span style={{color:m.color,fontWeight:'bold',fontSize:10}}>{m.name}</span>
          </div>
        ))}
        <div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',background:`${ELEMENTS.base[character.element].color}18`,border:`1px solid ${ELEMENTS.base[character.element].color}66`,borderRadius:5}}>
          <span style={{fontSize:12}}>{ELEMENTS.base[character.element].icon}</span><span style={{color:ELEMENTS.base[character.element].color,fontWeight:'bold',fontSize:10}}>{character.element}</span>
        </div>
      </div>
      <button onClick={onOpen}
        style={{width:'100%',padding:9,background:'rgba(0,200,255,0.14)',border:'1px solid #00c8ff',borderRadius:6,color:'#00c8ff',fontSize:11,fontWeight:'bold',letterSpacing:'0.06em',cursor:'pointer'}}>
        Resume Campaign
      </button>
    </div>
  );
};

// A saved build not currently running -- launch it (starts a brand new
// Campaign, locking this loadout/element in for the run), edit it, or
// delete it. Launch is disabled while a *different* character is already
// mid-run, since only one Campaign session can exist at a time.
const SavedSlotCard = ({ character, launchDisabled, onLaunch, onEdit, onDelete }) => {
  const loadoutMeta = character.loadout.map(id=>BATTLE_SKILLS.find(s=>s.id===id)).filter(Boolean);
  const elMeta = ELEMENTS.base[character.element];
  return (
    <div style={{background:'rgba(10,18,28,0.9)',border:'1px solid #1e3a4a',borderRadius:10,padding:'16px 18px'}}>
      <div style={{fontSize:15,fontWeight:'bold',color:'#b0dff4',marginBottom:8}}>{character.name}</div>
      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:14}}>
        {loadoutMeta.map(m=>(
          <div key={m.id} style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',background:`${m.color}18`,border:`1px solid ${m.color}66`,borderRadius:5}}>
            <span style={{fontSize:12}}>{m.icon}</span><span style={{color:m.color,fontWeight:'bold',fontSize:10}}>{m.name}</span>
          </div>
        ))}
        <div style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',background:`${elMeta.color}18`,border:`1px solid ${elMeta.color}66`,borderRadius:5}}>
          <span style={{fontSize:12}}>{elMeta.icon}</span><span style={{color:elMeta.color,fontWeight:'bold',fontSize:10}}>{character.element}</span>
        </div>
      </div>
      <button onClick={onLaunch} disabled={launchDisabled}
        style={{width:'100%',padding:9,marginBottom:8,background:launchDisabled?'rgba(20,30,40,0.6)':'rgba(204,68,34,0.16)',border:`1px solid ${launchDisabled?'#1e3a4a':'#cc4422'}`,borderRadius:6,color:launchDisabled?'#2a4a5e':'#ff8866',fontSize:11,fontWeight:'bold',letterSpacing:'0.06em',cursor:launchDisabled?'not-allowed':'pointer'}}>
        {launchDisabled ? 'Another Campaign in progress' : 'Launch Campaign'}
      </button>
      <div style={{display:'flex',gap:8}}>
        <button onClick={onEdit}
          style={{flex:1,padding:7,background:'rgba(20,30,40,0.6)',border:'1px solid #1e3a4a',borderRadius:6,color:'#7a9db5',fontSize:11,fontWeight:'bold',cursor:'pointer'}}>
          Edit
        </button>
        <button onClick={onDelete}
          style={{flex:1,padding:7,background:'rgba(255,68,68,0.08)',border:'1px solid #6a2a2a',borderRadius:6,color:'#ff6666',fontSize:11,fontWeight:'bold',cursor:'pointer'}}>
          Delete
        </button>
      </div>
    </div>
  );
};

// Up to MAX_CHARACTER_SLOTS saved Proxy builds -- create/edit/delete freely,
// launch Campaign from whichever slot you want to play. Campaign itself no
// longer has its own character-creation step (see CharacterCreatorForm in
// GridBattlerGame.jsx); App.jsx routes any attempt to start a new run
// through this screen instead, so a build always exists before the first
// battle does.
const CharacterScreen = ({ characters, craftedSkillIds=[], activeCharacterId, campaignStarted, liveState, onSaveCharacter, onDeleteCharacter, onLaunchCampaign }) => {
  const [editingSlot, setEditingSlot] = useState(null);

  if(editingSlot!==null){
    const existing = characters[editingSlot];
    return (
      <div style={{maxWidth:560,margin:'0 auto',padding:'24px 20px 60px',width:'100%'}}>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',color:'#00c8ff'}}>// Character Slot {editingSlot+1}</div>
          <h1 style={{fontFamily:"'Advent Pro',sans-serif",fontSize:'1.3rem',letterSpacing:'0.1em',textTransform:'uppercase',color:'#00c8ff',margin:'4px 0 0'}}>{existing ? 'Edit Proxie' : 'New Proxie'}</h1>
        </div>
        <CharacterCreatorForm
          initial={existing}
          craftedSkillIds={craftedSkillIds}
          submitLabel={existing ? 'Save Changes' : 'Create Character'}
          onSubmit={(data)=>{ onSaveCharacter(editingSlot, data); setEditingSlot(null); }}
          onCancel={()=>setEditingSlot(null)}
        />
      </div>
    );
  }

  return (
    <div style={{maxWidth:960,margin:'0 auto',padding:'24px 20px 60px',width:'100%'}}>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:8,flexWrap:'wrap'}}>
        <div style={{width:56,height:56,borderRadius:8,background:'rgba(0,200,255,0.1)',border:'1px solid #00c8ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>🪪</div>
        <div>
          <h1 style={{fontFamily:"'Advent Pro',sans-serif",fontSize:'1.4rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'#00c8ff',margin:0}}>Character</h1>
          <div style={{fontSize:12,color:'#7a9db5'}}>Up to {MAX_CHARACTER_SLOTS} saved Proxy builds. Launching Campaign locks a build in for the run.</div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:14,marginTop:24}}>
        {Array.from({length:MAX_CHARACTER_SLOTS}).map((_,i)=>{
          const character = characters[i];
          if(!character) return <EmptySlotCard key={i} onCreate={()=>setEditingSlot(i)} />;
          const isActive = campaignStarted && character.id===activeCharacterId;
          if(isActive) return <ActiveSlotCard key={i} character={character} liveState={liveState} onOpen={()=>onLaunchCampaign(character.id)} />;
          return (
            <SavedSlotCard key={i} character={character}
              launchDisabled={campaignStarted}
              onLaunch={()=>onLaunchCampaign(character.id)}
              onEdit={()=>setEditingSlot(i)}
              onDelete={()=>onDeleteCharacter(i)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default CharacterScreen;
