const http = require('http');
const fs = require('fs');
const path = require('path');

async function collectConversationHistory() {
  console.log('Collecting session history for July 7, 2025 (12-1 PM ET / 5-6 PM UTC)...');
  
  // Create data directory if it doesn't exist
  const dataDir = '/Users/kengrafals/workspace/XOB CAT/data';
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const options = {
    hostname: 'localhost',
    port: 3001,
    path: '/api/analysis/sessions?start_date=2025-07-07T17:00:00.000Z&end_date=2025-07-07T18:00:00.000Z&limit=10000',
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  };

  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.data) {
            const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
            const filename = `session-history-july-7-1hour-${timestamp}.json`;
            const filepath = path.join(dataDir, filename);
            
            // Save the conversation history data
            fs.writeFileSync(filepath, JSON.stringify({
              collectionInfo: {
                dateRange: {
                  from: '2025-07-07T17:00:00.000Z',
                  to: '2025-07-07T18:00:00.000Z'
                },
                collectedAt: new Date().toISOString(),
                totalSessions: response.data.length,
                totalMessagesAcrossAllSessions: response.data.reduce((sum, session) => sum + (session.messages ? session.messages.length : 0), 0)
              },
              sessions: response.data
            }, null, 2));
            
            console.log(`✅ Conversation history saved to: ${filepath}`);
            console.log(`📊 Total sessions: ${response.data.length}`);
            console.log(`💬 Total messages: ${response.data.reduce((sum, session) => sum + (session.messages ? session.messages.length : 0), 0)}`);
            
            // Show sample session with messages if available
            const sessionWithMessages = response.data.find(s => s.messages && s.messages.length > 0);
            if (sessionWithMessages) {
              console.log(`📝 Sample session with ${sessionWithMessages.messages.length} messages: ${sessionWithMessages.session_id}`);
            } else {
              console.log('⚠️  No sessions found with messages in the response');
            }
            
            resolve(filepath);
          } else {
            reject(new Error('No data in response'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

collectConversationHistory().catch(console.error);