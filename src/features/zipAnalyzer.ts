import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { promisify } from 'util';
import { RAGManager } from '../core/RAGManager';

const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const rmdir = promisify(fs.rmdir);

export interface ZipAnalysisResult {
  success: boolean;
  extractedPath?: string;
  summary?: ZipSummary;
  error?: string;
}

export interface ZipSummary {
  totalFiles: number;
  codeFiles: number;
  supportedFiles: string[];
  languages: string[];
  structure: ZipStructure;
  size: number;
}

export interface ZipStructure {
  directories: string[];
  files: { [key: string]: number }; // file extension -> count
}

export class ZipAnalyzer {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('DevCanvas AI - ZIP Analyzer');
  }

  /**
   * Show ZIP file upload and analysis interface
   */
  async showZipUploadInterface(): Promise<void> {
    const zipFiles = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'ZIP Archives': ['zip'],
        'All Files': ['*']
      },
      openLabel: 'Select ZIP File to Analyze',
      title: 'Upload ZIP File for Analysis'
    });

    if (!zipFiles || zipFiles.length === 0) {
      return;
    }

    const zipFile = zipFiles[0];
    
    // Show analysis options
    const analysisType = await vscode.window.showQuickPick([
      {
        label: '🔍 Quick Analysis',
        description: 'Basic structure and file count analysis',
        detail: 'Fast overview without extracting files',
        value: 'quick'
      },
      {
        label: '📊 Full Analysis',
        description: 'Extract and analyze code content',
        detail: 'Extract files and perform deep code analysis with indexing',
        value: 'full'
      },
      {
        label: '📁 Extract Only',
        description: 'Extract files to a local directory',
        detail: 'Just extract the ZIP contents without analysis',
        value: 'extract'
      }
    ], {
      placeHolder: 'Choose analysis type',
      ignoreFocusOut: true
    });

    if (!analysisType) {
      return;
    }

    // Perform analysis with progress
    const result = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Analyzing ZIP file',
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0, message: 'Starting analysis...' });
      
      try {
        switch (analysisType.value) {
          case 'quick':
            return await this.performQuickAnalysis(zipFile, progress);
          case 'full':
            return await this.performFullAnalysis(zipFile, progress);
          case 'extract':
            return await this.extractOnly(zipFile, progress);
          default:
            throw new Error('Invalid analysis type');
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Show results
    await this.showAnalysisResults(result, analysisType.value);
  }

  /**
   * Perform quick analysis without extraction
   */
  private async performQuickAnalysis(
    zipFile: vscode.Uri, 
    progress: vscode.Progress<{ increment?: number; message?: string }>
  ): Promise<ZipAnalysisResult> {
    progress.report({ increment: 20, message: 'Reading ZIP structure...' });

    try {
      // Use Node.js built-in capabilities or a simple ZIP reader
      const AdmZip = await this.loadAdmZip();
      const zip = new AdmZip(zipFile.fsPath);
      const entries = zip.getEntries();

      progress.report({ increment: 50, message: 'Analyzing file structure...' });

      const summary = this.analyzeZipStructure(entries);
      
      progress.report({ increment: 100, message: 'Analysis complete!' });

      return {
        success: true,
        summary
      };
    } catch (error) {
      throw new Error(`Quick analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform full analysis with extraction and code indexing
   */
  private async performFullAnalysis(
    zipFile: vscode.Uri,
    progress: vscode.Progress<{ increment?: number; message?: string }>
  ): Promise<ZipAnalysisResult> {
    progress.report({ increment: 10, message: 'Extracting ZIP file...' });

    const tempDir = await this.createTempDirectory();
    
    try {
      const AdmZip = await this.loadAdmZip();
      const zip = new AdmZip(zipFile.fsPath);
      
      progress.report({ increment: 30, message: 'Extracting files...' });
      zip.extractAllTo(tempDir, true);

      progress.report({ increment: 50, message: 'Analyzing extracted content...' });
      
      // Analyze the extracted files
      const summary = await this.analyzeExtractedFiles(tempDir);
      
      progress.report({ increment: 80, message: 'Creating analysis report...' });

      // Offer to index the extracted code
      const shouldIndex = await this.askToIndexExtractedCode();
      
      if (shouldIndex) {
        progress.report({ increment: 90, message: 'Indexing code...' });
        await this.indexExtractedCode(tempDir);
      }

      progress.report({ increment: 100, message: 'Analysis complete!' });

      return {
        success: true,
        extractedPath: tempDir,
        summary
      };
    } catch (error) {
      // Clean up temp directory on error
      try {
        await this.cleanupTempDirectory(tempDir);
      } catch (cleanupError) {
        console.warn('Failed to cleanup temp directory:', cleanupError);
      }
      
      throw new Error(`Full analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract ZIP file only
   */
  private async extractOnly(
    zipFile: vscode.Uri,
    progress: vscode.Progress<{ increment?: number; message?: string }>
  ): Promise<ZipAnalysisResult> {
    progress.report({ increment: 20, message: 'Selecting extraction location...' });

    const extractLocation = await this.selectExtractionLocation(path.parse(zipFile.fsPath).name);
    if (!extractLocation) {
      return { success: false, error: 'No extraction location selected' };
    }

    progress.report({ increment: 40, message: 'Extracting files...' });

    try {
      const AdmZip = await this.loadAdmZip();
      const zip = new AdmZip(zipFile.fsPath);
      
      zip.extractAllTo(extractLocation, true);
      
      progress.report({ increment: 80, message: 'Creating summary...' });
      
      const summary = await this.analyzeExtractedFiles(extractLocation);
      
      progress.report({ increment: 100, message: 'Extraction complete!' });

      return {
        success: true,
        extractedPath: extractLocation,
        summary
      };
    } catch (error) {
      throw new Error(`Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze ZIP structure from entries
   */
  private analyzeZipStructure(entries: any[]): ZipSummary {
    const directories: string[] = [];
    const files: { [key: string]: number } = {};
    const languages = new Set<string>();
    const supportedFiles: string[] = [];
    let totalSize = 0;

    entries.forEach(entry => {
      if (entry.isDirectory) {
        directories.push(entry.entryName);
      } else {
        const ext = path.extname(entry.entryName).toLowerCase();
        files[ext] = (files[ext] || 0) + 1;
        totalSize += entry.header.size;

        // Determine language from extension
        const language = this.getLanguageFromExtension(ext);
        if (language) {
          languages.add(language);
          supportedFiles.push(entry.entryName);
        }
      }
    });

    return {
      totalFiles: entries.filter(e => !e.isDirectory).length,
      codeFiles: supportedFiles.length,
      supportedFiles,
      languages: Array.from(languages),
      structure: { directories, files },
      size: totalSize
    };
  }

  /**
   * Analyze extracted files on disk
   */
  private async analyzeExtractedFiles(extractedPath: string): Promise<ZipSummary> {
    const files: { [key: string]: number } = {};
    const languages = new Set<string>();
    const supportedFiles: string[] = [];
    const directories: string[] = [];
    let totalFiles = 0;
    let totalSize = 0;

    const analyzeDirectory = async (dirPath: string) => {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          directories.push(path.relative(extractedPath, itemPath));
          await analyzeDirectory(itemPath);
        } else {
          totalFiles++;
          totalSize += stat.size;
          
          const ext = path.extname(item).toLowerCase();
          files[ext] = (files[ext] || 0) + 1;

          const language = this.getLanguageFromExtension(ext);
          if (language) {
            languages.add(language);
            supportedFiles.push(path.relative(extractedPath, itemPath));
          }
        }
      }
    };

    await analyzeDirectory(extractedPath);

    return {
      totalFiles,
      codeFiles: supportedFiles.length,
      supportedFiles,
      languages: Array.from(languages),
      structure: { directories, files },
      size: totalSize
    };
  }

  /**
   * Get programming language from file extension
   */
  private getLanguageFromExtension(ext: string): string | null {
    const langMap: { [key: string]: string } = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.jsx': 'React',
      '.tsx': 'React TypeScript',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.go': 'Go',
      '.rs': 'Rust',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.less': 'LESS',
      '.vue': 'Vue',
      '.sql': 'SQL',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.xml': 'XML',
      '.md': 'Markdown',
      '.sh': 'Shell',
      '.bat': 'Batch',
      '.ps1': 'PowerShell'
    };

    return langMap[ext] || null;
  }

  /**
   * Load AdmZip dynamically (assuming it's installed)
   */
  private async loadAdmZip(): Promise<any> {
    try {
      // Try to use the system's unzip command if available
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // Check if unzip is available
      try {
        await execAsync('unzip -v');
        return {
          getEntries: () => { throw new Error('Use system unzip'); },
          extractAllTo: async (targetPath: string) => {
            // Implementation would use system unzip
            throw new Error('System unzip extraction not implemented yet');
          }
        };
      } catch {
        // Fall back to basic implementation
        throw new Error('ZIP extraction requires additional dependencies. Please install adm-zip package.');
      }
    } catch (error) {
      throw new Error('ZIP analysis requires additional dependencies. Please install the adm-zip package or ensure system unzip is available.');
    }
  }

  /**
   * Create temporary directory for extraction
   */
  private async createTempDirectory(): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `devcanvas-zip-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  /**
   * Select extraction location
   */
  private async selectExtractionLocation(suggestedName: string): Promise<string | undefined> {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const defaultPath = path.join(homeDir, 'DevCanvas-Extracted', suggestedName);

    const choice = await vscode.window.showQuickPick([
      {
        label: `$(folder) Use Default Location`,
        description: defaultPath,
        detail: 'Extract to the default DevCanvas folder',
        value: defaultPath
      },
      {
        label: `$(file-directory) Choose Custom Location`,
        description: 'Select a different folder',
        detail: 'Browse for a custom location',
        value: 'custom'
      }
    ], {
      placeHolder: 'Where would you like to extract the ZIP file?',
      ignoreFocusOut: true
    });

    if (!choice) {
      return undefined;
    }

    if (choice.value === 'custom') {
      const selectedUri = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: 'Select Extraction Location',
        title: 'Choose where to extract the ZIP file'
      });

      if (selectedUri && selectedUri[0]) {
        return path.join(selectedUri[0].fsPath, suggestedName);
      }
      return undefined;
    }

    return choice.value as string;
  }

  /**
   * Ask user if they want to index the extracted code
   */
  private async askToIndexExtractedCode(): Promise<boolean> {
    const choice = await vscode.window.showInformationMessage(
      'Would you like to index the extracted code for AI analysis?',
      'Yes, Index Code',
      'No, Skip Indexing'
    );

    return choice === 'Yes, Index Code';
  }

  /**
   * Index extracted code using RAG manager
   */
  private async indexExtractedCode(extractedPath: string): Promise<void> {
    // This would require access to the RAG manager
    // For now, just show a message
    vscode.window.showInformationMessage(
      `Code extracted to ${extractedPath}. You can open this folder and use "Index Current Workspace" to analyze the code.`
    );
  }

  /**
   * Clean up temporary directory
   */
  private async cleanupTempDirectory(tempDir: string): Promise<void> {
    try {
      await rmdir(tempDir, { recursive: true });
    } catch (error) {
      console.warn('Failed to cleanup temporary directory:', error);
    }
  }

  /**
   * Show analysis results to user
   */
  private async showAnalysisResults(result: ZipAnalysisResult, analysisType: string): Promise<void> {
    if (!result.success) {
      vscode.window.showErrorMessage(`ZIP analysis failed: ${result.error}`);
      return;
    }

    if (result.summary) {
      const summary = result.summary;
      let message = `📊 **ZIP Analysis Complete**\n\n`;
      message += `- **Total Files:** ${summary.totalFiles}\n`;
      message += `- **Code Files:** ${summary.codeFiles}\n`;
      message += `- **Languages:** ${summary.languages.join(', ') || 'None detected'}\n`;
      message += `- **Size:** ${this.formatBytes(summary.size)}\n`;
      
      if (summary.structure.directories.length > 0) {
        message += `- **Directories:** ${summary.structure.directories.length}\n`;
      }

      const actions: string[] = [];
      
      if (result.extractedPath) {
        actions.push('Open Folder', 'Add to Workspace');
      }
      
      if (summary.codeFiles > 0) {
        actions.push('Show Details');
      }

      const choice = await vscode.window.showInformationMessage(message, ...actions);

      switch (choice) {
        case 'Open Folder':
          if (result.extractedPath) {
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(result.extractedPath));
          }
          break;
        case 'Add to Workspace':
          if (result.extractedPath) {
            vscode.workspace.updateWorkspaceFolders(
              vscode.workspace.workspaceFolders?.length || 0,
              0,
              { uri: vscode.Uri.file(result.extractedPath), name: path.basename(result.extractedPath) }
            );
          }
          break;
        case 'Show Details':
          await this.showDetailedAnalysis(summary);
          break;
      }
    }
  }

  /**
   * Show detailed analysis in a new document
   */
  private async showDetailedAnalysis(summary: ZipSummary): Promise<void> {
    let content = `# ZIP File Analysis Report\n\n`;
    content += `## Summary\n\n`;
    content += `- **Total Files:** ${summary.totalFiles}\n`;
    content += `- **Code Files:** ${summary.codeFiles}\n`;
    content += `- **Size:** ${this.formatBytes(summary.size)}\n\n`;
    
    content += `## Programming Languages\n\n`;
    if (summary.languages.length > 0) {
      summary.languages.forEach(lang => {
        content += `- ${lang}\n`;
      });
    } else {
      content += `No programming languages detected.\n`;
    }
    
    content += `\n## File Types\n\n`;
    Object.entries(summary.structure.files).forEach(([ext, count]) => {
      content += `- **${ext || 'No extension'}**: ${count} files\n`;
    });
    
    if (summary.supportedFiles.length > 0) {
      content += `\n## Supported Code Files\n\n`;
      summary.supportedFiles.slice(0, 50).forEach(file => {
        content += `- ${file}\n`;
      });
      
      if (summary.supportedFiles.length > 50) {
        content += `\n... and ${summary.supportedFiles.length - 50} more files\n`;
      }
    }

    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });
    
    await vscode.window.showTextDocument(doc);
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}