import { LLMManager, TaskProfile } from './LLMManager';
import { UserProfile } from '../types';
import { QueryIntent, QueryContext as ExistingQueryContext } from './QueryProcessor';

export interface QueryComponent {
  id: string;
  type: 'semantic' | 'structural' | 'behavioral' | 'architectural' | 'business' | 'technical';
  intent: ComponentIntent;
  keywords: string[];
  entities: string[];
  filters: QueryFilter[];
  priority: number;
  dependencies: string[]; // IDs of other components this depends on
  expectedOutputType: 'code' | 'explanation' | 'list' | 'diagram' | 'analysis' | 'summary';
}

export interface ComponentIntent {
  action: 'find' | 'explain' | 'analyze' | 'compare' | 'generate' | 'refactor' | 'debug' | 'optimize';
  subject: string;
  context?: string;
  scope?: 'file' | 'class' | 'function' | 'module' | 'project' | 'framework';
  temporal?: 'current' | 'historical' | 'trending';
}

export interface QueryFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex' | 'range' | 'in' | 'exists';
  value: any;
  weight?: number;
}

export interface DecomposedQuery {
  originalQuery: string;
  queryType: 'simple' | 'compound' | 'complex' | 'analytical';
  components: QueryComponent[];
  executionPlan: ExecutionStep[];
  metadata: {
    confidence: number;
    estimatedComplexity: number;
    suggestedApproach: string;
    alternativeInterpretations?: string[];
  };
}

export interface ExecutionStep {
  id: string;
  componentIds: string[];
  type: 'search' | 'analysis' | 'synthesis' | 'validation';
  method: string;
  parameters: Record<string, any>;
  dependencies: string[];
  estimatedDuration: number;
  parallelizable: boolean;
}

export interface QueryContext extends ExistingQueryContext {
  currentWorkspace?: string;
  recentQueries?: string[];
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  activeFrameworks?: string[];
  projectContext?: {
    languages: string[];
    frameworks: string[];
    size: 'small' | 'medium' | 'large';
    complexity: 'low' | 'medium' | 'high';
  };
}

export interface QueryExpansion {
  synonyms: string[];
  relatedTerms: string[];
  frameworkSpecificTerms: Record<string, string[]>;
  domainSpecificTerms: string[];
  technicalAcronyms: Record<string, string>;
}

export class QueryDecomposer {
  private llmManager: LLMManager;
  private queryPatterns: Map<string, RegExp> = new Map();
  private intentKeywords: Map<string, string[]> = new Map();
  private entityExtractor: EntityExtractor;
  private queryExpander: QueryExpander;

  constructor(userProfile: UserProfile) {
    this.llmManager = LLMManager.getInstance(userProfile);
    this.entityExtractor = new EntityExtractor();
    this.queryExpander = new QueryExpander();
    this.initializePatterns();
    this.initializeIntentKeywords();
  }

  async decomposeQuery(query: string, context: QueryContext): Promise<DecomposedQuery> {
    console.log(`🔍 Phase 4: Decomposing complex query: "${query}"`);

    // Step 1: Preprocess and normalize the query
    const normalizedQuery = await this.preprocessQuery(query, context);

    // Step 2: Classify query complexity
    const queryType = this.classifyQueryComplexity(normalizedQuery);

    // Step 3: Extract entities and expand query
    const entities = await this.entityExtractor.extractEntities(normalizedQuery, context);
    const expansion = await this.queryExpander.expandQuery(normalizedQuery, context);

    // Step 4: Decompose into components
    const components = await this.decomposeIntoComponents(normalizedQuery, entities, expansion, context);

    // Step 5: Create execution plan
    const executionPlan = await this.createExecutionPlan(components, context);

    // Step 6: Calculate metadata
    const metadata = this.calculateQueryMetadata(normalizedQuery, components, executionPlan);

    return {
      originalQuery: query,
      queryType,
      components,
      executionPlan,
      metadata
    };
  }

  private async preprocessQuery(query: string, context: QueryContext): Promise<string> {
    // Expand abbreviations and acronyms
    let normalized = query;
    
    const acronymExpansions: Record<string, string> = {
      'api': 'application programming interface',
      'ui': 'user interface',
      'db': 'database',
      'auth': 'authentication',
      'crud': 'create read update delete',
      'mvc': 'model view controller',
      'oop': 'object oriented programming',
      'rest': 'representational state transfer',
      'jwt': 'json web token',
      'sql': 'structured query language',
      'orm': 'object relational mapping',
      'dto': 'data transfer object',
      'dao': 'data access object',
      'pojo': 'plain old java object',
      'di': 'dependency injection',
      'ioc': 'inversion of control'
    };

    for (const [acronym, expansion] of Object.entries(acronymExpansions)) {
      const regex = new RegExp(`\\b${acronym}\\b`, 'gi');
      normalized = normalized.replace(regex, expansion);
    }

    // Handle framework-specific terminology
    if (context.activeFrameworks) {
      for (const framework of context.activeFrameworks) {
        normalized = await this.expandFrameworkTerms(normalized, framework);
      }
    }

    // Remove filler words but preserve important qualifiers
    const fillerWords = ['um', 'uh', 'like', 'you know', 'basically', 'essentially'];
    const words = normalized.split(/\s+/);
    const filteredWords = words.filter(word => 
      !fillerWords.includes(word.toLowerCase()) || word.length > 2
    );

    return filteredWords.join(' ').trim();
  }

