import { RAGManager } from '../core/RAGManager';
import { CodeChunk } from '../types';

export interface FrameworkAnalysis {
  framework: string;
  version?: string;
  architecture: {
    layers: string[];
    patterns: string[];
    components: ComponentInfo[];
  };
  security: {
    vulnerabilities: SecurityIssue[];
    recommendations: string[];
  };
  performance: {
    issues: PerformanceIssue[];
    optimizations: string[];
  };
  bestPractices: {
    violations: BestPracticeViolation[];
    recommendations: string[];
  };
  dependencies: {
    frameworks: string[];
    libraries: string[];
    outdated: string[];
  };
  codeStructure: {
    complexity: number;
    maintainability: number;
    testCoverage: number;
  };
}

export interface ComponentInfo {
  name: string;
  type: string;
  purpose: string;
  dependencies: string[];
  complexity: number;
  filePath: string;
  lineNumber: number;
}

export interface SecurityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: string;
  recommendation: string;
}

export interface PerformanceIssue {
  type: string;
  impact: 'low' | 'medium' | 'high';
  description: string;
  location: string;
  solution: string;
}

export interface BestPracticeViolation {
  practice: string;
  violation: string;
  location: string;
  recommendation: string;
}

export class FrameworkAnalyzer {
  constructor(private ragManager: RAGManager) {}

  async analyzeFramework(framework: string): Promise<FrameworkAnalysis> {
    const chunks = await this.ragManager.getFrameworkChunks(framework);
    
    switch (framework.toLowerCase()) {
      case 'spring boot':
      case 'spring':
        return this.analyzeSpringFramework(chunks);
      case 'react':
        return this.analyzeReactFramework(chunks);
      case 'angular':
        return this.analyzeAngularFramework(chunks);
      case 'flask':
        return this.analyzeFlaskFramework(chunks);
      case 'fastapi':
        return this.analyzeFastAPIFramework(chunks);
      default:
        return this.analyzeGenericFramework(framework, chunks);
    }
  }

  private async analyzeSpringFramework(chunks: CodeChunk[]): Promise<FrameworkAnalysis> {
    const components = this.extractSpringComponents(chunks);
    const securityIssues = this.detectSpringSecurityIssues(chunks);
    const performanceIssues = this.detectSpringPerformanceIssues(chunks);
    const bestPracticeViolations = this.detectSpringBestPracticeViolations(chunks);

    return {
      framework: 'Spring Boot',
      architecture: {
        layers: this.identifySpringLayers(chunks),
        patterns: ['MVC', 'Dependency Injection', 'Repository Pattern', 'Service Layer'],
        components
      },
      security: {
        vulnerabilities: securityIssues,
        recommendations: this.getSpringSecurityRecommendations(chunks)
      },
      performance: {
        issues: performanceIssues,
        optimizations: this.getSpringPerformanceOptimizations(chunks)
      },
      bestPractices: {
        violations: bestPracticeViolations,
        recommendations: this.getSpringBestPractices()
      },
      dependencies: this.analyzeSpringDependencies(chunks),
      codeStructure: {
        complexity: this.calculateAverageComplexity(chunks),
        maintainability: this.calculateMaintainability(chunks),
        testCoverage: this.estimateTestCoverage(chunks)
      }
    };
  }

  private async analyzeReactFramework(chunks: CodeChunk[]): Promise<FrameworkAnalysis> {
    const components = this.extractReactComponents(chunks);
    const securityIssues = this.detectReactSecurityIssues(chunks);
    const performanceIssues = this.detectReactPerformanceIssues(chunks);

    return {
      framework: 'React',
      architecture: {
        layers: ['Components', 'Hooks', 'Context', 'Services'],
        patterns: ['Component Composition', 'Hooks Pattern', 'Context API', 'Higher-Order Components'],
        components
      },
      security: {
        vulnerabilities: securityIssues,
        recommendations: this.getReactSecurityRecommendations()
      },
      performance: {
        issues: performanceIssues,
        optimizations: this.getReactPerformanceOptimizations()
      },
      bestPractices: {
        violations: this.detectReactBestPracticeViolations(chunks),
        recommendations: this.getReactBestPractices()
      },
      dependencies: this.analyzeReactDependencies(chunks),
      codeStructure: {
        complexity: this.calculateAverageComplexity(chunks),
        maintainability: this.calculateMaintainability(chunks),
        testCoverage: this.estimateTestCoverage(chunks)
      }
    };
  }

