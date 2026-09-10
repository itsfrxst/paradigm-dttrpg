import React from 'react';
import { RARITY_TIERS, EQUIPMENT_SLOTS, ACCESSORY_TYPES, MATERIALS, rarityById } from './ItemData.jsx';

const EquipmentSlot = ({ slot, item }) => (
  <div style={{
    background:'rgba(10,18,28,0.9)', border:`1px solid ${item ? '#c9a22766' : '#1e3a4a'}`,
    borderRadius:8, padding:'14px 12px', textAlign:'center', minHeight:104,
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
  }}>
    <div style={{fontSize:24, opacity:item?1:0.35}}>{item?.icon ?? slot.icon}</div>
    <div style={{fontSize:9, letterSpacing:'0.15em', textTransform:'uppercase', color:'#3a5a6a'}}>{slot.name}</div>
    <div style={{fontSize:12, color:item?'#c9a227':'#3a5a6a', fontWeight:item?'bold':'normal', fontStyle:item?'normal':'italic'}}>
      {item?.name ?? 'Empty'}
    </div>
  </div>
);

const RarityLegend = () => (
  <div style={{display:'flex', gap:16, flexWrap:'wrap', alignItems:'center', marginBottom:24, padding:'10px 16px', border:'1px solid #1e3a4a', borderRadius:8, background:'rgba(10,18,28,0.7)'}}>
    <span style={{fontSize:10, letterSpacing:'0.15em', textTransform:'uppercase', color:'#3a5a6a'}}>Rarity</span>
    {RARITY_TIERS.map(r=>(
      <div key={r.id} style={{display:'flex', alignItems:'center', gap:6, fontSize:11}}>
        <span style={{color:r.color}}>{r.icon}</span>
        <span style={{color:r.color, fontWeight:'bold'}}>{r.name}</span>
        <span style={{color:'#3a5a6a', fontSize:9, textTransform:'uppercase', letterSpacing:'0.1em'}}>{r.label}</span>
      </div>
    ))}
  </div>
);

// Battle drops that haven't been equipped into a slot yet -- there's no
// equip/unequip interaction built yet, so this is just a held-items list
// rather than something draggable onto EquipmentSlot above.
const HeldEquipmentCard = ({ item }) => {
  const rarity = rarityById(item.tier);
  const slotMeta = EQUIPMENT_SLOTS.find(s => s.id === item.slot);
  return (
    <div style={{background:'rgba(10,18,28,0.85)', border:`1px solid ${rarity?.color ?? '#1e3a4a'}44`, borderRadius:8, padding:'12px 14px'}}>
      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
        <span style={{fontSize:16}}>{slotMeta?.icon ?? '◈'}</span>
        <span style={{color:rarity?.color ?? '#b0dff4', fontWeight:'bold', fontSize:13, flex:1}}>{item.name}</span>
        {rarity && <span style={{fontSize:9, color:rarity.color, textTransform:'uppercase', letterSpacing:'0.1em'}}>{rarity.label}</span>}
      </div>
      <div style={{fontSize:10, color:'#5a7a8a', textTransform:'uppercase', letterSpacing:'0.1em'}}>{slotMeta?.name ?? item.slot} slot</div>
    </div>
  );
};

const MaterialCard = ({ material, qty }) => (
  <div style={{background:'rgba(10,18,28,0.85)', border:`1px solid ${material.color}44`, borderRadius:8, padding:'12px 14px', opacity:qty>0?1:0.6}}>
    <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
      <span style={{fontSize:18}}>{material.icon}</span>
      <span style={{color:material.color, fontWeight:'bold', fontSize:13, flex:1}}>{material.name}</span>
      {material.kind==='stat' && (
        <span style={{fontSize:11, fontWeight:'bold', color: material.sign>0 ? '#00cc66' : '#ff4d4d'}}>
          {material.sign>0 ? '▲' : '▼'}
        </span>
      )}
      <span style={{fontSize:12, color:qty>0?'#b0dff4':'#3a5a6a', fontFamily:'monospace'}}>×{qty}</span>
    </div>
    <div style={{fontSize:11, color:'#7a9db5', lineHeight:1.5}}>{material.desc}</div>
  </div>
);

