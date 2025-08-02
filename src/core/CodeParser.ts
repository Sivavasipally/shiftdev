import * as fs from 'fs';
import * as path from 'path';
import { CodeChunk } from '../types';
import { FileUtils } from '../utils/fileUtils';
import { Configuration } from '../utils/configuration';

export class CodeParser {
  private readonly supportedExtensions = ['.ts', '.js', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.php', '.rb'];

  async parseRepository(rootPath: string): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    const files = await this.discoverFiles(rootPath);
    const chunkSize = Configuration.getChunkSize();

    for (const filePath of files) {
      try {
        const fileContent = await FileUtils.readFileAsync(filePath);
        const fileChunks = await this.parseFile(filePath, fileContent, chunkSize);
        chunks.push(...fileChunks);
      } catch (error) {
        console.warn(`Failed to parse ${filePath}:`, error);
      }
    }

    return chunks;
  }

  private async discoverFiles(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    const gitignorePatterns = await FileUtils.loadGitignore(rootPath);

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (FileUtils.shouldIgnoreFile(fullPath, rootPath)) {
            continue;
          }

          if (this.shouldIgnoreByGitignore(fullPath, rootPath, gitignorePatterns)) {
            continue;
          }

          if (entry.isDirectory()) {
            await walk(fullPath);
          } else if (FileUtils.isTextFile(entry.name)) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`Failed to read directory ${dir}:`, error);
      }
    };

    await walk(rootPath);
    return files;
  }

  private async parseFile(filePath: string, content: string, maxChunkSize: number): Promise<CodeChunk[]> {
    const extension = path.extname(filePath);
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

    // Level 1: File-level chunk (for smaller files)
    if (content.length <= maxChunkSize) {
      chunks.push(this.createFileChunk(filePath, content, lines.length));
    } else {
      // Split large files into smaller chunks
      const fileChunks = this.splitLargeFile(filePath, content, maxChunkSize);
      chunks.push(...fileChunks);
    }

    if (this.supportedExtensions.includes(extension)) {
      // Level 2 & 3: AST-based parsing
      const astChunks = await this.parseWithAST(filePath, content, extension, maxChunkSize);
      chunks.push(...astChunks);
    }

    return chunks;
  }

  private createFileChunk(filePath: string, content: string, totalLines: number): CodeChunk {
    return {
      id: `file_${this.generateId(filePath)}`,
      content: content.substring(0, 8000), // Limit for embeddings
      filePath,
      startLine: 1,
      endLine: totalLines,
      chunkType: 'file',
      metadata: {
        language: this.detectLanguage(path.extname(filePath))
      },
      denseVector: [], // Will be populated by embedding
      sparseVector: {}
    };
  }

  private splitLargeFile(filePath: string, content: string, maxChunkSize: number): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    let currentChunk = '';
    let startLine = 1;
    let currentLine = 1;

    for (const line of lines) {
      if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          id: `file_${this.generateId(filePath + startLine)}`,
          content: currentChunk,
          filePath,
          startLine,
          endLine: currentLine - 1,
          chunkType: 'block',
          metadata: {
            language: this.detectLanguage(path.extname(filePath))
          },
          denseVector: [],
          sparseVector: {}
        });

        currentChunk = '';
        startLine = currentLine;
      }

      currentChunk += line + '\n';
      currentLine++;
    }

    // Add remaining chunk
    if (currentChunk.trim()) {
      chunks.push({
        id: `file_${this.generateId(filePath + startLine)}`,
        content: currentChunk,
        filePath,
        startLine,
        endLine: currentLine - 1,
        chunkType: 'block',
        metadata: {
          language: this.detectLanguage(path.extname(filePath))
        },
        denseVector: [],
        sparseVector: {}
      });
    }

    return chunks;
  }

  private async parseWithAST(
    filePath: string, 
    content: string, 
    extension: string,
    maxChunkSize: number
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

    // Simplified AST parsing - in production, use proper parsers like:
    // - @typescript-eslint/parser for TS/JS
    // - tree-sitter for multi-language support
    // - python-ast for Python
    
    if (extension === '.ts' || extension === '.js') {
      chunks.push(...this.parseTypeScript(filePath, content, lines, maxChunkSize));
    } else if (extension === '.py') {
      chunks.push(...this.parsePython(filePath, content, lines, maxChunkSize));
    } else if (extension === '.java') {
      chunks.push(...this.parseJava(filePath, content, lines, maxChunkSize));
    }

    return chunks;
  }

  private parseTypeScript(filePath: string, content: string, lines: string[], maxChunkSize: number): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Simple regex-based parsing for demo - use proper AST in production
    const classRegex = /class\s+(\w+)/g;
    const functionRegex = /(?:function\s+(\w+)|(\w+)\s*[=:]\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g;
    const interfaceRegex = /interface\s+(\w+)/g;

    let match;

    // Parse classes
    classRegex.lastIndex = 0;
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const startPos = match.index;
      const lineNumber = content.substring(0, startPos).split('\n').length;
      
      const classContent = this.extractBlock(content, startPos, '{', '}');
      
      if (classContent.length <= maxChunkSize) {
        chunks.push({
          id: `class_${this.generateId(filePath + className)}`,
          content: classContent,
          filePath,
          startLine: lineNumber,
          endLine: lineNumber + classContent.split('\n').length - 1,
          chunkType: 'class',
          metadata: {
            language: 'typescript',
            className,
            complexity: this.calculateComplexity(classContent)
          },
          denseVector: [],
          sparseVector: {}
        });
      }
    }

    // Parse functions
    functionRegex.lastIndex = 0;
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1] || match[2];
      if (!functionName) continue;
      
      const startPos = match.index;
      const lineNumber = content.substring(0, startPos).split('\n').length;
      
      const functionContent = this.extractBlock(content, startPos, '{', '}');
      
      if (functionContent.length <= maxChunkSize) {
        chunks.push({
          id: `function_${this.generateId(filePath + functionName)}`,
          content: functionContent,
          filePath,
          startLine: lineNumber,
          endLine: lineNumber + functionContent.split('\n').length - 1,
          chunkType: 'function',
          metadata: {
            language: 'typescript',
            functionName,
            complexity: this.calculateComplexity(functionContent)
          },
          denseVector: [],
          sparseVector: {}
        });
      }
    }

    // Parse interfaces
    interfaceRegex.lastIndex = 0;
    while ((match = interfaceRegex.exec(content)) !== null) {
      const interfaceName = match[1];
      const startPos = match.index;
      const lineNumber = content.substring(0, startPos).split('\n').length;
      
      const interfaceContent = this.extractBlock(content, startPos, '{', '}');
      
      if (interfaceContent.length <= maxChunkSize) {
        chunks.push({
          id: `interface_${this.generateId(filePath + interfaceName)}`,
          content: interfaceContent,
          filePath,
          startLine: lineNumber,
          endLine: lineNumber + interfaceContent.split('\n').length - 1,
          chunkType: 'class', // Treating interface as class type
          metadata: {
            language: 'typescript',
            className: interfaceName,
            complexity: 1
          },
          denseVector: [],
          sparseVector: {}
        });
      }
    }

    return chunks;
  }

  private parsePython(filePath: string, content: string, lines: string[], maxChunkSize: number): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    const classRegex = /class\s+(\w+)/g;
    const functionRegex = /def\s+(\w+)/g;

    let match;

    // Parse classes
    classRegex.lastIndex = 0;
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const startPos = match.index;
      const lineNumber = content.substring(0, startPos).split('\n').length;
      
      const classContent = this.extractPythonBlock(content, startPos);
      
      if (classContent.length <= maxChunkSize) {
        chunks.push({
          id: `class_${this.generateId(filePath + className)}`,
          content: classContent,
          filePath,
          startLine: lineNumber,
          endLine: lineNumber + classContent.split('\n').length - 1,
          chunkType: 'class',
          metadata: {
            language: 'python',
            className,
            complexity: this.calculateComplexity(classContent)
          },
          denseVector: [],
          sparseVector: {}
        });
      }
    }

    // Parse functions
    functionRegex.lastIndex = 0;
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const startPos = match.index;
      const lineNumber = content.substring(0, startPos).split('\n').length;
      
      const functionContent = this.extractPythonBlock(content, startPos);
      
      if (functionContent.length <= maxChunkSize) {
        chunks.push({
          id: `function_${this.generateId(filePath + functionName)}`,
          content: functionContent,
          filePath,
          startLine: lineNumber,
          endLine: lineNumber + functionContent.split('\n').length - 1,
          chunkType: 'function',
          metadata: {
            language: 'python',
            functionName,
            complexity: this.calculateComplexity(functionContent)
          },
          denseVector: [],
          sparseVector: {}
        });
      }
    }

    return chunks;
  }

  private parseJava(filePath: string, content: string, lines: string[], maxChunkSize: number): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    const classRegex = /(?:public\s+|private\s+|protected\s+)?class\s+(\w+)/g;
    const methodRegex = /(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:\w+\s+)*(\w+)\s*\([^)]*\)\s*\{/g;

    let match;

    // Parse classes
    classRegex.lastIndex = 0;
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const startPos = match.index;
      const lineNumber = content.substring(0, startPos).split('\n').length;
      
      const classContent = this.extractBlock(content, startPos, '{', '}');
      
      if (classContent.length <= maxChunkSize) {
        chunks.push({
          id: `class_${this.generateId(filePath + className)}`,
          content: classContent,
          filePath,
          startLine: lineNumber,
          endLine: lineNumber + classContent.split('\n').length - 1,
          chunkType: 'class',
          metadata: {
            language: 'java',
            className,
            complexity: this.calculateComplexity(classContent)
          },
          denseVector: [],
          sparseVector: {}
        });
      }
    }

    return chunks;
  }

  private extractBlock(content: string, startPos: number, openChar: string, closeChar: string): string {
    let depth = 0;
    let i = startPos;
    let start = -1;

    // Find the opening brace
    while (i < content.length) {
      if (content[i] === openChar) {
        if (start === -1) start = i;
        depth++;
      } else if (content[i] === closeChar) {
        depth--;
        if (depth === 0 && start !== -1) {
          return content.substring(startPos, i + 1);
        }
      }
      i++;
    }

    return content.substring(startPos, Math.min(startPos + 1000, content.length));
  }

  private extractPythonBlock(content: string, startPos: number): string {
    const lines = content.substring(startPos).split('\n');
    const result = [lines[0]]; // Class/function definition line
    
    if (lines.length < 2) return lines[0];
    
    // Find the indentation level of the next line
    let baseIndent = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      
      baseIndent = line.length - line.trimStart().length;
      break;
    }

    // Include all lines with indentation >= baseIndent
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') {
        result.push(line);
        continue;
      }
      
      const indent = line.length - line.trimStart().length;
      if (indent >= baseIndent) {
        result.push(line);
      } else {
        break;
      }
    }

    return result.join('\n');
  }

  private calculateComplexity(code: string): number {
    // Simplified cyclomatic complexity
    const complexityKeywords = [
      'if', 'else', 'elif', 'while', 'for', 'case', 'switch', 
      'catch', 'except', 'try', '&&', '||', '\\?'
    ];
    
    let complexity = 1; // Base complexity
    
    for (const keyword of complexityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = code.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  private shouldIgnoreByGitignore(filePath: string, rootPath: string, patterns: string[]): boolean {
    const relativePath = path.relative(rootPath, filePath);
    
    return patterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(relativePath);
      }
      return relativePath.includes(pattern);
    });
  }

  private detectLanguage(extension: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript',
      '.tsx': 'typescript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.rb': 'ruby',
      '.md': 'markdown',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss'
    };
    
    return languageMap[extension] || 'text';
  }

  private generateId(input: string): string {
    // Simple hash function for IDs
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}