  private async analyzeAngularFramework(chunks: CodeChunk[]): Promise<FrameworkAnalysis> {
    return {
      framework: 'Angular',
      architecture: {
        layers: ['Components', 'Services', 'Modules', 'Guards', 'Pipes'],
        patterns: ['Dependency Injection', 'Observables', 'Component Architecture', 'Module System'],
        components: this.extractAngularComponents(chunks)
      },
      security: {
        vulnerabilities: this.detectAngularSecurityIssues(chunks),
        recommendations: this.getAngularSecurityRecommendations()
      },
      performance: {
        issues: this.detectAngularPerformanceIssues(chunks),
        optimizations: this.getAngularPerformanceOptimizations()
      },
      bestPractices: {
        violations: this.detectAngularBestPracticeViolations(chunks),
        recommendations: this.getAngularBestPractices()
      },
      dependencies: this.analyzeAngularDependencies(chunks),
      codeStructure: {
        complexity: this.calculateAverageComplexity(chunks),
        maintainability: this.calculateMaintainability(chunks),
        testCoverage: this.estimateTestCoverage(chunks)
      }
    };
  }

  private async analyzeFlaskFramework(chunks: CodeChunk[]): Promise<FrameworkAnalysis> {
    return {
      framework: 'Flask',
      architecture: {
        layers: ['Routes', 'Views', 'Models', 'Blueprints'],
        patterns: ['MVC', 'Blueprint Pattern', 'Application Factory', 'Request Context'],
        components: this.extractFlaskComponents(chunks)
      },
      security: {
        vulnerabilities: this.detectFlaskSecurityIssues(chunks),
        recommendations: this.getFlaskSecurityRecommendations()
      },
      performance: {
        issues: this.detectFlaskPerformanceIssues(chunks),
        optimizations: this.getFlaskPerformanceOptimizations()
      },
      bestPractices: {
        violations: this.detectFlaskBestPracticeViolations(chunks),
        recommendations: this.getFlaskBestPractices()
      },
      dependencies: this.analyzePythonDependencies(chunks),
      codeStructure: {
        complexity: this.calculateAverageComplexity(chunks),
        maintainability: this.calculateMaintainability(chunks),
        testCoverage: this.estimateTestCoverage(chunks)
      }
    };
  }

  private async analyzeFastAPIFramework(chunks: CodeChunk[]): Promise<FrameworkAnalysis> {
    return {
      framework: 'FastAPI',
      architecture: {
        layers: ['Routers', 'Dependencies', 'Models', 'Services'],
        patterns: ['Dependency Injection', 'Type Hints', 'Async/Await', 'Pydantic Models'],
        components: this.extractFastAPIComponents(chunks)
      },
      security: {
        vulnerabilities: this.detectFastAPISecurityIssues(chunks),
        recommendations: this.getFastAPISecurityRecommendations()
      },
      performance: {
        issues: this.detectFastAPIPerformanceIssues(chunks),
        optimizations: this.getFastAPIPerformanceOptimizations()
      },
      bestPractices: {
        violations: this.detectFastAPIBestPracticeViolations(chunks),
        recommendations: this.getFastAPIBestPractices()
      },
      dependencies: this.analyzePythonDependencies(chunks),
      codeStructure: {
        complexity: this.calculateAverageComplexity(chunks),
        maintainability: this.calculateMaintainability(chunks),
        testCoverage: this.estimateTestCoverage(chunks)
      }
    };
  }

