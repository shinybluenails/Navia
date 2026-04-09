import { exec } from 'child_process'
import { promisify } from 'util'
import si from 'systeminformation'

const execAsync = promisify(exec)

// ── System info ───────────────────────────────────────────────────────────────

export async function getSystemInfo(): Promise<string> {
  const [cpu, mem, disk, osInfo] = await Promise.all([
    si.currentLoad(),
    si.mem(),
    si.fsSize(),
    si.osInfo()
  ])

  const cpuPct = cpu.currentLoad.toFixed(1)
  const ramUsedGB = (mem.active / 1e9).toFixed(1)
  const ramTotalGB = (mem.total / 1e9).toFixed(1)
  const ramPct = ((mem.active / mem.total) * 100).toFixed(1)

  const diskLines = disk
    .filter((d) => d.size > 0)
    .map((d) => {
      const usedGB = ((d.size - d.available) / 1e9).toFixed(1)
      const totalGB = (d.size / 1e9).toFixed(1)
      const pct = (((d.size - d.available) / d.size) * 100).toFixed(1)
      return `  ${d.mount}: ${usedGB} GB used of ${totalGB} GB (${pct}%)`
    })
    .join('\n')

  return [
    `OS: ${osInfo.distro} ${osInfo.release} (${osInfo.arch})`,
    `CPU load: ${cpuPct}%`,
    `RAM: ${ramUsedGB} GB used of ${ramTotalGB} GB (${ramPct}%)`,
    `Disk:`,
    diskLines || '  (no drives found)'
  ].join('\n')
}

// ── Running processes ─────────────────────────────────────────────────────────

export async function getRunningProcesses(
  sortBy: 'cpu' | 'memory' = 'cpu',
  limit = 10
): Promise<string> {
  const data = await si.processes()
  const sorted = [...data.list].sort((a, b) =>
    sortBy === 'cpu' ? b.cpu - a.cpu : b.mem - a.mem
  )
  const top = sorted.slice(0, limit)
  const lines = top.map(
    (p) => `  ${p.name} (pid ${p.pid}) — CPU: ${p.cpu.toFixed(1)}%, MEM: ${p.mem.toFixed(1)}%`
  )
  return `Top ${limit} processes by ${sortBy}:\n` + lines.join('\n')
}

// ── Windows Event Log ─────────────────────────────────────────────────────────

export interface EventLogEntry {
  TimeCreated: string
  Id: number
  LevelDisplayName: string
  Message: string
}

export async function getEventLog(
  logName: 'Application' | 'System' | 'Security' = 'System',
  maxEvents = 20,
  level?: 'Error' | 'Warning' | 'Information'
): Promise<string> {
  if (process.platform !== 'win32') {
    return `Event log is only available on Windows. Current platform: ${process.platform}`
  }

  const levelFilter = level
    ? ` | Where-Object { $_.LevelDisplayName -eq '${level}' }`
    : ''

  // Sanitise logName to prevent injection — only allow known log names
  const safeLogName = ['Application', 'System', 'Security'].includes(logName)
    ? logName
    : 'System'

  const ps = [
    `Get-WinEvent -LogName '${safeLogName}' -MaxEvents ${maxEvents * 3}`,
    levelFilter,
    `| Select-Object -First ${maxEvents} TimeCreated, Id, LevelDisplayName, @{Name='Message';Expression={$_.Message -replace '\\r?\\n',' ' | Select-Object -First 1}} -ExcludeProperty Message`,
    `| ForEach-Object { [PSCustomObject]@{ TimeCreated=$_.TimeCreated.ToString('o'); Id=$_.Id; LevelDisplayName=$_.LevelDisplayName; Message=($_.Message -replace '[\\r\\n]+',' ').Substring(0,[Math]::Min(200,($_.Message -replace '[\\r\\n]+',' ').Length)) } }`,
    `| ConvertTo-Json -Depth 2`
  ].join(' ')

  let stdout: string
  try {
    const result = await execAsync(`powershell -NoProfile -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`, {
      timeout: 15000
    })
    stdout = result.stdout.trim()
  } catch (err) {
    return `Failed to read event log: ${String(err)}`
  }

  if (!stdout) return `No ${level ?? ''} events found in ${safeLogName} log.`

  let entries: EventLogEntry[]
  try {
    const parsed = JSON.parse(stdout)
    entries = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return `Failed to parse event log output.`
  }

  const lines = entries.map(
    (e) =>
      `[${e.LevelDisplayName}] ${e.TimeCreated} (Event ${e.Id})\n  ${e.Message}`
  )
  return `${safeLogName} log — last ${entries.length} events:\n\n` + lines.join('\n\n')
}
