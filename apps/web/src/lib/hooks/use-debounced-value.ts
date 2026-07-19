"use client";

/**
 * apps/web/src/lib/hooks/use-debounced-value.ts
 *
 * C4 (#42): trailing-edge debounce, used to turn a free-text input into a
 * SERVER-side query without firing one request per keystroke.
 *
 * Pairs with `usePaginatedList`: pass the debounced value through `params` so
 * the hook rebuilds the querystring (and resets to page 0) only once the user
 * pauses.
 */

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
