import React from 'react';
import MainSequenceEditor from './MainSequenceEditor';
import PrimerDesigner from './primers/primer_design/SequenceTabComponents/PrimerDesigner';

function SequenceTab() {
  return (
    <>
      <PrimerDesigner />
      <MainSequenceEditor />
    </>
  );
}

export default SequenceTab;
