import { Narrative, ProductIdea } from '../types';

interface IdeaTemplate {
  category: string;
  patterns: string[];
  targetAudiences: string[];
  generateIdea: (narrative: Narrative, context: any) => ProductIdea | null;
}

export class IdeaGenerator {
  private templates: IdeaTemplate[];

  constructor() {
    this.templates = this.buildIdeaTemplates();
  }

  generateIdeas(narrative: Narrative): ProductIdea[] {
    const ideas: ProductIdea[] = [];
    const context = this.analyzeNarrativeContext(narrative);

    // Try each template
    for (const template of this.templates) {
      if (ideas.length >= 5) break;

      const idea = template.generateIdea(narrative, context);
      if (idea && !this.isDuplicate(idea, ideas)) {
        ideas.push(idea);
      }
    }

    // Ensure we have at least 3 ideas
    while (ideas.length < 3) {
      ideas.push(this.generateGenericIdea(narrative, ideas.length));
    }

    return ideas.slice(0, 5);
  }

  private analyzeNarrativeContext(narrative: Narrative) {
    const keywords = new Set(narrative.keywords);
    
    return {
      hasDev: keywords.has('sdk') || keywords.has('api') || keywords.has('framework') || keywords.has('tools'),
      hasUser: keywords.has('app') || keywords.has('dapp') || keywords.has('marketplace') || keywords.has('platform'),
      hasOnchain: narrative.signals.some(s => s.source === 'onchain'),
      hasGithub: narrative.signals.some(s => s.source === 'github'),
      hasHighVelocity: narrative.metrics.velocity > 1.5,
      isInfra: keywords.has('infrastructure') || keywords.has('validator') || keywords.has('rpc'),
      isFinance: keywords.has('defi') || keywords.has('lending') || keywords.has('dex'),
      isNFT: keywords.has('nft') || keywords.has('collection') || keywords.has('marketplace'),
      isGaming: keywords.has('gaming') || keywords.has('game'),
      keywords: Array.from(keywords)
    };
  }

