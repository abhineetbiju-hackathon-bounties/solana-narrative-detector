import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { Signal, CollectorResult } from '../types';

interface ReportSource {
  name: string;
  rssUrl?: string;
  websiteUrl?: string;
  weight: number;
  requireSolanaFilter: boolean; // Whether to filter for Solana-specific content
}

export class ReportsCollector {
  private rssParser: Parser;
  private sources: ReportSource[] = [
    {
      name: 'Helius Blog',
      rssUrl: 'https://www.helius.dev/blog/rss.xml',
      websiteUrl: 'https://www.helius.dev/blog',
      weight: 3.0,
      requireSolanaFilter: false, // Helius is always Solana-relevant
    },
    {
      name: 'Messari Research',
      websiteUrl: 'https://messari.io/research',
      weight: 2.5,
      requireSolanaFilter: true,
    },
    {
      name: 'Solana Foundation Blog',
      rssUrl: 'https://solana.com/news/rss.xml',
      websiteUrl: 'https://solana.com/news',
      weight: 3.0,
      requireSolanaFilter: false, // Always Solana
    },
    {
      name: 'Electric Capital',
      websiteUrl: 'https://www.electriccapital.com/research',
      weight: 2.5,
      requireSolanaFilter: true,
    },
    {
      name: 'Phantom Blog',
      rssUrl: 'https://phantom.app/blog/rss.xml',
      websiteUrl: 'https://phantom.app/blog',
      weight: 2.0,
      requireSolanaFilter: false,
    },
    {
      name: 'Jito Blog',
      rssUrl: 'https://www.jito.network/blog/rss.xml',
      websiteUrl: 'https://www.jito.network/blog',
      weight: 2.0,
      requireSolanaFilter: false,
    },
    {
      name: 'CoinDesk',
      rssUrl: 'https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml',
      weight: 1.5,
      requireSolanaFilter: true,
    },
    {
      name: 'The Block',
      rssUrl: 'https://www.theblock.co/rss.xml',
      weight: 1.5,
      requireSolanaFilter: true,
    },
    {
      name: 'DeFiLlama News',
      rssUrl: 'https://defillama.com/rss',
      weight: 1.5,
      requireSolanaFilter: true,
    },
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

  async collectReportSignals(): Promise<CollectorResult> {
    const signals: Signal[] = [];
    const errors: string[] = [];

    for (const source of this.sources) {
      try {
        let sourceSignals: Signal[] = [];

        if (source.rssUrl) {
          sourceSignals = await this.collectFromRSS(source);
        }

        // If RSS returned nothing, try website scraping 
        if (sourceSignals.length === 0 && source.websiteUrl) {
          sourceSignals = await this.scrapeWebsite(source);
        }

        signals.push(...sourceSignals);
        if (sourceSignals.length > 0) {
          console.log(`  ${source.name}: ${sourceSignals.length} signals`);
        }
      } catch (error: any) {
        errors.push(`${source.name}: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    return {
      signals,
      collectedAt: Date.now(),
      source: 'report',
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private async collectFromRSS(source: ReportSource): Promise<Signal[]> {
    const signals: Signal[] = [];

    if (!source.rssUrl) return signals;

    try {
      const feed = await this.rssParser.parseURL(source.rssUrl);

      for (const item of feed.items.slice(0, 15)) {
        const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();

        // Only include articles from last 30 days
        if (Date.now() - pubDate < 30 * 24 * 60 * 60 * 1000) {
          const content = this.extractContent(item);
          const title = item.title || '';
          const text = `${title} ${content}`;

          // Apply Solana filter only if required
          if (!source.requireSolanaFilter || this.isSolanaRelevant(title, content)) {
            const keywords = this.extractKeywordsFromReport(title, content);

            signals.push({
              id: `report_${source.name.replace(/\s+/g, '_')}_${pubDate}`,
              source: 'report',
              timestamp: pubDate,
              content: `${source.name}: ${title} - ${content.substring(0, 250)}`,
              metadata: {
                url: item.link || '',
                author: source.name,
                metrics: {
                  report_age_days: Math.floor((Date.now() - pubDate) / (1000 * 60 * 60 * 24))
                }
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

  private async scrapeWebsite(source: ReportSource): Promise<Signal[]> {
    const signals: Signal[] = [];

    if (!source.websiteUrl) return signals;

    try {
      const response = await axios.get(source.websiteUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);

      // Try multiple selectors for article discovery
      const selectors = [
        'article',
        '.post', '.blog-post', '.blog-card',
        '[class*="article"]', '[class*="post"]', '[class*="card"]',
        '.entry', '.item',
      ];

      const articles = $(selectors.join(', ')).slice(0, 15);

      articles.each((_, element) => {
        const $article = $(element);
        const title = $article.find('h1, h2, h3, .title, [class*="title"], [class*="heading"]').first().text().trim();
        const content = $article.find('p, .excerpt, .description, [class*="excerpt"], [class*="description"], [class*="summary"]').first().text().trim();
        const link = $article.find('a').first().attr('href');

        if (title && title.length > 10) {
          // Apply Solana filter only if required
          if (!source.requireSolanaFilter || this.isSolanaRelevant(title, content)) {
            const keywords = this.extractKeywordsFromReport(title, content);

            signals.push({
              id: `report_scraped_${source.name.replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              source: 'report',
              timestamp: Date.now(),
              content: `${source.name}: ${title} - ${content.substring(0, 250)}`,
              metadata: {
                url: link ? this.resolveUrl(source.websiteUrl, link) : source.websiteUrl,
                author: source.name
              },
              keywords,
              weight: source.weight * 0.8
            });
          }
        }
      });

