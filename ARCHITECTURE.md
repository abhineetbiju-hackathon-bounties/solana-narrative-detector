# Solana Narrative Detector - Architecture

## System Overview
Multi-source data aggregation → Signal detection → Narrative clustering → Idea generation → Web dashboard

## Data Sources & Collection Strategy

### 1. Onchain Activity (Solana RPC)
- **API**: Public Solana RPC endpoints (free tier)
- **Metrics**: Program deployments, transaction volume spikes, token launches
- **Collection**: Poll every 6 hours, store program creation timestamps and activity
- **Signals**: New program clusters, usage growth patterns

### 2. GitHub Activity
- **API**: GitHub REST API (5000 req/hour authenticated)
- **Metrics**: New Solana repos, star velocity, commit activity
- **Collection**: Search for "solana" topics, track stars/forks/commits
- **Signals**: Rapidly growing repos, new tool categories

### 3. Twitter/X Monitoring
- **Method**: RSS feeds + web scraping (Twitter API v2 costs money)
- **Targets**: Key voices (Mert @0xMert, Akshay @aeyakovenko, Toly @aeyakovenko)
- **Collection**: Nitter instances or RSS alternatives
- **Signals**: Repeated keywords, announcement patterns

### 4. Discord/Forums
- **Method**: Public RSS feeds, web scraping of public channels
- **Sources**: Solana Discord public channels, forum.solana.com
- **Signals**: Discussion volume spikes, emerging terminology

### 5. Market Reports
- **Method**: RSS feeds + web scraping
- **Sources**: Messari, Electric Capital blog, Helius blog
- **Collection**: Weekly refresh, extract key themes

## Signal Detection Logic

### Phase 1: Data Normalization
- Timestamp all signals
- Extract keywords using TF-IDF
- Tag by source type

### Phase 2: Trend Detection
- **Frequency analysis**: Count keyword mentions across sources
- **Velocity tracking**: Rate of change in mentions
- **Cross-source validation**: Signals appearing in 3+ sources score higher
- **Anomaly detection**: Sudden spikes vs baseline

### Phase 3: Narrative Clustering
- Group related signals by semantic similarity
- Use keyword co-occurrence and topic modeling
- Rank by:
  - Recency (last 14 days weighted higher)
  - Cross-source presence (GitHub + onchain = stronger)
  - Velocity (growing vs declining)
  - Key voice mentions (Mert/Toly tweets = 3x weight)

### Phase 4: Idea Generation
- For each narrative, generate 3-5 product ideas using:
  - Gap analysis (what's missing in the detected activity)
  - Combination patterns (new tech + existing use case)
  - Developer tooling opportunities
  - User-facing applications

## Tech Stack

### Backend
- **Runtime**: Node.js + TypeScript
- **Data storage**: JSON files (simple, no DB needed for MVP)
- **Scheduling**: Node-cron for periodic updates
- **APIs**: axios, @solana/web3.js

### Frontend
- **Framework**: Next.js (React)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (free tier)

### Data Processing
- **NLP**: natural (Node.js NLP library)
- **Clustering**: Simple cosine similarity + keyword matching
- **Ranking**: Custom scoring algorithm

## Deployment Strategy

1. **Repository**: Public GitHub repo with clear README
2. **Hosting**: Vercel (frontend + API routes)
3. **Data refresh**: API route triggered manually or via cron
4. **Caching**: Store processed narratives in JSON, serve statically

## File Structure
```
solana-narrative-detector/
├── src/
│   ├── collectors/
│   │   ├── solana-onchain.ts
│   │   ├── github.ts
│   │   ├── twitter.ts
│   │   └── reports.ts
│   ├── analysis/
│   │   ├── signal-detector.ts
│   │   ├── narrative-clusterer.ts
│   │   └── idea-generator.ts
│   ├── utils/
│   │   └── scoring.ts
│   └── types/
│       └── index.ts
├── frontend/
│   ├── pages/
│   │   ├── index.tsx
│   │   └── api/
│   │       └── refresh.ts
│   ├── components/
│   └── styles/
├── data/
│   ├── raw/
│   ├── processed/
│   └── narratives.json
├── scripts/
│   └── collect-data.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Success Metrics
- Detect 5-10 narratives per refresh
- 50%+ should be non-obvious (not just trending coins)
- Ideas should be specific and actionable
- Tool should be fast (<30s refresh time)
