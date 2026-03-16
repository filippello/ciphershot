# CipherShot

A two-player turn-based duel of bluffs and bullets. Players take turns shooting each other through a randomized shotgun chamber while playing cards to bluff or redirect shots.

**[Play Live](https://ciphershot.vercel.app)**

---

## How It Works

A shotgun is loaded with **7 rounds** in random order: 3 live, 4 blank. Players alternate turns choosing to shoot themselves or their opponent. The defender responds with a card:

| Card | Count | Effect |
|------|-------|--------|
| **Bluff** | x3 | Does nothing — a decoy to confuse your opponent |
| **Redirect** | x2 | Reverses the shot back at the shooter |

Cards are revealed after a 3...2...1 countdown. Your opponent won't know what you played until then. The game ends when someone gets hit by a live round.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Client | Vite + React + TypeScript |
| Game Rendering | Phaser 3 (960x540 canvas) |
| State Management | Zustand |
| Server | Node.js WebSocket (real-time sync) |
| Wallet | viem (Ethereum wallet connect) |
| Styling | CRT/arcade aesthetic with Press Start 2P font |

---

## Architecture

```
src/
├── game/
│   ├── core/           # Pure game logic (no rendering)
│   │   ├── engine.ts   # State machine & transitions
│   │   ├── types.ts    # GameState, Card, ShotResult
│   │   ├── chamber.ts  # Shuffle 7 rounds (3 live, 4 blank)
│   │   ├── cards.ts    # Generate 5 cards per player
│   │   └── resolver.ts # Shot resolution logic
│   ├── phaser/         # Phaser scenes & rendering
│   │   ├── GameScene.ts
│   │   └── config.ts
│   ├── adapters/       # Game engine adapters
│   └── store.ts        # Zustand store with animation buffering
├── components/         # React UI overlays
│   ├── GameScreen.tsx          # Main game view + Phaser integration
│   ├── TargetingOverlay.tsx    # Crosshair target selection
│   ├── CardSelectOverlay.tsx   # Card hand fan selection
│   ├── SuspenseOverlay.tsx     # 3-2-1 countdown reveal
│   ├── MatchmakingLobby.tsx    # Queue + Tutorial
│   ├── WalletConnect.tsx       # Wallet connection screen
│   ├── ResultBanner.tsx        # Victory/Defeat screen
│   └── ...
├── lib/                # Wallet, matchmaking, audio utilities
└── styles/             # CRT effects, arcade button styles

server/
├── index.ts            # WebSocket server (port 3001)
├── matchmaking.ts      # Queue pairing logic
└── matchStore.ts       # Match state + broadcast
```

**Key design decisions:**
- `game/core/` is pure logic with zero rendering dependencies — fully testable
- Phaser handles sprites and animations; React handles UI overlays on top
- Animation buffering in the Zustand store keeps old state on screen while animations play, then flushes the real state when done

---

## Game Flow

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Connect    │────>│  Matchmaking     │────>│  Game        │
│  Wallet     │     │  Queue + Tutorial│     │  Screen      │
└─────────────┘     └──────────────────┘     └──────┬───────┘
                                                     │
                                    ┌────────────────┼────────────────┐
                                    v                v                v
                              Choose Target    Respond Card     Shot Resolves
                              (click player)   (pick from hand) (3-2-1 reveal)
                                    │                │                │
                                    └────────────────┴────────────────┘
                                                     │
                                              ┌──────v───────┐
                                              │  Game Over   │
                                              │  Victory or  │
                                              │  Defeat      │
                                              └──────────────┘
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Install & Run

```bash
npm install
npm run dev
```

This starts both:
- **Client** on `http://localhost:3000` (Vite)
- **Server** on `ws://localhost:3001` (WebSocket)

### Build

```bash
npm run build
```

### Individual Commands

```bash
npm run dev:client   # Vite dev server only
npm run dev:server   # WebSocket server only
```

---

## Visual Style

The UI uses a **Balatro-inspired CRT/arcade aesthetic**:

- **Press Start 2P** pixel font throughout
- CRT scanline overlay + vignette + subtle flicker
- Chromatic aberration on titles
- Arcade-style buttons with 3D press effect
- Red crosshair cursor during target selection
- Neon glow effects on text and card hover
- Card fan layout for hand selection

---

## Game Mechanics Detail

### Chamber
7 rounds shuffled randomly each game. Neither player knows the order.

### Turn Structure
1. **Shooter picks target** — Click on yourself or your opponent in the game scene
2. **Defender plays a card** — Select from your hand (fan layout)
3. **Reveal** — 3...2...1 countdown, card is shown
4. **Resolution** — Shot fires. Live round + final target = kill

### Cards
Each player starts with 5 cards (3 Bluff, 2 Redirect). Once used, they're gone. The psychological game: your opponent can't tell if you played a Bluff or a Redirect until the reveal.

### Win Condition
Survive while your opponent doesn't. That's all.

---

## Roadmap

- [ ] Zama FHE integration for encrypted chamber/resolver logic
- [ ] On-chain game verification
- [ ] Ranked matchmaking
- [ ] Additional card types

---

## License

MIT
