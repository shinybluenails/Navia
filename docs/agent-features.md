# Navia Agent Features

This document describes the agentic capabilities added to Navia across Phases 1–6.

---

## Phase 1 — Agent Loop

### What was added
- **Multi-turn tool-calling loop** in the main process (`src/main/index.ts`, `ollama:agent` IPC handler)
- **Tool registry** (`src/main/tools/registry.ts`) — a central map of named tools, each with an Ollama-compatible JSON schema and an async `execute` function
- **`think` tool** — a built-in no-op scratchpad tool; the model calls it to reason step-by-step before responding. The thought text is streamed to the UI as an agent step.
- **`AgentStepList` / `AgentStepCard`** components in the Chat screen — each tool call and result appears as a collapsible card above the model's final reply
- **New Ollama client types**: `OllamaTool`, `OllamaToolCall`, `ChatEvent` (discriminated union: `token | tool_calls`); the `chat()` generator now yields these

### How it works
When the user sends a message, `Chat.tsx` calls `window.ollama.agent()`. The main process runs a loop (up to 10 iterations):

1. Send the conversation to Ollama, including all registered tool schemas
2. **If the model returns tool calls** — execute each tool, append results to the message history, repeat
3. **If the model returns plain text** — stream tokens back to the renderer and return

The `ollama:agent-step` push event carries each `tool-call` and `tool-result` to the renderer in real time. The `ollama:agent-token` push event carries streamed text tokens.

---

## Phase 2 — Persistence (electron-store)

### What was added
- **`electron-store@8`** for persistent, file-backed JSON storage in the main process (v8 chosen for CJS compatibility with electron-vite)
- **`src/main/store.ts`** — two stores:
  - `todos.json` — the `Todo` entity: `id`, `title`, `description`, `status`, `priority`, `dueDate`, `tags`, `createdAt`, `updatedAt`
  - `memory.json` — the `MemoryEntry` entity: `id`, `key`, `value`, `category`, `createdAt`, `updatedAt`
- **IPC handlers** for both stores (`todo:list/create/update/delete`, `memory:list/write/read/delete`)
- **`window.todos.*`** and **`window.memory.*`** APIs exposed via `contextBridge`

### How it works
All reads and writes happen in the main process via IPC. `electron-store` serialises the data to JSON files in Electron's `userData` directory. Because storage is in the main process, it is accessible to both the UI and the AI tool handlers.

---

## Phase 3 — Agentic Memory

### What was added
- **`remember` tool** — stores a key/value fact about the user (with optional category). Upserts if the key already exists.
- **`recall` tool** — retrieves a specific stored memory by key.
- **`list_memories` tool** — lists all stored memories, optionally filtered by category.
- **`forget` tool** — deletes a memory entry by key.
- **System prompt injection** — before every agent call, all stored memories are appended to the system message so the model always knows what it has learned about the user.

### How it works
Memory tools are registered in `src/main/tools/registry.ts`. They call the same CRUD functions used by the IPC handlers in `store.ts`. At the start of each `ollama:agent` invocation, the handler reads all memory entries and formats them as a bullet list appended to the system prompt:

```
---
What you know about the user:
- preferred_language: TypeScript
- work_hours: 9am–6pm
```

The model can call `remember` mid-conversation to save new facts that will persist across app restarts.

---

## Phase 4 — Todo Tracking

### What was added
- **`create_todo` tool** — creates a new task with title, optional description, priority (`low | medium | high`), optional due date and tags. Returns the new todo's short ID.
- **`list_todos` tool** — lists all todos, optionally filtered by `status` (`todo | in-progress | done`) or `priority`.
- **`update_todo` tool** — updates status, priority, title, or description on an existing todo (accepts the first 8 characters of the UUID as a short ID).
- **`delete_todo` tool** — removes a todo by short ID.
- **Tasks screen** (`src/renderer/src/screens/Tasks.tsx`) — a three-column kanban board (To Do / In Progress / Done). Each card shows priority, tags, and due date. Click the status icon to advance a card through the columns. Press Enter in the quick-add bar at the top of any column to create a task directly.
- **`useTodos` hook** (`src/renderer/src/hooks/useTodos.ts`) — subscribes to the `todos:changed` push event so the board refreshes immediately when the AI creates or updates tasks, without requiring the user to navigate away and back.
- **System prompt injection** — open (non-done) todos are appended to the system message alongside memories so the model is always aware of the user's current workload.
- **Tasks nav item** added to the Sidebar.

### How it works
Todo tools call `store.ts` CRUD functions. After every mutation IPC handler (`todo:create/update/delete`), the main process sends a `todos:changed` event to the renderer, which triggers `useTodos` to re-fetch. This ensures the Tasks screen is always up to date whether a task was created by the AI or by the user directly in the UI.

---

## Phase 5 — PC Troubleshooting

### What was added
- **`src/main/tools/system.ts`** — three Windows-first system information functions:
  - `getSystemInfo()` — CPU usage %, total/used RAM, per-disk usage via the `systeminformation` package
  - `getRunningProcesses(sortBy, limit)` — top processes sorted by CPU or memory
  - `getEventLog(logName, maxEvents, level?)` — queries the Windows Event Log via PowerShell `Get-WinEvent`; `logName` is validated against an allowlist (`System`, `Application`, `Security`, `Setup`); falls back gracefully on non-Windows platforms
