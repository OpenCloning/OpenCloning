import { DirectedGraph } from 'graphology';
import {
  GRAPH_SPACER,
  partsToGraph,
  partsToEdgesGraph,
  openCycleAtNode,
  graphToMSA,
  graphHasCycle
} from './graph_utils';

describe('GRAPH_SPACER', () => {
  it('is the expected spacer string', () => {
    expect(GRAPH_SPACER).toBe('---------');
  });
});

describe('partsToGraph', () => {
  it('creates nodes for each part', () => {
    const parts = [
      { left_overhang: 'A', right_overhang: 'B' },
      { left_overhang: 'C', right_overhang: 'D' }
    ];
    const graph = partsToGraph(parts);
    expect(graph.hasNode('A-B')).toBe(true);
    expect(graph.hasNode('C-D')).toBe(true);
  });

  it('connects nodes that share an overhang', () => {
    const parts = [
      { left_overhang: 'A', right_overhang: 'B' },
      { left_overhang: 'B', right_overhang: 'C' }
    ];
    const graph = partsToGraph(parts);
    expect(graph.hasEdge('A-B', 'B-C')).toBe(true);
  });

  it('does not connect nodes that do not share an overhang', () => {
    const parts = [
      { left_overhang: 'A', right_overhang: 'B' },
      { left_overhang: 'C', right_overhang: 'D' }
    ];
    const graph = partsToGraph(parts);
    expect(graph.hasEdge('A-B', 'C-D')).toBe(false);
  });

  it('handles duplicate parts', () => {
    const parts = [
      { left_overhang: 'A', right_overhang: 'B' },
      { left_overhang: 'A', right_overhang: 'B' }
    ];
    const graph = partsToGraph(parts);
    expect(graph.nodes().length).toBe(1);
    expect(graph.hasNode('A-B')).toBe(true);
  });

  it('handles empty parts array', () => {
    const graph = partsToGraph([]);
    expect(graph.nodes().length).toBe(0);
  });

  it('creates a chain of connected nodes', () => {
    const parts = [
      { left_overhang: 'A', right_overhang: 'B' },
      { left_overhang: 'B', right_overhang: 'C' },
      { left_overhang: 'C', right_overhang: 'D' }
    ];
    const graph = partsToGraph(parts);
    expect(graph.hasEdge('A-B', 'B-C')).toBe(true);
    expect(graph.hasEdge('B-C', 'C-D')).toBe(true);
  });
});

describe('partsToEdgesGraph', () => {
  it('creates nodes for each unique overhang and creates edges between them', () => {
    const parts = [
      { left_overhang: 'A', right_overhang: 'B' },
      { left_overhang: 'C', right_overhang: 'D' }
    ];
    const graph = partsToEdgesGraph(parts);
    expect(graph.hasNode('A')).toBe(true);
    expect(graph.hasNode('B')).toBe(true);
    expect(graph.hasNode('C')).toBe(true);
    expect(graph.hasNode('D')).toBe(true);
    expect(graph.hasEdge('A', 'B')).toBe(true);
    expect(graph.hasEdge('C', 'D')).toBe(true);
  });

  it('handles duplicate overhangs', () => {
    const parts = [
      { left_overhang: 'A', right_overhang: 'B' },
      { left_overhang: 'A', right_overhang: 'B' }
    ];
    const graph = partsToEdgesGraph(parts);
    expect(graph.hasNode('A')).toBe(true);
    expect(graph.hasNode('B')).toBe(true);
    expect(graph.hasEdge('A', 'B')).toBe(true);
    expect(graph.nodes().length).toBe(2);
  });

  it('handles empty parts array', () => {
    const graph = partsToEdgesGraph([]);
    expect(graph.nodes().length).toBe(0);
  });
});

