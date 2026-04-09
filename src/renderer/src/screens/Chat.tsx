import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, RefreshCw, ChevronDown, ChevronRight, Brain } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import type { Settings } from '@renderer/hooks/useSettings'
import type { ChatSession, ChatMessage } from '@renderer/hooks/useChats'
import { MarkdownMessage } from '@renderer/components/MarkdownMessage'
import type { AgentStep } from '../../../preload/index.d'

interface ChatProps {
  settings: Settings
  activeChat: ChatSession | null
  onUpdateChat: (id: string, updates: Partial<Omit<ChatSession, 'id' | 'createdAt'>>) => void
  onCreateChat: (model?: string) => string
}

// ── Agent step display ───────────────────────────────────────────────────────

function AgentStepCard({ step }: { step: AgentStep }): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  if (step.type === 'tool-call') {
    const isThink = step.toolName === 'think'
    const thought = isThink ? (step.args?.thought as string | undefined) : undefined
    return (
      <div className="flex justify-start">
        <div
          className={cn(
            'max-w-[80%] rounded-xl px-3 py-2 text-xs border border-border bg-background text-muted-foreground',
            isThink && 'cursor-pointer hover:bg-accent/50 transition-colors'
          )}
          onClick={isThink ? () => setExpanded((v) => !v) : undefined}
        >
          <div className="flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 shrink-0" />
            <span className="font-medium">{isThink ? 'Thinking…' : `Using ${step.toolName}…`}</span>
            {isThink && thought && (
              <span className="ml-auto">
                {expanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </span>
            )}
          </div>
          {expanded && thought && (
            <p className="mt-1.5 italic leading-relaxed border-l-2 border-border pl-2 text-foreground/70">
              {thought}
            </p>
          )}
        </div>
      </div>
    )
  }

  return <></>
}

function AgentStepList({ steps }: { steps: AgentStep[] }): JSX.Element {
  // Only render tool-call steps (results are implicit in the collapsed card)
  const toolCallSteps = steps.filter((s) => s.type === 'tool-call')
  if (toolCallSteps.length === 0) return <></>
  return (
    <div className="space-y-1.5">
      {toolCallSteps.map((step, i) => (
        <AgentStepCard key={i} step={step} />
      ))}
    </div>
  )
}

