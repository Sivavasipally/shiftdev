import { VectorDB } from '../core/VectorDB';
import { LLMManager } from '../core/LLMManager';
import { EnhancedQueryHandler, EnhancedQueryResponse } from '../core/EnhancedQueryHandler';
import { IncrementalIndexer } from '../core/IncrementalIndexer';
import { APIDocumentation } from '../core/EndpointDetector';

export interface QueryRequest {
  query: string;
  projectPath?: string;
  options?: QueryOptions;
}

export interface QueryOptions {
  includeOverview?: boolean;
  maxResults?: number;
  forceRefreshOverview?: boolean;
  includeCodeContext?: boolean;
  responseFormat?: 'detailed' | 'concise' | 'technical';
}

export interface FormattedResponse {
  content: string;
  metadata: {
    processingTime: number;
    confidence: number;
    usedOverview: boolean;
    foundRelevantCode: number;
  };
  suggestions?: string[];
}

export class QueryResponseSystem {
  private vectorDB: VectorDB;
  private llmManager: LLMManager;
  private queryHandler: EnhancedQueryHandler;
  private incrementalIndexer: IncrementalIndexer;
  private projectPath: string | null = null;

  constructor(vectorDBConfig: any = {}) {
    this.vectorDB = new VectorDB(vectorDBConfig);
    this.llmManager = new LLMManager();
    this.queryHandler = new EnhancedQueryHandler(this.vectorDB, this.llmManager, '');
    this.incrementalIndexer = new IncrementalIndexer(this.vectorDB, '');
  }

  async initialize(projectPath: string): Promise<void> {
    console.log('🚀 Initializing Query Response System...');
    
    try {
      this.projectPath = projectPath;
      
      // Initialize components
      await this.vectorDB.initialize();
      await this.llmManager.initialize();
      
      // Update query handler with project path
      this.queryHandler = new EnhancedQueryHandler(this.vectorDB, this.llmManager, projectPath);
      this.incrementalIndexer = new IncrementalIndexer(this.vectorDB, projectPath);

      // Check if incremental update is needed
      await this.checkAndUpdateIndex();

      // Preload overview for common queries
      await this.queryHandler.preloadOverview(projectPath);

      console.log('✅ Query Response System initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Query Response System:', error);
      throw error;
    }
  }

  async processQuery(request: QueryRequest): Promise<FormattedResponse> {
    console.log(`📥 Processing query: "${request.query}"`);
    
    try {
      // Use project path from request or fallback to initialized path
      const projectPath = request.projectPath || this.projectPath;
      
      if (!projectPath) {
        throw new Error('No project path available. Please initialize the system or provide a project path.');
      }

      // Set default options
      const options: QueryOptions = {
        includeOverview: this.shouldIncludeOverview(request.query),
        maxResults: 10,
        forceRefreshOverview: false,
        includeCodeContext: true,
        responseFormat: 'detailed',
        ...request.options
      };

      // Process the query
      const response = await this.queryHandler.handleQuery(
        request.query,
        projectPath,
        {
          includeOverview: options.includeOverview,
          maxResults: options.maxResults,
          forceRefreshOverview: options.forceRefreshOverview
        }
      );

      // Format the response
      const formattedResponse = await this.formatResponse(response, options);

      console.log(`✅ Query processed successfully (confidence: ${(response.confidence * 100).toFixed(1)}%)`);
      
      return formattedResponse;

    } catch (error) {
      console.error('❌ Failed to process query:', error);
      
      return {
        content: this.generateErrorResponse(request.query, error),
        metadata: {
          processingTime: 0,
          confidence: 0,
          usedOverview: false,
          foundRelevantCode: 0
        }
      };
    }
  }

