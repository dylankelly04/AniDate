"use client";

import { useEffect, useState } from "react";

/**
 * Hook to prevent hydration mismatches by only rendering content on the client
 * Use this for components that depend on browser-only APIs or client state
 */
export function useClientOnly() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
