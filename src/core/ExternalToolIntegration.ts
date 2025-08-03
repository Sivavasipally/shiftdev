import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ContentChunk } from './ContentProcessor';
import { LLMManager, TaskProfile } from './LLMManager';
import { UserProfile } from '../types';

const execAsync = promisify(exec);

export interface ToolConfiguration {
  name: string;
  enabled: boolean;
  command: string;
  args: string[];
  workingDirectory?: string;
  timeout: number; // milliseconds
  fileTypes: string[]; // File extensions this tool can analyze
  frameworks: string[]; // Frameworks this tool supports
  outputFormat: 'json' | 'xml' | 'text' | 'csv';
  severityLevels: string[]; // e.g., ['error', 'warning', 'info']
  customConfig?: string; // Path to custom config file
}

export interface ToolResult {
  toolName: string;
  filePath: string;
  issues: ToolIssue[];
  metrics: ToolMetrics;
  suggestions: string[];
  executionTime: number;
  success: boolean;
  error?: string;
}

export interface ToolIssue {
  id: string;
  severity: 'error' | 'warning' | 'info' | 'suggestion';
  category: string;
  message: string;
  description?: string;
  line?: number;
  column?: number;
  rule?: string;
  fixable: boolean;
  suggestedFix?: string;
  codeSnippet?: string;
  documentation?: string;
}

export interface ToolMetrics {
  linesOfCode: number;
  complexity: number;
  maintainabilityIndex: number;
  duplication: number;
  coverage?: number;
  performance?: Record<string, number>;
  security?: Record<string, number>;
  quality?: Record<string, number>;
}

export interface IntegrationOptions {
  enabledTools: string[];
  parallelExecution: boolean;
  continueOnError: boolean;
  aggregateResults: boolean;
  enhanceWithAI: boolean; // Use LLM to enhance tool outputs
  customRules: Record<string, any>;
}

export interface EnhancedToolResult extends ToolResult {
  aiEnhancedSuggestions: string[];
  prioritizedIssues: ToolIssue[];
  contextualExplanations: string[];
  frameworkSpecificAdvice: string[];
  relatedPatterns: string[];
}

export class ExternalToolIntegration {
  private tools: Map<string, ToolConfiguration> = new Map();
  private llmManager: LLMManager;

  constructor(userProfile: UserProfile) {
    this.llmManager = LLMManager.getInstance(userProfile);
    this.initializeDefaultTools();
  }

  async analyzeChunk(
    chunk: ContentChunk, 
    options: IntegrationOptions = this.getDefaultOptions()
  ): Promise<EnhancedToolResult[]> {
    console.log(`🔧 Phase 5: Running external tool analysis on ${chunk.id}`);

    const results: EnhancedToolResult[] = [];
    const enabledTools = this.getApplicableTools(chunk, options.enabledTools);

    if (enabledTools.length === 0) {
      console.log(`No applicable tools found for ${chunk.id}`);
      return results;
    }

    // Create temporary file for analysis
    const tempFilePath = await this.createTempFile(chunk);

    try {
      if (options.parallelExecution) {
        // Run tools in parallel
        const promises = enabledTools.map(tool => 
          this.runTool(tool, tempFilePath, chunk, options)
        );
        
        const toolResults = await Promise.allSettled(promises);
        
        for (let i = 0; i < toolResults.length; i++) {
          const result = toolResults[i];
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else if (!options.continueOnError) {
            console.error(`Tool ${enabledTools[i].name} failed:`, result.reason);
            throw result.reason;
          }
        }
      } else {
        // Run tools sequentially
        for (const tool of enabledTools) {
          try {
            const result = await this.runTool(tool, tempFilePath, chunk, options);
            results.push(result);
          } catch (error) {
            console.error(`Tool ${tool.name} failed:`, error);
            if (!options.continueOnError) {
              throw error;
            }
          }
        }
      }

      // Enhance results with AI if enabled
      if (options.enhanceWithAI) {
        await this.enhanceResultsWithAI(results, chunk);
      }

    } finally {
      // Clean up temporary file
      await this.cleanupTempFile(tempFilePath);
    }

    console.log(`🔧 Completed analysis with ${results.length} tool results`);
    return results;
  }

