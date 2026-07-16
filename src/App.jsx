import { useState, useCallback } from 'react'
import GridBattlerGame from './GridBattlerGame.jsx'
import StartScreen from './StartScreen.jsx'
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
      'Recipes and item fabrication come online in a future build.',
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
  const [liveState, setLiveState] = useState(null)

  const goTo = useCallback((s)=>{
    if(s==='gauntlet') setGauntletStarted(true)
    setScreen(s)
  },[])

  if(screen==='start'){
    return <StartScreen onSelectMode={goTo} onNavigate={goTo} hasActiveSession={gauntletStarted} />
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

      {screen!=='gauntlet' && (
        <div style={{minHeight:'100vh',background:'#0a0a0a',backgroundImage:'radial-gradient(circle at 50% 0%, rgba(0,200,255,0.06), transparent 60%)',color:'#b0dff4',fontFamily:"'Rajdhani','Share Tech Mono',sans-serif",display:'flex',flexDirection:'column'}}>
          <NavBar current={screen} onNavigate={goTo} onMenu={()=>setScreen('start')} />
          {screen==='character'
            ? <CharacterScreen liveState={liveState} hasActiveSession={gauntletStarted} onLaunch={()=>goTo('gauntlet')} />
            : <PlaceholderScreen {...PLACEHOLDER_CONTENT[screen]} />}
        </div>
      )}
    </>
  )
}

export default App
