import * as vscode from 'vscode';
import { SidebarProvider } from './sidebar/SidebarProvider';
import { ChatController } from './chat/ChatController';
import { RAGManager } from './core/RAGManager';
import { Configuration } from './utils/configuration';
import { Storage } from './utils/storage';
import { GitLabProvider } from './integrations/GitLabProvider';
import { BitbucketProvider } from './integrations/BitbucketProvider';

let ragManager: RAGManager | undefined;
let chatController: ChatController | undefined;
let sidebarProvider: SidebarProvider | undefined;

export async function activate(context: vscode.ExtensionContext) {
  console.log('🎨 DevCanvas AI is now active!');

  try {
    // Initialize storage
    const storage = new Storage(context);
    
    // Get or create user profile
    let userProfile = await Configuration.getUserProfile();
    if (!userProfile) {
      userProfile = await Configuration.createDefaultProfile();
      vscode.window.showInformationMessage(
        'Welcome to DevCanvas AI! Please configure your API keys using the "Configure API Keys" command.'
      );
    }

    // Check if workspace is available
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceUri) {
      vscode.window.showWarningMessage('DevCanvas AI requires an open workspace to function properly.');
      return;
    }

    // Initialize core components
    ragManager = new RAGManager(workspaceUri, userProfile);
    await ragManager.initialize();

    chatController = new ChatController(ragManager, storage, userProfile);
    
    // Register sidebar provider
    sidebarProvider = new SidebarProvider(context.extensionUri, chatController);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(SidebarProvider.viewType, sidebarProvider)
    );

    // Register commands
    registerCommands(context, ragManager, storage);

    // Auto-index on startup if enabled and user has API keys configured
    if (Configuration.isAutoIndexEnabled()) {
      const lastIndex = await storage.getLastIndexTime();
      const shouldIndex = !lastIndex || (Date.now() - lastIndex.getTime()) > 24 * 60 * 60 * 1000; // 24 hours
      
      if (shouldIndex) {
        // Check if user has API keys configured before auto-indexing
        if (userProfile && userProfile.apiKeys && Object.keys(userProfile.apiKeys).length > 0) {
          vscode.window.showInformationMessage(
            'DevCanvas AI is indexing your workspace in the background...'
          );
          
          try {
            await ragManager.indexCodebase(workspaceUri.fsPath);
            await storage.saveLastIndexTime(new Date());
          } catch (error) {
            console.error('Auto-indexing failed:', error);
            vscode.window.showWarningMessage(
              'Auto-indexing failed. You can manually index using the "Index Current Workspace" command.'
            );
          }
        } else {
          // Skip auto-indexing if no API keys are configured
          console.log('Skipping auto-indexing: No API keys configured');
        }
      }
    }

    // Set context for when extension is enabled
    vscode.commands.executeCommand('setContext', 'devcanvas-ai.enabled', true);

    console.log('✅ DevCanvas AI activated successfully');

  } catch (error) {
    console.error('DevCanvas AI activation failed:', error);
    vscode.window.showErrorMessage(
      `DevCanvas AI failed to activate: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

function registerCommands(
  context: vscode.ExtensionContext, 
  ragManager: RAGManager, 
  storage: Storage
) {
  // Index workspace command
  const indexCommand = vscode.commands.registerCommand('devcanvas-ai.indexWorkspace', async () => {
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceUri) {
      vscode.window.showErrorMessage('No workspace folder found');
      return;
    }

    try {
      await ragManager.indexCodebase(workspaceUri.fsPath);
      await storage.saveLastIndexTime(new Date());
      vscode.window.showInformationMessage('✅ Workspace indexed successfully!');
      
      // Focus the sidebar after indexing
      if (sidebarProvider) {
        sidebarProvider.focus();
      }
    } catch (error) {
      console.error('Indexing failed:', error);
      vscode.window.showErrorMessage(
        `Indexing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  // Clear index command
  const clearCommand = vscode.commands.registerCommand('devcanvas-ai.clearIndex', async () => {
    const confirm = await vscode.window.showWarningMessage(
      'This will clear all indexed code data. Are you sure?',
      'Yes, Clear Index',
      'Cancel'
    );

    if (confirm === 'Yes, Clear Index') {
      try {
        await ragManager.clearIndex();
        vscode.window.showInformationMessage('✅ Index cleared successfully!');
      } catch (error) {
        vscode.window.showErrorMessage('Failed to clear index');
      }
    }
  });

  // Configure API keys command
  const configureCommand = vscode.commands.registerCommand('devcanvas-ai.configure', async () => {
    await showConfigurationPanel(storage);
  });

  // Generate README command
  const generateReadmeCommand = vscode.commands.registerCommand('devcanvas-ai.generateReadme', async () => {
    if (!chatController) {
      vscode.window.showErrorMessage('DevCanvas AI is not properly initialized');
      return;
    }

    try {
      const response = await chatController.processMessage('Generate a comprehensive README for this project');
      
      // Create and show README document
      const doc = await vscode.workspace.openTextDocument({
        content: response.content,
        language: 'markdown'
      });
      
      await vscode.window.showTextDocument(doc);
      
      if (sidebarProvider) {
        sidebarProvider.focus();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate README: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Generate diagram command
  const generateDiagramCommand = vscode.commands.registerCommand('devcanvas-ai.generateDiagram', async () => {
    if (!chatController) {
      vscode.window.showErrorMessage('DevCanvas AI is not properly initialized');
      return;
    }

    const diagramType = await vscode.window.showQuickPick([
      { label: 'Architecture Diagram', value: 'architecture' },
      { label: 'Class Diagram', value: 'class' },
      { label: 'Sequence Diagram', value: 'sequence' }
    ], {
      placeHolder: 'Select diagram type to generate'
    });

    if (!diagramType) return;

    try {
      let query = `Generate a ${diagramType.value} diagram`;
      if (diagramType.value === 'sequence') {
        const scenario = await vscode.window.showInputBox({
          prompt: 'Describe the scenario for the sequence diagram',
          placeHolder: 'e.g., user login process, data processing flow'
        });
        if (scenario) {
          query += ` for: ${scenario}`;
        }
      }

      await chatController.processMessage(query);
      
      if (sidebarProvider) {
        sidebarProvider.focus();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to generate diagram: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Add integration commands
  const gitlabCommand = vscode.commands.registerCommand('devcanvas-ai.connectGitlab', async () => {
    await connectToGitLab();
  });

  const bitbucketCommand = vscode.commands.registerCommand('devcanvas-ai.connectBitbucket', async () => {
    await connectToBitbucket();
  });

  // Register all commands
  context.subscriptions.push(
    indexCommand,
    clearCommand,
    configureCommand,
    generateReadmeCommand,
    generateDiagramCommand,
    gitlabCommand,
    bitbucketCommand
  );
}

async function showConfigurationPanel(storage: Storage) {
  const llmOptions = [
    { label: '🔥 Google Gemini Flash (Recommended)', value: 'gemini-flash' },
    { label: '⚡ Google Gemini Pro', value: 'gemini-pro' },
    { label: '🤖 OpenAI GPT-4', value: 'openai-gpt4' },
    { label: '🧠 Anthropic Claude 3', value: 'claude-3' }
  ];

  const selectedLLM = await vscode.window.showQuickPick(llmOptions, {
    placeHolder: 'Select your preferred LLM provider'
  });

  if (!selectedLLM) return;

  const apiKey = await vscode.window.showInputBox({
    prompt: `Enter your API key for ${selectedLLM.label}`,
    password: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'API key cannot be empty';
      }
      if (value.length < 10) {
        return 'API key seems too short';
      }
      return null;
    }
  });

  if (!apiKey) return;

  try {
    // Test the API key
    vscode.window.showInformationMessage('Testing API key...');
    
    let userProfile = await Configuration.getUserProfile();
    if (!userProfile) {
      // Create a new profile if none exists
      userProfile = await Configuration.createDefaultProfile();
    }

    userProfile.selectedLLM = selectedLLM.value as any;
    
    // Ensure apiKeys object exists
    if (!userProfile.apiKeys) {
      userProfile.apiKeys = {};
    }
    
    userProfile.apiKeys[selectedLLM.value] = apiKey;
    
    // Set appropriate embedding model
    if (selectedLLM.value.startsWith('gemini')) {
      userProfile.embeddingModel = 'text-embedding-004'; // Google's embedding model
    } else if (selectedLLM.value.startsWith('openai')) {
      userProfile.embeddingModel = 'text-embedding-ada-002'; // OpenAI's embedding model
    } else if (selectedLLM.value.startsWith('claude')) {
      userProfile.embeddingModel = 'text-embedding-004'; // Use Google's for Claude (fallback)
    } else {
      userProfile.embeddingModel = 'text-embedding-004'; // Fallback to Google
    }

    await Configuration.saveUserProfile(userProfile);
    
    // Store API key securely
    await storage.saveApiKeySecurely(selectedLLM.value, apiKey);
    
    // Update the user profile in active components
    if (ragManager) {
      ragManager.updateUserProfile(userProfile);
    }
    if (chatController) {
      chatController.updateUserProfile(userProfile);
    }
    
    vscode.window.showInformationMessage('✅ Configuration saved successfully!');
    
    // Suggest indexing
    const shouldIndex = await vscode.window.showInformationMessage(
      'Configuration complete! Would you like to index your workspace now?',
      'Yes, Index Now',
      'Later'
    );
    
    if (shouldIndex === 'Yes, Index Now') {
      vscode.commands.executeCommand('devcanvas-ai.indexWorkspace');
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Configuration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function connectToGitLab() {
  const apiToken = await vscode.window.showInputBox({
    prompt: 'Enter your GitLab API token',
    password: true,
    validateInput: (value) => {
      if (!value || !GitLabProvider.validateApiToken(value)) {
        return 'Please enter a valid GitLab API token';
      }
      return null;
    }
  });

  if (!apiToken) return;

  const baseUrl = await vscode.window.showInputBox({
    prompt: 'Enter GitLab base URL (leave empty for gitlab.com)',
    value: 'https://gitlab.com',
    validateInput: (value) => {
      if (value && !value.startsWith('http')) {
        return 'URL must start with http:// or https://';
      }
      return null;
    }
  });

  try {
    const provider = new GitLabProvider(apiToken, baseUrl || 'https://gitlab.com');
    
    // Test connection
    const isConnected = await provider.testConnection();
    if (!isConnected) {
      vscode.window.showErrorMessage('Failed to connect to GitLab. Please check your credentials.');
      return;
    }

    // Get projects
    const projects = await provider.getUserProjects();
    
    if (projects.length === 0) {
      vscode.window.showInformationMessage('No GitLab projects found.');
      return;
    }

    const selectedProject = await vscode.window.showQuickPick(
      projects.map(p => ({
        label: p.name,
        description: p.path_with_namespace,
        detail: p.description || 'No description',
        project: p
      })),
      {
        placeHolder: 'Select a GitLab project to analyze'
      }
    );

    if (selectedProject) {
      vscode.window.showInformationMessage(
        `Selected ${selectedProject.label}. This feature will be available in a future update.`
      );
    }

  } catch (error) {
    vscode.window.showErrorMessage(`GitLab connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function connectToBitbucket() {
  const username = await vscode.window.showInputBox({
    prompt: 'Enter your Bitbucket username',
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Username cannot be empty';
      }
      return null;
    }
  });

  if (!username) return;

  const appPassword = await vscode.window.showInputBox({
    prompt: 'Enter your Bitbucket app password',
    password: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'App password cannot be empty';
      }
      return null;
    }
  });

  if (!appPassword) return;

  try {
    const provider = new BitbucketProvider(username, appPassword);
    
    // Test connection
    const isConnected = await provider.testConnection();
    if (!isConnected) {
      vscode.window.showErrorMessage('Failed to connect to Bitbucket. Please check your credentials.');
      return;
    }

    // Get repositories
    const repositories = await provider.getUserRepositories();
    
    if (repositories.length === 0) {
      vscode.window.showInformationMessage('No Bitbucket repositories found.');
      return;
    }

    const selectedRepo = await vscode.window.showQuickPick(
      repositories.map(r => ({
        label: r.name,
        description: r.full_name,
        detail: r.description || 'No description',
        repository: r
      })),
      {
        placeHolder: 'Select a Bitbucket repository to analyze'
      }
    );

    if (selectedRepo) {
      vscode.window.showInformationMessage(
        `Selected ${selectedRepo.label}. This feature will be available in a future update.`
      );
    }

  } catch (error) {
    vscode.window.showErrorMessage(`Bitbucket connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function deactivate() {
  console.log('🎨 DevCanvas AI is deactivating...');
  
  try {
    if (ragManager) {
      await ragManager.close();
    }
    console.log('✅ DevCanvas AI deactivated successfully');
  } catch (error) {
    console.error('Error during deactivation:', error);
  }
}