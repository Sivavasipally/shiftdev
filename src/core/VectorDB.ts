import { connect } from '@lancedb/lancedb';
import { CodeChunk } from '../types';
import { BM25 } from '../utils/bm25';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface SearchFilter {
  framework?: string | string[];
  language?: string | string[];
  chunkType?: string | string[];
  filePath?: string;
  filePathPattern?: RegExp;
  className?: string;
  functionName?: string;
  componentType?: string;
  complexity?: { min?: number; max?: number };
  hasFramework?: boolean;
  isInterface?: boolean;
  isEnum?: boolean;
  minLines?: number;
  maxLines?: number;
  dependencies?: string[];
}

export interface SearchOptions {
  filter?: SearchFilter;
  limit?: number;
  offset?: number;
  sortBy?: 'relevance' | 'complexity' | 'lines' | 'alphabetical';
  sortOrder?: 'asc' | 'desc';
  includeMetadata?: boolean;
  hybridWeight?: { dense?: number; sparse?: number; keyword?: number };
}

export interface SearchResult {
  chunk: CodeChunk;
  score: number;
  relevanceBreakdown?: {
    denseScore: number;
    sparseScore: number;
    keywordScore: number;
    metadataScore: number;
    totalScore: number;
  };
}

export interface AggregationResult {
  frameworks: Record<string, number>;
  languages: Record<string, number>;
  chunkTypes: Record<string, number>;
  complexityDistribution: { low: number; medium: number; high: number };
  totalChunks: number;
}

export class VectorDB {
  private db: any;
  private table: any = null;
  private readonly dbPath: string;
  private chunks: CodeChunk[] = []; // In-memory storage as fallback
  private bm25Index: BM25;
  private metadataIndex: Map<string, Set<number>> = new Map();
  private isIndexed: boolean = false;

  constructor(workspaceUri: vscode.Uri) {
    this.dbPath = path.join(workspaceUri.fsPath, '.vscode', 'devcanvas.lance');
  }

  async initialize(): Promise<void> {
    try {
      // Ensure the directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Load existing data
      this.loadFromFile();
      
      // Initialize search indices
      await this.rebuildIndices();
      
      console.log(`🗄️ VectorDB initialized with ${this.chunks.length} chunks`);
    } catch (error) {
      console.error('Failed to initialize VectorDB:', error);
      // Continue with in-memory storage
    }
  }

  async addChunks(chunks: CodeChunk[]): Promise<void> {
    try {
      console.log(`VectorDB: Adding ${chunks.length} chunks. Current total: ${this.chunks.length}`);
      
      const startIndex = this.chunks.length;
      this.chunks = [...this.chunks, ...chunks];
      
      // Update search indices incrementally
      await this.updateIndicesForNewChunks(chunks, startIndex);
      
      await this.saveToFile();
      console.log(`VectorDB: Now have ${this.chunks.length} total chunks`);
    } catch (error) {
      console.error('Failed to add chunks:', error);
      throw error;
    }
  }

