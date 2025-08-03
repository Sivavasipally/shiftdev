import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { VectorDB } from './VectorDB';
import { GitIntegration } from './GitIntegration';

export interface FileHashEntry {
  filePath: string;
  contentHash: string;
  metadataHash: string;
  lastModified: Date;
  lastIndexed: Date;
  size: number;
  encoding: string;
  language?: string;
  framework?: string;
}

export interface IndexState {
  version: string;
  lastFullIndexTime: Date;
  totalFiles: number;
  indexedFiles: number;
  fileHashes: Map<string, FileHashEntry>;
  incrementalUpdates: IncrementalUpdate[];
  statistics: IndexStatistics;
}

export interface IncrementalUpdate {
  timestamp: Date;
  type: 'added' | 'modified' | 'deleted' | 'moved';
  filePath: string;
  oldPath?: string; // For moved files
  reason: string;
  processingTimeMs: number;
}

export interface IndexStatistics {
  totalIndexOperations: number;
  filesAdded: number;
  filesModified: number;
  filesDeleted: number;
  filesMoved: number;
  averageProcessingTime: number;
  lastUpdateDuration: number;
  errorCount: number;
  skippedFiles: number;
}

export interface ChangeDetectionResult {
  addedFiles: string[];
  modifiedFiles: string[];
  deletedFiles: string[];
  movedFiles: { oldPath: string; newPath: string }[];
  unchangedFiles: string[];
  totalChanges: number;
}

export interface IndexConfiguration {
  batchSize: number;
  maxFileSize: number; // in bytes
  supportedExtensions: string[];
  ignorePatterns: string[];
  enableGitIntegration: boolean;
  enableMetadataHashing: boolean;
  compressionLevel: number;
  parallelProcessing: boolean;
  maxParallelJobs: number;
}

export class IncrementalIndexer {
  private vectorDB: VectorDB;
  private gitIntegration: GitIntegration | null = null;
  private indexStatePath: string;
  private indexState: IndexState;
  private config: IndexConfiguration;

  constructor(
    vectorDB: VectorDB,
    projectPath: string,
    config: Partial<IndexConfiguration> = {}
  ) {
    this.vectorDB = vectorDB;
    this.indexStatePath = path.join(projectPath, '.devcanvas', 'index-state.json');
    
    // Initialize Git integration if available
    try {
      this.gitIntegration = new GitIntegration(projectPath);
    } catch {
      console.log('Git integration not available, using file system timestamps');
    }

    // Default configuration
    this.config = {
      batchSize: 100,
      maxFileSize: 1024 * 1024, // 1MB
      supportedExtensions: [
        '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
        '.py', '.java', '.go', '.rs', '.cs', '.php', '.rb',
        '.html', '.css', '.scss', '.less', '.json', '.yaml', '.yml',
        '.md', '.txt', '.sql', '.sh', '.bat'
      ],
      ignorePatterns: [
        'node_modules/**',
        '.git/**',
        'target/**',
        'build/**',
        'dist/**',
        '**/*.min.js',
        '**/*.min.css',
        '__pycache__/**',
        '*.pyc',
        '.DS_Store',
        'Thumbs.db'
      ],
      enableGitIntegration: true,
      enableMetadataHashing: true,
      compressionLevel: 6,
      parallelProcessing: true,
      maxParallelJobs: 4,
      ...config
    };

    this.indexState = this.loadIndexState();
  }

