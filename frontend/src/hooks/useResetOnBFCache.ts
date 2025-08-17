// useResetOnBFCache.ts
import { useEffect } from 'react';

export function useResetOnBFCache(reset: () => void) {
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Restored from bfcache
        console.log('🔄 BFCache restore detected - resetting filters');
        reset();
      }
    };
    window.addEventListener('pageshow', onPageShow as EventListener);
    return () => window.removeEventListener('pageshow', onPageShow as EventListener);
  }, [reset]);
}