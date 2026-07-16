import React from 'react';

// Shared "not built yet" screen for nav destinations that don't have a
// backing system (items, recipes, accounts, friends) yet. Establishes the
// visual identity for each section so navigation feels real even before the
// systems behind it exist.
const PlaceholderScreen = ({ icon, title, color, lines }) => (
  <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'4rem 1.5rem',textAlign:'center',gap:16,minHeight:'70vh'}}>
    <div style={{fontSize:64,filter:`drop-shadow(0 0 20px ${color}88)`}}>{icon}</div>
    <h1 style={{fontFamily:"'Advent Pro',sans-serif",fontSize:'1.7rem',letterSpacing:'0.18em',textTransform:'uppercase',color,margin:0,textShadow:`0 0 18px ${color}66`}}>{title}</h1>
    <div style={{display:'inline-flex',alignItems:'center',gap:8,fontSize:11,letterSpacing:'0.2em',color:'#3a5a6a',textTransform:'uppercase',fontFamily:'monospace'}}>
      <span style={{width:6,height:6,borderRadius:'50%',background:'#ff4444',boxShadow:'0 0 6px #ff4444',animation:'blinkDot 1.4s infinite'}} />
      module offline
    </div>
    <div style={{maxWidth:440,color:'#7a9db5',fontSize:14,lineHeight:1.8}}>
      {lines.map((l,i)=><p key={i} style={{margin:'6px 0'}}>{l}</p>)}
    </div>
    <style>{`@keyframes blinkDot{0%,100%{opacity:1;}50%{opacity:0.25;}}`}</style>
  </div>
);

export default PlaceholderScreen;
