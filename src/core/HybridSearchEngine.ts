import { VectorDB, SearchOptions, SearchResult, SearchFilter } from './VectorDB';
import { ContentChunk } from './ContentProcessor';
import { QueryComponent, QueryFilter } from './QueryDecomposer';

export interface HybridSearchOptions extends SearchOptions {
  semanticWeight: number; // 0.0 to 1.0, weight for semantic similarity
  keywordWeight: number; // 0.0 to 1.0, weight for keyword matching
  bm25Weight: number; // 0.0 to 1.0, weight for BM25 scoring
  fuzzyMatching: boolean; // Enable fuzzy keyword matching
  synonymExpansion: boolean; // Expand query with synonyms
  contextualBoost: boolean; // Boost results based on context
  reranking: boolean; // Apply reranking after initial retrieval
  diversification: boolean; // Ensure diverse results
}

export interface HybridSearchResult extends SearchResult {
  semanticScore: number;
  keywordScore: number;
  bm25Score: number;
  combinedScore: number;
  matchingKeywords: string[];
  matchingPhrases: string[];
  contextRelevance: number;
  diversityScore: number;
  explanation: string;
}

export interface BM25Parameters {
  k1: number; // Controls term frequency saturation point (typical: 1.2-2.0)
  b: number; // Controls field length normalization (typical: 0.75)
  avgDocLength: number; // Average document length in corpus
  totalDocs: number; // Total number of documents
}

export interface TermFrequency {
  term: string;
  frequency: number;
  documentFrequency: number; // Number of documents containing this term
  positions: number[]; // Positions within the document
}

export interface DocumentIndex {
  chunkId: string;
  terms: Map<string, TermFrequency>;
  totalTerms: number;
  uniqueTerms: number;
  length: number; // Document length in characters
  keywords: string[];
  phrases: string[];
  embeddings?: number[];
}

export class HybridSearchEngine {
  private vectorDB: VectorDB;
  private documentIndex: Map<string, DocumentIndex> = new Map();
  private invertedIndex: Map<string, Set<string>> = new Map(); // term -> chunk IDs
  private termDocumentFrequency: Map<string, number> = new Map(); // term -> document frequency
  private bm25Parameters: BM25Parameters;
  private synonymMap: Map<string, string[]> = new Map();
  private phraseIndex: Map<string, Set<string>> = new Map(); // phrase -> chunk IDs

  constructor(vectorDB: VectorDB) {
    this.vectorDB = vectorDB;
    this.bm25Parameters = {
      k1: 1.5,
      b: 0.75,
      avgDocLength: 0,
      totalDocs: 0
    };
    this.initializeSynonymMap();
  }

  async indexChunks(chunks: ContentChunk[]): Promise<void> {
    console.log(`🔍 Phase 4: Building hybrid search index for ${chunks.length} chunks`);

    // Clear existing indices
    this.documentIndex.clear();
    this.invertedIndex.clear();
    this.termDocumentFrequency.clear();
    this.phraseIndex.clear();

    // Build document indices
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
    this.bm25Parameters.avgDocLength = totalLength / chunks.length;
    this.bm25Parameters.totalDocs = chunks.length;

    for (const chunk of chunks) {
      await this.indexChunk(chunk);
    }

    // Calculate document frequencies
    this.calculateDocumentFrequencies();

    console.log(`📊 Indexed ${chunks.length} chunks with ${this.invertedIndex.size} unique terms`);
  }

  async hybridSearch(
    query: string,
    options: HybridSearchOptions = this.getDefaultOptions()
  ): Promise<HybridSearchResult[]> {
    console.log(`🔍 Phase 4: Performing hybrid search for: "${query}"`);

    // Validate weights
    this.validateSearchWeights(options);

    // Step 1: Parse and prepare query
    const queryTerms = this.parseQuery(query);
    const expandedQuery = options.synonymExpansion ? this.expandQueryWithSynonyms(queryTerms) : queryTerms;

    // Step 2: Semantic search
    const semanticResults = await this.performSemanticSearch(query, options);

    // Step 3: Keyword search
    const keywordResults = await this.performKeywordSearch(expandedQuery, options);

    // Step 4: BM25 search
    const bm25Results = await this.performBM25Search(expandedQuery, options);

    // Step 5: Combine and rank results
    const combinedResults = this.combineSearchResults(
      query,
      semanticResults,
      keywordResults,
      bm25Results,
      options
    );

    // Step 6: Apply reranking if enabled
    const finalResults = options.reranking 
      ? await this.applyReranking(query, combinedResults, options)
      : combinedResults;

    // Step 7: Apply diversification if enabled
    const diversifiedResults = options.diversification
      ? this.applyDiversification(finalResults, options)
      : finalResults;

    // Step 8: Apply contextual boosting
    const contextBoostedResults = options.contextualBoost
      ? this.applyContextualBoosting(query, diversifiedResults, options)
      : diversifiedResults;

    return contextBoostedResults.slice(0, options.maxResults || 20);
  }

