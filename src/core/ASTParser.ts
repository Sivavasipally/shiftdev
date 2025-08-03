import * as Parser from 'tree-sitter';
import * as path from 'path';

// Import language parsers
const JavascriptLanguage = require('tree-sitter-javascript');
const TypescriptLanguage = require('tree-sitter-typescript');
const PythonLanguage = require('tree-sitter-python');
const JavaLanguage = require('tree-sitter-java');

export interface ASTNode {
  type: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  text: string;
  children: ASTNode[];
  parent?: ASTNode;
}

export interface CodeSymbol {
  name: string;
  kind: 'class' | 'function' | 'method' | 'variable' | 'interface' | 'enum' | 'module' | 'import' | 'decorator' | 'annotation';
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  detail?: string;
  documentation?: string;
  parameters?: Parameter[];
  returnType?: string;
  visibility?: 'public' | 'private' | 'protected';
  isStatic?: boolean;
  isAsync?: boolean;
  isAbstract?: boolean;
  decorators?: string[];
  annotations?: string[];
  superClass?: string;
  interfaces?: string[];
  imports?: string[];
  exports?: string[];
}

export interface Parameter {
  name: string;
  type?: string;
  defaultValue?: string;
  optional?: boolean;
}

export interface ClassInfo {
  name: string;
  superClass?: string;
  interfaces: string[];
  methods: CodeSymbol[];
  properties: CodeSymbol[];
  constructors: CodeSymbol[];
  innerClasses: ClassInfo[];
  annotations: string[];
  visibility: 'public' | 'private' | 'protected';
  isAbstract: boolean;
  isInterface: boolean;
  isEnum: boolean;
}

export interface FunctionInfo {
  name: string;
  parameters: Parameter[];
  returnType?: string;
  visibility?: 'public' | 'private' | 'protected';
  isStatic: boolean;
  isAsync: boolean;
  isAbstract: boolean;
  decorators: string[];
  annotations: string[];
  complexity: number;
  bodyRange: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface ImportInfo {
  module: string;
  importedNames: string[];
  alias?: string;
  isDefault: boolean;
  isNamespace: boolean;
}

export interface ParseResult {
  language: string;
  symbols: CodeSymbol[];
  classes: ClassInfo[];
  functions: FunctionInfo[];
  imports: ImportInfo[];
  exports: string[];
  errors: string[];
  complexity: {
    cyclomatic: number;
    cognitive: number;
    halstead: {
      vocabulary: number;
      length: number;
      difficulty: number;
      effort: number;
    };
  };
  relationships: {
    inheritance: Array<{ child: string; parent: string }>;
    dependencies: Array<{ from: string; to: string; type: 'import' | 'call' | 'instantiation' }>;
    implementations: Array<{ class: string; interface: string }>;
  };
}

export class ASTParser {
  private parsers: Map<string, Parser> = new Map();
  private languageMap: Map<string, any> = new Map();

  constructor() {
    this.initializeParsers();
  }

  private initializeParsers(): void {
    // Initialize language parsers
    this.languageMap.set('javascript', JavascriptLanguage);
    this.languageMap.set('typescript', TypescriptLanguage.typescript);
    this.languageMap.set('tsx', TypescriptLanguage.tsx);
    this.languageMap.set('python', PythonLanguage);
    this.languageMap.set('java', JavaLanguage);

    // Create parser instances
    for (const [lang, language] of this.languageMap) {
      const parser = new Parser();
      try {
        parser.setLanguage(language);
        this.parsers.set(lang, parser);
      } catch (error) {
        console.warn(`Failed to initialize parser for ${lang}:`, error);
      }
    }
  }

  getLanguageFromFile(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();

    // Extension-based detection
    const extensionMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'tsx',
      '.py': 'python',
      '.pyw': 'python',
      '.java': 'java'
    };

    return extensionMap[ext] || 'unknown';
  }

