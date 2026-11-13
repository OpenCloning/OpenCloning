import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { tg_modalState } from '@teselagen/ui';
import {
  vectorEditorReducer as VectorEditor,
  vectorEditorMiddleware,
} from '@teselagen/ove';
import { reducer as form } from 'redux-form';
import cloningReducer from './cloning';

const reducerMap = {
  form,
  tg_modalState,
  VectorEditor: VectorEditor(),
  cloning: cloningReducer,
};

const store = configureStore({
  reducer: combineReducers(reducerMap),
  // Thunk is included in the default middleware (the VectorEditor needs it).
  // The serializable / immutable dev checks are disabled: the VectorEditor and redux-form
  // state are not serializable, and deep-checking the sequence caches is very slow.
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: false,
    immutableCheck: false,
  }).concat(vectorEditorMiddleware),
  devTools: {
    actionsDenylist: ['HOVEREDANNOTATIONUPDATE', 'HOVEREDANNOTATIONCLEAR'],
    latency: 1000,
    name: 'openVE',
  },
});

export function extendStore(extraReducers) {
  store.replaceReducer(combineReducers({ ...reducerMap, ...extraReducers }));
}

export default store;
