'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import * as gtag from '../lib/gtag';

export default function GaListener() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const url = pathname + (searchParams?.toString() ? `?${searchParams}` : '');
    gtag.pageview(url);
  }, [pathname, searchParams]);

  return null;
}
