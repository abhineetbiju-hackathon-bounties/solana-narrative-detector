import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { Signal, CollectorResult } from '../types';

interface ForumSource {
  name: string;
  url: string;
  rssUrl?: string;
  apiUrl?: string;
  weight: number;
}

export class DiscordCollector {
  private rssParser: Parser;
  private forumSources: ForumSource[] = [
    {
      name: 'Solana StackExchange',
      url: 'https://solana.stackexchange.com/questions?tab=newest',
      rssUrl: 'https://solana.stackexchange.com/feeds',
      apiUrl: 'https://api.stackexchange.com/2.3/questions?order=desc&sort=activity&site=solana&pagesize=30&filter=withbody',
      weight: 2.5
    },
    {
      name: 'Solana Forum',
      url: 'https://forum.solana.com/latest',
      weight: 2.0
    },
    {
      name: 'r/solana',
      url: 'https://www.reddit.com/r/solana/new/',
      rssUrl: 'https://www.reddit.com/r/solana/new/.rss',
      weight: 1.5
    },
    {
      name: 'r/solanadev',
      url: 'https://www.reddit.com/r/solanadev/new/',
      rssUrl: 'https://www.reddit.com/r/solanadev/new/.rss',
      weight: 2.0
    },
    {
      name: 'r/solana (hot)',
      url: 'https://www.reddit.com/r/solana/hot/',
      rssUrl: 'https://www.reddit.com/r/solana/hot/.rss',
      weight: 2.0
    }
  ];

