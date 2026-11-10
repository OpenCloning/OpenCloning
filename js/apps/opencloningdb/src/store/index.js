import store, { extendStore } from '@opencloning/store';
import appReducer from './appReducer';
import authReducer from './authSlice';

extendStore({ opencloningdb: appReducer, auth: authReducer });

export default store;
