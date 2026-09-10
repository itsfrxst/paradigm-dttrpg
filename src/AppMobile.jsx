import { useState, useEffect, useCallback, useMemo } from 'react'
import GridBattlerGame from './GridBattlerGame.jsx'
import StartScreen from './StartScreen.jsx'
import NavBar from './NavBar.jsx'
import FloatingMenuButton from './FloatingMenuButton.jsx'
import CharacterScreen from './CharacterScreen.jsx'
import CraftingScreen from './CraftingScreen.jsx'
import InventoryScreen from './InventoryScreen.jsx'
import ExploreScreenOffline from './ExploreScreenOffline.jsx'
import { storageGet, storageSet, debounce, mergeCounts } from './storage.js'
import { skillModTierCost, skillModMaxTier, MODIFIABLE_ELEMENTS } from './ItemData.jsx'

// Trimmed mode/nav lists for the mobile Artifact build -- Training and
// Gauntlet are cut (per the user's ask), leaving Campaign + Explore as the
// two launchable modes and Character/Inventory/Crafting as the flat screens.
const MOBILE_MODES = [
  { id:'campaign', name:'Campaign', icon:'📜', color:'#cc4422', locked:false,
    desc:'Fight through an army. Five escalating squad battles — from a trio of single-skill grunts to a lone Full Proxie finale.' },
  { id:'explore', name:'Web Exploration', icon:'🌐', color:'#00cc66', locked:false,
    desc:'An auto-populated 3D world -- collect Hexas and Materials, hop between sites via portals.' },
]
const MOBILE_NAV_ITEMS = [
  { id:'character', label:'Character', icon:'🪪', color:'#00c8ff' },
  { id:'inventory', label:'Inventory', icon:'🎒', color:'#c9a227' },
  { id:'crafting',  label:'Crafting',  icon:'🔧', color:'#ff8844' },
]
const MOBILE_FLOATING_ITEMS = [
  { id:'character', label:'Character', icon:'🪪' },
  { id:'inventory', label:'Inventory', icon:'🎒' },
  { id:'crafting',  label:'Crafting',  icon:'🔧' },
  { id:'start',     label:'Main', icon:'◄' },
]

const APP_STATE_KEY = 'appStateMobile'
const DEFAULT_APP_STATE = {
  hexas: 0,
  materials: {},
  craftedSkillIds: [],
  campaignCompletedOnce: false,
  visitedDomains: [],
  goldQuestComplete: false,
  skillMods: {},
  battle1Cleared: false,
  customSkillDef: null,
  characters: [null, null, null],
  activeCharacterId: null,
}

