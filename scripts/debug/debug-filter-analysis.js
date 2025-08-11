/**
 * Debug why filterValidSessions is rejecting all sessions
 */

const { ServiceFactory } = require('./backend/dist/backend/src/factories/serviceFactory');
const { SWTService } = require('./backend/dist/backend/src/services/swtService');

const credentials = {
  botId: '***REMOVED***',
  clientId: '***REMOVED***',
  clientSecret: '***REMOVED***'
};

async function debugFilterRejection() {
  console.log('🔍 Debugging why filterValidSessions rejects all sessions...');
  
  try {
    // Create services
    const config = {
      botId: credentials.botId,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      baseUrl: 'https://bots.kore.ai'
    };
    
    const koreApiService = ServiceFactory.createKoreApiService(config);
    const swtService = new SWTService(koreApiService);
    
    // Get a small sample of session metadata
    console.log('Getting session metadata...');
    const metadata = await koreApiService.getSessionsMetadata({
      dateFrom: '2025-08-01T13:00:00.000Z',  
      dateTo: '2025-08-01T16:00:00.000Z',
      limit: 5  // Just 5 sessions for analysis
    });
    
    console.log(`Got ${metadata.length} metadata objects`);
    
    // Convert to SWT format
    const swts = await swtService.createSWTsFromMetadata(metadata);
    console.log(`Created ${swts.length} SWT objects`);
    
    // Analyze first few sessions
    swts.slice(0, 3).forEach((session, index) => {
      console.log(`\n--- Session ${index + 1} Analysis ---`);
      console.log(`Session ID: ${session.session_id}`);
      console.log(`Messages count: ${session.messages.length}`);
      console.log(`Message count field: ${session.message_count}`);
      console.log(`User ID: ${session.user_id}`);
      console.log(`Created at: ${session.created_at}`);
      console.log(`Session type: ${session.session_type}`);
      
      // Apply the same filtering logic manually
      const MIN_MESSAGES_PER_SESSION = 2;
      let passesFilter = false;
      let reason = '';
      
      if (session.messages.length === 0) {
        // Use message_count metadata instead
        if (session.message_count >= MIN_MESSAGES_PER_SESSION) {
          passesFilter = true;
          reason = `Passes: message_count (${session.message_count}) >= ${MIN_MESSAGES_PER_SESSION}`;
        } else {
          reason = `Fails: message_count (${session.message_count}) < ${MIN_MESSAGES_PER_SESSION}`;
        }
      } else {
        if (session.messages.length >= MIN_MESSAGES_PER_SESSION) {
          passesFilter = true;
          reason = `Passes: messages.length (${session.messages.length}) >= ${MIN_MESSAGES_PER_SESSION}`;
        } else {
          reason = `Fails: messages.length (${session.messages.length}) < ${MIN_MESSAGES_PER_SESSION}`;
        }
      }
      
      console.log(`Filter result: ${passesFilter ? '✅ PASS' : '❌ FAIL'} - ${reason}`);
    });
    
  } catch (error) {
    console.error('❌ Error in filter analysis:', error.message);
  }
}

debugFilterRejection().catch(console.error);