import { ChunkHierarchy, ChunkMetadata, CodeSymbol, ASTNode } from './HierarchicalChunker';
import { ASTParser, ParseResult } from './ASTParser';
import { FileClassifier, FileClassification } from './FileClassifier';
import { CodeGraph, GraphNode } from './CodeGraph';
import { FrameworkConfigLoader } from '../config/FrameworkConfigLoader';
import * as path from 'path';

export interface EnrichedChunk extends ChunkHierarchy {
  enrichedMetadata: EnrichedMetadata;
  contextualSummary: string;
  semanticNeighbors: ChunkReference[];
  crossReferences: CrossReference[];
  frameworkContext: FrameworkContext;
  businessContext: BusinessContext;
}

export interface EnrichedMetadata extends ChunkMetadata {
  // Enhanced file context
  fileClassification: FileClassification;
  architecturalRole: ArchitecturalRole;
  domainConcepts: string[];
  qualityMetrics: QualityMetrics;
  
  // Code analysis
  complexityScore: number;
  maintainabilityIndex: number;
  couplingMetrics: CouplingMetrics;
  designPatterns: string[];
  
  // Framework-specific context
  frameworkSpecificMetadata: Record<string, any>;
  conventionCompliance: ConventionCompliance;
  
  // Temporal context
  lastModified?: Date;
  changeFrequency?: number;
  hotspotScore?: number;
}

export interface ChunkReference {
  chunkId: string;
  similarity: number;
  relationship: 'semantic' | 'structural' | 'functional' | 'data-flow' | 'control-flow';
  description: string;
}

export interface CrossReference {
  target: string;
  type: 'import' | 'inheritance' | 'composition' | 'dependency' | 'configuration' | 'test';
  confidence: number;
  location: { line: number; column: number };
  context: string;
}

export interface FrameworkContext {
  primaryFramework: string;
  frameworkVersion?: string;
  frameworkPatterns: string[];
  frameworkConventions: string[];
  frameworkViolations: string[];
  suggestedImprovements: string[];
}

export interface BusinessContext {
  domain: string;
  businessCapability: string;
  userStories: string[];
  acceptanceCriteria: string[];
  businessRules: string[];
}

export interface ArchitecturalRole {
  layer: 'presentation' | 'business' | 'data' | 'infrastructure' | 'cross-cutting';
  responsibility: string;
  concerns: string[];
  boundaries: string[];
}

export interface QualityMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  duplicateCodePercentage: number;
  testCoverage?: number;
}

export interface CouplingMetrics {
  afferentCoupling: number; // Fan-in
  efferentCoupling: number; // Fan-out
  instability: number; // Ce / (Ca + Ce)
  abstractness: number;
  distance: number; // |A + I - 1|
}

export interface ConventionCompliance {
  namingConventions: { score: number; violations: string[] };
  structuralConventions: { score: number; violations: string[] };
  documentationConventions: { score: number; violations: string[] };
  overallScore: number;
}

export class ContextEnricher {
  private astParser: ASTParser;
  private fileClassifier: FileClassifier;
  private codeGraph: CodeGraph;
  private frameworkConfigLoader: FrameworkConfigLoader;
  private enrichmentCache: Map<string, EnrichedChunk> = new Map();

  constructor() {
    this.astParser = new ASTParser();
    this.fileClassifier = new FileClassifier();
    this.codeGraph = new CodeGraph();
    this.frameworkConfigLoader = FrameworkConfigLoader.getInstance();
  }

