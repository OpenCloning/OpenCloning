// optionally connect to the redux store
import { legacy_createStore as createStore, combineReducers, applyMiddleware, compose } from 'redux';
import { tg_modalState } from '@teselagen/ui';
import {
  vectorEditorReducer as VectorEditor,
  vectorEditorMiddleware,
} from '@teselagen/ove';
import thunk from 'redux-thunk';
import { reducer as form } from 'redux-form';
import cloningReducer from './cloning';

const composeEnhancer = (window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
      actionsBlacklist: ['HOVEREDANNOTATIONUPDATE', 'HOVEREDANNOTATIONCLEAR'],
      // actionSanitizer,
      latency: 1000,
      name: 'openVE',
    }))
  || compose;

const reducerMap = {
  form,
  tg_modalState,
  VectorEditor: VectorEditor(),
  cloning: cloningReducer,
};

const store = createStore(
  combineReducers(reducerMap),
  undefined,
  composeEnhancer(
    applyMiddleware(thunk, vectorEditorMiddleware), // your store should be redux-thunk connected for the VectorEditor component to work
  ),
);

export function extendStore(extraReducers) {
  store.replaceReducer(combineReducers({ ...reducerMap, ...extraReducers }));
}

export default store;
