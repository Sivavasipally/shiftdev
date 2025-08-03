import axios from 'axios';
import { UserProfile, LLMResponse } from '../types';

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'local';
  model: string;
  endpoint?: string;
  maxTokens: number;
  costPer1KTokens: {
    input: number;
    output: number;
  };
  capabilities: {
    chat: boolean;
    embedding: boolean;
    codeGeneration: boolean;
    reasoning: boolean;
    vision: boolean;
  };
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface TaskProfile {
  taskType: 'classification' | 'embedding' | 'simple_chat' | 'complex_reasoning' | 'code_generation' | 'explanation' | 'analysis';
  priority: 'low' | 'medium' | 'high';
  maxCostPerRequest?: number;
  requiresAccuracy?: boolean;
  requiresSpeed?: boolean;
  maxLatency?: number; // in milliseconds
}

export interface LLMRequestOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  timeout?: number;
  retries?: number;
  fallbackModel?: string;
  systemPrompt?: string;
  streaming?: boolean;
}

export interface LLMUsageMetrics {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  latency: number;
  requestTime: Date;
  success: boolean;
  errorType?: string;
}

export class LLMManager {
  private static instance: LLMManager;
  private modelConfigs: Map<string, LLMConfig> = new Map();
  private userProfile: UserProfile;
  private usageMetrics: LLMUsageMetrics[] = [];
  private rateLimitTracker: Map<string, { requests: number[], tokens: number }> = new Map();

  private constructor(userProfile: UserProfile) {
    this.userProfile = userProfile;
    this.initializeModelConfigs();
  }

  static getInstance(userProfile?: UserProfile): LLMManager {
    if (!LLMManager.instance) {
      if (!userProfile) {
        throw new Error('UserProfile required for first initialization');
      }
      LLMManager.instance = new LLMManager(userProfile);
    }
    return LLMManager.instance;
  }

  updateUserProfile(userProfile: UserProfile): void {
    this.userProfile = userProfile;
  }

