#!/bin/bash

# Run the Playwright E2E test for the sessions page from the frontend directory

cd "$(dirname "$0")/frontend"
npx playwright test e2e/sessions-page.spec.ts