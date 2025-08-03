import { HybridSearchResult } from './HybridSearchEngine';
import { ContentChunk } from './ContentProcessor';
import { QueryComponent, QueryContext } from './QueryDecomposer';
import { FileClassification } from './FileClassifier';

export interface RankingCriteria {
  name: string;
  weight: number; // 0.0 to 1.0
  type: 'metadata' | 'content' | 'context' | 'temporal' | 'social' | 'quality';
  enabled: boolean;
  configuration: Record<string, any>;
}

export interface DynamicRankingOptions {
  criteria: RankingCriteria[];
  adaptiveWeights: boolean; // Adjust weights based on query context
  learningEnabled: boolean; // Learn from user interactions
  diversityPromotion: boolean; // Promote diverse results
  freshnessBias: number; // 0.0 to 1.0, bias towards newer content
  authorityBias: number; // 0.0 to 1.0, bias towards authoritative sources
  personalizedRanking: boolean; // Use user preferences
}

export interface RankingSignal {
  name: string;
  value: number;
  confidence: number;
  source: 'metadata' | 'analysis' | 'user_behavior' | 'external';
  explanation: string;
}

export interface RankedResult extends HybridSearchResult {
  rankingSignals: RankingSignal[];
  finalRankingScore: number;
  rankingExplanation: string;
  confidenceScore: number;
  freshnessFactor: number;
  authorityFactor: number;
  diversityFactor: number;
  personalizedFactor: number;
}

export interface MetadataFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'range' | 'in' | 'exists' | 'not' | 'and' | 'or';
  value: any;
  weight: number;
  adaptive: boolean; // Adjust based on query context
  temporal: boolean; // Consider temporal aspects
}

export interface FilterRule {
  id: string;
  name: string;
  condition: MetadataFilter[];
  action: 'boost' | 'demote' | 'exclude' | 'require';
  strength: number; // How much to boost/demote (0.0 to 2.0)
  priority: number; // Rule application order
  context: string[]; // When this rule applies
  enabled: boolean;
}

export interface UserPreference {
  userId: string;
  frameworkPreferences: Record<string, number>; // framework -> preference score
  contentTypePreferences: Record<string, number>; // content type -> preference score
  complexityPreference: number; // -1.0 (simple) to 1.0 (complex)
  freshnessPreference: number; // 0.0 (age doesn't matter) to 1.0 (prefer fresh)
  authorityPreference: number; // 0.0 to 1.0
  interactionHistory: UserInteraction[];
  learningEnabled: boolean;
}

export interface UserInteraction {
  timestamp: Date;
  queryId: string;
  resultId: string;
  action: 'click' | 'copy' | 'bookmark' | 'dismiss' | 'rate';
  value?: number; // For ratings
  context: Record<string, any>;
}

export interface RankingMetrics {
  precision: number;
  recall: number;
  ndcg: number; // Normalized Discounted Cumulative Gain
  averageRankingScore: number;
  diversityScore: number;
  userSatisfactionScore: number;
}

export class DynamicRankingEngine {
  private filterRules: Map<string, FilterRule> = new Map();
  private userPreferences: Map<string, UserPreference> = new Map();
  private rankingHistory: Map<string, RankedResult[]> = new Map();
  private temporalFactors: Map<string, number> = new Map();
  private authorityScores: Map<string, number> = new Map();

  constructor() {
    this.initializeDefaultRules();
    this.initializeTemporalFactors();
  }

  async rankResults(
    results: HybridSearchResult[],
    query: string,
    components: QueryComponent[],
    context: QueryContext,
    options: DynamicRankingOptions
  ): Promise<RankedResult[]> {
    console.log(`🎯 Phase 4: Applying dynamic ranking to ${results.length} results`);

    if (results.length === 0) return [];

    // Step 1: Calculate ranking signals for each result
    const resultsWithSignals = await this.calculateRankingSignals(results, query, components, context, options);

    // Step 2: Apply metadata filters
    const filteredResults = this.applyMetadataFilters(resultsWithSignals, components, context, options);

    // Step 3: Calculate final ranking scores
    const rankedResults = this.calculateFinalRankingScores(filteredResults, query, context, options);

    // Step 4: Apply diversification if enabled
    const diversifiedResults = options.diversityPromotion 
      ? this.applyDiversification(rankedResults, options)
      : rankedResults;

    // Step 5: Apply personalization if enabled
    const personalizedResults = options.personalizedRanking
      ? this.applyPersonalization(diversifiedResults, context, options)
      : diversifiedResults;

    // Step 6: Final sort and limit
    const finalResults = personalizedResults
      .sort((a, b) => b.finalRankingScore - a.finalRankingScore)
      .slice(0, 50); // Reasonable limit

    // Step 7: Store results for learning if enabled
    if (options.learningEnabled) {
      this.storeRankingHistory(query, finalResults);
    }

    console.log(`🎯 Final ranking: ${finalResults.length} results with avg score ${this.calculateAverageScore(finalResults).toFixed(3)}`);

    return finalResults;
  }

