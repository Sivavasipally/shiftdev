import { LLMManager, TaskProfile } from './LLMManager';
import { UserProfile } from '../types';
import { QueryComponent, DecomposedQuery } from './QueryDecomposer';
import { HybridSearchResult } from './HybridSearchEngine';
import { ContentChunk } from './ContentProcessor';

export interface ThoughtStep {
  id: string;
  stepNumber: number;
  type: 'analysis' | 'synthesis' | 'reasoning' | 'validation' | 'conclusion';
  description: string;
  input: any;
  output: any;
  reasoning: string;
  confidence: number;
  dependencies: string[]; // IDs of previous steps this depends on
  metadata: Record<string, any>;
}

export interface ThoughtChain {
  id: string;
  query: string;
  goal: string;
  steps: ThoughtStep[];
  finalConclusion: string;
  overallConfidence: number;
  executionTime: number;
  usedSources: string[];
  reasoningPath: string[];
}

export interface Agent {
  id: string;
  name: string;
  role: string;
  expertise: string[];
  capabilities: AgentCapability[];
  maxConcurrentTasks: number;
  currentTasks: number;
  llmProfile: TaskProfile;
}

export interface AgentCapability {
  name: string;
  description: string;
  inputTypes: string[];
  outputTypes: string[];
  complexity: 'simple' | 'moderate' | 'complex' | 'expert';
}

export interface AgentTask {
  id: string;
  agentId: string;
  type: string;
  input: any;
  output?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  dependencies: string[];
  priority: number;
}

export interface MultiAgentWorkflow {
  id: string;
  name: string;
  description: string;
  agents: Agent[];
  tasks: AgentTask[];
  coordinationStrategy: 'sequential' | 'parallel' | 'hierarchical' | 'democratic';
  communicationProtocol: CommunicationProtocol;
  results: WorkflowResult[];
}

export interface CommunicationProtocol {
  messageFormat: 'json' | 'structured' | 'natural';
  validationRequired: boolean;
  consensusThreshold: number; // For democratic coordination
  conflictResolution: 'majority' | 'expert' | 'confidence' | 'user';
}

export interface WorkflowResult {
  taskId: string;
  agentId: string;
  result: any;
  confidence: number;
  reasoning: string;
  timestamp: Date;
}

export interface ChainOfThoughtOptions {
  maxSteps: number;
  confidenceThreshold: number;
  enableSelfCorrection: boolean;
  enableMultipleHypotheses: boolean;
  verboseReasoning: boolean;
  useMultipleAgents: boolean;
  agentCollaboration: boolean;
}

export class ChainOfThoughtEngine {
  private llmManager: LLMManager;
  private agents: Map<string, Agent> = new Map();
  private activeWorkflows: Map<string, MultiAgentWorkflow> = new Map();
  private thoughtHistory: Map<string, ThoughtChain[]> = new Map();

  constructor(userProfile: UserProfile) {
    this.llmManager = LLMManager.getInstance(userProfile);
    this.initializeAgents();
  }

  async executeChainOfThought(
    query: string,
    decomposedQuery: DecomposedQuery,
    searchResults: HybridSearchResult[],
    options: ChainOfThoughtOptions = this.getDefaultOptions()
  ): Promise<ThoughtChain> {
    console.log(`🧠 Phase 5: Executing chain-of-thought reasoning for: "${query}"`);

    const chainId = `chain_${Date.now()}`;
    const startTime = Date.now();

    const thoughtChain: ThoughtChain = {
      id: chainId,
      query,
      goal: this.extractGoal(query, decomposedQuery),
      steps: [],
      finalConclusion: '',
      overallConfidence: 0,
      executionTime: 0,
      usedSources: [],
      reasoningPath: []
    };

    try {
      // Step 1: Initial analysis
      await this.addAnalysisStep(thoughtChain, decomposedQuery, searchResults, options);

      // Step 2: Synthesis of information
      await this.addSynthesisStep(thoughtChain, searchResults, options);

      // Step 3: Reasoning and hypothesis formation
      await this.addReasoningStep(thoughtChain, options);

      // Step 4: Validation and verification
      if (options.enableSelfCorrection) {
        await this.addValidationStep(thoughtChain, options);
      }

      // Step 5: Final conclusion
      await this.addConclusionStep(thoughtChain, options);

      // Calculate final metrics
      thoughtChain.executionTime = Date.now() - startTime;
      thoughtChain.overallConfidence = this.calculateOverallConfidence(thoughtChain.steps);
      thoughtChain.reasoningPath = this.extractReasoningPath(thoughtChain.steps);
      thoughtChain.usedSources = this.extractUsedSources(thoughtChain.steps);

      // Store in history
      this.storeThoughtChain(query, thoughtChain);

      console.log(`🧠 Chain-of-thought completed with ${thoughtChain.steps.length} steps (confidence: ${(thoughtChain.overallConfidence * 100).toFixed(1)}%)`);

    } catch (error) {
      console.error('Chain-of-thought execution failed:', error);
      thoughtChain.finalConclusion = `Reasoning failed: ${error}`;
      thoughtChain.overallConfidence = 0;
    }

    return thoughtChain;
  }

