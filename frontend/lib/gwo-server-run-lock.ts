/**
 * Single-flight lock for the GWO optimizer on this Node process.
 * Cancelling a run uses this controller — not the HTTP request signal — so
 * navigating away does not stop the Python child.
 */

let activeRunAbort: AbortController | null = null;

export function tryBeginGwoRun(controller: AbortController): boolean {
  if (activeRunAbort) return false;
  activeRunAbort = controller;
  return true;
}

export function endGwoRun(): void {
  activeRunAbort = null;
}

/** User-initiated cancel (and optional cleanup); returns whether a run was active. */
export function abortActiveGwoRun(): boolean {
  if (!activeRunAbort) return false;
  try {
    activeRunAbort.abort();
  } catch {
    /* ignore */
  }
  return true;
}
