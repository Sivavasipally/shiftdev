import { VectorDB } from './VectorDB';
import { LLMManager } from './LLMManager';

export interface APIEndpoint {
  path: string;
  method: string;
  filePath: string;
  lineNumber?: number;
  handler: string;
  framework: string;
  description?: string;
  parameters?: EndpointParameter[];
  requestBody?: RequestBodyInfo;
  responses?: ResponseInfo[];
  middleware?: string[];
  authentication?: AuthenticationInfo;
  validation?: ValidationInfo[];
  tags?: string[];
  deprecated?: boolean;
}

export interface EndpointParameter {
  name: string;
  type: 'path' | 'query' | 'header' | 'cookie';
  dataType: string;
  required: boolean;
  description?: string;
  example?: any;
}

export interface RequestBodyInfo {
  contentType: string;
  schema?: any;
  example?: any;
  required: boolean;
}

export interface ResponseInfo {
  statusCode: number;
  description: string;
  contentType?: string;
  schema?: any;
  example?: any;
}

export interface AuthenticationInfo {
  type: 'bearer' | 'basic' | 'api-key' | 'oauth' | 'session' | 'none';
  description?: string;
  required: boolean;
}

export interface ValidationInfo {
  field: string;
  rules: string[];
  message?: string;
}

export interface EndpointGroup {
  name: string;
  basePath: string;
  endpoints: APIEndpoint[];
  description?: string;
}

export interface APIDocumentation {
  totalEndpoints: number;
  endpointsByMethod: { [method: string]: number };
  endpointsByFramework: { [framework: string]: number };
  groups: EndpointGroup[];
  allEndpoints: APIEndpoint[];
  baseUrls: string[];
  openApiSpec?: any;
}

export class EndpointDetector {
  private vectorDB: VectorDB;
  private llmManager: LLMManager;

