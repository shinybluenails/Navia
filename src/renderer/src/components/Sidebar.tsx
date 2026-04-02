import { Package, Settings2, Brain, Plus, Trash2, MessageSquare } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { ChatSession } from '@renderer/hooks/useChats'

export type Screen = 'chat' | 'models' | 'settings'

interface NavItemProps {
  icon: React.ReactNode
  label: string
  screen: Screen
  active: boolean
  onClick: (screen: Screen) => void
}

function NavItem({ icon, label, screen, active, onClick }: NavItemProps): JSX.Element {
  return (
    <button
      onClick={() => onClick(screen)}
      className={cn(
        'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left',
        active
          ? 'bg-accent text-accent-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

interface SidebarProps {
  active: Screen
  onNavigate: (screen: Screen) => void
  chats: ChatSession[]
  activeChatId: string | null
  onSelectChat: (id: string) => void
  onNewChat: () => void
  onDeleteChat: (id: string) => void
}

export function Sidebar({
  active,
  onNavigate,
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat
}: SidebarProps): JSX.Element {
  return (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-card h-full">
      {/* Brand header */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border shrink-0">
        <Brain className="w-5 h-5 text-primary shrink-0" />
        <span className="font-bold text-foreground tracking-tight flex-1">HomeMind</span>
      </div>

      {/* New Chat button */}
      <div className="px-2 pt-2 shrink-0">
        <button
          onClick={onNewChat}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-accent/50 border border-dashed border-border"
        >
          <Plus className="w-4 h-4 shrink-0" />
          New Chat
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-2">
            <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No conversations yet</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={cn(
                'group flex items-center gap-1 w-full rounded-lg transition-colors',
                chat.id === activeChatId && active === 'chat'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              )}
            >
              <button
                onClick={() => onSelectChat(chat.id)}
                className="flex-1 text-left px-3 py-2 text-sm truncate min-w-0"
                title={chat.title}
              >
                {chat.title}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteChat(chat.id)
                }}
                className="shrink-0 p-1.5 mr-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                title="Delete conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Bottom nav */}
      <div className="p-2 border-t border-border shrink-0 flex flex-col gap-0.5">
        <NavItem
          icon={<Package className="w-4 h-4 shrink-0" />}
          label="Models"
          screen="models"
          active={active === 'models'}
          onClick={onNavigate}
        />
        <NavItem
          icon={<Settings2 className="w-4 h-4 shrink-0" />}
          label="Settings"
          screen="settings"
          active={active === 'settings'}
          onClick={onNavigate}
        />
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0">
        <p className="text-xs text-muted-foreground">Powered by Ollama</p>
      </div>
    </aside>
  )
}