  private async analyzeGenericFramework(framework: string, chunks: CodeChunk[]): Promise<FrameworkAnalysis> {
    return {
      framework,
      architecture: {
        layers: [],
        patterns: [],
        components: []
      },
      security: {
        vulnerabilities: [],
        recommendations: []
      },
      performance: {
        issues: [],
        optimizations: []
      },
      bestPractices: {
        violations: [],
        recommendations: []
      },
      dependencies: {
        frameworks: [],
        libraries: [],
        outdated: []
      },
      codeStructure: {
        complexity: this.calculateAverageComplexity(chunks),
        maintainability: this.calculateMaintainability(chunks),
        testCoverage: this.estimateTestCoverage(chunks)
      }
    };
  }

  // Spring-specific analysis methods
  private extractSpringComponents(chunks: CodeChunk[]): ComponentInfo[] {
    const components: ComponentInfo[] = [];
    
    for (const chunk of chunks) {
      if (chunk.chunkType === 'class' && chunk.metadata.className) {
        const content = chunk.content;
        let type = 'Component';
        
        if (content.includes('@RestController') || content.includes('@Controller')) {
          type = 'Controller';
        } else if (content.includes('@Service')) {
          type = 'Service';
        } else if (content.includes('@Repository')) {
          type = 'Repository';
        } else if (content.includes('@Configuration')) {
          type = 'Configuration';
        } else if (content.includes('@Entity')) {
          type = 'Entity';
        }
        
        components.push({
          name: chunk.metadata.className,
          type,
          purpose: this.inferComponentPurpose(type, chunk.metadata.className),
          dependencies: this.extractDependencies(content),
          complexity: chunk.metadata.complexity || 1,
          filePath: chunk.filePath,
          lineNumber: chunk.startLine
        });
      }
    }
    
    return components;
  }

  private identifySpringLayers(chunks: CodeChunk[]): string[] {
    const layers = new Set<string>();
    
    for (const chunk of chunks) {
      if (chunk.content.includes('@Controller') || chunk.content.includes('@RestController')) {
        layers.add('Controller Layer');
      }
      if (chunk.content.includes('@Service')) {
        layers.add('Service Layer');
      }
      if (chunk.content.includes('@Repository')) {
        layers.add('Repository Layer');
      }
      if (chunk.content.includes('@Entity')) {
        layers.add('Domain Layer');
      }
      if (chunk.content.includes('@Configuration')) {
        layers.add('Configuration Layer');
      }
    }
    
    return Array.from(layers);
  }

  private detectSpringSecurityIssues(chunks: CodeChunk[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    for (const chunk of chunks) {
      const content = chunk.content;
      
      // Check for hardcoded credentials
      if (content.match(/password\s*=\s*["'][^"']*["']/i)) {
        issues.push({
          type: 'Hardcoded Password',
          severity: 'high',
          description: 'Hardcoded password found in source code',
          location: `${chunk.filePath}:${chunk.startLine}`,
          recommendation: 'Use environment variables or secure configuration for passwords'
        });
      }
      
      // Check for SQL injection vulnerabilities
      if (content.includes('createQuery(') && content.includes('+')) {
        issues.push({
          type: 'SQL Injection Risk',
          severity: 'high',
          description: 'Potential SQL injection vulnerability detected',
          location: `${chunk.filePath}:${chunk.startLine}`,
          recommendation: 'Use parameterized queries or JPA criteria queries'
        });
      }
      
      // Check for missing @PreAuthorize annotations
      if (content.includes('@RequestMapping') && !content.includes('@PreAuthorize')) {
        issues.push({
          type: 'Missing Authorization',
          severity: 'medium',
          description: 'Endpoint lacks authorization checks',
          location: `${chunk.filePath}:${chunk.startLine}`,
          recommendation: 'Add @PreAuthorize annotation to secure the endpoint'
        });
      }
    }
    
    return issues;
  }

  private detectSpringPerformanceIssues(chunks: CodeChunk[]): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    
    for (const chunk of chunks) {
      const content = chunk.content;
      
      // Check for N+1 query problems
      if (content.includes('@OneToMany') && !content.includes('fetch = FetchType.LAZY')) {
        issues.push({
          type: 'N+1 Query Problem',
          impact: 'high',
          description: 'Eager fetching may cause N+1 query problems',
          location: `${chunk.filePath}:${chunk.startLine}`,
          solution: 'Use LAZY fetching and explicit JOIN FETCH queries'
        });
      }
      
      // Check for missing @Transactional
      if (content.includes('@Service') && content.includes('save(') && !content.includes('@Transactional')) {
        issues.push({
          type: 'Missing Transaction Management',
          impact: 'medium',
          description: 'Data modification without transaction management',
          location: `${chunk.filePath}:${chunk.startLine}`,
          solution: 'Add @Transactional annotation to ensure proper transaction boundaries'
        });
      }
    }
    
    return issues;
  }

