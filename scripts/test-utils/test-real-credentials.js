// Test real credentials with the sessions API
// Credentials should be set in .env.local file:
// TEST_BOT_ID=st-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
// TEST_CLIENT_ID=cs-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
// TEST_CLIENT_SECRET=your-client-secret-here
const axios = require('axios');

async function testRealCredentials() {
  console.log('🔍 Testing real credentials with sessions API...');
  
  // Check for required environment variables
  const requiredVars = ['TEST_BOT_ID', 'TEST_CLIENT_ID', 'TEST_CLIENT_SECRET'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('Please set these variables in your .env.local file and try again.');
    process.exit(1);
  }
  
  const credentials = {
    botId: process.env.TEST_BOT_ID,
    clientId: process.env.TEST_CLIENT_ID,
    clientSecret: process.env.TEST_CLIENT_SECRET
  };
  
  try {
    const response = await axios.get('http://localhost:3001/api/analysis/sessions', {
      params: {
        start_date: '2025-08-01',
        start_time: '09:00',
        end_date: '2025-08-01', 
        end_time: '12:00',
        limit: 5
      },
      headers: {
        'x-bot-id': credentials.botId,
        'x-client-id': credentials.clientId,
        'x-client-secret': credentials.clientSecret
      },
      timeout: 45000  // 45 second timeout
    });
    
    console.log('✅ Success!');
    console.log('Status:', response.status);
    console.log('Found sessions:', response.data.data?.length || 0);
    
    if (response.data.data && response.data.data.length > 0) {
      const firstSession = response.data.data[0];
      console.log('\n=== First Session ===');
      console.log('Session ID:', firstSession.session_id);
      console.log('Messages count:', firstSession.messages?.length || 0);
      
      if (firstSession.messages && firstSession.messages.length > 0) {
        const firstMessage = firstSession.messages[0];
        console.log('First message structure:', Object.keys(firstMessage));
        console.log('First message text:', firstMessage.message?.substring(0, 50) + '...');
        
        // Test if it passes the filtering logic from our fixed component
        const timestamp = firstMessage.timestamp || firstMessage.createdOn;
        const messageType = firstMessage.message_type || firstMessage.type;
        const isValidType = (firstMessage.message_type === 'user' || firstMessage.message_type === 'bot') ||
                           (firstMessage.type === 'incoming' || firstMessage.type === 'outgoing');
        
        console.log('\n=== Filter Validation ===');
        console.log('Has timestamp?', !!timestamp);
        console.log('Has message_type?', !!messageType);
        console.log('Valid type?', isValidType);
        console.log('Has message?', !!firstMessage.message);
        console.log('Should pass filter?', !!(timestamp && messageType && isValidType && firstMessage.message));
      }
    }
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error data:', error.response.data);
    }
  }
}

testRealCredentials().catch(console.error);