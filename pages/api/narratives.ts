import type { NextApiRequest, NextApiResponse } from 'next';
import * as fs from 'fs';
import * as path from 'path';
import { AnalysisResult } from '../../src/types';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<AnalysisResult | { error: string }>
) {
  try {
    const narrativesPath = path.join(process.cwd(), 'data', 'processed', 'narratives.json');
    
    if (!fs.existsSync(narrativesPath)) {
      // Return sample data if no real data exists yet
      return res.status(200).json(getSampleData());
    }
    
    const data = fs.readFileSync(narrativesPath, 'utf-8');
    const analysisResult: AnalysisResult = JSON.parse(data);
    
    res.status(200).json(analysisResult);
  } catch (error: any) {
    console.error('Error loading narratives:', error);
    res.status(500).json({ error: error.message });
  }
}

function getSampleData(): AnalysisResult {
  return {
    narratives: [
      {
        id: 'sample_1',
        title: 'DeFi: Jupiter Aggregator Innovation',
        description: 'Detected 15 signals across 3 sources indicating emerging activity in DeFi. Key themes include: dex, amm, swap, liquidity, jupiter. This represents new financial primitives and protocols being built on Solana.',
        signals: [],
        keywords: ['dex', 'amm', 'swap', 'liquidity', 'jupiter', 'aggregator', 'trading'],
        score: 67.5,
        metrics: {
          crossSourceCount: 3,
          velocity: 2.1,
          recency: 0.9,
          keyVoiceMentions: 2
        },
        timestamp: Date.now(),
        ideas: [
          {
            title: 'Developer SDK for DEX Aggregation',
            description: 'Build a comprehensive TypeScript/Rust SDK that simplifies integration with DEX aggregation protocols. Include code examples, CLI tools, and testing utilities.',
            reasoning: 'With 15 signals showing development activity, there\'s clear demand for tooling. Developers need easier ways to build on this narrative.',
            targetAudience: 'Solana developers building dApps',
            difficulty: 'Medium',
            impact: 'High'
          },
          {
            title: 'Simplified DeFi Aggregator',
            description: 'User-friendly mobile app that aggregates best rates across Jupiter, Raydium, and Orca protocols. One-tap optimal routing.',
            reasoning: 'High velocity (2.1x) shows rapid innovation, but complexity is increasing. Users need simplification.',
            targetAudience: 'Crypto newcomers and mobile-first users',
            difficulty: 'Medium',
            impact: 'High'
          },
          {
            title: 'DeFi Analytics Dashboard',
            description: 'Real-time dashboard aggregating all DeFi activity on Solana. Track metrics, compare protocols, and identify trends before they go mainstream.',
            reasoning: 'Cross-source signals (3 sources) indicate fragmented information. Users need a single place to monitor this space.',
            targetAudience: 'Traders, researchers, and power users',
            difficulty: 'Medium',
            impact: 'Medium'
          }
        ]
      }
    ],
    analyzedAt: Date.now(),
    dataWindow: {
      start: Date.now() - 14 * 24 * 60 * 60 * 1000,
      end: Date.now()
    },
    stats: {
      totalSignals: 15,
      sourcesUsed: ['github', 'onchain', 'twitter'],
      narrativesDetected: 1
    }
  };
}
