import * as path from 'path';
import { FileUtils } from '../utils/fileUtils';
import { WorkspaceEnvironment } from './RAGFoundation';

export interface FileClassification {
  primary: PrimaryClassification;
  secondary: SecondaryClassification;
  tertiary: TertiaryClassification;
  confidence: number;
  context: FileContext;
}

export enum PrimaryClassification {
  SpringBoot = 'spring-boot',
  React = 'react',
  Angular = 'angular',
  Flask = 'flask',
  FastAPI = 'fastapi',
  Vue = 'vue',
  Streamlit = 'streamlit',
  Generic = 'generic'
}

export enum SecondaryClassification {
  Code = 'code',
  Template = 'template',
  Configuration = 'configuration',
  Documentation = 'documentation',
  Static = 'static',
  Test = 'test',
  Build = 'build',
  Data = 'data'
}

export enum TertiaryClassification {
  // Code roles
  Controller = 'controller',
  Service = 'service',
  Repository = 'repository',
  Model = 'model',
  Entity = 'entity',
  Component = 'component',
  View = 'view',
  Middleware = 'middleware',
  Router = 'router',
  Utility = 'utility',
  Interface = 'interface',
  Enum = 'enum',
  
  // Template roles
  Layout = 'layout',
  Partial = 'partial',
  Page = 'page',
  Widget = 'widget',
  
  // Config roles
  Application = 'application',
  Database = 'database',
  Security = 'security',
  Deployment = 'deployment',
  
  // Other roles
  Unit = 'unit',
  Integration = 'integration',
  E2E = 'e2e',
  Asset = 'asset',
  Schema = 'schema',
  Migration = 'migration',
  StreamlitWidget = 'streamlit-widget',
  StreamlitLayout = 'streamlit-layout',
  
  Unknown = 'unknown'
}

export interface FileContext {
  imports: string[];
  dependencies: string[];
  relationships: FileRelationship[];
  directoryContext: DirectoryContext;
  patterns: PatternMatch[];
}

export interface FileRelationship {
  type: 'imports' | 'extends' | 'implements' | 'references' | 'configures';
  target: string;
  confidence: number;
}

export interface DirectoryContext {
  level: number;
  parentPath: string;
  siblings: string[];
  pathSegments: string[];
  frameworkHints: string[];
}

export interface PatternMatch {
  pattern: string;
  confidence: number;
  category: string;
}

export class FileClassifier {
  private classificationRules: Map<string, ClassificationRule[]> = new Map();
  private workspaceEnvironment: WorkspaceEnvironment | null = null;

  constructor() {
    this.initializeClassificationRules();
  }

  setWorkspaceEnvironment(environment: WorkspaceEnvironment): void {
    this.workspaceEnvironment = environment;
  }

  async classifyFile(filePath: string): Promise<FileClassification> {
    console.log(`🔍 Phase 2: Classifying file: ${filePath}`);
    
    const fileExtension = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    const directoryContext = this.analyzeDirectoryContext(filePath);
    
    // Step 1: Primary Classification (Framework identification)
    const primary = await this.determinePrimaryClassification(filePath, directoryContext);
    
    // Step 2: Secondary Classification (File category)
    const secondary = await this.determineSecondaryClassification(filePath, fileExtension, directoryContext);
    
    // Step 3: Tertiary Classification (Functional role)
    const tertiary = await this.determineTertiaryClassification(filePath, primary, secondary, directoryContext);
    
    // Step 4: Analyze file context
    const context = await this.analyzeFileContext(filePath, directoryContext);
    
    // Step 5: Calculate overall confidence
    const confidence = this.calculateClassificationConfidence(primary, secondary, tertiary, context);
    
    return {
      primary,
      secondary,
      tertiary,
      confidence,
      context
    };
  }