  async analyzeProject(
    projectPath: string,
    options: IntegrationOptions = this.getDefaultOptions()
  ): Promise<Map<string, EnhancedToolResult[]>> {
    console.log(`🔧 Phase 5: Running project-wide analysis on ${projectPath}`);

    const results = new Map<string, EnhancedToolResult[]>();
    const enabledTools = options.enabledTools.map(name => this.tools.get(name)).filter(Boolean) as ToolConfiguration[];

    for (const tool of enabledTools) {
      try {
        const projectResults = await this.runProjectAnalysis(tool, projectPath, options);
        
        for (const [filePath, result] of projectResults) {
          if (!results.has(filePath)) {
            results.set(filePath, []);
          }
          results.get(filePath)!.push(result);
        }
      } catch (error) {
        console.error(`Project analysis failed for ${tool.name}:`, error);
        if (!options.continueOnError) {
          throw error;
        }
      }
    }

    return results;
  }

  private async runTool(
    tool: ToolConfiguration,
    filePath: string,
    chunk: ContentChunk,
    options: IntegrationOptions
  ): Promise<EnhancedToolResult> {
    const startTime = Date.now();

    try {
      // Build command
      const command = this.buildCommand(tool, filePath, options);
      
      // Execute tool
      const { stdout, stderr } = await execAsync(command, {
        timeout: tool.timeout,
        cwd: tool.workingDirectory || process.cwd(),
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      // Parse tool output
      const baseResult = this.parseToolOutput(tool, stdout, stderr, filePath);
      baseResult.executionTime = Date.now() - startTime;

      // Enhance with framework-specific analysis
      const enhanced = await this.enhanceWithFrameworkContext(baseResult, chunk);

      return enhanced;

    } catch (error) {
      return {
        toolName: tool.name,
        filePath,
        issues: [],
        metrics: this.getEmptyMetrics(),
        suggestions: [],
        executionTime: Date.now() - startTime,
        success: false,
        error: String(error),
        aiEnhancedSuggestions: [],
        prioritizedIssues: [],
        contextualExplanations: [],
        frameworkSpecificAdvice: [],
        relatedPatterns: []
      };
    }
  }

  private async runProjectAnalysis(
    tool: ToolConfiguration,
    projectPath: string,
    options: IntegrationOptions
  ): Promise<Map<string, EnhancedToolResult>> {
    const results = new Map<string, EnhancedToolResult>();

    // Build project-level command
    const command = this.buildProjectCommand(tool, projectPath, options);

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: tool.timeout * 5, // Longer timeout for project analysis
        cwd: projectPath,
        maxBuffer: 1024 * 1024 * 50 // 50MB buffer for project results
      });

      // Parse project-level output
      const projectResults = this.parseProjectOutput(tool, stdout, stderr, projectPath);
      
      for (const [filePath, result] of projectResults) {
        results.set(filePath, result);
      }

    } catch (error) {
      console.error(`Project analysis failed for ${tool.name}:`, error);
    }

