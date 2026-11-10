import { Button, FormControl } from '@mui/material';
import React from 'react';
import { batch, shallowEqual, useDispatch, useSelector } from 'react-redux';
import SingleInputSelector from './SingleInputSelector';
import { CopySequenceThunk } from '@opencloning/utils/thunks';
import { cloningActions } from '@opencloning/store/cloning';

const { deleteSourceAndItsChildren } = cloningActions;

function SourceCopySequence({ source }) {
  const [id, setId] = React.useState(null);
  const allSequenceIds = useSelector((state) => state.cloning.sequences.map((sequence) => sequence.id), shallowEqual);
  const dispatch = useDispatch();

  const onSubmit = (e) => {
    e.preventDefault();
    batch(() => {
      dispatch(deleteSourceAndItsChildren(source.id));
      dispatch(CopySequenceThunk(id, source.id));
    });
  };

  return (
    <form onSubmit={onSubmit}>
      <FormControl fullWidth>
        <SingleInputSelector
          label="Sequence to copy"
          selectedId={id}
          onChange={(e) => setId(e.target.value)}
          inputSequenceIds={allSequenceIds}
        />
      </FormControl>
      <Button type="submit" variant="contained" style={{ marginTop: 15 }}>Copy sequence</Button>
    </form>
  );
}

export default SourceCopySequence;
