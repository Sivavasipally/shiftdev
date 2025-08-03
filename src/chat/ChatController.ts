import { RAGManager } from '../core/RAGManager';
import { Storage } from '../utils/storage';
import { UserProfile, ChatMessage, WebviewMessage } from '../types';
import { DiagramGenerator } from '../features/diagramGenerator';
import { ReadmeGenerator } from '../features/readmeGenerator';
import { AgileGenerator } from '../features/agileGenerator';
import { QualityAnalyzer } from '../features/qualityAnalyzer';
import { FrameworkAnalyzer } from '../features/frameworkAnalyzer';

export class ChatController {
  private diagramGenerator: DiagramGenerator | null;
  private readmeGenerator: ReadmeGenerator | null;
  private agileGenerator: AgileGenerator | null;
  private qualityAnalyzer: QualityAnalyzer | null;
  private frameworkAnalyzer: FrameworkAnalyzer | null;

  constructor(
    private ragManager: RAGManager | undefined,
    private storage: Storage,
    private userProfile: UserProfile
  ) {
    if (ragManager) {
      this.diagramGenerator = new DiagramGenerator(ragManager);
      this.readmeGenerator = new ReadmeGenerator(ragManager);
      this.agileGenerator = new AgileGenerator(ragManager);
      this.qualityAnalyzer = new QualityAnalyzer(ragManager);
      this.frameworkAnalyzer = new FrameworkAnalyzer(ragManager);
    } else {
      // Initialize with null - handle in methods
      this.diagramGenerator = null;
      this.readmeGenerator = null;
      this.agileGenerator = null;
      this.qualityAnalyzer = null;
      this.frameworkAnalyzer = null;
    }
  }

  updateUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
    if (this.ragManager) {
      this.ragManager.updateUserProfile(profile);
    }
  }

  private getWorkspaceRequiredMessage(): string {
    return `🚀 **Welcome to DevCanvas AI!**

To get started, please:

1. **Open a workspace**: Use File → Open Folder to open your code project
2. **Configure API keys**: Run the "DevCanvas AI: Configure API Keys" command
3. **Index your code**: Run "DevCanvas AI: Index Current Workspace" to enable AI features

Once set up, you can:
- Ask questions about your code
- Generate documentation and diagrams  
- Analyze code quality
- Clone repositories

Type "help" for more guidance or use the commands above to begin!`;
  }

  async processMessage(content: string): Promise<{
    content: string;
    metadata?: any;
  }> {
    try {
      // Save user message
      const userMessage: ChatMessage = {
        id: this.generateId(),
        role: 'user',
        content,
        timestamp: new Date()
      };

      const history = await this.storage.getChatHistory();
      history.push(userMessage);

      // Detect command type
      const command = this.detectCommand(content);
      let response: any;

      switch (command.type) {
        case 'diagram':
          response = await this.handleDiagramCommand(command.params);
          break;
        case 'readme':
          response = await this.handleReadmeCommand(command.params);
          break;
        case 'agile':
          response = await this.handleAgileCommand(command.params);
          break;
        case 'quality':
          response = await this.handleQualityCommand(command.params);
          break;
        case 'stats':
          response = await this.handleStatsCommand();
          break;
        case 'framework':
          response = await this.handleFrameworkCommand(command.params);
          break;
        default:
          response = await this.handleGeneralQuery(content);
      }

      // Save assistant message
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        metadata: response.metadata
      };

      history.push(assistantMessage);
      await this.storage.saveChatHistory(history);

      return {
        content: response.content,
        metadata: {
          ...response.metadata,
          tokens: response.usage
        }
      };

    } catch (error) {
      console.error('Message processing error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to process message'
      );
    }
  }

  private detectCommand(content: string): { type: string; params: any } {
    const lowerContent = content.toLowerCase();

    // Diagram commands
    if (lowerContent.includes('diagram') || lowerContent.includes('visualize') || lowerContent.includes('chart')) {
      if (lowerContent.includes('class')) {
        return { type: 'diagram', params: { subtype: 'class' } };
      } else if (lowerContent.includes('architecture') || lowerContent.includes('system')) {
        return { type: 'diagram', params: { subtype: 'architecture' } };
      } else if (lowerContent.includes('sequence') || lowerContent.includes('flow')) {
        return { type: 'diagram', params: { subtype: 'sequence', scenario: content } };
      }
      return { type: 'diagram', params: { subtype: 'architecture' } };
    }

    // README commands
    if (lowerContent.includes('readme') || lowerContent.includes('documentation') || 
        (lowerContent.includes('generate') && lowerContent.includes('doc'))) {
      return { type: 'readme', params: {} };
    }

    // Agile commands
    if (lowerContent.includes('story') || lowerContent.includes('epic') || 
        lowerContent.includes('agile') || lowerContent.includes('user story')) {
      return { type: 'agile', params: { content } };
    }

    // Quality analysis commands
    if (lowerContent.includes('quality') || lowerContent.includes('analyze') || 
        lowerContent.includes('code review') || lowerContent.includes('metrics')) {
      return { type: 'quality', params: {} };
    }

    // Stats commands
    if (lowerContent.includes('stats') || lowerContent.includes('statistics') || 
        lowerContent.includes('summary') || lowerContent.includes('overview') ||
        lowerContent.includes('status') || lowerContent.includes('indexed')) {
      return { type: 'stats', params: {} };
    }

    // Framework analysis commands
    if (lowerContent.includes('framework') || lowerContent.includes('spring boot') || 
        lowerContent.includes('react') || lowerContent.includes('angular') ||
        lowerContent.includes('flask') || lowerContent.includes('fastapi') ||
        lowerContent.includes('analyze framework') || lowerContent.includes('framework analysis')) {
      
      // Detect specific framework
      let framework = '';
      if (lowerContent.includes('spring boot')) framework = 'spring boot';
      else if (lowerContent.includes('spring')) framework = 'spring';
      else if (lowerContent.includes('react')) framework = 'react';
      else if (lowerContent.includes('angular')) framework = 'angular';
      else if (lowerContent.includes('flask')) framework = 'flask';
      else if (lowerContent.includes('fastapi')) framework = 'fastapi';
      
      return { type: 'framework', params: { framework, content } };
    }

    return { type: 'general', params: {} };
  }

  private async handleDiagramCommand(params: any): Promise<any> {
    try {
      if (!this.ragManager) {
        return {
          content: this.getWorkspaceRequiredMessage(),
          metadata: {}
        };
      }

      const stats = await this.ragManager.getCodebaseStats();
      if (stats.totalChunks === 0) {
        return {
          content: "No code has been indexed yet. Please run 'Index Current Workspace' command first.",
          metadata: {}
        };
      }

      if (!this.diagramGenerator) {
        return {
          content: "Diagram generation is not available. Please ensure workspace is open and indexed.",
          metadata: {}
        };
      }

      let diagram;
      switch (params.subtype) {
        case 'class':
          diagram = await this.diagramGenerator.generateClassDiagram();
          break;
        case 'sequence':
          diagram = await this.diagramGenerator.generateSequenceDiagram(params.scenario);
          break;
        default:
          diagram = await this.diagramGenerator.generateArchitectureDiagram();
      }

      return {
        content: `# ${params.subtype.charAt(0).toUpperCase() + params.subtype.slice(1)} Diagram\n\n\`\`\`mermaid\n${diagram.content}\n\`\`\`\n\n${diagram.explanation}`,
        metadata: {
          diagram: diagram.content,
          diagramType: params.subtype,
          navigationData: diagram.navigationData,
          isDiagram: true
        }
      };
    } catch (error) {
      return {
        content: `Failed to generate diagram: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {}
      };
    }
  }

  private async handleReadmeCommand(params: any): Promise<any> {
    try {
      if (!this.ragManager) {
        return {
          content: this.getWorkspaceRequiredMessage(),
          metadata: {}
        };
      }

      const stats = await this.ragManager.getCodebaseStats();
      if (stats.totalChunks === 0) {
        return {
          content: "No code has been indexed yet. Please run 'Index Current Workspace' command first.",
          metadata: {}
        };
      }

      if (!this.readmeGenerator) {
        return {
          content: "README generation is not available. Please ensure workspace is open and indexed.",
          metadata: {}
        };
      }

      const readme = await this.readmeGenerator.generateReadme();
      
      return {
        content: readme.content,
        metadata: {
          readmeStats: readme.stats,
          generatedSections: readme.sections
        }
      };
    } catch (error) {
      return {
        content: `Failed to generate README: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {}
      };
    }
  }

  private async handleAgileCommand(params: any): Promise<any> {
    try {
      if (!this.ragManager) {
        return {
          content: this.getWorkspaceRequiredMessage(),
          metadata: {}
        };
      }

      const stats = await this.ragManager.getCodebaseStats();
      if (stats.totalChunks === 0) {
        return {
          content: "No code has been indexed yet. Please run 'Index Current Workspace' command first.",
          metadata: {}
        };
      }

      if (!this.agileGenerator) {
        return {
          content: "Agile artifacts generation is not available. Please ensure workspace is open and indexed.",
          metadata: {}
        };
      }

      const agileArtifacts = await this.agileGenerator.generateAgileArtifacts(params.content);
      
      let content = `# Agile Epic and User Stories\n\n`;
      content += `## Epic: ${agileArtifacts.epic.title}\n\n`;
      content += `${agileArtifacts.epic.description}\n\n`;
      content += `**Total Story Points:** ${agileArtifacts.epic.totalStoryPoints}\n\n`;
      content += `## User Stories\n\n`;

      agileArtifacts.epic.stories.forEach((story, index) => {
        content += `### ${index + 1}. ${story.title}\n\n`;
        content += `**Story Points:** ${story.storyPoints} | **Priority:** ${story.priority}\n\n`;
        content += `${story.description}\n\n`;
        content += `**Acceptance Criteria:**\n`;
        story.acceptanceCriteria.forEach(criteria => {
          content += `- ${criteria}\n`;
        });
        content += `\n**Reasoning:** ${story.reasoning}\n\n`;
        if (story.dependencies.length > 0) {
          content += `**Dependencies:** ${story.dependencies.join(', ')}\n\n`;
        }
        content += `---\n\n`;
      });

      return {
        content,
        metadata: {
          epic: agileArtifacts.epic,
          estimationMethod: 'Fibonacci sequence based on complexity analysis'
        }
      };
    } catch (error) {
      return {
        content: `Failed to generate agile artifacts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {}
      };
    }
  }

  private async handleQualityCommand(params: any): Promise<any> {
    try {
      if (!this.ragManager) {
        return {
          content: this.getWorkspaceRequiredMessage(),
          metadata: {}
        };
      }

      const stats = await this.ragManager.getCodebaseStats();
      if (stats.totalChunks === 0) {
        return {
          content: "No code has been indexed yet. Please run 'Index Current Workspace' command first.",
          metadata: {}
        };
      }

      if (!this.qualityAnalyzer) {
        return {
          content: "Code quality analysis is not available. Please ensure workspace is open and indexed.",
          metadata: {}
        };
      }

      const qualityReport = await this.qualityAnalyzer.analyzeCodeQuality();
      
      let content = `# Code Quality Analysis\n\n`;
      content += `## Overall Metrics\n\n`;
      content += `- **Average Complexity:** ${qualityReport.complexity.toFixed(2)}\n`;
      content += `- **Maintainability Index:** ${qualityReport.maintainabilityIndex.toFixed(2)}/100\n`;
      content += `- **Code Smells:** ${qualityReport.codeSmells.length}\n`;
      content += `- **Security Issues:** ${qualityReport.securityIssues.length}\n\n`;

      if (qualityReport.codeSmells.length > 0) {
        content += `## Code Smells\n\n`;
        qualityReport.codeSmells.forEach((smell, index) => {
          content += `### ${index + 1}. ${smell.type} (${smell.severity})\n\n`;
          content += `**File:** \`${smell.filePath}:${smell.lineNumber}\`\n\n`;
          content += `${smell.description}\n\n`;
          content += `**Suggestion:** ${smell.suggestion}\n\n`;
        });
      }

      if (qualityReport.securityIssues.length > 0) {
        content += `## Security Issues\n\n`;
        qualityReport.securityIssues.forEach((issue, index) => {
          content += `### ${index + 1}. ${issue.type} (${issue.severity})\n\n`;
          content += `**File:** \`${issue.filePath}:${issue.lineNumber}\`\n\n`;
          content += `${issue.description}\n\n`;
          content += `**Recommendation:** ${issue.recommendation}\n\n`;
        });
      }

      if (qualityReport.suggestions.length > 0) {
        content += `## Improvement Suggestions\n\n`;
        qualityReport.suggestions.forEach((suggestion, index) => {
          content += `${index + 1}. ${suggestion}\n`;
        });
      }

      return {
        content,
        metadata: {
          qualityMetrics: qualityReport
        }
      };
    } catch (error) {
      return {
        content: `Failed to analyze code quality: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {}
      };
    }
  }

  private async handleStatsCommand(): Promise<any> {
    try {
      if (!this.ragManager) {
        return {
          content: this.getWorkspaceRequiredMessage(),
          metadata: {}
        };
      }

      const stats = await this.ragManager.getCodebaseStats();
      
      let content = `# Codebase Statistics\n\n`;
      content += `- **Total Code Chunks:** ${stats.totalChunks}\n`;
      content += `- **Files Analyzed:** ${stats.fileCount}\n`;
      content += `- **Classes Found:** ${stats.classCount}\n`;
      content += `- **Functions Found:** ${stats.functionCount}\n`;
      
      if (stats.bm25VocabularySize && stats.bm25DocumentCount) {
        content += `\n## BM25 Search Index\n`;
        content += `- **Vocabulary Size:** ${stats.bm25VocabularySize} unique terms\n`;
        content += `- **Indexed Documents:** ${stats.bm25DocumentCount}\n`;
      }
      
      content += `\n`;

      if (stats.totalChunks === 0) {
        content += `No code has been indexed yet. Run the "Index Current Workspace" command to analyze your codebase.\n`;
      }

      return {
        content,
        metadata: { stats }
      };
    } catch (error) {
      return {
        content: `Failed to get statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {}
      };
    }
  }

  private async handleFrameworkCommand(params: any): Promise<any> {
    try {
      if (!this.ragManager) {
        return {
          content: this.getWorkspaceRequiredMessage(),
          metadata: {}
        };
      }

      const stats = await this.ragManager.getCodebaseStats();
      if (stats.totalChunks === 0) {
        return {
          content: "No code has been indexed yet. Please run 'Index Current Workspace' command first.",
          metadata: {}
        };
      }

      if (!this.frameworkAnalyzer) {
        return {
          content: "Framework analysis is not available. Please ensure workspace is open and indexed.",
          metadata: {}
        };
      }

      // If no specific framework provided, detect and list all frameworks
      if (!params.framework) {
        const detectedFrameworks = await this.ragManager.getDetectedFrameworks();
        
        if (detectedFrameworks.length === 0) {
          return {
            content: "No frameworks detected in this codebase. The analyzer supports Spring Boot, Spring, React, Angular, Flask, and FastAPI.",
            metadata: {}
          };
        }

        let content = `# Detected Frameworks\n\n`;
        detectedFrameworks.forEach((framework, index) => {
          content += `${index + 1}. **${framework.name}** ${framework.version || ''}\n`;
          content += `   - Type: ${framework.type}\n`;
          content += `   - Language: ${framework.language}\n\n`;
        });

        content += `You can get detailed analysis by asking:\n`;
        content += `- "Analyze Spring Boot framework"\n`;
        content += `- "React framework analysis"\n`;
        content += `- "Flask security analysis"\n`;

        return {
          content,
          metadata: { detectedFrameworks }
        };
      }

      // Perform deep framework analysis
      const analysis = await this.frameworkAnalyzer.analyzeFramework(params.framework);
      
      let content = `# ${analysis.framework} Framework Analysis\n\n`;
      
      // Architecture section
      content += `## Architecture\n\n`;
      if (analysis.architecture.layers.length > 0) {
        content += `**Layers:** ${analysis.architecture.layers.join(', ')}\n\n`;
      }
      if (analysis.architecture.patterns.length > 0) {
        content += `**Patterns:** ${analysis.architecture.patterns.join(', ')}\n\n`;
      }
      if (analysis.architecture.components.length > 0) {
        content += `**Components Found:** ${analysis.architecture.components.length}\n\n`;
        analysis.architecture.components.slice(0, 5).forEach(comp => {
          content += `- **${comp.name}** (${comp.type}): ${comp.purpose}\n`;
        });
        if (analysis.architecture.components.length > 5) {
          content += `- ... and ${analysis.architecture.components.length - 5} more components\n`;
        }
        content += `\n`;
      }

      // Security section
      if (analysis.security.vulnerabilities.length > 0) {
        content += `## Security Issues\n\n`;
        analysis.security.vulnerabilities.forEach((vuln, index) => {
          content += `### ${index + 1}. ${vuln.type} (${vuln.severity.toUpperCase()})\n`;
          content += `**Location:** \`${vuln.location}\`\n`;
          content += `**Description:** ${vuln.description}\n`;
          content += `**Recommendation:** ${vuln.recommendation}\n\n`;
        });
      }

      // Performance section
      if (analysis.performance.issues.length > 0) {
        content += `## Performance Issues\n\n`;
        analysis.performance.issues.forEach((issue, index) => {
          content += `### ${index + 1}. ${issue.type} (${issue.impact.toUpperCase()} impact)\n`;
          content += `**Location:** \`${issue.location}\`\n`;
          content += `**Description:** ${issue.description}\n`;
          content += `**Solution:** ${issue.solution}\n\n`;
        });
      }

      // Best practices section
      if (analysis.bestPractices.violations.length > 0) {
        content += `## Best Practice Violations\n\n`;
        analysis.bestPractices.violations.forEach((violation, index) => {
          content += `### ${index + 1}. ${violation.practice}\n`;
          content += `**Violation:** ${violation.violation}\n`;
          content += `**Location:** \`${violation.location}\`\n`;
          content += `**Recommendation:** ${violation.recommendation}\n\n`;
        });
      }

      // Code structure metrics
      content += `## Code Quality Metrics\n\n`;
      content += `- **Average Complexity:** ${analysis.codeStructure.complexity.toFixed(2)}\n`;
      content += `- **Maintainability Index:** ${analysis.codeStructure.maintainability.toFixed(2)}/100\n`;
      content += `- **Estimated Test Coverage:** ${analysis.codeStructure.testCoverage.toFixed(1)}%\n\n`;

      // Recommendations
      if (analysis.bestPractices.recommendations.length > 0) {
        content += `## Recommendations\n\n`;
        analysis.bestPractices.recommendations.forEach((rec, index) => {
          content += `${index + 1}. ${rec}\n`;
        });
      }

      return {
        content,
        metadata: {
          frameworkAnalysis: analysis,
          framework: params.framework
        }
      };

    } catch (error) {
      return {
        content: `Failed to analyze framework: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {}
      };
    }
  }

  private async handleGeneralQuery(content: string): Promise<any> {
    try {
      if (!this.ragManager) {
        return {
          content: this.getWorkspaceRequiredMessage(),
          metadata: {}
        };
      }

      const stats = await this.ragManager.getCodebaseStats();
      if (stats.totalChunks === 0) {
        return {
          content: "I don't have any code context yet. Please run the 'Index Current Workspace' command first to analyze your codebase, then I'll be able to answer questions about your code.",
          metadata: {}
        };
      }

      const response = await this.ragManager.query(content);
      
      return {
        content: response.response,
        metadata: {
          retrievedChunks: response.retrievedChunks.map(chunk => ({
            filePath: chunk.filePath,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            chunkType: chunk.chunkType,
            className: chunk.metadata.className,
            functionName: chunk.metadata.functionName
          }))
        },
        usage: response.usage
      };
    } catch (error) {
      return {
        content: `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {}
      };
    }
  }

  async clearHistory(): Promise<void> {
    await this.storage.clearChatHistory();
  }

  async getChatHistory(): Promise<ChatMessage[]> {
    return this.storage.getChatHistory();
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}