  private classifyQueryComplexity(query: string): DecomposedQuery['queryType'] {
    const complexityIndicators = {
      simple: ['find', 'show', 'get', 'what is', 'where is', 'list'],
      compound: ['and', 'or', 'also', 'plus', 'additionally', 'compare', 'both'],
      complex: ['analyze', 'explain how', 'why does', 'what happens when', 'relationship between', 'integration'],
      analytical: ['optimize', 'refactor', 'improve', 'performance', 'architecture', 'design pattern', 'best practice']
    };

    const lowerQuery = query.toLowerCase();
    let maxScore = 0;
    let classification: DecomposedQuery['queryType'] = 'simple';

    for (const [type, indicators] of Object.entries(complexityIndicators)) {
      const score = indicators.reduce((acc, indicator) => {
        return acc + (lowerQuery.includes(indicator) ? 1 : 0);
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        classification = type as DecomposedQuery['queryType'];
      }
    }

    // Additional complexity checks
    const sentenceCount = query.split(/[.!?]+/).filter(s => s.trim()).length;
    const questionWordCount = (query.match(/\b(what|where|when|why|how|which|who)\b/gi) || []).length;
    const conjunctionCount = (query.match(/\b(and|or|but|also|however|moreover|furthermore)\b/gi) || []).length;

    if (sentenceCount > 2 || questionWordCount > 2 || conjunctionCount > 1) {
      classification = classification === 'simple' ? 'compound' : 'complex';
    }

    // Check for analytical keywords
    if (/\b(architecture|design|pattern|performance|optimization|scalability|security)\b/i.test(query)) {
      classification = 'analytical';
    }

    return classification;
  }

  private async decomposeIntoComponents(
    query: string,
    entities: ExtractedEntities,
    expansion: QueryExpansion,
    context: QueryContext
  ): Promise<QueryComponent[]> {
    const components: QueryComponent[] = [];

    // Use LLM for sophisticated decomposition
    const taskProfile: TaskProfile = {
      taskType: 'analysis',
      priority: 'high',
      requiresAccuracy: true
    };

    const decompositionPrompt = this.buildDecompositionPrompt(query, entities, context);
    
    try {
      const llmResponse = await this.llmManager.generateResponse([
        { role: 'system', content: 'You are an expert at decomposing complex technical queries into searchable components. Analyze the query and break it down into logical, executable components.' },
        { role: 'user', content: decompositionPrompt }
      ], taskProfile);

      const parsedComponents = this.parseLLMDecomposition(llmResponse.content);
      components.push(...parsedComponents);
    } catch (error) {
      console.warn('LLM decomposition failed, using rule-based approach:', error);
      const ruleBasedComponents = this.decomposeUsingRules(query, entities, expansion);
      components.push(...ruleBasedComponents);
    }

    // If no components were created, create at least one default component
    if (components.length === 0) {
      components.push(this.createDefaultComponent(query, entities));
    }

    // Enhance components with additional analysis
    return this.enhanceComponents(components, context);
  }

  private buildDecompositionPrompt(query: string, entities: ExtractedEntities, context: QueryContext): string {
    let prompt = `Decompose this technical query into searchable components:\n\nQuery: "${query}"\n\n`;
    
    if (entities.frameworks.length > 0) {
      prompt += `Detected frameworks: ${entities.frameworks.join(', ')}\n`;
    }
    
    if (entities.technologies.length > 0) {
      prompt += `Detected technologies: ${entities.technologies.join(', ')}\n`;
    }
    
    if (entities.codeElements.length > 0) {
      prompt += `Detected code elements: ${entities.codeElements.join(', ')}\n`;
    }

    if (context.activeFrameworks && context.activeFrameworks.length > 0) {
      prompt += `Active frameworks in project: ${context.activeFrameworks.join(', ')}\n`;
    }

    prompt += `\nDecompose this into 1-4 components. For each component, provide:
1. id: A unique identifier (e.g., "search_classes", "analyze_architecture")
2. type: One of [semantic, structural, behavioral, architectural, business, technical]
3. intent: {
   action: One of [find, explain, analyze, compare, generate, refactor, debug, optimize]
   subject: What to act upon
   scope: One of [file, class, function, module, project, framework]
}
4. keywords: Array of search terms
5. entities: Array of relevant entities from the query
6. priority: 1-10 (10 = highest)
7. dependencies: Array of component IDs this depends on (empty if independent)
8. expectedOutputType: One of [code, explanation, list, diagram, analysis, summary]

Return ONLY a valid JSON array with no additional text.`;

    return prompt;
  }

  private parseLLMDecomposition(llmResponse: string): QueryComponent[] {
    try {
      // Extract JSON from response
      const jsonMatch = llmResponse.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('No JSON array found in LLM response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        console.warn('LLM response is not an array');
        return [];
      }

      return parsed.map((comp: any, index: number) => this.normalizeComponent(comp, index));
    } catch (error) {
      console.warn('Failed to parse LLM decomposition:', error);
      return [];
    }
  }

  private normalizeComponent(rawComponent: any, index: number): QueryComponent {
    return {
      id: rawComponent.id || `component_${index}`,
      type: rawComponent.type || 'semantic',
      intent: {
        action: rawComponent.intent?.action || 'find',
        subject: rawComponent.intent?.subject || rawComponent.subject || 'code',
        context: rawComponent.intent?.context,
        scope: rawComponent.intent?.scope || 'project'
      },
      keywords: Array.isArray(rawComponent.keywords) ? rawComponent.keywords : [],
      entities: Array.isArray(rawComponent.entities) ? rawComponent.entities : [],
      filters: Array.isArray(rawComponent.filters) ? rawComponent.filters : [],
      priority: typeof rawComponent.priority === 'number' ? rawComponent.priority : 5,
      dependencies: Array.isArray(rawComponent.dependencies) ? rawComponent.dependencies : [],
      expectedOutputType: rawComponent.expectedOutputType || 'explanation'
    };
  }

  private decomposeUsingRules(
    query: string,
    entities: ExtractedEntities,
    expansion: QueryExpansion
  ): QueryComponent[] {
    const components: QueryComponent[] = [];
    const lowerQuery = query.toLowerCase();

    // Pattern 1: Find/Search patterns
    if (this.matchesPattern(lowerQuery, 'find_pattern')) {
      components.push({
        id: 'search_component',
        type: 'semantic',
        intent: { action: 'find', subject: this.extractSubject(query), scope: 'project' },
        keywords: entities.codeElements.concat(entities.technologies),
        entities: entities.all,
        filters: [],
        priority: 8,
        dependencies: [],
        expectedOutputType: 'list'
      });
    }

    // Pattern 2: Explanation patterns
    if (this.matchesPattern(lowerQuery, 'explain_pattern')) {
      components.push({
        id: 'explanation_component',
        type: 'behavioral',
        intent: { action: 'explain', subject: this.extractSubject(query), scope: 'function' },
        keywords: expansion.synonyms.concat(entities.codeElements),
        entities: entities.codeElements,
        filters: [],
        priority: 9,
        dependencies: components.length > 0 ? ['search_component'] : [],
        expectedOutputType: 'explanation'
      });
    }

    // Pattern 3: Analysis patterns
    if (this.matchesPattern(lowerQuery, 'analysis_pattern')) {
      components.push({
        id: 'analysis_component',
        type: 'architectural',
        intent: { action: 'analyze', subject: this.extractSubject(query), scope: 'project' },
        keywords: entities.architecturalTerms || [],
        entities: entities.frameworks.concat(entities.technologies),
        filters: [],
        priority: 7,
        dependencies: [],
        expectedOutputType: 'analysis'
      });
    }

    // Pattern 4: Comparison patterns
    if (this.matchesPattern(lowerQuery, 'comparison_pattern')) {
      components.push({
        id: 'comparison_component',
        type: 'technical',
        intent: { action: 'compare', subject: this.extractSubject(query), scope: 'module' },
        keywords: entities.technologies.concat(entities.frameworks),
        entities: entities.all,
        filters: [],
        priority: 6,
        dependencies: [],
        expectedOutputType: 'analysis'
      });
    }

    // Pattern 5: Diagram generation patterns
    if (this.matchesPattern(lowerQuery, 'diagram_pattern')) {
      components.push({
        id: 'diagram_component',
        type: 'structural',
        intent: { action: 'generate', subject: 'diagram', scope: 'project' },
        keywords: ['class', 'component', 'architecture', 'structure'],
        entities: entities.codeElements,
        filters: [],
        priority: 8,
        dependencies: [],
        expectedOutputType: 'diagram'
      });
    }

    return components;
  }

  private createDefaultComponent(query: string, entities: ExtractedEntities): QueryComponent {
    return {
      id: 'default_search',
      type: 'semantic',
      intent: { 
        action: 'find', 
        subject: this.extractSubject(query) || 'relevant code',
        scope: 'project'
      },
      keywords: this.extractKeywords(query),
      entities: entities.all,
      filters: [],
      priority: 5,
      dependencies: [],
      expectedOutputType: 'list'
    };
  }

  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'how', 'what', 'where', 'when', 'why', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'can', 'may', 'might', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
      'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
    ]);
    
    return query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10); // Limit to top 10 keywords
  }

  private enhanceComponents(components: QueryComponent[], context: QueryContext): QueryComponent[] {
    return components.map(component => {
      // Add framework-specific filters
      if (context.activeFrameworks) {
        for (const framework of context.activeFrameworks) {
          component.filters.push({
            field: 'framework',
            operator: 'equals',
            value: framework,
            weight: 0.8
          });
        }
      }

      // Add file type filters based on query intent
      if (component.intent.action === 'find' && component.keywords.some(k => 
        ['component', 'service', 'controller', 'model'].includes(k.toLowerCase())
      )) {
        component.filters.push({
          field: 'fileType',
          operator: 'in',
          value: ['typescript', 'javascript', 'python', 'java'],
          weight: 0.6
        });
      }

      // Add complexity filters for analysis components
      if (component.type === 'architectural' || component.intent.action === 'analyze') {
        component.filters.push({
          field: 'complexity',
          operator: 'range',
          value: [3, 10], // Focus on moderately complex to complex code
          weight: 0.4
        });
      }

      return component;
    });
  }

  private async createExecutionPlan(
    components: QueryComponent[],
    context: QueryContext
  ): Promise<ExecutionStep[]> {
    const steps: ExecutionStep[] = [];
    const processedDependencies = new Set<string>();

    // Sort components by dependencies and priority using topological sort
    const sortedComponents = this.topologicalSort(components);

    for (let i = 0; i < sortedComponents.length; i++) {
      const component = sortedComponents[i];
      
      // Determine if step can be parallelized
      const canParallelize = component.dependencies.every(dep => 
        processedDependencies.has(dep)
      );

      const step: ExecutionStep = {
        id: `step_${i + 1}`,
        componentIds: [component.id],
        type: this.determineStepType(component),
        method: this.determineMethod(component),
        parameters: this.buildStepParameters(component, context),
        dependencies: component.dependencies,
        estimatedDuration: this.estimateStepDuration(component),
        parallelizable: canParallelize && i > 0 // First step is never parallel
      };

      steps.push(step);
      processedDependencies.add(component.id);
    }

    // Optimize execution plan by grouping parallelizable steps
    return this.optimizeExecutionPlan(steps);
  }

  private topologicalSort(components: QueryComponent[]): QueryComponent[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: QueryComponent[] = [];
    const componentMap = new Map(components.map(c => [c.id, c]));

    const visit = (componentId: string) => {
      if (visited.has(componentId)) return;
      if (visiting.has(componentId)) {
        console.warn(`Circular dependency detected involving ${componentId}, breaking cycle`);
        return;
      }

      visiting.add(componentId);
      const component = componentMap.get(componentId);
      if (component) {
        for (const depId of component.dependencies) {
          if (componentMap.has(depId)) {
            visit(depId);
          }
        }
        visited.add(componentId);
        result.push(component);
      }
      visiting.delete(componentId);
    };

    for (const component of components) {
      if (!visited.has(component.id)) {
        visit(component.id);
      }
    }

    return result;
  }

  private determineStepType(component: QueryComponent): ExecutionStep['type'] {
    switch (component.intent.action) {
      case 'find':
        return 'search';
      case 'analyze':
      case 'compare':
        return 'analysis';
      case 'explain':
      case 'generate':
        return 'synthesis';
      case 'debug':
      case 'optimize':
        return 'validation';
      default:
        return 'search';
    }
  }

  private determineMethod(component: QueryComponent): string {
    const methodMap: Record<string, string> = {
      'semantic': 'vectorSearch',
      'structural': 'astSearch',
      'behavioral': 'codeFlowAnalysis',
      'architectural': 'dependencyAnalysis',
      'business': 'domainSearch',
      'technical': 'patternMatching'
    };

    // Consider both component type and intent action
    let method = methodMap[component.type] || 'hybridSearch';
    
    // Override based on intent for specific actions
    if (component.intent.action === 'generate' && component.expectedOutputType === 'diagram') {
      method = 'diagramGeneration';
    } else if (component.intent.action === 'compare') {
      method = 'comparativeAnalysis';
    } else if (component.intent.action === 'debug') {
      method = 'errorAnalysis';
    }

    return method;
  }

  private buildStepParameters(component: QueryComponent, context: QueryContext): Record<string, any> {
    return {
      keywords: component.keywords,
      entities: component.entities,
      filters: component.filters,
      scope: component.intent.scope,
      outputType: component.expectedOutputType,
      maxResults: this.determineMaxResults(component),
      timeout: this.determineTimeout(component),
      framework: context.activeFrameworks?.[0],
      priority: component.priority,
      searchStrategy: this.determineSearchStrategy(component),
      contextual: true
    };
  }

  private determineSearchStrategy(component: QueryComponent): string {
    if (component.type === 'semantic') {
      return 'embedding_similarity';
    } else if (component.type === 'structural') {
      return 'ast_pattern_matching';
    } else if (component.type === 'behavioral') {
      return 'execution_flow_analysis';
    } else {
      return 'hybrid_semantic_structural';
    }
  }

  private estimateStepDuration(component: QueryComponent): number {
    const baseTime = 1000; // 1 second base
    const complexityMultiplier = {
      'semantic': 2,
      'structural': 3,
      'behavioral': 4,
      'architectural': 5,
      'business': 2,
      'technical': 3
    };

    const actionMultiplier = {
      'find': 1,
      'explain': 2,
      'analyze': 3,
      'compare': 2.5,
      'generate': 4,
      'refactor': 3,
      'debug': 2.5,
      'optimize': 3.5
    };

    const typeMultiplier = complexityMultiplier[component.type] || 2;
    const actionMult = actionMultiplier[component.intent.action] || 2;

    return Math.round(baseTime * typeMultiplier * actionMult);
  }

  private optimizeExecutionPlan(steps: ExecutionStep[]): ExecutionStep[] {
    // Group parallelizable steps
    const optimized: ExecutionStep[] = [];
    let currentParallelGroup: ExecutionStep[] = [];

    for (const step of steps) {
      if (step.parallelizable && currentParallelGroup.length < 3) { // Limit parallel group size
        currentParallelGroup.push(step);
      } else {
        if (currentParallelGroup.length > 0) {
          if (currentParallelGroup.length === 1) {
            optimized.push(currentParallelGroup[0]);
          } else {
            optimized.push(this.mergeParallelSteps(currentParallelGroup));
          }
          currentParallelGroup = [];
        }
        
        if (step.parallelizable) {
          currentParallelGroup.push(step);
        } else {
          optimized.push(step);
        }
      }
    }

    // Handle remaining parallel group
    if (currentParallelGroup.length > 0) {
      if (currentParallelGroup.length === 1) {
        optimized.push(currentParallelGroup[0]);
      } else {
        optimized.push(this.mergeParallelSteps(currentParallelGroup));
      }
    }

    return optimized;
  }

  private mergeParallelSteps(steps: ExecutionStep[]): ExecutionStep {
    if (steps.length === 1) return steps[0];

    return {
      id: `parallel_${steps.map(s => s.id).join('_')}`,
      componentIds: steps.flatMap(s => s.componentIds),
      type: 'search', // Default for parallel execution
      method: 'parallelExecution',
      parameters: {
        subSteps: steps.map(s => ({
          id: s.id,
          method: s.method,
          parameters: s.parameters
        })),
        parallelism: steps.length
      },
      dependencies: [...new Set(steps.flatMap(s => s.dependencies))],
      estimatedDuration: Math.max(...steps.map(s => s.estimatedDuration)),
      parallelizable: true
    };
  }

  private calculateQueryMetadata(
    query: string,
    components: QueryComponent[],
    executionPlan: ExecutionStep[]
  ): DecomposedQuery['metadata'] {
    const totalComplexity = components.reduce((sum, comp) => sum + comp.priority, 0);
    const avgComplexity = components.length > 0 ? totalComplexity / components.length : 0;
    
    const confidence = this.calculateDecompositionConfidence(query, components);
    
    return {
      confidence,
      estimatedComplexity: avgComplexity,
      suggestedApproach: this.suggestApproach(components, executionPlan),
      alternativeInterpretations: this.generateAlternativeInterpretations(query)
    };
  }

  private calculateDecompositionConfidence(query: string, components: QueryComponent[]): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence if we found clear intents
    const hasValidIntents = components.every(comp => 
      comp.intent.action !== 'find' || comp.intent.subject !== 'code'
    );
    if (hasValidIntents) confidence += 0.2;

    // Boost confidence if we extracted meaningful entities
    const hasEntities = components.some(comp => comp.entities.length > 0);
    if (hasEntities) confidence += 0.15;

    // Boost confidence if query matches known patterns
    const matchesPatterns = Array.from(this.queryPatterns.values())
      .some(pattern => pattern.test(query.toLowerCase()));
    if (matchesPatterns) confidence += 0.15;

    // Boost confidence based on component diversity
    const componentTypes = new Set(components.map(c => c.type));
    if (componentTypes.size > 1) confidence += 0.1;

    return Math.min(1.0, confidence);
  }

  private suggestApproach(components: QueryComponent[], executionPlan: ExecutionStep[]): string {
    const totalSteps = executionPlan.length;
    const parallelSteps = executionPlan.filter(step => step.parallelizable).length;
    const componentTypes = new Set(components.map(c => c.type));
    
    if (totalSteps === 1) {
      return 'Simple direct search approach';
    } else if (parallelSteps > totalSteps / 2) {
      return 'Parallel search with result synthesis';
    } else if (componentTypes.has('architectural')) {
      return 'Sequential architectural analysis with dependency resolution';
    } else if (componentTypes.has('behavioral')) {
      return 'Behavioral analysis with code flow tracing';
    } else {
      return 'Multi-phase semantic and structural analysis';
    }
  }

  private generateAlternativeInterpretations(query: string): string[] {
    const alternatives: string[] = [];
    
    // Common query variations
    const variations = [
      { from: 'find', to: ['search for', 'locate', 'identify'] },
      { from: 'how', to: ['in what way', 'by what means'] },
      { from: 'show', to: ['display', 'present', 'demonstrate'] },
      { from: 'explain', to: ['describe', 'clarify', 'detail'] },
      { from: 'analyze', to: ['examine', 'review', 'assess'] }
    ];

    for (const variation of variations) {
      if (query.toLowerCase().includes(variation.from)) {
        for (const replacement of variation.to) {
          alternatives.push(query.replace(new RegExp(`\\b${variation.from}\\b`, 'gi'), replacement));
        }
      }
    }
    
    return alternatives.slice(0, 3); // Limit to 3 alternatives
  }

  // Utility methods
  private initializePatterns(): void {
    this.queryPatterns.set('find_pattern', /\b(find|search|locate|get|show|retrieve|fetch)\b/i);
    this.queryPatterns.set('explain_pattern', /\b(explain|describe|how|why|what|clarify|detail)\b/i);
    this.queryPatterns.set('analysis_pattern', /\b(analyze|examine|review|assess|evaluate|study)\b/i);
    this.queryPatterns.set('comparison_pattern', /\b(compare|contrast|difference|similar|versus|vs)\b/i);
    this.queryPatterns.set('optimization_pattern', /\b(optimize|improve|enhance|refactor|performance)\b/i);
    this.queryPatterns.set('diagram_pattern', /\b(diagram|chart|visual|graph|draw|visualize|structure)\b/i);
    this.queryPatterns.set('debug_pattern', /\b(debug|fix|error|issue|problem|bug|troubleshoot)\b/i);
  }

  private initializeIntentKeywords(): void {
    this.intentKeywords.set('find', ['search', 'locate', 'get', 'retrieve', 'fetch', 'identify']);
    this.intentKeywords.set('explain', ['describe', 'clarify', 'elaborate', 'detail', 'illustrate']);
    this.intentKeywords.set('analyze', ['examine', 'review', 'assess', 'evaluate', 'study', 'investigate']);
    this.intentKeywords.set('compare', ['contrast', 'versus', 'difference', 'similarity', 'vs', 'against']);
    this.intentKeywords.set('generate', ['create', 'build', 'make', 'produce', 'construct', 'develop']);
    this.intentKeywords.set('refactor', ['improve', 'optimize', 'enhance', 'restructure', 'reorganize']);
    this.intentKeywords.set('debug', ['fix', 'resolve', 'troubleshoot', 'diagnose', 'repair']);
    this.intentKeywords.set('optimize', ['improve', 'enhance', 'boost', 'accelerate', 'streamline']);
  }

  private matchesPattern(query: string, patternName: string): boolean {
    const pattern = this.queryPatterns.get(patternName);
    return pattern ? pattern.test(query) : false;
  }

  private extractSubject(query: string): string {
    // Enhanced subject extraction
    const words = query.toLowerCase().split(/\s+/);
    const actionWords = ['find', 'search', 'explain', 'analyze', 'show', 'get', 'locate', 'describe'];
    
    for (let i = 0; i < words.length; i++) {
      if (actionWords.includes(words[i]) && i + 1 < words.length) {
        // Take the next few words as the subject
        const subjectWords = [];
        for (let j = i + 1; j < Math.min(i + 4, words.length); j++) {
          if (!actionWords.includes(words[j])) {
            subjectWords.push(words[j]);
          } else {
            break;
          }
        }
        return subjectWords.join(' ') || 'code';
      }
    }
    
    // Fallback: look for nouns
    const nounPatterns = /\b(class|function|method|component|service|controller|model|interface|api|database|table)\b/gi;
    const matches = query.match(nounPatterns);
    return matches ? matches[0] : 'code';
  }

  private async expandFrameworkTerms(query: string, framework: string): Promise<string> {
    const frameworkTerms: Record<string, Record<string, string>> = {
      'react': {
        'component': 'react component',
        'hook': 'react hook',
        'state': 'react state',
        'props': 'react props',
        'context': 'react context',
        'reducer': 'react reducer'
      },
      'spring-boot': {
        'controller': 'spring controller',
        'service': 'spring service',
        'repository': 'spring repository',
        'bean': 'spring bean',
        'entity': 'jpa entity',
        'config': 'spring configuration'
      },
      'angular': {
        'service': 'angular service',
        'component': 'angular component',
        'directive': 'angular directive',
        'pipe': 'angular pipe',
        'module': 'angular module',
        'guard': 'angular guard'
      },
      'django': {
        'model': 'django model',
        'view': 'django view',
        'form': 'django form',
        'serializer': 'django serializer',
        'middleware': 'django middleware'
      },
      'flask': {
        'route': 'flask route',
        'blueprint': 'flask blueprint',
        'view': 'flask view function',
        'model': 'flask model'
      }
    };

    const terms = frameworkTerms[framework] || {};
    let expanded = query;

    for (const [term, expansion] of Object.entries(terms)) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      expanded = expanded.replace(regex, expansion);
    }

    return expanded;
  }

  private determineMaxResults(component: QueryComponent): number {
    const maxResultsMap: Record<string, number> = {
      'list': 20,
      'explanation': 5,
      'analysis': 10,
      'summary': 3,
      'diagram': 1,
      'code': 15
    };

    const baseResults = maxResultsMap[component.expectedOutputType] || 10;
    
    // Adjust based on component priority
    if (component.priority >= 8) {
      return Math.ceil(baseResults * 1.5);
    } else if (component.priority <= 3) {
      return Math.ceil(baseResults * 0.7);
    }
    
    return baseResults;
  }

  private determineTimeout(component: QueryComponent): number {
    const timeoutMap: Record<string, number> = {
      'semantic': 10000,
      'structural': 15000,
      'behavioral': 20000,
      'architectural': 25000,
      'business': 8000,
      'technical': 12000
    };

    const baseTimeout = timeoutMap[component.type] || 10000;
    
    // Adjust based on expected output type
    if (component.expectedOutputType === 'diagram') {
      return baseTimeout * 2;
    } else if (component.expectedOutputType === 'analysis') {
      return baseTimeout * 1.5;
    }
    
    return baseTimeout;
  }

  // Public utility methods
  getQueryComplexity(query: string): DecomposedQuery['queryType'] {
    return this.classifyQueryComplexity(query);
  }

  async extractEntitiesFromQuery(query: string, context: QueryContext): Promise<ExtractedEntities> {
    return this.entityExtractor.extractEntities(query, context);
  }

  async expandQueryTerms(query: string, context: QueryContext): Promise<QueryExpansion> {
    return this.queryExpander.expandQuery(query, context);
  }
}

