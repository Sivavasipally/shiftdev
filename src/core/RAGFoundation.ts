import * as vscode from 'vscode';
import * as path from 'path';
import { FrameworkDetector, FrameworkInfo } from '../utils/frameworkDetector';
import { FileUtils } from '../utils/fileUtils';
import { FrameworkConfigLoader, FrameworkConfig, GlobalSettings } from '../config/FrameworkConfigLoader';

export interface WorkspaceEnvironment {
  rootPath: string;
  workspaceUri: vscode.Uri;
  detectedFrameworks: FrameworkInfo[];
  projectStructure: ProjectStructure;
  confidence: FrameworkConfidence;
}

export interface ProjectStructure {
  sourceDirectories: string[];
  testDirectories: string[];
  configDirectories: string[];
  buildDirectories: string[];
  documentationDirectories: string[];
  staticAssetDirectories: string[];
}

export interface FrameworkConfidence {
  primary: { framework: string; confidence: number };
  secondary: Array<{ framework: string; confidence: number }>;
  overall: number;
}

// These interfaces are now handled by the FrameworkConfigLoader
// Keeping minimal interfaces for backward compatibility if needed

export class RAGFoundation {
  private frameworkConfigs: Map<string, FrameworkConfig> = new Map();
  private workspaceEnvironment: WorkspaceEnvironment | null = null;
  private configLoader: FrameworkConfigLoader;
  private globalSettings: GlobalSettings | null = null;

  constructor() {
    this.configLoader = FrameworkConfigLoader.getInstance();
    this.initializeFrameworkConfigurations();
  }

  async initializeWorkspace(workspaceUri: vscode.Uri): Promise<WorkspaceEnvironment> {
    console.log('🎯 Phase 1: Initializing RAG Foundation...');
    
    // Ensure configurations are loaded
    await this.ensureConfigLoaded();
    
    const rootPath = workspaceUri.fsPath;
    
    // 1.1 Environment Preparation
    const projectStructure = await this.analyzeProjectStructure(rootPath);
    console.log('📁 Project structure analyzed:', projectStructure);
    
    // 1.2 Framework Detection Strategy
    const detectedFrameworks = await this.detectFrameworksWithConfidence(rootPath);
    console.log('🔍 Frameworks detected:', detectedFrameworks);
    
    const confidence = this.calculateOverallConfidence(detectedFrameworks);
    console.log('📊 Framework confidence:', confidence);
    
    this.workspaceEnvironment = {
      rootPath,
      workspaceUri,
      detectedFrameworks,
      projectStructure,
      confidence
    };
    
    return this.workspaceEnvironment;
  }

  private async initializeFrameworkConfigurations(): Promise<void> {
    try {
      const frameworks = await this.configLoader.getAllFrameworks();
      this.globalSettings = await this.configLoader.getGlobalSettings();
      
      // Load all framework configurations into memory
      for (const framework of frameworks) {
        this.frameworkConfigs.set(framework.key, framework);
      }
      
      console.log(`🔧 Loaded ${frameworks.length} framework configurations from external config`);
    } catch (error) {
      console.error('Failed to load framework configurations:', error);
      // Fallback to basic configurations if external config fails
      this.initializeFallbackConfigurations();
    }
  }

  private initializeFallbackConfigurations(): void {
    console.warn('Using fallback framework configurations');
    // Minimal fallback configurations would go here
    // For now, we'll rely on the external config
  }

