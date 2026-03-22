# TruthMarket

**Manipulation-proof prediction markets using AI consensus.**

Polymarket uses UMA's optimistic oracle where token-weighted human voters resolve markets. Whales with large UMA stakes can manipulate outcomes. TruthMarket replaces human voters with GenLayer's AI validators: multiple validators running diverse LLMs that independently fetch real-world data and reach consensus. No whales. No bribes. Just truth.

## The Problem

Prediction markets like Polymarket rely on UMA's resolution mechanism where:
- Anyone can propose a resolution
- If disputed, UMA token holders vote on the outcome
- Token-weighted voting means whales control the outcome
- The 2024 US election resolution controversy proved this is exploitable

## The Solution

TruthMarket uses GenLayer's Intelligent Contracts with Optimistic Democracy consensus:

1. **Multiple AI validators** independently fetch data from trusted sources
2. **Each validator runs a different LLM** (GPT, Claude, Llama, etc.)
3. **Equivalence Principle** ensures consensus across diverse models
4. **On-chain reasoning** explains exactly why each outcome was determined
5. **No token accumulation** can influence the result

## Architecture

```
User creates market with:
  - Natural language resolution criteria
  - Trusted data source URLs
  - Two sides (YES/NO)

Users place bets on either side

When resolution triggers:
  GenLayer Validator 1 (GPT)     ──┐
  GenLayer Validator 2 (Claude)  ──┼── Fetch sources → Evaluate → Consensus
  GenLayer Validator 3 (Llama)   ──┘
                                     ↓
                              Winner determined
                              Reasoning stored on-chain
                              Funds auto-distributed
```

## Tech Stack

- **Intelligent Contract**: Python on GenLayer (Optimistic Democracy + Equivalence Principle)
- **Frontend**: Next.js 16, shadcn/ui, Tailwind CSS, dark mode
- **Blockchain SDK**: genlayer-js for wallet integration and contract interaction
- **Testnet**: GenLayer Bradbury (first testnet with real AI consensus)

## Project Structure

```
truthmarket/
├── contracts/
│   └── truth_market.py      # GenLayer Intelligent Contract
├── frontend/
│   ├── app/                  # Next.js App Router
│   ├── components/           # UI components (shadcn/ui)
│   └── lib/genlayer/         # GenLayer client, contract, wallet
├── deploy/
│   └── deploy.ts             # Deployment script
└── package.json
```

## Quick Start

### Prerequisites
- Node.js 20+
- MetaMask wallet
- GenLayer CLI (`npm install -g genlayer`)

### 1. Test in GenLayer Studio

Visit [studio.genlayer.com](https://studio.genlayer.com/contracts), paste `contracts/truth_market.py`, and test with the constructor args.

### 2. Deploy to Bradbury testnet

```bash
# Create account
genlayer account create --name myaccount

# Deploy
genlayer deploy --contract contracts/truth_market.py \
  --rpc https://studio.genlayer.com/api \
  --args "Will Bitcoin exceed 100K by March 31?" \
        "Resolves based on CoinMarketCap BTC price" \
        "Check BTC price on CoinMarketCap. If >= 100000, Yes wins." \
        "https://coinmarketcap.com/currencies/bitcoin/" \
        "Yes, above 100K" \
        "No, below 100K" \
        "2026-03-31"
```

### 3. Run the frontend

```bash
cd frontend
npm install
echo "NEXT_PUBLIC_CONTRACT_ADDRESS=<your_address>" > .env.local
npm run dev
```

## How AI Resolution Works

The `resolve()` method in the intelligent contract:

1. Captures resolution sources and criteria
2. Each GenLayer validator independently:
   - Fetches data from all source URLs via `gl.nondet.web.render()`
   - Evaluates the outcome using their LLM via `gl.nondet.exec_prompt()`
   - Returns a verdict with reasoning
3. `gl.eq_principle.prompt_non_comparative()` ensures validators reach consensus
4. The winning side and reasoning are stored on-chain
5. Winners can claim their proportional share of the pool

## Anti-Manipulation Features

- **Diverse LLMs**: Each validator runs a different model, preventing single-model bias
- **Prompt injection defense**: Resolution prompts instruct validators to ignore authority claims, emotional appeals, and embedded instructions
- **Source verification**: Validators fetch from pre-specified trusted sources only
- **On-chain transparency**: All reasoning is stored on-chain for public audit

## Hackathon Tracks

- **GenLayer AI Agentics Track** (primary): Intelligent Contracts with Optimistic Democracy consensus and Equivalence Principle on Bradbury testnet
- **PL_Genesis Best Projects**: Governance and "Future of Work" themes
- **Avalanche Track** (stretch): Cross-chain escrow bridging

## License

MIT
