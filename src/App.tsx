import { useState } from 'react'
import SplashScreen from './components/SplashScreen'
import FieldSimulator from './simulator/FieldSimulator'

export default function App() {
  const [introComplete, setIntroComplete] = useState(false)

  return (
    <>
      {!introComplete && (
        <SplashScreen onComplete={() => setIntroComplete(true)} />
      )}
      <div
        style={{
          opacity: introComplete ? 1 : 0,
          transition: 'opacity 0.65s ease',
          position: 'fixed',
          inset: 0,
          pointerEvents: introComplete ? 'auto' : 'none',
        }}
      >
        <FieldSimulator />
      </div>
    </>
  )
}