  async performIncrementalUpdate(projectPath: string): Promise<ChangeDetectionResult> {
    console.log('🔄 Starting incremental index update...');
    const startTime = Date.now();

    try {
      // 1. Detect changes
      const changes = await this.detectChanges(projectPath);
      
      if (changes.totalChanges === 0) {
        console.log('✅ No changes detected, index is up to date');
        return changes;
      }

      console.log(`📊 Detected ${changes.totalChanges} changes:`);
      console.log(`  - Added: ${changes.addedFiles.length}`);
      console.log(`  - Modified: ${changes.modifiedFiles.length}`);
      console.log(`  - Deleted: ${changes.deletedFiles.length}`);
      console.log(`  - Moved: ${changes.movedFiles.length}`);

      // 2. Process deletions first
      await this.processDeletedFiles(changes.deletedFiles);

      // 3. Process moved files
      await this.processMovedFiles(changes.movedFiles);

      // 4. Process additions and modifications
      await this.processAddedAndModifiedFiles(
        [...changes.addedFiles, ...changes.modifiedFiles],
        projectPath
      );

      // 5. Update index state
      this.updateIndexStatistics(changes, startTime);
      await this.saveIndexState();

      const duration = Date.now() - startTime;
      console.log(`✅ Incremental update completed in ${duration}ms`);

      return changes;
    } catch (error) {
      console.error('❌ Failed to perform incremental update:', error);
      this.indexState.statistics.errorCount++;
      throw error;
    }
  }

  async detectChanges(projectPath: string): Promise<ChangeDetectionResult> {
    const currentFiles = await this.scanProjectFiles(projectPath);
    const previousFiles = new Set(this.indexState.fileHashes.keys());
    
    const addedFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const deletedFiles: string[] = [];
    const movedFiles: { oldPath: string; newPath: string }[] = [];
    const unchangedFiles: string[] = [];

    // Check for added and modified files
    for (const filePath of currentFiles) {
      const relativePath = path.relative(projectPath, filePath);
      
      if (!previousFiles.has(relativePath)) {
        // Check if this might be a moved file
        const possibleMoves = await this.detectMovedFile(filePath, projectPath);
        if (possibleMoves.length > 0) {
          movedFiles.push({ oldPath: possibleMoves[0], newPath: relativePath });
        } else {
          addedFiles.push(relativePath);
        }
      } else {
        // Check if file has been modified
        const hasChanged = await this.hasFileChanged(filePath, relativePath);
        if (hasChanged) {
          modifiedFiles.push(relativePath);
        } else {
          unchangedFiles.push(relativePath);
        }
      }
    }

    // Check for deleted files
    const currentFilesSet = new Set(
      currentFiles.map(f => path.relative(projectPath, f))
    );
    
    for (const previousFile of previousFiles) {
      if (!currentFilesSet.has(previousFile)) {
        // Check if this file was moved (not in moved files already)
        const wasMoved = movedFiles.some(move => move.oldPath === previousFile);
        if (!wasMoved) {
          deletedFiles.push(previousFile);
        }
      }
    }

    return {
      addedFiles,
      modifiedFiles,
      deletedFiles,
      movedFiles,
      unchangedFiles,
      totalChanges: addedFiles.length + modifiedFiles.length + deletedFiles.length + movedFiles.length
    };
  }

