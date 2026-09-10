import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createExploreScene } from './explore/ExploreScene.js';
import {
  getWorldConfiguration,
  getCustomPortalDestinations, addCustomPortalDestination, removeCustomPortalDestination,
  checkOwnerStatus, verifyOwnerPassphrase, clearOwnerAuth,
  getEditorPreferences, saveEditorPreferences,
} from './explore/worldData.js';
import { generateCollectiblesForDomain, rollCollectibleReward } from './explore/collectibles.js';
import { rarityById } from './ItemData.jsx';

// Offline variant of ExploreScreen.jsx for the mobile/Artifact build, which
// has no browser.tabs to read a real site from. getWorldConfiguration() and
// everything downstream of it (worldData.js, collectibles.js, the Three.js
// engine in explore/ExploreScene.js) never needed a browser API in the first
// place -- only getActiveTabPortalData()/navigateActiveTabAndWait() did, and
// this file simply never calls them. In their place: a small rotation of
// example domains, auto-picked on mount and re-picked (from the clicked
// portal destination's own URL, same as the real getActiveTabPortalData did)
// whenever the player walks into a portal -- so the world still changes on
// portal use, just without a real tab behind it.
const ROTATION_DOMAINS = [
  'www.google.com', 'frxst.io', 'www.youtube.com', 'www.apple.com',
  'shop.example-store.com', 'news.example-daily.com', 'my-example-blog.net',
];

function pickRandomDomain(excluding) {
  const pool = ROTATION_DOMAINS.filter(d => d !== excluding);
  return pool[Math.floor(Math.random() * pool.length)] || ROTATION_DOMAINS[0];
}

function hostnameFromUrl(url, fallback) {
  try { return new URL(url).hostname; } catch { return fallback; }
}

const KEY_MAP = {
  KeyA:'a', KeyD:'d', KeyS:'s', KeyW:'w',
  ShiftLeft:'shift', ShiftRight:'shift', Space:'space',
  ArrowLeft:'arrowleft', ArrowRight:'arrowright', KeyQ:'q', KeyE:'e',
};

// iOS Safari treats on-screen glyphs/labels as selectable text by default,
// so a press-and-hold on a control (exactly what "hold to move"/"hold to
// sprint" requires) pops the native copy/paste callout instead of just
// registering as a button press. user-select and -webkit-touch-callout both
// inherit, so setting this once on the screen's root container covers every
// descendant; it's also spread directly onto the touch-control buttons
// themselves since those are the ones actually held down.
const NO_CALLOUT_STYLE = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
  MozUserSelect: 'none',
  WebkitTouchCallout: 'none',
  WebkitTapHighlightColor: 'transparent',
};

const PanelBox = ({children, style}) => (
  <div style={{background:'rgba(10,18,28,0.92)', border:'1px solid #1e3a4a', boxShadow:'0 0 12px rgba(0,200,255,0.08)', borderRadius:6, padding:12, ...style}}>
    {children}
  </div>
);