  private detectSpringBestPracticeViolations(chunks: CodeChunk[]): BestPracticeViolation[] {
    const violations: BestPracticeViolation[] = [];
    
    for (const chunk of chunks) {
      const content = chunk.content;
      
      // Check for field injection instead of constructor injection
      if (content.includes('@Autowired') && content.includes('private') && !content.includes('final')) {
        violations.push({
          practice: 'Constructor Injection',
          violation: 'Using field injection instead of constructor injection',
          location: `${chunk.filePath}:${chunk.startLine}`,
          recommendation: 'Use constructor injection for better testability and immutability'
        });
      }
      
      // Check for overly complex classes
      if (chunk.metadata.complexity && chunk.metadata.complexity > 15) {
        violations.push({
          practice: 'Single Responsibility Principle',
          violation: 'Class has high complexity indicating multiple responsibilities',
          location: `${chunk.filePath}:${chunk.startLine}`,
          recommendation: 'Break down the class into smaller, focused components'
        });
      }
    }
    
    return violations;
  }

  // React-specific analysis methods
  private extractReactComponents(chunks: CodeChunk[]): ComponentInfo[] {
    const components: ComponentInfo[] = [];
    
    for (const chunk of chunks) {
      if (chunk.metadata.framework === 'react') {
        const content = chunk.content;
        
        // Detect functional components
        const funcComponentMatch = content.match(/(?:function|const)\s+(\w+)\s*(?:\(|=)/);
        if (funcComponentMatch && content.includes('return')) {
          components.push({
            name: funcComponentMatch[1],
            type: 'Functional Component',
            purpose: 'React functional component',
            dependencies: this.extractReactDependencies(content),
            complexity: chunk.metadata.complexity || 1,
            filePath: chunk.filePath,
            lineNumber: chunk.startLine
          });
        }
        
        // Detect class components
        const classComponentMatch = content.match(/class\s+(\w+)\s+extends\s+.*Component/);
        if (classComponentMatch) {
          components.push({
            name: classComponentMatch[1],
            type: 'Class Component',
            purpose: 'React class component',
            dependencies: this.extractReactDependencies(content),
            complexity: chunk.metadata.complexity || 1,
            filePath: chunk.filePath,
            lineNumber: chunk.startLine
          });
        }
      }
    }
    
    return components;
  }

  private detectReactSecurityIssues(chunks: CodeChunk[]): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    for (const chunk of chunks) {
      const content = chunk.content;
      
      // Check for dangerouslySetInnerHTML
      if (content.includes('dangerouslySetInnerHTML')) {
        issues.push({
          type: 'XSS Vulnerability',
          severity: 'high',
          description: 'Use of dangerouslySetInnerHTML can lead to XSS attacks',
          location: `${chunk.filePath}:${chunk.startLine}`,
          recommendation: 'Sanitize HTML content or use safe alternatives'
        });
      }
      
      // Check for eval usage
      if (content.includes('eval(')) {
        issues.push({
          type: 'Code Injection',
          severity: 'critical',
          description: 'eval() usage can lead to code injection vulnerabilities',
          location: `${chunk.filePath}:${chunk.startLine}`,
          recommendation: 'Avoid using eval() and use safer alternatives'
        });
      }
    }
    
    return issues;
  }