// Simplified sibling of App.jsx for the mobile/Artifact test build: same
// persistence + shared hexas/materials pool design, minus Training/Gauntlet,
// and Explore swapped for the browser-free ExploreScreenOffline.jsx.
function AppMobile() {
  const [screen, setScreen] = useState('start')
  const [campaignStarted, setCampaignStarted] = useState(false)
  const [liveState, setLiveState] = useState(null)
  const [craftedSkillIds, setCraftedSkillIds] = useState([])
  const [campaignCompletedOnce, setCampaignCompletedOnce] = useState(false)

  const [hexas, setHexas] = useState(0)
  const [materials, setMaterials] = useState({})
  const [visitedDomains, setVisitedDomains] = useState([])
  const [goldQuestComplete, setGoldQuestComplete] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [skillMods, setSkillMods] = useState({})
  const [battle1Cleared, setBattle1Cleared] = useState(false)
  const [customSkillDef, setCustomSkillDef] = useState(null)
  const [characters, setCharacters] = useState([null, null, null])
  const [activeCharacterId, setActiveCharacterId] = useState(null)
  const [campaignLeaveSignal, setCampaignLeaveSignal] = useState(0)

  useEffect(() => {
    let cancelled = false
    storageGet(APP_STATE_KEY, DEFAULT_APP_STATE).then((saved) => {
      if (cancelled) return
      const s = { ...DEFAULT_APP_STATE, ...saved }
      setHexas(s.hexas)
      setMaterials(s.materials)
      setCraftedSkillIds(s.craftedSkillIds)
      setCampaignCompletedOnce(s.campaignCompletedOnce)
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

  const saveAppState = useMemo(
    () => debounce((state) => storageSet(APP_STATE_KEY, state), 400),
    []
  )
  useEffect(() => {
    if (!hydrated) return
    saveAppState({ hexas, materials, craftedSkillIds, campaignCompletedOnce, visitedDomains, goldQuestComplete, skillMods, battle1Cleared, customSkillDef, characters, activeCharacterId })
  }, [hydrated, hexas, materials, craftedSkillIds, campaignCompletedOnce, visitedDomains, goldQuestComplete, skillMods, battle1Cleared, customSkillDef, characters, activeCharacterId, saveAppState])

  // See App.jsx's goTo for the full rationale: Campaign is locked behind
  // CharacterScreen (redirect when not already started), and stepping away
  // from the live battle view to *anywhere* else (Main, Character,
  // Inventory, Crafting, Explore) bumps campaignLeaveSignal so
  // GridBattlerGame can reset an in-progress battle instead of silently
  // resuming it. Deliberately broad, not just the Main button: Crafting's
  // Modifier Panel can change the player's actual stats mid-fight via a
  // prop that's live for as long as this session stays mounted, so a
  // fight's stats have to be exactly what they were when it started, or
  // ducking into Crafting mid-fight with Hexas earned *in that fight* to
  // buy a tier and carry the buff back in would be a real farming exploit.
  // Only fires on the actual transition out of campaign (guarded by
  // `screen==='campaign'`), so browsing those other screens after already
  // having left doesn't keep re-rolling a fresh battle for no reason.
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

  const handleBattleCleared = useCallback((stage)=>{
    if(stage===1) setBattle1Cleared(true)
  },[])

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

  const handleSaveCustomSkill = useCallback((def)=>{
    setCustomSkillDef(def)
  },[])

  const handleLearnSkill = useCallback((skillId)=>{
    setCraftedSkillIds(prev => prev.includes(skillId) ? prev : [...prev, skillId])
  },[])

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
      {/* screen==='start' used to be an early `return` here, which skips
          this whole fragment and unmounts the campaignStarted div below
          (destroying its live battle state) even though campaignStarted
          itself stays true — the "stays mounted" comment only held for
          navigation *within* this fragment (crafting/inventory/etc), not
          for stepping back out to the main menu. Folding start in here as a
          sibling instead of an early return is what keeps a session alive
          across that hop. */}
      {screen==='start' && (
        <StartScreen onSelectMode={goTo} onNavigate={goTo} hasActiveCampaignSession={campaignStarted}
          modes={MOBILE_MODES} navItems={MOBILE_NAV_ITEMS} />
      )}

      {campaignStarted && (
        <div style={{display: screen==='campaign' ? 'block' : 'none'}}>
          <GridBattlerGame campaign character={characters.find(c=>c?.id===activeCharacterId)} leaveSignal={campaignLeaveSignal}
            onCampaignComplete={handleCampaignComplete} onReturnToMenu={()=>setScreen('start')} onQuit={()=>handleCampaignComplete(false)} onBattleCleared={handleBattleCleared}
            onStateSync={handleStateSync} craftedSkillIds={craftedSkillIds} skillMods={skillMods} initialHexas={hexas} initialMaterials={materials} />
          <FloatingMenuButton onNavigate={goTo} items={MOBILE_FLOATING_ITEMS} />
        </div>
      )}

      {screen==='explore' && (
        <>
          <ExploreScreenOffline hexas={hexas} materials={materials} goldQuestComplete={goldQuestComplete}
            onCollect={handleExploreCollect} onGoldFound={handleGoldFound} onNavigate={handleExploreNavigate} />
          <FloatingMenuButton onNavigate={goTo} items={MOBILE_FLOATING_ITEMS} />
        </>
      )}

      {screen!=='start' && screen!=='campaign' && screen!=='explore' && (
        <div style={{minHeight:'100vh',background:'#0a0a0a',backgroundImage:'radial-gradient(circle at 50% 0%, rgba(0,200,255,0.06), transparent 60%)',color:'#b0dff4',fontFamily:"'Rajdhani','Share Tech Mono',sans-serif",display:'flex',flexDirection:'column'}}>
          <NavBar current={screen} onNavigate={goTo} onMenu={()=>goTo('start')} items={MOBILE_NAV_ITEMS} />
          {screen==='character'
            ? <CharacterScreen characters={characters} craftedSkillIds={craftedSkillIds} activeCharacterId={activeCharacterId} campaignStarted={campaignStarted} liveState={liveState}
                onSaveCharacter={handleSaveCharacter} onDeleteCharacter={handleDeleteCharacter} onLaunchCampaign={handleLaunchCampaign} />
            : screen==='crafting'
            ? <CraftingScreen hexas={hexas} materials={materials} craftedSkillIds={craftedSkillIds} onLearnSkill={handleLearnSkill} campaignCompletedOnce={campaignCompletedOnce} customSkillUnlocked={!!liveState?.player?.customSkillUnlocked} skillMods={skillMods} battle1Cleared={battle1Cleared} onUpgradeSkillMod={handleUpgradeSkillMod} customSkillDef={customSkillDef} onSaveCustomSkill={handleSaveCustomSkill} />
            : <InventoryScreen hexas={hexas} materials={materials} equipmentDrops={liveState?.player?.equipmentDrops ?? []} />}
        </div>
      )}
    </>
  )
}

export default AppMobile
