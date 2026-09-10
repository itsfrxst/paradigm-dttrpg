import React, { useState } from 'react';

const ITEMS = [
  { id:'character', label:'Character', icon:'🪪' },
  { id:'profile',   label:'Profile',   icon:'👤' },
  { id:'inventory', label:'Inventory', icon:'🎒' },
  { id:'crafting',  label:'Crafting',  icon:'🔧' },
  { id:'social',    label:'Social',    icon:'💬' },
  { id:'start',     label:'Main', icon:'◄' },
];

// Fixed-position corner menu shown only while Campaign is active. Campaign
// owns its own full-viewport header and height math (calc(100dvh - 92px)),
// so this stays out of document flow entirely rather than stacking a NavBar
// above it. `items` defaults to the full extension-build list; the mobile
// Artifact build passes a trimmed array instead (see AppMobile.jsx).
const FloatingMenuButton = ({ onNavigate, items=ITEMS }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{position:'fixed',top:10,right:12,zIndex:5000}}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{width:36,height:36,borderRadius:6,background:'rgba(8,14,20,0.9)',border:'1px solid #1e3a4a',color:'#00c8ff',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
        ☰
      </button>
      {open&&(
        <div onMouseLeave={()=>setOpen(false)}
          style={{position:'absolute',top:42,right:0,background:'#080e14',border:'1px solid #1e3a4a',borderRadius:8,padding:6,minWidth:150,boxShadow:'0 8px 24px rgba(0,0,0,0.5)'}}>
          {items.map(item=>(
            <button key={item.id} onClick={()=>{setOpen(false);onNavigate(item.id);}}
              style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'8px 10px',background:'transparent',border:'none',color:'#b0dff4',fontSize:12,cursor:'pointer',textAlign:'left',borderRadius:4,fontFamily:"'Rajdhani',sans-serif"}}
              onMouseEnter={e=>e.currentTarget.style.background='rgba(0,200,255,0.1)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FloatingMenuButton;