  private detectReactPerformanceIssues(chunks: CodeChunk[]): PerformanceIssue[] {
    const issues: PerformanceIssue[] = [];
    
    for (const chunk of chunks) {
      const content = chunk.content;
      
      // Check for missing React.memo
      if (content.includes('function') && content.includes('props') && !content.includes('React.memo')) {
        issues.push({
          type: 'Unnecessary Re-renders',
          impact: 'medium',
          description: 'Component may re-render unnecessarily',
          location: `${chunk.filePath}:${chunk.startLine}`,
          solution: 'Consider wrapping with React.memo for performance optimization'
        });
      }
      
      // Check for missing dependency arrays in useEffect
      if (content.includes('useEffect') && !content.includes('], [')) {
        issues.push({
          type: 'Infinite Re-renders',
          impact: 'high',
          description: 'useEffect without dependency array may cause infinite re-renders',
          location: `${chunk.filePath}:${chunk.startLine}`,
          solution: 'Add proper dependency array to useEffect'
        });
      }
    }
    
    return issues;
  }

  // Helper methods
  private calculateAverageComplexity(chunks: CodeChunk[]): number {
    const complexities = chunks
      .map(chunk => chunk.metadata.complexity || 1)
      .filter(complexity => complexity > 0);
    
    return complexities.length > 0 
      ? complexities.reduce((sum, c) => sum + c, 0) / complexities.length 
      : 1;
  }

  private calculateMaintainability(chunks: CodeChunk[]): number {
    // Simple maintainability index based on complexity and code size
    const avgComplexity = this.calculateAverageComplexity(chunks);
    const avgLinesPerChunk = chunks.reduce((sum, chunk) => 
      sum + (chunk.endLine - chunk.startLine), 0) / chunks.length;
    
    // Simplified maintainability index (0-100)
    return Math.max(0, 100 - (avgComplexity * 5) - (avgLinesPerChunk * 0.5));
  }

  private estimateTestCoverage(chunks: CodeChunk[]): number {
    const testFiles = chunks.filter(chunk => 
      chunk.filePath.includes('.test.') || 
      chunk.filePath.includes('.spec.') ||
      chunk.filePath.includes('test/')
    );
    
    const sourceFiles = chunks.filter(chunk => 
      !chunk.filePath.includes('.test.') && 
      !chunk.filePath.includes('.spec.') &&
      !chunk.filePath.includes('test/')
    );
    
    return sourceFiles.length > 0 ? (testFiles.length / sourceFiles.length) * 100 : 0;
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    const importMatches = content.match(/import\s+.*\s+from\s+['"]([^'"]+)['"]/g);
    
    if (importMatches) {
      for (const match of importMatches) {
        const depMatch = match.match(/from\s+['"]([^'"]+)['"]/);
        if (depMatch) {
          dependencies.push(depMatch[1]);
        }
      }
    }
    
    return dependencies;
  }

  private extractReactDependencies(content: string): string[] {
    const deps = this.extractDependencies(content);
    const reactDeps = deps.filter(dep => 
      dep.includes('react') || 
      dep.includes('redux') || 
      dep.includes('hook') ||
      dep.startsWith('@')
    );
    
    return reactDeps;
  }

  private inferComponentPurpose(type: string, name: string): string {
    const purposes: Record<string, string> = {
      'Controller': 'Handles HTTP requests and responses',
      'Service': 'Contains business logic and operations',
      'Repository': 'Manages data access and persistence',
      'Entity': 'Represents domain model and database mapping',
      'Configuration': 'Provides application configuration and beans'
    };
    
    return purposes[type] || `${type} component`;
  }

  // Framework-specific recommendation methods
  private getSpringSecurityRecommendations(chunks: CodeChunk[]): string[] {
    return [
      'Use Spring Security for authentication and authorization',
      'Implement CSRF protection for state-changing operations',
      'Use HTTPS for all communications',
      'Validate and sanitize all input data',
      'Implement proper session management',
      'Use strong password policies and encryption'
    ];
  }

  private getSpringPerformanceOptimizations(chunks: CodeChunk[]): string[] {
    return [
      'Use connection pooling for database connections',
      'Implement caching for frequently accessed data',
      'Use lazy loading for JPA relationships',
      'Optimize database queries with proper indexes',
      'Use async processing for long-running operations',
      'Implement proper transaction boundaries'
    ];
  }

