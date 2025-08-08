// Jest setup file to load environment variables from root .env.local
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from root .env.local
const rootDir = path.resolve(__dirname, '../../..');
const envPath = path.join(rootDir, '.env.local');

dotenv.config({ path: envPath });

console.log('🔧 [Jest Setup] Loaded environment variables from:', envPath);
console.log('🔧 [Jest Setup] TEST_BOT_ID available:', !!process.env.TEST_BOT_ID);
console.log('🔧 [Jest Setup] TEST_OPENAI_API_KEY available:', !!process.env.TEST_OPENAI_API_KEY);

// Configure Jest timers for integration tests
// Background job queue relies on setTimeout, which Jest mocks by default
if (process.env.JEST_WORKER_ID) {
  // Use real timers for integration tests to allow background job processing
  jest.useRealTimers();
  console.log('🔧 [Jest Setup] Using real timers for background job queue compatibility');
}

// Set longer timeout for integration tests (5 minutes)
// This allows tests with 100+ sessions to complete
jest.setTimeout(300000); // 5 minutes
console.log('🔧 [Jest Setup] Test timeout set to 5 minutes for integration tests');