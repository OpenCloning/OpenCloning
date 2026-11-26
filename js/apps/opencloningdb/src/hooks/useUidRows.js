import React from 'react';

const newRow = (id, fields) => ({ id, uid: '', checking: false, ...fields });

/** The UIDs that appear more than once (case-insensitive, as UIDs are unique regardless of case). */
export function duplicatedUids(uids) {
  const seen = new Set();
  const duplicated = new Set();
  uids.filter(Boolean).forEach((uid) => {
    const key = uid.toLowerCase();
    if (seen.has(key)) duplicated.add(uid);
    seen.add(key);
  });
  return [...duplicated];
}

/**
 * Rows of a form to create several entities with new UIDs (see UidRowsForm). Each row is { id, uid, checking, ...fields },
 * uid '' until the field has validated it, checking while it is validated. ready: all the UIDs are valid and different.
 */
export default function useUidRows(fields = {}) {
  // The fields of new rows are those of the first render
  const [initialFields] = React.useState(fields);
  const nextIdRef = React.useRef(1);
  const [rows, setRows] = React.useState(() => [newRow(0, initialFields)]);

  // Returns the same rows if nothing changes, as the UID fields report their state on every render
  const updateRow = React.useCallback((id, changes) => setRows((prev) => {
    const row = prev.find((r) => r.id === id);
    if (!row || Object.entries(changes).every(([key, value]) => row[key] === value)) return prev;
    return prev.map((r) => (r === row ? { ...r, ...changes } : r));
  }), []);
  const addRow = () => setRows((prev) => [...prev, newRow(nextIdRef.current++, initialFields)]);
  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  const duplicates = duplicatedUids(rows.map((r) => r.uid));
  const ready = rows.every((r) => r.uid && !r.checking) && duplicates.length === 0;

  return { rows, updateRow, addRow, removeRow, duplicates, ready };
}
