export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || '';

declare global {
  interface Window { dataLayer: any[]; gtag: (...args:any[]) => void }
}

export const pageview = (path: string) => {
  if (!GA_ID || typeof window === 'undefined') return;
  window.gtag('event', 'page_view', { page_path: path });
};

export const event = (name: string, params: Record<string, any> = {}) => {
  if (!GA_ID || typeof window === 'undefined') return;
  window.gtag('event', name, params);
};
