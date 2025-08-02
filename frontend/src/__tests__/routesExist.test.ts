import fs from 'fs';
import path from 'path';
import { ROUTES } from '../routes';

describe('Route files exist', () => {
  for (const [name, route] of Object.entries(ROUTES)) {
    it(`should have a page file for ${name}`, () => {
      // Dashboard routes are in the (dashboard) route group
      const isDashboardRoute = name.startsWith('DASHBOARD_');
      const routeParts = route.split('/').filter(Boolean);
      
      const filePath = isDashboardRoute 
        ? path.join(__dirname, '../app/(dashboard)', ...routeParts, 'page.tsx')
        : path.join(__dirname, '../app', ...routeParts, 'page.tsx');
      
      expect(fs.existsSync(filePath)).toBe(true);
    });
  }
}); 