import { VectorDB } from './VectorDB';
import { MicroserviceDetector, MicroserviceArchitecture } from './MicroserviceDetector';
import { FileClassifier } from './FileClassifier';
import { CodeGraph } from './CodeGraph';
import { FrameworkConfigLoader } from '../config/FrameworkConfigLoader';
import { LLMManager } from './LLMManager';
import { ChainOfThoughtEngine } from './ChainOfThoughtEngine';

export interface CodebaseOverview {
  summary: CodebaseSummary;
  architecture: ArchitectureOverview;
  frameworks: FrameworkAnalysis[];
  structure: ProjectStructure;
  codeMetrics: CodeMetrics;
  keyComponents: ComponentAnalysis[];
  dataFlow: DataFlowAnalysis;
  recommendations: Recommendation[];
  insights: CodebaseInsight[];
}

export interface CodebaseSummary {
  projectName: string;
  description: string;
  primaryLanguages: LanguageStats[];
  totalFiles: number;
  totalLines: number;
  estimatedComplexity: 'Low' | 'Medium' | 'High' | 'Very High';
  maturityLevel: 'Prototype' | 'Development' | 'Production' | 'Legacy';
  lastAnalyzed: Date;
}

export interface ArchitectureOverview {
  type: 'Monolith' | 'Microservices' | 'Modular Monolith' | 'Hybrid';
  services: ServiceSummary[];
  layering: ArchitecturalLayer[];
  patterns: ArchitecturalPattern[];
  dependencies: DependencyGraph;
  coupling: CouplingAnalysis;
}

export interface FrameworkAnalysis {
  name: string;
  version?: string;
  confidence: number;
  usage: 'Primary' | 'Secondary' | 'Utility';
  components: string[];
  bestPractices: {
    followed: string[];
    violations: string[];
  };
}

export interface ProjectStructure {
  rootDirectories: DirectoryInfo[];
  organizationPattern: 'By Feature' | 'By Layer' | 'By Component' | 'Mixed';
  configurationFiles: ConfigFile[];
  testStructure: TestStructure;
}

export interface CodeMetrics {
  linesOfCode: LanguageStats[];
  complexity: ComplexityMetrics;
  testCoverage: TestCoverageInfo;
  codeQuality: QualityMetrics;
  maintainability: MaintainabilityIndex;
}

export interface ComponentAnalysis {
  name: string;
  type: 'Service' | 'Module' | 'Library' | 'Component' | 'Utility';
  filePath: string;
  purpose: string;
  dependencies: string[];
  importance: number; // 0-1 scale
  complexity: number;
  lastModified: Date;
}

export interface DataFlowAnalysis {
  entryPoints: EntryPoint[];
  dataTransformations: DataTransformation[];
  persistenceLayer: PersistenceInfo;
  externalIntegrations: ExternalIntegration[];
}

export interface Recommendation {
  category: 'Architecture' | 'Performance' | 'Security' | 'Maintainability' | 'Testing';
  priority: 'High' | 'Medium' | 'Low';
  title: string;
  description: string;
  impact: string;
  effort: 'Low' | 'Medium' | 'High';
  examples?: string[];
}

export interface CodebaseInsight {
  type: 'Pattern' | 'Anomaly' | 'Opportunity' | 'Risk';
  title: string;
  description: string;
  evidence: string[];
  confidence: number;
}

// Supporting interfaces
export interface LanguageStats {
  language: string;
  files: number;
  lines: number;
  percentage: number;
}

export interface ServiceSummary {
  name: string;
  type: string;
  files: number;
  apis: number;
  dependencies: number;
}

export interface ArchitecturalLayer {
  name: string;
  components: string[];
  responsibilities: string[];
}

export interface ArchitecturalPattern {
  name: string;
  confidence: number;
  evidence: string[];
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  cycles: string[][];
}

export interface CouplingAnalysis {
  overall: number; // 0-1 scale
  afferent: { [component: string]: number };
  efferent: { [component: string]: number };
  instability: { [component: string]: number };
}

export interface DirectoryInfo {
  name: string;
  path: string;
  fileCount: number;
  purpose: string;
  subDirectories: string[];
}

export interface ConfigFile {
  name: string;
  type: string;
  purpose: string;
}

