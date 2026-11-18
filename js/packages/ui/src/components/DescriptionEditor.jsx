import React, { useEffect } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { TextField, Button, FormControl, Box, Typography } from '@mui/material';
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
      {/* pre-line: show the line breaks of the description */}
      <Typography component="p" variant="inherit" sx={{ whiteSpace: 'pre-line', textAlign: 'left', mb: 1.25 }}>{text}</Typography>
      <Button onClick={onClickEditButton} variant="contained" color="success" sx={{ mt: 2 }}>Edit description</Button>

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
        <Button type="submit" variant="contained" sx={{ mt: 2 }}>Save description</Button>
      </form>
    );
  }

  return (
    <Box className="description-container" sx={{ mx: 'auto', mb: '2em', maxWidth: 600 }}>
      {textShown}
    </Box>
  );
}

export default DescriptionEditor;