const InventoryScreen = ({ hexas = 0, equipment = {}, materials = {}, equipmentDrops = [] }) => {
  const materialsByTier = RARITY_TIERS.map(tier => ({
    tier,
    items: MATERIALS.filter(m => m.tier === tier.id),
  })).filter(g => g.items.length > 0);

  return (
    <div style={{maxWidth:960, margin:'0 auto', padding:'24px 20px 60px', width:'100%'}}>
      <div style={{display:'flex', alignItems:'center', gap:16, marginBottom:24, flexWrap:'wrap'}}>
        <div style={{width:56, height:56, borderRadius:8, background:'rgba(201,162,39,0.1)', border:'1px solid #c9a227', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0}}>🎒</div>
        <div>
          <h1 style={{fontFamily:"'Advent Pro',sans-serif", fontSize:'1.4rem', letterSpacing:'0.12em', textTransform:'uppercase', color:'#c9a227', margin:0}}>Cyberworld Cache</h1>
          <div style={{fontSize:12, color:'#7a9db5'}}>Equipment loadout and synthesis materials.</div>
        </div>
        <div style={{marginLeft:'auto', fontSize:13, color:'#ffd700', fontWeight:'bold'}}>{hexas} Hexas</div>
      </div>

      <h2 style={{fontSize:'0.8rem', letterSpacing:'0.15em', textTransform:'uppercase', color:'#00c8ff', borderBottom:'1px solid #1e3a4a', paddingBottom:8, marginBottom:14}}>Equipment</h2>
      <div style={{fontSize:11, color:'#5a7a8a', lineHeight:1.7, marginBottom:16, maxWidth:640}}>
        Six slots per Proxy — Helm, Torso, and Legs for armor, plus three open Accessory slots. Any accessory type ({ACCESSORY_TYPES.join(' · ')}) can go in any of the three.
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))', gap:10, marginBottom:24}}>
        {EQUIPMENT_SLOTS.map(slot => (
          <EquipmentSlot key={slot.id} slot={slot} item={equipment[slot.id]} />
        ))}
      </div>

      <div style={{fontSize:10, color:'#3a5a6a', textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:10}}>
        Held (Unequipped) — {equipmentDrops.length}
      </div>
      {equipmentDrops.length > 0 ? (
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10, marginBottom:32}}>
          {equipmentDrops.map(item => <HeldEquipmentCard key={item.id} item={item} />)}
        </div>
      ) : (
        <div style={{fontSize:11, color:'#3a5a6a', fontStyle:'italic', marginBottom:32}}>No equipment found yet — Campaign Rank 2 and up have a chance to drop it.</div>
      )}

      <h2 style={{fontSize:'0.8rem', letterSpacing:'0.15em', textTransform:'uppercase', color:'#00c8ff', borderBottom:'1px solid #1e3a4a', paddingBottom:8, marginBottom:14}}>Materials</h2>
      <div style={{fontSize:11, color:'#5a7a8a', lineHeight:1.7, marginBottom:16, maxWidth:640}}>
        Synthesis materials feed the Crafting bench — four elemental Cores plus a +/- pair each for Damage, Health, and Energy. Rarity reflects how hard a material is to obtain, from common drops to legendary finds.
      </div>
      <RarityLegend />

      {materialsByTier.map(({ tier, items }) => (
        <div key={tier.id} style={{marginBottom:24}}>
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:10}}>
            <span style={{color:tier.color, fontSize:14}}>{tier.icon}</span>
            <span style={{color:tier.color, fontWeight:'bold', fontSize:12, letterSpacing:'0.1em', textTransform:'uppercase'}}>{tier.name}</span>
            <span style={{color:'#3a5a6a', fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em'}}>{tier.label}</span>
            <div style={{flex:1, height:1, background:'#1e3a4a'}} />
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10}}>
            {items.map(material => (
              <MaterialCard key={material.id} material={material} qty={materials[material.id] ?? 0} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default InventoryScreen;
