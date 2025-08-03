import * as fs from 'fs';
import * as path from 'path';
import { FrameworkConfigLoader } from '../config/FrameworkConfigLoader';

export interface ServiceBoundary {
  name: string;
  rootPath: string;
  type: 'microservice' | 'module' | 'package' | 'library';
  framework: string | null;
  language: string;
  dependencies: string[];
  exposedAPIs: ServiceAPI[];
  consumedAPIs: ServiceAPI[];
  confidence: number;
  metadata: {
    size: number; // Lines of code
    complexity: number;
    testCoverage?: number;
    deploymentUnit: boolean;
    hasOwnDatabase: boolean;
    hasOwnConfig: boolean;
  };
}

export interface ServiceAPI {
  type: 'REST' | 'GraphQL' | 'gRPC' | 'Message Queue' | 'Database' | 'File System';
  endpoint: string;
  method?: string;
  description?: string;
  confidence: number;
}

export interface MicroserviceArchitecture {
  services: ServiceBoundary[];
  boundaries: ServiceBoundaryMap;
  communicationPatterns: CommunicationPattern[];
  architecturalMetrics: ArchitecturalMetrics;
}

export interface ServiceBoundaryMap {
  [serviceName: string]: {
    dependencies: string[];
    dependents: string[];
    sharedComponents: string[];
  };
}

export interface CommunicationPattern {
  from: string;
  to: string;
  type: 'synchronous' | 'asynchronous' | 'event-driven';
  protocol: string;
  frequency: 'high' | 'medium' | 'low';
  dataFlow: string[];
}

export interface ArchitecturalMetrics {
  serviceCount: number;
  averageServiceSize: number;
  couplingIndex: number; // 0-1, lower is better
  cohesionIndex: number; // 0-1, higher is better
  deploymentComplexity: number;
  testabilityScore: number;
}

export class MicroserviceDetector {
  private configLoader: FrameworkConfigLoader;
  private fileSystemCache: Map<string, any> = new Map();

  constructor() {
    this.configLoader = FrameworkConfigLoader.getInstance();
  }

  async detectMicroserviceArchitecture(projectPath: string): Promise<MicroserviceArchitecture> {
    console.log('🔍 Starting microservice architecture detection...');

    // 1. Discover potential service boundaries
    const potentialServices = await this.discoverServiceBoundaries(projectPath);

    // 2. Analyze each service boundary
    const services: ServiceBoundary[] = [];
    for (const serviceCandidate of potentialServices) {
      const service = await this.analyzeServiceBoundary(serviceCandidate);
      if (service) {
        services.push(service);
      }
    }

    // 3. Build service boundary map
    const boundaries = await this.buildServiceBoundaryMap(services);

    // 4. Detect communication patterns
    const communicationPatterns = await this.detectCommunicationPatterns(services, projectPath);

    // 5. Calculate architectural metrics
    const architecturalMetrics = this.calculateArchitecturalMetrics(services, boundaries, communicationPatterns);

    console.log(`📊 Detected ${services.length} services with ${communicationPatterns.length} communication patterns`);

    return {
      services,
      boundaries,
      communicationPatterns,
      architecturalMetrics
    };
  }