  // Framework-specific endpoint patterns
  private readonly endpointPatterns = {
    express: {
      patterns: [
        /app\.(get|post|put|delete|patch|head|options|all)\s*\(\s*['"`]([^'"`]+)['"`]/g,
        /router\.(get|post|put|delete|patch|head|options|all)\s*\(\s*['"`]([^'"`]+)['"`]/g,
        /\.route\s*\(\s*['"`]([^'"`]+)['"`]\s*\)\s*\.(get|post|put|delete|patch)\s*\(/g
      ],
      middleware: [
        /app\.use\s*\(\s*['"`]([^'"`]+)['"`]/g,
        /router\.use\s*\(\s*['"`]([^'"`]+)['"`]/g
      ]
    },
    fastapi: {
      patterns: [
        /@app\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/g,
        /@router\.(get|post|put|delete|patch|head|options)\s*\(\s*['"`]([^'"`]+)['"`]/g
      ],
      decorators: [
        /@app\.(get|post|put|delete|patch|head|options)/g,
        /@router\.(get|post|put|delete|patch|head|options)/g
      ]
    },
    flask: {
      patterns: [
        /@app\.route\s*\(\s*['"`]([^'"`]+)['"`](?:.*?methods\s*=\s*\[['"`]([^'"`]+)['"`]\])?/g,
        /@bp\.route\s*\(\s*['"`]([^'"`]+)['"`](?:.*?methods\s*=\s*\[['"`]([^'"`]+)['"`]\])?/g,
        /app\.add_url_rule\s*\(\s*['"`]([^'"`]+)['"`]/g
      ]
    },
    django: {
      patterns: [
        /path\s*\(\s*['"`]([^'"`]+)['"`]/g,
        /re_path\s*\(\s*r?['"`]([^'"`]+)['"`]/g,
        /url\s*\(\s*r?['"`]([^'"`]+)['"`]/g
      ]
    },
    springboot: {
      patterns: [
        /@(Get|Post|Put|Delete|Patch)Mapping\s*\(\s*(?:value\s*=\s*)?['"`]([^'"`]+)['"`]/g,
        /@RequestMapping\s*\(\s*(?:value\s*=\s*)?['"`]([^'"`]+)['"`](?:.*?method\s*=\s*RequestMethod\.([A-Z]+))?/g
      ]
    },
    nestjs: {
      patterns: [
        /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"`]([^'"`]+)['"`]/g,
        /@(Get|Post|Put|Delete|Patch)\s*\(\s*\)/g
      ]
    },
    gin: {
      patterns: [
        /r\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*['"`]([^'"`]+)['"`]/g,
        /router\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*['"`]([^'"`]+)['"`]/g
      ]
    },
    rails: {
      patterns: [
        /(get|post|put|delete|patch)\s+['"`]([^'"`]+)['"`]/g,
        /resources?\s+:(\w+)/g,
        /namespace\s+['"`]([^'"`]+)['"`]/g
      ]
    }
  };

  constructor(vectorDB: VectorDB, llmManager: LLMManager) {
    this.vectorDB = vectorDB;
    this.llmManager = llmManager;
  }

  async detectAllEndpoints(): Promise<APIDocumentation> {
    console.log('🔍 Scanning codebase for API endpoints...');

    try {
      // Get all documents from vector database
      const allDocuments = await this.vectorDB.getAllDocuments();
      
      if (allDocuments.length === 0) {
        throw new Error('No indexed documents found. Please index the codebase first.');
      }

      // Filter for relevant files (likely to contain endpoints)
      const relevantFiles = this.filterRelevantFiles(allDocuments);
      console.log(`📁 Found ${relevantFiles.length} relevant files to analyze`);

      // Extract endpoints from each file
      const allEndpoints: APIEndpoint[] = [];
      
      for (const doc of relevantFiles) {
        const endpoints = await this.extractEndpointsFromFile(doc);
        allEndpoints.push(...endpoints);
      }

      console.log(`🎯 Discovered ${allEndpoints.length} endpoints`);

      // Enhance endpoints with additional analysis
      const enhancedEndpoints = await this.enhanceEndpoints(allEndpoints, allDocuments);

      // Group and organize endpoints
      const documentation = this.organizeEndpoints(enhancedEndpoints);

      console.log('✅ Endpoint detection completed');
      return documentation;

    } catch (error) {
      console.error('❌ Failed to detect endpoints:', error);
      throw error;
    }
  }

  private filterRelevantFiles(documents: any[]): any[] {
    return documents.filter(doc => {
      const filePath = doc.metadata?.filePath || '';
      const content = doc.content || '';

      // File path indicators
      const pathIndicators = [
        '/routes/', '/controllers/', '/handlers/', '/api/', '/endpoints/',
        '/views/', '/resources/', '/rest/', '/graphql/', '/services/'
      ];

      // Content indicators
      const contentIndicators = [
        'app.get', 'app.post', 'router.', '@app.route', '@RequestMapping',
        '@GetMapping', '@PostMapping', 'def get', 'def post', 'path(',
        'urlpatterns', 'Route::', 'gin.', 'fastapi', 'flask'
      ];

      // File extension check
      const relevantExtensions = ['.js', '.ts', '.py', '.java', '.go', '.rb', '.php', '.cs'];
      const hasRelevantExtension = relevantExtensions.some(ext => filePath.endsWith(ext));

      // Check path indicators
      const hasPathIndicator = pathIndicators.some(indicator => 
        filePath.toLowerCase().includes(indicator)
      );

      // Check content indicators
      const hasContentIndicator = contentIndicators.some(indicator => 
        content.toLowerCase().includes(indicator.toLowerCase())
      );

      return hasRelevantExtension && (hasPathIndicator || hasContentIndicator);
    });
  }

  private async extractEndpointsFromFile(document: any): Promise<APIEndpoint[]> {
    const filePath = document.metadata?.filePath || 'unknown';
    const content = document.content || '';
    const endpoints: APIEndpoint[] = [];

    // Detect framework
    const framework = this.detectFramework(content, filePath);
    
    if (!framework) {
      return endpoints;
    }

    // Get patterns for detected framework
    const patterns = this.endpointPatterns[framework as keyof typeof this.endpointPatterns];
    if (!patterns) {
      return endpoints;
    }

    // Extract endpoints using framework-specific patterns
    for (const pattern of patterns.patterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(content)) !== null) {
        const endpoint = this.parseEndpointMatch(match, framework, filePath, content);
        if (endpoint) {
          endpoints.push(endpoint);
        }
      }
    }

    // Framework-specific parsing
    if (framework === 'django') {
      const djangoEndpoints = await this.parseDjangoUrls(content, filePath);
      endpoints.push(...djangoEndpoints);
    }

    if (framework === 'rails') {
      const railsEndpoints = await this.parseRailsRoutes(content, filePath);
      endpoints.push(...railsEndpoints);
    }

    return endpoints;
  }

  private detectFramework(content: string, filePath: string): string | null {
    const frameworks = {
      express: ['express', 'app.get', 'app.post', 'router.get', 'router.post'],
      fastapi: ['fastapi', '@app.get', '@app.post', 'FastAPI'],
      flask: ['flask', '@app.route', '@bp.route', 'from flask'],
      django: ['django', 'urlpatterns', 'path(', 'from django.urls'],
      springboot: ['@RestController', '@RequestMapping', '@GetMapping', '@PostMapping'],
      nestjs: ['@Controller', '@Get', '@Post', 'nestjs'],
      gin: ['gin.', 'gin-gonic', 'r.GET', 'r.POST'],
      rails: ['Rails.application.routes', 'get ', 'post ', 'resources ']
    };

    for (const [framework, indicators] of Object.entries(frameworks)) {
      if (indicators.some(indicator => content.includes(indicator))) {
        return framework;
      }
    }

    return null;
  }

  private parseEndpointMatch(
    match: RegExpExecArray, 
    framework: string, 
    filePath: string, 
    content: string
  ): APIEndpoint | null {
    try {
      let method = '';
      let path = '';
      let handler = '';

      switch (framework) {
        case 'express':
        case 'fastapi':
        case 'gin':
          method = match[1]?.toUpperCase() || 'GET';
          path = match[2] || '';
          break;
        
        case 'flask':
          path = match[1] || '';
          method = match[2]?.toUpperCase() || 'GET';
          break;
        
        case 'springboot':
          if (match[1] === 'RequestMapping') {
            path = match[2] || '';
            method = match[3]?.toUpperCase() || 'GET';
          } else {
            method = match[1]?.toUpperCase() || 'GET';
            path = match[2] || '';
          }
          break;
        
        case 'django':
          path = match[1] || '';
          method = 'GET'; // Django URLs don't specify method in URL patterns
          break;
        
        default:
          return null;
      }

      // Extract handler/function name
      handler = this.extractHandlerName(match, content, framework);

      // Find line number
      const lineNumber = this.findLineNumber(content, match[0]);

      return {
        path: this.normalizePath(path),
        method: method.toUpperCase(),
        filePath,
        lineNumber,
        handler,
        framework,
        middleware: [],
        tags: []
      };
    } catch (error) {
      console.warn(`Failed to parse endpoint match in ${filePath}:`, error);
      return null;
    }
  }

  private extractHandlerName(match: RegExpExecArray, content: string, framework: string): string {
    const matchIndex = match.index || 0;
    const lines = content.split('\n');
    let currentLine = 0;
    let currentPos = 0;

    // Find the line containing the match
    for (let i = 0; i < lines.length; i++) {
      if (currentPos + lines[i].length >= matchIndex) {
        currentLine = i;
        break;
      }
      currentPos += lines[i].length + 1; // +1 for newline
    }

    // Look for function definition near the match
    for (let i = currentLine; i < Math.min(lines.length, currentLine + 10); i++) {
      const line = lines[i].trim();
      
      // Different patterns for different languages/frameworks
      const functionPatterns = [
        /function\s+(\w+)/,           // JavaScript function
        /(\w+)\s*:\s*\(/,             // Object method
        /def\s+(\w+)/,                // Python function
        /public\s+\w+\s+(\w+)\s*\(/,  // Java method
        /(\w+)\s*\(/,                 // General function call
      ];

      for (const pattern of functionPatterns) {
        const funcMatch = pattern.exec(line);
        if (funcMatch) {
          return funcMatch[1];
        }
      }
    }

    return 'unknown';
  }

  private findLineNumber(content: string, searchText: string): number {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchText)) {
        return i + 1;
      }
    }
    return 0;
  }

  private normalizePath(path: string): string {
    // Remove regex patterns and normalize
    let normalized = path.replace(/\$|\^|\\d\+|\\w\+|\.\*/g, '');
    
    // Convert Django/Flask parameter syntax
    normalized = normalized.replace(/<\w+:(\w+)>/g, ':$1');  // <int:id> -> :id
    normalized = normalized.replace(/<(\w+)>/g, ':$1');      // <id> -> :id
    
    // Convert Spring Boot parameter syntax
    normalized = normalized.replace(/\{(\w+)\}/g, ':$1');    // {id} -> :id
    
    // Ensure starts with /
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    return normalized;
  }

  private async parseDjangoUrls(content: string, filePath: string): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];
    
    // Parse urlpatterns
    const urlPatternsMatch = content.match(/urlpatterns\s*=\s*\[([\s\S]*?)\]/);
    if (!urlPatternsMatch) return endpoints;

    const urlsContent = urlPatternsMatch[1];
    const pathPattern = /path\s*\(\s*r?['"`]([^'"`]+)['"`]\s*,\s*(\w+)/g;
    
    let match;
    while ((match = pathPattern.exec(urlsContent)) !== null) {
      endpoints.push({
        path: this.normalizePath(match[1]),
        method: 'GET', // Django URLs don't specify method
        filePath,
        handler: match[2],
        framework: 'django',
        middleware: [],
        tags: []
      });
    }

    return endpoints;
  }

  private async parseRailsRoutes(content: string, filePath: string): Promise<APIEndpoint[]> {
    const endpoints: APIEndpoint[] = [];
    
    // Parse Rails routes
    const routePattern = /(get|post|put|delete|patch)\s+['"`]([^'"`]+)['"`](?:\s*,\s*to:\s*['"`]([^'"`]+)['"`])?/g;
    
    let match;
    while ((match = routePattern.exec(content)) !== null) {
      endpoints.push({
        path: this.normalizePath(match[2]),
        method: match[1].toUpperCase(),
        filePath,
        handler: match[3] || 'unknown',
        framework: 'rails',
        middleware: [],
        tags: []
      });
    }

    // Parse resources
    const resourcePattern = /resources?\s+:(\w+)/g;
    while ((match = resourcePattern.exec(content)) !== null) {
      const resource = match[1];
      const resourceEndpoints = [
        { method: 'GET', path: `/${resource}`, handler: `${resource}#index` },
        { method: 'GET', path: `/${resource}/:id`, handler: `${resource}#show` },
        { method: 'POST', path: `/${resource}`, handler: `${resource}#create` },
        { method: 'PUT', path: `/${resource}/:id`, handler: `${resource}#update` },
        { method: 'DELETE', path: `/${resource}/:id`, handler: `${resource}#destroy` }
      ];

      for (const endpoint of resourceEndpoints) {
        endpoints.push({
          ...endpoint,
          filePath,
          framework: 'rails',
          middleware: [],
          tags: [resource]
        });
      }
    }

    return endpoints;
  }

  private async enhanceEndpoints(endpoints: APIEndpoint[], allDocuments: any[]): Promise<APIEndpoint[]> {
    console.log('🔍 Enhancing endpoints with additional analysis...');

    const enhanced: APIEndpoint[] = [];

    for (const endpoint of endpoints) {
      try {
        // Find the actual implementation file
        const implDoc = allDocuments.find(doc => 
          doc.metadata?.filePath === endpoint.filePath
        );

        if (implDoc) {
          // Extract additional details using AI
          const details = await this.analyzeEndpointDetails(endpoint, implDoc.content);
          enhanced.push({ ...endpoint, ...details });
        } else {
          enhanced.push(endpoint);
        }
      } catch (error) {
        console.warn(`Failed to enhance endpoint ${endpoint.method} ${endpoint.path}:`, error);
        enhanced.push(endpoint);
      }
    }

    return enhanced;
  }

  private async analyzeEndpointDetails(endpoint: APIEndpoint, fileContent: string): Promise<Partial<APIEndpoint>> {
    try {
      // Find the handler function in the file
      const handlerPattern = new RegExp(`(function\\s+${endpoint.handler}|def\\s+${endpoint.handler}|${endpoint.handler}\\s*[=:]|public\\s+\\w+\\s+${endpoint.handler})([\\s\\S]*?)(?=function|def|public|$)`, 'i');
      const handlerMatch = handlerPattern.exec(fileContent);
      
      if (!handlerMatch) {
        return {};
      }

      const handlerCode = handlerMatch[0];

      // Use AI to analyze the handler code
      const analysisPrompt = `
      Analyze this API endpoint handler code and extract details:

      Endpoint: ${endpoint.method} ${endpoint.path}
      Handler: ${endpoint.handler}
      
      Code:
      \`\`\`
      ${handlerCode.substring(0, 1000)}
      \`\`\`

      Extract and return JSON with:
      {
        "description": "brief description of what this endpoint does",
        "parameters": [{"name": "param", "type": "path|query|header", "dataType": "string", "required": true}],
        "requestBody": {"contentType": "application/json", "required": true},
        "responses": [{"statusCode": 200, "description": "success response"}],
        "authentication": {"type": "bearer|none", "required": true},
        "middleware": ["auth", "validation"],
        "tags": ["user", "api"]
      }

      Only include fields that are clearly evident from the code.
      `;

      const analysis = await this.llmManager.generateResponse(analysisPrompt, {
        maxTokens: 500,
        temperature: 0.2
      });

      try {
        const parsed = JSON.parse(analysis);
        return parsed;
      } catch (parseError) {
        // Fallback to basic analysis
        return this.basicEndpointAnalysis(handlerCode, endpoint);
      }

    } catch (error) {
      console.warn(`Failed to analyze endpoint details for ${endpoint.path}:`, error);
      return {};
    }
  }

  private basicEndpointAnalysis(handlerCode: string, endpoint: APIEndpoint): Partial<APIEndpoint> {
    const details: Partial<APIEndpoint> = {};

    // Basic parameter detection
    const paramMatches = handlerCode.match(/(req\.params\.\w+|request\.args\.\w+|\$\w+|@PathVariable)/g);
    if (paramMatches) {
      details.parameters = paramMatches.map(param => ({
        name: param.split('.').pop() || param,
        type: 'path' as const,
        dataType: 'string',
        required: true
      }));
    }

    // Basic middleware detection
    const middlewareMatches = handlerCode.match(/@\w+|\.use\(\w+\)|authenticate|authorize/g);
    if (middlewareMatches) {
      details.middleware = middlewareMatches;
    }

    // Basic response detection
    if (handlerCode.includes('json') || handlerCode.includes('JSON')) {
      details.responses = [{
        statusCode: 200,
        description: 'JSON response',
        contentType: 'application/json'
      }];
    }

    return details;
  }

  private organizeEndpoints(endpoints: APIEndpoint[]): APIDocumentation {
    // Group endpoints by base path
    const groups = new Map<string, APIEndpoint[]>();
    
    for (const endpoint of endpoints) {
      const basePath = this.extractBasePath(endpoint.path);
      if (!groups.has(basePath)) {
        groups.set(basePath, []);
      }
      groups.get(basePath)!.push(endpoint);
    }

    // Create endpoint groups
    const endpointGroups: EndpointGroup[] = [];
    for (const [basePath, groupEndpoints] of groups) {
      endpointGroups.push({
        name: basePath === '/' ? 'Root' : basePath.replace('/', '').replace(/\//g, ' '),
        basePath,
        endpoints: groupEndpoints.sort((a, b) => a.path.localeCompare(b.path)),
        description: `Endpoints under ${basePath}`
      });
    }

    // Calculate statistics
    const endpointsByMethod: { [method: string]: number } = {};
    const endpointsByFramework: { [framework: string]: number } = {};

    for (const endpoint of endpoints) {
      endpointsByMethod[endpoint.method] = (endpointsByMethod[endpoint.method] || 0) + 1;
      endpointsByFramework[endpoint.framework] = (endpointsByFramework[endpoint.framework] || 0) + 1;
    }

    // Extract base URLs
    const baseUrls = [...new Set(endpoints.map(e => this.extractBasePath(e.path)))];

    return {
      totalEndpoints: endpoints.length,
      endpointsByMethod,
      endpointsByFramework,
      groups: endpointGroups.sort((a, b) => a.name.localeCompare(b.name)),
      allEndpoints: endpoints.sort((a, b) => a.path.localeCompare(b.path)),
      baseUrls
    };
  }

  private extractBasePath(path: string): string {
    const parts = path.split('/').filter(Boolean);
    if (parts.length === 0) return '/';
    if (parts.length === 1) return '/' + parts[0];
    return '/' + parts[0];
  }

  // Public utility methods
  async searchEndpoints(query: string): Promise<APIEndpoint[]> {
    const allEndpoints = await this.detectAllEndpoints();
    const lowerQuery = query.toLowerCase();
    
    return allEndpoints.allEndpoints.filter(endpoint => 
      endpoint.path.toLowerCase().includes(lowerQuery) ||
      endpoint.method.toLowerCase().includes(lowerQuery) ||
      endpoint.handler.toLowerCase().includes(lowerQuery) ||
      endpoint.description?.toLowerCase().includes(lowerQuery) ||
      endpoint.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }

  async getEndpointsByMethod(method: string): Promise<APIEndpoint[]> {
    const allEndpoints = await this.detectAllEndpoints();
    return allEndpoints.allEndpoints.filter(endpoint => 
      endpoint.method.toUpperCase() === method.toUpperCase()
    );
  }

  async getEndpointsByFramework(framework: string): Promise<APIEndpoint[]> {
    const allEndpoints = await this.detectAllEndpoints();
    return allEndpoints.allEndpoints.filter(endpoint => 
      endpoint.framework.toLowerCase() === framework.toLowerCase()
    );
  }

  async generateOpenAPISpec(): Promise<any> {
    const documentation = await this.detectAllEndpoints();
    
    // Convert to OpenAPI 3.0 specification
    const openApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'Detected API',
        version: '1.0.0',
        description: 'Auto-generated API documentation from code analysis'
      },
      paths: {} as any
    };

    for (const endpoint of documentation.allEndpoints) {
      const path = endpoint.path.replace(/:(\w+)/g, '{$1}'); // Convert :id to {id}
      
      if (!openApiSpec.paths[path]) {
        openApiSpec.paths[path] = {};
      }

      openApiSpec.paths[path][endpoint.method.toLowerCase()] = {
        summary: endpoint.description || `${endpoint.method} ${endpoint.path}`,
        operationId: endpoint.handler,
        parameters: endpoint.parameters?.map(param => ({
          name: param.name,
          in: param.type,
          required: param.required,
          schema: { type: param.dataType }
        })),
        responses: endpoint.responses?.reduce((acc, resp) => {
          acc[resp.statusCode] = {
            description: resp.description,
            content: resp.contentType ? {
              [resp.contentType]: {}
            } : undefined
          };
          return acc;
        }, {} as any) || {
          200: { description: 'Success' }
        },
        tags: endpoint.tags
      };
    }

    return openApiSpec;
  }
}