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
  private keyVoices: TwitterUser[] = [
    { username: 'mertimus', displayName: 'Mert', weight: 3.0 },
    { username: 'aeyakovenko', displayName: 'Anatoly (Toly)', weight: 3.0 },
    { username: 'rajgokal', displayName: 'Raj Gokal', weight: 2.5 },
    { username: 'armaniferrante', displayName: 'Armani Ferrante', weight: 2.5 },
    { username: 'solanafndn', displayName: 'Solana Foundation', weight: 2.0 },
    { username: 'Jupiter_HQ', displayName: 'Jupiter', weight: 2.0 },
  ];

  constructor() {
    this.rssParser = new Parser({
      customFields: {
        item: ['description', 'pubDate']
      }
    });
  }

  async collectTwitterSignals(): Promise<CollectorResult> {
    const signals: Signal[] = [];
    const errors: string[] = [];

    // Try multiple approaches for Twitter data collection
    
    // 1. Try Nitter RSS feeds (if Nitter instances are available)
    const nitterSignals = await this.collectFromNitter();
    signals.push(...nitterSignals);

    // 2. Try RSS alternatives
    const rssSignals = await this.collectFromRSSAlternatives();
    signals.push(...rssSignals);

    // 3. Fallback: Scrape public Solana-related hashtag pages
    const hashtagSignals = await this.collectHashtagActivity();
    signals.push(...hashtagSignals);

    return {
      signals: this.deduplicateSignals(signals),
      collectedAt: Date.now(),
      source: 'twitter',
      errors: errors.length > 0 ? errors : undefined
    };
  }

  private async collectFromNitter(): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    // List of public Nitter instances
    const nitterInstances = [
      'nitter.net',
      'nitter.poast.org',
      'nitter.privacydev.net'
    ];

    for (const user of this.keyVoices) {
      for (const instance of nitterInstances) {
        try {
          const rssUrl = `https://${instance}/${user.username}/rss`;
          const feed = await this.rssParser.parseURL(rssUrl);

          if (feed.items && feed.items.length > 0) {
            for (const item of feed.items.slice(0, 10)) {
              const tweetDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
              const content = this.cleanTweetContent(item.contentSnippet || item.description || '');
              
              // Only include recent tweets (last 14 days)
              if (Date.now() - tweetDate < 14 * 24 * 60 * 60 * 1000) {
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
            
            // If successful, break instance loop
            break;
          }
        } catch (error) {
          // Try next instance
          continue;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return signals;
  }

  private async collectFromRSSAlternatives(): Promise<Signal[]> {
    const signals: Signal[] = [];

    try {
      // Try RSS Hub for Twitter feeds
      const rsshubBase = 'https://rsshub.app/twitter/user';
      
      for (const user of this.keyVoices.slice(0, 3)) { // Limit to avoid rate limits
        try {
          const feed = await this.rssParser.parseURL(`${rsshubBase}/${user.username}`);
          
          if (feed.items) {
            for (const item of feed.items.slice(0, 5)) {
              const content = this.cleanTweetContent(item.contentSnippet || item.description || '');
              const tweetDate = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
              
              if (Date.now() - tweetDate < 14 * 24 * 60 * 60 * 1000) {
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

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.log('RSS alternatives failed');
    }

    return signals;
  }

  private async collectHashtagActivity(): Promise<Signal[]> {
    // Hashtag scraping requires authenticated Twitter API access.
    // When available, this method would scrape #Solana trending topics.
    // Currently returns empty — real signals come from Nitter RSS and RSSHub above.
    return [];
  }

  private cleanTweetContent(content: string): string {
    // Remove HTML tags
    content = content.replace(/<[^>]*>/g, '');
    // Remove URLs
    content = content.replace(/https?:\/\/\S+/g, '');
    // Remove excessive whitespace
    content = content.replace(/\s+/g, ' ').trim();
    return content.substring(0, 280);
  }

  private extractKeywordsFromTweet(content: string): string[] {
    const keywords: Set<string> = new Set();
    
    // Extract hashtags
    const hashtags = content.match(/#\w+/g) || [];
    hashtags.forEach(tag => keywords.add(tag.substring(1).toLowerCase()));
    
    // Extract @mentions
    const mentions = content.match(/@\w+/g) || [];
    mentions.forEach(mention => keywords.add(mention.substring(1).toLowerCase()));
    
    // Extract significant words
    const words = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 3 && 
        !['that', 'this', 'with', 'from', 'have', 'been', 'will', 'your'].includes(word)
      );
    
    words.forEach(word => keywords.add(word));
    
    // Solana-specific terms get priority
    const solanaTerms = ['solana', 'sol', 'defi', 'nft', 'dapp', 'web3', 'crypto', 'blockchain'];
    solanaTerms.forEach(term => {
      if (content.toLowerCase().includes(term)) {
        keywords.add(term);
      }
    });
    
    return Array.from(keywords).slice(0, 20);
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
