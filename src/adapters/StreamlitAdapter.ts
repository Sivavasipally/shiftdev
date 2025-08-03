import { ContentChunk } from '../core/ContentProcessor';
import { QueryIntent } from '../core/QueryProcessor';
import { OutputRequest } from '../core/OutputGenerator';
import { 
  FrameworkAdapter, 
  FrameworkCapabilities, 
  FrameworkPattern, 
  ArchitecturalLayer, 
  BestPractice, 
  SecurityGuideline, 
  PerformanceOptimization 
} from '../core/FrameworkAdapter';

export class StreamlitAdapter implements FrameworkAdapter {
  frameworkName = 'Streamlit';
  version = '1.20+';
  capabilities: FrameworkCapabilities = {
    supportsLayeredArchitecture: false,
    supportsAnnotations: false,
    supportsDependencyInjection: false,
    supportsAOP: false,
    supportsORM: false,
    supportsRESTAPI: false,
    supportsGraphQL: false,
    supportsWebSockets: false,
    supportsReactiveProgramming: true,
    supportsTesting: true,
    supportsSecurity: false,
    supportsMetrics: false
  };

  async adaptContentProcessing(content: any): Promise<any> {
    const adaptedContent = { ...content };
    
    // Enhance Streamlit-specific content processing
    adaptedContent.chunks = await Promise.all(
      content.chunks.map((chunk: ContentChunk) => this.adaptChunk(chunk))
    );
    
    return adaptedContent;
  }

  async adaptQueryProcessing(query: string, intent: QueryIntent, chunks: ContentChunk[]): Promise<any> {
    const streamlitChunks = chunks.filter(chunk => this.isRelevantChunk(chunk, intent));
    
    return {
      answer: await this.generateFrameworkSpecificAnswer(query, intent, streamlitChunks),
      relevantChunks: streamlitChunks.map(chunk => ({
        chunk,
        relevanceScore: this.calculateFrameworkRelevance(chunk, intent),
        explanation: this.generateFrameworkExplanation(chunk, intent),
        contextType: 'framework' as any
      })),
      suggestions: this.getFrameworkSpecificSuggestions(intent),
      confidence: 0.8,
      metadata: {
        processingTime: 0,
        chunksAnalyzed: chunks.length,
        intentConfidence: intent.confidence,
        sources: chunks.map(c => c.id),
        frameworks: [this.frameworkName],
        followUpQuestions: this.generateFrameworkFollowUps(intent)
      }
    };
  }

  async adaptOutputGeneration(request: OutputRequest, chunks: ContentChunk[]): Promise<any> {
    const content = await this.generateFrameworkSpecificContent(request, chunks);
    
    return {
      content,
      metadata: {
        type: request.type,
        format: request.parameters.format,
        generatedAt: new Date(),
        version: '1.0.0',
        sources: chunks.map(c => c.id),
        wordCount: content.split(/\s+/).length,
        estimatedReadTime: Math.ceil(content.split(/\s+/).length / 200),
        sections: []
      }
    };
  }

  private async adaptChunk(chunk: ContentChunk): Promise<ContentChunk> {
    const adaptedChunk = { ...chunk };
    
    // Enhance Streamlit-specific metadata
    if (chunk.content.includes('st.sidebar')) {
      adaptedChunk.metadata.tags.push('sidebar', 'layout');
      adaptedChunk.metadata.importance = Math.max(chunk.metadata.importance, 0.7);
    }
    
    if (chunk.content.includes('st.columns')) {
      adaptedChunk.metadata.tags.push('columns', 'layout');
      adaptedChunk.metadata.importance = Math.max(chunk.metadata.importance, 0.6);
    }
    
    if (chunk.content.includes('@st.cache') || chunk.content.includes('@st.experimental_memo')) {
      adaptedChunk.metadata.tags.push('caching', 'performance');
      adaptedChunk.metadata.importance = Math.max(chunk.metadata.importance, 0.8);
    }
    
    if (chunk.content.includes('st.session_state')) {
      adaptedChunk.metadata.tags.push('state-management', 'session');
      adaptedChunk.metadata.importance = Math.max(chunk.metadata.importance, 0.7);
    }
    
    // Add Streamlit-specific patterns
    if (chunk.content.includes('st.file_uploader')) {
      adaptedChunk.patterns.push('file-upload');
    }
    
    if (chunk.content.includes('st.dataframe') || chunk.content.includes('st.table')) {
      adaptedChunk.patterns.push('data-display');
    }
    
    if (chunk.content.includes('plotly') || chunk.content.includes('pyplot') || chunk.content.includes('chart')) {
      adaptedChunk.patterns.push('visualization');
    }
    
    return adaptedChunk;
  }

  private isRelevantChunk(chunk: ContentChunk, intent: QueryIntent): boolean {
    const streamlitPatterns = ['st.', 'streamlit', '@st.cache', 'st.session_state', 'st.sidebar'];
    return streamlitPatterns.some(pattern => chunk.content.includes(pattern));
  }

