import axios from 'axios';

export interface BitbucketRepository {
  uuid: string;
  name: string;
  full_name: string;
  description?: string;
  website?: string;
  is_private: boolean;
  updated_on: string;
  clone: {
    https: string;
    ssh: string;
  };
  mainbranch?: {
    name: string;
  };
}

export class BitbucketProvider {
  private readonly baseUrl = 'https://api.bitbucket.org/2.0';

  constructor(
    private username: string,
    private appPassword: string
  ) {}

  async getUserRepositories(): Promise<BitbucketRepository[]> {
    try {
      const repositories: BitbucketRepository[] = [];
      let url = `${this.baseUrl}/repositories/${this.username}`;
      
      while (url) {
        const response = await axios.get(url, {
          auth: {
            username: this.username,
            password: this.appPassword
          },
          params: {
            pagelen: 50,
            sort: '-updated_on'
          },
          timeout: 10000
        });

        repositories.push(...response.data.values);
        url = response.data.next; // Pagination
      }

      return repositories;
    } catch (error) {
      console.error('Bitbucket API error:', error);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        throw new Error(`Bitbucket API error (${status}): ${message}`);
      }
      throw new Error('Failed to fetch Bitbucket repositories');
    }
  }

  async getRepository(repoFullName: string): Promise<BitbucketRepository> {
    try {
      const response = await axios.get(`${this.baseUrl}/repositories/${repoFullName}`, {
        auth: {
          username: this.username,
          password: this.appPassword
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      console.error('Bitbucket repository fetch error:', error);
      throw new Error(`Failed to fetch repository ${repoFullName}`);
    }
  }

  async downloadRepositoryArchive(
    repoFullName: string,
    targetPath: string,
    branch: string = 'main'
  ): Promise<void> {
    try {
      // Get the download URL for the archive
      const response = await axios.get(
        `${this.baseUrl}/repositories/${repoFullName}/downloads`,
        {
          auth: {
            username: this.username,
            password: this.appPassword
          },
          timeout: 10000
        }
      );

      // Bitbucket doesn't provide direct archive download via API
      // We need to use git clone or the web interface
      // For now, we'll create a placeholder implementation
      throw new Error('Bitbucket archive download requires git clone. Please use git clone manually.');
      
    } catch (error) {
      console.error('Bitbucket download error:', error);
      throw new Error(`Failed to download repository ${repoFullName}`);
    }
  }

  async getRepositoryFiles(
    repoFullName: string,
    branch: string = 'main',
    path: string = ''
  ): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/repositories/${repoFullName}/src/${branch}/${path}`,
        {
          auth: {
            username: this.username,
            password: this.appPassword
          },
          params: {
            pagelen: 100
          },
          timeout: 10000
        }
      );

      return response.data.values || [];
    } catch (error) {
      console.error('Bitbucket files fetch error:', error);
      throw new Error(`Failed to fetch files for ${repoFullName}`);
    }
  }

  async getFileContent(
    repoFullName: string,
    filePath: string,
    branch: string = 'main'
  ): Promise<string> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/repositories/${repoFullName}/src/${branch}/${filePath}`,
        {
          auth: {
            username: this.username,
            password: this.appPassword
          },
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      console.error('Bitbucket file content error:', error);
      throw new Error(`Failed to fetch file content: ${filePath}`);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/user`, {
        auth: {
          username: this.username,
          password: this.appPassword
        },
        timeout: 5000
      });
      
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  static validateCredentials(username: string, appPassword: string): boolean {
    return username.length > 0 && appPassword.length > 0;
  }
}