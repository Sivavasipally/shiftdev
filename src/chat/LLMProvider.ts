import axios from 'axios';
import { UserProfile, LLMResponse } from '../types';
import { LLMManager, TaskProfile } from '../core/LLMManager';

export class LLMProvider {
  private llmManager: LLMManager;
  
  constructor(private userProfile: UserProfile) {
    this.llmManager = LLMManager.getInstance(userProfile);
  }

  async generateResponse(
    messages: Array<{role: 'user' | 'assistant' | 'system'; content: string}>,
    temperature: number = 0.7,
    taskType: 'classification' | 'embedding' | 'simple_chat' | 'complex_reasoning' | 'code_generation' | 'explanation' | 'analysis' = 'simple_chat'
  ): Promise<LLMResponse> {
    try {
      // Use the new LLM Manager for intelligent model selection and enhanced features
      const taskProfile: TaskProfile = {
        taskType,
        priority: 'medium',
        requiresAccuracy: taskType === 'complex_reasoning' || taskType === 'analysis',
        requiresSpeed: taskType === 'classification' || taskType === 'simple_chat'
      };
      
      const response = await this.llmManager.generateResponse(messages, taskProfile, {
        temperature,
        fallbackModel: this.getFallbackModel()
      });
      
      return response;
    } catch (error) {
      console.warn('LLM Manager failed, falling back to direct provider calls:', error);
      // Fallback to original implementation for backward compatibility
      return this.generateResponseFallback(messages, temperature);
    }
  }
  
  private async generateResponseFallback(
    messages: Array<{role: 'user' | 'assistant' | 'system'; content: string}>,
    temperature: number = 0.7
  ): Promise<LLMResponse> {
    switch (this.userProfile.selectedLLM) {
      case 'gemini-flash':
      case 'gemini-pro':
        return this.callGemini(messages, temperature);
      case 'openai-gpt4':
        return this.callOpenAI(messages, temperature);
      case 'claude-3':
        return this.callClaude(messages, temperature);
      default:
        throw new Error(`Unsupported LLM: ${this.userProfile.selectedLLM}`);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // Use the new LLM Manager for intelligent embedding model selection
      const taskProfile: TaskProfile = {
        taskType: 'embedding',
        priority: 'medium',
        requiresSpeed: true
      };
      
      return await this.llmManager.generateEmbedding(text, taskProfile);
    } catch (error) {
      console.warn('LLM Manager embedding failed, falling back to direct calls:', error);
      // Fallback to original implementation
      return this.generateEmbeddingFallback(text);
    }
  }
  
  private async generateEmbeddingFallback(text: string): Promise<number[]> {
    try {
      // Use the same provider as the selected LLM for embeddings
      if (this.userProfile.selectedLLM.startsWith('openai')) {
        const apiKey = this.getApiKey();
        return this.callOpenAIEmbedding(text, 'text-embedding-ada-002', apiKey);
      } else if (this.userProfile.selectedLLM.startsWith('gemini')) {
        const apiKey = this.getApiKey();
        return this.callGeminiEmbedding(text, 'text-embedding-004', apiKey);
      } else if (this.userProfile.selectedLLM.startsWith('claude')) {
        // Claude doesn't have embeddings, so we'll use a simple fallback
        console.warn('Claude does not support embeddings, using fallback');
        return new Array(768).fill(0);
      }

      throw new Error(`Unsupported LLM for embeddings: ${this.userProfile.selectedLLM}`);
    } catch (error) {
      console.error('Embedding generation failed:', error);
      // Return zero vector as fallback
      return new Array(768).fill(0);
    }
  }

