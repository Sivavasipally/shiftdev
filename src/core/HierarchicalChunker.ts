import * as path from 'path';
import { ParseResult, CodeSymbol, ClassInfo, FunctionInfo } from './ASTParser';
import { FileClassification } from './FileClassifier';
import { CodeChunk } from '../types';
import { GraphNode, GraphEdge, CodeGraph } from './CodeGraph';
import { BM25 } from '../utils/bm25';

export interface ChunkHierarchy {
  id: string;
  type: 'file' | 'class' | 'function' | 'method' | 'block' | 'statement';
  level: number;
  parent?: ChunkHierarchy;
  children: ChunkHierarchy[];
  content: string;
  metadata: ChunkMetadata;
  position: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
  summary?: string;
  context: HierarchicalContext;
}

export interface ChunkMetadata {
  language: string;
  framework?: string;
  classification?: FileClassification;
  complexity: number;
  importance: number;
  semanticType: string;
  abstractLevel: 'overview' | 'detail' | 'implementation';
  dependencies: string[];
  exports: string[];
  annotations: string[];
  decorators: string[];
  tags: string[];
  parentContext: {
    className?: string;
    functionName?: string;
    namespace?: string;
    filePath: string;
  };
}

export interface HierarchicalContext {
  ancestors: string[];
  siblings: string[];
  descendants: string[];
  relatedChunks: string[];
  crossReferences: Array<{
    chunkId: string;
    relationship: 'calls' | 'inherits' | 'implements' | 'imports' | 'references';
    confidence: number;
  }>;
  semanticNeighbors: Array<{
    chunkId: string;
    similarity: number;
    reason: string;
  }>;
}

export interface ChunkingStrategy {
  name: string;
  maxChunkSize: number;
  overlapSize: number;
  preserveBoundaries: boolean;
  respectSyntax: boolean;
  includeContext: boolean;
  generateSummaries: boolean;
  semanticGrouping: boolean;
}

export interface ChunkingOptions {
  strategy: ChunkingStrategy;
  targetFramework?: string;
  includePrivateMembers: boolean;
  generateOverviewChunks: boolean;
  crossReferenceDepth: number;
  semanticSimilarityThreshold: number;
  contextWindowSize: number;
}

export class HierarchicalChunker {
  private codeGraph: CodeGraph;
  private bm25: BM25;
  private chunkHierarchies: Map<string, ChunkHierarchy> = new Map();
  private chunkIndex: Map<string, string[]> = new Map(); // file -> chunk IDs

  constructor(codeGraph: CodeGraph) {
    this.codeGraph = codeGraph;
    this.bm25 = new BM25([]);
  }

  async chunkFiles(
    files: Array<{ filePath: string; astData: ParseResult; classification: FileClassification; content: string }>,
    options: ChunkingOptions
  ): Promise<CodeChunk[]> {
    console.log('🧩 Starting hierarchical chunking for', files.length, 'files...');

    const allChunks: CodeChunk[] = [];
    const hierarchies: ChunkHierarchy[] = [];

    // Step 1: Create hierarchical structure for each file
    for (const file of files) {
      const hierarchy = await this.createFileHierarchy(file, options);
      hierarchies.push(hierarchy);
      this.chunkHierarchies.set(file.filePath, hierarchy);
    }

    // Step 2: Build cross-references and semantic relationships
    await this.buildCrossReferences(hierarchies, options);

    // Step 3: Generate chunks from hierarchies
    for (const hierarchy of hierarchies) {
      const chunks = await this.generateChunksFromHierarchy(hierarchy, options);
      allChunks.push(...chunks);
    }

    // Step 4: Generate overview chunks if requested
    if (options.generateOverviewChunks) {
      const overviewChunks = await this.generateOverviewChunks(hierarchies, options);
      allChunks.push(...overviewChunks);
    }

    // Step 5: Enhance chunks with parent context
    await this.enrichChunksWithContext(allChunks, options);

    console.log(`✅ Generated ${allChunks.length} hierarchical chunks`);
    return allChunks;
  }