export interface TestStructure {
  framework: string;
  coverage: number;
  unitTests: number;
  integrationTests: number;
  e2eTests: number;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  maintainabilityIndex: number;
  technicalDebt: number;
}

export interface TestCoverageInfo {
  overall: number;
  byLanguage: { [language: string]: number };
  uncoveredCriticalPaths: string[];
}

export interface QualityMetrics {
  codeSmells: number;
  duplicateCode: number;
  securityHotspots: number;
  bugs: number;
  vulnerabilities: number;
}

export interface MaintainabilityIndex {
  score: number; // 0-100
  factors: {
    complexity: number;
    linesOfCode: number;
    codeSmells: number;
    testCoverage: number;
  };
}

export interface EntryPoint {
  type: 'HTTP Endpoint' | 'CLI Command' | 'Event Handler' | 'Main Function';
  path: string;
  method?: string;
  description: string;
}

export interface DataTransformation {
  source: string;
  target: string;
  transformationType: string;
  components: string[];
}

export interface PersistenceInfo {
  databases: DatabaseInfo[];
  caching: CacheInfo[];
  fileStorage: FileStorageInfo[];
}

export interface ExternalIntegration {
  name: string;
  type: 'API' | 'Database' | 'Message Queue' | 'File System' | 'Third Party Service';
  purpose: string;
  components: string[];
}

export interface DatabaseInfo {
  type: string;
  name: string;
  entities: string[];
}

export interface CacheInfo {
  type: string;
  purpose: string;
  components: string[];
}

export interface FileStorageInfo {
  type: string;
  purpose: string;
  location: string;
}

export interface DependencyNode {
  id: string;
  name: string;
  type: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: string;
  weight: number;
}

export class CodebaseOverviewGenerator {
  private vectorDB: VectorDB;
  private microserviceDetector: MicroserviceDetector;
  private fileClassifier: FileClassifier;
  private codeGraph: CodeGraph;
  private configLoader: FrameworkConfigLoader;
  private llmManager: LLMManager;
  private chainOfThought: ChainOfThoughtEngine;

  constructor(
    vectorDB: VectorDB,
    llmManager: LLMManager
  ) {
    this.vectorDB = vectorDB;
    this.llmManager = llmManager;
    this.microserviceDetector = new MicroserviceDetector();
    this.fileClassifier = new FileClassifier();
    this.codeGraph = new CodeGraph();
    this.configLoader = FrameworkConfigLoader.getInstance();
    this.chainOfThought = new ChainOfThoughtEngine(llmManager);
  }

  async generateCompleteOverview(projectPath: string): Promise<CodebaseOverview> {
    console.log('🔍 Generating comprehensive codebase overview...');

    try {
      // Get all indexed documents
      const allDocuments = await this.vectorDB.getAllDocuments();
      
      if (allDocuments.length === 0) {
        throw new Error('No indexed documents found. Please index the codebase first.');
      }

      // Parallel analysis for performance
      const [
        summary,
        architecture,
        frameworks,
        structure,
        codeMetrics,
        keyComponents,
        dataFlow
      ] = await Promise.all([
        this.generateCodebaseSummary(allDocuments, projectPath),
        this.analyzeArchitecture(projectPath),
        this.analyzeFrameworks(allDocuments),
        this.analyzeProjectStructure(allDocuments),
        this.calculateCodeMetrics(allDocuments),
        this.identifyKeyComponents(allDocuments),
        this.analyzeDataFlow(allDocuments)
      ]);

      // Generate AI-powered insights and recommendations
      const [recommendations, insights] = await Promise.all([
        this.generateRecommendations(summary, architecture, frameworks, codeMetrics),
        this.generateInsights(allDocuments, architecture, frameworks)
      ]);

      console.log('✅ Codebase overview generated successfully');

      return {
        summary,
        architecture,
        frameworks,
        structure,
        codeMetrics,
        keyComponents,
        dataFlow,
        recommendations,
        insights
      };
    } catch (error) {
      console.error('❌ Failed to generate codebase overview:', error);
      throw error;
    }
  }

