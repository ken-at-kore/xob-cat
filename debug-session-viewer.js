/**
 * Debug the session viewer with real API calls
 */

const axios = require('axios');

const credentials = {
  botId: '***REMOVED***',
  clientId: '***REMOVED***',
  clientSecret: '***REMOVED***'
};

async function testSessionViewer() {
  console.log('\n=== TESTING SESSION VIEWER WITH REAL CREDENTIALS ===');
  
  try {
    // Test the sessions API endpoint directly (what the session viewer calls)
    const response = await axios.get('http://localhost:3001/api/analysis/sessions', {
      params: {
        start_date: '2025-08-01',
        start_time: '09:00',
        end_date: '2025-08-01', 
        end_time: '12:00',
        limit: 50
      },
      headers: {
        'x-bot-id': credentials.botId,
        'x-client-id': credentials.clientId,
        'x-client-secret': credentials.clientSecret
      }
    });

    console.log(`✅ Session Viewer API: Found ${response.data.data?.length || 0} sessions`);
    console.log(`✅ Success: ${response.data.success}`);
    console.log(`✅ Message: ${response.data.message}`);
    
    if (response.data.data?.length > 0) {
      console.log('\n📋 Sample sessions:');
      response.data.data.slice(0, 3).forEach(session => {
        console.log(`  - ${session.session_id}: ${session.start_time} (${session.message_count} messages)`);
      });
      
      console.log('\n🎉 SUCCESS: Session viewer API works with real credentials!');
      console.log('This proves the credentials are valid and the bot has data.');
    } else {
      console.log('\n⚠️  No sessions found for Aug 1st 9am-12pm ET');
      console.log('Let me try a broader date range...');
      
      // Try last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const dateString = sevenDaysAgo.toISOString().split('T')[0];
      
      const broaderResponse = await axios.get('http://localhost:3001/api/analysis/sessions', {
        params: {
          start_date: dateString,
          end_date: new Date().toISOString().split('T')[0],
          limit: 50
        },
        headers: {
          'x-bot-id': credentials.botId,
          'x-client-id': credentials.clientId,
          'x-client-secret': credentials.clientSecret
        }
      });
      
      console.log(`📅 Last 7 days: Found ${broaderResponse.data.data?.length || 0} sessions`);
      
      if (broaderResponse.data.data?.length > 0) {
        console.log('\n✅ Bot has data! Sample session times:');
        broaderResponse.data.data.slice(0, 5).forEach(session => {
          console.log(`  - ${session.start_time}`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Session Viewer API Error:', error.response?.data || error.message);
  }
}

testSessionViewer().catch(console.error);