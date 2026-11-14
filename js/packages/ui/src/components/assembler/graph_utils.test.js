import { DirectedGraph } from 'graphology';
import { partsToEdgesGraph, openCycleAtNode } from './graph_utils';

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