  async executeMultiAgentWorkflow(
    query: string,
    decomposedQuery: DecomposedQuery,
    searchResults: HybridSearchResult[],
    workflowType: string = 'collaborative_analysis'
  ): Promise<MultiAgentWorkflow> {
    console.log(`🤖 Phase 5: Executing multi-agent workflow: ${workflowType}`);

    const workflowId = `workflow_${Date.now()}`;
    const workflow = this.createWorkflow(workflowId, workflowType, query, decomposedQuery);

    try {
      // Assign tasks to agents
      await this.assignTasks(workflow, decomposedQuery, searchResults);

      // Execute workflow based on coordination strategy
      await this.executeWorkflow(workflow);

      // Synthesize results
      await this.synthesizeWorkflowResults(workflow);

      console.log(`🤖 Multi-agent workflow completed with ${workflow.tasks.length} tasks`);

    } catch (error) {
      console.error('Multi-agent workflow failed:', error);
    }

    return workflow;
  }

  private async addAnalysisStep(
    thoughtChain: ThoughtChain,
    decomposedQuery: DecomposedQuery,
    searchResults: HybridSearchResult[],
    options: ChainOfThoughtOptions
  ): Promise<void> {
    const stepId = `analysis_${thoughtChain.steps.length + 1}`;
    
    const analysisPrompt = this.buildAnalysisPrompt(thoughtChain.query, decomposedQuery, searchResults);
    
    const taskProfile: TaskProfile = {
      taskType: 'analysis',
      priority: 'high',
      requiresAccuracy: true
    };

    const llmResponse = await this.llmManager.generateResponse([
      { role: 'system', content: 'You are an expert code analyst. Break down the query and analyze the available information systematically.' },
      { role: 'user', content: analysisPrompt }
    ], taskProfile);

    const analysisResult = this.parseStepResult(llmResponse.content, 'analysis');

    const step: ThoughtStep = {
      id: stepId,
      stepNumber: thoughtChain.steps.length + 1,
      type: 'analysis',
      description: 'Initial analysis of query and available information',
      input: { query: thoughtChain.query, components: decomposedQuery.components, resultsCount: searchResults.length },
      output: analysisResult,
      reasoning: analysisResult.reasoning || 'Systematic breakdown of the query components and available search results',
      confidence: analysisResult.confidence || 0.8,
      dependencies: [],
      metadata: {
        queryComplexity: decomposedQuery.queryType,
        componentCount: decomposedQuery.components.length,
        resultQuality: this.assessResultQuality(searchResults)
      }
    };

    thoughtChain.steps.push(step);
  }

  private async addSynthesisStep(
    thoughtChain: ThoughtChain,
    searchResults: HybridSearchResult[],
    options: ChainOfThoughtOptions
  ): Promise<void> {
    const stepId = `synthesis_${thoughtChain.steps.length + 1}`;
    const previousStep = thoughtChain.steps[thoughtChain.steps.length - 1];

    const synthesisPrompt = this.buildSynthesisPrompt(thoughtChain, searchResults, previousStep);

    const taskProfile: TaskProfile = {
      taskType: 'analysis',
      priority: 'high',
      requiresAccuracy: true
    };

    const llmResponse = await this.llmManager.generateResponse([
      { role: 'system', content: 'You are an expert at synthesizing information from multiple sources. Combine insights coherently.' },
      { role: 'user', content: synthesisPrompt }
    ], taskProfile);

    const synthesisResult = this.parseStepResult(llmResponse.content, 'synthesis');

    const step: ThoughtStep = {
      id: stepId,
      stepNumber: thoughtChain.steps.length + 1,
      type: 'synthesis',
      description: 'Synthesis of information from multiple sources',
      input: { 
        previousAnalysis: previousStep.output, 
        searchResults: searchResults.slice(0, 10).map(r => ({ id: r.id, score: r.combinedScore, explanation: r.explanation }))
      },
      output: synthesisResult,
      reasoning: synthesisResult.reasoning || 'Combined insights from analysis and search results',
      confidence: synthesisResult.confidence || 0.75,
      dependencies: [previousStep.id],
      metadata: {
        sourceCount: searchResults.length,
        highConfidenceResults: searchResults.filter(r => r.combinedScore > 0.8).length
      }
    };

    thoughtChain.steps.push(step);
  }

