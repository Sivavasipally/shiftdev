import { RAGManager } from '../core/RAGManager';
import { Storage } from '../utils/storage';
import { UserProfile, ChatMessage, WebviewMessage } from '../types';
import { DiagramGenerator } from '../features/diagramGenerator';
import { ReadmeGenerator } from '../features/readmeGenerator';
import { AgileGenerator } from '../features/agileGenerator';
import { QualityAnalyzer } from '../features/qualityAnalyzer';

export class ChatController {
  private diagramGenerator: DiagramGenerator;
  private readmeGenerator: ReadmeGenerator;
  private agileGenerator: AgileGenerator;
  private qualityAnalyzer: QualityAnalyzer;

  constructor(
    private ragManager: RAGManager,
    private storage: Storage,
    private userProfile: UserProfile
  ) {
    this.diagramGenerator = new DiagramGenerator(ragManager);
    this.readmeGenerator = new ReadmeGenerator(ragManager);
    this.agileGenerator = new AgileGenerator(ragManager);
    this.qualityAnalyzer = new QualityAnalyzer(ragManager);
  }

  updateUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
    this.ragManager.updateUserProfile(profile);
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

    return { type: 'general', params: {} };
  }

  private async handleDiagramCommand(params: any): Promise<any> {
    try {
      const stats = await this.ragManager.getCodebaseStats();
      if (stats.totalChunks === 0) {
        return {
          content: "No code has been indexed yet. Please run 'Index Current Workspace' command first.",
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
        content: `# ${params.subtype.charAt(0).toUpperCase() + params.subtype.slice(1)} Diagram\n\n${diagram.content}\n\n${diagram.explanation}`,
        metadata: {
          diagram,
          diagramType: params.subtype
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
      const stats = await this.ragManager.getCodebaseStats();
      if (stats.totalChunks === 0) {
        return {
          content: "No code has been indexed yet. Please run 'Index Current Workspace' command first.",
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
      const stats = await this.ragManager.getCodebaseStats();
      if (stats.totalChunks === 0) {
        return {
          content: "No code has been indexed yet. Please run 'Index Current Workspace' command first.",
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
      const stats = await this.ragManager.getCodebaseStats();
      if (stats.totalChunks === 0) {
        return {
          content: "No code has been indexed yet. Please run 'Index Current Workspace' command first.",
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
      const stats = await this.ragManager.getCodebaseStats();
      
      let content = `# Codebase Statistics\n\n`;
      content += `- **Total Code Chunks:** ${stats.totalChunks}\n`;
      content += `- **Files Analyzed:** ${stats.fileCount}\n`;
      content += `- **Classes Found:** ${stats.classCount}\n`;
      content += `- **Functions Found:** ${stats.functionCount}\n\n`;

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

  private async handleGeneralQuery(content: string): Promise<any> {
    try {
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