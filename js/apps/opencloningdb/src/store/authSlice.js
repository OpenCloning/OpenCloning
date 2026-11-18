import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  // sessionError: { message, retryable }, set when the user/workspace could not be loaded after signing in
  initialState: { user: null, workspace: null, sessionError: null },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
    },
    setWorkspace(state, action) {
      state.workspace = action.payload;
    },
    setSessionError(state, action) {
      state.sessionError = action.payload;
    },
    clearUser(state) {
      state.user = null;
    },
  },
});

export const { setUser, setWorkspace, setSessionError, clearUser } = authSlice.actions;
export default authSlice.reducer;
