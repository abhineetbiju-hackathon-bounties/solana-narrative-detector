import axios from 'axios';
import { Signal, CollectorResult } from '../types';

interface GitHubRepo {
  full_name: string;
  description: string;
  stargazers_count: number;
  created_at: string;
  updated_at: string;
  html_url: string;
  topics: string[];
  language: string;
}

interface GitHubSearchResponse {
  items: GitHubRepo[];
  total_count: number;
}

export class GitHubCollector {
  private apiKey: string | undefined;
  private baseUrl = 'https://api.github.com';

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  private getHeaders() {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SolanaNarrativeDetector/1.0'
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `token ${this.apiKey}`;
    }
    
    return headers;
  }

  async collectRecentSolanaRepos(): Promise<CollectorResult> {
    const signals: Signal[] = [];
    const errors: string[] = [];
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const dateStr = twoWeeksAgo.toISOString().split('T')[0];

    try {
      // Search for recently created/updated Solana repos
      const queries = [
        `solana created:>${dateStr}`,
        `solana-program created:>${dateStr}`,
        `anchor-lang created:>${dateStr}`,
        `solana topic:solana pushed:>${dateStr} stars:>10`
      ];

      for (const query of queries) {
        try {
          const response = await axios.get<GitHubSearchResponse>(
            `${this.baseUrl}/search/repositories`,
            {
              headers: this.getHeaders(),
              params: {
                q: query,
                sort: 'stars',
                order: 'desc',
                per_page: 30
              }
            }
          );

          for (const repo of response.data.items) {
            const keywords = this.extractKeywords(repo);
            const signal: Signal = {
              id: `github_${repo.full_name}_${Date.now()}`,
              source: 'github',
              timestamp: new Date(repo.created_at).getTime(),
              content: `${repo.full_name}: ${repo.description || 'No description'}`,
              metadata: {
                url: repo.html_url,
                author: repo.full_name.split('/')[0],
                metrics: {
                  stars: repo.stargazers_count,
                  age_days: Math.floor((Date.now() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24))
                },
                tags: repo.topics
              },
              keywords,
              weight: this.calculateWeight(repo)
            };
            signals.push(signal);
          }

          // Rate limiting - wait between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err: any) {
          errors.push(`Query "${query}" failed: ${err.message}`);
        }
      }

      // Get trending Solana repos by star growth
      try {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const trendingResponse = await axios.get<GitHubSearchResponse>(
          `${this.baseUrl}/search/repositories`,
          {
            headers: this.getHeaders(),
            params: {
              q: `solana stars:>50 pushed:>${weekAgo}`,
              sort: 'updated',
              order: 'desc',
              per_page: 20
            }
          }
        );

        for (const repo of trendingResponse.data.items) {
          const keywords = this.extractKeywords(repo);
          const signal: Signal = {
            id: `github_trending_${repo.full_name}_${Date.now()}`,
            source: 'github',
            timestamp: new Date(repo.updated_at).getTime(),
            content: `Trending: ${repo.full_name} - ${repo.description || ''}`,
            metadata: {
              url: repo.html_url,
              author: repo.full_name.split('/')[0],
              metrics: {
                stars: repo.stargazers_count
              },
              tags: repo.topics
            },
            keywords,
            weight: this.calculateWeight(repo) * 1.5 // Boost trending repos
          };
          signals.push(signal);
        }
      } catch (err: any) {
        errors.push(`Trending repos failed: ${err.message}`);
      }

    } catch (error: any) {
      errors.push(`GitHub collection failed: ${error.message}`);
    }

    return {
      signals: this.deduplicateSignals(signals),
      collectedAt: Date.now(),
      source: 'github',
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private extractKeywords(repo: GitHubRepo): string[] {
    const keywords: Set<string> = new Set();
    
    // Add topics
    repo.topics.forEach(topic => keywords.add(topic.toLowerCase()));
    
    // Extract from description
    if (repo.description) {
      const words = repo.description
        .toLowerCase()
        .match(/\b[a-z]{3,}\b/g) || [];
      
      const relevantWords = words.filter(word => 
        !['the', 'and', 'for', 'with', 'this', 'that'].includes(word)
      );
      
      relevantWords.forEach(word => keywords.add(word));
    }
    
    // Add language
    if (repo.language) {
      keywords.add(repo.language.toLowerCase());
    }
    
    // Extract from repo name
    const nameParts = repo.full_name.toLowerCase().split(/[-_/]/);
    nameParts.forEach(part => {
      if (part.length > 2 && part !== 'solana') {
        keywords.add(part);
      }
    });
    
    return Array.from(keywords).slice(0, 15);
  }

  private calculateWeight(repo: GitHubRepo): number {
    let weight = 1.0;
    
    // Star-based weight
    if (repo.stargazers_count > 100) weight += 1.0;
    if (repo.stargazers_count > 500) weight += 1.5;
    if (repo.stargazers_count > 1000) weight += 2.0;
    
    // Recency weight
    const ageInDays = (Date.now() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays < 7) weight += 2.0;
    else if (ageInDays < 14) weight += 1.0;
    
    // Recent activity
    const updateAgeInDays = (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    if (updateAgeInDays < 3) weight += 0.5;
    
    return weight;
  }

  private deduplicateSignals(signals: Signal[]): Signal[] {
    const seen = new Set<string>();
    return signals.filter(signal => {
      const key = signal.metadata.url;
      if (seen.has(key!)) return false;
      seen.add(key!);
      return true;
    });
  }
}