  private async discoverServiceBoundaries(projectPath: string): Promise<string[]> {
    const boundaries: string[] = [];

    // Strategy 1: Look for package.json files (Node.js services)
    const packageJsonFiles = await this.findFiles(projectPath, 'package.json');
    for (const packageFile of packageJsonFiles) {
      const serviceRoot = path.dirname(packageFile);
      if (await this.isLikelyServiceRoot(serviceRoot)) {
        boundaries.push(serviceRoot);
      }
    }

    // Strategy 2: Look for build files (various languages)
    const buildFiles = await this.findFiles(projectPath, '{pom.xml,build.gradle,Cargo.toml,go.mod,requirements.txt,pyproject.toml}');
    for (const buildFile of buildFiles) {
      const serviceRoot = path.dirname(buildFile);
      if (await this.isLikelyServiceRoot(serviceRoot)) {
        boundaries.push(serviceRoot);
      }
    }

    // Strategy 3: Look for containerization files
    const containerFiles = await this.findFiles(projectPath, '{Dockerfile,docker-compose.yml,docker-compose.yaml}');
    for (const containerFile of containerFiles) {
      const serviceRoot = path.dirname(containerFile);
      if (await this.isLikelyServiceRoot(serviceRoot)) {
        boundaries.push(serviceRoot);
      }
    }

    // Strategy 4: Look for deployment configuration
    const deploymentFiles = await this.findFiles(projectPath, '{k8s/**/*.yaml,kubernetes/**/*.yaml,helm/**/*.yaml,.github/workflows/*.yml}');
    for (const deploymentFile of deploymentFiles) {
      const content = await fs.promises.readFile(deploymentFile, 'utf8');
      const servicePaths = this.extractServicePathsFromDeployment(content, projectPath);
      boundaries.push(...servicePaths);
    }

    // Strategy 5: Look for service-like directory structures
    const serviceDirectories = await this.findServiceDirectories(projectPath);
    boundaries.push(...serviceDirectories);

    // Remove duplicates and nested paths
    return this.deduplicateAndFilterPaths(boundaries);
  }

  private async isLikelyServiceRoot(dirPath: string): Promise<boolean> {
    try {
      const files = await fs.promises.readdir(dirPath);
      
      // Check for service indicators
      const serviceIndicators = [
        'src', 'lib', 'app', 'server', 'api',
        'package.json', 'pom.xml', 'build.gradle',
        'Dockerfile', 'requirements.txt', 'go.mod',
        'main.py', 'main.js', 'app.py', 'server.js'
      ];

      const hasServiceIndicators = serviceIndicators.some(indicator => files.includes(indicator));
      
      // Check for typical service structure
      const hasSourceCode = files.some(file => 
        file.endsWith('.js') || file.endsWith('.ts') || 
        file.endsWith('.py') || file.endsWith('.java') ||
        file.endsWith('.go') || file.endsWith('.rs')
      );

      const hasDirectories = await Promise.all(
        files.map(async file => {
          const filePath = path.join(dirPath, file);
          const stat = await fs.promises.stat(filePath);
          return stat.isDirectory();
        })
      );

      const directoryCount = hasDirectories.filter(Boolean).length;

      return hasServiceIndicators && (hasSourceCode || directoryCount >= 2);
    } catch (error) {
      return false;
    }
  }

  private async analyzeServiceBoundary(servicePath: string): Promise<ServiceBoundary | null> {
    try {
      const serviceName = path.basename(servicePath);
      
      // Detect framework and language
      const files = await this.getAllFiles(servicePath);
      const framework = await this.detectFramework(servicePath, files);
      const language = this.detectPrimaryLanguage(files);

      // Analyze dependencies
      const dependencies = await this.analyzeDependencies(servicePath);

      // Detect APIs
      const exposedAPIs = await this.detectExposedAPIs(servicePath, files);
      const consumedAPIs = await this.detectConsumedAPIs(servicePath, files);

      // Calculate metadata
      const metadata = await this.calculateServiceMetadata(servicePath, files);

      // Calculate confidence score
      const confidence = this.calculateServiceConfidence(servicePath, framework, exposedAPIs, metadata);

      const serviceType = this.determineServiceType(servicePath, metadata, dependencies);

      return {
        name: serviceName,
        rootPath: servicePath,
        type: serviceType,
        framework,
        language,
        dependencies,
        exposedAPIs,
        consumedAPIs,
        confidence,
        metadata
      };
    } catch (error) {
      console.warn(`Failed to analyze service boundary at ${servicePath}:`, error);
      return null;
    }
  }

