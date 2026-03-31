import { MessageSquare, Package, Settings2, Brain } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

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
}

export function Sidebar({ active, onNavigate }: SidebarProps): JSX.Element {
  return (
    <aside className="w-48 shrink-0 flex flex-col border-r border-border bg-card h-full">
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <Brain className="w-5 h-5 text-primary shrink-0" />
        <span className="font-bold text-foreground tracking-tight">HomeMind</span>
      </div>

      <nav className="flex-1 p-2 flex flex-col gap-0.5">
        <NavItem
          icon={<MessageSquare className="w-4 h-4 shrink-0" />}
          label="Chat"
          screen="chat"
          active={active === 'chat'}
          onClick={onNavigate}
        />
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
      </nav>

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Powered by Ollama</p>
      </div>
    </aside>
  )
}