// Supporting classes
export class EntityExtractor {
  async extractEntities(query: string, context: QueryContext): Promise<ExtractedEntities> {
    const entities: ExtractedEntities = {
      all: [],
      frameworks: [],
      technologies: [],
      codeElements: [],
      architecturalTerms: [],
      businessTerms: []
    };

    // Extract frameworks with improved patterns
    const frameworkPatterns = /\b(react|angular|vue\.?js|vue|spring\s*boot|spring|django|flask|fastapi|streamlit|node\.?js|express|nest\.?js|next\.?js|nuxt\.?js)\b/gi;
    const frameworkMatches = query.match(frameworkPatterns) || [];
    entities.frameworks = [...new Set(frameworkMatches.map(m => m.toLowerCase().replace(/\s+/g, '-')))];

    // Extract technologies
    const techPatterns = /\b(javascript|typescript|python|java|kotlin|scala|go|rust|php|ruby|html5?|css3?|scss|sass|sql|mongodb|postgresql|postgres|mysql|redis|elasticsearch|docker|kubernetes|aws|azure|gcp|git|jenkins|maven|gradle|npm|yarn|webpack|babel)\b/gi;
    const techMatches = query.match(techPatterns) || [];
    entities.technologies = [...new Set(techMatches.map(m => m.toLowerCase()))];

    // Extract code elements with improved patterns
    const codePatterns = /\b(class|interface|enum|function|method|procedure|component|service|controller|model|entity|repository|dao|dto|pojo|api|endpoint|route|middleware|filter|interceptor|decorator|annotation|variable|constant|property|field)\b/gi;
    const codeMatches = query.match(codePatterns) || [];
    entities.codeElements = [...new Set(codeMatches.map(m => m.toLowerCase()))];

    // Extract architectural terms
    const archPatterns = /\b(microservice|monolith|api\s*gateway|load\s*balancer|database|cache|queue|message\s*broker|event\s*bus|authentication|authorization|security|middleware|proxy|container|orchestration|deployment|scaling|monitoring|logging|metrics)\b/gi;
    const archMatches = query.match(archPatterns) || [];
    entities.architecturalTerms = [...new Set(archMatches.map(m => m.toLowerCase().replace(/\s+/g, ' ')))];

    // Extract business terms
    const businessPatterns = /\b(user|customer|client|account|profile|order|payment|transaction|product|inventory|catalog|dashboard|report|analytics|workflow|process|notification|email|sms|integration|sync|import|export)\b/gi;
    const businessMatches = query.match(businessPatterns) || [];
    entities.businessTerms = [...new Set(businessMatches.map(m => m.toLowerCase()))];

    // Combine all entities
    entities.all = [
      ...entities.frameworks,
      ...entities.technologies,
      ...entities.codeElements,
      ...entities.architecturalTerms,
      ...entities.businessTerms
    ];

    return entities;
  }
}

