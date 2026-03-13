---
name: DevContainer and port setup
description: How to access the game — ports, Docker mapping, and memory constraints
type: reference
---

- DevContainer: `mcr.microsoft.com/devcontainers/typescript-node:20`
- Memory limit: ~2GB (reason Next.js was replaced with Vite)
- `npm run dev` → Vite on `0.0.0.0:3000`
- Docker `appPort: ["9000:3000"]` → host access via `localhost:9000`
- Codespaces `forwardPorts: [3000]` → direct port 3000
- Git identity set locally: `CipherShot Dev <ciphershot@dev.local>`
- Assets must be resized before use — WebGL has texture size limits, images >1024px fail with `pixelArt: true` (now disabled)