  private async createFileHierarchy(
    file: { filePath: string; astData: ParseResult; classification: FileClassification; content: string },
    options: ChunkingOptions
  ): Promise<ChunkHierarchy> {
    const { filePath, astData, classification, content } = file;
    
    // Create root file hierarchy
    const fileHierarchy: ChunkHierarchy = {
      id: this.generateChunkId('file', filePath),
      type: 'file',
      level: 0,
      children: [],
      content: this.createFileOverview(astData),
      metadata: {
        language: astData.language,
        framework: classification.primary?.toString(),
        classification,
        complexity: astData.complexity.cyclomatic,
        importance: this.calculateFileImportance(astData),
        semanticType: 'file_overview',
        abstractLevel: 'overview',
        dependencies: astData.imports.map(imp => imp.module),
        exports: astData.exports,
        annotations: [],
        decorators: [],
        tags: this.generateFileTags(astData, classification),
        parentContext: {
          filePath
        }
      },
      position: {
        startLine: 1,
        endLine: content.split('\n').length,
        startColumn: 0,
        endColumn: 0
      },
      context: {
        ancestors: [],
        siblings: [],
        descendants: [],
        relatedChunks: [],
        crossReferences: [],
        semanticNeighbors: []
      }
    };

    // Create class hierarchies
    for (const cls of astData.classes) {
      const classHierarchy = await this.createClassHierarchy(cls, astData, filePath, content, fileHierarchy);
      fileHierarchy.children.push(classHierarchy);
    }

    // Create standalone function hierarchies
    for (const fn of astData.functions) {
      const functionHierarchy = await this.createFunctionHierarchy(fn, astData, filePath, content, fileHierarchy);
      fileHierarchy.children.push(functionHierarchy);
    }

    // Update descendants
    fileHierarchy.context.descendants = this.collectDescendantIds(fileHierarchy);

    return fileHierarchy;
  }

  private async createClassHierarchy(
    cls: ClassInfo,
    astData: ParseResult,
    filePath: string,
    content: string,
    parent: ChunkHierarchy
  ): Promise<ChunkHierarchy> {
    const classContent = this.extractClassContent(cls, content);
    
    const classHierarchy: ChunkHierarchy = {
      id: this.generateChunkId('class', filePath, cls.name),
      type: 'class',
      level: 1,
      parent,
      children: [],
      content: classContent,
      metadata: {
        language: astData.language,
        complexity: this.calculateClassComplexity(cls),
        importance: this.calculateClassImportance(cls),
        semanticType: cls.isInterface ? 'interface' : cls.isEnum ? 'enum' : 'class',
        abstractLevel: 'detail',
        dependencies: this.extractClassDependencies(cls),
        exports: [cls.name],
        annotations: cls.annotations,
        decorators: [],
        tags: this.generateClassTags(cls),
        parentContext: {
          className: cls.name,
          filePath
        }
      },
      position: this.estimateClassPosition(cls, content),
      summary: this.generateClassSummary(cls),
      context: {
        ancestors: [parent.id],
        siblings: [],
        descendants: [],
        relatedChunks: [],
        crossReferences: [],
        semanticNeighbors: []
      }
    };

    // Create method hierarchies
    for (const method of cls.methods) {
      const methodHierarchy = await this.createMethodHierarchy(method, cls, astData, filePath, content, classHierarchy);
      classHierarchy.children.push(methodHierarchy);
    }

    // Create property hierarchies if significant
    for (const property of cls.properties) {
      if (this.isSignificantProperty(property)) {
        const propertyHierarchy = await this.createPropertyHierarchy(property, cls, astData, filePath, content, classHierarchy);
        classHierarchy.children.push(propertyHierarchy);
      }
    }

    // Update descendants
    classHierarchy.context.descendants = this.collectDescendantIds(classHierarchy);

    return classHierarchy;
  }

  private async createFunctionHierarchy(
    fn: FunctionInfo,
    astData: ParseResult,
    filePath: string,
    content: string,
    parent: ChunkHierarchy
  ): Promise<ChunkHierarchy> {
    const functionContent = this.extractFunctionContent(fn, content);
    
    const functionHierarchy: ChunkHierarchy = {
      id: this.generateChunkId('function', filePath, fn.name),
      type: 'function',
      level: 1,
      parent,
      children: [],
      content: functionContent,
      metadata: {
        language: astData.language,
        complexity: fn.complexity,
        importance: this.calculateFunctionImportance(fn),
        semanticType: 'function',
        abstractLevel: 'detail',
        dependencies: this.extractFunctionDependencies(fn),
        exports: [fn.name],
        annotations: fn.annotations,
        decorators: fn.decorators,
        tags: this.generateFunctionTags(fn),
        parentContext: {
          functionName: fn.name,
          filePath
        }
      },
      position: {
        startLine: fn.bodyRange.start.line,
        endLine: fn.bodyRange.end.line,
        startColumn: fn.bodyRange.start.character,
        endColumn: fn.bodyRange.end.character
      },
      summary: this.generateFunctionSummary(fn),
      context: {
        ancestors: [parent.id],
        siblings: [],
        descendants: [],
        relatedChunks: [],
        crossReferences: [],
        semanticNeighbors: []
      }
    };

    // For complex functions, create block-level hierarchies
    if (fn.complexity > 10 && functionContent.length > 500) {
      const blockHierarchies = await this.createBlockHierarchies(fn, functionContent, functionHierarchy);
      functionHierarchy.children.push(...blockHierarchies);
    }

    return functionHierarchy;
  }