  async hybridSearch(
    query: string, 
    denseVector: number[], 
    sparseVector: Record<string, number>,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    try {
      const limit = options.limit || 10;
      const offset = options.offset || 0;
      const weights = options.hybridWeight || { dense: 0.4, sparse: 0.3, keyword: 0.3 };
      
      console.log(`VectorDB: Hybrid search through ${this.chunks.length} chunks for: "${query}"`);
      
      if (!this.isIndexed) {
        await this.rebuildIndices();
      }
      
      // Step 1: Apply filters to get candidate chunks
      let candidateIndices = this.getFilteredIndices(options.filter);
      
      // Step 2: Calculate scores for each component
      const results: SearchResult[] = [];
      
      for (const index of candidateIndices) {
        const chunk = this.chunks[index];
        if (!chunk) continue;
        
        // Dense vector similarity (cosine similarity)
        const denseScore = this.calculateDenseVectorSimilarity(denseVector, chunk.denseVector);
        
        // Sparse vector similarity (BM25-like)
        const sparseScore = this.calculateSparseVectorSimilarity(sparseVector, chunk.sparseVector);
        
        // Keyword similarity using BM25
        const keywordScore = this.bm25Index ? this.bm25Index.score(query, index) : 0;
        
        // Metadata relevance boost
        const metadataScore = this.calculateMetadataRelevance(query, chunk);
        
        // Combined score
        const totalScore = (
          (denseScore * (weights.dense || 0.4)) +
          (sparseScore * (weights.sparse || 0.3)) +
          (keywordScore * (weights.keyword || 0.3)) +
          (metadataScore * 0.1)
        );
        
        if (totalScore > 0.1) { // Minimum relevance threshold
          results.push({
            chunk,
            score: totalScore,
            relevanceBreakdown: options.includeMetadata ? {
              denseScore,
              sparseScore,
              keywordScore,
              metadataScore,
              totalScore
            } : undefined
          });
        }
      }
      
      // Step 3: Sort and paginate results
      const sortedResults = this.sortResults(results, options.sortBy || 'relevance', options.sortOrder || 'desc');
      
      console.log(`VectorDB: Found ${results.length} relevant chunks, returning top ${limit}`);
      
      return sortedResults.slice(offset, offset + limit);
    } catch (error) {
      console.error('Hybrid search failed:', error);
      return [];
    }
  }

  async searchByFilePath(filePath: string, limit: number = 5): Promise<CodeChunk[]> {
    return this.chunks
      .filter(chunk => chunk.filePath === filePath)
      .slice(0, limit);
  }

  async searchByChunkType(chunkType: string, limit: number = 20): Promise<CodeChunk[]> {
    return this.chunks
      .filter(chunk => chunk.chunkType === chunkType)
      .slice(0, limit);
  }
  
  async searchWithFilters(filters: SearchFilter, options: SearchOptions = {}): Promise<SearchResult[]> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    
    const candidateIndices = this.getFilteredIndices(filters);
    
    const results = candidateIndices.map(index => ({
      chunk: this.chunks[index],
      score: 1.0 // Default score for filter-only searches
    }));
    
    const sortedResults = this.sortResults(results, options.sortBy || 'alphabetical', options.sortOrder || 'asc');
    
