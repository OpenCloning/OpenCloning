import { DirectedGraph } from 'graphology';

// Graph where the nodes are the overhangs, and each part is an edge from its left to its right overhang
export function partsToEdgesGraph(parts) {
  const graph = new DirectedGraph();
  for (const part of parts) {
    for (const node of [part.left_overhang, part.right_overhang]) {
      if (!graph.hasNode(node)) {
        graph.addNode(node);
      }
    }
    graph.mergeEdge(part.left_overhang, part.right_overhang);
  }
  return graph;
}

// Break cycles by removing incoming edges to a node
export function openCycleAtNode(graph, cutNode) {
  const newGraph = graph.copy();
  for (const edge of newGraph.inEdges(cutNode)) {
    newGraph.dropEdge(edge);
  }
  return newGraph;
}
