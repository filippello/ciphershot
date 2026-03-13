---
name: CipherShot project status
description: Current state of the CipherShot game — what's done, what's pending, architecture decisions
type: project
---

CipherShot is a turn-based card/gun game built with Vite + React + Phaser 3 + Zustand + TypeScript.

## What's done (as of 2026-03-13)

### Core game loop — WORKING
- Chamber: 7 rounds (3 live, 4 blank), shuffled
- Players alternate as shooter/responder
- Shooter picks target: self or opponent
- Responder plays a card: **bluff** (no effect) or **redirect** (flips target)
- No PASS option — responder must play a card
- If responder has no cards left, shot auto-resolves
- Live round kills → game over. Blank → next turn.
- 5 cards per player (3 bluff, 2 redirect)

### Bugs fixed
1. **"Resolving shot..." stuck** — App.tsx checked `phase === 'resolving'` but engine never set that phase. Fixed: animation triggers on `animating` flag rising edge instead.
2. **Dead player not resetting on NEW GAME** — Added `resetVisuals()` to GameScene, called when `currentShotIndex` resets to 0.
3. **PASS button removed** — Game requires bluff or redirect, no pass.
4. **Aim direction inverted** — Gun was moving to target instead of shooter. Fixed: gun moves to shooter side, flips based on target direction.
5. **Phaser image load failure** — Original assets were 1024-1536px, too large for WebGL. Resized with ImageMagick.

### Visual assets integrated
- `bg_room.png` (810x540) — dark bar/cantina background
- `table.png` (512x512) — poker table with chips
- `gun.png` (256x256) — shotgun
- `player_left_idle.png` (256x384) — crypto guy (P1, flipped to face right)
- `player_right_idle.png` (256x384) — fedora guy (P2)
- `card_bluff.png`, `card_redirect.png`, `card_back.png` — card art used in CardDisplay

### Architecture
- `src/game/core/` — pure logic (no rendering): types, engine, resolver, chamber, cards
- `src/game/phaser/` — GameScene (Phaser rendering + animations), config
- `src/game/store.ts` — Zustand store bridging core logic ↔ React/Phaser
- `src/components/` — React UI: HUD, ActionPanel, CardDisplay, ShotHistory
- `src/App.tsx` — mounts Phaser + React, wires store state → scene methods

**Why:** Migrated from Next.js to Vite because Next.js 16+Turbopack consumes ~2GB RAM, exceeding devcontainer limit. Vite uses ~100MB.

**How to apply:** All new features should follow this split. Game logic in core/, rendering in phaser/, UI in components/.

## What's pending / next steps

1. **Zama FHE integration** — encrypt chamber and resolver logic so neither player knows the chamber order (future milestone)
2. **Sound effects** — `public/assets/fx/` directory exists but is empty
3. **UI polish** — `public/assets/ui/` directory exists but is empty
4. **Better animations** — gun aim could show rotation, muzzle flash positioned at barrel tip
5. **Player death animation** — currently just fades + drops; could be more dramatic
6. **Mobile responsive** — canvas scales with FIT mode but React UI doesn't adapt
7. **Multiplayer** — currently local hot-seat (both players on same screen)