  private async generateCodebaseSummary(
    documents: any[], 
    projectPath: string
  ): Promise<CodebaseSummary> {
    // Analyze language distribution
    const languageStats = this.calculateLanguageStats(documents);
    
    // Calculate totals
    const totalFiles = documents.length;
    const totalLines = documents.reduce((sum, doc) => {
      return sum + (doc.content?.split('\n').length || 0);
    }, 0);

    // Estimate complexity based on various factors
    const estimatedComplexity = this.estimateComplexity(documents, languageStats);
    
    // Determine maturity level
    const maturityLevel = await this.assessMaturityLevel(documents, projectPath);

    // Generate project description using AI
    const description = await this.generateProjectDescription(documents, languageStats);

    // Extract project name from path or package.json
    const projectName = await this.extractProjectName(projectPath);

    return {
      projectName,
      description,
      primaryLanguages: languageStats.slice(0, 5), // Top 5 languages
      totalFiles,
      totalLines,
      estimatedComplexity,
      maturityLevel,
      lastAnalyzed: new Date()
    };
  }

  private async analyzeArchitecture(projectPath: string): Promise<ArchitectureOverview> {
    // Detect microservice architecture
    const microserviceArchitecture = await this.microserviceDetector.detectMicroserviceArchitecture(projectPath);
    
    // Determine architecture type
    const type = this.determineArchitectureType(microserviceArchitecture);
    
    // Analyze services
    const services = microserviceArchitecture.services.map(service => ({
      name: service.name,
      type: service.type,
      files: 0, // Would be calculated from actual file analysis
      apis: service.exposedAPIs.length,
      dependencies: service.dependencies.length
    }));

    // Detect architectural layers
    const layering = await this.detectArchitecturalLayers(microserviceArchitecture);
    
    // Identify patterns
    const patterns = await this.identifyArchitecturalPatterns(microserviceArchitecture);
    
    // Build dependency graph
    const dependencies = this.buildDependencyGraph(microserviceArchitecture);
    
    // Calculate coupling metrics
    const coupling = this.calculateCouplingMetrics(microserviceArchitecture);

    return {
      type,
      services,
      layering,
      patterns,
      dependencies,
      coupling
    };
  }

  private async analyzeFrameworks(documents: any[]): Promise<FrameworkAnalysis[]> {
    const frameworkMap = new Map<string, {
      files: string[];
      confidence: number[];
      components: Set<string>;
    }>();

    // Analyze each document for framework indicators
    for (const doc of documents) {
      const filePath = doc.metadata?.filePath || '';
      const content = doc.content || '';
      
      // Detect frameworks using existing logic
      const detectedFrameworks = await this.detectFrameworksInFile(filePath, content);
      
      for (const framework of detectedFrameworks) {
        if (!frameworkMap.has(framework.name)) {
          frameworkMap.set(framework.name, {
            files: [],
            confidence: [],
            components: new Set()
          });
        }
        
        const entry = frameworkMap.get(framework.name)!;
        entry.files.push(filePath);
        entry.confidence.push(framework.confidence);
        entry.components.add(framework.component || 'unknown');
      }
    }

    // Convert to framework analysis
    const frameworks: FrameworkAnalysis[] = [];
    
    for (const [name, data] of frameworkMap) {
      const avgConfidence = data.confidence.reduce((a, b) => a + b, 0) / data.confidence.length;
      const usage = this.determineFrameworkUsage(data.files.length, documents.length);
      
      // Load framework config for best practices analysis
      const frameworkConfig = await this.configLoader.loadIndividualFrameworkConfig(name);
      const bestPractices = await this.analyzeBestPractices(data.files, frameworkConfig);

      frameworks.push({
        name,
        confidence: avgConfidence,
        usage,
        components: [...data.components],
        bestPractices
      });
    }

    return frameworks.sort((a, b) => b.confidence - a.confidence);
  }

  private async analyzeProjectStructure(documents: any[]): Promise<ProjectStructure> {
    // Group files by directory
    const directoryMap = new Map<string, string[]>();
    const configFiles: ConfigFile[] = [];

    for (const doc of documents) {
      const filePath = doc.metadata?.filePath || '';
      const dirPath = filePath.substring(0, filePath.lastIndexOf('/')) || '.';
      
      if (!directoryMap.has(dirPath)) {
        directoryMap.set(dirPath, []);
      }
      directoryMap.get(dirPath)!.push(filePath);

      // Identify config files
      if (this.isConfigFile(filePath)) {
        configFiles.push({
          name: filePath.split('/').pop() || '',
          type: this.getConfigFileType(filePath),
          purpose: this.getConfigFilePurpose(filePath)
        });
      }
    }

    // Analyze root directories
    const rootDirectories = this.analyzeRootDirectories(directoryMap);
    
    // Determine organization pattern
    const organizationPattern = this.determineOrganizationPattern(directoryMap);
    
    // Analyze test structure
    const testStructure = this.analyzeTestStructure(documents);

    return {
      rootDirectories,
      organizationPattern,
      configurationFiles: configFiles,
      testStructure
    };
  }

