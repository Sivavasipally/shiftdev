import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';

const exec = promisify(execCallback);

export interface Repository {
  name: string;
  url: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  branch?: string;
  token?: string;
}

export interface CloneResult {
  success: boolean;
  localPath?: string;
  error?: string;
}

export class RepositoryManager {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('DevCanvas AI - Repository Manager');
  }

  /**
   * Parse repository URL to extract provider and repository info
   */
  parseRepositoryUrl(url: string): {
    provider: 'github' | 'gitlab' | 'bitbucket' | 'unknown';
    owner: string;
    repo: string;
    originalUrl: string;
  } {
    // Remove trailing .git if present
    const cleanUrl = url.replace(/\.git$/, '');
    
    // GitHub patterns
    if (cleanUrl.includes('github.com')) {
      const match = cleanUrl.match(/github\.com[/:]([^/]+)\/([^/?#]+)/);
      if (match) {
        return {
          provider: 'github',
          owner: match[1],
          repo: match[2],
          originalUrl: url
        };
      }
    }
    
    // GitLab patterns
    if (cleanUrl.includes('gitlab.com')) {
      const match = cleanUrl.match(/gitlab\.com[/:]([^/]+)\/([^/?#]+)/);
      if (match) {
        return {
          provider: 'gitlab',
          owner: match[1],
          repo: match[2],
          originalUrl: url
        };
      }
    }
    
    // Bitbucket patterns
    if (cleanUrl.includes('bitbucket.org')) {
      const match = cleanUrl.match(/bitbucket\.org[/:]([^/]+)\/([^/?#]+)/);
      if (match) {
        return {
          provider: 'bitbucket',
          owner: match[1],
          repo: match[2],
          originalUrl: url
        };
      }
    }
    
    // Generic Git URL parsing
    const genericMatch = cleanUrl.match(/[/:]([^/]+)\/([^/?#]+)$/);
    if (genericMatch) {
      return {
        provider: 'unknown',
        owner: genericMatch[1],
        repo: genericMatch[2],
        originalUrl: url
      };
    }
    
    throw new Error(`Could not parse repository URL: ${url}`);
  }

  /**
   * Check if Git is available on the system
   */
  async checkGitAvailability(): Promise<boolean> {
    try {
      await exec('git --version');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clone a repository to a local directory
   */
  async cloneRepository(
    repository: Repository,
    targetDirectory?: string
  ): Promise<CloneResult> {
    try {
      // Check Git availability
      if (!(await this.checkGitAvailability())) {
        return {
          success: false,
          error: 'Git is not installed or not available in PATH. Please install Git to clone repositories.'
        };
      }

      const repoInfo = this.parseRepositoryUrl(repository.url);
      
      // Determine target directory
      const cloneDir = targetDirectory || await this.selectCloneDirectory(repoInfo.repo);
      if (!cloneDir) {
        return {
          success: false,
          error: 'No target directory selected'
        };
      }

      // Ensure parent directory exists
      const parentDir = path.dirname(cloneDir);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      // Check if directory already exists
      if (fs.existsSync(cloneDir)) {
        const existingChoice = await vscode.window.showWarningMessage(
          `Directory ${cloneDir} already exists. What would you like to do?`,
          'Replace',
          'Choose Different Location',
          'Cancel'
        );

        switch (existingChoice) {
          case 'Replace':
            fs.rmSync(cloneDir, { recursive: true, force: true });
            break;
          case 'Choose Different Location':
            return this.cloneRepository(repository);
          default:
            return { success: false, error: 'Clone cancelled by user' };
        }
      }

      this.outputChannel.show();
      this.outputChannel.appendLine(`Starting clone of ${repository.url}...`);

      // Build clone command
      let cloneUrl = repository.url;
      
      // Add authentication if token is provided
      if (repository.token) {
        cloneUrl = this.addAuthToUrl(repository.url, repository.token, repository.provider);
      }

      let cloneCommand = `git clone "${cloneUrl}" "${cloneDir}"`;
      
      // Add branch specification if provided
      if (repository.branch) {
        cloneCommand += ` --branch "${repository.branch}"`;
      }

      // Add depth limitation for faster cloning (optional)
      cloneCommand += ' --depth 1';

      this.outputChannel.appendLine(`Running: git clone [REDACTED_URL] "${cloneDir}"`);

      // Execute clone command
      const { stdout, stderr } = await exec(cloneCommand, {
        timeout: 300000, // 5 minutes timeout
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      if (stdout) {
        this.outputChannel.appendLine('STDOUT: ' + stdout);
      }
      if (stderr) {
        this.outputChannel.appendLine('STDERR: ' + stderr);
      }

      // Verify clone was successful
      if (fs.existsSync(cloneDir) && fs.existsSync(path.join(cloneDir, '.git'))) {
        this.outputChannel.appendLine(`Successfully cloned to: ${cloneDir}`);
        
        // Offer to open the cloned repository
        const openChoice = await vscode.window.showInformationMessage(
          `Repository cloned successfully to ${cloneDir}`,
          'Open in New Window',
          'Add to Workspace',
          'Open Folder'
        );

        switch (openChoice) {
          case 'Open in New Window':
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(cloneDir), true);
            break;
          case 'Add to Workspace':
            vscode.workspace.updateWorkspaceFolders(
              vscode.workspace.workspaceFolders?.length || 0,
              0,
              { uri: vscode.Uri.file(cloneDir), name: repoInfo.repo }
            );
            break;
          case 'Open Folder':
            await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(cloneDir), false);
            break;
        }

        return {
          success: true,
          localPath: cloneDir
        };
      } else {
        return {
          success: false,
          error: 'Clone command completed but repository directory was not created'
        };
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.outputChannel.appendLine(`Clone failed: ${errorMessage}`);
      
      return {
        success: false,
        error: `Failed to clone repository: ${errorMessage}`
      };
    }
  }

  /**
   * Add authentication token to repository URL
   */
  private addAuthToUrl(url: string, token: string, provider: string): string {
    try {
      const urlObj = new URL(url);
      
      switch (provider) {
        case 'github':
          // For GitHub, use token as username with 'x-oauth-basic' as password
          urlObj.username = token;
          urlObj.password = 'x-oauth-basic';
          break;
        case 'gitlab':
          // For GitLab, use 'oauth2' as username and token as password
          urlObj.username = 'oauth2';
          urlObj.password = token;
          break;
        case 'bitbucket':
          // For Bitbucket, use 'x-token-auth' as username and token as password
          urlObj.username = 'x-token-auth';
          urlObj.password = token;
          break;
        default:
          // Generic: try token as password
          urlObj.username = 'token';
          urlObj.password = token;
      }
      
      return urlObj.toString();
    } catch (error) {
      // If URL parsing fails, return original URL
      console.warn('Failed to add auth to URL:', error);
      return url;
    }
  }

  /**
   * Let user select where to clone the repository
   */
  private async selectCloneDirectory(repoName: string): Promise<string | undefined> {
    // First, try to suggest a default location
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const defaultPath = path.join(homeDir, 'DevCanvas-Repositories', repoName);

    const choice = await vscode.window.showQuickPick([
      {
        label: `$(folder) Use Default Location`,
        description: defaultPath,
        detail: 'Clone to the default DevCanvas repositories folder',
        value: defaultPath
      },
      {
        label: `$(file-directory) Choose Custom Location`,
        description: 'Select a different folder',
        detail: 'Browse for a custom location to clone the repository',
        value: 'custom'
      }
    ], {
      placeHolder: 'Where would you like to clone this repository?',
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
        openLabel: 'Select Clone Location',
        title: 'Choose where to clone the repository'
      });

      if (selectedUri && selectedUri[0]) {
        return path.join(selectedUri[0].fsPath, repoName);
      }
      return undefined;
    }

    return choice.value as string;
  }

  /**
   * Show repository cloning interface
   */
  async showCloneInterface(): Promise<void> {
    const url = await vscode.window.showInputBox({
      prompt: 'Enter the repository URL',
      placeHolder: 'https://github.com/user/repo.git or https://gitlab.com/user/repo.git',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value) {
          return 'Please enter a repository URL';
        }
        try {
          this.parseRepositoryUrl(value);
          return null;
        } catch (error) {
          return 'Invalid repository URL format';
        }
      }
    });

    if (!url) {
      return;
    }

    const repoInfo = this.parseRepositoryUrl(url);
    
    // Ask for branch (optional)
    const branch = await vscode.window.showInputBox({
      prompt: 'Enter branch name (optional)',
      placeHolder: 'main, master, develop, etc. (leave empty for default)',
      ignoreFocusOut: true
    });

    // Ask for access token if needed
    let token: string | undefined;
    
    if (repoInfo.provider !== 'unknown') {
      const needsAuth = await vscode.window.showQuickPick([
        {
          label: 'No authentication needed',
          detail: 'This is a public repository',
          value: false
        },
        {
          label: 'Provide access token',
          detail: 'This is a private repository or you want to use your token',
          value: true
        }
      ], {
        placeHolder: 'Does this repository require authentication?',
        ignoreFocusOut: true
      });

      if (needsAuth?.value) {
        token = await vscode.window.showInputBox({
          prompt: `Enter your ${repoInfo.provider} access token`,
          placeHolder: 'Personal access token or app password',
          password: true,
          ignoreFocusOut: true
        });
      }
    }

    // Create repository object
    const repository: Repository = {
      name: repoInfo.repo,
      url: url,
      provider: repoInfo.provider as any,
      branch: branch || undefined,
      token: token || undefined
    };

    // Show progress and clone
    const result = await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Cloning ${repoInfo.repo}`,
      cancellable: false
    }, async (progress) => {
      progress.report({ increment: 0, message: 'Starting clone...' });
      
      const cloneResult = await this.cloneRepository(repository);
      
      progress.report({ increment: 100, message: 'Clone complete!' });
      
      return cloneResult;
    });

    if (!result.success) {
      vscode.window.showErrorMessage(`Failed to clone repository: ${result.error}`);
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.outputChannel.dispose();
  }
}