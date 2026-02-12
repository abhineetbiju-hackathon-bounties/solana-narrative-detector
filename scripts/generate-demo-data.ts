import * as fs from 'fs';
import * as path from 'path';
import { Signal, CollectorResult } from '../src/types';

function generateDemoData() {
  console.log('🎭 Generating demo data for testing...\n');

  const dataDir = path.join(__dirname, '..', 'data', 'raw');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // GitHub signals
  const githubSignals: Signal[] = [
    {
      id: 'github_1',
      source: 'github',
      timestamp: now - 2 * dayMs,
      content: 'solana-ai-sdk: SDK for building AI agents on Solana with built-in wallet integration',
      metadata: {
        url: 'https://github.com/example/solana-ai-sdk',
        author: 'ai-builder',
        metrics: { stars: 234, age_days: 5 },
        tags: ['ai', 'sdk', 'agents']
      },
      keywords: ['ai', 'sdk', 'agents', 'wallet', 'solana'],
      weight: 3.5
    },
    {
      id: 'github_2',
      source: 'github',
      timestamp: now - 3 * dayMs,
      content: 'compressed-nft-toolkit: Tools for creating and managing compressed NFTs at scale',
      metadata: {
        url: 'https://github.com/example/compressed-nft-toolkit',
        author: 'nft-dev',
        metrics: { stars: 456, age_days: 8 },
        tags: ['nft', 'compression', 'tools']
      },
      keywords: ['nft', 'compressed', 'compression', 'state-compression', 'tools'],
      weight: 4.0
    },
    {
      id: 'github_3',
      source: 'github',
      timestamp: now - 1 * dayMs,
      content: 'token-2022-migration: Automated migration tool for upgrading SPL tokens to Token Extensions',
      metadata: {
        url: 'https://github.com/example/token-2022-migration',
        author: 'token-labs',
        metrics: { stars: 178, age_days: 3 },
        tags: ['token-2022', 'migration', 'tools']
      },
      keywords: ['token-2022', 'token-extensions', 'migration', 'spl', 'tools'],
      weight: 3.0
    },
  ];

  // Onchain signals
  const onchainSignals: Signal[] = [
    {
      id: 'onchain_1',
      source: 'onchain',
      timestamp: now - 1 * dayMs,
      content: 'High activity detected on Jupiter Aggregator: 1247 recent transactions',
      metadata: {
        url: 'https://solscan.io/account/JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
        metrics: { recent_transactions: 1247, program_activity: 12.47 }
      },
      keywords: ['onchain-activity', 'jupiter-aggregator', 'high-volume', 'dex', 'trading'],
      weight: 4.5
    },
    {
      id: 'onchain_2',
      source: 'onchain',
      timestamp: now - 4 * dayMs,
      content: 'Trending token: RENDER - Decentralized GPU rendering network',
      metadata: {
        url: 'https://solscan.io/token/rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof',
        metrics: { volume: 2500000, liquidity: 8900000 }
      },
      keywords: ['token-launch', 'trending', 'render', 'gpu', 'depin'],
      weight: 2.5
    },
  ];

  // Twitter signals
  const twitterSignals: Signal[] = [
    {
      id: 'twitter_1',
      source: 'twitter',
      timestamp: now - 2 * dayMs,
      content: '@mertimus: Compressed NFTs are the future. 10M+ NFTs minted in a week. This changes everything.',
      metadata: {
        url: 'https://twitter.com/mertimus/status/123',
        author: 'mertimus'
      },
      keywords: ['compressed-nfts', 'cnft', 'nft', 'state-compression', 'scaling'],
      weight: 3.0
    },
    {
      id: 'twitter_2',
      source: 'twitter',
      timestamp: now - 3 * dayMs,
      content: '@aeyakovenko: Firedancer making great progress. Expect mainnet testing soon. This will be a game changer for throughput.',
      metadata: {
        url: 'https://twitter.com/aeyakovenko/status/124',
        author: 'aeyakovenko'
      },
      keywords: ['firedancer', 'infrastructure', 'validator', 'throughput', 'performance'],
      weight: 3.0
    },
    {
      id: 'twitter_3',
      source: 'twitter',
      timestamp: now - 1 * dayMs,
      content: '@armaniferrante: Token-2022 adoption picking up. Transfer hooks enable so many new use cases.',
      metadata: {
        url: 'https://twitter.com/armaniferrante/status/125',
        author: 'armaniferrante'
      },
      keywords: ['token-2022', 'token-extensions', 'transfer-hooks', 'programmability'],
      weight: 2.5
    },
  ];

  // Report signals
  const reportSignals: Signal[] = [
    {
      id: 'report_1',
      source: 'report',
      timestamp: now - 5 * dayMs,
      content: 'Helius Blog: State Compression Deep Dive - How Compressed NFTs achieve 1000x cost reduction',
      metadata: {
        url: 'https://helius.dev/blog/state-compression',
        author: 'Helius Blog',
        metrics: { report_age_days: 5 }
      },
      keywords: ['state-compression', 'compressed-nfts', 'cost-reduction', 'scaling', 'merkle-tree'],
      weight: 2.5
    },
    {
      id: 'report_2',
      source: 'report',
      timestamp: now - 7 * dayMs,
      content: 'Messari Research: Solana Q4 2025 Report - Token Extensions driving new protocol innovation',
      metadata: {
        url: 'https://messari.io/report/solana-q4-2025',
        author: 'Messari Research',
        metrics: { report_age_days: 7 }
      },
      keywords: ['token-extensions', 'token-2022', 'protocol-innovation', 'defi', 'report'],
      weight: 2.0
    },
  ];

  const results: Record<string, CollectorResult> = {
    github: {
      signals: githubSignals,
      collectedAt: now,
      source: 'github'
    },
    onchain: {
      signals: onchainSignals,
      collectedAt: now,
      source: 'onchain'
    },
    twitter: {
      signals: twitterSignals,
      collectedAt: now,
      source: 'twitter'
    },
    reports: {
      signals: reportSignals,
      collectedAt: now,
      source: 'report'
    }
  };

  const outputFile = path.join(dataDir, `collection_demo_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));

  console.log(`✅ Demo data generated: ${outputFile}`);
  console.log(`\n📊 Summary:`);
  console.log(`   GitHub signals: ${githubSignals.length}`);
  console.log(`   Onchain signals: ${onchainSignals.length}`);
  console.log(`   Twitter signals: ${twitterSignals.length}`);
  console.log(`   Report signals: ${reportSignals.length}`);
  console.log(`   Total: ${githubSignals.length + onchainSignals.length + twitterSignals.length + reportSignals.length}`);
  console.log(`\n💡 Next: Run "npm run analyze" to generate narratives`);
}

generateDemoData();