export class QueryExpander {
  async expandQuery(query: string, context: QueryContext): Promise<QueryExpansion> {
    const expansion: QueryExpansion = {
      synonyms: [],
      relatedTerms: [],
      frameworkSpecificTerms: {},
      domainSpecificTerms: [],
      technicalAcronyms: {}
    };

    // Build comprehensive synonyms
    const synonymMap: Record<string, string[]> = {
      'find': ['search', 'locate', 'get', 'retrieve', 'discover', 'identify'],
      'function': ['method', 'procedure', 'routine', 'operation', 'behavior'],
      'class': ['object', 'type', 'entity', 'model', 'component'],
      'database': ['db', 'datastore', 'persistence', 'storage', 'repository'],
      'user': ['customer', 'client', 'person', 'account', 'profile'],
      'create': ['make', 'build', 'generate', 'add', 'construct', 'develop'],
      'remove': ['delete', 'destroy', 'eliminate', 'drop', 'purge'],
      'update': ['modify', 'change', 'edit', 'alter', 'revise'],
      'analyze': ['examine', 'review', 'assess', 'evaluate', 'inspect'],
      'optimize': ['improve', 'enhance', 'boost', 'accelerate', 'streamline'],
      'error': ['bug', 'issue', 'problem', 'exception', 'failure'],
      'performance': ['speed', 'efficiency', 'throughput', 'latency', 'optimization']
    };

    for (const word of query.toLowerCase().split(/\s+/)) {
      if (synonymMap[word]) {
        expansion.synonyms.push(...synonymMap[word]);
      }
    }

    // Remove duplicates
    expansion.synonyms = [...new Set(expansion.synonyms)];

    // Framework-specific terms
    if (context.activeFrameworks) {
      for (const framework of context.activeFrameworks) {
        expansion.frameworkSpecificTerms[framework] = this.getFrameworkTerms(framework);
      }
    }

    // Technical acronyms
    expansion.technicalAcronyms = {
      'api': 'Application Programming Interface',
      'ui': 'User Interface',
      'ux': 'User Experience',
      'db': 'Database',
      'orm': 'Object Relational Mapping',
      'mvc': 'Model View Controller',
      'mvp': 'Model View Presenter',
      'mvvm': 'Model View ViewModel',
      'crud': 'Create Read Update Delete',
      'rest': 'Representational State Transfer',
      'http': 'HyperText Transfer Protocol',
      'json': 'JavaScript Object Notation',
      'xml': 'eXtensible Markup Language',
      'jwt': 'JSON Web Token',
      'oauth': 'Open Authorization',
      'ssl': 'Secure Sockets Layer',
      'tls': 'Transport Layer Security'
    };

    return expansion;
  }