  private async hasFileChanged(filePath: string, relativePath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(filePath);
      const previousEntry = this.indexState.fileHashes.get(relativePath);
      
      if (!previousEntry) return true;

      // Quick check: file size or modification time
      if (stats.size !== previousEntry.size || 
          stats.mtime > previousEntry.lastModified) {
        
        // Detailed check: content hash
        const currentContentHash = await this.calculateContentHash(filePath);
        if (currentContentHash !== previousEntry.contentHash) {
          return true;
        }

        // Metadata hash check if enabled
        if (this.config.enableMetadataHashing) {
          const currentMetadataHash = await this.calculateMetadataHash(filePath);
          if (currentMetadataHash !== previousEntry.metadataHash) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.warn(`Failed to check if file changed: ${filePath}`, error);
      return true; // Assume changed to be safe
    }
  }

  private async detectMovedFile(
    newFilePath: string, 
    projectPath: string
  ): Promise<string[]> {
    const newContentHash = await this.calculateContentHash(newFilePath);
    const possibleMoves: string[] = [];

    // Look for files with the same content hash that are marked as "deleted"
    for (const [oldPath, hashEntry] of this.indexState.fileHashes) {
      if (hashEntry.contentHash === newContentHash) {
        const oldFullPath = path.join(projectPath, oldPath);
        const exists = await this.fileExists(oldFullPath);
        
        if (!exists) {
          possibleMoves.push(oldPath);
        }
      }
    }

    return possibleMoves;
  }

  private async processDeletedFiles(deletedFiles: string[]): Promise<void> {
    if (deletedFiles.length === 0) return;

    console.log(`🗑️  Processing ${deletedFiles.length} deleted files...`);

    for (const filePath of deletedFiles) {
      const startTime = Date.now();
      
      try {
        // Remove from vector database
        await this.vectorDB.deleteByFilePath(filePath);
        
        // Remove from index state
        this.indexState.fileHashes.delete(filePath);
        
        // Record the update
        this.recordIncrementalUpdate({
          timestamp: new Date(),
          type: 'deleted',
          filePath,
          reason: 'File deleted from filesystem',
          processingTimeMs: Date.now() - startTime
        });

        this.indexState.statistics.filesDeleted++;
      } catch (error) {
        console.error(`Failed to process deleted file ${filePath}:`, error);
        this.indexState.statistics.errorCount++;
      }
    }
  }

  private async processMovedFiles(
    movedFiles: { oldPath: string; newPath: string }[]
  ): Promise<void> {
    if (movedFiles.length === 0) return;

    console.log(`📁 Processing ${movedFiles.length} moved files...`);

    for (const { oldPath, newPath } of movedFiles) {
      const startTime = Date.now();
      
      try {
        // Update vector database entries
        await this.vectorDB.updateFilePath(oldPath, newPath);
        
        // Update index state
        const oldEntry = this.indexState.fileHashes.get(oldPath);
        if (oldEntry) {
          this.indexState.fileHashes.delete(oldPath);
          this.indexState.fileHashes.set(newPath, {
            ...oldEntry,
            filePath: newPath,
            lastIndexed: new Date()
          });
        }

        // Record the update
        this.recordIncrementalUpdate({
          timestamp: new Date(),
          type: 'moved',
          filePath: newPath,
          oldPath,
          reason: 'File moved in filesystem',
          processingTimeMs: Date.now() - startTime
        });

        this.indexState.statistics.filesMoved++;
      } catch (error) {
        console.error(`Failed to process moved file ${oldPath} -> ${newPath}:`, error);
        this.indexState.statistics.errorCount++;
      }
    }
  }

  private async processAddedAndModifiedFiles(
    files: string[], 
    projectPath: string
  ): Promise<void> {
    if (files.length === 0) return;

    console.log(`📝 Processing ${files.length} added/modified files...`);

    // Process in batches for better performance
    const batches = this.createBatches(files, this.config.batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`Processing batch ${i + 1}/${batches.length} (${batch.length} files)`);

      if (this.config.parallelProcessing) {
        await this.processBatchParallel(batch, projectPath);
      } else {
        await this.processBatchSequential(batch, projectPath);
      }
    }
  }

