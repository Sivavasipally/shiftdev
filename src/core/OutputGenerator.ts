import { ContentChunk } from './ContentProcessor';
import { FileClassification } from './FileClassifier';
import { WorkspaceEnvironment } from './RAGFoundation';
import { QueryResponse, RelevantChunk } from './QueryProcessor';
import { CodeGraph, GraphNode, GraphEdge } from './CodeGraph';
import { ParseResult } from './ASTParser';

export interface OutputRequest {
  type: OutputType;
  parameters: OutputParameters;
  context: OutputContext;
}

export enum OutputType {
  README = 'readme',
  TechnicalDocumentation = 'technical-documentation',
  APIDocumentation = 'api-documentation',
  ArchitectureDiagram = 'architecture-diagram',
  ClassDiagram = 'class-diagram',
  SequenceDiagram = 'sequence-diagram',
  ERDiagram = 'er-diagram',
  ComponentDiagram = 'component-diagram',
  DataFlowDiagram = 'data-flow-diagram',
  InteractionDiagram = 'interaction-diagram',
  LayeredArchitectureDiagram = 'layered-architecture-diagram',
  DependencyGraph = 'dependency-graph',
  CodeAnalysisReport = 'code-analysis-report',
  SecurityAssessment = 'security-assessment',
  PerformanceReport = 'performance-report',
  TestingGuide = 'testing-guide',
  DeploymentGuide = 'deployment-guide',
  TroubleshootingGuide = 'troubleshooting-guide',
  ChangeLog = 'change-log',
  ContributorGuide = 'contributor-guide'
}

export interface OutputParameters {
  scope: OutputScope;
  detail: OutputDetailLevel;
  format: OutputFormat;
  includeCode: boolean;
  includeExamples: boolean;
  targetAudience: TargetAudience;
  customSections?: string[];
  diagramOptions?: DiagramOptions;
  interactiveElements?: boolean;
  layoutAlgorithm?: LayoutAlgorithm;
  visualTheme?: VisualTheme;
  filterCriteria?: FilterCriteria;
}

export interface DiagramOptions {
  showAnnotations: boolean;
  includePrivateMembers: boolean;
  groupByPackage: boolean;
  showDependencies: boolean;
  maxDepth: number;
  nodeColors: Record<string, string>;
  edgeStyles: Record<string, EdgeStyle>;
  layoutDirection: 'TB' | 'TD' | 'BT' | 'RL' | 'LR';
  clustering: boolean;
  minimumImportance: number;
}

export interface EdgeStyle {
  color: string;
  thickness: number;
  pattern: 'solid' | 'dashed' | 'dotted';
  animated: boolean;
}

export enum LayoutAlgorithm {
  Hierarchical = 'hierarchical',
  Force = 'force',
  Circular = 'circular',
  Tree = 'tree',
  Grid = 'grid',
  Organic = 'organic'
}

export enum VisualTheme {
  Light = 'light',
  Dark = 'dark',
  HighContrast = 'high-contrast',
  Custom = 'custom'
}

export interface FilterCriteria {
  includeTypes: string[];
  excludeTypes: string[];
  minComplexity: number;
  maxComplexity: number;
  frameworks: string[];
  tags: string[];
  namespaceFilter: string;
}

export enum OutputScope {
  Project = 'project',
  Module = 'module',
  Component = 'component',
  Function = 'function'
}

export enum OutputDetailLevel {
  Brief = 'brief',
  Standard = 'standard',
  Detailed = 'detailed',
  Comprehensive = 'comprehensive'
}

export enum OutputFormat {
  Markdown = 'markdown',
  HTML = 'html',
  PDF = 'pdf',
  JSON = 'json',
  PlantUML = 'plantuml',
  Mermaid = 'mermaid',
  D3JS = 'd3js',
  Graphviz = 'graphviz',
  Draw_io = 'draw-io',
  SVG = 'svg'
}

export enum TargetAudience {
  Developer = 'developer',
  Architect = 'architect',
  BusinessUser = 'business-user',
  Tester = 'tester',
  DevOps = 'devops',
  EndUser = 'end-user'
}

export interface OutputContext {
  workspaceEnvironment: WorkspaceEnvironment;
  availableChunks: ContentChunk[];
  codeGraph?: CodeGraph;
  parseResults?: ParseResult[];
  recentChanges?: ChangeInfo[];
  deploymentInfo?: DeploymentInfo;
  testResults?: TestResults;
  structureAnalysis?: StructureAnalysis;
}

export interface StructureAnalysis {
  architecturalPatterns: ArchitecturalPattern[];
  layerStructure: LayerInfo[];
  componentGroups: ComponentGroup[];
  dataFlow: DataFlowPath[];
  hotspots: ComponentHotspot[];
  frameworkSpecificPatterns: FrameworkPattern[];
}

export interface ArchitecturalPattern {
  name: string;
  confidence: number;
  components: string[];
  description: string;
  benefits: string[];
  tradeoffs: string[];
}

export interface LayerInfo {
  name: string;
  level: number;
  components: string[];
  responsibilities: string[];
  dependencies: string[];
}

export interface ComponentGroup {
  name: string;
  type: 'module' | 'package' | 'namespace' | 'feature';
  components: string[];
  cohesion: number;
  coupling: number;
}

export interface DataFlowPath {
  source: string;
  target: string;
  dataType: string;
  operations: string[];
  direction: 'unidirectional' | 'bidirectional';
}

export interface ComponentHotspot {
  component: string;
  issues: string[];
  complexity: number;
  importance: number;
  recommendations: string[];
}

export interface FrameworkPattern {
  framework: string;
  pattern: string;
  implementation: string[];
  conventions: string[];
  examples: string[];
}

export interface ChangeInfo {
  type: 'added' | 'modified' | 'deleted';
  filePath: string;
  timestamp: Date;
  description: string;
}

export interface DeploymentInfo {
  environment: string;
  version: string;
  deploymentDate: Date;
  configuration: Record<string, any>;
}

export interface TestResults {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  coverage: number;
  lastRun: Date;
}

export interface GeneratedOutput {
  content: string;
  metadata: OutputMetadata;
  attachments?: OutputAttachment[];
}

export interface OutputMetadata {
  type: OutputType;
  format: OutputFormat;
  generatedAt: Date;
  version: string;
  sources: string[];
  wordCount: number;
  estimatedReadTime: number;
  sections: OutputSection[];
}

export interface OutputSection {
  title: string;
  level: number;
  wordCount: number;
  startPosition: number;
  endPosition: number;
}

export interface OutputAttachment {
  name: string;
  type: 'diagram' | 'code' | 'config' | 'data';
  content: string;
  format: string;
}

export class OutputGenerator {
  private generators: Map<OutputType, SpecializedGenerator> = new Map();
  private templates: Map<string, OutputTemplate> = new Map();

  constructor() {
    this.initializeGenerators();
    this.initializeTemplates();
  }

  async generateOutput(request: OutputRequest): Promise<GeneratedOutput> {
    console.log(`📄 Phase 5: Generating ${request.type} output...`);
    
    const generator = this.generators.get(request.type);
    if (!generator) {
      throw new Error(`No generator available for output type: ${request.type}`);
    }

    const startTime = Date.now();
    const output = await generator.generate(request);
    
    // Enhance metadata
    output.metadata.generatedAt = new Date();
    output.metadata.version = this.generateVersion();
    output.metadata.wordCount = this.countWords(output.content);
    output.metadata.estimatedReadTime = Math.ceil(output.metadata.wordCount / 200); // 200 WPM average
    
    console.log(`✅ Generated ${request.type} in ${Date.now() - startTime}ms`);
    
    return output;
  }

  private initializeGenerators(): void {
    this.generators.set(OutputType.README, new READMEGenerator());
    this.generators.set(OutputType.TechnicalDocumentation, new TechnicalDocumentationGenerator());
    this.generators.set(OutputType.APIDocumentation, new APIDocumentationGenerator());
    this.generators.set(OutputType.ArchitectureDiagram, new StructureFirstArchitectureDiagramGenerator());
    this.generators.set(OutputType.ClassDiagram, new ClassDiagramGenerator());
    this.generators.set(OutputType.SequenceDiagram, new SequenceDiagramGenerator());
    this.generators.set(OutputType.CodeAnalysisReport, new CodeAnalysisReportGenerator());
    this.generators.set(OutputType.SecurityAssessment, new SecurityAssessmentGenerator());
    this.generators.set(OutputType.PerformanceReport, new PerformanceReportGenerator());
    this.generators.set(OutputType.TestingGuide, new TestingGuideGenerator());
    this.generators.set(OutputType.DeploymentGuide, new DeploymentGuideGenerator());
    this.generators.set(OutputType.TroubleshootingGuide, new TroubleshootingGuideGenerator());
  }

  private initializeTemplates(): void {
    this.templates.set('readme-basic', new READMETemplate());
    this.templates.set('api-docs', new APIDocumentationTemplate());
    this.templates.set('architecture', new ArchitectureTemplate());
    this.templates.set('security-report', new SecurityReportTemplate());
  }

  private generateVersion(): string {
    const now = new Date();
    return `v${now.getFullYear()}.${(now.getMonth() + 1).toString().padStart(2, '0')}.${now.getDate().toString().padStart(2, '0')}`;
  }

  private countWords(content: string): number {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }
}

// Abstract base class for specialized generators
abstract class SpecializedGenerator {
  abstract generate(request: OutputRequest): Promise<GeneratedOutput>;
  
  protected createBaseMetadata(type: OutputType, format: OutputFormat): OutputMetadata {
    return {
      type,
      format,
      generatedAt: new Date(),
      version: '',
      sources: [],
      wordCount: 0,
      estimatedReadTime: 0,
      sections: []
    };
  }
  
  protected extractSections(content: string): OutputSection[] {
    const sections: OutputSection[] = [];
    const lines = content.split('\n');
    let currentPosition = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        const startPosition = currentPosition;
        
        // Find end position (next header of same or higher level, or end of content)
        let endPosition = content.length;
        for (let j = i + 1; j < lines.length; j++) {
          const nextHeaderMatch = lines[j].match(/^(#{1,6})\s+/);
          if (nextHeaderMatch && nextHeaderMatch[1].length <= level) {
            endPosition = lines.slice(0, j).join('\n').length;
            break;
          }
        }
        
        const sectionContent = content.substring(startPosition, endPosition);
        
        sections.push({
          title,
          level,
          wordCount: this.countWords(sectionContent),
          startPosition,
          endPosition
        });
      }
      
      currentPosition += line.length + 1; // +1 for newline
    }
    
    return sections;
  }
  
  private countWords(content: string): number {
    return content.split(/\s+/).filter(word => word.length > 0).length;
  }
  
  protected generateInteractiveAnnotations(chunks: ContentChunk[], type: string): InteractiveElement[] {
    const annotations: InteractiveElement[] = [];
    
    chunks.forEach((chunk, index) => {
      if (chunk.metadata.importance > 0.7) {
        annotations.push({
          id: `annotation-${index}`,
          type: 'tooltip',
          target: chunk.id,
          action: 'hover',
          content: this.generateTooltipContent(chunk),
          position: { x: 0, y: 0 }
        });
      }
      
      if (chunk.metadata.complexity > 7) {
        annotations.push({
          id: `complexity-${index}`,
          type: 'clickable',
          target: chunk.id,
          action: 'expand',
          content: this.generateComplexityDetails(chunk)
        });
      }
    });
    
    return annotations;
  }
  
