import { FileClassification } from './FileClassifier';
import { ProcessedContent, ContentChunk } from './ContentProcessor';
import { WorkspaceEnvironment } from './RAGFoundation';

export interface QueryIntent {
  type: QueryType;
  confidence: number;
  parameters: QueryParameters;
  context: QueryContext;
}

export enum QueryType {
  CodeSearch = 'code-search',
  ArchitectureAnalysis = 'architecture-analysis',
  Documentation = 'documentation',
  BugAnalysis = 'bug-analysis',
  FeatureRequest = 'feature-request',
  CodeReview = 'code-review',
  SecurityAnalysis = 'security-analysis',
  PerformanceAnalysis = 'performance-analysis',
  TestingGuidance = 'testing-guidance',
  RefactoringAdvice = 'refactoring-advice',
  DiagramGeneration = 'diagram-generation',
  ClassDiagram = 'class-diagram',
  SequenceDiagram = 'sequence-diagram',
  ArchitectureDiagram = 'architecture-diagram',
  General = 'general'
}

export interface QueryParameters {
  keywords: string[];
  frameworks: string[];
  fileTypes: string[];
  components: string[];
  scope: QueryScope;
  complexity: QueryComplexity;
}

export enum QueryScope {
  File = 'file',
  Component = 'component',
  Module = 'module',
  Project = 'project',
  Framework = 'framework'
}

export enum QueryComplexity {
  Simple = 'simple',
  Moderate = 'moderate',
  Complex = 'complex',
  Advanced = 'advanced'
}

export interface QueryContext {
  workspaceEnvironment?: WorkspaceEnvironment;
  recentFiles: string[];
  userRole: UserRole;
  sessionHistory: QuerySession[];
  primaryFramework?: string;
}

export enum UserRole {
  Developer = 'developer',
  Architect = 'architect',
  QA = 'qa',
  DevOps = 'devops',
  Manager = 'manager'
}

export interface QuerySession {
  query: string;
  intent: QueryIntent;
  response: QueryResponse;
  timestamp: Date;
  satisfaction?: number;
}

export interface QueryResponse {
  answer: string;
  relevantChunks: RelevantChunk[];
  suggestions: string[];
  confidence: number;
  metadata: ResponseMetadata;
}

export interface RelevantChunk {
  chunk: ContentChunk;
  relevanceScore: number;
  explanation: string;
  contextType: ContextType;
}

export enum ContextType {
  DirectMatch = 'direct-match',
  Related = 'related',
  Dependency = 'dependency',
  Pattern = 'pattern',
  Framework = 'framework',
  Example = 'example'
}

export interface ResponseMetadata {
  processingTime: number;
  chunksAnalyzed: number;
  intentConfidence: number;
  sources: string[];
  frameworks: string[];
  followUpQuestions: string[];
}

export class QueryProcessor {
  private intentClassifiers: Map<QueryType, IntentClassifier> = new Map();
  private contextAnalyzers: Map<string, ContextAnalyzer> = new Map();
  private responseGenerators: Map<QueryType, ResponseGenerator> = new Map();

  constructor() {
    this.initializeIntentClassifiers();
    this.initializeContextAnalyzers();
    this.initializeResponseGenerators();
  }

  async processQuery(
    query: string,
    availableChunks: ContentChunk[],
    context: QueryContext
  ): Promise<QueryResponse> {
    console.log('🤖 Phase 4: Processing query with RAG pipeline...');
    
    const startTime = Date.now();
    
    // Step 1: Intent Classification
    const intent = await this.classifyIntent(query, context);
    console.log(`📝 Detected intent: ${intent.type} (confidence: ${intent.confidence})`);
    
    // Step 2: Context Analysis
    const enrichedContext = await this.analyzeContext(query, intent, context, availableChunks);
    
    // Step 3: Chunk Retrieval and Ranking
    const relevantChunks = await this.retrieveRelevantChunks(query, intent, availableChunks, enrichedContext);
    console.log(`📊 Retrieved ${relevantChunks.length} relevant chunks`);
    
    // Step 4: Response Generation
    const response = await this.generateResponse(query, intent, relevantChunks, enrichedContext);
    
    // Step 5: Post-processing and Enhancement
    const enhancedResponse = await this.enhanceResponse(response, intent, enrichedContext);
    
    enhancedResponse.metadata.processingTime = Date.now() - startTime;
    enhancedResponse.metadata.chunksAnalyzed = availableChunks.length;
    enhancedResponse.metadata.intentConfidence = intent.confidence;
    
    return enhancedResponse;
  }

  private async classifyIntent(query: string, context: QueryContext): Promise<QueryIntent> {
    const queryLower = query.toLowerCase();
    const intentScores = new Map<QueryType, number>();
    
    // Initialize all intent types with base scores
    Object.values(QueryType).forEach(type => {
      intentScores.set(type, 0);
    });
    
    // Pattern-based intent classification
    const patterns = this.getIntentPatterns();
    
    for (const [intentType, patternList] of patterns.entries()) {
      let score = 0;
      for (const pattern of patternList) {
        if (pattern.test(queryLower)) {
          score += pattern.source.length / 10; // Longer patterns = higher confidence
        }
      }
      intentScores.set(intentType, score);
    }
    
    // Context-based intent adjustment
    this.adjustIntentBasedOnContext(intentScores, context);
    
    // Find the highest scoring intent
    let maxScore = 0;
    let bestIntent = QueryType.General;
    
    for (const [intent, score] of intentScores.entries()) {
      if (score > maxScore) {
        maxScore = score;
        bestIntent = intent;
      }
    }
    
    const confidence = Math.min(1.0, maxScore / 10);
    
    return {
      type: bestIntent,
      confidence,
      parameters: this.extractQueryParameters(query, bestIntent),
      context: this.enrichQueryContext(context, bestIntent)
    };
  }

