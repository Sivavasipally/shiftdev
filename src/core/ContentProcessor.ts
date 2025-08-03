import * as path from 'path';
import { FileUtils } from '../utils/fileUtils';
import { FileClassification, SecondaryClassification, TertiaryClassification, PrimaryClassification } from './FileClassifier';
import { CodeChunk } from '../types';

export interface ProcessedContent {
  chunks: ContentChunk[];
  metadata: ContentMetadata;
  relationships: ContentRelationship[];
}

export interface ContentChunk {
  id: string;
  content: string;
  startPosition: number;
  endPosition: number;
  chunkType: ChunkType;
  metadata: ChunkMetadata;
  dependencies: string[];
  patterns: string[];
}

export enum ChunkType {
  Function = 'function',
  Class = 'class',
  Component = 'component',
  Route = 'route',
  Configuration = 'configuration',
  Documentation = 'documentation',
  Template = 'template',
  Style = 'style',
  Test = 'test',
  Schema = 'schema'
}

export interface ChunkMetadata {
  name?: string;
  type: string;
  framework?: string;
  language: string;
  complexity: number;
  importance: number;
  tags: string[];
  annotations: string[];
  parameters?: string[];
  returnType?: string;
}

export interface ContentMetadata {
  filePath: string;
  classification: FileClassification;
  size: number;
  encoding: string;
  language: string;
  framework?: string;
  extractedElements: ExtractedElement[];
  dependencies: FileDependency[];
  exports: string[];
  imports: string[];
}

export interface ExtractedElement {
  type: 'class' | 'function' | 'interface' | 'enum' | 'component' | 'route' | 'configuration';
  name: string;
  startLine: number;
  endLine: number;
  signature?: string;
  documentation?: string;
  annotations: string[];
  visibility?: 'public' | 'private' | 'protected' | 'internal';
}

export interface FileDependency {
  path: string;
  type: 'import' | 'reference' | 'inherit' | 'implement';
  confidence: number;
}

export interface ContentRelationship {
  sourceChunk: string;
  targetChunk: string;
  relationshipType: 'calls' | 'extends' | 'implements' | 'uses' | 'configures' | 'references';
  confidence: number;
}

export class ContentProcessor {
  async processContent(filePath: string, classification: FileClassification): Promise<ProcessedContent> {
    console.log(`📊 Phase 3: Processing content for: ${filePath}`);
    
    const content = await this.extractContent(filePath, classification);
    const chunks = await this.createChunks(content, filePath, classification);
    const metadata = await this.enrichMetadata(filePath, classification, content);
    const relationships = this.analyzeRelationships(chunks);
    
    return {
      chunks,
      metadata,
      relationships
    };
  }

  private async extractContent(filePath: string, classification: FileClassification): Promise<string> {
    try {
      switch (classification.secondary) {
        case SecondaryClassification.Code:
          return await this.extractCodeContent(filePath);
        case SecondaryClassification.Configuration:
          return await this.extractConfigContent(filePath);
        case SecondaryClassification.Template:
          return await this.extractTemplateContent(filePath);
        case SecondaryClassification.Documentation:
          return await this.extractDocumentationContent(filePath);
        default:
          return await FileUtils.readFileAsync(filePath);
      }
    } catch (error) {
      console.warn(`Error extracting content from ${filePath}:`, error);
      return '';
    }
  }

  private async extractCodeContent(filePath: string): Promise<string> {
    const content = await FileUtils.readFileAsync(filePath);
    
    // Remove comments and clean up code for better processing
    const extension = path.extname(filePath).toLowerCase();
    
    switch (extension) {
      case '.java':
        return this.cleanJavaCode(content);
      case '.js':
      case '.ts':
      case '.jsx':
      case '.tsx':
        return this.cleanJavaScriptCode(content);
      case '.py':
        return this.cleanPythonCode(content);
      default:
        return content;
    }
  }

  private async extractConfigContent(filePath: string): Promise<string> {
    const content = await FileUtils.readFileAsync(filePath);
    const extension = path.extname(filePath).toLowerCase();
    
    // Parse and structure configuration content
    switch (extension) {
      case '.json':
        return this.structureJsonConfig(content);
      case '.yml':
      case '.yaml':
        return this.structureYamlConfig(content);
      case '.properties':
        return this.structurePropertiesConfig(content);
      case '.xml':
        return this.structureXmlConfig(content);
      default:
        return content;
    }
  }

  private async extractTemplateContent(filePath: string): Promise<string> {
    const content = await FileUtils.readFileAsync(filePath);
    
    // Extract both structure and embedded logic from templates
    return this.extractTemplateStructure(content, path.extname(filePath));
  }

  private async extractDocumentationContent(filePath: string): Promise<string> {
    const content = await FileUtils.readFileAsync(filePath);
    
    // Structure documentation for better semantic understanding
    return this.structureDocumentation(content, path.extname(filePath));
  }

  private async createChunks(content: string, filePath: string, classification: FileClassification): Promise<ContentChunk[]> {
    const chunks: ContentChunk[] = [];
    
    switch (classification.secondary) {
      case SecondaryClassification.Code:
        chunks.push(...await this.createCodeChunks(content, filePath, classification));
        break;
      case SecondaryClassification.Configuration:
        chunks.push(...await this.createConfigChunks(content, filePath, classification));
        break;
      case SecondaryClassification.Template:
        chunks.push(...await this.createTemplateChunks(content, filePath, classification));
        break;
      case SecondaryClassification.Documentation:
        chunks.push(...await this.createDocumentationChunks(content, filePath, classification));
        break;
      default:
        chunks.push(...await this.createGenericChunks(content, filePath, classification));
    }
    
    return chunks;
  }

