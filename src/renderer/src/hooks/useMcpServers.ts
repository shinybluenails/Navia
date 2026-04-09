import { useState, useEffect, useCallback } from 'react'

export interface McpServerStatus {
  id: string
  name: string
  command: string
  args: string[]
  enabled: boolean
  connected: boolean
  toolCount: number
}

export function useMcpServers() {
  const [servers, setServers] = useState<McpServerStatus[]>([])

  const refresh = useCallback(async () => {
    const list = await window.mcp.list()
    setServers(list as McpServerStatus[])
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const add = useCallback(
    async (data: { name: string; command: string; args: string[]; enabled: boolean }) => {
      await window.mcp.add(data)
      await refresh()
    },
    [refresh]
  )

  const remove = useCallback(
    async (id: string) => {
      await window.mcp.remove(id)
      await refresh()
    },
    [refresh]
  )

  const toggle = useCallback(
    async (id: string, enabled: boolean) => {
      await window.mcp.toggle(id, enabled)
      await refresh()
    },
    [refresh]
  )

  return { servers, add, remove, toggle, refresh }
}