  private getIntentPatterns(): Map<QueryType, RegExp[]> {
    const patterns = new Map<QueryType, RegExp[]>();
    
    patterns.set(QueryType.CodeSearch, [
      /find.*function/,
      /search.*class/,
      /where.*is/,
      /locate.*method/,
      /show.*implementation/,
      /how.*does.*work/
    ]);
    
    patterns.set(QueryType.ArchitectureAnalysis, [
      /architecture/,
      /structure/,
      /design.*pattern/,
      /system.*overview/,
      /how.*organized/
    ]);

    patterns.set(QueryType.ClassDiagram, [
      /class.*diagram/,
      /uml.*class/,
      /show.*class/,
      /generate.*class.*diagram/,
      /class.*structure/,
      /diagram.*for.*class/,
      /class.*relationship/
    ]);

    patterns.set(QueryType.SequenceDiagram, [
      /sequence.*diagram/,
      /interaction.*diagram/,
      /flow.*diagram/,
      /process.*flow/,
      /sequence.*chart/
    ]);

    patterns.set(QueryType.ArchitectureDiagram, [
      /architecture.*diagram/,
      /system.*diagram/,
      /component.*diagram/,
      /service.*diagram/,
      /module.*diagram/
    ]);

    patterns.set(QueryType.DiagramGeneration, [
      /diagram/,
      /chart/,
      /visual/,
      /graph/,
      /draw/,
      /show.*structure/,
      /visualize/
    ]);
    
    patterns.set(QueryType.Documentation, [
      /document/,
      /explain/,
      /readme/,
      /guide/,
      /tutorial/,
      /how.*to.*use/
    ]);
    
    patterns.set(QueryType.BugAnalysis, [
      /bug/,
      /error/,
      /exception/,
      /issue/,
      /problem/,
      /not.*working/,
      /fail/
    ]);
    
    patterns.set(QueryType.SecurityAnalysis, [
      /security/,
      /vulnerability/,
      /authentication/,
      /authorization/,
      /secure/,
      /protect/
    ]);
    
    patterns.set(QueryType.PerformanceAnalysis, [
      /performance/,
      /optimize/,
      /slow/,
      /memory/,
      /cpu/,
      /bottleneck/,
      /efficiency/
    ]);
    
    patterns.set(QueryType.TestingGuidance, [
      /test/,
      /testing/,
      /unit.*test/,
      /integration.*test/,
      /coverage/,
      /mock/
    ]);
    
    patterns.set(QueryType.RefactoringAdvice, [
      /refactor/,
      /improve/,
      /clean.*up/,
      /best.*practice/,
      /code.*quality/,
      /maintainable/
    ]);
    
    return patterns;
  }

  private adjustIntentBasedOnContext(intentScores: Map<QueryType, number>, context: QueryContext): void {
    // Adjust based on user role
    switch (context.userRole) {
      case UserRole.Architect:
        intentScores.set(QueryType.ArchitectureAnalysis, intentScores.get(QueryType.ArchitectureAnalysis)! + 2);
        break;
      case UserRole.QA:
        intentScores.set(QueryType.TestingGuidance, intentScores.get(QueryType.TestingGuidance)! + 2);
        intentScores.set(QueryType.BugAnalysis, intentScores.get(QueryType.BugAnalysis)! + 1);
        break;
      case UserRole.DevOps:
        intentScores.set(QueryType.SecurityAnalysis, intentScores.get(QueryType.SecurityAnalysis)! + 1);
        intentScores.set(QueryType.PerformanceAnalysis, intentScores.get(QueryType.PerformanceAnalysis)! + 1);
        break;
    }
    
    // Adjust based on recent session history
    if (context.sessionHistory.length > 0) {
      const recentIntent = context.sessionHistory[context.sessionHistory.length - 1].intent.type;
      intentScores.set(recentIntent, intentScores.get(recentIntent)! + 1);
    }
  }

  private extractQueryParameters(query: string, intentType: QueryType): QueryParameters {
    const queryLower = query.toLowerCase();
    
    return {
      keywords: this.extractKeywords(query),
      frameworks: this.extractFrameworks(queryLower),
      fileTypes: this.extractFileTypes(queryLower),
      components: this.extractComponents(queryLower),
      scope: this.determineScope(query, intentType),
      complexity: this.determineComplexity(query, intentType)
    };
  }

  private extractKeywords(query: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'how', 'what', 'where', 'when', 'why', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might']);
    
    return query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Limit to top 10 keywords
  }

  private extractFrameworks(query: string): string[] {
    const frameworks: string[] = [];
    const frameworkPatterns = {
      'spring boot': /spring\s*boot|springboot/,
      'spring': /spring(?!\s*boot)/,
      'react': /react/,
      'angular': /angular/,
      'vue': /vue\.?js|vue/,
      'flask': /flask/,
      'fastapi': /fastapi|fast\s*api/,
      'django': /django/,
      'express': /express\.?js|express/,
      'nest': /nestjs|nest/
    };
    
    for (const [framework, pattern] of Object.entries(frameworkPatterns)) {
      if (pattern.test(query)) {
        frameworks.push(framework);
      }
    }
    
    return frameworks;
  }

