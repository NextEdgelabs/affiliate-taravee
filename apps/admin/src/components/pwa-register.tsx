"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in PRODUCTION only. In development a cache-first
 * SW would serve stale JS chunks and cause hydration mismatches, so dev instead
 * UNREGISTERS any existing worker and clears its caches (self-healing).
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      // Dev: tear down any previously-installed worker + caches so the latest
      // build always loads fresh.
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      if ("caches" in window) {
        caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
      }
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures are non-fatal.
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
