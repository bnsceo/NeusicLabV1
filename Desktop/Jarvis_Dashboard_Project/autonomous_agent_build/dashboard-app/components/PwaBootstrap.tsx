'use client';

import { useEffect } from 'react';

export default function PwaBootstrap() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      let cancelled = false;

      const clearDevShell = async () => {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }

        if (cancelled) return;

        if (sessionStorage.getItem('cyvora-dev-cache-busted') !== '1') {
          sessionStorage.setItem('cyvora-dev-cache-busted', '1');
          window.location.reload();
        }
      };

      void clearDevShell().catch((error) => {
        console.warn('Failed to clear dev service worker state', error);
      });

      return () => {
        cancelled = true;
      };
    }

    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Failed to register service worker', error);
    });
  }, []);

  return null;
}
