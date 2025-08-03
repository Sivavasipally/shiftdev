import { VectorDB } from './VectorDB';
import { LLMManager } from './LLMManager';
import { QueryDecomposer } from './QueryDecomposer';
import { HybridSearchEngine } from './HybridSearchEngine';
import { CodebaseOverviewGenerator, CodebaseOverview } from './CodebaseOverviewGenerator';
import { ChainOfThoughtEngine } from './ChainOfThoughtEngine';
import { EndpointDetector, APIDocumentation } from './EndpointDetector';

export interface QueryContext {
  query: string;
  queryType: QueryType;
  intent: QueryIntent;
  scope: QueryScope;
  complexity: QueryComplexity;
  requiresCodebaseOverview: boolean;
}

export enum QueryType {
  OVERVIEW = 'overview',
  SPECIFIC = 'specific',
  ARCHITECTURAL = 'architectural',
  IMPLEMENTATION = 'implementation',
  DEBUG = 'debug',
  COMPARISON = 'comparison',
  RECOMMENDATION = 'recommendation',
  ENDPOINTS = 'endpoints',
  API_DOCUMENTATION = 'api_documentation'
}

export enum QueryIntent {
  UNDERSTAND = 'understand',
  MODIFY = 'modify',
  DEBUG = 'debug',
  OPTIMIZE = 'optimize',
  DOCUMENT = 'document',
  ANALYZE = 'analyze'
}

export enum QueryScope {
  ENTIRE_CODEBASE = 'entire_codebase',
  SPECIFIC_COMPONENT = 'specific_component',
  SPECIFIC_FILE = 'specific_file',
  SPECIFIC_FUNCTION = 'specific_function',
  FRAMEWORK_SPECIFIC = 'framework_specific'
}

export enum QueryComplexity {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  ARCHITECTURAL = 'architectural'
}

export interface EnhancedQueryResponse {
  answer: string;
  codebaseOverview?: CodebaseOverview;
  apiDocumentation?: APIDocumentation;
  relevantCode: CodeContext[];
  recommendations: string[];
  followUpQuestions: string[];
  confidence: number;
  processingMetadata: ProcessingMetadata;
}

export interface CodeContext {
  filePath: string;
  content: string;
  relevanceScore: number;
  explanation: string;
  lineNumbers?: { start: number; end: number };
}

export interface ProcessingMetadata {
  queryClassification: QueryContext;
  searchResults: number;
  processingTimeMs: number;
  llmCalls: number;
  usedOverview: boolean;
  usedEndpointDetection: boolean;
}

export class EnhancedQueryHandler {
  private vectorDB: VectorDB;
  private llmManager: LLMManager;
  private queryDecomposer: QueryDecomposer;
  private hybridSearch: HybridSearchEngine;
  private overviewGenerator: CodebaseOverviewGenerator;
  private chainOfThought: ChainOfThoughtEngine;
  private endpointDetector: EndpointDetector;
  private cachedOverview: CodebaseOverview | null = null;
  private lastOverviewTime: Date | null = null;
  private cachedEndpoints: APIDocumentation | null = null;
  private lastEndpointsTime: Date | null = null;

  constructor(
    vectorDB: VectorDB,
    llmManager: LLMManager,
    projectPath: string
  ) {
    this.vectorDB = vectorDB;
    this.llmManager = llmManager;
    this.queryDecomposer = new QueryDecomposer(llmManager);
    this.hybridSearch = new HybridSearchEngine(vectorDB);
    this.overviewGenerator = new CodebaseOverviewGenerator(vectorDB, llmManager);
    this.chainOfThought = new ChainOfThoughtEngine(llmManager);
    this.endpointDetector = new EndpointDetector(vectorDB, llmManager);
  }

