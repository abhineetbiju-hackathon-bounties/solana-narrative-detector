import type { NextApiRequest, NextApiResponse } from 'next';
import { GitHubCollector } from '../../../src/collectors/github';
import { SolanaOnchainCollector } from '../../../src/collectors/solana-onchain';
import { TwitterCollector } from '../../../src/collectors/twitter';
import { ReportsCollector } from '../../../src/collectors/reports';
import { DiscordCollector } from '../../../src/collectors/discord';
import { SignalDetector } from '../../../src/analysis/signal-detector';
import { NarrativeClusterer } from '../../../src/analysis/narrative-clusterer';
import { IdeaGenerator } from '../../../src/analysis/idea-generator';
import { Signal, CollectorResult, AnalysisResult } from '../../../src/types';
import * as fs from 'fs';
import * as path from 'path';

// Vercel serverless functions have a max duration (Hobby: 10s, Pro: 60s)
// We run collectors with tight timeouts and do everything in-memory
export const config = {
  maxDuration: 60, // seconds (Pro plan), Hobby plan caps at 10s
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify cron secret (Vercel automatically adds this header for cron jobs)
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🔄 Starting automated narrative refresh...');

    // --- Step 1: Collect data from all sources ---
    const results: Record<string, CollectorResult> = {};

    // GitHub
    try {
      const github = new GitHubCollector(process.env.GITHUB_TOKEN);
      results.github = await github.collectRecentSolanaRepos();
      console.log(`GitHub: ${results.github.signals.length} signals`);
    } catch (e: any) {
      console.error(`GitHub failed: ${e.message}`);
      results.github = { signals: [], collectedAt: Date.now(), source: 'github', errors: [e.message] };
    }

    // Onchain
    try {
      const onchain = new SolanaOnchainCollector(
        process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
        process.env.HELIUS_API_KEY
      );
      results.onchain = await onchain.collectOnchainSignals();
      console.log(`Onchain: ${results.onchain.signals.length} signals`);
    } catch (e: any) {
      console.error(`Onchain failed: ${e.message}`);
      results.onchain = { signals: [], collectedAt: Date.now(), source: 'onchain', errors: [e.message] };
    }

    // Twitter
    try {
      const twitter = new TwitterCollector(process.env.TWITTER_BEARER_TOKEN);
      results.twitter = await twitter.collectTwitterSignals();
      console.log(`Twitter: ${results.twitter.signals.length} signals`);
    } catch (e: any) {
      console.error(`Twitter failed: ${e.message}`);
      results.twitter = { signals: [], collectedAt: Date.now(), source: 'twitter', errors: [e.message] };
    }

    // Reports
    try {
      const reports = new ReportsCollector();
      results.reports = await reports.collectReportSignals();
      console.log(`Reports: ${results.reports.signals.length} signals`);
    } catch (e: any) {
      console.error(`Reports failed: ${e.message}`);
      results.reports = { signals: [], collectedAt: Date.now(), source: 'report', errors: [e.message] };
    }

    // Discord/Forums
    try {
      const discord = new DiscordCollector();
      results.discord = await discord.collectDiscordSignals();
      console.log(`Discord: ${results.discord.signals.length} signals`);
    } catch (e: any) {
      console.error(`Discord failed: ${e.message}`);
      results.discord = { signals: [], collectedAt: Date.now(), source: 'discord', errors: [e.message] };
    }

    // --- Step 2: Analyze in-memory ---
    const allSignals: Signal[] = [];
    for (const result of Object.values(results)) {
      allSignals.push(...result.signals);
    }

    console.log(`Total signals: ${allSignals.length}`);

    if (allSignals.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No signals collected — skipping analysis',
        timestamp: new Date().toISOString(),
      });
    }

    // Process signals
    const detector = new SignalDetector();
    const processed = detector.processSignals(allSignals);

    // Cluster into narratives
    const clusterer = new NarrativeClusterer();
    const narratives = clusterer.clusterSignals(processed);

    // Generate ideas
    const ideaGen = new IdeaGenerator();
    for (const n of narratives) {
      n.ideas = ideaGen.generateIdeas(n);
    }

    const timestamps = allSignals.map(s => s.timestamp).filter(t => t > 0);
    const analysisResult: AnalysisResult = {
      narratives,
      analyzedAt: Date.now(),
      dataWindow: {
        start: Math.min(...timestamps),
        end: Math.max(...timestamps),
      },
      stats: {
        totalSignals: allSignals.length,
        sourcesUsed: Object.keys(results),
        narrativesDetected: narratives.length,
      },
    };

    // --- Step 3: Persist results ---
    // Try to write to filesystem (works locally, may fail on Vercel)
    try {
      const processedDir = path.join(process.cwd(), 'data', 'processed');
      if (!fs.existsSync(processedDir)) {
        fs.mkdirSync(processedDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(processedDir, 'narratives.json'),
        JSON.stringify(analysisResult, null, 2)
      );
      console.log('Saved to data/processed/narratives.json');
    } catch (fsErr: any) {
      console.warn(`Could not write to filesystem (expected on Vercel): ${fsErr.message}`);
    }

    console.log(`✅ Refresh complete — ${narratives.length} narratives from ${allSignals.length} signals`);

    res.status(200).json({
      success: true,
      message: `Refreshed: ${narratives.length} narratives from ${allSignals.length} signals`,
      narrativesDetected: narratives.length,
      totalSignals: allSignals.length,
      sourcesUsed: Object.keys(results),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Refresh failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
