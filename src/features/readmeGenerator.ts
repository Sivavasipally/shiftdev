import { RAGManager } from '../core/RAGManager';

export class ReadmeGenerator {
  constructor(private ragManager: RAGManager) {}

  async generateReadme(): Promise<{
    content: string;
    stats: any;
    sections: string[];
  }> {
    try {
      const stats = await this.ragManager.getCodebaseStats();
      
      // Check if there's any indexed content
      if (stats.totalChunks === 0) {
        return {
          content: `# README

⚠️ **No code has been indexed yet**

To generate a comprehensive README, please:

1. Run the command: \`DevCanvas AI: Index Current Workspace\`
2. Wait for indexing to complete
3. Try generating the README again

**Current Status:**
- Total files analyzed: ${stats.fileCount}
- Classes found: ${stats.classCount}
- Functions found: ${stats.functionCount}
- Code chunks: ${stats.totalChunks}

Once your codebase is indexed, I'll be able to generate a detailed README with:
- Project overview and purpose
- Installation instructions
- Usage examples
- API documentation
- Project structure explanation
`,
          stats,
          sections: ['Warning', 'Instructions']
        };
      }
      
      // Get overview of the codebase
      const overviewQuery = "What is this project about? Summarize the main purpose and functionality.";
      const overviewResponse = await this.ragManager.query(overviewQuery, 8);

      // Get setup/installation info
      const setupQuery = "How do I install dependencies and set up this project? Show me package.json, requirements, or build files.";
      const setupResponse = await this.ragManager.query(setupQuery, 5);

      // Get usage examples
      const usageQuery = "Show me main entry points, key functions, and how to use this code.";
      const usageResponse = await this.ragManager.query(usageQuery, 8);

      // Get project structure
      const structureQuery = "What are the main directories and files in this project? Explain the project structure.";
      const structureResponse = await this.ragManager.query(structureQuery, 10);

      // If queries didn't return much content, use a broader approach
      let contextContent = '';
      const totalResponseLength = overviewResponse.response.length + setupResponse.response.length + 
                                  usageResponse.response.length + structureResponse.response.length;
      
      if (totalResponseLength < 500) {
        console.log('Individual queries returned limited content, trying broader search...');
        const broadQuery = "Show me all the important code, files, and structure of this project";
        const broadResponse = await this.ragManager.query(broadQuery, 20);
        contextContent = broadResponse.response;
      }

      const prompt = `
Generate a comprehensive README.md file for this codebase based on the following analysis:

## Project Overview
${overviewResponse.response}

## Setup Information
${setupResponse.response}

## Usage Information
${usageResponse.response}

## Project Structure
${structureResponse.response}

${contextContent ? `## Additional Context\n${contextContent}` : ''}

## Statistics
- Total files analyzed: ${stats.fileCount}
- Classes found: ${stats.classCount}
- Functions found: ${stats.functionCount}

Requirements for the README:
1. Start with a clear project title and description
2. Include installation/setup instructions
3. Provide usage examples with code snippets
4. Explain the project structure
5. Add API documentation if applicable
6. Include contributing guidelines
7. Add appropriate badges if you can infer the tech stack
8. Make it professional and comprehensive
9. Use proper markdown formatting

Generate a complete, well-structured README.md file.
`;

      const result = await this.ragManager.query(prompt);
      
      const sections = this.extractSections(result.response);
      
      return {
        content: result.response,
        stats: {
          totalFiles: stats.fileCount,
          totalClasses: stats.classCount,
          totalFunctions: stats.functionCount,
          sectionsGenerated: sections.length
        },
        sections
      };
    } catch (error) {
      throw new Error(`README generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractSections(readme: string): string[] {
    const sections: string[] = [];
    const lines = readme.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('#')) {
        const sectionName = line.replace(/^#+\s*/, '').trim();
        if (sectionName && !sections.includes(sectionName)) {
          sections.push(sectionName);
        }
      }
    }
    
    return sections;
  }
}