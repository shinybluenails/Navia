// Types derived from window.ollama (declared in src/preload/index.d.ts)
export type OllamaModel = Awaited<ReturnType<typeof window.ollama.list>>[0]
export type PullProgress = Parameters<Parameters<typeof window.ollama.onPullProgress>[0]>[0]
