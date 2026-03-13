# CipherShot

## Stack
Vite + React + Phaser 3 + Zustand + TypeScript

## Dev server
```bash
npm run dev
```
Listens on `0.0.0.0:3000`. External port: 9000 (devcontainer Docker mapping).

## Architecture
- `game/core/` — pure game logic (no rendering)
- `game/phaser/` — Phaser scenes and rendering
- `components/` — React UI overlays

## Constraints
- **Do NOT use Next.js** — consumes ~2GB RAM, exceeds this container's limit. Vite uses ~100MB.
- Keep dependencies minimal to stay within container memory.

## Future
- Zama FHE integration for encrypted chamber/resolver logic
