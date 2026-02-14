import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as fs from 'fs';
import * as path from 'path';
import { Signal, CollectorResult, AnalysisResult } from '../src/types';
import { SignalDetector, ProcessedSignal } from '../src/analysis/signal-detector';
import { NarrativeClusterer } from '../src/analysis/narrative-clusterer';
import { IdeaGenerator } from '../src/analysis/idea-generator';

async function main() {
  console.log('🧠 Starting narrative analysis...\n');

  const dataDir = path.join(__dirname, '..', 'data', 'raw');
  const processedDir = path.join(__dirname, '..', 'data', 'processed');

  // Ensure processed directory exists
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  // Load and merge ALL collection files for comprehensive analysis
  const files = fs.readdirSync(dataDir).filter(f => f.startsWith('collection_') && !f.includes('_demo_'));
  if (files.length === 0) {
    console.error('❌ No collection data found. Run collect-data.ts first.');
    process.exit(1);
  }

  console.log(`📂 Loading ${files.length} collection file(s)...`);
  const collectionData: Record<string, CollectorResult> = {};

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const fileData: Record<string, CollectorResult> = JSON.parse(
      fs.readFileSync(filePath, 'utf-8')
    );
    console.log(`   ${file}`);

    // Merge signals from each source, deduplicating by signal id
    for (const [source, result] of Object.entries(fileData)) {
      if (!collectionData[source]) {
        collectionData[source] = { signals: [], collectedAt: result.collectedAt, source: result.source };
      }
      const existingIds = new Set(collectionData[source].signals.map(s => s.id));
      for (const signal of result.signals) {
        if (!existingIds.has(signal.id)) {
          collectionData[source].signals.push(signal);
          existingIds.add(signal.id);
        }
      }
    }
  }

  // Aggregate all signals
  const allSignals: Signal[] = [];
  for (const [source, result] of Object.entries(collectionData)) {
    console.log(`  ${source}: ${result.signals.length} signals`);
    allSignals.push(...result.signals);
  }

  console.log(`\n📊 Total signals to analyze: ${allSignals.length}\n`);

  if (allSignals.length === 0) {
    console.error('❌ No signals to analyze.');
    process.exit(1);
  }

  // Step 1: Process signals
  console.log('🔍 Processing signals...');
  const signalDetector = new SignalDetector();
  const processedSignals = signalDetector.processSignals(allSignals);
  console.log(`✅ Processed ${processedSignals.length} signals`);

  // Extract top keywords
  const topKeywords = signalDetector.extractTopKeywords(processedSignals, 30);
  console.log(`\n🔑 Top keywords:`);
  topKeywords.slice(0, 10).forEach((kw, i) => {
    console.log(`  ${i + 1}. ${kw.keyword} (score: ${kw.score.toFixed(2)})`);
  });

  // Detect anomalies
  const anomalies = signalDetector.detectAnomalies(allSignals);
  console.log(`\n⚡ Detected ${anomalies.length} anomalous signals`);

  // Step 2: Cluster into narratives
  console.log('\n🎯 Clustering signals into narratives...');
  const narrativeClusterer = new NarrativeClusterer();
  const narratives = narrativeClusterer.clusterSignals(processedSignals);
  console.log(`✅ Identified ${narratives.length} narratives`);

  // Step 3: Generate product ideas
  console.log('\n💡 Generating product ideas...');
  const ideaGenerator = new IdeaGenerator();

  for (const narrative of narratives) {
    narrative.ideas = ideaGenerator.generateIdeas(narrative);
    console.log(`  "${narrative.title}": ${narrative.ideas.length} ideas generated`);
  }

  // Create analysis result
  const timestamps = allSignals.map(s => s.timestamp).filter(t => t > 0);
  const analysisResult: AnalysisResult = {
    narratives,
    analyzedAt: Date.now(),
    dataWindow: {
      start: Math.min(...timestamps),
      end: Math.max(...timestamps)
    },
    stats: {
      totalSignals: allSignals.length,
      sourcesUsed: Object.keys(collectionData),
      narrativesDetected: narratives.length
    }
  };

  // Save analysis results
  const outputFile = path.join(processedDir, 'narratives.json');
  fs.writeFileSync(outputFile, JSON.stringify(analysisResult, null, 2));
  console.log(`\n💾 Analysis saved to: ${outputFile}`);

  // Print summary
  console.log(`\n\n═══════════════════════════════════════════`);
  console.log(`📈 NARRATIVE DETECTION SUMMARY`);
  console.log(`═══════════════════════════════════════════\n`);

  narratives.forEach((narrative, i) => {
    console.log(`${i + 1}. ${narrative.title}`);
    console.log(`   Score: ${narrative.score.toFixed(2)} | Signals: ${narrative.signals.length} | Sources: ${narrative.metrics.crossSourceCount}`);
    console.log(`   ${narrative.description.substring(0, 150)}...`);
    console.log(`\n   💡 Product Ideas:`);
    narrative.ideas.forEach((idea, j) => {
      console.log(`      ${j + 1}. ${idea.title} [${idea.difficulty}, ${idea.impact} impact]`);
    });
    console.log('');
  });

  console.log(`═══════════════════════════════════════════`);
  console.log('✨ Analysis complete!\n');

  return analysisResult;
}

main().catch(console.error);
