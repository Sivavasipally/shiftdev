import { ContentChunk, ProcessedContent } from './ContentProcessor';
import { FileClassification, PrimaryClassification } from './FileClassifier';
import { QueryIntent, QueryResponse, RelevantChunk } from './QueryProcessor';
import { WorkspaceEnvironment } from './RAGFoundation';
import { GeneratedOutput, OutputRequest, OutputType } from './OutputGenerator';

export interface FrameworkAdapter {
  frameworkName: string;
  version: string;
  capabilities: FrameworkCapabilities;
  
  // Core adaptation methods
  adaptContentProcessing(content: ProcessedContent): Promise<ProcessedContent>;
  adaptQueryProcessing(query: string, intent: QueryIntent, chunks: ContentChunk[]): Promise<QueryResponse>;
  adaptOutputGeneration(request: OutputRequest, chunks: ContentChunk[]): Promise<GeneratedOutput>;
  
  // Framework-specific methods
  getFrameworkPatterns(): FrameworkPattern[];
  getArchitecturalLayers(): ArchitecturalLayer[];
  getBestPractices(): BestPractice[];
  getSecurityGuidelines(): SecurityGuideline[];
  getPerformanceOptimizations(): PerformanceOptimization[];
}

export interface FrameworkCapabilities {
  supportsLayeredArchitecture: boolean;
  supportsAnnotations: boolean;
  supportsDependencyInjection: boolean;
  supportsAOP: boolean;
  supportsORM: boolean;
  supportsRESTAPI: boolean;
  supportsGraphQL: boolean;
  supportsWebSockets: boolean;
  supportsReactiveProgramming: boolean;
  supportsTesting: boolean;
  supportsSecurity: boolean;
  supportsMetrics: boolean;
}

export interface FrameworkPattern {
  name: string;
  description: string;
  usage: string;
  example: string;
  benefits: string[];
  caveats: string[];
}

export interface ArchitecturalLayer {
  name: string;
  purpose: string;
  components: string[];
  responsibilities: string[];
  dependencies: string[];
}

export interface BestPractice {
  category: string;
  title: string;
  description: string;
  implementation: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
}

export interface SecurityGuideline {
  area: string;
  guideline: string;
  implementation: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  mitigation: string;
}

export interface PerformanceOptimization {
  area: string;
  optimization: string;
  implementation: string;
  expectedGain: string;
  complexity: 'low' | 'medium' | 'high';
}

export interface FrameworkAdaptationResult {
  originalContent: ProcessedContent;
  adaptedContent: ProcessedContent;
  adaptations: FrameworkAdaptation[];
  recommendations: FrameworkRecommendation[];
  metadata: AdaptationMetadata;
}

export interface FrameworkAdaptation {
  type: AdaptationType;
  component: string;
  description: string;
  before: string;
  after: string;
  rationale: string;
}

export enum AdaptationType {
  PatternEnhancement = 'pattern-enhancement',
  StructureOptimization = 'structure-optimization',
  SecurityHardening = 'security-hardening',
  PerformanceImprovement = 'performance-improvement',
  BestPracticeAlignment = 'best-practice-alignment',
  DocumentationEnhancement = 'documentation-enhancement'
}

export interface FrameworkRecommendation {
  category: string;
  title: string;
  description: string;
  action: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  effort: 'minimal' | 'low' | 'medium' | 'high';
  impact: string;
}

export interface AdaptationMetadata {
  framework: string;
  version: string;
  adaptationTime: number;
  adaptationsApplied: number;
  compatibilityScore: number;
  qualityImprovement: number;
}

export class FrameworkAdapterManager {
  private adapters: Map<string, FrameworkAdapter> = new Map();
  private registry: FrameworkRegistry = new FrameworkRegistry();

  constructor() {
    this.initializeAdapters();
  }

  async adaptForFramework(
    framework: string,
    content: ProcessedContent,
    workspaceEnvironment: WorkspaceEnvironment
  ): Promise<FrameworkAdaptationResult> {
    console.log(`🔧 Phase 7: Adapting content for ${framework}...`);
    
    const adapter = this.adapters.get(framework.toLowerCase());
    if (!adapter) {
      throw new Error(`No adapter available for framework: ${framework}`);
    }

    const startTime = Date.now();
    
    // Apply framework-specific adaptations
    const adaptedContent = await adapter.adaptContentProcessing(content);
    
    // Generate framework-specific recommendations
    const recommendations = await this.generateFrameworkRecommendations(adapter, content);
    
    // Track adaptations applied
    const adaptations = this.compareContents(content, adaptedContent);
    
    const metadata: AdaptationMetadata = {
      framework: adapter.frameworkName,
      version: adapter.version,
      adaptationTime: Date.now() - startTime,
      adaptationsApplied: adaptations.length,
      compatibilityScore: this.calculateCompatibilityScore(adapter, content),
      qualityImprovement: this.calculateQualityImprovement(content, adaptedContent)
    };

    return {
      originalContent: content,
      adaptedContent,
      adaptations,
      recommendations,
      metadata
    };
  }