  private async addReasoningStep(
    thoughtChain: ThoughtChain,
    options: ChainOfThoughtOptions
  ): Promise<void> {
    const stepId = `reasoning_${thoughtChain.steps.length + 1}`;
    const previousSteps = thoughtChain.steps.slice(-2); // Last 2 steps

    const reasoningPrompt = this.buildReasoningPrompt(thoughtChain, previousSteps, options);

    const taskProfile: TaskProfile = {
      taskType: 'complex_reasoning',
      priority: 'high',
      requiresAccuracy: true
    };

    const llmResponse = await this.llmManager.generateResponse([
      { role: 'system', content: 'You are an expert reasoning engine. Form logical conclusions and consider multiple hypotheses.' },
      { role: 'user', content: reasoningPrompt }
    ], taskProfile);

    const reasoningResult = this.parseStepResult(llmResponse.content, 'reasoning');

    const step: ThoughtStep = {
      id: stepId,
      stepNumber: thoughtChain.steps.length + 1,
      type: 'reasoning',
      description: 'Logical reasoning and hypothesis formation',
      input: { 
        previousSteps: previousSteps.map(s => ({ id: s.id, type: s.type, output: s.output })),
        goal: thoughtChain.goal
      },
      output: reasoningResult,
      reasoning: reasoningResult.reasoning || 'Applied logical reasoning to form conclusions',
      confidence: reasoningResult.confidence || 0.7,
      dependencies: previousSteps.map(s => s.id),
      metadata: {
        hypotheses: reasoningResult.hypotheses || [],
        alternatives: reasoningResult.alternatives || []
      }
    };

    thoughtChain.steps.push(step);
  }

  private async addValidationStep(
    thoughtChain: ThoughtChain,
    options: ChainOfThoughtOptions
  ): Promise<void> {
    const stepId = `validation_${thoughtChain.steps.length + 1}`;
    const reasoningStep = thoughtChain.steps[thoughtChain.steps.length - 1];

    const validationPrompt = this.buildValidationPrompt(thoughtChain, reasoningStep);

    const taskProfile: TaskProfile = {
      taskType: 'analysis',
      priority: 'medium',
      requiresAccuracy: true
    };

    const llmResponse = await this.llmManager.generateResponse([
      { role: 'system', content: 'You are a critical validator. Check reasoning for errors, gaps, and alternative explanations.' },
      { role: 'user', content: validationPrompt }
    ], taskProfile);

    const validationResult = this.parseStepResult(llmResponse.content, 'validation');

    const step: ThoughtStep = {
      id: stepId,
      stepNumber: thoughtChain.steps.length + 1,
      type: 'validation',
      description: 'Validation and error checking of reasoning',
      input: { reasoningToValidate: reasoningStep.output },
      output: validationResult,
      reasoning: validationResult.reasoning || 'Critical review of previous reasoning',
      confidence: validationResult.confidence || 0.8,
      dependencies: [reasoningStep.id],
      metadata: {
        errorsFound: validationResult.errors || [],
        improvements: validationResult.improvements || []
      }
    };

    thoughtChain.steps.push(step);
  }

  private async addConclusionStep(
    thoughtChain: ThoughtChain,
    options: ChainOfThoughtOptions
  ): Promise<void> {
    const stepId = `conclusion_${thoughtChain.steps.length + 1}`;
    const allSteps = thoughtChain.steps;

    const conclusionPrompt = this.buildConclusionPrompt(thoughtChain, allSteps);

    const taskProfile: TaskProfile = {
      taskType: 'complex_reasoning',
      priority: 'high',
      requiresAccuracy: true
    };

    const llmResponse = await this.llmManager.generateResponse([
      { role: 'system', content: 'You are an expert at drawing final conclusions. Synthesize all reasoning into a clear, actionable answer.' },
      { role: 'user', content: conclusionPrompt }
    ], taskProfile);

    const conclusionResult = this.parseStepResult(llmResponse.content, 'conclusion');

    const step: ThoughtStep = {
      id: stepId,
      stepNumber: thoughtChain.steps.length + 1,
      type: 'conclusion',
      description: 'Final conclusion and recommendations',
      input: { allSteps: allSteps.map(s => ({ id: s.id, type: s.type, output: s.output })) },
      output: conclusionResult,
      reasoning: conclusionResult.reasoning || 'Final synthesis of all reasoning steps',
      confidence: conclusionResult.confidence || 0.75,
      dependencies: allSteps.map(s => s.id),
      metadata: {
        recommendations: conclusionResult.recommendations || [],
        nextSteps: conclusionResult.nextSteps || []
      }
    };

    thoughtChain.steps.push(step);
    thoughtChain.finalConclusion = conclusionResult.conclusion || conclusionResult.summary || 'Analysis completed';
  }

