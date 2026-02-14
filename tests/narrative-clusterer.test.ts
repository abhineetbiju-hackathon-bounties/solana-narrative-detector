import { NarrativeClusterer } from '../src/analysis/narrative-clusterer';
import { ProcessedSignal } from '../src/analysis/signal-detector';

// Expose private methods for testing
class TestableClusterer extends NarrativeClusterer {
    public testNormalizeKeywords(keywords: string[]): string[] {
        return (this as any).normalizeKeywords(keywords);
    }

    public testIsNoisyKeyword(kw: string): boolean {
        return (this as any).isNoisyKeyword(kw);
    }

    public testIdentifyTheme(keywords: string[]): string {
        return (this as any).identifyTheme(keywords);
    }
}

function makeSignal(overrides: Partial<ProcessedSignal> = {}): ProcessedSignal {
    return {
        id: `test_${Math.random().toString(36).slice(2)}`,
        source: 'github',
        timestamp: Date.now(),
        content: 'Test signal content',
        keywords: ['solana', 'defi'],
        weight: 1,
        normalizedWeight: 0.5,
        recencyScore: 0.8,
        crossSourceScore: 1,
        ...overrides,
    };
}

describe('NarrativeClusterer', () => {
    let clusterer: TestableClusterer;

    beforeEach(() => {
        clusterer = new TestableClusterer();
    });

    describe('isNoisyKeyword', () => {
        it('rejects short words (≤2 chars)', () => {
            expect(clusterer.testIsNoisyKeyword('ab')).toBe(true);
            expect(clusterer.testIsNoisyKeyword('x')).toBe(true);
        });

        it('rejects numeric-only strings', () => {
            expect(clusterer.testIsNoisyKeyword('12345')).toBe(true);
        });

        it('rejects username-like patterns', () => {
            expect(clusterer.testIsNoisyKeyword('james09777')).toBe(true);
            expect(clusterer.testIsNoisyKeyword('raad05123')).toBe(true);
        });

        it('rejects common filler words', () => {
            expect(clusterer.testIsNoisyKeyword('looking')).toBe(true);
            expect(clusterer.testIsNoisyKeyword('anyone')).toBe(true);
            expect(clusterer.testIsNoisyKeyword('really')).toBe(true);
        });

        it('accepts ecosystem terms', () => {
            expect(clusterer.testIsNoisyKeyword('jupiter')).toBe(false);
            expect(clusterer.testIsNoisyKeyword('defi')).toBe(false);
            expect(clusterer.testIsNoisyKeyword('firedancer')).toBe(false);
        });
    });

    describe('normalizeKeywords', () => {
        it('maps aliases to canonical terms', () => {
            const result = clusterer.testNormalizeKeywords(['dexes', 'amm', 'swap']);
            expect(result).toContain('dex');
        });

        it('maps liquid staking aliases', () => {
            const result = clusterer.testNormalizeKeywords(['lst', 'liquid-staking']);
            expect(result).toContain('liquid-staking');
        });

        it('filters out noisy keywords', () => {
            const result = clusterer.testNormalizeKeywords(['jupiter', 'looking', 'anyone', 'defi']);
            expect(result).not.toContain('looking');
            expect(result).not.toContain('anyone');
            expect(result).toContain('jupiter');
            expect(result).toContain('defi');
        });

        it('keeps ecosystem terms', () => {
            const result = clusterer.testNormalizeKeywords(['solana', 'jupiter', 'jito']);
            expect(result).toContain('solana');
            expect(result).toContain('jupiter');
            expect(result).toContain('jito');
        });
    });

    describe('identifyTheme', () => {
        it('identifies DeFi theme', () => {
            expect(clusterer.testIdentifyTheme(['defi', 'dex', 'lending'])).toBe('DeFi');
        });

        it('identifies Liquid Staking theme', () => {
            expect(clusterer.testIdentifyTheme(['liquid-staking', 'jito', 'marinade'])).toBe('Liquid Staking');
        });

        it('identifies Infrastructure theme', () => {
            expect(clusterer.testIdentifyTheme(['validator', 'firedancer', 'rpc'])).toBe('Infrastructure');
        });

        it('identifies DePIN theme', () => {
            expect(clusterer.testIdentifyTheme(['depin', 'helium', 'hivemapper'])).toBe('DePIN');
        });

        it('identifies AI & Agents theme', () => {
            expect(clusterer.testIdentifyTheme(['ai', 'ai-agents', 'inference'])).toBe('AI & Agents');
        });
    });

    describe('clusterSignals', () => {
        it('returns empty array for too few signals', () => {
            const signals = [makeSignal(), makeSignal()]; // only 2, min is 3
            expect(clusterer.clusterSignals(signals)).toEqual([]);
        });

        it('clusters similar signals together', () => {
            const signals = [
                makeSignal({ keywords: ['jupiter', 'dex', 'swap', 'defi'], source: 'github' }),
                makeSignal({ keywords: ['jupiter', 'dex', 'aggregator', 'defi'], source: 'onchain' }),
                makeSignal({ keywords: ['jupiter', 'swap', 'trading', 'defi'], source: 'discord' }),
            ];
            const narratives = clusterer.clusterSignals(signals);
            expect(narratives.length).toBeGreaterThanOrEqual(1);
            expect(narratives[0].keywords).toContain('jupiter');
        });

        it('caps output to maxNarratives', () => {
            // Create 30 signals with varied keywords to form many clusters
            const signals = [];
            const topics = ['jupiter', 'jito', 'drift', 'tensor', 'kamino', 'raydium', 'orca', 'pyth', 'helium', 'phantom'];
            for (const topic of topics) {
                for (let i = 0; i < 3; i++) {
                    signals.push(makeSignal({
                        keywords: [topic, 'solana', `keyword-${topic}-${i}`],
                        source: ['github', 'onchain', 'discord'][i] as any,
                    }));
                }
            }
            const narratives = clusterer.clusterSignals(signals);
            expect(narratives.length).toBeLessThanOrEqual(10);
        });

        it('prioritizes multi-source narratives', () => {
            const multiSource = [
                makeSignal({ keywords: ['jupiter', 'dex', 'defi'], source: 'github' }),
                makeSignal({ keywords: ['jupiter', 'dex', 'swap'], source: 'onchain' }),
                makeSignal({ keywords: ['jupiter', 'aggregator', 'defi'], source: 'discord' }),
            ];
            const singleSource = [
                makeSignal({ keywords: ['helium', 'depin', 'iot'], source: 'github' }),
                makeSignal({ keywords: ['helium', 'depin', 'network'], source: 'github' }),
                makeSignal({ keywords: ['helium', 'depin', 'wireless'], source: 'github' }),
            ];
            const narratives = clusterer.clusterSignals([...multiSource, ...singleSource]);

            if (narratives.length >= 2) {
                // Multi-source narrative should score higher
                const jupiterNarrative = narratives.find(n => n.keywords.includes('jupiter'));
                const heliumNarrative = narratives.find(n => n.keywords.includes('helium'));
                if (jupiterNarrative && heliumNarrative) {
                    expect(jupiterNarrative.score).toBeGreaterThan(heliumNarrative.score);
                }
            }
        });
    });
});
