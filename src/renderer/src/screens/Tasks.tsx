import { useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { Plus, Trash2, Circle, Clock, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useTodos } from '@renderer/hooks/useTodos'
import type { Todo, TodoStatus, TodoPriority } from '@renderer/hooks/useTodos'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLUMNS: { status: TodoStatus; label: string; icon: ReactNode }[] = [
  { status: 'todo', label: 'To Do', icon: <Circle className="w-4 h-4" /> },
  { status: 'in-progress', label: 'In Progress', icon: <Clock className="w-4 h-4" /> },
  { status: 'done', label: 'Done', icon: <CheckCircle2 className="w-4 h-4" /> }
]

const PRIORITY_COLORS: Record<TodoPriority, string> = {
  high: 'bg-destructive/15 text-destructive border-destructive/20',
  medium: 'bg-amber-500/15 text-amber-600 border-amber-500/20',
  low: 'bg-muted text-muted-foreground border-border'
}

// ── Todo card ─────────────────────────────────────────────────────────────────

function TodoCard({
  todo,
  onStatusChange,
  onDelete
}: {
  todo: Todo
  onStatusChange: (id: string, status: TodoStatus) => void
  onDelete: (id: string) => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const nextStatus: Record<TodoStatus, TodoStatus> = {
    todo: 'in-progress',
    'in-progress': 'done',
    done: 'todo'
  }

  return (
    <div className="group bg-background border border-border rounded-lg px-3 py-2.5 space-y-1.5 hover:border-ring/50 transition-colors">
      <div className="flex items-start gap-2">
        <button
          onClick={() => onStatusChange(todo.id, nextStatus[todo.status])}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          title="Advance status"
        >
          {todo.status === 'done' ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : todo.status === 'in-progress' ? (
            <Clock className="w-4 h-4 text-amber-500" />
          ) : (
            <Circle className="w-4 h-4" />
          )}
        </button>
        <span
          className={cn(
            'flex-1 text-sm leading-snug',
            todo.status === 'done' && 'line-through text-muted-foreground'
          )}
        >
          {todo.title}
        </span>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {todo.description && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={() => onDelete(todo.id)}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expanded && todo.description && (
        <p className="text-xs text-muted-foreground ml-6 leading-relaxed">{todo.description}</p>
      )}

      <div className="flex items-center gap-1.5 ml-6 flex-wrap">
        <Badge
          variant="outline"
          className={cn('text-[10px] px-1.5 py-0 h-4 font-medium', PRIORITY_COLORS[todo.priority])}
        >
          {todo.priority}
        </Badge>
        {todo.dueDate && (
          <span className="text-[10px] text-muted-foreground">due {todo.dueDate}</span>
        )}
      </div>
    </div>
  )
}

// ── Quick-add row ─────────────────────────────────────────────────────────────

function QuickAdd({ onAdd }: { onAdd: (title: string) => void }): JSX.Element {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = (): void => {
    const trimmed = value.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setValue('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex gap-1.5">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        placeholder="Add a task…"
        className="h-8 text-sm"
      />
      <Button size="icon" className="h-8 w-8 shrink-0" onClick={submit} disabled={!value.trim()}>
        <Plus className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export function TasksScreen(): JSX.Element {
  const { todos, loading, createTodo, updateTodo, deleteTodo } = useTodos()

  const handleAdd = async (title: string): Promise<void> => {
    await createTodo({ title, status: 'todo', priority: 'medium' })
  }

  const handleStatusChange = async (id: string, status: TodoStatus): Promise<void> => {
    await updateTodo(id, { status })
  }

  const handleDelete = async (id: string): Promise<void> => {
    await deleteTodo(id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-base font-semibold">Tasks</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ask Navia in chat to add, update, or plan your tasks.
        </p>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-3 gap-4 p-6 h-full">
          {STATUS_COLUMNS.map(({ status, label, icon }) => {
            const col = todos.filter((t) => t.status === status)
            return (
              <div key={status} className="flex flex-col gap-3 min-h-0">
                {/* Column header */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground">{icon}</span>
                  <span className="text-sm font-medium">{label}</span>
                  <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
                    {col.length}
                  </span>
                </div>

                {/* Quick-add only in the To Do column */}
                {status === 'todo' && <QuickAdd onAdd={handleAdd} />}

                {/* Cards */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
                  {col.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center pt-4">Nothing here</p>
                  ) : (
                    col.map((todo) => (
                      <TodoCard
                        key={todo.id}
                        todo={todo}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
