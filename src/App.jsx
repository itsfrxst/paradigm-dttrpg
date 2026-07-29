import { useState, useCallback } from 'react'
import GridBattlerGame from './GridBattlerGame.jsx'
import StartScreen from './StartScreen.jsx'
import TutorialHub from './TutorialHub.jsx'
import NavBar from './NavBar.jsx'
import FloatingMenuButton from './FloatingMenuButton.jsx'
import CharacterScreen from './CharacterScreen.jsx'
import PlaceholderScreen from './PlaceholderScreen.jsx'

const PLACEHOLDER_CONTENT = {
  profile: {
    icon:'👤', title:'Profile', color:'#5aa9c9',
    lines:[
      'Operator identity matrix uninitialized.',
      'Account sync, achievements, and cosmetic loadouts come online in a future build.',
    ],
  },
  inventory: {
    icon:'🎒', title:'Inventory', color:'#c9a227',
    lines:[
      'Cyberworld cache offline.',
      'Loot, gear, and consumables come online in a future build.',
    ],
  },
  crafting: {
    icon:'🔧', title:'Crafting', color:'#ff8844',
    lines:[
      'Synthesis protocol not yet compiled.',
      'Complete the Campaign to bring it online.',
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

function App() {
  const [screen, setScreen] = useState('start')
  const [gauntletStarted, setGauntletStarted] = useState(false)
  const [campaignStarted, setCampaignStarted] = useState(false)
  const [liveState, setLiveState] = useState(null)
  // Training Mode: which scene is active, a nonce to force a fresh mount
  // each time a scene is (re)selected (scenes are a practice sandbox, not a
  // persistent session like Gauntlet — no resume-in-progress behavior), and
  // which scenes have been cleared at least once (for the hub's checkmarks).
  const [activeScene, setActiveScene] = useState(null)
  const [sceneNonce, setSceneNonce] = useState(0)
  const [completedScenes, setCompletedScenes] = useState([])

  const goTo = useCallback((s)=>{
    if(s==='gauntlet') setGauntletStarted(true)
    if(s==='campaign') setCampaignStarted(true)
    setScreen(s)
  },[])

  const handleCampaignComplete = useCallback(()=>{
    setCampaignStarted(false)
    setScreen('start')
  },[])

  const startScene = useCallback((sceneId)=>{
    setActiveScene(sceneId)
    setSceneNonce(n=>n+1)
    setScreen('trainingScene')
  },[])

  const handleSceneComplete = useCallback(()=>{
    setCompletedScenes(prev => prev.includes(activeScene) ? prev : [...prev, activeScene])
    setScreen('training')
  },[activeScene])

  // Crafting stays a placeholder until the real system exists, but reflects
  // the Campaign-completion unlock: current Hexas balance and whatever
  // equipment the run granted, so the reward from finishing Campaign is
  // visible somewhere even before spending is actually wired up.
  const craftingContent = liveState?.craftingUnlocked
    ? {
        icon:'🔧', title:'Crafting', color:'#ff8844',
        lines:[
          'Synthesis protocol online — Campaign reward unlocked.',
          `Hexas on hand: ${liveState.hexas ?? 0}.`,
          liveState.player?.equipment?.length
            ? `Equipped: ${liveState.player.equipment.map(e=>e.name).join(', ')}.`
            : 'No equipment yet.',
          'Spending Hexas on recipes comes online in a future build.',
        ],
      }
    : PLACEHOLDER_CONTENT.crafting

  if(screen==='start'){
    return <StartScreen onSelectMode={goTo} onNavigate={goTo} hasActiveSession={gauntletStarted} hasActiveCampaignSession={campaignStarted} />
  }

  if(screen==='training'){
    return <TutorialHub completedScenes={completedScenes} onSelectScene={startScene} onMenu={()=>setScreen('start')} />
  }

  return (
    <>
      {/* Gauntlet stays mounted (just hidden) once started, so leaving to
          check Character/Inventory/etc and coming back resumes mid-battle
          instead of restarting the session. */}
      {gauntletStarted && (
        <div style={{display: screen==='gauntlet' ? 'block' : 'none'}}>
          <GridBattlerGame onStateSync={setLiveState} />
          <FloatingMenuButton onNavigate={goTo} />
        </div>
      )}

      {/* Campaign stays mounted (just hidden) once started too — same
          resume-in-progress pattern as Gauntlet, since it's a real
          multi-battle run whose player HP/level carries across battles. */}
      {campaignStarted && (
        <div style={{display: screen==='campaign' ? 'block' : 'none'}}>
          <GridBattlerGame campaign onCampaignComplete={handleCampaignComplete} onStateSync={setLiveState} />
          <FloatingMenuButton onNavigate={goTo} />
        </div>
      )}

      {/* Training scenes are NOT kept mounted — each selection from the hub
          is a fresh instance (key forces remount even on replaying the same
          scene), since these are repeatable lessons, not sessions to resume. */}
      {screen==='trainingScene' && (
        <GridBattlerGame key={`${activeScene}-${sceneNonce}`} scene={activeScene} onSceneComplete={handleSceneComplete} />
      )}

      {screen!=='gauntlet' && screen!=='campaign' && screen!=='trainingScene' && (
        <div style={{minHeight:'100vh',background:'#0a0a0a',backgroundImage:'radial-gradient(circle at 50% 0%, rgba(0,200,255,0.06), transparent 60%)',color:'#b0dff4',fontFamily:"'Rajdhani','Share Tech Mono',sans-serif",display:'flex',flexDirection:'column'}}>
          <NavBar current={screen} onNavigate={goTo} onMenu={()=>setScreen('start')} />
          {screen==='character'
            ? <CharacterScreen liveState={liveState} hasActiveSession={gauntletStarted} onLaunch={()=>goTo('gauntlet')} />
            : <PlaceholderScreen {...(screen==='crafting' ? craftingContent : PLACEHOLDER_CONTENT[screen])} />}
        </div>
      )}
    </>
  )
}

export default App
