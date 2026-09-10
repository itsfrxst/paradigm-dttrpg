import { useState, useEffect, useCallback, useMemo } from 'react'
import GridBattlerGame from './GridBattlerGame.jsx'
import StartScreen from './StartScreen.jsx'
import TutorialHub from './TutorialHub.jsx'
import NavBar from './NavBar.jsx'
import FloatingMenuButton from './FloatingMenuButton.jsx'
import CharacterScreen from './CharacterScreen.jsx'
import CraftingScreen from './CraftingScreen.jsx'
import InventoryScreen from './InventoryScreen.jsx'
import PlaceholderScreen from './PlaceholderScreen.jsx'
import ExploreScreen from './ExploreScreen.jsx'
import { storageGet, storageSet, debounce, mergeCounts } from './storage.js'
import { skillModTierCost, skillModMaxTier, MODIFIABLE_ELEMENTS, computeCustomSkillCreationCost } from './ItemData.jsx'

const PLACEHOLDER_CONTENT = {
  profile: {
    icon:'👤', title:'Profile', color:'#5aa9c9',
    lines:[
      'Operator identity matrix uninitialized.',
      'Account sync, achievements, and cosmetic loadouts come online in a future build.',
    ],
  },
  social: {
    icon:'💬', title:'Social', color:'#d966b3',
    lines:[
      'Netlink array unpatched.',
      'Friends, guilds, and messaging come online in a future build.',
    ],
  },
}

const APP_STATE_KEY = 'appState'
const DEFAULT_APP_STATE = {
  hexas: 0,
  materials: {},
  craftedSkillIds: [],
  campaignCompletedOnce: false,
  completedScenes: [],
  visitedDomains: [],
  goldQuestComplete: false,
  skillMods: {},
  battle1Cleared: false,
  customSkillDef: null,
  characters: [null, null, null],
  activeCharacterId: null,
}