  private async callGemini(
    messages: Array<{role: string; content: string}>,
    temperature: number
  ): Promise<LLMResponse> {
    const apiKey = this.getApiKey();
    const model = this.userProfile.selectedLLM === 'gemini-pro' ? 'gemini-1.5-pro' : 'gemini-1.5-flash';
    
    try {
      const contents = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          contents,
          generationConfig: {
            temperature,
            maxOutputTokens: 4096,
            topP: 0.8,
            topK: 40
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        },
        {
          headers: { 
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (!response.data.candidates || response.data.candidates.length === 0) {
        throw new Error('No response generated from Gemini');
      }

      return {
        content: response.data.candidates[0].content.parts[0].text,
        usage: {
          inputTokens: response.data.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.data.usageMetadata?.candidatesTokenCount || 0
        }
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        throw new Error(`Gemini API error (${status}): ${message}`);
      }
      throw new Error('Failed to get response from Gemini');
    }
  }

  private async callOpenAI(
    messages: Array<{role: string; content: string}>,
    temperature: number
  ): Promise<LLMResponse> {
    const apiKey = this.getApiKey();
    
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4-turbo-preview',
          messages,
          temperature,
          max_tokens: 4096,
          top_p: 0.9,
          frequency_penalty: 0,
          presence_penalty: 0
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return {
        content: response.data.choices[0].message.content,
        usage: {
          inputTokens: response.data.usage.prompt_tokens,
          outputTokens: response.data.usage.completion_tokens
        }
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        throw new Error(`OpenAI API error (${status}): ${message}`);
      }
      throw new Error('Failed to get response from OpenAI');
    }
  }

  private async callClaude(
    messages: Array<{role: string; content: string}>,
    temperature: number
  ): Promise<LLMResponse> {
    const apiKey = this.getApiKey();
    
    try {
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-3-sonnet-20240229',
          messages: conversationMessages,
          system: systemMessage?.content,
          temperature,
          max_tokens: 4096,
          top_p: 0.9
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          timeout: 30000
        }
      );

      return {
        content: response.data.content[0].text,
        usage: {
          inputTokens: response.data.usage.input_tokens,
          outputTokens: response.data.usage.output_tokens
        }
      };
    } catch (error) {
      console.error('Claude API error:', error);
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        throw new Error(`Claude API error (${status}): ${message}`);
      }
      throw new Error('Failed to get response from Claude');
    }
  }

  private async callGeminiEmbedding(text: string, model: string, apiKey: string): Promise<number[]> {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
        {
          content: { 
            parts: [{ text: text.substring(0, 2048) }] // Limit text length
          }
        },
        {
          timeout: 15000
        }
      );

      return response.data.embedding.values;
    } catch (error) {
      console.error('Gemini embedding error:', error);
      throw error;
    }
  }

  private async callOpenAIEmbedding(text: string, model: string, apiKey: string): Promise<number[]> {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          model,
          input: text.substring(0, 8192) // Limit text length
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
    } catch (error) {
      console.error('OpenAI embedding error:', error);
      throw error;
    }
  }

  private getFallbackModel(): string | undefined {
    // Define fallback model based on current selection
    const fallbackMap: Record<string, string> = {
      'gpt-4-turbo': 'gpt-3.5-turbo',
      'claude-3-opus': 'claude-3-sonnet',
      'claude-3-sonnet': 'claude-3-haiku',
      'gemini-1.5-pro': 'gemini-1.5-flash',
      'openai-gpt4': 'gpt-3.5-turbo',
      'claude-3': 'claude-3-haiku',
      'gemini-pro': 'gemini-1.5-flash'
    };
    
    return fallbackMap[this.userProfile.selectedLLM];
  }
  
  updateUserProfile(userProfile: UserProfile): void {
    this.userProfile = userProfile;
    this.llmManager.updateUserProfile(userProfile);
  }
  
  // Enhanced methods using LLM Manager
  async generateWithTaskProfile(
    messages: Array<{role: 'user' | 'assistant' | 'system'; content: string}>,
    taskProfile: TaskProfile,
    options: { temperature?: number; maxTokens?: number; timeout?: number } = {}
  ): Promise<LLMResponse> {
    return this.llmManager.generateResponse(messages, taskProfile, options);
  }
  
  getUsageMetrics(hours: number = 24) {
    return this.llmManager.getUsageMetrics(hours);
  }
  
  getTotalCost(hours: number = 24): number {
    return this.llmManager.getTotalCost(hours);
  }
  
  getAverageLatency(modelKey?: string, hours: number = 24): number {
    return this.llmManager.getAverageLatency(modelKey, hours);
  }
  
  getSuccessRate(modelKey?: string, hours: number = 24): number {
    return this.llmManager.getSuccessRate(modelKey, hours);
  }
  
  getAvailableModels(capability?: 'chat' | 'embedding' | 'codeGeneration' | 'reasoning' | 'vision'): string[] {
    return this.llmManager.getAvailableModels(capability);
  }

  private getApiKey(): string {
    if (!this.userProfile.selectedLLM) {
      throw new Error('No LLM provider selected. Please configure your API keys using the "Configure API Keys" command.');
    }
    
    if (!this.userProfile.apiKeys) {
      throw new Error('No API keys configured. Please configure your API keys using the "Configure API Keys" command.');
    }
    
    const key = this.userProfile.apiKeys[this.userProfile.selectedLLM];
    if (!key) {
      throw new Error(`API key not configured for ${this.userProfile.selectedLLM}. Please configure your API keys using the "Configure API Keys" command.`);
    }
    return key;
  }
}