import { Label } from '@renderer/components/ui/label'
import { Textarea } from '@renderer/components/ui/textarea'
import { Slider } from '@renderer/components/ui/slider'
import { Input } from '@renderer/components/ui/input'
import { Separator } from '@renderer/components/ui/separator'
import { Button } from '@renderer/components/ui/button'
import type { Settings } from '@renderer/hooks/useSettings'

const CTX_PRESETS = [512, 1024, 2048, 4096, 8192, 16384, 32768]

interface SettingsProps {
  settings: Settings
  updateSettings: (updates: Partial<Settings>) => void
}

export function SettingsScreen({ settings, updateSettings }: SettingsProps): JSX.Element {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="p-6 max-w-2xl space-y-8">
        <div>
          <h1 className="text-base font-semibold text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            These settings apply to all chat conversations.
          </p>
        </div>

        <Separator />

        {/* System Prompt */}
        <section className="space-y-3">
          <div>
            <Label htmlFor="system-prompt">System Prompt</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Instructions given to the model before every conversation.
            </p>
          </div>
          <Textarea
            id="system-prompt"
            value={settings.systemPrompt}
            onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
            rows={4}
            placeholder="You are a helpful assistant."
          />
        </section>

        <Separator />

        {/* Temperature */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>Temperature</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Controls randomness. Lower = more focused, higher = more creative.
              </p>
            </div>
            <span className="text-sm font-mono text-foreground tabular-nums w-10 text-right">
              {settings.temperature.toFixed(1)}
            </span>
          </div>
          <Slider
            min={0}
            max={2}
            step={0.1}
            value={settings.temperature}
            onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 — Deterministic</span>
            <span>2 — Creative</span>
          </div>
        </section>

        <Separator />

        {/* Context Window */}
        <section className="space-y-3">
          <div>
            <Label>Context Window</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Number of tokens the model can "see" at once. Larger = more memory but slower.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {CTX_PRESETS.map((n) => (
              <Button
                key={n}
                variant={settings.numCtx === n ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSettings({ numCtx: n })}
              >
                {n >= 1024 ? `${n / 1024}k` : n}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="ctx-custom" className="shrink-0 text-muted-foreground">
              Custom:
            </Label>
            <Input
              id="ctx-custom"
              type="number"
              min={128}
              max={131072}
              step={128}
              value={settings.numCtx}
              onChange={(e) => {
                const v = parseInt(e.target.value)
                if (!isNaN(v) && v > 0) updateSettings({ numCtx: v })
              }}
              className="w-32"
            />
          </div>
        </section>

        <Separator />

        {/* GPU Layers */}
        <section className="space-y-3">
          <div>
            <Label>GPU Layers</Label>
            <p className="text-xs text-muted-foreground mt-1">
              How many model layers to offload to GPU. <code className="font-mono text-foreground">0</code> = CPU only,{' '}
              <code className="font-mono text-foreground">-1</code> = all layers on GPU (auto-detect).
              Has no effect if you don't have a compatible GPU.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={-1}
              max={200}
              value={settings.numGpu}
              onChange={(e) => {
                const v = parseInt(e.target.value)
                if (!isNaN(v)) updateSettings({ numGpu: v })
              }}
              className="w-24"
            />
            <div className="flex gap-2">
              <Button
                variant={settings.numGpu === 0 ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSettings({ numGpu: 0 })}
              >
                CPU only
              </Button>
              <Button
                variant={settings.numGpu === -1 ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateSettings({ numGpu: -1 })}
              >
                Auto GPU
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
