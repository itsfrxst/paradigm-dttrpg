import React from 'react';

const NAV_ITEMS = [
  { id:'gauntlet',  label:'Gauntlet',  icon:'⚔' },
  { id:'character', label:'Character', icon:'🪪' },
  { id:'profile',   label:'Profile',   icon:'👤' },
  { id:'inventory', label:'Inventory', icon:'🎒' },
  { id:'crafting',  label:'Crafting',  icon:'🔧' },
  { id:'social',    label:'Social',    icon:'💬' },
];

// Persistent top strip for every screen except the start screen itself
// (Gauntlet has its own full-viewport header, so it gets a FloatingMenuButton
// instead — this bar would fight its internal height math).
const NavBar = ({ current, onNavigate, onMenu }) => (
  <div style={{position:'sticky',top:0,zIndex:100,display:'flex',alignItems:'center',gap:6,padding:'10px 16px',background:'rgba(8,14,20,0.95)',borderBottom:'1px solid #1e3a4a',flexWrap:'wrap'}}>
    <button onClick={onMenu}
      style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px',background:'transparent',border:'1px solid #1e3a4a',borderRadius:4,color:'#5a7a8a',fontSize:11,fontWeight:600,letterSpacing:'0.08em',cursor:'pointer',fontFamily:"'Rajdhani',sans-serif",textTransform:'uppercase'}}>
      ◄ Menu
    </button>
    <div style={{width:1,height:20,background:'#1e3a4a',margin:'0 4px'}} />
    {NAV_ITEMS.map(item=>{
      const active = current===item.id;
      return (
        <button key={item.id} onClick={()=>onNavigate(item.id)}
          style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',background:active?'rgba(0,200,255,0.14)':'transparent',border:`1px solid ${active?'#00c8ff':'#1e3a4a'}`,borderRadius:4,color:active?'#00c8ff':'#7a9db5',fontSize:11,fontWeight:600,letterSpacing:'0.06em',cursor:'pointer',fontFamily:"'Rajdhani',sans-serif",textTransform:'uppercase',transition:'all 0.15s'}}>
          <span>{item.icon}</span>{item.label}
        </button>
      );
    })}
  </div>
);

export default NavBar;