  private extractFileTypes(query: string): string[] {
    const fileTypes: string[] = [];
    const typePatterns = {
      'java': /\.java|java\s*file/,
      'javascript': /\.js|javascript/,
      'typescript': /\.ts|typescript/,
      'python': /\.py|python/,
      'html': /\.html|html/,
      'css': /\.css|css/,
      'json': /\.json|json/,
      'xml': /\.xml|xml/,
      'yaml': /\.ya?ml|yaml/
    };
    
    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(query)) {
        fileTypes.push(type);
      }
    }
    
    return fileTypes;
  }

  private extractComponents(query: string): string[] {
    const components: string[] = [];
    const componentPatterns = {
      'controller': /controller/,
      'service': /service/,
      'repository': /repository/,
      'entity': /entity|model/,
      'component': /component/,
      'middleware': /middleware/,
      'router': /router|route/,
      'config': /config|configuration/
    };
    
    for (const [component, pattern] of Object.entries(componentPatterns)) {
      if (pattern.test(query)) {
        components.push(component);
      }
    }
    
    return components;
  }

  private determineScope(query: string, intentType: QueryType): QueryScope {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('project') || queryLower.includes('entire') || queryLower.includes('all')) {
      return QueryScope.Project;
    }
    if (queryLower.includes('module') || queryLower.includes('package')) {
      return QueryScope.Module;
    }
    if (queryLower.includes('component') || queryLower.includes('class')) {
      return QueryScope.Component;
    }
    if (queryLower.includes('file')) {
      return QueryScope.File;
    }
    
    // Default based on intent type
    switch (intentType) {
      case QueryType.ArchitectureAnalysis:
        return QueryScope.Project;
      case QueryType.CodeSearch:
        return QueryScope.Component;
      default:
        return QueryScope.Module;
    }
  }

  private determineComplexity(query: string, intentType: QueryType): QueryComplexity {
    const queryLower = query.toLowerCase();
    const complexityIndicators = {
      advanced: ['architecture', 'design pattern', 'optimization', 'performance', 'security', 'scalability'],
      complex: ['integration', 'workflow', 'pipeline', 'relationship', 'dependency'],
      moderate: ['implement', 'create', 'build', 'configure', 'setup'],
      simple: ['find', 'show', 'list', 'what', 'where']
    };
    
    for (const [level, indicators] of Object.entries(complexityIndicators)) {
      if (indicators.some(indicator => queryLower.includes(indicator))) {
        return level as QueryComplexity;
      }
    }
    
    return QueryComplexity.Moderate;
  }

  private enrichQueryContext(context: QueryContext, intentType: QueryType): QueryContext {
    // Add intent-specific context enrichment
    const enriched = { ...context };
    
    // Add framework-specific context if available
    if (context.workspaceEnvironment) {
      enriched.workspaceEnvironment = context.workspaceEnvironment;
    }
    
    return enriched;
  }

  private async analyzeContext(
    query: string,
    intent: QueryIntent,
    context: QueryContext,
    availableChunks: ContentChunk[]
  ): Promise<QueryContext> {
    // Enhance context with semantic analysis
    const enrichedContext = { ...context };
    
    // Analyze available frameworks in chunks
    const frameworks = new Set<string>();
    availableChunks.forEach(chunk => {
      if (chunk.metadata.framework) {
        frameworks.add(chunk.metadata.framework);
      }
    });
    
    // Update context with discovered frameworks
    if (enrichedContext.workspaceEnvironment) {
      enrichedContext.workspaceEnvironment.detectedFrameworks.forEach(fw => {
        frameworks.add(fw.name.toLowerCase());
      });
    }
    
    return enrichedContext;
  }

  private async retrieveRelevantChunks(
    query: string,
    intent: QueryIntent,
    availableChunks: ContentChunk[],
    context: QueryContext
  ): Promise<RelevantChunk[]> {
    const relevantChunks: RelevantChunk[] = [];
    
    for (const chunk of availableChunks) {
      const relevanceScore = this.calculateRelevanceScore(query, intent, chunk, context);
      
      if (relevanceScore > 0.1) { // Minimum relevance threshold
        relevantChunks.push({
          chunk,
          relevanceScore,
          explanation: this.generateRelevanceExplanation(query, intent, chunk, relevanceScore),
          contextType: this.determineContextType(query, intent, chunk)
        });
      }
    }
    
    // Sort by relevance score and take top chunks
    relevantChunks.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Adaptive chunk selection based on query complexity
    const maxChunks = this.getMaxChunksForComplexity(intent.parameters.complexity);
    return relevantChunks.slice(0, maxChunks);
  }

  private calculateRelevanceScore(
    query: string,
    intent: QueryIntent,
    chunk: ContentChunk,
    context: QueryContext
  ): number {
    let score = 0;
    const queryLower = query.toLowerCase();
    const chunkContent = chunk.content.toLowerCase();
    
    // Keyword matching
    intent.parameters.keywords.forEach(keyword => {
      if (chunkContent.includes(keyword)) {
        score += 0.2;
      }
      if (chunk.metadata.name?.toLowerCase().includes(keyword)) {
        score += 0.3;
      }
    });
    
    // Framework matching
    intent.parameters.frameworks.forEach(framework => {
      if (chunk.metadata.framework?.toLowerCase().includes(framework)) {
        score += 0.4;
      }
    });
    
    // Component type matching
    intent.parameters.components.forEach(component => {
      if (chunk.metadata.type.includes(component)) {
        score += 0.3;
      }
    });
    
    // Intent-specific scoring
    switch (intent.type) {
      case QueryType.CodeSearch:
        if (chunk.chunkType.toString().includes('function') || chunk.chunkType.toString().includes('class')) {
          score += 0.2;
        }
        break;
      case QueryType.SecurityAnalysis:
        if (chunk.metadata.tags.some(tag => tag.includes('auth') || tag.includes('security'))) {
          score += 0.3;
        }
        break;
      case QueryType.PerformanceAnalysis:
        if (chunk.metadata.complexity > 5) {
          score += 0.2;
        }
        break;
    }
    
    // Importance weighting
    score *= chunk.metadata.importance;
    
    return Math.min(1.0, score);
  }

  private generateRelevanceExplanation(
    query: string,
    intent: QueryIntent,
    chunk: ContentChunk,
    score: number
  ): string {
    const reasons: string[] = [];
    
    if (chunk.metadata.name && intent.parameters.keywords.some(k => chunk.metadata.name?.toLowerCase().includes(k))) {
      reasons.push('matches query keywords in name');
    }
    
    if (chunk.metadata.framework && intent.parameters.frameworks.some(f => chunk.metadata.framework?.includes(f))) {
      reasons.push('matches specified framework');
    }
    
    if (chunk.metadata.importance > 0.8) {
      reasons.push('high importance component');
    }
    
    if (reasons.length === 0) {
      reasons.push('general content relevance');
    }
    
    return `Relevant because it ${reasons.join(', ')} (score: ${score.toFixed(2)})`;
  }

  private determineContextType(query: string, intent: QueryIntent, chunk: ContentChunk): ContextType {
    const queryLower = query.toLowerCase();
    const chunkContent = chunk.content.toLowerCase();
    
    // Direct keyword match
    if (intent.parameters.keywords.some(keyword => chunkContent.includes(keyword))) {
      return ContextType.DirectMatch;
    }
    
    // Framework match
    if (chunk.metadata.framework && intent.parameters.frameworks.some(f => chunk.metadata.framework?.includes(f))) {
      return ContextType.Framework;
    }
    
    // Dependency relationship
    if (chunk.dependencies.length > 0) {
      return ContextType.Dependency;
    }
    
    // Pattern match
    if (chunk.patterns.length > 0) {
      return ContextType.Pattern;
    }
    
    return ContextType.Related;
  }

  private getMaxChunksForComplexity(complexity: QueryComplexity): number {
    switch (complexity) {
      case QueryComplexity.Simple:
        return 5;
      case QueryComplexity.Moderate:
        return 10;
      case QueryComplexity.Complex:
        return 15;
      case QueryComplexity.Advanced:
        return 20;
      default:
        return 10;
    }
  }

  private async generateResponse(
    query: string,
    intent: QueryIntent,
    relevantChunks: RelevantChunk[],
    context: QueryContext
  ): Promise<QueryResponse> {
    const generator = this.responseGenerators.get(intent.type) || this.responseGenerators.get(QueryType.General)!;
    
    return await generator.generateResponse(query, intent, relevantChunks, context);
  }

  private async enhanceResponse(
    response: QueryResponse,
    intent: QueryIntent,
    context: QueryContext
  ): Promise<QueryResponse> {
    // Add follow-up questions
    response.metadata.followUpQuestions = this.generateFollowUpQuestions(intent, response);
    
    // Add framework-specific suggestions
    response.suggestions.push(...this.generateFrameworkSuggestions(intent, context));
    
    return response;
  }

  private generateFollowUpQuestions(intent: QueryIntent, response: QueryResponse): string[] {
    const questions: string[] = [];
    
    switch (intent.type) {
      case QueryType.CodeSearch:
        questions.push(
          "Would you like to see related functions or classes?",
          "Do you need implementation details for any of these components?",
          "Are you looking for usage examples?"
        );
        break;
      case QueryType.ArchitectureAnalysis:
        questions.push(
          "Would you like a visual diagram of the architecture?",
          "Do you want to explore specific architectural patterns?",
          "Are you interested in component relationships?"
        );
        break;
      case QueryType.SecurityAnalysis:
        questions.push(
          "Would you like specific security recommendations?",
          "Do you want to see potential vulnerabilities?",
          "Are you interested in authentication mechanisms?"
        );
        break;
    }
    
    return questions.slice(0, 3);
  }

  private generateFrameworkSuggestions(intent: QueryIntent, context: QueryContext): string[] {
    const suggestions: string[] = [];
    
    if (context.workspaceEnvironment) {
      const primaryFramework = context.workspaceEnvironment.confidence.primary.framework;
      
      switch (primaryFramework.toLowerCase()) {
        case 'spring boot':
          suggestions.push(
            "Consider reviewing Spring Boot best practices",
            "Check for proper dependency injection usage",
            "Verify configuration management"
          );
          break;
        case 'react':
          suggestions.push(
            "Review component composition patterns",
            "Consider performance optimization with React.memo",
            "Check for proper state management"
          );
          break;
      }
    }
    
    return suggestions.slice(0, 2);
  }

  private initializeIntentClassifiers(): void {
    // Initialize intent classifiers for each query type
    Object.values(QueryType).forEach(type => {
      this.intentClassifiers.set(type, new DefaultIntentClassifier(type));
    });
  }

  private initializeContextAnalyzers(): void {
    // Initialize context analyzers for different domains
    this.contextAnalyzers.set('code', new CodeContextAnalyzer());
    this.contextAnalyzers.set('architecture', new ArchitectureContextAnalyzer());
    this.contextAnalyzers.set('security', new SecurityContextAnalyzer());
  }

  private initializeResponseGenerators(): void {
    // Initialize response generators for each query type
    this.responseGenerators.set(QueryType.CodeSearch, new CodeSearchResponseGenerator());
    this.responseGenerators.set(QueryType.ArchitectureAnalysis, new ArchitectureResponseGenerator());
    this.responseGenerators.set(QueryType.SecurityAnalysis, new SecurityResponseGenerator());
    this.responseGenerators.set(QueryType.General, new GeneralResponseGenerator());
    
    // Diagram-specific generators
    this.responseGenerators.set(QueryType.ClassDiagram, new ClassDiagramResponseGenerator());
    this.responseGenerators.set(QueryType.SequenceDiagram, new SequenceDiagramResponseGenerator());
    this.responseGenerators.set(QueryType.ArchitectureDiagram, new ArchitectureDiagramResponseGenerator());
    this.responseGenerators.set(QueryType.DiagramGeneration, new ClassDiagramResponseGenerator()); // Default to class diagram
  }
}

