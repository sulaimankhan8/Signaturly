import { useCallback, useReducer } from "react";

// How many steps back the editor remembers
const LIMIT = 100;
// Changes with the same key this close together are one step (typing a label, nudging with arrows)
const MERGE_WINDOW_MS = 1000;

const reducer = (state, action) => {
  switch (action.type) {
    case "set": {
      const next = typeof action.update === "function" ? action.update(state.present) : action.update;
      if (next === state.present) return state;

      const now = Date.now();
      const merge = action.key && action.key === state.lastKey && now - state.lastAt < MERGE_WINDOW_MS;
      return {
        past: merge ? state.past : [...state.past, state.present].slice(-LIMIT),
        present: next,
        future: [],
        lastKey: action.key || null,
        lastAt: now,
      };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      return {
        past: state.past.slice(0, -1),
        present: state.past[state.past.length - 1],
        future: [state.present, ...state.future],
        lastKey: null,
        lastAt: 0,
      };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      return {
        past: [...state.past, state.present],
        present: state.future[0],
        future: state.future.slice(1),
        lastKey: null,
        lastAt: 0,
      };
    }
    case "reset":
      return { past: [], present: action.fields, future: [], lastKey: null, lastAt: 0 };
    default:
      return state;
  }
};

/**
 * The fields on the document with undo and redo.
 *
 * setFields(update, key?) takes a new list or a function of the old one. Pass a `key` for a run
 * of small changes that should undo as one (each keystroke of a label, each arrow-key nudge).
 */
export function useFieldHistory(initial = []) {
  const [state, dispatch] = useReducer(reducer, { past: [], present: initial, future: [], lastKey: null, lastAt: 0 });

  const setFields = useCallback((update, key = null) => dispatch({ type: "set", update, key }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const resetFields = useCallback((fields) => dispatch({ type: "reset", fields }), []);

  return {
    fields: state.present,
    setFields,
    undo,
    redo,
    resetFields,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
