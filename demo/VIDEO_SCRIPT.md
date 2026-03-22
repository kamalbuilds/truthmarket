# TruthMarket Demo Video Script

**Target length:** 3-4 minutes
**Tone:** Confident, clear, technically impressive but accessible

---

## INTRO (0:00 - 0:30)

**[Screen: Polymarket controversy headline / UMA whale vote screenshot]**

"Prediction markets are one of the most powerful tools for forecasting the future. Polymarket alone did over 9 billion dollars in volume in 2024."

"But they have a fundamental flaw: resolution."

"When a market needs to resolve, Polymarket uses UMA's optimistic oracle, where token-weighted human voters decide the outcome. The problem? Whales with large UMA stakes can manipulate the result. We saw this play out during the 2024 US election resolution controversy."

"What if we could replace human voters with AI?"

---

## THE SOLUTION (0:30 - 1:15)

**[Screen: TruthMarket landing page, scroll through the comparison section]**

"This is TruthMarket: prediction markets where resolutions cannot be manipulated."

"Instead of token-weighted human voters, TruthMarket uses GenLayer's AI validators. Multiple validators, each running a different large language model, GPT, Claude, Llama, independently fetch real-world data from trusted sources and evaluate the outcome."

**[Screen: Show the side-by-side flow comparison on the landing page]**

"Here's the key difference:"
"Polymarket: Market expires, anyone disputes, token-weighted vote, whales dominate."
"TruthMarket: Market expires, AI validators triggered automatically, each fetches real data, Equivalence Principle consensus, funds auto-distributed. No tokens to accumulate. No votes to buy."

"The resolution reasoning is stored on-chain. Full transparency. Full auditability."

---

## LIVE DEMO (1:15 - 3:00)

**[Screen: Terminal running the demo script]**

"Let me show you this working end-to-end."

### Step 1: Deploy
"First, I deploy a TruthMarket contract to GenLayer. This market asks: Will Bitcoin exceed 100K by March 31, 2026?"

**[Run demo script, show deploy output]**

"The contract is live. It stores the market title, resolution criteria, and the source URLs that validators will check."

### Step 2: Read Market
"Let's read the market state. 50/50 odds, zero pool, no bets yet."

### Step 3: Place Bets
"Now I place three bets: 100 on Yes, 50 on No, and another 50 on Yes."

**[Show each bet confirmation and the odds updating in real-time]**

"Watch the odds shift: 75% Yes, 25% No. The pool is 200 GEN. Payout ratio for Yes is 1.33x, for No it's 4x."

### Step 4: AI Resolution (The Magic)
"Now the moment of truth. I trigger AI resolution."

"What happens next is what makes TruthMarket different from everything else:"
"Multiple GenLayer validators, each running a different LLM, independently visit CoinMarketCap, fetch the current Bitcoin price, evaluate it against our resolution criteria, and reach consensus through the Equivalence Principle."

**[Show resolution in progress, then result]**

"The market resolved! The AI validators determined the winner based on actual data. The reasoning is right here, on-chain, fully auditable."

"No whale could have manipulated this. No token accumulation could have changed the outcome. The truth was determined by data, not by wealth."

### Step 5: Frontend
**[Switch to browser showing TruthMarket UI]**

"And here's the frontend. Connect your wallet, see the market with the probability gauge, place bets with quick-amount buttons, see your potential payout before betting, and trigger resolution, all from the UI."

---

## CLOSING (3:00 - 3:30)

**[Screen: Architecture diagram or GitHub repo]**

"TruthMarket is built entirely on GenLayer's Intelligent Contracts using Optimistic Democracy consensus and the Equivalence Principle. The contract is Python, the frontend is Next.js 16 with shadcn, and we have 40 passing end-to-end tests."

"We're not just building another prediction market. We're fixing the fundamental trust problem that every prediction market has. Because truth should be determined by data, not by the size of your wallet."

"TruthMarket. No whales. No bribes. Just truth."

---

## KEY TALKING POINTS FOR Q&A

- **Why not just use Chainlink/oracles?** Chainlink provides data feeds but can't handle subjective markets. TruthMarket's AI validators can evaluate qualitative outcomes like "Did the team deliver on their roadmap?"
- **What about AI hallucinations?** Multiple validators running DIFFERENT LLMs must agree. One hallucinating model gets outvoted by the others checking real data.
- **Why GenLayer over other AI chains?** GenLayer's Equivalence Principle is purpose-built for non-deterministic consensus. Other chains bolt AI on top; GenLayer built it in.
- **Revenue model?** Protocol fee on each market (configurable by creator). Scales with volume.
- **What markets can this resolve?** Any market with verifiable data sources: crypto prices, election results, sports scores, product launches, regulatory decisions.