  private generateTooltipContent(chunk: ContentChunk): string {
    return `<div class="tooltip-content">
      <h4>${chunk.metadata.name || 'Component'}</h4>
      <p><strong>Type:</strong> ${chunk.metadata.type}</p>
      <p><strong>Complexity:</strong> ${chunk.metadata.complexity}/10</p>
      <p><strong>Importance:</strong> ${chunk.metadata.importance.toFixed(2)}</p>
      ${chunk.metadata.annotations.length > 0 ? `<p><strong>Annotations:</strong> ${chunk.metadata.annotations.join(', ')}</p>` : ''}
    </div>`;
  }
  
  private generateComplexityDetails(chunk: ContentChunk): string {
    return `<div class="complexity-details">
      <h4>Complexity Analysis: ${chunk.metadata.name}</h4>
      <div class="metrics">
        <div class="metric">
          <span class="label">Complexity Score:</span>
          <span class="value">${chunk.metadata.complexity}/10</span>
        </div>
        <div class="metric">
          <span class="label">Dependencies:</span>
          <span class="value">${chunk.dependencies.length}</span>
        </div>
        <div class="metric">
          <span class="label">Lines of Code:</span>
          <span class="value">${chunk.content.split('\n').length}</span>
        </div>
      </div>
      <div class="recommendations">
        ${chunk.metadata.complexity > 8 ? '<p class="warning">⚠️ Consider refactoring to reduce complexity</p>' : ''}
        ${chunk.dependencies.length > 10 ? '<p class="info">ℹ️ High number of dependencies detected</p>' : ''}
      </div>
    </div>`;
  }
}

// Concrete generator implementations
class READMEGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const { context, parameters } = request;
    const { workspaceEnvironment, availableChunks } = context;
    
    let content = '';
    
    // Project Title and Description
    const projectName = this.extractProjectName(workspaceEnvironment);
    content += `# ${projectName}\n\n`;
    
    // Description
    content += this.generateDescription(workspaceEnvironment, availableChunks);
    content += '\n\n';
    
    // Table of Contents (for detailed documentation)
    if (parameters.detail === OutputDetailLevel.Detailed || parameters.detail === OutputDetailLevel.Comprehensive) {
      content += this.generateTableOfContents();
      content += '\n\n';
    }
    
    // Features
    content += this.generateFeatures(availableChunks);
    content += '\n\n';
    
    // Technology Stack
    content += this.generateTechnologyStack(workspaceEnvironment);
    content += '\n\n';
    
    // Installation
    content += this.generateInstallation(workspaceEnvironment);
    content += '\n\n';
    
    // Usage
    if (parameters.includeExamples) {
      content += this.generateUsage(availableChunks);
      content += '\n\n';
    }
    
    // API Documentation (if applicable)
    if (this.hasAPIComponents(availableChunks)) {
      content += this.generateAPISection(availableChunks);
      content += '\n\n';
    }
    
    // Configuration
    content += this.generateConfiguration(availableChunks);
    content += '\n\n';
    
    // Development
    if (parameters.targetAudience === TargetAudience.Developer) {
      content += this.generateDevelopmentSection(availableChunks);
      content += '\n\n';
    }
    
    // Testing
    if (context.testResults) {
      content += this.generateTestingSection(context.testResults);
      content += '\n\n';
    }
    
    // Deployment
    if (context.deploymentInfo) {
      content += this.generateDeploymentSection(context.deploymentInfo);
      content += '\n\n';
    }
    
    // Contributing
    content += this.generateContributingSection();
    content += '\n\n';
    
    // License
    content += this.generateLicenseSection();
    
    const metadata = this.createBaseMetadata(OutputType.README, OutputFormat.Markdown);
    metadata.sources = this.extractSources(availableChunks);
    metadata.sections = this.extractSections(content);
    
    return {
      content,
      metadata
    };
  }
  
  private extractProjectName(workspaceEnvironment: WorkspaceEnvironment): string {
    const pathSegments = workspaceEnvironment.rootPath.split(/[/\\]/);
    return pathSegments[pathSegments.length - 1] || 'Project';
  }
  
  private generateDescription(workspaceEnvironment: WorkspaceEnvironment, chunks: ContentChunk[]): string {
    const frameworks = workspaceEnvironment.detectedFrameworks.map(f => f.name).join(', ');
    const primaryFramework = workspaceEnvironment.confidence.primary.framework;
    
    let description = `A ${primaryFramework} application`;
    
    if (frameworks) {
      description += ` built with ${frameworks}`;
    }
    
    // Try to infer purpose from components
    const controllers = chunks.filter(c => c.metadata.type.includes('controller')).length;
    const services = chunks.filter(c => c.metadata.type.includes('service')).length;
    
    if (controllers > 0) {
      description += ` featuring ${controllers} controller${controllers > 1 ? 's' : ''}`;
    }
    if (services > 0) {
      description += ` and ${services} service${services > 1 ? 's' : ''}`;
    }
    
    description += '.';
    
    return description;
  }
  
  private generateTableOfContents(): string {
    return `## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)`;
  }
  
  private generateFeatures(chunks: ContentChunk[]): string {
    let features = '## Features\n\n';
    
    const featureMap = new Map<string, string[]>();
    
    chunks.forEach(chunk => {
      if (chunk.metadata.type.includes('controller')) {
        if (!featureMap.has('API Endpoints')) featureMap.set('API Endpoints', []);
        featureMap.get('API Endpoints')!.push(chunk.metadata.name || 'Endpoint');
      }
      if (chunk.metadata.type.includes('service')) {
        if (!featureMap.has('Business Logic')) featureMap.set('Business Logic', []);
        featureMap.get('Business Logic')!.push(chunk.metadata.name || 'Service');
      }
      if (chunk.metadata.type.includes('repository')) {
        if (!featureMap.has('Data Access')) featureMap.set('Data Access', []);
        featureMap.get('Data Access')!.push(chunk.metadata.name || 'Repository');
      }
      if (chunk.metadata.type.includes('configuration')) {
        if (!featureMap.has('Configuration')) featureMap.set('Configuration', []);
        featureMap.get('Configuration')!.push(chunk.metadata.name || 'Config');
      }
    });
    
    if (featureMap.size === 0) {
      features += '- Modular architecture\n';
      features += '- Clean code structure\n';
      features += '- Framework best practices\n';
    } else {
      featureMap.forEach((items, category) => {
        features += `- **${category}**: ${items.slice(0, 3).join(', ')}${items.length > 3 ? ` and ${items.length - 3} more` : ''}\n`;
      });
    }
    
    return features;
  }
  
  private generateTechnologyStack(workspaceEnvironment: WorkspaceEnvironment): string {
    let stack = '## Technology Stack\n\n';
    
    const frameworks = workspaceEnvironment.detectedFrameworks;
    
    if (frameworks.length > 0) {
      frameworks.forEach(framework => {
        stack += `- **${framework.name}** ${framework.version || ''} - ${this.getFrameworkDescription(framework.name)}\n`;
      });
    }
    
    // Add common tools based on detected files
    stack += '\n### Build Tools\n';
    // This would be enhanced with actual file detection
    stack += '- Build automation and dependency management\n';
    stack += '- Testing framework integration\n';
    
    return stack;
  }
  
  private getFrameworkDescription(frameworkName: string): string {
    const descriptions: Record<string, string> = {
      'Spring Boot': 'Java-based enterprise application framework',
      'React': 'JavaScript library for building user interfaces',
      'Angular': 'TypeScript-based web application framework',
      'Vue.js': 'Progressive JavaScript framework',
      'Flask': 'Lightweight Python web framework',
      'FastAPI': 'Modern Python web framework for APIs'
    };
    return descriptions[frameworkName] || 'Framework';
  }
  
  private generateInstallation(workspaceEnvironment: WorkspaceEnvironment): string {
    const primaryFramework = workspaceEnvironment.confidence.primary.framework.toLowerCase();
    
    let installation = '## Installation\n\n';
    installation += '### Prerequisites\n\n';
    
    // Framework-specific prerequisites
    switch (primaryFramework) {
      case 'spring boot':
        installation += '- Java 17 or higher\n';
        installation += '- Maven 3.6+ or Gradle 7+\n';
        break;
      case 'react':
      case 'angular':
      case 'vue.js':
        installation += '- Node.js 16 or higher\n';
        installation += '- npm or yarn\n';
        break;
      case 'flask':
      case 'fastapi':
        installation += '- Python 3.8 or higher\n';
        installation += '- pip\n';
        break;
    }
    
    installation += '\n### Setup\n\n';
    installation += '1. Clone the repository:\n';
    installation += '   ```bash\n';
    installation += '   git clone <repository-url>\n';
    installation += '   cd ' + this.extractProjectName(workspaceEnvironment).toLowerCase() + '\n';
    installation += '   ```\n\n';
    
    // Framework-specific setup
    switch (primaryFramework) {
      case 'spring boot':
        installation += '2. Build the project:\n';
        installation += '   ```bash\n';
        installation += '   ./mvnw clean install\n';
        installation += '   ```\n\n';
        break;
      case 'react':
      case 'angular':
      case 'vue.js':
        installation += '2. Install dependencies:\n';
        installation += '   ```bash\n';
        installation += '   npm install\n';
        installation += '   ```\n\n';
        break;
      case 'flask':
      case 'fastapi':
        installation += '2. Create virtual environment and install dependencies:\n';
        installation += '   ```bash\n';
        installation += '   python -m venv venv\n';
        installation += '   source venv/bin/activate  # On Windows: venv\\Scripts\\activate\n';
        installation += '   pip install -r requirements.txt\n';
        installation += '   ```\n\n';
        break;
    }
    
    return installation;
  }
  
  private generateUsage(chunks: ContentChunk[]): string {
    let usage = '## Usage\n\n';
    
    const mainClasses = chunks.filter(c => 
      c.metadata.name?.toLowerCase().includes('main') || 
      c.metadata.name?.toLowerCase().includes('application') ||
      c.metadata.tags.includes('spring-boot-main')
    );
    
    if (mainClasses.length > 0) {
      usage += '### Running the Application\n\n';
      usage += '```bash\n';
      usage += '# Development mode\n';
      usage += 'npm start  # or ./mvnw spring-boot:run for Spring Boot\n';
      usage += '```\n\n';
    }
    
    const controllers = chunks.filter(c => c.metadata.type.includes('controller'));
    if (controllers.length > 0) {
      usage += '### API Endpoints\n\n';
      usage += 'The application provides the following main endpoints:\n\n';
      controllers.slice(0, 3).forEach(controller => {
        usage += `- **${controller.metadata.name}**: Handles ${controller.metadata.name?.toLowerCase().replace('controller', '')} operations\n`;
      });
    }
    
    return usage;
  }
  
  private hasAPIComponents(chunks: ContentChunk[]): boolean {
    return chunks.some(c => 
      c.metadata.type.includes('controller') || 
      c.metadata.type.includes('route') ||
      c.metadata.tags.includes('api')
    );
  }
  
  private generateAPISection(chunks: ContentChunk[]): string {
    let api = '## API Documentation\n\n';
    
    const apiChunks = chunks.filter(c => 
      c.metadata.type.includes('controller') || 
      c.metadata.type.includes('route')
    );
    
    if (apiChunks.length > 0) {
      api += 'This application exposes RESTful APIs for:\n\n';
      apiChunks.forEach(chunk => {
        const endpoint = chunk.metadata.name?.replace(/Controller|Route/gi, '') || 'Resource';
        api += `- **${endpoint}**: CRUD operations for ${endpoint.toLowerCase()}\n`;
      });
      
      api += '\nFor detailed API documentation, see the `/docs` endpoint when the application is running.\n';
    }
    
    return api;
  }
  
  private generateConfiguration(chunks: ContentChunk[]): string {
    let config = '## Configuration\n\n';
    
    const configChunks = chunks.filter(c => c.metadata.type.includes('configuration'));
    
    if (configChunks.length > 0) {
      config += 'The application can be configured through:\n\n';
      configChunks.forEach(chunk => {
        config += `- **${chunk.metadata.name}**: ${this.getConfigDescription(chunk)}\n`;
      });
    } else {
      config += 'Configuration files are located in the appropriate directories based on the framework conventions.\n';
    }
    
    config += '\n### Environment Variables\n\n';
    config += 'Key environment variables:\n\n';
    config += '- `PORT`: Application port (default: framework specific)\n';
    config += '- `DATABASE_URL`: Database connection string\n';
    config += '- `LOG_LEVEL`: Logging level (DEBUG, INFO, WARN, ERROR)\n';
    
    return config;
  }
  
  private getConfigDescription(chunk: ContentChunk): string {
    const name = chunk.metadata.name?.toLowerCase() || '';
    if (name.includes('database') || name.includes('datasource')) {
      return 'Database configuration and connection settings';
    }
    if (name.includes('security')) {
      return 'Security and authentication configuration';
    }
    if (name.includes('server') || name.includes('application')) {
      return 'Server and application configuration';
    }
    return 'Application configuration';
  }
  
  private generateDevelopmentSection(chunks: ContentChunk[]): string {
    let dev = '## Development\n\n';
    
    dev += '### Project Structure\n\n';
    dev += 'The project follows standard framework conventions:\n\n';
    
    const structureMap = new Map<string, string[]>();
    chunks.forEach(chunk => {
      const type = chunk.metadata.type;
      if (!structureMap.has(type)) structureMap.set(type, []);
      structureMap.get(type)!.push(chunk.metadata.name || 'Component');
    });
    
    structureMap.forEach((items, type) => {
      dev += `- **${type}**: ${items.slice(0, 2).join(', ')}${items.length > 2 ? '...' : ''}\n`;
    });
    
    dev += '\n### Code Style\n\n';
    dev += '- Follow framework best practices\n';
    dev += '- Use consistent naming conventions\n';
    dev += '- Write comprehensive tests\n';
    dev += '- Document public APIs\n';
    
    return dev;
  }
  
  private generateTestingSection(testResults: TestResults): string {
    let testing = '## Testing\n\n';
    
    testing += `### Test Coverage: ${testResults.coverage}%\n\n`;
    testing += `- Total Tests: ${testResults.totalTests}\n`;
    testing += `- Passed: ${testResults.passedTests}\n`;
    testing += `- Failed: ${testResults.failedTests}\n`;
    testing += `- Last Run: ${testResults.lastRun.toLocaleDateString()}\n\n`;
    
    testing += '### Running Tests\n\n';
    testing += '```bash\n';
    testing += '# Run all tests\n';
    testing += 'npm test  # or ./mvnw test for Spring Boot\n\n';
    testing += '# Run with coverage\n';
    testing += 'npm run test:coverage\n';
    testing += '```\n';
    
    return testing;
  }
  
  private generateDeploymentSection(deploymentInfo: DeploymentInfo): string {
    let deployment = '## Deployment\n\n';
    
    deployment += `### Current Version: ${deploymentInfo.version}\n`;
    deployment += `### Environment: ${deploymentInfo.environment}\n`;
    deployment += `### Last Deployed: ${deploymentInfo.deploymentDate.toLocaleDateString()}\n\n`;
    
    deployment += '### Deployment Steps\n\n';
    deployment += '1. Ensure all tests pass\n';
    deployment += '2. Build the application\n';
    deployment += '3. Configure environment variables\n';
    deployment += '4. Deploy to target environment\n';
    deployment += '5. Verify deployment health\n';
    
    return deployment;
  }
  
  private generateContributingSection(): string {
    return `## Contributing

1. Fork the repository
2. Create a feature branch: \`git checkout -b feature-name\`
3. Make your changes and write tests
4. Ensure all tests pass
5. Commit your changes: \`git commit -am 'Add feature'\`
6. Push to the branch: \`git push origin feature-name\`
7. Submit a pull request`;
  }
  
  private generateLicenseSection(): string {
    return `## License

This project is licensed under the MIT License - see the LICENSE file for details.`;
  }
  
  private extractSources(chunks: ContentChunk[]): string[] {
    return [...new Set(chunks.map(chunk => chunk.id.split('_')[0]))].slice(0, 10);
  }
}

class TechnicalDocumentationGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const { context, parameters } = request;
    
    let content = '# Technical Documentation\n\n';
    
    // Architecture Overview
    content += this.generateArchitectureOverview(context);
    content += '\n\n';
    
    // Component Documentation
    content += this.generateComponentDocumentation(context.availableChunks);
    content += '\n\n';
    
    // Data Models
    content += this.generateDataModels(context.availableChunks);
    content += '\n\n';
    
    // Integration Points
    content += this.generateIntegrationPoints(context.availableChunks);
    
    const metadata = this.createBaseMetadata(OutputType.TechnicalDocumentation, OutputFormat.Markdown);
    metadata.sections = this.extractSections(content);
    
    return { content, metadata };
  }
  
  private generateArchitectureOverview(context: OutputContext): string {
    let overview = '## Architecture Overview\n\n';
    
    const frameworks = context.workspaceEnvironment.detectedFrameworks;
    const primaryFramework = context.workspaceEnvironment.confidence.primary.framework;
    
    overview += `### Framework: ${primaryFramework}\n\n`;
    overview += 'The application follows a layered architecture pattern:\n\n';
    
    // Identify layers from chunks
    const layers = this.identifyArchitecturalLayers(context.availableChunks);
    layers.forEach(layer => {
      overview += `- **${layer.name}**: ${layer.description}\n`;
    });
    
    return overview;
  }
  
  private identifyArchitecturalLayers(chunks: ContentChunk[]): Array<{name: string, description: string}> {
    const layers = [];
    
    if (chunks.some(c => c.metadata.type.includes('controller'))) {
      layers.push({
        name: 'Presentation Layer',
        description: 'Handles HTTP requests and responses, input validation'
      });
    }
    
    if (chunks.some(c => c.metadata.type.includes('service'))) {
      layers.push({
        name: 'Business Logic Layer',
        description: 'Contains core business logic and orchestrates operations'
      });
    }
    
    if (chunks.some(c => c.metadata.type.includes('repository'))) {
      layers.push({
        name: 'Data Access Layer',
        description: 'Manages data persistence and retrieval operations'
      });
    }
    
    return layers;
  }
  
  private generateComponentDocumentation(chunks: ContentChunk[]): string {
    let components = '## Component Documentation\n\n';
    
    const groupedChunks = this.groupChunksByType(chunks);
    
    groupedChunks.forEach((typeChunks, type) => {
      components += `### ${type.charAt(0).toUpperCase() + type.slice(1)} Components\n\n`;
      
      typeChunks.slice(0, 5).forEach(chunk => {
        components += `#### ${chunk.metadata.name || 'Unnamed'}\n\n`;
        components += `- **Type**: ${chunk.metadata.type}\n`;
        components += `- **Framework**: ${chunk.metadata.framework || 'N/A'}\n`;
        components += `- **Complexity**: ${chunk.metadata.complexity}/10\n`;
        components += `- **Dependencies**: ${chunk.dependencies.slice(0, 3).join(', ')}${chunk.dependencies.length > 3 ? '...' : ''}\n\n`;
        
        if (chunk.metadata.annotations.length > 0) {
          components += `- **Annotations**: ${chunk.metadata.annotations.join(', ')}\n\n`;
        }
      });
    });
    
    return components;
  }
  
  private generateDataModels(chunks: ContentChunk[]): string {
    let models = '## Data Models\n\n';
    
    const entityChunks = chunks.filter(c => 
      c.metadata.type.includes('entity') || 
      c.metadata.type.includes('model') ||
      c.metadata.tags.includes('entity')
    );
    
    if (entityChunks.length > 0) {
      models += 'The application uses the following data models:\n\n';
      
      entityChunks.forEach(entity => {
        models += `### ${entity.metadata.name}\n\n`;
        models += this.extractEntityDetails(entity);
        models += '\n';
      });
    } else {
      models += 'No explicit data models identified in the current analysis scope.\n';
    }
    
    return models;
  }
  
  private extractEntityDetails(entity: ContentChunk): string {
    let details = '';
    
    // Try to extract field information from content
    const fields = this.extractFieldsFromContent(entity.content);
    if (fields.length > 0) {
      details += 'Fields:\n';
      fields.forEach(field => {
        details += `- ${field}\n`;
      });
    }
    
    if (entity.metadata.annotations.length > 0) {
      details += `\nAnnotations: ${entity.metadata.annotations.join(', ')}\n`;
    }
    
    return details;
  }
  
  private extractFieldsFromContent(content: string): string[] {
    const fields: string[] = [];
    
    // Java field patterns
    const javaFields = content.match(/private\s+\w+\s+(\w+);/g);
    if (javaFields) {
      fields.push(...javaFields.map(field => {
        const match = field.match(/private\s+(\w+)\s+(\w+);/);
        return match ? `${match[2]}: ${match[1]}` : field;
      }));
    }
    
    // TypeScript/JavaScript property patterns
    const tsFields = content.match(/(\w+):\s*(\w+);?/g);
    if (tsFields) {
      fields.push(...tsFields.slice(0, 10)); // Limit to avoid noise
    }
    
    return fields.slice(0, 10); // Limit to top 10 fields
  }
  
  private generateIntegrationPoints(chunks: ContentChunk[]): string {
    let integration = '## Integration Points\n\n';
    
    const integrationChunks = chunks.filter(c => 
      c.metadata.type.includes('controller') ||
      c.metadata.type.includes('route') ||
      c.dependencies.some(dep => dep.includes('http') || dep.includes('api'))
    );
    
    if (integrationChunks.length > 0) {
      integration += 'The application provides the following integration points:\n\n';
      
      integrationChunks.slice(0, 5).forEach(chunk => {
        integration += `### ${chunk.metadata.name}\n\n`;
        integration += `- **Type**: ${chunk.metadata.type}\n`;
        integration += `- **Endpoint Pattern**: ${this.inferEndpointPattern(chunk)}\n`;
        integration += `- **Dependencies**: ${chunk.dependencies.slice(0, 3).join(', ')}\n\n`;
      });
    }
    
    return integration;
  }
  
  private inferEndpointPattern(chunk: ContentChunk): string {
    const content = chunk.content.toLowerCase();
    
    if (content.includes('@requestmapping') || content.includes('@getmapping')) {
      return 'REST API endpoint';
    }
    if (content.includes('@app.route') || content.includes('@app.get')) {
      return 'HTTP route handler';
    }
    if (content.includes('router.')) {
      return 'Route definition';
    }
    
    return 'Integration point';
  }
  
  private groupChunksByType(chunks: ContentChunk[]): Map<string, ContentChunk[]> {
    const groups = new Map<string, ContentChunk[]>();
    
    chunks.forEach(chunk => {
      const type = chunk.metadata.type;
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      groups.get(type)!.push(chunk);
    });
    
    return groups;
  }
}

