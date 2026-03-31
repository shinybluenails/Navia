import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import type { Settings } from '@renderer/hooks/useSettings'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatProps {
  settings: Settings
}

export function Chat({ settings }: ChatProps): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [ollamaError, setOllamaError] = useState<string | null>(null)

  const streamRef = useRef('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const loadModels = useCallback(async () => {
    try {
      const list = await window.ollama.list()
      const names = list.map((m) => m.name)
      setModels(names)
      if (names.length > 0) {
        setSelectedModel((prev) => (names.includes(prev) ? prev : names[0]))
      }
      setOllamaError(null)
    } catch {
      setOllamaError('Could not connect to Ollama. It may still be starting up.')
    }
  }, [])

  useEffect(() => {
    loadModels()
  }, [loadModels])

  // Auto-scroll on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages, streamingContent])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
  }

  const handleSend = async () => {
    if (!selectedModel || !input.trim() || isStreaming) return

    const content = input.trim()
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content }
    const newMessages = [...messages, userMsg]

    setMessages(newMessages)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsStreaming(true)
    streamRef.current = ''
    setStreamingContent('')

    const apiMessages = [
      ...(settings.systemPrompt
        ? [{ role: 'system' as const, content: settings.systemPrompt }]
        : []),
      ...newMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    ]

    const cleanupToken = window.ollama.onChatToken((token) => {
      streamRef.current += token
      setStreamingContent(streamRef.current)
    })

    try {
      await window.ollama.chat(selectedModel, apiMessages, {
        temperature: settings.temperature,
        num_ctx: settings.numCtx,
        ...(settings.numGpu !== 0 ? { num_gpu: settings.numGpu } : {})
      })
      const finalContent = streamRef.current
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: finalContent }
      ])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `⚠️ Error: ${String(err)}`
        }
      ])
    } finally {
      cleanupToken()
      setStreamingContent('')
      streamRef.current = ''
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleClear = () => {
    setMessages([])
    setStreamingContent('')
    streamRef.current = ''
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        {models.length > 0 ? (
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
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
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClear}
          disabled={isStreaming || messages.length === 0}
          title="Clear conversation"
        >
          <Trash2 className="w-4 h-4" />
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
                <p className="text-foreground text-sm font-medium">
                  Start a conversation
                </p>
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
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words leading-relaxed',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Streaming message */}
          {isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm bg-muted text-foreground whitespace-pre-wrap break-words leading-relaxed min-w-[60px] min-h-[36px]">
                {streamingContent || (
                  <span className="flex gap-1 items-center h-full">
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                )}
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
