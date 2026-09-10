import React, { useState } from 'react';
import WaterBackground from './WaterBackground.jsx';

// Display order per product decision: Campaign (the flagship arc) leads,
// then Training, then the locked Arena teaser. Selecting Campaign with no
// run already in progress routes to CharacterScreen instead of launching
// directly (see App.jsx's goTo) -- a run only ever starts from a saved
// character's own "Launch Campaign" button.
const MODES = [
  { id:'campaign', name:'Campaign', icon:'📜', color:'#cc4422', locked:false,
    desc:'Fight through an army. Five escalating squad battles — from a trio of single-skill grunts to a lone Full Proxie finale.' },
  { id:'training', name:'Training Mode', icon:'🧭', color:'#00cc66', locked:false,
    desc:'A tutorial hub of focused practice scenes — movement, classes, and elements, each teachable in isolation. No grind.' },
  { id:'arena', name:'Arena', icon:'🛡', color:'#5a7a8a', locked:true,
    desc:'Head-to-head Proxy combat.' },
  { id:'explore', name:'Web Exploration', icon:'🌐', color:'#00cc66', locked:false,
    desc:'Browse the web as a 3D world — collect Hexas and Materials from the sites you visit.' },
];

const NAV_ITEMS = [
  { id:'character', label:'Character', icon:'🪪', color:'#00c8ff' },
  { id:'profile',   label:'Profile',   icon:'👤', color:'#5aa9c9' },
  { id:'inventory', label:'Inventory', icon:'🎒', color:'#c9a227' },
  { id:'crafting',  label:'Crafting',  icon:'🔧', color:'#ff8844' },
  { id:'social',    label:'Social',    icon:'💬', color:'#d966b3' },
];

