import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

export interface FrameworkConfig {
  framework: string;
  key: string;
  type: 'backend' | 'frontend' | 'fullstack' | 'mobile';
  language: string;
  signature_files: string[];
  primary_indicators: string[];
  confidence_thresholds: {
    minimum: number;
    strong: number;
    definitive: number;
  };
  file_types: FileTypeConfig[];
  pattern_weights: PatternWeight[];
}

export interface FileTypeConfig {
  type: string;
  patterns: string[];
  decorators: string[];
  content_patterns: string[];
}

export interface PatternWeight {
  category: string;
  multiplier: number;
}

export interface GlobalSettings {
  max_frameworks_detected: number;
  confidence_boost_for_config_files: number;
  multi_framework_threshold: number;
  ignore_patterns: string[];
  extension_mappings: Record<string, string[]>;
}

export interface FrameworkConfiguration {
  frameworks: FrameworkConfig[];
  global_settings: GlobalSettings;
}

export class FrameworkConfigLoader {
  private static instance: FrameworkConfigLoader;
  private config: FrameworkConfiguration | null = null;
  private configPath: string;
  private individualConfigs: Map<string, any> = new Map();

  private constructor() {
    // Default path relative to the extension root
    this.configPath = path.join(__dirname, '../../config/frameworks.yml');
  }

  static getInstance(): FrameworkConfigLoader {
    if (!FrameworkConfigLoader.instance) {
      FrameworkConfigLoader.instance = new FrameworkConfigLoader();
    }
    return FrameworkConfigLoader.instance;
  }

  setConfigPath(configPath: string): void {
    this.configPath = configPath;
    this.config = null; // Force reload
  }

  async loadConfig(): Promise<FrameworkConfiguration> {
    if (this.config) {
      return this.config;
    }

    try {
      const configContent = await fs.promises.readFile(this.configPath, 'utf8');
      this.config = yaml.parse(configContent) as FrameworkConfiguration;
      
      // Validate the configuration
      this.validateConfig(this.config);
      
      console.log(`📋 Loaded framework configuration with ${this.config.frameworks.length} frameworks`);
      return this.config;
    } catch (error) {
      console.error('Failed to load framework configuration:', error);
      throw new Error(`Failed to load framework configuration from ${this.configPath}: ${error}`);
    }
  }

  async getFrameworkConfig(frameworkKey: string): Promise<FrameworkConfig | null> {
    const config = await this.loadConfig();
    return config.frameworks.find(f => f.key === frameworkKey) || null;
  }

  async getAllFrameworks(): Promise<FrameworkConfig[]> {
    const config = await this.loadConfig();
    return config.frameworks;
  }

  async getGlobalSettings(): Promise<GlobalSettings> {
    const config = await this.loadConfig();
    return config.global_settings;
  }

  async getFrameworksByLanguage(language: string): Promise<FrameworkConfig[]> {
    const config = await this.loadConfig();
    return config.frameworks.filter(f => f.language.toLowerCase() === language.toLowerCase());
  }

  async getFrameworksByType(type: 'backend' | 'frontend' | 'fullstack' | 'mobile'): Promise<FrameworkConfig[]> {
    const config = await this.loadConfig();
    return config.frameworks.filter(f => f.type === type);
  }

  async getFrameworksForExtension(extension: string): Promise<FrameworkConfig[]> {
    const config = await this.loadConfig();
    const frameworkKeys = config.global_settings.extension_mappings[extension] || [];
    
    return config.frameworks.filter(f => frameworkKeys.includes(f.key));
  }

  private validateConfig(config: FrameworkConfiguration): void {
    if (!config.frameworks || !Array.isArray(config.frameworks)) {
      throw new Error('Invalid configuration: frameworks must be an array');
    }

    if (!config.global_settings) {
      throw new Error('Invalid configuration: global_settings is required');
    }

    // Validate each framework configuration
    for (const framework of config.frameworks) {
      this.validateFrameworkConfig(framework);
    }

    // Validate global settings
    this.validateGlobalSettings(config.global_settings);
  }