describe('openCycleAtNode', () => {
  it('removes incoming edges to the specified node and does not affect outgoing edges', () => {
    const graph = new DirectedGraph();
    graph.addNode('A');
    graph.addNode('B');
    graph.addNode('C');
    graph.addEdge('A', 'B');
    graph.addEdge('B', 'C');
    graph.addEdge('C', 'B'); // Creates cycle
    
    expect(graph.inDegree('B')).toBe(2);
    const newGraph = openCycleAtNode(graph, 'B');
    expect(newGraph.inDegree('B')).toBe(0);
    expect(newGraph.outDegree('B')).toBe(1);

  });

  it('does not affect outgoing edges', () => {
    const graph = new DirectedGraph();
    graph.addNode('A');
    graph.addNode('B');
    graph.addEdge('A', 'B');
    graph.addEdge('B', 'A'); // Cycle
    
    const newGraph = openCycleAtNode(graph, 'A');
    expect(newGraph.outDegree('A')).toBe(1);
    expect(newGraph.hasEdge('A', 'B')).toBe(true);
  });

  it('handles node with no incoming edges', () => {
    const graph = new DirectedGraph();
    graph.addNode('A');
    graph.addNode('B');
    graph.addEdge('A', 'B');
    
    const newGraph = openCycleAtNode(graph, 'A');
    expect(newGraph.inDegree('A')).toBe(0);
    expect(newGraph.hasEdge('A', 'B')).toBe(true);
  });
});

describe('graphToMSA', () => {
  it('converts a simple linear DAG to MSA', () => {
    const graph = new DirectedGraph();
    graph.addNode('A');
    graph.addNode('B');
    graph.addNode('C');
    graph.addEdge('A', 'B');
    graph.addEdge('B', 'C');
    graph.addEdge('C', 'A');
    const msa = graphToMSA(graph);
    expect(msa.length).toBe(1);
    expect(msa[0]).toContain('A');
    expect(msa[0]).toContain('B');
    expect(msa[0]).toContain('C');
  });

  it('handles branching paths', () => {
    const graph = new DirectedGraph();
    graph.addNode('A');
    graph.addNode('B1');
    graph.addNode('B2');
    graph.addNode('B3');
    graph.addNode('C');
    graph.addEdge('A', 'B1');
    graph.addEdge('A', 'B2');
    graph.addEdge('B1', 'C');
    graph.addEdge('B2', 'B3');
    graph.addEdge('B3', 'C');
    graph.addEdge('C', 'A');
    const msa = graphToMSA(graph);
    expect(msa).toEqual([
      ['A', 'B2', 'B3', 'C'],
      ['A', 'B1', GRAPH_SPACER, 'C'],
    ]);
  });

  it('handles empty graph', () => {
    const graph = new DirectedGraph();
    const msa = graphToMSA(graph);
    expect(msa).toEqual([]);
  });

  it('handles single node', () => {
    const graph = new DirectedGraph();
    graph.addNode('A');
    const msa = graphToMSA(graph);
    expect(msa).toEqual([]);
  });
});


describe('graphHasCycle', () => {
  it('returns false for acyclic graph', () => {
    const graph = new DirectedGraph();
    graph.addNode('A');
    graph.addNode('B');
    graph.addNode('C');
    graph.addEdge('A', 'B');
    graph.addEdge('B', 'C');
    
    expect(graphHasCycle(graph)).toBe(false);
  });

  it('returns true for cyclic graph', () => {
    const graph = new DirectedGraph();
    graph.addNode('A');
    graph.addNode('B');
    graph.addEdge('A', 'B');
    graph.addEdge('B', 'A');
    
    expect(graphHasCycle(graph)).toBe(true);
  });

  it('handles self-loop', () => {
    const graph = new DirectedGraph();
    graph.addNode('A');
    graph.addEdge('A', 'A');
    
    expect(graphHasCycle(graph)).toBe(true);
  });

  it('handles empty graph', () => {
    const graph = new DirectedGraph();
    expect(graphHasCycle(graph)).toBe(false);
  });

  it('handles single node with no edges', () => {
    const graph = new DirectedGraph();
    graph.addNode('A');
    
    expect(graphHasCycle(graph)).toBe(false);
  });
});