  getAvailableAdapters(): string[] {
    return Array.from(this.adapters.keys());
  }

  getAdapterCapabilities(framework: string): FrameworkCapabilities | null {
    const adapter = this.adapters.get(framework.toLowerCase());
    return adapter ? adapter.capabilities : null;
  }

  private initializeAdapters(): void {
    this.adapters.set('spring-boot', new SpringBootAdapter());
    this.adapters.set('react', new ReactAdapter());
    this.adapters.set('angular', new AngularAdapter());
    this.adapters.set('flask', new FlaskAdapter());
    this.adapters.set('fastapi', new FastAPIAdapter());
    this.adapters.set('vue', new VueAdapter());
    this.adapters.set('express', new ExpressAdapter());
    this.adapters.set('django', new DjangoAdapter());
    // StreamlitAdapter is imported from separate file
    const { StreamlitAdapter } = require('../adapters/StreamlitAdapter');
    this.adapters.set('streamlit', new StreamlitAdapter());
  }

  private async generateFrameworkRecommendations(
    adapter: FrameworkAdapter,
    content: ProcessedContent
  ): Promise<FrameworkRecommendation[]> {
    const recommendations: FrameworkRecommendation[] = [];
    
    // Get framework-specific best practices
    const bestPractices = adapter.getBestPractices();
    const securityGuidelines = adapter.getSecurityGuidelines();
    const performanceOptimizations = adapter.getPerformanceOptimizations();
    
    // Analyze content against best practices
    bestPractices.forEach(practice => {
      const violations = this.checkBestPracticeViolations(content, practice);
      if (violations > 0) {
        recommendations.push({
          category: practice.category,
          title: practice.title,
          description: practice.description,
          action: practice.implementation,
          priority: practice.priority,
          effort: this.estimateEffort(practice),
          impact: practice.impact
        });
      }
    });
    
    return recommendations.sort((a, b) => this.comparePriority(a.priority, b.priority));
  }

  private compareContents(original: ProcessedContent, adapted: ProcessedContent): FrameworkAdaptation[] {
    const adaptations: FrameworkAdaptation[] = [];
    
    // Compare chunks for differences
    original.chunks.forEach((originalChunk, index) => {
      const adaptedChunk = adapted.chunks[index];
      if (adaptedChunk && originalChunk.content !== adaptedChunk.content) {
        adaptations.push({
          type: AdaptationType.PatternEnhancement,
          component: originalChunk.metadata.name || 'Unknown',
          description: 'Content enhanced for framework compatibility',
          before: originalChunk.content.substring(0, 100) + '...',
          after: adaptedChunk.content.substring(0, 100) + '...',
          rationale: 'Applied framework-specific patterns and best practices'
        });
      }
    });
    
    return adaptations;
  }

  private calculateCompatibilityScore(adapter: FrameworkAdapter, content: ProcessedContent): number {
    let score = 0;
    const patterns = adapter.getFrameworkPatterns();
    const totalPatterns = patterns.length;
    
    patterns.forEach(pattern => {
      const usage = content.chunks.filter(chunk => 
        chunk.content.includes(pattern.name) || 
        chunk.patterns.some(p => p.includes(pattern.name))
      ).length;
      
      if (usage > 0) score++;
    });
    
    return totalPatterns > 0 ? (score / totalPatterns) * 100 : 0;
  }

  private calculateQualityImprovement(original: ProcessedContent, adapted: ProcessedContent): number {
    // Simple heuristic based on metadata improvements
    const originalAvgComplexity = original.chunks.reduce((sum, chunk) => sum + chunk.metadata.complexity, 0) / original.chunks.length;
    const adaptedAvgComplexity = adapted.chunks.reduce((sum, chunk) => sum + chunk.metadata.complexity, 0) / adapted.chunks.length;
    
    const originalAvgImportance = original.chunks.reduce((sum, chunk) => sum + chunk.metadata.importance, 0) / original.chunks.length;
    const adaptedAvgImportance = adapted.chunks.reduce((sum, chunk) => sum + chunk.metadata.importance, 0) / adapted.chunks.length;
    
    const complexityImprovement = Math.max(0, originalAvgComplexity - adaptedAvgComplexity) * 10;
    const importanceImprovement = Math.max(0, adaptedAvgImportance - originalAvgImportance) * 100;
    
    return complexityImprovement + importanceImprovement;
  }

  private checkBestPracticeViolations(content: ProcessedContent, practice: BestPractice): number {
    let violations = 0;
    
    content.chunks.forEach(chunk => {
      // Simple rule-based checking
      if (practice.title.includes('Constructor Injection') && 
          chunk.content.includes('@Autowired') && 
          !chunk.content.includes('final')) {
        violations++;
      }
      
      if (practice.title.includes('Error Handling') && 
          chunk.content.includes('throw') && 
          !chunk.content.includes('try')) {
        violations++;
      }
    });
    
    return violations;
  }