  async handleQuery(
    query: string, 
    projectPath?: string,
    options: {
      includeOverview?: boolean;
      maxResults?: number;
      forceRefreshOverview?: boolean;
    } = {}
  ): Promise<EnhancedQueryResponse> {
    const startTime = Date.now();
    let llmCalls = 0;

    console.log(`🔍 Processing query: "${query}"`);

    try {
      // 1. Classify and analyze the query
      const queryContext = await this.classifyQuery(query);
      llmCalls++;

      console.log(`📊 Query classified as: ${queryContext.queryType} (${queryContext.scope})`);

      // 2. Determine if codebase overview is needed
      const needsOverview = options.includeOverview || 
                          queryContext.requiresCodebaseOverview ||
                          this.shouldGenerateOverview(query, queryContext);

      // 3. Determine if endpoint detection is needed
      const needsEndpoints = this.shouldDetectEndpoints(query, queryContext);

      let codebaseOverview: CodebaseOverview | undefined;
      let apiDocumentation: APIDocumentation | undefined;

      // 4. Generate or retrieve codebase overview if needed
      if (needsOverview && projectPath) {
        codebaseOverview = await this.getCodebaseOverview(projectPath, options.forceRefreshOverview);
      }

      // 5. Generate or retrieve API documentation if needed
      if (needsEndpoints) {
        apiDocumentation = await this.getAPIDocumentation(options.forceRefreshOverview);
      }

      // 6. Perform context-aware search
      const relevantCode = await this.performContextualSearch(
        query, 
        queryContext, 
        codebaseOverview,
        options.maxResults || 10
      );

      // 7. Generate comprehensive answer
      const answer = await this.generateEnhancedAnswer(
        query, 
        queryContext, 
        relevantCode, 
        codebaseOverview,
        apiDocumentation
      );
      llmCalls++;

      // 8. Generate recommendations and follow-up questions
      const [recommendations, followUpQuestions] = await Promise.all([
        this.generateRecommendations(query, queryContext, relevantCode, codebaseOverview, apiDocumentation),
        this.generateFollowUpQuestions(query, queryContext, codebaseOverview, apiDocumentation)
      ]);
      llmCalls += 2;

      // 9. Calculate confidence score
      const confidence = this.calculateConfidence(queryContext, relevantCode, codebaseOverview, apiDocumentation);

      const processingTime = Date.now() - startTime;
      console.log(`✅ Query processed in ${processingTime}ms with ${llmCalls} LLM calls`);

      return {
        answer,
        codebaseOverview,
        apiDocumentation,
        relevantCode,
        recommendations,
        followUpQuestions,
        confidence,
        processingMetadata: {
          queryClassification: queryContext,
          searchResults: relevantCode.length,
          processingTimeMs: processingTime,
          llmCalls,
          usedOverview: !!codebaseOverview,
          usedEndpointDetection: !!apiDocumentation
        }
      };

    } catch (error) {
      console.error('❌ Failed to process query:', error);
      throw new Error(`Failed to process query: ${error}`);
    }
  }

  private async classifyQuery(query: string): Promise<QueryContext> {
    const classificationPrompt = `
    Analyze this query and classify it along multiple dimensions:

    Query: "${query}"

    Classify the query and respond with JSON:
    {
      "queryType": "overview|specific|architectural|implementation|debug|comparison|recommendation|endpoints|api_documentation",
      "intent": "understand|modify|debug|optimize|document|analyze",
      "scope": "entire_codebase|specific_component|specific_file|specific_function|framework_specific",
      "complexity": "simple|moderate|complex|architectural",
      "requiresCodebaseOverview": boolean,
      "reasoning": "brief explanation"
    }

    Guidelines:
    - "overview" queries ask about general structure, entire codebase, or high-level understanding
    - "architectural" queries focus on system design, patterns, or component relationships
    - "endpoints" queries ask about API endpoints, routes, or REST APIs
    - "api_documentation" queries ask for API documentation or endpoint details
    - "specific" queries target particular files, functions, or components
    - requiresCodebaseOverview should be true for overview, architectural, or broad understanding queries
    - Queries like "explain the code", "overview of source code", "how does this work" need overview
    - Queries like "give me all endpoints", "show me the APIs", "list all routes" are endpoint queries
    `;

    try {
      const response = await this.llmManager.generateResponse(classificationPrompt, {
        maxTokens: 300,
        temperature: 0.1
      });

      const classification = JSON.parse(response);
      
      return {
        query,
        queryType: QueryType[classification.queryType.toUpperCase() as keyof typeof QueryType] || QueryType.SPECIFIC,
        intent: QueryIntent[classification.intent.toUpperCase() as keyof typeof QueryIntent] || QueryIntent.UNDERSTAND,
        scope: QueryScope[classification.scope.toUpperCase() as keyof typeof QueryScope] || QueryScope.SPECIFIC_COMPONENT,
        complexity: QueryComplexity[classification.complexity.toUpperCase() as keyof typeof QueryComplexity] || QueryComplexity.MODERATE,
        requiresCodebaseOverview: classification.requiresCodebaseOverview || false
      };

    } catch (error) {
      console.warn('Failed to classify query, using defaults:', error);
      
      // Fallback classification based on keywords
      return this.fallbackClassifyQuery(query);
    }
  }

