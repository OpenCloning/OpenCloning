import { isEqual } from 'lodash-es';
import React from 'react';
import { useSelector } from 'react-redux';
import CodeBlock from './common/CodeBlock';
import ExternalLink from './common/ExternalLink';

function DataModelDisplayer() {
  const { sources,  sequences, primers } = useSelector((state) => state.cloning, isEqual);
  const trimmedSequences = sequences.map((s) => {
    const seqOut = { ...s };
    seqOut.file_content = '[...]';
    return seqOut;
  });

  // TODO: proper json syntax highlighting here
  return (
    <div className="data-model-displayer">
      <p>
        Visit the
        {' '}
        <ExternalLink href="https://opencloning.github.io/OpenCloning_LinkML">data model documentation</ExternalLink>
        .
      </p>

      <CodeBlock sx={{ display: 'inline-block', minWidth: '40%', maxWidth: '50%', mb: 4, whiteSpace: 'pre-wrap' }}>
        {JSON.stringify({ sources, sequences: trimmedSequences, primers }, null, 4)}
      </CodeBlock>
    </div>
  );
}

export default DataModelDisplayer;