  private estimateEffort(practice: BestPractice): 'minimal' | 'low' | 'medium' | 'high' {
    switch (practice.priority) {
      case 'critical': return 'high';
      case 'high': return 'medium';
      case 'medium': return 'low';
      case 'low': return 'minimal';
      default: return 'medium';
    }
  }

  private comparePriority(a: string, b: string): number {
    const priorities = ['critical', 'high', 'medium', 'low'];
    return priorities.indexOf(a) - priorities.indexOf(b);
  }
}

// Framework Registry for managing framework information
class FrameworkRegistry {
  private frameworks: Map<string, FrameworkInfo> = new Map();

  constructor() {
    this.initializeFrameworks();
  }

  getFramework(name: string): FrameworkInfo | null {
    return this.frameworks.get(name.toLowerCase()) || null;
  }

  getAllFrameworks(): FrameworkInfo[] {
    return Array.from(this.frameworks.values());
  }

  private initializeFrameworks(): void {
    this.frameworks.set('spring-boot', {
      name: 'Spring Boot',
      version: '3.0+',
      language: 'Java',
      type: 'backend',
      ecosystem: 'Spring',
      documentation: 'https://spring.io/projects/spring-boot',
      community: 'enterprise',
      maturity: 'stable'
    });

    this.frameworks.set('react', {
      name: 'React',
      version: '18.0+',
      language: 'JavaScript/TypeScript',
      type: 'frontend',
      ecosystem: 'React',
      documentation: 'https://react.dev',
      community: 'large',
      maturity: 'stable'
    });

    // Add other frameworks...
  }
}

interface FrameworkInfo {
  name: string;
  version: string;
  language: string;
  type: 'backend' | 'frontend' | 'fullstack' | 'mobile';
  ecosystem: string;
  documentation: string;
  community: 'small' | 'medium' | 'large' | 'enterprise';
  maturity: 'experimental' | 'beta' | 'stable' | 'mature';
}

// Abstract base adapter
abstract class BaseFrameworkAdapter implements FrameworkAdapter {
  abstract frameworkName: string;
  abstract version: string;
  abstract capabilities: FrameworkCapabilities;

  async adaptContentProcessing(content: ProcessedContent): Promise<ProcessedContent> {
    const adaptedContent = { ...content };
    adaptedContent.chunks = await Promise.all(
      content.chunks.map(chunk => this.adaptChunk(chunk))
    );
    return adaptedContent;
  }

  async adaptQueryProcessing(query: string, intent: QueryIntent, chunks: ContentChunk[]): Promise<QueryResponse> {
    // Framework-specific query adaptation
    const adaptedChunks = chunks.filter(chunk => this.isRelevantChunk(chunk, intent));
    
    return {
      answer: await this.generateFrameworkSpecificAnswer(query, intent, adaptedChunks),
      relevantChunks: adaptedChunks.map(chunk => ({
        chunk,
        relevanceScore: this.calculateFrameworkRelevance(chunk, intent),
        explanation: this.generateFrameworkExplanation(chunk, intent),
        contextType: 'framework' as any
      })),
      suggestions: this.getFrameworkSpecificSuggestions(intent),
      confidence: 0.8,
      metadata: {
        processingTime: 0,
        chunksAnalyzed: chunks.length,
        intentConfidence: intent.confidence,
        sources: chunks.map(c => c.id),
        frameworks: [this.frameworkName],
        followUpQuestions: this.generateFrameworkFollowUps(intent)
      }
    };
  }

  async adaptOutputGeneration(request: OutputRequest, chunks: ContentChunk[]): Promise<GeneratedOutput> {
    const frameworkContent = await this.generateFrameworkSpecificContent(request, chunks);
    
    return {
      content: frameworkContent,
      metadata: {
        type: request.type,
        format: request.parameters.format,
        generatedAt: new Date(),
        version: '1.0.0',
        sources: chunks.map(c => c.id),
        wordCount: frameworkContent.split(/\s+/).length,
        estimatedReadTime: Math.ceil(frameworkContent.split(/\s+/).length / 200),
        sections: []
      }
    };
  }

  abstract getFrameworkPatterns(): FrameworkPattern[];
  abstract getArchitecturalLayers(): ArchitecturalLayer[];
  abstract getBestPractices(): BestPractice[];
  abstract getSecurityGuidelines(): SecurityGuideline[];
  abstract getPerformanceOptimizations(): PerformanceOptimization[];

