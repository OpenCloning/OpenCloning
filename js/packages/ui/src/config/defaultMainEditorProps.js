export default {
  isFullscreen: false,
  readOnly: false,
  disableBpEditing: true,
  hideSingleImport: true,
  annotationVisibility: { reverseSequence: true, cutsites: false },
  ToolBarProps: {
    toolList: [
      'downloadTool',
      'undoTool',
      'redoTool',
      'cutsiteTool',
      'featureTool',
      'findTool',
      'visibilityTool',
    ],
  },
  adjustCircularLabelSpacing: true,
  panelsShown: [[
    {
      id: 'rail',
      name: 'Linear Map',
      active: true,
    },
    {
      id: 'sequence',
      name: 'Sequence Map',
    },
    {
      id: 'circular',
      name: 'Circular Map',
    },
    {
      id: 'properties',
      name: 'Properties',
    },
  ]],
  massageCmds: (cmds) => {
    // just using the print cmd here as an example but other cmds are also valid targets for modifying
    Object.keys(cmds).forEach((key) => {
      delete cmds[key].hotkey;
    });
    return cmds;
  },
};
