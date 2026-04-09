import { useState, useEffect, useCallback } from 'react'
import { Download, Trash2, RefreshCw, Search, HardDrive } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Progress } from '@renderer/components/ui/progress'
import { Badge } from '@renderer/components/ui/badge'
import { Separator } from '@renderer/components/ui/separator'
import { cn } from '@renderer/lib/utils'
import type { OllamaModel, PullProgress } from '@renderer/../../preload/index.d'

interface RegistryModel {
  name: string
  label: string
  description: string
  size: string
  tags?: string[]
}

const REGISTRY_MODELS: RegistryModel[] = [
  { name: 'llama3.2:1b', label: 'Llama 3.2 1B', description: 'Meta · Great starting point', size: '1.3 GB', tags: ['recommended', 'fast'] },
  { name: 'llama3.2:3b', label: 'Llama 3.2 3B', description: 'Meta · Good balance of speed and quality', size: '2.0 GB' },
  { name: 'llama3.1:8b', label: 'Llama 3.1 8B', description: 'Meta · High quality responses', size: '4.7 GB', tags: ['tool-calling'] },
  { name: 'gemma3:1b', label: 'Gemma 3 1B', description: 'Google · Tiny and fast', size: '815 MB', tags: ['fast'] },
  { name: 'gemma3:4b', label: 'Gemma 3 4B', description: 'Google · Strong performance', size: '2.5 GB' },
  { name: 'gemma3:12b', label: 'Gemma 3 12B', description: 'Google · Excellent quality', size: '7.6 GB' },
  { name: 'phi4-mini:3.8b', label: 'Phi-4 Mini 3.8B', description: 'Microsoft · Efficient reasoning', size: '2.5 GB', tags: ['tool-calling'] },
  { name: 'phi4:14b', label: 'Phi-4 14B', description: 'Microsoft · Advanced reasoning', size: '9.1 GB', tags: ['tool-calling'] },
  { name: 'qwen2.5:1.5b', label: 'Qwen 2.5 1.5B', description: 'Alibaba · Multilingual support', size: '986 MB', tags: ['fast', 'tool-calling'] },
  { name: 'qwen2.5:3b', label: 'Qwen 2.5 3B', description: 'Alibaba · Good general purpose', size: '1.9 GB', tags: ['tool-calling'] },
  { name: 'qwen2.5:7b', label: 'Qwen 2.5 7B', description: 'Alibaba · Strong multilingual', size: '4.7 GB', tags: ['tool-calling'] },
  { name: 'mistral:7b', label: 'Mistral 7B', description: 'Mistral AI · Fast and capable', size: '4.1 GB', tags: ['tool-calling'] },
  { name: 'deepseek-r1:1.5b', label: 'DeepSeek R1 1.5B', description: 'DeepSeek · Reasoning model', size: '1.1 GB', tags: ['reasoning'] },
  { name: 'deepseek-r1:7b', label: 'DeepSeek R1 7B', description: 'DeepSeek · Advanced reasoning', size: '4.7 GB', tags: ['reasoning'] }
]