  private async calculateCodeMetrics(documents: any[]): Promise<CodeMetrics> {
    const languageStats = this.calculateLanguageStats(documents);
    
    // Calculate complexity metrics
    const complexity = await this.calculateComplexityMetrics(documents);
    
    // Analyze test coverage
    const testCoverage = this.analyzeTestCoverage(documents);
    
    // Calculate quality metrics
    const codeQuality = await this.calculateQualityMetrics(documents);
    
    // Calculate maintainability index
    const maintainability = this.calculateMaintainabilityIndex(complexity, testCoverage, codeQuality);

    return {
      linesOfCode: languageStats,
      complexity,
      testCoverage,
      codeQuality,
      maintainability
    };
  }

  private async identifyKeyComponents(documents: any[]): Promise<ComponentAnalysis[]> {
    const components: ComponentAnalysis[] = [];

    for (const doc of documents) {
      const filePath = doc.metadata?.filePath || '';
      const content = doc.content || '';
      
      // Analyze file to determine if it's a key component
      const importance = await this.calculateComponentImportance(filePath, content, documents);
      
      if (importance > 0.5) { // Threshold for key components
        const analysis = await this.analyzeComponent(filePath, content, documents);
        components.push(analysis);
      }
    }

    return components.sort((a, b) => b.importance - a.importance).slice(0, 20); // Top 20 components
  }

  private async analyzeDataFlow(documents: any[]): Promise<DataFlowAnalysis> {
    // Identify entry points
    const entryPoints = await this.identifyEntryPoints(documents);
    
    // Analyze data transformations
    const dataTransformations = await this.analyzeDataTransformations(documents);
    
    // Analyze persistence layer
    const persistenceLayer = await this.analyzePersistenceLayer(documents);
    
    // Identify external integrations
    const externalIntegrations = await this.identifyExternalIntegrations(documents);

    return {
      entryPoints,
      dataTransformations,
      persistenceLayer,
      externalIntegrations
    };
  }