// Additional generator classes would follow similar patterns...
class APIDocumentationGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const content = '# API Documentation\n\nGenerated API documentation...';
    const metadata = this.createBaseMetadata(OutputType.APIDocumentation, OutputFormat.Markdown);
    return { content, metadata };
  }
}

// Structure-first Architecture Diagram Generator
class StructureFirstArchitectureDiagramGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const { context, parameters } = request;
    const filteredChunks = this.applyFilterCriteria(context.availableChunks, parameters.filterCriteria);
    
    let content: string;
    const format = parameters.format || OutputFormat.Mermaid;
    
    switch (format) {
      case OutputFormat.PlantUML:
        content = this.generatePlantUMLArchitecture(filteredChunks, context.structureAnalysis, parameters.diagramOptions);
        break;
      case OutputFormat.D3JS:
        content = this.generateD3JSArchitecture(filteredChunks, context.structureAnalysis, parameters.diagramOptions);
        break;
      case OutputFormat.Graphviz:
        content = this.generateGraphvizArchitecture(filteredChunks, context.structureAnalysis, parameters.diagramOptions);
        break;
      default:
        content = this.generateMermaidArchitecture(filteredChunks, context.structureAnalysis, parameters.diagramOptions);
    }
    
    const metadata = this.createBaseMetadata(OutputType.ArchitectureDiagram, format);
    metadata.sources = this.extractSources(filteredChunks);
    
    const attachments: OutputAttachment[] = [];
    
    if (parameters.interactiveElements) {
      attachments.push({
        name: 'interactive-elements.json',
        type: 'interactive',
        content: JSON.stringify(this.generateInteractiveAnnotations(filteredChunks, 'architecture')),
        format: 'json',
        interactiveElements: this.generateInteractiveAnnotations(filteredChunks, 'architecture')
      });
    }
    
    return { content, metadata, attachments };
  }
  
  private generateMermaidArchitecture(chunks: ContentChunk[], analysis?: StructureAnalysis, options?: DiagramOptions): string {
    let diagram = `graph ${options?.layoutDirection || 'TD'}\n`;
    
    if (!analysis) {
      // Fallback to simple structure analysis
      analysis = this.performBasicStructureAnalysis(chunks);
    }
    
    // Generate layers based on structure analysis
    const layers = analysis.layerStructure;
    
    // Define layer hierarchy
    layers.forEach((layer, index) => {
      const layerId = this.sanitizeId(layer.name);
      diagram += `    subgraph ${layerId}["${layer.name}"]\n`;
      
      // Add components to layer
      layer.components.forEach(componentName => {
        const chunk = chunks.find(c => c.metadata.name === componentName);
        if (chunk) {
          const compId = this.sanitizeId(componentName);
          diagram += `        ${compId}["${componentName}"]\n`;
        }
      });
      
      diagram += `    end\n`;
    });
    
    // Add dependencies between layers
    this.addArchitecturalDependencies(diagram, chunks, analysis, options);
    
    // Add styling
    diagram += this.generateMermaidStyling(options);
    
    return diagram;
  }
  
  private generatePlantUMLArchitecture(chunks: ContentChunk[], analysis?: StructureAnalysis, options?: DiagramOptions): string {
    let diagram = '@startuml\n!theme plain\n\n';
    
    if (!analysis) {
      analysis = this.performBasicStructureAnalysis(chunks);
    }
    
    // Add architectural layers as packages
    analysis.layerStructure.forEach(layer => {
      diagram += `package "${layer.name}" {\n`;
      
      layer.components.forEach(componentName => {
        const chunk = chunks.find(c => c.metadata.name === componentName);
        if (chunk) {
          const componentType = this.getPlantUMLComponentType(chunk.metadata.type);
          diagram += `  ${componentType} ${componentName}\n`;
        }
      });
      
      diagram += `}\n\n`;
    });
    
    // Add relationships
    this.addPlantUMLArchitecturalRelationships(diagram, chunks, analysis);
    
    diagram += '\n@enduml';
    return diagram;
  }
  
  private generateD3JSArchitecture(chunks: ContentChunk[], analysis?: StructureAnalysis, options?: DiagramOptions): string {
    if (!analysis) {
      analysis = this.performBasicStructureAnalysis(chunks);
    }
    
    const nodes = [];
    const links = [];
    
    // Create nodes for each component
    chunks.forEach((chunk, index) => {
      nodes.push({
        id: chunk.id,
        name: chunk.metadata.name || `Component${index}`,
        type: chunk.metadata.type,
        layer: this.getComponentLayer(chunk, analysis!.layerStructure),
        complexity: chunk.metadata.complexity,
        importance: chunk.metadata.importance,
        size: Math.max(10, chunk.metadata.complexity * 5)
      });
    });
    
    // Create links based on dependencies
    chunks.forEach(chunk => {
      chunk.dependencies.forEach(dep => {
        const targetChunk = chunks.find(c => c.id === dep || c.metadata.name === dep);
        if (targetChunk) {
          links.push({
            source: chunk.id,
            target: targetChunk.id,
            type: 'dependency',
            strength: 1
          });
        }
      });
    });
    
    return JSON.stringify({
      nodes,
      links,
      layout: {
        algorithm: options?.layoutDirection || 'force',
        clustering: options?.clustering || true,
        groupBy: 'layer'
      },
      styling: this.getD3JSStyling(options)
    }, null, 2);
  }
  
  private generateGraphvizArchitecture(chunks: ContentChunk[], analysis?: StructureAnalysis, options?: DiagramOptions): string {
    let diagram = 'digraph Architecture {\n';
    diagram += '  rankdir=TB;\n';
    diagram += '  node [shape=rect, style=filled];\n\n';
    
    if (!analysis) {
      analysis = this.performBasicStructureAnalysis(chunks);
    }
    
    // Create clusters for layers
    analysis.layerStructure.forEach((layer, index) => {
      diagram += `  subgraph cluster_${index} {\n`;
      diagram += `    label="${layer.name}";\n`;
      diagram += `    style=filled;\n`;
      diagram += `    fillcolor=lightgrey;\n\n`;
      
      layer.components.forEach(componentName => {
        const chunk = chunks.find(c => c.metadata.name === componentName);
        if (chunk) {
          const nodeId = this.sanitizeId(componentName);
          const nodeColor = this.getGraphvizNodeColor(chunk.metadata.type);
          diagram += `    ${nodeId} [label="${componentName}", fillcolor="${nodeColor}"];\n`;
        }
      });
      
      diagram += `  }\n\n`;
    });
    
    // Add edges
    chunks.forEach(chunk => {
      chunk.dependencies.forEach(dep => {
        const sourceId = this.sanitizeId(chunk.metadata.name || chunk.id);
        const targetChunk = chunks.find(c => c.metadata.name === dep);
        if (targetChunk) {
          const targetId = this.sanitizeId(targetChunk.metadata.name || targetChunk.id);
          diagram += `  ${sourceId} -> ${targetId};\n`;
        }
      });
    });
    
    diagram += '}';
    return diagram;
  }
  
  private performBasicStructureAnalysis(chunks: ContentChunk[]): StructureAnalysis {
    const layers: LayerInfo[] = [];
    
    // Identify common architectural layers
    const controllerChunks = chunks.filter(c => c.metadata.type.includes('controller'));
    const serviceChunks = chunks.filter(c => c.metadata.type.includes('service'));
    const repositoryChunks = chunks.filter(c => c.metadata.type.includes('repository'));
    const configChunks = chunks.filter(c => c.metadata.type.includes('configuration'));
    
    if (controllerChunks.length > 0) {
      layers.push({
        name: 'Presentation Layer',
        level: 1,
        components: controllerChunks.map(c => c.metadata.name || c.id),
        responsibilities: ['Handle HTTP requests', 'Input validation', 'Response formatting'],
        dependencies: ['Business Layer']
      });
    }
    
    if (serviceChunks.length > 0) {
      layers.push({
        name: 'Business Layer',
        level: 2,
        components: serviceChunks.map(c => c.metadata.name || c.id),
        responsibilities: ['Business logic', 'Transaction management', 'Data processing'],
        dependencies: ['Data Layer']
      });
    }
    
    if (repositoryChunks.length > 0) {
      layers.push({
        name: 'Data Layer',
        level: 3,
        components: repositoryChunks.map(c => c.metadata.name || c.id),
        responsibilities: ['Data persistence', 'Query execution', 'Data mapping'],
        dependencies: ['Database']
      });
    }
    
    if (configChunks.length > 0) {
      layers.push({
        name: 'Configuration Layer',
        level: 0,
        components: configChunks.map(c => c.metadata.name || c.id),
        responsibilities: ['Application configuration', 'Dependency injection', 'Environment setup'],
        dependencies: []
      });
    }
    
    return {
      architecturalPatterns: [],
      layerStructure: layers,
      componentGroups: [],
      dataFlow: [],
      hotspots: [],
      frameworkSpecificPatterns: []
    };
  }
  
  private getComponentLayer(chunk: ContentChunk, layers: LayerInfo[]): string {
    for (const layer of layers) {
      if (layer.components.includes(chunk.metadata.name || chunk.id)) {
        return layer.name;
      }
    }
    return 'Unknown';
  }
  
  private getPlantUMLComponentType(type: string): string {
    if (type.includes('controller')) return 'component';
    if (type.includes('service')) return 'component';
    if (type.includes('repository')) return 'database';
    if (type.includes('configuration')) return 'node';
    return 'component';
  }
  
  private getGraphvizNodeColor(type: string): string {
    const colors: Record<string, string> = {
      'controller': 'lightblue',
      'service': 'lightgreen',
      'repository': 'lightyellow',
      'configuration': 'lightgray',
      'entity': 'lightcoral',
      'model': 'lightcoral'
    };
    
    for (const [key, color] of Object.entries(colors)) {
      if (type.includes(key)) return color;
    }
    return 'white';
  }
  
  private getD3JSStyling(options?: DiagramOptions) {
    return {
      nodes: {
        fill: options?.nodeColors || {},
        stroke: '#333',
        strokeWidth: 2
      },
      links: {
        stroke: '#666',
        strokeWidth: 1,
        opacity: 0.6
      },
      labels: {
        fontSize: 12,
        fontFamily: 'Arial, sans-serif'
      }
    };
  }
  
  private generateMermaidStyling(options?: DiagramOptions): string {
    if (!options?.nodeColors) return '';
    
    let styling = '\n';
    Object.entries(options.nodeColors).forEach(([type, color]) => {
      const className = type.replace(/\s+/g, '_').toLowerCase();
      styling += `    classDef ${className} fill:${color}\n`;
    });
    
    return styling;
  }
  
  private addArchitecturalDependencies(diagram: string, chunks: ContentChunk[], analysis: StructureAnalysis, options?: DiagramOptions): void {
    // Add dependencies between layers
    for (let i = 0; i < analysis.layerStructure.length - 1; i++) {
      const currentLayer = analysis.layerStructure[i];
      const nextLayer = analysis.layerStructure[i + 1];
      
      if (currentLayer.dependencies.includes(nextLayer.name)) {
        const currentLayerId = this.sanitizeId(currentLayer.name);
        const nextLayerId = this.sanitizeId(nextLayer.name);
        diagram += `    ${currentLayerId} --> ${nextLayerId}\n`;
      }
    }
  }
  
  private addPlantUMLArchitecturalRelationships(diagram: string, chunks: ContentChunk[], analysis: StructureAnalysis): void {
    chunks.forEach(chunk => {
      chunk.dependencies.forEach(dep => {
        const targetChunk = chunks.find(c => c.metadata.name === dep);
        if (targetChunk) {
          diagram += `${chunk.metadata.name} --> ${targetChunk.metadata.name}\n`;
        }
      });
    });
  }
  
  private sanitizeId(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
  }
  
  private extractSources(chunks: ContentChunk[]): string[] {
    return [...new Set(chunks.map(chunk => chunk.id.split('_')[0]))].slice(0, 10);
  }
}

class ClassDiagramGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    // Check if specific format is requested, default to Mermaid for better web compatibility
    const format = request.parameters.format === 'plantuml' ? OutputFormat.PlantUML : OutputFormat.Mermaid;
    const content = format === OutputFormat.PlantUML 
      ? this.generatePlantUMLClassDiagram(request.context.availableChunks)
      : this.generateMermaidClassDiagram(request.context.availableChunks);
    
    const metadata = this.createBaseMetadata(OutputType.ClassDiagram, format);
    return { content, metadata };
  }
  
  private generateMermaidClassDiagram(chunks: ContentChunk[]): string {
    let diagram = 'classDiagram\n';
    
    // Filter for actual class-related chunks
    const classChunks = chunks.filter(c => 
      c.chunkType.toString().includes('class') || 
      c.metadata.type.includes('class') ||
      c.metadata.type.includes('entity') ||
      c.content.includes('class ') ||
      c.content.includes('public class') ||
      c.content.includes('interface ')
    );

    if (classChunks.length === 0) {
      return 'classDiagram\n    note "No classes found in the analyzed code"';
    }

    const processedClasses = new Set<string>();
    
    classChunks.forEach(chunk => {
      const classInfo = this.extractClassInfo(chunk);
      if (classInfo && !processedClasses.has(classInfo.name)) {
        processedClasses.add(classInfo.name);
        
        // Add class definition
        diagram += `    class ${classInfo.name} {\n`;
        
        // Add fields
        classInfo.fields.forEach(field => {
          const visibility = this.getVisibilitySymbol(field.visibility);
          diagram += `        ${visibility}${field.type} ${field.name}\n`;
        });
        
        // Add methods
        classInfo.methods.forEach(method => {
          const visibility = this.getVisibilitySymbol(method.visibility);
          const params = method.parameters.map(p => `${p.type} ${p.name}`).join(', ');
          diagram += `        ${visibility}${method.name}(${params}) ${method.returnType}\n`;
        });
        
        diagram += '    }\n';
        
        // Add annotations as notes
        if (classInfo.annotations.length > 0) {
          diagram += `    ${classInfo.name} : <<${classInfo.annotations.join(', ')}>>\n`;
        }
      }
    });
    
    // Add relationships
    this.addClassRelationships(diagram, classChunks, processedClasses);
    
    return diagram;
  }
  
  private generatePlantUMLClassDiagram(chunks: ContentChunk[]): string {
    let diagram = '@startuml\n!theme plain\n\n';
    
    const classChunks = chunks.filter(c => 
      c.chunkType.toString().includes('class') || 
      c.metadata.type.includes('class') ||
      c.metadata.type.includes('entity') ||
      c.content.includes('class ') ||
      c.content.includes('public class') ||
      c.content.includes('interface ')
    );

    if (classChunks.length === 0) {
      return '@startuml\nnote top : No classes found in the analyzed code\n@enduml';
    }

    const processedClasses = new Set<string>();
    
    classChunks.forEach(chunk => {
      const classInfo = this.extractClassInfo(chunk);
      if (classInfo && !processedClasses.has(classInfo.name)) {
        processedClasses.add(classInfo.name);
        
        // Add class definition
        const classType = classInfo.isInterface ? 'interface' : 'class';
        diagram += `${classType} ${classInfo.name} {\n`;
        
        // Add fields
        classInfo.fields.forEach(field => {
          diagram += `  ${field.visibility} ${field.type} ${field.name}\n`;
        });
        
        // Add separator if both fields and methods exist
        if (classInfo.fields.length > 0 && classInfo.methods.length > 0) {
          diagram += '  --\n';
        }
        
        // Add methods
        classInfo.methods.forEach(method => {
          const params = method.parameters.map(p => `${p.name}: ${p.type}`).join(', ');
          diagram += `  ${method.visibility} ${method.name}(${params}): ${method.returnType}\n`;
        });
        
        diagram += '}\n\n';
        
        // Add annotations as stereotypes
        if (classInfo.annotations.length > 0) {
          classInfo.annotations.forEach(annotation => {
            diagram += `${classInfo.name} <<${annotation}>>\n`;
          });
        }
      }
    });
    
    // Add relationships (PlantUML format)
    this.addPlantUMLRelationships(diagram, classChunks, processedClasses);
    
    diagram += '\n@enduml';
    return diagram;
  }
  
  private extractClassInfo(chunk: ContentChunk): ClassInfo | null {
    const content = chunk.content;
    const classInfo: ClassInfo = {
      name: '',
      fields: [],
      methods: [],
      annotations: [],
      isInterface: false,
      superClass: '',
      interfaces: []
    };
    
    // Extract class name
    const classMatch = content.match(/(?:public\s+)?(?:class|interface)\s+(\w+)/);
    if (!classMatch) {
      // Try to get from metadata if regex fails
      classInfo.name = chunk.metadata.name || 'UnknownClass';
    } else {
      classInfo.name = classMatch[1];
    }
    
    // Check if it's an interface
    classInfo.isInterface = content.includes('interface ');
    
    // Extract annotations
    const annotationMatches = content.match(/@\w+(\([^)]*\))?/g);
    if (annotationMatches) {
      classInfo.annotations = annotationMatches.map(ann => ann.replace(/[@()]/g, ''));
    }
    
    // Extract fields
    const fieldMatches = content.match(/(private|public|protected)?\s*(\w+)\s+(\w+)\s*[;=]/g);
    if (fieldMatches) {
      fieldMatches.forEach(fieldMatch => {
        const parts = fieldMatch.trim().split(/\s+/);
        if (parts.length >= 2) {
          const visibility = ['private', 'public', 'protected'].includes(parts[0]) ? parts[0] : 'package';
          const type = parts.length >= 3 ? parts[parts.length - 2] : parts[0];
          const name = parts[parts.length - 1].replace(/[;=].*/, '');
          
          classInfo.fields.push({
            name: name,
            type: type,
            visibility: visibility
          });
        }
      });
    }
    
    // Extract methods
    const methodMatches = content.match(/(private|public|protected)?\s*\w+\s+(\w+)\s*\([^)]*\)\s*\{/g);
    if (methodMatches) {
      methodMatches.forEach(methodMatch => {
        const match = methodMatch.match(/(private|public|protected)?\s*(\w+)\s+(\w+)\s*\(([^)]*)\)/);
        if (match) {
          const visibility = match[1] || 'package';
          const returnType = match[2];
          const methodName = match[3];
          const paramString = match[4];
          
          const parameters: Parameter[] = [];
          if (paramString.trim()) {
            const params = paramString.split(',');
            params.forEach(param => {
              const paramParts = param.trim().split(/\s+/);
              if (paramParts.length >= 2) {
                parameters.push({
                  name: paramParts[paramParts.length - 1],
                  type: paramParts[paramParts.length - 2]
                });
              }
            });
          }
          
          classInfo.methods.push({
            name: methodName,
            returnType: returnType,
            visibility: visibility,
            parameters: parameters
          });
        }
      });
    }
    
    return classInfo.name ? classInfo : null;
  }
  
  private getVisibilitySymbol(visibility: string): string {
    switch (visibility) {
      case 'public': return '+';
      case 'private': return '-';
      case 'protected': return '#';
      default: return '~';
    }
  }
  
  private addClassRelationships(diagram: string, chunks: ContentChunk[], processedClasses: Set<string>): string {
    // Simple relationship detection based on dependencies and imports
    chunks.forEach(chunk => {
      const classInfo = this.extractClassInfo(chunk);
      if (!classInfo) return;
      
      // Look for extends/implements relationships
      const extendsMatch = chunk.content.match(/extends\s+(\w+)/);
      if (extendsMatch && processedClasses.has(extendsMatch[1])) {
        diagram += `    ${extendsMatch[1]} <|-- ${classInfo.name}\n`;
      }
      
      const implementsMatches = chunk.content.match(/implements\s+([\w\s,]+)/);
      if (implementsMatches) {
        const interfaces = implementsMatches[1].split(',').map(i => i.trim());
        interfaces.forEach(interfaceName => {
          if (processedClasses.has(interfaceName)) {
            diagram += `    ${interfaceName} <|.. ${classInfo.name}\n`;
          }
        });
      }
      
      // Look for composition relationships (has-a)
      chunk.dependencies.forEach(dep => {
        const depClassName = dep.split('.').pop();
        if (depClassName && processedClasses.has(depClassName) && depClassName !== classInfo.name) {
          diagram += `    ${classInfo.name} --> ${depClassName}\n`;
        }
      });
    });
    
    return diagram;
  }
  
  private addPlantUMLRelationships(diagram: string, chunks: ContentChunk[], processedClasses: Set<string>): string {
    chunks.forEach(chunk => {
      const classInfo = this.extractClassInfo(chunk);
      if (!classInfo) return;
      
      // Inheritance relationships
      const extendsMatch = chunk.content.match(/extends\s+(\w+)/);
      if (extendsMatch && processedClasses.has(extendsMatch[1])) {
        diagram += `${extendsMatch[1]} <|-- ${classInfo.name}\n`;
      }
      
      // Interface implementation
      const implementsMatches = chunk.content.match(/implements\s+([\w\s,]+)/);
      if (implementsMatches) {
        const interfaces = implementsMatches[1].split(',').map(i => i.trim());
        interfaces.forEach(interfaceName => {
          if (processedClasses.has(interfaceName)) {
            diagram += `${interfaceName} <|.. ${classInfo.name}\n`;
          }
        });
      }
      
      // Composition relationships
      chunk.dependencies.forEach(dep => {
        const depClassName = dep.split('.').pop();
        if (depClassName && processedClasses.has(depClassName) && depClassName !== classInfo.name) {
          diagram += `${classInfo.name} --> ${depClassName} : uses\n`;
        }
      });
    });
    
    return diagram;
  }
}

interface ClassInfo {
  name: string;
  fields: Field[];
  methods: Method[];
  annotations: string[];
  isInterface: boolean;
  superClass: string;
  interfaces: string[];
}

interface Field {
  name: string;
  type: string;
  visibility: string;
}

interface Method {
  name: string;
  returnType: string;
  visibility: string;
  parameters: Parameter[];
}

interface Parameter {
  name: string;
  type: string;
}

// Advanced Structure Analysis Engine
class StructureAnalyzer {
  async analyze(
    chunks: ContentChunk[],
    workspaceEnvironment: WorkspaceEnvironment,
    codeGraph?: CodeGraph
  ): Promise<StructureAnalysis> {
    console.log('🔍 Performing comprehensive structure analysis...');
    
    const architecturalPatterns = await this.identifyArchitecturalPatterns(chunks, workspaceEnvironment);
    const layerStructure = await this.analyzeLayerStructure(chunks, codeGraph);
    const componentGroups = await this.groupComponents(chunks);
    const dataFlow = await this.analyzeDataFlow(chunks, codeGraph);
    const hotspots = await this.identifyHotspots(chunks);
    const frameworkPatterns = await this.analyzeFrameworkPatterns(chunks, workspaceEnvironment);
    
    return {
      architecturalPatterns,
      layerStructure,
      componentGroups,
      dataFlow,
      hotspots,
      frameworkSpecificPatterns: frameworkPatterns
    };
  }
  
