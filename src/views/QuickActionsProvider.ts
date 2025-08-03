import * as vscode from 'vscode';

export class QuickActionsProvider implements vscode.TreeDataProvider<QuickAction> {
  private _onDidChangeTreeData: vscode.EventEmitter<QuickAction | undefined | null | void> = new vscode.EventEmitter<QuickAction | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<QuickAction | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor() {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: QuickAction): vscode.TreeItem {
    return element;
  }

  getChildren(element?: QuickAction): Thenable<QuickAction[]> {
    if (!element) {
      return Promise.resolve(this.getQuickActions());
    }
    return Promise.resolve([]);
  }

  private getQuickActions(): QuickAction[] {
    const actions: QuickAction[] = [
      new QuickAction(
        'Configure API Keys',
        'Set up your LLM provider (Gemini, OpenAI, Claude)',
        vscode.TreeItemCollapsibleState.None,
        'devcanvas-ai.configure',
        'settings-gear'
      ),
      new QuickAction(
        'Index Workspace',
        'Analyze your codebase for AI features',
        vscode.TreeItemCollapsibleState.None,
        'devcanvas-ai.indexWorkspace',
        'search'
      ),
      new QuickAction(
        'Generate README',
        'Create comprehensive documentation',
        vscode.TreeItemCollapsibleState.None,
        'devcanvas-ai.generateReadme',
        'book'
      ),
      new QuickAction(
        'Create Diagram',
        'Generate architecture or class diagrams',
        vscode.TreeItemCollapsibleState.None,
        'devcanvas-ai.generateDiagram',
        'graph'
      ),
      new QuickAction(
        'Clone Repository',
        'Clone from GitHub, GitLab, or Bitbucket',
        vscode.TreeItemCollapsibleState.None,
        'devcanvas-ai.cloneRepository',
        'cloud-download'
      ),
      new QuickAction(
        'Analyze ZIP File',
        'Upload and analyze code archives',
        vscode.TreeItemCollapsibleState.None,
        'devcanvas-ai.analyzeZip',
        'archive'
      ),
      new QuickAction(
        'Getting Started',
        'Show the onboarding guide',
        vscode.TreeItemCollapsibleState.None,
        'devcanvas-ai.showOnboarding',
        'rocket'
      )
    ];

    return actions;
  }
}

export class QuickAction extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly tooltip: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly commandId: string,
    public readonly iconName: string
  ) {
    super(label, collapsibleState);

    this.tooltip = tooltip;
    this.command = {
      command: commandId,
      title: label,
      arguments: []
    };
    this.iconPath = new vscode.ThemeIcon(iconName);
    this.contextValue = 'quickAction';
  }
}