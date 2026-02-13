import { Signal } from '../types';

export interface ProcessedSignal extends Signal {
  normalizedWeight: number;
  recencyScore: number;
  crossSourceScore: number;
}

export class SignalDetector {
  private static STOP_KEYWORDS = new Set([
    'https', 'http', 'www', 'com', 'org', 'dev', 'html', 'json', 'api',
    'github', 'git', 'readme', 'license', 'master', 'main',
    'rust', 'typescript', 'javascript', 'python', 'java', 'cpp',
    'solana', 'program', 'programs', 'repo', 'repository',
    'code', 'build', 'built', 'source', 'open', 'new', 'use', 'using',
    'project', 'lib', 'library', 'example', 'examples', 'test', 'tests',
    'the', 'and', 'for', 'with', 'this', 'that', 'from', 'are', 'was',
    'into', 'about', 'based', 'also', 'just', 'only', 'more', 'some',
    'implementation', 'tool', 'tools', 'app', 'application',
  ]);

  private cleanKeywords(signals: Signal[]): Signal[] {
    return signals.map(signal => ({
      ...signal,
      keywords: signal.keywords.filter(kw => !SignalDetector.STOP_KEYWORDS.has(kw.toLowerCase()))
    }));
  }

  processSignals(signals: Signal[]): ProcessedSignal[] {
    if (signals.length === 0) return [];

    // Clean noisy keywords before processing
    signals = this.cleanKeywords(signals);

    // Calculate cross-source presence
    const keywordSourceMap = this.buildKeywordSourceMap(signals);
    
    // Process each signal
    const processed = signals.map(signal => {
      const recencyScore = this.calculateRecencyScore(signal.timestamp);
      const crossSourceScore = this.calculateCrossSourceScore(signal.keywords, keywordSourceMap);
      const normalizedWeight = this.normalizeWeight(signal.weight, signals);
      
      return {
        ...signal,
        normalizedWeight,
        recencyScore,
        crossSourceScore
      };
    });

    // Sort by combined score
    return processed.sort((a, b) => {
      const scoreA = this.calculateTotalScore(a);
      const scoreB = this.calculateTotalScore(b);
      return scoreB - scoreA;
    });
  }

  detectAnomalies(signals: Signal[]): Signal[] {
    // Detect sudden spikes in specific keywords or sources
    const keywordFrequency = new Map<string, number>();
    
    signals.forEach(signal => {
      signal.keywords.forEach(keyword => {
        keywordFrequency.set(keyword, (keywordFrequency.get(keyword) || 0) + 1);
      });
    });

    // Find keywords appearing much more than average
    const frequencies = Array.from(keywordFrequency.values());
    const avgFrequency = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
    const stdDev = Math.sqrt(
      frequencies.reduce((sum, f) => sum + Math.pow(f - avgFrequency, 2), 0) / frequencies.length
    );

    const anomalyKeywords = new Set<string>();
    keywordFrequency.forEach((freq, keyword) => {
      if (freq > avgFrequency + 2 * stdDev) {
        anomalyKeywords.add(keyword);
      }
    });

    // Return signals containing anomaly keywords
    return signals.filter(signal =>
      signal.keywords.some(kw => anomalyKeywords.has(kw))
    );
  }

  calculateVelocity(signals: Signal[], keyword: string, windowDays: number = 7): number {
    const now = Date.now();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    
    const recentSignals = signals.filter(s =>
      s.keywords.includes(keyword) &&
      now - s.timestamp < windowMs
    );

    const olderSignals = signals.filter(s =>
      s.keywords.includes(keyword) &&
      s.timestamp < now - windowMs &&
      s.timestamp > now - 2 * windowMs
    );

    const recentCount = recentSignals.length;
    const olderCount = olderSignals.length;

    if (olderCount === 0) return recentCount > 0 ? 2.0 : 0;
    
    return recentCount / olderCount;
  }

  private buildKeywordSourceMap(signals: Signal[]): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    
    signals.forEach(signal => {
      signal.keywords.forEach(keyword => {
        if (!map.has(keyword)) {
          map.set(keyword, new Set());
        }
        map.get(keyword)!.add(signal.source);
      });
    });
    
    return map;
  }

  private calculateRecencyScore(timestamp: number): number {
    const ageInDays = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
    
    // Exponential decay with half-life of 7 days
    return Math.exp(-ageInDays / 7);
  }

  private calculateCrossSourceScore(keywords: string[], sourceMap: Map<string, Set<string>>): number {
    let totalSources = 0;
    let keywordCount = 0;
    
    keywords.forEach(keyword => {
      const sources = sourceMap.get(keyword);
      if (sources) {
        totalSources += sources.size;
        keywordCount++;
      }
    });
    
    return keywordCount > 0 ? totalSources / keywordCount : 0;
  }

  private normalizeWeight(weight: number, allSignals: Signal[]): number {
    const weights = allSignals.map(s => s.weight);
    const maxWeight = Math.max(...weights);
    const minWeight = Math.min(...weights);
    
    if (maxWeight === minWeight) return 0.5;
    
    return (weight - minWeight) / (maxWeight - minWeight);
  }

  private calculateTotalScore(signal: ProcessedSignal): number {
    return (
      signal.normalizedWeight * 0.3 +
      signal.recencyScore * 0.4 +
      signal.crossSourceScore * 0.3
    );
  }

  extractTopKeywords(signals: Signal[], topN: number = 30): Array<{ keyword: string; score: number }> {
    const keywordScores = new Map<string, number>();
    
    signals.forEach(signal => {
      const processed = signal as ProcessedSignal;
      const signalScore = this.calculateTotalScore(processed);
      
      signal.keywords.forEach(keyword => {
        keywordScores.set(
          keyword,
          (keywordScores.get(keyword) || 0) + signalScore
        );
      });
    });

    return Array.from(keywordScores.entries())
      .map(([keyword, score]) => ({ keyword, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }
}
