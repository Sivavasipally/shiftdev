export interface UserProfile {
  id: string;
  name: string;
  selectedLLM: 'gemini-flash' | 'gemini-pro' | 'openai-gpt4' | 'claude-3';
  apiKeys: Record<string, string>;
  embeddingModel: string;
}

export interface CodebaseConfig {
  id: string;
  name: string;
  type: 'local' | 'gitlab' | 'bitbucket' | 'zip';
  path: string;
  lastIndexed: Date;
  totalChunks: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    retrievedChunks?: CodeChunk[];
    diagrams?: DiagramData[];
    tokens?: {
      input: number;
      output: number;
    };
  };
}

export interface CodeChunk {
  id: string;
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  chunkType: 'file' | 'class' | 'function' | 'block';
  metadata: {
    language: string;
    className?: string;
    functionName?: string;
    complexity?: number;
    dependencies?: string[];
  };
  denseVector: number[];
  sparseVector: Record<string, number>;
}

export interface DiagramData {
  type: 'mermaid' | 'plantuml';
  content: string;
  clickableElements: DiagramElement[];
}

export interface DiagramElement {
  id: string;
  filePath: string;
  lineNumber: number;
  elementType: 'class' | 'function' | 'interface';
}

export interface LLMResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AgileStory {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  storyPoints: number;
  reasoning: string;
  dependencies: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  stories: AgileStory[];
  totalStoryPoints: number;
}

export interface QualityMetrics {
  complexity: number;
  maintainabilityIndex: number;
  codeSmells: CodeSmell[];
  securityIssues: SecurityIssue[];
  suggestions: string[];
}

export interface CodeSmell {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  filePath: string;
  lineNumber: number;
  suggestion: string;
}

export interface SecurityIssue {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  filePath: string;
  lineNumber: number;
  recommendation: string;
}

export interface WebviewMessage {
  type: string;
  content?: any;
  error?: string;
}