  private createWorkflow(
    workflowId: string,
    workflowType: string,
    query: string,
    decomposedQuery: DecomposedQuery
  ): MultiAgentWorkflow {
    const workflowTemplates = {
      collaborative_analysis: {
        name: 'Collaborative Code Analysis',
        description: 'Multiple agents analyze different aspects of the code',
        coordinationStrategy: 'parallel' as const,
        agents: ['code_analyst', 'architecture_expert', 'security_specialist']
      },
      hierarchical_review: {
        name: 'Hierarchical Code Review',
        description: 'Tiered analysis from junior to senior experts',
        coordinationStrategy: 'hierarchical' as const,
        agents: ['junior_analyst', 'senior_developer', 'tech_lead']
      },
      consensus_building: {
        name: 'Consensus Building',
        description: 'Multiple experts reach consensus on complex issues',
        coordinationStrategy: 'democratic' as const,
        agents: ['expert_1', 'expert_2', 'expert_3', 'moderator']
      }
    };

    const template = workflowTemplates[workflowType as keyof typeof workflowTemplates] || workflowTemplates.collaborative_analysis;

    return {
      id: workflowId,
      name: template.name,
      description: template.description,
      agents: template.agents.map(agentId => this.agents.get(agentId)!).filter(Boolean),
      tasks: [],
      coordinationStrategy: template.coordinationStrategy,
      communicationProtocol: {
        messageFormat: 'structured',
        validationRequired: true,
        consensusThreshold: 0.7,
        conflictResolution: 'confidence'
      },
      results: []
    };
  }

  private async assignTasks(
    workflow: MultiAgentWorkflow,
    decomposedQuery: DecomposedQuery,
    searchResults: HybridSearchResult[]
  ): Promise<void> {
    let taskCounter = 0;

    for (const component of decomposedQuery.components) {
      // Find the best agent for this component
      const agent = this.findBestAgent(workflow.agents, component);
      
      if (agent) {
        const task: AgentTask = {
          id: `task_${++taskCounter}`,
          agentId: agent.id,
          type: component.type,
          input: {
            component,
            relevantResults: searchResults.filter(r => 
              r.matchingKeywords.some(k => component.keywords.includes(k))
            ).slice(0, 5)
          },
          status: 'pending',
          dependencies: [],
          priority: component.priority
        };

        workflow.tasks.push(task);
      }
    }

    // Add coordination tasks if needed
    if (workflow.coordinationStrategy === 'hierarchical') {
      this.addCoordinationTasks(workflow);
    }
  }

  private async executeWorkflow(workflow: MultiAgentWorkflow): Promise<void> {
    switch (workflow.coordinationStrategy) {
      case 'parallel':
        await this.executeParallelWorkflow(workflow);
        break;
      case 'sequential':
        await this.executeSequentialWorkflow(workflow);
        break;
      case 'hierarchical':
        await this.executeHierarchicalWorkflow(workflow);
        break;
      case 'democratic':
        await this.executeDemocraticWorkflow(workflow);
        break;
    }
  }

  private async executeParallelWorkflow(workflow: MultiAgentWorkflow): Promise<void> {
    const taskPromises = workflow.tasks.map(task => this.executeAgentTask(workflow, task));
    
    const results = await Promise.allSettled(taskPromises);
    
    results.forEach((result, index) => {
      const task = workflow.tasks[index];
      if (result.status === 'fulfilled') {
        task.status = 'completed';
        task.output = result.value;
        task.endTime = new Date();
      } else {
        task.status = 'failed';
        console.error(`Task ${task.id} failed:`, result.reason);
      }
    });
  }

  private async executeSequentialWorkflow(workflow: MultiAgentWorkflow): Promise<void> {
    // Sort tasks by priority and dependencies
    const sortedTasks = this.topologicalSort(workflow.tasks);
    
    for (const task of sortedTasks) {
      try {
        task.status = 'running';
        task.startTime = new Date();
        
        const result = await this.executeAgentTask(workflow, task);
        
        task.status = 'completed';
        task.output = result;
        task.endTime = new Date();
      } catch (error) {
        task.status = 'failed';
        console.error(`Task ${task.id} failed:`, error);
      }
    }
  }

  private async executeHierarchicalWorkflow(workflow: MultiAgentWorkflow): Promise<void> {
    // Group tasks by hierarchy level
    const taskLevels = this.groupTasksByLevel(workflow.tasks);
    
    for (const level of taskLevels) {
      await this.executeParallelTasks(workflow, level);
    }
  }

  private async executeDemocraticWorkflow(workflow: MultiAgentWorkflow): Promise<void> {
    // Execute all agent tasks
    await this.executeParallelWorkflow(workflow);
    
    // Build consensus from results
    await this.buildConsensus(workflow);
  }

