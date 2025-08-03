/**
 * Debug the actual structure of session metadata from Kore.ai API
 */

const { ServiceFactory } = require('./backend/dist/backend/src/factories/serviceFactory');

const credentials = {
  botId: '***REMOVED***',
  clientId: '***REMOVED***',
  clientSecret: '***REMOVED***'
};

async function debugMetadataStructure() {
  console.log('🔍 Debugging session metadata structure from Kore.ai API...');
  
  try {
    const config = {
      botId: credentials.botId,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      baseUrl: 'https://bots.kore.ai'
    };
    
    const koreApiService = ServiceFactory.createKoreApiService(config);
    
    // Get just 1 session metadata for analysis
    const metadata = await koreApiService.getSessionsMetadata({
      dateFrom: '2025-08-01T13:00:00.000Z',  
      dateTo: '2025-08-01T16:00:00.000Z',
      limit: 1
    });
    
    console.log(`\n=== Raw Metadata Structure ===`);
    console.log('Number of metadata objects:', metadata.length);
    
    if (metadata.length > 0) {
      const firstSession = metadata[0];
      console.log('\nFirst session metadata:');
      console.log(JSON.stringify(firstSession, null, 2));
      
      console.log('\n=== Field Analysis ===');
      console.log('Available fields:', Object.keys(firstSession));
      
      console.log('\nChecking metrics field:');
      console.log('Has metrics field:', 'metrics' in firstSession);
      if ('metrics' in firstSession) {
        console.log('Metrics value:', firstSession.metrics);
        console.log('Metrics type:', typeof firstSession.metrics);
        if (firstSession.metrics && typeof firstSession.metrics === 'object') {
          console.log('Metrics keys:', Object.keys(firstSession.metrics));
        }
      }
      
      // Check for other possible message count fields
      const possibleMessageFields = [
        'messageCount', 'message_count', 'totalMessages', 'total_messages',
        'messagesCount', 'messages_count', 'numMessages', 'num_messages'
      ];
      
      console.log('\nChecking for possible message count fields:');
      possibleMessageFields.forEach(field => {
        if (field in firstSession) {
          console.log(`✅ Found ${field}:`, firstSession[field]);
        }
      });
      
      // Check nested fields
      if (firstSession.metrics) {
        console.log('\nChecking nested metrics fields:');
        possibleMessageFields.forEach(field => {
          if (firstSession.metrics[field] !== undefined) {
            console.log(`✅ Found metrics.${field}:`, firstSession.metrics[field]);
          }
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error in metadata structure analysis:', error.message);
  }
}

debugMetadataStructure().catch(console.error);