  async enrichChunk(
    chunk: ChunkHierarchy,
    parseResult: ParseResult,
    fileContent: string,
    filePath: string,
    projectContext?: { allFiles: string[]; codeGraph: CodeGraph }
  ): Promise<EnrichedChunk> {
    const cacheKey = this.generateCacheKey(chunk, filePath);
    
    // Check cache first
    if (this.enrichmentCache.has(cacheKey)) {
      const cached = this.enrichmentCache.get(cacheKey)!;
      // Update with fresh project context if provided
      if (projectContext) {
        cached.semanticNeighbors = await this.findSemanticNeighbors(chunk, projectContext);
        cached.crossReferences = await this.findCrossReferences(chunk, parseResult, projectContext);
      }
      return cached;
    }

    console.log(`🔍 Phase 3: Enriching chunk context for ${chunk.id} in ${filePath}`);

    // Classify the file
    const fileClassification = await this.fileClassifier.classifyFile(filePath);

    // Build enriched metadata
    const enrichedMetadata = await this.buildEnrichedMetadata(
      chunk,
      parseResult,
      fileClassification,
      fileContent,
      filePath
    );

    // Generate contextual summary
    const contextualSummary = await this.generateContextualSummary(
      chunk,
      enrichedMetadata,
      fileContent
    );

    // Find semantic neighbors and cross-references
    const semanticNeighbors = projectContext 
      ? await this.findSemanticNeighbors(chunk, projectContext)
      : [];
    
    const crossReferences = projectContext
      ? await this.findCrossReferences(chunk, parseResult, projectContext)
      : [];

    // Build framework context
    const frameworkContext = await this.buildFrameworkContext(
      chunk,
      fileClassification,
      parseResult,
      fileContent
    );

    // Infer business context
    const businessContext = await this.inferBusinessContext(
      chunk,
      fileClassification,
      filePath,
      fileContent
    );

    const enrichedChunk: EnrichedChunk = {
      ...chunk,
      enrichedMetadata,
      contextualSummary,
      semanticNeighbors,
      crossReferences,
      frameworkContext,
      businessContext
    };

    // Cache the result
    this.enrichmentCache.set(cacheKey, enrichedChunk);

    return enrichedChunk;
  }

  private async buildEnrichedMetadata(
    chunk: ChunkHierarchy,
    parseResult: ParseResult,
    fileClassification: FileClassification,
    fileContent: string,
    filePath: string
  ): Promise<EnrichedMetadata> {
    // Calculate quality metrics
    const qualityMetrics = this.calculateQualityMetrics(chunk, parseResult, fileContent);
    
    // Determine architectural role
    const architecturalRole = this.determineArchitecturalRole(fileClassification, chunk);
    
    // Extract domain concepts
    const domainConcepts = this.extractDomainConcepts(chunk.content, filePath);
    
    // Calculate coupling metrics
    const couplingMetrics = this.calculateCouplingMetrics(parseResult, chunk);
    
    // Detect design patterns
    const designPatterns = this.detectDesignPatterns(chunk, parseResult);
    
    // Build framework-specific metadata
    const frameworkSpecificMetadata = await this.buildFrameworkSpecificMetadata(
      chunk,
      fileClassification,
      parseResult
    );
    
    // Check convention compliance
    const conventionCompliance = this.checkConventionCompliance(
      chunk,
      fileClassification,
      parseResult
    );

    return {
      ...chunk.metadata,
      fileClassification,
      architecturalRole,
      domainConcepts,
      qualityMetrics,
      complexityScore: parseResult.complexity.cyclomatic + parseResult.complexity.cognitive,
      maintainabilityIndex: this.calculateMaintainabilityIndex(qualityMetrics),
      couplingMetrics,
      designPatterns,
      frameworkSpecificMetadata,
      conventionCompliance
    };
  }

  private calculateQualityMetrics(
    chunk: ChunkHierarchy,
    parseResult: ParseResult,
    fileContent: string
  ): QualityMetrics {
    const lines = chunk.content.split('\n');
    const linesOfCode = lines.filter(line => 
      line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('*')
    ).length;

    return {
      linesOfCode,
      cyclomaticComplexity: parseResult.complexity.cyclomatic,
      cognitiveComplexity: parseResult.complexity.cognitive,
      maintainabilityIndex: 0, // Will be calculated
      duplicateCodePercentage: 0 // Could be calculated with more analysis
    };
  }