  private getFrameworkTerms(framework: string): string[] {
    const frameworkTerms: Record<string, string[]> = {
      'react': ['jsx', 'tsx', 'hooks', 'props', 'state', 'context', 'reducer', 'effect', 'memo', 'callback', 'ref'],
      'angular': ['component', 'service', 'directive', 'pipe', 'module', 'injectable', 'guard', 'resolver', 'interceptor'],
      'spring-boot': ['bean', 'autowired', 'controller', 'service', 'repository', 'entity', 'configuration', 'component'],
      'django': ['model', 'view', 'template', 'url', 'admin', 'orm', 'middleware', 'form', 'serializer'],
      'flask': ['route', 'blueprint', 'template', 'session', 'request', 'response', 'endpoint'],
      'vue': ['component', 'directive', 'mixin', 'plugin', 'router', 'vuex', 'computed', 'watch'],
      'fastapi': ['router', 'dependency', 'pydantic', 'schema', 'response', 'middleware', 'authentication'],
      'express': ['middleware', 'router', 'route', 'request', 'response', 'next', 'app'],
      'streamlit': ['widget', 'sidebar', 'container', 'column', 'cache', 'session', 'state']
    };

    return frameworkTerms[framework] || [];
  }
}

export interface ExtractedEntities {
  all: string[];
  frameworks: string[];
  technologies: string[];
  codeElements: string[];
  architecturalTerms: string[];
  businessTerms: string[];
}