  private async generateRecommendations(
    summary: CodebaseSummary,
    architecture: ArchitectureOverview,
    frameworks: FrameworkAnalysis[],
    metrics: CodeMetrics
  ): Promise<Recommendation[]> {
    const recommendations: Recommendation[] = [];

    // Architecture recommendations
    if (architecture.coupling.overall > 0.7) {
      recommendations.push({
        category: 'Architecture',
        priority: 'High',
        title: 'Reduce System Coupling',
        description: 'The system shows high coupling between components, which can make it difficult to maintain and test.',
        impact: 'Improved maintainability, testability, and system resilience',
        effort: 'High',
        examples: ['Introduce dependency injection', 'Use event-driven architecture', 'Extract shared services']
      });
    }

    // Performance recommendations
    if (metrics.complexity.cyclomaticComplexity > 20) {
      recommendations.push({
        category: 'Performance',
        priority: 'Medium',
        title: 'Refactor Complex Functions',
        description: 'Several functions have high cyclomatic complexity, which can impact performance and maintainability.',
        impact: 'Better performance, easier debugging, and reduced cognitive load',
        effort: 'Medium'
      });
    }

    // Security recommendations
    if (metrics.codeQuality.vulnerabilities > 0) {
      recommendations.push({
        category: 'Security',
        priority: 'High',
        title: 'Address Security Vulnerabilities',
        description: `Found ${metrics.codeQuality.vulnerabilities} security vulnerabilities that need immediate attention.`,
        impact: 'Reduced security risk and compliance with security standards',
        effort: 'Medium'
      });
    }

    // Testing recommendations
    if (metrics.testCoverage.overall < 70) {
      recommendations.push({
        category: 'Testing',
        priority: 'Medium',
        title: 'Improve Test Coverage',
        description: `Current test coverage is ${metrics.testCoverage.overall}%. Aim for at least 80% coverage.`,
        impact: 'Reduced bugs, increased confidence in deployments',
        effort: 'Medium'
      });
    }

    // Framework-specific recommendations
    for (const framework of frameworks) {
      if (framework.bestPractices.violations.length > 0) {
        recommendations.push({
          category: 'Maintainability',
          priority: 'Low',
          title: `Improve ${framework.name} Best Practices`,
          description: `Found ${framework.bestPractices.violations.length} best practice violations in ${framework.name} code.`,
          impact: 'Better code quality and maintainability',
          effort: 'Low',
          examples: framework.bestPractices.violations.slice(0, 3)
        });
      }
    }

    return recommendations.sort((a, b) => {
      const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private async generateInsights(
    documents: any[],
    architecture: ArchitectureOverview,
    frameworks: FrameworkAnalysis[]
  ): Promise<CodebaseInsight[]> {
    const insights: CodebaseInsight[] = [];

    // Use AI to generate insights
    const context = {
      documentCount: documents.length,
      architectureType: architecture.type,
      primaryFrameworks: frameworks.slice(0, 3).map(f => f.name),
      serviceCount: architecture.services.length,
      couplingLevel: architecture.coupling.overall
    };

    const analysisPrompt = `
    Analyze this codebase structure and provide insights:
    
    Context: ${JSON.stringify(context, null, 2)}
    
    Identify patterns, anomalies, opportunities, and risks. Provide specific, actionable insights.
    `;

    try {
      const aiInsights = await this.llmManager.generateResponse(
        analysisPrompt,
        { maxTokens: 1000, temperature: 0.3 }
      );

      // Parse AI response and convert to structured insights
      // This is a simplified version - would need more sophisticated parsing
      const lines = aiInsights.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.includes('Pattern:')) {
          insights.push({
            type: 'Pattern',
            title: line.replace('Pattern:', '').trim(),
            description: 'AI-identified architectural pattern',
            evidence: [],
            confidence: 0.8
          });
        }
        // Add more parsing logic for different types
      }
    } catch (error) {
      console.warn('Failed to generate AI insights:', error);
    }

    // Add rule-based insights
    if (architecture.services.length > 10) {
      insights.push({
        type: 'Opportunity',
        title: 'Consider Service Mesh',
        description: 'With 10+ services, a service mesh could help manage inter-service communication.',
        evidence: [`${architecture.services.length} services detected`],
        confidence: 0.7
      });
    }

    if (frameworks.some(f => f.name.includes('Legacy'))) {
      insights.push({
        type: 'Risk',
        title: 'Legacy Framework Dependencies',
        description: 'Legacy frameworks may pose security and maintenance risks.',
        evidence: frameworks.filter(f => f.name.includes('Legacy')).map(f => f.name),
        confidence: 0.9
      });
    }

    return insights;
  }

  // Helper methods implementation would continue here...
  // Due to length constraints, I'm showing the structure and key methods
  
  private calculateLanguageStats(documents: any[]): LanguageStats[] {
    const languageMap = new Map<string, { files: number; lines: number }>();
    let totalLines = 0;

    for (const doc of documents) {
      const language = doc.metadata?.language || 'unknown';
      const lines = doc.content?.split('\n').length || 0;
      
      if (!languageMap.has(language)) {
        languageMap.set(language, { files: 0, lines: 0 });
      }
      
      const stats = languageMap.get(language)!;
      stats.files++;
      stats.lines += lines;
      totalLines += lines;
    }

    const result: LanguageStats[] = [];
    for (const [language, stats] of languageMap) {
      result.push({
        language,
        files: stats.files,
        lines: stats.lines,
        percentage: totalLines > 0 ? (stats.lines / totalLines) * 100 : 0
      });
    }

    return result.sort((a, b) => b.lines - a.lines);
  }

  private estimateComplexity(documents: any[], languageStats: LanguageStats[]): 'Low' | 'Medium' | 'High' | 'Very High' {
    const totalFiles = documents.length;
    const totalLines = languageStats.reduce((sum, stat) => sum + stat.lines, 0);
    const languageCount = languageStats.length;

    let complexityScore = 0;
    
    // File count factor
    if (totalFiles > 1000) complexityScore += 3;
    else if (totalFiles > 500) complexityScore += 2;
    else if (totalFiles > 100) complexityScore += 1;

    // Lines of code factor
    if (totalLines > 100000) complexityScore += 3;
    else if (totalLines > 50000) complexityScore += 2;
    else if (totalLines > 10000) complexityScore += 1;

    // Language diversity factor
    if (languageCount > 5) complexityScore += 2;
    else if (languageCount > 3) complexityScore += 1;

    if (complexityScore >= 7) return 'Very High';
    if (complexityScore >= 5) return 'High';
    if (complexityScore >= 3) return 'Medium';
    return 'Low';
  }

  private async assessMaturityLevel(documents: any[], projectPath: string): Promise<'Prototype' | 'Development' | 'Production' | 'Legacy'> {
    // Look for production indicators
    const hasDockerfile = documents.some(doc => doc.metadata?.filePath?.includes('Dockerfile'));
    const hasCI = documents.some(doc => doc.metadata?.filePath?.includes('.github/workflows') || 
                                     doc.metadata?.filePath?.includes('.gitlab-ci.yml'));
    const hasTests = documents.some(doc => doc.metadata?.filePath?.includes('test') || 
                                     doc.metadata?.filePath?.includes('spec'));
    const hasConfig = documents.some(doc => doc.metadata?.filePath?.includes('config') ||
                                     doc.metadata?.filePath?.includes('environment'));

    // Check for legacy indicators
    const hasLegacyPatterns = documents.some(doc => 
      doc.content?.includes('var ') || // Old JS
      doc.content?.includes('python2') ||
      doc.content?.includes('jQuery')
    );

    if (hasLegacyPatterns) return 'Legacy';
    if (hasDockerfile && hasCI && hasTests && hasConfig) return 'Production';
    if (hasTests && hasConfig) return 'Development';
    return 'Prototype';
  }

  private async generateProjectDescription(documents: any[], languageStats: LanguageStats[]): Promise<string> {
    const primaryLanguage = languageStats[0]?.language || 'unknown';
    const frameworks = await this.detectPrimaryFrameworks(documents);
    
    try {
      const prompt = `
      Based on the following codebase analysis, generate a concise 2-3 sentence description:
      - Primary language: ${primaryLanguage}
      - Frameworks: ${frameworks.join(', ')}
      - File count: ${documents.length}
      - Key file types: ${this.getKeyFileTypes(documents).join(', ')}
      
      Describe what this project likely does and its technology stack.
      `;

      return await this.llmManager.generateResponse(prompt, { maxTokens: 150, temperature: 0.5 });
    } catch (error) {
      return `A ${primaryLanguage} project with ${documents.length} files using ${frameworks.join(', ')}.`;
    }
  }

  private async extractProjectName(projectPath: string): Promise<string> {
    // Try to get from package.json, pom.xml, etc.
    return projectPath.split('/').pop() || 'Unknown Project';
  }

  private determineArchitectureType(architecture: MicroserviceArchitecture): 'Monolith' | 'Microservices' | 'Modular Monolith' | 'Hybrid' {
    const serviceCount = architecture.services.length;
    
    if (serviceCount === 1) return 'Monolith';
    if (serviceCount > 5) return 'Microservices';
    if (serviceCount > 2) return 'Modular Monolith';
    return 'Hybrid';
  }

  private async detectFrameworksInFile(filePath: string, content: string): Promise<{name: string; confidence: number; component?: string}[]> {
    // Simplified framework detection - would integrate with existing logic
    const frameworks: {name: string; confidence: number; component?: string}[] = [];
    
    if (content.includes('import React')) {
      frameworks.push({ name: 'React', confidence: 0.9, component: 'Component' });
    }
    if (content.includes('from django')) {
      frameworks.push({ name: 'Django', confidence: 0.9, component: 'Model/View' });
    }
    // Add more detection logic...
    
    return frameworks;
  }

  private determineFrameworkUsage(fileCount: number, totalFiles: number): 'Primary' | 'Secondary' | 'Utility' {
    const percentage = (fileCount / totalFiles) * 100;
    if (percentage > 30) return 'Primary';
    if (percentage > 10) return 'Secondary';
    return 'Utility';
  }

  private async analyzeBestPractices(files: string[], frameworkConfig: any): Promise<{followed: string[]; violations: string[]}> {
    // Simplified implementation
    return {
      followed: ['Component structure', 'Naming conventions'],
      violations: ['Missing error handling', 'Large component files']
    };
  }

  private isConfigFile(filePath: string): boolean {
    const configExtensions = ['.json', '.yml', '.yaml', '.toml', '.ini', '.env'];
    const configNames = ['package.json', 'pom.xml', 'Dockerfile', 'docker-compose'];
    
    return configExtensions.some(ext => filePath.endsWith(ext)) ||
           configNames.some(name => filePath.includes(name));
  }

  private getConfigFileType(filePath: string): string {
    if (filePath.includes('package.json')) return 'Package Management';
    if (filePath.includes('Dockerfile')) return 'Container';
    if (filePath.includes('docker-compose')) return 'Orchestration';
    if (filePath.endsWith('.env')) return 'Environment';
    return 'Configuration';
  }

  private getConfigFilePurpose(filePath: string): string {
    if (filePath.includes('package.json')) return 'Node.js dependencies and scripts';
    if (filePath.includes('Dockerfile')) return 'Container image definition';
    if (filePath.includes('docker-compose')) return 'Multi-container application setup';
    return 'Application configuration';
  }

  private analyzeRootDirectories(directoryMap: Map<string, string[]>): DirectoryInfo[] {
    const rootDirs: DirectoryInfo[] = [];
    
    for (const [path, files] of directoryMap) {
      if (path.split('/').length <= 2) { // Root level directories
        rootDirs.push({
          name: path.split('/').pop() || path,
          path,
          fileCount: files.length,
          purpose: this.inferDirectoryPurpose(path, files),
          subDirectories: []
        });
      }
    }
    
    return rootDirs.sort((a, b) => b.fileCount - a.fileCount);
  }

  private inferDirectoryPurpose(path: string, files: string[]): string {
    const dirName = path.split('/').pop()?.toLowerCase() || '';
    
    if (dirName.includes('src') || dirName.includes('source')) return 'Source Code';
    if (dirName.includes('test') || dirName.includes('spec')) return 'Tests';
    if (dirName.includes('doc') || dirName.includes('docs')) return 'Documentation';
    if (dirName.includes('config') || dirName.includes('conf')) return 'Configuration';
    if (dirName.includes('asset') || dirName.includes('static')) return 'Static Assets';
    if (dirName.includes('lib') || dirName.includes('vendor')) return 'Dependencies';
    
    return 'General';
  }

  private determineOrganizationPattern(directoryMap: Map<string, string[]>): 'By Feature' | 'By Layer' | 'By Component' | 'Mixed' {
    // Simplified logic - would analyze directory structure more thoroughly
    const directories = Array.from(directoryMap.keys());
    
    const hasLayerStructure = directories.some(dir => 
      dir.includes('controller') || dir.includes('service') || dir.includes('repository')
    );
    
    const hasFeatureStructure = directories.some(dir =>
      dir.includes('user') || dir.includes('product') || dir.includes('order')
    );
    
    if (hasLayerStructure && hasFeatureStructure) return 'Mixed';
    if (hasLayerStructure) return 'By Layer';
    if (hasFeatureStructure) return 'By Feature';
    return 'By Component';
  }

  private analyzeTestStructure(documents: any[]): TestStructure {
    const testFiles = documents.filter(doc => 
      doc.metadata?.filePath?.includes('test') || 
      doc.metadata?.filePath?.includes('spec')
    );
    
    // Detect test framework
    let framework = 'Unknown';
    const testContent = testFiles.map(f => f.content).join(' ');
    
    if (testContent.includes('jest')) framework = 'Jest';
    else if (testContent.includes('mocha')) framework = 'Mocha';
    else if (testContent.includes('pytest')) framework = 'PyTest';
    else if (testContent.includes('junit')) framework = 'JUnit';

    return {
      framework,
      coverage: 0, // Would be calculated from actual coverage data
      unitTests: testFiles.filter(f => f.metadata?.filePath?.includes('unit')).length,
      integrationTests: testFiles.filter(f => f.metadata?.filePath?.includes('integration')).length,
      e2eTests: testFiles.filter(f => f.metadata?.filePath?.includes('e2e')).length
    };
  }

  private async detectPrimaryFrameworks(documents: any[]): Promise<string[]> {
    const frameworks = new Set<string>();
    
    for (const doc of documents) {
      const content = doc.content || '';
      
      if (content.includes('React')) frameworks.add('React');
      if (content.includes('Vue')) frameworks.add('Vue.js');
      if (content.includes('Angular')) frameworks.add('Angular');
      if (content.includes('django')) frameworks.add('Django');
      if (content.includes('express')) frameworks.add('Express');
      if (content.includes('spring')) frameworks.add('Spring');
      // Add more framework detection...
    }
    
    return Array.from(frameworks);
  }

  private getKeyFileTypes(documents: any[]): string[] {
    const types = new Map<string, number>();
    
    for (const doc of documents) {
      const filePath = doc.metadata?.filePath || '';
      const ext = filePath.split('.').pop() || 'unknown';
      types.set(ext, (types.get(ext) || 0) + 1);
    }
    
    return Array.from(types.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type]) => type);
  }

  // Additional helper methods would be implemented here...
  private async detectArchitecturalLayers(architecture: MicroserviceArchitecture): Promise<ArchitecturalLayer[]> {
    // Implementation would analyze service structure to identify layers
    return [];
  }

  private async identifyArchitecturalPatterns(architecture: MicroserviceArchitecture): Promise<ArchitecturalPattern[]> {
    // Implementation would identify common patterns like MVC, Repository, etc.
    return [];
  }

  private buildDependencyGraph(architecture: MicroserviceArchitecture): DependencyGraph {
    // Implementation would build a dependency graph from service relationships
    return { nodes: [], edges: [], cycles: [] };
  }

  private calculateCouplingMetrics(architecture: MicroserviceArchitecture): CouplingAnalysis {
    // Implementation would calculate coupling metrics
    return { overall: 0, afferent: {}, efferent: {}, instability: {} };
  }

  private async calculateComplexityMetrics(documents: any[]): Promise<ComplexityMetrics> {
    // Implementation would calculate various complexity metrics
    return {
      cyclomaticComplexity: 0,
      cognitiveComplexity: 0,
      maintainabilityIndex: 0,
      technicalDebt: 0
    };
  }

  private analyzeTestCoverage(documents: any[]): TestCoverageInfo {
    // Implementation would analyze test coverage
    return {
      overall: 0,
      byLanguage: {},
      uncoveredCriticalPaths: []
    };
  }

  private async calculateQualityMetrics(documents: any[]): Promise<QualityMetrics> {
    // Implementation would calculate code quality metrics
    return {
      codeSmells: 0,
      duplicateCode: 0,
      securityHotspots: 0,
      bugs: 0,
      vulnerabilities: 0
    };
  }

  private calculateMaintainabilityIndex(
    complexity: ComplexityMetrics,
    testCoverage: TestCoverageInfo,
    quality: QualityMetrics
  ): MaintainabilityIndex {
    // Implementation would calculate maintainability index
    return {
      score: 50,
      factors: {
        complexity: complexity.cyclomaticComplexity,
        linesOfCode: 0,
        codeSmells: quality.codeSmells,
        testCoverage: testCoverage.overall
      }
    };
  }

  private async calculateComponentImportance(filePath: string, content: string, allDocuments: any[]): Promise<number> {
    // Implementation would calculate component importance based on various factors
    return 0.5;
  }

  private async analyzeComponent(filePath: string, content: string, allDocuments: any[]): Promise<ComponentAnalysis> {
    // Implementation would analyze a specific component
    return {
      name: filePath.split('/').pop() || '',
      type: 'Component',
      filePath,
      purpose: 'Unknown',
      dependencies: [],
      importance: 0.5,
      complexity: 1,
      lastModified: new Date()
    };
  }

  private async identifyEntryPoints(documents: any[]): Promise<EntryPoint[]> {
    // Implementation would identify application entry points
    return [];
  }

  private async analyzeDataTransformations(documents: any[]): Promise<DataTransformation[]> {
    // Implementation would analyze data flow transformations
    return [];
  }

  private async analyzePersistenceLayer(documents: any[]): Promise<PersistenceInfo> {
    // Implementation would analyze persistence layer
    return {
      databases: [],
      caching: [],
      fileStorage: []
    };
  }

  private async identifyExternalIntegrations(documents: any[]): Promise<ExternalIntegration[]> {
    // Implementation would identify external integrations
    return [];
  }
}