  protected abstract adaptChunk(chunk: ContentChunk): Promise<ContentChunk>;
  protected abstract isRelevantChunk(chunk: ContentChunk, intent: QueryIntent): boolean;
  protected abstract generateFrameworkSpecificAnswer(query: string, intent: QueryIntent, chunks: ContentChunk[]): Promise<string>;
  protected abstract calculateFrameworkRelevance(chunk: ContentChunk, intent: QueryIntent): number;
  protected abstract generateFrameworkExplanation(chunk: ContentChunk, intent: QueryIntent): string;
  protected abstract getFrameworkSpecificSuggestions(intent: QueryIntent): string[];
  protected abstract generateFrameworkFollowUps(intent: QueryIntent): string[];
  protected abstract generateFrameworkSpecificContent(request: OutputRequest, chunks: ContentChunk[]): Promise<string>;
}

// Spring Boot Adapter Implementation
class SpringBootAdapter extends BaseFrameworkAdapter {
  frameworkName = 'Spring Boot';
  version = '3.0+';
  capabilities: FrameworkCapabilities = {
    supportsLayeredArchitecture: true,
    supportsAnnotations: true,
    supportsDependencyInjection: true,
    supportsAOP: true,
    supportsORM: true,
    supportsRESTAPI: true,
    supportsGraphQL: true,
    supportsWebSockets: true,
    supportsReactiveProgramming: true,
    supportsTesting: true,
    supportsSecurity: true,
    supportsMetrics: true
  };

  protected async adaptChunk(chunk: ContentChunk): Promise<ContentChunk> {
    const adaptedChunk = { ...chunk };
    
    // Enhance Spring Boot specific metadata
    if (chunk.content.includes('@RestController')) {
      adaptedChunk.metadata.tags.push('rest-api', 'web-layer');
      adaptedChunk.metadata.importance = Math.max(chunk.metadata.importance, 0.8);
    }
    
    if (chunk.content.includes('@Service')) {
      adaptedChunk.metadata.tags.push('business-logic', 'service-layer');
      adaptedChunk.metadata.importance = Math.max(chunk.metadata.importance, 0.7);
    }
    
    if (chunk.content.includes('@Repository')) {
      adaptedChunk.metadata.tags.push('data-access', 'persistence-layer');
      adaptedChunk.metadata.importance = Math.max(chunk.metadata.importance, 0.6);
    }
    
    // Add Spring Boot specific patterns
    if (chunk.content.includes('@Autowired')) {
      adaptedChunk.patterns.push('dependency-injection');
    }
    
    if (chunk.content.includes('@Transactional')) {
      adaptedChunk.patterns.push('transaction-management');
    }
    
    return adaptedChunk;
  }

  protected isRelevantChunk(chunk: ContentChunk, intent: QueryIntent): boolean {
    const springAnnotations = ['@RestController', '@Service', '@Repository', '@Entity', '@Configuration'];
    return springAnnotations.some(annotation => chunk.content.includes(annotation));
  }

  protected async generateFrameworkSpecificAnswer(query: string, intent: QueryIntent, chunks: ContentChunk[]): Promise<string> {
    let answer = `Based on your Spring Boot application structure:\n\n`;
    
    const controllers = chunks.filter(c => c.content.includes('@RestController') || c.content.includes('@Controller'));
    const services = chunks.filter(c => c.content.includes('@Service'));
    const repositories = chunks.filter(c => c.content.includes('@Repository'));
    
    if (controllers.length > 0) {
      answer += `## Controllers (${controllers.length})\n`;
      controllers.forEach(controller => {
        answer += `- **${controller.metadata.name}**: Handles HTTP requests\n`;
      });
      answer += '\n';
    }
    
    if (services.length > 0) {
      answer += `## Services (${services.length})\n`;
      services.forEach(service => {
        answer += `- **${service.metadata.name}**: Contains business logic\n`;
      });
      answer += '\n';
    }
    
    if (repositories.length > 0) {
      answer += `## Repositories (${repositories.length})\n`;
      repositories.forEach(repo => {
        answer += `- **${repo.metadata.name}**: Manages data persistence\n`;
      });
    }
    
    return answer;
  }

  protected calculateFrameworkRelevance(chunk: ContentChunk, intent: QueryIntent): number {
    let relevance = 0.5;
    
    if (chunk.content.includes('@RestController')) relevance += 0.3;
    if (chunk.content.includes('@Service')) relevance += 0.2;
    if (chunk.content.includes('@Repository')) relevance += 0.2;
    if (chunk.content.includes('@SpringBootApplication')) relevance += 0.4;
    
    return Math.min(1.0, relevance);
  }

  protected generateFrameworkExplanation(chunk: ContentChunk, intent: QueryIntent): string {
    if (chunk.content.includes('@RestController')) {
      return 'Spring Boot REST controller handling HTTP requests';
    }
    if (chunk.content.includes('@Service')) {
      return 'Spring Boot service component containing business logic';
    }
    if (chunk.content.includes('@Repository')) {
      return 'Spring Boot repository for data access operations';
    }
    return 'Spring Boot component';
  }