  private async analyzeProjectStructure(rootPath: string): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      sourceDirectories: [],
      testDirectories: [],
      configDirectories: [],
      buildDirectories: [],
      documentationDirectories: [],
      staticAssetDirectories: []
    };

    const commonPatterns = {
      source: ['src', 'lib', 'app', 'source', 'main'],
      test: ['test', 'tests', '__tests__', 'spec', 'specs', 'testing'],
      config: ['config', 'conf', 'configuration', 'settings'],
      build: ['build', 'dist', 'target', 'out', 'output', 'bin'],
      docs: ['docs', 'doc', 'documentation', 'readme', 'wiki'],
      static: ['static', 'public', 'assets', 'resources', 'images', 'css', 'js']
    };

    try {
      const files = await this.discoverAllFiles(rootPath);
      
      for (const file of files) {
        const relativePath = path.relative(rootPath, file);
        const pathSegments = relativePath.split(path.sep);
        
        for (const segment of pathSegments) {
          const lowerSegment = segment.toLowerCase();
          
          if (commonPatterns.source.some(pattern => lowerSegment.includes(pattern))) {
            if (!structure.sourceDirectories.includes(path.dirname(file))) {
              structure.sourceDirectories.push(path.dirname(file));
            }
          }
          
          if (commonPatterns.test.some(pattern => lowerSegment.includes(pattern))) {
            if (!structure.testDirectories.includes(path.dirname(file))) {
              structure.testDirectories.push(path.dirname(file));
            }
          }
          
          if (commonPatterns.config.some(pattern => lowerSegment.includes(pattern))) {
            if (!structure.configDirectories.includes(path.dirname(file))) {
              structure.configDirectories.push(path.dirname(file));
            }
          }
          
          if (commonPatterns.build.some(pattern => lowerSegment.includes(pattern))) {
            if (!structure.buildDirectories.includes(path.dirname(file))) {
              structure.buildDirectories.push(path.dirname(file));
            }
          }
          
          if (commonPatterns.docs.some(pattern => lowerSegment.includes(pattern))) {
            if (!structure.documentationDirectories.includes(path.dirname(file))) {
              structure.documentationDirectories.push(path.dirname(file));
            }
          }
          
          if (commonPatterns.static.some(pattern => lowerSegment.includes(pattern))) {
            if (!structure.staticAssetDirectories.includes(path.dirname(file))) {
              structure.staticAssetDirectories.push(path.dirname(file));
            }
          }
        }
      }
    } catch (error) {
      console.warn('Error analyzing project structure:', error);
    }

    return structure;
  }

  private async detectFrameworksWithConfidence(rootPath: string): Promise<FrameworkInfo[]> {
    await this.ensureConfigLoaded();
    
    const frameworks: FrameworkInfo[] = [];
    const confidenceScores = new Map<string, number>();
    const maxFrameworks = this.globalSettings?.max_frameworks_detected || 5;

    for (const [frameworkKey, config] of this.frameworkConfigs) {
      const score = await this.calculateFrameworkScore(rootPath, config);
      confidenceScores.set(frameworkKey, score);
      
      if (score >= config.confidence_thresholds.minimum) {
        const baseFramework = await FrameworkDetector.detectFrameworks(rootPath);
        const matchingFramework = baseFramework.find(f => 
          f.name.toLowerCase().includes(config.framework.toLowerCase())
        );
        
        if (matchingFramework || score >= config.confidence_thresholds.strong) {
          frameworks.push({
            name: config.framework,
            version: matchingFramework?.version,
            type: config.type,
            language: config.language,
            configFiles: matchingFramework?.configFiles || config.signature_files,
            patterns: matchingFramework?.patterns || config.primary_indicators,
            ...(matchingFramework || {}),
            confidence: score // Add confidence score to the framework info
          } as FrameworkInfo & { confidence: number });
        }
      }
    }

    // Sort by confidence score and limit results
    frameworks.sort((a, b) => ((b as any).confidence || 0) - ((a as any).confidence || 0));
    
    return frameworks.slice(0, maxFrameworks);
  }

  private async calculateFrameworkScore(rootPath: string, config: FrameworkConfig): Promise<number> {
    let signatureFileScore = 0;
    let indicatorScore = 0;
    let configFileBoost = 0;
    
    const files = await this.discoverAllFiles(rootPath);
    
    // Check signature files
    for (const sigFile of config.signature_files) {
      const found = files.some(file => {
        const fileName = path.basename(file);
        return fileName === sigFile || new RegExp(sigFile.replace(/\*/g, '.*')).test(fileName);
      });
      if (found) {
        signatureFileScore += 0.3;
        if (this.globalSettings?.confidence_boost_for_config_files) {
          configFileBoost += this.globalSettings.confidence_boost_for_config_files;
        }
      }
    }
    
    // Check primary indicators in file content
    for (const file of files) {
      if (FileUtils.isTextFile(file)) {
        try {
          const content = await FileUtils.readFileAsync(file);
          for (const indicator of config.primary_indicators) {
            if (content.includes(indicator) || new RegExp(indicator).test(content)) {
              indicatorScore += 0.2;
              break; // Only count once per file
            }
          }
        } catch (error) {
          // Skip files we can't read
        }
      }
    }
    
    // Calculate base score
    const baseScore = Math.min(1.0, signatureFileScore + indicatorScore);
    
    // Apply pattern weights
    let weightedScore = baseScore;
    for (const weight of config.pattern_weights) {
      weightedScore *= weight.multiplier;
    }
    
    // Apply config file boost
    weightedScore += configFileBoost;
    
    return Math.min(1.0, Math.max(0.0, weightedScore));
  }

  private async ensureConfigLoaded(): Promise<void> {
    if (this.frameworkConfigs.size === 0) {
      await this.initializeFrameworkConfigurations();
    }
  }


  private calculateOverallConfidence(frameworks: FrameworkInfo[]): FrameworkConfidence {
    if (frameworks.length === 0) {
      return {
        primary: { framework: 'unknown', confidence: 0 },
        secondary: [],
        overall: 0
      };
    }

    const primary = frameworks[0];
    const secondary = frameworks.slice(1, 3);
    const overall = frameworks.reduce((sum, f) => sum + ((f as any).confidence || 0), 0) / frameworks.length;

    return {
      primary: { 
        framework: primary.name, 
        confidence: (primary as any).confidence || 0 
      },
      secondary: secondary.map(f => ({ 
        framework: f.name, 
        confidence: (f as any).confidence || 0 
      })),
      overall
    };
  }

  private async discoverAllFiles(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    const ignorePatterns = this.globalSettings?.ignore_patterns || [
      'node_modules/**', '.git/**', 'target/**', 'build/**', 'dist/**', '__pycache__/**'
    ];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await FileUtils.getFileStats(dir);
        if (!entries || !entries.isDirectory()) return;

        const fs = require('fs');
        const dirEntries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of dirEntries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(rootPath, fullPath);
          
          // Check against global ignore patterns
          const shouldIgnore = ignorePatterns.some(pattern => {
            const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
            return regex.test(relativePath) || regex.test(entry.name);
          });
          
          if (shouldIgnore || FileUtils.shouldIgnoreFile(fullPath, rootPath)) {
            continue;
          }

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    await walk(rootPath);
    return files;
  }

  // New methods for working with the configuration system
  async getFrameworkConfig(frameworkKey: string): Promise<FrameworkConfig | null> {
    await this.ensureConfigLoaded();
    return this.configLoader.getFrameworkConfig(frameworkKey);
  }
  
  async getAllFrameworkConfigs(): Promise<FrameworkConfig[]> {
    await this.ensureConfigLoaded();
    return this.configLoader.getAllFrameworks();
  }
  
  async getGlobalSettings(): Promise<GlobalSettings | null> {
    await this.ensureConfigLoaded();
    return this.globalSettings;
  }
  
  async reloadFrameworkConfigurations(): Promise<void> {
    this.frameworkConfigs.clear();
    this.globalSettings = null;
    await this.configLoader.reloadConfig();
    await this.initializeFrameworkConfigurations();
  }

  getWorkspaceEnvironment(): WorkspaceEnvironment | null {
    return this.workspaceEnvironment;
  }

  getFrameworkConfidence(framework: string): number {
    if (!this.workspaceEnvironment) return 0;
    
    const found = this.workspaceEnvironment.detectedFrameworks.find(f => 
      f.name.toLowerCase().includes(framework.toLowerCase())
    );
    
    return (found as any)?.confidence || 0;
  }
  
  // Enhanced method to get framework info with configuration details
  async getFrameworkInfo(frameworkKey: string): Promise<{config: FrameworkConfig | null, detected: FrameworkInfo | null}> {
    const config = await this.getFrameworkConfig(frameworkKey);
    const detected = this.workspaceEnvironment?.detectedFrameworks.find(f => 
      f.name.toLowerCase() === config?.framework.toLowerCase()
    ) || null;
    
    return { config, detected };
  }
}