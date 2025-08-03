import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface GitCommit {
  hash: string;
  author: string;
  date: Date;
  message: string;
  files: GitFileChange[];
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
}

export interface GitFileChange {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  additions: number;
  deletions: number;
  oldPath?: string; // For renamed files
}

export interface GitBranch {
  name: string;
  isActive: boolean;
  lastCommit: string;
  lastCommitDate: Date;
  ahead: number;
  behind: number;
}

export interface GitRepository {
  path: string;
  currentBranch: string;
  branches: GitBranch[];
  remotes: string[];
  isClean: boolean;
  unstagedFiles: string[];
  stagedFiles: string[];
}

export interface FileHistory {
  filePath: string;
  commits: GitCommit[];
  createdDate: Date;
  lastModified: Date;
  totalCommits: number;
  contributors: string[];
  churnRate: number; // Lines changed per day
  stability: number; // 0-1, higher means more stable
}

export interface CodeEvolution {
  timeRange: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalCommits: number;
    activeContributors: number;
    filesChanged: number;
    linesAdded: number;
    linesDeleted: number;
    averageCommitSize: number;
    hotspots: FileHotspot[];
    trends: EvolutionTrend[];
  };
}

export interface FileHotspot {
  filePath: string;
  changeFrequency: number;
  lastChanged: Date;
  contributors: string[];
  complexity: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
}

export interface EvolutionTrend {
  period: string; // e.g., '2024-01', '2024-Q1'
  commits: number;
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;
  contributors: string[];
}

export interface TemporalContext {
  timestamp: Date;
  commitHash: string;
  branchName: string;
  fileVersions: Map<string, string>; // filePath -> content hash
  codebaseMetrics: {
    totalFiles: number;
    totalLines: number;
    testCoverage?: number;
    complexity?: number;
  };
}