  private fallbackClassifyQuery(query: string): QueryContext {
    const lowerQuery = query.toLowerCase();
    
    // Check for overview indicators
    const overviewKeywords = [
      'overview', 'explain the code', 'entire source', 'whole project', 
      'codebase', 'architecture', 'structure', 'how does this work',
      'what does this do', 'general explanation', 'summary'
    ];

    const isOverview = overviewKeywords.some(keyword => lowerQuery.includes(keyword));
    
    // Check for architectural indicators
    const architecturalKeywords = [
      'architecture', 'design pattern', 'component', 'service', 'module',
      'dependency', 'relationship', 'flow', 'structure'
    ];

    const isArchitectural = architecturalKeywords.some(keyword => lowerQuery.includes(keyword));

    // Determine scope
    let scope = QueryScope.SPECIFIC_COMPONENT;
    if (lowerQuery.includes('entire') || lowerQuery.includes('whole') || 
        lowerQuery.includes('all') || lowerQuery.includes('codebase')) {
      scope = QueryScope.ENTIRE_CODEBASE;
    }

    return {
      query,
      queryType: isOverview ? QueryType.OVERVIEW : 
                 isArchitectural ? QueryType.ARCHITECTURAL : 
                 QueryType.SPECIFIC,
      intent: QueryIntent.UNDERSTAND,
      scope,
      complexity: isOverview || isArchitectural ? QueryComplexity.ARCHITECTURAL : QueryComplexity.MODERATE,
      requiresCodebaseOverview: isOverview || isArchitectural || scope === QueryScope.ENTIRE_CODEBASE
    };
  }

  private shouldGenerateOverview(query: string, context: QueryContext): boolean {
    // Always generate overview for these conditions
    if (context.requiresCodebaseOverview) return true;
    if (context.queryType === QueryType.OVERVIEW) return true;
    if (context.scope === QueryScope.ENTIRE_CODEBASE) return true;
    
    // Check for specific phrases that indicate need for overview
    const overviewPhrases = [
      'give overview', 'explain the code', 'how does this work',
      'what does this project do', 'describe the codebase',
      'structure of the code', 'architecture overview'
    ];

    return overviewPhrases.some(phrase => 
      query.toLowerCase().includes(phrase.toLowerCase())
    );
  }

  private shouldDetectEndpoints(query: string, context: QueryContext): boolean {
    // Always detect endpoints for these conditions
    if (context.queryType === QueryType.ENDPOINTS) return true;
    if (context.queryType === QueryType.API_DOCUMENTATION) return true;
    
    // Check for specific phrases that indicate need for endpoint detection
    const endpointPhrases = [
      'all endpoints', 'list endpoints', 'show endpoints', 'api endpoints',
      'all routes', 'list routes', 'show routes', 'available apis',
      'rest endpoints', 'http endpoints', 'web apis', 'api documentation',
      'endpoints available', 'what apis', 'available endpoints',
      'show me apis', 'list apis', 'get endpoints'
    ];

    return endpointPhrases.some(phrase => 
      query.toLowerCase().includes(phrase.toLowerCase())
    );
  }