function App() {
  const [screen, setScreen] = useState('start')
  const [campaignStarted, setCampaignStarted] = useState(false)
  // Up to 3 saved Proxy builds (name/loadout/element), managed on
  // CharacterScreen.jsx -- fixed-length slots (a null hole is an empty
  // slot) rather than a growable array, so "slot 2" always means the same
  // thing. `activeCharacterId` is whichever one is currently locked into
  // the live Campaign session, if any.
  const [characters, setCharacters] = useState([null, null, null])
  const [activeCharacterId, setActiveCharacterId] = useState(null)
  // Bumped whenever the player backs all the way out to the main menu while
  // Campaign is mounted -- see the matching effect in GridBattlerGame.jsx
  // (keyed off the `leaveSignal` prop) that resets the in-progress battle
  // when this happens mid-fight, now that there's no separate Quit button
  // to do that explicitly.
  const [campaignLeaveSignal, setCampaignLeaveSignal] = useState(0)
  const [liveState, setLiveState] = useState(null)
  // Training Mode: which scene is active, a nonce to force a fresh mount
  // each time a scene is (re)selected (scenes are a practice sandbox, not a
  // persistent session like Gauntlet — no resume-in-progress behavior), and
  // which scenes have been cleared at least once (for the hub's checkmarks).
  const [activeScene, setActiveScene] = useState(null)
  const [sceneNonce, setSceneNonce] = useState(0)
  const [completedScenes, setCompletedScenes] = useState([])
  // Skills learned via Crafting — persists at the app level (not tied to any
  // one Gauntlet/Campaign session) since a crafted skill should carry into
  // every mode once learned, the same way real progression would.
  const [craftedSkillIds, setCraftedSkillIds] = useState([])
  // Whether the Campaign has been won at least once (not just started/quit)
  // — Circuit Sigil specifically stays locked in Crafting until this is
  // true, even though Crafting itself is available from the start now.
  const [campaignCompletedOnce, setCampaignCompletedOnce] = useState(false)

  // Shared hexas/materials pool — the single source of truth Crafting,
  // Inventory, Character, battle sessions (seeded via initialHexas/
  // initialMaterials), and Explore all read from and add into. Persisted
  // via storage.js (browser.storage.local in the extension popup, localStorage
  // under plain `npm run dev`) so progress survives a popup close.
  const [hexas, setHexas] = useState(0)
  const [materials, setMaterials] = useState({})
  const [visitedDomains, setVisitedDomains] = useState([])
  const [goldQuestComplete, setGoldQuestComplete] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  // Modifier Panel: { [skillId]: { damage: tier } } -- tier is 0..10 (each
  // worth +10 damage, see SKILL_MOD_STATS in ItemData.jsx). Permanent,
  // shared across every mode (Gauntlet/Campaign/Training) the same way
  // craftedSkillIds already is. Unlocked once battle1Cleared is true.
  const [skillMods, setSkillMods] = useState({})
  const [battle1Cleared, setBattle1Cleared] = useState(false)
  // Custom Synthesis: the player's one authored skill definition (archetype
  // + tiles/length/warp target, damage, element -- see CraftingScreen.jsx).
  // Null until saved. Counts as a Core skill for Modifier Panel pricing
  // purposes (see SKILL_MOD_GROUPS.core in ItemData.jsx) the moment it
  // exists; not yet wired into actual battle casting -- that's a follow-up
  // once this authoring UI itself is solid.
  const [customSkillDef, setCustomSkillDef] = useState(null)

  // Load persisted state once on mount.
  useEffect(() => {
    let cancelled = false
    storageGet(APP_STATE_KEY, DEFAULT_APP_STATE).then((saved) => {
      if (cancelled) return
      const s = { ...DEFAULT_APP_STATE, ...saved }
      setHexas(s.hexas)
      setMaterials(s.materials)
      setCraftedSkillIds(s.craftedSkillIds)
      setCampaignCompletedOnce(s.campaignCompletedOnce)
      setCompletedScenes(s.completedScenes)
      setVisitedDomains(s.visitedDomains)
      setGoldQuestComplete(s.goldQuestComplete)
      setSkillMods(s.skillMods)
      setBattle1Cleared(s.battle1Cleared)
      setCustomSkillDef(s.customSkillDef)
      setCharacters(s.characters)
      setActiveCharacterId(s.activeCharacterId)
      setHydrated(true)
    })
    return () => { cancelled = true }
  }, [])

  // Debounced save whenever any persisted field changes, gated on hydration
  // so we never overwrite storage with defaults before the load above lands.
  // useMemo (not useCallback wrapping a debounce(...) call) so debounce()
  // itself only runs once -- useCallback still evaluates its first argument
  // expression on every render even though it discards the result after the
  // first, which would otherwise recreate the debounce closure for nothing.
  const saveAppState = useMemo(
    () => debounce((state) => storageSet(APP_STATE_KEY, state), 400),
    []
  )
  useEffect(() => {
    if (!hydrated) return
    saveAppState({ hexas, materials, craftedSkillIds, campaignCompletedOnce, completedScenes, visitedDomains, goldQuestComplete, skillMods, battle1Cleared, customSkillDef, characters, activeCharacterId })
  }, [hydrated, hexas, materials, craftedSkillIds, campaignCompletedOnce, completedScenes, visitedDomains, goldQuestComplete, skillMods, battle1Cleared, customSkillDef, characters, activeCharacterId, saveAppState])

  // Campaign is locked behind CharacterScreen now: selecting it with no run
  // already in progress routes there instead of launching directly (a run
  // only ever starts via a slot's own "Launch Campaign" button, see
  // handleLaunchCampaign) -- resuming an already-started run still goes
  // straight through, same as any other screen. Stepping away from the live
  // battle view to *anywhere* else (Main, Character, Inventory, Crafting,
  // Training, Explore) bumps `campaignLeaveSignal`, which GridBattlerGame
  // reads to reset the in-progress battle if it wasn't already at a
  // decision point (see the matching effect there). This has to be broad,
  // not just the Main button: Crafting's Modifier Panel can change the
  // player's actual stats (Damage/Accuracy tiers) via a prop that's live for
  // as long as this session stays mounted, so ducking into Crafting
  // mid-fight to buy a tier with Hexas earned *in that very fight* and
  // carrying the buff back into it would be a real farming exploit — a
  // fight's stats have to be exactly what they were when it started, so any
  // excursion away from it before it resolves invalidates it, the same as
  // leaving via Main always has. Only fires on the actual transition *out*
  // of campaign (guarded by `screen==='campaign'`), not on every subsequent
  // hop between those other screens, so browsing Character/Inventory/
  // Crafting after having already left doesn't keep re-rolling a fresh
  // battle for no reason.
  const goTo = useCallback((s)=>{
    if(s==='campaign' && !campaignStarted){ setScreen('character'); return }
    if(screen==='campaign' && s!=='campaign' && campaignStarted) setCampaignLeaveSignal(n=>n+1)
    setScreen(s)
  },[screen,campaignStarted])

  const handleCampaignComplete = useCallback((victorious)=>{
    setCampaignStarted(false)
    setActiveCharacterId(null)
    setScreen('start')
    if(victorious) setCampaignCompletedOnce(true)
  },[])

  const handleLaunchCampaign = useCallback((characterId)=>{
    setActiveCharacterId(characterId)
    setCampaignStarted(true)
    setScreen('campaign')
  },[])

  const handleSaveCharacter = useCallback((slotIndex, data)=>{
    setCharacters(prev => prev.map((c,i)=> i===slotIndex ? { id: c?.id || `char${Date.now()}`, ...data } : c))
  },[])

  const handleDeleteCharacter = useCallback((slotIndex)=>{
    const deletedId = characters[slotIndex]?.id
    setCharacters(prev => prev.map((c,i)=> i===slotIndex ? null : c))
    if(deletedId && deletedId===activeCharacterId && !campaignStarted) setActiveCharacterId(null)
  },[characters,activeCharacterId,campaignStarted])

  // Fired every time a Campaign stage is cleared (see handleEnemyDefeatedMulti
  // in GridBattlerGame.jsx), not just on a full Campaign win -- the Modifier
  // Panel only cares about Battle 1 specifically, so this is a one-way latch
  // rather than tracking every stage.
  const handleBattleCleared = useCallback((stage)=>{
    if(stage===1) setBattle1Cleared(true)
  },[])

  // Spends Hexas (and, for an elemental skill, one matching Core per tier)
  // to buy every tier between what's currently owned and `targetTier` in one
  // purchase -- the slider drags to a target, this pays the lump sum for
  // whatever tiers that drag skipped. Silently no-ops on an invalid buy
  // (maxed out, not actually raising the tier, or can't afford) rather than
  // erroring -- the button itself is already disabled in that state, so
  // reaching here with bad inputs would mean a stale click, not a real
  // request.
  const handleUpgradeSkillMod = useCallback((skillId, statId, targetTier)=>{
    const maxTier = skillModMaxTier(statId)
    const currentTier = skillMods[skillId]?.[statId] || 0
    const clampedTarget = Math.max(currentTier, Math.min(targetTier, maxTier))
    if(clampedTarget <= currentTier) return
    let cost = 0
    for(let t=currentTier+1; t<=clampedTarget; t++) cost += skillModTierCost(skillId, t)
    const tiersBought = clampedTarget - currentTier
    if(hexas < cost) return
    const coreId = MODIFIABLE_ELEMENTS.find(e=>e.id===skillId)?.coreId
    if(coreId && (materials[coreId]||0) < tiersBought) return
    setHexas(h => h - cost)
    if(coreId) setMaterials(m => ({...m, [coreId]: (m[coreId]||0) - tiersBought}))
    setSkillMods(prev => ({...prev, [skillId]: {...prev[skillId], [statId]: clampedTarget}}))
  },[hexas,materials,skillMods])

  // Mirrors handleUpgradeSkillMod's self-contained validate-then-deduct
  // pattern: a stale click (cost changed under the player, or the CraftingScreen
  // button was somehow not disabled) fails silently rather than erroring, since
  // the UI itself is the real gate.
  const handleSaveCustomSkill = useCallback((def)=>{
    const cost = computeCustomSkillCreationCost(def)
    if(hexas < cost.hexas) return
    if(cost.coreId && (materials[cost.coreId]||0) < cost.coreQty) return
    setHexas(h => h - cost.hexas)
    if(cost.coreId) setMaterials(m => ({...m, [cost.coreId]: (m[cost.coreId]||0) - cost.coreQty}))
    setCustomSkillDef(def)
  },[hexas,materials])

  const startScene = useCallback((sceneId)=>{
    setActiveScene(sceneId)
    setSceneNonce(n=>n+1)
    setScreen('trainingScene')
  },[])

  const handleSceneComplete = useCallback(()=>{
    setCompletedScenes(prev => prev.includes(activeScene) ? prev : [...prev, activeScene])
    setScreen('training')
  },[activeScene])

  const handleLearnSkill = useCallback((skillId)=>{
    setCraftedSkillIds(prev => prev.includes(skillId) ? prev : [...prev, skillId])
  },[])

  // Battle sessions still report their own liveState (player/loadout/wave
  // detail CharacterScreen needs) but their hexas/materials now flow into
  // the shared pool instead of being read from liveState directly, so
  // Crafting/Inventory reflect the total even with no session mounted.
  const handleStateSync = useCallback((s)=>{
    setLiveState(s)
    setHexas(s.hexas)
    setMaterials(s.materials)
  },[])

  const handleExploreCollect = useCallback((reward)=>{
    if(!reward) return
    setHexas(h => h + (reward.hexas||0))
    if(reward.materials) setMaterials(m => mergeCounts(m, reward.materials))
  },[])

  const handleExploreNavigate = useCallback((domain)=>{
    setVisitedDomains(prev => prev.includes(domain) ? prev : [...prev, domain])
  },[])

  const handleGoldFound = useCallback(()=>{
    setGoldQuestComplete(true)
  },[])

  return (
    <>
      {/* screen==='start'/'training' used to be early `return`s here, which
          seems harmless but isn't: an early return skips this whole
          fragment, so React unmounts the campaignStarted div below
          (destroying its live battle state) even though that boolean itself
          stays true — the "stays mounted, just hidden" comment on it only
          held for navigation *within* this fragment (crafting/inventory/
          etc). Folding start/training in here as siblings instead of early
          returns is what actually keeps a session alive when stepping out
          to the main menu and back. */}
      {screen==='start' && (
        <StartScreen onSelectMode={goTo} onNavigate={goTo} hasActiveCampaignSession={campaignStarted} />
      )}

      {screen==='training' && (
        <TutorialHub completedScenes={completedScenes} onSelectScene={startScene} onMenu={()=>goTo('start')} />
      )}

      {/* Campaign stays mounted (just hidden, not unmounted) once started --
          that keeps the session's liveState sync flowing to CharacterScreen
          (its active-slot card wants to keep showing real HP/XP even while
          parked elsewhere) and avoids losing player/enemy React state to a
          remount. It does NOT mean stepping away resumes an in-progress
          fight exactly as left, though: any hop away from this screen bumps
          campaignLeaveSignal (see goTo), which resets the in-progress battle
          if it wasn't already at a decision point -- deliberately broad
          (Character/Inventory/Crafting/Main, not just Main), since Crafting
          can change the player's actual stats mid-fight otherwise. onQuit is
          required here (not just onCampaignComplete): without it, Surrender
          falls into GridBattlerGame's in-place reset branch, which zeroes
          hexas — now that hexas is a persisted cross-session pool, that
          would wipe real currency instead of just discarding a session.
          onReturnToMenu is a separate, non-destructive hop: its "Return to
          Menu" buttons (post-battle, post-defeat) are for stepping away to
          craft and coming back, not quitting — routing that through
          onCampaignComplete would setCampaignStarted(false) and unmount the
          whole session (same bug class as onQuit's comment above, just for
          progress instead of currency), exactly the bug this fixes. */}
      {campaignStarted && (
        <div style={{display: screen==='campaign' ? 'block' : 'none'}}>
          <GridBattlerGame campaign character={characters.find(c=>c?.id===activeCharacterId)} leaveSignal={campaignLeaveSignal}
            onCampaignComplete={handleCampaignComplete} onReturnToMenu={()=>setScreen('start')} onQuit={()=>handleCampaignComplete(false)} onBattleCleared={handleBattleCleared} onStateSync={handleStateSync} craftedSkillIds={craftedSkillIds} skillMods={skillMods} initialHexas={hexas} initialMaterials={materials} customSkillDef={customSkillDef} />
          <FloatingMenuButton onNavigate={goTo} />
        </div>
      )}

      {/* Training scenes are NOT kept mounted — each selection from the hub
          is a fresh instance (key forces remount even on replaying the same
          scene), since these are repeatable lessons, not sessions to resume. */}
      {screen==='trainingScene' && (
        <GridBattlerGame key={`${activeScene}-${sceneNonce}`} scene={activeScene} onSceneComplete={handleSceneComplete} onQuit={()=>setScreen('training')} craftedSkillIds={craftedSkillIds} skillMods={skillMods} onStateSync={handleStateSync} initialHexas={hexas} initialMaterials={materials} customSkillDef={customSkillDef} />
      )}

      {/* Explore is never kept mounted — it always reflects whatever the
          real active browser tab is right now, so a fresh mount per visit
          (re-fetching tab/domain data) is correct, not a limitation. */}
      {screen==='explore' && (
        <>
          <ExploreScreen hexas={hexas} materials={materials} goldQuestComplete={goldQuestComplete}
            onCollect={handleExploreCollect} onGoldFound={handleGoldFound} onNavigate={handleExploreNavigate} />
          <FloatingMenuButton onNavigate={goTo} />
        </>
      )}

      {screen!=='start' && screen!=='training' && screen!=='campaign' && screen!=='trainingScene' && screen!=='explore' && (
        <div style={{minHeight:'100vh',background:'#0a0a0a',backgroundImage:'radial-gradient(circle at 50% 0%, rgba(0,200,255,0.06), transparent 60%)',color:'#b0dff4',fontFamily:"'Rajdhani','Share Tech Mono',sans-serif",display:'flex',flexDirection:'column'}}>
          <NavBar current={screen} onNavigate={goTo} onMenu={()=>goTo('start')} />
          {screen==='character'
            ? <CharacterScreen characters={characters} craftedSkillIds={craftedSkillIds} activeCharacterId={activeCharacterId} campaignStarted={campaignStarted} liveState={liveState} customSkillDef={customSkillDef}
                onSaveCharacter={handleSaveCharacter} onDeleteCharacter={handleDeleteCharacter} onLaunchCampaign={handleLaunchCampaign} />
            : screen==='crafting'
            ? <CraftingScreen hexas={hexas} materials={materials} craftedSkillIds={craftedSkillIds} onLearnSkill={handleLearnSkill} campaignCompletedOnce={campaignCompletedOnce} customSkillUnlocked={!!liveState?.player?.customSkillUnlocked} skillMods={skillMods} battle1Cleared={battle1Cleared} onUpgradeSkillMod={handleUpgradeSkillMod} customSkillDef={customSkillDef} onSaveCustomSkill={handleSaveCustomSkill} />
            : screen==='inventory'
            ? <InventoryScreen hexas={hexas} materials={materials} equipmentDrops={liveState?.player?.equipmentDrops ?? []} />
            : <PlaceholderScreen {...PLACEHOLDER_CONTENT[screen]} />}
        </div>
      )}
    </>
  )
}

export default App