  private async executeAgentTask(workflow: MultiAgentWorkflow, task: AgentTask): Promise<any> {
    const agent = workflow.agents.find(a => a.id === task.agentId);
    if (!agent) {
      throw new Error(`Agent ${task.agentId} not found`);
    }

    // Build agent-specific prompt
    const prompt = this.buildAgentPrompt(agent, task);

    const llmResponse = await this.llmManager.generateResponse([
      { role: 'system', content: this.buildAgentSystemPrompt(agent) },
      { role: 'user', content: prompt }
    ], agent.llmProfile);

    const result = this.parseAgentResult(llmResponse.content, agent, task);

    // Store result
    workflow.results.push({
      taskId: task.id,
      agentId: agent.id,
      result,
      confidence: result.confidence || 0.7,
      reasoning: result.reasoning || '',
      timestamp: new Date()
    });

    return result;
  }

  private async synthesizeWorkflowResults(workflow: MultiAgentWorkflow): Promise<void> {
    // Combine all agent results into a coherent synthesis
    const synthesisPrompt = this.buildWorkflowSynthesisPrompt(workflow);

    const taskProfile: TaskProfile = {
      taskType: 'complex_reasoning',
      priority: 'high',
      requiresAccuracy: true
    };

    const llmResponse = await this.llmManager.generateResponse([
      { role: 'system', content: 'You are an expert at synthesizing insights from multiple expert agents. Combine their findings coherently.' },
      { role: 'user', content: synthesisPrompt }
    ], taskProfile);

    const synthesis = this.parseStepResult(llmResponse.content, 'synthesis');

    // Store synthesis as a special workflow result
    workflow.results.push({
      taskId: 'synthesis',
      agentId: 'synthesizer',
      result: synthesis,
      confidence: synthesis.confidence || 0.8,
      reasoning: synthesis.reasoning || 'Synthesis of all agent findings',
      timestamp: new Date()
    });
  }

  // Prompt building methods
  private buildAnalysisPrompt(
    query: string,
    decomposedQuery: DecomposedQuery,
    searchResults: HybridSearchResult[]
  ): string {
    let prompt = `Analyze this technical query step by step:\n\n`;
    prompt += `Query: "${query}"\n\n`;
    prompt += `Query Analysis:\n`;
    prompt += `- Type: ${decomposedQuery.queryType}\n`;
    prompt += `- Components: ${decomposedQuery.components.length}\n`;
    prompt += `- Suggested approach: ${decomposedQuery.metadata.suggestedApproach}\n\n`;

    prompt += `Available Information:\n`;
    prompt += `- Search results: ${searchResults.length} items\n`;
    prompt += `- Top results:\n`;
    
    searchResults.slice(0, 5).forEach((result, i) => {
      prompt += `  ${i + 1}. Score: ${result.combinedScore.toFixed(3)} - ${result.explanation}\n`;
    });

    prompt += `\nPlease provide:\n`;
    prompt += `1. Initial assessment of the query complexity\n`;
    prompt += `2. Key information gaps that need to be addressed\n`;
    prompt += `3. Preliminary findings from the available results\n`;
    prompt += `4. Confidence level in current information (0-1)\n\n`;
    prompt += `Return your analysis in a structured format with clear reasoning.`;

    return prompt;
  }

  private buildSynthesisPrompt(
    thoughtChain: ThoughtChain,
    searchResults: HybridSearchResult[],
    previousStep: ThoughtStep
  ): string {
    let prompt = `Synthesize information from multiple sources:\n\n`;
    prompt += `Query: "${thoughtChain.query}"\n`;
    prompt += `Goal: ${thoughtChain.goal}\n\n`;

    prompt += `Previous Analysis:\n${JSON.stringify(previousStep.output, null, 2)}\n\n`;

    prompt += `Additional Evidence from Search Results:\n`;
    searchResults.slice(0, 8).forEach((result, i) => {
      if (result.chunk) {
        prompt += `${i + 1}. ${result.chunk.metadata.name || 'Unknown'} (${result.chunk.metadata.type})\n`;
        prompt += `   Score: ${result.combinedScore.toFixed(3)}\n`;
        prompt += `   Content preview: ${result.chunk.content.substring(0, 200)}...\n\n`;
      }
    });

    prompt += `Please synthesize this information by:\n`;
    prompt += `1. Combining insights from analysis and search results\n`;
    prompt += `2. Identifying patterns and relationships\n`;
    prompt += `3. Noting any contradictions or gaps\n`;
    prompt += `4. Building toward answering the original query\n\n`;
    prompt += `Provide structured output with clear connections between sources.`;

    return prompt;
  }