  private initializeModelConfigs(): void {
    // OpenAI Models
    this.modelConfigs.set('gpt-4-turbo', {
      provider: 'openai',
      model: 'gpt-4-turbo-preview',
      maxTokens: 128000,
      costPer1KTokens: { input: 0.01, output: 0.03 },
      capabilities: {
        chat: true,
        embedding: false,
        codeGeneration: true,
        reasoning: true,
        vision: true
      },
      rateLimits: {
        requestsPerMinute: 500,
        tokensPerMinute: 10000
      }
    });

    this.modelConfigs.set('gpt-3.5-turbo', {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      maxTokens: 16385,
      costPer1KTokens: { input: 0.0005, output: 0.0015 },
      capabilities: {
        chat: true,
        embedding: false,
        codeGeneration: true,
        reasoning: false,
        vision: false
      },
      rateLimits: {
        requestsPerMinute: 3500,
        tokensPerMinute: 90000
      }
    });

    this.modelConfigs.set('text-embedding-ada-002', {
      provider: 'openai',
      model: 'text-embedding-ada-002',
      maxTokens: 8191,
      costPer1KTokens: { input: 0.0001, output: 0 },
      capabilities: {
        chat: false,
        embedding: true,
        codeGeneration: false,
        reasoning: false,
        vision: false
      },
      rateLimits: {
        requestsPerMinute: 3000,
        tokensPerMinute: 1000000
      }
    });

    // Anthropic Models
    this.modelConfigs.set('claude-3-opus', {
      provider: 'anthropic',
      model: 'claude-3-opus-20240229',
      maxTokens: 200000,
      costPer1KTokens: { input: 0.015, output: 0.075 },
      capabilities: {
        chat: true,
        embedding: false,
        codeGeneration: true,
        reasoning: true,
        vision: true
      },
      rateLimits: {
        requestsPerMinute: 50,
        tokensPerMinute: 40000
      }
    });

    this.modelConfigs.set('claude-3-sonnet', {
      provider: 'anthropic',
      model: 'claude-3-sonnet-20240229',
      maxTokens: 200000,
      costPer1KTokens: { input: 0.003, output: 0.015 },
      capabilities: {
        chat: true,
        embedding: false,
        codeGeneration: true,
        reasoning: true,
        vision: true
      },
      rateLimits: {
        requestsPerMinute: 50,
        tokensPerMinute: 40000
      }
    });

    this.modelConfigs.set('claude-3-haiku', {
      provider: 'anthropic',
      model: 'claude-3-haiku-20240307',
      maxTokens: 200000,
      costPer1KTokens: { input: 0.00025, output: 0.00125 },
      capabilities: {
        chat: true,
        embedding: false,
        codeGeneration: true,
        reasoning: false,
        vision: true
      },
      rateLimits: {
        requestsPerMinute: 50,
        tokensPerMinute: 40000
      }
    });

    // Google Models
    this.modelConfigs.set('gemini-1.5-pro', {
      provider: 'google',
      model: 'gemini-1.5-pro',
      maxTokens: 2097152,
      costPer1KTokens: { input: 0.0035, output: 0.0105 },
      capabilities: {
        chat: true,
        embedding: false,
        codeGeneration: true,
        reasoning: true,
        vision: true
      },
      rateLimits: {
        requestsPerMinute: 360,
        tokensPerMinute: 32000
      }
    });

    this.modelConfigs.set('gemini-1.5-flash', {
      provider: 'google',
      model: 'gemini-1.5-flash',
      maxTokens: 1048576,
      costPer1KTokens: { input: 0.000075, output: 0.0003 },
      capabilities: {
        chat: true,
        embedding: false,
        codeGeneration: true,
        reasoning: false,
        vision: true
      },
      rateLimits: {
        requestsPerMinute: 1000,
        tokensPerMinute: 4000000
      }
    });

    this.modelConfigs.set('text-embedding-004', {
      provider: 'google',
      model: 'text-embedding-004',
      maxTokens: 2048,
      costPer1KTokens: { input: 0.000025, output: 0 },
      capabilities: {
        chat: false,
        embedding: true,
        codeGeneration: false,
        reasoning: false,
        vision: false
      },
      rateLimits: {
        requestsPerMinute: 1500,
        tokensPerMinute: 2000000
      }
    });
  }

  async generateResponse(
    messages: Array<{role: 'user' | 'assistant' | 'system'; content: string}>,
    taskProfile: TaskProfile,
    options: LLMRequestOptions = {}
  ): Promise<LLMResponse> {
    const selectedModel = this.selectOptimalModel(taskProfile, 'chat');
    const startTime = Date.now();

    try {
      // Check rate limits
      await this.checkRateLimits(selectedModel);

      let response: LLMResponse;
      const modelConfig = this.modelConfigs.get(selectedModel)!;

      switch (modelConfig.provider) {
        case 'openai':
          response = await this.callOpenAI(selectedModel, messages, options);
          break;
        case 'anthropic':
          response = await this.callAnthropic(selectedModel, messages, options);
          break;
        case 'google':
          response = await this.callGoogle(selectedModel, messages, options);
          break;
        default:
          throw new Error(`Unsupported provider: ${modelConfig.provider}`);
      }

      // Record successful usage
      this.recordUsage({
        provider: modelConfig.provider,
        model: selectedModel,
        inputTokens: response.usage?.inputTokens || 0,
        outputTokens: response.usage?.outputTokens || 0,
        totalCost: this.calculateCost(selectedModel, response.usage?.inputTokens || 0, response.usage?.outputTokens || 0),
        latency: Date.now() - startTime,
        requestTime: new Date(),
        success: true
      });

      return response;

    } catch (error) {
      console.error(`LLM request failed for model ${selectedModel}:`, error);

      // Record failed usage
      this.recordUsage({
        provider: this.modelConfigs.get(selectedModel)!.provider,
        model: selectedModel,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        latency: Date.now() - startTime,
        requestTime: new Date(),
        success: false,
        errorType: error instanceof Error ? error.message : 'Unknown error'
      });

      // Try fallback model if specified
      if (options.fallbackModel && options.fallbackModel !== selectedModel) {
        console.log(`Trying fallback model: ${options.fallbackModel}`);
        return this.generateResponse(messages, taskProfile, { ...options, fallbackModel: undefined });
      }

      throw error;
    }
  }

