import * as vscode from 'vscode';
import { ChatMessage } from '../types';

export class Storage {
  constructor(private context: vscode.ExtensionContext) {}

  async saveChatHistory(messages: ChatMessage[]): Promise<void> {
    await this.context.workspaceState.update('chatHistory', messages);
  }

  async getChatHistory(): Promise<ChatMessage[]> {
    const history = this.context.workspaceState.get('chatHistory', []);
    return history.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
  }

  async clearChatHistory(): Promise<void> {
    await this.context.workspaceState.update('chatHistory', []);
  }

  async saveLastIndexTime(timestamp: Date): Promise<void> {
    await this.context.workspaceState.update('lastIndex', timestamp.toISOString());
  }

  async getLastIndexTime(): Promise<Date | null> {
    const timestamp = this.context.workspaceState.get<string>('lastIndex');
    return timestamp ? new Date(timestamp) : null;
  }

  async saveIndexedFiles(files: string[]): Promise<void> {
    await this.context.workspaceState.update('indexedFiles', files);
  }

  async getIndexedFiles(): Promise<string[]> {
    return this.context.workspaceState.get('indexedFiles', []);
  }

  async saveApiKeySecurely(provider: string, apiKey: string): Promise<void> {
    await this.context.secrets.store(`devcanvas.apiKey.${provider}`, apiKey);
  }

  async getApiKeySecurely(provider: string): Promise<string | undefined> {
    return await this.context.secrets.get(`devcanvas.apiKey.${provider}`);
  }

  async deleteApiKeySecurely(provider: string): Promise<void> {
    await this.context.secrets.delete(`devcanvas.apiKey.${provider}`);
  }
}