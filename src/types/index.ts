export interface Signal {
  id: string;
  source: 'onchain' | 'github' | 'twitter' | 'discord' | 'report';
  timestamp: number;
  content: string;
  metadata: {
    url?: string;
    author?: string;
    metrics?: Record<string, number>;
    tags?: string[];
  };
  keywords: string[];
  weight: number;
}

export interface Narrative {
  id: string;
  title: string;
  description: string;
  signals: Signal[];
  keywords: string[];
  score: number;
  metrics: {
    crossSourceCount: number;
    velocity: number;
    recency: number;
    keyVoiceMentions: number;
  };
  timestamp: number;
  ideas: ProductIdea[];
}

export interface ProductIdea {
  title: string;
  description: string;
  reasoning: string;
  targetAudience: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  impact: 'Low' | 'Medium' | 'High';
}

export interface CollectorResult {
  signals: Signal[];
  collectedAt: number;
  source: string;
  errors?: string[];
}

export interface AnalysisResult {
  narratives: Narrative[];
  analyzedAt: number;
  dataWindow: {
    start: number;
    end: number;
  };
  stats: {
    totalSignals: number;
    sourcesUsed: string[];
    narrativesDetected: number;
  };
}
