import { RAGManager } from '../core/RAGManager';

export class DiagramGenerator {
  constructor(private ragManager: RAGManager) {}

  async generateClassDiagram(): Promise<{
    content: string;
    explanation: string;
    navigationData?: any;
  }> {
    try {
      // Get codebase statistics first
      const stats = await this.ragManager.getCodebaseStats();
      console.log('Codebase stats for diagram generation:', stats);
      
      // First, try to get all Java chunks directly from the vector DB
      let allChunks = await this.ragManager.getAllJavaChunks();
      console.log(`Direct Java chunks retrieved: ${allChunks.length}`);
      
      // If we don't have enough chunks, supplement with query-based search
      if (allChunks.length < 5) {
        console.log('Not enough Java chunks found, supplementing with query search...');
        
        const queries = [
          "public class",
          "interface", 
          "@Entity @Component @Service @Repository @Controller @RestController",
          "extends implements",
          "class enum",
          "java spring boot",
          ".java files"
        ];
        
        const queryChunks: any[] = [];
        
        for (const query of queries) {
          console.log(`Searching for: "${query}"`);
          const response = await this.ragManager.query(query, 15);
          console.log(`Found ${response.retrievedChunks.length} chunks for "${query}"`);
          queryChunks.push(...response.retrievedChunks);
        }
        
        // Combine direct and query chunks, removing duplicates
        const combinedChunks = [...allChunks, ...queryChunks];
        allChunks = combinedChunks.filter((chunk, index, self) => 
          index === self.findIndex(c => c.id === chunk.id)
        );
      }
      
      console.log(`Final chunk count for diagram: ${allChunks.length}`);
      
      // Log chunk details for debugging
      allChunks.forEach((chunk, index) => {
        console.log(`Chunk ${index + 1}: ${chunk.filePath} (${chunk.chunkType}) - ${chunk.metadata?.className || 'No class'} - Language: ${chunk.metadata?.language}`);
      });

      const context = this.buildContextFromChunks(allChunks);
      const navigationData = this.buildNavigationData(allChunks);
      
      const prompt = `
Create a comprehensive Mermaid.js class diagram from the provided code context.

IMPORTANT: Work with the code that IS provided. Do not request additional information.

Code Context:
${context}

INSTRUCTIONS:
1. Analyze ALL the code chunks provided above
2. Extract every class, interface, and enum you can find
3. Identify relationships (inheritance, composition, dependencies) from the actual code
4. Include key methods and properties visible in the code
5. Use proper Mermaid class diagram syntax

REQUIREMENTS:
- Show inheritance relationships with class A --|> B
- Show composition relationships with class A --* B  
- Show dependencies with class A ..> B
- Include Spring annotations (@Entity, @Service, @Repository, @Controller, etc.)
- Group related classes logically
- Add click events: click ClassName "navigate:ClassName"

MERMAID FORMAT:
\`\`\`mermaid
classDiagram
    %% Define classes with their methods and properties
    class ClassName {
        +fieldName : Type
        +methodName() : ReturnType
    }
    
    %% Define relationships
    ClassA --|> ClassB : extends
    ClassC --* ClassD : contains
    ClassE ..> ClassF : uses
\`\`\`

Generate the complete diagram based on the provided code context. Do not mention missing information - work with what is available.
`;

      const result = await this.ragManager.query(prompt);
      const diagramContent = this.extractMermaidDiagram(result.response);
      const enhancedDiagram = this.addClickEventsToClassDiagram(diagramContent, navigationData);
      
      return {
        content: enhancedDiagram,
        explanation: this.extractExplanation(result.response),
        navigationData
      };
    } catch (error) {
      throw new Error(`Class diagram generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateArchitectureDiagram(): Promise<{
    content: string;
    explanation: string;
    navigationData?: any;
  }> {
    try {
      const query = "Show me the overall architecture and main components of this system";
      const response = await this.ragManager.query(query, 12);

      const context = this.buildContextFromChunks(response.retrievedChunks);
      const navigationData = this.buildNavigationData(response.retrievedChunks);
      
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
7. Use click events for navigation: click ComponentName "navigate:ComponentName"

Provide the diagram in this format:
\`\`\`mermaid
flowchart TD
[your diagram here]
\`\`\`

Then provide a brief explanation of the architecture.
`;

      const result = await this.ragManager.query(prompt);
      const diagramContent = this.extractMermaidDiagram(result.response);
      const enhancedDiagram = this.addClickEventsToFlowchart(diagramContent, navigationData);
      
      return {
        content: enhancedDiagram,
        explanation: this.extractExplanation(result.response),
        navigationData
      };
    } catch (error) {
      throw new Error(`Architecture diagram generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateSequenceDiagram(scenario: string): Promise<{
    content: string;
    explanation: string;
    navigationData?: any;
  }> {
    try {
      const query = `Show me the code flow and function calls for: ${scenario}`;
      const response = await this.ragManager.query(query, 10);

      const context = this.buildContextFromChunks(response.retrievedChunks);
      const navigationData = this.buildNavigationData(response.retrievedChunks);
      
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
        explanation: this.extractExplanation(result.response),
        navigationData
      };
    } catch (error) {
      throw new Error(`Sequence diagram generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildContextFromChunks(chunks: any[]): string {
    let context = `Found ${chunks.length} code chunks to analyze:\n\n`;
    
    chunks.forEach((chunk, index) => {
      context += `## Code Chunk ${index + 1}: ${chunk.chunkType}\n`;
      context += `**File:** \`${chunk.filePath}\` (Lines ${chunk.startLine}-${chunk.endLine})\n`;
      context += `**Language:** ${chunk.metadata?.language || 'unknown'}\n`;
      
      if (chunk.metadata?.className) {
        context += `**Class:** ${chunk.metadata.className}\n`;
      }
      if (chunk.metadata?.functionName) {
        context += `**Function:** ${chunk.metadata.functionName}\n`;
      }
      if (chunk.metadata?.complexity) {
        context += `**Complexity:** ${chunk.metadata.complexity}\n`;
      }
      
      context += `**Code:**\n`;
      context += "```" + (chunk.metadata?.language || 'java') + "\n" + chunk.content.substring(0, 1200) + "\n```\n\n";
    });

    // Add summary
    const classChunks = chunks.filter(c => c.chunkType === 'class').length;
    const functionChunks = chunks.filter(c => c.chunkType === 'function').length;
    const fileChunks = chunks.filter(c => c.chunkType === 'file').length;
    
    context += `**Summary:** ${classChunks} classes, ${functionChunks} functions, ${fileChunks} files\n\n`;

    return context;
  }

  private buildNavigationData(chunks: any[]): Record<string, any> {
    const navigationData: Record<string, any> = {};
    
    chunks.forEach(chunk => {
      // Map class names to file locations
      if (chunk.metadata.className) {
        navigationData[chunk.metadata.className] = {
          filePath: chunk.filePath,
          lineNumber: chunk.startLine,
          chunkType: chunk.chunkType
        };
      }
      
      // Map function names to file locations
      if (chunk.metadata.functionName) {
        const functionKey = chunk.metadata.className 
          ? `${chunk.metadata.className}.${chunk.metadata.functionName}`
          : chunk.metadata.functionName;
        navigationData[functionKey] = {
          filePath: chunk.filePath,
          lineNumber: chunk.startLine,
          chunkType: chunk.chunkType
        };
      }
      
      // Map file names to file locations
      const fileName = chunk.filePath.split('/').pop()?.replace(/\.(ts|js|py|java|cpp|c|go|rs|php|rb)$/, '');
      if (fileName) {
        navigationData[fileName] = {
          filePath: chunk.filePath,
          lineNumber: chunk.startLine,
          chunkType: chunk.chunkType
        };
      }
    });
    
    return navigationData;
  }

  private addClickEventsToClassDiagram(diagram: string, navigationData: Record<string, any>): string {
    let enhancedDiagram = diagram;
    
    // Add click events for classes found in navigation data
    Object.keys(navigationData).forEach(className => {
      const clickEvent = `click ${className} "navigate:${className}"`;
      if (!enhancedDiagram.includes(clickEvent)) {
        enhancedDiagram += `\n    ${clickEvent}`;
      }
    });
    
    return enhancedDiagram;
  }

  private addClickEventsToFlowchart(diagram: string, navigationData: Record<string, any>): string {
    let enhancedDiagram = diagram;
    
    // Add click events for components found in navigation data
    Object.keys(navigationData).forEach(componentName => {
      const clickEvent = `click ${componentName} "navigate:${componentName}"`;
      if (!enhancedDiagram.includes(clickEvent)) {
        enhancedDiagram += `\n    ${clickEvent}`;
      }
    });
    
    return enhancedDiagram;
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