function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`
  return `${Math.round(bytes / 1e3)} KB`
}

export function Models(): JSX.Element {
  const [installed, setInstalled] = useState<OllamaModel[]>([])
  const [search, setSearch] = useState('')
  const [pulling, setPulling] = useState<string | null>(null)
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [customModel, setCustomModel] = useState('')

  const loadInstalled = useCallback(async () => {
    try {
      const list = await window.ollama.list()
      setInstalled(list)
      setError(null)
    } catch {
      setError('Could not connect to Ollama. It may still be starting up.')
    }
  }, [])

  useEffect(() => {
    loadInstalled()
  }, [loadInstalled])

  const installedNames = new Set(installed.map((m) => m.name))

  const handlePull = async (name: string) => {
    if (pulling) return
    setPulling(name)
    setPullProgress(null)

    const cleanup = window.ollama.onPullProgress((p) => {
      setPullProgress(p)
    })

    try {
      await window.ollama.pull(name)
      await loadInstalled()
    } catch (err) {
      setError(`Failed to download ${name}: ${String(err)}`)
    } finally {
      cleanup()
      setPulling(null)
      setPullProgress(null)
    }
  }

  const handleDelete = async (name: string) => {
    if (deleting) return
    setDeleting(name)
    try {
      await window.ollama.delete(name)
      await loadInstalled()
    } catch (err) {
      setError(`Failed to delete ${name}: ${String(err)}`)
    } finally {
      setDeleting(null)
    }
  }

  const pullPct =
    pullProgress?.total && pullProgress?.completed
      ? Math.round((pullProgress.completed / pullProgress.total) * 100)
      : null

  const filteredRegistry = REGISTRY_MODELS.filter(
    (m) =>
      search === '' ||
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.label.toLowerCase().includes(search.toLowerCase()) ||
      m.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 space-y-8">
        {/* Installed Models */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Installed Models</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {installed.length === 0 ? 'No models installed yet' : `${installed.length} model${installed.length !== 1 ? 's' : ''} installed`}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={loadInstalled} title="Refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {error && (
            <div className="text-sm text-destructive-foreground bg-destructive/20 border border-destructive/30 rounded-lg px-4 py-3 mb-4">
              {error}
            </div>
          )}

          {installed.length === 0 && !error ? (
            <div className="border border-border rounded-lg px-4 py-8 text-center">
              <HardDrive className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No models installed. Download one below.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {installed.map((model) => (
                <div
                  key={model.name}
                  className="flex items-center gap-3 border border-border rounded-lg px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{model.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {model.details?.parameter_size} · {formatBytes(model.size)} ·{' '}
                      {model.details?.quantization_level}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(model.name)}
                    disabled={deleting === model.name || !!pulling}
                    title="Delete model"
                    className="text-muted-foreground hover:text-destructive-foreground shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <Separator />

        {/* Download Models */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">Download Models</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Curated models from the Ollama library
            </p>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search models…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Custom model name */}
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Or enter any Ollama model name (e.g. codellama:7b)"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customModel.trim()) handlePull(customModel.trim())
              }}
            />
            <Button
              variant="outline"
              onClick={() => { if (customModel.trim()) handlePull(customModel.trim()) }}
              disabled={!customModel.trim() || !!pulling}
              className="shrink-0"
            >
              <Download className="w-4 h-4 mr-1.5" />
              Pull
            </Button>
          </div>

          {/* Pull progress */}
          {pulling && (
            <div className="border border-border rounded-lg px-4 py-3 mb-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium truncate">{pulling}</span>
                {pullPct !== null && (
                  <span className="text-muted-foreground shrink-0 ml-2">{pullPct}%</span>
                )}
              </div>
              {pullPct !== null ? (
                <Progress value={pullPct} />
              ) : (
                <Progress value={0} className="animate-pulse" />
              )}
              <p className="text-xs text-muted-foreground">
                {pullProgress?.status ?? 'Connecting…'}
              </p>
            </div>
          )}

          <div className="space-y-2">
            {filteredRegistry.map((model) => {
              const isInstalled = installedNames.has(model.name)
              const isPulling = pulling === model.name
              return (
                <div
                  key={model.name}
                  className={cn(
                    'flex items-center gap-3 border rounded-lg px-4 py-3 transition-colors',
                    isInstalled ? 'border-border opacity-60' : 'border-border hover:border-ring/50'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{model.label}</p>
                      {model.tags?.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className={cn(tag === 'tool-calling' && 'bg-blue-500/15 text-blue-600 border border-blue-500/20')}
                        >
                          {tag}
                        </Badge>
                      ))}
                      {isInstalled && <Badge variant="outline">installed</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {model.description} · {model.size}
                    </p>
                    <p className="text-xs text-muted-foreground/60 font-mono mt-0.5">{model.name}</p>
                  </div>
                  <Button
                    variant={isInstalled ? 'ghost' : 'outline'}
                    size="sm"
                    onClick={() => handlePull(model.name)}
                    disabled={!!pulling || isInstalled}
                    className="shrink-0"
                  >
                    {isPulling ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        {isInstalled ? 'Installed' : 'Download'}
                      </>
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