  private determineArchitecturalRole(
    fileClassification: FileClassification,
    chunk: ChunkHierarchy
  ): ArchitecturalRole {
    let layer: ArchitecturalRole['layer'] = 'business';
    let responsibility = 'General business logic';
    const concerns: string[] = [];
    const boundaries: string[] = [];

    // Determine layer based on classification
    switch (fileClassification.tertiary) {
      case 'controller':
        layer = 'presentation';
        responsibility = 'Handle HTTP requests and responses';
        concerns.push('Input validation', 'Response formatting', 'Error handling');
        boundaries.push('External API', 'User interface');
        break;
      case 'service':
        layer = 'business';
        responsibility = 'Implement business logic and workflows';
        concerns.push('Business rules', 'Transaction management', 'Orchestration');
        boundaries.push('Business domain', 'External services');
        break;
      case 'repository':
      case 'model':
      case 'entity':
        layer = 'data';
        responsibility = 'Data access and persistence';
        concerns.push('Data consistency', 'Query optimization', 'Schema management');
        boundaries.push('Database', 'External data sources');
        break;
      case 'middleware':
        layer = 'cross-cutting';
        responsibility = 'Cross-cutting concerns';
        concerns.push('Security', 'Logging', 'Monitoring');
        boundaries.push('All layers');
        break;
      case 'component':
      case 'view':
        layer = 'presentation';
        responsibility = 'User interface and interaction';
        concerns.push('User experience', 'Accessibility', 'Responsive design');
        boundaries.push('User interface', 'Browser compatibility');
        break;
    }

    return { layer, responsibility, concerns, boundaries };
  }

  private extractDomainConcepts(content: string, filePath: string): string[] {
    const concepts: string[] = [];
    
    // Extract from file path
    const pathSegments = filePath.split(path.sep);
    pathSegments.forEach(segment => {
      if (segment && !['src', 'main', 'java', 'com', 'org', 'components', 'services'].includes(segment.toLowerCase())) {
        concepts.push(this.humanizeString(segment));
      }
    });

    // Extract from class names, method names, etc.
    const camelCaseRegex = /[A-Z][a-z]+/g;
    const matches = content.match(camelCaseRegex) || [];
    matches.forEach(match => {
      if (match.length > 2 && !['String', 'Object', 'Array', 'Number'].includes(match)) {
        concepts.push(match);
      }
    });

    // Extract from comments
    const commentRegex = /\/\*\*?(.*?)\*\//gs;
    const comments = content.match(commentRegex) || [];
    comments.forEach(comment => {
      const words = comment.replace(/[^\w\s]/g, ' ').split(/\s+/);
      words.forEach(word => {
        if (word.length > 4 && !['this', 'that', 'with', 'from', 'they', 'have', 'will'].includes(word.toLowerCase())) {
          concepts.push(word);
        }
      });
    });

    return [...new Set(concepts)];
  }

  private calculateCouplingMetrics(parseResult: ParseResult, chunk: ChunkHierarchy): CouplingMetrics {
    const efferentCoupling = parseResult.imports.length;
    const afferentCoupling = 0; // Would need project-wide analysis
    const instability = efferentCoupling / Math.max(1, efferentCoupling + afferentCoupling);
    const abstractness = this.calculateAbstractness(parseResult);
    const distance = Math.abs(abstractness + instability - 1);

    return {
      afferentCoupling,
      efferentCoupling,
      instability,
      abstractness,
      distance
    };
  }

  private calculateAbstractness(parseResult: ParseResult): number {
    const totalClasses = parseResult.classes.length;
    if (totalClasses === 0) return 0;
    
    const abstractClasses = parseResult.classes.filter(cls => 
      cls.isAbstract || cls.isInterface
    ).length;
    
    return abstractClasses / totalClasses;
  }

