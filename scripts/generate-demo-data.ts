import * as fs from 'fs';
import * as path from 'path';
import { Signal, CollectorResult } from '../src/types';

function generateDemoData() {
  console.log('Generating demo data for testing...\n');

  const dataDir = path.join(__dirname, '..', 'data', 'raw');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // === NARRATIVE 1: AI x Solana (strong cross-source) ===
  const aiSignals: Signal[] = [
    {
      id: 'github_ai_1', source: 'github', timestamp: now - 1 * dayMs,
      content: 'solana-ai-agents: Framework for building autonomous AI agents with Solana wallet integration',
      metadata: { url: 'https://github.com/sendai/solana-ai-agents', author: 'sendai', metrics: { stars: 892, age_days: 4 }, tags: ['ai', 'agents', 'solana'] },
      keywords: ['ai', 'agents', 'autonomous', 'wallet', 'framework', 'solana'], weight: 4.5
    },
    {
      id: 'github_ai_2', source: 'github', timestamp: now - 2 * dayMs,
      content: 'ai-defi-strategy: LLM-powered DeFi strategy optimizer using on-chain data feeds',
      metadata: { url: 'https://github.com/arc-ai/ai-defi-strategy', author: 'arc-ai', metrics: { stars: 341, age_days: 6 }, tags: ['ai', 'defi', 'llm'] },
      keywords: ['ai', 'llm', 'defi', 'strategy', 'agents', 'optimization'], weight: 3.5
    },
    {
      id: 'github_ai_3', source: 'github', timestamp: now - 3 * dayMs,
      content: 'solana-model-marketplace: Decentralized marketplace for AI model inference on Solana',
      metadata: { url: 'https://github.com/nosana-ci/model-marketplace', author: 'nosana-ci', metrics: { stars: 567, age_days: 10 }, tags: ['ai', 'inference', 'marketplace'] },
      keywords: ['ai', 'inference', 'marketplace', 'decentralized', 'model', 'gpu'], weight: 3.0
    },
    {
      id: 'twitter_ai_1', source: 'twitter', timestamp: now - 1 * dayMs,
      content: '@aeyakovenko: AI agents are the next frontier for crypto. Solana\'s speed makes it the natural home for autonomous agent transactions.',
      metadata: { url: 'https://twitter.com/aeyakovenko/status/ai1', author: 'aeyakovenko' },
      keywords: ['ai', 'agents', 'autonomous', 'solana', 'transactions', 'speed'], weight: 3.0
    },
    {
      id: 'twitter_ai_2', source: 'twitter', timestamp: now - 2 * dayMs,
      content: '@mertimus: The AI x Solana stack is maturing fast. SendAI, Nosana, ELNA — real infra being built, not just memecoins.',
      metadata: { url: 'https://twitter.com/mertimus/status/ai2', author: 'mertimus' },
      keywords: ['ai', 'infrastructure', 'agents', 'solana', 'nosana'], weight: 3.0
    },
    {
      id: 'onchain_ai_1', source: 'onchain', timestamp: now - 1 * dayMs,
      content: 'Surge in AI-related program deployments: 47 new programs with AI/ML metadata in past 7 days',
      metadata: { url: 'https://solscan.io', metrics: { new_programs: 47, weekly_growth: 3.2 } },
      keywords: ['ai', 'agents', 'programs', 'deployment', 'growth'], weight: 3.5
    },
    {
      id: 'report_ai_1', source: 'report', timestamp: now - 4 * dayMs,
      content: 'Helius Blog: AI Agents on Solana — How sub-second finality enables real-time autonomous trading',
      metadata: { url: 'https://helius.dev/blog/ai-agents-solana', author: 'Helius Blog', metrics: { report_age_days: 4 } },
      keywords: ['ai', 'agents', 'autonomous', 'trading', 'finality', 'solana'], weight: 2.5
    },
  ];

  // === NARRATIVE 2: Token Extensions / Token-2022 adoption ===
  const tokenExtSignals: Signal[] = [
    {
      id: 'github_te_1', source: 'github', timestamp: now - 2 * dayMs,
      content: 'token-2022-examples: Production-ready examples of transfer hooks, metadata pointers, and confidential transfers',
      metadata: { url: 'https://github.com/solana-developers/token-2022-examples', author: 'solana-developers', metrics: { stars: 234, age_days: 5 }, tags: ['token-2022', 'examples'] },
      keywords: ['token-2022', 'token-extensions', 'transfer-hooks', 'confidential-transfers', 'metadata'], weight: 3.0
    },
    {
      id: 'github_te_2', source: 'github', timestamp: now - 3 * dayMs,
      content: 'token-2022-migration-toolkit: Automated tool for migrating existing SPL tokens to Token Extensions',
      metadata: { url: 'https://github.com/solana-labs/token-2022-migration', author: 'solana-labs', metrics: { stars: 178, age_days: 8 }, tags: ['token-2022', 'migration'] },
      keywords: ['token-2022', 'token-extensions', 'migration', 'spl-token', 'upgrade'], weight: 3.5
    },
    {
      id: 'twitter_te_1', source: 'twitter', timestamp: now - 1 * dayMs,
      content: '@armaniferrante: Token-2022 adoption is accelerating. Transfer hooks enable programmable compliance — this changes everything for RWA on Solana.',
      metadata: { url: 'https://twitter.com/armaniferrante/status/te1', author: 'armaniferrante' },
      keywords: ['token-2022', 'token-extensions', 'transfer-hooks', 'rwa', 'compliance', 'programmable'], weight: 2.5
    },
    {
      id: 'twitter_te_2', source: 'twitter', timestamp: now - 3 * dayMs,
      content: '@rajgokal: Confidential transfers in Token-2022 are a game changer for institutional DeFi. Privacy without compromising compliance.',
      metadata: { url: 'https://twitter.com/rajgokal/status/te2', author: 'rajgokal' },
      keywords: ['token-2022', 'confidential-transfers', 'privacy', 'institutional', 'defi', 'compliance'], weight: 2.5
    },
    {
      id: 'report_te_1', source: 'report', timestamp: now - 5 * dayMs,
      content: 'Messari Research: Token Extensions on Solana — Programmable tokens and the path to institutional adoption',
      metadata: { url: 'https://messari.io/report/token-extensions-solana', author: 'Messari Research', metrics: { report_age_days: 5 } },
      keywords: ['token-2022', 'token-extensions', 'programmable', 'institutional', 'adoption'], weight: 2.0
    },
    {
      id: 'onchain_te_1', source: 'onchain', timestamp: now - 2 * dayMs,
      content: 'Token-2022 program usage spiked 340% this week — 1,847 new token mints using Token Extensions',
      metadata: { url: 'https://solscan.io/account/TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', metrics: { weekly_mints: 1847, growth_pct: 340 } },
      keywords: ['token-2022', 'token-extensions', 'minting', 'growth', 'adoption'], weight: 4.0
    },
  ];

  // === NARRATIVE 3: DeFi innovation / Jupiter ecosystem ===
  const defiSignals: Signal[] = [
    {
      id: 'onchain_defi_1', source: 'onchain', timestamp: now - 1 * dayMs,
      content: 'Jupiter Aggregator hit record volume: $4.2B in 7-day trading volume, up 67% week-over-week',
      metadata: { url: 'https://solscan.io/account/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', metrics: { volume_7d: 4200000000, growth_pct: 67 } },
      keywords: ['defi', 'dex', 'jupiter', 'aggregator', 'trading', 'volume'], weight: 4.5
    },
    {
      id: 'onchain_defi_2', source: 'onchain', timestamp: now - 2 * dayMs,
      content: 'Kamino lending TVL crossed $2B — highest ever for a Solana lending protocol',
      metadata: { url: 'https://solscan.io/account/KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD', metrics: { tvl: 2000000000 } },
      keywords: ['defi', 'lending', 'tvl', 'kamino', 'liquidity', 'yield'], weight: 3.5
    },
    {
      id: 'github_defi_1', source: 'github', timestamp: now - 2 * dayMs,
      content: 'jupiter-perps-v2: Next-gen perpetuals engine with advanced order types and cross-margin',
      metadata: { url: 'https://github.com/jup-ag/jupiter-perps-v2', author: 'jup-ag', metrics: { stars: 445, age_days: 7 }, tags: ['defi', 'perps', 'jupiter'] },
      keywords: ['defi', 'perpetuals', 'jupiter', 'trading', 'cross-margin', 'advanced-orders'], weight: 4.0
    },
    {
      id: 'twitter_defi_1', source: 'twitter', timestamp: now - 1 * dayMs,
      content: '@mertimus: Solana DeFi TVL hit $12B. That\'s a 5x from a year ago. The composability flywheel is real.',
      metadata: { url: 'https://twitter.com/mertimus/status/defi1', author: 'mertimus' },
      keywords: ['defi', 'tvl', 'liquidity', 'composability', 'growth', 'solana'], weight: 3.0
    },
    {
      id: 'twitter_defi_2', source: 'twitter', timestamp: now - 3 * dayMs,
      content: '@Jupiter_HQ: Limit orders and DCA now processing $500M/week. DeFi on Solana is going mainstream.',
      metadata: { url: 'https://twitter.com/Jupiter_HQ/status/defi2', author: 'Jupiter_HQ' },
      keywords: ['defi', 'dex', 'jupiter', 'limit-orders', 'dca', 'mainstream'], weight: 2.0
    },
    {
      id: 'report_defi_1', source: 'report', timestamp: now - 6 * dayMs,
      content: 'Helius Blog: Solana DeFi Deep Dive — Why composability and speed are driving record TVL',
      metadata: { url: 'https://helius.dev/blog/solana-defi-deep-dive', author: 'Helius Blog', metrics: { report_age_days: 6 } },
      keywords: ['defi', 'tvl', 'composability', 'liquidity', 'jupiter', 'lending'], weight: 2.5
    },
  ];

  // === NARRATIVE 4: DePIN growth ===
  const depinSignals: Signal[] = [
    {
      id: 'github_depin_1', source: 'github', timestamp: now - 3 * dayMs,
      content: 'helium-iot-sdk: Helium IoT network SDK for building connected devices on Solana',
      metadata: { url: 'https://github.com/helium/helium-iot-sdk', author: 'helium', metrics: { stars: 312, age_days: 12 }, tags: ['depin', 'iot', 'helium'] },
      keywords: ['depin', 'iot', 'helium', 'physical-infrastructure', 'devices', 'network'], weight: 3.0
    },
    {
      id: 'twitter_depin_1', source: 'twitter', timestamp: now - 2 * dayMs,
      content: '@aeyakovenko: DePIN on Solana is quietly becoming massive. Helium, Render, Hivemapper — real hardware, real revenue.',
      metadata: { url: 'https://twitter.com/aeyakovenko/status/depin1', author: 'aeyakovenko' },
      keywords: ['depin', 'helium', 'render', 'hivemapper', 'physical-infrastructure', 'revenue'], weight: 3.0
    },
    {
      id: 'onchain_depin_1', source: 'onchain', timestamp: now - 1 * dayMs,
      content: 'Render Network: GPU compute usage up 280% — 15,000+ active node operators on Solana',
      metadata: { url: 'https://solscan.io/token/rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof', metrics: { active_nodes: 15000, growth_pct: 280 } },
      keywords: ['depin', 'render', 'gpu', 'compute', 'physical-infrastructure', 'network'], weight: 3.5
    },
    {
      id: 'report_depin_1', source: 'report', timestamp: now - 7 * dayMs,
      content: 'Messari Research: DePIN on Solana — Physical infrastructure networks generating $50M+ annual protocol revenue',
      metadata: { url: 'https://messari.io/report/depin-solana-2026', author: 'Messari Research', metrics: { report_age_days: 7 } },
      keywords: ['depin', 'physical-infrastructure', 'revenue', 'helium', 'render', 'network'], weight: 2.0
    },
  ];

  // === NARRATIVE 5: Compressed NFTs / State Compression ===
  const cnftSignals: Signal[] = [
    {
      id: 'github_cnft_1', source: 'github', timestamp: now - 2 * dayMs,
      content: 'cnft-tools: CLI and SDK for minting, transferring, and managing compressed NFTs at scale',
      metadata: { url: 'https://github.com/metaplex-foundation/cnft-tools', author: 'metaplex-foundation', metrics: { stars: 456, age_days: 8 }, tags: ['nft', 'compressed', 'tools'] },
      keywords: ['compressed-nfts', 'state-compression', 'nft', 'minting', 'merkle-tree', 'tools'], weight: 4.0
    },
    {
      id: 'twitter_cnft_1', source: 'twitter', timestamp: now - 2 * dayMs,
      content: '@mertimus: Compressed NFTs are the future. 50M+ minted this month alone. 1000x cheaper than Ethereum.',
      metadata: { url: 'https://twitter.com/mertimus/status/cnft1', author: 'mertimus' },
      keywords: ['compressed-nfts', 'state-compression', 'nft', 'scaling', 'cost-reduction'], weight: 3.0
    },
    {
      id: 'onchain_cnft_1', source: 'onchain', timestamp: now - 1 * dayMs,
      content: 'State compression: 50M+ compressed NFTs minted in February, 3x increase from January',
      metadata: { url: 'https://solscan.io', metrics: { monthly_mints: 50000000, growth_pct: 200 } },
      keywords: ['compressed-nfts', 'state-compression', 'nft', 'minting', 'growth', 'scaling'], weight: 3.5
    },
    {
      id: 'report_cnft_1', source: 'report', timestamp: now - 5 * dayMs,
      content: 'Helius Blog: State Compression Deep Dive — How compressed NFTs achieve 1000x cost reduction using concurrent Merkle trees',
      metadata: { url: 'https://helius.dev/blog/state-compression', author: 'Helius Blog', metrics: { report_age_days: 5 } },
      keywords: ['compressed-nfts', 'state-compression', 'cost-reduction', 'merkle-tree', 'scaling', 'nft'], weight: 2.5
    },
  ];

  const results: Record<string, CollectorResult> = {
    github: {
      signals: [
        ...aiSignals.filter(s => s.source === 'github'),
        ...tokenExtSignals.filter(s => s.source === 'github'),
        ...defiSignals.filter(s => s.source === 'github'),
        ...depinSignals.filter(s => s.source === 'github'),
        ...cnftSignals.filter(s => s.source === 'github'),
      ],
      collectedAt: now,
      source: 'github'
    },
    onchain: {
      signals: [
        ...aiSignals.filter(s => s.source === 'onchain'),
        ...tokenExtSignals.filter(s => s.source === 'onchain'),
        ...defiSignals.filter(s => s.source === 'onchain'),
        ...depinSignals.filter(s => s.source === 'onchain'),
        ...cnftSignals.filter(s => s.source === 'onchain'),
      ],
      collectedAt: now,
      source: 'onchain'
    },
    twitter: {
      signals: [
        ...aiSignals.filter(s => s.source === 'twitter'),
        ...tokenExtSignals.filter(s => s.source === 'twitter'),
        ...defiSignals.filter(s => s.source === 'twitter'),
        ...depinSignals.filter(s => s.source === 'twitter'),
        ...cnftSignals.filter(s => s.source === 'twitter'),
      ],
      collectedAt: now,
      source: 'twitter'
    },
    reports: {
      signals: [
        ...aiSignals.filter(s => s.source === 'report'),
        ...tokenExtSignals.filter(s => s.source === 'report'),
        ...defiSignals.filter(s => s.source === 'report'),
        ...depinSignals.filter(s => s.source === 'report'),
        ...cnftSignals.filter(s => s.source === 'report'),
      ],
      collectedAt: now,
      source: 'report'
    }
  };

  const outputFile = path.join(dataDir, `collection_demo_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

  const totalSignals = Object.values(results).reduce((sum, r) => sum + r.signals.length, 0);
  console.log(`Demo data generated: ${outputFile}`);
  console.log(`\nSummary:`);
  console.log(`  GitHub signals: ${results.github.signals.length}`);
  console.log(`  Onchain signals: ${results.onchain.signals.length}`);
  console.log(`  Twitter signals: ${results.twitter.signals.length}`);
  console.log(`  Report signals: ${results.reports.signals.length}`);
  console.log(`  Total: ${totalSignals}`);
  console.log(`\nNext: Run "npm run analyze" to generate narratives`);
}

generateDemoData();