  private async calculateRankingSignals(
    results: HybridSearchResult[],
    query: string,
    components: QueryComponent[],
    context: QueryContext,
    options: DynamicRankingOptions
  ): Promise<RankedResult[]> {
    const rankedResults: RankedResult[] = [];

    for (const result of results) {
      const signals: RankingSignal[] = [];

      // Content-based signals
      if (result.chunk) {
        signals.push(...this.calculateContentSignals(result.chunk, query, components));
      }

      // Metadata-based signals
      signals.push(...this.calculateMetadataSignals(result, context));

      // Temporal signals
      signals.push(...this.calculateTemporalSignals(result));

      // Quality signals
      signals.push(...this.calculateQualitySignals(result));

      // Context signals
      signals.push(...this.calculateContextSignals(result, components, context));

      // Social/authority signals
      signals.push(...this.calculateAuthoritySignals(result));

      const rankedResult: RankedResult = {
        ...result,
        rankingSignals: signals,
        finalRankingScore: result.combinedScore, // Will be recalculated
        rankingExplanation: '',
        confidenceScore: this.calculateConfidenceScore(signals),
        freshnessFactor: this.calculateFreshnessFactor(result),
        authorityFactor: this.calculateAuthorityFactor(result),
        diversityFactor: 0, // Will be calculated later
        personalizedFactor: 0 // Will be calculated later
      };

      rankedResults.push(rankedResult);
    }

    return rankedResults;
  }

  private calculateContentSignals(chunk: ContentChunk, query: string, components: QueryComponent[]): RankingSignal[] {
    const signals: RankingSignal[] = [];

    // Content length signal
    const length = chunk.content.length;
    const lengthScore = this.normalizeContentLength(length);
    signals.push({
      name: 'content_length_quality',
      value: lengthScore,
      confidence: 0.7,
      source: 'analysis',
      explanation: `Content length (${length} chars) indicates ${lengthScore > 0.7 ? 'comprehensive' : lengthScore > 0.4 ? 'adequate' : 'brief'} coverage`
    });

    // Code structure signal
    const structureScore = this.analyzeCodeStructure(chunk.content);
    signals.push({
      name: 'code_structure_quality',
      value: structureScore,
      confidence: 0.8,
      source: 'analysis',
      explanation: `Code structure analysis: ${structureScore > 0.7 ? 'well-structured' : structureScore > 0.4 ? 'moderately structured' : 'needs improvement'}`
    });

    // Documentation signal
    const docScore = this.analyzeDocumentation(chunk.content);
    signals.push({
      name: 'documentation_quality',
      value: docScore,
      confidence: 0.6,
      source: 'analysis',
      explanation: `Documentation coverage: ${docScore > 0.7 ? 'well-documented' : docScore > 0.4 ? 'some documentation' : 'minimal documentation'}`
    });

    // Query alignment signal
    const alignmentScore = this.calculateQueryAlignment(chunk.content, query, components);
    signals.push({
      name: 'query_alignment',
      value: alignmentScore,
      confidence: 0.9,
      source: 'analysis',
      explanation: `Query alignment: ${alignmentScore > 0.8 ? 'highly relevant' : alignmentScore > 0.5 ? 'relevant' : 'somewhat relevant'}`
    });

    return signals;
  }

