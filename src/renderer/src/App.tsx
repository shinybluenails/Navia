import { useState, useEffect } from 'react'
import { Sidebar, type Screen } from '@renderer/components/Sidebar'
import { Chat } from '@renderer/screens/Chat'
import { Models } from '@renderer/screens/Models'
import { SettingsScreen } from '@renderer/screens/Settings'
import { useSettings } from '@renderer/hooks/useSettings'
import { Button } from '@renderer/components/ui/button'

function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>('chat')
  const { settings, updateSettings } = useSettings()
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const cleanupDownloaded = window.updater.onUpdateDownloaded(() => setUpdateReady(true))
    return () => { cleanupDownloaded() }
  }, [])

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {updateReady && (
        <div className="flex items-center justify-between gap-4 px-4 py-2 bg-primary text-primary-foreground text-sm shrink-0">
          <span>A new version of HomeMind is ready to install.</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.updater.install()}
          >
            Restart &amp; Update
          </Button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar active={screen} onNavigate={setScreen} />
        <main className="flex-1 overflow-hidden">
          {screen === 'chat' && <Chat settings={settings} />}
          {screen === 'models' && <Models />}
          {screen === 'settings' && (
            <SettingsScreen settings={settings} updateSettings={updateSettings} />
          )}
        </main>
      </div>
    </div>
  )
}

export default App