  protected getFrameworkSpecificSuggestions(intent: QueryIntent): string[] {
    return [
      'Explore Spring Boot auto-configuration features',
      'Review Spring Security integration',
      'Consider Spring Data JPA for database operations',
      'Implement proper exception handling with @ControllerAdvice'
    ];
  }

  protected generateFrameworkFollowUps(intent: QueryIntent): string[] {
    return [
      'How can I implement Spring Security in this application?',
      'What are the best practices for Spring Boot configuration?',
      'How can I add database integration with Spring Data JPA?'
    ];
  }

  protected async generateFrameworkSpecificContent(request: OutputRequest, chunks: ContentChunk[]): Promise<string> {
    let content = `# Spring Boot Application Guide\n\n`;
    
    content += `## Architecture Overview\n\n`;
    content += `This Spring Boot application follows the layered architecture pattern:\n\n`;
    
    const layers = this.getArchitecturalLayers();
    layers.forEach(layer => {
      const layerChunks = chunks.filter(chunk => 
        layer.components.some(comp => chunk.metadata.type.includes(comp))
      );
      
      if (layerChunks.length > 0) {
        content += `### ${layer.name}\n`;
        content += `${layer.purpose}\n\n`;
        content += `Components:\n`;
        layerChunks.forEach(chunk => {
          content += `- **${chunk.metadata.name}**: ${chunk.metadata.type}\n`;
        });
        content += '\n';
      }
    });
    
    content += `## Configuration\n\n`;
    content += `Key Spring Boot configuration files:\n`;
    content += `- \`application.properties\` or \`application.yml\`: Main configuration\n`;
    content += `- \`@ConfigurationProperties\`: Type-safe configuration\n`;
    content += `- \`@Profile\`: Environment-specific configuration\n\n`;
    
    const bestPractices = this.getBestPractices();
    content += `## Best Practices\n\n`;
    bestPractices.slice(0, 5).forEach(practice => {
      content += `### ${practice.title}\n`;
      content += `${practice.description}\n\n`;
    });
    
    return content;
  }

  getFrameworkPatterns(): FrameworkPattern[] {
    return [
      {
        name: 'Dependency Injection',
        description: 'IoC container manages object dependencies',
        usage: '@Autowired, @Inject, Constructor injection',
        example: '@Autowired private UserService userService;',
        benefits: ['Loose coupling', 'Testability', 'Maintainability'],
        caveats: ['Field injection should be avoided', 'Circular dependencies']
      },
      {
        name: 'MVC Pattern',
        description: 'Model-View-Controller architectural pattern',
        usage: '@Controller, @RestController, @RequestMapping',
        example: '@RestController public class UserController { ... }',
        benefits: ['Separation of concerns', 'Testability'],
        caveats: ['Can become complex with many controllers']
      }
    ];
  }

  getArchitecturalLayers(): ArchitecturalLayer[] {
    return [
      {
        name: 'Presentation Layer',
        purpose: 'Handles HTTP requests and responses',
        components: ['controller'],
        responsibilities: ['Request handling', 'Response formatting', 'Input validation'],
        dependencies: ['Service Layer']
      },
      {
        name: 'Service Layer',
        purpose: 'Contains business logic and orchestrates operations',
        components: ['service'],
        responsibilities: ['Business logic', 'Transaction management', 'Service coordination'],
        dependencies: ['Repository Layer']
      },
      {
        name: 'Repository Layer',
        purpose: 'Manages data persistence and retrieval',
        components: ['repository'],
        responsibilities: ['Data access', 'Query execution', 'Entity mapping'],
        dependencies: ['Database']
      }
    ];
  }

  getBestPractices(): BestPractice[] {
    return [
      {
        category: 'Dependency Injection',
        title: 'Use Constructor Injection',
        description: 'Prefer constructor injection over field injection for mandatory dependencies',
        implementation: 'Use constructor parameters instead of @Autowired fields',
        priority: 'high',
        impact: 'Improved testability and immutability'
      },
      {
        category: 'Configuration',
        title: 'Use @ConfigurationProperties',
        description: 'Use type-safe configuration properties instead of @Value',
        implementation: 'Create configuration classes with @ConfigurationProperties',
        priority: 'medium',
        impact: 'Type safety and better organization'
      },
      {
        category: 'Error Handling',
        title: 'Implement Global Exception Handling',
        description: 'Use @ControllerAdvice for centralized exception handling',
        implementation: 'Create exception handler classes with @ControllerAdvice',
        priority: 'high',
        impact: 'Consistent error responses and better debugging'
      }
    ];
  }

  getSecurityGuidelines(): SecurityGuideline[] {
    return [
      {
        area: 'Authentication',
        guideline: 'Use Spring Security for authentication and authorization',
        implementation: 'Configure SecurityConfig with proper authentication mechanisms',
        riskLevel: 'high',
        mitigation: 'Implement JWT or OAuth2 authentication'
      },
      {
        area: 'Data Validation',
        guideline: 'Validate all input data using Bean Validation',
        implementation: 'Use @Valid and validation annotations',
        riskLevel: 'medium',
        mitigation: 'Add comprehensive input validation'
      }
    ];
  }

