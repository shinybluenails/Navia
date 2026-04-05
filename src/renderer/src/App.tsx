import { useState, useEffect } from 'react'
import { Sidebar, type Screen } from '@renderer/components/Sidebar'
import { Chat } from '@renderer/screens/Chat'
import { Models } from '@renderer/screens/Models'
import { SettingsScreen } from '@renderer/screens/Settings'
import { useSettings } from '@renderer/hooks/useSettings'
import { useChats } from '@renderer/hooks/useChats'
import { useTheme } from '@renderer/hooks/useTheme'
import { Button } from '@renderer/components/ui/button'

function App(): JSX.Element {
  const [screen, setScreen] = useState<Screen>('chat')
  const { settings, updateSettings } = useSettings()
  const { chats, activeChatId, activeChat, createChat, deleteChat, selectChat, updateChat } =
    useChats()
  const { theme, setTheme } = useTheme()
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const cleanupDownloaded = window.updater.onUpdateDownloaded(() => setUpdateReady(true))
    return () => {
      cleanupDownloaded()
    }
  }, [])

  const handleSelectChat = (id: string): void => {
    selectChat(id)
    setScreen('chat')
  }

  const handleNewChat = (): void => {
    createChat()
    setScreen('chat')
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-background">
      {updateReady && (
        <div className="flex items-center justify-between gap-4 px-4 py-2 bg-primary text-primary-foreground text-sm shrink-0">
          <span>A new version of HomeMind is ready to install.</span>
          <Button size="sm" variant="secondary" onClick={() => window.updater.install()}>
            Restart &amp; Update
          </Button>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          active={screen}
          onNavigate={setScreen}
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={deleteChat}
        />
        <main className="flex-1 overflow-hidden">
          {screen === 'chat' && (
            <Chat
              settings={settings}
              activeChat={activeChat}
              onUpdateChat={updateChat}
              onCreateChat={createChat}
            />
          )}
          {screen === 'models' && <Models />}
          {screen === 'settings' && (
            <SettingsScreen
              settings={settings}
              updateSettings={updateSettings}
              theme={theme}
              setTheme={setTheme}
            />
          )}
        </main>
      </div>
    </div>
  )
}

export default App