export function Chat({ settings, activeChat, onUpdateChat, onCreateChat }: ChatProps): JSX.Element {
  const [selectedModel, setSelectedModel] = useState(activeChat?.model ?? '')
  const [models, setModels] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([])
  const [ollamaError, setOllamaError] = useState<string | null>(null)

  const streamRef = useRef('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [input, setInput] = useState('')

  // Sync selected model when switching chats
  useEffect(() => {
    setSelectedModel(activeChat?.model ?? '')
    setStreamingContent('')
    streamRef.current = ''
    // Reset input only when the active chat changes identity
  }, [activeChat?.id])

  const loadModels = useCallback(async () => {
    try {
      const list = await window.ollama.list()
      const names = list.map((m) => m.name)
      setModels(names)
      if (names.length > 0) {
        setSelectedModel((prev) => {
          const resolved = names.includes(prev) ? prev : names[0]
          // Persist the resolved model onto the active chat if it changed
          if (activeChat && resolved !== activeChat.model) {
            onUpdateChat(activeChat.id, { model: resolved })
          }
          return resolved
        })
      }
      setOllamaError(null)
    } catch {
      setOllamaError('Could not connect to Ollama. It may still be starting up.')
    }
  }, [activeChat, onUpdateChat])

  useEffect(() => {
    loadModels()
  }, [loadModels])

  // Auto-scroll on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [activeChat?.messages, streamingContent])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  const handleModelChange = (model: string): void => {
    setSelectedModel(model)
    if (activeChat) {
      onUpdateChat(activeChat.id, { model })
    }
  }

  const handleSend = async (): Promise<void> => {
    if (!selectedModel || !input.trim() || isStreaming) return

    // Ensure there is an active chat to write into
    let chatId = activeChat?.id ?? ''
    let existingMessages: ChatMessage[] = activeChat?.messages ?? []

    if (!chatId) {
      chatId = onCreateChat(selectedModel)
      existingMessages = []
    }

    const content = input.trim()
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content }
    const updatedMessages = [...existingMessages, userMsg]

    // Auto-title from the first user message
    const isFirstMessage = existingMessages.length === 0
    const title = isFirstMessage
      ? content.slice(0, 50) + (content.length > 50 ? '…' : '')
      : undefined

    // Persist the user message (and optional title) immediately
    onUpdateChat(chatId, {
      messages: updatedMessages,
      model: selectedModel,
      ...(title ? { title } : {})
    })

    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsStreaming(true)
    streamRef.current = ''
    setStreamingContent('')
    setAgentSteps([])

    const apiMessages = [
      ...(settings.systemPrompt
        ? [{ role: 'system' as const, content: settings.systemPrompt }]
        : []),
      ...updatedMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    ]

    const cleanupToken = window.ollama.onAgentToken((token) => {
      streamRef.current += token
      setStreamingContent(streamRef.current)
    })

    const cleanupStep = window.ollama.onAgentStep((step) => {
      setAgentSteps((prev) => [...prev, step])
    })

    try {
      await window.ollama.agent(selectedModel, apiMessages, {
        temperature: settings.temperature,
        num_ctx: settings.numCtx,
        ...(settings.numGpu !== 0 ? { num_gpu: settings.numGpu } : {})
      })
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: streamRef.current
      }
      onUpdateChat(chatId, { messages: [...updatedMessages, assistantMsg] })
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `⚠️ Error: ${String(err)}`
      }
      onUpdateChat(chatId, { messages: [...updatedMessages, errorMsg] })
    } finally {
      cleanupToken()
      cleanupStep()
      setStreamingContent('')
      streamRef.current = ''
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const messages = activeChat?.messages ?? []

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        {models.length > 0 ? (
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            disabled={isStreaming}
            className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            {models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        ) : (
          <span className="flex-1 text-sm text-muted-foreground">
            {ollamaError ? 'No models available' : 'Loading models…'}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={loadModels}
          disabled={isStreaming}
          title="Refresh models"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Empty state */}
        {messages.length === 0 && !isStreaming && (
          <div className="flex items-center justify-center h-full">
            {ollamaError ? (
              <div className="text-center space-y-2">
                <p className="text-muted-foreground text-sm">{ollamaError}</p>
                <Button variant="outline" size="sm" onClick={loadModels}>
                  Retry
                </Button>
              </div>
            ) : models.length === 0 ? (
              <div className="text-center space-y-1">
                <p className="text-foreground text-sm font-medium">No models installed</p>
                <p className="text-muted-foreground text-xs">
                  Go to the Models screen to download one.
                </p>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <p className="text-foreground text-sm font-medium">Start a conversation</p>
                <p className="text-muted-foreground text-xs">
                  Type a message below and press Enter.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Message list */}
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm break-words',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap leading-relaxed'
                    : 'bg-muted text-foreground rounded-bl-sm'
                )}
              >
                {msg.role === 'user' ? msg.content : <MarkdownMessage content={msg.content} />}
              </div>
            </div>
          ))}

          {/* Streaming / agent steps area */}
          {isStreaming && (
            <div className="space-y-2">
              {/* Agent tool-call steps */}
              <AgentStepList steps={agentSteps} />

              {/* Streaming response bubble */}
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm bg-muted text-foreground break-words min-w-[60px] min-h-[36px]">
                    {streamingContent ? (
                    <MarkdownMessage content={streamingContent} />
                  ) : (
                    <span className="flex gap-1 items-center h-full">
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border px-4 py-3 shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              models.length === 0
                ? 'Download a model first…'
                : 'Message (Enter to send, Shift+Enter for newline)'
            }
            disabled={isStreaming || models.length === 0}
            rows={1}
            className={cn(
              'flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm',
              'text-foreground placeholder:text-muted-foreground resize-none overflow-y-auto',
              'focus:outline-none focus:ring-2 focus:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          />
          <Button
            onClick={handleSend}
            disabled={!selectedModel || !input.trim() || isStreaming}
            size="icon"
            className="shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