    return results;
  }

  private buildCommand(tool: ToolConfiguration, filePath: string, options: IntegrationOptions): string {
    let command = tool.command;
    
    // Add tool-specific arguments
    const args = [...tool.args];
    
    // Add custom configuration if available
    if (tool.customConfig) {
      args.push('--config', tool.customConfig);
    }

    // Add output format specification
    switch (tool.outputFormat) {
      case 'json':
        args.push('--format', 'json');
        break;
      case 'xml':
        args.push('--format', 'xml');
        break;
    }

    // Tool-specific command building
    switch (tool.name) {
      case 'eslint':
        args.push('--no-eslintrc', '--format', 'json', filePath);
        break;
      case 'sonarjs':
        args.push('--format', 'json', filePath);
        break;
      case 'bandit':
        args.push('-f', 'json', filePath);
        break;
      case 'pylint':
        args.push('--output-format=json', filePath);
        break;
      case 'checkstyle':
        args.push('-f', 'xml', filePath);
        break;
      case 'pmd':
        args.push('-format', 'json', '-files', filePath);
        break;
      default:
        args.push(filePath);
    }

    return `${command} ${args.join(' ')}`;
  }

  private buildProjectCommand(tool: ToolConfiguration, projectPath: string, options: IntegrationOptions): string {
    let command = tool.command;
    const args = [...tool.args];

    // Add custom configuration if available
    if (tool.customConfig) {
      args.push('--config', tool.customConfig);
    }

    // Tool-specific project command building
    switch (tool.name) {
      case 'eslint':
        args.push('--format', 'json', `${projectPath}/**/*.{js,ts,jsx,tsx}`);
        break;
      case 'sonarjs':
        args.push('--format', 'json', projectPath);
        break;
      case 'bandit':
        args.push('-r', '-f', 'json', projectPath);
        break;
      case 'pylint':
        args.push('--output-format=json', `${projectPath}/**/*.py`);
        break;
      case 'checkstyle':
        args.push('-r', projectPath);
        break;
      default:
        args.push(projectPath);
    }

    return `${command} ${args.join(' ')}`;
  }

  private parseToolOutput(
    tool: ToolConfiguration,
    stdout: string,
    stderr: string,
    filePath: string
  ): ToolResult {
    const baseResult: ToolResult = {
      toolName: tool.name,
      filePath,
      issues: [],
      metrics: this.getEmptyMetrics(),
      suggestions: [],
      executionTime: 0,
      success: true
    };

    try {
      switch (tool.name) {
        case 'eslint':
          return this.parseESLintOutput(stdout, baseResult);
        case 'sonarjs':
          return this.parseSonarJSOutput(stdout, baseResult);
        case 'bandit':
          return this.parseBanditOutput(stdout, baseResult);
        case 'pylint':
          return this.parsePylintOutput(stdout, baseResult);
        case 'checkstyle':
          return this.parseCheckstyleOutput(stdout, baseResult);
        case 'pmd':
          return this.parsePMDOutput(stdout, baseResult);
        default:
          return this.parseGenericOutput(stdout, stderr, baseResult);
      }
    } catch (error) {
      baseResult.success = false;
      baseResult.error = `Failed to parse ${tool.name} output: ${error}`;
      return baseResult;
    }
  }

  private parseESLintOutput(stdout: string, baseResult: ToolResult): ToolResult {
    try {
      const eslintResults = JSON.parse(stdout);
      
      for (const fileResult of eslintResults) {
        for (const message of fileResult.messages) {
          baseResult.issues.push({
            id: `eslint-${message.ruleId || 'unknown'}`,
            severity: message.severity === 2 ? 'error' : 'warning',
            category: 'code-quality',
            message: message.message,
            line: message.line,
            column: message.column,
            rule: message.ruleId,
            fixable: message.fix !== undefined,
            suggestedFix: message.fix ? this.extractESLintFix(message.fix) : undefined
          });
        }
        
        // Extract metrics
        baseResult.metrics.linesOfCode = fileResult.source?.split('\n').length || 0;
      }
    } catch (error) {
      baseResult.error = `Failed to parse ESLint output: ${error}`;
    }

    return baseResult;
  }

  private parseSonarJSOutput(stdout: string, baseResult: ToolResult): ToolResult {
    try {
      const sonarResults = JSON.parse(stdout);
      
      for (const issue of sonarResults.issues || []) {
        baseResult.issues.push({
          id: `sonar-${issue.rule}`,
          severity: this.mapSonarSeverity(issue.severity),
          category: issue.type || 'code-quality',
          message: issue.message,
          line: issue.line,
          column: issue.column,
          rule: issue.rule,
          fixable: false, // SonarJS typically doesn't provide auto-fixes
          description: issue.description
        });
      }

      // Extract metrics if available
      if (sonarResults.metrics) {
        baseResult.metrics.complexity = sonarResults.metrics.complexity || 0;
        baseResult.metrics.duplication = sonarResults.metrics.duplication || 0;
      }
    } catch (error) {
      baseResult.error = `Failed to parse SonarJS output: ${error}`;
    }

    return baseResult;
  }

  private parseBanditOutput(stdout: string, baseResult: ToolResult): ToolResult {
    try {
      const banditResults = JSON.parse(stdout);
      
      for (const result of banditResults.results || []) {
        baseResult.issues.push({
          id: `bandit-${result.test_id}`,
          severity: this.mapBanditSeverity(result.issue_severity),
          category: 'security',
          message: result.issue_text,
          line: result.line_number,
          rule: result.test_id,
          fixable: false,
          description: result.issue_text,
          codeSnippet: result.code
        });
      }

      // Extract security metrics
      if (banditResults.metrics) {
        baseResult.metrics.security = {
          highSeverityIssues: banditResults.metrics._totals?.SEVERITY?.HIGH || 0,
          mediumSeverityIssues: banditResults.metrics._totals?.SEVERITY?.MEDIUM || 0,
          lowSeverityIssues: banditResults.metrics._totals?.SEVERITY?.LOW || 0
        };
      }
    } catch (error) {
      baseResult.error = `Failed to parse Bandit output: ${error}`;
    }

    return baseResult;
  }

  private parsePylintOutput(stdout: string, baseResult: ToolResult): ToolResult {
    try {
      const pylintResults = JSON.parse(stdout);
      
      for (const message of pylintResults) {
        baseResult.issues.push({
          id: `pylint-${message.symbol}`,
          severity: this.mapPylintSeverity(message.type),
          category: message.category || 'code-quality',
          message: message.message,
          line: message.line,
          column: message.column,
          rule: message.symbol,
          fixable: false
        });
      }
    } catch (error) {
      baseResult.error = `Failed to parse Pylint output: ${error}`;
    }

    return baseResult;
  }

  private parseCheckstyleOutput(stdout: string, baseResult: ToolResult): ToolResult {
    // Parse XML output from Checkstyle
    // This would need an XML parser in a real implementation
    try {
      // Simplified parsing - in practice, use a proper XML parser
      const errorMatches = stdout.match(/<error[^>]*>/g) || [];
      
      for (const errorMatch of errorMatches) {
        const lineMatch = errorMatch.match(/line="(\d+)"/);
        const severityMatch = errorMatch.match(/severity="([^"]*)"/);
        const messageMatch = errorMatch.match(/message="([^"]*)"/);
        
        if (messageMatch) {
          baseResult.issues.push({
            id: 'checkstyle-issue',
            severity: severityMatch ? this.mapCheckstyleSeverity(severityMatch[1]) : 'warning',
            category: 'code-style',
            message: messageMatch[1],
            line: lineMatch ? parseInt(lineMatch[1]) : undefined,
            rule: 'checkstyle',
            fixable: false
          });
        }
      }
    } catch (error) {
      baseResult.error = `Failed to parse Checkstyle output: ${error}`;
    }

    return baseResult;
  }

  private parsePMDOutput(stdout: string, baseResult: ToolResult): ToolResult {
    try {
      const pmdResults = JSON.parse(stdout);
      
      for (const violation of pmdResults.violations || []) {
        baseResult.issues.push({
          id: `pmd-${violation.rule}`,
          severity: this.mapPMDSeverity(violation.priority),
          category: 'code-quality',
          message: violation.description,
          line: violation.beginline,
          column: violation.begincolumn,
          rule: violation.rule,
          fixable: false
        });
      }
    } catch (error) {
      baseResult.error = `Failed to parse PMD output: ${error}`;
    }

    return baseResult;
  }

  private parseGenericOutput(stdout: string, stderr: string, baseResult: ToolResult): ToolResult {
    // Generic parser for tools that don't have specific parsers
    const lines = stdout.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Try to extract basic issue information
      const parts = line.split(':');
      if (parts.length >= 3) {
        baseResult.issues.push({
          id: 'generic-issue',
          severity: 'info',
          category: 'generic',
          message: parts.slice(2).join(':').trim(),
          line: parseInt(parts[1]) || undefined,
          rule: 'generic',
          fixable: false
        });
      }
    }

    if (stderr) {
      baseResult.error = stderr;
    }

    return baseResult;
  }

  private parseProjectOutput(
    tool: ToolConfiguration,
    stdout: string,
    stderr: string,
    projectPath: string
  ): Map<string, EnhancedToolResult> {
    const results = new Map<string, EnhancedToolResult>();

    try {
      switch (tool.name) {
        case 'eslint':
          const eslintResults = JSON.parse(stdout);
          for (const fileResult of eslintResults) {
            const relativePath = path.relative(projectPath, fileResult.filePath);
            const result = this.parseESLintOutput(JSON.stringify([fileResult]), {
              toolName: tool.name,
              filePath: relativePath,
              issues: [],
              metrics: this.getEmptyMetrics(),
              suggestions: [],
              executionTime: 0,
              success: true
            });
            
            results.set(relativePath, result as EnhancedToolResult);
          }
          break;
        // Add other project-level parsers as needed
      }
    } catch (error) {
      console.error(`Failed to parse project output for ${tool.name}:`, error);
    }

    return results;
  }

  private async enhanceResultsWithAI(results: EnhancedToolResult[], chunk: ContentChunk): Promise<void> {
    console.log(`🤖 Enhancing tool results with AI analysis`);

    for (const result of results) {
      try {
        await this.enhanceIndividualResult(result, chunk);
      } catch (error) {
        console.warn(`Failed to enhance result for ${result.toolName}:`, error);
      }
    }
  }

  private async enhanceIndividualResult(result: EnhancedToolResult, chunk: ContentChunk): Promise<void> {
    const taskProfile: TaskProfile = {
      taskType: 'analysis',
      priority: 'medium',
      requiresAccuracy: true
    };

    // Build enhancement prompt
    const prompt = this.buildEnhancementPrompt(result, chunk);

    try {
      const llmResponse = await this.llmManager.generateResponse([
        { role: 'system', content: 'You are an expert code analysis assistant. Enhance the tool analysis results with contextual insights and actionable recommendations.' },
        { role: 'user', content: prompt }
      ], taskProfile);

      const enhanced = this.parseAIEnhancement(llmResponse.content);
      
      result.aiEnhancedSuggestions = enhanced.suggestions || [];
      result.prioritizedIssues = this.prioritizeIssues(result.issues, enhanced.priorities);
      result.contextualExplanations = enhanced.explanations || [];
      result.frameworkSpecificAdvice = enhanced.frameworkAdvice || [];
      result.relatedPatterns = enhanced.patterns || [];

    } catch (error) {
      console.warn(`AI enhancement failed:`, error);
    }
  }

  private buildEnhancementPrompt(result: ToolResult, chunk: ContentChunk): string {
    let prompt = `Analyze and enhance this code analysis result:\n\n`;
    prompt += `Tool: ${result.toolName}\n`;
    prompt += `File: ${result.filePath}\n`;
    prompt += `Framework: ${chunk.metadata.framework || 'Unknown'}\n`;
    prompt += `File Type: ${chunk.metadata.type}\n\n`;

    prompt += `Issues Found (${result.issues.length}):\n`;
    result.issues.slice(0, 10).forEach((issue, i) => {
      prompt += `${i + 1}. [${issue.severity}] ${issue.message} (${issue.rule})\n`;
    });

    prompt += `\nCode Sample:\n\`\`\`\n${chunk.content.substring(0, 1000)}\n\`\`\`\n\n`;

    prompt += `Please provide:
1. Enhanced suggestions (3-5 actionable recommendations)
2. Issue priorities (rank issues by importance)
3. Contextual explanations (why these issues matter)
4. Framework-specific advice (best practices for ${chunk.metadata.framework})
5. Related patterns (design patterns or practices that could help)

Return as JSON with keys: suggestions, priorities, explanations, frameworkAdvice, patterns`;

    return prompt;
  }

  private parseAIEnhancement(content: string): any {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.warn('Failed to parse AI enhancement JSON:', error);
    }

    return {
      suggestions: [],
      priorities: {},
      explanations: [],
      frameworkAdvice: [],
      patterns: []
    };
  }

  private prioritizeIssues(issues: ToolIssue[], priorities: Record<string, number>): ToolIssue[] {
    return issues.sort((a, b) => {
      const priorityA = priorities[a.id] || this.getDefaultPriority(a);
      const priorityB = priorities[b.id] || this.getDefaultPriority(b);
      return priorityB - priorityA;
    });
  }

  private getDefaultPriority(issue: ToolIssue): number {
    switch (issue.severity) {
      case 'error': return 10;
      case 'warning': return 7;
      case 'info': return 4;
      case 'suggestion': return 2;
      default: return 5;
    }
  }

  private async enhanceWithFrameworkContext(result: ToolResult, chunk: ContentChunk): Promise<EnhancedToolResult> {
    const enhanced: EnhancedToolResult = {
      ...result,
      aiEnhancedSuggestions: [],
      prioritizedIssues: result.issues,
      contextualExplanations: [],
      frameworkSpecificAdvice: [],
      relatedPatterns: []
    };

    // Add framework-specific advice based on detected framework
    const framework = chunk.metadata.framework?.toLowerCase();
    if (framework) {
      enhanced.frameworkSpecificAdvice = this.getFrameworkSpecificAdvice(framework, result.issues);
    }

    return enhanced;
  }

  private getFrameworkSpecificAdvice(framework: string, issues: ToolIssue[]): string[] {
    const advice: string[] = [];

    switch (framework) {
      case 'react':
        if (issues.some(i => i.message.includes('useState'))) {
          advice.push('Consider using useCallback and useMemo for performance optimization');
        }
        if (issues.some(i => i.message.includes('key'))) {
          advice.push('Always provide stable keys for list items in React');
        }
        break;
      
      case 'spring-boot':
        if (issues.some(i => i.message.includes('@Autowired'))) {
          advice.push('Consider using constructor injection instead of field injection');
        }
        if (issues.some(i => i.message.includes('Exception'))) {
          advice.push('Use @ControllerAdvice for global exception handling');
        }
        break;

      case 'angular':
        if (issues.some(i => i.message.includes('OnInit'))) {
          advice.push('Implement OnDestroy to prevent memory leaks');
        }
        break;
    }

    return advice;
  }

  // Tool management methods
  private getApplicableTools(chunk: ContentChunk, enabledToolNames: string[]): ToolConfiguration[] {
    const applicableTools: ToolConfiguration[] = [];
    const fileExtension = this.getFileExtension(chunk.id);
    const framework = chunk.metadata.framework?.toLowerCase();

    for (const toolName of enabledToolNames) {
      const tool = this.tools.get(toolName);
      if (!tool || !tool.enabled) continue;

      // Check if tool supports this file type
      if (tool.fileTypes.length > 0 && !tool.fileTypes.includes(fileExtension)) {
        continue;
      }

      // Check if tool supports this framework
      if (tool.frameworks.length > 0 && framework && !tool.frameworks.some(f => f.toLowerCase() === framework)) {
        continue;
      }

      applicableTools.push(tool);
    }

    return applicableTools;
  }

  private getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase().substring(1);
  }

  private async createTempFile(chunk: ContentChunk): Promise<string> {
    const extension = this.getFileExtension(chunk.id) || 'txt';
    const tempPath = path.join('/tmp', `chunk_${Date.now()}.${extension}`);
    
    await fs.writeFile(tempPath, chunk.content, 'utf8');
    return tempPath;
  }

  private async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.warn(`Failed to cleanup temp file ${filePath}:`, error);
    }
  }

  private getEmptyMetrics(): ToolMetrics {
    return {
      linesOfCode: 0,
      complexity: 0,
      maintainabilityIndex: 0,
      duplication: 0
    };
  }

  // Severity mapping methods
  private mapSonarSeverity(severity: string): 'error' | 'warning' | 'info' | 'suggestion' {
    switch (severity?.toLowerCase()) {
      case 'blocker':
      case 'critical': return 'error';
      case 'major': return 'warning';
      case 'minor': return 'info';
      case 'info': return 'suggestion';
      default: return 'warning';
    }
  }

  private mapBanditSeverity(severity: string): 'error' | 'warning' | 'info' | 'suggestion' {
    switch (severity?.toLowerCase()) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'warning';
    }
  }

  private mapPylintSeverity(type: string): 'error' | 'warning' | 'info' | 'suggestion' {
    switch (type?.toLowerCase()) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'refactor': return 'suggestion';
      case 'convention': return 'info';
      default: return 'warning';
    }
  }

  private mapCheckstyleSeverity(severity: string): 'error' | 'warning' | 'info' | 'suggestion' {
    switch (severity?.toLowerCase()) {
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'warning';
    }
  }

  private mapPMDSeverity(priority: number): 'error' | 'warning' | 'info' | 'suggestion' {
    if (priority <= 2) return 'error';
    if (priority <= 3) return 'warning';
    if (priority <= 4) return 'info';
    return 'suggestion';
  }

  private extractESLintFix(fix: any): string {
    return fix.text || 'Auto-fix available';
  }

  private getDefaultOptions(): IntegrationOptions {
    return {
      enabledTools: ['eslint', 'sonarjs', 'bandit', 'pylint'],
      parallelExecution: true,
      continueOnError: true,
      aggregateResults: true,
      enhanceWithAI: true,
      customRules: {}
    };
  }

  private initializeDefaultTools(): void {
    // ESLint configuration
    this.tools.set('eslint', {
      name: 'eslint',
      enabled: true,
      command: 'npx eslint',
      args: [],
      timeout: 30000,
      fileTypes: ['js', 'jsx', 'ts', 'tsx', 'vue'],
      frameworks: ['react', 'angular', 'vue', 'node'],
      outputFormat: 'json',
      severityLevels: ['error', 'warning']
    });

    // SonarJS configuration
    this.tools.set('sonarjs', {
      name: 'sonarjs',
      enabled: true,
      command: 'sonar-scanner',
      args: [],
      timeout: 60000,
      fileTypes: ['js', 'jsx', 'ts', 'tsx'],
      frameworks: ['react', 'angular', 'vue', 'node'],
      outputFormat: 'json',
      severityLevels: ['blocker', 'critical', 'major', 'minor', 'info']
    });

    // Bandit configuration
    this.tools.set('bandit', {
      name: 'bandit',
      enabled: true,
      command: 'bandit',
      args: [],
      timeout: 30000,
      fileTypes: ['py'],
      frameworks: ['django', 'flask', 'fastapi'],
      outputFormat: 'json',
      severityLevels: ['high', 'medium', 'low']
    });

    // Pylint configuration
    this.tools.set('pylint', {
      name: 'pylint',
      enabled: true,
      command: 'pylint',
      args: [],
      timeout: 45000,
      fileTypes: ['py'],
      frameworks: ['django', 'flask', 'fastapi'],
      outputFormat: 'json',
      severityLevels: ['error', 'warning', 'refactor', 'convention']
    });

    // Checkstyle configuration
    this.tools.set('checkstyle', {
      name: 'checkstyle',
      enabled: true,
      command: 'checkstyle',
      args: [],
      timeout: 30000,
      fileTypes: ['java'],
      frameworks: ['spring-boot', 'spring'],
      outputFormat: 'xml',
      severityLevels: ['error', 'warning', 'info']
    });

    // PMD configuration
    this.tools.set('pmd', {
      name: 'pmd',
      enabled: true,
      command: 'pmd',
      args: [],
      timeout: 45000,
      fileTypes: ['java'],
      frameworks: ['spring-boot', 'spring'],
      outputFormat: 'json',
      severityLevels: ['1', '2', '3', '4', '5']
    });
  }

  // Public API methods
  addTool(tool: ToolConfiguration): void {
    this.tools.set(tool.name, tool);
  }

  removeTool(toolName: string): void {
    this.tools.delete(toolName);
  }

  updateTool(toolName: string, updates: Partial<ToolConfiguration>): void {
    const existing = this.tools.get(toolName);
    if (existing) {
      this.tools.set(toolName, { ...existing, ...updates });
    }
  }

  getAvailableTools(): ToolConfiguration[] {
    return Array.from(this.tools.values());
  }

  getToolByName(name: string): ToolConfiguration | undefined {
    return this.tools.get(name);
  }

  async validateToolInstallation(toolName: string): Promise<boolean> {
    const tool = this.tools.get(toolName);
    if (!tool) return false;

    try {
      await execAsync(`${tool.command} --version`, { timeout: 5000 });
      return true;
    } catch (error) {
      return false;
    }
  }

  async getInstalledTools(): Promise<string[]> {
    const installedTools: string[] = [];
    
    for (const [name, tool] of this.tools) {
      if (await this.validateToolInstallation(name)) {
        installedTools.push(name);
      }
    }
    
    return installedTools;
  }
}