// Mode-select picker — opened from the single PLAY button instead of a
// permanent grid on the main screen, so Navigation gets the visual room.
// `modes` defaults to the full extension-build MODES list; the mobile
// Artifact build passes a trimmed array instead (see AppMobile.jsx).
const ModePickerModal = ({show, onSelect, onClose, hasActiveCampaignSession, modes=MODES}) => {
  if(!show) return null;
  return (
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2500,padding:20}}>
      <div onClick={e=>e.stopPropagation()} style={{background:'#080e14',border:'2px solid #00c8ff',borderRadius:10,padding:'1.4rem',maxWidth:760,width:'100%',maxHeight:'85vh',overflowY:'auto',boxShadow:'0 0 40px rgba(0,200,255,0.27)',color:'#b0dff4'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,borderBottom:'1px solid #1e3a4a',paddingBottom:10}}>
          <div style={{fontSize:'0.9rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'#00c8ff'}}>Select Mode</div>
          <button onClick={onClose} style={{background:'transparent',border:'none',color:'#3a6a8a',cursor:'pointer',fontSize:18}}>X</button>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>
          {modes.map(m=>(
            <div key={m.id} onClick={()=>!m.locked&&onSelect(m.id)}
              style={{background:'rgba(10,18,28,0.9)',border:`1px solid ${m.locked?'#1e3a4a':`${m.color}66`}`,borderRadius:10,padding:'18px 16px',cursor:m.locked?'not-allowed':'pointer',opacity:m.locked?0.55:1,transition:'border-color 0.15s'}}
              onMouseEnter={e=>{if(!m.locked)e.currentTarget.style.borderColor=m.color;}}
              onMouseLeave={e=>{if(!m.locked)e.currentTarget.style.borderColor=`${m.color}66`;}}>
              <div style={{fontSize:26,marginBottom:8}}>{m.locked?'🔒':m.icon}</div>
              <div style={{fontSize:14,fontWeight:'bold',color:m.locked?'#5a7a8a':m.color,marginBottom:6}}>{m.name}</div>
              <div style={{fontSize:11,color:'#7a9db5',lineHeight:1.5}}>{m.desc}</div>
              {!m.locked && m.id==='campaign' && hasActiveCampaignSession && (
                <div style={{marginTop:10,fontSize:10,color:'#00cc66',fontWeight:'bold',letterSpacing:'0.05em'}}>▸ SESSION IN PROGRESS — RESUME</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StartScreen = ({ onSelectMode, onNavigate, hasActiveCampaignSession, modes=MODES, navItems=NAV_ITEMS }) => {
  const [showModePicker, setShowModePicker] = useState(false);

  return (
    <div style={{position:'relative',minHeight:'100vh',overflow:'hidden',background:'#05090e',color:'#b0dff4',fontFamily:"'Rajdhani','Share Tech Mono',sans-serif",display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 20px 60px'}}>
      <WaterBackground />
      {/* Darkens the water toward the edges so title/nav text and card
          borders keep contrast without hiding the animation entirely. */}
      <div style={{position:'absolute',inset:0,zIndex:1,pointerEvents:'none',background:'linear-gradient(to bottom, rgba(5,9,14,0.88) 0%, rgba(5,9,14,0.32) 30%, rgba(5,9,14,0.42) 65%, rgba(5,9,14,0.92) 100%)'}} />

      <div style={{position:'relative',zIndex:2,display:'flex',flexDirection:'column',alignItems:'center',width:'100%'}}>
        <div style={{fontSize:11,letterSpacing:'0.3em',color:'#3a6a8a',textTransform:'uppercase',marginBottom:10,fontFamily:'monospace'}}>// cyberworld access terminal //</div>
        <h1 style={{fontFamily:"'Advent Pro',sans-serif",fontSize:'3.2rem',fontWeight:700,letterSpacing:'0.16em',textTransform:'uppercase',color:'#00c8ff',textShadow:'0 0 30px rgba(0,200,255,0.5)',margin:0}}>Paradigm</h1>
        <div style={{fontSize:'0.9rem',letterSpacing:'0.3em',color:'#5a7a8a',textTransform:'uppercase',marginTop:6}}>Grid Battler</div>
        <div style={{fontSize:12,color:'#3a5a6a',marginTop:14,maxWidth:480,textAlign:'center',lineHeight:1.6}}>
          Jack in. Master the four elements. Survive the grid.
        </div>

        <button onClick={()=>setShowModePicker(true)}
          style={{marginTop:40,padding:'18px 64px',background:'rgba(0,200,255,0.14)',border:'1px solid #00c8ff',borderRadius:8,color:'#00c8ff',fontSize:20,fontWeight:700,letterSpacing:'0.2em',textTransform:'uppercase',cursor:'pointer',fontFamily:"'Rajdhani',sans-serif",boxShadow:'0 0 24px rgba(0,200,255,0.18)'}}>
          ▶ Play
        </button>
        {hasActiveCampaignSession && (
          <div style={{marginTop:10,fontSize:11,color:'#00cc66',fontWeight:'bold',letterSpacing:'0.05em'}}>▸ SESSION IN PROGRESS — RESUME</div>
        )}

        <div style={{width:'100%',maxWidth:760,marginTop:56}}>
          <div style={{fontSize:'0.72rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'#00c8ff',borderBottom:'1px solid #1e3a4a',paddingBottom:8,marginBottom:16}}>Navigation</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
            {navItems.map(n=>(
              <div key={n.id} onClick={()=>onNavigate(n.id)}
                style={{background:'rgba(10,18,28,0.8)',border:`1px solid ${n.color}44`,borderRadius:8,padding:'14px 10px',textAlign:'center',cursor:'pointer',transition:'border-color 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=n.color}
                onMouseLeave={e=>e.currentTarget.style.borderColor=`${n.color}44`}>
                <div style={{fontSize:22,marginBottom:6}}>{n.icon}</div>
                <div style={{fontSize:11,color:n.color,fontWeight:'bold',letterSpacing:'0.05em',textTransform:'uppercase'}}>{n.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{marginTop:50,fontSize:10,letterSpacing:'0.15em',color:'#2a4a5e',fontFamily:'monospace'}}>v4.3 // system nominal</div>
      </div>

      <ModePickerModal
        show={showModePicker}
        onSelect={(id)=>{ setShowModePicker(false); onSelectMode(id); }}
        onClose={()=>setShowModePicker(false)}
        hasActiveCampaignSession={hasActiveCampaignSession}
        modes={modes}
      />
    </div>
  );
};

export default StartScreen;
