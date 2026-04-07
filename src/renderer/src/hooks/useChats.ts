import { useState, useCallback } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSession {
  id: string
  title: string
  model: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

const CHATS_KEY = 'navia-chats'
const ACTIVE_KEY = 'navia-active-chat'

function loadChats(): ChatSession[] {
  try {
    const raw = localStorage.getItem(CHATS_KEY)
    return raw ? (JSON.parse(raw) as ChatSession[]) : []
  } catch {
    return []
  }
}

function saveChats(chats: ChatSession[]): void {
  try {
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats))
  } catch {
    // ignore storage errors
  }
}

function loadActiveId(chats: ChatSession[]): string | null {
  try {
    const id = localStorage.getItem(ACTIVE_KEY)
    return id && chats.some((c) => c.id === id) ? id : (chats[0]?.id ?? null)
  } catch {
    return chats[0]?.id ?? null
  }
}

function saveActiveId(id: string | null): void {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_KEY, id)
    } else {
      localStorage.removeItem(ACTIVE_KEY)
    }
  } catch {
    // ignore
  }
}

export function useChats(): {
  chats: ChatSession[]
  activeChatId: string | null
  activeChat: ChatSession | null
  createChat: (model?: string) => string
  deleteChat: (id: string) => void
  selectChat: (id: string) => void
  updateChat: (id: string, updates: Partial<Omit<ChatSession, 'id' | 'createdAt'>>) => void
} {
  const [chats, setChats] = useState<ChatSession[]>(loadChats)
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    const initial = loadChats()
    return loadActiveId(initial)
  })

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null

  const createChat = useCallback((model = ''): string => {
    const id = crypto.randomUUID()
    const now = Date.now()
    const chat: ChatSession = {
      id,
      title: 'New Chat',
      model,
      messages: [],
      createdAt: now,
      updatedAt: now
    }
    setChats((prev) => {
      const next = [chat, ...prev]
      saveChats(next)
      return next
    })
    setActiveChatId(id)
    saveActiveId(id)
    return id
  }, [])

  const deleteChat = useCallback((id: string): void => {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id)
      saveChats(next)
      // Update active selection inside the same state update to avoid stale closure
      setActiveChatId((current) => {
        if (current !== id) return current
        const newActive = next[0]?.id ?? null
        saveActiveId(newActive)
        return newActive
      })
      return next
    })
  }, [])

  const selectChat = useCallback((id: string): void => {
    setActiveChatId(id)
    saveActiveId(id)
  }, [])

  const updateChat = useCallback(
    (id: string, updates: Partial<Omit<ChatSession, 'id' | 'createdAt'>>): void => {
      setChats((prev) => {
        const next = prev.map((c) =>
          c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
        )
        saveChats(next)
        return next
      })
    },
    []
  )

  return { chats, activeChatId, activeChat, createChat, deleteChat, selectChat, updateChat }
}