  private getSpringBestPractices(): string[] {
    return [
      'Use constructor injection over field injection',
      'Follow single responsibility principle',
      'Use proper exception handling',
      'Implement comprehensive testing',
      'Use appropriate HTTP status codes',
      'Document APIs with Swagger/OpenAPI'
    ];
  }

  private getReactSecurityRecommendations(): string[] {
    return [
      'Sanitize user input and avoid dangerouslySetInnerHTML',
      'Use HTTPS for all API communications',
      'Implement proper authentication and authorization',
      'Validate props and state data',
      'Use Content Security Policy (CSP)',
      'Keep dependencies updated'
    ];
  }

  private getReactPerformanceOptimizations(): string[] {
    return [
      'Use React.memo for expensive components',
      'Implement code splitting with React.lazy',
      'Optimize bundle size with tree shaking',
      'Use proper key props for lists',
      'Minimize state updates and re-renders',
      'Use useCallback and useMemo appropriately'
    ];
  }

  private getReactBestPractices(): string[] {
    return [
      'Use functional components with hooks',
      'Follow component composition patterns',
      'Implement proper error boundaries',
      'Use TypeScript for type safety',
      'Write comprehensive tests',
      'Follow consistent naming conventions'
    ];
  }

  // Placeholder methods for other frameworks
  private analyzeSpringDependencies(chunks: CodeChunk[]): any {
    return { frameworks: ['Spring Boot'], libraries: [], outdated: [] };
  }

  private analyzeReactDependencies(chunks: CodeChunk[]): any {
    return { frameworks: ['React'], libraries: [], outdated: [] };
  }

  private analyzeAngularDependencies(chunks: CodeChunk[]): any {
    return { frameworks: ['Angular'], libraries: [], outdated: [] };
  }

  private analyzePythonDependencies(chunks: CodeChunk[]): any {
    return { frameworks: [], libraries: [], outdated: [] };
  }

  private extractAngularComponents(chunks: CodeChunk[]): ComponentInfo[] { return []; }
  private extractFlaskComponents(chunks: CodeChunk[]): ComponentInfo[] { return []; }
  private extractFastAPIComponents(chunks: CodeChunk[]): ComponentInfo[] { return []; }

  private detectAngularSecurityIssues(chunks: CodeChunk[]): SecurityIssue[] { return []; }
  private detectFlaskSecurityIssues(chunks: CodeChunk[]): SecurityIssue[] { return []; }
  private detectFastAPISecurityIssues(chunks: CodeChunk[]): SecurityIssue[] { return []; }

  private detectAngularPerformanceIssues(chunks: CodeChunk[]): PerformanceIssue[] { return []; }
  private detectFlaskPerformanceIssues(chunks: CodeChunk[]): PerformanceIssue[] { return []; }
  private detectFastAPIPerformanceIssues(chunks: CodeChunk[]): PerformanceIssue[] { return []; }

  private detectReactBestPracticeViolations(chunks: CodeChunk[]): BestPracticeViolation[] { return []; }
  private detectAngularBestPracticeViolations(chunks: CodeChunk[]): BestPracticeViolation[] { return []; }
  private detectFlaskBestPracticeViolations(chunks: CodeChunk[]): BestPracticeViolation[] { return []; }
  private detectFastAPIBestPracticeViolations(chunks: CodeChunk[]): BestPracticeViolation[] { return []; }

  private getAngularSecurityRecommendations(): string[] { return []; }
  private getFlaskSecurityRecommendations(): string[] { return []; }
  private getFastAPISecurityRecommendations(): string[] { return []; }

  private getAngularPerformanceOptimizations(): string[] { return []; }
  private getFlaskPerformanceOptimizations(): string[] { return []; }
  private getFastAPIPerformanceOptimizations(): string[] { return []; }

  private getAngularBestPractices(): string[] { return []; }
  private getFlaskBestPractices(): string[] { return []; }
  private getFastAPIBestPractices(): string[] { return []; }
}