// Touch/mouse d-pad + camera + jump controls -- the real ExploreScreen relies
// entirely on a physical keyboard (WASD/space/Q/E), which doesn't exist on a
// phone. Pointer events unify mouse (desktop testing) and touch (mobile) in
// one handler.
const TouchControls = ({ onKey }) => {
  // Sprint is a toggle (tap on, tap off), not hold-to-sprint like the other
  // buttons -- a glowing border shows which state it's in, since "held down"
  // isn't visible at a glance the way it is with a physical shift key.
  const [sprintOn, setSprintOn] = useState(false);
  const toggleSprint = () => {
    setSprintOn(current => {
      const on = !current;
      onKey('shift', on);
      return on;
    });
  };

  const btnStyle = {
    width:52, height:52, borderRadius:10, background:'rgba(10,18,28,0.85)',
    border:'1px solid #00c8ff', color:'#00c8ff', fontSize:20, display:'flex',
    alignItems:'center', justifyContent:'center', touchAction:'none',
    ...NO_CALLOUT_STYLE,
  };
  const hold = (name) => ({
    onPointerDown: (e) => { e.preventDefault(); onKey(name, true); },
    onPointerUp: (e) => { e.preventDefault(); onKey(name, false); },
    onPointerLeave: () => onKey(name, false),
    onPointerCancel: () => onKey(name, false),
  });

  return (
    <>
      {/* Movement d-pad, bottom-left. bottom uses env(safe-area-inset-bottom)
          (needs viewport-fit=cover in mobile.html's viewport meta) so this
          clears the iPhone home-indicator strip instead of sitting under it. */}
      <div style={{position:'fixed', left:16, bottom:'calc(16px + env(safe-area-inset-bottom))', zIndex:80, display:'grid', gridTemplateColumns:'repeat(3,52px)', gridTemplateRows:'repeat(3,52px)', gap:4}}>
        <div />
        <button style={btnStyle} {...hold('w')}>▲</button>
        <div />
        <button style={btnStyle} {...hold('a')}>◄</button>
        {/* Sprint (toggle, not hold) -- gold/lightning styling so it reads
            as "speed" rather than blending in with the directional buttons;
            a glowing border/fill marks it as currently active. */}
        <button
          style={{
            ...btnStyle,
            borderColor: '#ffd700',
            color: '#ffd700',
            background: sprintOn ? 'rgba(255,215,0,0.22)' : btnStyle.background,
            boxShadow: sprintOn ? '0 0 12px 2px rgba(255,215,0,0.7)' : 'none',
          }}
          onClick={toggleSprint}
        >⚡</button>
        <button style={btnStyle} {...hold('d')}>►</button>
        <div />
        <button style={btnStyle} {...hold('s')}>▼</button>
        <div />
      </div>

      {/* Camera + jump, bottom-right */}
      <div style={{position:'fixed', right:16, bottom:'calc(16px + env(safe-area-inset-bottom))', zIndex:80, display:'flex', flexDirection:'column', alignItems:'center', gap:8}}>
        <button style={{...btnStyle, width:64, height:64, borderRadius:32, borderColor:'#b0dff4', color:'#b0dff4'}} {...hold('space')}>⤒</button>
        <div style={{display:'flex', gap:8}}>
          <button style={btnStyle} {...hold('q')}>‹</button>
          <button style={btnStyle} {...hold('e')}>›</button>
        </div>
      </div>
    </>
  );
};

