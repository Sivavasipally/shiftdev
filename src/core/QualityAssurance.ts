import { ContentChunk, ProcessedContent } from './ContentProcessor';
import { FileClassification } from './FileClassifier';
import { QueryResponse, QueryIntent, RelevantChunk } from './QueryProcessor';
import { GeneratedOutput, OutputRequest } from './OutputGenerator';
import { WorkspaceEnvironment } from './RAGFoundation';

export interface QualityAssessment {
  overall: QualityScore;
  dimensions: QualityDimensions;
  issues: QualityIssue[];
  recommendations: QualityRecommendation[];
  validationResults: ValidationResult[];
  metadata: QualityMetadata;
}

export interface QualityScore {
  score: number; // 0-100
  level: QualityLevel;
  confidence: number;
  timestamp: Date;
}

export enum QualityLevel {
  Excellent = 'excellent',
  Good = 'good',
  Fair = 'fair',
  Poor = 'poor',
  Critical = 'critical'
}

export interface QualityDimensions {
  accuracy: DimensionScore;
  completeness: DimensionScore;
  relevance: DimensionScore;
  consistency: DimensionScore;
  clarity: DimensionScore;
  timeliness: DimensionScore;
  reliability: DimensionScore;
}

export interface DimensionScore {
  score: number;
  weight: number;
  issues: string[];
  evidence: string[];
}

export interface QualityIssue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  category: IssueCategory;
  description: string;
  location: IssueLocation;
  impact: string;
  suggestion: string;
  automated: boolean;
  confidence: number;
}

export enum IssueType {
  DataInconsistency = 'data-inconsistency',
  IncompleteCoverage = 'incomplete-coverage',
  AccuracyError = 'accuracy-error',
  RelevanceMismatch = 'relevance-mismatch',
  PerformanceDegradation = 'performance-degradation',
  ValidationFailure = 'validation-failure',
  ContentDuplication = 'content-duplication',
  MissingDependency = 'missing-dependency',
  DeprecatedPattern = 'deprecated-pattern',
  SecurityVulnerability = 'security-vulnerability'
}

export enum IssueSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
  Info = 'info'
}

export enum IssueCategory {
  Content = 'content',
  Processing = 'processing',
  Query = 'query',
  Output = 'output',
  Configuration = 'configuration',
  Performance = 'performance'
}

export interface IssueLocation {
  component: string;
  file?: string;
  line?: number;
  chunk?: string;
  context: string;
}

export interface QualityRecommendation {
  id: string;
  priority: RecommendationPriority;
  category: string;
  title: string;
  description: string;
  action: string;
  expectedImpact: string;
  effort: EffortLevel;
  dependencies: string[];
}

export enum RecommendationPriority {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low'
}

export enum EffortLevel {
  Minimal = 'minimal',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Extensive = 'extensive'
}

export interface ValidationResult {
  validator: string;
  passed: boolean;
  score: number;
  details: ValidationDetail[];
  executionTime: number;
}

export interface ValidationDetail {
  test: string;
  result: boolean;
  message: string;
  data?: any;
}

export interface QualityMetadata {
  assessmentId: string;
  timestamp: Date;
  version: string;
  scope: string;
  totalChunks: number;
  validatedChunks: number;
  processingTime: number;
  validatorsUsed: string[];
}

export class QualityAssurance {
  private validators: Map<string, QualityValidator> = new Map();
  private rules: Map<string, QualityRule[]> = new Map();
  private metrics: QualityMetrics = new QualityMetrics();

  constructor() {
    this.initializeValidators();
    this.initializeQualityRules();
  }

  async assessContentQuality(
    processedContent: ProcessedContent,
    classification: FileClassification,
    workspaceEnvironment: WorkspaceEnvironment
  ): Promise<QualityAssessment> {
    console.log('🔍 Phase 6: Assessing content quality...');
    
    const startTime = Date.now();
    const assessmentId = this.generateAssessmentId();
    
    // Run all relevant validators
    const validationResults = await this.runValidators(processedContent, classification);
    
    // Calculate quality dimensions
    const dimensions = await this.calculateQualityDimensions(processedContent, validationResults);
    
    // Identify issues
    const issues = await this.identifyQualityIssues(processedContent, validationResults, classification);
    
    // Generate recommendations
    const recommendations = await this.generateRecommendations(issues, dimensions);
    
    // Calculate overall quality score
    const overall = this.calculateOverallScore(dimensions, issues);
    
    const metadata: QualityMetadata = {
      assessmentId,
      timestamp: new Date(),
      version: '1.0.0',
      scope: 'content',
      totalChunks: processedContent.chunks.length,
      validatedChunks: processedContent.chunks.length,
      processingTime: Date.now() - startTime,
      validatorsUsed: Array.from(this.validators.keys())
    };
    
    return {
      overall,
      dimensions,
      issues,
      recommendations,
      validationResults,
      metadata
    };
  }

  async assessQueryQuality(
    query: string,
    intent: QueryIntent,
    response: QueryResponse,
    relevantChunks: RelevantChunk[]
  ): Promise<QualityAssessment> {
    console.log('🔍 Phase 6: Assessing query response quality...');
    
    const startTime = Date.now();
    const assessmentId = this.generateAssessmentId();
    
    // Validate query processing
    const validationResults = await this.validateQueryProcessing(query, intent, response, relevantChunks);
    
    // Assess response quality dimensions
    const dimensions = await this.assessResponseQuality(response, relevantChunks, intent);
    
    // Identify query-specific issues
    const issues = await this.identifyQueryIssues(query, intent, response, relevantChunks);
    
    // Generate query-specific recommendations
    const recommendations = await this.generateQueryRecommendations(issues, response);
    
    const overall = this.calculateOverallScore(dimensions, issues);
    
    const metadata: QualityMetadata = {
      assessmentId,
      timestamp: new Date(),
      version: '1.0.0',
      scope: 'query',
      totalChunks: relevantChunks.length,
      validatedChunks: relevantChunks.length,
      processingTime: Date.now() - startTime,
      validatorsUsed: ['QueryValidator', 'RelevanceValidator', 'AccuracyValidator']
    };
    
    return {
      overall,
      dimensions,
      issues,
      recommendations,
      validationResults,
      metadata
    };
  }

