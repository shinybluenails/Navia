import type { OllamaTool } from '../ollama-client'
import { writeMemory, readMemory, listMemory, deleteMemory, createTodo, listTodos, updateTodo, deleteTodo } from '../store'
import { getSystemInfo, getRunningProcesses, getEventLog } from './system'

export interface ToolHandler {
  schema: OllamaTool
  execute: (args: Record<string, unknown>) => Promise<string>
}

const registry = new Map<string, ToolHandler>()

export function registerTool(name: string, handler: ToolHandler): void {
  registry.set(name, handler)
}

export function getTools(): OllamaTool[] {
  return Array.from(registry.values()).map((h) => h.schema)
}

export function hasTool(name: string): boolean {
  return registry.has(name)
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const handler = registry.get(name)
  if (!handler) throw new Error(`Unknown tool: ${name}`)
  return handler.execute(args)
}

// Built-in: think tool — lets the model reason step by step
registerTool('think', {
  schema: {
    type: 'function',
    function: {
      name: 'think',
      description:
        'Use this to reason through a problem or plan your approach before answering. The thought is visible to the user.',
      parameters: {
        type: 'object',
        properties: {
          thought: {
            type: 'string',
            description: 'Your reasoning, plan, or chain of thought'
          }
        },
        required: ['thought']
      }
    }
  },
  execute: async (_args) => {
    // No-op: the thought is displayed via the agent-step event
    return `Thought recorded.`
  }
})

// ── Memory tools ─────────────────────────────────────────────────────────────

registerTool('remember', {
  schema: {
    type: 'function',
    function: {
      name: 'remember',
      description:
        'Store a fact or piece of information about the user to recall in future conversations. Use a short descriptive key.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Short identifier, e.g. "user_name" or "preferred_language"' },
          value: { type: 'string', description: 'The information to remember' },
          category: { type: 'string', description: 'Optional grouping, e.g. "preferences", "personal", "work"' }
        },
        required: ['key', 'value']
      }
    }
  },
  execute: async (args) => {
    const entry = await writeMemory(
      args.key as string,
      args.value as string,
      args.category as string | undefined
    )
    return `Remembered: ${entry.key} = ${entry.value}`
  }
})

registerTool('recall', {
  schema: {
    type: 'function',
    function: {
      name: 'recall',
      description: 'Retrieve a specific stored memory by its key.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The key to look up' }
        },
        required: ['key']
      }
    }
  },
  execute: async (args) => {
    const entry = readMemory(args.key as string)
    if (!entry) return `No memory found for key: ${args.key}`
    return `${entry.key}: ${entry.value}`
  }
})

registerTool('list_memories', {
  schema: {
    type: 'function',
    function: {
      name: 'list_memories',
      description: 'List all stored memories, optionally filtered by category.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Optional category to filter by' }
        },
        required: []
      }
    }
  },
  execute: async (args) => {
    const entries = listMemory()
    const filtered = args.category
      ? entries.filter((e) => e.category === (args.category as string))
      : entries
    if (filtered.length === 0) return 'No memories stored yet.'
    return filtered.map((e) => `${e.key}: ${e.value}${e.category ? ` [${e.category}]` : ''}`).join('\n')
  }
})

registerTool('forget', {
  schema: {
    type: 'function',
    function: {
      name: 'forget',
      description: 'Delete a stored memory by its key.',
      parameters: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'The key to delete' }
        },
        required: ['key']
      }
    }
  },
  execute: async (args) => {
    deleteMemory(args.key as string)
    return `Forgot: ${args.key}`
  }
})

// ── Todo tools ────────────────────────────────────────────────────────────────

registerTool('create_todo', {
  schema: {
    type: 'function',
    function: {
      name: 'create_todo',
      description: 'Create a new task or todo item for the user.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short title for the task' },
          description: { type: 'string', description: 'Optional longer description' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Priority level' },
          due_date: { type: 'string', description: 'Optional due date in YYYY-MM-DD format' }
        },
        required: ['title']
      }
    }
  },
  execute: async (args) => {
    const todo = createTodo({
      title: args.title as string,
      description: args.description as string | undefined,
      status: 'todo',
      priority: (args.priority as 'low' | 'medium' | 'high') ?? 'medium',
      dueDate: args.due_date as string | undefined
    })
    return `Created todo: "${todo.title}" (id: ${todo.id}, priority: ${todo.priority})`
  }
})