  private async createCodeChunks(content: string, filePath: string, classification: FileClassification): Promise<ContentChunk[]> {
    const chunks: ContentChunk[] = [];
    const extension = path.extname(filePath).toLowerCase();
    
    switch (extension) {
      case '.java':
        chunks.push(...this.createJavaChunks(content, filePath, classification));
        break;
      case '.js':
      case '.ts':
      case '.jsx':
      case '.tsx':
        chunks.push(...this.createJavaScriptChunks(content, filePath, classification));
        break;
      case '.py':
        if (classification.primary === PrimaryClassification.Streamlit) {
          chunks.push(...this.createStreamlitChunks(content, filePath, classification));
        } else {
          chunks.push(...this.createPythonChunks(content, filePath, classification));
        }
        break;
      case '.vue':
        chunks.push(...this.createVueChunks(content, filePath, classification));
        break;
      default:
        chunks.push(...this.createGenericCodeChunks(content, filePath, classification));
    }
    
    return chunks;
  }

  private createJavaChunks(content: string, filePath: string, classification: FileClassification): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    
    // Extract classes
    const classRegex = /(?:@[\w\s()=",.\[\]{}]*\s+)*(?:public\s+|private\s+|protected\s+)?(?:final\s+|abstract\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/g;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const startPos = match.index;
      const classContent = this.extractJavaBlock(content, startPos);
      
      chunks.push({
        id: this.generateChunkId(filePath, 'class', className),
        content: classContent,
        startPosition: startPos,
        endPosition: startPos + classContent.length,
        chunkType: ChunkType.Class,
        metadata: {
          name: className,
          type: 'class',
          framework: this.getFrameworkFromClassification(classification),
          language: 'java',
          complexity: this.calculateComplexity(classContent),
          importance: this.calculateImportance(classContent, 'class'),
          tags: this.extractTags(classContent),
          annotations: this.extractJavaAnnotations(classContent)
        },
        dependencies: this.extractDependencies(classContent),
        patterns: this.extractPatterns(classContent, 'java')
      });
    }
    
    // Extract methods
    const methodRegex = /(?:@[\w\s()=",.\[\]{}]*\s+)*(?:public\s+|private\s+|protected\s+)?(?:static\s+)?(?:final\s+)?(?:synchronized\s+)?(?:\w+(?:<[^>]+>)?\s+)+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w\s,]+)?\s*\{/g;
    
    while ((match = methodRegex.exec(content)) !== null) {
      const methodName = match[1];
      const startPos = match.index;
      const methodContent = this.extractJavaBlock(content, startPos);
      
      chunks.push({
        id: this.generateChunkId(filePath, 'method', methodName),
        content: methodContent,
        startPosition: startPos,
        endPosition: startPos + methodContent.length,
        chunkType: ChunkType.Function,
        metadata: {
          name: methodName,
          type: 'method',
          framework: this.getFrameworkFromClassification(classification),
          language: 'java',
          complexity: this.calculateComplexity(methodContent),
          importance: this.calculateImportance(methodContent, 'method'),
          tags: this.extractTags(methodContent),
          annotations: this.extractJavaAnnotations(methodContent),
          parameters: this.extractMethodParameters(match[0]),
          returnType: this.extractReturnType(match[0])
        },
        dependencies: this.extractDependencies(methodContent),
        patterns: this.extractPatterns(methodContent, 'java')
      });
    }
    
    return chunks;
  }

  private createJavaScriptChunks(content: string, filePath: string, classification: FileClassification): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    
    // Extract React components
    if (classification.primary.toString().includes('react')) {
      const componentRegex = /(?:export\s+)?(?:default\s+)?(?:function|const)\s+(\w+)\s*(?:=\s*)?(?:\([^)]*\))?\s*(?:=>)?\s*\{/g;
      let match;
      
      while ((match = componentRegex.exec(content)) !== null) {
        const componentName = match[1];
        if (this.isReactComponent(componentName, content, match.index)) {
          const startPos = match.index;
          const componentContent = this.extractJavaScriptBlock(content, startPos);
          
          chunks.push({
            id: this.generateChunkId(filePath, 'component', componentName),
            content: componentContent,
            startPosition: startPos,
            endPosition: startPos + componentContent.length,
            chunkType: ChunkType.Component,
            metadata: {
              name: componentName,
              type: 'component',
              framework: 'react',
              language: 'javascript',
              complexity: this.calculateComplexity(componentContent),
              importance: this.calculateImportance(componentContent, 'component'),
              tags: this.extractTags(componentContent),
              annotations: this.extractJSXAnnotations(componentContent)
            },
            dependencies: this.extractDependencies(componentContent),
            patterns: this.extractPatterns(componentContent, 'react')
          });
        }
      }
    }
    
    // Extract regular functions
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const startPos = match.index;
      const functionContent = this.extractJavaScriptBlock(content, startPos);
      
      chunks.push({
        id: this.generateChunkId(filePath, 'function', functionName),
        content: functionContent,
        startPosition: startPos,
        endPosition: startPos + functionContent.length,
        chunkType: ChunkType.Function,
        metadata: {
          name: functionName,
          type: 'function',
          framework: this.getFrameworkFromClassification(classification),
          language: 'javascript',
          complexity: this.calculateComplexity(functionContent),
          importance: this.calculateImportance(functionContent, 'function'),
          tags: this.extractTags(functionContent),
          annotations: []
        },
        dependencies: this.extractDependencies(functionContent),
        patterns: this.extractPatterns(functionContent, 'javascript')
      });
    }
    
    return chunks;
  }

