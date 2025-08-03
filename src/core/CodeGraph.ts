import * as path from 'path';
import { ParseResult, CodeSymbol, ClassInfo, FunctionInfo, ImportInfo } from './ASTParser';
import { FileClassification } from './FileClassifier';

export interface GraphNode {
  id: string;
  type: 'file' | 'class' | 'function' | 'method' | 'interface' | 'enum' | 'module' | 'variable';
  name: string;
  filePath: string;
  metadata: {
    language: string;
    framework?: string;
    classification?: FileClassification;
    complexity?: number;
    lines?: number;
    visibility?: 'public' | 'private' | 'protected';
    isStatic?: boolean;
    isAsync?: boolean;
    isAbstract?: boolean;
    parameters?: Array<{ name: string; type?: string }>;
    returnType?: string;
    annotations?: string[];
    decorators?: string[];
  };
  position?: {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
  tags: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'imports' | 'extends' | 'implements' | 'calls' | 'instantiates' | 'references' | 'contains' | 'uses' | 'configures' | 'depends_on';
  weight: number;
  metadata: {
    confidence: number;
    context?: string;
    lineNumber?: number;
    isDirectDependency: boolean;
    isCircular?: boolean;
  };
}

export interface DependencyPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  totalWeight: number;
  pathType: 'direct' | 'transitive' | 'circular';
  depth: number;
}

export interface GraphCluster {
  id: string;
  name: string;
  type: 'module' | 'package' | 'feature' | 'layer' | 'framework';
  nodes: Set<string>;
  internalConnections: number;
  externalConnections: number;
  cohesion: number; // How tightly connected nodes within cluster are
  coupling: number; // How connected this cluster is to other clusters
}

export interface ArchitecturalMetrics {
  totalNodes: number;
  totalEdges: number;
  clusters: GraphCluster[];
  circularDependencies: DependencyPath[];
  abstractionLevel: number; // Ratio of abstract to concrete elements
  instability: number; // Ratio of outgoing to total dependencies
  distance: number; // Distance from main sequence (A + I - 1)
  fanIn: Map<string, number>; // Number of classes that depend on this class
  fanOut: Map<string, number>; // Number of classes this class depends on
  depthOfInheritance: Map<string, number>;
  layerViolations: Array<{ from: string; to: string; reason: string }>;
}