  async assessOutputQuality(
    outputRequest: OutputRequest,
    generatedOutput: GeneratedOutput,
    sourceChunks: ContentChunk[]
  ): Promise<QualityAssessment> {
    console.log('🔍 Phase 6: Assessing generated output quality...');
    
    const startTime = Date.now();
    const assessmentId = this.generateAssessmentId();
    
    // Validate output generation
    const validationResults = await this.validateOutputGeneration(outputRequest, generatedOutput, sourceChunks);
    
    // Assess output quality dimensions
    const dimensions = await this.assessOutputDimensions(generatedOutput, sourceChunks, outputRequest);
    
    // Identify output-specific issues
    const issues = await this.identifyOutputIssues(generatedOutput, sourceChunks, outputRequest);
    
    // Generate output-specific recommendations
    const recommendations = await this.generateOutputRecommendations(issues, generatedOutput);
    
    const overall = this.calculateOverallScore(dimensions, issues);
    
    const metadata: QualityMetadata = {
      assessmentId,
      timestamp: new Date(),
      version: '1.0.0',
      scope: 'output',
      totalChunks: sourceChunks.length,
      validatedChunks: sourceChunks.length,
      processingTime: Date.now() - startTime,
      validatorsUsed: ['OutputValidator', 'CompletenessValidator', 'FormatValidator']
    };
    
    return {
      overall,
      dimensions,
      issues,
      recommendations,
      validationResults,
      metadata
    };
  }