  private async createMethodHierarchy(
    method: CodeSymbol,
    cls: ClassInfo,
    astData: ParseResult,
    filePath: string,
    content: string,
    parent: ChunkHierarchy
  ): Promise<ChunkHierarchy> {
    const methodContent = this.extractMethodContent(method, content);
    
    const methodHierarchy: ChunkHierarchy = {
      id: this.generateChunkId('method', filePath, cls.name, method.name),
      type: 'method',
      level: 2,
      parent,
      children: [],
      content: methodContent,
      metadata: {
        language: astData.language,
        complexity: this.calculateMethodComplexity(method),
        importance: this.calculateMethodImportance(method, cls),
        semanticType: method.name === 'constructor' ? 'constructor' : 'method',
        abstractLevel: 'implementation',
        dependencies: method.dependencies || [],
        exports: [method.name],
        annotations: method.annotations || [],
        decorators: method.decorators || [],
        tags: this.generateMethodTags(method),
        parentContext: {
          className: cls.name,
          functionName: method.name,
          filePath
        }
      },
      position: method.range,
      summary: this.generateMethodSummary(method),
      context: {
        ancestors: [parent.parent!.id, parent.id],
        siblings: [],
        descendants: [],
        relatedChunks: [],
        crossReferences: [],
        semanticNeighbors: []
      }
    };

    return methodHierarchy;
  }

  private async createPropertyHierarchy(
    property: CodeSymbol,
    cls: ClassInfo,
    astData: ParseResult,
    filePath: string,
    content: string,
    parent: ChunkHierarchy
  ): Promise<ChunkHierarchy> {
    return {
      id: this.generateChunkId('property', filePath, cls.name, property.name),
      type: 'statement',
      level: 2,
      parent,
      children: [],
      content: this.extractPropertyContent(property, content),
      metadata: {
        language: astData.language,
        complexity: 1,
        importance: this.calculatePropertyImportance(property),
        semanticType: 'property',
        abstractLevel: 'implementation',
        dependencies: [],
        exports: [property.name],
        annotations: property.annotations || [],
        decorators: property.decorators || [],
        tags: this.generatePropertyTags(property),
        parentContext: {
          className: cls.name,
          filePath
        }
      },
      position: property.range,
      context: {
        ancestors: [parent.parent!.id, parent.id],
        siblings: [],
        descendants: [],
        relatedChunks: [],
        crossReferences: [],
        semanticNeighbors: []
      }
    };
  }

  private async createBlockHierarchies(
    fn: FunctionInfo,
    functionContent: string,
    parent: ChunkHierarchy
  ): Promise<ChunkHierarchy[]> {
    const blocks: ChunkHierarchy[] = [];
    
    // Simple block detection - could be enhanced with AST
    const lines = functionContent.split('\n');
    let currentBlock = '';
    let blockStart = 0;
    let braceLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentBlock += line + '\n';
      
      // Count braces to detect block boundaries
      braceLevel += (line.match(/\{/g) || []).length;
      braceLevel -= (line.match(/\}/g) || []).length;
      
      // If we're back to the original level and have a substantial block
      if (braceLevel === 0 && currentBlock.trim().length > 100) {
        const blockHierarchy: ChunkHierarchy = {
          id: this.generateChunkId('block', parent.metadata.parentContext.filePath, fn.name, `block_${blockStart}`),
          type: 'block',
          level: 2,
          parent,
          children: [],
          content: currentBlock.trim(),
          metadata: {
            language: parent.metadata.language,
            complexity: this.estimateBlockComplexity(currentBlock),
            importance: 0.3,
            semanticType: 'code_block',
            abstractLevel: 'implementation',
            dependencies: [],
            exports: [],
            annotations: [],
            decorators: [],
            tags: ['code-block'],
            parentContext: parent.metadata.parentContext
          },
          position: {
            startLine: fn.bodyRange.start.line + blockStart,
            endLine: fn.bodyRange.start.line + i,
            startColumn: 0,
            endColumn: line.length
          },
          context: {
            ancestors: [parent.parent!.id, parent.id],
            siblings: [],
            descendants: [],
            relatedChunks: [],
            crossReferences: [],
            semanticNeighbors: []
          }
        };
        
        blocks.push(blockHierarchy);
        currentBlock = '';
        blockStart = i + 1;
      }
    }
    