  getPerformanceOptimizations(): PerformanceOptimization[] {
    return [
      {
        area: 'Database',
        optimization: 'Use lazy loading for JPA relationships',
        implementation: 'Set fetch = FetchType.LAZY for @OneToMany and @ManyToMany',
        expectedGain: '20-50% reduction in query execution time',
        complexity: 'low'
      },
      {
        area: 'Caching',
        optimization: 'Implement caching for frequently accessed data',
        implementation: 'Use @Cacheable annotation with Redis or Caffeine',
        expectedGain: '50-80% reduction in response time',
        complexity: 'medium'
      }
    ];
  }
}

// React Adapter Implementation (simplified)
class ReactAdapter extends BaseFrameworkAdapter {
  frameworkName = 'React';
  version = '18.0+';
  capabilities: FrameworkCapabilities = {
    supportsLayeredArchitecture: false,
    supportsAnnotations: false,
    supportsDependencyInjection: false,
    supportsAOP: false,
    supportsORM: false,
    supportsRESTAPI: false,
    supportsGraphQL: true,
    supportsWebSockets: true,
    supportsReactiveProgramming: true,
    supportsTesting: true,
    supportsSecurity: false,
    supportsMetrics: false
  };

  protected async adaptChunk(chunk: ContentChunk): Promise<ContentChunk> {
    const adaptedChunk = { ...chunk };
    
    if (chunk.content.includes('useState')) {
      adaptedChunk.metadata.tags.push('state-management', 'react-hook');
    }
    
    if (chunk.content.includes('useEffect')) {
      adaptedChunk.metadata.tags.push('side-effects', 'lifecycle');
    }
    
    return adaptedChunk;
  }

  protected isRelevantChunk(chunk: ContentChunk, intent: QueryIntent): boolean {
    return chunk.content.includes('React') || 
           chunk.content.includes('useState') || 
           chunk.content.includes('useEffect') ||
           chunk.chunkType.toString().includes('component');
  }

  protected async generateFrameworkSpecificAnswer(query: string, intent: QueryIntent, chunks: ContentChunk[]): Promise<string> {
    return `React-specific implementation details...`;
  }

  protected calculateFrameworkRelevance(chunk: ContentChunk, intent: QueryIntent): number {
    return 0.7;
  }

  protected generateFrameworkExplanation(chunk: ContentChunk, intent: QueryIntent): string {
    return 'React component or hook';
  }

  protected getFrameworkSpecificSuggestions(intent: QueryIntent): string[] {
    return ['Consider using React.memo for performance', 'Implement proper state management'];
  }

  protected generateFrameworkFollowUps(intent: QueryIntent): string[] {
    return ['How can I optimize this React component?'];
  }

  protected async generateFrameworkSpecificContent(request: OutputRequest, chunks: ContentChunk[]): Promise<string> {
    return '# React Application Guide\n\nReact-specific content...';
  }

  getFrameworkPatterns(): FrameworkPattern[] {
    return [];
  }

  getArchitecturalLayers(): ArchitecturalLayer[] {
    return [];
  }

  getBestPractices(): BestPractice[] {
    return [];
  }

  getSecurityGuidelines(): SecurityGuideline[] {
    return [];
  }

  getPerformanceOptimizations(): PerformanceOptimization[] {
    return [];
  }
}

// Placeholder implementations for other adapters
class AngularAdapter extends BaseFrameworkAdapter {
  frameworkName = 'Angular';
  version = '15.0+';
  capabilities: FrameworkCapabilities = {
    supportsLayeredArchitecture: true,
    supportsAnnotations: true,
    supportsDependencyInjection: true,
    supportsAOP: false,
    supportsORM: false,
    supportsRESTAPI: true,
    supportsGraphQL: true,
    supportsWebSockets: true,
    supportsReactiveProgramming: true,
    supportsTesting: true,
    supportsSecurity: false,
    supportsMetrics: false
  };

  protected async adaptChunk(chunk: ContentChunk): Promise<ContentChunk> { return chunk; }
  protected isRelevantChunk(chunk: ContentChunk, intent: QueryIntent): boolean { return false; }
  protected async generateFrameworkSpecificAnswer(query: string, intent: QueryIntent, chunks: ContentChunk[]): Promise<string> { return ''; }
  protected calculateFrameworkRelevance(chunk: ContentChunk, intent: QueryIntent): number { return 0.5; }
  protected generateFrameworkExplanation(chunk: ContentChunk, intent: QueryIntent): string { return ''; }
  protected getFrameworkSpecificSuggestions(intent: QueryIntent): string[] { return []; }
  protected generateFrameworkFollowUps(intent: QueryIntent): string[] { return []; }
  protected async generateFrameworkSpecificContent(request: OutputRequest, chunks: ContentChunk[]): Promise<string> { return ''; }
  getFrameworkPatterns(): FrameworkPattern[] { return []; }
  getArchitecturalLayers(): ArchitecturalLayer[] { return []; }
  getBestPractices(): BestPractice[] { return []; }
  getSecurityGuidelines(): SecurityGuideline[] { return []; }
  getPerformanceOptimizations(): PerformanceOptimization[] { return []; }
}

