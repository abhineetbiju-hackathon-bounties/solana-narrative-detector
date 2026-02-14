import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { Signal, CollectorResult } from '../types';

interface DeFiLlamaProtocol {
  name: string;
  slug: string;
  chain: string;
  chains: string[];
  tvl: number;
  change_1d: number | null;
  change_7d: number | null;
  category: string;
  url: string;
}

export class SolanaOnchainCollector {
  private connection: Connection;
  private heliusApiKey?: string;

  constructor(rpcUrl: string = 'https://api.mainnet-beta.solana.com', heliusApiKey?: string) {
    this.connection = new Connection(rpcUrl, 'confirmed');
    this.heliusApiKey = heliusApiKey;
  }

  async collectOnchainSignals(): Promise<CollectorResult> {
    const signals: Signal[] = [];
    const errors: string[] = [];

    // 1. DeFiLlama TVL data — comprehensive Solana DeFi landscape
    try {
      const defiSignals = await this.collectDeFiLlamaData();
      signals.push(...defiSignals);
      console.log(`  DeFiLlama: ${defiSignals.length} signals`);
    } catch (e: any) {
      errors.push(`DeFiLlama: ${e.message}`);
    }

    // 2. Known program activity detection
    try {
      const programSignals = await this.detectProgramActivity();
      signals.push(...programSignals);
      console.log(`  Program Activity: ${programSignals.length} signals`);
    } catch (e: any) {
      errors.push(`Program Activity: ${e.message}`);
    }

    // 3. Jupiter trending tokens
    try {
      const tokenSignals = await this.detectTrendingTokens();
      signals.push(...tokenSignals);
      console.log(`  Trending Tokens: ${tokenSignals.length} signals`);
    } catch (e: any) {
      errors.push(`Trending Tokens: ${e.message}`);
    }

    // 4. Helius enrichment (if API key available)
    if (this.heliusApiKey) {
      try {
        const heliusSignals = await this.collectHeliusData();
        signals.push(...heliusSignals);
        console.log(`  Helius: ${heliusSignals.length} signals`);
      } catch (e: any) {
        errors.push(`Helius: ${e.message}`);
      }
    }

    // 5. Solana network stats
    try {
      const networkSignals = await this.collectNetworkStats();
      signals.push(...networkSignals);
      console.log(`  Network Stats: ${networkSignals.length} signals`);
    } catch (e: any) {
      errors.push(`Network Stats: ${e.message}`);
    }

    return {
      signals,
      collectedAt: Date.now(),
      source: 'onchain',
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private async collectDeFiLlamaData(): Promise<Signal[]> {
    const signals: Signal[] = [];

    try {
      // Get all protocols and filter for Solana
      const response = await axios.get('https://api.llama.fi/protocols', { timeout: 15000 });
      const protocols: DeFiLlamaProtocol[] = response.data;

      // Filter for Solana-native protocols (exclude CEXes and non-native multi-chain protocols)
      const excludedCategories = new Set(['CEX', 'Chain', 'Reserve Currency']);
      const excludedSlugs = new Set([
        'binance-cex', 'bitstamp', 'bitmex', 'okx', 'bybit', 'coinbase',
        'kraken', 'bitfinex', 'htx', 'gate-io', 'kucoin', 'crypto-com',
      ]);
      const solanaProtocols = protocols.filter((p: any) =>
        p.chains && (p.chains.includes('Solana') || p.chain === 'Solana') &&
        !excludedCategories.has(p.category) &&
        !excludedSlugs.has(p.slug)
      );

      // Sort by TVL descending
      solanaProtocols.sort((a: any, b: any) => (b.tvl || 0) - (a.tvl || 0));

      // Top protocols by TVL — these represent the current landscape
      const topProtocols = solanaProtocols.slice(0, 25);
      for (const protocol of topProtocols) {
        const tvlFormatted = protocol.tvl > 1e9
          ? `$${(protocol.tvl / 1e9).toFixed(2)}B`
          : `$${(protocol.tvl / 1e6).toFixed(1)}M`;

        const change7d = protocol.change_7d;
        const growthText = change7d !== null && change7d !== undefined
          ? `${change7d > 0 ? '+' : ''}${change7d.toFixed(1)}% 7d change`
          : '';

        const keywords = this.extractProtocolKeywords(protocol);

        signals.push({
          id: `onchain_defillama_${protocol.slug}_${Date.now()}`,
          source: 'onchain',
          timestamp: Date.now(),
          content: `${protocol.name} TVL: ${tvlFormatted} (${protocol.category}). ${growthText}`.trim(),
          metadata: {
            url: protocol.url || `https://defillama.com/protocol/${protocol.slug}`,
            metrics: {
              tvl: Math.round(protocol.tvl || 0),
              change_7d: change7d || 0,
              change_1d: protocol.change_1d || 0,
            }
          },
          keywords,
          weight: this.calculateDeFiWeight(protocol),
        });
      }

      // Detect protocols with significant growth (>20% in 7 days)
      const growthProtocols = solanaProtocols.filter(
        (p: any) => p.change_7d && p.change_7d > 20 && p.tvl > 1000000
      );
      for (const protocol of growthProtocols.slice(0, 10)) {
        signals.push({
          id: `onchain_growth_${protocol.slug}_${Date.now()}`,
          source: 'onchain',
          timestamp: Date.now(),
          content: `Rapid growth detected: ${protocol.name} (${protocol.category}) TVL grew ${protocol.change_7d?.toFixed(1)}% in 7 days`,
          metadata: {
            url: `https://defillama.com/protocol/${protocol.slug}`,
            metrics: {
              tvl: Math.round(protocol.tvl || 0),
              growth_7d_pct: protocol.change_7d || 0,
            }
          },
          keywords: [...this.extractProtocolKeywords(protocol), 'growth', 'trending'],
          weight: Math.min(3.0 + (protocol.change_7d || 0) / 50, 5.0),
        });
      }

      // Category aggregation — detect trending categories
      const categoryTvl = new Map<string, { totalTvl: number; count: number; protocols: string[] }>();
      for (const p of solanaProtocols) {
        const cat = p.category || 'Other';
        if (!categoryTvl.has(cat)) {
          categoryTvl.set(cat, { totalTvl: 0, count: 0, protocols: [] });
        }
        const entry = categoryTvl.get(cat)!;
        entry.totalTvl += p.tvl || 0;
        entry.count++;
        if (entry.protocols.length < 5) entry.protocols.push(p.name);
      }

      for (const [category, data] of categoryTvl) {
        if (data.count >= 3 && data.totalTvl > 10000000) {
          const tvlFormatted = data.totalTvl > 1e9
            ? `$${(data.totalTvl / 1e9).toFixed(2)}B`
            : `$${(data.totalTvl / 1e6).toFixed(1)}M`;

          signals.push({
            id: `onchain_category_${category.toLowerCase().replace(/\s+/g, '-')}_${Date.now()}`,
            source: 'onchain',
            timestamp: Date.now(),
            content: `Solana ${category} sector: ${data.count} protocols, ${tvlFormatted} total TVL. Top: ${data.protocols.join(', ')}`,
            metadata: {
              url: `https://defillama.com/chain/Solana`,
              metrics: {
                total_tvl: Math.round(data.totalTvl),
                protocol_count: data.count,
              }
            },
            keywords: [
              category.toLowerCase().replace(/\s+/g, '-'),
              'defi', 'tvl', 'solana',
              ...data.protocols.map(p => p.toLowerCase().replace(/\s+/g, '-')),
            ],
            weight: Math.min(2.0 + data.count / 5, 4.0),
          });
        }
      }
    } catch (error: any) {
      console.error('DeFiLlama collection error:', error.message);
    }

    return signals;
  }

  private async detectProgramActivity(): Promise<Signal[]> {
    const signals: Signal[] = [];

    // Expanded list of known Solana programs
    const knownPrograms = [
      // Top programs by category — DeFiLlama already covers TVL data for all protocols
      { name: 'Jupiter Aggregator', address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', category: 'dex' },
      { name: 'Raydium', address: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', category: 'dex' },
      { name: 'Kamino', address: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD', category: 'lending' },
      { name: 'Drift Protocol', address: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH', category: 'perps' },
      { name: 'Jito', address: 'Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P3FBscJC', category: 'liquid-staking' },
      { name: 'Tensor', address: 'TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN', category: 'nft' },
      { name: 'Marginfi', address: 'MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA', category: 'lending' },
      { name: 'Pyth Network', address: 'FsJ3A3u2vn5cTVofAjvy6y5kwABJAqYWpe4975bi2epH', category: 'oracle' },
    ];

    for (const program of knownPrograms) {
      try {
        const pubkey = new PublicKey(program.address);
        const signatures = await this.connection.getSignaturesForAddress(pubkey, { limit: 100 });

        if (signatures.length > 0) {
          const activityLevel = signatures.length >= 100 ? 'very high' :
            signatures.length >= 50 ? 'high' :
              signatures.length >= 20 ? 'moderate' : 'low';

          signals.push({
            id: `onchain_activity_${program.address}_${Date.now()}`,
            source: 'onchain',
            timestamp: Date.now(),
            content: `${activityLevel.charAt(0).toUpperCase() + activityLevel.slice(1)} activity on ${program.name} (${program.category}): ${signatures.length} recent transactions`,
            metadata: {
              url: `https://solscan.io/account/${program.address}`,
              metrics: {
                recent_transactions: signatures.length,
                program_activity: signatures.length / 100
              }
            },
            keywords: [
              'onchain-activity',
              program.name.toLowerCase().replace(/\s+/g, '-'),
              program.category,
              activityLevel === 'very high' || activityLevel === 'high' ? 'high-volume' : 'active',
            ],
            weight: Math.min(signatures.length / 25, 5)
          });
        }
      } catch (err) {
        continue;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return signals;
  }

  private async detectTrendingTokens(): Promise<Signal[]> {
    const signals: Signal[] = [];

    try {
      // Use Jupiter's token API for trending tokens
      const trendingResponse = await axios.get('https://cache.jup.ag/top-tokens', { timeout: 10000 });
      const trendingTokens = trendingResponse.data;

      if (Array.isArray(trendingTokens)) {
        for (const token of trendingTokens.slice(0, 15)) {
          const symbol = token.symbol || token.name || 'Unknown';
          const address = token.address || token.mint || '';

          signals.push({
            id: `token_trending_${address}_${Date.now()}`,
            source: 'onchain',
            timestamp: Date.now(),
            content: `Trending token on Jupiter: ${symbol} (${token.name || ''})`,
            metadata: {
              url: `https://solscan.io/token/${address}`,
              metrics: {
                daily_volume: token.daily_volume || 0,
              }
            },
            keywords: [
              'token',
              'trending',
              symbol.toLowerCase(),
              'trading',
              'jupiter',
            ].filter(Boolean),
            weight: 1.5
          });
        }
      }
    } catch (error: any) {
      console.log('Trending token detection error:', error.message);
    }

    // Try Jupiter token stats for volume info
    try {
      const response = await axios.get('https://stats.jup.ag/info/day', { timeout: 10000 });
      if (response.data) {
        const stats = response.data;
        signals.push({
          id: `onchain_jupiter_stats_${Date.now()}`,
          source: 'onchain',
          timestamp: Date.now(),
          content: `Jupiter DEX daily stats: ${JSON.stringify(stats).substring(0, 200)}`,
          metadata: {
            url: 'https://jup.ag',
            metrics: stats,
          },
          keywords: ['jupiter', 'dex', 'aggregator', 'trading', 'volume', 'defi'],
          weight: 3.0,
        });
      }
    } catch (e) {
      // Stats endpoint may not be available
    }

    return signals;
  }

  private async collectHeliusData(): Promise<Signal[]> {
    const signals: Signal[] = [];

    if (!this.heliusApiKey) return signals;

    try {
      const response = await axios.post(
        `https://api.helius.xyz/v0/addresses/active-programs`,
        { limit: 50, time_range: '14d' },
        { headers: { 'Authorization': `Bearer ${this.heliusApiKey}` }, timeout: 10000 }
      );

      if (response.data && Array.isArray(response.data.programs)) {
        for (const program of response.data.programs) {
          signals.push({
            id: `helius_${program.address}_${Date.now()}`,
            source: 'onchain',
            timestamp: Date.now(),
            content: `New active program detected via Helius: ${program.name || program.address}`,
            metadata: {
              url: `https://solscan.io/account/${program.address}`,
              metrics: program.metrics || {}
            },
            keywords: ['new-program', 'helius-detected', 'deployment'],
            weight: 2.0
          });
        }
      }
    } catch (error: any) {
      console.log('Helius data collection skipped:', error.message);
    }

    return signals;
  }

  private async collectNetworkStats(): Promise<Signal[]> {
    const signals: Signal[] = [];

    try {
      // Get current TPS and network performance
      const perfSamples = await this.connection.getRecentPerformanceSamples(5);

      if (perfSamples.length > 0) {
        const avgTps = perfSamples.reduce((sum, s) => sum + s.numTransactions / s.samplePeriodSecs, 0) / perfSamples.length;

        signals.push({
          id: `onchain_network_tps_${Date.now()}`,
          source: 'onchain',
          timestamp: Date.now(),
          content: `Solana network average TPS: ${Math.round(avgTps)} transactions per second`,
          metadata: {
            url: 'https://solscan.io',
            metrics: {
              avg_tps: Math.round(avgTps),
              samples: perfSamples.length,
            }
          },
          keywords: ['network', 'tps', 'performance', 'throughput', 'solana'],
          weight: 1.5,
        });
      }

      // Get current epoch info
      const epochInfo = await this.connection.getEpochInfo();
      signals.push({
        id: `onchain_epoch_${epochInfo.epoch}_${Date.now()}`,
        source: 'onchain',
        timestamp: Date.now(),
        content: `Solana Epoch ${epochInfo.epoch}: ${((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100).toFixed(1)}% complete, slot ${epochInfo.absoluteSlot}`,
        metadata: {
          url: 'https://solscan.io',
          metrics: {
            epoch: epochInfo.epoch,
            slot: epochInfo.absoluteSlot,
            epoch_progress: Math.round((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100),
          }
        },
        keywords: ['network', 'epoch', 'validator', 'solana'],
        weight: 1.0,
      });
    } catch (error: any) {
      console.log('Network stats collection error:', error.message);
    }

    return signals;
  }

  private extractProtocolKeywords(protocol: any): string[] {
    const keywords: string[] = [];

    // Category-based keywords
    const categoryMap: Record<string, string[]> = {
      'Dexes': ['dex', 'amm', 'trading', 'swap', 'defi'],
      'Lending': ['lending', 'borrowing', 'defi', 'yield'],
      'Liquid Staking': ['liquid-staking', 'staking', 'validator', 'defi'],
      'Derivatives': ['derivatives', 'perps', 'perpetuals', 'trading', 'defi'],
      'CDP': ['cdp', 'stablecoin', 'defi', 'collateral'],
      'Yield': ['yield', 'farming', 'defi', 'apy'],
      'Bridge': ['bridge', 'cross-chain', 'interoperability'],
      'NFT Marketplace': ['nft', 'marketplace', 'trading'],
      'NFT Lending': ['nft', 'lending', 'defi'],
      'Launchpad': ['launchpad', 'ido', 'token-launch'],
      'Prediction Market': ['prediction', 'market', 'betting'],
      'RWA': ['rwa', 'real-world-assets', 'tokenization'],
      'Privacy': ['privacy', 'confidential', 'zk'],
    };

    const catKeywords = categoryMap[protocol.category] || [protocol.category?.toLowerCase().replace(/\s+/g, '-') || 'defi'];
    keywords.push(...catKeywords);

    // Protocol name
    keywords.push(protocol.name.toLowerCase().replace(/\s+/g, '-'));

    // Add TVL-based tags
    if (protocol.tvl > 1e9) keywords.push('high-tvl');
    if (protocol.change_7d && protocol.change_7d > 20) keywords.push('growth', 'trending');

    return keywords.slice(0, 15);
  }

  private calculateDeFiWeight(protocol: any): number {
    let weight = 1.0;

    // TVL-based weight
    if (protocol.tvl > 1e9) weight += 2.0;
    else if (protocol.tvl > 100e6) weight += 1.5;
    else if (protocol.tvl > 10e6) weight += 1.0;

    // Growth-based weight
    const change7d = protocol.change_7d || 0;
    if (change7d > 50) weight += 1.5;
    else if (change7d > 20) weight += 1.0;
    else if (change7d > 10) weight += 0.5;

    return Math.min(weight, 5.0);
  }
}