    return blocks;
  }

  private async buildCrossReferences(hierarchies: ChunkHierarchy[], options: ChunkingOptions): Promise<void> {
    console.log('🔗 Building cross-references between chunks...');
    
    for (const hierarchy of hierarchies) {
      await this.buildCrossReferencesRecursive(hierarchy, hierarchies, options);
    }
  }

  private async buildCrossReferencesRecursive(
    chunk: ChunkHierarchy,
    allHierarchies: ChunkHierarchy[],
    options: ChunkingOptions
  ): Promise<void> {
    // Build cross-references for this chunk
    chunk.context.crossReferences = await this.findCrossReferences(chunk, allHierarchies, options);
    chunk.context.semanticNeighbors = await this.findSemanticNeighbors(chunk, allHierarchies, options);
    
    // Update siblings
    if (chunk.parent) {
      chunk.context.siblings = chunk.parent.children
        .filter(sibling => sibling.id !== chunk.id)
        .map(sibling => sibling.id);
    }
    
    // Recursively process children
    for (const child of chunk.children) {
      await this.buildCrossReferencesRecursive(child, allHierarchies, options);
    }
  }

  private async findCrossReferences(
    chunk: ChunkHierarchy,
    allHierarchies: ChunkHierarchy[],
    options: ChunkingOptions
  ): Promise<Array<{ chunkId: string; relationship: string; confidence: number }>> {
    const crossRefs: Array<{ chunkId: string; relationship: string; confidence: number }> = [];
    
    // Use code graph to find relationships
    const graphNodes = this.codeGraph.getNodesByFile(chunk.metadata.parentContext.filePath);
    
    for (const node of graphNodes) {
      const dependencies = this.codeGraph.getDependencies(node.id);
      const dependents = this.codeGraph.getDependents(node.id);
      
      // Map graph relationships to chunk relationships
      for (const dep of dependencies) {
        const targetChunk = this.findChunkByNodeId(dep.id, allHierarchies);
        if (targetChunk && targetChunk.id !== chunk.id) {
          crossRefs.push({
            chunkId: targetChunk.id,
            relationship: 'depends_on',
            confidence: 0.8
          });
        }
      }
      
      for (const dependent of dependents) {
        const sourceChunk = this.findChunkByNodeId(dependent.id, allHierarchies);
        if (sourceChunk && sourceChunk.id !== chunk.id) {
          crossRefs.push({
            chunkId: sourceChunk.id,
            relationship: 'used_by',
            confidence: 0.8
          });
        }
      }
    }
    
    return crossRefs;
  }

  private async findSemanticNeighbors(
    chunk: ChunkHierarchy,
    allHierarchies: ChunkHierarchy[],
    options: ChunkingOptions
  ): Promise<Array<{ chunkId: string; similarity: number; reason: string }>> {
    const neighbors: Array<{ chunkId: string; similarity: number; reason: string }> = [];
    
    // Find chunks with similar content using various similarity measures
    const allChunks = this.flattenHierarchies(allHierarchies);
    
    for (const otherChunk of allChunks) {
      if (otherChunk.id === chunk.id) continue;
      
      const similarity = await this.calculateSemanticSimilarity(chunk, otherChunk);
      
      if (similarity > options.semanticSimilarityThreshold) {
        neighbors.push({
          chunkId: otherChunk.id,
          similarity,
          reason: this.determineSimilarityReason(chunk, otherChunk)
        });
      }
    }
    
    // Sort by similarity and limit results
    return neighbors
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
  }

  private async generateChunksFromHierarchy(
    hierarchy: ChunkHierarchy,
    options: ChunkingOptions
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];
    
    await this.generateChunksRecursive(hierarchy, chunks, options);
    
    return chunks;
  }

  private async generateChunksRecursive(
    hierarchy: ChunkHierarchy,
    chunks: CodeChunk[],
    options: ChunkingOptions
  ): Promise<void> {
    // Generate chunk for current hierarchy level
    const chunk = await this.createCodeChunkFromHierarchy(hierarchy, options);
    chunks.push(chunk);
    
    // Recursively process children
    for (const child of hierarchy.children) {
      await this.generateChunksRecursive(child, chunks, options);
    }
  }

  private async createCodeChunkFromHierarchy(
    hierarchy: ChunkHierarchy,
    options: ChunkingOptions
  ): Promise<CodeChunk> {
    // Generate embeddings for the chunk content
    const denseVector = await this.generateDenseVector(hierarchy.content);
    const sparseVector = this.generateSparseVector(hierarchy.content);
    
    return {
      id: hierarchy.id,
      content: this.enhanceContentWithContext(hierarchy, options),
      filePath: hierarchy.metadata.parentContext.filePath,
      startLine: hierarchy.position.startLine,
      endLine: hierarchy.position.endLine,
      chunkType: hierarchy.type as any,
      metadata: {
        language: hierarchy.metadata.language,
        className: hierarchy.metadata.parentContext.className,
        functionName: hierarchy.metadata.parentContext.functionName,
        complexity: hierarchy.metadata.complexity,
        dependencies: hierarchy.metadata.dependencies,
        isInterface: hierarchy.metadata.semanticType === 'interface',
        isEnum: hierarchy.metadata.semanticType === 'enum',
        isAnnotation: hierarchy.metadata.annotations.length > 0,
        framework: hierarchy.metadata.framework,
        frameworkVersion: undefined,
        frameworkType: hierarchy.metadata.classification?.primary?.toString(),
        componentType: hierarchy.metadata.semanticType,
        isFrameworkSummary: hierarchy.metadata.abstractLevel === 'overview'
      },
      denseVector,
      sparseVector
    };
  }

  private async generateOverviewChunks(
    hierarchies: ChunkHierarchy[],
    options: ChunkingOptions
  ): Promise<CodeChunk[]> {
    const overviewChunks: CodeChunk[] = [];
    
    // Generate project-level overview
    const projectOverview = await this.generateProjectOverview(hierarchies);
    overviewChunks.push(projectOverview);
    
    // Generate framework-specific overviews
    const frameworkOverviews = await this.generateFrameworkOverviews(hierarchies);
    overviewChunks.push(...frameworkOverviews);
    
    // Generate architectural layer overviews
    const layerOverviews = await this.generateLayerOverviews(hierarchies);
    overviewChunks.push(...layerOverviews);
    
    return overviewChunks;
  }

  private async enrichChunksWithContext(chunks: CodeChunk[], options: ChunkingOptions): Promise<void> {
    console.log('🌟 Enriching chunks with parent context...');
    
    for (const chunk of chunks) {
      const hierarchy = this.findHierarchyById(chunk.id);
      if (hierarchy) {
        // Add parent context to chunk content
        chunk.content = this.addParentContextToContent(chunk, hierarchy, options);
        
        // Update metadata with hierarchical information
        this.updateChunkMetadataWithHierarchy(chunk, hierarchy);
      }
    }
  }

  // Helper methods for content extraction and generation
  private createFileOverview(astData: ParseResult): string {
    const overview = [`File Overview:`];
    
    if (astData.classes.length > 0) {
      overview.push(`Classes: ${astData.classes.map(c => c.name).join(', ')}`);
    }
    
    if (astData.functions.length > 0) {
      overview.push(`Functions: ${astData.functions.map(f => f.name).join(', ')}`);
    }
    
    if (astData.imports.length > 0) {
      overview.push(`Imports: ${astData.imports.map(i => i.module).join(', ')}`);
    }
    
    overview.push(`Complexity: ${astData.complexity.cyclomatic}`);
    
    return overview.join('\n');
  }

  private extractClassContent(cls: ClassInfo, content: string): string {
    // Extract class definition and signature
    return `class ${cls.name} {\n  // ${cls.methods.length} methods, ${cls.properties.length} properties\n  // Annotations: ${cls.annotations.join(', ')}\n}`;
  }

  private extractFunctionContent(fn: FunctionInfo, content: string): string {
    // Extract function signature and body
    const params = fn.parameters.map(p => p.name).join(', ');
    return `function ${fn.name}(${params}) {\n  // Complexity: ${fn.complexity}\n  // Implementation details...\n}`;
  }

  private extractMethodContent(method: CodeSymbol, content: string): string {
    const params = method.parameters?.map(p => p.name).join(', ') || '';
    return `${method.name}(${params}) {\n  // Method implementation\n}`;
  }

  private extractPropertyContent(property: CodeSymbol, content: string): string {
    return `${property.name}: ${property.detail || 'property'}`;
  }

  private generateChunkId(...parts: string[]): string {
    return parts.join('::');
  }

  private calculateFileImportance(astData: ParseResult): number {
    // Higher importance for files with more complex structures
    return Math.min(1.0, (astData.classes.length * 0.3 + astData.functions.length * 0.2 + astData.imports.length * 0.1));
  }

  private calculateClassComplexity(cls: ClassInfo): number {
    return cls.methods.length + cls.properties.length;
  }

  private calculateClassImportance(cls: ClassInfo): number {
    let importance = 0.5;
    
    if (cls.isInterface) importance += 0.2;
    if (cls.isAbstract) importance += 0.1;
    if (cls.annotations.length > 0) importance += 0.1;
    if (cls.methods.length > 5) importance += 0.1;
    
    return Math.min(1.0, importance);
  }

  private calculateFunctionImportance(fn: FunctionInfo): number {
    let importance = 0.4;
    
    if (fn.complexity > 10) importance += 0.3;
    if (fn.decorators.length > 0) importance += 0.1;
    if (fn.annotations.length > 0) importance += 0.1;
    if (fn.isAsync) importance += 0.05;
    
    return Math.min(1.0, importance);
  }

  private calculateMethodComplexity(method: CodeSymbol): number {
    return 1; // Placeholder - would need AST analysis
  }

  private calculateMethodImportance(method: CodeSymbol, cls: ClassInfo): number {
    let importance = 0.3;
    
    if (method.name === 'constructor') importance += 0.4;
    if (method.visibility === 'public') importance += 0.1;
    if (method.isStatic) importance += 0.1;
    if (method.decorators && method.decorators.length > 0) importance += 0.1;
    
    return Math.min(1.0, importance);
  }

  private calculatePropertyImportance(property: CodeSymbol): number {
    let importance = 0.2;
    
    if (property.visibility === 'public') importance += 0.1;
    if (property.isStatic) importance += 0.1;
    
    return Math.min(1.0, importance);
  }

  private isSignificantProperty(property: CodeSymbol): boolean {
    return property.visibility === 'public' || 
           (property.decorators && property.decorators.length > 0) ||
           (property.annotations && property.annotations.length > 0);
  }

  private estimateClassPosition(cls: ClassInfo, content: string): any {
    // Estimate based on class name occurrence in content
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`class ${cls.name}`)) {
        return {
          startLine: i + 1,
          endLine: Math.min(i + 50, lines.length), // Estimate
          startColumn: 0,
          endColumn: lines[i].length
        };
      }
    }
    return { startLine: 1, endLine: 1, startColumn: 0, endColumn: 0 };
  }

  private estimateBlockComplexity(blockContent: string): number {
    // Simple complexity estimation
    const ifCount = (blockContent.match(/\bif\b/g) || []).length;
    const loopCount = (blockContent.match(/\b(for|while)\b/g) || []).length;
    const switchCount = (blockContent.match(/\bswitch\b/g) || []).length;
    
    return 1 + ifCount + loopCount * 2 + switchCount * 2;
  }

  private generateClassSummary(cls: ClassInfo): string {
    return `${cls.isInterface ? 'Interface' : cls.isEnum ? 'Enum' : 'Class'} ${cls.name} with ${cls.methods.length} methods and ${cls.properties.length} properties`;
  }

  private generateFunctionSummary(fn: FunctionInfo): string {
    return `Function ${fn.name} with complexity ${fn.complexity}${fn.isAsync ? ' (async)' : ''}`;
  }

  private generateMethodSummary(method: CodeSymbol): string {
    return `Method ${method.name}${method.isStatic ? ' (static)' : ''}${method.isAsync ? ' (async)' : ''}`;
  }

  private extractClassDependencies(cls: ClassInfo): string[] {
    const deps: string[] = [];
    
    if (cls.superClass) deps.push(cls.superClass);
    deps.push(...cls.interfaces);
    
    return deps;
  }

  private extractFunctionDependencies(fn: FunctionInfo): string[] {
    // Extract from parameters and return type
    const deps: string[] = [];
    
    fn.parameters.forEach(param => {
      if (param.type) deps.push(param.type);
    });
    
    if (fn.returnType) deps.push(fn.returnType);
    
    return deps;
  }

  private generateFileTags(astData: ParseResult, classification: FileClassification): string[] {
    const tags: string[] = [];
    
    tags.push(`lang:${astData.language}`);
    if (classification.primary) tags.push(`framework:${classification.primary}`);
    if (astData.classes.length > 0) tags.push('has-classes');
    if (astData.functions.length > 0) tags.push('has-functions');
    
    return tags;
  }

  private generateClassTags(cls: ClassInfo): string[] {
    const tags: string[] = ['class'];
    
    if (cls.isInterface) tags.push('interface');
    if (cls.isEnum) tags.push('enum');
    if (cls.isAbstract) tags.push('abstract');
    if (cls.annotations.length > 0) tags.push('annotated');
    
    return tags;
  }

  private generateFunctionTags(fn: FunctionInfo): string[] {
    const tags: string[] = ['function'];
    
    if (fn.isAsync) tags.push('async');
    if (fn.isStatic) tags.push('static');
    if (fn.complexity > 10) tags.push('complex');
    
    return tags;
  }

  private generateMethodTags(method: CodeSymbol): string[] {
    const tags: string[] = ['method'];
    
    if (method.isStatic) tags.push('static');
    if (method.isAsync) tags.push('async');
    if (method.visibility) tags.push(`visibility:${method.visibility}`);
    
    return tags;
  }

  private generatePropertyTags(property: CodeSymbol): string[] {
    const tags: string[] = ['property'];
    
    if (property.isStatic) tags.push('static');
    if (property.visibility) tags.push(`visibility:${property.visibility}`);
    
    return tags;
  }

  private collectDescendantIds(hierarchy: ChunkHierarchy): string[] {
    const descendants: string[] = [];
    
    for (const child of hierarchy.children) {
      descendants.push(child.id);
      descendants.push(...this.collectDescendantIds(child));
    }
    
    return descendants;
  }

  private findChunkByNodeId(nodeId: string, hierarchies: ChunkHierarchy[]): ChunkHierarchy | null {
    for (const hierarchy of hierarchies) {
      const found = this.findChunkByNodeIdRecursive(nodeId, hierarchy);
      if (found) return found;
    }
    return null;
  }

  private findChunkByNodeIdRecursive(nodeId: string, hierarchy: ChunkHierarchy): ChunkHierarchy | null {
    // Simple heuristic matching - could be more sophisticated
    if (hierarchy.id.includes(nodeId.split('::').pop() || '')) {
      return hierarchy;
    }
    
    for (const child of hierarchy.children) {
      const found = this.findChunkByNodeIdRecursive(nodeId, child);
      if (found) return found;
    }
    
    return null;
  }

  private flattenHierarchies(hierarchies: ChunkHierarchy[]): ChunkHierarchy[] {
    const flattened: ChunkHierarchy[] = [];
    
    for (const hierarchy of hierarchies) {
      this.flattenHierarchyRecursive(hierarchy, flattened);
    }
    
    return flattened;
  }

  private flattenHierarchyRecursive(hierarchy: ChunkHierarchy, result: ChunkHierarchy[]): void {
    result.push(hierarchy);
    
    for (const child of hierarchy.children) {
      this.flattenHierarchyRecursive(child, result);
    }
  }

  private async calculateSemanticSimilarity(chunk1: ChunkHierarchy, chunk2: ChunkHierarchy): Promise<number> {
    // Multiple similarity measures
    let similarity = 0;
    
    // Content similarity (simple text overlap)
    const contentSimilarity = this.calculateTextSimilarity(chunk1.content, chunk2.content);
    similarity += contentSimilarity * 0.4;
    
    // Tag similarity
    const tagSimilarity = this.calculateTagSimilarity(chunk1.metadata.tags, chunk2.metadata.tags);
    similarity += tagSimilarity * 0.3;
    
    // Structural similarity (same type, level)
    if (chunk1.type === chunk2.type) similarity += 0.2;
    if (chunk1.level === chunk2.level) similarity += 0.1;
    
    return Math.min(1.0, similarity);
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateTagSimilarity(tags1: string[], tags2: string[]): number {
    const set1 = new Set(tags1);
    const set2 = new Set(tags2);
    
    const intersection = new Set([...set1].filter(tag => set2.has(tag)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private determineSimilarityReason(chunk1: ChunkHierarchy, chunk2: ChunkHierarchy): string {
    if (chunk1.type === chunk2.type) return `Same type: ${chunk1.type}`;
    if (chunk1.metadata.language === chunk2.metadata.language) return 'Same language';
    if (chunk1.metadata.framework === chunk2.metadata.framework) return 'Same framework';
    return 'Content similarity';
  }

  private async generateDenseVector(content: string): Promise<number[]> {
    // Placeholder - would use actual embedding model
    return new Array(768).fill(0).map(() => Math.random());
  }

  private generateSparseVector(content: string): Record<string, number> {
    if (!this.bm25) {
      this.bm25 = new BM25([content]);
    }
    return this.bm25.generateSparseVector(content);
  }

  private enhanceContentWithContext(hierarchy: ChunkHierarchy, options: ChunkingOptions): string {
    let enhancedContent = hierarchy.content;
    
    if (options.includeContext) {
      // Add parent context
      if (hierarchy.parent) {
        enhancedContent = `// Parent: ${hierarchy.parent.metadata.semanticType}\n${enhancedContent}`;
      }
      
      // Add summary if available
      if (hierarchy.summary) {
        enhancedContent = `// Summary: ${hierarchy.summary}\n${enhancedContent}`;
      }
      
      // Add cross-references
      if (hierarchy.context.crossReferences.length > 0) {
        const refs = hierarchy.context.crossReferences.slice(0, 3).map(ref => ref.chunkId).join(', ');
        enhancedContent += `\n// Related: ${refs}`;
      }
    }
    
    return enhancedContent;
  }

  private async generateProjectOverview(hierarchies: ChunkHierarchy[]): Promise<CodeChunk> {
    const allFiles = hierarchies.length;
    const allClasses = hierarchies.flatMap(h => h.children.filter(c => c.type === 'class')).length;
    const allFunctions = hierarchies.flatMap(h => h.children.filter(c => c.type === 'function')).length;
    
    const overview = `Project Overview:
Files: ${allFiles}
Classes: ${allClasses}
Functions: ${allFunctions}
Languages: ${[...new Set(hierarchies.map(h => h.metadata.language))].join(', ')}
Frameworks: ${[...new Set(hierarchies.map(h => h.metadata.framework).filter(Boolean))].join(', ')}`;
    
    return {
      id: 'project::overview',
      content: overview,
      filePath: 'project',
      startLine: 1,
      endLine: 1,
      chunkType: 'file',
      metadata: {
        language: 'overview',
        isFrameworkSummary: true,
        componentType: 'project_overview'
      },
      denseVector: await this.generateDenseVector(overview),
      sparseVector: this.generateSparseVector(overview)
    };
  }

  private async generateFrameworkOverviews(hierarchies: ChunkHierarchy[]): Promise<CodeChunk[]> {
    const frameworkGroups = new Map<string, ChunkHierarchy[]>();
    
    for (const hierarchy of hierarchies) {
      const framework = hierarchy.metadata.framework || 'unknown';
      if (!frameworkGroups.has(framework)) {
        frameworkGroups.set(framework, []);
      }
      frameworkGroups.get(framework)!.push(hierarchy);
    }
    
    const overviews: CodeChunk[] = [];
    
    for (const [framework, files] of frameworkGroups) {
      if (framework !== 'unknown' && files.length > 1) {
        const overview = `${framework} Framework Overview:
Files: ${files.length}
Classes: ${files.flatMap(f => f.children.filter(c => c.type === 'class')).length}
Functions: ${files.flatMap(f => f.children.filter(c => c.type === 'function')).length}`;
        
        overviews.push({
          id: `framework::${framework}::overview`,
          content: overview,
          filePath: framework,
          startLine: 1,
          endLine: 1,
          chunkType: 'file',
          metadata: {
            language: 'overview',
            framework,
            isFrameworkSummary: true,
            componentType: 'framework_overview'
          },
          denseVector: await this.generateDenseVector(overview),
          sparseVector: this.generateSparseVector(overview)
        });
      }
    }
    
    return overviews;
  }

  private async generateLayerOverviews(hierarchies: ChunkHierarchy[]): Promise<CodeChunk[]> {
    // Group by architectural layers
    const layerGroups = new Map<string, ChunkHierarchy[]>();
    
    for (const hierarchy of hierarchies) {
      const layer = this.identifyArchitecturalLayer(hierarchy);
      if (layer) {
        if (!layerGroups.has(layer)) {
          layerGroups.set(layer, []);
        }
        layerGroups.get(layer)!.push(hierarchy);
      }
    }
    
    const overviews: CodeChunk[] = [];
    
    for (const [layer, items] of layerGroups) {
      if (items.length > 1) {
        const overview = `${layer} Layer Overview:
Components: ${items.length}
Average Complexity: ${items.reduce((sum, item) => sum + item.metadata.complexity, 0) / items.length}`;
        
        overviews.push({
          id: `layer::${layer}::overview`,
          content: overview,
          filePath: layer,
          startLine: 1,
          endLine: 1,
          chunkType: 'file',
          metadata: {
            language: 'overview',
            isFrameworkSummary: true,
            componentType: 'layer_overview'
          },
          denseVector: await this.generateDenseVector(overview),
          sparseVector: this.generateSparseVector(overview)
        });
      }
    }
    
    return overviews;
  }

  private identifyArchitecturalLayer(hierarchy: ChunkHierarchy): string | null {
    const content = hierarchy.content.toLowerCase();
    const tags = hierarchy.metadata.tags.join(' ').toLowerCase();
    
    if (content.includes('controller') || tags.includes('controller')) return 'Controller';
    if (content.includes('service') || tags.includes('service')) return 'Service';
    if (content.includes('repository') || tags.includes('repository')) return 'Repository';
    if (content.includes('model') || content.includes('entity')) return 'Model';
    if (content.includes('component') || tags.includes('component')) return 'Component';
    
    return null;
  }

  private addParentContextToContent(chunk: CodeChunk, hierarchy: ChunkHierarchy, options: ChunkingOptions): string {
    if (!options.includeContext) return chunk.content;
    
    let contextualContent = chunk.content;
    
    // Add hierarchical breadcrumb
    const breadcrumb = hierarchy.context.ancestors.join(' > ');
    if (breadcrumb) {
      contextualContent = `// Context: ${breadcrumb}\n${contextualContent}`;
    }
    
    // Add parent summary
    if (hierarchy.parent && hierarchy.parent.summary) {
      contextualContent = `// Parent: ${hierarchy.parent.summary}\n${contextualContent}`;
    }
    
    return contextualContent;
  }

  private updateChunkMetadataWithHierarchy(chunk: CodeChunk, hierarchy: ChunkHierarchy): void {
    // Add hierarchical metadata
    chunk.metadata = {
      ...chunk.metadata,
      complexity: hierarchy.metadata.complexity,
      dependencies: hierarchy.metadata.dependencies
    };
  }

  private findHierarchyById(chunkId: string): ChunkHierarchy | null {
    for (const hierarchy of this.chunkHierarchies.values()) {
      const found = this.findHierarchyByIdRecursive(chunkId, hierarchy);
      if (found) return found;
    }
    return null;
  }

  private findHierarchyByIdRecursive(chunkId: string, hierarchy: ChunkHierarchy): ChunkHierarchy | null {
    if (hierarchy.id === chunkId) return hierarchy;
    
    for (const child of hierarchy.children) {
      const found = this.findHierarchyByIdRecursive(chunkId, child);
      if (found) return found;
    }
    
    return null;
  }

  // Public utility methods
  getChunkingStrategies(): ChunkingStrategy[] {
    return [
      {
        name: 'semantic',
        maxChunkSize: 1000,
        overlapSize: 200,
        preserveBoundaries: true,
        respectSyntax: true,
        includeContext: true,
        generateSummaries: true,
        semanticGrouping: true
      },
      {
        name: 'balanced',
        maxChunkSize: 800,
        overlapSize: 150,
        preserveBoundaries: true,
        respectSyntax: true,
        includeContext: true,
        generateSummaries: false,
        semanticGrouping: false
      },
      {
        name: 'compact',
        maxChunkSize: 500,
        overlapSize: 100,
        preserveBoundaries: false,
        respectSyntax: true,
        includeContext: false,
        generateSummaries: false,
        semanticGrouping: false
      }
    ];
  }

  getDefaultOptions(): ChunkingOptions {
    return {
      strategy: this.getChunkingStrategies()[0],
      includePrivateMembers: false,
      generateOverviewChunks: true,
      crossReferenceDepth: 2,
      semanticSimilarityThreshold: 0.3,
      contextWindowSize: 3
    };
  }
}