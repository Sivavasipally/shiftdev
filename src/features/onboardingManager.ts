import * as vscode from 'vscode';
import { Configuration } from '../utils/configuration';
import { Storage } from '../utils/storage';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action?: () => Promise<void>;
  completed: boolean;
}

export class OnboardingManager {
  private storage: Storage;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext, storage: Storage) {
    this.context = context;
    this.storage = storage;
  }

  /**
   * Check if user has completed onboarding
   */
  async isOnboardingComplete(): Promise<boolean> {
    const globalState = this.context.globalState;
    return globalState.get('devcanvas.onboardingComplete', false);
  }

  /**
   * Mark onboarding as complete
   */
  async completeOnboarding(): Promise<void> {
    await this.context.globalState.update('devcanvas.onboardingComplete', true);
  }

  /**
   * Get onboarding steps based on current state
   */
  async getOnboardingSteps(): Promise<OnboardingStep[]> {
    const userProfile = await Configuration.getUserProfile();
    const hasWorkspace = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0;
    const hasApiKeys = userProfile && userProfile.apiKeys && Object.keys(userProfile.apiKeys).length > 0;

    const steps: OnboardingStep[] = [
      {
        id: 'welcome',
        title: '👋 Welcome to DevCanvas AI',
        description: 'DevCanvas AI is an intelligent code assistant that helps you understand, document, and improve your codebase using AI.',
        completed: true // Always true since they're seeing this
      },
      {
        id: 'workspace',
        title: '📁 Open a Workspace',
        description: hasWorkspace 
          ? '✅ Great! You have a workspace open. DevCanvas AI works best with your code projects.'
          : '📂 Please open a folder or workspace that contains your code. DevCanvas AI analyzes your project structure.',
        action: hasWorkspace ? undefined : this.openWorkspaceAction,
        completed: hasWorkspace || false
      },
      {
        id: 'configure',
        title: '🔑 Configure API Keys',
        description: hasApiKeys 
          ? '✅ Perfect! Your API keys are configured. You can use your preferred AI model.'
          : '⚙️ Configure your API keys to enable AI features. Supports Google Gemini, OpenAI, and Claude.',
        action: hasApiKeys ? undefined : this.configureApiKeysAction,
        completed: hasApiKeys || false
      },
      {
        id: 'index',
        title: '🔍 Index Your Codebase',
        description: hasApiKeys && hasWorkspace 
          ? '📊 Index your codebase to enable intelligent code search and analysis.'
          : '📊 This step will be available after you configure API keys and open a workspace.',
        action: (hasApiKeys && hasWorkspace) ? this.indexCodebaseAction : undefined,
        completed: false // Will be checked dynamically
      },
      {
        id: 'try',
        title: '💬 Try the Chat Interface',
        description: '🎯 Ask questions about your code, generate documentation, or create diagrams using the sidebar chat.',
        action: this.openChatAction,
        completed: false
      },
      {
        id: 'features',
        title: '✨ Explore Advanced Features',
        description: '🚀 Discover repository cloning, diagram generation, README creation, and code quality analysis.',
        completed: false
      }
    ];

    return steps;
  }

  /**
   * Show onboarding wizard
   */
  async showOnboardingWizard(): Promise<void> {
    const steps = await this.getOnboardingSteps();
    
    await this.showOnboardingWebview(steps);
  }

  /**
   * Show quick start guide
   */
  async showQuickStartGuide(): Promise<void> {
    try {
      const steps = await this.getOnboardingSteps();
      const nextStep = steps.find(step => !step.completed);

      if (!nextStep) {
        vscode.window.showInformationMessage(
          '🎉 Great! You\'ve completed all setup steps. You\'re ready to use DevCanvas AI!',
          'Open Chat',
          'Generate Diagram',
          'Create README'
        ).then(choice => {
          if (choice) {
            switch (choice) {
              case 'Open Chat':
                vscode.commands.executeCommand('devcanvas-ai.chatView.focus');
                break;
              case 'Generate Diagram':
                vscode.commands.executeCommand('devcanvas-ai.generateDiagram');
                break;
              case 'Create README':
                vscode.commands.executeCommand('devcanvas-ai.generateReadme');
                break;
            }
          }
        });
        return;
      }

      const message = `Next step: ${nextStep.title}\n\n${nextStep.description}`;
      const actionButton = nextStep.action ? 'Complete Step' : 'Got it';
      
      const choice = await vscode.window.showInformationMessage(
        message,
        actionButton,
        'Show Full Guide',
        'Skip'
      );

      if (!choice) {
        // User cancelled the dialog
        return;
      }

      switch (choice) {
        case 'Complete Step':
          if (nextStep.action) {
            await nextStep.action();
          }
          break;
        case 'Show Full Guide':
          await this.showOnboardingWizard();
          break;
        case 'Skip':
          await this.completeOnboarding();
          break;
      }
    } catch (error) {
      console.log('Quick start guide was cancelled or failed:', error);
      // Don't throw the error to prevent blocking extension activation
    }
  }

  /**
   * Show welcome message for new users
   */
  async showWelcomeMessage(): Promise<void> {
    try {
      const isFirstTime = !await this.isOnboardingComplete();
      
      if (isFirstTime) {
        const choice = await vscode.window.showInformationMessage(
          '🎨 Welcome to DevCanvas AI! Would you like a quick tour to get started?',
          'Start Tour',
          'Quick Setup',
          'Skip'
        );

        if (!choice) {
          // User cancelled the dialog
          return;
        }

        switch (choice) {
          case 'Start Tour':
            await this.showOnboardingWizard();
            break;
          case 'Quick Setup':
            await this.showQuickStartGuide();
            break;
          case 'Skip':
            await this.completeOnboarding();
            break;
        }
      }
    } catch (error) {
      console.log('Welcome message was cancelled or failed:', error);
      // Don't throw the error to prevent blocking extension activation
    }
  }

  /**
   * Create onboarding webview
   */
  private async showOnboardingWebview(steps: OnboardingStep[]): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'devcanvasOnboarding',
      'DevCanvas AI - Getting Started',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    panel.webview.html = this.getOnboardingHtml(steps);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'executeAction':
          const step = steps.find(s => s.id === message.stepId);
          if (step && step.action) {
            try {
              await step.action();
              // Refresh the webview
              const updatedSteps = await this.getOnboardingSteps();
              panel.webview.html = this.getOnboardingHtml(updatedSteps);
            } catch (error) {
              vscode.window.showErrorMessage(`Failed to complete step: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          }
          break;
        case 'completeOnboarding':
          await this.completeOnboarding();
          panel.dispose();
          vscode.window.showInformationMessage('🎉 Welcome aboard! DevCanvas AI is ready to help you with your code.');
          break;
        case 'openChat':
          vscode.commands.executeCommand('devcanvas-ai.chatView.focus');
          break;
      }
    });
  }

  /**
   * Generate HTML for onboarding webview
   */
  private getOnboardingHtml(steps: OnboardingStep[]): string {
    const stepsHtml = steps.map((step, index) => {
      const statusIcon = step.completed ? '✅' : '⭕';
      const actionButton = step.action && !step.completed 
        ? `<button onclick="executeAction('${step.id}')">Complete Step</button>`
        : '';
      
      return `
        <div class="step ${step.completed ? 'completed' : 'pending'}">
          <div class="step-header">
            <span class="step-icon">${statusIcon}</span>
            <h3 class="step-title">${step.title}</h3>
          </div>
          <p class="step-description">${step.description}</p>
          ${actionButton}
        </div>
      `;
    }).join('');

    const completedCount = steps.filter(s => s.completed).length;
    const progressPercent = Math.round((completedCount / steps.length) * 100);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DevCanvas AI - Getting Started</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 3em;
            margin-bottom: 10px;
          }
          .title {
            font-size: 2em;
            margin: 0;
            color: var(--vscode-foreground);
          }
          .subtitle {
            color: var(--vscode-descriptionForeground);
            margin: 10px 0;
          }
          .progress-container {
            background-color: var(--vscode-progressBar-background);
            border-radius: 10px;
            height: 20px;
            margin: 20px 0;
            overflow: hidden;
          }
          .progress-bar {
            background-color: var(--vscode-progressBar-foreground);
            height: 100%;
            width: ${progressPercent}%;
            transition: width 0.3s ease;
          }
          .progress-text {
            text-align: center;
            margin: 10px 0;
            font-weight: 600;
          }
          .steps-container {
            max-width: 800px;
            margin: 0 auto;
          }
          .step {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            transition: all 0.2s ease;
          }
          .step:hover {
            border-color: var(--vscode-focusBorder);
          }
          .step.completed {
            background-color: var(--vscode-inputValidation-infoBackground);
            border-color: var(--vscode-inputValidation-infoBorder);
          }
          .step-header {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
          }
          .step-icon {
            font-size: 1.5em;
            margin-right: 15px;
          }
          .step-title {
            margin: 0;
            font-size: 1.2em;
            color: var(--vscode-foreground);
          }
          .step-description {
            margin: 10px 0;
            color: var(--vscode-descriptionForeground);
            margin-left: 45px;
          }
          button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin: 10px 5px 0 45px;
            font-size: 14px;
          }
          button:hover {
            background: var(--vscode-button-hoverBackground);
          }
          .footer {
            text-align: center;
            margin: 40px 0 20px 0;
            padding: 20px;
            border-top: 1px solid var(--vscode-widget-border);
          }
          .footer button {
            margin: 0 10px;
            padding: 12px 24px;
            font-size: 16px;
          }
          .complete-button {
            background: var(--vscode-button-background);
          }
          .chat-button {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🎨</div>
          <h1 class="title">DevCanvas AI</h1>
          <p class="subtitle">Your intelligent coding companion</p>
          
          <div class="progress-container">
            <div class="progress-bar"></div>
          </div>
          <div class="progress-text">${completedCount} of ${steps.length} steps completed (${progressPercent}%)</div>
        </div>

        <div class="steps-container">
          ${stepsHtml}
        </div>

        <div class="footer">
          <button class="chat-button" onclick="openChat()">Open Chat Interface</button>
          <button class="complete-button" onclick="completeOnboarding()">Complete Setup</button>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          
          function executeAction(stepId) {
            vscode.postMessage({ type: 'executeAction', stepId });
          }
          
          function completeOnboarding() {
            vscode.postMessage({ type: 'completeOnboarding' });
          }
          
          function openChat() {
            vscode.postMessage({ type: 'openChat' });
          }
        </script>
      </body>
      </html>
    `;
  }

  // Action methods
  private openWorkspaceAction = async (): Promise<void> => {
    const result = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Open Workspace'
    });

    if (result && result[0]) {
      await vscode.commands.executeCommand('vscode.openFolder', result[0]);
    }
  };

  private configureApiKeysAction = async (): Promise<void> => {
    await vscode.commands.executeCommand('devcanvas-ai.configure');
  };

  private indexCodebaseAction = async (): Promise<void> => {
    await vscode.commands.executeCommand('devcanvas-ai.indexWorkspace');
  };

  private openChatAction = async (): Promise<void> => {
    await vscode.commands.executeCommand('devcanvas-ai.chatView.focus');
  };
}