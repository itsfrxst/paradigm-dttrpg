import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createExploreScene } from './explore/ExploreScene.js';
import {
  getActiveTabPortalData, getWorldConfiguration, navigateActiveTabAndWait,
  getCustomPortalDestinations, addCustomPortalDestination, removeCustomPortalDestination,
  checkOwnerStatus, verifyOwnerPassphrase, clearOwnerAuth,
  getEditorPreferences, saveEditorPreferences,
} from './explore/worldData.js';
import { generateCollectiblesForDomain, rollCollectibleReward } from './explore/collectibles.js';
import { isExtensionContext } from './storage.js';
import { rarityById } from './ItemData.jsx';

// WASD/space/shift/arrows/Q/E -> the engine's setKey() names.
const KEY_MAP = {
  KeyA:'a', KeyD:'d', KeyS:'s', KeyW:'w',
  ShiftLeft:'shift', ShiftRight:'shift', Space:'space',
  ArrowLeft:'arrowleft', ArrowRight:'arrowright', KeyQ:'q', KeyE:'e',
};

const PanelBox = ({children, style}) => (
  <div style={{background:'rgba(10,18,28,0.92)', border:'1px solid #1e3a4a', boxShadow:'0 0 12px rgba(0,200,255,0.08)', borderRadius:6, padding:12, ...style}}>
    {children}
  </div>
);