class FlaskAdapter extends BaseFrameworkAdapter {
  frameworkName = 'Flask';
  version = '2.0+';
  capabilities: FrameworkCapabilities = {
    supportsLayeredArchitecture: false,
    supportsAnnotations: false,
    supportsDependencyInjection: false,
    supportsAOP: false,
    supportsORM: true,
    supportsRESTAPI: true,
    supportsGraphQL: false,
    supportsWebSockets: true,
    supportsReactiveProgramming: false,
    supportsTesting: true,
    supportsSecurity: true,
    supportsMetrics: false
  };

  protected async adaptChunk(chunk: ContentChunk): Promise<ContentChunk> { return chunk; }
  protected isRelevantChunk(chunk: ContentChunk, intent: QueryIntent): boolean { return false; }
  protected async generateFrameworkSpecificAnswer(query: string, intent: QueryIntent, chunks: ContentChunk[]): Promise<string> { return ''; }
  protected calculateFrameworkRelevance(chunk: ContentChunk, intent: QueryIntent): number { return 0.5; }
  protected generateFrameworkExplanation(chunk: ContentChunk, intent: QueryIntent): string { return ''; }
  protected getFrameworkSpecificSuggestions(intent: QueryIntent): string[] { return []; }
  protected generateFrameworkFollowUps(intent: QueryIntent): string[] { return []; }
  protected async generateFrameworkSpecificContent(request: OutputRequest, chunks: ContentChunk[]): Promise<string> { return ''; }
  getFrameworkPatterns(): FrameworkPattern[] { return []; }
  getArchitecturalLayers(): ArchitecturalLayer[] { return []; }
  getBestPractices(): BestPractice[] { return []; }
  getSecurityGuidelines(): SecurityGuideline[] { return []; }
  getPerformanceOptimizations(): PerformanceOptimization[] { return []; }
}

class FastAPIAdapter extends BaseFrameworkAdapter {
  frameworkName = 'FastAPI';
  version = '0.95+';
  capabilities: FrameworkCapabilities = {
    supportsLayeredArchitecture: false,
    supportsAnnotations: false,
    supportsDependencyInjection: true,
    supportsAOP: false,
    supportsORM: true,
    supportsRESTAPI: true,
    supportsGraphQL: true,
    supportsWebSockets: true,
    supportsReactiveProgramming: true,
    supportsTesting: true,
    supportsSecurity: true,
    supportsMetrics: true
  };

  protected async adaptChunk(chunk: ContentChunk): Promise<ContentChunk> { return chunk; }
  protected isRelevantChunk(chunk: ContentChunk, intent: QueryIntent): boolean { return false; }
  protected async generateFrameworkSpecificAnswer(query: string, intent: QueryIntent, chunks: ContentChunk[]): Promise<string> { return ''; }
  protected calculateFrameworkRelevance(chunk: ContentChunk, intent: QueryIntent): number { return 0.5; }
  protected generateFrameworkExplanation(chunk: ContentChunk, intent: QueryIntent): string { return ''; }
  protected getFrameworkSpecificSuggestions(intent: QueryIntent): string[] { return []; }
  protected generateFrameworkFollowUps(intent: QueryIntent): string[] { return []; }
  protected async generateFrameworkSpecificContent(request: OutputRequest, chunks: ContentChunk[]): Promise<string> { return ''; }
  getFrameworkPatterns(): FrameworkPattern[] { return []; }
  getArchitecturalLayers(): ArchitecturalLayer[] { return []; }
  getBestPractices(): BestPractice[] { return []; }
  getSecurityGuidelines(): SecurityGuideline[] { return []; }
  getPerformanceOptimizations(): PerformanceOptimization[] { return []; }
}

class VueAdapter extends BaseFrameworkAdapter {
  frameworkName = 'Vue.js';
  version = '3.0+';
  capabilities: FrameworkCapabilities = {
    supportsLayeredArchitecture: false,
    supportsAnnotations: false,
    supportsDependencyInjection: false,
    supportsAOP: false,
    supportsORM: false,
    supportsRESTAPI: false,
    supportsGraphQL: true,
    supportsWebSockets: true,
    supportsReactiveProgramming: true,
    supportsTesting: true,
    supportsSecurity: false,
    supportsMetrics: false
  };