  private async runValidators(
    processedContent: ProcessedContent,
    classification: FileClassification
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    for (const [name, validator] of this.validators.entries()) {
      const startTime = Date.now();
      try {
        const result = await validator.validate(processedContent, classification);
        results.push({
          validator: name,
          passed: result.passed,
          score: result.score,
          details: result.details,
          executionTime: Date.now() - startTime
        });
      } catch (error) {
        results.push({
          validator: name,
          passed: false,
          score: 0,
          details: [{
            test: 'execution',
            result: false,
            message: `Validator failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          }],
          executionTime: Date.now() - startTime
        });
      }
    }
    
    return results;
  }

  private async calculateQualityDimensions(
    processedContent: ProcessedContent,
    validationResults: ValidationResult[]
  ): Promise<QualityDimensions> {
    const accuracy = await this.assessAccuracy(processedContent, validationResults);
    const completeness = await this.assessCompleteness(processedContent, validationResults);
    const relevance = await this.assessRelevance(processedContent, validationResults);
    const consistency = await this.assessConsistency(processedContent, validationResults);
    const clarity = await this.assessClarity(processedContent, validationResults);
    const timeliness = await this.assessTimeliness(processedContent, validationResults);
    const reliability = await this.assessReliability(processedContent, validationResults);
    
    return {
      accuracy,
      completeness,
      relevance,
      consistency,
      clarity,
      timeliness,
      reliability
    };
  }

  private async assessAccuracy(
    processedContent: ProcessedContent,
    validationResults: ValidationResult[]
  ): Promise<DimensionScore> {
    const accuracyValidators = validationResults.filter(r => 
      r.validator.includes('Accuracy') || r.validator.includes('Syntax')
    );
    
    let score = 85; // Base score
    const issues: string[] = [];
    const evidence: string[] = [];
    
    // Check for syntax errors
    const syntaxErrors = this.countSyntaxErrors(processedContent.chunks);
    if (syntaxErrors > 0) {
      score -= Math.min(30, syntaxErrors * 5);
      issues.push(`${syntaxErrors} syntax errors detected`);
    } else {
      evidence.push('No syntax errors detected');
    }
    
    // Check for consistency in naming conventions
    const namingConsistency = this.assessNamingConsistency(processedContent.chunks);
    if (namingConsistency < 0.8) {
      score -= 10;
      issues.push('Inconsistent naming conventions');
    } else {
      evidence.push('Consistent naming conventions');
    }
    
    // Check for framework-specific accuracy
    const frameworkCompliance = this.assessFrameworkCompliance(processedContent.chunks);
    score = score * frameworkCompliance;
    
    if (frameworkCompliance < 0.9) {
      issues.push('Framework best practices not fully followed');
    } else {
      evidence.push('Good framework compliance');
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      weight: 0.25,
      issues,
      evidence
    };
  }

  private async assessCompleteness(
    processedContent: ProcessedContent,
    validationResults: ValidationResult[]
  ): Promise<DimensionScore> {
    let score = 80; // Base score
    const issues: string[] = [];
    const evidence: string[] = [];
    
    // Check for missing critical components
    const missingComponents = this.identifyMissingComponents(processedContent.chunks);
    if (missingComponents.length > 0) {
      score -= missingComponents.length * 10;
      issues.push(`Missing components: ${missingComponents.join(', ')}`);
    } else {
      evidence.push('All critical components present');
    }
    
    // Check for incomplete dependencies
    const incompleteDeps = this.checkIncompleteDependencies(processedContent.chunks);
    if (incompleteDeps > 0) {
      score -= incompleteDeps * 5;
      issues.push(`${incompleteDeps} incomplete dependencies`);
    } else {
      evidence.push('Dependencies properly resolved');
    }
    
    // Check documentation coverage
    const docCoverage = this.calculateDocumentationCoverage(processedContent.chunks);
    if (docCoverage < 0.5) {
      score -= 15;
      issues.push('Low documentation coverage');
    } else {
      evidence.push(`Good documentation coverage: ${(docCoverage * 100).toFixed(1)}%`);
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      weight: 0.2,
      issues,
      evidence
    };
  }

  private async assessRelevance(
    processedContent: ProcessedContent,
    validationResults: ValidationResult[]
  ): Promise<DimensionScore> {
    let score = 90; // Base score
    const issues: string[] = [];
    const evidence: string[] = [];
    
    // Check for relevant content based on importance scores
    const avgImportance = processedContent.chunks.reduce(
      (sum, chunk) => sum + chunk.metadata.importance, 0
    ) / processedContent.chunks.length;
    
    if (avgImportance < 0.5) {
      score -= 20;
      issues.push('Low average importance of content');
    } else {
      evidence.push(`Good content relevance: ${(avgImportance * 100).toFixed(1)}%`);
    }
    
    // Check for dead code or unused components
    const unusedChunks = this.identifyUnusedComponents(processedContent.chunks);
    if (unusedChunks.length > 0) {
      score -= Math.min(15, unusedChunks.length * 2);
      issues.push(`${unusedChunks.length} potentially unused components`);
    } else {
      evidence.push('No unused components detected');
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      weight: 0.15,
      issues,
      evidence
    };
  }

  private async assessConsistency(
    processedContent: ProcessedContent,
    validationResults: ValidationResult[]
  ): Promise<DimensionScore> {
    let score = 85; // Base score
    const issues: string[] = [];
    const evidence: string[] = [];
    
    // Check pattern consistency
    const patternConsistency = this.assessPatternConsistency(processedContent.chunks);
    if (patternConsistency < 0.8) {
      score -= 15;
      issues.push('Inconsistent patterns across components');
    } else {
      evidence.push('Consistent patterns maintained');
    }
    
    // Check framework usage consistency
    const frameworkConsistency = this.assessFrameworkConsistency(processedContent.chunks);
    if (frameworkConsistency < 0.9) {
      score -= 10;
      issues.push('Inconsistent framework usage');
    } else {
      evidence.push('Consistent framework usage');
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      weight: 0.15,
      issues,
      evidence
    };
  }

  private async assessClarity(
    processedContent: ProcessedContent,
    validationResults: ValidationResult[]
  ): Promise<DimensionScore> {
    let score = 80; // Base score
    const issues: string[] = [];
    const evidence: string[] = [];
    
    // Check complexity levels
    const avgComplexity = processedContent.chunks.reduce(
      (sum, chunk) => sum + chunk.metadata.complexity, 0
    ) / processedContent.chunks.length;
    
    if (avgComplexity > 7) {
      score -= 20;
      issues.push('High average complexity may affect clarity');
    } else {
      evidence.push(`Manageable complexity level: ${avgComplexity.toFixed(1)}/10`);
    }
    
    // Check for clear naming
    const clearNaming = this.assessNamingClarity(processedContent.chunks);
    if (clearNaming < 0.8) {
      score -= 15;
      issues.push('Unclear naming conventions');
    } else {
      evidence.push('Clear and descriptive naming');
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      weight: 0.1,
      issues,
      evidence
    };
  }

  private async assessTimeliness(
    processedContent: ProcessedContent,
    validationResults: ValidationResult[]
  ): Promise<DimensionScore> {
    let score = 95; // Base score
    const issues: string[] = [];
    const evidence: string[] = [];
    
    // Check for deprecated patterns
    const deprecatedPatterns = this.identifyDeprecatedPatterns(processedContent.chunks);
    if (deprecatedPatterns.length > 0) {
      score -= deprecatedPatterns.length * 5;
      issues.push(`${deprecatedPatterns.length} deprecated patterns found`);
    } else {
      evidence.push('No deprecated patterns detected');
    }
    
    // Check for modern best practices
    const modernPractices = this.assessModernPractices(processedContent.chunks);
    if (modernPractices < 0.8) {
      score -= 10;
      issues.push('Limited use of modern best practices');
    } else {
      evidence.push('Good adoption of modern practices');
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      weight: 0.1,
      issues,
      evidence
    };
  }

  private async assessReliability(
    processedContent: ProcessedContent,
    validationResults: ValidationResult[]
  ): Promise<DimensionScore> {
    let score = 85; // Base score
    const issues: string[] = [];
    const evidence: string[] = [];
    
    // Check error handling
    const errorHandling = this.assessErrorHandling(processedContent.chunks);
    if (errorHandling < 0.7) {
      score -= 15;
      issues.push('Insufficient error handling');
    } else {
      evidence.push('Good error handling practices');
    }
    
    // Check for potential reliability issues
    const reliabilityIssues = this.identifyReliabilityIssues(processedContent.chunks);
    if (reliabilityIssues.length > 0) {
      score -= reliabilityIssues.length * 3;
      issues.push(`${reliabilityIssues.length} potential reliability concerns`);
    } else {
      evidence.push('No reliability concerns identified');
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      weight: 0.05,
      issues,
      evidence
    };
  }

  private async identifyQualityIssues(
    processedContent: ProcessedContent,
    validationResults: ValidationResult[],
    classification: FileClassification
  ): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    
    // Content-related issues
    issues.push(...this.identifyContentIssues(processedContent.chunks));
    
    // Processing-related issues
    issues.push(...this.identifyProcessingIssues(processedContent, validationResults));
    
    // Classification-related issues
    issues.push(...this.identifyClassificationIssues(classification, processedContent));
    
    // Security issues
    issues.push(...this.identifySecurityIssues(processedContent.chunks));
    
    // Performance issues
    issues.push(...this.identifyPerformanceIssues(processedContent.chunks));
    
    return issues.sort((a, b) => this.compareSeverity(a.severity, b.severity));
  }

  private identifyContentIssues(chunks: ContentChunk[]): QualityIssue[] {
    const issues: QualityIssue[] = [];
    
    chunks.forEach((chunk, index) => {
      // Check for overly complex chunks
      if (chunk.metadata.complexity > 8) {
        issues.push({
          id: `COMPLEX_${index}`,
          type: IssueType.AccuracyError,
          severity: IssueSeverity.Medium,
          category: IssueCategory.Content,
          description: `Component has high complexity (${chunk.metadata.complexity}/10)`,
          location: {
            component: chunk.metadata.name || 'Unknown',
            chunk: chunk.id,
            context: 'complexity analysis'
          },
          impact: 'May affect maintainability and understanding',
          suggestion: 'Consider breaking down into smaller, focused components',
          automated: true,
          confidence: 0.8
        });
      }
      
      // Check for missing dependencies
      if (chunk.dependencies.length === 0 && chunk.metadata.type !== 'configuration') {
        issues.push({
          id: `NODEPS_${index}`,
          type: IssueType.MissingDependency,
          severity: IssueSeverity.Low,
          category: IssueCategory.Content,
          description: 'Component has no declared dependencies',
          location: {
            component: chunk.metadata.name || 'Unknown',
            chunk: chunk.id,
            context: 'dependency analysis'
          },
          impact: 'May indicate incomplete analysis or isolated component',
          suggestion: 'Verify if component truly has no dependencies',
          automated: true,
          confidence: 0.6
        });
      }
      
      // Check for duplicate content
      const duplicates = chunks.filter(other => 
        other !== chunk && 
        this.calculateSimilarity(chunk.content, other.content) > 0.8
      );
      
      if (duplicates.length > 0) {
        issues.push({
          id: `DUP_${index}`,
          type: IssueType.ContentDuplication,
          severity: IssueSeverity.Medium,
          category: IssueCategory.Content,
          description: `Potential code duplication detected with ${duplicates.length} other components`,
          location: {
            component: chunk.metadata.name || 'Unknown',
            chunk: chunk.id,
            context: 'duplication analysis'
          },
          impact: 'Increases maintenance burden and potential for inconsistencies',
          suggestion: 'Consider extracting common functionality into shared components',
          automated: true,
          confidence: 0.7
        });
      }
    });
    
    return issues;
  }

  private identifyProcessingIssues(
    processedContent: ProcessedContent,
    validationResults: ValidationResult[]
  ): QualityIssue[] {
    const issues: QualityIssue[] = [];
    
    // Check for failed validations
    const failedValidations = validationResults.filter(r => !r.passed);
    failedValidations.forEach((validation, index) => {
      issues.push({
        id: `VAL_${index}`,
        type: IssueType.ValidationFailure,
        severity: IssueSeverity.High,
        category: IssueCategory.Processing,
        description: `Validation failed: ${validation.validator}`,
        location: {
          component: validation.validator,
          context: 'validation process'
        },
        impact: 'May indicate processing errors or quality degradation',
        suggestion: 'Review validation details and address underlying issues',
        automated: true,
        confidence: 0.9
      });
    });
    
    // Check for performance issues in processing
    const slowValidations = validationResults.filter(r => r.executionTime > 5000);
    slowValidations.forEach((validation, index) => {
      issues.push({
        id: `PERF_${index}`,
        type: IssueType.PerformanceDegradation,
        severity: IssueSeverity.Medium,
        category: IssueCategory.Performance,
        description: `Slow validation performance: ${validation.validator} (${validation.executionTime}ms)`,
        location: {
          component: validation.validator,
          context: 'performance analysis'
        },
        impact: 'May affect overall system responsiveness',
        suggestion: 'Optimize validation logic or consider caching',
        automated: true,
        confidence: 0.8
      });
    });
    
    return issues;
  }

  private identifySecurityIssues(chunks: ContentChunk[]): QualityIssue[] {
    const issues: QualityIssue[] = [];
    
    chunks.forEach((chunk, index) => {
      const content = chunk.content.toLowerCase();
      
      // Check for potential security vulnerabilities
      if (content.includes('password') && content.includes('=') && content.includes('"')) {
        issues.push({
          id: `SEC_CRED_${index}`,
          type: IssueType.SecurityVulnerability,
          severity: IssueSeverity.High,
          category: IssueCategory.Content,
          description: 'Potential hardcoded credentials detected',
          location: {
            component: chunk.metadata.name || 'Unknown',
            chunk: chunk.id,
            context: 'security analysis'
          },
          impact: 'Security risk due to exposed credentials',
          suggestion: 'Use environment variables or secure configuration management',
          automated: true,
          confidence: 0.7
        });
      }
      
      // Check for SQL injection risks
      if (content.includes('query') && content.includes('+') && !content.includes('parameterized')) {
        issues.push({
          id: `SEC_SQL_${index}`,
          type: IssueType.SecurityVulnerability,
          severity: IssueSeverity.High,
          category: IssueCategory.Content,
          description: 'Potential SQL injection vulnerability',
          location: {
            component: chunk.metadata.name || 'Unknown',
            chunk: chunk.id,
            context: 'security analysis'
          },
          impact: 'Data security risk through SQL injection',
          suggestion: 'Use parameterized queries or prepared statements',
          automated: true,
          confidence: 0.6
        });
      }
    });
    
    return issues;
  }

  private identifyPerformanceIssues(chunks: ContentChunk[]): QualityIssue[] {
    const issues: QualityIssue[] = [];
    
    chunks.forEach((chunk, index) => {
      // Check for potential N+1 query problems
      if (chunk.content.includes('@OneToMany') && !chunk.content.includes('LAZY')) {
        issues.push({
          id: `PERF_N1_${index}`,
          type: IssueType.PerformanceDegradation,
          severity: IssueSeverity.Medium,
          category: IssueCategory.Performance,
          description: 'Potential N+1 query problem with eager fetching',
          location: {
            component: chunk.metadata.name || 'Unknown',
            chunk: chunk.id,
            context: 'performance analysis'
          },
          impact: 'May cause performance degradation with large datasets',
          suggestion: 'Consider using lazy loading or explicit fetch strategies',
          automated: true,
          confidence: 0.8
        });
      }
      
      // Check for missing transaction boundaries
      if (chunk.content.includes('save(') && !chunk.content.includes('@Transactional')) {
        issues.push({
          id: `PERF_TX_${index}`,
          type: IssueType.PerformanceDegradation,
          severity: IssueSeverity.Low,
          category: IssueCategory.Performance,
          description: 'Missing transaction management for data operations',
          location: {
            component: chunk.metadata.name || 'Unknown',
            chunk: chunk.id,
            context: 'transaction analysis'
          },
          impact: 'May affect data consistency and performance',
          suggestion: 'Add appropriate transaction annotations',
          automated: true,
          confidence: 0.7
        });
      }
    });
    
    return issues;
  }

  private async generateRecommendations(
    issues: QualityIssue[],
    dimensions: QualityDimensions
  ): Promise<QualityRecommendation[]> {
    const recommendations: QualityRecommendation[] = [];
    
    // Group issues by type and generate recommendations
    const issueGroups = new Map<IssueType, QualityIssue[]>();
    issues.forEach(issue => {
      if (!issueGroups.has(issue.type)) {
        issueGroups.set(issue.type, []);
      }
      issueGroups.get(issue.type)!.push(issue);
    });
    
    // Generate specific recommendations based on issue patterns
    issueGroups.forEach((groupIssues, issueType) => {
      const recommendation = this.generateRecommendationForIssueType(issueType, groupIssues);
      if (recommendation) {
        recommendations.push(recommendation);
      }
    });
    
    // Generate dimension-based recommendations
    recommendations.push(...this.generateDimensionRecommendations(dimensions));
    
    return recommendations.sort((a, b) => this.compareRecommendationPriority(a.priority, b.priority));
  }

  private generateRecommendationForIssueType(
    issueType: IssueType,
    issues: QualityIssue[]
  ): QualityRecommendation | null {
    const highSeverityCount = issues.filter(i => i.severity === IssueSeverity.High).length;
    const totalCount = issues.length;
    
    switch (issueType) {
      case IssueType.SecurityVulnerability:
        return {
          id: `REC_SEC_${Date.now()}`,
          priority: RecommendationPriority.Critical,
          category: 'Security',
          title: 'Address Security Vulnerabilities',
          description: `${totalCount} security vulnerabilities detected, ${highSeverityCount} high severity`,
          action: 'Review and fix security issues, implement secure coding practices',
          expectedImpact: 'Improved application security and reduced risk',
          effort: EffortLevel.High,
          dependencies: ['Security review', 'Code changes']
        };
        
      case IssueType.PerformanceDegradation:
        return {
          id: `REC_PERF_${Date.now()}`,
          priority: RecommendationPriority.High,
          category: 'Performance',
          title: 'Optimize Performance Issues',
          description: `${totalCount} performance issues identified`,
          action: 'Implement performance optimizations and best practices',
          expectedImpact: 'Better application responsiveness and resource usage',
          effort: EffortLevel.Medium,
          dependencies: ['Performance testing', 'Code optimization']
        };
        
      case IssueType.ContentDuplication:
        return {
          id: `REC_DUP_${Date.now()}`,
          priority: RecommendationPriority.Medium,
          category: 'Code Quality',
          title: 'Reduce Code Duplication',
          description: `${totalCount} instances of potential code duplication`,
          action: 'Refactor duplicated code into reusable components',
          expectedImpact: 'Improved maintainability and consistency',
          effort: EffortLevel.Medium,
          dependencies: ['Refactoring', 'Testing']
        };
        
      default:
        return null;
    }
  }

  private generateDimensionRecommendations(dimensions: QualityDimensions): QualityRecommendation[] {
    const recommendations: QualityRecommendation[] = [];
    
    // Check each dimension and generate recommendations for low scores
    if (dimensions.accuracy.score < 70) {
      recommendations.push({
        id: `REC_ACC_${Date.now()}`,
        priority: RecommendationPriority.High,
        category: 'Accuracy',
        title: 'Improve Code Accuracy',
        description: `Accuracy score is ${dimensions.accuracy.score}/100`,
        action: 'Address syntax errors, improve naming consistency, enhance framework compliance',
        expectedImpact: 'Higher code quality and fewer bugs',
        effort: EffortLevel.Medium,
        dependencies: ['Code review', 'Refactoring']
      });
    }
    
    if (dimensions.completeness.score < 70) {
      recommendations.push({
        id: `REC_COMP_${Date.now()}`,
        priority: RecommendationPriority.Medium,
        category: 'Completeness',
        title: 'Improve Code Completeness',
        description: `Completeness score is ${dimensions.completeness.score}/100`,
        action: 'Add missing components, resolve dependencies, improve documentation',
        expectedImpact: 'More comprehensive and maintainable codebase',
        effort: EffortLevel.High,
        dependencies: ['Development', 'Documentation']
      });
    }
    
    return recommendations;
  }

  // Validation methods for query processing
  private async validateQueryProcessing(
    query: string,
    intent: QueryIntent,
    response: QueryResponse,
    relevantChunks: RelevantChunk[]
  ): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    
    // Validate intent classification accuracy
    results.push(await this.validateIntentClassification(query, intent));
    
    // Validate chunk relevance
    results.push(await this.validateChunkRelevance(query, relevantChunks));
    
    // Validate response quality
    results.push(await this.validateResponseQuality(response, relevantChunks));
    
    return results;
  }

  private async validateIntentClassification(query: string, intent: QueryIntent): Promise<ValidationResult> {
    const details: ValidationDetail[] = [];
    let score = 0;
    
    // Check confidence level
    if (intent.confidence > 0.8) {
      score += 40;
      details.push({
        test: 'confidence',
        result: true,
        message: `High confidence: ${intent.confidence}`
      });
    } else if (intent.confidence > 0.6) {
      score += 20;
      details.push({
        test: 'confidence',
        result: true,
        message: `Medium confidence: ${intent.confidence}`
      });
    } else {
      details.push({
        test: 'confidence',
        result: false,
        message: `Low confidence: ${intent.confidence}`
      });
    }
    
    // Check parameter extraction
    if (intent.parameters.keywords.length > 0) {
      score += 30;
      details.push({
        test: 'keywords',
        result: true,
        message: `Extracted ${intent.parameters.keywords.length} keywords`
      });
    }
    
    // Check scope determination
    if (intent.parameters.scope) {
      score += 30;
      details.push({
        test: 'scope',
        result: true,
        message: `Determined scope: ${intent.parameters.scope}`
      });
    }
    
    return {
      validator: 'IntentClassificationValidator',
      passed: score >= 60,
      score,
      details,
      executionTime: 50
    };
  }

  private async validateChunkRelevance(query: string, relevantChunks: RelevantChunk[]): Promise<ValidationResult> {
    const details: ValidationDetail[] = [];
    let score = 0;
    
    if (relevantChunks.length === 0) {
      return {
        validator: 'ChunkRelevanceValidator',
        passed: false,
        score: 0,
        details: [{
          test: 'chunk_count',
          result: false,
          message: 'No relevant chunks found'
        }],
        executionTime: 25
      };
    }
    
    // Check average relevance score
    const avgRelevance = relevantChunks.reduce((sum, chunk) => sum + chunk.relevanceScore, 0) / relevantChunks.length;
    if (avgRelevance > 0.7) {
      score += 50;
      details.push({
        test: 'relevance_score',
        result: true,
        message: `High average relevance: ${avgRelevance.toFixed(2)}`
      });
    } else if (avgRelevance > 0.4) {
      score += 25;
      details.push({
        test: 'relevance_score',
        result: true,
        message: `Medium average relevance: ${avgRelevance.toFixed(2)}`
      });
    }
    
    // Check chunk diversity
    const frameworks = new Set(relevantChunks.map(c => c.chunk.metadata.framework).filter(Boolean));
    if (frameworks.size > 1) {
      score += 25;
      details.push({
        test: 'diversity',
        result: true,
        message: `Good diversity: ${frameworks.size} frameworks`
      });
    }
    
    // Check explanation quality
    const explanations = relevantChunks.filter(c => c.explanation && c.explanation.length > 10);
    if (explanations.length === relevantChunks.length) {
      score += 25;
      details.push({
        test: 'explanations',
        result: true,
        message: 'All chunks have explanations'
      });
    }
    
    return {
      validator: 'ChunkRelevanceValidator',
      passed: score >= 50,
      score,
      details,
      executionTime: 75
    };
  }

  private async validateResponseQuality(response: QueryResponse, relevantChunks: RelevantChunk[]): Promise<ValidationResult> {
    const details: ValidationDetail[] = [];
    let score = 0;
    
    // Check response length
    if (response.answer.length > 50 && response.answer.length < 2000) {
      score += 25;
      details.push({
        test: 'length',
        result: true,
        message: `Appropriate length: ${response.answer.length} characters`
      });
    }
    
    // Check if response addresses the chunks
    const chunkNames = relevantChunks.map(c => c.chunk.metadata.name).filter(Boolean);
    const mentionsChunks = chunkNames.some(name => response.answer.includes(name!));
    if (mentionsChunks) {
      score += 25;
      details.push({
        test: 'chunk_integration',
        result: true,
        message: 'Response integrates chunk information'
      });
    }
    
    // Check confidence
    if (response.confidence > 0.7) {
      score += 25;
      details.push({
        test: 'confidence',
        result: true,
        message: `High confidence: ${response.confidence}`
      });
    }
    
    // Check suggestions
    if (response.suggestions.length > 0) {
      score += 25;
      details.push({
        test: 'suggestions',
        result: true,
        message: `Provided ${response.suggestions.length} suggestions`
      });
    }
    
    return {
      validator: 'ResponseQualityValidator',
      passed: score >= 50,
      score,
      details,
      executionTime: 40
    };
  }

  // Helper methods for quality assessment
  private countSyntaxErrors(chunks: ContentChunk[]): number {
    let errors = 0;
    chunks.forEach(chunk => {
      // Simple syntax error detection
      const content = chunk.content;
      if (content.includes('{') && !content.includes('}')) errors++;
      if (content.includes('(') && !content.includes(')')) errors++;
      if (content.includes('[') && !content.includes(']')) errors++;
    });
    return errors;
  }

  private assessNamingConsistency(chunks: ContentChunk[]): number {
    const names = chunks.map(c => c.metadata.name).filter(Boolean) as string[];
    if (names.length === 0) return 1;
    
    // Simple consistency check based on naming patterns
    const camelCaseCount = names.filter(name => /^[a-z][a-zA-Z0-9]*$/.test(name)).length;
    const pascalCaseCount = names.filter(name => /^[A-Z][a-zA-Z0-9]*$/.test(name)).length;
    const snakeCaseCount = names.filter(name => /^[a-z][a-z0-9_]*$/.test(name)).length;
    
    const maxPattern = Math.max(camelCaseCount, pascalCaseCount, snakeCaseCount);
    return maxPattern / names.length;
  }

  private assessFrameworkCompliance(chunks: ContentChunk[]): number {
    const totalChunks = chunks.length;
    if (totalChunks === 0) return 1;
    
    const compliantChunks = chunks.filter(chunk => 
      chunk.metadata.annotations.length > 0 || 
      chunk.patterns.length > 0 ||
      chunk.metadata.framework !== undefined
    ).length;
    
    return compliantChunks / totalChunks;
  }

  private identifyMissingComponents(chunks: ContentChunk[]): string[] {
    const missing: string[] = [];
    const types = new Set(chunks.map(c => c.metadata.type));
    
    // Check for common missing components based on detected frameworks
    if (!types.has('controller') && chunks.some(c => c.metadata.framework?.includes('spring'))) {
      missing.push('controller');
    }
    if (!types.has('service') && chunks.some(c => c.metadata.framework?.includes('spring'))) {
      missing.push('service');
    }
    if (!types.has('repository') && chunks.some(c => c.metadata.framework?.includes('spring'))) {
      missing.push('repository');
    }
    
    return missing;
  }

  private checkIncompleteDependencies(chunks: ContentChunk[]): number {
    return chunks.filter(chunk => 
      chunk.dependencies.some(dep => dep.includes('undefined') || dep.includes('null'))
    ).length;
  }

  private calculateDocumentationCoverage(chunks: ContentChunk[]): number {
    const documented = chunks.filter(chunk => 
      chunk.content.includes('/**') || 
      chunk.content.includes('"""') || 
      chunk.content.includes('///')
    ).length;
    
    return chunks.length > 0 ? documented / chunks.length : 0;
  }

  private identifyUnusedComponents(chunks: ContentChunk[]): ContentChunk[] {
    // Simple heuristic: components with very low importance and no references
    return chunks.filter(chunk => 
      chunk.metadata.importance < 0.3 && 
      chunk.dependencies.length === 0
    );
  }

  private assessPatternConsistency(chunks: ContentChunk[]): number {
    // Simple pattern consistency assessment
    const allPatterns = chunks.flatMap(c => c.patterns);
    const uniquePatterns = new Set(allPatterns);
    
    if (uniquePatterns.size === 0) return 1;
    
    // Check for consistent pattern usage
    const patternCounts = new Map<string, number>();
    allPatterns.forEach(pattern => {
      patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
    });
    
    const maxUsage = Math.max(...patternCounts.values());
    return maxUsage / allPatterns.length;
  }

  private assessFrameworkConsistency(chunks: ContentChunk[]): number {
    const frameworks = chunks.map(c => c.metadata.framework).filter(Boolean);
    if (frameworks.length === 0) return 1;
    
    const frameworkCounts = new Map<string, number>();
    frameworks.forEach(fw => {
      frameworkCounts.set(fw!, (frameworkCounts.get(fw!) || 0) + 1);
    });
    
    const primaryFramework = Math.max(...frameworkCounts.values());
    return primaryFramework / frameworks.length;
  }

  private assessNamingClarity(chunks: ContentChunk[]): number {
    const names = chunks.map(c => c.metadata.name).filter(Boolean) as string[];
    if (names.length === 0) return 1;
    
    // Simple clarity assessment based on name length and descriptiveness
    const clearNames = names.filter(name => 
      name.length >= 3 && 
      name.length <= 30 && 
      !/^[a-z]+$/.test(name) // Not all lowercase
    ).length;
    
    return clearNames / names.length;
  }

  private identifyDeprecatedPatterns(chunks: ContentChunk[]): string[] {
    const deprecated: string[] = [];
    
    chunks.forEach(chunk => {
      const content = chunk.content.toLowerCase();
      
      // Check for deprecated Java patterns
      if (content.includes('vector') && !content.includes('arraylist')) {
        deprecated.push('Vector usage (prefer ArrayList)');
      }
      if (content.includes('hashtable') && !content.includes('hashmap')) {
        deprecated.push('Hashtable usage (prefer HashMap)');
      }
      
      // Check for deprecated JavaScript patterns
      if (content.includes('var ') && !content.includes('let ') && !content.includes('const ')) {
        deprecated.push('var declaration (prefer let/const)');
      }
    });
    
    return deprecated;
  }

  private assessModernPractices(chunks: ContentChunk[]): number {
    const totalChunks = chunks.length;
    if (totalChunks === 0) return 1;
    
    let modernCount = 0;
    
    chunks.forEach(chunk => {
      const content = chunk.content.toLowerCase();
      
      // Check for modern Java practices
      if (content.includes('@override') || content.includes('lambda') || content.includes('stream')) {
        modernCount++;
      }
      
      // Check for modern JavaScript practices
      if (content.includes('const ') || content.includes('let ') || content.includes('=>')) {
        modernCount++;
      }
      
      // Check for modern Python practices
      if (content.includes('async def') || content.includes('type hint') || content.includes('dataclass')) {
        modernCount++;
      }
    });
    
    return modernCount / totalChunks;
  }

  private assessErrorHandling(chunks: ContentChunk[]): number {
    const totalChunks = chunks.length;
    if (totalChunks === 0) return 1;
    
    const chunksWithErrorHandling = chunks.filter(chunk => {
      const content = chunk.content.toLowerCase();
      return content.includes('try') || 
             content.includes('catch') || 
             content.includes('except') || 
             content.includes('finally') ||
             content.includes('throw') ||
             content.includes('raise');
    }).length;
    
    return chunksWithErrorHandling / totalChunks;
  }

  private identifyReliabilityIssues(chunks: ContentChunk[]): string[] {
    const issues: string[] = [];
    
    chunks.forEach(chunk => {
      const content = chunk.content.toLowerCase();
      
      // Check for potential null pointer issues
      if (content.includes('.') && !content.includes('null check') && !content.includes('optional')) {
        issues.push('Potential null pointer access');
      }
      
      // Check for resource leaks
      if ((content.includes('new ') || content.includes('open(')) && 
          !content.includes('close') && !content.includes('with ')) {
        issues.push('Potential resource leak');
      }
    });
    
    return issues;
  }

  private calculateOverallScore(dimensions: QualityDimensions, issues: QualityIssue[]): QualityScore {
    // Calculate weighted average of dimensions
    const dimensionEntries = Object.entries(dimensions) as [keyof QualityDimensions, DimensionScore][];
    const weightedSum = dimensionEntries.reduce((sum, [_, dimension]) => 
      sum + (dimension.score * dimension.weight), 0
    );
    const totalWeight = dimensionEntries.reduce((sum, [_, dimension]) => sum + dimension.weight, 0);
    
    let baseScore = weightedSum / totalWeight;
    
    // Apply issue penalties
    const criticalIssues = issues.filter(i => i.severity === IssueSeverity.Critical).length;
    const highIssues = issues.filter(i => i.severity === IssueSeverity.High).length;
    const mediumIssues = issues.filter(i => i.severity === IssueSeverity.Medium).length;
    
    baseScore -= (criticalIssues * 15) + (highIssues * 7) + (mediumIssues * 3);
    
    const finalScore = Math.max(0, Math.min(100, baseScore));
    
    // Determine quality level
    let level: QualityLevel;
    if (finalScore >= 90) level = QualityLevel.Excellent;
    else if (finalScore >= 75) level = QualityLevel.Good;
    else if (finalScore >= 60) level = QualityLevel.Fair;
    else if (finalScore >= 40) level = QualityLevel.Poor;
    else level = QualityLevel.Critical;
    
    // Calculate confidence based on number of assessments and consistency
    const confidence = Math.min(1.0, 0.7 + (dimensionEntries.length * 0.05));
    
    return {
      score: finalScore,
      level,
      confidence,
      timestamp: new Date()
    };
  }

  private calculateSimilarity(content1: string, content2: string): number {
    // Simple similarity calculation using Jaccard index
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private compareSeverity(a: IssueSeverity, b: IssueSeverity): number {
    const severityOrder = [IssueSeverity.Critical, IssueSeverity.High, IssueSeverity.Medium, IssueSeverity.Low, IssueSeverity.Info];
    return severityOrder.indexOf(a) - severityOrder.indexOf(b);
  }

  private compareRecommendationPriority(a: RecommendationPriority, b: RecommendationPriority): number {
    const priorityOrder = [RecommendationPriority.Critical, RecommendationPriority.High, RecommendationPriority.Medium, RecommendationPriority.Low];
    return priorityOrder.indexOf(a) - priorityOrder.indexOf(b);
  }

  private generateAssessmentId(): string {
    return `QA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeValidators(): void {
    this.validators.set('SyntaxValidator', new SyntaxValidator());
    this.validators.set('StructureValidator', new StructureValidator());
    this.validators.set('ConsistencyValidator', new ConsistencyValidator());
    this.validators.set('CompletenessValidator', new CompletenessValidator());
    this.validators.set('SecurityValidator', new SecurityValidator());
  }

  private initializeQualityRules(): void {
    // Initialize framework-specific quality rules
    this.rules.set('spring-boot', this.getSpringBootQualityRules());
    this.rules.set('react', this.getReactQualityRules());
    this.rules.set('angular', this.getAngularQualityRules());
    this.rules.set('python', this.getPythonQualityRules());
  }

  private getSpringBootQualityRules(): QualityRule[] {
    return [
      {
        id: 'spring-constructor-injection',
        description: 'Prefer constructor injection over field injection',
        severity: IssueSeverity.Medium,
        check: (chunk: ContentChunk) => 
          chunk.content.includes('@Autowired') && !chunk.content.includes('final')
      },
      {
        id: 'spring-transaction-management',
        description: 'Use @Transactional for data modification operations',
        severity: IssueSeverity.High,
        check: (chunk: ContentChunk) => 
          chunk.content.includes('save(') && !chunk.content.includes('@Transactional')
      }
    ];
  }

  private getReactQualityRules(): QualityRule[] {
    return [
      {
        id: 'react-hooks-dependencies',
        description: 'useEffect should have proper dependency array',
        severity: IssueSeverity.Medium,
        check: (chunk: ContentChunk) => 
          chunk.content.includes('useEffect') && !chunk.content.includes('], [')
      }
    ];
  }

  private getAngularQualityRules(): QualityRule[] {
    return [
      {
        id: 'angular-component-lifecycle',
        description: 'Implement OnDestroy for cleanup',
        severity: IssueSeverity.Low,
        check: (chunk: ContentChunk) => 
          chunk.content.includes('@Component') && !chunk.content.includes('OnDestroy')
      }
    ];
  }

  private getPythonQualityRules(): QualityRule[] {
    return [
      {
        id: 'python-type-hints',
        description: 'Use type hints for function parameters and return values',
        severity: IssueSeverity.Low,
        check: (chunk: ContentChunk) => 
          chunk.content.includes('def ') && !chunk.content.includes(': ')
      }
    ];
  }

  // Additional validation methods would be implemented for output generation...
  private async validateOutputGeneration(
    outputRequest: OutputRequest,
    generatedOutput: GeneratedOutput,
    sourceChunks: ContentChunk[]
  ): Promise<ValidationResult[]> {
    // Implementation for output validation
    return [];
  }

  private async assessResponseQuality(
    response: QueryResponse,
    relevantChunks: RelevantChunk[],
    intent: QueryIntent
  ): Promise<QualityDimensions> {
    // Implementation for query response quality assessment
    return {} as QualityDimensions;
  }

  private async assessOutputDimensions(
    generatedOutput: GeneratedOutput,
    sourceChunks: ContentChunk[],
    outputRequest: OutputRequest
  ): Promise<QualityDimensions> {
    // Implementation for output quality dimensions
    return {} as QualityDimensions;
  }

  private async identifyQueryIssues(
    query: string,
    intent: QueryIntent,
    response: QueryResponse,
    relevantChunks: RelevantChunk[]
  ): Promise<QualityIssue[]> {
    // Implementation for query-specific issue identification
    return [];
  }

  private async identifyOutputIssues(
    generatedOutput: GeneratedOutput,
    sourceChunks: ContentChunk[],
    outputRequest: OutputRequest
  ): Promise<QualityIssue[]> {
    // Implementation for output-specific issue identification
    return [];
  }

  private async generateQueryRecommendations(
    issues: QualityIssue[],
    response: QueryResponse
  ): Promise<QualityRecommendation[]> {
    // Implementation for query-specific recommendations
    return [];
  }

  private async generateOutputRecommendations(
    issues: QualityIssue[],
    generatedOutput: GeneratedOutput
  ): Promise<QualityRecommendation[]> {
    // Implementation for output-specific recommendations
    return [];
  }

  private identifyClassificationIssues(
    classification: FileClassification,
    processedContent: ProcessedContent
  ): QualityIssue[] {
    // Implementation for classification issue identification
    return [];
  }
}

// Quality metrics tracking
class QualityMetrics {
  private metrics: Map<string, number> = new Map();
  
  updateMetric(name: string, value: number): void {
    this.metrics.set(name, value);
  }
  
  getMetric(name: string): number {
    return this.metrics.get(name) || 0;
  }
  
  getAllMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
}

// Abstract validator base class
abstract class QualityValidator {
  abstract validate(content: ProcessedContent, classification: FileClassification): Promise<ValidationResult>;
}

// Concrete validator implementations
class SyntaxValidator extends QualityValidator {
  async validate(content: ProcessedContent, classification: FileClassification): Promise<ValidationResult> {
    const details: ValidationDetail[] = [];
    let score = 100;
    
    content.chunks.forEach((chunk, index) => {
      const syntaxIssues = this.checkSyntax(chunk.content);
      if (syntaxIssues > 0) {
        score -= syntaxIssues * 10;
        details.push({
          test: `syntax_chunk_${index}`,
          result: false,
          message: `${syntaxIssues} syntax issues found in ${chunk.metadata.name}`
        });
      }
    });
    
    return {
      validator: 'SyntaxValidator',
      passed: score >= 70,
      score: Math.max(0, score),
      details,
      executionTime: 100
    };
  }
  
  private checkSyntax(content: string): number {
    let issues = 0;
    
    // Simple syntax checks
    const openBraces = (content.match(/\{/g) || []).length;
    const closeBraces = (content.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) issues++;
    
    const openParens = (content.match(/\(/g) || []).length;
    const closeParens = (content.match(/\)/g) || []).length;
    if (openParens !== closeParens) issues++;
    
    return issues;
  }
}

class StructureValidator extends QualityValidator {
  async validate(content: ProcessedContent, classification: FileClassification): Promise<ValidationResult> {
    const details: ValidationDetail[] = [];
    let score = 90;
    
    // Check for proper structure organization
    const hasControllers = content.chunks.some(c => c.metadata.type.includes('controller'));
    const hasServices = content.chunks.some(c => c.metadata.type.includes('service'));
    const hasRepositories = content.chunks.some(c => c.metadata.type.includes('repository'));
    
    if (hasControllers && hasServices && hasRepositories) {
      details.push({
        test: 'layered_architecture',
        result: true,
        message: 'Proper layered architecture detected'
      });
    } else {
      score -= 20;
      details.push({
        test: 'layered_architecture',
        result: false,
        message: 'Missing components in layered architecture'
      });
    }
    
    return {
      validator: 'StructureValidator',
      passed: score >= 60,
      score,
      details,
      executionTime: 75
    };
  }
}

class ConsistencyValidator extends QualityValidator {
  async validate(content: ProcessedContent, classification: FileClassification): Promise<ValidationResult> {
    const details: ValidationDetail[] = [];
    let score = 85;
    
    // Check naming consistency
    const namingScore = this.checkNamingConsistency(content.chunks);
    score = score * namingScore;
    
    if (namingScore > 0.8) {
      details.push({
        test: 'naming_consistency',
        result: true,
        message: `Good naming consistency: ${(namingScore * 100).toFixed(1)}%`
      });
    } else {
      details.push({
        test: 'naming_consistency',
        result: false,
        message: `Poor naming consistency: ${(namingScore * 100).toFixed(1)}%`
      });
    }
    
    return {
      validator: 'ConsistencyValidator',
      passed: score >= 70,
      score,
      details,
      executionTime: 60
    };
  }
  
  private checkNamingConsistency(chunks: ContentChunk[]): number {
    const names = chunks.map(c => c.metadata.name).filter(Boolean) as string[];
    if (names.length === 0) return 1;
    
    const camelCase = names.filter(name => /^[a-z][a-zA-Z0-9]*$/.test(name)).length;
    const pascalCase = names.filter(name => /^[A-Z][a-zA-Z0-9]*$/.test(name)).length;
    
    const maxPattern = Math.max(camelCase, pascalCase);
    return maxPattern / names.length;
  }
}

class CompletenessValidator extends QualityValidator {
  async validate(content: ProcessedContent, classification: FileClassification): Promise<ValidationResult> {
    const details: ValidationDetail[] = [];
    let score = 80;
    
    // Check for complete dependency resolution
    const unresolvedDeps = content.chunks.filter(chunk => 
      chunk.dependencies.some(dep => dep.includes('undefined'))
    ).length;
    
    if (unresolvedDeps === 0) {
      details.push({
        test: 'dependency_resolution',
        result: true,
        message: 'All dependencies resolved'
      });
    } else {
      score -= unresolvedDeps * 5;
      details.push({
        test: 'dependency_resolution',
        result: false,
        message: `${unresolvedDeps} unresolved dependencies`
      });
    }
    
    return {
      validator: 'CompletenessValidator',
      passed: score >= 60,
      score,
      details,
      executionTime: 80
    };
  }
}

class SecurityValidator extends QualityValidator {
  async validate(content: ProcessedContent, classification: FileClassification): Promise<ValidationResult> {
    const details: ValidationDetail[] = [];
    let score = 95;
    
    // Check for security issues
    let securityIssues = 0;
    
    content.chunks.forEach(chunk => {
      const content = chunk.content.toLowerCase();
      
      if (content.includes('password') && content.includes('=') && content.includes('"')) {
        securityIssues++;
        details.push({
          test: 'hardcoded_credentials',
          result: false,
          message: `Potential hardcoded credentials in ${chunk.metadata.name}`
        });
      }
      
      if (content.includes('sql') && content.includes('+')) {
        securityIssues++;
        details.push({
          test: 'sql_injection',
          result: false,
          message: `Potential SQL injection risk in ${chunk.metadata.name}`
        });
      }
    });
    
    score -= securityIssues * 15;
    
    if (securityIssues === 0) {
      details.push({
        test: 'security_scan',
        result: true,
        message: 'No obvious security issues detected'
      });
    }
    
    return {
      validator: 'SecurityValidator',
      passed: score >= 70,
      score: Math.max(0, score),
      details,
      executionTime: 120
    };
  }
}

// Quality rule interface
interface QualityRule {
  id: string;
  description: string;
  severity: IssueSeverity;
  check: (chunk: ContentChunk) => boolean;
}