  private async detectFramework(servicePath: string, files: string[]): Promise<string | null> {
    try {
      // Use existing framework detection logic
      const relativeFiles = files.map(f => path.relative(servicePath, f));
      
      // Check for Angular version detection
      const angularVersion = await this.configLoader.detectAngularVersion(servicePath, relativeFiles);
      if (angularVersion) {
        return angularVersion;
      }

      // Check other frameworks
      const frameworks = await this.configLoader.getAllFrameworks();
      
      for (const framework of frameworks) {
        let confidence = 0;

        // Check signature files
        for (const sigFile of framework.signature_files) {
          if (relativeFiles.some(f => f.includes(sigFile) || new RegExp(sigFile.replace(/\*/g, '.*')).test(f))) {
            confidence += 0.3;
          }
        }

        // Check primary indicators by reading package.json or similar
        if (framework.key === 'react' || framework.key === 'vue' || framework.key === 'angular') {
          const packageJsonPath = path.join(servicePath, 'package.json');
          if (await this.fileExists(packageJsonPath)) {
            const packageContent = await fs.promises.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageContent);
            const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
            
            for (const indicator of framework.primary_indicators) {
              if (dependencies[indicator] || Object.keys(dependencies).some(dep => dep.includes(indicator))) {
                confidence += 0.4;
              }
            }
          }
        }

        if (confidence >= framework.confidence_thresholds.minimum) {
          return framework.key;
        }
      }

      return null;
    } catch (error) {
      console.warn(`Failed to detect framework for ${servicePath}:`, error);
      return null;
    }
  }

  private detectPrimaryLanguage(files: string[]): string {
    const languageMap: { [ext: string]: string } = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.vue': 'javascript',
      '.svelte': 'javascript'
    };

    const languageCounts: { [lang: string]: number } = {};

    for (const file of files) {
      const ext = path.extname(file);
      const language = languageMap[ext];
      if (language) {
        languageCounts[language] = (languageCounts[language] || 0) + 1;
      }
    }

    return Object.entries(languageCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'unknown';
  }

  private async analyzeDependencies(servicePath: string): Promise<string[]> {
    const dependencies: string[] = [];

    // Node.js dependencies
    const packageJsonPath = path.join(servicePath, 'package.json');
    if (await this.fileExists(packageJsonPath)) {
      const packageContent = await fs.promises.readFile(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(packageContent);
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      dependencies.push(...Object.keys(deps));
    }

    // Python dependencies
    const requirementsPath = path.join(servicePath, 'requirements.txt');
    if (await this.fileExists(requirementsPath)) {
      const content = await fs.promises.readFile(requirementsPath, 'utf8');
      const deps = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => line.split('==')[0].split('>=')[0].split('~=')[0]);
      dependencies.push(...deps);
    }

    // Java dependencies (simplified)
    const pomPath = path.join(servicePath, 'pom.xml');
    if (await this.fileExists(pomPath)) {
      const content = await fs.promises.readFile(pomPath, 'utf8');
      const artifactMatches = content.match(/<artifactId>(.*?)<\/artifactId>/g) || [];
      const artifacts = artifactMatches.map(match => match.replace(/<\/?artifactId>/g, ''));
      dependencies.push(...artifacts);
    }

    return dependencies;
  }

  private async detectExposedAPIs(servicePath: string, files: string[]): Promise<ServiceAPI[]> {
    const apis: ServiceAPI[] = [];

    for (const file of files) {
      try {
        if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.py') || file.endsWith('.java')) {
          const content = await fs.promises.readFile(file, 'utf8');
          
          // REST API detection
          const restPatterns = [
            /@app\.route\(["']([^"']+)["']\)/g, // Flask
            /app\.(get|post|put|delete)\(["']([^"']+)["']/g, // Express
            /@(Get|Post|Put|Delete)Mapping\(.*?["']([^"']+)["']/g, // Spring Boot
            /router\.(get|post|put|delete)\(["']([^"']+)["']/g, // Express Router
            /@api_view\(\[["']([^"']+)["']\]\)/g, // Django REST
          ];

          for (const pattern of restPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
              apis.push({
                type: 'REST',
                endpoint: match[2] || match[1],
                method: match[1]?.toUpperCase(),
                confidence: 0.8
              });
            }
          }

          // GraphQL detection
          if (content.includes('GraphQL') || content.includes('graphql') || content.includes('apollo')) {
            apis.push({
              type: 'GraphQL',
              endpoint: '/graphql',
              confidence: 0.7
            });
          }

          // gRPC detection
          if (content.includes('grpc') || content.includes('proto')) {
            apis.push({
              type: 'gRPC',
              endpoint: 'grpc-service',
              confidence: 0.8
            });
          }
        }
      } catch (error) {
        // Continue processing other files
      }
    }

    return apis;
  }

  private async detectConsumedAPIs(servicePath: string, files: string[]): Promise<ServiceAPI[]> {
    const apis: ServiceAPI[] = [];

    for (const file of files) {
      try {
        if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.py') || file.endsWith('.java')) {
          const content = await fs.promises.readFile(file, 'utf8');
          
          // HTTP client patterns
          const httpPatterns = [
            /fetch\(["']([^"']+)["']\)/g,
            /axios\.(get|post|put|delete)\(["']([^"']+)["']\)/g,
            /requests\.(get|post|put|delete)\(["']([^"']+)["']\)/g,
            /http\.(get|post|put|delete)\(["']([^"']+)["']\)/g,
          ];

          for (const pattern of httpPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
              const url = match[2] || match[1];
              if (url.startsWith('http')) {
                apis.push({
                  type: 'REST',
                  endpoint: url,
                  method: match[1]?.toUpperCase(),
                  confidence: 0.6
                });
              }
            }
          }

          // Database connections
          const dbPatterns = [
            /mongodb:\/\/[^"']+/g,
            /postgresql:\/\/[^"']+/g,
            /mysql:\/\/[^"']+/g,
            /redis:\/\/[^"']+/g,
          ];

          for (const pattern of dbPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
              apis.push({
                type: 'Database',
                endpoint: match[0],
                confidence: 0.7
              });
            }
          }
        }
      } catch (error) {
        // Continue processing other files
      }
    }

    return apis;
  }

  private async calculateServiceMetadata(servicePath: string, files: string[]): Promise<ServiceBoundary['metadata']> {
    let totalLines = 0;
    let complexity = 0;

    // Calculate lines of code and basic complexity
    for (const file of files) {
      if (this.isSourceFile(file)) {
        try {
          const content = await fs.promises.readFile(file, 'utf8');
          const lines = content.split('\n').filter(line => line.trim()).length;
          totalLines += lines;

          // Simple complexity calculation based on control structures
          const complexityPatterns = [
            /\bif\b/g, /\bfor\b/g, /\bwhile\b/g, /\bswitch\b/g, /\btry\b/g, /\bcatch\b/g
          ];
          
          for (const pattern of complexityPatterns) {
            const matches = content.match(pattern);
            if (matches) {
              complexity += matches.length;
            }
          }
        } catch (error) {
          // Continue processing other files
        }
      }
    }

    // Check for deployment unit indicators
    const deploymentUnit = await this.hasDeploymentConfiguration(servicePath);

    // Check for database configuration
    const hasOwnDatabase = await this.hasOwnDatabase(servicePath);

    // Check for configuration files
    const hasOwnConfig = await this.hasOwnConfiguration(servicePath);

    return {
      size: totalLines,
      complexity,
      deploymentUnit,
      hasOwnDatabase,
      hasOwnConfig
    };
  }

  private calculateServiceConfidence(
    servicePath: string, 
    framework: string | null, 
    exposedAPIs: ServiceAPI[], 
    metadata: ServiceBoundary['metadata']
  ): number {
    let confidence = 0.5; // Base confidence

    // Framework detection adds confidence
    if (framework) confidence += 0.2;

    // Exposed APIs indicate a service
    if (exposedAPIs.length > 0) confidence += 0.3;

    // Deployment configuration indicates independence
    if (metadata.deploymentUnit) confidence += 0.2;

    // Own database indicates service boundary
    if (metadata.hasOwnDatabase) confidence += 0.15;

    // Own configuration indicates independence
    if (metadata.hasOwnConfig) confidence += 0.1;

    // Size consideration (not too small, not too large)
    if (metadata.size > 100 && metadata.size < 10000) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private determineServiceType(
    servicePath: string, 
    metadata: ServiceBoundary['metadata'], 
    dependencies: string[]
  ): ServiceBoundary['type'] {
    // Check for microservice indicators
    if (metadata.deploymentUnit && metadata.hasOwnDatabase && metadata.size > 500) {
      return 'microservice';
    }

    // Check for library indicators
    if (dependencies.length < 5 && metadata.size < 1000 && !metadata.deploymentUnit) {
      return 'library';
    }

    // Check for package indicators
    if (servicePath.includes('packages/') || servicePath.includes('libs/')) {
      return 'package';
    }

    // Default to module
    return 'module';
  }

  private async buildServiceBoundaryMap(services: ServiceBoundary[]): Promise<ServiceBoundaryMap> {
    const boundaryMap: ServiceBoundaryMap = {};

    for (const service of services) {
      const dependencies: string[] = [];
      const dependents: string[] = [];
      const sharedComponents: string[] = [];

      // Analyze dependencies between services
      for (const otherService of services) {
        if (service.name === otherService.name) continue;

        // Check if service depends on other service
        const dependsOn = this.servicesDependOnEachOther(service, otherService);
        if (dependsOn) {
          dependencies.push(otherService.name);
          if (!dependents.includes(service.name)) {
            dependents.push(service.name);
          }
        }

        // Check for shared components
        const shared = this.findSharedComponents(service, otherService);
        sharedComponents.push(...shared);
      }

      boundaryMap[service.name] = {
        dependencies: [...new Set(dependencies)],
        dependents: [...new Set(dependents)],
        sharedComponents: [...new Set(sharedComponents)]
      };
    }

    return boundaryMap;
  }

  private servicesDependOnEachOther(service1: ServiceBoundary, service2: ServiceBoundary): boolean {
    // Check if service1 consumes APIs from service2
    const service2APIs = service2.exposedAPIs.map(api => api.endpoint);
    const service1Consumes = service1.consumedAPIs.some(api => 
      service2APIs.some(exposedAPI => api.endpoint.includes(exposedAPI))
    );

    // Check dependency relationships
    const hasDependency = service1.dependencies.some(dep => 
      service2.dependencies.includes(dep) || service2.name.toLowerCase().includes(dep.toLowerCase())
    );

    return service1Consumes || hasDependency;
  }

  private findSharedComponents(service1: ServiceBoundary, service2: ServiceBoundary): string[] {
    const shared: string[] = [];

    // Find common dependencies
    const commonDeps = service1.dependencies.filter(dep => 
      service2.dependencies.includes(dep)
    );

    shared.push(...commonDeps);

    return shared;
  }

  private async detectCommunicationPatterns(services: ServiceBoundary[], projectPath: string): Promise<CommunicationPattern[]> {
    const patterns: CommunicationPattern[] = [];

    for (const service of services) {
      for (const consumedAPI of service.consumedAPIs) {
        // Find which service exposes this API
        const providerService = services.find(s => 
          s.exposedAPIs.some(api => consumedAPI.endpoint.includes(api.endpoint))
        );

        if (providerService) {
          const pattern: CommunicationPattern = {
            from: service.name,
            to: providerService.name,
            type: this.determineCommunicationType(consumedAPI),
            protocol: this.determineProtocol(consumedAPI),
            frequency: 'medium', // Default, could be enhanced with analysis
            dataFlow: [consumedAPI.endpoint]
          };

          patterns.push(pattern);
        }
      }
    }

    return patterns;
  }

  private determineCommunicationType(api: ServiceAPI): 'synchronous' | 'asynchronous' | 'event-driven' {
    if (api.type === 'Message Queue') return 'asynchronous';
    if (api.endpoint.includes('webhook') || api.endpoint.includes('event')) return 'event-driven';
    return 'synchronous';
  }

  private determineProtocol(api: ServiceAPI): string {
    switch (api.type) {
      case 'REST': return 'HTTP/REST';
      case 'GraphQL': return 'HTTP/GraphQL';
      case 'gRPC': return 'gRPC';
      case 'Message Queue': return 'AMQP/Kafka';
      case 'Database': return 'Database';
      default: return 'HTTP';
    }
  }

  private calculateArchitecturalMetrics(
    services: ServiceBoundary[], 
    boundaries: ServiceBoundaryMap, 
    patterns: CommunicationPattern[]
  ): ArchitecturalMetrics {
    const serviceCount = services.length;
    const averageServiceSize = services.reduce((sum, s) => sum + s.metadata.size, 0) / serviceCount;

    // Calculate coupling index (lower is better)
    const totalConnections = patterns.length;
    const maxPossibleConnections = serviceCount * (serviceCount - 1);
    const couplingIndex = maxPossibleConnections > 0 ? totalConnections / maxPossibleConnections : 0;

    // Calculate cohesion index (higher is better)
    const servicesWithSinglePurpose = services.filter(s => 
      s.exposedAPIs.length > 0 && s.exposedAPIs.length <= 3
    ).length;
    const cohesionIndex = serviceCount > 0 ? servicesWithSinglePurpose / serviceCount : 0;

    // Calculate deployment complexity
    const deployableServices = services.filter(s => s.metadata.deploymentUnit).length;
    const deploymentComplexity = deployableServices / serviceCount;

    // Calculate testability score
    const testableServices = services.filter(s => 
      s.consumedAPIs.length <= 3 && s.dependencies.length <= 10
    ).length;
    const testabilityScore = serviceCount > 0 ? testableServices / serviceCount : 0;

    return {
      serviceCount,
      averageServiceSize,
      couplingIndex,
      cohesionIndex,
      deploymentComplexity,
      testabilityScore
    };
  }

  // Utility methods
  private async findFiles(rootPath: string, pattern: string): Promise<string[]> {
    // This would use a glob pattern matching library in practice
    // For now, simplified implementation
    const files: string[] = [];
    
    const walk = async (dirPath: string) => {
      try {
        const entries = await fs.promises.readdir(dirPath);
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry);
          const stat = await fs.promises.stat(fullPath);
          
          if (stat.isDirectory() && !this.shouldIgnoreDirectory(entry)) {
            await walk(fullPath);
          } else if (stat.isFile() && this.matchesPattern(entry, pattern)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    };

    await walk(rootPath);
    return files;
  }

  private async getAllFiles(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const walk = async (dirPath: string) => {
      try {
        const entries = await fs.promises.readdir(dirPath);
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry);
          const stat = await fs.promises.stat(fullPath);
          
          if (stat.isDirectory() && !this.shouldIgnoreDirectory(entry)) {
            await walk(fullPath);
          } else if (stat.isFile()) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    };

    await walk(rootPath);
    return files;
  }

  private shouldIgnoreDirectory(dirName: string): boolean {
    const ignoredDirs = [
      'node_modules', '.git', 'target', 'build', 'dist', 
      '__pycache__', '.pytest_cache', 'vendor', '.venv', 'venv'
    ];
    return ignoredDirs.includes(dirName) || dirName.startsWith('.');
  }

  private matchesPattern(fileName: string, pattern: string): boolean {
    // Simplified pattern matching
    if (pattern.includes('{') && pattern.includes('}')) {
      const options = pattern.match(/\{([^}]+)\}/)?.[1].split(',') || [];
      return options.some(option => fileName.includes(option.trim()));
    }
    return fileName.includes(pattern);
  }

  private isSourceFile(filePath: string): boolean {
    const sourceExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.cs', '.php', '.rb'];
    return sourceExts.some(ext => filePath.endsWith(ext));
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async hasDeploymentConfiguration(servicePath: string): Promise<boolean> {
    const deploymentFiles = [
      'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
      'k8s.yaml', 'kubernetes.yaml', 'deployment.yaml',
      'helm', '.github/workflows'
    ];

    for (const file of deploymentFiles) {
      if (await this.fileExists(path.join(servicePath, file))) {
        return true;
      }
    }

    return false;
  }

  private async hasOwnDatabase(servicePath: string): Promise<boolean> {
    const dbConfigFiles = [
      'database.yml', 'db.config.js', 'knexfile.js',
      'migrations', 'schema.sql', 'models'
    ];

    for (const file of dbConfigFiles) {
      if (await this.fileExists(path.join(servicePath, file))) {
        return true;
      }
    }

    // Check for database connection strings in config files
    const configFiles = await this.findFiles(servicePath, '{.env,config.js,config.json,settings.py}');
    for (const configFile of configFiles) {
      try {
        const content = await fs.promises.readFile(configFile, 'utf8');
        if (content.includes('DATABASE_URL') || content.includes('DB_HOST') || 
            content.includes('mongodb://') || content.includes('postgresql://')) {
          return true;
        }
      } catch {
        // Continue checking other files
      }
    }

    return false;
  }

  private async hasOwnConfiguration(servicePath: string): Promise<boolean> {
    const configFiles = [
      'config.js', 'config.json', 'config.yaml', 'config.yml',
      'settings.py', 'application.properties', 'application.yml',
      '.env', '.env.local', 'environment.ts'
    ];

    for (const file of configFiles) {
      if (await this.fileExists(path.join(servicePath, file))) {
        return true;
      }
    }

    return false;
  }

  private async findServiceDirectories(projectPath: string): Promise<string[]> {
    const serviceDirectories: string[] = [];
    
    try {
      const entries = await fs.promises.readdir(projectPath);
      
      for (const entry of entries) {
        const fullPath = path.join(projectPath, entry);
        const stat = await fs.promises.stat(fullPath);
        
        if (stat.isDirectory() && !this.shouldIgnoreDirectory(entry)) {
          // Check if directory looks like a service
          const serviceIndicators = ['services', 'microservices', 'apps', 'packages'];
          if (serviceIndicators.some(indicator => entry.includes(indicator))) {
            const subDirs = await fs.promises.readdir(fullPath);
            for (const subDir of subDirs) {
              const subDirPath = path.join(fullPath, subDir);
              const subStat = await fs.promises.stat(subDirPath);
              if (subStat.isDirectory() && await this.isLikelyServiceRoot(subDirPath)) {
                serviceDirectories.push(subDirPath);
              }
            }
          } else if (await this.isLikelyServiceRoot(fullPath)) {
            serviceDirectories.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn('Error scanning for service directories:', error);
    }

    return serviceDirectories;
  }

  private extractServicePathsFromDeployment(content: string, projectPath: string): string[] {
    const paths: string[] = [];
    
    // Extract paths from Kubernetes/Docker Compose files
    const pathPatterns = [
      /context:\s*["']?([^"'\s]+)["']?/g,
      /dockerfile:\s*["']?([^"'\s]+)["']?/g,
      /build:\s*["']?([^"'\s]+)["']?/g
    ];

    for (const pattern of pathPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const relativePath = match[1];
        if (relativePath && relativePath !== '.') {
          const fullPath = path.resolve(projectPath, relativePath);
          paths.push(fullPath);
        }
      }
    }

    return paths;
  }

  private deduplicateAndFilterPaths(paths: string[]): string[] {
    const uniquePaths = [...new Set(paths)];
    
    // Remove nested paths (keep only root-level service boundaries)
    return uniquePaths.filter(path => {
      return !uniquePaths.some(otherPath => 
        otherPath !== path && path.startsWith(otherPath + '/')
      );
    });
  }
}