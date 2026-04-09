import ElectronStore from 'electron-store'
import { randomUUID } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export type TodoStatus = 'todo' | 'in-progress' | 'done'
export type TodoPriority = 'low' | 'medium' | 'high'

export interface Todo {
  id: string
  title: string
  description?: string
  status: TodoStatus
  priority: TodoPriority
  dueDate?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

export interface MemoryEntry {
  id: string
  key: string
  value: string
  category?: string
  createdAt: number
  updatedAt: number
}

// ── Stores ───────────────────────────────────────────────────────────────────

const todosStore = new ElectronStore<{ todos: Todo[] }>({
  name: 'todos',
  defaults: { todos: [] }
})

const memoryStore = new ElectronStore<{ entries: MemoryEntry[] }>({
  name: 'memory',
  defaults: { entries: [] }
})

// ── Todo operations ──────────────────────────────────────────────────────────

export function listTodos(): Todo[] {
  return todosStore.get('todos')
}

export function createTodo(data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Todo {
  const now = Date.now()
  const todo: Todo = { ...data, id: randomUUID(), createdAt: now, updatedAt: now }
  todosStore.set('todos', [...todosStore.get('todos'), todo])
  return todo
}

export function updateTodo(id: string, changes: Partial<Omit<Todo, 'id' | 'createdAt'>>): Todo {
  const todos = todosStore.get('todos')
  const idx = todos.findIndex((t) => t.id === id)
  if (idx === -1) throw new Error(`Todo not found: ${id}`)
  const updated: Todo = { ...todos[idx], ...changes, updatedAt: Date.now() }
  todos[idx] = updated
  todosStore.set('todos', todos)
  return updated
}

export function deleteTodo(id: string): void {
  todosStore.set(
    'todos',
    todosStore.get('todos').filter((t) => t.id !== id)
  )
}

// ── Memory operations ────────────────────────────────────────────────────────

export function listMemory(): MemoryEntry[] {
  return memoryStore.get('entries')
}

export function writeMemory(key: string, value: string, category?: string): MemoryEntry {
  const entries = memoryStore.get('entries')
  const existing = entries.find((e) => e.key === key)
  const now = Date.now()
  if (existing) {
    const updated: MemoryEntry = { ...existing, value, category, updatedAt: now }
    memoryStore.set(
      'entries',
      entries.map((e) => (e.key === key ? updated : e))
    )
    return updated
  }
  const entry: MemoryEntry = {
    id: randomUUID(),
    key,
    value,
    category,
    createdAt: now,
    updatedAt: now
  }
  memoryStore.set('entries', [...entries, entry])
  return entry
}

export function readMemory(key: string): MemoryEntry | null {
  return memoryStore.get('entries').find((e) => e.key === key) ?? null
}

export function deleteMemory(key: string): void {
  memoryStore.set(
    'entries',
    memoryStore.get('entries').filter((e) => e.key !== key)
  )
}

// ── MCP server config ────────────────────────────────────────────────────────

export interface McpServer {
  id: string
  name: string
  command: string
  args: string[]
  enabled: boolean
}

const mcpStore = new ElectronStore<{ servers: McpServer[] }>({
  name: 'mcp-servers',
  defaults: { servers: [] }
})

export function listMcpServers(): McpServer[] {
  return mcpStore.get('servers')
}

export function addMcpServer(data: Omit<McpServer, 'id'>): McpServer {
  const server: McpServer = { ...data, id: randomUUID() }
  mcpStore.set('servers', [...listMcpServers(), server])
  return server
}

export function updateMcpServer(id: string, changes: Partial<Omit<McpServer, 'id'>>): McpServer {
  const servers = listMcpServers().map((s) => (s.id === id ? { ...s, ...changes } : s))
  mcpStore.set('servers', servers)
  const updated = servers.find((s) => s.id === id)
  if (!updated) throw new Error(`MCP server not found: ${id}`)
  return updated
}

export function removeMcpServer(id: string): void {
  mcpStore.set('servers', listMcpServers().filter((s) => s.id !== id))
}
