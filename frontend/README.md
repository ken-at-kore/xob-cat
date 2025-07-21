This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Route Registry and Routing Robustness

This project uses a **central route registry** (`src/routes.ts`) to define all main application routes as constants. This pattern ensures:
- All links, navigation, and tests use a single source of truth for route paths.
- Refactors or renames only require updating the route in one place.
- Accidental 404 errors due to missing or misnamed files are caught early.

### How to Add a New Route
1. **Add the route to `src/routes.ts`:**
   ```ts
   export const ROUTES = {
     DASHBOARD_SESSIONS: '/dashboard/sessions',
     // Add your new route here
   };
   ```
2. **Create the corresponding page file:**
   - For `/dashboard/sessions`, create `src/app/dashboard/sessions/page.tsx`.
3. **Use the route constant everywhere:**
   ```tsx
   import { ROUTES } from '@/routes';
   <Link href={ROUTES.DASHBOARD_SESSIONS}>Sessions</Link>
   ```

### Route Existence Tests
- **Unit/Integration Test:** `src/__tests__/routesExist.test.ts`
  - Fails if any route in the registry is missing its `page.tsx` file.
- **E2E Test:** `e2e/sessions-route.spec.ts`
  - Fails if the route returns a 404 at runtime.

### Why This Matters
- Prevents accidental 404s during refactors or test runs.
- Ensures all navigation and tests stay in sync with the actual app routes.
- Makes the codebase safer and easier to maintain.

**Always add new routes to the registry and use the constants throughout your code and tests!**
