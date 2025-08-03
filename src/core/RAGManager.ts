import { VectorDB } from './VectorDB';
import { CodeParser } from './CodeParser';
import { LLMProvider } from '../chat/LLMProvider';
import { CodeChunk, UserProfile } from '../types';
import { Configuration } from '../utils/configuration';
import { BM25 } from '../utils/bm25';
import * as vscode from 'vscode';

export class RAGManager {
  private vectorDB: VectorDB;
  private codeParser: CodeParser;
  private llmProvider: LLMProvider;
  private bm25: BM25;
  private documentCorpus: string[] = [];

  constructor(
    workspaceUri: vscode.Uri,
    private userProfile: UserProfile
  ) {
    this.vectorDB = new VectorDB(workspaceUri);
    this.codeParser = new CodeParser();
    this.llmProvider = new LLMProvider(userProfile);
    this.bm25 = new BM25();
  }

  updateUserProfile(profile: UserProfile): void {
    this.userProfile = profile;
    this.llmProvider = new LLMProvider(profile);
  }

  async initialize(): Promise<void> {
    await this.vectorDB.initialize();
  }

  async indexCodebase(rootPath: string): Promise<void> {
    // Check if user has API keys configured
    if (!this.userProfile.selectedLLM || !this.userProfile.apiKeys || Object.keys(this.userProfile.apiKeys).length === 0) {
      throw new Error('Please configure your API keys using the "Configure API Keys" command before indexing.');
    }

    return vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "DevCanvas AI: Indexing codebase",
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ increment: 0, message: "Discovering files..." });
        
        // Parse repository into chunks
        const chunks = await this.codeParser.parseRepository(rootPath);
        progress.report({ increment: 20, message: `Found ${chunks.length} code chunks` });

        if (chunks.length === 0) {
          vscode.window.showWarningMessage('No supported files found in workspace');
          return;
        }

        // Build BM25 corpus from chunks
        progress.report({ increment: 25, message: "Building BM25 index..." });
        this.documentCorpus = chunks.map(chunk => chunk.content);
        this.bm25.addDocuments(this.documentCorpus);
        
        // Generate embeddings in batches
        progress.report({ increment: 30, message: "Generating embeddings..." });
        const enrichedChunks = await this.generateEmbeddingsWithProgress(chunks, progress);
        
        progress.report({ increment: 80, message: "Storing in vector database..." });
        
        // Clear existing data and store new chunks
        await this.vectorDB.clearAll();
        await this.vectorDB.addChunks(enrichedChunks);
        
        progress.report({ increment: 100, message: "Indexing complete!" });
        
        vscode.window.showInformationMessage(
          `Successfully indexed ${enrichedChunks.length} code chunks`
        );
      } catch (error) {
        console.error('Indexing failed:', error);
        vscode.window.showErrorMessage(`Indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    });
  }

  async query(userQuery: string, maxChunks?: number): Promise<{
    response: string;
    retrievedChunks: CodeChunk[];
    usage?: { inputTokens: number; outputTokens: number };
  }> {
    try {
      const limit = maxChunks || Configuration.getMaxChunks();
      
      // Enhance query
      const enhancedQuery = await this.enhanceQuery(userQuery);
      
      // Generate query embeddings
      const queryEmbedding = await this.llmProvider.generateEmbedding(enhancedQuery.dense);
      const sparseVector = this.bm25.generateSparseVector(enhancedQuery.sparse);

      // Retrieve relevant chunks
      const retrievedChunks = await this.vectorDB.hybridSearch(
        enhancedQuery.dense,
        queryEmbedding,
        sparseVector,
        limit
      );

      // Build context
      const context = this.buildContext(retrievedChunks);

      // Generate response
      const response = await this.generateResponse(userQuery, context);

      return {
        response: response.content,
        retrievedChunks,
        usage: response.usage
      };
    } catch (error) {
      console.error('Query failed:', error);
      throw new Error(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getAllJavaChunks(): Promise<CodeChunk[]> {
    try {
      // Get all class chunks
      const classChunks = await this.vectorDB.searchByChunkType('class', 1000);
      
      // Get all function chunks  
      const functionChunks = await this.vectorDB.searchByChunkType('function', 1000);
      
      // Get all file chunks for Java files
      const fileChunks = await this.vectorDB.searchByChunkType('file', 1000);
      const javaFileChunks = fileChunks.filter(chunk => 
        chunk.filePath.endsWith('.java') || 
        chunk.metadata.language === 'java'
      );
      
      // Combine all chunks and remove duplicates
      const allChunks = [...classChunks, ...functionChunks, ...javaFileChunks];
      const uniqueChunks = allChunks.filter((chunk, index, self) => 
        index === self.findIndex(c => c.id === chunk.id)
      );
      
      console.log(`Found ${uniqueChunks.length} Java-related chunks:`, {
        classes: classChunks.length,
        functions: functionChunks.length,
        javaFiles: javaFileChunks.length
      });
      
      return uniqueChunks;
    } catch (error) {
      console.error('Failed to get Java chunks:', error);
      return [];
    }
  }

  async getFrameworkChunks(framework: string): Promise<CodeChunk[]> {
    try {
      // Get all chunks for a specific framework
      const allChunks = await this.vectorDB.searchByChunkType('file', 1000);
      const classChunks = await this.vectorDB.searchByChunkType('class', 1000);
      const functionChunks = await this.vectorDB.searchByChunkType('function', 1000);
      
      const combinedChunks = [...allChunks, ...classChunks, ...functionChunks];
      
      const frameworkChunks = combinedChunks.filter(chunk => 
        chunk.metadata.framework === framework.toLowerCase() ||
        chunk.metadata.isFrameworkSummary
      );
      
      // Remove duplicates
      const uniqueChunks = frameworkChunks.filter((chunk, index, self) => 
        index === self.findIndex(c => c.id === chunk.id)
      );
      
      console.log(`Found ${uniqueChunks.length} ${framework} framework chunks`);
      
      return uniqueChunks;
    } catch (error) {
      console.error(`Failed to get ${framework} chunks:`, error);
      return [];
    }
  }

  async getDetectedFrameworks(): Promise<any[]> {
    try {
      const allChunks = await this.vectorDB.searchByChunkType('file', 1000);
      const frameworkChunks = allChunks.filter(chunk => chunk.metadata.isFrameworkSummary);
      
      return frameworkChunks.map(chunk => ({
        name: chunk.metadata.framework,
        version: chunk.metadata.frameworkVersion,
        type: chunk.metadata.frameworkType,
        language: chunk.metadata.language
      }));
    } catch (error) {
      console.error('Failed to get detected frameworks:', error);
      return [];
    }
  }

  async getCodebaseStats(): Promise<{
    totalChunks: number;
    fileCount: number;
    classCount: number;
    functionCount: number;
    bm25VocabularySize?: number;
    bm25DocumentCount?: number;
  }> {
    try {
      const totalChunks = await this.vectorDB.getChunkCount();
      const fileChunks = await this.vectorDB.searchByChunkType('file', 1000);
      const classChunks = await this.vectorDB.searchByChunkType('class', 1000);
      const functionChunks = await this.vectorDB.searchByChunkType('function', 1000);

      return {
        totalChunks,
        fileCount: fileChunks.length,
        classCount: classChunks.length,
        functionCount: functionChunks.length,
        bm25VocabularySize: this.bm25.getVocabularySize(),
        bm25DocumentCount: this.bm25.getDocumentCount()
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return { totalChunks: 0, fileCount: 0, classCount: 0, functionCount: 0 };
    }
  }

  async searchByFile(filePath: string): Promise<CodeChunk[]> {
    return this.vectorDB.searchByFilePath(filePath);
  }

  private async generateEmbeddingsWithProgress(
    chunks: CodeChunk[], 
    progress: vscode.Progress<{ increment?: number; message?: string }>
  ): Promise<CodeChunk[]> {
    const batchSize = 10;
    const enrichedChunks: CodeChunk[] = [];
    const totalBatches = Math.ceil(chunks.length / batchSize);

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      progress.report({ 
        increment: 40 / totalBatches,
        message: `Processing batch ${batchNumber}/${totalBatches}...` 
      });

      const embeddingPromises = batch.map(async (chunk) => {
        try {
          const embedding = await this.llmProvider.generateEmbedding(chunk.content);
          const sparseVector = this.bm25.generateSparseVector(chunk.content);
          
          return {
            ...chunk,
            denseVector: embedding,
            sparseVector
          };
        } catch (error) {
          console.warn(`Failed to generate embedding for chunk ${chunk.id}:`, error);
          return {
            ...chunk,
            denseVector: new Array(768).fill(0), // Fallback
            sparseVector: {}
          };
        }
      });

      const batchResults = await Promise.all(embeddingPromises);
      enrichedChunks.push(...batchResults);

      // Small delay to respect API rate limits
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return enrichedChunks;
  }

  private async enhanceQuery(query: string): Promise<{dense: string; sparse: string}> {
    try {
      const enhancePrompt = `
Enhance this user query for better code search:
Query: "${query}"

Generate:
1. A dense query (semantic meaning, rephrased for better embedding)
2. A sparse query (key programming terms, class names, function names)

Format:
DENSE: [enhanced semantic query]
SPARSE: [key terms separated by spaces]
`;

      const response = await this.llmProvider.generateResponse([
        { role: 'system', content: 'You are a code search expert. Be concise and focused.' },
        { role: 'user', content: enhancePrompt }
      ]);

      const lines = response.content.split('\n');
      const denseLine = lines.find(l => l.startsWith('DENSE:'));
      const sparseLine = lines.find(l => l.startsWith('SPARSE:'));

      return {
        dense: denseLine?.replace('DENSE:', '').trim() || query,
        sparse: sparseLine?.replace('SPARSE:', '').trim() || query
      };
    } catch (error) {
      console.warn('Query enhancement failed, using original query:', error);
      return { dense: query, sparse: query };
    }
  }


  private buildContext(chunks: CodeChunk[]): string {
    let context = "# Relevant Code Context\n\n";
    
    chunks.forEach((chunk, index) => {
      context += `## Context ${index + 1}\n`;
      context += `**File:** \`${chunk.filePath}\` (Lines ${chunk.startLine}-${chunk.endLine})\n`;
      
      if (chunk.metadata.className) {
        context += `**Class:** ${chunk.metadata.className}\n`;
      }
      if (chunk.metadata.functionName) {
        context += `**Function:** ${chunk.metadata.functionName}\n`;
      }
      
      context += `**Type:** ${chunk.chunkType}\n`;
      context += `**Language:** ${chunk.metadata.language}\n`;
      
      if (chunk.metadata.complexity) {
        context += `**Complexity:** ${chunk.metadata.complexity}\n`;
      }
      
      context += "\n```" + chunk.metadata.language + "\n";
      context += chunk.content;
      context += "\n```\n\n---\n\n";
    });

    return context;
  }

  private async generateResponse(query: string, context: string): Promise<{content: string; usage?: any}> {
    const systemPrompt = `You are DevCanvas AI, an expert programming assistant with deep understanding of codebases.

Use the provided code context to answer the user's question accurately and helpfully.

Guidelines:
- Reference specific files, functions, and line numbers when relevant using the format: \`filename:line_number\`
- Provide code examples when helpful
- If the context doesn't contain enough information, say so clearly
- Focus on being practical and actionable
- Use markdown formatting for better readability
- When discussing code structure, explain the relationships between components`;

    return this.llmProvider.generateResponse([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}` }
    ]);
  }

  async clearIndex(): Promise<void> {
    await this.vectorDB.clearAll();
    this.documentCorpus = [];
    this.bm25 = new BM25(); // Reset BM25 index
    vscode.window.showInformationMessage('Index cleared successfully');
  }

  async close(): Promise<void> {
    await this.vectorDB.close();
  }
}