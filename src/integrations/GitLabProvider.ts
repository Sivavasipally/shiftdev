import axios from 'axios';

export interface GitLabProject {
  id: number;
  name: string;
  path_with_namespace: string;
  web_url: string;
  http_url_to_repo: string;
  default_branch: string;
  description?: string;
  last_activity_at: string;
}

export class GitLabProvider {
  constructor(
    private apiToken: string, 
    private baseUrl: string = 'https://gitlab.com'
  ) {}

  async getUserProjects(): Promise<GitLabProject[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v4/projects`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        params: {
          membership: true,
          per_page: 100,
          order_by: 'last_activity_at',
          sort: 'desc'
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      console.error('GitLab API error:', error);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.message || error.message;
        throw new Error(`GitLab API error (${status}): ${message}`);
      }
      throw new Error('Failed to fetch GitLab projects');
    }
  }

  async getProject(projectId: number): Promise<GitLabProject> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v4/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      console.error('GitLab project fetch error:', error);
      throw new Error(`Failed to fetch project ${projectId}`);
    }
  }

  async downloadProjectArchive(
    projectId: number, 
    targetPath: string,
    branch: string = 'main'
  ): Promise<void> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v4/projects/${projectId}/repository/archive.zip`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          },
          params: {
            sha: branch
          },
          responseType: 'arraybuffer',
          timeout: 30000
        }
      );

      // Save the zip file
      const fs = require('fs');
      const path = require('path');
      
      const zipPath = path.join(targetPath, `project-${projectId}.zip`);
      await fs.promises.writeFile(zipPath, response.data);
      
      // Extract the zip file
      await this.extractZip(zipPath, targetPath);
      
      // Clean up zip file
      await fs.promises.unlink(zipPath);
      
    } catch (error) {
      console.error('GitLab download error:', error);
      throw new Error(`Failed to download project ${projectId}`);
    }
  }

  private async extractZip(zipPath: string, targetPath: string): Promise<void> {
    const JSZip = require('jszip');
    const fs = require('fs');
    const path = require('path');

    try {
      const zipData = await fs.promises.readFile(zipPath);
      const zip = await JSZip.loadAsync(zipData);
      
      // Extract all files
      const extractPromises: Promise<void>[] = [];
      
      zip.forEach((relativePath: string, file: any) => {
        if (!file.dir) {
          const promise = (async () => {
            const content = await file.async('nodebuffer');
            const fullPath = path.join(targetPath, relativePath);
            
            // Ensure directory exists
            await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.promises.writeFile(fullPath, content);
          })();
          
          extractPromises.push(promise);
        }
      });
      
      await Promise.all(extractPromises);
    } catch (error) {
      console.error('Zip extraction error:', error);
      throw new Error('Failed to extract project archive');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v4/user`, {
        headers: {
          'Authorization': `Bearer ${this.apiToken}`
        },
        timeout: 5000
      });
      
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  static validateApiToken(token: string): boolean {
    // GitLab API tokens are typically 20 characters long and alphanumeric
    return /^[a-zA-Z0-9-_]{20,}$/.test(token);
  }
}