  private async getCodebaseOverview(
    projectPath: string, 
    forceRefresh: boolean = false
  ): Promise<CodebaseOverview | undefined> {
    try {
      // Check if we have a cached overview that's still fresh (within last hour)
      const cacheValidDuration = 60 * 60 * 1000; // 1 hour
      const now = new Date();
      
      if (!forceRefresh && 
          this.cachedOverview && 
          this.lastOverviewTime &&
          (now.getTime() - this.lastOverviewTime.getTime()) < cacheValidDuration) {
        console.log('📋 Using cached codebase overview');
        return this.cachedOverview;
      }

      console.log('🔄 Generating fresh codebase overview...');
      const overview = await this.overviewGenerator.generateCompleteOverview(projectPath);
      
      // Cache the result
      this.cachedOverview = overview;
      this.lastOverviewTime = now;

      return overview;
    } catch (error) {
      console.warn('Failed to generate codebase overview:', error);
      return undefined;
    }
  }

  private async getAPIDocumentation(forceRefresh: boolean = false): Promise<APIDocumentation | undefined> {
    try {
      // Check if we have a cached API documentation that's still fresh (within last hour)
      const cacheValidDuration = 60 * 60 * 1000; // 1 hour
      const now = new Date();
      
      if (!forceRefresh && 
          this.cachedEndpoints && 
          this.lastEndpointsTime &&
          (now.getTime() - this.lastEndpointsTime.getTime()) < cacheValidDuration) {
        console.log('📋 Using cached API documentation');
        return this.cachedEndpoints;
      }

      console.log('🔄 Detecting API endpoints...');
      const apiDocumentation = await this.endpointDetector.detectAllEndpoints();
      
      // Cache the result
      this.cachedEndpoints = apiDocumentation;
      this.lastEndpointsTime = now;

      return apiDocumentation;
    } catch (error) {
      console.warn('Failed to detect API endpoints:', error);
      return undefined;
    }
  }

  private async performContextualSearch(
    query: string,
    context: QueryContext,
    overview: CodebaseOverview | undefined,
    maxResults: number
  ): Promise<CodeContext[]> {
    console.log(`🔍 Performing contextual search (scope: ${context.scope})`);

    let searchResults: any[] = [];

    // If we have overview and it's a broad query, use framework and component info to guide search
    if (overview && (context.scope === QueryScope.ENTIRE_CODEBASE || context.queryType === QueryType.OVERVIEW)) {
      // Search for key components identified in overview
      const keyComponentSearches = overview.keyComponents.slice(0, 5).map(component =>
        this.hybridSearch.search(query + ' ' + component.name, {
          limit: 2,
          filters: { filePath: component.filePath }
        })
      );

      const componentResults = await Promise.all(keyComponentSearches);
      searchResults = componentResults.flat();

      // Also do a general search to capture anything we might have missed
      const generalResults = await this.hybridSearch.search(query, {
        limit: maxResults - searchResults.length,
        filters: {}
      });

      searchResults = [...searchResults, ...generalResults];
    } else {
      // Standard search for specific queries
      searchResults = await this.hybridSearch.search(query, {
        limit: maxResults,
        filters: this.buildSearchFilters(context, overview)
      });
    }

    // Convert search results to code contexts
    const codeContexts: CodeContext[] = [];

    for (const result of searchResults.slice(0, maxResults)) {
      const explanation = await this.generateCodeExplanation(
        result.content,
        result.metadata?.filePath || 'unknown',
        query,
        context
      );

      codeContexts.push({
        filePath: result.metadata?.filePath || 'unknown',
        content: result.content || '',
        relevanceScore: result.score || 0,
        explanation,
        lineNumbers: result.metadata?.lineNumbers
      });
    }

    return codeContexts;
  }