  constructor() {
    this.rssParser = new Parser({
      customFields: {
        item: ['description', 'pubDate', 'content:encoded']
      },
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
  }

  async collectDiscordSignals(): Promise<CollectorResult> {
    const signals: Signal[] = [];
    const errors: string[] = [];

    // 1. Collect from StackExchange API (most reliable)
    try {
      const seSignals = await this.collectFromStackExchangeAPI();
      signals.push(...seSignals);
      console.log(`  StackExchange API: ${seSignals.length} signals`);
    } catch (e: any) {
      errors.push(`StackExchange API: ${e.message}`);
    }

    // 2. Collect from RSS feeds
    for (const source of this.forumSources) {
      if (source.apiUrl) continue; // Already handled via API above

      try {
        let sourceSignals: Signal[] = [];

        if (source.rssUrl) {
          sourceSignals = await this.collectFromRSS(source);
        } else {
          sourceSignals = await this.scrapeForumPage(source);
        }

        signals.push(...sourceSignals);
        console.log(`  ${source.name}: ${sourceSignals.length} signals`);
      } catch (error: any) {
        errors.push(`${source.name}: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 3. Collect from Reddit JSON API as fallback if RSS fails
    try {
      const redditSignals = await this.collectFromRedditJSON();
      // Only add if we didn't already get Reddit signals from RSS
      const hasRedditSignals = signals.some(s => s.id.includes('reddit') || s.id.includes('r_solana'));
      if (!hasRedditSignals || signals.filter(s => s.metadata.author?.includes('r/')).length < 5) {
        signals.push(...redditSignals);
        console.log(`  Reddit JSON fallback: ${redditSignals.length} signals`);
      }
    } catch (e: any) {
      errors.push(`Reddit JSON: ${e.message}`);
    }

    return {
      signals: this.deduplicateSignals(signals),
      collectedAt: Date.now(),
      source: 'discord',
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private async collectFromStackExchangeAPI(): Promise<Signal[]> {
    const signals: Signal[] = [];

    try {
      const response = await axios.get(
        'https://api.stackexchange.com/2.3/questions',
        {
          params: {
            order: 'desc',
            sort: 'activity',
            site: 'solana',
            pagesize: 30,
            filter: '!nNPvSNdWme', // Include body_markdown
          },
          timeout: 10000,
          headers: {
            'Accept-Encoding': 'gzip',
          }
        }
      );

      if (response.data && response.data.items) {
        for (const item of response.data.items) {
          const creationDate = item.creation_date * 1000; // Convert to ms

          // Only include posts from last 30 days
          if (Date.now() - creationDate < 30 * 24 * 60 * 60 * 1000) {
            const title = item.title || '';
            const body = this.cleanContent(item.body_markdown || item.body || '');
            const tags = item.tags || [];
            const keywords = this.extractKeywords(title, body);
            keywords.push(...tags.filter((t: string) => t.length > 2));

            signals.push({
              id: `discord_se_${item.question_id}`,
              source: 'discord',
              timestamp: creationDate,
              content: `Solana StackExchange: ${title} - ${body.substring(0, 200)}`,
              metadata: {
                url: item.link || `https://solana.stackexchange.com/questions/${item.question_id}`,
                author: 'Solana StackExchange',
                metrics: {
                  score: item.score || 0,
                  answer_count: item.answer_count || 0,
                  view_count: item.view_count || 0,
                }
              },
              keywords: [...new Set(keywords)].slice(0, 20),
              weight: Math.min(2.0 + (item.score || 0) * 0.3 + (item.answer_count || 0) * 0.2, 4.0)
            });
          }
        }
      }
    } catch (error: any) {
      console.error('StackExchange API error:', error.message);
    }

    return signals;
  }

  private async collectFromRSS(source: ForumSource): Promise<Signal[]> {
    const signals: Signal[] = [];

    if (!source.rssUrl) return signals;

    try {
      const feed = await this.rssParser.parseURL(source.rssUrl);

      for (const item of feed.items.slice(0, 20)) {
        const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();

        // Only include posts from last 14 days
        if (Date.now() - pubDate < 14 * 24 * 60 * 60 * 1000) {
          const content = this.cleanContent(
            item.contentSnippet || item['content:encoded'] || item.description || ''
          );
          const title = item.title || '';
          const keywords = this.extractKeywords(title, content);

          // Filter for Solana-relevant content
          if (this.isSolanaRelevant(title, content)) {
            signals.push({
              id: `discord_${source.name.replace(/[\s\/]+/g, '_')}_${pubDate}_${(item.title || '').substring(0, 20).replace(/\W/g, '')}`,
              source: 'discord',
              timestamp: pubDate,
              content: `${source.name}: ${title} - ${content.substring(0, 200)}`,
              metadata: {
                url: item.link || source.url,
                author: source.name
              },
              keywords,
              weight: source.weight
            });
          }
        }
      }
    } catch (error: any) {
      console.error(`RSS collection for ${source.name} failed:`, error.message);
    }

    return signals;
  }

  private async collectFromRedditJSON(): Promise<Signal[]> {
    const signals: Signal[] = [];

    const subreddits = ['solana', 'solanadev'];

    for (const subreddit of subreddits) {
      try {
        const response = await axios.get(`https://www.reddit.com/r/${subreddit}/hot.json?limit=25`, {
          headers: {
            'User-Agent': 'SolanaNarrativeDetector/1.0',
          },
          timeout: 10000,
        });

        if (response.data?.data?.children) {
          for (const post of response.data.data.children) {
            const data = post.data;
            if (!data || data.stickied) continue;

            const createdAt = data.created_utc * 1000;

            // Only recent posts
            if (Date.now() - createdAt < 14 * 24 * 60 * 60 * 1000) {
              const title = data.title || '';
              const selftext = (data.selftext || '').substring(0, 300);
              const keywords = this.extractKeywords(title, selftext);

              if (this.isSolanaRelevant(title, selftext)) {
                signals.push({
                  id: `discord_reddit_${subreddit}_${data.id}`,
                  source: 'discord',
                  timestamp: createdAt,
                  content: `r/${subreddit}: ${title} - ${this.cleanContent(selftext).substring(0, 200)}`,
                  metadata: {
                    url: `https://reddit.com${data.permalink}`,
                    author: `r/${subreddit}`,
                    metrics: {
                      score: data.score || 0,
                      num_comments: data.num_comments || 0,
                    }
                  },
                  keywords,
                  weight: Math.min(1.5 + (data.score || 0) / 50, 4.0),
                });
              }
            }
          }
        }
      } catch (error: any) {
        console.error(`Reddit JSON for r/${subreddit} failed:`, error.message);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return signals;
  }

  private async scrapeForumPage(source: ForumSource): Promise<Signal[]> {
    const signals: Signal[] = [];

    try {
      const response = await axios.get(source.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);

      // Discourse-style forums (like forum.solana.com)
      const topics = $('tr.topic-list-item, .topic-title, .latest-topic-list-item').slice(0, 20);

      topics.each((_, element) => {
        const $el = $(element);
        const titleEl = $el.find('.link-top-line a, .title a, a.title').first();
        const title = titleEl.text().trim() || $el.find('a').first().text().trim();
        const link = titleEl.attr('href') || $el.find('a').first().attr('href');

        if (title && title.length > 10) {
          const keywords = this.extractKeywords(title, '');

          signals.push({
            id: `discord_scraped_${source.name.replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            source: 'discord',
            timestamp: Date.now(),
            content: `${source.name}: ${title}`,
            metadata: {
              url: link ? this.resolveUrl(source.url, link) : source.url,
              author: source.name
            },
            keywords,
            weight: source.weight * 0.8
          });
        }
      });

      // Also try JSON API for Discourse forums
      if (signals.length === 0) {
        try {
          const jsonResponse = await axios.get(`${source.url}.json`, {
            headers: { 'Accept': 'application/json' },
            timeout: 10000,
          });

          if (jsonResponse.data?.topic_list?.topics) {
            for (const topic of jsonResponse.data.topic_list.topics.slice(0, 15)) {
              const title = topic.title || '';
              if (title.length > 10 && this.isSolanaRelevant(title, '')) {
                signals.push({
                  id: `discord_discourse_${source.name.replace(/\s+/g, '_')}_${topic.id}`,
                  source: 'discord',
                  timestamp: new Date(topic.created_at || Date.now()).getTime(),
                  content: `${source.name}: ${title}`,
                  metadata: {
                    url: `${source.url.replace('/latest', '')}/t/${topic.slug}/${topic.id}`,
                    author: source.name,
                    metrics: {
                      views: topic.views || 0,
                      reply_count: topic.reply_count || 0,
                      like_count: topic.like_count || 0,
                    }
                  },
                  keywords: this.extractKeywords(title, ''),
                  weight: source.weight,
                });
              }
            }
          }
        } catch (e) {
          // JSON API not available for this forum
        }
      }
    } catch (error: any) {
      console.error(`Forum scraping for ${source.name} failed:`, error.message);
    }

    return signals;
  }

  private isSolanaRelevant(title: string, content: string): boolean {
    const text = `${title} ${content}`.toLowerCase();
    const relevantTerms = [
      'solana', 'sol', 'anchor', 'spl', 'token-2022', 'defi', 'nft',
      'jupiter', 'marinade', 'jito', 'drift', 'kamino', 'tensor',
      'compressed', 'depin', 'firedancer', 'blinks', 'actions',
      'validator', 'stake', 'program', 'instruction', 'cpi',
      'metaplex', 'helius', 'helium', 'render', 'ai agent',
      'web3', 'wallet', 'phantom', 'backpack', 'token extensions',
      'raydium', 'orca', 'meteora', 'marginfi', 'sanctum', 'pyth',
      'wormhole', 'phoenix', 'nosana', 'hivemapper', 'bonk', 'jup',
    ];

    return relevantTerms.some(term => text.includes(term));
  }

  private cleanContent(content: string): string {
    content = content.replace(/<[^>]*>/g, ' ');
    content = content.replace(/https?:\/\/\S+/g, '');
    content = content.replace(/\s+/g, ' ').trim();
    return content.substring(0, 500);
  }

  private extractKeywords(title: string, content: string): string[] {
    const keywords: Set<string> = new Set();
    const text = `${title} ${content}`.toLowerCase();

    const solanaTerms = [
      'solana', 'sol', 'defi', 'nft', 'dex', 'amm', 'lending',
      'validator', 'stake', 'liquid-staking', 'jupiter', 'marinade',
      'drift', 'kamino', 'jito', 'tensor', 'magic-eden',
      'compressed-nfts', 'state-compression', 'zk-compression',
      'breakpoint', 'firedancer', 'simd', 'token-extensions',
      'token-2022', 'blinks', 'actions', 'mobile', 'saga',
      'depin', 'ai', 'agents', 'anchor', 'program', 'spl',
      'helium', 'render', 'hivemapper', 'nosana', 'metaplex',
      'raydium', 'orca', 'meteora', 'marginfi', 'sanctum',
      'pyth', 'phoenix', 'wormhole', 'phantom', 'backpack',
    ];

    solanaTerms.forEach(term => {
      const searchTerm = term.replace(/-/g, ' ');
      // Use word boundary matching for short terms to avoid false positives
      if (term.length <= 3) {
        const regex = new RegExp(`\\b${term}\\b`, 'i');
        if (regex.test(text)) keywords.add(term);
      } else if (text.includes(searchTerm) || text.includes(term)) {
        keywords.add(term);
      }
    });

    // Extract significant words from title
    const words = title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word =>
        word.length > 3 &&
        !['that', 'this', 'with', 'from', 'have', 'been', 'will', 'your',
          'what', 'does', 'need', 'help', 'would', 'could', 'should',
          'about', 'when', 'there', 'which', 'these', 'those'].includes(word)
      );

    words.forEach(word => keywords.add(word));

    return Array.from(keywords).slice(0, 20);
  }

  private resolveUrl(baseUrl: string, relativeUrl: string): string {
    if (relativeUrl.startsWith('http')) {
      return relativeUrl;
    }

    try {
      const base = new URL(baseUrl);
      return new URL(relativeUrl, base.origin).toString();
    } catch {
      return baseUrl;
    }
  }

  private deduplicateSignals(signals: Signal[]): Signal[] {
    const seen = new Map<string, Signal>();

    for (const signal of signals) {
      const key = `${signal.metadata.author}_${signal.content.substring(0, 80)}`;
      if (!seen.has(key)) {
        seen.set(key, signal);
      }
    }

    return Array.from(seen.values());
  }
}