  private detectDesignPatterns(chunk: ChunkHierarchy, parseResult: ParseResult): string[] {
    const patterns: string[] = [];

    // Singleton pattern
    if (this.detectSingletonPattern(chunk.content)) {
      patterns.push('Singleton');
    }

    // Factory pattern
    if (this.detectFactoryPattern(chunk.content)) {
      patterns.push('Factory');
    }

    // Observer pattern
    if (this.detectObserverPattern(chunk.content)) {
      patterns.push('Observer');
    }

    // Strategy pattern
    if (this.detectStrategyPattern(chunk.content)) {
      patterns.push('Strategy');
    }

    // Repository pattern
    if (this.detectRepositoryPattern(chunk.content)) {
      patterns.push('Repository');
    }

    // MVC pattern
    if (this.detectMVCPattern(chunk.content)) {
      patterns.push('MVC');
    }

    return patterns;
  }

  private detectSingletonPattern(content: string): boolean {
    return /private\s+static\s+.*instance.*|getInstance\s*\(/.test(content);
  }

  private detectFactoryPattern(content: string): boolean {
    return /create[A-Z][a-zA-Z]*\s*\(|Factory\s*{|\.factory\s*\(/.test(content);
  }

  private detectObserverPattern(content: string): boolean {
    return /addObserver|removeObserver|notifyObservers|addEventListener|subscribe|unsubscribe/.test(content);
  }

  private detectStrategyPattern(content: string): boolean {
    return /Strategy\s*{|algorithm\s*\(|executeStrategy/.test(content);
  }

  private detectRepositoryPattern(content: string): boolean {
    return /Repository\s*{|findBy|save|delete|find.*All/.test(content);
  }

  private detectMVCPattern(content: string): boolean {
    return /@Controller|@RestController|Model|View|Controller/.test(content);
  }

  private async buildFrameworkSpecificMetadata(
    chunk: ChunkHierarchy,
    fileClassification: FileClassification,
    parseResult: ParseResult
  ): Promise<Record<string, any>> {
    const metadata: Record<string, any> = {};
    const framework = fileClassification.primary;

    switch (framework) {
      case 'spring-boot':
        metadata.springBootMetadata = this.buildSpringBootMetadata(chunk, parseResult);
        break;
      case 'react':
        metadata.reactMetadata = this.buildReactMetadata(chunk, parseResult);
        break;
      case 'angular':
        metadata.angularMetadata = this.buildAngularMetadata(chunk, parseResult);
        break;
      case 'flask':
      case 'fastapi':
        metadata.pythonWebMetadata = this.buildPythonWebMetadata(chunk, parseResult);
        break;
      case 'streamlit':
        metadata.streamlitMetadata = this.buildStreamlitMetadata(chunk, parseResult);
        break;
    }

    return metadata;
  }

  private buildSpringBootMetadata(chunk: ChunkHierarchy, parseResult: ParseResult): any {
    return {
      annotations: this.extractAnnotations(chunk.content, '@'),
      endpoints: this.extractEndpoints(chunk.content),
      dependencies: this.extractSpringDependencies(chunk.content),
      transactionBoundaries: this.findTransactionBoundaries(chunk.content)
    };
  }

  private buildReactMetadata(chunk: ChunkHierarchy, parseResult: ParseResult): any {
    return {
      hooks: this.extractReactHooks(chunk.content),
      props: this.extractReactProps(chunk.content),
      state: this.extractReactState(chunk.content),
      lifecycle: this.extractLifecycleMethods(chunk.content)
    };
  }

  private buildAngularMetadata(chunk: ChunkHierarchy, parseResult: ParseResult): any {
    return {
      decorators: this.extractAnnotations(chunk.content, '@'),
      services: this.extractAngularServices(chunk.content),
      components: this.extractAngularComponents(chunk.content),
      directives: this.extractAngularDirectives(chunk.content)
    };
  }

  private buildPythonWebMetadata(chunk: ChunkHierarchy, parseResult: ParseResult): any {
    return {
      routes: this.extractPythonRoutes(chunk.content),
      models: this.extractPythonModels(chunk.content),
      serializers: this.extractPythonSerializers(chunk.content),
      middleware: this.extractPythonMiddleware(chunk.content)
    };
  }

  private buildStreamlitMetadata(chunk: ChunkHierarchy, parseResult: ParseResult): any {
    return {
      widgets: this.extractStreamlitWidgets(chunk.content),
      layouts: this.extractStreamlitLayouts(chunk.content),
      caching: this.extractStreamlitCaching(chunk.content),
      sessions: this.extractStreamlitSessions(chunk.content)
    };
  }

  private checkConventionCompliance(
    chunk: ChunkHierarchy,
    fileClassification: FileClassification,
    parseResult: ParseResult
  ): ConventionCompliance {
    const namingConventions = this.checkNamingConventions(chunk, fileClassification);
    const structuralConventions = this.checkStructuralConventions(chunk, fileClassification);
    const documentationConventions = this.checkDocumentationConventions(chunk);

    const overallScore = (
      namingConventions.score + 
      structuralConventions.score + 
      documentationConventions.score
    ) / 3;

    return {
      namingConventions,
      structuralConventions,
      documentationConventions,
      overallScore
    };
  }

  private checkNamingConventions(
    chunk: ChunkHierarchy,
    fileClassification: FileClassification
  ): { score: number; violations: string[] } {
    const violations: string[] = [];
    let score = 1.0;

    // Check based on framework and file type
    switch (fileClassification.primary) {
      case 'spring-boot':
        if (fileClassification.tertiary === 'controller' && !chunk.content.includes('Controller')) {
          violations.push('Controller class should end with "Controller"');
          score -= 0.2;
        }
        break;
      case 'react':
        if (fileClassification.tertiary === 'component' && !/^[A-Z]/.test(chunk.id)) {
          violations.push('React component should start with uppercase letter');
          score -= 0.2;
        }
        break;
    }

    return { score: Math.max(0, score), violations };
  }

  private checkStructuralConventions(
    chunk: ChunkHierarchy,
    fileClassification: FileClassification
  ): { score: number; violations: string[] } {
    const violations: string[] = [];
    let score = 1.0;

    // Check for proper separation of concerns
    if (chunk.content.includes('TODO') || chunk.content.includes('FIXME')) {
      violations.push('Contains TODO or FIXME comments');
      score -= 0.1;
    }

    // Check for proper error handling
    if (chunk.content.includes('catch') && !chunk.content.includes('log')) {
      violations.push('Exception handling without logging');
      score -= 0.2;
    }

    return { score: Math.max(0, score), violations };
  }

  private checkDocumentationConventions(chunk: ChunkHierarchy): { score: number; violations: string[] } {
    const violations: string[] = [];
    let score = 1.0;

    // Check for JSDoc or similar documentation
    if (!chunk.content.includes('/**') && chunk.type === 'function') {
      violations.push('Function lacks JSDoc documentation');
      score -= 0.3;
    }

    // Check for meaningful variable names
    const shortVarNames = chunk.content.match(/\b[a-z]{1,2}\b/g) || [];
    if (shortVarNames.length > 3) {
      violations.push('Uses too many short variable names');
      score -= 0.2;
    }

    return { score: Math.max(0, score), violations };
  }

  private calculateMaintainabilityIndex(qualityMetrics: QualityMetrics): number {
    // Simplified maintainability index calculation
    const complexityScore = Math.max(1, qualityMetrics.cyclomaticComplexity);
    const sizeScore = Math.log(Math.max(1, qualityMetrics.linesOfCode));
    
    return Math.max(0, 171 - 5.2 * Math.log(complexityScore) - 0.23 * sizeScore);
  }

  private async generateContextualSummary(
    chunk: ChunkHierarchy,
    metadata: EnrichedMetadata,
    fileContent: string
  ): Promise<string> {
    const framework = metadata.fileClassification.primary;
    const role = metadata.fileClassification.tertiary;
    const layer = metadata.architecturalRole.layer;
    
    let summary = `This ${chunk.type} in the ${layer} layer serves as a ${role} component in the ${framework} framework. `;
    
    if (metadata.domainConcepts.length > 0) {
      summary += `It handles concepts related to ${metadata.domainConcepts.slice(0, 3).join(', ')}. `;
    }
    
    if (metadata.designPatterns.length > 0) {
      summary += `It implements the ${metadata.designPatterns.join(', ')} pattern(s). `;
    }
    
    if (metadata.qualityMetrics.cyclomaticComplexity > 10) {
      summary += `This component has high complexity and may benefit from refactoring. `;
    }
    
    if (metadata.conventionCompliance.overallScore < 0.7) {
      summary += `The code has some convention compliance issues. `;
    }
    
    return summary.trim();
  }

  private async findSemanticNeighbors(
    chunk: ChunkHierarchy,
    projectContext: { allFiles: string[]; codeGraph: CodeGraph }
  ): Promise<ChunkReference[]> {
    const neighbors: ChunkReference[] = [];
    
    // This would use vector similarity in a real implementation
    // For now, we'll use simpler heuristics
    
    return neighbors;
  }

  private async findCrossReferences(
    chunk: ChunkHierarchy,
    parseResult: ParseResult,
    projectContext: { allFiles: string[]; codeGraph: CodeGraph }
  ): Promise<CrossReference[]> {
    const references: CrossReference[] = [];
    
    // Extract import references
    parseResult.imports.forEach(imp => {
      references.push({
        target: imp.module,
        type: 'import',
        confidence: 0.9,
        location: { line: 1, column: 1 }, // Would need actual location
        context: `Imports ${imp.importedNames.join(', ')} from ${imp.module}`
      });
    });
    
    return references;
  }

  private async buildFrameworkContext(
    chunk: ChunkHierarchy,
    fileClassification: FileClassification,
    parseResult: ParseResult,
    fileContent: string
  ): Promise<FrameworkContext> {
    const framework = fileClassification.primary;
    const config = await this.frameworkConfigLoader.getFrameworkConfig(framework);
    
    return {
      primaryFramework: framework,
      frameworkPatterns: this.findFrameworkPatterns(fileContent, config),
      frameworkConventions: this.checkFrameworkConventions(fileContent, config),
      frameworkViolations: this.findFrameworkViolations(fileContent, config),
      suggestedImprovements: this.suggestFrameworkImprovements(fileContent, config)
    };
  }

  private async inferBusinessContext(
    chunk: ChunkHierarchy,
    fileClassification: FileClassification,
    filePath: string,
    fileContent: string
  ): Promise<BusinessContext> {
    const domain = this.inferDomain(filePath);
    const capability = this.inferBusinessCapability(fileClassification, fileContent);
    
    return {
      domain,
      businessCapability: capability,
      userStories: [], // Would be extracted from comments or linked documentation
      acceptanceCriteria: [],
      businessRules: this.extractBusinessRules(fileContent)
    };
  }

  // Utility methods
  private generateCacheKey(chunk: ChunkHierarchy, filePath: string): string {
    return `${filePath}:${chunk.id}:${chunk.startLine}-${chunk.endLine}`;
  }

  private humanizeString(str: string): string {
    return str
      .replace(/[_-]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private extractAnnotations(content: string, prefix: string): string[] {
    const regex = new RegExp(`${prefix}\\w+`, 'g');
    return content.match(regex) || [];
  }

  private extractEndpoints(content: string): string[] {
    const patterns = [
      /@RequestMapping\s*\(\s*"([^"]+)"/g,
      /@GetMapping\s*\(\s*"([^"]+)"/g,
      /@PostMapping\s*\(\s*"([^"]+)"/g,
      /@PutMapping\s*\(\s*"([^"]+)"/g,
      /@DeleteMapping\s*\(\s*"([^"]+)"/g
    ];
    
    const endpoints: string[] = [];
    patterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        endpoints.push(match[1]);
      }
    });
    
    return endpoints;
  }

  private extractSpringDependencies(content: string): string[] {
    const autowiredPattern = /@Autowired[\s\S]*?private\s+(\w+)/g;
    const dependencies: string[] = [];
    
    const matches = content.matchAll(autowiredPattern);
    for (const match of matches) {
      dependencies.push(match[1]);
    }
    
    return dependencies;
  }

  private findTransactionBoundaries(content: string): string[] {
    return this.extractAnnotations(content, '@Transactional');
  }

  private extractReactHooks(content: string): string[] {
    const hookPattern = /use[A-Z]\w+/g;
    return content.match(hookPattern) || [];
  }

  private extractReactProps(content: string): string[] {
    const propsPattern = /props\.(\w+)/g;
    const props: string[] = [];
    
    const matches = content.matchAll(propsPattern);
    for (const match of matches) {
      props.push(match[1]);
    }
    
    return [...new Set(props)];
  }

  private extractReactState(content: string): string[] {
    const statePattern = /useState\s*\(\s*([^)]+)\)/g;
    const states: string[] = [];
    
    const matches = content.matchAll(statePattern);
    for (const match of matches) {
      states.push(match[1]);
    }
    
    return states;
  }

