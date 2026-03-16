# CipherShot

## Stack
Vite + React + Phaser 3 + Zustand + TypeScript + Zama fhEVM

## Dev server
```bash
npm run dev
```
Listens on `0.0.0.0:3000`. External port: 9000 (devcontainer Docker mapping).

## Architecture
- `game/core/` — pure game logic (no rendering)
- `game/phaser/` — Phaser scenes and rendering
- `components/` — React UI overlays
- `chain/` — Hardhat project for CipherShotGame.sol (Zama fhEVM)

## FHE Integration
- **Contract**: `chain/contracts/CipherShotGame.sol` — encrypted chamber, cards, resolution
- **Client FHE**: `src/lib/fhe.ts` — Relayer SDK wrapper (encrypt inputs, decrypt own data)
- **Contract Client**: `src/lib/contract.ts` — typed helpers for on-chain actions
- **Server**: Dual-mode — legacy (in-memory engine) or FHE (contract event relay)
- **Config**: Set `CIPHERSHOT_CONTRACT`, `RPC_URL`, `SERVER_PRIVATE_KEY` env vars for FHE mode

## FHE Mode
When `CIPHERSHOT_CONTRACT` env var is set on the server, it runs in FHE mode:
- Matchmaking creates on-chain matches (encrypted chamber + card inventories)
- `chooseTarget()` → plaintext tx to contract
- `playCard()` → encrypted card via fhevmjs → contract resolves in FHE domain
- Results are `makePubliclyDecryptable` → server decrypts + calls `finalizeRound`
- Without the env var, the game runs in legacy mode (in-memory, no blockchain)

## Constraints
- **Do NOT use Next.js** — consumes ~2GB RAM, exceeds this container's limit. Vite uses ~100MB.
- Keep dependencies minimal to stay within container memory.

## Chain project
```bash
cd chain
npm install
npm run compile
npm run test
npm run deploy:sepolia
```
