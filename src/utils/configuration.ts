import * as vscode from 'vscode';
import { UserProfile, CodebaseConfig } from '../types';

export class Configuration {
  private static readonly USER_PROFILE_KEY = 'userProfile';
  private static readonly CODEBASES_KEY = 'codebases';

  static async getUserProfile(): Promise<UserProfile | null> {
    const config = vscode.workspace.getConfiguration('devcanvas');
    const profileData = config.get<UserProfile>(this.USER_PROFILE_KEY);
    
    if (!profileData) {
      return null;
    }

    // Ensure the profile has the required structure
    if (!profileData.apiKeys) {
      profileData.apiKeys = {};
    }

    return profileData;
  }

  static async saveUserProfile(profile: UserProfile): Promise<void> {
    const config = vscode.workspace.getConfiguration('devcanvas');
    await config.update(this.USER_PROFILE_KEY, profile, vscode.ConfigurationTarget.Global);
  }

  static async getCodebaseConfigs(): Promise<CodebaseConfig[]> {
    const config = vscode.workspace.getConfiguration('devcanvas');
    return config.get<CodebaseConfig[]>(this.CODEBASES_KEY, []);
  }

  static async saveCodebaseConfigs(codebases: CodebaseConfig[]): Promise<void> {
    const config = vscode.workspace.getConfiguration('devcanvas');
    await config.update(this.CODEBASES_KEY, codebases, vscode.ConfigurationTarget.Workspace);
  }

  static async createDefaultProfile(): Promise<UserProfile> {
    const profile: UserProfile = {
      id: this.generateId(),
      name: 'Default User',
      selectedLLM: 'gemini-flash',
      apiKeys: {},
      embeddingModel: 'text-embedding-004'
    };

    await this.saveUserProfile(profile);
    return profile;
  }

  static getMaxChunks(): number {
    const config = vscode.workspace.getConfiguration('devcanvas');
    return config.get('maxChunks', 10);
  }

  static getChunkSize(): number {
    const config = vscode.workspace.getConfiguration('devcanvas');
    return config.get('chunkSize', 1000);
  }

  static isAutoIndexEnabled(): boolean {
    const config = vscode.workspace.getConfiguration('devcanvas');
    return config.get('autoIndex', true);
  }

  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}