// Abstract base classes for extensibility
abstract class IntentClassifier {
  constructor(protected intentType: QueryType) {}
  
  abstract classifyIntent(query: string, context: QueryContext): Promise<number>;
}

class DefaultIntentClassifier extends IntentClassifier {
  async classifyIntent(query: string, context: QueryContext): Promise<number> {
    // Simple default classification based on keywords
    const queryLower = query.toLowerCase();
    let score = 0;
    
    switch (this.intentType) {
      case QueryType.ClassDiagram:
        if (queryLower.includes('class') && queryLower.includes('diagram')) score = 0.9;
        break;
      case QueryType.SequenceDiagram:
        if (queryLower.includes('sequence') && queryLower.includes('diagram')) score = 0.9;
        break;
      case QueryType.ArchitectureDiagram:
        if (queryLower.includes('architecture') && queryLower.includes('diagram')) score = 0.9;
        break;
      default:
        score = 0.1;
    }
    
    return score;
  }
}

abstract class ContextAnalyzer {
  abstract analyzeContext(chunks: ContentChunk[], context: QueryContext): Promise<any>;
}

abstract class ResponseGenerator {
  abstract generateResponse(
    query: string,
    intent: QueryIntent,
    chunks: RelevantChunk[],
    context: QueryContext
  ): Promise<QueryResponse>;
}

