import React from 'react';
import { ELEMENTS, getXPThreshold, UNLOCKABLE_CLASSES } from './GridBattlerGame.jsx';

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

// Real character data pulled from the live Gauntlet session via App's
// onStateSync mirror (see GridBattlerGame's sync effect) — this screen has
// no state of its own, it just reads whatever the last session reported.
const CharacterScreen = ({ liveState, hasActiveSession, onLaunch }) => {
  if(!hasActiveSession || !liveState?.player){
    return (
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,minHeight:'70vh',textAlign:'center',padding:'2rem'}}>
        <div style={{fontSize:56}}>🪪</div>
        <h1 style={{fontFamily:"'Advent Pro',sans-serif",fontSize:'1.5rem',letterSpacing:'0.16em',textTransform:'uppercase',color:'#00c8ff',margin:0}}>No Active Proxy</h1>
        <div style={{color:'#7a9db5',fontSize:13,maxWidth:380,lineHeight:1.6}}>
          No Proxy has been deployed to the grid yet. Launch Gauntlet Test Mode to instantiate one.
        </div>
        <button onClick={onLaunch}
          style={{padding:'10px 22px',background:'rgba(0,200,255,0.14)',border:'1px solid #00c8ff',borderRadius:6,color:'#00c8ff',fontSize:13,fontWeight:700,letterSpacing:'0.08em',cursor:'pointer',fontFamily:"'Rajdhani',sans-serif",textTransform:'uppercase'}}>
          Deploy Proxy
        </button>
      </div>
    );
  }

  const { player, playerClass, wave, hexas } = liveState;
  const xpNeeded = getXPThreshold(player.level);
  const classMeta = playerClass ? UNLOCKABLE_CLASSES.find(c=>c.id===playerClass) : null;
  const allElements = [
    ...Object.entries(ELEMENTS.base).map(([name,d])=>({name,d,cat:'Base'})),
    ...Object.entries(ELEMENTS.minor).map(([name,d])=>({name,d,cat:'Minor Fusion'})),
    ...Object.entries(ELEMENTS.major).map(([name,d])=>({name,d,cat:'Major Fusion'})),
  ];

  return (
    <div style={{maxWidth:960,margin:'0 auto',padding:'24px 20px 60px',width:'100%'}}>
      <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20,flexWrap:'wrap'}}>
        <div style={{width:56,height:56,borderRadius:8,background:'rgba(0,200,255,0.1)',border:'1px solid #00c8ff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>🪪</div>
        <div>
          <h1 style={{fontFamily:"'Advent Pro',sans-serif",fontSize:'1.4rem',letterSpacing:'0.12em',textTransform:'uppercase',color:'#00c8ff',margin:0}}>{player.name}</h1>
          <div style={{fontSize:12,color:'#7a9db5'}}>Level {player.level} · Wave {wave} · <span style={{color:'#ffd700'}}>{hexas} Hexas</span></div>
        </div>
        {classMeta ? (
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8,padding:'6px 12px',background:`${classMeta.color}18`,border:`1px solid ${classMeta.color}66`,borderRadius:6}}>
            <span style={{fontSize:18}}>{classMeta.icon}</span>
            <span style={{color:classMeta.color,fontWeight:'bold',fontSize:13}}>{classMeta.name}</span>
          </div>
        ) : (
          <div style={{marginLeft:'auto',fontSize:11,color:'#3a5a6a',fontStyle:'italic'}}>Unclassed — defeat a boss to unlock a class path</div>
        )}
      </div>

      <div style={{background:'rgba(10,18,28,0.92)',border:'1px solid #1e3a4a',borderRadius:8,padding:18,marginBottom:24}}>
        <StatBar label="Health" current={player.health} max={player.maxHealth} color="#00cc66" />
        <StatBar label="Experience" current={player.playerXp} max={xpNeeded} color="#ffd700" />
        <div style={{display:'flex',gap:24,marginTop:12,fontSize:12,color:'#7a9db5'}}>
          <span>Agility <strong style={{color:'#b0dff4'}}>{player.agi}</strong></span>
          <span>Facing <strong style={{color:'#b0dff4',textTransform:'uppercase'}}>{player.facing}</strong></span>
        </div>
      </div>

      <h2 style={{fontSize:'0.8rem',letterSpacing:'0.15em',textTransform:'uppercase',color:'#00c8ff',borderBottom:'1px solid #1e3a4a',paddingBottom:8,marginBottom:14}}>Elemental Techniques</h2>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10}}>
        {allElements.map(({name,d,cat})=>(
          <div key={name} style={{background:'rgba(10,18,28,0.8)',border:`1px solid ${d.color}44`,borderRadius:6,padding:'10px 12px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <span style={{fontSize:16}}>{d.icon}</span>
              <span style={{color:d.color,fontWeight:'bold',fontSize:13}}>{name}</span>
              <span style={{marginLeft:'auto',fontSize:9,color:'#3a5a6a',textTransform:'uppercase'}}>{cat}</span>
            </div>
            <div style={{fontSize:11,color:'#7a9db5',lineHeight:1.5}}>{d.description}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CharacterScreen;
