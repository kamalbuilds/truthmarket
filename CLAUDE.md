# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PM Kit is an experimental prediction market playground on Base Sepolia. Markets are resolved by GenLayer intelligent contracts (Python oracles) that fetch real-world data, reach validator consensus, and bridge results back via LayerZero.

## Commands

### Contracts (`contracts/`)
```bash
npm run compile          # Compile Solidity + sync ABIs to frontend
npm run test             # Run Hardhat tests
npm run deploy:factory:sepolia   # Deploy BetFactoryCOFI to Base Sepolia
npm run deploy:factory:base      # Deploy to Base mainnet
```

### Frontend (`frontend/`)
```bash
npm run dev              # Start dev server at localhost:3000
npm run build            # Production build
npm run lint             # ESLint
```

### Bridge Service (`bridge/service/`)
```bash
npm run dev              # Run relay service with ts-node
npm run build            # Compile TypeScript
npm run test:e2e         # Full end-to-end flow test
npm run test:oracle      # Deploy test oracle to GenLayer
```

## Architecture

```
Frontend (Next.js/Wagmi/Privy) → Base Sepolia
                                    ├── BetFactoryCOFI (factory, routes resolutions)
                                    ├── BetCOFI (individual markets)
                                    └── MockUSDL (betting token)

Bridge Service (TypeScript) ← → GenLayer (Python oracles)
                            ← → LayerZero (cross-chain messaging)
```

### Resolution Flow
1. User calls `bet.resolve()` after market end date
2. Bridge service catches `ResolutionRequested` event
3. Deploys Python intelligent contract to GenLayer
4. GenLayer validators fetch data (CoinMarketCap, Yahoo Finance)
5. Result bridges back via LayerZero → BridgeReceiver → BetFactoryCOFI → BetCOFI
6. Winners claim via `bet.claim()`

## Key Files

**Smart Contracts:**
- `contracts/contracts/BetCOFI.sol` - Market contract (betting, resolution, claims)
- `contracts/contracts/BetFactoryCOFI.sol` - Factory, deploys markets, processes oracle results
- `contracts/contracts/mocks/MockUSDL.sol` - Testnet ERC-20 with rate-limited faucet

**Frontend:**
- `frontend/src/lib/onchain/reads.ts` - Contract read helpers
- `frontend/src/lib/onchain/writes.ts` - Contract write helpers (bet, claim, approve)
- `frontend/src/lib/constants.ts` - Chain config, contract addresses
- `frontend/src/app/providers/WalletProvider.tsx` - Privy + Wagmi setup

**Bridge:**
- `bridge/service/src/relay/EvmToGenLayer.ts` - Listens for resolution requests, deploys oracles
- `bridge/service/src/relay/GenLayerToEvm.ts` - Polls GenLayer, relays results via LayerZero
- `bridge/intelligent-contracts/` - Python oracle contracts (crypto, stocks)

## Contract Patterns

- Solidity 0.8.22 with `viaIR: true` (avoids stack-too-deep errors)
- OpenZeppelin 5.x for ReentrancyGuard, Ownable, ERC20
- BetCOFI states: ACTIVE → RESOLVING → RESOLVED/UNDETERMINED
- Resolution types: CRYPTO (0), STOCKS (1), NEWS (2)
- 7-day timeout allows bet cancellation if oracle fails

## Environment Variables

**Frontend** (`.env.local`):
- `NEXT_PUBLIC_PRIVY_APP_ID` - From dashboard.privy.io
- `NEXT_PUBLIC_BET_FACTORY_ADDRESS` - Deployed factory
- `NEXT_PUBLIC_MOCK_USDL_ADDRESS` - Token address

**Contracts** (`.env`):
- `PRIVATE_KEY` - Deployer wallet
- `BASESCAN_API_KEY` - For contract verification

**Bridge Service** (`.env`):
- `PRIVATE_KEY` - Relayer wallet
- `GENLAYER_RPC_URL` - GenLayer endpoint
- `BASE_SEPOLIA_RPC_URL` - Base RPC
- `BET_FACTORY_ADDRESS` - Factory to monitor
