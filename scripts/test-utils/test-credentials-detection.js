/**
 * Test if credentials are being detected correctly as real vs mock
 * Real credentials should be set in .env.local file:
 * TEST_BOT_ID=st-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * TEST_CLIENT_ID=cs-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 * TEST_CLIENT_SECRET=your-client-secret-here
 */

// Mock credentials from the service
const MOCK_CREDENTIALS = {
  BOT_ID: 'st-mock-bot-id-12345',
  CLIENT_ID: 'cs-mock-client-id-12345',
  CLIENT_SECRET: 'mock-client-secret-12345'
};

// Check for required environment variables
const requiredVars = ['TEST_BOT_ID', 'TEST_CLIENT_ID', 'TEST_CLIENT_SECRET'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please set these variables in your .env.local file and try again.');
  process.exit(1);
}

// Real credentials from environment variables
const REAL_CREDENTIALS = {
  botId: process.env.TEST_BOT_ID,
  clientId: process.env.TEST_CLIENT_ID,
  clientSecret: process.env.TEST_CLIENT_SECRET
};

function isMockCredentials(config) {
  return config.botId === MOCK_CREDENTIALS.BOT_ID &&
         config.clientId === MOCK_CREDENTIALS.CLIENT_ID &&
         config.clientSecret === MOCK_CREDENTIALS.CLIENT_SECRET;
}

console.log('=== TESTING CREDENTIAL DETECTION ===');

console.log('\n1. Testing real credentials:');
console.log(`   Bot ID: ${REAL_CREDENTIALS.botId}`);
console.log(`   Client ID: ${REAL_CREDENTIALS.clientId}`);
console.log(`   isMockCredentials: ${isMockCredentials(REAL_CREDENTIALS)}`);

console.log('\n2. Testing mock credentials:');
console.log(`   Bot ID: ${MOCK_CREDENTIALS.BOT_ID}`);
console.log(`   Client ID: ${MOCK_CREDENTIALS.CLIENT_ID}`);
console.log(`   isMockCredentials: ${isMockCredentials(MOCK_CREDENTIALS)}`);

console.log('\n3. Comparison:');
console.log(`   Real bot ID === Mock bot ID: ${REAL_CREDENTIALS.botId === MOCK_CREDENTIALS.BOT_ID}`);
console.log(`   Real client ID === Mock client ID: ${REAL_CREDENTIALS.clientId === MOCK_CREDENTIALS.CLIENT_ID}`);
console.log(`   Real client secret === Mock client secret: ${REAL_CREDENTIALS.clientSecret === MOCK_CREDENTIALS.CLIENT_SECRET}`);

console.log('\n✅ Real credentials should NOT be detected as mock credentials');
console.log('If they are being detected as mock, that would explain the issue!');