- **`get_system_info` tool** — registered in the tool registry; returns a JSON summary of system health
- **`get_running_processes` tool** — accepts `sort_by` (`cpu | memory`) and `limit` (1–50)
- **`get_event_log` tool** — accepts `log_name`, `max_events` (1–100), and optional `level` (`Critical | Error | Warning | Information`)
- **Tool-calling badges** — the Models screen now shows a blue `tool-calling` badge next to model variants that are known to support function calling (llama3.1, qwen2.5, qwen3, phi4, phi4-mini, mistral, mixtral, command-r, firefunction, nemotron-mini)
- **`modelSupportsTools()` guard** — gates whether the `tools` array is sent to Ollama; prevents hanging with models that do not support function calling (e.g. llama3.2)

### How it works
The model can ask "what's my CPU doing?" and the agent loop will call `get_system_info`, receive a JSON snapshot, and answer in plain English. For deeper diagnosis it can call `get_event_log` to read recent Windows errors and correlate them with running processes.

---

## Phase 6 — MCP (Model Context Protocol)

### What was added
- **`src/main/mcp/client.ts`** — `McpClient` class:
  - Spawns an MCP server as a child process (stdio transport)
  - Speaks **JSON-RPC 2.0** over stdin/stdout
  - Performs the full MCP handshake: `initialize` → `notifications/initialized` → `tools/list`
  - `call(toolName, args)` executes a tool and returns the text content of the response
  - 30-second per-request timeout; auto-cleans up pending requests on process exit
  - `mcpToolToOllama()` converts MCP `inputSchema` → Ollama's `parameters` format so tools from any MCP server drop straight into the agent loop
- **`McpServer` config** in `store.ts` — persisted in `mcp-servers.json`: `id`, `name`, `command`, `args[]`, `enabled`
- **IPC handlers** in `index.ts`: `mcp:list`, `mcp:add`, `mcp:remove`, `mcp:toggle`
- **`window.mcp.*`** API in the preload (contextBridge)
- **`useMcpServers` hook** (`src/renderer/src/hooks/useMcpServers.ts`) — list, add, remove, toggle
- **MCP Servers section in Settings** — add any stdio MCP server by specifying a display name, the executable to run (`npx`, `uvx`, `node`, …), and the arguments. Toggle servers on/off; the status badge shows how many tools are live.
- **Agent loop integration** — at the start of every agent call, tools from all connected MCP servers are merged with the built-in tool list. The `hasTool()` helper routes execution: built-in tools go to `executeTool()` in the registry, everything else goes to `executeMcpTool()` which finds the right `McpClient`.

### How it works

#### Connecting a server
1. User enters a server config in Settings (e.g. Command: `npx`, Args: `-y @modelcontextprotocol/server-brave-search`)
2. Config is saved to `mcp-servers.json` and `McpClient.connect()` is called immediately if enabled
3. The client spawns the process, handshakes, and caches the tool list
4. Status badge turns green: `N tools`

#### Using tools in a conversation
Tool schemas from all connected servers are included in every `ollama:agent` request. If the model calls an MCP tool, `executeMcpTool()` finds the client that owns that tool name and calls `tools/call` over the existing stdio pipe.

#### Example servers
| Purpose | Command | Arguments |
|---|---|---|
| Local filesystem | `npx` | `-y @modelcontextprotocol/server-filesystem /path/to/folder` |
| Web fetch | `uvx` | `mcp-server-fetch` |
| Brave Search | `npx` | `-y @modelcontextprotocol/server-brave-search` |
| SQLite | `uvx` | `mcp-server-sqlite --db-path /path/to/db.sqlite` |

---

## Architecture Overview

```
Renderer (React)                    Main Process
──────────────────                  ──────────────────────────────────────

Chat.tsx                            ollama:agent IPC handler
  │  window.ollama.agent()   ──────►  inject memories + open todos
  │  onAgentToken(token)     ◄──────  into system prompt
  │  onAgentStep(step)       ◄──────  run tool loop (max 10 turns)
  │                                     │
Tasks.tsx                              ├─ getTools()     (registry.ts)
  │  window.todos.*          ◄──────  ├─ mcp tools      (McpClient[])
  │  todos:changed push      ◄──────  │
  │                                   ├─ executeTool()   built-in
Settings.tsx (MCP section)           └─ executeMcpTool() → McpClient
  │  window.mcp.*            ──────►
                                     store.ts
                                       todos.json       (electron-store)
                                       memory.json
                                       mcp-servers.json
```

### Built-in tools

| Tool | Purpose |
|---|---|
| `think` | Model scratchpad — reason before answering |
| `remember` | Store a key/value fact about the user |
| `recall` | Retrieve a stored memory by key |
| `list_memories` | List all stored memories |
| `forget` | Delete a memory entry |
| `create_todo` | Create a new task |
| `list_todos` | List tasks (filterable by status/priority) |
| `update_todo` | Change status, priority, title, or description |
| `delete_todo` | Remove a task |
| `get_system_info` | CPU%, RAM, disk usage snapshot |
| `get_running_processes` | Top processes by CPU or memory |
| `get_event_log` | Windows Event Log query (System/Application/Security) |