  private async identifyArchitecturalPatterns(
    chunks: ContentChunk[],
    workspaceEnvironment: WorkspaceEnvironment
  ): Promise<ArchitecturalPattern[]> {
    const patterns: ArchitecturalPattern[] = [];
    
    // MVC Pattern
    const mvcPattern = this.detectMVCPattern(chunks);
    if (mvcPattern.confidence > 0.6) {
      patterns.push(mvcPattern);
    }
    
    // Layered Architecture
    const layeredPattern = this.detectLayeredArchitecture(chunks);
    if (layeredPattern.confidence > 0.6) {
      patterns.push(layeredPattern);
    }
    
    // Repository Pattern
    const repositoryPattern = this.detectRepositoryPattern(chunks);
    if (repositoryPattern.confidence > 0.7) {
      patterns.push(repositoryPattern);
    }
    
    return patterns;
  }
  
  private detectMVCPattern(chunks: ContentChunk[]): ArchitecturalPattern {
    const controllers = chunks.filter(c => this.isController(c));
    const models = chunks.filter(c => this.isModel(c));
    const views = chunks.filter(c => this.isView(c));
    
    const hasControllers = controllers.length > 0;
    const hasModels = models.length > 0;
    const hasViews = views.length > 0;
    
    let confidence = 0;
    if (hasControllers) confidence += 0.4;
    if (hasModels) confidence += 0.4;
    if (hasViews) confidence += 0.2;
    
    return {
      name: 'Model-View-Controller (MVC)',
      confidence,
      components: [
        ...controllers.map(c => c.metadata.name || c.id),
        ...models.map(c => c.metadata.name || c.id),
        ...views.map(c => c.metadata.name || c.id)
      ],
      description: 'Separates application into three interconnected components',
      benefits: ['Clear separation of concerns', 'Parallel development', 'Multiple views for same model'],
      tradeoffs: ['Increased complexity', 'Tight coupling between view and controller']
    };
  }
  
  private detectLayeredArchitecture(chunks: ContentChunk[]): ArchitecturalPattern {
    const presentationLayer = chunks.filter(c => this.isPresentationLayer(c));
    const businessLayer = chunks.filter(c => this.isBusinessLayer(c));
    const dataLayer = chunks.filter(c => this.isDataLayer(c));
    
    const hasLayers = [presentationLayer, businessLayer, dataLayer].filter(layer => layer.length > 0).length;
    const confidence = hasLayers >= 2 ? 0.7 + (hasLayers - 2) * 0.15 : 0.3;
    
    return {
      name: 'Layered Architecture',
      confidence,
      components: [
        ...presentationLayer.map(c => c.metadata.name || c.id),
        ...businessLayer.map(c => c.metadata.name || c.id),
        ...dataLayer.map(c => c.metadata.name || c.id)
      ],
      description: 'Organizes system into horizontal layers with defined responsibilities',
      benefits: ['Clear separation', 'Easy to understand', 'Technology flexibility'],
      tradeoffs: ['Performance overhead', 'Can become rigid']
    };
  }
  
  private detectRepositoryPattern(chunks: ContentChunk[]): ArchitecturalPattern {
    const repositories = chunks.filter(c => this.isRepository(c));
    const entities = chunks.filter(c => this.isEntity(c));
    
    const hasRepositories = repositories.length > 0;
    const hasEntities = entities.length > 0;
    
    let confidence = 0;
    if (hasRepositories) confidence += 0.5;
    if (hasEntities) confidence += 0.3;
    
    return {
      name: 'Repository Pattern',
      confidence,
      components: [...repositories.map(c => c.metadata.name || c.id), ...entities.map(c => c.metadata.name || c.id)],
      description: 'Encapsulates data access logic',
      benefits: ['Centralized data access', 'Testability', 'Separation of concerns'],
      tradeoffs: ['Additional abstraction', 'Potential over-engineering']
    };
  }
  
  private async analyzeLayerStructure(chunks: ContentChunk[], codeGraph?: CodeGraph): Promise<LayerInfo[]> {
    const layers: LayerInfo[] = [];
    
    // Presentation Layer
    const presentationComponents = chunks.filter(c => this.isPresentationLayer(c));
    if (presentationComponents.length > 0) {
      layers.push({
        name: 'Presentation Layer',
        level: 1,
        components: presentationComponents.map(c => c.metadata.name || c.id),
        responsibilities: ['User interface', 'Input validation', 'Request processing'],
        dependencies: ['Business Layer']
      });
    }
    
    // Business Layer
    const businessComponents = chunks.filter(c => this.isBusinessLayer(c));
    if (businessComponents.length > 0) {
      layers.push({
        name: 'Business Layer',
        level: 2,
        components: businessComponents.map(c => c.metadata.name || c.id),
        responsibilities: ['Business logic', 'Transaction management', 'Workflow coordination'],
        dependencies: ['Data Access Layer']
      });
    }
    
    // Data Access Layer
    const dataComponents = chunks.filter(c => this.isDataLayer(c));
    if (dataComponents.length > 0) {
      layers.push({
        name: 'Data Access Layer',
        level: 3,
        components: dataComponents.map(c => c.metadata.name || c.id),
        responsibilities: ['Data persistence', 'Query execution', 'Data mapping'],
        dependencies: ['Database']
      });
    }
    
    return layers.sort((a, b) => a.level - b.level);
  }
  
  private async groupComponents(chunks: ContentChunk[]): Promise<ComponentGroup[]> {
    const groups: ComponentGroup[] = [];
    
    // Group by type
    const typeGroups = this.groupByType(chunks);
    groups.push(...typeGroups);
    
    return groups;
  }
  
  private async analyzeDataFlow(chunks: ContentChunk[], codeGraph?: CodeGraph): Promise<DataFlowPath[]> {
    const dataFlows: DataFlowPath[] = [];
    
    // Analyze flow between layers
    const controllers = chunks.filter(c => this.isController(c));
    const services = chunks.filter(c => this.isBusinessLayer(c));
    
    // Controller -> Service flows
    controllers.forEach(controller => {
      const relatedServices = this.findRelatedComponents(controller, services);
      relatedServices.forEach(service => {
        dataFlows.push({
          source: controller.metadata.name || controller.id,
          target: service.metadata.name || service.id,
          dataType: 'Request Data',
          operations: ['Validation', 'Transformation'],
          direction: 'unidirectional'
        });
      });
    });
    
    return dataFlows;
  }
  
  private async identifyHotspots(chunks: ContentChunk[]): Promise<ComponentHotspot[]> {
    const hotspots: ComponentHotspot[] = [];
    
    chunks.forEach(chunk => {
      const issues: string[] = [];
      const recommendations: string[] = [];
      
      // High complexity
      if (chunk.metadata.complexity > 8) {
        issues.push('High complexity detected');
        recommendations.push('Consider breaking down into smaller components');
      }
      
      // Too many dependencies
      if (chunk.dependencies.length > 10) {
        issues.push('High number of dependencies');
        recommendations.push('Review dependencies and consider dependency injection');
      }
      
      if (issues.length > 0) {
        hotspots.push({
          component: chunk.metadata.name || chunk.id,
          issues,
          complexity: chunk.metadata.complexity,
          importance: chunk.metadata.importance,
          recommendations
        });
      }
    });
    
    return hotspots.sort((a, b) => (b.complexity + b.importance) - (a.complexity + a.importance));
  }
  
  private async analyzeFrameworkPatterns(
    chunks: ContentChunk[],
    workspaceEnvironment: WorkspaceEnvironment
  ): Promise<FrameworkPattern[]> {
    return [];
  }
  
  // Helper methods
  private isController(chunk: ContentChunk): boolean {
    return chunk.metadata.type.includes('controller') ||
           chunk.metadata.annotations.some(a => a.includes('Controller'));
  }
  
  private isModel(chunk: ContentChunk): boolean {
    return chunk.metadata.type.includes('model') ||
           chunk.metadata.type.includes('entity');
  }
  
  private isView(chunk: ContentChunk): boolean {
    return chunk.metadata.type.includes('view') ||
           chunk.metadata.type.includes('template');
  }
  
  private isPresentationLayer(chunk: ContentChunk): boolean {
    return this.isController(chunk) || this.isView(chunk);
  }
  
  private isBusinessLayer(chunk: ContentChunk): boolean {
    return chunk.metadata.type.includes('service') ||
           chunk.metadata.annotations.some(a => a.includes('Service'));
  }
  
  private isDataLayer(chunk: ContentChunk): boolean {
    return this.isRepository(chunk) ||
           chunk.metadata.type.includes('dao');
  }
  
  private isRepository(chunk: ContentChunk): boolean {
    return chunk.metadata.type.includes('repository') ||
           chunk.metadata.annotations.some(a => a.includes('Repository'));
  }
  
  private isEntity(chunk: ContentChunk): boolean {
    return chunk.metadata.type.includes('entity') ||
           chunk.metadata.annotations.some(a => a.includes('Entity'));
  }
  
  private findRelatedComponents(source: ContentChunk, candidates: ContentChunk[]): ContentChunk[] {
    const sourceName = source.metadata.name?.toLowerCase() || '';
    const baseEntityName = sourceName.replace(/(controller|service|repository)$/i, '');
    
    return candidates.filter(candidate => {
      const candidateName = candidate.metadata.name?.toLowerCase() || '';
      return candidateName.includes(baseEntityName) || 
             source.dependencies.some(dep => dep.toLowerCase().includes(candidateName));
    }).slice(0, 2);
  }
  
  private groupByType(chunks: ContentChunk[]): ComponentGroup[] {
    const typeMap = new Map<string, ContentChunk[]>();
    
    chunks.forEach(chunk => {
      const type = chunk.metadata.type;
      if (!typeMap.has(type)) {
        typeMap.set(type, []);
      }
      typeMap.get(type)!.push(chunk);
    });
    
    return Array.from(typeMap.entries())
      .filter(([, components]) => components.length > 1)
      .map(([type, components]) => ({
        name: type,
        type: 'module' as const,
        components: components.map(c => c.metadata.name || c.id),
        cohesion: 0.8, // Simplified
        coupling: 0.3  // Simplified
      }));
  }
}

// Diagram Optimization Engine
class DiagramOptimizer {
  async optimize(
    diagramContent: string,
    format: OutputFormat,
    options: DiagramOptions
  ): Promise<string> {
    console.log('🎨 Optimizing diagram with advanced algorithms...');
    
    switch (format) {
      case OutputFormat.Mermaid:
        return this.optimizeMermaidDiagram(diagramContent, options);
      case OutputFormat.PlantUML:
        return this.optimizePlantUMLDiagram(diagramContent, options);
      default:
        return diagramContent;
    }
  }
  
  private optimizeMermaidDiagram(content: string, options: DiagramOptions): string {
    let optimized = content;
    
    // Apply layout optimizations
    if (options.layoutDirection) {
      optimized = optimized.replace(/graph\s+\w+/, `graph ${options.layoutDirection}`);
    }
    
    // Apply visual themes
    optimized = this.applyMermaidTheme(optimized, options);
    
    return optimized;
  }
  
  private optimizePlantUMLDiagram(content: string, options: DiagramOptions): string {
    let optimized = content;
    
    // Add skinparams for better visualization
    optimized = this.addPlantUMLSkinParams(optimized, options);
    
    return optimized;
  }
  
