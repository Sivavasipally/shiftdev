import { RAGManager } from '../core/RAGManager';
import { Epic, AgileStory } from '../types';

export class AgileGenerator {
  constructor(private ragManager: RAGManager) {}

  async generateAgileArtifacts(userInput: string): Promise<{
    epic: Epic;
  }> {
    try {
      // Get relevant code context based on user input
      const codeQuery = `Find code related to: ${userInput}`;
      const codeResponse = await this.ragManager.query(codeQuery, 12);

      // Get overall codebase understanding
      const overviewQuery = "What are the main features and components of this codebase?";
      const overviewResponse = await this.ragManager.query(overviewQuery, 8);

      const context = this.buildAgileContext(codeResponse.retrievedChunks, overviewResponse.retrievedChunks);

      const prompt = `
Based on the following codebase analysis and user request: "${userInput}"

Code Context:
${context}

Generate an Agile Epic and User Stories following these requirements:

1. EPIC:
   - Create a high-level epic that encompasses the user's request
   - Make it business-value focused
   - Include acceptance criteria

2. USER STORIES:
   - Break the epic into 3-7 user stories
   - Follow the format: "As a [user type], I want [functionality] so that [benefit]"
   - Include detailed acceptance criteria for each story
   - Estimate story points using Fibonacci sequence (1, 2, 3, 5, 8, 13, 21)
   - Provide reasoning for each estimate based on:
     * Code complexity analysis
     * Dependencies identified
     * Estimated development effort
   - Assign priority (high/medium/low)
   - Identify dependencies between stories

3. ESTIMATION CRITERIA:
   - 1 point: Simple configuration or minor changes
   - 2 points: Small feature with minimal complexity
   - 3 points: Standard feature requiring moderate development
   - 5 points: Complex feature with multiple components
   - 8 points: Large feature requiring significant development
   - 13+ points: Very complex feature that should be broken down further

Format your response as JSON:
{
  "epic": {
    "title": "Epic Title",
    "description": "Epic description",
    "totalStoryPoints": 0,
    "stories": [
      {
        "title": "Story Title",
        "description": "As a [user], I want [goal] so that [benefit]",
        "acceptanceCriteria": ["Criteria 1", "Criteria 2"],
        "storyPoints": 5,
        "reasoning": "Explanation for story point estimate based on complexity",
        "dependencies": ["Story titles this depends on"],
        "priority": "high"
      }
    ]
  }
}
`;

      const result = await this.ragManager.query(prompt);
      const parsed = this.parseAgileResponse(result.response);
      
      return parsed;
    } catch (error) {
      throw new Error(`Agile artifacts generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildAgileContext(codeChunks: any[], overviewChunks: any[]): string {
    let context = "## Relevant Code Components\n\n";
    
    codeChunks.forEach((chunk, index) => {
      context += `### Component ${index + 1}\n`;
      context += `**File:** ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}\n`;
      if (chunk.className) context += `**Class:** ${chunk.className}\n`;
      if (chunk.functionName) context += `**Function:** ${chunk.functionName}\n`;
      context += `**Complexity:** ${chunk.metadata?.complexity || 'Unknown'}\n`;
      context += "```\n" + chunk.content.substring(0, 600) + "\n```\n\n";
    });

    context += "## Codebase Overview\n\n";
    overviewChunks.forEach((chunk, index) => {
      context += `**File:** ${chunk.filePath}\n`;
      context += chunk.content.substring(0, 400) + "\n\n";
    });

    return context;
  }

  private parseAgileResponse(response: string): { epic: Epic } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and transform the response
        if (parsed.epic) {
          const epic: Epic = {
            id: this.generateId(),
            title: parsed.epic.title || "Generated Epic",
            description: parsed.epic.description || "Epic description",
            stories: (parsed.epic.stories || []).map((story: any) => ({
              id: this.generateId(),
              title: story.title || "User Story",
              description: story.description || "Story description",
              acceptanceCriteria: story.acceptanceCriteria || [],
              storyPoints: story.storyPoints || 3,
              reasoning: story.reasoning || "Standard complexity estimate",
              dependencies: story.dependencies || [],
              priority: story.priority || "medium"
            })),
            totalStoryPoints: 0
          };

          // Calculate total story points
          epic.totalStoryPoints = epic.stories.reduce((total, story) => total + story.storyPoints, 0);
          
          return { epic };
        }
      }
    } catch (error) {
      console.warn('Failed to parse JSON response, generating fallback:', error);
    }

    // Fallback: generate a basic epic from the response text
    return this.generateFallbackEpic(response);
  }

  private generateFallbackEpic(response: string): { epic: Epic } {
    const epic: Epic = {
      id: this.generateId(),
      title: "Feature Development Epic",
      description: "Develop the requested feature based on codebase analysis",
      stories: [
        {
          id: this.generateId(),
          title: "Analysis and Planning",
          description: "As a developer, I want to analyze the existing codebase so that I can plan the implementation effectively",
          acceptanceCriteria: [
            "Understand current code structure",
            "Identify integration points",
            "Plan implementation approach"
          ],
          storyPoints: 3,
          reasoning: "Analysis requires understanding existing code and planning integration",
          dependencies: [],
          priority: "high"
        },
        {
          id: this.generateId(),
          title: "Core Implementation",
          description: "As a user, I want the core functionality implemented so that I can use the new feature",
          acceptanceCriteria: [
            "Implement main functionality",
            "Ensure proper error handling",
            "Add appropriate logging"
          ],
          storyPoints: 8,
          reasoning: "Core implementation typically requires significant development effort",
          dependencies: ["Analysis and Planning"],
          priority: "high"
        },
        {
          id: this.generateId(),
          title: "Testing and Documentation",
          description: "As a developer, I want comprehensive tests and documentation so that the feature is maintainable",
          acceptanceCriteria: [
            "Write unit tests",
            "Add integration tests",
            "Update documentation"
          ],
          storyPoints: 5,
          reasoning: "Testing and documentation require moderate effort but are essential",
          dependencies: ["Core Implementation"],
          priority: "medium"
        }
      ],
      totalStoryPoints: 16
    };

    return { epic };
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}