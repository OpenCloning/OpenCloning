import { useCallback, useEffect, useRef, useState } from 'react';

export default function useRowSelection(orderedIds = []) {
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const lastSelectedIdRef = useRef(null);
  const orderedIdsRef = useRef(orderedIds);

  const clearSelection = useCallback(() => {
    lastSelectedIdRef.current = null;
    setSelectedIds(new Set());
  }, []);

  useEffect(() => {
    orderedIdsRef.current = orderedIds;
  }, [orderedIds]);
  const toggleRow = useCallback((id, event) => {
    const ids = orderedIdsRef.current;
    const shiftKey = event?.nativeEvent?.shiftKey ?? event?.shiftKey ?? false;
    const anchorId = lastSelectedIdRef.current;
    const anchorIndex = anchorId == null ? -1 : ids.indexOf(anchorId);
    const targetIndex = ids.indexOf(id);
    const doRange = shiftKey && anchorIndex !== -1 && targetIndex !== -1;

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (doRange) {
        const [start, end] = anchorIndex <= targetIndex
          ? [anchorIndex, targetIndex]
          : [targetIndex, anchorIndex];
        for (let i = start; i <= end; i += 1) {
          next.add(ids[i]);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

    if (!doRange) {
      lastSelectedIdRef.current = id;
    }
  }, []);

  return { selectedIds, toggleRow, clearSelection };
}