// Browses the web as a 3D world — reads the real active browser tab's
// domain, generates a per-site scene via explore/worldData.js +
// explore/collectibles.js, and renders it with the raw-Three.js engine in
// explore/ExploreScene.js (same pattern as WaterBackground.jsx). Never kept
// mounted across visits (see App.jsx) — always reflects whatever tab is
// active right now.
const ExploreScreen = ({ hexas, materials, goldQuestComplete, onCollect, onGoldFound, onNavigate }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const domainRef = useRef(null);
  const editorPrefsRef = useRef({ color:'#b0dff4', blizzardEnabled:true, gridEnabled:true });

  const [ready, setReady] = useState(false);
  const [activePortalDestinations, setActivePortalDestinations] = useState(null);
  const [activeMerchant, setActiveMerchant] = useState(null);
  const [collectionToast, setCollectionToast] = useState(null);
  const [loadingNav, setLoadingNav] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [ownerPanelOpen, setOwnerPanelOpen] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [editorPrefs, setEditorPrefsState] = useState(editorPrefsRef.current);
  const [questPanelOpen, setQuestPanelOpen] = useState(false);
  const [customPortals, setCustomPortals] = useState([]);
  const [newPortalForm, setNewPortalForm] = useState({name:'', url:'', icon:'🌐', description:''});

  const setEditorPrefs = useCallback((prefs) => {
    editorPrefsRef.current = prefs;
    setEditorPrefsState(prefs);
  }, []);

  const handleCollect = useCallback((reward) => {
    onCollect(reward);
    const tier = rarityById(reward.tierId);
    setCollectionToast({ tierId: reward.tierId, label: tier.label, hexas: reward.hexas, materials: reward.materials });
    setTimeout(() => setCollectionToast(null), 2500);
    if (reward.tierId === 'icosahedron' && !goldQuestComplete) onGoldFound();
  // goldQuestComplete deliberately omitted -- this callback is handed to the
  // engine once at mount and shouldn't be recreated; onGoldFound itself is a
  // no-op past the first call (App.jsx guards on the same flag).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onCollect, onGoldFound]);

  const loadForDomain = useCallback(async (domain, worldConfig) => {
    worldConfig.collectibles = generateCollectiblesForDomain(domain);

    if (worldConfig.hasCustomPortal) {
      const custom = await getCustomPortalDestinations();
      setCustomPortals(custom);
      if (custom.length > 0) worldConfig.portalDestinations = custom;
    }

    const owner = await checkOwnerStatus(domain);
    setIsOwner(owner);
    let prefs = editorPrefsRef.current;
    if (owner) {
      prefs = await getEditorPreferences();
      setEditorPrefs(prefs);
    }

    const isFrxst = domain === 'frxst.io' || domain === 'www.frxst.io';
    setAuthPromptOpen(isFrxst && !owner);

    domainRef.current = domain;
    sceneRef.current?.loadWorld(domain, worldConfig, prefs);
  }, [setEditorPrefs]);

  useEffect(() => {
    if (!isExtensionContext) return;
    let cancelled = false;

    sceneRef.current = createExploreScene(containerRef.current, {
      onCollect: handleCollect,
      onPortalTriggered: setActivePortalDestinations,
      onMerchantTriggered: setActiveMerchant,
    });

    (async () => {
      const tabData = await getActiveTabPortalData();
      if (cancelled || !tabData) { setReady(true); return; }
      const worldConfig = getWorldConfiguration(tabData.domain);
      await loadForDomain(tabData.domain, worldConfig);
      if (!cancelled) setReady(true);
    })();

    const handleKeyDown = (e) => { const k = KEY_MAP[e.code]; if (k) sceneRef.current?.setKey(k, true); };
    const handleKeyUp = (e) => { const k = KEY_MAP[e.code]; if (k) sceneRef.current?.setKey(k, false); };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      sceneRef.current?.dispose();
    };
  // Mount-only, deliberately: Explore always reflects "what tab is active
  // right now" rather than resuming a prior session (see App.jsx).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePortalSelect = useCallback(async (dest) => {
    setActivePortalDestinations(null);
    setLoadingNav(true);
    await navigateActiveTabAndWait(dest.url);
    const tabData = await getActiveTabPortalData();
    if (tabData) {
      const worldConfig = getWorldConfiguration(tabData.domain);
      await loadForDomain(tabData.domain, worldConfig);
      onNavigate(tabData.domain);
    }
    setLoadingNav(false);
  }, [loadForDomain, onNavigate]);

  const handlePassphraseSubmit = useCallback(async () => {
    const ok = await verifyOwnerPassphrase(passphraseInput);
    if (ok) {
      setAuthError(false);
      setPassphraseInput('');
      setAuthPromptOpen(false);
      setIsOwner(true);
      const domain = domainRef.current;
      if (domain) await loadForDomain(domain, getWorldConfiguration(domain));
    } else {
      setAuthError(true);
    }
  }, [passphraseInput, loadForDomain]);

  const handleLogout = useCallback(async () => {
    await clearOwnerAuth();
    setIsOwner(false);
    setOwnerPanelOpen(false);
  }, []);

  const updateEditorPrefs = useCallback(async (patch) => {
    const next = { ...editorPrefsRef.current, ...patch };
    setEditorPrefs(next);
    await saveEditorPreferences(next);
    const domain = domainRef.current;
    if (domain) await loadForDomain(domain, getWorldConfiguration(domain));
  }, [setEditorPrefs, loadForDomain]);

  const handleAddCustomPortal = useCallback(async () => {
    if (!newPortalForm.name || !newPortalForm.url) return;
    const updated = await addCustomPortalDestination({ ...newPortalForm });
    setCustomPortals(updated);
    setNewPortalForm({ name:'', url:'', icon:'🌐', description:'' });
    const domain = domainRef.current;
    if (domain) await loadForDomain(domain, getWorldConfiguration(domain));
  }, [newPortalForm, loadForDomain]);

  const handleRemoveCustomPortal = useCallback(async (index) => {
    const updated = await removeCustomPortalDestination(index);
    setCustomPortals(updated);
    const domain = domainRef.current;
    if (domain) await loadForDomain(domain, getWorldConfiguration(domain));
  }, [loadForDomain]);

  const handleSpawnCollectible = useCallback(() => {
    const reward = rollCollectibleReward();
    const tier = rarityById(reward.tierId);
    sceneRef.current?.spawnCollectibleNearPlayer({ tierId: reward.tierId, color: tier.color, name: 'Spawned Cache', reward });
  }, []);

  if (!isExtensionContext) {
    return (
      <div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0a0a0a', color:'#7a9db5', fontFamily:"'Rajdhani',sans-serif", textAlign:'center', padding:20}}>
        <div>
          <div style={{fontSize:40, marginBottom:12}}>🌐</div>
          <div style={{fontSize:16, color:'#00c8ff', marginBottom:6}}>Web Exploration requires the extension popup</div>
          <div style={{fontSize:12}}>This screen reads the browser's active tab — it only works when running as the Paradigm extension.</div>
        </div>
      </div>
    );
  }

  const materialEntries = Object.entries(materials || {}).filter(([, qty]) => qty > 0);

  return (
    <div style={{position:'relative', width:'100%', height:'100vh', overflow:'hidden', background:'#0a0a0a'}}>
      <div ref={containerRef} style={{position:'absolute', inset:0}} />

      {!ready && (
        <div style={{position:'fixed', inset:0, background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center', zIndex:4000, color:'#00c8ff', fontSize:14, letterSpacing:'0.15em', textTransform:'uppercase'}}>
          Scanning current site...
        </div>
      )}

      {/* HUD */}
      <PanelBox style={{position:'fixed', top:10, left:12, zIndex:50, minWidth:160, fontFamily:"'Rajdhani',sans-serif"}}>
        <div style={{fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', color:'#00c8ff', marginBottom:6}}>💎 {hexas} Hexas</div>
        <div style={{fontSize:10, color:'#7a9db5', display:'flex', flexWrap:'wrap', gap:6}}>
          {materialEntries.length === 0
            ? <span>No materials yet</span>
            : materialEntries.map(([id, qty]) => <span key={id}>{qty}×{id}</span>)}
        </div>
      </PanelBox>

      {/* Quest badge */}
      <div style={{position:'fixed', top:10, left:'50%', transform:'translateX(-50%)', zIndex:50}}>
        <button onClick={() => setQuestPanelOpen(o => !o)}
          style={{display:'flex', alignItems:'center', gap:6, padding:'6px 12px', background: goldQuestComplete ? 'rgba(255,215,0,0.16)' : 'rgba(10,18,28,0.9)', border:`1px solid ${goldQuestComplete ? '#ffd700' : '#1e3a4a'}`, borderRadius:6, color: goldQuestComplete ? '#ffd700' : '#5a7a8a', fontSize:11, cursor:'pointer', fontFamily:"'Rajdhani',sans-serif"}}>
          {goldQuestComplete ? '⬡ Gold Badge Earned' : '⬡ ??? Quest'}
        </button>
        {questPanelOpen && (
          <div style={{marginTop:6, background:'#080e14', border:'1px solid #1e3a4a', borderRadius:6, padding:'8px 12px', fontSize:11, color:'#7a9db5', maxWidth:220}}>
            {goldQuestComplete
              ? 'You found a Gold-tier (Legendary) collectible out in the world. Badge earned.'
              : 'Find a Gold-tier collectible somewhere out in the world.'}
          </div>
        )}
      </div>

      {/* Collection toast */}
      {collectionToast && (() => {
        const tier = rarityById(collectionToast.tierId);
        return (
          <div style={{position:'fixed', bottom:30, left:'50%', transform:'translateX(-50%)', zIndex:60, background:'#080e14', border:`1px solid ${tier.color}`, borderRadius:8, padding:'10px 18px', color:tier.color, fontFamily:"'Rajdhani',sans-serif", fontSize:13, boxShadow:`0 0 20px ${tier.color}66`}}>
            {tier.icon} {collectionToast.label} — +{collectionToast.hexas} Hexas
            {collectionToast.materials && Object.entries(collectionToast.materials).map(([id, qty]) => ` · +${qty} ${id}`).join('')}
          </div>
        );
      })()}

      {/* Portal modal */}
      {activePortalDestinations && (
        <div onClick={() => setActivePortalDestinations(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000}}>
          <div onClick={e => e.stopPropagation()} style={{background:'#080e14', border:'2px solid #00c8ff', borderRadius:10, padding:'1.4rem', maxWidth:420, width:'92%', color:'#b0dff4', boxShadow:'0 0 40px rgba(0,200,255,0.3)'}}>
            <div style={{fontSize:'0.9rem', letterSpacing:'0.15em', textTransform:'uppercase', color:'#00c8ff', marginBottom:14}}>Portal Destinations</div>
            {activePortalDestinations.map((dest, i) => (
              <button key={i} onClick={() => handlePortalSelect(dest)}
                style={{display:'block', width:'100%', textAlign:'left', background:'rgba(0,200,255,0.08)', border:'1px solid #00c8ff', color:'#b0dff4', borderRadius:6, padding:'10px 14px', marginBottom:8, cursor:'pointer', fontFamily:"'Rajdhani',sans-serif"}}>
                <div style={{fontSize:14}}>{dest.icon} {dest.name}</div>
                <div style={{fontSize:11, opacity:0.7, marginTop:4}}>{dest.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Merchant placeholder modal -- ported at reduced scope: no item
          catalog, just a "check back later" placeholder (see plan). */}
      {activeMerchant && (
        <div onClick={() => setActiveMerchant(null)} style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000}}>
          <div onClick={e => e.stopPropagation()} style={{background:'#080e14', border:'2px solid #a6a6a6', borderRadius:10, padding:'1.6rem', maxWidth:380, width:'90%', color:'#b0dff4', textAlign:'center'}}>
            <div style={{fontSize:15, color:'#a6a6a6', marginBottom:8}}>{activeMerchant.name}</div>
            <div style={{fontSize:12, color:'#7a9db5', marginBottom:16}}>{activeMerchant.greeting}</div>
            <div style={{fontSize:12, color:'#5a7a8a', fontStyle:'italic', marginBottom:16}}>Check back later — the shop isn't open yet.</div>
            <button onClick={() => setActiveMerchant(null)} style={{padding:'8px 20px', background:'rgba(166,166,166,0.15)', border:'1px solid #a6a6a6', borderRadius:6, color:'#a6a6a6', cursor:'pointer'}}>Close</button>
          </div>
        </div>
      )}

      {/* Loading overlay during a real tab navigation */}
      {loadingNav && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000, color:'#00c8ff', fontSize:16, letterSpacing:'0.1em', textTransform:'uppercase'}}>
          Traveling...
        </div>
      )}

      {/* Owner passphrase prompt */}
      {authPromptOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2500}}>
          <div style={{background:'#080e14', border:'2px solid #b0dff4', borderRadius:10, padding:'1.6rem', maxWidth:340, width:'90%', color:'#b0dff4'}}>
            <div style={{fontSize:13, letterSpacing:'0.1em', textTransform:'uppercase', color:'#b0dff4', marginBottom:12}}>Owner Access</div>
            <input type="password" value={passphraseInput} onChange={e => setPassphraseInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handlePassphraseSubmit(); }}
              placeholder="Passphrase"
              style={{width:'100%', padding:8, background:'#0a0a0a', border:'1px solid #1e3a4a', borderRadius:4, color:'#b0dff4', marginBottom:10, boxSizing:'border-box'}} />
            {authError && <div style={{fontSize:11, color:'#ff6666', marginBottom:10}}>Incorrect passphrase.</div>}
            <div style={{display:'flex', gap:8}}>
              <button onClick={handlePassphraseSubmit} style={{flex:1, padding:8, background:'rgba(0,200,255,0.15)', border:'1px solid #00c8ff', borderRadius:6, color:'#00c8ff', cursor:'pointer'}}>Enter</button>
              <button onClick={() => setAuthPromptOpen(false)} style={{flex:1, padding:8, background:'transparent', border:'1px solid #1e3a4a', borderRadius:6, color:'#5a7a8a', cursor:'pointer'}}>Not Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Owner panel toggle + drawer (bottom-right, away from
          FloatingMenuButton's top-right corner). */}
      {isOwner && (
        <div style={{position:'fixed', bottom:16, right:12, zIndex:50}}>
          <button onClick={() => setOwnerPanelOpen(o => !o)}
            style={{width:36, height:36, borderRadius:6, background:'rgba(8,14,20,0.9)', border:'1px solid #b0dff4', color:'#b0dff4', fontSize:16, cursor:'pointer'}}>
            ⚙
          </button>
          {ownerPanelOpen && (
            <div style={{position:'absolute', bottom:42, right:0, background:'#080e14', border:'1px solid #1e3a4a', borderRadius:8, padding:14, width:260, maxHeight:'70vh', overflowY:'auto', color:'#b0dff4', fontSize:12}}>
              <div style={{fontSize:12, letterSpacing:'0.1em', textTransform:'uppercase', color:'#b0dff4', marginBottom:10}}>Owner Panel</div>

              <label style={{display:'block', marginBottom:10}}>
                Ground color
                <input type="color" value={editorPrefs.color} onChange={e => updateEditorPrefs({ color: e.target.value })} style={{display:'block', marginTop:4, width:'100%', height:28}} />
              </label>

              <label style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                <input type="checkbox" checked={editorPrefs.blizzardEnabled} onChange={e => updateEditorPrefs({ blizzardEnabled: e.target.checked })} /> Blizzard
              </label>
              <label style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
                <input type="checkbox" checked={editorPrefs.gridEnabled} onChange={e => updateEditorPrefs({ gridEnabled: e.target.checked })} /> Grid
              </label>

              <button onClick={handleSpawnCollectible} style={{width:'100%', padding:8, background:'rgba(0,200,255,0.12)', border:'1px solid #00c8ff', borderRadius:6, color:'#00c8ff', cursor:'pointer', marginBottom:12}}>Spawn Collectible</button>

              <div style={{fontSize:11, letterSpacing:'0.08em', textTransform:'uppercase', color:'#7a9db5', marginBottom:6}}>Portal Destinations</div>
              {customPortals.map((p, i) => (
                <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4, fontSize:11}}>
                  <span>{p.icon} {p.name}</span>
                  <button onClick={() => handleRemoveCustomPortal(i)} style={{background:'transparent', border:'none', color:'#ff6666', cursor:'pointer'}}>✕</button>
                </div>
              ))}
              <input placeholder="Name" value={newPortalForm.name} onChange={e => setNewPortalForm(f => ({ ...f, name: e.target.value }))}
                style={{width:'100%', padding:6, marginTop:6, background:'#0a0a0a', border:'1px solid #1e3a4a', borderRadius:4, color:'#b0dff4', boxSizing:'border-box'}} />
              <input placeholder="URL" value={newPortalForm.url} onChange={e => setNewPortalForm(f => ({ ...f, url: e.target.value }))}
                style={{width:'100%', padding:6, marginTop:4, background:'#0a0a0a', border:'1px solid #1e3a4a', borderRadius:4, color:'#b0dff4', boxSizing:'border-box'}} />
              <button onClick={handleAddCustomPortal} style={{width:'100%', padding:6, marginTop:6, background:'rgba(0,200,255,0.12)', border:'1px solid #00c8ff', borderRadius:4, color:'#00c8ff', cursor:'pointer'}}>Add Portal</button>

              <button onClick={handleLogout} style={{width:'100%', padding:8, marginTop:12, background:'transparent', border:'1px solid #1e3a4a', borderRadius:6, color:'#5a7a8a', cursor:'pointer'}}>Log Out</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExploreScreen;
