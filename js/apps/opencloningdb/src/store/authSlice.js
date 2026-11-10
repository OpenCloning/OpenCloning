import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: { user: null, workspace: null },
  reducers: {
    setUser(state, action) {
      state.user = action.payload;
    },
    setWorkspace(state, action) {
      state.workspace = action.payload;
    },
    clearUser(state) {
      state.user = null;
    },
  },
});

export const { setUser, setWorkspace, clearUser } = authSlice.actions;
export default authSlice.reducer;
