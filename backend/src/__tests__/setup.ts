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