  private buildIdeaTemplates(): IdeaTemplate[] {
    return [
      // Developer Tools Template
      {
        category: 'Developer Tools',
        patterns: ['sdk', 'api', 'framework', 'tools', 'cli'],
        targetAudiences: ['developers', 'builders'],
        generateIdea: (narrative, ctx) => {
          if (!ctx.hasDev && !ctx.hasGithub) return null;
          
          const mainKeyword = narrative.keywords[0];
          return {
            title: `Developer SDK for ${this.formatKeyword(mainKeyword)}`,
            description: `Build a comprehensive TypeScript/Rust SDK that simplifies integration with ${mainKeyword}-related protocols. Include code examples, CLI tools, and testing utilities.`,
            reasoning: `With ${narrative.signals.length} signals showing development activity, there's clear demand for tooling. Developers need easier ways to build on this narrative.`,
            targetAudience: 'Solana developers building dApps',
            difficulty: 'Medium',
            impact: 'High'
          };
        }
      },
      
      // Aggregator/Dashboard Template
      {
        category: 'Analytics',
        patterns: ['data', 'metrics', 'tracking', 'analytics'],
        targetAudiences: ['traders', 'analysts', 'users'],
        generateIdea: (narrative, ctx) => {
          const theme = narrative.title.split(':')[0];
          return {
            title: `${theme} Analytics Dashboard`,
            description: `Real-time dashboard aggregating all ${theme.toLowerCase()} activity on Solana. Track metrics, compare protocols, and identify trends before they go mainstream.`,
            reasoning: `Cross-source signals (${narrative.metrics.crossSourceCount} sources) indicate fragmented information. Users need a single place to monitor this space.`,
            targetAudience: 'Traders, researchers, and power users',
            difficulty: 'Medium',
            impact: 'Medium'
          };
        }
      },
      
      // User-Facing App Template
      {
        category: 'User Application',
        patterns: ['app', 'platform', 'marketplace', 'interface'],
        targetAudiences: ['end-users', 'consumers'],
        generateIdea: (narrative, ctx) => {
          if (ctx.isFinance) {
            return {
              title: 'Simplified DeFi Aggregator',
              description: `User-friendly mobile app that aggregates best rates across ${narrative.keywords.filter(k => k.includes('dex') || k.includes('lending')).slice(0, 3).join(', ')} protocols. One-tap optimal routing.`,
              reasoning: `High velocity (${narrative.metrics.velocity.toFixed(1)}x) shows rapid innovation, but complexity is increasing. Users need simplification.`,
              targetAudience: 'Crypto newcomers and mobile-first users',
              difficulty: 'Medium',
              impact: 'High'
            };
          } else if (ctx.isNFT) {
            return {
              title: 'NFT Discovery & Trading Bot',
              description: 'Telegram/Discord bot for real-time NFT mint alerts, floor price tracking, and instant buying. Focus on the emerging collections in this narrative.',
              reasoning: `${narrative.signals.length} signals suggest active NFT ecosystem growth. Traders need faster ways to discover and act on opportunities.`,
              targetAudience: 'NFT traders and collectors',
              difficulty: 'Easy',
              impact: 'Medium'
            };
          }
          return null;
        }
      },
      
      // Infrastructure/Backend Template
      {
        category: 'Infrastructure',
        patterns: ['rpc', 'validator', 'infrastructure', 'node'],
        targetAudiences: ['protocols', 'developers'],
        generateIdea: (narrative, ctx) => {
          if (!ctx.isInfra) return null;
          
          return {
            title: 'Specialized RPC Service',
            description: `High-performance RPC endpoints optimized for ${narrative.keywords[0]}-related transactions. Features: priority routing, caching, and webhook notifications.`,
            reasoning: `Onchain activity signals show demand for infrastructure. Specialized RPCs can offer better performance than general-purpose providers.`,
            targetAudience: 'dApp developers and protocols',
            difficulty: 'Hard',
            impact: 'High'
          };
        }
      },
      
      // Educational/Content Template
      {
        category: 'Education',
        patterns: ['tutorial', 'guide', 'learn'],
        targetAudiences: ['beginners', 'developers'],
        generateIdea: (narrative, ctx) => {
          const theme = narrative.title.split(':')[0];
          return {
            title: `"${theme} on Solana" Interactive Course`,
            description: `Comprehensive video course + interactive coding challenges teaching developers how to build in this space. Include real-world examples from detected protocols.`,
            reasoning: `Emerging narrative with ${narrative.metrics.keyVoiceMentions} key voice mentions. Early educational content can capture attention as ecosystem grows.`,
            targetAudience: 'Developers new to this Solana vertical',
            difficulty: 'Medium',
            impact: 'Medium'
          };
        }
      },
      
      // Automation/Bot Template
      {
        category: 'Automation',
        patterns: ['bot', 'automation', 'alert'],
        targetAudiences: ['traders', 'power-users'],
        generateIdea: (narrative, ctx) => {
          if (!ctx.hasHighVelocity) return null;
          
          return {
            title: 'Smart Alert & Automation Platform',
            description: `Custom alerts and automated actions for ${narrative.keywords.slice(0, 3).join(', ')} events. Set conditions, get notified, auto-execute strategies.`,
            reasoning: `High velocity (${narrative.metrics.velocity.toFixed(1)}x growth) means things move fast. Users need automation to keep up and capitalize on opportunities.`,
            targetAudience: 'Active traders and strategists',
            difficulty: 'Medium',
            impact: 'Medium'
          };
        }
      },
      
      // Integration/Bridge Template
      {
        category: 'Integration',
        patterns: ['integration', 'bridge', 'connect'],
        targetAudiences: ['developers', 'protocols'],
        generateIdea: (narrative, ctx) => {
          const mainKeyword = narrative.keywords[0];
          return {
            title: `${this.formatKeyword(mainKeyword)} Integration Layer`,
            description: `Middleware that connects existing Solana apps to emerging ${mainKeyword} protocols. Plug-and-play integration for wallets, dApps, and marketplaces.`,
            reasoning: `Multiple protocols detected (${narrative.signals.length} signals) but no standard integration. First-mover advantage for abstraction layer.`,
            targetAudience: 'Existing Solana protocols and dApps',
            difficulty: 'Hard',
            impact: 'High'
          };
        }
      },
      
      // Data/Index Template
      {
        category: 'Data Infrastructure',
        patterns: ['index', 'query', 'data', 'archive'],
        targetAudiences: ['developers', 'analysts'],
        generateIdea: (narrative, ctx) => {
          if (!ctx.hasOnchain) return null;
          
          const theme = narrative.title.split(':')[0];
          return {
            title: `${theme} Data Indexer`,
            description: `Fast, queryable index of all ${theme.toLowerCase()}-related onchain data. GraphQL API, historical data, and real-time subscriptions.`,
            reasoning: `Onchain signals detected but data is scattered. Protocols need indexed data for UIs, analytics, and integrations.`,
            targetAudience: 'dApp developers and data analysts',
            difficulty: 'Hard',
            impact: 'High'
          };
        }
      }
    ];
  }

  private generateGenericIdea(narrative: Narrative, index: number): ProductIdea {
    const fallbackIdeas = [
      {
        title: `${narrative.title} Monitoring Tool`,
        description: `Build a specialized monitoring tool that tracks all activity related to this narrative. Alert users to new developments, protocol launches, and market movements.`,
        reasoning: `Generic monitoring needs exist for any emerging narrative. First-to-market monitoring tools capture engaged early adopters.`,
        targetAudience: 'Early adopters and researchers',
        difficulty: 'Easy' as const,
        impact: 'Low' as const
      },
      {
        title: `Community Hub for ${narrative.title}`,
        description: `Create a Discord/Telegram community focused on this specific narrative. Curate news, host AMAs with builders, and facilitate collaboration.`,
        reasoning: `Community formation around new narratives creates value. Early community leaders gain influence and can monetize through content/consulting.`,
        targetAudience: 'Community builders and enthusiasts',
        difficulty: 'Easy' as const,
        impact: 'Medium' as const
      },
      {
        title: `Newsletter Covering ${narrative.title}`,
        description: `Weekly newsletter aggregating all developments in this narrative. Include analysis, interviews, and investment insights.`,
        reasoning: `Information is fragmented across sources. Curated newsletter provides value to busy professionals tracking this space.`,
        targetAudience: 'Investors, builders, and ecosystem participants',
        difficulty: 'Easy' as const,
        impact: 'Low' as const
      }
    ];

    return fallbackIdeas[index % fallbackIdeas.length];
  }

  private formatKeyword(keyword: string): string {
    return keyword
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private isDuplicate(idea: ProductIdea, existingIdeas: ProductIdea[]): boolean {
    return existingIdeas.some(existing => 
      existing.title.toLowerCase() === idea.title.toLowerCase() ||
      this.calculateSimilarity(existing.description, idea.description) > 0.7
    );
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = new Set(str1.toLowerCase().split(/\s+/));
    const words2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }
}
