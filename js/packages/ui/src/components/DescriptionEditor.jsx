import React, { useEffect } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { TextField, Button, FormControl } from '@mui/material';
import { cloningActions } from '@opencloning/store/cloning';

function DescriptionEditor() {
  const description = useSelector((state) => state.cloning.description, shallowEqual);
  const [text, setText] = React.useState('');
  const [typing, setTyping] = React.useState('');

  useEffect(
    () => {
      setText(description);
      setTyping(description === '');
    },
    [description],
  );
  const { setDescription: setDescriptionAction } = cloningActions;
  const dispatch = useDispatch();

  const onChange = (e) => {
    setText(e.target.value);
  };
  const onSubmit = (e) => {
    e.preventDefault();
    if (text === '') {
      return;
    }
    dispatch(setDescriptionAction(text));
    setTyping(false);
  };
  const onClickEditButton = () => {
    setTyping(true);
  };
  let textShown = (
    <>
      <p>{text}</p>
      <Button onClick={onClickEditButton} variant="contained" color="success" style={{ marginTop: 15 }}>Edit description</Button>

    </>
  );
  if (typing) {
    textShown = (
      <form onSubmit={onSubmit}>
        <FormControl fullWidth>
          <TextField
            id="outlined-multiline-flexible"
            multiline
            fullWidth
            onChange={onChange}
            value={text}
            label="Add a brief description"
          />
        </FormControl>
        <Button type="submit" variant="contained" style={{ marginTop: 15 }}>Save description</Button>
      </form>
    );
  }

  return (
    <div className="description-container">
      {textShown}
    </div>
  );
}

export default DescriptionEditor;
