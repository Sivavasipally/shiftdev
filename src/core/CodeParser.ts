import * as fs from 'fs';
import * as path from 'path';
import { CodeChunk } from '../types';
import { FileUtils } from '../utils/fileUtils';
import { Configuration } from '../utils/configuration';
import { FrameworkDetector, FrameworkInfo } from '../utils/frameworkDetector';

export class CodeParser {
  private readonly supportedExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.go', '.rs', '.php', '.rb', '.vue', '.svelte'];
  private detectedFrameworks: FrameworkInfo[] = [];

  async parseRepository(rootPath: string): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    
    // First, detect frameworks in the repository
    this.detectedFrameworks = await FrameworkDetector.detectFrameworks(rootPath);
    console.log('Detected frameworks:', this.detectedFrameworks.map(f => `${f.name} ${f.version || ''}`));
    
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

    // Add framework-specific metadata chunks
    const frameworkChunks = this.createFrameworkChunks(rootPath);
    chunks.push(...frameworkChunks);

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
    
    if (extension === '.ts' || extension === '.js' || extension === '.tsx' || extension === '.jsx') {
      chunks.push(...this.parseTypeScriptJavaScript(filePath, content, lines, maxChunkSize));
    } else if (extension === '.py') {
      chunks.push(...this.parsePython(filePath, content, lines, maxChunkSize));
    } else if (extension === '.java') {
      chunks.push(...this.parseJava(filePath, content, lines, maxChunkSize));
    } else if (extension === '.vue') {
      chunks.push(...this.parseVue(filePath, content, lines, maxChunkSize));
    } else if (extension === '.svelte') {
      chunks.push(...this.parseSvelte(filePath, content, lines, maxChunkSize));
    }

