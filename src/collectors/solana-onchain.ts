import { Connection, PublicKey } from '@solana/web3.js';
import axios from 'axios';
import { Signal, CollectorResult } from '../types';

interface ProgramDeployment {
  address: string;
  deployedAt: number;
  transactions: number;
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

    try {
      // Collect program deployment signals
      const programSignals = await this.detectNewPrograms();
      signals.push(...programSignals);

      // If Helius API key available, get richer data
      if (this.heliusApiKey) {
        const heliusSignals = await this.collectHeliusData();
        signals.push(...heliusSignals);
      }

      // Collect token launch signals
      const tokenSignals = await this.detectNewTokens();
      signals.push(...tokenSignals);

    } catch (error: any) {
      errors.push(`Onchain collection error: ${error.message}`);
    }

    return {
      signals,
      collectedAt: Date.now(),
      source: 'onchain',
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private async detectNewPrograms(): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    try {
      // Well-known program IDs to track activity around
      const knownPrograms = [
        { name: 'Jupiter Aggregator', address: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4' },
        { name: 'Marinade Finance', address: 'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD' },
        { name: 'Kamino', address: 'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD' },
        { name: 'Drift Protocol', address: 'dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH' },
        { name: 'Magic Eden', address: 'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K' },
      ];

      for (const program of knownPrograms) {
        try {
          const pubkey = new PublicKey(program.address);
          const signatures = await this.connection.getSignaturesForAddress(pubkey, { limit: 100 });
          
          if (signatures.length > 50) {
            // High activity detected
            signals.push({
              id: `onchain_activity_${program.address}_${Date.now()}`,
              source: 'onchain',
              timestamp: Date.now(),
              content: `High activity detected on ${program.name}: ${signatures.length} recent transactions`,
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
                'high-volume'
              ],
              weight: Math.min(signatures.length / 20, 5)
            });
          }
        } catch (err) {
          // Skip failed programs
          continue;
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error: any) {
      console.error('Program detection error:', error.message);
    }

    return signals;
  }

  private async collectHeliusData(): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    if (!this.heliusApiKey) return signals;

    try {
      // Use Helius webhook data or API to get program deployments
      const response = await axios.post(
        `https://api.helius.xyz/v0/addresses/active-programs`,
        {
          limit: 50,
          time_range: '14d'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.heliusApiKey}`
          }
        }
      );

      // Process Helius response (structure depends on actual API)
      if (response.data && Array.isArray(response.data.programs)) {
        for (const program of response.data.programs) {
          signals.push({
            id: `helius_${program.address}_${Date.now()}`,
            source: 'onchain',
            timestamp: Date.now(),
            content: `New active program detected: ${program.name || program.address}`,
            metadata: {
              url: `https://solscan.io/account/${program.address}`,
              metrics: program.metrics || {}
            },
            keywords: ['new-program', 'helius-detected'],
            weight: 2.0
          });
        }
      }
    } catch (error: any) {
      // Helius API might not be available or configured
      console.log('Helius data collection skipped:', error.message);
    }

    return signals;
  }

  private async detectNewTokens(): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    try {
      // Use Jupiter Token List API for new token detection
      const response = await axios.get('https://token.jup.ag/all');
      const tokens = response.data;

      // Filter for recently added tokens (heuristic: check if they're in trending lists)
      const trendingResponse = await axios.get('https://cache.jup.ag/top-tokens');
      const trendingTokens = trendingResponse.data;

      if (Array.isArray(trendingTokens)) {
        for (const token of trendingTokens.slice(0, 20)) {
          signals.push({
            id: `token_${token.address}_${Date.now()}`,
            source: 'onchain',
            timestamp: Date.now(),
            content: `Trending token: ${token.symbol || 'Unknown'} - ${token.name || ''}`,
            metadata: {
              url: `https://solscan.io/token/${token.address}`,
              metrics: {
                volume: token.volume_24h || 0,
                liquidity: token.liquidity || 0
              }
            },
            keywords: [
              'token-launch',
              'trending',
              (token.symbol || '').toLowerCase()
            ].filter(Boolean),
            weight: 1.5
          });
        }
      }
    } catch (error: any) {
      console.log('Token detection error:', error.message);
    }

    return signals;
  }

  async getRecentSlotActivity(): Promise<number> {
    try {
      const slot = await this.connection.getSlot();
      const blockTime = await this.connection.getBlockTime(slot);
      return blockTime || Date.now() / 1000;
    } catch (error) {
      return Date.now() / 1000;
    }
  }
}