  private validateFrameworkConfig(framework: FrameworkConfig): void {
    const required = ['framework', 'key', 'type', 'language', 'signature_files', 'primary_indicators'];
    
    for (const field of required) {
      if (!(field in framework)) {
        throw new Error(`Invalid framework configuration: missing required field '${field}' for framework ${framework.framework}`);
      }
    }

    if (!['backend', 'frontend', 'fullstack', 'mobile'].includes(framework.type)) {
      throw new Error(`Invalid framework type '${framework.type}' for framework ${framework.framework}`);
    }

    if (!framework.confidence_thresholds) {
      throw new Error(`Invalid framework configuration: confidence_thresholds required for framework ${framework.framework}`);
    }

    const thresholds = framework.confidence_thresholds;
    if (typeof thresholds.minimum !== 'number' || 
        typeof thresholds.strong !== 'number' || 
        typeof thresholds.definitive !== 'number') {
      throw new Error(`Invalid confidence thresholds for framework ${framework.framework}`);
    }

    if (thresholds.minimum >= thresholds.strong || thresholds.strong >= thresholds.definitive) {
      throw new Error(`Invalid confidence threshold order for framework ${framework.framework}: minimum < strong < definitive`);
    }
  }

  private validateGlobalSettings(settings: GlobalSettings): void {
    const required = ['max_frameworks_detected', 'confidence_boost_for_config_files', 'multi_framework_threshold'];
    
    for (const field of required) {
      if (!(field in settings)) {
        throw new Error(`Invalid global settings: missing required field '${field}'`);
      }
    }

    if (!Array.isArray(settings.ignore_patterns)) {
      throw new Error('Invalid global settings: ignore_patterns must be an array');
    }

    if (typeof settings.extension_mappings !== 'object') {
      throw new Error('Invalid global settings: extension_mappings must be an object');
    }
  }

  // Utility methods for working with the configuration
  async findFrameworksWithSignatureFile(fileName: string): Promise<FrameworkConfig[]> {
    const config = await this.loadConfig();
    return config.frameworks.filter(f => 
      f.signature_files.some(sigFile => 
        sigFile === fileName || 
        new RegExp(sigFile.replace(/\*/g, '.*')).test(fileName)
      )
    );
  }

  async findFrameworksWithIndicator(indicator: string): Promise<FrameworkConfig[]> {
    const config = await this.loadConfig();
    return config.frameworks.filter(f => 
      f.primary_indicators.some(ind => 
        indicator.includes(ind) || 
        new RegExp(ind).test(indicator)
      )
    );
  }

  async findFileTypeConfig(frameworkKey: string, fileName: string, content?: string): Promise<FileTypeConfig | null> {
    const framework = await this.getFrameworkConfig(frameworkKey);
    if (!framework) return null;

    for (const fileType of framework.file_types) {
      // Check file name patterns
      const matchesPattern = fileType.patterns.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(fileName);
      });

      // Check content patterns if content is provided
      let matchesContent = true;
      if (content && fileType.content_patterns.length > 0) {
        matchesContent = fileType.content_patterns.some(pattern => {
          return content.includes(pattern) || new RegExp(pattern).test(content);
        });
      }