  private shouldIncludeOverview(query: string): boolean {
    const overviewKeywords = [
      'overview', 'explain the code', 'entire source', 'whole project',
      'codebase', 'architecture', 'structure', 'how does this work',
      'what does this do', 'general explanation', 'summary',
      'give overview', 'describe the project', 'explain the system'
    ];

    const lowerQuery = query.toLowerCase();
    return overviewKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  private shouldIncludeEndpoints(query: string): boolean {
    const endpointKeywords = [
      'all endpoints', 'list endpoints', 'show endpoints', 'api endpoints',
      'all routes', 'list routes', 'show routes', 'available apis',
      'rest endpoints', 'http endpoints', 'web apis', 'api documentation',
      'endpoints available', 'what apis', 'available endpoints',
      'show me apis', 'list apis', 'get endpoints', 'give me all endpoints'
    ];

    const lowerQuery = query.toLowerCase();
    return endpointKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  private async formatResponse(
    response: EnhancedQueryResponse,
    options: QueryOptions
  ): Promise<FormattedResponse> {
    let content = '';

    // Main answer
    content += response.answer;

    // Add codebase overview if included and format is detailed
    if (response.codebaseOverview && options.responseFormat === 'detailed') {
      content += '\n\n## 📊 Codebase Overview\n';
      content += this.formatCodebaseOverview(response.codebaseOverview);
    }

    // Add API documentation if included
    if (response.apiDocumentation) {
      content += '\n\n## 🌐 API Endpoints\n';
      content += this.formatAPIDocumentation(response.apiDocumentation, options.responseFormat || 'detailed');
    }

    // Add relevant code context if requested
    if (options.includeCodeContext && response.relevantCode.length > 0) {
      content += '\n\n## 💻 Relevant Code\n';
      content += this.formatRelevantCode(response.relevantCode, options.responseFormat || 'detailed');
    }

    // Add recommendations if any
    if (response.recommendations.length > 0) {
      content += '\n\n## 💡 Recommendations\n';
      response.recommendations.forEach((rec, index) => {
        content += `${index + 1}. ${rec}\n`;
      });
    }

    // Prepare suggestions (follow-up questions)
    const suggestions = response.followUpQuestions.length > 0 
      ? response.followUpQuestions 
      : undefined;

    return {
      content: content.trim(),
      metadata: {
        processingTime: response.processingMetadata.processingTimeMs,
        confidence: response.confidence,
        usedOverview: response.processingMetadata.usedOverview,
        foundRelevantCode: response.relevantCode.length
      },
      suggestions
    };
  }

  private formatCodebaseOverview(overview: any): string {
    let content = '';

    // Project summary
    content += `**${overview.summary.projectName}**\n`;
    content += `${overview.summary.description}\n\n`;

    // Key statistics
    content += `📈 **Statistics:**\n`;
    content += `- Files: ${overview.summary.totalFiles.toLocaleString()}\n`;
    content += `- Lines of Code: ${overview.summary.totalLines.toLocaleString()}\n`;
    content += `- Languages: ${overview.summary.primaryLanguages.slice(0, 3).map(l => `${l.language} (${l.percentage.toFixed(1)}%)`).join(', ')}\n`;
    content += `- Architecture: ${overview.architecture.type}\n`;
    content += `- Complexity: ${overview.summary.estimatedComplexity}\n`;
    content += `- Maturity: ${overview.summary.maturityLevel}\n\n`;

    // Frameworks
    if (overview.frameworks.length > 0) {
      content += `🔧 **Frameworks & Technologies:**\n`;
      overview.frameworks.slice(0, 5).forEach((framework: any) => {
        content += `- ${framework.name} (${(framework.confidence * 100).toFixed(0)}% confidence)\n`;
      });
      content += '\n';
    }

    // Key components
    if (overview.keyComponents.length > 0) {
      content += `🏗️ **Key Components:**\n`;
      overview.keyComponents.slice(0, 5).forEach((component: any) => {
        content += `- **${component.name}**: ${component.purpose}\n`;
      });
      content += '\n';
    }

    // Architecture insights
    if (overview.architecture.services.length > 0) {
      content += `🏛️ **Architecture:**\n`;
      content += `- Services: ${overview.architecture.services.length}\n`;
      content += `- Organization: ${overview.structure.organizationPattern}\n`;
      if (overview.structure.testStructure.framework !== 'Unknown') {
        content += `- Test Framework: ${overview.structure.testStructure.framework}\n`;
      }
    }

    return content;
  }

  private formatRelevantCode(relevantCode: any[], format: string): string {
    let content = '';

    const limit = format === 'concise' ? 2 : 5;
    
    relevantCode.slice(0, limit).forEach((code, index) => {
      content += `### ${index + 1}. ${code.filePath}\n`;
      content += `${code.explanation}\n\n`;
      
      if (format === 'detailed' || format === 'technical') {
        // Show code with syntax highlighting hint
        const language = this.detectLanguageFromPath(code.filePath);
        content += `\`\`\`${language}\n`;
        content += code.content.length > 500 
          ? code.content.substring(0, 500) + '\n// ... (truncated)\n'
          : code.content;
        content += '\n```\n\n';
      }
    });

    if (relevantCode.length > limit) {
      content += `*... and ${relevantCode.length - limit} more relevant sections*\n`;
    }

    return content;
  }

  private formatAPIDocumentation(apiDoc: APIDocumentation, format: string): string {
    let content = '';

    // Summary
    content += `📊 **Summary:**\n`;
    content += `- Total Endpoints: ${apiDoc.totalEndpoints}\n`;
    content += `- HTTP Methods: ${Object.entries(apiDoc.endpointsByMethod).map(([method, count]) => `${method}: ${count}`).join(', ')}\n`;
    content += `- Frameworks: ${Object.entries(apiDoc.endpointsByFramework).map(([framework, count]) => `${framework}: ${count}`).join(', ')}\n\n`;

    if (format === 'concise') {
      // Concise format - just list endpoints
      content += `🔗 **Endpoints:**\n`;
      apiDoc.allEndpoints.slice(0, 10).forEach(endpoint => {
        content += `- **${endpoint.method} ${endpoint.path}** (${endpoint.framework})\n`;
      });
      
      if (apiDoc.allEndpoints.length > 10) {
        content += `*... and ${apiDoc.allEndpoints.length - 10} more endpoints*\n`;
      }
    } else {
      // Detailed format - group by base path
      for (const group of apiDoc.groups) {
        content += `### ${group.name}\n`;
        if (group.description) {
          content += `*${group.description}*\n\n`;
        }

        for (const endpoint of group.endpoints) {
          content += `**${endpoint.method} ${endpoint.path}**\n`;
          content += `- Handler: \`${endpoint.handler}\`\n`;
          content += `- File: \`${endpoint.filePath}\`${endpoint.lineNumber ? ` (line ${endpoint.lineNumber})` : ''}\n`;
          content += `- Framework: ${endpoint.framework}\n`;
          
          if (endpoint.description) {
            content += `- Description: ${endpoint.description}\n`;
          }
          
          if (endpoint.parameters && endpoint.parameters.length > 0) {
            content += `- Parameters: ${endpoint.parameters.map(p => `\`${p.name}\` (${p.type})`).join(', ')}\n`;
          }
          
          if (endpoint.middleware && endpoint.middleware.length > 0) {
            content += `- Middleware: ${endpoint.middleware.map(m => `\`${m}\``).join(', ')}\n`;
          }
          
          content += '\n';
        }
      }

      // Add OpenAPI hint if many endpoints
      if (apiDoc.totalEndpoints > 5) {
        content += '\n💡 *Consider generating OpenAPI/Swagger documentation for better API management.*\n';
      }
    }

    return content;
  }

  private detectLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'jsx',
      'tsx': 'tsx',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'vue': 'vue',
      'svelte': 'svelte',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'yaml': 'yaml',
      'yml': 'yaml',
      'json': 'json'
    };

    return languageMap[ext || ''] || 'text';
  }

  private generateErrorResponse(query: string, error: any): string {
    const isIndexError = error.message?.includes('No indexed documents') || 
                        error.message?.includes('index');

    if (isIndexError) {
      return `I notice this codebase hasn't been indexed yet. To analyze your code, I need to first index the project files. 

Please run the indexing process first, then I'll be able to provide a comprehensive analysis of your codebase.

Once indexed, I can help you with:
- Complete codebase overviews and architecture analysis
- Specific code explanations and documentation
- Framework and pattern identification
- Code quality assessments and recommendations
- Component relationships and data flow analysis

Would you like me to guide you through the indexing process?`;
    }

    return `I encountered an issue while processing your query: "${query}"

This might be due to:
- The project not being properly indexed
- Temporary connectivity issues
- Complex query requiring more context

Please try:
1. Ensuring the project is indexed
2. Rephrasing your question more specifically
3. Breaking complex questions into smaller parts

I'm here to help once these issues are resolved!`;
  }

  private async checkAndUpdateIndex(): Promise<void> {
    if (!this.projectPath) return;

    try {
      console.log('🔍 Checking for index updates...');
      
      const changes = await this.incrementalIndexer.detectChanges(this.projectPath);
      
      if (changes.totalChanges > 0) {
        console.log(`📝 Found ${changes.totalChanges} changes, updating index...`);
        await this.incrementalIndexer.performIncrementalUpdate(this.projectPath);
        
        // Clear overview cache since codebase changed
        await this.queryHandler.clearOverviewCache();
      } else {
        console.log('✅ Index is up to date');
      }
    } catch (error) {
      console.warn('⚠️ Failed to check index status:', error);
      // Continue without incremental update
    }
  }

  // Public utility methods
  async refreshIndex(force: boolean = false): Promise<void> {
    if (!this.projectPath) {
      throw new Error('No project path available');
    }

    if (force) {
      console.log('🔄 Forcing full reindex...');
      await this.incrementalIndexer.forceFull Reindex();
    }

    await this.incrementalIndexer.performIncrementalUpdate(this.projectPath);
    await this.queryHandler.clearOverviewCache();
    
    console.log('✅ Index refreshed successfully');
  }

  async getIndexStatistics(): Promise<any> {
    return await this.incrementalIndexer.getIndexStatistics();
  }

  async preloadOverview(): Promise<void> {
    if (!this.projectPath) {
      throw new Error('No project path available');
    }

    await this.queryHandler.preloadOverview(this.projectPath);
  }

  getOverviewCacheStatus(): any {
    return this.queryHandler.getOverviewCacheStatus();
  }

  // Main entry point for chat systems
  static async handleChatQuery(
    query: string, 
    projectPath: string,
    options: QueryOptions = {}
  ): Promise<FormattedResponse> {
    const system = new QueryResponseSystem();
    
    try {
      await system.initialize(projectPath);
      
      return await system.processQuery({
        query,
        projectPath,
        options
      });
    } catch (error) {
      console.error('Failed to handle chat query:', error);
      
      return {
        content: system.generateErrorResponse(query, error),
        metadata: {
          processingTime: 0,
          confidence: 0,
          usedOverview: false,
          foundRelevantCode: 0
        }
      };
    }
  }
}