  async parseFile(filePath: string, content: string): Promise<ParseResult> {
    const language = this.getLanguageFromFile(filePath);
    
    if (language === 'unknown') {
      return this.createEmptyResult(language, [`Unsupported file type: ${filePath}`]);
    }

    const parser = this.parsers.get(language);
    if (!parser) {
      return this.createEmptyResult(language, [`No parser available for ${language}`]);
    }

    try {
      const tree = parser.parse(content);
      const result = await this.analyzeAST(tree.rootNode, content, language);
      
      return {
        ...result,
        language,
        complexity: this.calculateComplexity(tree.rootNode, content),
        relationships: this.extractRelationships(result.symbols, result.classes, result.imports)
      };
    } catch (error) {
      console.error(`Failed to parse ${filePath}:`, error);
      return this.createEmptyResult(language, [`Parse error: ${error}`]);
    }
  }

  private async analyzeAST(rootNode: Parser.SyntaxNode, content: string, language: string): Promise<Partial<ParseResult>> {
    const symbols: CodeSymbol[] = [];
    const classes: ClassInfo[] = [];
    const functions: FunctionInfo[] = [];
    const imports: ImportInfo[] = [];
    const exports: string[] = [];
    const errors: string[] = [];

    switch (language) {
      case 'javascript':
      case 'typescript':
      case 'tsx':
        return this.analyzeJavaScriptTypeScript(rootNode, content, language);
      case 'python':
        return this.analyzePython(rootNode, content);
      case 'java':
        return this.analyzeJava(rootNode, content);
      default:
        return { symbols, classes, functions, imports, exports, errors };
    }
  }

  private analyzeJavaScriptTypeScript(rootNode: Parser.SyntaxNode, content: string, language: string): Partial<ParseResult> {
    const symbols: CodeSymbol[] = [];
    const classes: ClassInfo[] = [];
    const functions: FunctionInfo[] = [];
    const imports: ImportInfo[] = [];
    const exports: string[] = [];
    const errors: string[] = [];

    const traverse = (node: Parser.SyntaxNode) => {
      try {
        switch (node.type) {
          case 'class_declaration':
            classes.push(this.extractJSClass(node, content));
            break;
          case 'function_declaration':
          case 'function_expression':
          case 'arrow_function':
          case 'method_definition':
            functions.push(this.extractJSFunction(node, content));
            break;
          case 'import_statement':
            imports.push(this.extractJSImport(node, content));
            break;
          case 'export_statement':
            exports.push(...this.extractJSExports(node, content));
            break;
          case 'variable_declaration':
            symbols.push(...this.extractJSVariables(node, content));
            break;
          case 'interface_declaration':
            if (language === 'typescript' || language === 'tsx') {
              symbols.push(this.extractTSInterface(node, content));
            }
            break;
          case 'enum_declaration':
            if (language === 'typescript' || language === 'tsx') {
              symbols.push(this.extractTSEnum(node, content));
            }
            break;
        }

        for (const child of node.children) {
          traverse(child);
        }
      } catch (error) {
        errors.push(`Error processing node ${node.type}: ${error}`);
      }
    };

    traverse(rootNode);

    // Convert classes and functions to symbols as well
    symbols.push(...classes.map(cls => this.classToSymbol(cls)));
    symbols.push(...functions.map(fn => this.functionToSymbol(fn)));

    return { symbols, classes, functions, imports, exports, errors };
  }

  private analyzePython(rootNode: Parser.SyntaxNode, content: string): Partial<ParseResult> {
    const symbols: CodeSymbol[] = [];
    const classes: ClassInfo[] = [];
    const functions: FunctionInfo[] = [];
    const imports: ImportInfo[] = [];
    const exports: string[] = [];
    const errors: string[] = [];

    const traverse = (node: Parser.SyntaxNode) => {
      try {
        switch (node.type) {
          case 'class_definition':
            classes.push(this.extractPythonClass(node, content));
            break;
          case 'function_definition':
            functions.push(this.extractPythonFunction(node, content));
            break;
          case 'import_statement':
          case 'import_from_statement':
            imports.push(this.extractPythonImport(node, content));
            break;
          case 'assignment':
            symbols.push(...this.extractPythonVariables(node, content));
            break;
        }

        for (const child of node.children) {
          traverse(child);
        }
      } catch (error) {
        errors.push(`Error processing node ${node.type}: ${error}`);
      }
    };

    traverse(rootNode);

    // Convert classes and functions to symbols
    symbols.push(...classes.map(cls => this.classToSymbol(cls)));
    symbols.push(...functions.map(fn => this.functionToSymbol(fn)));

    return { symbols, classes, functions, imports, exports, errors };
  }