  private async generateFrameworkSpecificAnswer(query: string, intent: QueryIntent, chunks: ContentChunk[]): Promise<string> {
    let answer = `Based on your Streamlit application structure:\n\n`;
    
    const pages = chunks.filter(c => c.metadata.type === 'page');
    const widgets = chunks.filter(c => c.metadata.type === 'widget');
    const displays = chunks.filter(c => c.metadata.type === 'display');
    const layouts = chunks.filter(c => c.metadata.type === 'layout');
    const cachedFunctions = chunks.filter(c => c.metadata.type === 'cached_function');
    
    if (pages.length > 0) {
      answer += `## Pages (${pages.length})\n`;
      pages.forEach(page => {
        answer += `- **${page.metadata.name}**: Streamlit page function\n`;
      });
      answer += '\n';
    }
    
    if (widgets.length > 0) {
      answer += `## Interactive Widgets (${widgets.length})\n`;
      const widgetTypes = [...new Set(widgets.map(w => w.metadata.name))];
      widgetTypes.forEach(type => {
        const count = widgets.filter(w => w.metadata.name === type).length;
        answer += `- **${type}**: ${count} instance(s)\n`;
      });
      answer += '\n';
    }
    
    if (displays.length > 0) {
      answer += `## Data Display Components (${displays.length})\n`;
      const displayTypes = [...new Set(displays.map(d => d.metadata.name))];
      displayTypes.forEach(type => {
        const count = displays.filter(d => d.metadata.name === type).length;
        answer += `- **${type}**: ${count} instance(s)\n`;
      });
      answer += '\n';
    }
    
    if (layouts.length > 0) {
      answer += `## Layout Components (${layouts.length})\n`;
      const layoutTypes = [...new Set(layouts.map(l => l.metadata.name))];
      layoutTypes.forEach(type => {
        const count = layouts.filter(l => l.metadata.name === type).length;
        answer += `- **${type}**: ${count} instance(s)\n`;
      });
      answer += '\n';
    }
    
    if (cachedFunctions.length > 0) {
      answer += `## Cached Functions (${cachedFunctions.length})\n`;
      cachedFunctions.forEach(func => {
        answer += `- **${func.metadata.name}**: Performance-optimized function\n`;
      });
    }
    
    return answer;
  }

  private calculateFrameworkRelevance(chunk: ContentChunk, intent: QueryIntent): number {
    let relevance = 0.5;
    
    if (chunk.content.includes('import streamlit as st')) relevance += 0.4;
    if (chunk.content.includes('st.title') || chunk.content.includes('st.header')) relevance += 0.2;
    if (chunk.content.includes('st.sidebar')) relevance += 0.2;
    if (chunk.content.includes('@st.cache')) relevance += 0.3;
    if (chunk.content.includes('st.session_state')) relevance += 0.2;
    
    return Math.min(1.0, relevance);
  }

  private generateFrameworkExplanation(chunk: ContentChunk, intent: QueryIntent): string {
    if (chunk.metadata.type === 'page') {
      return 'Streamlit page function that defines app layout and behavior';
    }
    if (chunk.metadata.type === 'widget') {
      return `Streamlit ${chunk.metadata.name} widget for user interaction`;
    }
    if (chunk.metadata.type === 'display') {
      return `Streamlit ${chunk.metadata.name} component for data visualization`;
    }
    if (chunk.metadata.type === 'layout') {
      return `Streamlit ${chunk.metadata.name} for organizing app layout`;
    }
    if (chunk.metadata.type === 'cached_function') {
      return 'Streamlit cached function for performance optimization';
    }
    return 'Streamlit component';
  }

  private getFrameworkSpecificSuggestions(intent: QueryIntent): string[] {
    return [
      'Use st.cache_data for data loading functions',
      'Implement proper session state management',
      'Consider using st.columns for better layout',
      'Add file uploaders for interactive data analysis',
      'Use st.sidebar for navigation and controls'
    ];
  }

  private generateFrameworkFollowUps(intent: QueryIntent): string[] {
    return [
      'How can I implement multi-page navigation in Streamlit?',
      'What are the best practices for Streamlit performance optimization?',
      'How can I add authentication to my Streamlit app?'
    ];
  }

  private async generateFrameworkSpecificContent(request: OutputRequest, chunks: ContentChunk[]): Promise<string> {
    let content = `# Streamlit Application Guide\n\n`;
    
    content += `## Application Overview\n\n`;
    content += `This Streamlit application provides an interactive web interface for data analysis and visualization.\n\n`;
    
    content += `## Key Components\n\n`;
    
    const componentTypes = ['page', 'widget', 'display', 'layout', 'cached_function'];
    componentTypes.forEach(type => {
      const typeChunks = chunks.filter(chunk => chunk.metadata.type === type);
      if (typeChunks.length > 0) {
        content += `### ${type.charAt(0).toUpperCase() + type.slice(1)} Components\n`;
        typeChunks.slice(0, 5).forEach(chunk => {
          content += `- **${chunk.metadata.name}**: ${chunk.metadata.tags.join(', ')}\n`;
        });
        content += '\n';
      }
    });
    
    content += `## Streamlit Features Used\n\n`;
    const features = new Set<string>();
    chunks.forEach(chunk => {
      chunk.patterns.forEach(pattern => features.add(pattern));
    });
    
    Array.from(features).forEach(feature => {
      content += `- ${feature}\n`;
    });
    content += '\n';
    
    const bestPractices = this.getBestPractices();
    content += `## Best Practices\n\n`;
    bestPractices.slice(0, 5).forEach(practice => {
      content += `### ${practice.title}\n`;
      content += `${practice.description}\n\n`;
    });
    
    return content;
  }