export class GitIntegration {
  private repoPath: string;
  private isGitRepo: boolean = false;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.checkGitRepository();
  }

  private checkGitRepository(): void {
    try {
      execSync('git rev-parse --git-dir', { 
        cwd: this.repoPath, 
        stdio: 'ignore' 
      });
      this.isGitRepo = true;
    } catch {
      this.isGitRepo = false;
    }
  }

  async getRepositoryInfo(): Promise<GitRepository | null> {
    if (!this.isGitRepo) return null;

    try {
      const currentBranch = this.getCurrentBranch();
      const branches = await this.getBranches();
      const remotes = this.getRemotes();
      const status = this.getRepositoryStatus();

      return {
        path: this.repoPath,
        currentBranch,
        branches,
        remotes,
        isClean: status.isClean,
        unstagedFiles: status.unstagedFiles,
        stagedFiles: status.stagedFiles
      };
    } catch (error) {
      console.error('Failed to get repository info:', error);
      return null;
    }
  }

  async getCommitHistory(
    filePath?: string, 
    maxCommits: number = 100,
    since?: Date,
    until?: Date
  ): Promise<GitCommit[]> {
    if (!this.isGitRepo) return [];

    try {
      let command = `git log --pretty=format:"%H|%an|%ad|%s" --date=iso --numstat`;
      
      if (maxCommits > 0) {
        command += ` -${maxCommits}`;
      }
      
      if (since) {
        command += ` --since="${since.toISOString()}"`;
      }
      
      if (until) {
        command += ` --until="${until.toISOString()}"`;
      }
      
      if (filePath) {
        command += ` -- "${filePath}"`;
      }

      const output = execSync(command, { 
        cwd: this.repoPath, 
        encoding: 'utf8' 
      });

      return this.parseCommitHistory(output);
    } catch (error) {
      console.error('Failed to get commit history:', error);
      return [];
    }
  }

  async getFileHistory(filePath: string): Promise<FileHistory | null> {
    if (!this.isGitRepo) return null;

    try {
      const commits = await this.getCommitHistory(filePath);
      
      if (commits.length === 0) return null;

      const contributors = [...new Set(commits.map(c => c.author))];
      const createdDate = commits[commits.length - 1].date;
      const lastModified = commits[0].date;
      
      // Calculate churn rate (changes per day)
      const daysDiff = (lastModified.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      const totalChanges = commits.reduce((sum, c) => sum + c.stats.total, 0);
      const churnRate = daysDiff > 0 ? totalChanges / daysDiff : 0;

      // Calculate stability (fewer recent changes = more stable)
      const recentCommits = commits.filter(c => {
        const daysSinceCommit = (Date.now() - c.date.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCommit <= 30; // Last 30 days
      });
      const stability = Math.max(0, 1 - (recentCommits.length / 10)); // Normalize to 0-1

      return {
        filePath,
        commits,
        createdDate,
        lastModified,
        totalCommits: commits.length,
        contributors,
        churnRate,
        stability
      };
    } catch (error) {
      console.error(`Failed to get file history for ${filePath}:`, error);
      return null;
    }
  }

  async getCodeEvolution(
    startDate: Date, 
    endDate: Date = new Date()
  ): Promise<CodeEvolution> {
    const commits = await this.getCommitHistory(undefined, 0, startDate, endDate);
    
    const metrics = this.calculateEvolutionMetrics(commits, startDate, endDate);
    const hotspots = await this.identifyFileHotspots(commits);
    const trends = this.calculateEvolutionTrends(commits, startDate, endDate);

    return {
      timeRange: { start: startDate, end: endDate },
      metrics: {
        ...metrics,
        hotspots,
        trends
      }
    };
  }

  async getTemporalContext(commitHash?: string): Promise<TemporalContext | null> {
    if (!this.isGitRepo) return null;

    try {
      const hash = commitHash || this.getCurrentCommitHash();
      const branchName = this.getCurrentBranch();
      
      // Get commit info
      const commitInfo = execSync(
        `git show --pretty=format:"%ad" --date=iso --name-only ${hash}`, 
        { cwd: this.repoPath, encoding: 'utf8' }
      );
      
      const lines = commitInfo.split('\n');
      const timestamp = new Date(lines[0]);
      const changedFiles = lines.slice(2).filter(line => line.trim());

      // Get file versions at this commit
      const fileVersions = new Map<string, string>();
      for (const file of changedFiles) {
        try {
          const content = execSync(`git show ${hash}:${file}`, { 
            cwd: this.repoPath, 
            encoding: 'utf8' 
          });
          const hash_ = this.hashContent(content);
          fileVersions.set(file, hash_);
        } catch {
          // File might not exist at this commit
        }
      }

      // Calculate codebase metrics at this point
      const codebaseMetrics = await this.calculateCodebaseMetricsAtCommit(hash);

      return {
        timestamp,
        commitHash: hash,
        branchName,
        fileVersions,
        codebaseMetrics
      };
    } catch (error) {
      console.error('Failed to get temporal context:', error);
      return null;
    }
  }

  async getFileContentAtCommit(filePath: string, commitHash: string): Promise<string | null> {
    if (!this.isGitRepo) return null;

    try {
      return execSync(`git show ${commitHash}:${filePath}`, { 
        cwd: this.repoPath, 
        encoding: 'utf8' 
      });
    } catch {
      return null;
    }
  }

  async getBlameInformation(filePath: string): Promise<BlameInfo[]> {
    if (!this.isGitRepo) return [];

    try {
      const output = execSync(`git blame --porcelain "${filePath}"`, { 
        cwd: this.repoPath, 
        encoding: 'utf8' 
      });

      return this.parseBlameOutput(output);
    } catch (error) {
      console.error(`Failed to get blame info for ${filePath}:`, error);
      return [];
    }
  }

  async getDiffBetweenCommits(
    fromCommit: string, 
    toCommit: string, 
    filePath?: string
  ): Promise<DiffResult> {
    if (!this.isGitRepo) {
      return { additions: 0, deletions: 0, changes: [] };
    }

    try {
      let command = `git diff --numstat ${fromCommit}..${toCommit}`;
      if (filePath) {
        command += ` -- "${filePath}"`;
      }

      const output = execSync(command, { 
        cwd: this.repoPath, 
        encoding: 'utf8' 
      });

      return this.parseDiffOutput(output);
    } catch (error) {
      console.error('Failed to get diff between commits:', error);
      return { additions: 0, deletions: 0, changes: [] };
    }
  }

  // Private helper methods
  private getCurrentBranch(): string {
    try {
      return execSync('git branch --show-current', { 
        cwd: this.repoPath, 
        encoding: 'utf8' 
      }).trim();
    } catch {
      return 'unknown';
    }
  }

  private getCurrentCommitHash(): string {
    try {
      return execSync('git rev-parse HEAD', { 
        cwd: this.repoPath, 
        encoding: 'utf8' 
      }).trim();
    } catch {
      return '';
    }
  }

  private async getBranches(): Promise<GitBranch[]> {
    try {
      const output = execSync('git branch -vv', { 
        cwd: this.repoPath, 
        encoding: 'utf8' 
      });

      return this.parseBranchOutput(output);
    } catch {
      return [];
    }
  }

  private getRemotes(): string[] {
    try {
      const output = execSync('git remote', { 
        cwd: this.repoPath, 
        encoding: 'utf8' 
      });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private getRepositoryStatus(): { isClean: boolean; unstagedFiles: string[]; stagedFiles: string[] } {
    try {
      const output = execSync('git status --porcelain', { 
        cwd: this.repoPath, 
        encoding: 'utf8' 
      });

      const lines = output.trim().split('\n').filter(Boolean);
      const unstagedFiles: string[] = [];
      const stagedFiles: string[] = [];

      for (const line of lines) {
        const status = line.substring(0, 2);
        const filePath = line.substring(3);

        if (status[0] !== ' ' && status[0] !== '?') {
          stagedFiles.push(filePath);
        }
        if (status[1] !== ' ') {
          unstagedFiles.push(filePath);
        }
      }

      return {
        isClean: lines.length === 0,
        unstagedFiles,
        stagedFiles
      };
    } catch {
      return { isClean: true, unstagedFiles: [], stagedFiles: [] };
    }
  }

  private parseCommitHistory(output: string): GitCommit[] {
    const commits: GitCommit[] = [];
    const sections = output.split('\n\n').filter(Boolean);

    for (const section of sections) {
      const lines = section.split('\n');
      if (lines.length < 1) continue;

      const [hash, author, date, message] = lines[0].split('|');
      const files: GitFileChange[] = [];
      let totalAdditions = 0;
      let totalDeletions = 0;

      // Parse file changes
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split('\t');
        if (parts.length >= 3) {
          const additions = parseInt(parts[0]) || 0;
          const deletions = parseInt(parts[1]) || 0;
          const filePath = parts[2];

          totalAdditions += additions;
          totalDeletions += deletions;

          files.push({
            path: filePath,
            status: 'modified', // Simplified
            additions,
            deletions
          });
        }
      }

      commits.push({
        hash,
        author,
        date: new Date(date),
        message,
        files,
        stats: {
          additions: totalAdditions,
          deletions: totalDeletions,
          total: totalAdditions + totalDeletions
        }
      });
    }

    return commits;
  }

  private parseBranchOutput(output: string): GitBranch[] {
    const branches: GitBranch[] = [];
    const lines = output.split('\n').filter(Boolean);

    for (const line of lines) {
      const isActive = line.startsWith('*');
      const trimmed = line.replace(/^\*?\s+/, '');
      const parts = trimmed.split(/\s+/);
      
      if (parts.length >= 2) {
        const name = parts[0];
        const lastCommit = parts[1];
        
        branches.push({
          name,
          isActive,
          lastCommit,
          lastCommitDate: new Date(), // Would need additional command to get exact date
          ahead: 0, // Would need additional parsing
          behind: 0 // Would need additional parsing
        });
      }
    }

    return branches;
  }

  private calculateEvolutionMetrics(
    commits: GitCommit[], 
    startDate: Date, 
    endDate: Date
  ): Omit<CodeEvolution['metrics'], 'hotspots' | 'trends'> {
    const totalCommits = commits.length;
    const contributors = [...new Set(commits.map(c => c.author))];
    const filesChanged = [...new Set(commits.flatMap(c => c.files.map(f => f.path)))];
    
    const linesAdded = commits.reduce((sum, c) => sum + c.stats.additions, 0);
    const linesDeleted = commits.reduce((sum, c) => sum + c.stats.deletions, 0);
    
    const averageCommitSize = totalCommits > 0 ? 
      commits.reduce((sum, c) => sum + c.stats.total, 0) / totalCommits : 0;

    return {
      totalCommits,
      activeContributors: contributors.length,
      filesChanged: filesChanged.length,
      linesAdded,
      linesDeleted,
      averageCommitSize
    };
  }

  private async identifyFileHotspots(commits: GitCommit[]): Promise<FileHotspot[]> {
    const fileStats = new Map<string, {
      changes: number;
      lastChanged: Date;
      contributors: Set<string>;
    }>();

    // Aggregate file change data
    for (const commit of commits) {
      for (const file of commit.files) {
        if (!fileStats.has(file.path)) {
          fileStats.set(file.path, {
            changes: 0,
            lastChanged: commit.date,
            contributors: new Set()
          });
        }

        const stats = fileStats.get(file.path)!;
        stats.changes++;
        stats.contributors.add(commit.author);
        
        if (commit.date > stats.lastChanged) {
          stats.lastChanged = commit.date;
        }
      }
    }

    // Convert to hotspots and calculate risk
    const hotspots: FileHotspot[] = [];
    for (const [filePath, stats] of fileStats) {
      const changeFrequency = stats.changes;
      const complexity = this.assessFileComplexity(filePath);
      const risk = this.assessFileRisk(changeFrequency, stats.contributors.size, complexity);

      hotspots.push({
        filePath,
        changeFrequency,
        lastChanged: stats.lastChanged,
        contributors: [...stats.contributors],
        complexity,
        risk
      });
    }

    // Sort by change frequency (hottest first)
    return hotspots.sort((a, b) => b.changeFrequency - a.changeFrequency).slice(0, 20);
  }

  private calculateEvolutionTrends(
    commits: GitCommit[], 
    startDate: Date, 
    endDate: Date
  ): EvolutionTrend[] {
    const trends: EvolutionTrend[] = [];
    const monthlyData = new Map<string, {
      commits: GitCommit[];
      contributors: Set<string>;
    }>();

    // Group commits by month
    for (const commit of commits) {
      const monthKey = `${commit.date.getFullYear()}-${String(commit.date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          commits: [],
          contributors: new Set()
        });
      }

      const monthData = monthlyData.get(monthKey)!;
      monthData.commits.push(commit);
      monthData.contributors.add(commit.author);
    }

    // Convert to trends
    for (const [period, data] of monthlyData) {
      const linesAdded = data.commits.reduce((sum, c) => sum + c.stats.additions, 0);
      const linesDeleted = data.commits.reduce((sum, c) => sum + c.stats.deletions, 0);
      const filesChanged = [...new Set(data.commits.flatMap(c => c.files.map(f => f.path)))];

      trends.push({
        period,
        commits: data.commits.length,
        linesAdded,
        linesDeleted,
        filesChanged: filesChanged.length,
        contributors: [...data.contributors]
      });
    }

    return trends.sort((a, b) => a.period.localeCompare(b.period));
  }

  private async calculateCodebaseMetricsAtCommit(commitHash: string): Promise<TemporalContext['codebaseMetrics']> {
    try {
      // Get list of files at this commit
      const filesOutput = execSync(`git ls-tree -r --name-only ${commitHash}`, { 
        cwd: this.repoPath, 
        encoding: 'utf8' 
      });
      
      const files = filesOutput.trim().split('\n').filter(Boolean);
      const sourceFiles = files.filter(f => this.isSourceFile(f));
      
      let totalLines = 0;
      
      // Count lines in source files
      for (const file of sourceFiles.slice(0, 100)) { // Limit for performance
        try {
          const content = execSync(`git show ${commitHash}:${file}`, { 
            cwd: this.repoPath, 
            encoding: 'utf8' 
          });
          totalLines += content.split('\n').length;
        } catch {
          // File might not exist or be binary
        }
      }

      return {
        totalFiles: files.length,
        totalLines
      };
    } catch (error) {
      return { totalFiles: 0, totalLines: 0 };
    }
  }

  private parseBlameOutput(output: string): BlameInfo[] {
    const lines = output.split('\n');
    const blameInfo: BlameInfo[] = [];
    
    // Git blame porcelain format parsing would go here
    // This is a simplified version
    
    return blameInfo;
  }

  private parseDiffOutput(output: string): DiffResult {
    const lines = output.trim().split('\n').filter(Boolean);
    let totalAdditions = 0;
    let totalDeletions = 0;
    const changes: DiffChange[] = [];

    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 3) {
        const additions = parseInt(parts[0]) || 0;
        const deletions = parseInt(parts[1]) || 0;
        const filePath = parts[2];

        totalAdditions += additions;
        totalDeletions += deletions;

        changes.push({
          filePath,
          additions,
          deletions,
          status: 'modified'
        });
      }
    }

    return {
      additions: totalAdditions,
      deletions: totalDeletions,
      changes
    };
  }

  private assessFileComplexity(filePath: string): 'low' | 'medium' | 'high' {
    const extension = path.extname(filePath);
    const name = path.basename(filePath);

    // Simple heuristics
    if (name.includes('test') || name.includes('spec')) return 'low';
    if (extension === '.json' || extension === '.yaml' || extension === '.yml') return 'low';
    if (extension === '.js' || extension === '.ts' || extension === '.py') return 'medium';
    if (extension === '.java' || extension === '.cs') return 'high';
    
    return 'medium';
  }

  private assessFileRisk(
    changeFrequency: number, 
    contributorCount: number, 
    complexity: 'low' | 'medium' | 'high'
  ): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // High change frequency increases risk
    if (changeFrequency > 20) riskScore += 2;
    else if (changeFrequency > 10) riskScore += 1;

    // Multiple contributors can increase risk (communication overhead)
    if (contributorCount > 5) riskScore += 2;
    else if (contributorCount > 2) riskScore += 1;

    // Complexity affects risk
    if (complexity === 'high') riskScore += 2;
    else if (complexity === 'medium') riskScore += 1;

    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  private isSourceFile(filePath: string): boolean {
    const sourceExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.cs', '.php', '.rb'];
    return sourceExts.some(ext => filePath.endsWith(ext));
  }

  private hashContent(content: string): string {
    // Simple hash function - in practice, use crypto
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
}

// Additional interfaces
export interface BlameInfo {
  lineNumber: number;
  commitHash: string;
  author: string;
  date: Date;
  content: string;
}

export interface DiffResult {
  additions: number;
  deletions: number;
  changes: DiffChange[];
}

export interface DiffChange {
  filePath: string;
  additions: number;
  deletions: number;
  status: 'added' | 'modified' | 'deleted';
}