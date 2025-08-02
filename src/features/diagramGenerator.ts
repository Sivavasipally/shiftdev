import { RAGManager } from '../core/RAGManager';

export class DiagramGenerator {
  constructor(private ragManager: RAGManager) {}

  async generateClassDiagram(): Promise<{
    content: string;
    explanation: string;
  }> {
    try {
      const query = "Show me all classes, interfaces, and their relationships in this codebase";
      const response = await this.ragManager.query(query, 15);

      const context = this.buildContextFromChunks(response.retrievedChunks);
      
      const prompt = `
Analyze the following code and create a Mermaid.js class diagram showing classes, interfaces, and their relationships.

${context}

Requirements:
1. Use proper Mermaid class diagram syntax
2. Show inheritance relationships with -->
3. Show composition relationships with --*
4. Include key methods and properties
5. Group related classes together
6. Make it readable and well-organized

Provide the diagram in this format:
\`\`\`mermaid
classDiagram
[your diagram here]
\`\`\`

Then provide a brief explanation of the architecture shown.
`;

      const result = await this.ragManager.query(prompt);
      
      return {
        content: this.extractMermaidDiagram(result.response),
        explanation: this.extractExplanation(result.response)
      };
    } catch (error) {
      throw new Error(`Class diagram generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateArchitectureDiagram(): Promise<{
    content: string;
    explanation: string;
  }> {
    try {
      const query = "Show me the overall architecture and main components of this system";
      const response = await this.ragManager.query(query, 12);

      const context = this.buildContextFromChunks(response.retrievedChunks);
      
      const prompt = `
Analyze the following codebase and create a Mermaid.js architecture diagram showing the main components and their relationships.

${context}

Requirements:
1. Use Mermaid flowchart syntax
2. Show major modules/components as boxes
3. Show data flow and dependencies with arrows
4. Group related components
5. Include external dependencies if obvious
6. Make it high-level and understandable

Provide the diagram in this format:
\`\`\`mermaid
flowchart TD
[your diagram here]
\`\`\`

Then provide a brief explanation of the architecture.
`;

      const result = await this.ragManager.query(prompt);
      
      return {
        content: this.extractMermaidDiagram(result.response),
        explanation: this.extractExplanation(result.response)
      };
    } catch (error) {
      throw new Error(`Architecture diagram generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateSequenceDiagram(scenario: string): Promise<{
    content: string;
    explanation: string;
  }> {
    try {
      const query = `Show me the code flow and function calls for: ${scenario}`;
      const response = await this.ragManager.query(query, 10);

      const context = this.buildContextFromChunks(response.retrievedChunks);
      
      const prompt = `
Create a Mermaid.js sequence diagram for the scenario: "${scenario}"

Code context:
${context}

Requirements:
1. Use proper Mermaid sequence diagram syntax
2. Show the flow of function calls and interactions
3. Include important actors/components as participants
4. Show the sequence of operations clearly
5. Add notes for important steps

Provide the diagram in this format:
\`\`\`mermaid
sequenceDiagram
[your diagram here]
\`\`\`

Then explain the sequence flow.
`;

      const result = await this.ragManager.query(prompt);
      
      return {
        content: this.extractMermaidDiagram(result.response),
        explanation: this.extractExplanation(result.response)
      };
    } catch (error) {
      throw new Error(`Sequence diagram generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildContextFromChunks(chunks: any[]): string {
    let context = "";
    
    chunks.forEach((chunk, index) => {
      context += `## Context ${index + 1}\n`;
      context += `File: ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}\n`;
      
      if (chunk.className) {
        context += `Class: ${chunk.className}\n`;
      }
      if (chunk.functionName) {
        context += `Function: ${chunk.functionName}\n`;
      }
      
      context += `Type: ${chunk.chunkType}\n`;
      context += "```\n" + chunk.content.substring(0, 800) + "\n```\n\n";
    });

    return context;
  }

  private extractMermaidDiagram(response: string): string {
    const mermaidRegex = /```mermaid\n([\s\S]*?)```/;
    const match = response.match(mermaidRegex);
    
    if (match) {
      return match[1].trim();
    }
    
    // Fallback: look for any mermaid-like content
    if (response.includes('classDiagram') || response.includes('flowchart') || response.includes('sequenceDiagram')) {
      return response;
    }
    
    return `flowchart TD
    A[No diagram generated] --> B[Please try again]
    B --> C[Check if code is indexed]`;
  }

  private extractExplanation(response: string): string {
    // Remove the mermaid code block and return the rest as explanation
    const withoutMermaid = response.replace(/```mermaid[\s\S]*?```/, '').trim();
    
    if (withoutMermaid.length > 0) {
      return withoutMermaid;
    }
    
    return "This diagram shows the structure and relationships of the main components in your codebase.";
  }
}