  async generateEmbedding(
    text: string,
    taskProfile: TaskProfile,
    options: LLMRequestOptions = {}
  ): Promise<number[]> {
    const selectedModel = this.selectOptimalModel(taskProfile, 'embedding');
    const startTime = Date.now();

    try {
      await this.checkRateLimits(selectedModel);

      let embedding: number[];
      const modelConfig = this.modelConfigs.get(selectedModel)!;

      switch (modelConfig.provider) {
        case 'openai':
          embedding = await this.callOpenAIEmbedding(selectedModel, text);
          break;
        case 'google':
          embedding = await this.callGoogleEmbedding(selectedModel, text);
          break;
        default:
          throw new Error(`Provider ${modelConfig.provider} does not support embeddings`);
      }

      // Record successful usage
      this.recordUsage({
        provider: modelConfig.provider,
        model: selectedModel,
        inputTokens: this.estimateTokens(text),
        outputTokens: 0,
        totalCost: this.calculateCost(selectedModel, this.estimateTokens(text), 0),
        latency: Date.now() - startTime,
        requestTime: new Date(),
        success: true
      });

      return embedding;

    } catch (error) {
      console.error(`Embedding generation failed for model ${selectedModel}:`, error);

      // Record failed usage
      this.recordUsage({
        provider: this.modelConfigs.get(selectedModel)!.provider,
        model: selectedModel,
        inputTokens: 0,
        outputTokens: 0,
        totalCost: 0,
        latency: Date.now() - startTime,
        requestTime: new Date(),
        success: false,
        errorType: error instanceof Error ? error.message : 'Unknown error'
      });

      // Fallback to zero vector
      console.warn('Returning zero vector as fallback');
      return new Array(768).fill(0);
    }
  }

  private selectOptimalModel(taskProfile: TaskProfile, capability: keyof LLMConfig['capabilities']): string {
    // Filter models by capability
    const capableModels = Array.from(this.modelConfigs.entries())
      .filter(([key, config]) => config.capabilities[capability])
      .filter(([key, config]) => this.hasApiKey(config.provider));

    if (capableModels.length === 0) {
      throw new Error(`No models available for capability: ${capability}`);
    }

    // Task-specific model selection logic
    switch (taskProfile.taskType) {
      case 'classification':
      case 'embedding':
        // Prefer fast, cheap models
        return this.selectByPriority(capableModels, ['cost', 'speed']);

      case 'simple_chat':
        // Balance cost and quality
        if (taskProfile.priority === 'low') {
          return this.selectByPriority(capableModels, ['cost', 'speed']);
        }
        return this.selectByPriority(capableModels, ['speed', 'quality']);

      case 'complex_reasoning':
      case 'analysis':
        // Prefer high-quality models
        return this.selectByPriority(capableModels, ['quality', 'reasoning']);

      case 'code_generation':
        // Prefer models good at code
        return this.selectByPriority(capableModels, ['codeGeneration', 'quality']);

      case 'explanation':
        // Balance quality and cost
        return this.selectByPriority(capableModels, ['quality', 'cost']);

      default:
        // Default to user's preferred model if available
        const userPreferred = this.userProfile.selectedLLM;
        if (userPreferred && capableModels.some(([key]) => key.includes(userPreferred))) {
          return capableModels.find(([key]) => key.includes(userPreferred))![0];
        }
        return capableModels[0][0];
    }
  }