      if (matchesPattern && matchesContent) {
        return fileType;
      }
    }

    return null;
  }

  // Hot reload support for development
  async reloadConfig(): Promise<FrameworkConfiguration> {
    this.config = null;
    return this.loadConfig();
  }

  // Export configuration for debugging
  async exportConfig(): Promise<string> {
    const config = await this.loadConfig();
    return yaml.stringify(config);
  }

  // Load individual framework configuration files
  async loadIndividualFrameworkConfig(frameworkName: string): Promise<any> {
    if (this.individualConfigs.has(frameworkName)) {
      return this.individualConfigs.get(frameworkName);
    }

    try {
      const configPath = path.join(__dirname, `../../config/${frameworkName.toLowerCase()}.yml`);
      const configContent = await fs.promises.readFile(configPath, 'utf8');
      const config = yaml.parse(configContent);
      
      this.individualConfigs.set(frameworkName, config);
      console.log(`📋 Loaded individual framework configuration for ${frameworkName}`);
      return config;
    } catch (error) {
      console.warn(`Failed to load individual configuration for ${frameworkName}:`, error);
      return null;
    }
  }

  // Distinguish between AngularJS and Angular 2+ based on file patterns and content
  async detectAngularVersion(projectPath: string, files: string[]): Promise<'angularjs' | 'angular' | null> {
    try {
      // Strong indicators for Angular 2+
      const angular2PlusIndicators = [
        'angular.json',
        'angular-cli.json',
        '.angular-cli.json',
        'tsconfig.json',
        'main.ts',
        'polyfills.ts'
      ];

      // Strong indicators for AngularJS
      const angularJsIndicators = [
        'angular.js',
        'angular.min.js'
      ];

      // Check for definitive file indicators
      const hasAngular2Plus = files.some(file => 
        angular2PlusIndicators.some(indicator => file.includes(indicator))
      );

      const hasAngularJs = files.some(file => 
        angularJsIndicators.some(indicator => file.includes(indicator))
      );

      // If we have strong indicators for either, return that
      if (hasAngular2Plus && !hasAngularJs) return 'angular';
      if (hasAngularJs && !hasAngular2Plus) return 'angularjs';

      // If we have both or neither, examine content patterns
      let angular2PlusScore = 0;
      let angularJsScore = 0;

      // Check TypeScript files for Angular 2+ patterns
      const tsFiles = files.filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'));
      if (tsFiles.length > 0) {
        angular2PlusScore += 10; // TypeScript is strong indicator for Angular 2+
      }

      // Check for component files
      const componentFiles = files.filter(f => f.includes('.component.'));
      angular2PlusScore += componentFiles.length * 5;

      // Check for service files
      const serviceFiles = files.filter(f => f.includes('.service.'));
      angular2PlusScore += serviceFiles.length * 3;

      // Check for module files (both can have these, but pattern differs)
      const moduleFiles = files.filter(f => f.includes('.module.'));
      if (moduleFiles.length > 0) {
        // Need to examine content to differentiate
        angular2PlusScore += moduleFiles.length * 2;
      }

      // Check for AngularJS specific patterns
      const controllerFiles = files.filter(f => f.includes('.controller.'));
      angularJsScore += controllerFiles.length * 5;

      const directiveFiles = files.filter(f => f.includes('.directive.'));
      if (directiveFiles.length > 0) {
        // Directives exist in both, but AngularJS more likely to have separate files
        angularJsScore += directiveFiles.length * 2;
      }

      const filterFiles = files.filter(f => f.includes('.filter.'));
      angularJsScore += filterFiles.length * 5; // Filters are AngularJS specific

      // Check for package.json dependencies if available
      const packageJsonFile = files.find(f => f.endsWith('package.json'));
      if (packageJsonFile) {
        try {
          const packagePath = path.join(projectPath, packageJsonFile);
          const packageContent = await fs.promises.readFile(packagePath, 'utf8');
          const packageJson = JSON.parse(packageContent);
          
          const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
          
          // Check for Angular 2+ packages
          if (dependencies['@angular/core']) angular2PlusScore += 20;
          if (dependencies['@angular/cli']) angular2PlusScore += 15;
          if (dependencies['typescript']) angular2PlusScore += 10;
          if (dependencies['rxjs']) angular2PlusScore += 10;
          
          // Check for AngularJS packages
          if (dependencies['angular'] && !dependencies['@angular/core']) angularJsScore += 20;
          if (dependencies['angular-route']) angularJsScore += 10;
          if (dependencies['angular-resource']) angularJsScore += 10;
          
        } catch (error) {
          console.warn('Failed to read package.json for Angular version detection:', error);
        }
      }

      // Determine result based on scores
      if (angular2PlusScore > angularJsScore && angular2PlusScore > 10) {
        return 'angular';
      } else if (angularJsScore > angular2PlusScore && angularJsScore > 10) {
        return 'angularjs';
      }

      return null; // Cannot determine
    } catch (error) {
      console.error('Error detecting Angular version:', error);
      return null;
    }
  }

  // Get framework configuration with version detection
  async getFrameworkConfigWithVersionDetection(
    frameworkName: string, 
    projectPath: string, 
    files: string[]
  ): Promise<any> {
    // Special handling for Angular vs AngularJS
    if (frameworkName.toLowerCase().includes('angular')) {
      const version = await this.detectAngularVersion(projectPath, files);
      if (version) {
        return await this.loadIndividualFrameworkConfig(version);
      }
    }

    // For other frameworks, load standard configuration
    return await this.loadIndividualFrameworkConfig(frameworkName);
  }

  // Merge custom configuration with default
  async mergeCustomConfig(customConfigPath: string): Promise<void> {
    try {
      const customContent = await fs.promises.readFile(customConfigPath, 'utf8');
      const customConfig = yaml.parse(customContent) as Partial<FrameworkConfiguration>;
      const baseConfig = await this.loadConfig();

      // Merge frameworks
      if (customConfig.frameworks) {
        const customFrameworkKeys = new Set(customConfig.frameworks.map(f => f.key));
        const baseFrameworks = baseConfig.frameworks.filter(f => !customFrameworkKeys.has(f.key));
        baseConfig.frameworks = [...baseFrameworks, ...customConfig.frameworks];
      }

      // Merge global settings
      if (customConfig.global_settings) {
        baseConfig.global_settings = { ...baseConfig.global_settings, ...customConfig.global_settings };
      }

      this.config = baseConfig;
      console.log(`📋 Merged custom configuration from ${customConfigPath}`);
    } catch (error) {
      console.warn(`Failed to merge custom configuration from ${customConfigPath}:`, error);
    }
  }
}