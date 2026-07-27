import React from 'react';

const MODES = [
  { id:'gauntlet', name:'Gauntlet Test Mode', icon:'⚔', color:'#00c8ff', locked:false,
    desc:'Endless wave survival. Face escalating goblins and elemental Wardens.' },
  { id:'training', name:'Training Mode', icon:'🧭', color:'#00cc66', locked:false,
    desc:'A tutorial hub of focused practice scenes — movement, classes, and elements, each teachable in isolation. No grind.' },
  { id:'campaign', name:'Campaign', icon:'📜', color:'#cc4422', locked:false,
    desc:'Fight through an army. Three escalating squad battles — from a pair of single-skill grunts to a lone Full Proxie finale.' },
  { id:'arena', name:'Arena', icon:'🛡', color:'#5a7a8a', locked:true,
    desc:'Head-to-head Proxy combat.' },
];

const NAV_ITEMS = [
  { id:'character', label:'Character', icon:'🪪', color:'#00c8ff' },
  { id:'profile',   label:'Profile',   icon:'👤', color:'#5aa9c9' },
  { id:'inventory', label:'Inventory', icon:'🎒', color:'#c9a227' },
  { id:'crafting',  label:'Crafting',  icon:'🔧', color:'#ff8844' },
  { id:'social',    label:'Social',    icon:'💬', color:'#d966b3' },
];

const StartScreen = ({ onSelectMode, onNavigate, hasActiveSession, hasActiveCampaignSession }) => (
  <div style={{minHeight:'100vh',background:'#0a0a0a',backgroundImage:'radial-gradient(circle at 50% 0%, rgba(0,200,255,0.08), transparent 60%)',color:'#b0dff4',fontFamily:"'Rajdhani','Share Tech Mono',sans-serif",display:'flex',flexDirection:'column',alignItems:'center',padding:'48px 20px 60px'}}>
    <div style={{fontSize:11,letterSpacing:'0.3em',color:'#3a6a8a',textTransform:'uppercase',marginBottom:10,fontFamily:'monospace'}}>// cyberworld access terminal //</div>
    <h1 style={{fontFamily:"'Advent Pro',sans-serif",fontSize:'3.2rem',fontWeight:700,letterSpacing:'0.16em',textTransform:'uppercase',color:'#00c8ff',textShadow:'0 0 30px rgba(0,200,255,0.5)',margin:0}}>Paradigm</h1>
    <div style={{fontSize:'0.9rem',letterSpacing:'0.3em',color:'#5a7a8a',textTransform:'uppercase',marginTop:6}}>Grid Battler</div>
    <div style={{fontSize:12,color:'#3a5a6a',marginTop:14,maxWidth:480,textAlign:'center',lineHeight:1.6}}>
      Jack in. Master the four elements. Survive the grid.
    </div>

    <div style={{width:'100%',maxWidth:760,marginTop:48}}>
      <div style={{fontSize:'0.72rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'#00c8ff',borderBottom:'1px solid #1e3a4a',paddingBottom:8,marginBottom:16}}>Select Mode</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>
        {MODES.map(m=>(
          <div key={m.id} onClick={()=>!m.locked&&onSelectMode(m.id)}
            style={{background:'rgba(10,18,28,0.9)',border:`1px solid ${m.locked?'#1e3a4a':`${m.color}66`}`,borderRadius:10,padding:'18px 16px',cursor:m.locked?'not-allowed':'pointer',opacity:m.locked?0.55:1,transition:'border-color 0.15s'}}
            onMouseEnter={e=>{if(!m.locked)e.currentTarget.style.borderColor=m.color;}}
            onMouseLeave={e=>{if(!m.locked)e.currentTarget.style.borderColor=`${m.color}66`;}}>
            <div style={{fontSize:26,marginBottom:8}}>{m.locked?'🔒':m.icon}</div>
            <div style={{fontSize:14,fontWeight:'bold',color:m.locked?'#5a7a8a':m.color,marginBottom:6}}>{m.name}</div>
            <div style={{fontSize:11,color:'#7a9db5',lineHeight:1.5}}>{m.desc}</div>
            {!m.locked && m.id==='gauntlet' && hasActiveSession && (
              <div style={{marginTop:10,fontSize:10,color:'#00cc66',fontWeight:'bold',letterSpacing:'0.05em'}}>▸ SESSION IN PROGRESS — RESUME</div>
            )}
            {!m.locked && m.id==='campaign' && hasActiveCampaignSession && (
              <div style={{marginTop:10,fontSize:10,color:'#00cc66',fontWeight:'bold',letterSpacing:'0.05em'}}>▸ SESSION IN PROGRESS — RESUME</div>
            )}
          </div>
        ))}
      </div>
    </div>

    <div style={{width:'100%',maxWidth:760,marginTop:40}}>
      <div style={{fontSize:'0.72rem',letterSpacing:'0.2em',textTransform:'uppercase',color:'#00c8ff',borderBottom:'1px solid #1e3a4a',paddingBottom:8,marginBottom:16}}>Navigation</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10}}>
        {NAV_ITEMS.map(n=>(
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
);

export default StartScreen;