  private extractLifecycleMethods(content: string): string[] {
    const lifecycleMethods = [
      'componentDidMount', 'componentDidUpdate', 'componentWillUnmount',
      'useEffect', 'useLayoutEffect'
    ];
    
    return lifecycleMethods.filter(method => content.includes(method));
  }

  private extractAngularServices(content: string): string[] {
    const servicePattern = /@Injectable\s*\(\s*\)\s*export\s+class\s+(\w+)/g;
    const services: string[] = [];
    
    const matches = content.matchAll(servicePattern);
    for (const match of matches) {
      services.push(match[1]);
    }
    
    return services;
  }

  private extractAngularComponents(content: string): string[] {
    const componentPattern = /@Component\s*\(\s*{[\s\S]*?}\s*\)\s*export\s+class\s+(\w+)/g;
    const components: string[] = [];
    
    const matches = content.matchAll(componentPattern);
    for (const match of matches) {
      components.push(match[1]);
    }
    
    return components;
  }

  private extractAngularDirectives(content: string): string[] {
    const directivePattern = /@Directive\s*\(\s*{[\s\S]*?}\s*\)\s*export\s+class\s+(\w+)/g;
    const directives: string[] = [];
    
    const matches = content.matchAll(directivePattern);
    for (const match of matches) {
      directives.push(match[1]);
    }
    
    return directives;
  }