  private buildSearchFilters(
    context: QueryContext,
    overview: CodebaseOverview | undefined
  ): Record<string, any> {
    const filters: Record<string, any> = {};

    // Add framework-specific filters if relevant
    if (context.scope === QueryScope.FRAMEWORK_SPECIFIC && overview) {
      const primaryFramework = overview.frameworks[0];
      if (primaryFramework) {
        filters.framework = primaryFramework.name;
      }
    }

    return filters;
  }

  private async generateCodeExplanation(
    code: string,
    filePath: string,
    query: string,
    context: QueryContext
  ): Promise<string> {
    const prompt = `
    Briefly explain this code snippet in the context of the user's query.
    
    Query: "${query}"
    File: ${filePath}
    
    Code:
    \`\`\`
    ${code.substring(0, 1000)}${code.length > 1000 ? '...' : ''}
    \`\`\`
    
    Provide a concise 1-2 sentence explanation of what this code does and how it relates to the query.
    `;

    try {
      return await this.llmManager.generateResponse(prompt, {
        maxTokens: 150,
        temperature: 0.3
      });
    } catch (error) {
      return `Code from ${filePath} - unable to generate explanation`;
    }
  }

  private async generateEnhancedAnswer(
    query: string,
    context: QueryContext,
    relevantCode: CodeContext[],
    overview: CodebaseOverview | undefined,
    apiDocumentation: APIDocumentation | undefined
  ): Promise<string> {
    let prompt = '';

    if ((context.queryType === QueryType.ENDPOINTS || context.queryType === QueryType.API_DOCUMENTATION) && apiDocumentation) {
      // Generate endpoint-focused answer
      prompt = `
      User Query: "${query}"
      
      Based on the comprehensive API endpoint analysis, provide a detailed explanation:
      
      ## API Endpoints Summary:
      - **Total Endpoints**: ${apiDocumentation.totalEndpoints}
      - **Methods**: ${Object.entries(apiDocumentation.endpointsByMethod).map(([method, count]) => `${method}: ${count}`).join(', ')}
      - **Frameworks**: ${Object.entries(apiDocumentation.endpointsByFramework).map(([framework, count]) => `${framework}: ${count}`).join(', ')}
      
      ## Endpoint Groups:
      ${apiDocumentation.groups.map(group => `
      ### ${group.name} (${group.basePath})
      ${group.endpoints.map(endpoint => `- **${endpoint.method} ${endpoint.path}** - ${endpoint.handler} (${endpoint.filePath})`).join('\n')}
      `).join('\n')}
      
      ## All Endpoints:
      ${apiDocumentation.allEndpoints.map(endpoint => `
      **${endpoint.method} ${endpoint.path}**
      - Handler: ${endpoint.handler}
      - File: ${endpoint.filePath}${endpoint.lineNumber ? ` (line ${endpoint.lineNumber})` : ''}
      - Framework: ${endpoint.framework}
      ${endpoint.description ? `- Description: ${endpoint.description}` : ''}
      ${endpoint.parameters && endpoint.parameters.length > 0 ? `- Parameters: ${endpoint.parameters.map(p => `${p.name} (${p.type})`).join(', ')}` : ''}
      ${endpoint.middleware && endpoint.middleware.length > 0 ? `- Middleware: ${endpoint.middleware.join(', ')}` : ''}
      `).join('\n')}
      
      Provide a comprehensive explanation that covers:
      1. Complete list of all API endpoints found in the codebase
      2. Organization and grouping of endpoints
      3. Framework-specific patterns and conventions used
      4. Notable features like authentication, middleware, or validation
      5. API design patterns and best practices observed
      
      Make it well-structured and easy to understand for developers who need to work with these APIs.
      `;
    } else if (context.queryType === QueryType.OVERVIEW && overview) {
      // Generate overview-focused answer
      prompt = `
      User Query: "${query}"
      
      Based on this comprehensive codebase analysis, provide a detailed explanation:
      
      ## Codebase Overview:
      - **Project**: ${overview.summary.projectName}
      - **Description**: ${overview.summary.description}
      - **Architecture**: ${overview.architecture.type}
      - **Primary Languages**: ${overview.summary.primaryLanguages.map(l => `${l.language} (${l.percentage.toFixed(1)}%)`).join(', ')}
      - **Total Files**: ${overview.summary.totalFiles}
      - **Frameworks**: ${overview.frameworks.map(f => f.name).join(', ')}
      
      ## Key Components:
      ${overview.keyComponents.slice(0, 5).map(c => `- **${c.name}**: ${c.purpose}`).join('\n')}
      
      ## Architecture Details:
      - **Services**: ${overview.architecture.services.length} services detected
      - **Organization**: ${overview.structure.organizationPattern}
      - **Test Framework**: ${overview.structure.testStructure.framework}
      
      ## Code Quality:
      - **Complexity**: ${overview.summary.estimatedComplexity}
      - **Maturity**: ${overview.summary.maturityLevel}
      - **Test Coverage**: ${overview.codeMetrics.testCoverage.overall}%
      
      ${relevantCode.length > 0 ? `
      ## Relevant Code Examples:
      ${relevantCode.slice(0, 3).map(code => `
      **${code.filePath}**:
      ${code.explanation}
      \`\`\`
      ${code.content.substring(0, 300)}${code.content.length > 300 ? '...' : ''}
      \`\`\`
      `).join('\n')}
      ` : ''}
      
      Provide a comprehensive explanation that covers:
      1. What this codebase does and its purpose
      2. The overall architecture and how components work together
      3. Key technologies and frameworks used
      4. Notable patterns or design decisions
      5. Current state and quality assessment
      
      Make it accessible and well-structured for someone trying to understand the entire project.
      `;
    } else {
      // Generate specific answer
      prompt = `
      User Query: "${query}"
      
      Context: This is a ${context.queryType} query with ${context.scope} scope.
      
      ${overview ? `
      ## Project Context:
      - Project: ${overview.summary.projectName}
      - Architecture: ${overview.architecture.type}
      - Primary Frameworks: ${overview.frameworks.map(f => f.name).join(', ')}
      ` : ''}
      
      ## Relevant Code:
      ${relevantCode.map(code => `
      **File: ${code.filePath}**
      ${code.explanation}
      
      \`\`\`
      ${code.content}
      \`\`\`
      `).join('\n\n')}
      
