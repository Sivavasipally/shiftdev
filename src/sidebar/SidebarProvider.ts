import * as vscode from 'vscode';
import { ChatController } from '../chat/ChatController';
import { getNonce } from '../utils/getNonce';

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'devcanvas-ai.chatView';
  private _view?: vscode.WebviewView;
  
  constructor(
    private readonly _extensionUri: vscode.Uri,
    private chatController: ChatController
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'media')
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(
      async message => {
        switch (message.type) {
          case 'sendMessage':
            await this.handleChatMessage(message.content);
            break;
          case 'navigateToCode':
            await this.navigateToCode(message.filePath, message.lineNumber);
            break;
          case 'clearChat':
            await this.handleClearChat();
            break;
        }
      },
      undefined,
      []
    );
  }

  private async handleChatMessage(content: string) {
    try {
      // Show typing indicator
      this.sendMessage({ type: 'typing', isTyping: true });
      
      const response = await this.chatController.processMessage(content);
      
      // Send response back to webview
      this.sendMessage({
        type: 'messageResponse',
        content: response.content,
        metadata: response.metadata
      });
      
    } catch (error) {
      console.error('Chat message error:', error);
      this.sendMessage({ 
        type: 'error', 
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      this.sendMessage({ type: 'typing', isTyping: false });
    }
  }

  private async handleClearChat() {
    try {
      await this.chatController.clearHistory();
      this.sendMessage({ type: 'clearComplete' });
    } catch (error) {
      console.error('Clear chat error:', error);
      this.sendMessage({ 
        type: 'error', 
        message: 'Failed to clear chat history' 
      });
    }
  }

  private async navigateToCode(filePath: string, lineNumber: number) {
    try {
      // Handle relative paths by resolving against workspace
      let absolutePath = filePath;
      if (!filePath.startsWith('/') && vscode.workspace.workspaceFolders) {
        const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
        absolutePath = vscode.Uri.joinPath(
          vscode.Uri.file(workspaceRoot), 
          filePath
        ).fsPath;
      }

      const uri = vscode.Uri.file(absolutePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);
      
      const position = new vscode.Position(Math.max(0, lineNumber - 1), 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position), 
        vscode.TextEditorRevealType.InCenter
      );
      
      // Highlight the line briefly
      const decoration = vscode.window.createTextEditorDecorationType({
        backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
        isWholeLine: true
      });
      
      editor.setDecorations(decoration, [new vscode.Range(position, position)]);
      
      // Remove highlight after 2 seconds
      setTimeout(() => {
        decoration.dispose();
      }, 2000);
      
    } catch (error) {
      console.error('Navigation error:', error);
      vscode.window.showErrorMessage(
        `Could not navigate to ${filePath}:${lineNumber}. ${error instanceof Error ? error.message : ''}`
      );
    }
  }

  public sendMessage(message: any) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  public focus() {
    if (this._view) {
      this._view.show(true);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
    );
    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval'; font-src ${webview.cspSource};">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${styleMainUri}" rel="stylesheet">
        <title>DevCanvas AI</title>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🎨 DevCanvas AI</h2>
            <button id="clearChat" class="clear-btn" title="Clear chat history">Clear</button>
          </div>
          
          <div id="messages" class="messages"></div>
          
          <div class="input-container">
            <textarea 
              id="messageInput" 
              placeholder="Ask about your codebase, generate docs, create diagrams..." 
              rows="3"
              maxlength="4000"
            ></textarea>
            <button id="sendButton" class="send-btn">Send</button>
          </div>
        </div>
        
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}