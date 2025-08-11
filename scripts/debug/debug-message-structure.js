// Debug the message structure from mock service
const axios = require('axios');

async function debugMessageStructure() {
  console.log('🔍 Debugging message structure from mock service...');
  
  try {
    const response = await axios.get('http://localhost:3001/api/analysis/sessions', {
      params: { limit: 1 },
      headers: {
        'x-bot-id': 'st-mock-bot-id-12345',
        'x-client-id': 'cs-mock-client-id-67890',
        'x-client-secret': 'mock-client-secret-abcdef'
      }
    });
    
    if (response.data.data && response.data.data.length > 0) {
      const firstSession = response.data.data[0];
      console.log('\n=== Session Structure ===');
      console.log('Session ID:', firstSession.session_id);
      console.log('Messages array length:', firstSession.messages?.length || 0);
      
      if (firstSession.messages && firstSession.messages.length > 0) {
        console.log('\n=== First Message Structure ===');
        const firstMessage = firstSession.messages[0];
        console.log('Message keys:', Object.keys(firstMessage));
        console.log('Full message structure:');
        console.log(JSON.stringify(firstMessage, null, 2));
        
        console.log('\n=== Validation Check ===');
        console.log('Has timestamp?', !!firstMessage.timestamp);
        console.log('Has message_type?', !!firstMessage.message_type);
        console.log('message_type value:', firstMessage.message_type);
        console.log('Has message?', !!firstMessage.message);
        console.log('message value:', firstMessage.message);
        console.log('message is string?', typeof firstMessage.message === 'string');
        console.log('message length:', firstMessage.message?.length || 0);
        console.log('message trimmed length:', firstMessage.message?.trim().length || 0);
        
        // Test the exact filter logic from SessionDetailsDialog
        const passesFilter = 
          firstMessage && 
          typeof firstMessage === 'object' &&
          firstMessage.timestamp && 
          firstMessage.message_type && 
          (firstMessage.message_type === 'user' || firstMessage.message_type === 'bot') &&
          firstMessage.message &&
          typeof firstMessage.message === 'string' &&
          firstMessage.message.trim().length > 0;
          
        console.log('\n=== Filter Test Result ===');
        console.log('Would pass SessionDetailsDialog filter?', passesFilter);
        
      } else {
        console.log('❌ No messages found in session');
      }
      
    } else {
      console.log('❌ No sessions returned');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

debugMessageStructure().catch(console.error);