import { Signal, Narrative } from '../types';
import { ProcessedSignal } from './signal-detector';

interface KeywordCluster {
  keywords: Set<string>;
  signals: ProcessedSignal[];
  centroid: string[];
}

// Canonical keyword mappings to normalize across sources
const KEYWORD_ALIASES: Record<string, string> = {
  'dexes': 'dex',
  'amm': 'dex',
  'swap': 'dex',
  'trading': 'dex',
  'perps': 'derivatives',
  'perpetuals': 'derivatives',
  'perp': 'derivatives',
  'lending': 'lending',
  'borrowing': 'lending',
  'liquid-staking': 'liquid-staking',
  'lst': 'liquid-staking',
  'staking': 'staking',
  'validator': 'staking',
  'nft': 'nft',
  'nfts': 'nft',
  'compressed-nfts': 'compressed-nft',
  'state-compression': 'compressed-nft',
  'zk-compression': 'compressed-nft',
  'token-extensions': 'token-extensions',
  'token-2022': 'token-extensions',
  'ai': 'ai',
  'artificial-intelligence': 'ai',
  'agents': 'ai-agents',
  'ai-agents': 'ai-agents',
  'depin': 'depin',
  'iot': 'depin',
  'bridge': 'cross-chain',
  'cross-chain': 'cross-chain',
  'interoperability': 'cross-chain',
  'rwa': 'rwa',
  'real-world-assets': 'rwa',
  'tokenization': 'rwa',
  'oracle': 'oracle',
  'oracles': 'oracle',
  'payments': 'payments',
  'stablecoin': 'payments',
  'usdc': 'payments',
  'mobile': 'mobile',
  'saga': 'mobile',
  'gaming': 'gaming',
  'game': 'gaming',
  'prediction': 'prediction-market',
  'betting': 'prediction-market',
  'yield': 'yield',
  'farming': 'yield',
  'apy': 'yield',
  'cdp': 'stablecoin',
  'mev': 'mev',
  'high-tvl': 'high-tvl',
  'growth': 'growth',
  'trending': 'trending',
};

// Known Solana ecosystem terms that are important for matching
const ECOSYSTEM_TERMS = new Set([
  'jupiter', 'jito', 'marinade', 'drift', 'kamino', 'tensor', 'raydium',
  'orca', 'meteora', 'phoenix', 'marginfi', 'sanctum', 'pyth', 'wormhole',
  'helius', 'metaplex', 'helium', 'render', 'nosana', 'hivemapper',
  'phantom', 'backpack', 'magic-eden', 'solana', 'anchor', 'firedancer',
  'bonk', 'jup', 'sol', 'defi', 'nft', 'dex', 'lending', 'staking',
  'liquid-staking', 'derivatives', 'oracle', 'payments', 'depin', 'ai',
  'ai-agents', 'mev', 'rwa', 'gaming', 'mobile', 'compressed-nft',
  'token-extensions', 'cross-chain', 'yield', 'prediction-market',
]);

export class NarrativeClusterer {
  private minClusterSize = 3;
  private similarityThreshold = 0.25;
  private maxNarratives = 10;

  clusterSignals(signals: ProcessedSignal[]): Narrative[] {
    if (signals.length < this.minClusterSize) return [];

    // Normalize keywords across all signals first
    const normalizedSignals = signals.map(s => ({
      ...s,
      keywords: this.normalizeKeywords(s.keywords),
    }));

    // Build keyword clusters using similarity
    const clusters = this.buildClusters(normalizedSignals);

    // Convert clusters to narratives
    let narratives = clusters
      .filter(cluster => cluster.signals.length >= this.minClusterSize)
      .map(cluster => this.clusterToNarrative(cluster))
      .sort((a, b) => b.score - a.score);

    // Deduplicate narratives with similar titles
    narratives = this.deduplicateNarratives(narratives);

    // Prioritize multi-source narratives and cap output
    narratives = this.rankAndCap(narratives);

    return narratives;
  }

