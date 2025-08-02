import { RAGManager } from '../core/RAGManager';
import { QualityMetrics, CodeSmell, SecurityIssue } from '../types';

export class QualityAnalyzer {
  constructor(private ragManager: RAGManager) {}

  async analyzeCodeQuality(): Promise<QualityMetrics> {
    try {
      // Get code chunks for analysis
      const complexityQuery = "Show me the most complex functions and classes in this codebase";
      const complexityResponse = await this.ragManager.query(complexityQuery, 15);

      const securityQuery = "Find potential security issues, vulnerable patterns, or unsafe code practices";
      const securityResponse = await this.ragManager.query(securityQuery, 10);

      const qualityQuery = "Identify code smells, anti-patterns, and areas for improvement";
      const qualityResponse = await this.ragManager.query(qualityQuery, 12);

      const context = this.buildQualityContext(
        complexityResponse.retrievedChunks,
        securityResponse.retrievedChunks,
        qualityResponse.retrievedChunks
      );

      const prompt = `
Analyze the following code for quality metrics, code smells, and security issues:

${context}

Provide a comprehensive analysis including:

1. COMPLEXITY ANALYSIS:
   - Calculate average cyclomatic complexity
   - Identify overly complex functions/classes
   - Suggest refactoring opportunities

2. CODE SMELLS:
   - Long methods/classes
   - Duplicate code
   - Dead code
   - Poor naming
   - Tight coupling
   - God objects

3. SECURITY ISSUES:
   - Input validation problems
   - SQL injection risks
   - XSS vulnerabilities
   - Hardcoded secrets
   - Unsafe file operations
   - Authentication/authorization issues

4. MAINTAINABILITY:
   - Calculate maintainability index (0-100)
   - Identify technical debt
   - Suggest improvements

Format your response as JSON:
{
  "complexity": 5.2,
  "maintainabilityIndex": 78.5,
  "codeSmells": [
    {
      "type": "Long Method",
      "severity": "medium",
      "description": "Method exceeds recommended length",
      "filePath": "path/to/file.ts",
      "lineNumber": 42,
      "suggestion": "Break into smaller functions"
    }
  ],
  "securityIssues": [
    {
      "type": "Hardcoded Secret",
      "severity": "high",
      "description": "API key hardcoded in source",
      "filePath": "path/to/file.ts",
      "lineNumber": 15,
      "recommendation": "Use environment variables"
    }
  ],
  "suggestions": [
    "Add input validation to user-facing functions",
    "Implement proper error handling"
  ]
}
`;

      const result = await this.ragManager.query(prompt);
      const metrics = this.parseQualityResponse(result.response);
      
      return metrics;
    } catch (error) {
      throw new Error(`Quality analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildQualityContext(complexityChunks: any[], securityChunks: any[], qualityChunks: any[]): string {
    let context = "## Code Complexity Analysis\n\n";
    
    complexityChunks.forEach((chunk, index) => {
      context += `### Complex Component ${index + 1}\n`;
      context += `**File:** ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}\n`;
      if (chunk.className) context += `**Class:** ${chunk.className}\n`;
      if (chunk.functionName) context += `**Function:** ${chunk.functionName}\n`;
      context += `**Complexity:** ${chunk.metadata?.complexity || 'Unknown'}\n`;
      context += "```\n" + chunk.content.substring(0, 800) + "\n```\n\n";
    });

    context += "## Security-Relevant Code\n\n";
    securityChunks.forEach((chunk, index) => {
      context += `### Security Component ${index + 1}\n`;
      context += `**File:** ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}\n`;
      context += "```\n" + chunk.content.substring(0, 600) + "\n```\n\n";
    });

    context += "## Quality Assessment Areas\n\n";
    qualityChunks.forEach((chunk, index) => {
      context += `### Quality Component ${index + 1}\n`;
      context += `**File:** ${chunk.filePath}:${chunk.startLine}-${chunk.endLine}\n`;
      context += "```\n" + chunk.content.substring(0, 600) + "\n```\n\n";
    });

    return context;
  }

  private parseQualityResponse(response: string): QualityMetrics {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        return {
          complexity: parsed.complexity || 5.0,
          maintainabilityIndex: parsed.maintainabilityIndex || 70.0,
          codeSmells: (parsed.codeSmells || []).map((smell: any) => ({
            type: smell.type || "Unknown",
            severity: smell.severity || "medium",
            description: smell.description || "Code quality issue",
            filePath: smell.filePath || "Unknown",
            lineNumber: smell.lineNumber || 0,
            suggestion: smell.suggestion || "Review and refactor"
          })),
          securityIssues: (parsed.securityIssues || []).map((issue: any) => ({
            type: issue.type || "Security Issue",
            severity: issue.severity || "medium",
            description: issue.description || "Security concern identified",
            filePath: issue.filePath || "Unknown",
            lineNumber: issue.lineNumber || 0,
            recommendation: issue.recommendation || "Review security implications"
          })),
          suggestions: parsed.suggestions || []
        };
      }
    } catch (error) {
      console.warn('Failed to parse quality response JSON:', error);
    }

    // Fallback analysis
    return this.generateFallbackQuality(response);
  }

  private generateFallbackQuality(response: string): QualityMetrics {
    const codeSmells: CodeSmell[] = [];
    const securityIssues: SecurityIssue[] = [];
    const suggestions: string[] = [];

    // Basic pattern matching for common issues
    if (response.toLowerCase().includes('long method') || response.toLowerCase().includes('complex function')) {
      codeSmells.push({
        type: "Long Method",
        severity: "medium",
        description: "Method or function is too long and complex",
        filePath: "Multiple files",
        lineNumber: 0,
        suggestion: "Break into smaller, more focused functions"
      });
    }

    if (response.toLowerCase().includes('duplicate') || response.toLowerCase().includes('repeated')) {
      codeSmells.push({
        type: "Code Duplication",
        severity: "medium",
        description: "Duplicate code detected",
        filePath: "Multiple files",
        lineNumber: 0,
        suggestion: "Extract common code into reusable functions"
      });
    }

    if (response.toLowerCase().includes('hardcoded') || response.toLowerCase().includes('secret')) {
      securityIssues.push({
        type: "Hardcoded Values",
        severity: "high",
        description: "Hardcoded secrets or configuration values found",
        filePath: "Multiple files",
        lineNumber: 0,
        recommendation: "Use environment variables or configuration files"
      });
    }

    if (response.toLowerCase().includes('validation') || response.toLowerCase().includes('input')) {
      securityIssues.push({
        type: "Input Validation",
        severity: "medium",
        description: "Potential input validation issues",
        filePath: "Multiple files",
        lineNumber: 0,
        recommendation: "Implement proper input validation and sanitization"
      });
    }

    suggestions.push("Add comprehensive unit tests");
    suggestions.push("Implement proper error handling");
    suggestions.push("Add code documentation");
    suggestions.push("Consider using linting tools");

    return {
      complexity: 6.5,
      maintainabilityIndex: 65.0,
      codeSmells,
      securityIssues,
      suggestions
    };
  }
}