  async componentBasedSearch(
    components: QueryComponent[],
    options: HybridSearchOptions = this.getDefaultOptions()
  ): Promise<Map<string, HybridSearchResult[]>> {
    const results = new Map<string, HybridSearchResult[]>();

    for (const component of components) {
      console.log(`🔍 Searching for component: ${component.id} (${component.type})`);

      // Build component-specific search query
      const componentQuery = this.buildComponentQuery(component);

      // Adjust options based on component type
      const componentOptions = this.adjustOptionsForComponent(component, options);

      // Apply component filters
      componentOptions.filters = [
        ...(componentOptions.filters || []),
        ...this.convertQueryFiltersToSearchFilters(component.filters)
      ];

      // Perform search
      const componentResults = await this.hybridSearch(componentQuery, componentOptions);

      // Filter results based on component intent
      const filteredResults = this.filterResultsByIntent(componentResults, component);

      results.set(component.id, filteredResults);
    }

    return results;
  }

  private async indexChunk(chunk: ContentChunk): Promise<void> {
    const content = chunk.content.toLowerCase();
    const terms = this.tokenize(content);
    const termFreqMap = new Map<string, TermFrequency>();

    // Calculate term frequencies and positions
    terms.forEach((term, index) => {
      if (!termFreqMap.has(term)) {
        termFreqMap.set(term, {
          term,
          frequency: 0,
          documentFrequency: 0,
          positions: []
        });
      }
      const termFreq = termFreqMap.get(term)!;
      termFreq.frequency++;
      termFreq.positions.push(index);
    });

    // Extract keywords and phrases
    const keywords = this.extractKeywords(content);
    const phrases = this.extractPhrases(content);

    // Create document index
    const docIndex: DocumentIndex = {
      chunkId: chunk.id,
      terms: termFreqMap,
      totalTerms: terms.length,
      uniqueTerms: termFreqMap.size,
      length: content.length,
      keywords,
      phrases
    };

    this.documentIndex.set(chunk.id, docIndex);

    // Update inverted index
    for (const term of termFreqMap.keys()) {
      if (!this.invertedIndex.has(term)) {
        this.invertedIndex.set(term, new Set());
      }
      this.invertedIndex.get(term)!.add(chunk.id);
    }

    // Update phrase index
    for (const phrase of phrases) {
      if (!this.phraseIndex.has(phrase)) {
        this.phraseIndex.set(phrase, new Set());
      }
      this.phraseIndex.get(phrase)!.add(chunk.id);
    }
  }

  private calculateDocumentFrequencies(): void {
    for (const [term, documentIds] of this.invertedIndex.entries()) {
      this.termDocumentFrequency.set(term, documentIds.size);
      
      // Update document frequency in each document index
      for (const docId of documentIds) {
        const docIndex = this.documentIndex.get(docId);
        if (docIndex && docIndex.terms.has(term)) {
          docIndex.terms.get(term)!.documentFrequency = documentIds.size;
        }
      }
    }
  }

  private async performSemanticSearch(
    query: string,
    options: HybridSearchOptions
  ): Promise<Array<{ chunkId: string; score: number; chunk?: ContentChunk }>> {
    if (options.semanticWeight === 0) return [];

    try {
      const vectorResults = await this.vectorDB.search(query, {
        maxResults: Math.ceil((options.maxResults || 20) * 1.5), // Get more for later filtering
        filters: options.filters,
        threshold: options.threshold || 0.1
      });

      return vectorResults.map(result => ({
        chunkId: result.id,
        score: result.score,
        chunk: result.chunk
      }));
    } catch (error) {
      console.warn('Semantic search failed:', error);
      return [];
    }
  }

