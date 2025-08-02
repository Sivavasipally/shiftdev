import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export class FileUtils {
  static async readFileAsync(filePath: string): Promise<string> {
    return fs.promises.readFile(filePath, 'utf-8');
  }

  static async writeFileAsync(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }

  static async pathExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async getFileStats(filePath: string): Promise<fs.Stats | null> {
    try {
      return await fs.promises.stat(filePath);
    } catch {
      return null;
    }
  }

  static getRelativePath(absolutePath: string, workspaceRoot: string): string {
    return path.relative(workspaceRoot, absolutePath);
  }

  static isTextFile(filePath: string): boolean {
    const textExtensions = [
      '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
      '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.kt', '.scala', '.clj',
      '.html', '.css', '.scss', '.sass', '.less', '.xml', '.json', '.yaml', '.yml',
      '.md', '.txt', '.sql', '.sh', '.bat', '.ps1', '.dockerfile', '.gitignore'
    ];
    
    const ext = path.extname(filePath).toLowerCase();
    return textExtensions.includes(ext);
  }

  static shouldIgnoreFile(filePath: string, workspaceRoot: string): boolean {
    const relativePath = path.relative(workspaceRoot, filePath);
    
    const ignorePaths = [
      'node_modules',
      '.git',
      '.vscode',
      'dist',
      'build',
      'out',
      'target',
      'bin',
      'obj',
      '.next',
      '.nuxt',
      'coverage',
      '.nyc_output',
      'logs',
      '*.log',
      '.DS_Store',
      'Thumbs.db'
    ];

    return ignorePaths.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(relativePath);
      }
      return relativePath.includes(pattern);
    });
  }

  static async loadGitignore(workspaceRoot: string): Promise<string[]> {
    try {
      const gitignorePath = path.join(workspaceRoot, '.gitignore');
      const content = await this.readFileAsync(gitignorePath);
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
    } catch {
      return [];
    }
  }

  static async navigateToFile(filePath: string, lineNumber?: number): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);
      
      if (lineNumber !== undefined) {
        const position = new vscode.Position(Math.max(0, lineNumber - 1), 0);
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Could not navigate to ${filePath}${lineNumber ? `:${lineNumber}` : ''}`);
    }
  }

  static async showFilePreview(filePath: string, startLine?: number, endLine?: number): Promise<string> {
    try {
      const content = await this.readFileAsync(filePath);
      const lines = content.split('\n');
      
      if (startLine !== undefined && endLine !== undefined) {
        const selectedLines = lines.slice(Math.max(0, startLine - 1), endLine);
        return selectedLines.join('\n');
      }
      
      return content.substring(0, 1000); // First 1000 characters
    } catch {
      return 'Unable to read file content';
    }
  }
}