  private analyzeJava(rootNode: Parser.SyntaxNode, content: string): Partial<ParseResult> {
    const symbols: CodeSymbol[] = [];
    const classes: ClassInfo[] = [];
    const functions: FunctionInfo[] = [];
    const imports: ImportInfo[] = [];
    const exports: string[] = [];
    const errors: string[] = [];

    const traverse = (node: Parser.SyntaxNode) => {
      try {
        switch (node.type) {
          case 'class_declaration':
          case 'interface_declaration':
          case 'enum_declaration':
            classes.push(this.extractJavaClass(node, content));
            break;
          case 'method_declaration':
          case 'constructor_declaration':
            functions.push(this.extractJavaMethod(node, content));
            break;
          case 'import_declaration':
            imports.push(this.extractJavaImport(node, content));
            break;
          case 'field_declaration':
            symbols.push(...this.extractJavaFields(node, content));
            break;
        }

        for (const child of node.children) {
          traverse(child);
        }
      } catch (error) {
        errors.push(`Error processing node ${node.type}: ${error}`);
      }
    };

    traverse(rootNode);

    // Convert classes and functions to symbols
    symbols.push(...classes.map(cls => this.classToSymbol(cls)));
    symbols.push(...functions.map(fn => this.functionToSymbol(fn)));

    return { symbols, classes, functions, imports, exports, errors };
  }

  // Helper methods for extracting specific language constructs
  private extractJSClass(node: Parser.SyntaxNode, content: string): ClassInfo {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(nameNode, content) : 'anonymous';
    
    const superClass = this.extractSuperClass(node, content);
    const methods: CodeSymbol[] = [];
    const properties: CodeSymbol[] = [];
    const constructors: CodeSymbol[] = [];

    // Extract class body
    const body = node.childForFieldName('body');
    if (body) {
      for (const child of body.children) {
        if (child.type === 'method_definition') {
          const method = this.extractJSFunction(child, content);
          if (method.name === 'constructor') {
            constructors.push(this.functionToSymbol(method));
          } else {
            methods.push(this.functionToSymbol(method));
          }
        } else if (child.type === 'field_definition') {
          properties.push(this.extractJSProperty(child, content));
        }
      }
    }

    return {
      name,
      superClass,
      interfaces: [], // JavaScript doesn't have explicit interfaces
      methods,
      properties,
      constructors,
      innerClasses: [],
      annotations: this.extractDecorators(node, content),
      visibility: 'public', // JavaScript classes are public by default
      isAbstract: false,
      isInterface: false,
      isEnum: false
    };
  }

  private extractJSFunction(node: Parser.SyntaxNode, content: string): FunctionInfo {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(nameNode, content) : 'anonymous';
    
    const parameters = this.extractJSParameters(node, content);
    const isAsync = this.hasModifier(node, 'async');
    const isStatic = this.hasModifier(node, 'static');
    
    return {
      name,
      parameters,
      returnType: this.extractReturnType(node, content),
      isStatic,
      isAsync,
      isAbstract: false,
      decorators: this.extractDecorators(node, content),
      annotations: [],
      complexity: this.calculateFunctionComplexity(node),
      bodyRange: this.getNodeRange(node)
    };
  }

  private extractPythonClass(node: Parser.SyntaxNode, content: string): ClassInfo {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(nameNode, content) : 'anonymous';
    
    const superClasses = this.extractPythonSuperClasses(node, content);
    const methods: CodeSymbol[] = [];
    const properties: CodeSymbol[] = [];

    // Extract class body
    const body = node.childForFieldName('body');
    if (body) {
      for (const child of body.children) {
        if (child.type === 'function_definition') {
          const method = this.extractPythonFunction(child, content);
          methods.push(this.functionToSymbol(method));
        } else if (child.type === 'assignment') {
          properties.push(...this.extractPythonVariables(child, content));
        }
      }
    }

    return {
      name,
      superClass: superClasses[0],
      interfaces: superClasses.slice(1), // Python uses multiple inheritance
      methods,
      properties,
      constructors: methods.filter(m => m.name === '__init__'),
      innerClasses: [],
      annotations: this.extractPythonDecorators(node, content),
      visibility: this.inferPythonVisibility(name),
      isAbstract: this.isPythonAbstract(node, content),
      isInterface: false,
      isEnum: false
    };
  }