// Concrete implementations
class CodeSearchResponseGenerator extends ResponseGenerator {
  async generateResponse(
    query: string,
    intent: QueryIntent,
    chunks: RelevantChunk[],
    context: QueryContext
  ): Promise<QueryResponse> {
    let answer = "Based on your code search, I found the following relevant components:\n\n";
    
    chunks.forEach((relevantChunk, index) => {
      const chunk = relevantChunk.chunk;
      answer += `${index + 1}. **${chunk.metadata.name || 'Component'}** (${chunk.metadata.type})\n`;
      answer += `   - File: ${chunk.id.split('_')[0]}\n`;
      answer += `   - ${relevantChunk.explanation}\n\n`;
    });
    
    const suggestions = [
      "Use more specific keywords to narrow the search",
      "Try searching within a specific framework or module",
      "Consider looking at related components or dependencies"
    ];
    
    return {
      answer,
      relevantChunks: chunks,
      suggestions,
      confidence: chunks.length > 0 ? 0.8 : 0.3,
      metadata: {
        processingTime: 0,
        chunksAnalyzed: 0,
        intentConfidence: intent.confidence,
        sources: chunks.map(c => c.chunk.id),
        frameworks: [...new Set(chunks.map(c => c.chunk.metadata.framework).filter((f): f is string => Boolean(f)))],
        followUpQuestions: []
      }
    };
  }
}

class ArchitectureResponseGenerator extends ResponseGenerator {
  async generateResponse(
    query: string,
    intent: QueryIntent,
    chunks: RelevantChunk[],
    context: QueryContext
  ): Promise<QueryResponse> {
    let answer = "Here's an analysis of your system architecture:\n\n";
    
    // Group chunks by type and framework
    const componentsByType = new Map<string, RelevantChunk[]>();
    chunks.forEach(chunk => {
      const type = chunk.chunk.metadata.type;
      if (!componentsByType.has(type)) {
        componentsByType.set(type, []);
      }
      componentsByType.get(type)!.push(chunk);
    });
    
    componentsByType.forEach((typeChunks, type) => {
      answer += `## ${type.charAt(0).toUpperCase() + type.slice(1)} Components\n`;
      typeChunks.forEach(chunk => {
        answer += `- ${chunk.chunk.metadata.name || 'Unnamed'} (${chunk.chunk.metadata.framework || 'Unknown framework'})\n`;
      });
      answer += '\n';
    });
    
    const suggestions = [
      "Generate a visual architecture diagram",
      "Analyze component dependencies",
      "Review architectural patterns in use"
    ];
    
    return {
      answer,
      relevantChunks: chunks,
      suggestions,
      confidence: 0.7,
      metadata: {
        processingTime: 0,
        chunksAnalyzed: 0,
        intentConfidence: intent.confidence,
        sources: chunks.map(c => c.chunk.id),
        frameworks: [...new Set(chunks.map(c => c.chunk.metadata.framework).filter((f): f is string => Boolean(f)))],
        followUpQuestions: []
      }
    };
  }
}

