import axios from 'axios';
import * as cheerio from 'cheerio';
import Parser from 'rss-parser';
import { Signal, CollectorResult } from '../types';

interface ReportSource {
  name: string;
  rssUrl?: string;
  websiteUrl?: string;
  weight: number;
}

export class ReportsCollector {
  private rssParser: Parser;
  private sources: ReportSource[] = [
    {
      name: 'Helius Blog',
      rssUrl: 'https://www.helius.dev/blog/rss.xml',
      websiteUrl: 'https://www.helius.dev/blog',
      weight: 2.5
    },
    {
      name: 'Messari Research',
      websiteUrl: 'https://messari.io/research',
      weight: 2.0
    },
    {
      name: 'Solana Foundation Blog',
      rssUrl: 'https://solana.com/news/rss.xml',
      websiteUrl: 'https://solana.com/news',
      weight: 2.5
    }
  ];

  constructor() {
    this.rssParser = new Parser({
      customFields: {
        item: ['description', 'pubDate', 'content:encoded']
      }
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
        } else if (source.websiteUrl) {
          sourceSignals = await this.scrapeWebsite(source);
        }
        
        signals.push(...sourceSignals);
      } catch (error: any) {
        errors.push(`${source.name} collection failed: ${error.message}`);
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
      
      for (const item of feed.items.slice(0, 10)) {
        const pubDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
        
        // Only include articles from last 30 days
        if (Date.now() - pubDate < 30 * 24 * 60 * 60 * 1000) {
          const content = this.extractContent(item);
          const keywords = this.extractKeywordsFromReport(item.title || '', content);
          
          signals.push({
            id: `report_${source.name}_${pubDate}`,
            source: 'report',
            timestamp: pubDate,
            content: `${source.name}: ${item.title} - ${content.substring(0, 200)}`,
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
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      
      // Generic article scraping (adjust selectors based on actual websites)
      const articles = $('article, .post, .blog-post').slice(0, 10);
      
      articles.each((_, element) => {
        const $article = $(element);
        const title = $article.find('h1, h2, h3, .title').first().text().trim();
        const content = $article.find('p, .excerpt, .description').first().text().trim();
        const link = $article.find('a').first().attr('href');
        
        if (title && title.toLowerCase().includes('solana')) {
          const keywords = this.extractKeywordsFromReport(title, content);
          
          signals.push({
            id: `report_scraped_${source.name}_${Date.now()}_${Math.random()}`,
            source: 'report',
            timestamp: Date.now(),
            content: `${source.name}: ${title} - ${content.substring(0, 200)}`,
            metadata: {
              url: link ? this.resolveUrl(source.websiteUrl, link) : source.websiteUrl,
              author: source.name
            },
            keywords,
            weight: source.weight * 0.8 // Slightly lower weight for scraped content
          });
        }
      });
    } catch (error: any) {
      console.error(`Website scraping for ${source.name} failed:`, error.message);
    }

    return signals;
  }

  private extractContent(item: any): string {
    // Try different content fields
    let content = item['content:encoded'] || item.content || item.contentSnippet || item.description || '';
    
    // Clean HTML
    content = content.replace(/<[^>]*>/g, ' ');
    content = content.replace(/\s+/g, ' ').trim();
    
    return content;
  }

  private extractKeywordsFromReport(title: string, content: string): string[] {
    const keywords: Set<string> = new Set();
    const text = `${title} ${content}`.toLowerCase();
    
    // Solana-specific terms
    const solanaTerms = [
      'solana', 'sol', 'defi', 'nft', 'dex', 'amm', 'lending',
      'validator', 'stake', 'liquid-staking', 'jupiter', 'marinade',
      'drift', 'kamino', 'jito', 'tensor', 'magic-eden',
      'compressed-nfts', 'state-compression', 'zk-compression',
      'breakpoint', 'firedancer', 'simd', 'token-extensions',
      'blinks', 'actions', 'mobile', 'saga', 'depin', 'ai'
    ];
    
    solanaTerms.forEach(term => {
      if (text.includes(term.replace(/-/g, ' ')) || text.includes(term)) {
        keywords.add(term);
      }
    });
    
    // Extract capitalized terms (likely important proper nouns)
    const capitalizedWords = (title + ' ' + content).match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    capitalizedWords.forEach(word => {
      if (word.length > 3 && word !== 'The' && word !== 'And') {
        keywords.add(word.toLowerCase().replace(/\s+/g, '-'));
      }
    });
    
    // Extract phrases in quotes (often significant)
    const quotedPhrases = text.match(/"([^"]+)"/g) || [];
    quotedPhrases.forEach(phrase => {
      const cleaned = phrase.replace(/"/g, '').trim().toLowerCase();
      if (cleaned.length > 3) {
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