  private extractJavaClass(node: Parser.SyntaxNode, content: string): ClassInfo {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(nameNode, content) : 'anonymous';
    
    const isInterface = node.type === 'interface_declaration';
    const isEnum = node.type === 'enum_declaration';
    const isAbstract = this.hasJavaModifier(node, 'abstract');
    
    const superClass = this.extractJavaSuperClass(node, content);
    const interfaces = this.extractJavaInterfaces(node, content);
    
    const methods: CodeSymbol[] = [];
    const properties: CodeSymbol[] = [];
    const constructors: CodeSymbol[] = [];

    // Extract class body
    const body = node.childForFieldName('body');
    if (body) {
      for (const child of body.children) {
        if (child.type === 'method_declaration') {
          const method = this.extractJavaMethod(child, content);
          methods.push(this.functionToSymbol(method));
        } else if (child.type === 'constructor_declaration') {
          const constructor = this.extractJavaMethod(child, content);
          constructors.push(this.functionToSymbol(constructor));
        } else if (child.type === 'field_declaration') {
          properties.push(...this.extractJavaFields(child, content));
        }
      }
    }

    return {
      name,
      superClass,
      interfaces,
      methods,
      properties,
      constructors,
      innerClasses: [],
      annotations: this.extractJavaAnnotations(node, content),
      visibility: this.extractJavaVisibility(node),
      isAbstract,
      isInterface,
      isEnum
    };
  }

  // Utility methods
  private getNodeText(node: Parser.SyntaxNode, content: string): string {
    return content.substring(node.startIndex, node.endIndex);
  }

  private getNodeRange(node: Parser.SyntaxNode): { start: { line: number; character: number }; end: { line: number; character: number } } {
    return {
      start: { line: node.startPosition.row, character: node.startPosition.column },
      end: { line: node.endPosition.row, character: node.endPosition.column }
    };
  }

  private hasModifier(node: Parser.SyntaxNode, modifier: string): boolean {
    // Check for modifiers in the node or its children
    for (const child of node.children) {
      if (child.type === modifier || (child.type === 'identifier' && child.text === modifier)) {
        return true;
      }
    }
    return false;
  }

  private extractDecorators(node: Parser.SyntaxNode, content: string): string[] {
    const decorators: string[] = [];
    // Look for decorators before the node
    let current = node.previousSibling;
    while (current && current.type === 'decorator') {
      decorators.unshift(this.getNodeText(current, content));
      current = current.previousSibling;
    }
    return decorators;
  }

  private extractJSParameters(node: Parser.SyntaxNode, content: string): Parameter[] {
    const params: Parameter[] = [];
    const paramsNode = node.childForFieldName('parameters');
    
    if (paramsNode) {
      for (const child of paramsNode.children) {
        if (child.type === 'identifier' || child.type === 'formal_parameter') {
          const name = this.getNodeText(child, content);
          params.push({ name });
        }
      }
    }
    
    return params;
  }

  private extractReturnType(node: Parser.SyntaxNode, content: string): string | undefined {
    // For TypeScript, look for return type annotation
    const typeNode = node.childForFieldName('return_type');
    return typeNode ? this.getNodeText(typeNode, content) : undefined;
  }

  private calculateFunctionComplexity(node: Parser.SyntaxNode): number {
    let complexity = 1; // Base complexity
    
    const traverse = (n: Parser.SyntaxNode) => {
      switch (n.type) {
        case 'if_statement':
        case 'while_statement':
        case 'for_statement':
        case 'switch_statement':
        case 'catch_clause':
        case 'conditional_expression':
          complexity++;
          break;
        case 'binary_expression':
          if (n.childForFieldName('operator')?.text === '||' || 
              n.childForFieldName('operator')?.text === '&&') {
            complexity++;
          }
          break;
      }
      
      for (const child of n.children) {
        traverse(child);
      }
    };
    
    traverse(node);
    return complexity;
  }