registerTool('list_todos', {
  schema: {
    type: 'function',
    function: {
      name: 'list_todos',
      description: 'List the user\'s todos, optionally filtered by status or priority.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['todo', 'in-progress', 'done'], description: 'Filter by status' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Filter by priority' }
        },
        required: []
      }
    }
  },
  execute: async (args) => {
    let todos = listTodos()
    if (args.status) todos = todos.filter((t) => t.status === args.status)
    if (args.priority) todos = todos.filter((t) => t.priority === args.priority)
    if (todos.length === 0) return 'No todos found.'
    return todos
      .map((t) => `[${t.id.slice(0, 8)}] (${t.status}, ${t.priority}) ${t.title}${t.dueDate ? ` — due ${t.dueDate}` : ''}${t.description ? `\n  ${t.description}` : ''}`)
      .join('\n')
  }
})

registerTool('update_todo', {
  schema: {
    type: 'function',
    function: {
      name: 'update_todo',
      description: 'Update a todo\'s status, priority, title, description, or due date.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The todo id (first 8 chars are enough)' },
          title: { type: 'string', description: 'New title' },
          description: { type: 'string', description: 'New description' },
          status: { type: 'string', enum: ['todo', 'in-progress', 'done'], description: 'New status' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'], description: 'New priority' },
          due_date: { type: 'string', description: 'New due date in YYYY-MM-DD format' }
        },
        required: ['id']
      }
    }
  },
  execute: async (args) => {
    const idPrefix = args.id as string
    const todos = listTodos()
    const match = todos.find((t) => t.id === idPrefix || t.id.startsWith(idPrefix))
    if (!match) return `No todo found with id starting with: ${idPrefix}`
    const updated = updateTodo(match.id, {
      ...(args.title !== undefined ? { title: args.title as string } : {}),
      ...(args.description !== undefined ? { description: args.description as string } : {}),
      ...(args.status !== undefined ? { status: args.status as 'todo' | 'in-progress' | 'done' } : {}),
      ...(args.priority !== undefined ? { priority: args.priority as 'low' | 'medium' | 'high' } : {}),
      ...(args.due_date !== undefined ? { dueDate: args.due_date as string } : {})
    })
    return `Updated todo "${updated.title}": status=${updated.status}, priority=${updated.priority}`
  }
})

registerTool('delete_todo', {
  schema: {
    type: 'function',
    function: {
      name: 'delete_todo',
      description: 'Permanently delete a todo.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The todo id (first 8 chars are enough)' }
        },
        required: ['id']
      }
    }
  },
  execute: async (args) => {
    const idPrefix = args.id as string
    const todos = listTodos()
    const match = todos.find((t) => t.id === idPrefix || t.id.startsWith(idPrefix))
    if (!match) return `No todo found with id starting with: ${idPrefix}`
    deleteTodo(match.id)
    return `Deleted todo: "${match.title}"`
  }
})

// ── System tools ──────────────────────────────────────────────────────────────

registerTool('get_system_info', {
  schema: {
    type: 'function',
    function: {
      name: 'get_system_info',
      description: 'Get current system resource usage: CPU load, RAM usage, and disk space for all drives.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  execute: async (_args) => getSystemInfo()
})

registerTool('get_running_processes', {
  schema: {
    type: 'function',
    function: {
      name: 'get_running_processes',
      description: 'List the top running processes sorted by CPU or memory usage.',
      parameters: {
        type: 'object',
        properties: {
          sort_by: {
            type: 'string',
            enum: ['cpu', 'memory'],
            description: 'Sort processes by CPU usage or memory usage (default: cpu)'
          },
          limit: {
            type: 'string',
            description: 'Number of processes to return (default: 10)'
          }
        },
        required: []
      }
    }
  },
  execute: async (args) =>
    getRunningProcesses(
      (args.sort_by as 'cpu' | 'memory') ?? 'cpu',
      args.limit ? parseInt(args.limit as string, 10) : 10
    )
})

registerTool('get_event_log', {
  schema: {
    type: 'function',
    function: {
      name: 'get_event_log',
      description:
        'Read entries from the Windows Event Log. Useful for diagnosing errors, crashes, and system issues. Only available on Windows.',
      parameters: {
        type: 'object',
        properties: {
          log_name: {
            type: 'string',
            enum: ['Application', 'System', 'Security'],
            description: 'The event log to query (default: System)'
          },
          level: {
            type: 'string',
            enum: ['Error', 'Warning', 'Information'],
            description: 'Filter by severity level (optional — omit for all levels)'
          },
          max_events: {
            type: 'string',
            description: 'Maximum number of events to return (default: 20)'
          }
        },
        required: []
      }
    }
  },
  execute: async (args) =>
    getEventLog(
      (args.log_name as 'Application' | 'System' | 'Security') ?? 'System',
      args.max_events ? parseInt(args.max_events as string, 10) : 20,
      args.level as 'Error' | 'Warning' | 'Information' | undefined
    )
})