  private calculateMetadataSignals(result: HybridSearchResult, context: QueryContext): RankingSignal[] {
    const signals: RankingSignal[] = [];

    if (!result.chunk) return signals;

    // Importance signal
    const importance = result.chunk.metadata.importance;
    signals.push({
      name: 'metadata_importance',
      value: importance,
      confidence: 0.8,
      source: 'metadata',
      explanation: `Component importance: ${importance > 0.8 ? 'critical' : importance > 0.6 ? 'important' : importance > 0.4 ? 'moderate' : 'low'}`
    });

    // Framework alignment signal
    const frameworkScore = this.calculateFrameworkAlignment(result.chunk, context);
    signals.push({
      name: 'framework_alignment',
      value: frameworkScore,
      confidence: 0.7,
      source: 'metadata',
      explanation: `Framework alignment: ${frameworkScore > 0.8 ? 'exact match' : frameworkScore > 0.5 ? 'compatible' : 'different framework'}`
    });

    // Complexity signal
    const complexity = result.chunk.metadata.complexity;
    const complexityScore = this.normalizeComplexity(complexity);
    signals.push({
      name: 'complexity_appropriateness',
      value: complexityScore,
      confidence: 0.6,
      source: 'metadata',
      explanation: `Complexity level: ${complexity > 8 ? 'high' : complexity > 5 ? 'moderate' : 'low'}`
    });

    return signals;
  }

  private calculateTemporalSignals(result: HybridSearchResult): RankingSignal[] {
    const signals: RankingSignal[] = [];

    if (!result.chunk?.metadata.lastModified) return signals;

    const lastModified = result.chunk.metadata.lastModified;
    const daysSinceModified = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60 * 24);

    // Freshness signal
    const freshnessScore = Math.max(0, 1 - daysSinceModified / 365); // Decay over a year
    signals.push({
      name: 'content_freshness',
      value: freshnessScore,
      confidence: 0.8,
      source: 'metadata',
      explanation: `Last modified ${Math.round(daysSinceModified)} days ago`
    });

    // Update frequency signal (if available)
    const updateFreq = this.temporalFactors.get(result.chunk.id) || 0;
    signals.push({
      name: 'update_frequency',
      value: Math.min(1, updateFreq / 10), // Normalize to 0-1
      confidence: 0.5,
      source: 'analysis',
      explanation: `Update frequency: ${updateFreq > 5 ? 'frequently updated' : updateFreq > 2 ? 'occasionally updated' : 'rarely updated'}`
    });