class SecurityResponseGenerator extends ResponseGenerator {
  async generateResponse(
    query: string,
    intent: QueryIntent,
    chunks: RelevantChunk[],
    context: QueryContext
  ): Promise<QueryResponse> {
    let answer = "Security analysis of your codebase:\n\n";
    
    const securityRelevantChunks = chunks.filter(chunk => 
      chunk.chunk.metadata.tags.some(tag => 
        tag.includes('auth') || tag.includes('security') || tag.includes('controller')
      )
    );
    
    if (securityRelevantChunks.length > 0) {
      answer += "## Security-Related Components\n";
      securityRelevantChunks.forEach(chunk => {
        answer += `- ${chunk.chunk.metadata.name}: ${chunk.explanation}\n`;
      });
    } else {
      answer += "No specific security components identified in the current search scope.\n";
    }
    
    const suggestions = [
      "Review authentication mechanisms",
      "Check for input validation",
      "Analyze authorization patterns",
      "Scan for potential vulnerabilities"
    ];
    
    return {
      answer,
      relevantChunks: chunks,
      suggestions,
      confidence: securityRelevantChunks.length > 0 ? 0.7 : 0.4,
      metadata: {
        processingTime: 0,
        chunksAnalyzed: 0,
        intentConfidence: intent.confidence,
        sources: chunks.map(c => c.chunk.id),
        frameworks: [...new Set(chunks.map(c => c.chunk.metadata.framework).filter((f): f is string => Boolean(f)))],
        followUpQuestions: []
      }
    };
  }
}

class GeneralResponseGenerator extends ResponseGenerator {
  async generateResponse(
    query: string,
    intent: QueryIntent,
    chunks: RelevantChunk[],
    context: QueryContext
  ): Promise<QueryResponse> {
    let answer = "Based on your query, here are the most relevant findings:\n\n";
    
    if (chunks.length === 0) {
      answer = "I couldn't find specific matches for your query. Here are some suggestions:\n\n";
      answer += "- Try using more specific keywords\n";
      answer += "- Check if the component exists in your codebase\n";
      answer += "- Consider browsing by framework or file type\n";
    } else {
      chunks.slice(0, 5).forEach((chunk, index) => {
        answer += `${index + 1}. ${chunk.chunk.metadata.name || 'Component'} - ${chunk.explanation}\n`;
      });
    }
    
    const suggestions = [
      "Refine your search with more specific terms",
      "Explore related components",
      "Use framework-specific searches"
    ];
    
    return {
      answer,
      relevantChunks: chunks,
      suggestions,
      confidence: chunks.length > 0 ? 0.6 : 0.3,
      metadata: {
        processingTime: 0,
        chunksAnalyzed: 0,
        intentConfidence: intent.confidence,
        sources: chunks.map(c => c.chunk.id),
        frameworks: [...new Set(chunks.map(c => c.chunk.metadata.framework).filter((f): f is string => Boolean(f)))],
        followUpQuestions: []
      }
    };
  }
}

// Concrete context analyzers
class CodeContextAnalyzer extends ContextAnalyzer {
  async analyzeContext(chunks: ContentChunk[], context: QueryContext): Promise<any> {
    return {
      codePatterns: this.extractCodePatterns(chunks),
      complexity: this.analyzeComplexity(chunks),
      dependencies: this.analyzeDependencies(chunks)
    };
  }
  
  private extractCodePatterns(chunks: ContentChunk[]): string[] {
    const patterns = new Set<string>();
    chunks.forEach(chunk => {
      chunk.patterns.forEach(pattern => patterns.add(pattern));
    });
    return Array.from(patterns);
  }
  
  private analyzeComplexity(chunks: ContentChunk[]): number {
    const complexities = chunks.map(chunk => chunk.metadata.complexity);
    return complexities.reduce((sum, complexity) => sum + complexity, 0) / complexities.length;
  }
  
  private analyzeDependencies(chunks: ContentChunk[]): string[] {
    const deps = new Set<string>();
    chunks.forEach(chunk => {
      chunk.dependencies.forEach(dep => deps.add(dep));
    });
    return Array.from(deps);
  }
}

class ArchitectureContextAnalyzer extends ContextAnalyzer {
  async analyzeContext(chunks: ContentChunk[], context: QueryContext): Promise<any> {
    return {
      layers: this.identifyLayers(chunks),
      patterns: this.identifyPatterns(chunks),
      frameworks: this.identifyFrameworks(chunks)
    };
  }
  
  private identifyLayers(chunks: ContentChunk[]): string[] {
    const layers = new Set<string>();
    chunks.forEach(chunk => {
      if (chunk.metadata.type.includes('controller')) layers.add('Presentation');
      if (chunk.metadata.type.includes('service')) layers.add('Business');
      if (chunk.metadata.type.includes('repository')) layers.add('Data');
    });
    return Array.from(layers);
  }
  
