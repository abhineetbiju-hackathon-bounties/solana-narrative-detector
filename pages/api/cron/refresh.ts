import type { NextApiRequest, NextApiResponse } from 'next';
import { GitHubCollector } from '../../../src/collectors/github';
import { SolanaOnchainCollector } from '../../../src/collectors/solana-onchain';
import { TwitterCollector } from '../../../src/collectors/twitter';
import { ReportsCollector } from '../../../src/collectors/reports';
import { DiscordCollector } from '../../../src/collectors/discord';
import { SignalDetector } from '../../../src/analysis/signal-detector';
import { NarrativeClusterer } from '../../../src/analysis/narrative-clusterer';
import { IdeaGenerator } from '../../../src/analysis/idea-generator';
import { Signal, CollectorResult } from '../../../src/types';

// Race a promise against a timeout
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Run ALL collectors in parallel with individual 7s timeouts
    // This fits within Vercel Hobby's 10s limit
    const TIMEOUT = 7000;

    const [githubResult, onchainResult, twitterResult, reportsResult, discordResult] =
      await Promise.allSettled([
        withTimeout(
          new GitHubCollector(process.env.GITHUB_TOKEN).collectRecentSolanaRepos(),
          TIMEOUT, 'GitHub'
        ),
        withTimeout(
          new SolanaOnchainCollector(
            process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
            process.env.HELIUS_API_KEY
          ).collectOnchainSignals(),
          TIMEOUT, 'Onchain'
        ),
        withTimeout(
          new TwitterCollector(process.env.TWITTER_BEARER_TOKEN).collectTwitterSignals(),
          TIMEOUT, 'Twitter'
        ),
        withTimeout(
          new ReportsCollector().collectReportSignals(),
          TIMEOUT, 'Reports'
        ),
        withTimeout(
          new DiscordCollector().collectDiscordSignals(),
          TIMEOUT, 'Discord'
        ),
      ]);

    // Collect results, gracefully handling failures
    const results: Record<string, CollectorResult> = {};
    const settled = [
      { key: 'github', result: githubResult },
      { key: 'onchain', result: onchainResult },
      { key: 'twitter', result: twitterResult },
      { key: 'reports', result: reportsResult },
      { key: 'discord', result: discordResult },
    ];

    for (const { key, result } of settled) {
      if (result.status === 'fulfilled') {
        results[key] = result.value;
      } else {
        console.warn(`${key}: ${result.reason?.message || 'failed'}`);
        results[key] = {
          signals: [],
          collectedAt: Date.now(),
          source: key as any,
          errors: [result.reason?.message || 'timeout'],
        };
      }
    }

    // Aggregate signals
    const allSignals: Signal[] = [];
    for (const r of Object.values(results)) {
      allSignals.push(...r.signals);
    }

    // Collect errors for debugging
    const errors = Object.entries(results)
      .filter(([_, r]) => r.errors?.length)
      .map(([k, r]) => `${k}: ${r.errors!.join(', ')}`);

    if (allSignals.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No signals collected — all collectors failed',
        errors,
        timestamp: new Date().toISOString(),
      });
    }

    // Analyze in-memory
    const processed = new SignalDetector().processSignals(allSignals);
    const narratives = new NarrativeClusterer().clusterSignals(processed);
    const ideaGen = new IdeaGenerator();
    for (const n of narratives) {
      n.ideas = ideaGen.generateIdeas(n);
    }

    const timestamps = allSignals.map(s => s.timestamp).filter(t => t > 0);

    res.status(200).json({
      success: true,
      narrativesDetected: narratives.length,
      totalSignals: allSignals.length,
      sourcesUsed: Object.keys(results).filter(k => results[k].signals.length > 0),
      errors: Object.entries(results)
        .filter(([_, r]) => r.errors?.length)
        .map(([k, r]) => `${k}: ${r.errors!.join(', ')}`),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Refresh failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
