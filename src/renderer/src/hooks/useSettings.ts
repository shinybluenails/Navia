import { useState } from 'react'

export interface Settings {
  systemPrompt: string
  temperature: number
  numCtx: number
  numGpu: number
}

const DEFAULTS: Settings = {
  systemPrompt: 'You are a helpful assistant.',
  temperature: 0.7,
  numCtx: 2048,
  numGpu: 0
}

const STORAGE_KEY = 'homemind-settings'

export function useSettings(): { settings: Settings; updateSettings: (updates: Partial<Settings>) => void } {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
    } catch {
      return DEFAULTS
    }
  })

  function updateSettings(updates: Partial<Settings>): void {
    setSettings((prev) => {
      const next = { ...prev, ...updates }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }

  return { settings, updateSettings }
}
