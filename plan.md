
The React UI talks to Ollama's local REST API. Ollama handles everything else.

---

## Implementation Phases

### Phase 1 — Scaffold
1. Initialize project with `electron-vite` (modern Electron + React + TypeScript boilerplate)
2. Add Tailwind CSS
3. Add shadcn/ui component library
4. Confirm blank window launches with hot-reload in dev mode

### Phase 2 — Ollama Integration
5. Download Ollama binaries for Windows and macOS; place in `resources/`
6. In `electron/main.ts`: on app start, check if Ollama is running; if not, spawn the bundled binary
7. Manage Ollama subprocess lifecycle — start with app, kill on app quit, handle crashes
8. Write `electron/ollama.ts` — typed REST client wrapping key Ollama endpoints:
   - `GET /api/tags` — list installed models
   - `POST /api/pull` — download a model (streaming progress)
   - `POST /api/chat` — send a message (streaming response)
   - `DELETE /api/delete` — remove a model

### Phase 3 — UI Screens *(can be built in parallel after Phase 2)*
9. **Chat screen** (`src/screens/Chat.tsx`)
   - Model selector dropdown
   - Message thread with user/assistant bubbles
   - Streaming token display
   - Clear conversation button
10. **Models screen** (`src/screens/Models.tsx`)
    - List of installed models (name, size, parameter count)
    - Delete model button
    - Search field for Ollama's public model registry
    - Pull/download with real-time progress bar
11. **Settings screen** (`src/screens/Settings.tsx`)
    - System prompt editor
    - Temperature slider
    - Context window size
    - GPU layer offloading toggle (for power users)

### Phase 4 — Packaging & Distribution
12. Configure `electron-builder.config.js`:
    - Windows: NSIS installer (`.exe`)
    - macOS: DMG (`.dmg`) — note: code signing requires Apple Developer account
    - Include Ollama binary as an `extraResource` per platform
13. Set up GitHub Actions CI to build installers on push to `main`
14. *(Optional)* Add `electron-updater` for in-app auto-update

---

## Key Files

| File | Purpose |
|---|---|
| `electron/main.ts` | App entry point, spawns Ollama, manages IPC between main and renderer |
| `electron/ollama.ts` | Typed wrapper around Ollama REST API |
| `src/screens/Chat.tsx` | Chat UI with streaming |
| `src/screens/Models.tsx` | Model manager (download, delete, browse) |
| `src/screens/Settings.tsx` | User-configurable settings |
| `src/components/` | Shared shadcn/ui components |
| `electron-builder.config.js` | Installer config, platform targets, extra resources |
| `.github/workflows/build.yml` | CI pipeline for building installers |

---

## Verification Checklist

- [ ] App launches on Windows; Ollama process appears in Task Manager
- [ ] App launches on macOS; Ollama process appears in Activity Monitor
- [ ] Pull `llama3.2:1b` (~1.3 GB, smallest model) through the Models screen — progress bar shows, model appears in installed list
- [ ] Send a chat message; streamed response appears token-by-token
- [ ] Close app; confirm Ollama subprocess is also killed (no orphan process)
- [ ] Run `electron-builder`; produces a working `.exe` installer on Windows

---

## Decisions & Scope

- **Ollama is bundled** inside the installer — ~150–200 MB total, but fully offline-capable after install. The bundled binary will need periodic updates as Ollama releases new versions.
- **Model source**: Ollama's curated registry only (Phase 1–3). Hugging Face GGUF direct download is a future enhancement.
- **Linux**: Not in scope for Phase 1–4. Adding an AppImage target in electron-builder later is straightforward.
- **No model training**: Download and run pre-trained models only.
- **GPU**: Ollama auto-detects and uses GPU if available. No user configuration needed for basic use.

---

## Open Questions

1. **App name / branding** — affects installer name, macOS bundle ID, and folder paths. Needs to be decided before Phase 4.
2. **Auto-update** — include `electron-updater` in Phase 4, or defer to a later release?