  private buildReasoningPrompt(
    thoughtChain: ThoughtChain,
    previousSteps: ThoughtStep[],
    options: ChainOfThoughtOptions
  ): string {
    let prompt = `Apply logical reasoning to form conclusions:\n\n`;
    prompt += `Query: "${thoughtChain.query}"\n`;
    prompt += `Goal: ${thoughtChain.goal}\n\n`;

    prompt += `Previous Steps:\n`;
    previousSteps.forEach((step, i) => {
      prompt += `${i + 1}. ${step.type}: ${step.description}\n`;
      prompt += `   Output: ${JSON.stringify(step.output, null, 2)}\n`;
      prompt += `   Confidence: ${(step.confidence * 100).toFixed(1)}%\n\n`;
    });

    if (options.enableMultipleHypotheses) {
      prompt += `Please consider multiple hypotheses and:\n`;
      prompt += `1. Form 2-3 alternative explanations or solutions\n`;
      prompt += `2. Evaluate evidence for each hypothesis\n`;
      prompt += `3. Rank hypotheses by likelihood and evidence\n`;
    } else {
      prompt += `Please apply logical reasoning to:\n`;
      prompt += `1. Draw logical conclusions from the available evidence\n`;
      prompt += `2. Form the most likely explanation or solution\n`;
    }

    prompt += `4. Identify any logical gaps or weaknesses\n`;
    prompt += `5. Provide confidence assessment for your reasoning\n\n`;
    prompt += `Use step-by-step logical reasoning and clearly explain your thought process.`;

    return prompt;
  }

  private buildValidationPrompt(thoughtChain: ThoughtChain, reasoningStep: ThoughtStep): string {
    let prompt = `Critically validate the following reasoning:\n\n`;
    prompt += `Original Query: "${thoughtChain.query}"\n\n`;
    prompt += `Reasoning to Validate:\n`;
    prompt += `${JSON.stringify(reasoningStep.output, null, 2)}\n\n`;

    prompt += `Please check for:\n`;
    prompt += `1. Logical fallacies or errors in reasoning\n`;
    prompt += `2. Unsupported assumptions or leaps\n`;
    prompt += `3. Missing evidence or alternative explanations\n`;
    prompt += `4. Potential biases in the analysis\n`;
    prompt += `5. Areas where the reasoning could be strengthened\n\n`;

    prompt += `Provide:\n`;
    prompt += `- List of any errors or weaknesses found\n`;
    prompt += `- Suggestions for improvement\n`;
    prompt += `- Overall validation score (0-1)\n`;
    prompt += `- Corrected reasoning if significant errors are found`;

    return prompt;
  }

  private buildConclusionPrompt(thoughtChain: ThoughtChain, allSteps: ThoughtStep[]): string {
    let prompt = `Draw final conclusions and provide actionable recommendations:\n\n`;
    prompt += `Original Query: "${thoughtChain.query}"\n`;
    prompt += `Goal: ${thoughtChain.goal}\n\n`;

    prompt += `Complete Reasoning Chain:\n`;
    allSteps.forEach((step, i) => {
      prompt += `${i + 1}. ${step.type}: ${step.description}\n`;
      prompt += `   Key findings: ${JSON.stringify(step.output, null, 2)}\n`;
      prompt += `   Confidence: ${(step.confidence * 100).toFixed(1)}%\n\n`;
    });

    prompt += `Please provide:\n`;
    prompt += `1. Clear, direct answer to the original query\n`;
    prompt += `2. Supporting evidence and reasoning\n`;
    prompt += `3. Practical recommendations or next steps\n`;
    prompt += `4. Limitations or caveats to consider\n`;
    prompt += `5. Overall confidence in the conclusion\n\n`;

    prompt += `Make your conclusion actionable and specific to the user's needs.`;

    return prompt;
  }

  private buildAgentPrompt(agent: Agent, task: AgentTask): string {
    let prompt = `As a ${agent.role} with expertise in ${agent.expertise.join(', ')}, analyze the following:\n\n`;
    
    prompt += `Component Type: ${task.type}\n`;
    prompt += `Task Input:\n${JSON.stringify(task.input, null, 2)}\n\n`;

    prompt += `Please provide analysis specific to your expertise area:\n`;
    prompt += `1. Key insights from your perspective\n`;
    prompt += `2. Potential issues or concerns\n`;
    prompt += `3. Recommendations or solutions\n`;
    prompt += `4. Confidence in your analysis\n\n`;

    prompt += `Focus on aspects most relevant to your role as ${agent.role}.`;

    return prompt;
  }

  private buildAgentSystemPrompt(agent: Agent): string {
    return `You are ${agent.name}, a ${agent.role} with expertise in ${agent.expertise.join(', ')}. 
    Provide analysis from your specialized perspective. Be specific and actionable in your recommendations.
    Focus on the aspects of the code/system that are most relevant to your expertise.`;
  }