  private createPythonChunks(content: string, filePath: string, classification: FileClassification): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    
    // Extract classes
    const classRegex = /class\s+(\w+)(?:\([^)]*\))?\s*:/g;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const startPos = match.index;
      const classContent = this.extractPythonBlock(content, startPos);
      
      chunks.push({
        id: this.generateChunkId(filePath, 'class', className),
        content: classContent,
        startPosition: startPos,
        endPosition: startPos + classContent.length,
        chunkType: ChunkType.Class,
        metadata: {
          name: className,
          type: 'class',
          framework: this.getFrameworkFromClassification(classification),
          language: 'python',
          complexity: this.calculateComplexity(classContent),
          importance: this.calculateImportance(classContent, 'class'),
          tags: this.extractTags(classContent),
          annotations: this.extractPythonDecorators(classContent)
        },
        dependencies: this.extractDependencies(classContent),
        patterns: this.extractPatterns(classContent, 'python')
      });
    }
    
    // Extract functions
    const functionRegex = /(?:@[\w\s()=",.\[\]{}]*\s+)*def\s+(\w+)\s*\([^)]*\)\s*(?:->\s*[^:]+)?\s*:/g;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const startPos = match.index;
      const functionContent = this.extractPythonBlock(content, startPos);
      
      // Determine if it's a route based on decorators
      const isRoute = functionContent.includes('@app.route') || functionContent.includes('@app.get') || functionContent.includes('@app.post');
      const chunkType = isRoute ? ChunkType.Route : ChunkType.Function;
      
      chunks.push({
        id: this.generateChunkId(filePath, isRoute ? 'route' : 'function', functionName),
        content: functionContent,
        startPosition: startPos,
        endPosition: startPos + functionContent.length,
        chunkType,
        metadata: {
          name: functionName,
          type: isRoute ? 'route' : 'function',
          framework: this.getFrameworkFromClassification(classification),
          language: 'python',
          complexity: this.calculateComplexity(functionContent),
          importance: this.calculateImportance(functionContent, isRoute ? 'route' : 'function'),
          tags: this.extractTags(functionContent),
          annotations: this.extractPythonDecorators(functionContent)
        },
        dependencies: this.extractDependencies(functionContent),
        patterns: this.extractPatterns(functionContent, 'python')
      });
    }
    
    return chunks;
  }

  private createVueChunks(content: string, filePath: string, classification: FileClassification): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    
    // Extract template section
    const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/);
    if (templateMatch) {
      chunks.push({
        id: this.generateChunkId(filePath, 'template', 'template'),
        content: templateMatch[1],
        startPosition: templateMatch.index!,
        endPosition: templateMatch.index! + templateMatch[0].length,
        chunkType: ChunkType.Template,
        metadata: {
          name: 'template',
          type: 'template',
          framework: 'vue',
          language: 'html',
          complexity: this.calculateComplexity(templateMatch[1]),
          importance: 0.8,
          tags: this.extractVueDirectives(templateMatch[1]),
          annotations: []
        },
        dependencies: [],
        patterns: this.extractPatterns(templateMatch[1], 'vue-template')
      });
    }
    
    // Extract script section
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    if (scriptMatch) {
      chunks.push({
        id: this.generateChunkId(filePath, 'script', 'script'),
        content: scriptMatch[1],
        startPosition: scriptMatch.index!,
        endPosition: scriptMatch.index! + scriptMatch[0].length,
        chunkType: ChunkType.Component,
        metadata: {
          name: 'script',
          type: 'component',
          framework: 'vue',
          language: 'javascript',
          complexity: this.calculateComplexity(scriptMatch[1]),
          importance: 0.9,
          tags: this.extractTags(scriptMatch[1]),
          annotations: []
        },
        dependencies: this.extractDependencies(scriptMatch[1]),
        patterns: this.extractPatterns(scriptMatch[1], 'vue-script')
      });
    }
    
    // Extract style section
    const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    if (styleMatch) {
      chunks.push({
        id: this.generateChunkId(filePath, 'style', 'style'),
        content: styleMatch[1],
        startPosition: styleMatch.index!,
        endPosition: styleMatch.index! + styleMatch[0].length,
        chunkType: ChunkType.Style,
        metadata: {
          name: 'style',
          type: 'style',
          framework: 'vue',
          language: 'css',
          complexity: this.calculateComplexity(styleMatch[1]),
          importance: 0.5,
          tags: [],
          annotations: []
        },
        dependencies: [],
        patterns: this.extractPatterns(styleMatch[1], 'css')
      });
    }
    
    return chunks;
  }

  private createConfigChunks(content: string, filePath: string, classification: FileClassification): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    const extension = path.extname(filePath).toLowerCase();
    
    if (extension === '.json') {
      try {
        const config = JSON.parse(content);
        const sections = this.extractJsonSections(config);
        
        sections.forEach((section, index) => {
          chunks.push({
            id: this.generateChunkId(filePath, 'config', section.key),
            content: JSON.stringify(section.value, null, 2),
            startPosition: index * 100, // Approximate
            endPosition: (index + 1) * 100,
            chunkType: ChunkType.Configuration,
            metadata: {
              name: section.key,
              type: 'configuration',
              framework: this.getFrameworkFromClassification(classification),
              language: 'json',
              complexity: this.calculateConfigComplexity(section.value),
              importance: this.calculateConfigImportance(section.key),
              tags: [section.key],
              annotations: []
            },
            dependencies: [],
            patterns: []
          });
        });
      } catch (error) {
        // If JSON parsing fails, create a single chunk
        chunks.push(this.createSingleConfigChunk(content, filePath, classification));
      }
    } else {
      chunks.push(this.createSingleConfigChunk(content, filePath, classification));
    }
    
    return chunks;
  }

  private createTemplateChunks(content: string, filePath: string, classification: FileClassification): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    
    // Split templates into logical sections
    const sections = this.extractTemplateSections(content, path.extname(filePath));
    
    sections.forEach((section, index) => {
      chunks.push({
        id: this.generateChunkId(filePath, 'template', section.name),
        content: section.content,
        startPosition: section.start,
        endPosition: section.end,
        chunkType: ChunkType.Template,
        metadata: {
          name: section.name,
          type: 'template',
          framework: this.getFrameworkFromClassification(classification),
          language: 'html',
          complexity: this.calculateComplexity(section.content),
          importance: section.importance,
          tags: section.tags,
          annotations: []
        },
        dependencies: section.dependencies,
        patterns: this.extractPatterns(section.content, 'template')
      });
    });
    
    return chunks;
  }

  private createDocumentationChunks(content: string, filePath: string, classification: FileClassification): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    
    // Split documentation into sections based on headers
    const sections = this.extractDocumentationSections(content);
    
    sections.forEach((section, index) => {
      chunks.push({
        id: this.generateChunkId(filePath, 'doc', section.title),
        content: section.content,
        startPosition: section.start,
        endPosition: section.end,
        chunkType: ChunkType.Documentation,
        metadata: {
          name: section.title,
          type: 'documentation',
          language: 'markdown',
          complexity: 1,
          importance: section.level === 1 ? 0.9 : 0.6,
          tags: section.tags,
          annotations: []
        },
        dependencies: [],
        patterns: []
      });
    });
    
    return chunks;
  }

  private createGenericChunks(content: string, filePath: string, classification: FileClassification): ContentChunk[] {
    // Create chunks based on natural breaks in content
    const maxChunkSize = 2000;
    const chunks: ContentChunk[] = [];
    
    if (content.length <= maxChunkSize) {
      chunks.push({
        id: this.generateChunkId(filePath, 'content', 'full'),
        content,
        startPosition: 0,
        endPosition: content.length,
        chunkType: ChunkType.Documentation,
        metadata: {
          type: 'generic',
          language: 'text',
          complexity: 1,
          importance: 0.5,
          tags: [],
          annotations: []
        },
        dependencies: [],
        patterns: []
      });
    } else {
      // Split into multiple chunks
      const lines = content.split('\n');
      let currentChunk = '';
      let chunkStart = 0;
      let chunkIndex = 0;
      
      for (let i = 0; i < lines.length; i++) {
        currentChunk += lines[i] + '\n';
        
        if (currentChunk.length > maxChunkSize || i === lines.length - 1) {
          chunks.push({
            id: this.generateChunkId(filePath, 'content', `chunk_${chunkIndex}`),
            content: currentChunk,
            startPosition: chunkStart,
            endPosition: chunkStart + currentChunk.length,
            chunkType: ChunkType.Documentation,
            metadata: {
              type: 'generic',
              language: 'text',
              complexity: 1,
              importance: 0.5,
              tags: [],
              annotations: []
            },
            dependencies: [],
            patterns: []
          });
          
          chunkStart += currentChunk.length;
          currentChunk = '';
          chunkIndex++;
        }
      }
    }
    
    return chunks;
  }

  private createStreamlitChunks(content: string, filePath: string, classification: FileClassification): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    
    // Extract Streamlit page functions
    const pageFunctionRegex = /def\s+(\w+_page|\w+_view|\w+_tab)\s*\([^)]*\)\s*:/g;
    let match;
    
    while ((match = pageFunctionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const startPos = match.index;
      const functionContent = this.extractPythonBlock(content, startPos);
      
      chunks.push({
        id: this.generateChunkId(filePath, 'page', functionName),
        content: functionContent,
        startPosition: startPos,
        endPosition: startPos + functionContent.length,
        chunkType: ChunkType.Component,
        metadata: {
          name: functionName,
          type: 'page',
          framework: 'streamlit',
          language: 'python',
          complexity: this.calculateComplexity(functionContent),
          importance: this.calculateImportance(functionContent, 'page'),
          tags: this.extractStreamlitTags(functionContent),
          annotations: []
        },
        dependencies: this.extractDependencies(functionContent),
        patterns: this.extractPatterns(functionContent, 'streamlit')
      });
    }
    
    // Extract Streamlit widgets and layouts
    const widgetRegex = /st\.(button|selectbox|slider|text_input|file_uploader|multiselect|radio|checkbox|date_input|time_input|number_input|text_area|color_picker)\s*\([^)]*\)/g;
    
    while ((match = widgetRegex.exec(content)) !== null) {
      const widgetType = match[1];
      const startPos = match.index;
      const widgetCall = match[0];
      
      chunks.push({
        id: this.generateChunkId(filePath, 'widget', `${widgetType}_${startPos}`),
        content: widgetCall,
        startPosition: startPos,
        endPosition: startPos + widgetCall.length,
        chunkType: ChunkType.Component,
        metadata: {
          name: widgetType,
          type: 'widget',
          framework: 'streamlit',
          language: 'python',
          complexity: 1,
          importance: 0.6,
          tags: ['widget', widgetType],
          annotations: []
        },
        dependencies: [],
        patterns: [`st.${widgetType}`]
      });
    }
    
    // Extract data display components
    const dataDisplayRegex = /st\.(dataframe|table|metric|json|code|plotly_chart|pyplot|altair_chart|vega_lite_chart|line_chart|area_chart|bar_chart|map)\s*\([^)]*\)/g;
    
    while ((match = dataDisplayRegex.exec(content)) !== null) {
      const displayType = match[1];
      const startPos = match.index;
      const displayCall = match[0];
      
      chunks.push({
        id: this.generateChunkId(filePath, 'display', `${displayType}_${startPos}`),
        content: displayCall,
        startPosition: startPos,
        endPosition: startPos + displayCall.length,
        chunkType: ChunkType.Component,
        metadata: {
          name: displayType,
          type: 'display',
          framework: 'streamlit',
          language: 'python',
          complexity: 2,
          importance: 0.7,
          tags: ['display', displayType],
          annotations: []
        },
        dependencies: [],
        patterns: [`st.${displayType}`]
      });
    }
    
    // Extract layout components (sidebar, columns, containers)
    const layoutRegex = /st\.(sidebar|columns|container|expander|form|empty|placeholder)\s*\([^)]*\)/g;
    
    while ((match = layoutRegex.exec(content)) !== null) {
      const layoutType = match[1];
      const startPos = match.index;
      const layoutCall = match[0];
      
      chunks.push({
        id: this.generateChunkId(filePath, 'layout', `${layoutType}_${startPos}`),
        content: layoutCall,
        startPosition: startPos,
        endPosition: startPos + layoutCall.length,
        chunkType: ChunkType.Component,
        metadata: {
          name: layoutType,
          type: 'layout',
          framework: 'streamlit',
          language: 'python',
          complexity: 1,
          importance: 0.5,
          tags: ['layout', layoutType],
          annotations: []
        },
        dependencies: [],
        patterns: [`st.${layoutType}`]
      });
    }
    
    // Extract cached functions
    const cacheRegex = /@st\.(cache|experimental_memo|experimental_singleton|cache_data|cache_resource)\s*\n\s*def\s+(\w+)/g;
    
    while ((match = cacheRegex.exec(content)) !== null) {
      const cacheType = match[1];
      const functionName = match[2];
      const startPos = match.index;
      const functionContent = this.extractPythonBlock(content, startPos);
      
      chunks.push({
        id: this.generateChunkId(filePath, 'cached_function', functionName),
        content: functionContent,
        startPosition: startPos,
        endPosition: startPos + functionContent.length,
        chunkType: ChunkType.Function,
        metadata: {
          name: functionName,
          type: 'cached_function',
          framework: 'streamlit',
          language: 'python',
          complexity: this.calculateComplexity(functionContent),
          importance: 0.8,
          tags: ['cached', cacheType, 'function'],
          annotations: [cacheType]
        },
        dependencies: this.extractDependencies(functionContent),
        patterns: [`@st.${cacheType}`, 'def ' + functionName]
      });
    }
    
    return chunks;
  }

  private extractStreamlitTags(content: string): string[] {
    const tags: string[] = [];
    
    // Streamlit-specific patterns
    if (content.includes('st.sidebar')) tags.push('sidebar');
    if (content.includes('st.columns')) tags.push('columns');
    if (content.includes('st.tabs')) tags.push('tabs');
    if (content.includes('st.form')) tags.push('form');
    if (content.includes('st.container')) tags.push('container');
    if (content.includes('st.expander')) tags.push('expander');
    if (content.includes('st.session_state')) tags.push('session-state');
    if (content.includes('@st.cache')) tags.push('cached');
    if (content.includes('st.file_uploader')) tags.push('file-upload');
    if (content.includes('plotly') || content.includes('pyplot') || content.includes('chart')) tags.push('visualization');
    if (content.includes('dataframe') || content.includes('table')) tags.push('data-display');
    
    return tags;
  }

  // Helper methods implementation continues...
  private generateChunkId(filePath: string, type: string, name: string): string {
    const hash = this.simpleHash(filePath + type + name);
    return `${type}_${name}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private calculateComplexity(content: string): number {
    // Simplified complexity calculation
    const complexityFactors = [
      { pattern: /if\s*\(/, weight: 1 },
      { pattern: /for\s*\(/, weight: 2 },
      { pattern: /while\s*\(/, weight: 2 },
      { pattern: /switch\s*\(/, weight: 3 },
      { pattern: /try\s*\{/, weight: 2 },
      { pattern: /catch\s*\(/, weight: 2 },
      { pattern: /async\s+/, weight: 1 },
      { pattern: /await\s+/, weight: 1 }
    ];
    
    let complexity = 1;
    complexityFactors.forEach(factor => {
      const matches = content.match(factor.pattern);
      if (matches) {
        complexity += matches.length * factor.weight;
      }
    });
    
    return Math.min(10, complexity);
  }

  private calculateImportance(content: string, type: string): number {
    let importance = 0.5;
    
    // Increase importance based on type
    const typeWeights: Record<string, number> = {
      'class': 0.8,
      'component': 0.8,
      'route': 0.9,
      'method': 0.6,
      'function': 0.6,
      'configuration': 0.7
    };
    
    importance = typeWeights[type] || 0.5;
    
    // Adjust based on content characteristics
    if (content.includes('@RestController') || content.includes('@Controller')) {
      importance += 0.2;
    }
    if (content.includes('main') || content.includes('Main')) {
      importance += 0.3;
    }
    if (content.includes('export default') || content.includes('public static void main')) {
      importance += 0.2;
    }
    
    return Math.min(1.0, importance);
  }

  private extractTags(content: string): string[] {
    const tags: string[] = [];
    
    // Common framework patterns
    if (content.includes('@Component')) tags.push('component');
    if (content.includes('@Service')) tags.push('service');
    if (content.includes('@Repository')) tags.push('repository');
    if (content.includes('@Controller')) tags.push('controller');
    if (content.includes('useState')) tags.push('react-hook');
    if (content.includes('useEffect')) tags.push('react-hook');
    if (content.includes('@app.route')) tags.push('flask-route');
    if (content.includes('@app.get')) tags.push('fastapi-endpoint');
    
    return tags;
  }

  private extractJavaAnnotations(content: string): string[] {
    const annotations = content.match(/@\w+/g) || [];
    return annotations.map(ann => ann.substring(1)); // Remove @ symbol
  }

  private extractPythonDecorators(content: string): string[] {
    const decorators = content.match(/@[\w.]+/g) || [];
    return decorators.map(dec => dec.substring(1)); // Remove @ symbol
  }

  private extractJSXAnnotations(content: string): string[] {
    // Extract JSX-specific patterns and props
    const jsxPatterns = content.match(/\w+(?=\s*=\s*\{)|jsx|tsx/g) || [];
    return [...new Set(jsxPatterns)];
  }

  private extractVueDirectives(content: string): string[] {
    const directives = content.match(/v-\w+/g) || [];
    return [...new Set(directives)];
  }

  private extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    // Extract import statements
    const imports = content.match(/import\s+.*?\s+from\s+['"][^'"]+['"]/g) || [];
    imports.forEach(imp => {
      const match = imp.match(/from\s+['"]([^'"]+)['"]/);
      if (match) dependencies.push(match[1]);
    });
    
    // Extract Java imports
    const javaImports = content.match(/import\s+[a-zA-Z0-9_.]+;/g) || [];
    javaImports.forEach(imp => {
      const cleaned = imp.replace('import ', '').replace(';', '').trim();
      dependencies.push(cleaned);
    });
    
    return [...new Set(dependencies)];
  }

  private extractPatterns(content: string, language: string): string[] {
    const patterns: string[] = [];
    
    const patternMap: Record<string, RegExp[]> = {
      'java': [/@\w+/, /public\s+class/, /private\s+\w+/, /protected\s+\w+/],
      'javascript': [/function\s+\w+/, /const\s+\w+\s*=/, /class\s+\w+/],
      'react': [/useState/, /useEffect/, /jsx/, /tsx/],
      'python': [/def\s+\w+/, /class\s+\w+/, /@\w+/],
      'vue-template': [/v-\w+/, /{{\s*\w+\s*}}/, /<\w+/],
      'css': [/\.\w+/, /#\w+/, /@media/],
      'streamlit': [/st\./, /import\s+streamlit/, /@st\.cache/, /st\.sidebar/, /st\.columns/]
    };
    
    const regexes = patternMap[language] || [];
    regexes.forEach(regex => {
      if (regex.test(content)) {
        patterns.push(regex.source);
      }
    });
    
    return patterns;
  }

  // Additional helper methods for specific languages and frameworks
  private cleanJavaCode(content: string): string {
    // Remove single-line comments
    content = content.replace(/\/\/.*$/gm, '');
    // Remove multi-line comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    return content.trim();
  }

  private cleanJavaScriptCode(content: string): string {
    // Remove single-line comments
    content = content.replace(/\/\/.*$/gm, '');
    // Remove multi-line comments
    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    return content.trim();
  }

  private cleanPythonCode(content: string): string {
    // Remove single-line comments
    content = content.replace(/#.*$/gm, '');
    // Remove multi-line comments (docstrings)
    content = content.replace(/"""[\s\S]*?"""/g, '');
    content = content.replace(/'''[\s\S]*?'''/g, '');
    return content.trim();
  }

  private extractJavaBlock(content: string, startPos: number): string {
    let braceCount = 0;
    let i = startPos;
    let started = false;
    
    while (i < content.length) {
      if (content[i] === '{') {
        braceCount++;
        started = true;
      } else if (content[i] === '}') {
        braceCount--;
        if (started && braceCount === 0) {
          return content.substring(startPos, i + 1);
        }
      }
      i++;
    }
    
    return content.substring(startPos, Math.min(startPos + 1000, content.length));
  }

  private extractJavaScriptBlock(content: string, startPos: number): string {
    // Similar to Java but handle arrow functions differently
    return this.extractJavaBlock(content, startPos);
  }

  private extractPythonBlock(content: string, startPos: number): string {
    const lines = content.substring(startPos).split('\n');
    const result = [lines[0]]; // Include the definition line
    
    if (lines.length < 2) return lines[0];
    
    // Find base indentation
    let baseIndent = 0;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() !== '') {
        baseIndent = lines[i].length - lines[i].trimStart().length;
        break;
      }
    }
    
    // Include all lines with >= base indentation
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

  private isReactComponent(name: string, content: string, position: number): boolean {
    // Check if function returns JSX
    const blockContent = this.extractJavaScriptBlock(content, position);
    return blockContent.includes('return') && 
           (blockContent.includes('<') || blockContent.includes('jsx') || blockContent.includes('React.createElement'));
  }

  private getFrameworkFromClassification(classification: FileClassification): string | undefined {
    return classification.primary.toString();
  }

  private async enrichMetadata(filePath: string, classification: FileClassification, content: string): Promise<ContentMetadata> {
    const stats = await FileUtils.getFileStats(filePath);
    
    return {
      filePath,
      classification,
      size: stats?.size || 0,
      encoding: 'utf-8',
      language: this.detectLanguage(filePath),
      framework: this.getFrameworkFromClassification(classification),
      extractedElements: this.extractElements(content, filePath),
      dependencies: this.extractFileDependencies(content),
      exports: this.extractExports(content),
      imports: this.extractImports(content)
    };
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      '.java': 'java',
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.vue': 'vue',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.json': 'json',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.xml': 'xml'
    };
    return langMap[ext] || 'text';
  }

  private extractElements(content: string, filePath: string): ExtractedElement[] {
    // This would be a comprehensive implementation
    // For now, return empty array
    return [];
  }

  private extractFileDependencies(content: string): FileDependency[] {
    // Extract and analyze dependencies
    return [];
  }

  private extractExports(content: string): string[] {
    const exports = content.match(/export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g) || [];
    return exports.map(exp => {
      const match = exp.match(/export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/);
      return match ? match[1] : '';
    }).filter(Boolean);
  }

  private extractImports(content: string): string[] {
    const imports = content.match(/import\s+.*?\s+from\s+['"][^'"]+['"]/g) || [];
    return imports.map(imp => {
      const match = imp.match(/from\s+['"]([^'"]+)['"]/);
      return match ? match[1] : '';
    }).filter(Boolean);
  }

  private analyzeRelationships(chunks: ContentChunk[]): ContentRelationship[] {
    const relationships: ContentRelationship[] = [];
    
    // Analyze relationships between chunks
    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        const relationship = this.findRelationship(chunks[i], chunks[j]);
        if (relationship) {
          relationships.push(relationship);
        }
      }
    }
    
    return relationships;
  }

  private findRelationship(chunk1: ContentChunk, chunk2: ContentChunk): ContentRelationship | null {
    // Check if chunk1 references chunk2
    if (chunk1.dependencies.some(dep => chunk2.metadata.name && dep.includes(chunk2.metadata.name))) {
      return {
        sourceChunk: chunk1.id,
        targetChunk: chunk2.id,
        relationshipType: 'uses',
        confidence: 0.8
      };
    }
    
    // Check inheritance relationships
    if (chunk1.content.includes(`extends ${chunk2.metadata.name}`)) {
      return {
        sourceChunk: chunk1.id,
        targetChunk: chunk2.id,
        relationshipType: 'extends',
        confidence: 0.9
      };
    }
    
    return null;
  }

  // Configuration processing implementations
  private structureJsonConfig(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  private structureYamlConfig(content: string): string {
    // Add structure annotations for YAML
    return content.split('\n').map(line => {
      if (line.trim().endsWith(':') && !line.trim().startsWith('#')) {
        return `${line} # Configuration section`;
      }
      return line;
    }).join('\n');
  }

  private structurePropertiesConfig(content: string): string {
    // Group properties by prefix
    const lines = content.split('\n');
    const groups: Record<string, string[]> = {};
    
    lines.forEach(line => {
      if (line.trim() && !line.startsWith('#')) {
        const prefix = line.split('.')[0];
        if (!groups[prefix]) groups[prefix] = [];
        groups[prefix].push(line);
      }
    });
    
    let structured = '';
    Object.entries(groups).forEach(([prefix, props]) => {
      structured += `# ${prefix.toUpperCase()} Configuration\n`;
      structured += props.join('\n') + '\n\n';
    });
    
    return structured;
  }

  private structureXmlConfig(content: string): string {
    // Add indentation and comments for better structure
    return content.replace(/(<[^/][^>]*>)/g, '$1 <!-- Configuration element -->');
  }

  private extractTemplateStructure(content: string, extension: string): string {
    if (extension === '.html' || extension === '.htm') {
      // Extract semantic structure from HTML
      return content.replace(/(<(h[1-6]|div|section|article|nav|header|footer)[^>]*>)/gi, 
        '\n$1 <!-- Template section -->\n');
    }
    return content;
  }

  private structureDocumentation(content: string, extension: string): string {
    if (extension === '.md') {
      // Add section markers for better chunking
      return content.replace(/^(#{1,6})\s+(.+)$/gm, '$1 $2\n<!-- Section: $2 -->\n');
    }
    return content;
  }

  private extractJsonSections(config: any): Array<{key: string, value: any}> {
    const sections: Array<{key: string, value: any}> = [];
    
    if (typeof config === 'object' && config !== null) {
      Object.entries(config).forEach(([key, value]) => {
        sections.push({ key, value });
      });
    }
    
    return sections;
  }

  private createSingleConfigChunk(content: string, filePath: string, classification: FileClassification): ContentChunk {
    return {
      id: this.generateChunkId(filePath, 'config', 'single'),
      content,
      startPosition: 0,
      endPosition: content.length,
      chunkType: ChunkType.Configuration,
      metadata: {
        type: 'configuration',
        language: this.detectLanguage(filePath),
        complexity: this.calculateConfigComplexity(content),
        importance: 0.7,
        tags: this.extractConfigTags(content),
        annotations: []
      },
      dependencies: [],
      patterns: []
    };
  }

  private extractTemplateSections(content: string, extension: string): Array<{name: string, content: string, start: number, end: number, importance: number, tags: string[], dependencies: string[]}> {
    const sections: Array<{name: string, content: string, start: number, end: number, importance: number, tags: string[], dependencies: string[]}> = [];
    
    if (extension === '.html' || extension === '.htm') {
      // Extract major HTML sections
      const sectionRegex = /<(header|nav|main|section|article|aside|footer)[^>]*>([\s\S]*?)<\/\1>/gi;
      let match;
      
      while ((match = sectionRegex.exec(content)) !== null) {
        const sectionName = match[1];
        const sectionContent = match[2];
        
        sections.push({
          name: sectionName,
          content: match[0],
          start: match.index,
          end: match.index + match[0].length,
          importance: this.calculateSectionImportance(sectionName),
          tags: this.extractTemplateTags(sectionContent),
          dependencies: this.extractTemplateDependencies(sectionContent)
        });
      }
    }
    
    if (sections.length === 0) {
      // Fallback: split by major breaks
      const chunks = content.split(/\n\s*\n/);
      let position = 0;
      
      chunks.forEach((chunk, index) => {
        if (chunk.trim()) {
          sections.push({
            name: `section_${index}`,
            content: chunk,
            start: position,
            end: position + chunk.length,
            importance: 0.5,
            tags: [],
            dependencies: []
          });
          position += chunk.length + 2; // Account for double newline
        }
      });
    }
    
    return sections;
  }

  private extractDocumentationSections(content: string): Array<{title: string, content: string, start: number, end: number, level: number, tags: string[]}> {
    const sections: Array<{title: string, content: string, start: number, end: number, level: number, tags: string[]}> = [];
    const lines = content.split('\n');
    
    let currentSection: {title: string, content: string[], start: number, level: number, tags: string[]} | null = null;
    let linePos = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headerMatch) {
        // Save previous section
        if (currentSection) {
          sections.push({
            title: currentSection.title,
            content: currentSection.content.join('\n'),
            start: currentSection.start,
            end: linePos,
            level: currentSection.level,
            tags: currentSection.tags
          });
        }
        
        // Start new section
        const level = headerMatch[1].length;
        const title = headerMatch[2].trim();
        currentSection = {
          title,
          content: [line],
          start: linePos,
          level,
          tags: this.extractDocTags(title)
        };
      } else if (currentSection) {
        currentSection.content.push(line);
      }
      
      linePos += line.length + 1; // +1 for newline
    }
    
    // Save final section
    if (currentSection) {
      sections.push({
        title: currentSection.title,
        content: currentSection.content.join('\n'),
        start: currentSection.start,
        end: linePos,
        level: currentSection.level,
        tags: currentSection.tags
      });
    }
    
    return sections;
  }

  private calculateConfigComplexity(value: any): number {
    if (typeof value === 'string') {
      const lines = value.split('\n').length;
      return Math.min(5, Math.max(1, lines / 10));
    }
    if (typeof value === 'object' && value !== null) {
      const keys = Object.keys(value).length;
      return Math.min(5, Math.max(1, keys / 5));
    }
    return 1;
  }

  private calculateConfigImportance(key: string): number {
    const importantKeys = ['database', 'security', 'server', 'application', 'spring', 'datasource'];
    const lowerKey = key.toLowerCase();
    
    if (importantKeys.some(important => lowerKey.includes(important))) {
      return 0.9;
    }
    if (lowerKey.includes('port') || lowerKey.includes('host') || lowerKey.includes('url')) {
      return 0.8;
    }
    return 0.6;
  }

  private extractMethodParameters(signature: string): string[] {
    const paramMatch = signature.match(/\(([^)]*)\)/);
    if (!paramMatch || !paramMatch[1].trim()) return [];
    
    return paramMatch[1].split(',').map(param => param.trim().split(/\s+/).pop() || '').filter(Boolean);
  }

  private extractReturnType(signature: string): string {
    // Java return type extraction
    const javaMatch = signature.match(/(?:public|private|protected)?\s*(?:static)?\s*(?:final)?\s*(\w+(?:<[^>]+>)?)\s+\w+\s*\(/);
    if (javaMatch) return javaMatch[1];
    
    // TypeScript return type extraction
    const tsMatch = signature.match(/:\s*([^{=]+)(?:\s*[{=]|$)/);
    if (tsMatch) return tsMatch[1].trim();
    
    return 'void';
  }

  private createGenericCodeChunks(content: string, filePath: string, classification: FileClassification): ContentChunk[] {
    const chunks: ContentChunk[] = [];
    const lines = content.split('\n');
    const maxLinesPerChunk = 50;
    
    for (let i = 0; i < lines.length; i += maxLinesPerChunk) {
      const chunkLines = lines.slice(i, i + maxLinesPerChunk);
      const chunkContent = chunkLines.join('\n');
      
      chunks.push({
        id: this.generateChunkId(filePath, 'code', `chunk_${i}`),
        content: chunkContent,
        startPosition: i,
        endPosition: Math.min(i + maxLinesPerChunk, lines.length),
        chunkType: ChunkType.Function,
        metadata: {
          name: `code_chunk_${i}`,
          type: 'code',
          framework: this.getFrameworkFromClassification(classification),
          language: this.detectLanguage(filePath),
          complexity: this.calculateComplexity(chunkContent),
          importance: 0.5,
          tags: this.extractTags(chunkContent),
          annotations: []
        },
        dependencies: this.extractDependencies(chunkContent),
        patterns: this.extractPatterns(chunkContent, this.detectLanguage(filePath))
      });
    }
    
    return chunks;
  }

  // Additional helper methods
  private extractConfigTags(content: string): string[] {
    const tags: string[] = [];
    if (content.includes('database') || content.includes('datasource')) tags.push('database');
    if (content.includes('security') || content.includes('auth')) tags.push('security');
    if (content.includes('server') || content.includes('port')) tags.push('server');
    if (content.includes('logging') || content.includes('log')) tags.push('logging');
    return tags;
  }

  private calculateSectionImportance(sectionName: string): number {
    const importance: Record<string, number> = {
      'header': 0.8,
      'nav': 0.7,
      'main': 0.9,
      'section': 0.6,
      'article': 0.7,
      'aside': 0.4,
      'footer': 0.3
    };
    return importance[sectionName.toLowerCase()] || 0.5;
  }

  private extractTemplateTags(content: string): string[] {
    const tags: string[] = [];
    if (content.includes('form')) tags.push('form');
    if (content.includes('table')) tags.push('table');
    if (content.includes('nav')) tags.push('navigation');
    if (content.includes('button')) tags.push('interactive');
    return tags;
  }

  private extractTemplateDependencies(content: string): string[] {
    const deps: string[] = [];
    const links = content.match(/href=["']([^"']+)["']/g) || [];
    const scripts = content.match(/src=["']([^"']+)["']/g) || [];
    
    [...links, ...scripts].forEach(match => {
      const url = match.match(/=["']([^"']+)["']/);
      if (url) deps.push(url[1]);
    });
    
    return deps;
  }

  private extractDocTags(title: string): string[] {
    const tags: string[] = [];
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('install') || lowerTitle.includes('setup')) tags.push('setup');
    if (lowerTitle.includes('api') || lowerTitle.includes('endpoint')) tags.push('api');
    if (lowerTitle.includes('config') || lowerTitle.includes('configuration')) tags.push('configuration');
    if (lowerTitle.includes('example') || lowerTitle.includes('usage')) tags.push('example');
    if (lowerTitle.includes('troubleshoot') || lowerTitle.includes('error')) tags.push('troubleshooting');
    
    return tags;
  }
}