  private async processBatchParallel(batch: string[], projectPath: string): Promise<void> {
    const semaphore = new Array(this.config.maxParallelJobs).fill(null);
    const promises: Promise<void>[] = [];

    for (const relativePath of batch) {
      const promise = this.processFile(relativePath, projectPath);
      promises.push(promise);

      // Limit concurrent operations
      if (promises.length >= this.config.maxParallelJobs) {
        await Promise.all(promises);
        promises.length = 0;
      }
    }

    // Process remaining files
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  private async processBatchSequential(batch: string[], projectPath: string): Promise<void> {
    for (const relativePath of batch) {
      await this.processFile(relativePath, projectPath);
    }
  }

  private async processFile(relativePath: string, projectPath: string): Promise<void> {
    const startTime = Date.now();
    const fullPath = path.join(projectPath, relativePath);
    
    try {
      // Check if file should be processed
      if (!await this.shouldProcessFile(fullPath)) {
        this.indexState.statistics.skippedFiles++;
        return;
      }

      const isNewFile = !this.indexState.fileHashes.has(relativePath);
      
      // Calculate hashes
      const contentHash = await this.calculateContentHash(fullPath);
      const metadataHash = this.config.enableMetadataHashing 
        ? await this.calculateMetadataHash(fullPath)
        : '';

      // Get file stats
      const stats = await fs.promises.stat(fullPath);
      
      // Detect language and framework (this would integrate with existing detection logic)
      const language = this.detectLanguage(fullPath);
      const framework = await this.detectFramework(fullPath);

      // Read and process file content
      const content = await fs.promises.readFile(fullPath, 'utf8');
      
      // Update vector database (this would integrate with existing indexing logic)
      if (isNewFile) {
        await this.vectorDB.addDocument({
          id: this.generateDocumentId(relativePath),
          content,
          metadata: {
            filePath: relativePath,
            language,
            framework,
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            contentHash
          }
        });
      } else {
        await this.vectorDB.updateDocument({
          id: this.generateDocumentId(relativePath),
          content,
          metadata: {
            filePath: relativePath,
            language,
            framework,
            size: stats.size,
            lastModified: stats.mtime.toISOString(),
            contentHash
          }
        });
      }

      // Update index state
      this.indexState.fileHashes.set(relativePath, {
        filePath: relativePath,
        contentHash,
        metadataHash,
        lastModified: stats.mtime,
        lastIndexed: new Date(),
        size: stats.size,
        encoding: 'utf8',
        language,
        framework
      });

      // Record the update
      this.recordIncrementalUpdate({
        timestamp: new Date(),
        type: isNewFile ? 'added' : 'modified',
        filePath: relativePath,
        reason: isNewFile ? 'New file detected' : 'File content changed',
        processingTimeMs: Date.now() - startTime
      });

      if (isNewFile) {
        this.indexState.statistics.filesAdded++;
      } else {
        this.indexState.statistics.filesModified++;
      }

    } catch (error) {
      console.error(`Failed to process file ${relativePath}:`, error);
      this.indexState.statistics.errorCount++;
    }
  }

  private async shouldProcessFile(filePath: string): Promise<boolean> {
    try {
      // Check file size
      const stats = await fs.promises.stat(filePath);
      if (stats.size > this.config.maxFileSize) {
        return false;
      }

      // Check extension
      const ext = path.extname(filePath);
      if (!this.config.supportedExtensions.includes(ext)) {
        return false;
      }

      // Check ignore patterns
      for (const pattern of this.config.ignorePatterns) {
        if (this.matchesPattern(filePath, pattern)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  private async calculateContentHash(filePath: string): Promise<string> {
    try {
      const content = await fs.promises.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      console.warn(`Failed to calculate content hash for ${filePath}:`, error);
      return '';
    }
  }

  private async calculateMetadataHash(filePath: string): Promise<string> {
    try {
      const stats = await fs.promises.stat(filePath);
      const metadata = {
        size: stats.size,
        mode: stats.mode,
        mtime: stats.mtime.getTime()
      };
      
      const metadataString = JSON.stringify(metadata);
      return crypto.createHash('md5').update(metadataString).digest('hex');
    } catch (error) {
      console.warn(`Failed to calculate metadata hash for ${filePath}:`, error);
      return '';
    }
  }

  private async scanProjectFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const walk = async (dirPath: string) => {
      try {
        const entries = await fs.promises.readdir(dirPath);
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry);
          
          // Skip ignored patterns
          const relativePath = path.relative(projectPath, fullPath);
          if (this.shouldIgnore(relativePath)) {
            continue;
          }

          const stats = await fs.promises.stat(fullPath);
          
          if (stats.isDirectory()) {
            await walk(fullPath);
          } else if (stats.isFile()) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    };

    await walk(projectPath);
    return files;
  }

  private shouldIgnore(relativePath: string): boolean {
    for (const pattern of this.config.ignorePatterns) {
      if (this.matchesPattern(relativePath, pattern)) {
        return true;
      }
    }
    return false;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Simple pattern matching - could be enhanced with a proper glob library
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath);
    const languageMap: { [ext: string]: string } = {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.jsx': 'javascript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.vue': 'vue',
      '.svelte': 'svelte'
    };
    
    return languageMap[ext] || 'unknown';
  }

  private async detectFramework(filePath: string): Promise<string | undefined> {
    // This would integrate with the framework detection logic
    // For now, return undefined
    return undefined;
  }

  private generateDocumentId(filePath: string): string {
    return crypto.createHash('md5').update(filePath).digest('hex');
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  private recordIncrementalUpdate(update: IncrementalUpdate): void {
    this.indexState.incrementalUpdates.push(update);
    
    // Keep only recent updates (last 1000)
    if (this.indexState.incrementalUpdates.length > 1000) {
      this.indexState.incrementalUpdates = this.indexState.incrementalUpdates.slice(-1000);
    }
  }

  private updateIndexStatistics(changes: ChangeDetectionResult, startTime: number): void {
    const stats = this.indexState.statistics;
    stats.totalIndexOperations++;
    stats.lastUpdateDuration = Date.now() - startTime;
    
    // Update average processing time
    const totalTime = stats.averageProcessingTime * (stats.totalIndexOperations - 1) + stats.lastUpdateDuration;
    stats.averageProcessingTime = totalTime / stats.totalIndexOperations;
    
    // Update file counts
    this.indexState.indexedFiles = this.indexState.fileHashes.size;
  }

  private loadIndexState(): IndexState {
    try {
      if (fs.existsSync(this.indexStatePath)) {
        const content = fs.readFileSync(this.indexStatePath, 'utf8');
        const data = JSON.parse(content);
        
        // Convert Map back from JSON
        const fileHashes = new Map<string, FileHashEntry>();
        if (data.fileHashes) {
          for (const [key, value] of Object.entries(data.fileHashes)) {
            fileHashes.set(key, {
              ...value as FileHashEntry,
              lastModified: new Date((value as any).lastModified),
              lastIndexed: new Date((value as any).lastIndexed)
            });
          }
        }

        return {
          ...data,
          lastFullIndexTime: new Date(data.lastFullIndexTime),
          fileHashes,
          incrementalUpdates: data.incrementalUpdates.map((update: any) => ({
            ...update,
            timestamp: new Date(update.timestamp)
          }))
        };
      }
    } catch (error) {
      console.warn('Failed to load index state, creating new one:', error);
    }

    // Return default state
    return {
      version: '1.0.0',
      lastFullIndexTime: new Date(0),
      totalFiles: 0,
      indexedFiles: 0,
      fileHashes: new Map(),
      incrementalUpdates: [],
      statistics: {
        totalIndexOperations: 0,
        filesAdded: 0,
        filesModified: 0,
        filesDeleted: 0,
        filesMoved: 0,
        averageProcessingTime: 0,
        lastUpdateDuration: 0,
        errorCount: 0,
        skippedFiles: 0
      }
    };
  }

  private async saveIndexState(): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.indexStatePath);
      await fs.promises.mkdir(dir, { recursive: true });

      // Convert Map to JSON-serializable format
      const fileHashesObj: { [key: string]: FileHashEntry } = {};
      for (const [key, value] of this.indexState.fileHashes) {
        fileHashesObj[key] = value;
      }

      const data = {
        ...this.indexState,
        fileHashes: fileHashesObj
      };

      await fs.promises.writeFile(
        this.indexStatePath, 
        JSON.stringify(data, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to save index state:', error);
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Public API methods
  async getIndexStatistics(): Promise<IndexStatistics> {
    return { ...this.indexState.statistics };
  }

  async getFileHashEntry(filePath: string): Promise<FileHashEntry | null> {
    return this.indexState.fileHashes.get(filePath) || null;
  }

  async getRecentUpdates(limit: number = 50): Promise<IncrementalUpdate[]> {
    return this.indexState.incrementalUpdates
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async forceFull Reindex(): Promise<void> {
    console.log('🔄 Forcing full reindex...');
    
    // Clear existing state
    this.indexState.fileHashes.clear();
    this.indexState.incrementalUpdates = [];
    this.indexState.lastFullIndexTime = new Date();
    
    // Clear vector database
    await this.vectorDB.clear();
    
    await this.saveIndexState();
    console.log('✅ Full reindex completed');
  }
}