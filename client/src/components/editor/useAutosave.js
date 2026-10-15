import { useCallback, useEffect, useRef, useState } from "react";

const RETRY_MS = 4000;

/**
 * Saves `value` with `save(value)` shortly after it stops changing.
 *
 * Nothing is saved until `enabled` is true; the value at that moment counts as already saved
 * (it is what was just loaded), unless `unsavedOnLoad` says the page changed it while loading
 * (filled in a recipient, say), in which case it is saved straight away. While a change is
 * unsaved, closing the tab asks first.
 *
 * Returns { status, savedAt, flush }: status is "saved", "pending", "saving" or "error";
 * flush() saves now and resolves when it is done (call it before leaving the page).
 */
export function useAutosave(save, value, { enabled = true, delay = 800, unsavedOnLoad = false } = {}) {
  const [status, setStatus] = useState("saved");
  const [savedAt, setSavedAt] = useState(null);

  const serialized = enabled ? JSON.stringify(value) : null;
  const latest = useRef({ value, serialized });
  latest.current = { value, serialized };

  const saveRef = useRef(save);
  saveRef.current = save;

  const lastSaved = useRef(null);
  const timer = useRef(null);
  const inFlight = useRef(null);

  // A save started by a timer reports its failure through the status, not as an error
  const later = () => runRef.current().catch(() => {});
  const runRef = useRef(null);

  const run = useCallback(async () => {
    clearTimeout(timer.current);
    timer.current = null;

    // One save at a time; a change made meanwhile is saved right after
    if (inFlight.current) await inFlight.current.catch(() => {});

    const { value: current, serialized: snapshot } = latest.current;
    if (snapshot == null || snapshot === lastSaved.current) {
      setStatus("saved");
      return;
    }

    setStatus("saving");
    const attempt = Promise.resolve().then(() => saveRef.current(current));
    inFlight.current = attempt;
    try {
      await attempt;
      lastSaved.current = snapshot;
      setSavedAt(new Date());
      setStatus(latest.current.serialized === snapshot ? "saved" : "pending");
      if (latest.current.serialized !== snapshot) timer.current = setTimeout(later, delay);
    } catch (err) {
      setStatus("error");
      timer.current = setTimeout(later, RETRY_MS);
      throw err;
    } finally {
      inFlight.current = null;
    }
  }, [delay]);
  runRef.current = run;

  // What was loaded is already saved, unless the page changed it while loading
  useEffect(() => {
    if (enabled && lastSaved.current == null) lastSaved.current = unsavedOnLoad ? "" : latest.current.serialized;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  useEffect(() => {
    if (!enabled || serialized === lastSaved.current) return;
    setStatus("pending");
    clearTimeout(timer.current);
    timer.current = setTimeout(later, delay);
  }, [serialized, enabled, delay, run]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Closing the tab with work not yet saved asks first
  useEffect(() => {
    const warn = (event) => {
      if (latest.current.serialized != null && latest.current.serialized !== lastSaved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const flush = useCallback(() => run(), [run]);

  return { status, savedAt, flush };
}

/** The few words the editor's header shows for an autosave status */
export const saveStatusText = (status) =>
  ({ saved: "All changes saved", pending: "Saving…", saving: "Saving…", error: "Not saved - retrying" })[status] || "";