    return signals;
  }

  private calculateQualitySignals(result: HybridSearchResult): RankingSignal[] {
    const signals: RankingSignal[] = [];

    if (!result.chunk) return signals;

    // Error indicators signal
    const errorScore = this.analyzeErrorIndicators(result.chunk.content);
    signals.push({
      name: 'error_free_quality',
      value: 1 - errorScore, // Invert so higher is better
      confidence: 0.7,
      source: 'analysis',
      explanation: `Code quality: ${errorScore < 0.2 ? 'clean' : errorScore < 0.5 ? 'some issues' : 'needs attention'}`
    });

    // Best practices signal
    const bestPracticesScore = this.analyzeBestPractices(result.chunk.content);
    signals.push({
      name: 'best_practices_adherence',
      value: bestPracticesScore,
      confidence: 0.6,
      source: 'analysis',
      explanation: `Best practices: ${bestPracticesScore > 0.7 ? 'follows best practices' : bestPracticesScore > 0.4 ? 'mostly good' : 'room for improvement'}`
    });

    // Test coverage signal (if available)
    const testCoverage = this.estimateTestCoverage(result.chunk);
    signals.push({
      name: 'test_coverage',
      value: testCoverage,
      confidence: 0.5,
      source: 'analysis',
      explanation: `Test coverage: ${testCoverage > 0.8 ? 'well-tested' : testCoverage > 0.5 ? 'some tests' : 'limited testing'}`
    });

    return signals;
  }

  private calculateContextSignals(
    result: HybridSearchResult,
    components: QueryComponent[],
    context: QueryContext
  ): RankingSignal[] {
    const signals: RankingSignal[] = [];

    if (!result.chunk) return signals;

    // Component type alignment signal
    const typeAlignment = this.calculateComponentTypeAlignment(result.chunk, components);
    signals.push({
      name: 'component_type_alignment',
      value: typeAlignment,
      confidence: 0.8,
      source: 'context',
      explanation: `Component type matches query intent: ${typeAlignment > 0.8 ? 'perfect match' : typeAlignment > 0.5 ? 'good match' : 'partial match'}`
    });

    // Scope appropriateness signal
    const scopeScore = this.calculateScopeApproppriateness(result.chunk, components);
    signals.push({
      name: 'scope_appropriateness',
      value: scopeScore,
      confidence: 0.7,
      source: 'context',
      explanation: `Scope alignment: ${scopeScore > 0.8 ? 'perfect scope' : scopeScore > 0.5 ? 'appropriate scope' : 'scope mismatch'}`
    });

    // User role relevance signal
    const roleRelevance = this.calculateUserRoleRelevance(result.chunk, context);
    signals.push({
      name: 'user_role_relevance',
      value: roleRelevance,
      confidence: 0.6,
      source: 'context',
      explanation: `Relevance to ${context.userRole}: ${roleRelevance > 0.7 ? 'highly relevant' : roleRelevance > 0.4 ? 'relevant' : 'less relevant'}`
    });

    return signals;
  }

  private calculateAuthoritySignals(result: HybridSearchResult): RankingSignal[] {
    const signals: RankingSignal[] = [];

    if (!result.chunk) return signals;

    // Authority score from external sources
    const authorityScore = this.authorityScores.get(result.chunk.id) || 0.5;
    signals.push({
      name: 'external_authority',
      value: authorityScore,
      confidence: 0.4,
      source: 'external',
      explanation: `Authority score: ${authorityScore > 0.8 ? 'highly authoritative' : authorityScore > 0.6 ? 'authoritative' : 'standard'}`
    });

    // Reference count signal (if available)
    const refCount = result.chunk.dependencies?.length || 0;
    const refScore = Math.min(1, refCount / 10); // Normalize to 0-1
    signals.push({
      name: 'reference_count',
      value: refScore,
      confidence: 0.5,
      source: 'analysis',
      explanation: `Referenced by ${refCount} other components`
    });

    return signals;
  }

  private applyMetadataFilters(
    results: RankedResult[],
    components: QueryComponent[],
    context: QueryContext,
    options: DynamicRankingOptions
  ): RankedResult[] {
    let filteredResults = [...results];

    // Apply global filter rules
    for (const rule of this.filterRules.values()) {
      if (!rule.enabled || !this.isRuleApplicable(rule, context)) continue;

      filteredResults = this.applyFilterRule(filteredResults, rule);
    }

    // Apply component-specific filters
    for (const component of components) {
      for (const filter of component.filters) {
        filteredResults = this.applyComponentFilter(filteredResults, filter);
      }
    }

    return filteredResults;
  }

  private calculateFinalRankingScores(
    results: RankedResult[],
    query: string,
    context: QueryContext,
    options: DynamicRankingOptions
  ): RankedResult[] {
    for (const result of results) {
      let finalScore = result.combinedScore;
      const explanations: string[] = [];

      // Apply ranking criteria
      for (const criteria of options.criteria) {
        if (!criteria.enabled) continue;

        const signalValue = this.getSignalValue(result.rankingSignals, criteria.name);
        if (signalValue !== null) {
          const weightedContribution = signalValue * criteria.weight;
          finalScore += weightedContribution;
          explanations.push(`${criteria.name}: ${(weightedContribution * 100).toFixed(1)}%`);
        }
      }

      // Apply freshness bias
      if (options.freshnessBias > 0) {
        const freshnessBoost = result.freshnessFactor * options.freshnessBias * 0.1;
        finalScore += freshnessBoost;
        if (freshnessBoost > 0.01) {
          explanations.push(`freshness boost: ${(freshnessBoost * 100).toFixed(1)}%`);
        }
      }

      // Apply authority bias
      if (options.authorityBias > 0) {
        const authorityBoost = result.authorityFactor * options.authorityBias * 0.1;
        finalScore += authorityBoost;
        if (authorityBoost > 0.01) {
          explanations.push(`authority boost: ${(authorityBoost * 100).toFixed(1)}%`);
        }
      }

      result.finalRankingScore = finalScore;
      result.rankingExplanation = explanations.join(', ') || 'base scoring';
    }

    return results;
  }

  private applyDiversification(results: RankedResult[], options: DynamicRankingOptions): RankedResult[] {
    const diversifiedResults: RankedResult[] = [];
    const seenTypes = new Set<string>();
    const seenFrameworks = new Set<string>();
    const seenComplexities = new Set<string>();

    for (const result of results) {
      let diversityBonus = 0;

      if (result.chunk) {
        const chunkType = result.chunk.metadata.type;
        const framework = result.chunk.metadata.framework;
        const complexity = this.getComplexityCategory(result.chunk.metadata.complexity);

        // Type diversity
        if (!seenTypes.has(chunkType)) {
          diversityBonus += 0.05;
          seenTypes.add(chunkType);
        }

        // Framework diversity
        if (framework && !seenFrameworks.has(framework)) {
          diversityBonus += 0.05;
          seenFrameworks.add(framework);
        }

        // Complexity diversity
        if (!seenComplexities.has(complexity)) {
          diversityBonus += 0.03;
          seenComplexities.add(complexity);
        }
      }

      result.diversityFactor = diversityBonus;
      result.finalRankingScore += diversityBonus;
      diversifiedResults.push(result);
    }

    return diversifiedResults;
  }

  private applyPersonalization(
    results: RankedResult[],
    context: QueryContext,
    options: DynamicRankingOptions
  ): RankedResult[] {
    const userId = context.userProfile?.userId;
    if (!userId) return results;

    const userPrefs = this.userPreferences.get(userId);
    if (!userPrefs || !userPrefs.learningEnabled) return results;

    for (const result of results) {
      if (!result.chunk) continue;

      let personalizationBoost = 0;

      // Framework preference
      const framework = result.chunk.metadata.framework;
      if (framework && userPrefs.frameworkPreferences[framework]) {
        personalizationBoost += userPrefs.frameworkPreferences[framework] * 0.1;
      }

      // Content type preference
      const contentType = result.chunk.metadata.type;
      if (userPrefs.contentTypePreferences[contentType]) {
        personalizationBoost += userPrefs.contentTypePreferences[contentType] * 0.08;
      }

      // Complexity preference alignment
      const complexity = result.chunk.metadata.complexity;
      const normalizedComplexity = (complexity - 5) / 5; // Normalize to -1 to 1
      const complexityAlignment = 1 - Math.abs(normalizedComplexity - userPrefs.complexityPreference);
      personalizationBoost += complexityAlignment * 0.05;

      result.personalizedFactor = personalizationBoost;
      result.finalRankingScore += personalizationBoost;
    }

    return results;
  }

  // Utility methods for signal calculation
  private normalizeContentLength(length: number): number {
    // Optimal length is around 500-2000 characters
    if (length < 100) return 0.3;
    if (length < 500) return 0.6 + (length - 100) / 400 * 0.2;
    if (length <= 2000) return 0.8 + (length - 500) / 1500 * 0.2;
    if (length <= 5000) return 1.0 - (length - 2000) / 3000 * 0.3;
    return 0.7;
  }

  private analyzeCodeStructure(content: string): number {
    let score = 0.5; // Base score

    // Check for proper structure indicators
    if (content.includes('class ') || content.includes('interface ')) score += 0.2;
    if (content.includes('function ') || content.includes('def ')) score += 0.15;
    if (content.includes('import ') || content.includes('require(')) score += 0.1;
    if (content.includes('{') && content.includes('}')) score += 0.1;

    // Check for organization indicators
    const lines = content.split('\n');
    const indentedLines = lines.filter(line => line.match(/^\s+/)).length;
    if (indentedLines / lines.length > 0.3) score += 0.1;

    return Math.min(1.0, score);
  }

  private analyzeDocumentation(content: string): number {
    let score = 0;

    // Check for various documentation patterns
    if (content.includes('/**') || content.includes('"""')) score += 0.4;
    if (content.includes('//') || content.includes('#')) score += 0.2;
    if (content.includes('@param') || content.includes('@return')) score += 0.2;
    if (content.includes('TODO') || content.includes('FIXME')) score += 0.1;

    const commentLines = content.split('\n').filter(line => 
      line.trim().startsWith('//') || 
      line.trim().startsWith('#') || 
      line.trim().startsWith('*')
    ).length;
    
    const totalLines = content.split('\n').length;
    const commentRatio = commentLines / totalLines;
    
    if (commentRatio > 0.1) score += 0.2;

    return Math.min(1.0, score);
  }

  private calculateQueryAlignment(content: string, query: string, components: QueryComponent[]): number {
    const contentLower = content.toLowerCase();
    const queryLower = query.toLowerCase();
    let score = 0;

    // Direct query substring match
    if (contentLower.includes(queryLower)) score += 0.3;

    // Component keyword matches
    for (const component of components) {
      for (const keyword of component.keywords) {
        if (contentLower.includes(keyword.toLowerCase())) {
          score += 0.1;
        }
      }
    }

    // Intent alignment
    const intentActions = components.map(c => c.intent.action);
    if (intentActions.includes('find') && (contentLower.includes('function') || contentLower.includes('class'))) {
      score += 0.2;
    }

    return Math.min(1.0, score);
  }

  private calculateFrameworkAlignment(chunk: ContentChunk, context: QueryContext): number {
    if (!chunk.metadata.framework || !context.activeFrameworks) return 0.5;

    const chunkFramework = chunk.metadata.framework.toLowerCase();
    
    for (const activeFramework of context.activeFrameworks) {
      if (chunkFramework.includes(activeFramework.toLowerCase())) {
        return 1.0;
      }
    }

    return 0.3; // Some penalty for framework mismatch
  }

  private normalizeComplexity(complexity: number): number {
    // Moderate complexity (3-7) is often most useful
    if (complexity >= 3 && complexity <= 7) return 1.0;
    if (complexity < 3) return 0.7; // Too simple
    if (complexity > 10) return 0.4; // Too complex
    return 0.8;
  }

  private analyzeErrorIndicators(content: string): number {
    let errorScore = 0;

    // Check for common error indicators
    if (content.includes('TODO')) errorScore += 0.1;
    if (content.includes('FIXME')) errorScore += 0.2;
    if (content.includes('HACK')) errorScore += 0.15;
    if (content.includes('XXX')) errorScore += 0.1;
    if (content.includes('console.log') || content.includes('print(')) errorScore += 0.05;

    // Check for code smells
    const longLines = content.split('\n').filter(line => line.length > 120).length;
    if (longLines > 3) errorScore += 0.1;

    return Math.min(1.0, errorScore);
  }

  private analyzeBestPractices(content: string): number {
    let score = 0.5; // Base score

    // Check for good practices
    if (content.includes('const ') || content.includes('final ')) score += 0.1;
    if (content.includes('try') && content.includes('catch')) score += 0.1;
    if (content.includes('async') || content.includes('await')) score += 0.05;
    if (content.includes('interface') || content.includes('abstract')) score += 0.1;

    // Check for naming conventions
    const camelCaseMatches = content.match(/\b[a-z][a-zA-Z0-9]*\b/g) || [];
    if (camelCaseMatches.length > 0) score += 0.1;

    return Math.min(1.0, score);
  }

  private estimateTestCoverage(chunk: ContentChunk): number {
    const content = chunk.content.toLowerCase();
    
    // Look for test indicators
    if (content.includes('test') || content.includes('spec')) return 0.8;
    if (content.includes('mock') || content.includes('stub')) return 0.6;
    if (content.includes('assert') || content.includes('expect')) return 0.7;
    
    // Estimate based on file structure
    if (chunk.metadata.type.includes('test')) return 0.9;
    if (chunk.metadata.type.includes('util') || chunk.metadata.type.includes('helper')) return 0.4;
    
    return 0.3; // Default low coverage assumption
  }

  private calculateComponentTypeAlignment(chunk: ContentChunk, components: QueryComponent[]): number {
    const chunkType = chunk.metadata.type.toLowerCase();
    
    for (const component of components) {
      // Check if chunk type matches component intent
      if (component.intent.subject.toLowerCase().includes(chunkType)) return 1.0;
      
      // Check for semantic matches
      if (component.intent.action === 'find' && chunkType.includes('function')) return 0.8;
      if (component.intent.action === 'analyze' && chunkType.includes('class')) return 0.8;
    }
    
    return 0.5;
  }

  private calculateScopeApproppriateness(chunk: ContentChunk, components: QueryComponent[]): number {
    for (const component of components) {
      const scope = component.intent.scope;
      
      switch (scope) {
        case 'file':
          return chunk.chunkType.toString().includes('file') ? 1.0 : 0.6;
        case 'class':
          return chunk.metadata.type.includes('class') ? 1.0 : 0.4;
        case 'function':
          return chunk.metadata.type.includes('function') ? 1.0 : 0.4;
        case 'module':
          return chunk.metadata.type.includes('module') ? 1.0 : 0.7;
        case 'project':
          return 0.8; // Project scope fits most results
        default:
          return 0.7;
      }
    }
    
    return 0.7;
  }

  private calculateUserRoleRelevance(chunk: ContentChunk, context: QueryContext): number {
    const userRole = context.userRole;
    const chunkType = chunk.metadata.type.toLowerCase();
    
    switch (userRole) {
      case 'architect':
        return chunkType.includes('config') || chunkType.includes('interface') ? 0.9 : 0.6;
      case 'developer':
        return chunkType.includes('function') || chunkType.includes('class') ? 0.9 : 0.7;
      case 'qa':
        return chunkType.includes('test') ? 0.9 : 0.5;
      case 'devops':
        return chunkType.includes('config') || chunkType.includes('deploy') ? 0.9 : 0.5;
      default:
        return 0.7;
    }
  }

  private calculateConfidenceScore(signals: RankingSignal[]): number {
    if (signals.length === 0) return 0.5;
    
    const avgConfidence = signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length;
    const signalCount = signals.length;
    
    // More signals with higher confidence = higher overall confidence
    return Math.min(1.0, avgConfidence * (1 + Math.log(signalCount) / 10));
  }

  private calculateFreshnessFactor(result: HybridSearchResult): number {
    if (!result.chunk?.metadata.lastModified) return 0.5;
    
    const daysSinceModified = (Date.now() - result.chunk.metadata.lastModified.getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - daysSinceModified / 365);
  }

  private calculateAuthorityFactor(result: HybridSearchResult): number {
    if (!result.chunk) return 0.5;
    
    return this.authorityScores.get(result.chunk.id) || 0.5;
  }

  private getComplexityCategory(complexity: number): string {
    if (complexity <= 3) return 'simple';
    if (complexity <= 7) return 'moderate';
    return 'complex';
  }

  private calculateAverageScore(results: RankedResult[]): number {
    if (results.length === 0) return 0;
    return results.reduce((sum, r) => sum + r.finalRankingScore, 0) / results.length;
  }

  // Filter and rule management
  private applyFilterRule(results: RankedResult[], rule: FilterRule): RankedResult[] {
    const filteredResults: RankedResult[] = [];

    for (const result of results) {
      if (!result.chunk) {
        filteredResults.push(result);
        continue;
      }

      const matches = this.evaluateFilterConditions(result.chunk, rule.condition);
      
      switch (rule.action) {
        case 'exclude':
          if (!matches) filteredResults.push(result);
          break;
        case 'require':
          if (matches) filteredResults.push(result);
          break;
        case 'boost':
          if (matches) result.finalRankingScore *= (1 + rule.strength);
          filteredResults.push(result);
          break;
        case 'demote':
          if (matches) result.finalRankingScore *= (1 - rule.strength);
          filteredResults.push(result);
          break;
        default:
          filteredResults.push(result);
      }
    }

    return filteredResults;
  }

  private applyComponentFilter(results: RankedResult[], filter: any): RankedResult[] {
    // Implementation of component-specific filtering
    return results.filter(result => {
      if (!result.chunk) return true;
      
      // Apply the filter based on field and operator
      return this.evaluateFilter(result.chunk, filter);
    });
  }

  private evaluateFilterConditions(chunk: ContentChunk, conditions: MetadataFilter[]): boolean {
    return conditions.every(condition => this.evaluateFilter(chunk, condition));
  }

  private evaluateFilter(chunk: ContentChunk, filter: any): boolean {
    const fieldValue = this.getFieldValue(chunk, filter.field);
    
    switch (filter.operator) {
      case 'equals':
        return fieldValue === filter.value;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(filter.value).toLowerCase());
      case 'startsWith':
        return String(fieldValue).toLowerCase().startsWith(String(filter.value).toLowerCase());
      case 'endsWith':
        return String(fieldValue).toLowerCase().endsWith(String(filter.value).toLowerCase());
      case 'in':
        return Array.isArray(filter.value) && filter.value.includes(fieldValue);
      case 'range':
        return Array.isArray(filter.value) && 
               typeof fieldValue === 'number' &&
               fieldValue >= filter.value[0] && 
               fieldValue <= filter.value[1];
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      default:
        return true;
    }
  }

  private getFieldValue(chunk: ContentChunk, field: string): any {
    const fieldPath = field.split('.');
    let value: any = chunk;
    
    for (const part of fieldPath) {
      value = value?.[part];
    }
    
    return value;
  }

  private isRuleApplicable(rule: FilterRule, context: QueryContext): boolean {
    if (rule.context.length === 0) return true;
    
    return rule.context.some(ctx => {
      switch (ctx) {
        case 'development':
          return context.userRole === 'developer';
        case 'testing':
          return context.userRole === 'qa';
        case 'architecture':
          return context.userRole === 'architect';
        default:
          return true;
      }
    });
  }

  private getSignalValue(signals: RankingSignal[], signalName: string): number | null {
    const signal = signals.find(s => s.name === signalName);
    return signal ? signal.value : null;
  }

  private storeRankingHistory(query: string, results: RankedResult[]): void {
    this.rankingHistory.set(query, results);
    
    // Keep only recent history (last 100 queries)
    if (this.rankingHistory.size > 100) {
      const oldestKey = this.rankingHistory.keys().next().value;
      this.rankingHistory.delete(oldestKey);
    }
  }

  private initializeDefaultRules(): void {
    // High-importance boost rule
    this.filterRules.set('boost_important', {
      id: 'boost_important',
      name: 'Boost High Importance Content',
      condition: [{
        field: 'metadata.importance',
        operator: 'range',
        value: [0.8, 1.0],
        weight: 1.0,
        adaptive: false,
        temporal: false
      }],
      action: 'boost',
      strength: 0.2,
      priority: 1,
      context: [],
      enabled: true
    });

    // Test code demote rule for production queries
    this.filterRules.set('demote_test_in_prod', {
      id: 'demote_test_in_prod',
      name: 'Demote Test Code in Production Context',
      condition: [{
        field: 'metadata.type',
        operator: 'contains',
        value: 'test',
        weight: 1.0,
        adaptive: false,
        temporal: false
      }],
      action: 'demote',
      strength: 0.3,
      priority: 2,
      context: ['production'],
      enabled: true
    });
  }

  private initializeTemporalFactors(): void {
    // Initialize with default values - in real implementation,
    // this would be populated from version control history
  }

  // Public API methods
  addFilterRule(rule: FilterRule): void {
    this.filterRules.set(rule.id, rule);
  }

  removeFilterRule(ruleId: string): void {
    this.filterRules.delete(ruleId);
  }

  updateUserPreferences(userId: string, preferences: Partial<UserPreference>): void {
    const existing = this.userPreferences.get(userId) || {
      userId,
      frameworkPreferences: {},
      contentTypePreferences: {},
      complexityPreference: 0,
      freshnessPreference: 0.5,
      authorityPreference: 0.5,
      interactionHistory: [],
      learningEnabled: false
    };

    this.userPreferences.set(userId, { ...existing, ...preferences });
  }

  recordUserInteraction(userId: string, interaction: UserInteraction): void {
    const preferences = this.userPreferences.get(userId);
    if (preferences?.learningEnabled) {
      preferences.interactionHistory.push(interaction);
      
      // Keep only recent interactions (last 1000)
      if (preferences.interactionHistory.length > 1000) {
        preferences.interactionHistory = preferences.interactionHistory.slice(-1000);
      }
      
      // Update preferences based on interaction
      this.updatePreferencesFromInteraction(preferences, interaction);
    }
  }

  private updatePreferencesFromInteraction(preferences: UserPreference, interaction: UserInteraction): void {
    // Simple learning algorithm - in practice, this would be more sophisticated
    if (interaction.action === 'click' || interaction.action === 'copy') {
      // Positive feedback - boost preferences for this content
      const framework = interaction.context.framework;
      const contentType = interaction.context.contentType;
      
      if (framework) {
        preferences.frameworkPreferences[framework] = 
          (preferences.frameworkPreferences[framework] || 0.5) + 0.1;
      }
      
      if (contentType) {
        preferences.contentTypePreferences[contentType] = 
          (preferences.contentTypePreferences[contentType] || 0.5) + 0.1;
      }
    }
  }

  getFilterRules(): FilterRule[] {
    return Array.from(this.filterRules.values());
  }

  getRankingMetrics(query: string): RankingMetrics | null {
    const results = this.rankingHistory.get(query);
    if (!results) return null;

    // Calculate basic metrics
    const avgScore = results.reduce((sum, r) => sum + r.finalRankingScore, 0) / results.length;
    const diversityScore = this.calculateDiversityMetric(results);

    return {
      precision: 0.8, // Would need user feedback to calculate
      recall: 0.7, // Would need ground truth to calculate
      ndcg: 0.75, // Would need relevance judgments to calculate
      averageRankingScore: avgScore,
      diversityScore,
      userSatisfactionScore: 0.8 // Would need user ratings to calculate
    };
  }

  private calculateDiversityMetric(results: RankedResult[]): number {
    const types = new Set(results.map(r => r.chunk?.metadata.type).filter(Boolean));
    const frameworks = new Set(results.map(r => r.chunk?.metadata.framework).filter(Boolean));
    
    const typesDiversity = Math.min(1, types.size / 5); // Normalize to max 5 types
    const frameworksDiversity = Math.min(1, frameworks.size / 3); // Normalize to max 3 frameworks
    
    return (typesDiversity + frameworksDiversity) / 2;
  }
}