    return sortedResults.slice(offset, offset + limit);
  }
  
  async getAggregatedMetrics(filters?: SearchFilter): Promise<AggregationResult> {
    const candidateIndices = filters ? this.getFilteredIndices(filters) : Array.from({ length: this.chunks.length }, (_, i) => i);
    
    const metrics: AggregationResult = {
      frameworks: {},
      languages: {},
      chunkTypes: {},
      complexityDistribution: { low: 0, medium: 0, high: 0 },
      totalChunks: candidateIndices.length
    };
    
    for (const index of candidateIndices) {
      const chunk = this.chunks[index];
      if (!chunk) continue;
      
      // Framework distribution
      const framework = chunk.metadata.framework || 'unknown';
      metrics.frameworks[framework] = (metrics.frameworks[framework] || 0) + 1;
      
      // Language distribution
      const language = chunk.metadata.language || 'unknown';
      metrics.languages[language] = (metrics.languages[language] || 0) + 1;
      
      // Chunk type distribution
      metrics.chunkTypes[chunk.chunkType] = (metrics.chunkTypes[chunk.chunkType] || 0) + 1;
      
      // Complexity distribution
      const complexity = chunk.metadata.complexity || 0;
      if (complexity <= 5) metrics.complexityDistribution.low++;
      else if (complexity <= 15) metrics.complexityDistribution.medium++;
      else metrics.complexityDistribution.high++;
    }
    
    return metrics;
  }

  async getChunkCount(): Promise<number> {
    return this.chunks.length;
  }

  async clearAll(): Promise<void> {
    this.chunks = [];
    this.metadataIndex.clear();
    this.bm25Index = new BM25([]);
    this.isIndexed = false;
    await this.saveToFile();
  }

  async close(): Promise<void> {
    await this.saveToFile();
    this.table = null;
    this.db = null;
  }

  private loadFromFile(): void {
    try {
      const filePath = path.join(path.dirname(this.dbPath), 'chunks.json');
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(data);
        
        // Handle both old and new format
        if (Array.isArray(parsed)) {
          // Old format - just chunks array
          this.chunks = parsed;
        } else if (parsed.chunks && Array.isArray(parsed.chunks)) {
          // New format - with metadata
          this.chunks = parsed.chunks;
          console.log(`📦 Loaded ${this.chunks.length} chunks from ${parsed.metadata?.lastUpdated || 'unknown date'}`);
        }
      }
    } catch (error) {
      console.warn('Failed to load chunks from file:', error);
      this.chunks = [];
    }
  }

  private async saveToFile(): Promise<void> {
    try {
      const filePath = path.join(path.dirname(this.dbPath), 'chunks.json');
      const dir = path.dirname(filePath);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Save chunks and metadata for faster loading
      const data = {
        chunks: this.chunks,
        metadata: {
          totalChunks: this.chunks.length,
          lastUpdated: new Date().toISOString(),
          version: '2.0'
        }
      };
      
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('Failed to save chunks to file:', error);
    }
  }
  
  // New private methods for enhanced functionality
  private async rebuildIndices(): Promise<void> {
    try {
      console.log('🔧 Rebuilding search indices...');
      
      // Build BM25 index
      const documents = this.chunks.map(chunk => 
        `${chunk.content} ${chunk.metadata.className || ''} ${chunk.metadata.functionName || ''} ${path.basename(chunk.filePath)}`
      );
      this.bm25Index = new BM25(documents);
      
      // Build metadata indices
      this.metadataIndex.clear();
      
      this.chunks.forEach((chunk, index) => {
        // Framework index
        this.addToMetadataIndex('framework', chunk.metadata.framework, index);
        
        // Language index
        this.addToMetadataIndex('language', chunk.metadata.language, index);
        
        // Chunk type index
        this.addToMetadataIndex('chunkType', chunk.chunkType, index);
        
        // Class name index
        this.addToMetadataIndex('className', chunk.metadata.className, index);
        
        // Function name index
        this.addToMetadataIndex('functionName', chunk.metadata.functionName, index);
        
        // Component type index
        this.addToMetadataIndex('componentType', chunk.metadata.componentType, index);
        
        // File path index (by directory)
        const dir = path.dirname(chunk.filePath);
        this.addToMetadataIndex('directory', dir, index);
      });
      
      this.isIndexed = true;
      console.log('✅ Search indices rebuilt successfully');
    } catch (error) {
      console.error('Failed to rebuild indices:', error);
      this.isIndexed = false;
    }
  }
  
  private async updateIndicesForNewChunks(newChunks: CodeChunk[], startIndex: number): Promise<void> {
    try {
      // Update BM25 index
      const newDocuments = newChunks.map(chunk => 
        `${chunk.content} ${chunk.metadata.className || ''} ${chunk.metadata.functionName || ''} ${path.basename(chunk.filePath)}`
      );
      
      // For now, rebuild the entire BM25 index (could be optimized)
      const allDocuments = this.chunks.map(chunk => 
        `${chunk.content} ${chunk.metadata.className || ''} ${chunk.metadata.functionName || ''} ${path.basename(chunk.filePath)}`
      );
      this.bm25Index = new BM25(allDocuments);
      
      // Update metadata indices
      newChunks.forEach((chunk, relativeIndex) => {
        const absoluteIndex = startIndex + relativeIndex;
        
        this.addToMetadataIndex('framework', chunk.metadata.framework, absoluteIndex);
        this.addToMetadataIndex('language', chunk.metadata.language, absoluteIndex);
        this.addToMetadataIndex('chunkType', chunk.chunkType, absoluteIndex);
        this.addToMetadataIndex('className', chunk.metadata.className, absoluteIndex);
        this.addToMetadataIndex('functionName', chunk.metadata.functionName, absoluteIndex);
        this.addToMetadataIndex('componentType', chunk.metadata.componentType, absoluteIndex);
        
        const dir = path.dirname(chunk.filePath);
        this.addToMetadataIndex('directory', dir, absoluteIndex);
      });
      
      this.isIndexed = true;
    } catch (error) {
      console.error('Failed to update indices:', error);
    }
  }
  
  private addToMetadataIndex(key: string, value: string | undefined, index: number): void {
    if (!value) return;
    
    const indexKey = `${key}:${value.toLowerCase()}`;
    if (!this.metadataIndex.has(indexKey)) {
      this.metadataIndex.set(indexKey, new Set());
    }
    this.metadataIndex.get(indexKey)!.add(index);
  }
  
  private getFilteredIndices(filter?: SearchFilter): Set<number> {
    if (!filter) {
      return new Set(Array.from({ length: this.chunks.length }, (_, i) => i));
    }
    
    let candidateIndices: Set<number> | null = null;
    
    // Framework filter
    if (filter.framework) {
      const frameworks = Array.isArray(filter.framework) ? filter.framework : [filter.framework];
      const frameworkIndices = new Set<number>();
      
      for (const framework of frameworks) {
        const indices = this.metadataIndex.get(`framework:${framework.toLowerCase()}`);
        if (indices) {
          indices.forEach(i => frameworkIndices.add(i));
        }
      }
      
      candidateIndices = this.intersectSets(candidateIndices, frameworkIndices);
    }
    
    // Language filter
    if (filter.language) {
      const languages = Array.isArray(filter.language) ? filter.language : [filter.language];
      const languageIndices = new Set<number>();
      
      for (const language of languages) {
        const indices = this.metadataIndex.get(`language:${language.toLowerCase()}`);
        if (indices) {
          indices.forEach(i => languageIndices.add(i));
        }
      }
      
      candidateIndices = this.intersectSets(candidateIndices, languageIndices);
    }
    
    // Chunk type filter
    if (filter.chunkType) {
      const chunkTypes = Array.isArray(filter.chunkType) ? filter.chunkType : [filter.chunkType];
      const chunkTypeIndices = new Set<number>();
      
      for (const chunkType of chunkTypes) {
        const indices = this.metadataIndex.get(`chunkType:${chunkType.toLowerCase()}`);
        if (indices) {
          indices.forEach(i => chunkTypeIndices.add(i));
        }
      }
      
      candidateIndices = this.intersectSets(candidateIndices, chunkTypeIndices);
    }
    
    // Apply additional filters
    if (candidateIndices === null) {
      candidateIndices = new Set(Array.from({ length: this.chunks.length }, (_, i) => i));
    }
    
    // Complex filters that require iteration
    const filteredIndices = new Set<number>();
    
    for (const index of candidateIndices) {
      const chunk = this.chunks[index];
      if (!chunk) continue;
      
      // File path filters
      if (filter.filePath && !chunk.filePath.includes(filter.filePath)) continue;
      if (filter.filePathPattern && !filter.filePathPattern.test(chunk.filePath)) continue;
      
      // Metadata filters
      if (filter.className && chunk.metadata.className !== filter.className) continue;
      if (filter.functionName && chunk.metadata.functionName !== filter.functionName) continue;
      if (filter.componentType && chunk.metadata.componentType !== filter.componentType) continue;
      
      // Complexity filter
      if (filter.complexity) {
        const complexity = chunk.metadata.complexity || 0;
        if (filter.complexity.min !== undefined && complexity < filter.complexity.min) continue;
        if (filter.complexity.max !== undefined && complexity > filter.complexity.max) continue;
      }
      
      // Boolean filters
      if (filter.hasFramework !== undefined && !!chunk.metadata.framework !== filter.hasFramework) continue;
      if (filter.isInterface !== undefined && !!chunk.metadata.isInterface !== filter.isInterface) continue;
      if (filter.isEnum !== undefined && !!chunk.metadata.isEnum !== filter.isEnum) continue;
      
      // Line count filters
      const lineCount = chunk.endLine - chunk.startLine + 1;
      if (filter.minLines !== undefined && lineCount < filter.minLines) continue;
      if (filter.maxLines !== undefined && lineCount > filter.maxLines) continue;
      
      // Dependencies filter
      if (filter.dependencies && filter.dependencies.length > 0) {
        const chunkDeps = chunk.metadata.dependencies || [];
        const hasAllDeps = filter.dependencies.every(dep => 
          chunkDeps.some(chunkDep => chunkDep.includes(dep))
        );
        if (!hasAllDeps) continue;
      }
      
      filteredIndices.add(index);
    }
    
    return filteredIndices;
  }
  
  private intersectSets(set1: Set<number> | null, set2: Set<number>): Set<number> {
    if (set1 === null) return set2;
    
    const intersection = new Set<number>();
    for (const item of set2) {
      if (set1.has(item)) {
        intersection.add(item);
      }
    }
    return intersection;
  }
  
  private calculateDenseVectorSimilarity(queryVector: number[], chunkVector: number[]): number {
    if (!queryVector || !chunkVector || queryVector.length !== chunkVector.length) {
      return 0;
    }
    
    // Cosine similarity
    let dotProduct = 0;
    let queryMagnitude = 0;
    let chunkMagnitude = 0;
    
    for (let i = 0; i < queryVector.length; i++) {
      dotProduct += queryVector[i] * chunkVector[i];
      queryMagnitude += queryVector[i] * queryVector[i];
      chunkMagnitude += chunkVector[i] * chunkVector[i];
    }
    
    queryMagnitude = Math.sqrt(queryMagnitude);
    chunkMagnitude = Math.sqrt(chunkMagnitude);
    
    if (queryMagnitude === 0 || chunkMagnitude === 0) {
      return 0;
    }
    
    return dotProduct / (queryMagnitude * chunkMagnitude);
  }
  
  private calculateSparseVectorSimilarity(querySparse: Record<string, number>, chunkSparse: Record<string, number>): number {
    if (!querySparse || !chunkSparse) return 0;
    
    let dotProduct = 0;
    let queryMagnitude = 0;
    let chunkMagnitude = 0;
    
    // Calculate dot product and magnitudes
    for (const [term, queryWeight] of Object.entries(querySparse)) {
      queryMagnitude += queryWeight * queryWeight;
      
      if (chunkSparse[term]) {
        dotProduct += queryWeight * chunkSparse[term];
      }
    }
    
    for (const [term, chunkWeight] of Object.entries(chunkSparse)) {
      chunkMagnitude += chunkWeight * chunkWeight;
    }
    
    queryMagnitude = Math.sqrt(queryMagnitude);
    chunkMagnitude = Math.sqrt(chunkMagnitude);
    
    if (queryMagnitude === 0 || chunkMagnitude === 0) {
      return 0;
    }
    
    return dotProduct / (queryMagnitude * chunkMagnitude);
  }
  
  private calculateMetadataRelevance(query: string, chunk: CodeChunk): number {
    const queryLower = query.toLowerCase();
    let relevance = 0;
    
    // Boost for class name matches
    if (chunk.metadata.className && chunk.metadata.className.toLowerCase().includes(queryLower)) {
      relevance += 0.5;
    }
    
    // Boost for function name matches
    if (chunk.metadata.functionName && chunk.metadata.functionName.toLowerCase().includes(queryLower)) {
      relevance += 0.5;
    }
    
    // Boost for file name matches
    const fileName = path.basename(chunk.filePath).toLowerCase();
    if (fileName.includes(queryLower)) {
      relevance += 0.3;
    }
    
    // Boost for framework matches
    if (chunk.metadata.framework && chunk.metadata.framework.toLowerCase().includes(queryLower)) {
      relevance += 0.2;
    }
    
    return Math.min(1.0, relevance);
  }
  
  private sortResults(results: SearchResult[], sortBy: string, sortOrder: string): SearchResult[] {
    return results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'relevance':
          comparison = a.score - b.score;
          break;
        case 'complexity':
          comparison = (a.chunk.metadata.complexity || 0) - (b.chunk.metadata.complexity || 0);
          break;
        case 'lines':
          const aLines = a.chunk.endLine - a.chunk.startLine + 1;
          const bLines = b.chunk.endLine - b.chunk.startLine + 1;
          comparison = aLines - bLines;
          break;
        case 'alphabetical':
          comparison = a.chunk.filePath.localeCompare(b.chunk.filePath);
          break;
        default:
          comparison = a.score - b.score;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }
}