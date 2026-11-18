import React from 'react';
import { Box } from '@mui/material';

const nodeColor = (isSavedToDatabase) => (isSavedToDatabase ? 'savedToDatabase.main' : 'primary.main');

// The box of a node of the cloning tree (a source or a sequence). The tree layout is in NetworkTree.css.
// Nodes saved in the database are drawn in the savedToDatabase colour.
export function TreeNodeContent({ isSavedToDatabase = false, children }) {
  return (
    <Box component="span" className="tf-nc" sx={{ border: 3, borderColor: nodeColor(isSavedToDatabase) }}>
      <span className="node-text">
        {children}
      </span>
    </Box>
  );
}

// The id of a node, in its top-left corner
export function TreeNodeId({ isSavedToDatabase = false, children }) {
  return (
    <Box
      className="corner-id"
      sx={{
        position: 'absolute',
        left: 0,
        top: 0,
        fontSize: 'large',
        fontWeight: 'bold',
        color: nodeColor(isSavedToDatabase),
      }}
    >
      {children}
    </Box>
  );
}