  private isNoisyKeyword(kw: string): boolean {
    // Filter out usernames, short words, numbers-only, and generic terms
    if (kw.length <= 2) return true;
    if (/^\d+$/.test(kw)) return true;
    if (/^[a-z]+\d{3,}$/i.test(kw)) return true; // username patterns like "james09777"
    if (/^\d+[a-z]+$/i.test(kw)) return true; // "123abc" patterns

    const noisy = new Set([
      'behind', 'worth', 'money', 'benefits', 'getting', 'looking',
      'thinking', 'question', 'discussion', 'help', 'need', 'want',
      'anyone', 'someone', 'best', 'good', 'great', 'like', 'really',
      'currently', 'right', 'people', 'make', 'start', 'started',
      'coming', 'going', 'taking', 'working', 'trying', 'actually',
      'still', 'much', 'many', 'should', 'would', 'could', 'will',
      'phone', 'post', 'update', 'week', 'month', 'year', 'today',
      'yesterday', 'introducing-orb', 'new-block-explorer', 'jump',
      'shares', 'firm', 'company', 'price', 'prices', 'market',
      'says', 'report', 'blog', 'article', 'read', 'check',
    ]);
    return noisy.has(kw);
  }

  private normalizeKeywords(keywords: string[]): string[] {
    const normalized = new Set<string>();

    for (const kw of keywords) {
      const lower = kw.toLowerCase().trim();

      if (this.isNoisyKeyword(lower)) continue;

      // Apply alias normalization
      const alias = KEYWORD_ALIASES[lower];
      if (alias) {
        normalized.add(alias);
      }

      // Always keep the original keyword too (if it's useful)
      if (ECOSYSTEM_TERMS.has(lower) || lower.length > 3) {
        normalized.add(lower);
      }
    }

    return Array.from(normalized);
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

    // Use weighted similarity: ecosystem terms count more
    let weightedIntersection = 0;
    let weightedUnion = 0;

    const allKeywords = new Set([...Array.from(signalKeywords), ...Array.from(cluster.keywords)]);

    for (const kw of allKeywords) {
      const weight = ECOSYSTEM_TERMS.has(kw) ? 2.0 : 1.0;
      const inSignal = signalKeywords.has(kw);
      const inCluster = cluster.keywords.has(kw);

      if (inSignal && inCluster) {
        weightedIntersection += weight;
      }
      weightedUnion += weight;
    }

    if (weightedUnion === 0) return 0;
    return weightedIntersection / weightedUnion;
  }

  private updateCentroid(cluster: KeywordCluster): string[] {
    const keywordFreq = new Map<string, number>();

    cluster.signals.forEach(signal => {
      signal.keywords.forEach(kw => {
        // Give extra weight to ecosystem terms in centroid
        const weight = ECOSYSTEM_TERMS.has(kw) ? 2 : 1;
        keywordFreq.set(kw, (keywordFreq.get(kw) || 0) + weight);
      });
    });

    return Array.from(keywordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([kw]) => kw);
  }

  private deduplicateNarratives(narratives: Narrative[]): Narrative[] {
    const result: Narrative[] = [];
    const seenThemes = new Set<string>();

    for (const narrative of narratives) {
      // Normalize title for comparison - deduplicate by theme prefix too
      const normalizedTitle = narrative.title.toLowerCase().replace(/[^a-z]+/g, ' ').trim();
      const themePrefix = narrative.title.split(':')[0].toLowerCase().trim();

      // Allow max 2 narratives per theme category
      const themeCount = result.filter(n =>
        n.title.split(':')[0].toLowerCase().trim() === themePrefix
      ).length;

      if (!seenThemes.has(normalizedTitle) && themeCount < 2) {
        seenThemes.add(normalizedTitle);
        result.push(narrative);
      }
    }

    return result;
  }