      // If nothing found via article selectors, try generic link+heading extraction
      if (signals.length === 0) {
        $('a[href]').each((_, el) => {
          const $a = $(el);
          const text = $a.text().trim();
          const href = $a.attr('href') || '';

          // Look for links with blog/report-like paths
          if (text.length > 15 && text.length < 200 &&
            (href.includes('/blog/') || href.includes('/research/') || href.includes('/report/') || href.includes('/news/'))) {
            if (!source.requireSolanaFilter || this.isSolanaRelevant(text, '')) {
              signals.push({
                id: `report_link_${source.name.replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                source: 'report',
                timestamp: Date.now(),
                content: `${source.name}: ${text}`,
                metadata: {
                  url: this.resolveUrl(source.websiteUrl!, href),
                  author: source.name,
                },
                keywords: this.extractKeywordsFromReport(text, ''),
                weight: source.weight * 0.7,
              });
            }
          }
        });
      }
    } catch (error: any) {
      console.error(`Website scraping for ${source.name} failed:`, error.message);
    }

    return signals;
  }

  private isSolanaRelevant(title: string, content: string): boolean {
    const text = `${title} ${content}`.toLowerCase();
    const relevantTerms = [
      'solana', 'sol', 'anchor', 'spl', 'token-2022', 'defi',
      'jupiter', 'marinade', 'jito', 'drift', 'kamino',
      'compressed', 'depin', 'firedancer', 'blinks', 'actions',
      'validator', 'phantom', 'backpack', 'token extensions',
      'helium', 'render', 'ai agent', 'raydium', 'orca',
      'meteora', 'phoenix', 'marginfi', 'sanctum', 'pyth',
      'wormhole', 'helius', 'metaplex', 'nosana', 'hivemapper',
      'breakpoint', 'saga', 'bonk', 'jup ', 'tensor',
    ];
    return relevantTerms.some(term => text.includes(term));
  }

  private extractContent(item: any): string {
    let content = item['content:encoded'] || item.content || item.contentSnippet || item.description || '';
    content = content.replace(/<[^>]*>/g, ' ');
    content = content.replace(/https?:\/\/\S+/g, '');
    content = content.replace(/\s+/g, ' ').trim();
    return content;
  }

  private extractKeywordsFromReport(title: string, content: string): string[] {
    const keywords: Set<string> = new Set();
    const text = `${title} ${content}`.toLowerCase();

    const solanaTerms = [
      'solana', 'sol', 'defi', 'nft', 'dex', 'amm', 'lending',
      'validator', 'stake', 'liquid-staking', 'jupiter', 'marinade',
      'drift', 'kamino', 'jito', 'tensor', 'magic-eden',
      'compressed-nfts', 'state-compression', 'zk-compression',
      'breakpoint', 'firedancer', 'simd', 'token-extensions',
      'blinks', 'actions', 'mobile', 'saga', 'depin', 'ai',
      'raydium', 'orca', 'meteora', 'marginfi', 'sanctum',
      'pyth', 'phoenix', 'wormhole', 'phantom', 'backpack',
      'token-2022', 'agents', 'mev', 'staking', 'yield',
      'rwa', 'real-world-assets', 'payments', 'gaming',
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

    // Extract capitalized terms (proper nouns)
    const capitalizedWords = (title + ' ' + content).match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    capitalizedWords.forEach(word => {
      if (word.length > 3 && !['The', 'And', 'This', 'That', 'With', 'From', 'What', 'How', 'Why'].includes(word)) {
        keywords.add(word.toLowerCase().replace(/\s+/g, '-'));
      }
    });

    // Extract phrases in quotes
    const quotedPhrases = text.match(/"([^"]+)"/g) || [];
    quotedPhrases.forEach(phrase => {
      const cleaned = phrase.replace(/"/g, '').trim().toLowerCase();
      if (cleaned.length > 3 && cleaned.length < 40) {
        keywords.add(cleaned.replace(/\s+/g, '-'));
      }
    });

    return Array.from(keywords).slice(0, 25);
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
}
