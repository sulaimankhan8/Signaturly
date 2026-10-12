import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { adminApi, errorText } from "../api/admin.api.js";

const withoutEmpty = (params = {}) => Object.fromEntries(Object.entries(params).filter(([, value]) => value !== "" && value !== undefined && value !== null));

/**
 * Reads one thing from the API. While a newer answer is on its way the last one stays on
 * screen, so a table does not blink empty when its page or filter changes.
 * A `path` of null asks for nothing.
 */
export function useFetch(path, params) {
  const query = new URLSearchParams(withoutEmpty(params)).toString();
  const url = path ? (query ? `${path}?${query}` : path) : null;
  const [turn, setTurn] = useState(0);
  // Which request the answer on screen belongs to. Until it is this one, the hook is loading.
  const request = url ? `${turn} ${url}` : null;
  const [state, setState] = useState({ data: null, error: "", request: null });

  useEffect(() => {
    if (!url) return undefined;
    const controller = new AbortController();

    adminApi
      .get(url, { signal: controller.signal })
      .then((res) => setState({ data: res.data.data, error: "", request }))
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setState((old) => ({ data: old.data, error: errorText(err, "This could not be loaded."), request }));
      });

    return () => controller.abort();
  }, [url, request]);

  const reload = useCallback(() => setTurn((n) => n + 1), []);
  const settled = state.request === request;
  return { data: state.data, error: settled ? state.error : "", loading: Boolean(request) && !settled, reload };
}

/**
 * Filters and the page number, kept in the address bar: a refresh, the Back button and a
 * copied link all return to the same view. Changing a filter goes back to page 1.
 */
export function useQueryState(defaults) {
  const [searchParams, setSearchParams] = useSearchParams();
  const keys = Object.keys(defaults).join(",");

  const values = useMemo(() => {
    const out = {};
    for (const [key, fallback] of Object.entries(defaults)) out[key] = searchParams.get(key) ?? fallback;
    return out;
    // `defaults` is a fresh object on every render; its keys say whether it changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, keys]);

  const set = useCallback(
    (patch) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (!("page" in patch)) next.delete("page");
          for (const [key, value] of Object.entries(patch)) {
            if (value === "" || value === undefined || value === null || String(value) === String(defaults[key] ?? "")) next.delete(key);
            else next.set(key, String(value));
          }
          return next;
        },
        { replace: true }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSearchParams, keys]
  );

  return [values, set];
}

// The value, once it has stopped changing for a moment. For search boxes.
export function useDebounced(value, ms = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * A search box that types freely and writes to the address bar once typing pauses.
 * Returns the text to show and the function to call on every keystroke.
 */
export function useSearchBox(current, onSettle) {
  const [text, setText] = useState(current);
  const settled = useDebounced(text);
  const latest = useRef(onSettle);
  useEffect(() => {
    latest.current = onSettle;
  });

  // The address changed by itself (the Back button, a link): the box follows it
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setText(current);
  }

  useEffect(() => {
    if (settled !== current) latest.current(settled);
    // Only a settled keystroke writes to the address
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  return [text, setText];
}