  private async performKeywordSearch(
    queryTerms: string[],
    options: HybridSearchOptions
  ): Promise<Array<{ chunkId: string; score: number; matchingTerms: string[] }>> {
    if (options.keywordWeight === 0) return [];

    const results: Array<{ chunkId: string; score: number; matchingTerms: string[] }> = [];
    const candidateChunks = new Set<string>();

    // Find candidate chunks containing query terms
    for (const term of queryTerms) {
      const exactMatches = this.invertedIndex.get(term) || new Set();
      for (const chunkId of exactMatches) {
        candidateChunks.add(chunkId);
      }

      // Fuzzy matching if enabled
      if (options.fuzzyMatching) {
        const fuzzyMatches = this.findFuzzyMatches(term);
        for (const fuzzyTerm of fuzzyMatches) {
          const fuzzyChunks = this.invertedIndex.get(fuzzyTerm) || new Set();
          for (const chunkId of fuzzyChunks) {
            candidateChunks.add(chunkId);
          }
        }
      }
    }

    // Score candidate chunks
    for (const chunkId of candidateChunks) {
      const docIndex = this.documentIndex.get(chunkId);
      if (!docIndex) continue;

      let score = 0;
      const matchingTerms: string[] = [];

      for (const term of queryTerms) {
        const termFreq = docIndex.terms.get(term);
        if (termFreq) {
          // Simple TF scoring with position boost
          const tf = termFreq.frequency / docIndex.totalTerms;
          const positionBoost = this.calculatePositionBoost(termFreq.positions, docIndex.totalTerms);
          score += tf * (1 + positionBoost);
          matchingTerms.push(term);
        }
      }

      // Phrase matching bonus
      const phraseBonus = this.calculatePhraseBonus(queryTerms, docIndex);
      score += phraseBonus;

      if (score > 0) {
        results.push({ chunkId, score, matchingTerms });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private async performBM25Search(
    queryTerms: string[],
    options: HybridSearchOptions
  ): Promise<Array<{ chunkId: string; score: number; termScores: Map<string, number> }>> {
    if (options.bm25Weight === 0) return [];

    const results: Array<{ chunkId: string; score: number; termScores: Map<string, number> }> = [];
    const candidateChunks = new Set<string>();

    // Find all candidate chunks
    for (const term of queryTerms) {
      const chunks = this.invertedIndex.get(term) || new Set();
      for (const chunkId of chunks) {
        candidateChunks.add(chunkId);
      }
    }

    // Calculate BM25 scores
    for (const chunkId of candidateChunks) {
      const docIndex = this.documentIndex.get(chunkId);
      if (!docIndex) continue;

      let bm25Score = 0;
      const termScores = new Map<string, number>();

      for (const term of queryTerms) {
        const termFreq = docIndex.terms.get(term);
        if (!termFreq) continue;

        const tf = termFreq.frequency;
        const df = this.termDocumentFrequency.get(term) || 1;
        const docLength = docIndex.totalTerms;

        // BM25 formula
        const idf = Math.log((this.bm25Parameters.totalDocs - df + 0.5) / (df + 0.5));
        const tfComponent = (tf * (this.bm25Parameters.k1 + 1)) / 
          (tf + this.bm25Parameters.k1 * (1 - this.bm25Parameters.b + 
          this.bm25Parameters.b * (docLength / this.bm25Parameters.avgDocLength)));
        
        const termScore = idf * tfComponent;
        bm25Score += termScore;
        termScores.set(term, termScore);
      }

      if (bm25Score > 0) {
        results.push({ chunkId, score: bm25Score, termScores });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private combineSearchResults(
    query: string,
    semanticResults: Array<{ chunkId: string; score: number; chunk?: ContentChunk }>,
    keywordResults: Array<{ chunkId: string; score: number; matchingTerms: string[] }>,
    bm25Results: Array<{ chunkId: string; score: number; termScores: Map<string, number> }>,
    options: HybridSearchOptions
  ): HybridSearchResult[] {
    const resultMap = new Map<string, HybridSearchResult>();

    // Normalize scores
    const maxSemanticScore = Math.max(...semanticResults.map(r => r.score), 1);
    const maxKeywordScore = Math.max(...keywordResults.map(r => r.score), 1);
    const maxBM25Score = Math.max(...bm25Results.map(r => r.score), 1);

    // Process semantic results
    for (const result of semanticResults) {
      const normalizedScore = result.score / maxSemanticScore;
      
      if (!resultMap.has(result.chunkId)) {
        resultMap.set(result.chunkId, {
          id: result.chunkId,
          score: 0, // Will be calculated below
          chunk: result.chunk,
          semanticScore: normalizedScore,
          keywordScore: 0,
          bm25Score: 0,
          combinedScore: 0,
          matchingKeywords: [],
          matchingPhrases: [],
          contextRelevance: 0,
          diversityScore: 0,
          explanation: ''
        });
      } else {
        resultMap.get(result.chunkId)!.semanticScore = normalizedScore;
      }
    }

    // Process keyword results
    for (const result of keywordResults) {
      const normalizedScore = result.score / maxKeywordScore;
      
      if (!resultMap.has(result.chunkId)) {
        resultMap.set(result.chunkId, {
          id: result.chunkId,
          score: 0,
          chunk: undefined,
          semanticScore: 0,
          keywordScore: normalizedScore,
          bm25Score: 0,
          combinedScore: 0,
          matchingKeywords: result.matchingTerms,
          matchingPhrases: [],
          contextRelevance: 0,
          diversityScore: 0,
          explanation: ''
        });
      } else {
        const existing = resultMap.get(result.chunkId)!;
        existing.keywordScore = normalizedScore;
        existing.matchingKeywords = result.matchingTerms;
      }
    }

    // Process BM25 results
    for (const result of bm25Results) {
      const normalizedScore = result.score / maxBM25Score;
      
      if (!resultMap.has(result.chunkId)) {
        resultMap.set(result.chunkId, {
          id: result.chunkId,
          score: 0,
          chunk: undefined,
          semanticScore: 0,
          keywordScore: 0,
          bm25Score: normalizedScore,
          combinedScore: 0,
          matchingKeywords: [],
          matchingPhrases: [],
          contextRelevance: 0,
          diversityScore: 0,
          explanation: ''
        });
      } else {
        resultMap.get(result.chunkId)!.bm25Score = normalizedScore;
      }
    }

    // Calculate combined scores and explanations
    const results: HybridSearchResult[] = [];
    for (const [chunkId, result] of resultMap.entries()) {
      // Combined score calculation
      result.combinedScore = 
        (result.semanticScore * options.semanticWeight) +
        (result.keywordScore * options.keywordWeight) +
        (result.bm25Score * options.bm25Weight);

      result.score = result.combinedScore;

      // Generate explanation
      result.explanation = this.generateScoreExplanation(result, options);

      // Calculate context relevance
      result.contextRelevance = this.calculateContextRelevance(query, result);

      results.push(result);
    }

    return results.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  private async applyReranking(
    query: string,
    results: HybridSearchResult[],
    options: HybridSearchOptions
  ): Promise<HybridSearchResult[]> {
    // Simple reranking based on query relevance and result diversity
    const queryTerms = this.parseQuery(query.toLowerCase());
    
    for (const result of results) {
      if (!result.chunk) continue;

      // Boost score based on query term density
      const content = result.chunk.content.toLowerCase();
      const termDensity = this.calculateTermDensity(queryTerms, content);
      result.combinedScore *= (1 + termDensity * 0.2);

      // Boost based on content quality indicators
      const qualityBoost = this.calculateQualityBoost(result.chunk);
      result.combinedScore *= (1 + qualityBoost);
    }

    return results.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  private applyDiversification(
    results: HybridSearchResult[],
    options: HybridSearchOptions
  ): HybridSearchResult[] {
    const diversifiedResults: HybridSearchResult[] = [];
    const seenTypes = new Set<string>();
    const seenFrameworks = new Set<string>();

    for (const result of results) {
      if (!result.chunk) {
        diversifiedResults.push(result);
        continue;
      }

      // Calculate diversity score based on type and framework diversity
      const chunkType = result.chunk.metadata.type;
      const chunkFramework = result.chunk.metadata.framework;

      let diversityBonus = 0;
      if (!seenTypes.has(chunkType)) {
        diversityBonus += 0.1;
        seenTypes.add(chunkType);
      }
      if (chunkFramework && !seenFrameworks.has(chunkFramework)) {
        diversityBonus += 0.1;
        seenFrameworks.add(chunkFramework);
      }

      result.diversityScore = diversityBonus;
      result.combinedScore += diversityBonus;

      diversifiedResults.push(result);
    }

    return diversifiedResults.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  private applyContextualBoosting(
    query: string,
    results: HybridSearchResult[],
    options: HybridSearchOptions
  ): HybridSearchResult[] {
    const queryLower = query.toLowerCase();
    
    for (const result of results) {
      if (!result.chunk) continue;

      let contextBoost = 0;

      // Boost based on chunk importance
      contextBoost += result.chunk.metadata.importance * 0.1;

      // Boost based on recency (if available)
      if (result.chunk.metadata.lastModified) {
        const daysSinceModified = (Date.now() - result.chunk.metadata.lastModified.getTime()) / (1000 * 60 * 60 * 24);
        const recencyBoost = Math.max(0, 1 - daysSinceModified / 365) * 0.05; // Boost newer content
        contextBoost += recencyBoost;
      }

      // Boost based on framework alignment
      if (options.filters) {
        for (const filter of options.filters) {
          if (filter.field === 'framework' && result.chunk.metadata.framework === filter.value) {
            contextBoost += 0.15;
          }
        }
      }

      result.contextRelevance = contextBoost;
      result.combinedScore += contextBoost;
    }

    return results.sort((a, b) => b.combinedScore - a.combinedScore);
  }

  // Utility methods
  private parseQuery(query: string): string[] {
    return this.tokenize(query.toLowerCase());
  }

  private tokenize(text: string): string[] {
    // Enhanced tokenization with programming-specific handling
    return text
      .replace(/[^\w\s.-]/g, ' ') // Keep dots and hyphens for technical terms
      .split(/\s+/)
      .filter(token => token.length > 1)
      .map(token => token.toLowerCase());
  }

  private extractKeywords(content: string): string[] {
    // Extract meaningful keywords using various patterns
    const keywords = new Set<string>();

    // Class names, function names, variables (camelCase, PascalCase)
    const identifierPattern = /\b[a-zA-Z_][a-zA-Z0-9_]*[A-Z][a-zA-Z0-9_]*\b/g;
    const identifiers = content.match(identifierPattern) || [];
    identifiers.forEach(id => keywords.add(id.toLowerCase()));

    // Technical terms and frameworks
    const technicalPattern = /\b(class|function|method|interface|component|service|controller|model|api|endpoint|database|table|field|property|parameter|variable|constant)\b/gi;
    const technical = content.match(technicalPattern) || [];
    technical.forEach(term => keywords.add(term.toLowerCase()));

    return Array.from(keywords).slice(0, 20); // Limit keywords
  }

  private extractPhrases(content: string): string[] {
    const phrases: string[] = [];
    const words = this.tokenize(content);

    // Extract 2-3 word phrases
    for (let i = 0; i < words.length - 1; i++) {
      // 2-word phrases
      phrases.push(`${words[i]} ${words[i + 1]}`);
      
      // 3-word phrases
      if (i < words.length - 2) {
        phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
      }
    }

    return phrases.slice(0, 50); // Limit phrases
  }

  private expandQueryWithSynonyms(queryTerms: string[]): string[] {
    const expanded = new Set(queryTerms);
    
    for (const term of queryTerms) {
      const synonyms = this.synonymMap.get(term) || [];
      synonyms.forEach(synonym => expanded.add(synonym));
    }
    
    return Array.from(expanded);
  }

  private findFuzzyMatches(term: string): string[] {
    const matches: string[] = [];
    const threshold = 0.8; // Similarity threshold
    
    for (const indexedTerm of this.invertedIndex.keys()) {
      if (this.calculateSimilarity(term, indexedTerm) >= threshold) {
        matches.push(indexedTerm);
      }
    }
    
    return matches;
  }

  private calculateSimilarity(term1: string, term2: string): number {
    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(term1, term2);
    const maxLength = Math.max(term1.length, term2.length);
    return 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private calculatePositionBoost(positions: number[], totalTerms: number): number {
    // Boost terms that appear early in the document
    if (positions.length === 0) return 0;
    
    const avgPosition = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
    const normalizedPosition = avgPosition / totalTerms;
    
    return Math.max(0, 1 - normalizedPosition) * 0.2; // Max 20% boost
  }

  private calculatePhraseBonus(queryTerms: string[], docIndex: DocumentIndex): number {
    if (queryTerms.length < 2) return 0;
    
    let bonus = 0;
    
    // Check for exact phrase matches
    for (let i = 0; i < queryTerms.length - 1; i++) {
      const phrase = `${queryTerms[i]} ${queryTerms[i + 1]}`;
      if (docIndex.phrases.includes(phrase)) {
        bonus += 0.1;
      }
    }
    
    return bonus;
  }

  private calculateTermDensity(queryTerms: string[], content: string): number {
    if (queryTerms.length === 0) return 0;
    
    const words = this.tokenize(content);
    let matches = 0;
    
    for (const word of words) {
      if (queryTerms.includes(word)) {
        matches++;
      }
    }
    
    return words.length > 0 ? matches / words.length : 0;
  }

  private calculateQualityBoost(chunk: ContentChunk): number {
    let qualityScore = 0;
    
    // Boost based on content length (moderate length is often better)
    const length = chunk.content.length;
    if (length > 100 && length < 2000) qualityScore += 0.05;
    
    // Boost based on code structure indicators
    if (chunk.content.includes('function') || chunk.content.includes('class')) {
      qualityScore += 0.05;
    }
    
    // Boost based on documentation indicators
    if (chunk.content.includes('/**') || chunk.content.includes('//')) {
      qualityScore += 0.03;
    }
    
    return Math.min(0.2, qualityScore); // Cap at 20% boost
  }

  private calculateContextRelevance(query: string, result: HybridSearchResult): number {
    if (!result.chunk) return 0;
    
    let relevance = 0;
    const queryLower = query.toLowerCase();
    const content = result.chunk.content.toLowerCase();
    
    // Check for direct query substring matches
    if (content.includes(queryLower)) {
      relevance += 0.2;
    }
    
    // Check for metadata alignment
    if (result.chunk.metadata.name && 
        result.chunk.metadata.name.toLowerCase().includes(queryLower)) {
      relevance += 0.3;
    }
    
    return Math.min(1.0, relevance);
  }

  private generateScoreExplanation(result: HybridSearchResult, options: HybridSearchOptions): string {
    const explanations: string[] = [];
    
    if (result.semanticScore > 0 && options.semanticWeight > 0) {
      explanations.push(`semantic similarity: ${(result.semanticScore * 100).toFixed(1)}%`);
    }
    
    if (result.keywordScore > 0 && options.keywordWeight > 0) {
      explanations.push(`keyword matching: ${(result.keywordScore * 100).toFixed(1)}%`);
    }
    
    if (result.bm25Score > 0 && options.bm25Weight > 0) {
      explanations.push(`relevance ranking: ${(result.bm25Score * 100).toFixed(1)}%`);
    }
    
    if (result.matchingKeywords.length > 0) {
      explanations.push(`matches: [${result.matchingKeywords.join(', ')}]`);
    }
    
    return explanations.join(', ') || 'combined scoring';
  }

  private buildComponentQuery(component: QueryComponent): string {
    const queryParts: string[] = [];
    
    // Add component subject
    if (component.intent.subject) {
      queryParts.push(component.intent.subject);
    }
    
    // Add keywords
    queryParts.push(...component.keywords);
    
    // Add entities
    queryParts.push(...component.entities);
    
    // Add action-specific terms
    switch (component.intent.action) {
      case 'find':
        queryParts.push('implementation', 'definition');
        break;
      case 'explain':
        queryParts.push('documentation', 'description');
        break;
      case 'analyze':
        queryParts.push('structure', 'pattern');
        break;
    }
    
    return queryParts.join(' ');
  }

  private adjustOptionsForComponent(component: QueryComponent, baseOptions: HybridSearchOptions): HybridSearchOptions {
    const adjusted = { ...baseOptions };
    
    // Adjust weights based on component type
    switch (component.type) {
      case 'semantic':
        adjusted.semanticWeight = Math.max(adjusted.semanticWeight, 0.6);
        break;
      case 'structural':
        adjusted.keywordWeight = Math.max(adjusted.keywordWeight, 0.7);
        break;
      case 'technical':
        adjusted.bm25Weight = Math.max(adjusted.bm25Weight, 0.5);
        break;
    }
    
    // Adjust based on expected output type
    if (component.expectedOutputType === 'code') {
      adjusted.keywordWeight *= 1.2;
    } else if (component.expectedOutputType === 'explanation') {
      adjusted.semanticWeight *= 1.2;
    }
    
    return adjusted;
  }

  private convertQueryFiltersToSearchFilters(queryFilters: QueryFilter[]): SearchFilter[] {
    return queryFilters.map(qf => ({
      field: qf.field,
      value: qf.value,
      operator: qf.operator as any, // Type conversion needed
      weight: qf.weight
    }));
  }

  private filterResultsByIntent(results: HybridSearchResult[], component: QueryComponent): HybridSearchResult[] {
    return results.filter(result => {
      if (!result.chunk) return true;
      
      // Apply scope filtering
      switch (component.intent.scope) {
        case 'class':
          return result.chunk.metadata.type.includes('class') || 
                 result.chunk.content.toLowerCase().includes('class');
        case 'function':
          return result.chunk.metadata.type.includes('function') || 
                 result.chunk.content.toLowerCase().includes('function');
        case 'file':
          return result.chunk.chunkType.toString().includes('file');
        default:
          return true;
      }
    });
  }

  private validateSearchWeights(options: HybridSearchOptions): void {
    const totalWeight = options.semanticWeight + options.keywordWeight + options.bm25Weight;
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      console.warn(`Search weights don't sum to 1.0: ${totalWeight}. Results may be skewed.`);
    }
  }

  private initializeSynonymMap(): void {
    // Common programming synonyms
    this.synonymMap.set('function', ['method', 'procedure', 'routine']);
    this.synonymMap.set('method', ['function', 'procedure', 'routine']);
    this.synonymMap.set('class', ['object', 'type', 'entity']);
    this.synonymMap.set('variable', ['var', 'property', 'field']);
    this.synonymMap.set('parameter', ['param', 'argument', 'arg']);
    this.synonymMap.set('return', ['result', 'output', 'response']);
    this.synonymMap.set('create', ['make', 'build', 'generate', 'new']);
    this.synonymMap.set('delete', ['remove', 'destroy', 'drop']);
    this.synonymMap.set('update', ['modify', 'change', 'edit']);
    this.synonymMap.set('get', ['fetch', 'retrieve', 'obtain']);
    this.synonymMap.set('set', ['assign', 'store', 'save']);
    this.synonymMap.set('check', ['validate', 'verify', 'test']);
    this.synonymMap.set('handle', ['process', 'manage', 'deal']);
    this.synonymMap.set('error', ['exception', 'failure', 'issue']);
    this.synonymMap.set('config', ['configuration', 'settings', 'options']);
  }

  private getDefaultOptions(): HybridSearchOptions {
    return {
      semanticWeight: 0.4,
      keywordWeight: 0.35,
      bm25Weight: 0.25,
      fuzzyMatching: true,
      synonymExpansion: true,
      contextualBoost: true,
      reranking: true,
      diversification: true,
      maxResults: 20,
      threshold: 0.1
    };
  }

  // Public utility methods
  getIndexStats(): {
    totalChunks: number;
    totalTerms: number;
    avgDocLength: number;
    totalPhrases: number;
  } {
    return {
      totalChunks: this.documentIndex.size,
      totalTerms: this.invertedIndex.size,
      avgDocLength: this.bm25Parameters.avgDocLength,
      totalPhrases: this.phraseIndex.size
    };
  }

  updateBM25Parameters(params: Partial<BM25Parameters>): void {
    this.bm25Parameters = { ...this.bm25Parameters, ...params };
  }

  clearIndex(): void {
    this.documentIndex.clear();
    this.invertedIndex.clear();
    this.termDocumentFrequency.clear();
    this.phraseIndex.clear();
    this.bm25Parameters.totalDocs = 0;
    this.bm25Parameters.avgDocLength = 0;
  }
}