  private applyMermaidTheme(content: string, options: DiagramOptions): string {
    if (!options.nodeColors) return content;
    
    let styled = content;
    styled += '\n\n%% Theme styling\n';
    Object.entries(options.nodeColors).forEach(([type, color]) => {
      const className = type.replace(/\s+/g, '_').toLowerCase();
      styled += `classDef ${className} fill:${color},stroke:#333,stroke-width:2px;\n`;
    });
    
    return styled;
  }
  
  private addPlantUMLSkinParams(content: string, options: DiagramOptions): string {
    const skinParams = `
skinparam backgroundColor white
skinparam defaultFontName Arial
skinparam defaultFontSize 12
`;
    
    return content.replace('@startuml', `@startuml${skinParams}`);
  }
}

// Interactive Elements Engine
class InteractivityEngine {
  async enhance(
    attachments: OutputAttachment[],
    structureAnalysis?: StructureAnalysis
  ): Promise<OutputAttachment[]> {
    console.log('⚡ Adding interactive elements to diagrams...');
    
    return attachments.map(attachment => {
      if (attachment.type === 'diagram') {
        return {
          ...attachment,
          type: 'interactive' as const,
          interactiveElements: this.generateInteractiveElements(attachment, structureAnalysis),
          metadata: {
            generationTime: Date.now(),
            algorithmsUsed: ['structure-analysis', 'hotspot-detection'],
            optimizations: ['tooltip-positioning', 'lazy-loading'],
            interactivityLevel: 'advanced' as const,
            accessibilityFeatures: ['keyboard-navigation', 'screen-reader-support']
          }
        };
      }
      return attachment;
    });
  }
  
  private generateInteractiveElements(
    attachment: OutputAttachment,
    structureAnalysis?: StructureAnalysis
  ): InteractiveElement[] {
    const elements: InteractiveElement[] = [];
    
    // Add tooltips for complex components
    if (structureAnalysis?.hotspots) {
      structureAnalysis.hotspots.forEach((hotspot, index) => {
        elements.push({
          id: `hotspot-${index}`,
          type: 'tooltip',
          target: hotspot.component,
          action: 'hover',
          content: this.generateHotspotTooltip(hotspot)
        });
      });
    }
    
    return elements;
  }
  
  private generateHotspotTooltip(hotspot: ComponentHotspot): string {
    return `
      <div class="hotspot-tooltip">
        <h4>⚠️ ${hotspot.component}</h4>
        <div class="metrics">
          <span class="complexity">Complexity: ${hotspot.complexity}/10</span>
          <span class="importance">Importance: ${hotspot.importance.toFixed(2)}</span>
        </div>
        <div class="issues">
          <h5>Issues:</h5>
          <ul>
            ${hotspot.issues.map(issue => `<li>${issue}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }
}

class SequenceDiagramGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const content = this.generateSequenceDiagram(request.context.availableChunks);
    const metadata = this.createBaseMetadata(OutputType.SequenceDiagram, OutputFormat.Mermaid);
    return { content, metadata };
  }
  
  private generateSequenceDiagram(chunks: ContentChunk[]): string {
    let diagram = 'sequenceDiagram\n';
    diagram += '    Client->>+Controller: Request\n';
    diagram += '    Controller->>+Service: Process\n';
    diagram += '    Service->>+Repository: Data\n';
    diagram += '    Repository-->>-Service: Response\n';
    diagram += '    Service-->>-Controller: Result\n';
    diagram += '    Controller-->>-Client: Response\n';
    return diagram;
  }
}

class CodeAnalysisReportGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const { context } = request;
    
    let content = '# Code Analysis Report\n\n';
    content += this.generateCodeMetrics(context.availableChunks);
    content += '\n\n';
    content += this.generateComplexityAnalysis(context.availableChunks);
    content += '\n\n';
    content += this.generateQualityMetrics(context.availableChunks);
    
    const metadata = this.createBaseMetadata(OutputType.CodeAnalysisReport, OutputFormat.Markdown);
    metadata.sections = this.extractSections(content);
    
    return { content, metadata };
  }
  
  private generateCodeMetrics(chunks: ContentChunk[]): string {
    const totalChunks = chunks.length;
    const avgComplexity = chunks.reduce((sum, chunk) => sum + chunk.metadata.complexity, 0) / totalChunks;
    const avgImportance = chunks.reduce((sum, chunk) => sum + chunk.metadata.importance, 0) / totalChunks;
    
    let metrics = '## Code Metrics\n\n';
    metrics += `- **Total Components**: ${totalChunks}\n`;
    metrics += `- **Average Complexity**: ${avgComplexity.toFixed(2)}/10\n`;
    metrics += `- **Average Importance**: ${avgImportance.toFixed(2)}\n`;
    
    return metrics;
  }
  
  private generateComplexityAnalysis(chunks: ContentChunk[]): string {
    let analysis = '## Complexity Analysis\n\n';
    
    const highComplexityChunks = chunks.filter(c => c.metadata.complexity > 7);
    const mediumComplexityChunks = chunks.filter(c => c.metadata.complexity >= 4 && c.metadata.complexity <= 7);
    const lowComplexityChunks = chunks.filter(c => c.metadata.complexity < 4);
    
    analysis += `- **High Complexity (8-10)**: ${highComplexityChunks.length} components\n`;
    analysis += `- **Medium Complexity (4-7)**: ${mediumComplexityChunks.length} components\n`;
    analysis += `- **Low Complexity (1-3)**: ${lowComplexityChunks.length} components\n\n`;
    
    if (highComplexityChunks.length > 0) {
      analysis += '### High Complexity Components\n\n';
      highComplexityChunks.slice(0, 5).forEach(chunk => {
        analysis += `- **${chunk.metadata.name}**: Complexity ${chunk.metadata.complexity}/10\n`;
      });
    }
    
    return analysis;
  }
  
  private generateQualityMetrics(chunks: ContentChunk[]): string {
    let quality = '## Quality Metrics\n\n';
    
    const componentsWithTests = chunks.filter(c => c.metadata.type.includes('test')).length;
    const totalComponents = chunks.filter(c => !c.metadata.type.includes('test')).length;
    const testCoverage = totalComponents > 0 ? (componentsWithTests / totalComponents) * 100 : 0;
    
    quality += `- **Estimated Test Coverage**: ${testCoverage.toFixed(1)}%\n`;
    quality += `- **Components with Documentation**: ${this.countDocumentedComponents(chunks)}\n`;
    quality += `- **Framework Compliance**: ${this.assessFrameworkCompliance(chunks)}%\n`;
    
    return quality;
  }
  
  private countDocumentedComponents(chunks: ContentChunk[]): number {
    return chunks.filter(c => 
      c.content.includes('/**') || 
      c.content.includes('"""') || 
      c.content.includes('///')
    ).length;
  }
  
  private assessFrameworkCompliance(chunks: ContentChunk[]): number {
    // Simple compliance assessment based on annotations and patterns
    const compliantChunks = chunks.filter(c => 
      c.metadata.annotations.length > 0 || 
      c.patterns.length > 0
    ).length;
    
    return chunks.length > 0 ? Math.round((compliantChunks / chunks.length) * 100) : 0;
  }
}

// Additional specialized generators for other output types...
class SecurityAssessmentGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const content = '# Security Assessment\n\nGenerated security assessment...';
    const metadata = this.createBaseMetadata(OutputType.SecurityAssessment, OutputFormat.Markdown);
    return { content, metadata };
  }
}

class PerformanceReportGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const content = '# Performance Report\n\nGenerated performance report...';
    const metadata = this.createBaseMetadata(OutputType.PerformanceReport, OutputFormat.Markdown);
    return { content, metadata };
  }
}

class TestingGuideGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const content = '# Testing Guide\n\nGenerated testing guide...';
    const metadata = this.createBaseMetadata(OutputType.TestingGuide, OutputFormat.Markdown);
    return { content, metadata };
  }
}

class DeploymentGuideGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const content = '# Deployment Guide\n\nGenerated deployment guide...';
    const metadata = this.createBaseMetadata(OutputType.DeploymentGuide, OutputFormat.Markdown);
    return { content, metadata };
  }
}

class TroubleshootingGuideGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const content = '# Troubleshooting Guide\n\nGenerated troubleshooting guide...';
    const metadata = this.createBaseMetadata(OutputType.TroubleshootingGuide, OutputFormat.Markdown);
    return { content, metadata };
  }
}

// Abstract template base class
abstract class OutputTemplate {
  abstract getTemplate(parameters: OutputParameters): string;
}

// Concrete template implementations
class READMETemplate extends OutputTemplate {
  getTemplate(parameters: OutputParameters): string {
    return `# {{PROJECT_NAME}}

{{DESCRIPTION}}

## Features
{{FEATURES}}

## Installation
{{INSTALLATION}}

## Usage
{{USAGE}}

## Contributing
{{CONTRIBUTING}}

## License
{{LICENSE}}`;
  }
}

class APIDocumentationTemplate extends OutputTemplate {
  getTemplate(parameters: OutputParameters): string {
    return `# API Documentation

## Endpoints
{{ENDPOINTS}}

## Authentication
{{AUTHENTICATION}}

## Error Handling
{{ERROR_HANDLING}}`;
  }
}

class ArchitectureTemplate extends OutputTemplate {
  getTemplate(parameters: OutputParameters): string {
    return `# Architecture Documentation

## Overview
{{OVERVIEW}}

## Components
{{COMPONENTS}}

## Data Flow
{{DATA_FLOW}}`;
  }
}

class SecurityReportTemplate extends OutputTemplate {
  getTemplate(parameters: OutputParameters): string {
    return `# Security Assessment Report

## Executive Summary
{{SUMMARY}}

## Vulnerabilities
{{VULNERABILITIES}}

## Recommendations
{{RECOMMENDATIONS}}`;
  }
}

// Additional diagram generators for new types
class ComponentDiagramGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const { context, parameters } = request;
    const filteredChunks = this.applyFilterCriteria(context.availableChunks, parameters.filterCriteria);
    
    const content = this.generateComponentDiagram(filteredChunks, context.structureAnalysis, parameters.diagramOptions);
    const metadata = this.createBaseMetadata(OutputType.ComponentDiagram, OutputFormat.Mermaid);
    metadata.sources = this.extractSources(filteredChunks);
    
    return { content, metadata };
  }
  
  private generateComponentDiagram(chunks: ContentChunk[], analysis?: StructureAnalysis, options?: DiagramOptions): string {
    let diagram = `graph TD\n`;
    
    // Group components by their functional areas
    const componentGroups = analysis?.componentGroups || this.createBasicGroups(chunks);
    
    componentGroups.forEach((group, groupIndex) => {
      const groupId = `group_${groupIndex}`;
      diagram += `    subgraph ${groupId}["${group.name}"]\n`;
      
      group.components.forEach(compName => {
        const chunk = chunks.find(c => c.metadata.name === compName);
        if (chunk) {
          const compId = this.sanitizeId(compName);
          diagram += `        ${compId}["${compName}"]\n`;
        }
      });
      
      diagram += `    end\n`;
    });
    
    // Add connections between components
    this.addComponentConnections(diagram, chunks);
    
    return diagram;
  }
  
  private createBasicGroups(chunks: ContentChunk[]): ComponentGroup[] {
    const typeGroups = new Map<string, ContentChunk[]>();
    
    chunks.forEach(chunk => {
      const type = chunk.metadata.type;
      if (!typeGroups.has(type)) {
        typeGroups.set(type, []);
      }
      typeGroups.get(type)!.push(chunk);
    });
    
    return Array.from(typeGroups.entries()).map(([type, components]) => ({
      name: type,
      type: 'module' as const,
      components: components.map(c => c.metadata.name || c.id),
      cohesion: 0.8,
      coupling: 0.3
    }));
  }
  
  private addComponentConnections(diagram: string, chunks: ContentChunk[]): void {
    chunks.forEach(chunk => {
      chunk.dependencies.forEach(dep => {
        const targetChunk = chunks.find(c => c.metadata.name === dep);
        if (targetChunk) {
          const sourceId = this.sanitizeId(chunk.metadata.name || chunk.id);
          const targetId = this.sanitizeId(targetChunk.metadata.name || targetChunk.id);
          diagram += `    ${sourceId} --> ${targetId}\n`;
        }
      });
    });
  }
  
  private sanitizeId(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
  }
  
  private extractSources(chunks: ContentChunk[]): string[] {
    return [...new Set(chunks.map(chunk => chunk.id.split('_')[0]))].slice(0, 10);
  }
}

class DataFlowDiagramGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const { context, parameters } = request;
    const filteredChunks = this.applyFilterCriteria(context.availableChunks, parameters.filterCriteria);
    
    const content = this.generateDataFlowDiagram(filteredChunks, context.structureAnalysis);
    const metadata = this.createBaseMetadata(OutputType.DataFlowDiagram, OutputFormat.Mermaid);
    metadata.sources = this.extractSources(filteredChunks);
    
    return { content, metadata };
  }
  
  private generateDataFlowDiagram(chunks: ContentChunk[], analysis?: StructureAnalysis): string {
    let diagram = `flowchart TD\n`;
    
    // External entities
    diagram += `    User[User/Client]\n`;
    diagram += `    DB[(Database)]\n`;
    diagram += `    ExtSys[External Systems]\n\n`;
    
    // Processes
    const processes = chunks.filter(c => 
      c.metadata.type.includes('controller') || 
      c.metadata.type.includes('service')
    );
    
    processes.forEach((process, index) => {
      const processId = `P${index}`;
      const processName = process.metadata.name || `Process${index}`;
      diagram += `    ${processId}["${processName}"]\n`;
    });
    
    // Data flows
    diagram += `\n    %% Data flows\n`;
    diagram += `    User --> P0\n`;
    
    if (processes.length > 1) {
      for (let i = 0; i < processes.length - 1; i++) {
        diagram += `    P${i} --> P${i + 1}\n`;
      }
    }
    
    if (processes.length > 0) {
      diagram += `    P${processes.length - 1} --> DB\n`;
      diagram += `    P0 --> User\n`;
    }
    
    return diagram;
  }
  
  private extractSources(chunks: ContentChunk[]): string[] {
    return [...new Set(chunks.map(chunk => chunk.id.split('_')[0]))].slice(0, 10);
  }
}

class InteractionDiagramGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const { context, parameters } = request;
    const filteredChunks = this.applyFilterCriteria(context.availableChunks, parameters.filterCriteria);
    
    const content = this.generateInteractionDiagram(filteredChunks, context.structureAnalysis);
    const metadata = this.createBaseMetadata(OutputType.InteractionDiagram, OutputFormat.Mermaid);
    metadata.sources = this.extractSources(filteredChunks);
    
    return { content, metadata };
  }
  
  private generateInteractionDiagram(chunks: ContentChunk[], analysis?: StructureAnalysis): string {
    let diagram = `graph LR\n`;
    
    // User interactions
    diagram += `    User((User))\n`;
    
    // UI Components
    const uiComponents = chunks.filter(c => 
      c.metadata.type.includes('controller') ||
      c.metadata.type.includes('view') ||
      c.metadata.type.includes('component')
    );
    
    uiComponents.forEach((component, index) => {
      const compId = `UI${index}`;
      const compName = component.metadata.name || `Component${index}`;
      diagram += `    ${compId}["${compName}"]\n`;
      
      if (index === 0) {
        diagram += `    User --> ${compId}\n`;
      }
    });
    
    // Backend services
    const services = chunks.filter(c => c.metadata.type.includes('service'));
    services.forEach((service, index) => {
      const serviceId = `S${index}`;
      const serviceName = service.metadata.name || `Service${index}`;
      diagram += `    ${serviceId}["${serviceName}"]\n`;
      
      if (uiComponents.length > 0) {
        diagram += `    UI0 --> ${serviceId}\n`;
      }
    });
    
    return diagram;
  }
  
  private extractSources(chunks: ContentChunk[]): string[] {
    return [...new Set(chunks.map(chunk => chunk.id.split('_')[0]))].slice(0, 10);
  }
}

class LayeredArchitectureDiagramGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const { context, parameters } = request;
    const filteredChunks = this.applyFilterCriteria(context.availableChunks, parameters.filterCriteria);
    
    const content = this.generateLayeredDiagram(filteredChunks, context.structureAnalysis);
    const metadata = this.createBaseMetadata(OutputType.LayeredArchitectureDiagram, OutputFormat.Mermaid);
    metadata.sources = this.extractSources(filteredChunks);
    
    return { content, metadata };
  }
  
  private generateLayeredDiagram(chunks: ContentChunk[], analysis?: StructureAnalysis): string {
    let diagram = `graph TD\n`;
    
    const layers = analysis?.layerStructure || this.createBasicLayers(chunks);
    
    layers.forEach((layer, layerIndex) => {
      const layerId = `layer_${layerIndex}`;
      diagram += `    subgraph ${layerId}["${layer.name}"]\n`;
      
      layer.components.forEach((compName, compIndex) => {
        const compId = `L${layerIndex}_C${compIndex}`;
        diagram += `        ${compId}["${compName}"]\n`;
      });
      
      diagram += `    end\n`;
    });
    
    // Add layer dependencies
    for (let i = 0; i < layers.length - 1; i++) {
      const currentLayer = layers[i];
      const nextLayer = layers[i + 1];
      
      if (currentLayer.dependencies.includes(nextLayer.name)) {
        diagram += `    layer_${i} --> layer_${i + 1}\n`;
      }
    }
    
    return diagram;
  }
  
  private createBasicLayers(chunks: ContentChunk[]): LayerInfo[] {
    const layers: LayerInfo[] = [];
    
    const presentationComponents = chunks.filter(c => c.metadata.type.includes('controller'));
    if (presentationComponents.length > 0) {
      layers.push({
        name: 'Presentation Layer',
        level: 1,
        components: presentationComponents.map(c => c.metadata.name || c.id),
        responsibilities: ['User interface', 'Input validation'],
        dependencies: ['Business Layer']
      });
    }
    
    const businessComponents = chunks.filter(c => c.metadata.type.includes('service'));
    if (businessComponents.length > 0) {
      layers.push({
        name: 'Business Layer',
        level: 2,
        components: businessComponents.map(c => c.metadata.name || c.id),
        responsibilities: ['Business logic', 'Transaction management'],
        dependencies: ['Data Layer']
      });
    }
    
    const dataComponents = chunks.filter(c => c.metadata.type.includes('repository'));
    if (dataComponents.length > 0) {
      layers.push({
        name: 'Data Layer',
        level: 3,
        components: dataComponents.map(c => c.metadata.name || c.id),
        responsibilities: ['Data persistence', 'Query execution'],
        dependencies: []
      });
    }
    
    return layers;
  }
  
  private extractSources(chunks: ContentChunk[]): string[] {
    return [...new Set(chunks.map(chunk => chunk.id.split('_')[0]))].slice(0, 10);
  }
}

class DependencyGraphGenerator extends SpecializedGenerator {
  async generate(request: OutputRequest): Promise<GeneratedOutput> {
    const { context, parameters } = request;
    const filteredChunks = this.applyFilterCriteria(context.availableChunks, parameters.filterCriteria);
    
    const format = parameters.format || OutputFormat.Graphviz;
    let content: string;
    
    if (format === OutputFormat.Graphviz) {
      content = this.generateGraphvizDependencyGraph(filteredChunks);
    } else {
      content = this.generateMermaidDependencyGraph(filteredChunks);
    }
    
    const metadata = this.createBaseMetadata(OutputType.DependencyGraph, format);
    metadata.sources = this.extractSources(filteredChunks);
    
    return { content, metadata };
  }
  
  private generateGraphvizDependencyGraph(chunks: ContentChunk[]): string {
    let diagram = `digraph Dependencies {\n`;
    diagram += `    rankdir=LR;\n`;
    diagram += `    node [shape=box, style=filled];\n\n`;
    
    // Add nodes
    chunks.forEach(chunk => {
      const nodeId = this.sanitizeId(chunk.metadata.name || chunk.id);
      const complexity = chunk.metadata.complexity;
      const color = complexity > 7 ? 'red' : complexity > 4 ? 'yellow' : 'lightgreen';
      
      diagram += `    ${nodeId} [label="${chunk.metadata.name || 'Component'}", fillcolor=${color}];\n`;
    });
    
    diagram += `\n`;
    
    // Add edges
    chunks.forEach(chunk => {
      const sourceId = this.sanitizeId(chunk.metadata.name || chunk.id);
      
      chunk.dependencies.forEach(dep => {
        const targetChunk = chunks.find(c => c.metadata.name === dep);
        if (targetChunk) {
          const targetId = this.sanitizeId(targetChunk.metadata.name || targetChunk.id);
          diagram += `    ${sourceId} -> ${targetId};\n`;
        }
      });
    });
    
    diagram += `}`;
    return diagram;
  }
  
  private generateMermaidDependencyGraph(chunks: ContentChunk[]): string {
    let diagram = `graph LR\n`;
    
    // Add nodes with complexity-based styling
    chunks.forEach(chunk => {
      const nodeId = this.sanitizeId(chunk.metadata.name || chunk.id);
      const nodeName = chunk.metadata.name || 'Component';
      const complexity = chunk.metadata.complexity;
      
      if (complexity > 7) {
        diagram += `    ${nodeId}["${nodeName}"]:::high\n`;
      } else if (complexity > 4) {
        diagram += `    ${nodeId}["${nodeName}"]:::medium\n`;
      } else {
        diagram += `    ${nodeId}["${nodeName}"]:::low\n`;
      }
    });
    
    // Add dependencies
    chunks.forEach(chunk => {
      const sourceId = this.sanitizeId(chunk.metadata.name || chunk.id);
      
      chunk.dependencies.forEach(dep => {
        const targetChunk = chunks.find(c => c.metadata.name === dep);
        if (targetChunk) {
          const targetId = this.sanitizeId(targetChunk.metadata.name || targetChunk.id);
          diagram += `    ${sourceId} --> ${targetId}\n`;
        }
      });
    });
    
    // Add styling
    diagram += `\n    classDef high fill:#ff6b6b\n`;
    diagram += `    classDef medium fill:#ffd93d\n`;
    diagram += `    classDef low fill:#6bcf7f\n`;
    
    return diagram;
  }
  
  private sanitizeId(name: string): string {
    return name.replace(/[^a-zA-Z0-9]/g, '_');
  }
  
  private extractSources(chunks: ContentChunk[]): string[] {
    return [...new Set(chunks.map(chunk => chunk.id.split('_')[0]))].slice(0, 10);
  }
}

export { StructureAnalyzer, DiagramOptimizer, InteractivityEngine };