  private buildWorkflowSynthesisPrompt(workflow: MultiAgentWorkflow): string {
    let prompt = `Synthesize insights from multiple expert agents:\n\n`;
    prompt += `Workflow: ${workflow.name}\n`;
    prompt += `Description: ${workflow.description}\n\n`;

    prompt += `Agent Results:\n`;
    workflow.results.forEach((result, i) => {
      const agent = workflow.agents.find(a => a.id === result.agentId);
      prompt += `${i + 1}. ${agent?.name || result.agentId} (${agent?.role || 'Unknown'}):\n`;
      prompt += `   Confidence: ${(result.confidence * 100).toFixed(1)}%\n`;
      prompt += `   Findings: ${JSON.stringify(result.result, null, 2)}\n\n`;
    });

    prompt += `Please provide:\n`;
    prompt += `1. Unified analysis combining all expert insights\n`;
    prompt += `2. Areas of agreement and consensus\n`;
    prompt += `3. Areas of disagreement and how to resolve them\n`;
    prompt += `4. Comprehensive recommendations\n`;
    prompt += `5. Overall confidence in the synthesized findings\n\n`;

    prompt += `Create a coherent, actionable synthesis that leverages each expert's strengths.`;

    return prompt;
  }

  // Utility methods
  private extractGoal(query: string, decomposedQuery: DecomposedQuery): string {
    const actions = decomposedQuery.components.map(c => c.intent.action);
    const subjects = decomposedQuery.components.map(c => c.intent.subject);
    
    return `${actions[0] || 'understand'} ${subjects.join(' and ')} based on the query: "${query}"`;
  }

  private parseStepResult(content: string, stepType: string): any {
    try {
      // Try to parse as JSON first
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // If JSON parsing fails, create structured result from text
    }

    // Fallback to text parsing
    return {
      summary: content.substring(0, 500),
      reasoning: content,
      confidence: 0.7,
      type: stepType
    };
  }

  private parseAgentResult(content: string, agent: Agent, task: AgentTask): any {
    const parsed = this.parseStepResult(content, 'agent_analysis');
    return {
      ...parsed,
      agentId: agent.id,
      agentRole: agent.role,
      taskType: task.type
    };
  }

  private calculateOverallConfidence(steps: ThoughtStep[]): number {
    if (steps.length === 0) return 0;
    
    const weightedSum = steps.reduce((sum, step, index) => {
      const weight = (index + 1) / steps.length; // Later steps get higher weight
      return sum + (step.confidence * weight);
    }, 0);
    
    return weightedSum / steps.length;
  }

  private extractReasoningPath(steps: ThoughtStep[]): string[] {
    return steps.map(step => `${step.type}: ${step.description}`);
  }

  private extractUsedSources(steps: ThoughtStep[]): string[] {
    const sources = new Set<string>();
    
    steps.forEach(step => {
      if (step.input?.searchResults) {
        step.input.searchResults.forEach((result: any) => {
          sources.add(result.id || 'unknown');
        });
      }
    });
    
    return Array.from(sources);
  }

  private assessResultQuality(results: HybridSearchResult[]): string {
    const avgScore = results.reduce((sum, r) => sum + r.combinedScore, 0) / results.length;
    
    if (avgScore > 0.8) return 'high';
    if (avgScore > 0.6) return 'medium';
    if (avgScore > 0.4) return 'low';
    return 'very_low';
  }