  private identifyPatterns(chunks: ContentChunk[]): string[] {
    // Implementation would analyze architectural patterns
    return ['MVC', 'Repository Pattern', 'Dependency Injection'];
  }
  
  private identifyFrameworks(chunks: ContentChunk[]): string[] {
    const frameworks = new Set<string>();
    chunks.forEach(chunk => {
      if (chunk.metadata.framework) frameworks.add(chunk.metadata.framework);
    });
    return Array.from(frameworks);
  }
}

class SecurityContextAnalyzer extends ContextAnalyzer {
  async analyzeContext(chunks: ContentChunk[], context: QueryContext): Promise<any> {
    return {
      authComponents: this.findAuthComponents(chunks),
      securityPatterns: this.findSecurityPatterns(chunks),
      vulnerabilities: this.identifyPotentialVulnerabilities(chunks)
    };
  }
  
  private findAuthComponents(chunks: ContentChunk[]): ContentChunk[] {
    return chunks.filter(chunk => 
      chunk.metadata.tags.some(tag => tag.includes('auth')) ||
      chunk.content.toLowerCase().includes('authentication') ||
      chunk.content.toLowerCase().includes('authorization')
    );
  }
  
  private findSecurityPatterns(chunks: ContentChunk[]): string[] {
    const patterns: string[] = [];
    chunks.forEach(chunk => {
      if (chunk.content.includes('@PreAuthorize')) patterns.push('Method-level authorization');
      if (chunk.content.includes('@Secured')) patterns.push('Role-based security');
      if (chunk.content.includes('SecurityConfig')) patterns.push('Security configuration');
    });
    return patterns;
  }
  
  private identifyPotentialVulnerabilities(chunks: ContentChunk[]): string[] {
    const vulnerabilities: string[] = [];
    chunks.forEach(chunk => {
      if (chunk.content.includes('password') && chunk.content.includes('=')) {
        vulnerabilities.push('Potential hardcoded credentials');
      }
      if (chunk.content.includes('sql') && chunk.content.includes('+')) {
        vulnerabilities.push('Potential SQL injection');
      }
    });
    return vulnerabilities;
  }
}

// Diagram-specific response generators
class ClassDiagramResponseGenerator extends ResponseGenerator {
  async generateResponse(
    query: string,
    intent: QueryIntent,
    chunks: RelevantChunk[],
    context: QueryContext
  ): Promise<QueryResponse> {
    console.log('🎨 Generating class diagram response...');
    
    // Import OutputGenerator here to avoid circular dependency
    const { OutputGenerator, OutputType, OutputFormat, OutputScope, OutputDetailLevel, TargetAudience } = await import('./OutputGenerator');
    const outputGenerator = new OutputGenerator();
    
    const outputRequest = {
      type: OutputType.ClassDiagram,
      parameters: {
        scope: OutputScope.Current,
        detail: OutputDetailLevel.Detailed,
        format: query.toLowerCase().includes('plantuml') ? OutputFormat.PlantUML : OutputFormat.Mermaid,
        includeCode: false,
        includeExamples: true,
        targetAudience: TargetAudience.Developer,
        includeFields: true,
        includeMethods: true,
        includeRelationships: true
      },
      context: {
        targetFramework: context.primaryFramework || 'generic',
        availableChunks: chunks.map(c => c.chunk),
        scope: intent.parameters.scope || 'current'
      }
    };
    
    const generatedOutput = await outputGenerator.generateOutput(outputRequest);
    
    let answer = `# Class Diagram\n\n`;
    
    // Extract specific class name from query if present
    const classNameMatch = query.match(/(?:for|of)\s+(\w+)/i);
    const targetClassName = classNameMatch ? classNameMatch[1] : null;
    
    if (targetClassName) {
      answer += `Class diagram for **${targetClassName}**:\n\n`;
    } else {
      answer += `Class diagram showing the structure and relationships:\n\n`;
    }
    
    // Add the diagram
    if (outputRequest.parameters.format === OutputFormat.PlantUML) {
      answer += `\`\`\`plantuml\n${generatedOutput.content}\n\`\`\`\n\n`;
    } else {
      answer += `\`\`\`mermaid\n${generatedOutput.content}\n\`\`\`\n\n`;
    }
    
    // Add explanation
    const classChunks = chunks.filter(c => 
      c.chunk.content.includes('class ') || 
      c.chunk.metadata.type.includes('class')
    );
    
    if (classChunks.length > 0) {
      answer += `## Classes Identified\n\n`;
      classChunks.slice(0, 5).forEach(chunk => {
        answer += `- **${chunk.chunk.metadata.name}**: ${chunk.explanation}\n`;
      });
    }
    
    const suggestions = [
      "Request a sequence diagram to see interactions",
      "Ask for architecture overview",
      "Get detailed code analysis for specific classes"
    ];
    
    return {
      answer,
      relevantChunks: chunks,
      suggestions,
      confidence: 0.9,
      metadata: {
        processingTime: 0,
        chunksAnalyzed: chunks.length,
        intentConfidence: intent.confidence,
        sources: chunks.map(c => c.chunk.id),
        frameworks: [...new Set(chunks.map(c => c.chunk.metadata.framework).filter((f): f is string => Boolean(f)))],
        followUpQuestions: [
          "Can you show the sequence diagram for this interaction?",
          "What design patterns are used in these classes?",
          "How are these classes tested?"
        ]
      }
    };
  }
}

