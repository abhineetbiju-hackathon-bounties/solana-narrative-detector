import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as fs from 'fs';
import * as path from 'path';
import { GitHubCollector } from '../src/collectors/github';
import { SolanaOnchainCollector } from '../src/collectors/solana-onchain';
import { TwitterCollector } from '../src/collectors/twitter';
import { ReportsCollector } from '../src/collectors/reports';
import { DiscordCollector } from '../src/collectors/discord';
import { CollectorResult } from '../src/types';

async function main() {
  console.log('🚀 Starting data collection...\n');

  const results: Record<string, CollectorResult> = {};
  const dataDir = path.join(__dirname, '..', 'data', 'raw');

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Collect from GitHub
  console.log('📊 Collecting from GitHub...');
  try {
    const githubCollector = new GitHubCollector(process.env.GITHUB_TOKEN);
    results.github = await githubCollector.collectRecentSolanaRepos();
    console.log(`✅ GitHub: ${results.github.signals.length} signals collected`);
    if (results.github.errors) {
      console.log(`⚠️  Errors: ${results.github.errors.join(', ')}`);
    }
  } catch (error: any) {
    console.error(`❌ GitHub collection failed: ${error.message}`);
    results.github = { signals: [], collectedAt: Date.now(), source: 'github', errors: [error.message] };
  }

  // Collect from Solana onchain
  console.log('\n⛓️  Collecting onchain data...');
  try {
    const onchainCollector = new SolanaOnchainCollector(
      process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com',
      process.env.HELIUS_API_KEY
    );
    results.onchain = await onchainCollector.collectOnchainSignals();
    console.log(`✅ Onchain: ${results.onchain.signals.length} signals collected`);
    if (results.onchain.errors) {
      console.log(`⚠️  Errors: ${results.onchain.errors.join(', ')}`);
    }
  } catch (error: any) {
    console.error(`❌ Onchain collection failed: ${error.message}`);
    results.onchain = { signals: [], collectedAt: Date.now(), source: 'onchain', errors: [error.message] };
  }

  // Collect from Twitter/X
  console.log('\n🐦 Collecting from Twitter/X...');
  try {
    const twitterCollector = new TwitterCollector(process.env.TWITTER_BEARER_TOKEN);
    results.twitter = await twitterCollector.collectTwitterSignals();
    console.log(`✅ Twitter: ${results.twitter.signals.length} signals collected`);
    if (results.twitter.errors) {
      console.log(`⚠️  Errors: ${results.twitter.errors.join(', ')}`);
    }
  } catch (error: any) {
    console.error(`❌ Twitter collection failed: ${error.message}`);
    results.twitter = { signals: [], collectedAt: Date.now(), source: 'twitter', errors: [error.message] };
  }

  // Collect from Reports
  console.log('\n📰 Collecting from reports & blogs...');
  try {
    const reportsCollector = new ReportsCollector();
    results.reports = await reportsCollector.collectReportSignals();
    console.log(`✅ Reports: ${results.reports.signals.length} signals collected`);
    if (results.reports.errors) {
      console.log(`⚠️  Errors: ${results.reports.errors.join(', ')}`);
    }
  } catch (error: any) {
    console.error(`❌ Reports collection failed: ${error.message}`);
    results.reports = { signals: [], collectedAt: Date.now(), source: 'report', errors: [error.message] };
  }

  // Collect from Discord/Forums
  console.log('\n💬 Collecting from Discord/forums...');
  try {
    const discordCollector = new DiscordCollector();
    results.discord = await discordCollector.collectDiscordSignals();
    console.log(`✅ Discord/Forums: ${results.discord.signals.length} signals collected`);
    if (results.discord.errors) {
      console.log(`⚠️  Errors: ${results.discord.errors.join(', ')}`);
    }
  } catch (error: any) {
    console.error(`❌ Discord collection failed: ${error.message}`);
    results.discord = { signals: [], collectedAt: Date.now(), source: 'discord', errors: [error.message] };
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = path.join(dataDir, `collection_${timestamp}.json`);

  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved to: ${outputFile}`);

  // Print summary
  const totalSignals = Object.values(results).reduce((sum, r) => sum + r.signals.length, 0);
  console.log(`\n📈 Total signals collected: ${totalSignals}`);
  console.log('✨ Collection complete!\n');

  return results;
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
