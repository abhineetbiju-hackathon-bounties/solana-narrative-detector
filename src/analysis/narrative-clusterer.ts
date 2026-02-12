import { Signal, Narrative } from '../types';
import { ProcessedSignal } from './signal-detector';

interface KeywordCluster {
  keywords: Set<string>;
  signals: ProcessedSignal[];
  centroid: string[];
}

export class NarrativeClusterer {
  private minClusterSize = 3;
  private similarityThreshold = 0.25;

  clusterSignals(signals: ProcessedSignal[]): Narrative[] {
    if (signals.length < this.minClusterSize) return [];

    // Build keyword clusters using similarity
    const clusters = this.buildClusters(signals);
    
    // Convert clusters to narratives
    const narratives = clusters
      .filter(cluster => cluster.signals.length >= this.minClusterSize)
      .map(cluster => this.clusterToNarrative(cluster))
      .sort((a, b) => b.score - a.score);

    return narratives;
  }

  private buildClusters(signals: ProcessedSignal[]): KeywordCluster[] {
    const clusters: KeywordCluster[] = [];
    const assigned = new Set<string>();

    // Sort signals by total score
    const sortedSignals = [...signals].sort((a, b) => {
      const scoreA = a.normalizedWeight + a.recencyScore + a.crossSourceScore;
      const scoreB = b.normalizedWeight + b.recencyScore + b.crossSourceScore;
      return scoreB - scoreA;
    });

    for (const signal of sortedSignals) {
      if (assigned.has(signal.id)) continue;

      // Find best matching cluster or create new one
      let bestCluster: KeywordCluster | null = null;
      let bestSimilarity = 0;

      for (const cluster of clusters) {
        const similarity = this.calculateSimilarity(signal, cluster);
        if (similarity > bestSimilarity && similarity >= this.similarityThreshold) {
          bestSimilarity = similarity;
          bestCluster = cluster;
        }
      }

      if (bestCluster) {
        // Add to existing cluster
        bestCluster.signals.push(signal);
        signal.keywords.forEach(kw => bestCluster.keywords.add(kw));
        bestCluster.centroid = this.updateCentroid(bestCluster);
      } else {
        // Create new cluster
        clusters.push({
          keywords: new Set(signal.keywords),
          signals: [signal],
          centroid: signal.keywords
        });
      }

      assigned.add(signal.id);
    }

    return clusters;
  }

  private calculateSimilarity(signal: ProcessedSignal, cluster: KeywordCluster): number {
    const signalKeywords = new Set(signal.keywords);
    const intersection = new Set(
      Array.from(signalKeywords).filter(kw => cluster.keywords.has(kw))
    );

    if (signalKeywords.size === 0 || cluster.keywords.size === 0) return 0;

    // Jaccard similarity
    const union = new Set([...Array.from(signalKeywords), ...Array.from(cluster.keywords)]);
    return intersection.size / union.size;
  }

  private updateCentroid(cluster: KeywordCluster): string[] {
    const keywordFreq = new Map<string, number>();
    
    cluster.signals.forEach(signal => {
      signal.keywords.forEach(kw => {
        keywordFreq.set(kw, (keywordFreq.get(kw) || 0) + 1);
      });
    });

    return Array.from(keywordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([kw]) => kw);
  }

