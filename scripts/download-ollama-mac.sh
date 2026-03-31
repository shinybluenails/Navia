#!/usr/bin/env bash
set -e
DEST="$(dirname "$0")/../resources/darwin"
mkdir -p "$DEST"

echo "Downloading Ollama for macOS..."
curl -L "https://github.com/ollama/ollama/releases/latest/download/ollama-darwin" -o "$DEST/ollama"
chmod +x "$DEST/ollama"
echo "Done. Ollama placed at resources/darwin/ollama"
