import React from 'react';
import { TUTORIAL_SCENES } from './GridBattlerGame.jsx';

// Training Mode's scene-select hub — styled like the start screen, scoped to
// the 3 tutorial scenes. Every card is always selectable (no forced order)
// and stays replayable after completion, since this is a practice sandbox
// rather than a persistent run.
const TutorialHub = ({ completedScenes, onSelectScene, onMenu }) => (
  <div style={{minHeight:'100vh',background:'#0a0a0a',backgroundImage:'radial-gradient(circle at 50% 0%, rgba(0,200,255,0.08), transparent 60%)',color:'#b0dff4',fontFamily:"'Rajdhani','Share Tech Mono',sans-serif",display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 20px 60px'}}>
    <button onClick={onMenu}
      style={{position:'fixed',top:16,left:16,display:'flex',alignItems:'center',gap:6,padding:'8px 14px',background:'rgba(8,14,20,0.9)',border:'1px solid #1e3a4a',borderRadius:6,color:'#5a7a8a',fontSize:11,fontWeight:600,letterSpacing:'0.08em',cursor:'pointer',fontFamily:"'Rajdhani',sans-serif",textTransform:'uppercase'}}>
      ◄ Menu
    </button>

    <div style={{fontSize:11,letterSpacing:'0.3em',color:'#3a6a8a',textTransform:'uppercase',marginBottom:10,fontFamily:'monospace'}}>// training sandbox //</div>
    <h1 style={{fontFamily:"'Advent Pro',sans-serif",fontSize:'2.4rem',fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',color:'#00c8ff',textShadow:'0 0 30px rgba(0,200,255,0.5)',margin:0}}>Tutorial Hub</h1>
    <div style={{fontSize:12,color:'#3a5a6a',marginTop:14,maxWidth:480,textAlign:'center',lineHeight:1.6}}>
      Pick a scene. Each one isolates a single mechanic — no grind, no permanent choices. Replay anytime.
    </div>

    <div style={{width:'100%',maxWidth:760,marginTop:44,display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>
      {TUTORIAL_SCENES.map(s=>{
        const done = completedScenes?.includes(s.id);
        return (
          <div key={s.id} onClick={()=>onSelectScene(s.id)}
            style={{background:'rgba(10,18,28,0.9)',border:`1px solid ${s.color}66`,borderRadius:10,padding:'20px 18px',cursor:'pointer',position:'relative',transition:'border-color 0.15s'}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=s.color}
            onMouseLeave={e=>e.currentTarget.style.borderColor=`${s.color}66`}>
            {done&&(
              <div style={{position:'absolute',top:12,right:12,fontSize:10,letterSpacing:'0.1em',color:'#00cc66',border:'1px solid #00663a',background:'rgba(0,200,100,0.1)',borderRadius:4,padding:'2px 7px',textTransform:'uppercase'}}>
                ✓ Cleared
              </div>
            )}
            <div style={{fontSize:28,marginBottom:10}}>{s.icon}</div>
            <div style={{fontSize:15,fontWeight:'bold',color:s.color,marginBottom:8}}>{s.name}</div>
            <div style={{fontSize:11,color:'#7a9db5',lineHeight:1.6}}>{s.blurb}</div>
          </div>
        );
      })}
    </div>

    <div style={{marginTop:50,fontSize:10,letterSpacing:'0.15em',color:'#2a4a5e',fontFamily:'monospace'}}>v4.3 // system nominal</div>
  </div>
);

export default TutorialHub;