export class CodeGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private nodesByFile: Map<string, Set<string>> = new Map();
  private nodesByType: Map<string, Set<string>> = new Map();
  private adjacencyList: Map<string, Set<string>> = new Map();
  private reverseAdjacencyList: Map<string, Set<string>> = new Map();
  private clusters: Map<string, GraphCluster> = new Map();

  constructor() {
    this.initializeNodeTypes();
  }

  private initializeNodeTypes(): void {
    const nodeTypes = ['file', 'class', 'function', 'method', 'interface', 'enum', 'module', 'variable'];
    for (const type of nodeTypes) {
      this.nodesByType.set(type, new Set());
    }
  }

  // Main API methods
  async buildFromFiles(files: Array<{ filePath: string; astData: ParseResult; classification: FileClassification }>): Promise<void> {
    console.log('🏗️ Building code graph from', files.length, 'files...');

    // Step 1: Create nodes for all files, classes, functions, etc.
    for (const file of files) {
      await this.addFileToGraph(file.filePath, file.astData, file.classification);
    }

    // Step 2: Create edges for relationships and dependencies
    for (const file of files) {
      await this.addRelationshipsToGraph(file.filePath, file.astData);
    }

    // Step 3: Detect and create clusters
    await this.detectClusters();

    // Step 4: Identify circular dependencies
    await this.identifyCircularDependencies();

    console.log(`✅ Code graph built: ${this.nodes.size} nodes, ${this.edges.size} edges, ${this.clusters.size} clusters`);
  }

  private async addFileToGraph(filePath: string, astData: ParseResult, classification: FileClassification): Promise<void> {
    // Create file node
    const fileId = this.createNodeId('file', filePath);
    const fileNode: GraphNode = {
      id: fileId,
      type: 'file',
      name: path.basename(filePath),
      filePath,
      metadata: {
        language: astData.language,
        framework: classification.context.astData?.language,
        classification,
        complexity: astData.complexity.cyclomatic,
        lines: this.calculateFileLines(astData)
      },
      tags: this.generateFileTags(filePath, astData, classification)
    };

    this.addNode(fileNode);

    // Create nodes for classes
    for (const cls of astData.classes) {
      const classId = this.createNodeId('class', filePath, cls.name);
      const classNode: GraphNode = {
        id: classId,
        type: cls.isInterface ? 'interface' : cls.isEnum ? 'enum' : 'class',
        name: cls.name,
        filePath,
        metadata: {
          language: astData.language,
          framework: classification.context.astData?.language,
          visibility: cls.visibility,
          isAbstract: cls.isAbstract,
          annotations: cls.annotations
        },
        tags: this.generateClassTags(cls, classification)
      };

      this.addNode(classNode);

      // Create containment relationship from file to class
      this.addEdge({
        id: this.createEdgeId(fileId, classId, 'contains'),
        source: fileId,
        target: classId,
        type: 'contains',
        weight: 1.0,
        metadata: {
          confidence: 1.0,
          isDirectDependency: true
        }
      });

      // Create nodes for methods within class
      for (const method of cls.methods) {
        const methodId = this.createNodeId('method', filePath, cls.name, method.name);
        const methodNode: GraphNode = {
          id: methodId,
          type: 'method',
          name: method.name,
          filePath,
          metadata: {
            language: astData.language,
            visibility: method.visibility,
            isStatic: method.isStatic,
            isAsync: method.isAsync,
            parameters: method.parameters,
            returnType: method.returnType,
            annotations: method.annotations,
            decorators: method.decorators
          },
          tags: this.generateMethodTags(method, cls, classification)
        };

        this.addNode(methodNode);

        // Create containment relationship from class to method
        this.addEdge({
          id: this.createEdgeId(classId, methodId, 'contains'),
          source: classId,
          target: methodId,
          type: 'contains',
          weight: 1.0,
          metadata: {
            confidence: 1.0,
            isDirectDependency: true
          }
        });
      }
    }

    // Create nodes for standalone functions
    for (const fn of astData.functions) {
      const functionId = this.createNodeId('function', filePath, fn.name);
      const functionNode: GraphNode = {
        id: functionId,
        type: 'function',
        name: fn.name,
        filePath,
        metadata: {
          language: astData.language,
          framework: classification.context.astData?.language,
          complexity: fn.complexity,
          isStatic: fn.isStatic,
          isAsync: fn.isAsync,
          parameters: fn.parameters,
          returnType: fn.returnType,
          decorators: fn.decorators,
          annotations: fn.annotations
        },
        position: {
          startLine: fn.bodyRange.start.line,
          endLine: fn.bodyRange.end.line,
          startColumn: fn.bodyRange.start.character,
          endColumn: fn.bodyRange.end.character
        },
        tags: this.generateFunctionTags(fn, classification)
      };

      this.addNode(functionNode);

      // Create containment relationship from file to function
      this.addEdge({
        id: this.createEdgeId(fileId, functionId, 'contains'),
        source: fileId,
        target: functionId,
        type: 'contains',
        weight: 1.0,
        metadata: {
          confidence: 1.0,
          isDirectDependency: true
        }
      });
    }
  }

  private async addRelationshipsToGraph(filePath: string, astData: ParseResult): Promise<void> {
    const fileId = this.createNodeId('file', filePath);

    // Add import relationships
    for (const imp of astData.imports) {
      const targetId = this.findNodeByModule(imp.module);
      if (targetId) {
        this.addEdge({
          id: this.createEdgeId(fileId, targetId, 'imports'),
          source: fileId,
          target: targetId,
          type: 'imports',
          weight: imp.isDefault ? 0.8 : 0.6,
          metadata: {
            confidence: 0.9,
            context: imp.module,
            isDirectDependency: true
          }
        });
      }
    }

    // Add inheritance relationships
    for (const relationship of astData.relationships.inheritance) {
      const childId = this.findNodeByName(relationship.child, filePath);
      const parentId = this.findNodeByName(relationship.parent);

      if (childId && parentId) {
        this.addEdge({
          id: this.createEdgeId(childId, parentId, 'extends'),
          source: childId,
          target: parentId,
          type: 'extends',
          weight: 1.0,
          metadata: {
            confidence: 0.95,
            isDirectDependency: true
          }
        });
      }
    }

    // Add implementation relationships
    for (const relationship of astData.relationships.implementations) {
      const classId = this.findNodeByName(relationship.class, filePath);
      const interfaceId = this.findNodeByName(relationship.interface);

      if (classId && interfaceId) {
        this.addEdge({
          id: this.createEdgeId(classId, interfaceId, 'implements'),
          source: classId,
          target: interfaceId,
          type: 'implements',
          weight: 1.0,
          metadata: {
            confidence: 0.95,
            isDirectDependency: true
          }
        });
      }
    }

    // Add dependency relationships
    for (const relationship of astData.relationships.dependencies) {
      const fromId = this.findNodeByName(relationship.from, filePath);
      const toId = this.findNodeByName(relationship.to);

      if (fromId && toId) {
        this.addEdge({
          id: this.createEdgeId(fromId, toId, 'depends_on'),
          source: fromId,
          target: toId,
          type: 'depends_on',
          weight: 0.7,
          metadata: {
            confidence: 0.8,
            isDirectDependency: relationship.type === 'import'
          }
        });
      }
    }
  }

  private async detectClusters(): Promise<void> {
    // Detect clusters based on different criteria
    await this.detectModuleClusters();
    await this.detectLayerClusters();
    await this.detectFeatureClusters();
    await this.detectFrameworkClusters();
  }

  private async detectModuleClusters(): Promise<void> {
    // Group nodes by directory structure
    const directoryGroups = new Map<string, Set<string>>();

    for (const [nodeId, node] of this.nodes) {
      if (node.type === 'file') {
        const dir = path.dirname(node.filePath);
        if (!directoryGroups.has(dir)) {
          directoryGroups.set(dir, new Set());
        }
        directoryGroups.get(dir)!.add(nodeId);
      }
    }

    for (const [directory, nodeIds] of directoryGroups) {
      if (nodeIds.size > 1) { // Only create clusters with multiple nodes
        const clusterId = `module_${this.sanitizeId(directory)}`;
        const cluster: GraphCluster = {
          id: clusterId,
          name: path.basename(directory) || 'root',
          type: 'module',
          nodes: nodeIds,
          internalConnections: this.countInternalConnections(nodeIds),
          externalConnections: this.countExternalConnections(nodeIds),
          cohesion: 0,
          coupling: 0
        };

        cluster.cohesion = this.calculateCohesion(cluster);
        cluster.coupling = this.calculateCoupling(cluster);

        this.clusters.set(clusterId, cluster);
      }
    }
  }

  private async detectLayerClusters(): Promise<void> {
    // Group nodes by architectural layers (controller, service, repository, etc.)
    const layerGroups = new Map<string, Set<string>>();

    for (const [nodeId, node] of this.nodes) {
      const layer = this.identifyArchitecturalLayer(node);
      if (layer) {
        if (!layerGroups.has(layer)) {
          layerGroups.set(layer, new Set());
        }
        layerGroups.get(layer)!.add(nodeId);
      }
    }

    for (const [layer, nodeIds] of layerGroups) {
      if (nodeIds.size > 1) {
        const clusterId = `layer_${layer}`;
        const cluster: GraphCluster = {
          id: clusterId,
          name: layer,
          type: 'layer',
          nodes: nodeIds,
          internalConnections: this.countInternalConnections(nodeIds),
          externalConnections: this.countExternalConnections(nodeIds),
          cohesion: 0,
          coupling: 0
        };

        cluster.cohesion = this.calculateCohesion(cluster);
        cluster.coupling = this.calculateCoupling(cluster);

        this.clusters.set(clusterId, cluster);
      }
    }
  }

  private async detectFeatureClusters(): Promise<void> {
    // Use community detection algorithms to find feature clusters
    // This is a simplified implementation - could use more sophisticated algorithms
    const visited = new Set<string>();
    const featureGroups: Set<string>[] = [];

    for (const [nodeId, node] of this.nodes) {
      if (!visited.has(nodeId) && node.type !== 'file') {
        const cluster = this.findConnectedComponent(nodeId, visited);
        if (cluster.size > 2) { // Minimum cluster size
          featureGroups.push(cluster);
        }
      }
    }

    featureGroups.forEach((nodeIds, index) => {
      const clusterId = `feature_${index}`;
      const cluster: GraphCluster = {
        id: clusterId,
        name: `Feature ${index + 1}`,
        type: 'feature',
        nodes: nodeIds,
        internalConnections: this.countInternalConnections(nodeIds),
        externalConnections: this.countExternalConnections(nodeIds),
        cohesion: 0,
        coupling: 0
      };

      cluster.cohesion = this.calculateCohesion(cluster);
      cluster.coupling = this.calculateCoupling(cluster);

      this.clusters.set(clusterId, cluster);
    });
  }

  private async detectFrameworkClusters(): Promise<void> {
    // Group nodes by framework
    const frameworkGroups = new Map<string, Set<string>>();

    for (const [nodeId, node] of this.nodes) {
      const framework = node.metadata.framework;
      if (framework) {
        if (!frameworkGroups.has(framework)) {
          frameworkGroups.set(framework, new Set());
        }
        frameworkGroups.get(framework)!.add(nodeId);
      }
    }

    for (const [framework, nodeIds] of frameworkGroups) {
      if (nodeIds.size > 1) {
        const clusterId = `framework_${framework}`;
        const cluster: GraphCluster = {
          id: clusterId,
          name: framework,
          type: 'framework',
          nodes: nodeIds,
          internalConnections: this.countInternalConnections(nodeIds),
          externalConnections: this.countExternalConnections(nodeIds),
          cohesion: 0,
          coupling: 0
        };

        cluster.cohesion = this.calculateCohesion(cluster);
        cluster.coupling = this.calculateCoupling(cluster);

        this.clusters.set(clusterId, cluster);
      }
    }
  }

  private async identifyCircularDependencies(): Promise<void> {
    // Use DFS to detect cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: DependencyPath[] = [];

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        this.dfsCycleDetection(nodeId, visited, recursionStack, [], cycles);
      }
    }

    // Mark edges as circular
    for (const cycle of cycles) {
      for (const edge of cycle.edges) {
        edge.metadata.isCircular = true;
      }
    }
  }

  private dfsCycleDetection(
    nodeId: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    currentPath: string[],
    cycles: DependencyPath[]
  ): void {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    currentPath.push(nodeId);

    const neighbors = this.adjacencyList.get(nodeId) || new Set();
    for (const neighborId of neighbors) {
      if (!visited.has(neighborId)) {
        this.dfsCycleDetection(neighborId, visited, recursionStack, [...currentPath], cycles);
      } else if (recursionStack.has(neighborId)) {
        // Found a cycle
        const cycleStart = currentPath.indexOf(neighborId);
        const cycleNodes = currentPath.slice(cycleStart);
        const cycleEdges: GraphEdge[] = [];

        for (let i = 0; i < cycleNodes.length; i++) {
          const current = cycleNodes[i];
          const next = cycleNodes[(i + 1) % cycleNodes.length];
          const edge = this.findEdge(current, next);
          if (edge) {
            cycleEdges.push(edge);
          }
        }

        cycles.push({
          nodes: cycleNodes.map(id => this.nodes.get(id)!),
          edges: cycleEdges,
          totalWeight: cycleEdges.reduce((sum, edge) => sum + edge.weight, 0),
          pathType: 'circular',
          depth: cycleNodes.length
        });
      }
    }

    recursionStack.delete(nodeId);
    currentPath.pop();
  }

  // Query and analysis methods
  findDependencyPath(fromNodeId: string, toNodeId: string): DependencyPath | null {
    const visited = new Set<string>();
    const path: string[] = [];
    const edges: GraphEdge[] = [];

    if (this.dfsPath(fromNodeId, toNodeId, visited, path, edges)) {
      return {
        nodes: path.map(id => this.nodes.get(id)!),
        edges,
        totalWeight: edges.reduce((sum, edge) => sum + edge.weight, 0),
        pathType: 'direct',
        depth: path.length
      };
    }

    return null;
  }

  private dfsPath(
    current: string,
    target: string,
    visited: Set<string>,
    path: string[],
    edges: GraphEdge[]
  ): boolean {
    visited.add(current);
    path.push(current);

    if (current === target) {
      return true;
    }

    const neighbors = this.adjacencyList.get(current) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        const edge = this.findEdge(current, neighbor);
        if (edge) {
          edges.push(edge);
          if (this.dfsPath(neighbor, target, visited, path, edges)) {
            return true;
          }
          edges.pop();
        }
      }
    }

    path.pop();
    return false;
  }

  getNodesByType(type: string): GraphNode[] {
    const nodeIds = this.nodesByType.get(type) || new Set();
    return Array.from(nodeIds).map(id => this.nodes.get(id)!);
  }

  getNodesByFile(filePath: string): GraphNode[] {
    const nodeIds = this.nodesByFile.get(filePath) || new Set();
    return Array.from(nodeIds).map(id => this.nodes.get(id)!);
  }

  getDependencies(nodeId: string, includeTransitive: boolean = false): GraphNode[] {
    const dependencies = new Set<string>();
    
    if (includeTransitive) {
      this.collectTransitiveDependencies(nodeId, dependencies, new Set());
    } else {
      const neighbors = this.adjacencyList.get(nodeId) || new Set();
      neighbors.forEach(dep => dependencies.add(dep));
    }

    return Array.from(dependencies).map(id => this.nodes.get(id)!).filter(Boolean);
  }

  private collectTransitiveDependencies(nodeId: string, dependencies: Set<string>, visited: Set<string>): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const neighbors = this.adjacencyList.get(nodeId) || new Set();
    for (const neighbor of neighbors) {
      dependencies.add(neighbor);
      this.collectTransitiveDependencies(neighbor, dependencies, visited);
    }
  }

  getDependents(nodeId: string, includeTransitive: boolean = false): GraphNode[] {
    const dependents = new Set<string>();
    
    if (includeTransitive) {
      this.collectTransitiveDependents(nodeId, dependents, new Set());
    } else {
      const reverseDeps = this.reverseAdjacencyList.get(nodeId) || new Set();
      reverseDeps.forEach(dep => dependents.add(dep));
    }

    return Array.from(dependents).map(id => this.nodes.get(id)!).filter(Boolean);
  }

  private collectTransitiveDependents(nodeId: string, dependents: Set<string>, visited: Set<string>): void {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const reverseDeps = this.reverseAdjacencyList.get(nodeId) || new Set();
    for (const dependent of reverseDeps) {
      dependents.add(dependent);
      this.collectTransitiveDependents(dependent, dependents, visited);
    }
  }

  calculateArchitecturalMetrics(): ArchitecturalMetrics {
    const fanIn = new Map<string, number>();
    const fanOut = new Map<string, number>();
    const depthOfInheritance = new Map<string, number>();
    const circularDependencies: DependencyPath[] = [];

    // Calculate fan-in and fan-out
    for (const [nodeId, node] of this.nodes) {
      if (node.type === 'class' || node.type === 'interface') {
        const dependencies = this.adjacencyList.get(nodeId) || new Set();
        const dependents = this.reverseAdjacencyList.get(nodeId) || new Set();
        
        fanOut.set(nodeId, dependencies.size);
        fanIn.set(nodeId, dependents.size);
      }
    }

    // Calculate depth of inheritance
    for (const [nodeId, node] of this.nodes) {
      if (node.type === 'class') {
        depthOfInheritance.set(nodeId, this.calculateInheritanceDepth(nodeId));
      }
    }

    // Get circular dependencies (already detected)
    for (const edge of this.edges.values()) {
      if (edge.metadata.isCircular) {
        // Add to circular dependencies list
      }
    }

    // Calculate abstraction and instability
    let abstractClasses = 0;
    let concreteClasses = 0;
    let totalOutgoingDeps = 0;
    let totalDeps = 0;

    for (const [nodeId, node] of this.nodes) {
      if (node.type === 'class' || node.type === 'interface') {
        if (node.metadata.isAbstract || node.type === 'interface') {
          abstractClasses++;
        } else {
          concreteClasses++;
        }

        const outgoing = fanOut.get(nodeId) || 0;
        const incoming = fanIn.get(nodeId) || 0;
        totalOutgoingDeps += outgoing;
        totalDeps += outgoing + incoming;
      }
    }

    const totalClasses = abstractClasses + concreteClasses;
    const abstractionLevel = totalClasses > 0 ? abstractClasses / totalClasses : 0;
    const instability = totalDeps > 0 ? totalOutgoingDeps / totalDeps : 0;
    const distance = Math.abs(abstractionLevel + instability - 1);

    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      clusters: Array.from(this.clusters.values()),
      circularDependencies,
      abstractionLevel,
      instability,
      distance,
      fanIn,
      fanOut,
      depthOfInheritance,
      layerViolations: this.detectLayerViolations()
    };
  }

  private calculateInheritanceDepth(nodeId: string): number {
    const visited = new Set<string>();
    return this.calculateDepthRecursive(nodeId, visited);
  }

  private calculateDepthRecursive(nodeId: string, visited: Set<string>): number {
    if (visited.has(nodeId)) return 0; // Prevent infinite recursion
    visited.add(nodeId);

    let maxDepth = 0;
    
    // Find parent classes through 'extends' edges
    for (const edge of this.edges.values()) {
      if (edge.source === nodeId && edge.type === 'extends') {
        const parentDepth = this.calculateDepthRecursive(edge.target, new Set(visited));
        maxDepth = Math.max(maxDepth, parentDepth + 1);
      }
    }

    return maxDepth;
  }

  private detectLayerViolations(): Array<{ from: string; to: string; reason: string }> {
    const violations: Array<{ from: string; to: string; reason: string }> = [];
    
    // Define layer hierarchy (lower numbers are higher in the hierarchy)
    const layerHierarchy = {
      'controller': 1,
      'service': 2,
      'repository': 3,
      'model': 4
    };

    for (const edge of this.edges.values()) {
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);

      if (sourceNode && targetNode) {
        const sourceLayer = this.identifyArchitecturalLayer(sourceNode);
        const targetLayer = this.identifyArchitecturalLayer(targetNode);

        if (sourceLayer && targetLayer) {
          const sourceLevel = layerHierarchy[sourceLayer as keyof typeof layerHierarchy];
          const targetLevel = layerHierarchy[targetLayer as keyof typeof layerHierarchy];

          // Violation if lower layer depends on higher layer
          if (sourceLevel && targetLevel && sourceLevel > targetLevel) {
            violations.push({
              from: edge.source,
              to: edge.target,
              reason: `${sourceLayer} should not depend on ${targetLayer}`
            });
          }
        }
      }
    }

    return violations;
  }

  // Utility methods
  private addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    
    // Update indices
    if (!this.nodesByFile.has(node.filePath)) {
      this.nodesByFile.set(node.filePath, new Set());
    }
    this.nodesByFile.get(node.filePath)!.add(node.id);
    
    this.nodesByType.get(node.type)!.add(node.id);
    
    // Initialize adjacency lists
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, new Set());
    }
    if (!this.reverseAdjacencyList.has(node.id)) {
      this.reverseAdjacencyList.set(node.id, new Set());
    }
  }

  private addEdge(edge: GraphEdge): void {
    this.edges.set(edge.id, edge);
    
    // Update adjacency lists
    this.adjacencyList.get(edge.source)!.add(edge.target);
    this.reverseAdjacencyList.get(edge.target)!.add(edge.source);
  }

  private createNodeId(type: string, filePath: string, ...identifiers: string[]): string {
    const parts = [type, this.sanitizeId(filePath), ...identifiers.map(id => this.sanitizeId(id))];
    return parts.join('::');
  }

  private createEdgeId(source: string, target: string, type: string): string {
    return `${source}--${type}-->${target}`;
  }

  private sanitizeId(input: string): string {
    return input.replace(/[^a-zA-Z0-9_]/g, '_');
  }

  private findNodeByModule(moduleName: string): string | null {
    // Simple heuristic to find nodes by module name
    for (const [nodeId, node] of this.nodes) {
      if (node.name === moduleName || node.filePath.includes(moduleName)) {
        return nodeId;
      }
    }
    return null;
  }

  private findNodeByName(name: string, filePath?: string): string | null {
    for (const [nodeId, node] of this.nodes) {
      if (node.name === name && (!filePath || node.filePath === filePath)) {
        return nodeId;
      }
    }
    return null;
  }

  private findEdge(source: string, target: string): GraphEdge | null {
    for (const edge of this.edges.values()) {
      if (edge.source === source && edge.target === target) {
        return edge;
      }
    }
    return null;
  }

  private identifyArchitecturalLayer(node: GraphNode): string | null {
    const lowerName = node.name.toLowerCase();
    const lowerPath = node.filePath.toLowerCase();

    if (lowerName.includes('controller') || lowerPath.includes('controller')) return 'controller';
    if (lowerName.includes('service') || lowerPath.includes('service')) return 'service';
    if (lowerName.includes('repository') || lowerName.includes('dao') || lowerPath.includes('repository')) return 'repository';
    if (lowerName.includes('model') || lowerName.includes('entity') || lowerPath.includes('model')) return 'model';
    if (lowerName.includes('component') || lowerPath.includes('component')) return 'component';
    if (lowerName.includes('view') || lowerPath.includes('view')) return 'view';

    return null;
  }

  private calculateFileLines(astData: ParseResult): number {
    // Estimate file lines from AST data
    let maxLine = 0;
    
    for (const fn of astData.functions) {
      maxLine = Math.max(maxLine, fn.bodyRange.end.line);
    }
    
    return maxLine || 1;
  }

  private generateFileTags(filePath: string, astData: ParseResult, classification: FileClassification): string[] {
    const tags: string[] = [];
    
    tags.push(`lang:${astData.language}`);
    if (classification.primary) tags.push(`framework:${classification.primary}`);
    if (classification.secondary) tags.push(`type:${classification.secondary}`);
    if (classification.tertiary) tags.push(`role:${classification.tertiary}`);
    
    if (astData.classes.length > 0) tags.push('has-classes');
    if (astData.functions.length > 0) tags.push('has-functions');
    if (astData.imports.length > 0) tags.push('has-imports');
    
    return tags;
  }

  private generateClassTags(cls: ClassInfo, classification: FileClassification): string[] {
    const tags: string[] = [];
    
    if (cls.isAbstract) tags.push('abstract');
    if (cls.isInterface) tags.push('interface');
    if (cls.isEnum) tags.push('enum');
    if (cls.visibility) tags.push(`visibility:${cls.visibility}`);
    if (cls.annotations.length > 0) tags.push('annotated');
    
    return tags;
  }

  private generateMethodTags(method: CodeSymbol, cls: ClassInfo, classification: FileClassification): string[] {
    const tags: string[] = [];
    
    if (method.isStatic) tags.push('static');
    if (method.isAsync) tags.push('async');
    if (method.visibility) tags.push(`visibility:${method.visibility}`);
    if (method.decorators && method.decorators.length > 0) tags.push('decorated');
    if (method.annotations && method.annotations.length > 0) tags.push('annotated');
    
    return tags;
  }

  private generateFunctionTags(fn: FunctionInfo, classification: FileClassification): string[] {
    const tags: string[] = [];
    
    if (fn.isStatic) tags.push('static');
    if (fn.isAsync) tags.push('async');
    if (fn.complexity > 10) tags.push('complex');
    if (fn.decorators.length > 0) tags.push('decorated');
    if (fn.annotations.length > 0) tags.push('annotated');
    
    return tags;
  }

  private countInternalConnections(nodeIds: Set<string>): number {
    let count = 0;
    for (const edge of this.edges.values()) {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        count++;
      }
    }
    return count;
  }

  private countExternalConnections(nodeIds: Set<string>): number {
    let count = 0;
    for (const edge of this.edges.values()) {
      if ((nodeIds.has(edge.source) && !nodeIds.has(edge.target)) ||
          (!nodeIds.has(edge.source) && nodeIds.has(edge.target))) {
        count++;
      }
    }
    return count;
  }

  private calculateCohesion(cluster: GraphCluster): number {
    const nodeCount = cluster.nodes.size;
    if (nodeCount <= 1) return 1.0;
    
    const maxPossibleConnections = (nodeCount * (nodeCount - 1)) / 2;
    return maxPossibleConnections > 0 ? cluster.internalConnections / maxPossibleConnections : 0;
  }

  private calculateCoupling(cluster: GraphCluster): number {
    const totalNodes = this.nodes.size;
    const externalNodes = totalNodes - cluster.nodes.size;
    if (externalNodes <= 0) return 0;
    
    const maxPossibleExternalConnections = cluster.nodes.size * externalNodes;
    return maxPossibleExternalConnections > 0 ? cluster.externalConnections / maxPossibleExternalConnections : 0;
  }

  private findConnectedComponent(startNodeId: string, visited: Set<string>): Set<string> {
    const component = new Set<string>();
    const stack = [startNodeId];
    
    while (stack.length > 0) {
      const nodeId = stack.pop()!;
      if (!visited.has(nodeId)) {
        visited.add(nodeId);
        component.add(nodeId);
        
        // Add neighbors to stack
        const neighbors = this.adjacencyList.get(nodeId) || new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            stack.push(neighbor);
          }
        }
      }
    }
    
    return component;
  }

  // Export methods for analysis
  exportToJSON(): any {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
      clusters: Array.from(this.clusters.values()),
      metadata: {
        nodeCount: this.nodes.size,
        edgeCount: this.edges.size,
        clusterCount: this.clusters.size
      }
    };
  }

  exportToDot(): string {
    let dot = 'digraph CodeGraph {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box];\n\n';

    // Add nodes
    for (const node of this.nodes.values()) {
      const label = `${node.name}\\n${node.type}`;
      const color = this.getNodeColor(node.type);
      dot += `  "${node.id}" [label="${label}", fillcolor="${color}", style=filled];\n`;
    }

    dot += '\n';

    // Add edges
    for (const edge of this.edges.values()) {
      const style = this.getEdgeStyle(edge.type);
      const color = edge.metadata.isCircular ? 'red' : 'black';
      dot += `  "${edge.source}" -> "${edge.target}" [label="${edge.type}", style="${style}", color="${color}"];\n`;
    }

    dot += '}\n';
    return dot;
  }

  private getNodeColor(type: string): string {
    const colors = {
      'file': 'lightblue',
      'class': 'lightgreen',
      'interface': 'lightcoral',
      'function': 'lightyellow',
      'method': 'lightpink',
      'enum': 'lightgray'
    };
    return colors[type as keyof typeof colors] || 'white';
  }

  private getEdgeStyle(type: string): string {
    const styles = {
      'imports': 'dashed',
      'extends': 'solid',
      'implements': 'dotted',
      'contains': 'bold',
      'calls': 'solid',
      'depends_on': 'dashed'
    };
    return styles[type as keyof typeof styles] || 'solid';
  }
}