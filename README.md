# 🔮 Solana Narrative Detector

> Detect emerging narratives and opportunities in the Solana ecosystem through multi-source signal analysis

**Live Demo:** [Deployed on Vercel](#deployment)
**Repository:** [GitHub](https://github.com/abhineetbiju-hackathon-bounties/solana-narrative-detector)

## 🎯 Overview

This tool automatically detects emerging narratives in the Solana ecosystem by collecting and analyzing signals from multiple sources:

- **Onchain activity**: Program deployments, transaction spikes, token launches
- **GitHub**: New repos, trending projects, commit activity
- **Twitter/X**: Key voice commentary (Mert, Toly, Raj, etc.)
- **Market reports**: Helius, Messari, Electric Capital, Solana Foundation blogs
- **Discord/Forums**: Solana StackExchange, Solana Forum, Reddit r/solana & r/solanadev

The tool refreshes fortnightly and generates 3-5 actionable product ideas for each detected narrative.

## 🧠 Methodology

### 1. Signal Collection

**Data Sources:**

| Source | Method | Refresh Rate |
|--------|--------|--------------|
| GitHub | GitHub REST API | 6 hours |
| Solana Onchain | DeFiLlama API + Public RPC + Jupiter API | 6 hours |
| Twitter/X | Twitter API v2, Nitter RSS, RSSHub, Syndication, Ecosystem blogs/newsletters | 12 hours |
| Market Reports | RSS feeds + Web scraping (Helius, Messari, Electric Capital, Phantom, Jito, CoinDesk, The Block, DeFiLlama) | Daily |
| Discord/Forums | StackExchange API, Solana Forum (Discourse API), Reddit RSS + JSON API | 12 hours |

**Key Voices Tracked:**
- Mert / Helius (@maboroshi0001) - 3.0x weight
- Anatoly Yakovenko (@aeyakovenko) - 3.0x weight
- Akshay (@akshaybd) - 3.0x weight
- Raj Gokal (@rajgokal) - 2.5x weight
- Armani Ferrante (@armaniferrante) - 2.5x weight
- Helius (@heaboroshi) - 2.5x weight
- Solana Foundation, Jupiter, other protocols - 2.0x weight

### 2. Signal Detection & Ranking

Each signal is scored based on:

```
Total Score = (0.3 × Normalized Weight) + (0.4 × Recency Score) + (0.3 × Cross-Source Score)
```

**Components:**
- **Recency**: Exponential decay with 7-day half-life
- **Cross-Source Validation**: Signals appearing in 3+ sources score higher
- **Weight**: Source authority + engagement metrics
- **Anomaly Detection**: Statistical outliers (>2σ from mean frequency)

### 3. Narrative Clustering

Signals are clustered into narratives using:

1. **Keyword Similarity**: Jaccard similarity with 0.25 threshold
2. **Semantic Grouping**: Co-occurrence analysis
3. **Theme Identification**: Pattern matching against known Solana verticals:
   - DeFi, NFTs, Gaming, Infrastructure, Payments, Mobile, DePIN, AI, Developer Tools, Token Extensions

**Narrative Scoring:**
```
Narrative Score = (10 × Sources) + (15 × Velocity) + (20 × Recency) + (5 × Key Voice Mentions) + min(Signals/2, 10)
```

### 4. Product Idea Generation

For each narrative, 3-5 product ideas are generated using template matching:

**Idea Categories:**
- Developer Tools (SDKs, frameworks, CLIs)
- Analytics & Monitoring (dashboards, alerts)
- User Applications (mobile apps, aggregators)
- Infrastructure (RPC services, indexers)
- Education (courses, documentation)
- Automation (bots, trading tools)
- Integration Layers (bridges, middleware)

Each idea includes:
- **Title**: Descriptive name
- **Description**: What to build
- **Reasoning**: Why this idea fits the narrative
- **Target Audience**: Who will use it
- **Difficulty**: Easy/Medium/Hard
- **Impact**: Low/Medium/High

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- (Optional) GitHub Personal Access Token for higher API limits
- (Optional) Helius API key for richer onchain data

### Installation

```bash
# Clone the repository
git clone https://github.com/abhineetbiju-hackathon-bounties/solana-narrative-detector.git
cd solana-narrative-detector

# Install dependencies
npm install
# or
yarn install
```

### Configuration

Create a `.env.local` file in the root directory:

```bash
# Optional: GitHub token for higher API limits (5000 req/hour vs 60)
GITHUB_TOKEN=your_github_token_here

# Optional: Helius API key for enhanced onchain data
HELIUS_API_KEY=your_helius_key_here

# Optional: Twitter API v2 bearer token for real-time social signals
TWITTER_BEARER_TOKEN=your_twitter_bearer_token_here

# Optional: Custom Solana RPC (defaults to public RPC)
SOLANA_RPC=https://your-rpc-endpoint.com
```

### Running Data Collection

```bash
# Collect fresh data from all sources
npm run collect

# This will:
# - Query GitHub for new Solana repos
# - Check onchain activity via DeFiLlama + RPC + Jupiter
# - Collect Twitter/X signals via API, RSS, newsletters
# - Fetch latest market reports from 9 sources
# - Scrape Discord/forums (StackExchange, Reddit, Solana Forum)
# - Save raw data to data/raw/
```

### Running Analysis

```bash
# Analyze collected data and generate narratives
npm run analyze

# This will:
# - Process and score all signals
# - Cluster signals into narratives
# - Generate product ideas
# - Save results to data/processed/narratives.json
```

### Running the Web Dashboard

```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard.

## 📊 Current Detected Narratives

Based on the latest analysis run (148 signals, 5 sources):

1. **DePIN: Physical Infrastructure Surge**
   - Score: 131.2 | 5 signals | 5 sources (onchain, twitter, github, discord, report)
   - Render Network GPU compute up 280%, Helium IoT expansion, real hardware revenue
   - **Top Idea**: Developer SDK for DePIN protocol integration

2. **NFTs: State Compression Rise**
   - Score: 102.4 | 5 signals | 5 sources (github, twitter, onchain, discord, report)
   - 50M+ compressed NFTs minted, 1000x cost reduction, Merkle tree scaling
   - **Top Idea**: Developer SDK for compressed NFTs with minting and management tools

3. **Token Extensions: Transfer Hooks Growth**
   - Score: 102.4 | 5 signals | 5 sources (onchain, discord, github, twitter, report)
   - Token-2022 mints up 340%, transfer hooks for RWA compliance, confidential transfers
   - **Top Idea**: Developer SDK for Token-2022 with transfer hooks and compliance tooling

4. **AI: Agents Rise**
   - Score: 92.9 | 4 signals | 4 sources (discord, twitter, github, report)
   - AI agent frameworks with Solana wallet integration, autonomous trading
   - **Top Idea**: Developer SDK for AI agent-to-Solana integration

5. **DeFi: TVL Growth**
   - Score: 80.3 | 3 signals | 3 sources (twitter, report, onchain)
   - Solana DeFi TVL hit $12B (5x YoY), Kamino lending crossed $2B
   - **Top Idea**: Simplified DeFi aggregator with one-tap optimal routing

6. **DeFi: Jupiter Surge**
   - Score: 78.2 | 3 signals | 3 sources (onchain, discord, github)
   - Jupiter $4.2B 7-day volume (+67% WoW), perps v2, limit orders + DCA at $500M/week
   - **Top Idea**: Developer SDK for DeFi protocol integration

7. **DeFi: Bitcoin Growth**
   - Score: 42.0 | 4 signals | 1 source (github)
   - Multi-chain wallet development, cross-chain DeFi infrastructure
   - **Top Idea**: Developer SDK for cross-chain Bitcoin-Solana integration

8. **Developer Tools: Anchor Rise**
   - Score: 26.5 | 3 signals | 1 source (github)
   - Anchor framework adoption, escrow program patterns
   - **Top Idea**: Developer SDK for Anchor escrow and program patterns

9. **DePIN: Sol Rise**
   - Score: 15.6 | 3 signals | 1 source (report)
   - Solana network upgrades, WisdomTree tokenization expansion, delegation program
   - **Top Idea**: DePIN Analytics Dashboard for Solana Foundation ecosystem

*Narratives refreshed: February 14, 2026*

## 🏗️ Architecture

```
solana-narrative-detector/
├── src/
│   ├── collectors/          # Data collection modules
│   │   ├── github.ts        # GitHub API collector
│   │   ├── solana-onchain.ts # Onchain data collector
│   │   ├── twitter.ts       # Twitter/X collector
│   │   ├── reports.ts       # Market reports collector (Helius, Messari, Electric Capital)
│   │   └── discord.ts       # Discord/forums collector (StackExchange, Reddit, Forum)
│   ├── analysis/            # Analysis logic
│   │   ├── signal-detector.ts    # Signal processing & ranking
│   │   ├── narrative-clusterer.ts # Clustering algorithm
│   │   └── idea-generator.ts     # Product idea generation
│   └── types/               # TypeScript type definitions
│       └── index.ts
├── pages/                   # Next.js pages
│   ├── index.tsx           # Main dashboard
│   ├── _app.tsx            # App wrapper
│   └── api/                # API routes
│       └── narratives.ts   # Narratives API endpoint
├── scripts/                # Utility scripts
│   ├── collect-data.ts    # Data collection script
│   └── analyze.ts         # Analysis script
├── data/                   # Data storage
│   ├── raw/               # Raw collected signals
│   └── processed/         # Processed narratives
├── styles/                # CSS styles
│   └── globals.css
└── public/                # Static assets
```

## 🔄 Automated Refresh

To set up fortnightly automatic refreshes:

### Option 1: GitHub Actions (Recommended)

Create `.github/workflows/refresh.yml`:

```yaml
name: Refresh Narratives

on:
  schedule:
    - cron: '0 0 1,15 * *'  # 1st and 15th of each month
  workflow_dispatch:  # Manual trigger

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run collect
        env:
          GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
          HELIUS_API_KEY: ${{ secrets.HELIUS_KEY }}
      - run: npm run analyze
      - uses: stefanzweifel/git-auto-commit-action@v4
        with:
          commit_message: 'chore: update narratives'
```

### Option 2: Vercel Cron Jobs

Add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/refresh",
    "schedule": "0 0 1,15 * *"
  }]
}
```

Create `pages/api/refresh.ts` to run collection + analysis on schedule.

## 📈 Sample Output

### Narrative Example

```json
{
  "id": "narrative_1707715200_abc123",
  "title": "DeFi: Jupiter Aggregator Innovation",
  "description": "Detected 23 signals across 4 sources...",
  "score": 87.3,
  "keywords": ["dex", "amm", "swap", "jupiter", "aggregator"],
  "metrics": {
    "crossSourceCount": 4,
    "velocity": 2.3,
    "recency": 0.95,
    "keyVoiceMentions": 3
  },
  "ideas": [
    {
      "title": "Multi-DEX Aggregation SDK",
      "description": "TypeScript SDK for optimal routing across Jupiter...",
      "reasoning": "23 signals show fragmented DEX landscape...",
      "targetAudience": "DeFi protocol developers",
      "difficulty": "Medium",
      "impact": "High"
    }
  ]
}
```

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. Push code to GitHub
2. Import repository in Vercel dashboard
3. Add environment variables (GITHUB_TOKEN, etc.)
4. Deploy!

```bash
# Or use Vercel CLI
npm install -g vercel
vercel --prod
```

### Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Deploy to Render

1. Create new Web Service
2. Connect GitHub repository
3. Build command: `npm install && npm run build`
4. Start command: `npm start`

## 🧪 Testing

```bash
# Run collection (dry-run mode)
npm run collect

# Run analysis on sample data
npm run analyze

# Check output
cat data/processed/narratives.json
```

## 📝 API Documentation

### GET `/api/narratives`

Returns the latest detected narratives.

**Response:**
```json
{
  "narratives": [...],
  "analyzedAt": 1707715200000,
  "dataWindow": {
    "start": 1706505600000,
    "end": 1707715200000
  },
  "stats": {
    "totalSignals": 127,
    "sourcesUsed": ["github", "onchain", "twitter", "report", "discord"],
    "narrativesDetected": 9
  }
}
```

## 🎯 What Makes This Tool Unique

1. **Multi-Source Validation**: Requires signals from 3+ sources for strong narratives
2. **Key Voice Weighting**: Tracks and prioritizes commentary from ecosystem leaders
3. **Velocity Tracking**: Identifies accelerating trends, not just current popularity
4. **Actionable Ideas**: Each narrative includes specific, buildable product concepts
5. **Statistical Rigor**: Uses anomaly detection and clustering algorithms, not just keyword matching

## 🛠️ Future Improvements

- [ ] Implement LLM-powered narrative summarization
- [ ] Add email/Telegram notifications for new narratives
- [ ] Track narrative evolution over time
- [ ] Add social sentiment analysis
- [ ] Create narrative "confidence scores"
- [ ] Build public API for community access

## 📄 License

MIT License - feel free to use, modify, and distribute this tool.

## 🙏 Acknowledgments

- Solana Foundation for ecosystem data
- GitHub, Helius, Jupiter for APIs
- Messari and Electric Capital for research reports
- Solana community for feedback and ideas

## 📧 Contact

Built for Solana Bounty #2 - Narrative Detection Tool

Questions? Open an issue or submit a PR!

---

**Last Updated:** February 14, 2026
**Next Refresh:** March 1, 2026
