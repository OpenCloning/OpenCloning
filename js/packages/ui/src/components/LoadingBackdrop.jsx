import React from 'react';
import { Backdrop, CircularProgress, Stack, Typography } from '@mui/material';
import { useSelector } from 'react-redux';

// Blocks the UI while a task started with useLoadingTask is running
function LoadingBackdrop() {
  // The most recent task is the most specific one (e.g. "Validating..." inside "Loading example...")
  const message = useSelector((state) => state.cloning.loadingTasks.at(-1)?.message);

  return (
    <Backdrop
      open={message !== undefined}
      className="loading-backdrop"
      sx={(theme) => ({ zIndex: theme.zIndex.modal + 1, color: 'common.white' })}
    >
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <CircularProgress color="inherit" />
        <Typography>{message}</Typography>
      </Stack>
    </Backdrop>
  );
}

export default LoadingBackdrop;
