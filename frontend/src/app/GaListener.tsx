'use client';
import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import * as gtag from '../lib/gtag';

function GaListenerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : '');
    gtag.pageview(url);
  }, [pathname, searchParams]);

  return null;
}

export default function GaListener() {
  return (
    <Suspense fallback={null}>
      <GaListenerInner />
    </Suspense>
  );
}