  private rankAndCap(narratives: Narrative[]): Narrative[] {
    // Boost narratives with multiple sources, penalize single-source
    return narratives
      .map(n => ({
        ...n,
        score: n.metrics.crossSourceCount >= 2
          ? n.score * 1.0
          : n.score * 0.4  // Heavy penalty for single-source narratives
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, this.maxNarratives);
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
      'DeFi': ['defi', 'dex', 'amm', 'lending', 'liquidity', 'yield', 'swap', 'derivatives', 'perps', 'trading'],
      'Liquid Staking': ['liquid-staking', 'lst', 'marinade', 'jito', 'sanctum'],
      'NFTs': ['nft', 'collection', 'mint', 'marketplace', 'compressed-nft', 'metadata', 'compressed', 'tensor', 'magic-eden'],
      'Gaming': ['gaming', 'game', 'play-to-earn', 'web3-game', 'metaverse'],
      'Infrastructure': ['validator', 'rpc', 'infrastructure', 'node', 'firedancer', 'network', 'tps'],
      'Payments': ['payments', 'stablecoin', 'usdc', 'transfer', 'merchant'],
      'Mobile': ['mobile', 'saga', 'dapp-store', 'smartphone'],
      'DePIN': ['depin', 'iot', 'physical', 'helium', 'hivemapper', 'nosana', 'render'],
      'AI & Agents': ['ai', 'ai-agents', 'artificial-intelligence', 'ml', 'model', 'inference', 'agents'],
      'Developer Tools': ['sdk', 'api', 'framework', 'tools', 'library', 'anchor', 'program'],
      'Token Extensions': ['token-extensions', 'token-2022', 'transfer-hook', 'metadata-pointer'],
      'MEV': ['mev', 'jito', 'searcher', 'bundle'],
      'Cross-Chain': ['cross-chain', 'bridge', 'wormhole', 'interoperability'],
      'RWA': ['rwa', 'real-world-assets', 'tokenization'],
      'Oracles': ['oracle', 'pyth', 'price-feed', 'data-feed'],
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
    // Filter out generic/noisy keywords and anything that looks like a username
    const genericWords = new Set([
      'solana', 'https', 'http', 'com', 'org', 'www', 'github', 'git',
      'rust', 'typescript', 'javascript', 'python', 'program', 'programs',
      'build', 'built', 'code', 'source', 'open', 'new', 'use', 'using',
      'api', 'sdk', 'lib', 'library', 'tool', 'tools', 'test', 'tests',
      'repo', 'project', 'example', 'examples', 'explorer', 'html', 'json',
      'defi', 'dex', 'nft', 'sol', 'active', 'high-volume', 'onchain-activity',
      'growth', 'trending', 'high-tvl', 'network', 'stake', 'staking',
      'lending', 'liquid-staking', 'ai', 'ai-agents', 'oracle', 'payments',
      'derivatives', 'cross-chain', 'yield', 'compressed-nft', 'token-extensions',
      'mev', 'rwa', 'gaming', 'mobile', 'depin', 'prediction-market',
    ]);

    const themeWords = theme.toLowerCase().split(/[\s/&]+/);

    // Find a meaningful ecosystem term as the distinct keyword
    const distinctKeyword = keywords.find(kw => {
      const lower = kw.toLowerCase();
      if (genericWords.has(lower)) return false;
      if (themeWords.some(tw => lower.includes(tw) || tw.includes(lower))) return false;
      if (this.isNoisyKeyword(lower)) return false;
      // Must be a recognizable ecosystem term or protocol name
      return ECOSYSTEM_TERMS.has(lower) || lower.includes('-') && lower.length > 5;
    }) || keywords.find(kw => ECOSYSTEM_TERMS.has(kw.toLowerCase()))
      || keywords[0] || 'Ecosystem';

    const formatted = distinctKeyword.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');

    // Vary the suffix based on narrative metrics
    const suffixes = ['Growth', 'Momentum', 'Surge', 'Wave', 'Expansion', 'Rise'];
    const suffixIndex = Math.abs(formatted.charCodeAt(0)) % suffixes.length;

    return `${theme}: ${formatted} ${suffixes[suffixIndex]}`;
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
      'Liquid Staking': 'Growing adoption of liquid staking tokens and validator economics on Solana.',
      'NFTs': 'Activity in digital collectibles, compressed NFTs, or new marketplace features.',
      'Gaming': 'New web3 games or gaming infrastructure launching on Solana.',
      'Infrastructure': 'Improvements to Solana\'s core infrastructure and validator ecosystem.',
      'Payments': 'Development in payment rails, stablecoin integration, or merchant adoption.',
      'Mobile': 'Mobile-first dApps and Saga phone ecosystem growth.',
      'DePIN': 'Physical infrastructure networks being tokenized on Solana.',
      'AI & Agents': 'AI model hosting, inference, autonomous agents, or data marketplaces on Solana.',
      'Developer Tools': 'New frameworks, SDKs, or tools making Solana development easier.',
      'Token Extensions': 'Adoption of Token-2022 program and its advanced features.',
      'MEV': 'Maximal extractable value infrastructure and Jito ecosystem developments.',
      'Cross-Chain': 'Bridges and interoperability solutions connecting Solana to other chains.',
      'RWA': 'Real-world asset tokenization and on-chain representation.',
      'Oracles': 'Price feed and data oracle infrastructure developments.',
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
      metrics.crossSourceCount * 20 +
      metrics.velocity * 15 +
      metrics.recency * 20 +
      metrics.keyVoiceMentions * 5 +
      Math.min(metrics.signalCount / 2, 15)
    );
  }
}
