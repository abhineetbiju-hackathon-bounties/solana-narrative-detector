import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { Signal, CollectorResult } from '../types';

interface TwitterUser {
  username: string;
  displayName: string;
  weight: number;
}

export class TwitterCollector {
  private rssParser: Parser;
  private bearerToken?: string;
  private keyVoices: TwitterUser[] = [
    { username: 'maboroshi0001', displayName: 'Mert (Helius)', weight: 3.0 },
    { username: 'aeyakovenko', displayName: 'Anatoly (Toly)', weight: 3.0 },
    { username: 'rajgokal', displayName: 'Raj Gokal', weight: 2.5 },
    { username: 'armaniferrante', displayName: 'Armani Ferrante', weight: 2.5 },
    { username: 'solanafndn', displayName: 'Solana Foundation', weight: 2.0 },
    { username: 'JupiterExchange', displayName: 'Jupiter', weight: 2.0 },
    { username: 'akshaybd', displayName: 'Akshay', weight: 3.0 },
    { username: 'heaboroshi', displayName: 'Helius', weight: 2.5 },
    { username: 'solaboroshi', displayName: 'Solana', weight: 2.0 },
  ];

  constructor(bearerToken?: string) {
    this.bearerToken = bearerToken;
    this.rssParser = new Parser({
      customFields: {
        item: ['description', 'pubDate']
      },
      timeout: 15000,
    });
  }

