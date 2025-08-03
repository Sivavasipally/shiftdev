import { QueryResponseSystem } from '../src/integration/QueryResponseSystem';

/**
 * Example integration with a chat system
 * 
 * This demonstrates how to integrate the comprehensive RAG system
 * with a chat interface to provide intelligent codebase analysis
 */

export class ChatInterface {
  private querySystem: QueryResponseSystem;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.querySystem = new QueryResponseSystem();
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing chat interface...');
    await this.querySystem.initialize(this.projectPath);
    console.log('✅ Chat interface ready!');
  }

  /**
   * Main method to handle user messages
   * This would be called by your chat UI/API
   */
  async handleUserMessage(message: string): Promise<string> {
    try {
      // Detect if this is an overview request
      const isOverviewRequest = this.isOverviewQuery(message);
      
      const response = await this.querySystem.processQuery({
        query: message,
        options: {
          includeOverview: isOverviewRequest,
          responseFormat: 'detailed',
          includeCodeContext: true
        }
      });

      // Format for chat display
      let chatResponse = response.content;

      // Add metadata for transparency
      if (response.metadata.confidence < 0.7) {
        chatResponse += '\n\n*Note: I have moderate confidence in this response. You might want to ask for more specific details.*';
      }

      // Add suggestions if available
      if (response.suggestions && response.suggestions.length > 0) {
        chatResponse += '\n\n**You might also want to ask:**\n';
        response.suggestions.forEach((suggestion, index) => {
          chatResponse += `${index + 1}. ${suggestion}\n`;
        });
      }

      return chatResponse;

    } catch (error) {
      console.error('Error handling user message:', error);
      return this.getErrorMessage(message);
    }
  }

  private isOverviewQuery(message: string): boolean {
    const overviewKeywords = [
      'overview', 'explain the code', 'entire source', 'whole project',
      'codebase', 'architecture', 'structure', 'how does this work',
      'what does this do', 'general explanation', 'summary',
      'give overview', 'describe the project', 'explain the system'
    ];

    const lowerMessage = message.toLowerCase();
    return overviewKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  private getErrorMessage(originalQuery: string): string {
    return `I encountered an issue while analyzing your request: "${originalQuery}"

This might be because:
- The project needs to be indexed first
- The query is too complex or ambiguous
- There are temporary system issues

Try asking:
- "Give me an overview of the entire source code"
- "Explain the architecture of this project"
- "What frameworks are used in this codebase?"
- More specific questions about particular files or components

I'm here to help once the issue is resolved!`;
  }

  /**
   * Utility methods for integration
   */
  async refreshCodebase(): Promise<void> {
    await this.querySystem.refreshIndex(false);
  }

  async getSystemStatus(): Promise<any> {
    const indexStats = await this.querySystem.getIndexStatistics();
    const overviewStatus = this.querySystem.getOverviewCacheStatus();
    
    return {
      indexStatistics: indexStats,
      overviewCached: overviewStatus.cached,
      overviewAge: overviewStatus.age,
      ready: true
    };
  }
}

/**
 * Example usage in different chat contexts
 */

// Example 1: Web API integration
export async function handleWebAPIRequest(req: any, res: any) {
  const { message, projectPath } = req.body;
  
  try {
    const response = await QueryResponseSystem.handleChatQuery(
      message,
      projectPath,
      {
        responseFormat: 'detailed',
        includeOverview: true
      }
    );

    res.json({
      success: true,
      response: response.content,
      metadata: response.metadata,
      suggestions: response.suggestions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to process query',
      message: error.message
    });
  }
}

// Example 2: CLI integration
export async function handleCLIQuery(query: string, projectPath: string) {
  console.log(`\n🤖 Processing: "${query}"\n`);
  
  const response = await QueryResponseSystem.handleChatQuery(
    query,
    projectPath,
    { responseFormat: 'detailed' }
  );

  console.log(response.content);
  
  if (response.suggestions) {
    console.log('\n💡 Related questions:');
    response.suggestions.forEach((suggestion, index) => {
      console.log(`  ${index + 1}. ${suggestion}`);
    });
  }

  console.log(`\n📊 Confidence: ${(response.metadata.confidence * 100).toFixed(1)}%`);
  console.log(`⏱️  Processing time: ${response.metadata.processingTime}ms\n`);
}

// Example 3: VS Code extension integration
export class VSCodeChatProvider {
  private chatInterface: ChatInterface;

  constructor(workspaceRoot: string) {
    this.chatInterface = new ChatInterface(workspaceRoot);
  }

  async initialize() {
    await this.chatInterface.initialize();
  }

  async provideResponse(message: string): Promise<{
    response: string;
    quickReplies?: string[];
  }> {
    const response = await this.chatInterface.handleUserMessage(message);
    
    // Get system status for quick replies
    const status = await this.chatInterface.getSystemStatus();
    
    const quickReplies = [
      'Show me the architecture overview',
      'What frameworks are used?',
      'Explain the main components',
      'Show me the test structure'
    ];

    return {
      response,
      quickReplies
    };
  }
}

// Example 4: Demonstration of handling common queries
export async function demonstrateCommonQueries() {
  const projectPath = '/path/to/your/project';
  
  const commonQueries = [
    'Give me an overview of the entire source code',
    'What is the architecture of this project?',
    'Explain how the authentication system works',
    'Show me the main entry points of the application',
    'What frameworks and technologies are used?',
    'How is the code organized?',
    'What are the key components?',
    'How is testing structured?'
  ];

  console.log('🎯 Demonstrating common codebase queries...\n');

  for (const query of commonQueries) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Query: "${query}"`);
    console.log('='.repeat(60));
    
    try {
      const response = await QueryResponseSystem.handleChatQuery(
        query,
        projectPath,
        { responseFormat: 'concise' } // Use concise for demo
      );

      console.log(response.content.substring(0, 300) + '...');
      console.log(`\nConfidence: ${(response.metadata.confidence * 100).toFixed(1)}%`);
      
    } catch (error) {
      console.log('❌ Error:', error.message);
    }
  }
}

// Export for easy integration
export { QueryResponseSystem };

/**
 * Integration checklist:
 * 
 * 1. Initialize the QueryResponseSystem with your project path
 * 2. Call handleUserMessage() or QueryResponseSystem.handleChatQuery() with user queries
 * 3. Handle overview queries automatically (queries about entire codebase)
 * 4. Display suggestions for follow-up questions
 * 5. Show confidence levels for transparency
 * 6. Handle errors gracefully with helpful messages
 * 7. Refresh index when codebase changes
 * 8. Cache overview for better performance
 * 
 * The system will automatically:
 * - Detect when users want codebase overviews
 * - Generate comprehensive architecture analysis
 * - Find relevant code sections
 * - Provide contextual explanations
 * - Suggest improvements and follow-up questions
 * - Maintain up-to-date index with incremental updates
 */