// Browses an auto-populated 3D world -- same collision/portal/merchant/owner
// mechanics as the extension's ExploreScreen.jsx, minus any dependency on a
// real browser tab. Kept mounted for the lifetime of the mobile build's
// 'explore' screen (unlike the extension version, there's no "real tab"
// state to go stale, so there's no reason to force a remount per visit).
const ExploreScreenOffline = ({ hexas, materials, goldQuestComplete, onCollect, onGoldFound, onNavigate }) => {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const domainRef = useRef(null);
  const editorPrefsRef = useRef({ color:'#b0dff4', blizzardEnabled:true, gridEnabled:true });

  const [ready, setReady] = useState(false);
  const [activePortalDestinations, setActivePortalDestinations] = useState(null);
  const [activeMerchant, setActiveMerchant] = useState(null);
  const [collectionToast, setCollectionToast] = useState(null);
  const [travelPulse, setTravelPulse] = useState(false);
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
    onNavigate?.(domain);
  }, [setEditorPrefs, onNavigate]);

  useEffect(() => {
    let cancelled = false;

    sceneRef.current = createExploreScene(containerRef.current, {
      onCollect: handleCollect,
      onPortalTriggered: setActivePortalDestinations,
      onMerchantTriggered: setActiveMerchant,
    });

    (async () => {
      const domain = pickRandomDomain();
      await loadForDomain(domain, getWorldConfiguration(domain));
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
  // Mount-only -- there's no live tab state to go stale here, so this just
  // sets up once for the screen's lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePortalSelect = useCallback(async (dest) => {
    setActivePortalDestinations(null);
    setTravelPulse(true);
    const nextDomain = hostnameFromUrl(dest.url, pickRandomDomain(domainRef.current));
    // Brief pulse so a portal hop still reads as "traveling" rather than an
    // instant cut, without pretending to wait on a real page load.
    await new Promise(r => setTimeout(r, 500));
    await loadForDomain(nextDomain, getWorldConfiguration(nextDomain));
    setTravelPulse(false);
  }, [loadForDomain]);

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

  const handleReroll = useCallback(async () => {
    const domain = pickRandomDomain(domainRef.current);
    setTravelPulse(true);
    await loadForDomain(domain, getWorldConfiguration(domain));
    setTravelPulse(false);
  }, [loadForDomain]);

  const materialEntries = Object.entries(materials || {}).filter(([, qty]) => qty > 0);

  // 100svh, not 100vh -- mobile Safari sizes 100vh as if its address bar and
  // bottom nav bar are hidden, so a height:100vh + overflow:hidden container
  // gets partially covered by that chrome (the default, chrome-visible
  // state). 100svh is the "small viewport height": always the
  // guaranteed-visible area regardless of chrome state, so nothing ever ends
  // up hidden behind it.
  return (
    <div style={{position:'relative', width:'100%', height:'100svh', overflow:'hidden', background:'#0a0a0a', ...NO_CALLOUT_STYLE}}>
      <div ref={containerRef} style={{position:'absolute', inset:0}} />

      {!ready && (
        <div style={{position:'fixed', inset:0, background:'#0a0a0a', display:'flex', alignItems:'center', justifyContent:'center', zIndex:4000, color:'#00c8ff', fontSize:14, letterSpacing:'0.15em', textTransform:'uppercase'}}>
          Generating world...
        </div>
      )}

      <TouchControls onKey={(name, pressed) => sceneRef.current?.setKey(name, pressed)} />

      {/* HUD */}
      <PanelBox style={{position:'fixed', top:10, left:12, zIndex:50, minWidth:160, fontFamily:"'Rajdhani',sans-serif"}}>
        <div style={{fontSize:11, letterSpacing:'0.1em', textTransform:'uppercase', color:'#00c8ff', marginBottom:6}}>💎 {hexas} Hexas</div>
        <div style={{fontSize:10, color:'#7a9db5', display:'flex', flexWrap:'wrap', gap:6}}>
          {materialEntries.length === 0
            ? <span>No materials yet</span>
            : materialEntries.map(([id, qty]) => <span key={id}>{qty}×{id}</span>)}
        </div>
      </PanelBox>

      {/* Reroll world -- the offline stand-in for "browse to a new site" */}
      <button onClick={handleReroll}
        style={{position:'fixed', top:10, right:12, zIndex:50, padding:'8px 12px', background:'rgba(10,18,28,0.9)', border:'1px solid #1e3a4a', borderRadius:6, color:'#7a9db5', fontSize:11, cursor:'pointer', fontFamily:"'Rajdhani',sans-serif"}}>
        ⟳ New Site
      </button>

      {/* Quest badge */}
      <div style={{position:'fixed', top:56, left:'50%', transform:'translateX(-50%)', zIndex:50}}>
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
          <div style={{position:'fixed', top:100, left:'50%', transform:'translateX(-50%)', zIndex:60, background:'#080e14', border:`1px solid ${tier.color}`, borderRadius:8, padding:'10px 18px', color:tier.color, fontFamily:"'Rajdhani',sans-serif", fontSize:13, boxShadow:`0 0 20px ${tier.color}66`}}>
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

      {/* Merchant placeholder modal */}
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

      {/* Travel pulse (portal hop / reroll) */}
      {travelPulse && (
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

      {/* Owner panel toggle + drawer */}
      {isOwner && (
        <div style={{position:'fixed', bottom:'calc(100px + env(safe-area-inset-bottom))', right:12, zIndex:50}}>
          <button onClick={() => setOwnerPanelOpen(o => !o)}
            style={{width:36, height:36, borderRadius:6, background:'rgba(8,14,20,0.9)', border:'1px solid #b0dff4', color:'#b0dff4', fontSize:16, cursor:'pointer'}}>
            ⚙
          </button>
          {ownerPanelOpen && (
            <div style={{position:'absolute', bottom:42, right:0, background:'#080e14', border:'1px solid #1e3a4a', borderRadius:8, padding:14, width:240, maxHeight:'60vh', overflowY:'auto', color:'#b0dff4', fontSize:12}}>
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

export default ExploreScreenOffline;
