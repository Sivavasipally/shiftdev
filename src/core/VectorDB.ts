import { connect } from '@lancedb/lancedb';
import { CodeChunk } from '../types';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class VectorDB {
  private db: any;
  private table: any = null;
  private readonly dbPath: string;
  private chunks: CodeChunk[] = []; // In-memory storage as fallback

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

      // For now, use simple file-based storage
      this.loadFromFile();
    } catch (error) {
      console.error('Failed to initialize VectorDB:', error);
      // Continue with in-memory storage
    }
  }

  async addChunks(chunks: CodeChunk[]): Promise<void> {
    try {
      console.log(`VectorDB: Adding ${chunks.length} chunks. Current total: ${this.chunks.length}`);
      this.chunks = [...this.chunks, ...chunks];
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
    limit: number = 10
  ): Promise<CodeChunk[]> {
    try {
      console.log(`VectorDB: Searching through ${this.chunks.length} chunks for: "${query}"`);
      
      // Simple search implementation with broader matching
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
      
      const results = this.chunks.filter(chunk => {
        const contentLower = chunk.content.toLowerCase();
        const filePathLower = chunk.filePath.toLowerCase();
        
        // Exact query match
        if (contentLower.includes(queryLower) || filePathLower.includes(queryLower)) {
          return true;
        }
        
        // Metadata matches
        if (chunk.metadata.className?.toLowerCase().includes(queryLower) ||
            chunk.metadata.functionName?.toLowerCase().includes(queryLower)) {
          return true;
        }
        
        // Word-based matching (at least 50% of words should match)
        if (queryWords.length > 0) {
          const matchingWords = queryWords.filter(word => 
            contentLower.includes(word) || 
            filePathLower.includes(word) ||
            chunk.metadata.className?.toLowerCase().includes(word) ||
            chunk.metadata.functionName?.toLowerCase().includes(word)
          );
          
          if (matchingWords.length / queryWords.length >= 0.3) { // 30% match threshold
            return true;
          }
        }
        
        // If no specific matches but this is a general query, include some chunks
        if (queryWords.some(word => ['project', 'main', 'purpose', 'functionality', 'what', 'install', 'setup', 'entry', 'structure'].includes(word))) {
          return true;
        }
        
        return false;
      });
      
      console.log(`VectorDB: Found ${results.length} matching chunks`);

      // Sort by relevance (simple scoring)
      const scored = results.map(chunk => {
        let score = 0;
        const queryLower = query.toLowerCase();
        const contentLower = chunk.content.toLowerCase();
        
        // Basic scoring
        if (contentLower.includes(queryLower)) score += 10;
        if (chunk.metadata.className?.toLowerCase().includes(queryLower)) score += 5;
        if (chunk.metadata.functionName?.toLowerCase().includes(queryLower)) score += 5;
        if (chunk.filePath.toLowerCase().includes(queryLower)) score += 3;
        
        // Add sparse vector scoring
        for (const [term, weight] of Object.entries(sparseVector)) {
          if (contentLower.includes(term.toLowerCase())) {
            score += weight;
          }
        }
        
        return { chunk, score };
      });

      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.chunk);
    } catch (error) {
      console.error('Search failed:', error);
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

  async getChunkCount(): Promise<number> {
    return this.chunks.length;
  }

  async clearAll(): Promise<void> {
    this.chunks = [];
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
        this.chunks = JSON.parse(data);
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
      
      fs.writeFileSync(filePath, JSON.stringify(this.chunks, null, 2));
    } catch (error) {
      console.warn('Failed to save chunks to file:', error);
    }
  }
}