  private clusterToNarrative(cluster: KeywordCluster): Narrative {
    const signals = cluster.signals;
    const keywords = Array.from(cluster.keywords);
    
    // Generate narrative title and description
    const { title, description } = this.generateNarrativeText(cluster);
    
    // Calculate metrics
    const sources = new Set(signals.map(s => s.source));
    const crossSourceCount = sources.size;
    
    const velocity = this.calculateClusterVelocity(signals);
    const recency = this.calculateClusterRecency(signals);
    const keyVoiceMentions = signals.filter(s => s.source === 'twitter' && s.weight >= 2.5).length;
    
    // Calculate overall score
    const score = this.calculateNarrativeScore({
      crossSourceCount,
      velocity,
      recency,
      keyVoiceMentions,
      signalCount: signals.length
    });

    return {
      id: `narrative_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title,
      description,
      signals,
      keywords: keywords.slice(0, 15),
      score,
      metrics: {
        crossSourceCount,
        velocity,
        recency,
        keyVoiceMentions
      },
      timestamp: Date.now(),
      ideas: [] // Will be filled by idea generator
    };
  }

  private generateNarrativeText(cluster: KeywordCluster): { title: string; description: string } {
    const topKeywords = cluster.centroid.slice(0, 5);
    const signals = cluster.signals;
    
    // Identify the main theme
    const theme = this.identifyTheme(topKeywords);
    
    // Count sources
    const sources = new Set(signals.map(s => s.source));
    const sourceList = Array.from(sources);
    
    // Build title
    const title = this.formatTitle(theme, topKeywords);
    
    // Build description
    const description = this.buildDescription(theme, topKeywords, signals, sourceList);
    
    return { title, description };
  }

  private identifyTheme(keywords: string[]): string {
    const themes = {
      'DeFi': ['defi', 'dex', 'amm', 'lending', 'liquidity', 'yield', 'swap'],
      'NFTs': ['nft', 'collection', 'mint', 'marketplace', 'compressed', 'metadata'],
      'Gaming': ['gaming', 'game', 'play-to-earn', 'web3-game', 'metaverse'],
      'Infrastructure': ['validator', 'rpc', 'infrastructure', 'node', 'firedancer'],
      'Payments': ['payments', 'stablecoin', 'usdc', 'transfer', 'merchant'],
      'Mobile': ['mobile', 'saga', 'dapp-store', 'smartphone'],
      'DePIN': ['depin', 'iot', 'physical', 'network', 'sensors'],
      'AI': ['ai', 'artificial-intelligence', 'ml', 'model', 'inference'],
      'Developer Tools': ['sdk', 'api', 'framework', 'tools', 'library', 'anchor'],
      'Token Extensions': ['token-extensions', 'token-2022', 'transfer-hook', 'metadata-pointer']
    };

    let bestTheme = 'Emerging Technology';
    let bestScore = 0;

    for (const [theme, terms] of Object.entries(themes)) {
      const score = keywords.filter(kw => 
        terms.some(term => kw.includes(term) || term.includes(kw))
      ).length;
      
      if (score > bestScore) {
        bestScore = score;
        bestTheme = theme;
      }
    }

    return bestTheme;
  }

  private formatTitle(theme: string, keywords: string[]): string {
    // Create a readable title from theme and top keywords
    const mainKeyword = keywords[0] || 'technology';
    const formatted = mainKeyword.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    return `${theme}: ${formatted} Innovation`;
  }

  private buildDescription(theme: string, keywords: string[], signals: Signal[], sources: string[]): string {
    const signalCount = signals.length;
    const sourceText = sources.length > 1 
      ? `${sources.length} different sources (${sources.join(', ')})` 
      : sources[0];
    
    const keywordList = keywords.slice(0, 5).join(', ');
    
    return `Detected ${signalCount} signals across ${sourceText} indicating emerging activity in ${theme.toLowerCase()}. ` +
           `Key themes include: ${keywordList}. ` +
           this.getThemeContext(theme);
  }

  private getThemeContext(theme: string): string {
    const contexts: Record<string, string> = {
      'DeFi': 'This represents new financial primitives and protocols being built on Solana.',
      'NFTs': 'Activity in digital collectibles, compressed NFTs, or new marketplace features.',
      'Gaming': 'New web3 games or gaming infrastructure launching on Solana.',
      'Infrastructure': 'Improvements to Solana\'s core infrastructure and validator ecosystem.',
      'Payments': 'Development in payment rails, stablecoin integration, or merchant adoption.',
      'Mobile': 'Mobile-first dApps and Saga phone ecosystem growth.',
      'DePIN': 'Physical infrastructure networks being tokenized on Solana.',
      'AI': 'AI model hosting, inference, or data marketplaces on Solana.',
      'Developer Tools': 'New frameworks, SDKs, or tools making Solana development easier.',
      'Token Extensions': 'Adoption of Token-2022 program and its advanced features.'
    };

    return contexts[theme] || 'This represents an emerging trend in the Solana ecosystem.';
  }

  private calculateClusterVelocity(signals: Signal[]): number {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    
    const recentCount = signals.filter(s => now - s.timestamp < weekMs).length;
    const olderCount = signals.filter(s => 
      s.timestamp < now - weekMs && 
      s.timestamp > now - 2 * weekMs
    ).length;

    if (olderCount === 0) return recentCount > 0 ? 2.0 : 1.0;
    return recentCount / olderCount;
  }

  private calculateClusterRecency(signals: Signal[]): number {
    const avgTimestamp = signals.reduce((sum, s) => sum + s.timestamp, 0) / signals.length;
    const ageInDays = (Date.now() - avgTimestamp) / (1000 * 60 * 60 * 24);
    return Math.exp(-ageInDays / 10);
  }

  private calculateNarrativeScore(metrics: {
    crossSourceCount: number;
    velocity: number;
    recency: number;
    keyVoiceMentions: number;
    signalCount: number;
  }): number {
    return (
      metrics.crossSourceCount * 10 +
      metrics.velocity * 15 +
      metrics.recency * 20 +
      metrics.keyVoiceMentions * 5 +
      Math.min(metrics.signalCount / 2, 10)
    );
  }
}