  private calculateComplexity(rootNode: Parser.SyntaxNode, content: string): ParseResult['complexity'] {
    let cyclomatic = 1;
    let cognitive = 0;
    const operators = new Set<string>();
    const operands = new Set<string>();
    let totalOperators = 0;
    let totalOperands = 0;

    const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
      switch (node.type) {
        case 'if_statement':
        case 'while_statement':
        case 'for_statement':
        case 'switch_statement':
        case 'catch_clause':
          cyclomatic++;
          cognitive += Math.max(1, depth);
          break;
        case 'binary_expression':
          const op = node.childForFieldName('operator')?.text;
          if (op === '||' || op === '&&') {
            cyclomatic++;
            cognitive += Math.max(1, depth);
          }
          if (op) {
            operators.add(op);
            totalOperators++;
          }
          break;
        case 'identifier':
          const text = this.getNodeText(node, content);
          operands.add(text);
          totalOperands++;
          break;
      }

      const newDepth = ['if_statement', 'while_statement', 'for_statement', 'function_declaration'].includes(node.type) 
        ? depth + 1 : depth;

      for (const child of node.children) {
        traverse(child, newDepth);
      }
    };

    traverse(rootNode);

    // Calculate Halstead metrics
    const vocabulary = operators.size + operands.size;
    const length = totalOperators + totalOperands;
    const difficulty = operators.size > 0 ? (operators.size / 2) * (totalOperands / operands.size) : 0;
    const effort = difficulty * length;

