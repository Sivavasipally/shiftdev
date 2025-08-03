/**
 * BM25 implementation for better text matching in RAG pipeline
 */
export class BM25 {
  private k1: number = 1.2;  // Term frequency saturation parameter
  private b: number = 0.75;  // Length normalization parameter
  private documentLengths: number[] = [];
  private averageDocLength: number = 0;
  private documentCount: number = 0;
  private termFrequencies: Map<string, Map<number, number>> = new Map();
  private documentFrequencies: Map<string, number> = new Map();
  private vocabulary: Set<string> = new Set();
  private documents: string[] = [];

  constructor(documents: string[] = [], k1: number = 1.2, b: number = 0.75) {
    this.k1 = k1;
    this.b = b;
    if (documents.length > 0) {
      this.addDocuments(documents);
    }
  }

  /**
   * Add documents to the BM25 index
   */
  addDocuments(documents: string[]): void {
    this.documents = documents;
    this.documentCount = documents.length;
    this.documentLengths = [];
    this.termFrequencies.clear();
    this.documentFrequencies.clear();
    this.vocabulary.clear();

    // Process each document
    documents.forEach((doc, docIndex) => {
      const tokens = this.tokenize(doc);
      this.documentLengths.push(tokens.length);

      // Count term frequencies in this document
      const termCounts = new Map<string, number>();
      tokens.forEach(token => {
        termCounts.set(token, (termCounts.get(token) || 0) + 1);
        this.vocabulary.add(token);
      });

      // Store term frequencies for this document
      termCounts.forEach((freq, term) => {
        if (!this.termFrequencies.has(term)) {
          this.termFrequencies.set(term, new Map());
        }
        this.termFrequencies.get(term)!.set(docIndex, freq);

        // Update document frequency
        this.documentFrequencies.set(term, (this.documentFrequencies.get(term) || 0) + 1);
      });
    });

    // Calculate average document length
    this.averageDocLength = this.documentLengths.reduce((sum, len) => sum + len, 0) / this.documentCount;
  }

  /**
   * Score documents against a query using BM25
   */
  score(query: string): number[];
  score(query: string, documentIndex: number): number;
  score(query: string, documentIndex?: number): number | number[] {
    const queryTokens = this.tokenize(query);
    
    if (documentIndex !== undefined) {
      // Score specific document
      return this.scoreDocument(queryTokens, documentIndex);
    }
    
    // Score all documents
    const scores = new Array(this.documentCount).fill(0);

    queryTokens.forEach(term => {
      if (!this.termFrequencies.has(term)) {
        return; // Term not in corpus
      }

      const df = this.documentFrequencies.get(term) || 0;
      const idf = Math.log((this.documentCount - df + 0.5) / (df + 0.5));

      const termDocs = this.termFrequencies.get(term)!;
      termDocs.forEach((tf, docIndex) => {
        const docLength = this.documentLengths[docIndex];
        const normalizedTF = tf / (tf + this.k1 * (1 - this.b + this.b * (docLength / this.averageDocLength)));
        scores[docIndex] += idf * normalizedTF;
      });
    });

    return scores;
  }

  /**
   * Get top-k documents for a query
   */
  search(query: string, k: number = 10): Array<{ index: number; score: number }> {
    const scores = this.score(query);
    const results = scores
      .map((score, index) => ({ index, score }))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);

    return results;
  }

  /**
   * Generate sparse vector representation for a document
   */
  generateSparseVector(text: string): Record<string, number> {
    const tokens = this.tokenize(text);
    const termCounts = new Map<string, number>();
    
    tokens.forEach(token => {
      termCounts.set(token, (termCounts.get(token) || 0) + 1);
    });

    const sparseVector: Record<string, number> = {};
    
    termCounts.forEach((tf, term) => {
      const df = this.documentFrequencies.get(term) || 1;
      const idf = Math.log((this.documentCount + 1) / (df + 1));
      
      // TF-IDF style weighting with BM25 normalization
      const normalizedTF = tf / (tf + this.k1 * (1 - this.b + this.b * (tokens.length / this.averageDocLength)));
      sparseVector[term] = idf * normalizedTF;
    });

    return sparseVector;
  }

  /**
   * Simple tokenization - can be enhanced for specific programming languages
   */
  private tokenize(text: string): string[] {
    // Enhanced tokenization for code
    return text
      .toLowerCase()
      // Split on common delimiters but preserve programming constructs
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
      .replace(/[_\-\.]/g, ' ') // underscores, hyphens, dots
      .replace(/[^\w\s]/g, ' ') // punctuation
      .split(/\s+/)
      .filter(token => 
        token.length > 1 && 
        !this.isStopWord(token) &&
        !/^\d+$/.test(token) // Filter out pure numbers
      );
  }

  /**
   * Basic stop word filtering
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'were', 'will', 'with', 'var', 'let', 'const',
      'if', 'else', 'return', 'true', 'false', 'null', 'undefined'
    ]);
    return stopWords.has(word);
  }

  /**
   * Get vocabulary size
   */
  getVocabularySize(): number {
    return this.vocabulary.size;
  }

  /**
   * Get document count
   */
  getDocumentCount(): number {
    return this.documentCount;
  }

  /**
   * Score a specific document against query tokens
   */
  private scoreDocument(queryTokens: string[], documentIndex: number): number {
    if (documentIndex >= this.documentCount) {
      return 0;
    }
    
    let score = 0;
    
    queryTokens.forEach(term => {
      if (!this.termFrequencies.has(term)) {
        return; // Term not in corpus
      }
      
      const tf = this.termFrequencies.get(term)!.get(documentIndex) || 0;
      if (tf === 0) {
        return; // Term not in this document
      }
      
      const df = this.documentFrequencies.get(term) || 0;
      const idf = Math.log((this.documentCount - df + 0.5) / (df + 0.5));
      
      const docLength = this.documentLengths[documentIndex];
      const normalizedTF = tf / (tf + this.k1 * (1 - this.b + this.b * (docLength / this.averageDocLength)));
      
      score += idf * normalizedTF;
    });
    
    return score;
  }
  
  /**
   * Update parameters
   */
  updateParameters(k1: number, b: number): void {
    this.k1 = k1;
    this.b = b;
  }
}