  private findBestAgent(agents: Agent[], component: QueryComponent): Agent | undefined {
    let bestAgent: Agent | undefined;
    let bestScore = 0;

    for (const agent of agents) {
      if (agent.currentTasks >= agent.maxConcurrentTasks) continue;

      let score = 0;
      
      // Check expertise match
      for (const expertise of agent.expertise) {
        if (component.keywords.some(k => k.toLowerCase().includes(expertise.toLowerCase()))) {
          score += 0.3;
        }
        if (component.type === expertise) {
          score += 0.5;
        }
      }

      // Check capability match
      for (const capability of agent.capabilities) {
        if (capability.inputTypes.includes(component.type) || 
            capability.outputTypes.includes(component.expectedOutputType)) {
          score += 0.2;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  private addCoordinationTasks(workflow: MultiAgentWorkflow): void {
    // Add synthesis task that depends on all other tasks
    const synthesisPrimaryTask: AgentTask = {
      id: `coordination_synthesis`,
      agentId: 'tech_lead', // Assuming tech_lead is the coordinator
      type: 'synthesis',
      input: { dependsOnAllTasks: true },
      status: 'pending',
      dependencies: workflow.tasks.map(t => t.id),
      priority: 10 // High priority
    };

    workflow.tasks.push(synthesisPrimaryTask);
  }

  private topologicalSort(tasks: AgentTask[]): AgentTask[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: AgentTask[] = [];
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      if (visiting.has(taskId)) return; // Cycle detected, skip

      visiting.add(taskId);
      const task = taskMap.get(taskId);
      if (task) {
        for (const depId of task.dependencies) {
          visit(depId);
        }
        visited.add(taskId);
        result.push(task);
      }
      visiting.delete(taskId);
    };

    for (const task of tasks) {
      visit(task.id);
    }

    return result;
  }

  private groupTasksByLevel(tasks: AgentTask[]): AgentTask[][] {
    const levels: AgentTask[][] = [];
    const visited = new Set<string>();

    while (visited.size < tasks.length) {
      const currentLevel: AgentTask[] = [];
      
      for (const task of tasks) {
        if (visited.has(task.id)) continue;
        
        // Check if all dependencies are satisfied
        const canExecute = task.dependencies.every(depId => visited.has(depId));
        
        if (canExecute) {
          currentLevel.push(task);
          visited.add(task.id);
        }
      }
      
      if (currentLevel.length > 0) {
        levels.push(currentLevel);
      } else {
        break; // Prevent infinite loop
      }
    }

    return levels;
  }

  private async executeParallelTasks(workflow: MultiAgentWorkflow, tasks: AgentTask[]): Promise<void> {
    const promises = tasks.map(task => this.executeAgentTask(workflow, task));
    await Promise.allSettled(promises);
  }

  private async buildConsensus(workflow: MultiAgentWorkflow): Promise<void> {
    // Simple consensus building - in practice, this would be more sophisticated
    const agentResults = workflow.results.filter(r => r.agentId !== 'synthesizer');
    
    if (agentResults.length < 2) return;

    // Find areas of agreement
    const consensusPoints: string[] = [];
    const disagreements: string[] = [];

    // This is a simplified consensus algorithm
    // In practice, you'd need more sophisticated agreement detection
    
    workflow.results.push({
      taskId: 'consensus',
      agentId: 'consensus_builder',
      result: {
        consensus: consensusPoints,
        disagreements: disagreements,
        recommendedAction: 'Follow majority opinion or seek expert arbitration'
      },
      confidence: 0.8,
      reasoning: 'Built consensus from multiple agent opinions',
      timestamp: new Date()
    });
  }

  private storeThoughtChain(query: string, thoughtChain: ThoughtChain): void {
    if (!this.thoughtHistory.has(query)) {
      this.thoughtHistory.set(query, []);
    }
    
    this.thoughtHistory.get(query)!.push(thoughtChain);
    
    // Keep only recent chains (max 10 per query)
    const chains = this.thoughtHistory.get(query)!;
    if (chains.length > 10) {
      this.thoughtHistory.set(query, chains.slice(-10));
    }
  }

  private getDefaultOptions(): ChainOfThoughtOptions {
    return {
      maxSteps: 8,
      confidenceThreshold: 0.7,
      enableSelfCorrection: true,
      enableMultipleHypotheses: false,
      verboseReasoning: true,
      useMultipleAgents: false,
      agentCollaboration: false
    };
  }

  private initializeAgents(): void {
    // Code Analyst Agent
    this.agents.set('code_analyst', {
      id: 'code_analyst',
      name: 'Code Analyst',
      role: 'Senior Code Analyst',
      expertise: ['code-quality', 'patterns', 'refactoring', 'best-practices'],
      capabilities: [
        {
          name: 'code_analysis',
          description: 'Analyze code quality and structure',
          inputTypes: ['semantic', 'structural'],
          outputTypes: ['analysis', 'summary'],
          complexity: 'expert'
        }
      ],
      maxConcurrentTasks: 3,
      currentTasks: 0,
      llmProfile: { taskType: 'code_generation', priority: 'high', requiresAccuracy: true }
    });

    // Architecture Expert Agent
    this.agents.set('architecture_expert', {
      id: 'architecture_expert',
      name: 'Architecture Expert',
      role: 'Software Architect',
      expertise: ['architecture', 'design-patterns', 'scalability', 'system-design'],
      capabilities: [
        {
          name: 'architecture_analysis',
          description: 'Analyze system architecture and design',
          inputTypes: ['architectural', 'structural'],
          outputTypes: ['analysis', 'diagram'],
          complexity: 'expert'
        }
      ],
      maxConcurrentTasks: 2,
      currentTasks: 0,
      llmProfile: { taskType: 'complex_reasoning', priority: 'high', requiresAccuracy: true }
    });

    // Security Specialist Agent
    this.agents.set('security_specialist', {
      id: 'security_specialist',
      name: 'Security Specialist',
      role: 'Security Expert',
      expertise: ['security', 'vulnerabilities', 'authentication', 'authorization'],
      capabilities: [
        {
          name: 'security_analysis',
          description: 'Analyze security implications and vulnerabilities',
          inputTypes: ['security', 'technical'],
          outputTypes: ['analysis', 'summary'],
          complexity: 'expert'
        }
      ],
      maxConcurrentTasks: 2,
      currentTasks: 0,
      llmProfile: { taskType: 'analysis', priority: 'high', requiresAccuracy: true }
    });

    // Add more agents as needed...
  }

  // Public API methods
  getThoughtHistory(query: string): ThoughtChain[] {
    return this.thoughtHistory.get(query) || [];
  }

  getActiveWorkflows(): MultiAgentWorkflow[] {
    return Array.from(this.activeWorkflows.values());
  }

  getAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  addAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  removeAgent(agentId: string): void {
    this.agents.delete(agentId);
  }
}