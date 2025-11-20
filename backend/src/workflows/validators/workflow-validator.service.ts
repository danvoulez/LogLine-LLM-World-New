import { Injectable } from '@nestjs/common';
import { WorkflowValidationException } from '../../common/exceptions/workflow-validation.exception';

/**
 * Service for validating workflow definitions
 */
@Injectable()
export class WorkflowValidatorService {
  /**
   * Validate workflow definition structure
   */
  validateWorkflowDefinition(definition: {
    nodes?: Array<{ id: string; type: string; [key: string]: any }>;
    edges?: Array<{ from: string; to: string; condition?: string }>;
    entryNode?: string;
  }): void {
    const errors: string[] = [];

    // Check basic structure
    if (!definition) {
      throw new WorkflowValidationException('Workflow definition is required', errors);
    }

    if (!definition.nodes || !Array.isArray(definition.nodes)) {
      errors.push('Workflow definition must have a nodes array');
    }

    if (!definition.edges || !Array.isArray(definition.edges)) {
      errors.push('Workflow definition must have an edges array');
    }

    if (!definition.entryNode) {
      errors.push('Workflow definition must have an entryNode field');
    }

    if (errors.length > 0) {
      throw new WorkflowValidationException('Invalid workflow structure', errors);
    }

    const nodes = definition.nodes!;
    const edges = definition.edges!;
    const entryNode = definition.entryNode!;

    // Validate nodes
    const nodeIds = new Set<string>();
    for (const node of nodes) {
      // Check node has required fields
      if (!node.id || typeof node.id !== 'string') {
        errors.push(`Node must have a valid id (string)`);
        continue;
      }

      // Check for duplicate node IDs
      if (nodeIds.has(node.id)) {
        errors.push(`Duplicate node ID: ${node.id}`);
      }
      nodeIds.add(node.id);

      // Check node type is valid
      const validTypes = ['static', 'agent', 'tool', 'router', 'human_gate'];
      if (!node.type || !validTypes.includes(node.type)) {
        errors.push(
          `Node ${node.id} has invalid type '${node.type}'. Must be one of: ${validTypes.join(', ')}`,
        );
      }

      // Validate node config based on type
      this.validateNodeConfig(node, errors);
    }

    // Validate entry node exists
    if (entryNode && !nodeIds.has(entryNode)) {
      errors.push(`Entry node '${entryNode}' not found in nodes array`);
    }

    // Validate edges
    for (const edge of edges) {
      if (!edge.from || typeof edge.from !== 'string') {
        errors.push(`Edge must have a valid 'from' field (string)`);
      } else if (!nodeIds.has(edge.from)) {
        errors.push(`Edge references non-existent node: ${edge.from}`);
      }

      if (!edge.to || typeof edge.to !== 'string') {
        errors.push(`Edge must have a valid 'to' field (string)`);
      } else if (!nodeIds.has(edge.to)) {
        errors.push(`Edge references non-existent node: ${edge.to}`);
      }
    }

    // Check for cycles (basic check - only detects self-loops and simple cycles)
    const cycles = this.detectCycles(nodes, edges, entryNode);
    if (cycles.length > 0) {
      errors.push(
        `Circular dependencies detected: ${cycles.map((c) => c.join(' -> ')).join(', ')}`,
      );
    }

    // Check graph connectivity (all nodes should be reachable from entry)
    if (entryNode) {
      const reachable = this.findReachableNodes(entryNode, edges);
      const unreachable = nodes
        .map((n) => n.id)
        .filter((id) => !reachable.has(id));
      if (unreachable.length > 0) {
        errors.push(
          `Unreachable nodes from entry: ${unreachable.join(', ')}`,
        );
      }
    }

    if (errors.length > 0) {
      throw new WorkflowValidationException('Workflow validation failed', errors, {
        node_count: nodes.length,
        edge_count: edges.length,
        entry_node: entryNode,
      });
    }
  }

  /**
   * Validate node configuration based on node type
   */
  private validateNodeConfig(
    node: { id: string; type: string; config?: any; [key: string]: any },
    errors: string[],
  ): void {
    const { id, type, config } = node;

    switch (type) {
      case 'agent':
        if (!config || !config.agent_id) {
          errors.push(`Agent node ${id} must have config.agent_id`);
        }
        break;

      case 'tool':
        if (!config || !config.tool_id) {
          errors.push(`Tool node ${id} must have config.tool_id`);
        }
        break;

      case 'router':
        if (config && config.router_agent_id) {
          // Router agent ID is optional, but if provided should be valid
          if (typeof config.router_agent_id !== 'string') {
            errors.push(`Router node ${id} config.router_agent_id must be a string`);
          }
        }
        if (config && config.routes) {
          if (!Array.isArray(config.routes)) {
            errors.push(`Router node ${id} config.routes must be an array`);
          } else {
            config.routes.forEach((route: any, index: number) => {
              if (!route.id || typeof route.id !== 'string') {
                errors.push(`Router node ${id} route[${index}] must have an id`);
              }
              if (!route.target_node || typeof route.target_node !== 'string') {
                errors.push(`Router node ${id} route[${index}] must have a target_node`);
              }
            });
          }
        }
        break;

      case 'static':
        // Static nodes don't require config
        break;

      case 'human_gate':
        // Human gate nodes don't require config
        break;

      default:
        // Already validated in validateWorkflowDefinition
        break;
    }
  }

  /**
   * Detect cycles in workflow graph (basic implementation)
   */
  private detectCycles(
    nodes: Array<{ id: string }>,
    edges: Array<{ from: string; to: string }>,
    entryNode?: string,
  ): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();

    const graph = new Map<string, string[]>();
    for (const edge of edges) {
      if (!graph.has(edge.from)) {
        graph.set(edge.from, []);
      }
      graph.get(edge.from)!.push(edge.to);
    }

    const dfs = (nodeId: string, path: string[]): void => {
      if (recStack.has(nodeId)) {
        // Cycle detected
        const cycleStart = path.indexOf(nodeId);
        cycles.push([...path.slice(cycleStart), nodeId]);
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        dfs(neighbor, [...path, nodeId]);
      }

      recStack.delete(nodeId);
    };

    // Start DFS from entry node or all nodes
    if (entryNode) {
      dfs(entryNode, []);
    } else {
      for (const node of nodes) {
        if (!visited.has(node.id)) {
          dfs(node.id, []);
        }
      }
    }

    return cycles;
  }

  /**
   * Find all nodes reachable from a starting node
   */
  private findReachableNodes(
    startNode: string,
    edges: Array<{ from: string; to: string }>,
  ): Set<string> {
    const reachable = new Set<string>();
    const queue: string[] = [startNode];

    const graph = new Map<string, string[]>();
    for (const edge of edges) {
      if (!graph.has(edge.from)) {
        graph.set(edge.from, []);
      }
      graph.get(edge.from)!.push(edge.to);
    }

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (reachable.has(node)) {
        continue;
      }

      reachable.add(node);
      const neighbors = graph.get(node) || [];
      queue.push(...neighbors);
    }

    return reachable;
  }
}