    return chunks;
  }

  private parseTypeScriptJavaScript(filePath: string, content: string, lines: string[], maxChunkSize: number): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Enhanced parsing with framework-specific patterns
    const classRegex = /class\s+(\w+)/g;
    const functionRegex = /(?:function\s+(\w+)|(\w+)\s*[=:]\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>))/g;
    const interfaceRegex = /interface\s+(\w+)/g;
    const componentRegex = /@Component\s*\(\s*\{|function\s+(\w+)\s*\(.*\)\s*\{|const\s+(\w+)\s*=\s*\(/g;
    const hookRegex = /const\s+\[(\w+),\s*set\w+\]\s*=\s*useState|useEffect\s*\(|use\w+\s*\(/g;

    let match;
    
    // Detect framework context
    const isReact = this.isReactFile(content);
    const isAngular = this.isAngularFile(content);
    const isVue = this.isVueFile(content);
    const isNode = this.isNodeFile(content);

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
            complexity: this.calculateComplexity(classContent),
            framework: isReact ? 'react' : isAngular ? 'angular' : isVue ? 'vue' : isNode ? 'node' : undefined
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
            complexity: this.calculateComplexity(functionContent),
            framework: isReact ? 'react' : isAngular ? 'angular' : isVue ? 'vue' : isNode ? 'node' : undefined
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
            complexity: 1,
            isInterface: true,
            framework: isReact ? 'react' : isAngular ? 'angular' : isVue ? 'vue' : isNode ? 'node' : undefined
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
    
    // Enhanced Python parsing with framework-specific patterns
    const classRegex = /class\s+(\w+)/g;
    const functionRegex = /def\s+(\w+)/g;
    const decoratorRegex = /@(\w+\.?\w*)\s*(?:\([^)]*\))?\s*\n\s*def\s+(\w+)/g;
    const flaskRouteRegex = /@app\.route\s*\(\s*['"]([^'"]+)['"]/g;
    const fastApiRouteRegex = /@app\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g;

    let match;
    
    // Detect framework context
    const isFlask = this.isFlaskFile(content);
    const isFastAPI = this.isFastAPIFile(content);
    const isDjango = this.isDjangoFile(content);

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
            complexity: this.calculateComplexity(classContent),
            framework: isFlask ? 'flask' : isFastAPI ? 'fastapi' : isDjango ? 'django' : undefined
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
            complexity: this.calculateComplexity(functionContent),
            framework: isFlask ? 'flask' : isFastAPI ? 'fastapi' : isDjango ? 'django' : undefined
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
    
    // Enhanced Java parsing patterns
    const classRegex = /(?:@\w+\s+)*(?:public\s+|private\s+|protected\s+)?(?:final\s+|abstract\s+)?class\s+(\w+)/g;
    const interfaceRegex = /(?:@\w+\s+)*(?:public\s+|private\s+|protected\s+)?interface\s+(\w+)/g;
    const enumRegex = /(?:@\w+\s+)*(?:public\s+|private\s+|protected\s+)?enum\s+(\w+)/g;
    const annotationRegex = /(?:@\w+\s+)*(?:public\s+)?@interface\s+(\w+)/g;
    const methodRegex = /(?:@\w+\s+)*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:\w+(?:<[^>]+>)?\s+)+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w\s,]+)?\s*\{/g;

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
          chunkType: 'class', // Treat interface as class type for search
          metadata: {
            language: 'java',
            className: interfaceName,
            isInterface: true,
            complexity: 1
          },
          denseVector: [],
          sparseVector: {}
        });
      }
    }

    // Parse enums
    enumRegex.lastIndex = 0;
    while ((match = enumRegex.exec(content)) !== null) {
      const enumName = match[1];
      const startPos = match.index;
      const lineNumber = content.substring(0, startPos).split('\n').length;
      
      const enumContent = this.extractBlock(content, startPos, '{', '}');
      
      if (enumContent.length <= maxChunkSize) {
        chunks.push({
          id: `enum_${this.generateId(filePath + enumName)}`,
          content: enumContent,
          filePath,
          startLine: lineNumber,
          endLine: lineNumber + enumContent.split('\n').length - 1,
          chunkType: 'class', // Treat enum as class type for search
          metadata: {
            language: 'java',
            className: enumName,
            isEnum: true,
            complexity: 1
          },
          denseVector: [],
          sparseVector: {}
        });
      }
    }

    // Parse annotation interfaces
    annotationRegex.lastIndex = 0;
    while ((match = annotationRegex.exec(content)) !== null) {
      const annotationName = match[1];
      const startPos = match.index;
      const lineNumber = content.substring(0, startPos).split('\n').length;
      
      const annotationContent = this.extractBlock(content, startPos, '{', '}');
      
      if (annotationContent.length <= maxChunkSize) {
        chunks.push({
          id: `annotation_${this.generateId(filePath + annotationName)}`,
          content: annotationContent,
          filePath,
          startLine: lineNumber,
          endLine: lineNumber + annotationContent.split('\n').length - 1,
          chunkType: 'class', // Treat annotation as class type for search
          metadata: {
            language: 'java',
            className: annotationName,
            isAnnotation: true,
            complexity: 1
          },
          denseVector: [],
          sparseVector: {}
        });
      }
    }

    // Parse methods
    methodRegex.lastIndex = 0;
    while ((match = methodRegex.exec(content)) !== null) {
      const methodName = match[1];
      const startPos = match.index;
      const lineNumber = content.substring(0, startPos).split('\n').length;
      
      const methodContent = this.extractBlock(content, startPos, '{', '}');
      
      if (methodContent.length <= maxChunkSize) {
        chunks.push({
          id: `method_${this.generateId(filePath + methodName)}`,
          content: methodContent,
          filePath,
          startLine: lineNumber,
          endLine: lineNumber + methodContent.split('\n').length - 1,
          chunkType: 'function',
          metadata: {
            language: 'java',
            functionName: methodName,
            complexity: this.calculateComplexity(methodContent)
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

  // Framework detection methods
  private isReactFile(content: string): boolean {
    return content.includes('from react') || 
           content.includes('import React') || 
           content.includes('useState') || 
           content.includes('useEffect') ||
           content.includes('JSX.Element') ||
           content.includes('React.Component');
  }

  private isAngularFile(content: string): boolean {
    return content.includes('@Component') || 
           content.includes('@Injectable') || 
           content.includes('@NgModule') ||
           content.includes('from @angular');
  }

  private isVueFile(content: string): boolean {
    return content.includes('from vue') || 
           content.includes('Vue.') || 
           content.includes('createApp') ||
           content.includes('defineComponent');
  }

  private isNodeFile(content: string): boolean {
    return content.includes('require(') || 
           content.includes('module.exports') || 
           content.includes('process.env') ||
           content.includes('__dirname') ||
           content.includes('express') ||
           content.includes('fastify');
  }

  private isFlaskFile(content: string): boolean {
    return content.includes('from flask') || 
           content.includes('import flask') || 
           content.includes('@app.route') ||
           content.includes('Flask(__name__)');
  }

  private isFastAPIFile(content: string): boolean {
    return content.includes('from fastapi') || 
           content.includes('import fastapi') || 
           content.includes('FastAPI()') ||
           content.includes('@app.get') ||
           content.includes('@app.post');
  }

  private isDjangoFile(content: string): boolean {
    return content.includes('from django') || 
           content.includes('import django') || 
           content.includes('models.Model') ||
           content.includes('views.View') ||
           content.includes('HttpResponse');
  }

  // Framework-specific parsing methods
  private parseVue(filePath: string, content: string, lines: string[], maxChunkSize: number): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Parse Vue SFC (Single File Component)
    const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/);
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    
    if (templateMatch) {
      chunks.push({
        id: `vue_template_${this.generateId(filePath)}`,
        content: templateMatch[1],
        filePath,
        startLine: this.getLineNumber(content, templateMatch.index!),
        endLine: this.getLineNumber(content, templateMatch.index! + templateMatch[0].length),
        chunkType: 'block',
        metadata: {
          language: 'vue-template',
          componentType: 'template',
          framework: 'vue'
        },
        denseVector: [],
        sparseVector: {}
      });
    }
    
    if (scriptMatch) {
      chunks.push({
        id: `vue_script_${this.generateId(filePath)}`,
        content: scriptMatch[1],
        filePath,
        startLine: this.getLineNumber(content, scriptMatch.index!),
        endLine: this.getLineNumber(content, scriptMatch.index! + scriptMatch[0].length),
        chunkType: 'block',
        metadata: {
          language: 'javascript',
          componentType: 'script',
          framework: 'vue'
        },
        denseVector: [],
        sparseVector: {}
      });
    }
    
    return chunks;
  }

  private parseSvelte(filePath: string, content: string, lines: string[], maxChunkSize: number): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    // Parse Svelte component
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    
    // The rest is the template
    let templateContent = content;
    if (scriptMatch) {
      templateContent = templateContent.replace(scriptMatch[0], '');
    }
    if (styleMatch) {
      templateContent = templateContent.replace(styleMatch[0], '');
    }
    
    if (scriptMatch) {
      chunks.push({
        id: `svelte_script_${this.generateId(filePath)}`,
        content: scriptMatch[1],
        filePath,
        startLine: this.getLineNumber(content, scriptMatch.index!),
        endLine: this.getLineNumber(content, scriptMatch.index! + scriptMatch[0].length),
        chunkType: 'block',
        metadata: {
          language: 'javascript',
          componentType: 'script',
          framework: 'svelte'
        },
        denseVector: [],
        sparseVector: {}
      });
    }
    
    return chunks;
  }

  private createFrameworkChunks(rootPath: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    for (const framework of this.detectedFrameworks) {
      const frameworkSummary = this.createFrameworkSummary(framework, rootPath);
      
      chunks.push({
        id: `framework_${this.generateId(framework.name)}`,
        content: frameworkSummary,
        filePath: rootPath,
        startLine: 1,
        endLine: 1,
        chunkType: 'file',
        metadata: {
          language: framework.language,
          framework: framework.name.toLowerCase(),
          frameworkVersion: framework.version,
          frameworkType: framework.type,
          isFrameworkSummary: true
        },
        denseVector: [],
        sparseVector: {}
      });
    }
    
    return chunks;
  }

  private createFrameworkSummary(framework: FrameworkInfo, rootPath: string): string {
    let summary = `# ${framework.name} Framework Analysis\n\n`;
    summary += `**Version:** ${framework.version || 'Unknown'}\n`;
    summary += `**Type:** ${framework.type}\n`;
    summary += `**Language:** ${framework.language}\n\n`;
    
    if (framework.dependencies && framework.dependencies.length > 0) {
      summary += `**Dependencies:**\n`;
      framework.dependencies.slice(0, 10).forEach(dep => {
        summary += `- ${dep}\n`;
      });
      if (framework.dependencies.length > 10) {
        summary += `- ... and ${framework.dependencies.length - 10} more\n`;
      }
      summary += `\n`;
    }
    
    if (framework.patterns && framework.patterns.length > 0) {
      summary += `**Key Patterns & Annotations:**\n`;
      framework.patterns.forEach(pattern => {
        summary += `- ${pattern}\n`;
      });
      summary += `\n`;
    }
    
    if (framework.configFiles && framework.configFiles.length > 0) {
      summary += `**Configuration Files:**\n`;
      framework.configFiles.forEach(file => {
        summary += `- ${file}\n`;
      });
      summary += `\n`;
    }
    
    // Add framework-specific architecture patterns
    summary += this.getFrameworkArchitecturePatterns(framework.name);
    
    return summary;
  }

  private getFrameworkArchitecturePatterns(frameworkName: string): string {
    const patterns: Record<string, string> = {
      'Spring Boot': `
**Architecture Patterns:**
- MVC (Model-View-Controller) pattern
- Dependency Injection with @Autowired
- RESTful API design with @RestController
- Service layer pattern with @Service
- Repository pattern with @Repository
- Configuration management with @Configuration
- Auto-configuration and starter dependencies
- Embedded server (Tomcat, Jetty, Undertow)
- Spring Security for authentication/authorization
- Spring Data for database access
      `,
      'React': `
**Architecture Patterns:**
- Component-based architecture
- Unidirectional data flow
- Virtual DOM rendering
- Hooks for state management (useState, useEffect)
- Context API for global state
- Higher-Order Components (HOCs)
- Render props pattern
- Custom hooks for reusable logic
- JSX for templating
- Props for component communication
      `,
      'Angular': `
**Architecture Patterns:**
- Component-based architecture
- Dependency Injection
- Services for business logic
- Modules for feature organization
- Directives for DOM manipulation
- Pipes for data transformation
- Observables for async operations
- TypeScript for type safety
- CLI for project scaffolding
- Guards for route protection
      `,
      'Flask': `
**Architecture Patterns:**
- WSGI application
- Blueprints for modular design
- Jinja2 templating
- Request-response cycle
- Application context
- Decorators for routing
- Middleware support
- Extension system
- Configuration management
- SQLAlchemy integration
      `,
      'FastAPI': `
**Architecture Patterns:**
- ASGI application
- Type hints and Pydantic validation
- Automatic API documentation
- Dependency injection system
- Async/await support
- OpenAPI schema generation
- OAuth2 and JWT authentication
- Background tasks
- WebSocket support
- High performance with Starlette
      `
    };
    
    return patterns[frameworkName] || '';
  }

  private getLineNumber(content: string, position: number): number {
    return content.substring(0, position).split('\n').length;
  }
}