  private extractPythonRoutes(content: string): string[] {
    const routePatterns = [
      /@app\.route\s*\(\s*"([^"]+)"/g,
      /@app\.(get|post|put|delete)\s*\(\s*"([^"]+)"/g
    ];
    
    const routes: string[] = [];
    routePatterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        routes.push(match[1] || match[2]);
      }
    });
    
    return routes;
  }

  private extractPythonModels(content: string): string[] {
    const modelPattern = /class\s+(\w+)\s*\(\s*(?:db\.Model|BaseModel)/g;
    const models: string[] = [];
    
    const matches = content.matchAll(modelPattern);
    for (const match of matches) {
      models.push(match[1]);
    }
    
    return models;
  }

  private extractPythonSerializers(content: string): string[] {
    const serializerPattern = /class\s+(\w+)\s*\(\s*.*Serializer/g;
    const serializers: string[] = [];
    
    const matches = content.matchAll(serializerPattern);
    for (const match of matches) {
      serializers.push(match[1]);
    }
    
    return serializers;
  }

  private extractPythonMiddleware(content: string): string[] {
    const middlewarePattern = /class\s+(\w+)\s*\(\s*.*Middleware/g;
    const middleware: string[] = [];
    
    const matches = content.matchAll(middlewarePattern);
    for (const match of matches) {
      middleware.push(match[1]);
    }
    
    return middleware;
  }

  private extractStreamlitWidgets(content: string): string[] {
    const widgetPattern = /st\.(button|selectbox|slider|text_input|number_input|checkbox|radio|multiselect)/g;
    return content.match(widgetPattern) || [];
  }

  private extractStreamlitLayouts(content: string): string[] {
    const layoutPattern = /st\.(sidebar|columns|container|expander|tabs)/g;
    return content.match(layoutPattern) || [];
  }

  private extractStreamlitCaching(content: string): string[] {
    const cachePattern = /@st\.(cache|cache_data|cache_resource)/g;
    return content.match(cachePattern) || [];
  }

  private extractStreamlitSessions(content: string): string[] {
    const sessionPattern = /st\.session_state\.(\w+)/g;
    const sessions: string[] = [];
    
    const matches = content.matchAll(sessionPattern);
    for (const match of matches) {
      sessions.push(match[1]);
    }
    
    return [...new Set(sessions)];
  }

  private findFrameworkPatterns(content: string, config: any): string[] {
    // This would use the framework configuration to identify patterns
    return [];
  }

  private checkFrameworkConventions(content: string, config: any): string[] {
    // This would check against framework conventions
    return [];
  }

  private findFrameworkViolations(content: string, config: any): string[] {
    // This would identify violations of framework best practices
    return [];
  }

  private suggestFrameworkImprovements(content: string, config: any): string[] {
    // This would suggest improvements based on framework best practices
    return [];
  }

  private inferDomain(filePath: string): string {
    const pathSegments = filePath.split(path.sep);
    
    // Look for domain indicators in path
    const domainKeywords = ['user', 'product', 'order', 'payment', 'inventory', 'auth', 'admin'];
    
    for (const segment of pathSegments) {
      const lowerSegment = segment.toLowerCase();
      for (const keyword of domainKeywords) {
        if (lowerSegment.includes(keyword)) {
          return this.humanizeString(keyword);
        }
      }
    }
    
    return 'General';
  }

  private inferBusinessCapability(fileClassification: FileClassification, content: string): string {
    const tertiary = fileClassification.tertiary;
    
    switch (tertiary) {
      case 'controller':
        return 'Request Processing';
      case 'service':
        return 'Business Logic';
      case 'repository':
        return 'Data Management';
      case 'model':
      case 'entity':
        return 'Data Modeling';
      case 'component':
        return 'User Interface';
      case 'middleware':
        return 'Cross-cutting Concerns';
      default:
        return 'General Functionality';
    }
  }

  private extractBusinessRules(content: string): string[] {
    const rules: string[] = [];
    
    // Extract validation rules
    const validationPattern = /validate|require|must|should|cannot|forbidden/gi;
    const validationMatches = content.match(validationPattern) || [];
    
    // Extract from comments
    const commentPattern = /\/\*\*?(.*?)\*\//gs;
    const comments = content.match(commentPattern) || [];
    
    comments.forEach(comment => {
      if (comment.toLowerCase().includes('business rule') || 
          comment.toLowerCase().includes('constraint') ||
          comment.toLowerCase().includes('requirement')) {
        rules.push(comment.replace(/[/*]/g, '').trim());
      }
    });
    
    return rules;
  }

  clearCache(): void {
    this.enrichmentCache.clear();
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.enrichmentCache.size,
      keys: Array.from(this.enrichmentCache.keys())
    };
  }
}