import fs from 'fs';
import path from 'path';
import { ROUTES } from '../routes';

describe('Route files exist', () => {
  for (const [name, route] of Object.entries(ROUTES)) {
    it(`should have a page file for ${name}`, () => {
      const filePath = path.join(
        __dirname,
        '../app',
        ...route.split('/').filter(Boolean),
        'page.tsx'
      );
      expect(fs.existsSync(filePath)).toBe(true);
    });
  }
}); 