    return {
      cyclomatic,
      cognitive,
      halstead: {
        vocabulary,
        length,
        difficulty,
        effort
      }
    };
  }

  private extractRelationships(symbols: CodeSymbol[], classes: ClassInfo[], imports: ImportInfo[]): ParseResult['relationships'] {
    const inheritance: Array<{ child: string; parent: string }> = [];
    const dependencies: Array<{ from: string; to: string; type: 'import' | 'call' | 'instantiation' }> = [];
    const implementations: Array<{ class: string; interface: string }> = [];

    // Extract inheritance relationships
    for (const cls of classes) {
      if (cls.superClass) {
        inheritance.push({ child: cls.name, parent: cls.superClass });
      }
      for (const iface of cls.interfaces) {
        implementations.push({ class: cls.name, interface: iface });
      }
    }

    // Extract import dependencies
    for (const imp of imports) {
      for (const name of imp.importedNames) {
        dependencies.push({ from: 'current_file', to: imp.module, type: 'import' });
      }
    }

    return { inheritance, dependencies, implementations };
  }

  private createEmptyResult(language: string, errors: string[]): ParseResult {
    return {
      language,
      symbols: [],
      classes: [],
      functions: [],
      imports: [],
      exports: [],
      errors,
      complexity: {
        cyclomatic: 0,
        cognitive: 0,
        halstead: { vocabulary: 0, length: 0, difficulty: 0, effort: 0 }
      },
      relationships: {
        inheritance: [],
        dependencies: [],
        implementations: []
      }
    };
  }

  // Conversion helpers
  private classToSymbol(cls: ClassInfo): CodeSymbol {
    return {
      name: cls.name,
      kind: cls.isInterface ? 'interface' : cls.isEnum ? 'enum' : 'class',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
      detail: `${cls.isInterface ? 'interface' : cls.isEnum ? 'enum' : 'class'} ${cls.name}`,
      annotations: cls.annotations,
      visibility: cls.visibility
    };
  }

  private functionToSymbol(fn: FunctionInfo): CodeSymbol {
    return {
      name: fn.name,
      kind: 'function',
      range: fn.bodyRange,
      detail: `function ${fn.name}(${fn.parameters.map(p => p.name).join(', ')})`,
      parameters: fn.parameters,
      returnType: fn.returnType,
      visibility: fn.visibility,
      isStatic: fn.isStatic,
      isAsync: fn.isAsync,
      decorators: fn.decorators,
      annotations: fn.annotations
    };
  }

  // Placeholder implementations for language-specific methods
  private extractSuperClass(node: Parser.SyntaxNode, content: string): string | undefined {
    // Implementation depends on language syntax
    return undefined;
  }

  private extractJSProperty(node: Parser.SyntaxNode, content: string): CodeSymbol {
    return {
      name: 'property',
      kind: 'variable',
      range: this.getNodeRange(node)
    };
  }

  private extractJSVariables(node: Parser.SyntaxNode, content: string): CodeSymbol[] {
    return [];
  }

  private extractTSInterface(node: Parser.SyntaxNode, content: string): CodeSymbol {
    return {
      name: 'interface',
      kind: 'interface',
      range: this.getNodeRange(node)
    };
  }

  private extractTSEnum(node: Parser.SyntaxNode, content: string): CodeSymbol {
    return {
      name: 'enum',
      kind: 'enum',
      range: this.getNodeRange(node)
    };
  }

  private extractJSImport(node: Parser.SyntaxNode, content: string): ImportInfo {
    return {
      module: '',
      importedNames: [],
      isDefault: false,
      isNamespace: false
    };
  }

  private extractJSExports(node: Parser.SyntaxNode, content: string): string[] {
    return [];
  }

  private extractPythonFunction(node: Parser.SyntaxNode, content: string): FunctionInfo {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(nameNode, content) : 'anonymous';
    
    return {
      name,
      parameters: [],
      isStatic: false,
      isAsync: false,
      isAbstract: false,
      decorators: [],
      annotations: [],
      complexity: this.calculateFunctionComplexity(node),
      bodyRange: this.getNodeRange(node)
    };
  }

  private extractPythonSuperClasses(node: Parser.SyntaxNode, content: string): string[] {
    return [];
  }

  private extractPythonVariables(node: Parser.SyntaxNode, content: string): CodeSymbol[] {
    return [];
  }

  private extractPythonImport(node: Parser.SyntaxNode, content: string): ImportInfo {
    return {
      module: '',
      importedNames: [],
      isDefault: false,
      isNamespace: false
    };
  }

  private extractPythonDecorators(node: Parser.SyntaxNode, content: string): string[] {
    return [];
  }

  private inferPythonVisibility(name: string): 'public' | 'private' | 'protected' {
    if (name.startsWith('__')) return 'private';
    if (name.startsWith('_')) return 'protected';
    return 'public';
  }

  private isPythonAbstract(node: Parser.SyntaxNode, content: string): boolean {
    return false;
  }

  private extractJavaMethod(node: Parser.SyntaxNode, content: string): FunctionInfo {
    const nameNode = node.childForFieldName('name');
    const name = nameNode ? this.getNodeText(nameNode, content) : 'anonymous';
    
    return {
      name,
      parameters: [],
      isStatic: this.hasJavaModifier(node, 'static'),
      isAsync: false,
      isAbstract: this.hasJavaModifier(node, 'abstract'),
      decorators: [],
      annotations: this.extractJavaAnnotations(node, content),
      complexity: this.calculateFunctionComplexity(node),
      bodyRange: this.getNodeRange(node),
      visibility: this.extractJavaVisibility(node)
    };
  }

  private extractJavaImport(node: Parser.SyntaxNode, content: string): ImportInfo {
    return {
      module: '',
      importedNames: [],
      isDefault: false,
      isNamespace: false
    };
  }

  private extractJavaFields(node: Parser.SyntaxNode, content: string): CodeSymbol[] {
    return [];
  }

  private extractJavaSuperClass(node: Parser.SyntaxNode, content: string): string | undefined {
    return undefined;
  }

  private extractJavaInterfaces(node: Parser.SyntaxNode, content: string): string[] {
    return [];
  }

  private extractJavaAnnotations(node: Parser.SyntaxNode, content: string): string[] {
    return [];
  }

  private extractJavaVisibility(node: Parser.SyntaxNode): 'public' | 'private' | 'protected' {
    return 'public';
  }

  private hasJavaModifier(node: Parser.SyntaxNode, modifier: string): boolean {
    return false;
  }
}