  private selectByPriority(
    models: Array<[string, LLMConfig]>, 
    priorities: Array<'cost' | 'speed' | 'quality' | 'reasoning' | 'codeGeneration'>
  ): string {
    // Simple scoring system - could be made more sophisticated
    const scored = models.map(([key, config]) => {
      let score = 0;
      
      priorities.forEach((priority, index) => {
        const weight = priorities.length - index; // Higher weight for earlier priorities
        
        switch (priority) {
          case 'cost':
            // Lower cost = higher score
            score += weight * (1 / (config.costPer1KTokens.input + config.costPer1KTokens.output));
            break;
          case 'speed':
            // Higher rate limits = higher score (proxy for speed)
            score += weight * (config.rateLimits.requestsPerMinute / 1000);
            break;
          case 'quality':
            // Heuristic: more expensive models are generally better quality
            if (config.costPer1KTokens.input > 0.01) score += weight * 3;
            else if (config.costPer1KTokens.input > 0.001) score += weight * 2;
            else score += weight * 1;
            break;
          case 'reasoning':
            if (config.capabilities.reasoning) score += weight * 2;
            break;
          case 'codeGeneration':
            if (config.capabilities.codeGeneration) score += weight * 2;
            break;
        }
      });
      
      return { key, score };
    });

    return scored.sort((a, b) => b.score - a.score)[0].key;
  }

  private async checkRateLimits(modelKey: string): Promise<void> {
    const config = this.modelConfigs.get(modelKey);
    if (!config) return;

    const now = Date.now();
    const tracker = this.rateLimitTracker.get(modelKey) || { requests: [], tokens: 0 };

    // Clean old requests (older than 1 minute)
    tracker.requests = tracker.requests.filter(time => now - time < 60000);

    // Check request rate limit
    if (tracker.requests.length >= config.rateLimits.requestsPerMinute) {
      const waitTime = 60000 - (now - tracker.requests[0]);
      throw new Error(`Rate limit exceeded for ${modelKey}. Wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }

    // Record this request
    tracker.requests.push(now);
    this.rateLimitTracker.set(modelKey, tracker);
  }

  private hasApiKey(provider: string): boolean {
    if (!this.userProfile.apiKeys) return false;

    switch (provider) {
      case 'openai':
        return 'openai-gpt4' in this.userProfile.apiKeys;
      case 'anthropic':
        return 'claude-3' in this.userProfile.apiKeys;
      case 'google':
        return 'gemini-pro' in this.userProfile.apiKeys || 'gemini-flash' in this.userProfile.apiKeys;
      default:
        return false;
    }
  }

  private getApiKey(provider: string): string {
    if (!this.userProfile.apiKeys) {
      throw new Error('No API keys configured');
    }

    switch (provider) {
      case 'openai':
        return this.userProfile.apiKeys['openai-gpt4'];
      case 'anthropic':
        return this.userProfile.apiKeys['claude-3'];
      case 'google':
        return this.userProfile.apiKeys['gemini-pro'] || this.userProfile.apiKeys['gemini-flash'];
      default:
        throw new Error(`No API key for provider: ${provider}`);
    }
  }

  private calculateCost(modelKey: string, inputTokens: number, outputTokens: number): number {
    const config = this.modelConfigs.get(modelKey);
    if (!config) return 0;

    return (inputTokens / 1000) * config.costPer1KTokens.input + 
           (outputTokens / 1000) * config.costPer1KTokens.output;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private recordUsage(metrics: LLMUsageMetrics): void {
    this.usageMetrics.push(metrics);
    
    // Keep only last 1000 records to prevent memory leaks
    if (this.usageMetrics.length > 1000) {
      this.usageMetrics = this.usageMetrics.slice(-1000);
    }
  }

  // API implementation methods (simplified versions of existing LLMProvider methods)
  private async callOpenAI(
    modelKey: string,
    messages: Array<{role: string; content: string}>,
    options: LLMRequestOptions
  ): Promise<LLMResponse> {
    const config = this.modelConfigs.get(modelKey)!;
    const apiKey = this.getApiKey('openai');

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: config.model,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: Math.min(options.maxTokens || 4096, config.maxTokens),
        top_p: options.topP || 0.9
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: options.timeout || 30000
      }
    );

    return {
      content: response.data.choices[0].message.content,
      usage: {
        inputTokens: response.data.usage.prompt_tokens,
        outputTokens: response.data.usage.completion_tokens
      }
    };
  }

  private async callAnthropic(
    modelKey: string,
    messages: Array<{role: string; content: string}>,
    options: LLMRequestOptions
  ): Promise<LLMResponse> {
    const config = this.modelConfigs.get(modelKey)!;
    const apiKey = this.getApiKey('anthropic');

    const systemMessage = messages.find(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: config.model,
        messages: conversationMessages,
        system: systemMessage?.content,
        temperature: options.temperature || 0.7,
        max_tokens: Math.min(options.maxTokens || 4096, config.maxTokens),
        top_p: options.topP || 0.9
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: options.timeout || 30000
      }
    );

    return {
      content: response.data.content[0].text,
      usage: {
        inputTokens: response.data.usage.input_tokens,
        outputTokens: response.data.usage.output_tokens
      }
    };
  }

  private async callGoogle(
    modelKey: string,
    messages: Array<{role: string; content: string}>,
    options: LLMRequestOptions
  ): Promise<LLMResponse> {
    const config = this.modelConfigs.get(modelKey)!;
    const apiKey = this.getApiKey('google');

    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`,
      {
        contents,
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: Math.min(options.maxTokens || 4096, config.maxTokens),
          topP: options.topP || 0.8,
          topK: options.topK || 40
        }
      },
      {
        timeout: options.timeout || 30000
      }
    );

    return {
      content: response.data.candidates[0].content.parts[0].text,
      usage: {
        inputTokens: response.data.usageMetadata?.promptTokenCount || 0,
        outputTokens: response.data.usageMetadata?.candidatesTokenCount || 0
      }
    };
  }