      Based on the code analysis above, provide a comprehensive answer to the user's query.
      Focus on being specific, accurate, and helpful. Include code examples where relevant.
      `;
    }

    try {
      const answer = await this.llmManager.generateResponse(prompt, {
        maxTokens: 2000,
        temperature: 0.4
      });

      return answer;
    } catch (error) {
      console.error('Failed to generate enhanced answer:', error);
      return `I found ${relevantCode.length} relevant code sections, but I'm having trouble generating a comprehensive answer. Please try rephrasing your question.`;
    }
  }

  private async generateRecommendations(
    query: string,
    context: QueryContext,
    relevantCode: CodeContext[],
    overview: CodebaseOverview | undefined,
    apiDocumentation: APIDocumentation | undefined
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Add overview-based recommendations if available
    if (overview && overview.recommendations.length > 0) {
      recommendations.push(
        ...overview.recommendations.slice(0, 3).map(rec => 
          `${rec.category}: ${rec.title} - ${rec.description}`
        )
      );
    }

    // Add endpoint-specific recommendations
    if (apiDocumentation && (context.queryType === QueryType.ENDPOINTS || context.queryType === QueryType.API_DOCUMENTATION)) {
      recommendations.push(
        `Consider adding API documentation for the ${apiDocumentation.totalEndpoints} endpoints found`,
        'Review endpoint security and authentication patterns',
        'Consider implementing OpenAPI/Swagger documentation',
        'Look for opportunities to group related endpoints consistently'
      );
      
      if (apiDocumentation.totalEndpoints > 20) {
        recommendations.push('Consider implementing API versioning strategy for the large number of endpoints');
      }
    }

    // Add query-specific recommendations
    if (context.queryType === QueryType.OVERVIEW) {
      recommendations.push(
        'Consider exploring specific components that interest you most',
        'Review the architectural patterns identified in your codebase',
        'Check the recommendations section for improvement opportunities'
      );
    }

    if (context.intent === QueryIntent.OPTIMIZE && relevantCode.length > 0) {
      recommendations.push(
        'Review the identified code sections for performance bottlenecks',
        'Consider refactoring complex functions into smaller, more manageable pieces',
        'Look for opportunities to reduce code duplication'
      );
    }

    return recommendations.slice(0, 5); // Limit to 5 recommendations
  }

  private async generateFollowUpQuestions(
    query: string,
    context: QueryContext,
    overview: CodebaseOverview | undefined,
    apiDocumentation: APIDocumentation | undefined
  ): Promise<string[]> {
    const questions: string[] = [];

    if ((context.queryType === QueryType.ENDPOINTS || context.queryType === QueryType.API_DOCUMENTATION) && apiDocumentation) {
      questions.push(
        'How are these endpoints authenticated and authorized?',
        'What is the request/response format for these APIs?',
        'Can you show me the implementation of a specific endpoint?',
        'Are there any middleware or validation patterns used?'
      );
      
      if (apiDocumentation.totalEndpoints > 0) {
        const firstEndpoint = apiDocumentation.allEndpoints[0];
        questions.push(`How does the ${firstEndpoint.method} ${firstEndpoint.path} endpoint work?`);
      }
    } else if (context.queryType === QueryType.OVERVIEW && overview) {
      questions.push(
        `How does the ${overview.frameworks[0]?.name || 'main framework'} implementation work?`,
        'What are the key data flows in this system?',
        'Can you explain the testing strategy used?',
        'What are the main entry points of the application?'
      );
    } else {
      questions.push(
        'Can you show me how this component is used elsewhere?',
        'What are the dependencies of this code?',
        'Are there any similar implementations in the codebase?',
        'How is this tested?'
      );
    }

    return questions.slice(0, 4); // Limit to 4 questions
  }

  private calculateConfidence(
    context: QueryContext,
    relevantCode: CodeContext[],
    overview: CodebaseOverview | undefined,
    apiDocumentation: APIDocumentation | undefined
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence if we have overview for overview queries
    if (context.queryType === QueryType.OVERVIEW && overview) {
      confidence += 0.3;
    }

    // Boost confidence if we have API documentation for endpoint queries
    if ((context.queryType === QueryType.ENDPOINTS || context.queryType === QueryType.API_DOCUMENTATION) && apiDocumentation) {
      confidence += 0.4; // High confidence for endpoint detection
    }

    // Boost confidence based on relevant code found
    if (relevantCode.length > 0) {
      const avgRelevance = relevantCode.reduce((sum, code) => sum + code.relevanceScore, 0) / relevantCode.length;
      confidence += avgRelevance * 0.3;
    }

    // Boost confidence for simpler queries
    if (context.complexity === QueryComplexity.SIMPLE) {
      confidence += 0.1;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  // Public utility methods
  async clearOverviewCache(): Promise<void> {
    this.cachedOverview = null;
    this.lastOverviewTime = null;
    console.log('🗑️ Cleared codebase overview cache');
  }

  async clearEndpointsCache(): Promise<void> {
    this.cachedEndpoints = null;
    this.lastEndpointsTime = null;
    console.log('🗑️ Cleared API endpoints cache');
  }

  async clearAllCaches(): Promise<void> {
    await this.clearOverviewCache();
    await this.clearEndpointsCache();
    console.log('🗑️ Cleared all caches');
  }

  async preloadOverview(projectPath: string): Promise<void> {
    console.log('⏳ Preloading codebase overview...');
    await this.getCodebaseOverview(projectPath, true);
    console.log('✅ Codebase overview preloaded');
  }

  getOverviewCacheStatus(): { cached: boolean; age?: number } {
    if (!this.cachedOverview || !this.lastOverviewTime) {
      return { cached: false };
    }

    const age = Date.now() - this.lastOverviewTime.getTime();
    return { cached: true, age };
  }
}