  async collectTwitterSignals(): Promise<CollectorResult> {
    const signals: Signal[] = [];
    const errors: string[] = [];

    // Strategy 0: Twitter v2 API (best source, requires bearer token)
    if (this.bearerToken) {
      try {
        const apiSignals = await this.collectFromTwitterAPI();
        signals.push(...apiSignals);
        if (apiSignals.length > 0) {
          console.log(`  Twitter API v2: ${apiSignals.length} signals`);
        }
      } catch (e: any) {
        errors.push(`Twitter API: ${e.message}`);
      }
    }

    // Strategy 1: Try Nitter RSS feeds (if any instances are alive)
    try {
      const nitterSignals = await this.collectFromNitter();
      signals.push(...nitterSignals);
      if (nitterSignals.length > 0) {
        console.log(`  Nitter: ${nitterSignals.length} signals`);
      }
    } catch (e: any) {
      errors.push(`Nitter: ${e.message}`);
    }

    // Strategy 2: Try RSSHub alternatives
    try {
      const rssSignals = await this.collectFromRSSAlternatives();
      signals.push(...rssSignals);
      if (rssSignals.length > 0) {
        console.log(`  RSSHub: ${rssSignals.length} signals`);
      }
    } catch (e: any) {
      errors.push(`RSSHub: ${e.message}`);
    }

    // Strategy 3: Scrape Twitter syndication API (publicly accessible)
    try {
      const syndicationSignals = await this.collectFromSyndication();
      signals.push(...syndicationSignals);
      if (syndicationSignals.length > 0) {
        console.log(`  Syndication: ${syndicationSignals.length} signals`);
      }
    } catch (e: any) {
      errors.push(`Syndication: ${e.message}`);
    }

    // Strategy 4: Scrape Solana ecosystem aggregators for social sentiment
    try {
      const aggregatorSignals = await this.collectFromEcosystemAggregators();
      signals.push(...aggregatorSignals);
      if (aggregatorSignals.length > 0) {
        console.log(`  Aggregators: ${aggregatorSignals.length} signals`);
      }
    } catch (e: any) {
      errors.push(`Aggregators: ${e.message}`);
    }

    // Strategy 5: Solana-focused newsletters/blogs RSS that aggregate Twitter discourse 
    try {
      const newsletterSignals = await this.collectFromNewsletters();
      signals.push(...newsletterSignals);
      if (newsletterSignals.length > 0) {
        console.log(`  Newsletters: ${newsletterSignals.length} signals`);
      }
    } catch (e: any) {
      errors.push(`Newsletters: ${e.message}`);
    }

    return {
      signals: this.deduplicateSignals(signals),
      collectedAt: Date.now(),
      source: 'twitter',
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private async collectFromTwitterAPI(): Promise<Signal[]> {
    const signals: Signal[] = [];

    if (!this.bearerToken) return signals;

    // Search queries targeting Solana ecosystem discussions
    const searchQueries = [
      'solana defi -is:retweet lang:en',
      '(jupiter OR jito OR marinade OR drift OR kamino) solana -is:retweet lang:en',
      '(firedancer OR token extensions OR compressed nft) -is:retweet lang:en',
      '(depin OR helium OR render OR hivemapper) solana -is:retweet lang:en',
      'solana ai agents -is:retweet lang:en',
    ];

    for (const query of searchQueries) {
      try {
        const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
          params: {
            query,
            max_results: 20,
            'tweet.fields': 'created_at,public_metrics,author_id,text',
            'user.fields': 'username,name',
            expansions: 'author_id',
          },
          headers: {
            'Authorization': `Bearer ${this.bearerToken}`,
          },
          timeout: 10000,
        });

        if (response.data?.data) {
          // Build author lookup from includes
          const authorMap = new Map<string, string>();
          if (response.data.includes?.users) {
            for (const user of response.data.includes.users) {
              authorMap.set(user.id, user.username);
            }
          }

          for (const tweet of response.data.data) {
            const tweetDate = tweet.created_at ? new Date(tweet.created_at).getTime() : Date.now();
            const authorUsername = authorMap.get(tweet.author_id) || 'unknown';
            const metrics = tweet.public_metrics || {};
            const content = this.cleanTweetContent(tweet.text || '');

            if (content.length > 20) {
              // Calculate weight based on engagement
              const engagementScore =
                (metrics.like_count || 0) * 0.01 +
                (metrics.retweet_count || 0) * 0.05 +
                (metrics.reply_count || 0) * 0.03;

              // Check if author is a known key voice
              const keyVoice = this.keyVoices.find(v =>
                v.username.toLowerCase() === authorUsername.toLowerCase()
              );
              const weight = keyVoice ? keyVoice.weight : Math.min(1.5 + engagementScore, 4.0);

              signals.push({
                id: `twitter_api_${tweet.id}`,
                source: 'twitter',
                timestamp: tweetDate,
                content: `@${authorUsername}: ${content}`,
                metadata: {
                  url: `https://twitter.com/${authorUsername}/status/${tweet.id}`,
                  author: authorUsername,
                  metrics: {
                    likes: metrics.like_count || 0,
                    retweets: metrics.retweet_count || 0,
                    replies: metrics.reply_count || 0,
                  },
                },
                keywords: this.extractKeywordsFromTweet(content),
                weight,
              });
            }
          }
        }
      } catch (error: any) {
        // Handle rate limits gracefully
        if (error.response?.status === 429) {
          console.log('  Twitter API rate limit reached, skipping remaining queries');
          break;
        }
        // Auth errors
        if (error.response?.status === 401 || error.response?.status === 403) {
          console.log('  Twitter API authentication failed — check your TWITTER_BEARER_TOKEN');
          break;
        }
        continue;
      }
      // Rate limit: 1 request per second for basic tier
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return signals;
  }

  private async collectFromNitter(): Promise<Signal[]> {
    const signals: Signal[] = [];

    const nitterInstances = [
      'nitter.poast.org',
      'nitter.privacydev.net',
      'nitter.net',
      'nitter.cz',
      'nitter.1d4.us',
    ];

    for (const user of this.keyVoices.slice(0, 5)) {
      for (const instance of nitterInstances) {
        try {
          const rssUrl = `https://${instance}/${user.username}/rss`;
          const feed = await this.rssParser.parseURL(rssUrl);

          if (feed.items && feed.items.length > 0) {
            for (const item of feed.items.slice(0, 10)) {
              const tweetDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
              const content = this.cleanTweetContent(item.contentSnippet || item.description || '');

              if (Date.now() - tweetDate < 14 * 24 * 60 * 60 * 1000 && content.length > 20) {
                signals.push({
                  id: `twitter_${user.username}_${tweetDate}`,
                  source: 'twitter',
                  timestamp: tweetDate,
                  content: `@${user.username}: ${content}`,
                  metadata: {
                    url: item.link || '',
                    author: user.username,
                    metrics: {}
                  },
                  keywords: this.extractKeywordsFromTweet(content),
                  weight: user.weight
                });
              }
            }
            break; // If successful, skip remaining instances
          }
        } catch (error) {
          continue;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return signals;
  }

  private async collectFromRSSAlternatives(): Promise<Signal[]> {
    const signals: Signal[] = [];

    // Try multiple RSS bridge services
    const rssBridges = [
      'https://rsshub.app/twitter/user',
      'https://rsshub.rssforever.com/twitter/user',
    ];

    for (const bridge of rssBridges) {
      for (const user of this.keyVoices.slice(0, 3)) {
        try {
          const feed = await this.rssParser.parseURL(`${bridge}/${user.username}`);

          if (feed.items) {
            for (const item of feed.items.slice(0, 5)) {
              const content = this.cleanTweetContent(item.contentSnippet || item.description || '');
              const tweetDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();

              if (Date.now() - tweetDate < 14 * 24 * 60 * 60 * 1000 && content.length > 20) {
                signals.push({
                  id: `twitter_rsshub_${user.username}_${tweetDate}`,
                  source: 'twitter',
                  timestamp: tweetDate,
                  content: `@${user.username}: ${content}`,
                  metadata: {
                    url: item.link || '',
                    author: user.username
                  },
                  keywords: this.extractKeywordsFromTweet(content),
                  weight: user.weight
                });
              }
            }
          }
        } catch (error) {
          continue;
        }
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    return signals;
  }

  private async collectFromSyndication(): Promise<Signal[]> {
    const signals: Signal[] = [];

    // Twitter's syndication API is publicly accessible without auth
    // It provides timeline data for public accounts
    for (const user of this.keyVoices) {
      try {
        const response = await axios.get(
          `https://syndication.twitter.com/srv/timeline-profile/screen-name/${user.username}`,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml',
            },
            timeout: 10000,
          }
        );

        if (response.data) {
          const $ = cheerio.load(response.data);

          // Extract tweet content from the syndication page
          $('[data-tweet-id], .timeline-Tweet-text, .tweet-text, p').each((_, el) => {
            const text = $(el).text().trim();
            if (text.length > 30 && this.isSolanaRelevant(text)) {
              signals.push({
                id: `twitter_synd_${user.username}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                source: 'twitter',
                timestamp: Date.now(),
                content: `@${user.username}: ${text.substring(0, 280)}`,
                metadata: {
                  url: `https://twitter.com/${user.username}`,
                  author: user.username,
                },
                keywords: this.extractKeywordsFromTweet(text),
                weight: user.weight * 0.9,
              });
            }
          });
        }
      } catch (error) {
        continue;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return signals;
  }

  private async collectFromEcosystemAggregators(): Promise<Signal[]> {
    const signals: Signal[] = [];

    // Scrape Solana ecosystem news/social aggregators
    const aggregatorSources = [
      {
        url: 'https://solana.com/news',
        name: 'Solana News',
        weight: 2.0,
      },
      {
        url: 'https://www.theblock.co/latest?tags=Solana',
        name: 'The Block (Solana)',
        weight: 2.0,
      },
    ];

    for (const source of aggregatorSources) {
      try {
        const response = await axios.get(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          timeout: 10000,
        });

        const $ = cheerio.load(response.data);

        // Generic article/post extraction
        $('article, .post, [class*="article"], [class*="story"], [class*="card"]').slice(0, 15).each((_, el) => {
          const $el = $(el);
          const title = $el.find('h1, h2, h3, h4, [class*="title"], [class*="heading"]').first().text().trim();
          const desc = $el.find('p, [class*="description"], [class*="excerpt"], [class*="summary"]').first().text().trim();
          const link = $el.find('a').first().attr('href');
          const text = `${title} ${desc}`.trim();

          if (text.length > 20 && this.isSolanaRelevant(text)) {
            signals.push({
              id: `twitter_agg_${source.name}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              source: 'twitter',
              timestamp: Date.now(),
              content: `${source.name}: ${title} - ${desc}`.substring(0, 350),
              metadata: {
                url: link ? this.resolveUrl(source.url, link) : source.url,
                author: source.name,
              },
              keywords: this.extractKeywordsFromTweet(text),
              weight: source.weight,
            });
          }
        });
      } catch (error) {
        continue;
      }
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return signals;
  }

  private async collectFromNewsletters(): Promise<Signal[]> {
    const signals: Signal[] = [];

    // RSS feeds from Solana-focused newsletters and blogs that aggregate social discourse
    const newsletterFeeds = [
      { url: 'https://solanafm.com/rss', name: 'SolanaFM', weight: 2.0 },
      { url: 'https://www.jito.network/blog/rss.xml', name: 'Jito Blog', weight: 2.0 },
      { url: 'https://phantom.app/blog/rss.xml', name: 'Phantom Blog', weight: 2.0 },
      { url: 'https://blog.marinade.finance/rss/', name: 'Marinade Blog', weight: 1.5 },
      { url: 'https://medium.com/feed/@solana', name: 'Solana Medium', weight: 1.5 },
      { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml&_website=coindesk', name: 'CoinDesk', weight: 1.5 },
    ];

    for (const feed of newsletterFeeds) {
      try {
        const parsed = await this.rssParser.parseURL(feed.url);
        if (parsed.items) {
          for (const item of parsed.items.slice(0, 10)) {
            const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();

            // Only recent items (30 days for blogs)
            if (Date.now() - pubDate < 30 * 24 * 60 * 60 * 1000) {
              const title = item.title || '';
              const content = this.cleanTweetContent(item.contentSnippet || item.description || '');
              const text = `${title} ${content}`;

              if (this.isSolanaRelevant(text)) {
                signals.push({
                  id: `twitter_newsletter_${feed.name}_${pubDate}`,
                  source: 'twitter',
                  timestamp: pubDate,
                  content: `${feed.name}: ${title} - ${content}`.substring(0, 350),
                  metadata: {
                    url: item.link || '',
                    author: feed.name,
                  },
                  keywords: this.extractKeywordsFromTweet(text),
                  weight: feed.weight,
                });
              }
            }
          }
        }
      } catch (error) {
        continue;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return signals;
  }

  private isSolanaRelevant(text: string): boolean {
    const lower = text.toLowerCase();
    const relevantTerms = [
      'solana', 'sol', 'anchor', 'spl', 'token-2022', 'defi', 'nft',
      'jupiter', 'marinade', 'jito', 'drift', 'kamino', 'tensor',
      'compressed', 'depin', 'firedancer', 'blinks', 'actions',
      'validator', 'stake', 'phantom', 'backpack', 'token extensions',
      'helium', 'render', 'ai agent', 'web3', 'raydium', 'orca',
      'meteora', 'phoenix', 'marginfi', 'sanctum', 'pyth',
      'wormhole', 'helius', 'metaplex', 'nosana', 'hivemapper',
    ];
    return relevantTerms.some(term => lower.includes(term));
  }

  private cleanTweetContent(content: string): string {
    content = content.replace(/<[^>]*>/g, '');
    content = content.replace(/https?:\/\/\S+/g, '');
    content = content.replace(/\s+/g, ' ').trim();
    return content.substring(0, 280);
  }

  private extractKeywordsFromTweet(content: string): string[] {
    const keywords: Set<string> = new Set();

    // Extract hashtags
    const hashtags: string[] = content.match(/#\w+/g) || [];
    hashtags.forEach(tag => keywords.add(tag.substring(1).toLowerCase()));

    // Extract significant words
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word =>
        word.length > 3 &&
        !['that', 'this', 'with', 'from', 'have', 'been', 'will', 'your',
          'what', 'about', 'just', 'more', 'also', 'very', 'most', 'some',
          'than', 'into', 'over', 'only', 'each', 'them', 'then', 'when',
          'here', 'much', 'many', 'such', 'even', 'like', 'does', 'done',
          'https', 'http', 'www'].includes(word)
      );

    words.forEach(word => keywords.add(word));

    // Solana-specific terms get priority
    const solanaTerms = [
      'solana', 'sol', 'defi', 'nft', 'dapp', 'web3', 'crypto', 'blockchain',
      'jupiter', 'jito', 'drift', 'kamino', 'tensor', 'marinade',
      'depin', 'ai', 'agents', 'token-2022', 'compressed', 'firedancer',
      'validator', 'staking', 'liquid-staking', 'mev', 'blinks',
    ];
    solanaTerms.forEach(term => {
      if (content.toLowerCase().includes(term)) {
        keywords.add(term);
      }
    });

    return Array.from(keywords).slice(0, 20);
  }

  private resolveUrl(baseUrl: string, relativeUrl: string): string {
    if (relativeUrl.startsWith('http')) return relativeUrl;
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
      const key = `${signal.metadata.author}_${signal.content.substring(0, 50)}`;
      if (!seen.has(key)) {
        seen.set(key, signal);
      }
    }

    return Array.from(seen.values());
  }
}