  private async callOpenAIEmbedding(modelKey: string, text: string): Promise<number[]> {
    const config = this.modelConfigs.get(modelKey)!;
    const apiKey = this.getApiKey('openai');

    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        model: config.model,
        input: text.substring(0, config.maxTokens * 4) // Rough token limit
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    return response.data.data[0].embedding;
  }

  private async callGoogleEmbedding(modelKey: string, text: string): Promise<number[]> {
    const config = this.modelConfigs.get(modelKey)!;
    const apiKey = this.getApiKey('google');

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:embedContent?key=${apiKey}`,
      {
        content: { 
          parts: [{ text: text.substring(0, config.maxTokens * 4) }]
        }
      },
      {
        timeout: 15000
      }
    );

    return response.data.embedding.values;
  }

  // Analytics and monitoring methods
  getUsageMetrics(timeRangeHours: number = 24): LLMUsageMetrics[] {
    const cutoff = new Date(Date.now() - timeRangeHours * 60 * 60 * 1000);
    return this.usageMetrics.filter(metric => metric.requestTime >= cutoff);
  }

  getTotalCost(timeRangeHours: number = 24): number {
    return this.getUsageMetrics(timeRangeHours)
      .reduce((total, metric) => total + metric.totalCost, 0);
  }

  getAverageLatency(modelKey?: string, timeRangeHours: number = 24): number {
    let metrics = this.getUsageMetrics(timeRangeHours).filter(m => m.success);
    if (modelKey) {
      metrics = metrics.filter(m => m.model === modelKey);
    }
    
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length;
  }

  getSuccessRate(modelKey?: string, timeRangeHours: number = 24): number {
    let metrics = this.getUsageMetrics(timeRangeHours);
    if (modelKey) {
      metrics = metrics.filter(m => m.model === modelKey);
    }
    
    if (metrics.length === 0) return 1.0;
    return metrics.filter(m => m.success).length / metrics.length;
  }

  // Configuration methods
  addCustomModel(key: string, config: LLMConfig): void {
    this.modelConfigs.set(key, config);
  }

  getAvailableModels(capability?: keyof LLMConfig['capabilities']): string[] {
    const models = Array.from(this.modelConfigs.entries());
    
    if (capability) {
      return models
        .filter(([key, config]) => config.capabilities[capability])
        .filter(([key, config]) => this.hasApiKey(config.provider))
        .map(([key]) => key);
    }
    
    return models
      .filter(([key, config]) => this.hasApiKey(config.provider))
      .map(([key]) => key);
  }

  getModelConfig(modelKey: string): LLMConfig | undefined {
    return this.modelConfigs.get(modelKey);
  }
}