  private initializeClassificationRules(): void {
    // Spring Boot Rules
    this.classificationRules.set('spring-boot', [
      {
        patterns: [/@Controller|@RestController/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.Controller,
        confidence: 0.9
      },
      {
        patterns: [/@Service/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.Service,
        confidence: 0.9
      },
      {
        patterns: [/@Repository/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.Repository,
        confidence: 0.9
      },
      {
        patterns: [/@Entity|@Table/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.Entity,
        confidence: 0.9
      },
      {
        patterns: [/application\.properties|application\.yml/],
        secondary: SecondaryClassification.Configuration,
        tertiary: TertiaryClassification.Application,
        confidence: 0.95
      }
    ]);

    // React Rules
    this.classificationRules.set('react', [
      {
        patterns: [/useState|useEffect|Component/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.Component,
        confidence: 0.9
      },
      {
        patterns: [/\.test\.|\.spec\./],
        secondary: SecondaryClassification.Test,
        tertiary: TertiaryClassification.Unit,
        confidence: 0.95
      },
      {
        patterns: [/package\.json/],
        secondary: SecondaryClassification.Configuration,
        tertiary: TertiaryClassification.Application,
        confidence: 0.9
      }
    ]);

    // Angular Rules
    this.classificationRules.set('angular', [
      {
        patterns: [/@Component/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.Component,
        confidence: 0.9
      },
      {
        patterns: [/@Injectable/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.Service,
        confidence: 0.9
      },
      {
        patterns: [/angular\.json/],
        secondary: SecondaryClassification.Configuration,
        tertiary: TertiaryClassification.Application,
        confidence: 0.95
      }
    ]);

    // Flask Rules
    this.classificationRules.set('flask', [
      {
        patterns: [/@app\.route/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.Router,
        confidence: 0.9
      },
      {
        patterns: [/class.*\(db\.Model\)/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.Model,
        confidence: 0.9
      }
    ]);

    // FastAPI Rules
    this.classificationRules.set('fastapi', [
      {
        patterns: [/@app\.(get|post|put|delete)/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.Router,
        confidence: 0.9
      },
      {
        patterns: [/class.*\(BaseModel\)/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.Model,
        confidence: 0.9
      }
    ]);

    // Streamlit Rules
    this.classificationRules.set('streamlit', [
      {
        patterns: [/st\.(title|header|subheader)/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.View,
        confidence: 0.9
      },
      {
        patterns: [/st\.(button|selectbox|slider|text_input)/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.StreamlitWidget,
        confidence: 0.9
      },
      {
        patterns: [/st\.sidebar/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.StreamlitLayout,
        confidence: 0.9
      },
      {
        patterns: [/st\.(dataframe|table|chart)/],
        secondary: SecondaryClassification.Code,
        tertiary: TertiaryClassification.Component,
        confidence: 0.9
      }
    ]);
  }

  private analyzeDirectoryContext(filePath: string): DirectoryContext {
    const pathSegments = filePath.split(path.sep);
    const level = pathSegments.length;
    const parentPath = path.dirname(filePath);
    
    // Analyze path segments for framework hints
    const frameworkHints: string[] = [];
    const lowerSegments = pathSegments.map(s => s.toLowerCase());
    
    // Common framework directory patterns
    const frameworkPatterns = {
      'spring-boot': ['src/main/java', 'controller', 'service', 'repository', 'entity'],
      'react': ['src', 'components', 'hooks', 'pages', 'utils'],
      'angular': ['src/app', 'components', 'services', 'modules'],
      'flask': ['templates', 'static', 'models', 'views'],
      'fastapi': ['routers', 'models', 'dependencies', 'schemas'],
      'streamlit': ['pages', 'components', 'utils', 'data', '.streamlit']
    };

    for (const [framework, patterns] of Object.entries(frameworkPatterns)) {
      for (const pattern of patterns) {
        if (lowerSegments.some(segment => pattern.includes(segment) || segment.includes(pattern))) {
          frameworkHints.push(framework);
        }
      }
    }

    return {
      level,
      parentPath,
      siblings: [], // Will be populated if needed
      pathSegments,
      frameworkHints: [...new Set(frameworkHints)] // Remove duplicates
    };
  }

  private async determinePrimaryClassification(
    filePath: string, 
    directoryContext: DirectoryContext
  ): Promise<PrimaryClassification> {
    // Use workspace environment if available
    if (this.workspaceEnvironment) {
      const primary = this.workspaceEnvironment.confidence.primary;
      if (primary.confidence > 0.7) {
        return this.mapFrameworkToPrimary(primary.framework);
      }
    }

    // Fallback to directory context analysis
    const hints = directoryContext.frameworkHints;
    if (hints.length > 0) {
      return this.mapFrameworkToPrimary(hints[0]);
    }

    // File extension based classification
    const ext = path.extname(filePath).toLowerCase();
    if (['.java'].includes(ext)) {
      return PrimaryClassification.SpringBoot;
    }
    if (['.jsx', '.tsx'].includes(ext)) {
      return PrimaryClassification.React;
    }
    if (['.py'].includes(ext)) {
      return PrimaryClassification.Flask; // Default for Python
    }

    return PrimaryClassification.Generic;
  }

  private async determineSecondaryClassification(
    filePath: string,
    fileExtension: string,
    directoryContext: DirectoryContext
  ): Promise<SecondaryClassification> {
    const fileName = path.basename(filePath).toLowerCase();
    const pathLower = filePath.toLowerCase();

    // Test patterns
    if (fileName.includes('test') || fileName.includes('spec') || pathLower.includes('/test/')) {
      return SecondaryClassification.Test;
    }

    // Configuration patterns
    if (['.json', '.yml', '.yaml', '.properties', '.xml', '.env'].includes(fileExtension)) {
      return SecondaryClassification.Configuration;
    }

    // Documentation patterns
    if (['.md', '.txt', '.rst', '.adoc'].includes(fileExtension)) {
      return SecondaryClassification.Documentation;
    }

    // Template patterns
    if (['.html', '.htm', '.jinja2', '.j2', '.mustache', '.handlebars'].includes(fileExtension)) {
      return SecondaryClassification.Template;
    }

    // Static assets
    if (['.css', '.scss', '.sass', '.less', '.js', '.ts', '.png', '.jpg', '.gif', '.svg'].includes(fileExtension)) {
      if (pathLower.includes('static') || pathLower.includes('assets') || pathLower.includes('public')) {
        return SecondaryClassification.Static;
      }
    }

    // Build files
    if (fileName.includes('build') || fileName.includes('dist') || fileName.includes('target')) {
      return SecondaryClassification.Build;
    }

    // Default to code for programming files
    if (['.java', '.py', '.js', '.ts', '.jsx', '.tsx', '.vue', '.php', '.rb', '.go', '.rs'].includes(fileExtension)) {
      return SecondaryClassification.Code;
    }

    return SecondaryClassification.Static;
  }

  private async determineTertiaryClassification(
    filePath: string,
    primary: PrimaryClassification,
    secondary: SecondaryClassification,
    directoryContext: DirectoryContext
  ): Promise<TertiaryClassification> {
    const fileName = path.basename(filePath).toLowerCase();
    const content = await this.getFileContent(filePath);
    
    // Apply framework-specific rules
    const rules = this.classificationRules.get(primary) || [];
    
    for (const rule of rules) {
      if (rule.secondary === secondary) {
        for (const pattern of rule.patterns) {
          if (fileName.match(pattern) || content.match(pattern)) {
            return rule.tertiary;
          }
        }
      }
    }

    // Generic classification based on file name patterns
    if (secondary === SecondaryClassification.Code) {
      if (fileName.includes('controller')) return TertiaryClassification.Controller;
      if (fileName.includes('service')) return TertiaryClassification.Service;
      if (fileName.includes('repository') || fileName.includes('dao')) return TertiaryClassification.Repository;
      if (fileName.includes('model') || fileName.includes('entity')) return TertiaryClassification.Model;
      if (fileName.includes('component')) return TertiaryClassification.Component;
      if (fileName.includes('util') || fileName.includes('helper')) return TertiaryClassification.Utility;
      if (fileName.includes('interface')) return TertiaryClassification.Interface;
      if (fileName.includes('enum')) return TertiaryClassification.Enum;
    }

    if (secondary === SecondaryClassification.Test) {
      if (fileName.includes('e2e') || fileName.includes('integration')) return TertiaryClassification.Integration;
      if (fileName.includes('unit')) return TertiaryClassification.Unit;
    }

    if (secondary === SecondaryClassification.Configuration) {
      if (fileName.includes('application') || fileName.includes('main')) return TertiaryClassification.Application;
      if (fileName.includes('database') || fileName.includes('db')) return TertiaryClassification.Database;
      if (fileName.includes('security')) return TertiaryClassification.Security;
    }

    return TertiaryClassification.Unknown;
  }

  private async analyzeFileContext(filePath: string, directoryContext: DirectoryContext): Promise<FileContext> {
    const content = await this.getFileContent(filePath);
    
    return {
      imports: this.extractImports(content),
      dependencies: this.extractDependencies(content),
      relationships: this.analyzeRelationships(content),
      directoryContext,
      patterns: this.matchPatterns(content, filePath)
    };
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    
    // Java imports
    const javaImports = content.match(/import\s+([a-zA-Z0-9_.]+);/g);
    if (javaImports) {
      imports.push(...javaImports.map(imp => imp.replace('import ', '').replace(';', '').trim()));
    }

    // JavaScript/TypeScript imports
    const jsImports = content.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
    if (jsImports) {
      imports.push(...jsImports.map(imp => {
        const match = imp.match(/from\s+['"]([^'"]+)['"]/);
        return match ? match[1] : '';
      }).filter(Boolean));
    }

    // Python imports
    const pythonImports = content.match(/from\s+([a-zA-Z0-9_.]+)\s+import|import\s+([a-zA-Z0-9_.]+)/g);
    if (pythonImports) {
      imports.push(...pythonImports.map(imp => {
        const fromMatch = imp.match(/from\s+([a-zA-Z0-9_.]+)\s+import/);
        const importMatch = imp.match(/import\s+([a-zA-Z0-9_.]+)/);
        return fromMatch ? fromMatch[1] : (importMatch ? importMatch[1] : '');
      }).filter(Boolean));
    }

    return [...new Set(imports)];
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    // Spring annotations
    const springAnnotations = content.match(/@[A-Z][a-zA-Z]+/g);
    if (springAnnotations) {
      dependencies.push(...springAnnotations);
    }

    // React hooks and components
    const reactPatterns = content.match(/use[A-Z][a-zA-Z]+|React\.[A-Z][a-zA-Z]+/g);
    if (reactPatterns) {
      dependencies.push(...reactPatterns);
    }

    return [...new Set(dependencies)];
  }

  private analyzeRelationships(content: string): FileRelationship[] {
    const relationships: FileRelationship[] = [];
    
    // Inheritance relationships
    const extendsMatch = content.match(/extends\s+([a-zA-Z0-9_]+)/g);
    if (extendsMatch) {
      extendsMatch.forEach(match => {
        const target = match.replace('extends ', '').trim();
        relationships.push({
          type: 'extends',
          target,
          confidence: 0.9
        });
      });
    }

    // Interface implementations
    const implementsMatch = content.match(/implements\s+([a-zA-Z0-9_,\s]+)/g);
    if (implementsMatch) {
      implementsMatch.forEach(match => {
        const targets = match.replace('implements ', '').split(',');
        targets.forEach(target => {
          relationships.push({
            type: 'implements',
            target: target.trim(),
            confidence: 0.9
          });
        });
      });
    }

    return relationships;
  }

  private matchPatterns(content: string, filePath: string): PatternMatch[] {
    const patterns: PatternMatch[] = [];
    const fileName = path.basename(filePath);

    // Framework-specific patterns
    const frameworkPatterns = [
      { pattern: '@SpringBootApplication', category: 'spring-boot-main', confidence: 0.95 },
      { pattern: '@RestController', category: 'spring-controller', confidence: 0.9 },
      { pattern: 'useState', category: 'react-hook', confidence: 0.9 },
      { pattern: '@Component', category: 'angular-component', confidence: 0.9 },
      { pattern: '@app.route', category: 'flask-route', confidence: 0.9 },
      { pattern: '@app.get', category: 'fastapi-route', confidence: 0.9 }
    ];

    frameworkPatterns.forEach(({ pattern, category, confidence }) => {
      if (content.includes(pattern)) {
        patterns.push({ pattern, category, confidence });
      }
    });

    return patterns;
  }

  private calculateClassificationConfidence(
    primary: PrimaryClassification,
    secondary: SecondaryClassification,
    tertiary: TertiaryClassification,
    context: FileContext
  ): number {
    let confidence = 0.5; // Base confidence

    // Boost confidence based on workspace environment
    if (this.workspaceEnvironment) {
      const frameworkConfidence = this.workspaceEnvironment.confidence.overall;
      confidence += frameworkConfidence * 0.3;
    }

    // Boost confidence based on patterns found
    confidence += context.patterns.length * 0.1;

    // Boost confidence based on context richness
    confidence += context.imports.length > 0 ? 0.1 : 0;
    confidence += context.relationships.length > 0 ? 0.1 : 0;

    // Reduce confidence for unknown classifications
    if (tertiary === TertiaryClassification.Unknown) {
      confidence -= 0.2;
    }

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  private async getFileContent(filePath: string): Promise<string> {
    try {
      if (FileUtils.isTextFile(filePath)) {
        return await FileUtils.readFileAsync(filePath);
      }
    } catch (error) {
      // Return empty string if file can't be read
    }
    return '';
  }

  private mapFrameworkToPrimary(framework: string): PrimaryClassification {
    const mapping: Record<string, PrimaryClassification> = {
      'spring boot': PrimaryClassification.SpringBoot,
      'spring-boot': PrimaryClassification.SpringBoot,
      'react': PrimaryClassification.React,
      'angular': PrimaryClassification.Angular,
      'flask': PrimaryClassification.Flask,
      'fastapi': PrimaryClassification.FastAPI,
      'vue': PrimaryClassification.Vue,
      'vue.js': PrimaryClassification.Vue,
      'streamlit': PrimaryClassification.Streamlit
    };

    return mapping[framework.toLowerCase()] || PrimaryClassification.Generic;
  }
}

interface ClassificationRule {
  patterns: RegExp[];
  secondary: SecondaryClassification;
  tertiary: TertiaryClassification;
  confidence: number;
}