class SequenceDiagramResponseGenerator extends ResponseGenerator {
  async generateResponse(
    query: string,
    intent: QueryIntent,
    chunks: RelevantChunk[],
    context: QueryContext
  ): Promise<QueryResponse> {
    console.log('🎨 Generating sequence diagram response...');
    
    const { OutputGenerator, OutputType, OutputFormat, OutputScope, OutputDetailLevel, TargetAudience } = await import('./OutputGenerator');
    const outputGenerator = new OutputGenerator();
    
    const outputRequest = {
      type: OutputType.SequenceDiagram,
      parameters: {
        scope: OutputScope.Current,
        detail: OutputDetailLevel.Detailed,
        format: OutputFormat.Mermaid,
        includeCode: false,
        includeExamples: true,
        targetAudience: TargetAudience.Developer,
        includeReturnMessages: true,
        showActivations: true
      },
      context: {
        targetFramework: context.primaryFramework || 'generic',
        availableChunks: chunks.map(c => c.chunk),
        scope: intent.parameters.scope || 'current'
      }
    };
    
    const generatedOutput = await outputGenerator.generateOutput(outputRequest);
    
    let answer = `# Sequence Diagram\n\n`;
    answer += `Interaction flow and component communication:\n\n`;
    answer += `\`\`\`mermaid\n${generatedOutput.content}\n\`\`\`\n\n`;
    
    // Add flow description
    const controllerChunks = chunks.filter(c => c.chunk.metadata.type.includes('controller'));
    const serviceChunks = chunks.filter(c => c.chunk.metadata.type.includes('service'));
    
    if (controllerChunks.length > 0 || serviceChunks.length > 0) {
      answer += `## Interaction Flow\n\n`;
      answer += `This diagram shows the typical request-response flow:\n\n`;
      
      if (controllerChunks.length > 0) {
        answer += `1. **Controllers**: ${controllerChunks.map(c => c.chunk.metadata.name).join(', ')}\n`;
      }
      if (serviceChunks.length > 0) {
        answer += `2. **Services**: ${serviceChunks.map(c => c.chunk.metadata.name).join(', ')}\n`;
      }
    }
    
    return {
      answer,
      relevantChunks: chunks,
      suggestions: [
        "View the class diagram for structural details",
        "Analyze specific method implementations", 
        "See architecture overview"
      ],
      confidence: 0.85,
      metadata: {
        processingTime: 0,
        chunksAnalyzed: chunks.length,
        intentConfidence: intent.confidence,
        sources: chunks.map(c => c.chunk.id),
        frameworks: [...new Set(chunks.map(c => c.chunk.metadata.framework).filter((f): f is string => Boolean(f)))],
        followUpQuestions: [
          "What happens if this flow encounters an error?",
          "How is this sequence tested?",
          "What are the performance implications?"
        ]
      }
    };
  }
}

class ArchitectureDiagramResponseGenerator extends ResponseGenerator {
  async generateResponse(
    query: string,
    intent: QueryIntent,
    chunks: RelevantChunk[],
    context: QueryContext
  ): Promise<QueryResponse> {
    console.log('🎨 Generating architecture diagram response...');
    
    const { OutputGenerator, OutputType, OutputFormat, OutputScope, OutputDetailLevel, TargetAudience } = await import('./OutputGenerator');
    const outputGenerator = new OutputGenerator();
    
    const outputRequest = {
      type: OutputType.ArchitectureDiagram,
      parameters: {
        scope: OutputScope.System,
        detail: OutputDetailLevel.Detailed,
        format: OutputFormat.Mermaid,
        includeCode: false,
        includeExamples: true,
        targetAudience: TargetAudience.Architect,
        showLayers: true,
        includeDataFlow: true
      },
      context: {
        targetFramework: context.primaryFramework || 'generic',
        availableChunks: chunks.map(c => c.chunk),
        scope: intent.parameters.scope || 'system'
      }
    };
    
    const generatedOutput = await outputGenerator.generateOutput(outputRequest);
    
    let answer = `# Architecture Diagram\n\n`;
    answer += `System architecture and component relationships:\n\n`;
    answer += `\`\`\`mermaid\n${generatedOutput.content}\n\`\`\`\n\n`;
    
    // Add architecture analysis
    const frameworks = [...new Set(chunks.map(c => c.chunk.metadata.framework).filter(Boolean))];
    if (frameworks.length > 0) {
      answer += `## Technology Stack\n\n`;
      frameworks.forEach(framework => {
        const frameworkChunks = chunks.filter(c => c.chunk.metadata.framework === framework);
        answer += `- **${framework}**: ${frameworkChunks.length} components\n`;
      });
    }
    
    return {
      answer,
      relevantChunks: chunks,
      suggestions: [
        "Drill down into specific components",
        "See detailed class relationships",
        "Analyze security architecture"
      ],
      confidence: 0.8,
      metadata: {
        processingTime: 0,
        chunksAnalyzed: chunks.length,
        intentConfidence: intent.confidence,
        sources: chunks.map(c => c.chunk.id),
        frameworks: frameworks.filter((f): f is string => Boolean(f)),
        followUpQuestions: [
          "How does this architecture scale?",
          "What are the security considerations?",
          "How is this architecture deployed?"
        ]
      }
    };
  }
}