import { createSlice } from '@reduxjs/toolkit';

const appSlice = createSlice({
  name: 'opencloningdb',
  initialState: {
    alerts: [],
  },
  reducers: {
    addAlert(state, action) {
      state.alerts.push(action.payload);
    },
    removeAlert(state, action) {
      const message = action.payload;
      state.alerts = state.alerts.filter((a) => a.message !== message);
    },
  },
});

export const appActions = appSlice.actions;
export default appSlice.reducer;