  protected async adaptChunk(chunk: ContentChunk): Promise<ContentChunk> { return chunk; }
  protected isRelevantChunk(chunk: ContentChunk, intent: QueryIntent): boolean { return false; }
  protected async generateFrameworkSpecificAnswer(query: string, intent: QueryIntent, chunks: ContentChunk[]): Promise<string> { return ''; }
  protected calculateFrameworkRelevance(chunk: ContentChunk, intent: QueryIntent): number { return 0.5; }
  protected generateFrameworkExplanation(chunk: ContentChunk, intent: QueryIntent): string { return ''; }
  protected getFrameworkSpecificSuggestions(intent: QueryIntent): string[] { return []; }
  protected generateFrameworkFollowUps(intent: QueryIntent): string[] { return []; }
  protected async generateFrameworkSpecificContent(request: OutputRequest, chunks: ContentChunk[]): Promise<string> { return ''; }
  getFrameworkPatterns(): FrameworkPattern[] { return []; }
  getArchitecturalLayers(): ArchitecturalLayer[] { return []; }
  getBestPractices(): BestPractice[] { return []; }
  getSecurityGuidelines(): SecurityGuideline[] { return []; }
  getPerformanceOptimizations(): PerformanceOptimization[] { return []; }
}

class ExpressAdapter extends BaseFrameworkAdapter {
  frameworkName = 'Express.js';
  version = '4.0+';
  capabilities: FrameworkCapabilities = {
    supportsLayeredArchitecture: false,
    supportsAnnotations: false,
    supportsDependencyInjection: false,
    supportsAOP: false,
    supportsORM: true,
    supportsRESTAPI: true,
    supportsGraphQL: true,
    supportsWebSockets: true,
    supportsReactiveProgramming: false,
    supportsTesting: true,
    supportsSecurity: true,
    supportsMetrics: false
  };

  protected async adaptChunk(chunk: ContentChunk): Promise<ContentChunk> { return chunk; }
  protected isRelevantChunk(chunk: ContentChunk, intent: QueryIntent): boolean { return false; }
  protected async generateFrameworkSpecificAnswer(query: string, intent: QueryIntent, chunks: ContentChunk[]): Promise<string> { return ''; }
  protected calculateFrameworkRelevance(chunk: ContentChunk, intent: QueryIntent): number { return 0.5; }
  protected generateFrameworkExplanation(chunk: ContentChunk, intent: QueryIntent): string { return ''; }
  protected getFrameworkSpecificSuggestions(intent: QueryIntent): string[] { return []; }
  protected generateFrameworkFollowUps(intent: QueryIntent): string[] { return []; }
  protected async generateFrameworkSpecificContent(request: OutputRequest, chunks: ContentChunk[]): Promise<string> { return ''; }
  getFrameworkPatterns(): FrameworkPattern[] { return []; }
  getArchitecturalLayers(): ArchitecturalLayer[] { return []; }
  getBestPractices(): BestPractice[] { return []; }
  getSecurityGuidelines(): SecurityGuideline[] { return []; }
  getPerformanceOptimizations(): PerformanceOptimization[] { return []; }
}

class DjangoAdapter extends BaseFrameworkAdapter {
  frameworkName = 'Django';
  version = '4.0+';
  capabilities: FrameworkCapabilities = {
    supportsLayeredArchitecture: true,
    supportsAnnotations: false,
    supportsDependencyInjection: false,
    supportsAOP: false,
    supportsORM: true,
    supportsRESTAPI: true,
    supportsGraphQL: true,
    supportsWebSockets: true,
    supportsReactiveProgramming: false,
    supportsTesting: true,
    supportsSecurity: true,
    supportsMetrics: false
  };

  protected async adaptChunk(chunk: ContentChunk): Promise<ContentChunk> { return chunk; }
  protected isRelevantChunk(chunk: ContentChunk, intent: QueryIntent): boolean { return false; }
  protected async generateFrameworkSpecificAnswer(query: string, intent: QueryIntent, chunks: ContentChunk[]): Promise<string> { return ''; }
  protected calculateFrameworkRelevance(chunk: ContentChunk, intent: QueryIntent): number { return 0.5; }
  protected generateFrameworkExplanation(chunk: ContentChunk, intent: QueryIntent): string { return ''; }
  protected getFrameworkSpecificSuggestions(intent: QueryIntent): string[] { return []; }
  protected generateFrameworkFollowUps(intent: QueryIntent): string[] { return []; }
  protected async generateFrameworkSpecificContent(request: OutputRequest, chunks: ContentChunk[]): Promise<string> { return ''; }
  getFrameworkPatterns(): FrameworkPattern[] { return []; }
  getArchitecturalLayers(): ArchitecturalLayer[] { return []; }
  getBestPractices(): BestPractice[] { return []; }
  getSecurityGuidelines(): SecurityGuideline[] { return []; }
  getPerformanceOptimizations(): PerformanceOptimization[] { return []; }
}