  getFrameworkPatterns(): FrameworkPattern[] {
    return [
      {
        name: 'Session State Management',
        description: 'Persistent state across Streamlit reruns',
        usage: 'st.session_state.key = value',
        example: 'if "counter" not in st.session_state:\n    st.session_state.counter = 0',
        benefits: ['Maintains state between interactions', 'Enables complex app behavior'],
        caveats: ['Can lead to memory issues with large data', 'Debugging can be challenging']
      },
      {
        name: 'Caching',
        description: 'Performance optimization for expensive operations',
        usage: '@st.cache_data or @st.cache_resource',
        example: '@st.cache_data\ndef load_data():\n    return pd.read_csv("data.csv")',
        benefits: ['Improved performance', 'Better user experience'],
        caveats: ['Cache invalidation complexity', 'Memory usage considerations']
      },
      {
        name: 'Layout Organization',
        description: 'Structured layout using columns and containers',
        usage: 'st.columns(), st.container(), st.sidebar',
        example: 'col1, col2 = st.columns(2)\nwith col1:\n    st.write("Left column")',
        benefits: ['Professional appearance', 'Better user experience'],
        caveats: ['Mobile responsiveness limitations', 'Complex layouts can be tricky']
      }
    ];
  }

  getArchitecturalLayers(): ArchitecturalLayer[] {
    return [
      {
        name: 'Presentation Layer',
        purpose: 'User interface and interaction components',
        components: ['widgets', 'displays', 'layouts'],
        responsibilities: ['User input handling', 'Data visualization', 'Layout management'],
        dependencies: ['Data Layer']
      },
      {
        name: 'Logic Layer',
        purpose: 'Business logic and data processing',
        components: ['cached_functions', 'utility_functions'],
        responsibilities: ['Data processing', 'Calculations', 'API calls'],
        dependencies: ['Data Layer']
      },
      {
        name: 'Data Layer',
        purpose: 'Data loading and management',
        components: ['data_loaders', 'file_handlers'],
        responsibilities: ['Data loading', 'File processing', 'External API integration'],
        dependencies: ['External Sources']
      }
    ];
  }

  getBestPractices(): BestPractice[] {
    return [
      {
        category: 'Performance',
        title: 'Use Caching Strategically',
        description: 'Cache expensive operations like data loading and API calls',
        implementation: 'Use @st.cache_data for data and @st.cache_resource for connections',
        priority: 'high',
        impact: 'Significant performance improvement and better user experience'
      },
      {
        category: 'State Management',
        title: 'Implement Session State Properly',
        description: 'Use session state to maintain data across interactions',
        implementation: 'Initialize session state variables and use them consistently',
        priority: 'medium',
        impact: 'Enables complex application behavior and better UX'
      },
      {
        category: 'Layout',
        title: 'Organize Layout with Containers',
        description: 'Use columns, containers, and sidebar for structured layouts',
        implementation: 'Plan layout structure and use appropriate container types',
        priority: 'medium',
        impact: 'Professional appearance and better usability'
      },
      {
        category: 'Error Handling',
        title: 'Implement Robust Error Handling',
        description: 'Handle file upload errors and data processing exceptions',
        implementation: 'Use try-except blocks and display user-friendly error messages',
        priority: 'high',
        impact: 'Better user experience and application stability'
      }
    ];
  }

  getSecurityGuidelines(): SecurityGuideline[] {
    return [
      {
        area: 'File Uploads',
        guideline: 'Validate and sanitize uploaded files',
        implementation: 'Check file types, sizes, and content before processing',
        riskLevel: 'high',
        mitigation: 'Implement file type restrictions and size limits'
      },
      {
        area: 'Data Exposure',
        guideline: 'Avoid exposing sensitive data in the interface',
        implementation: 'Filter sensitive columns and implement data masking',
        riskLevel: 'medium',
        mitigation: 'Use data anonymization and access controls'
      }
    ];
  }

  getPerformanceOptimizations(): PerformanceOptimization[] {
    return [
      {
        area: 'Data Loading',
        optimization: 'Implement efficient data caching',
        implementation: 'Use @st.cache_data with appropriate TTL',
        expectedGain: '70-90% reduction in load times',
        complexity: 'low'
      },
      {
        area: 'Large Datasets',
        optimization: 'Implement data pagination and lazy loading',
        implementation: 'Show data in chunks and implement virtual scrolling',
        expectedGain: '50-80% improvement in responsiveness',
        complexity: 'medium'
      },
      {
        area: 'Visualization',
        optimization: 'Use efficient plotting libraries',
        implementation: 'Choose appropriate chart types and optimize data format',
        expectedGain: '30-60% faster rendering',
        complexity: 'low'
      }
    ];
  }
}